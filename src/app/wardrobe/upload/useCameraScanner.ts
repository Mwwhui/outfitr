'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  DetectedItem,
  OverlayBox,
  EditItem,
  COUNTDOWN_SECONDS,
  CONFIDENCE_FLOOR,
  CONFIDENCE_HIGH,
  STABLE_STREAK_TARGET,
  STABLE_DIFF_THRESHOLD,
  FRAME_MAX_DIM,
  POLL_BASE,
  POLL_BACKOFF_EMPTY,
  POLL_MAX,
  NO_DETECTION_TIMEOUT,
  GEMINI_TIMEOUT_MS,
  dominantColorCandidatesFromCanvas,
  detectSeason,
  isWellPositioned,
  drawBoundingBoxes,
  canvasToBlob,
  compressImage,
  scaleDetections,
  smoothBoxes,
  checkBrightnessFromThumb,
  fetchWithTimeout,
} from './upload-utils';

export interface CameraScannerReturn {
  cameraMode: boolean;
  scanning: boolean;
  capturedFrame: Blob | null;
  itemCount: number;
  editItems: EditItem[] | null;
  countdownDisplay: number | null;
  flash: boolean;
  readiness: string | null;
  stablePct: number;
  saving: boolean;
  savingPhase: 'removing-bg' | 'uploading' | null;
  refining: boolean;
  capturing: boolean;
  cameraError: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasOverlayRef: React.RefObject<HTMLCanvasElement | null>;
  editCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  setEditItems: React.Dispatch<React.SetStateAction<EditItem[] | null>>;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  handleCapture: () => Promise<void>;
  handleRetake: () => void;
  handleSave: (userId: string) => Promise<void>;
}

export function useCameraScanner(): CameraScannerReturn {
  const [cameraMode, setCameraMode] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [capturedFrame, setCapturedFrame] = useState<Blob | null>(null);
  const [editItems, setEditItems] = useState<EditItem[] | null>(null);
  const [itemCount, setItemCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savingPhase, setSavingPhase] = useState<
    'removing-bg' | 'uploading' | null
  >(null);
  const [capturing, setCapturing] = useState(false);
  const [refining, setRefining] = useState(false);
  const [countdownDisplay, setCountdownDisplay] = useState<number | null>(null);
  const [readiness, setReadiness] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasOverlayRef = useRef<HTMLCanvasElement>(null);
  const editCanvasRef = useRef<HTMLCanvasElement>(null);

  const prevFrameRef = useRef<ImageData | null>(null);
  const stableRefFrameRef = useRef<ImageData | null>(null);
  const pollAttemptRef = useRef(0);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const lastFrameRef = useRef<HTMLCanvasElement | null>(null);
  const lastDetectionsRef = useRef<DetectedItem[] | null>(null);
  const thumbCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fullCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const countdownRef = useRef(0);
  const pendingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pendingDetectionsRef = useRef<DetectedItem[] | null>(null);
  const stableStreakRef = useRef(0);
  const prevBoxesRef = useRef<Array<[number, number, number, number]> | null>(
    null,
  );
  const prevOverlayKeyRef = useRef<string>('');
  const targetBoxesRef = useRef<OverlayBox[] | null>(null);
  const smoothBoxesRef = useRef<OverlayBox[] | null>(null);
  const prevItemCountRef = useRef(0);

  const [stablePct, setStablePct] = useState(0);

  // Derive stablePct from stableStreakRef periodically (only when camera is on)
  useEffect(() => {
    if (!cameraMode) {
      setStablePct(0);
      return;
    }
    const interval = setInterval(() => {
      setStablePct(Math.min(stableStreakRef.current / STABLE_STREAK_TARGET, 1));
    }, 200);
    return () => clearInterval(interval);
  }, [cameraMode]);

  const getCanvas = (ref: React.MutableRefObject<HTMLCanvasElement | null>) => {
    if (!ref.current) ref.current = document.createElement('canvas');
    return ref.current;
  };

  // Unmount cleanup
  useEffect(() => {
    return () => cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // Attach camera stream to video element
  useEffect(() => {
    if (!videoRef.current || !cameraStream) return;
    videoRef.current.srcObject = cameraStream;
    videoRef.current.play().catch(() => {});
  }, [cameraStream]);

  // Bounding box overlay with smooth rAF interpolation
  useEffect(() => {
    const canvas = canvasOverlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !cameraMode) {
      if (canvas)
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const LERP_SPEED = 0.15;
    let animFrame: number;
    const render = () => {
      const target = targetBoxesRef.current;
      if (!target?.length) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        smoothBoxesRef.current = null;
      } else {
        const current = smoothBoxesRef.current;
        if (!current || current.length !== target.length) {
          smoothBoxesRef.current = target.map((t) => ({ ...t }));
        } else {
          smoothBoxesRef.current = current.map((cb, i) => {
            const tb = target[i];
            if (!tb) return cb;
            return {
              box: [
                cb.box[0] + (tb.box[0] - cb.box[0]) * LERP_SPEED,
                cb.box[1] + (tb.box[1] - cb.box[1]) * LERP_SPEED,
                cb.box[2] + (tb.box[2] - cb.box[2]) * LERP_SPEED,
                cb.box[3] + (tb.box[3] - cb.box[3]) * LERP_SPEED,
              ] as [number, number, number, number],
              label: tb.label,
            };
          });
        }
        const ctx = canvas.getContext('2d')!;
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const boxes = smoothBoxesRef.current;
        if (boxes?.length) {
          const sx = canvas.width / (video.videoWidth || 1);
          const sy = canvas.height / (video.videoHeight || 1);
          drawBoundingBoxes(ctx, boxes, sx, sy);
        }
      }
      animFrame = requestAnimationFrame(render);
    };
    animFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrame);
  }, [cameraMode]);

  // Draw captured image + bounding boxes on edit modal canvas
  useEffect(() => {
    const canvas = editCanvasRef.current;
    if (!canvas || !capturedFrame || !editItems) return;
    const ctx = canvas.getContext('2d')!;
    const url = URL.createObjectURL(capturedFrame);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const container = canvas.parentElement!;
      const maxW = container.clientWidth;
      const maxH = Math.min(container.clientHeight || 300, 400);
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const labeled = editItems
        .map((item) => ({
          box: item.box,
          label: `${item.type || 'Item'} ${Math.round(item.confidence * 100)}%`,
          included: item.included,
        }))
        .filter((i) => i.included);
      drawBoundingBoxes(ctx, labeled, scale, scale);
      canvas.style.width = canvas.width + 'px';
      canvas.style.height = canvas.height + 'px';
      canvas.style.margin = '0 auto';
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [capturedFrame, editItems]);

  // ─── Scanning loop helpers (pure logic, no React state in these) ──

  const captureThumb = (video: HTMLVideoElement): ImageData => {
    const canvas = getCanvas(thumbCanvasRef);
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, 32, 32);
    return ctx.getImageData(0, 0, 32, 32);
  };

  const captureFullFrame = (video: HTMLVideoElement): HTMLCanvasElement => {
    const canvas = getCanvas(fullCanvasRef);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    return canvas;
  };

  const captureDownscaled = (
    fullCanvas: HTMLCanvasElement,
  ): HTMLCanvasElement => {
    const dScale = Math.min(
      FRAME_MAX_DIM / fullCanvas.width,
      FRAME_MAX_DIM / fullCanvas.height,
      1,
    );
    const canvas = getCanvas(captureCanvasRef);
    canvas.width = Math.round(fullCanvas.width * dScale);
    canvas.height = Math.round(fullCanvas.height * dScale);
    canvas
      .getContext('2d')!
      .drawImage(fullCanvas, 0, 0, canvas.width, canvas.height);
    return canvas;
  };

  // Scanning loop
  useEffect(() => {
    if (!scanning || !videoRef.current || !cameraStream) return;
    let active = true;
    pollAttemptRef.current = 0;
    let noItemCycles = 0;
    const abortController = new AbortController();

    const poll = async () => {
      if (!active) return;
      if (countdownRef.current > 0) {
        schedule(POLL_BASE);
        return;
      }
      const video = videoRef.current!;
      if (video.readyState < 2) {
        schedule(POLL_BASE);
        return;
      }

      const thumbData = captureThumb(video);
      if (prevFrameRef.current) checkStability(thumbData);
      else prevFrameRef.current = thumbData;

      const fullCanvas = captureFullFrame(video);
      const captureCanvas = captureDownscaled(fullCanvas);

      if (!checkBrightnessFromThumb(thumbData)) {
        schedule(stableStreakRef.current >= 3 ? POLL_BASE : POLL_BACKOFF_EMPTY);
        return;
      }

      let data;
      try {
        const blob = await canvasToBlob(captureCanvas, 0.5);
        const fd = new FormData();
        fd.append('file', blob, 'scan.jpg');
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_YOLO_API_URL}/detect`,
          { method: 'POST', body: fd, signal: abortController.signal },
        );
        data = await res.json();
        pollAttemptRef.current = 0;
      } catch {
        pollAttemptRef.current++;
        schedule(POLL_BASE);
        return;
      }

      const scaleX = fullCanvas.width / captureCanvas.width;
      const scaleY = fullCanvas.height / captureCanvas.height;
      const imgArea = fullCanvas.width * fullCanvas.height;
      const rawItems = (data.items || []) as DetectedItem[];
      const items = rawItems.filter((i) => i.confidence > CONFIDENCE_FLOOR);

      if (items.length > 0 && active) {
        noItemCycles = 0;
        let scaledItems = scaleDetections(items, scaleX, scaleY, imgArea);
        scaledItems = smoothBoxes(scaledItems, prevBoxesRef.current);
        prevBoxesRef.current = scaledItems.map((i) => i.box);

        const newBoxes = scaledItems.map((i) => ({
          box: i.box,
          label: i.yolo_type || i.type || 'Item',
        }));
        const key = JSON.stringify(newBoxes);
        if (key !== prevOverlayKeyRef.current) {
          prevOverlayKeyRef.current = key;
          targetBoxesRef.current = newBoxes;
          if (newBoxes.length !== prevItemCountRef.current) {
            prevItemCountRef.current = newBoxes.length;
            setItemCount(newBoxes.length);
          }
        }
        lastFrameRef.current = fullCanvas;
        lastDetectionsRef.current = scaledItems;

        resolveReadiness(scaledItems, fullCanvas);
        schedule(POLL_BASE);
      } else if (active) {
        targetBoxesRef.current = null;
        smoothBoxesRef.current = null;
        if (prevItemCountRef.current !== 0) {
          prevItemCountRef.current = 0;
          setItemCount(0);
        }
        resetCountdownState();
        noItemCycles++;
        schedule(noItemCycles > 3 ? POLL_BACKOFF_EMPTY : POLL_BASE);
      }
    };

    const checkStability = (currentData: ImageData) => {
      const reference =
        stableRefFrameRef.current || prevFrameRef.current;
      if (!reference) return;
      let diff = 0;
      for (let i = 0; i < currentData.data.length; i += 4) {
        diff +=
          Math.abs(currentData.data[i] - reference.data[i]) / 255;
      }
      const avgDiff = diff / (currentData.data.length / 4);
      if (avgDiff < STABLE_DIFF_THRESHOLD) {
        stableStreakRef.current += 1;
      } else {
        stableStreakRef.current = 0;
        stableRefFrameRef.current = null;
      }
      prevFrameRef.current = currentData;
    };

    const resolveReadiness = (
      scaledItems: DetectedItem[],
      fullCanvas: HTMLCanvasElement,
    ) => {
      const hasHighConfidence = scaledItems.some(
        (i) => i.confidence > CONFIDENCE_HIGH,
      );
      const stable = stableStreakRef.current >= STABLE_STREAK_TARGET;
      const positioned = isWellPositioned(
        scaledItems,
        fullCanvas.width,
        fullCanvas.height,
      );

      if (hasHighConfidence && positioned && active) {
        if (!stableRefFrameRef.current) {
          stableRefFrameRef.current = captureThumb(videoRef.current!);
          stableStreakRef.current = 0;
        }
        if (stable) {
          setReadiness(null);
          if (countdownRef.current === 0) {
            countdownRef.current = COUNTDOWN_SECONDS;
            setCountdownDisplay(COUNTDOWN_SECONDS);
            pendingCanvasRef.current = fullCanvas;
            pendingDetectionsRef.current = scaledItems;
            if (navigator.vibrate) navigator.vibrate(30);
          }
        } else {
          countdownRef.current = 0;
          setCountdownDisplay(null);
          setReadiness('standby');
        }
      } else if (hasHighConfidence && active) {
        stableRefFrameRef.current = null;
        countdownRef.current = 0;
        setCountdownDisplay(null);
        setReadiness(stable ? null : 'standby');
      } else if (active) {
        resetCountdownState();
      }
    };

    const resetCountdownState = () => {
      countdownRef.current = 0;
      setCountdownDisplay(null);
      setReadiness(null);
      stableStreakRef.current = 0;
      stableRefFrameRef.current = null;
      prevBoxesRef.current = null;
    };

    const schedule = (interval: number) => {
      const clamped = Math.min(
        interval * Math.pow(2, pollAttemptRef.current),
        POLL_MAX,
      );
      setTimeout(poll, clamped);
    };

    poll();
    return () => {
      active = false;
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, cameraStream]);

  // Countdown timer
  useEffect(() => {
    if (countdownDisplay === null || countdownDisplay <= 0) return;
    const t = setTimeout(() => {
      if (countdownDisplay === 1) {
        countdownRef.current = 0;
        setCountdownDisplay(null);
        setFlash(true);
        setTimeout(() => setFlash(false), 200);
        if (navigator.vibrate) navigator.vibrate([80, 40, 160]);
        handleCapture();
      } else {
        if (navigator.vibrate) navigator.vibrate(20);
        setCountdownDisplay(countdownDisplay - 1);
      }
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdownDisplay]);

  // 30s no-detection guard
  useEffect(() => {
    if (!cameraMode) return;
    const timer = setTimeout(() => {
      if (!capturedFrame) {
        setCameraError('No clothing detected — try again');
        stopCamera();
      }
    }, NO_DETECTION_TIMEOUT);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraMode, capturedFrame]);

  // Page visibility
  useEffect(() => {
    const handler = () => {
      if (document.hidden) {
        stopCamera();
      } else if (cameraMode) {
        startCamera();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraMode]);

  // ─── Camera functions ──

  const resetState = () => {
    setCapturedFrame(null);
    setEditItems(null);
    setSaving(false);
    setSavingPhase(null);
    setRefining(false);
    setCountdownDisplay(null);
    countdownRef.current = 0;
    pendingCanvasRef.current = null;
    pendingDetectionsRef.current = null;
    stableStreakRef.current = 0;
    stableRefFrameRef.current = null;
    prevBoxesRef.current = null;
    prevFrameRef.current = null;
    pollAttemptRef.current = 0;
    prevOverlayKeyRef.current = '';
    targetBoxesRef.current = null;
    smoothBoxesRef.current = null;
  };

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      cameraStreamRef.current = stream;
      setCameraStream(stream);
      setCameraMode(true);
      resetState();
      setScanning(true);
      setReadiness(null);
      setCameraError('');
    } catch {
      setCameraError('Camera access denied or unavailable');
    }
  }, []);

  const stopCamera = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);
    setCameraMode(false);
    setScanning(false);
    resetState();
    setCapturing(false);
  }, []);

  async function handleCapture() {
    if (capturing) return;
    setCapturing(true);
    setScanning(false);
    countdownRef.current = 0;
    setCountdownDisplay(null);

    const frameCanvas = pendingCanvasRef.current;
    const scaledItems =
      pendingDetectionsRef.current || lastDetectionsRef.current;
    if (!scaledItems) {
      setCapturing(false);
      return;
    }
    pendingCanvasRef.current = null;
    pendingDetectionsRef.current = null;

    const canvas =
      frameCanvas ||
      (() => {
        const v = videoRef.current;
        if (!v) return null;
        const c = document.createElement('canvas');
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        c.getContext('2d')!.drawImage(v, 0, 0);
        return c;
      })();

    if (!canvas) {
      setCapturing(false);
      return;
    }

    const fullFrameBlob = await canvasToBlob(canvas, 0.85);

    const cap = (s: string) =>
      s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    const title = (s: string) => s.split(' ').map(cap).join(' ');

    // Build items from HSV instantly (no network needed)
    const hsvItems: EditItem[] = scaledItems.map((item, idx) => {
      const hsvCandidates = dominantColorCandidatesFromCanvas(canvas, item.box, 3);
      const color = hsvCandidates[0] || '';
      const type = item.type || item.yolo_type || '';
      const seasonGuess = detectSeason(item.yolo_type, type);
      const desc = item.yolo_type || type || '';
      const itemName = [color, desc]
        .filter((s): s is string => !!s)
        .map(title)
        .join(' ');
      return {
        id: idx,
        name: itemName,
        type,
        color,
        season: seasonGuess || '',
        confidence: item.confidence,
        box: item.box,
        included: item.confidence > 0.5,
        colorSource: 'hsv' as const,
        aiColorSource: undefined,
      };
    });

    // Deduplicate names
    const nameFreq = new Map<string, number>();
    for (const item of hsvItems) nameFreq.set(item.name, (nameFreq.get(item.name) || 0) + 1);
    const nameCounter = new Map<string, number>();
    for (const item of hsvItems) {
      const raw = item.name;
      const c = nameCounter.get(raw) || 0;
      nameCounter.set(raw, c + 1);
      if (nameFreq.get(raw)! > 1) item.name = `${raw} ${c + 1}`;
    }

    // Show modal immediately with HSV results
    setCapturedFrame(fullFrameBlob);
    setEditItems(hsvItems);
    setCapturing(false);
    setRefining(true);

    // Background: fire YOLO + Gemini, then update items with better results
    const captureFile = new File([fullFrameBlob], 'capture.jpg', { type: 'image/jpeg' });

    const fetchGeminiWithRetry = async (): Promise<{ color: string } | null> => {
      const fd = new FormData();
      fd.append('file', captureFile);
      try {
        const res = await fetchWithTimeout('/api/clothes/detect-color', {
          method: 'POST', body: fd,
        }, GEMINI_TIMEOUT_MS);
        if (res.ok) return res.json();
        // Retry once on non-200 (503, etc.)
        await new Promise(r => setTimeout(r, 1000));
        const retry = await fetchWithTimeout('/api/clothes/detect-color', {
          method: 'POST', body: fd,
        }, GEMINI_TIMEOUT_MS);
        if (retry.ok) return retry.json();
        return null;
      } catch {
        return null;
      }
    };

    const fdYolo = new FormData();
    fdYolo.append('file', captureFile);

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_YOLO_API_URL}/auto-detect`, {
        method: 'POST', body: fdYolo,
      }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetchGeminiWithRetry(),
    ]).then(([autoData, geminiData]) => {
      const autoColor = geminiData?.color || autoData?.color || '';
      const autoType = autoData?.type || '';
      const geminiAvailable = !!geminiData?.color;

      if (!autoColor && !autoType) return; // nothing better to offer

      setEditItems(prev => {
        if (!prev) return prev;
        return prev.map((item, idx) => {
          const hsvCandidates = dominantColorCandidatesFromCanvas(canvas, item.box, 3);
          const perItemColor = hsvCandidates[0] || null;
          const betterColor = autoColor || item.color;
          const betterType = autoType || item.type;
          const newAiSource = autoColor
            ? (geminiAvailable ? "gemini" as const : "yolo" as const)
            : undefined;
          // Preserve existing aiColorSource if already set, otherwise use new one
          const aiColorSource = item.aiColorSource || newAiSource;
          const colorSource = aiColorSource || "hsv" as const;
          const hasDisagreement = autoColor && perItemColor && autoColor !== perItemColor;
          const seasonGuess = detectSeason(scaledItems[idx]?.yolo_type, betterType);
          const desc = scaledItems[idx]?.yolo_type || betterType || '';
          const itemName = [betterColor, desc]
            .filter((s): s is string => !!s)
            .map(title)
            .join(' ');
          return {
            ...item,
            name: itemName,
            type: betterType,
            color: betterColor || item.color,
            season: seasonGuess || item.season,
            colorCandidates: hasDisagreement
              ? [betterColor, ...hsvCandidates.filter(c => c !== betterColor)].slice(0, 2)
              : undefined,
            colorSource,
            aiColorSource,
          };
        });
      });
    }).catch(() => { /* background — ignore */ }).finally(() => setRefining(false));
  }

  function handleRetake() {
    resetState();
    setReadiness(null);
    setScanning(true);
  }

  async function handleSave(userId: string) {
    if (!capturedFrame || !editItems) return;
    const toSave = editItems.filter((i) => i.included);
    if (toSave.length === 0) return;
    setSaving(true);

    const fullUrl = URL.createObjectURL(capturedFrame);
    const fullImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = fullUrl;
    });
    URL.revokeObjectURL(fullUrl);

    const saveOne = async (item: EditItem) => {
      const [x1, y1, x2, y2] = item.box;
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = x2 - x1;
      cropCanvas.height = y2 - y1;
      cropCanvas
        .getContext('2d')!
        .drawImage(fullImg, x1, y1, x2 - x1, y2 - y1, 0, 0, x2 - x1, y2 - y1);

      const cropBlob = await canvasToBlob(cropCanvas, 0.85);
      const file = new File([cropBlob], `item-${Date.now()}-${item.id}.jpg`, {
        type: 'image/jpeg',
      });
      const compressed = await compressImage(file);

      const uploadFd = new FormData();
      uploadFd.append('file', compressed);
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFd,
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const { url } = await uploadRes.json();

      const saveRes = await fetch('/api/clothes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          name: item.name,
          type: item.type,
          color: item.color,
          season: item.season || null,
          image_url: url,
        }),
      });
      if (!saveRes.ok) throw new Error('Failed to save');
    };

    const results = await Promise.allSettled(toSave.map(saveOne));
    let saved = 0;
    for (const r of results) {
      if (r.status === 'fulfilled') saved++;
      else {
        console.error('Failed to save item', r.reason);
        toast.error('Failed to save an item');
      }
    }

    if (saved > 0) toast.success(`${saved} item${saved > 1 ? 's' : ''} saved!`);
    stopCamera();
    setSaving(false);
  }

  return {
    cameraMode,
    scanning,
    capturedFrame,
    itemCount,
    editItems,
    countdownDisplay,
    flash,
    readiness,
    stablePct,
    saving,
    savingPhase,
    refining,
    capturing,
    cameraError,
    videoRef,
    canvasOverlayRef,
    editCanvasRef,
    setEditItems,
    startCamera,
    stopCamera,
    handleCapture,
    handleRetake,
    handleSave,
  };
}
