"use client";

export interface Category {
  id: string;
  name: string;
  color: string;
  textColor: string;
}

export interface DetectedItem {
  type: string;
  yolo_type: string;
  confidence: number;
  box: [number, number, number, number];
}

export interface OverlayBox {
  box: [number, number, number, number];
  label: string;
}

export interface EditItem {
  id: number;
  name: string;
  type: string;
  color: string;
  season: string;
  confidence: number;
  box: [number, number, number, number];
  included: boolean;
  colorCandidates?: string[];
  colorSource?: ColorSource;
  aiColorSource?: ColorSource;
  useCase: string[];
}

export const SEASONS = ["All", "Spring", "Summer", "Autumn", "Winter"];
export const SIZES = ["XS", "S", "M", "L", "XL"];
export const MATERIALS = ["Cotton", "Linen", "Silk", "Wool", "Denim", "Leather", "Synthetic", "Nylon"];

export const BOX_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"];
export const COUNTDOWN_SECONDS = 3;

export const CONFIDENCE_FLOOR = 0.3;
export const CONFIDENCE_HIGH = 0.5;
export const STABLE_STREAK_TARGET = 3;
export const STABLE_DIFF_THRESHOLD = 0.15;
export const BRIGHTNESS_MIN = 40;
export const FRAME_MAX_DIM = 640;
export const OVERSCAN_RATIO = 0.7;
export const POSITION_MARGIN = 0.2;
export const POLL_BASE = 500;
export const POLL_BACKOFF_EMPTY = 2000;
export const POLL_MAX = 15000;
export const NO_DETECTION_TIMEOUT = 30000;
export const HSV_SAMPLE_SIZE = 128;
export const GEMINI_TIMEOUT_MS = 8000;

export type ColorSource = "gemini" | "yolo" | "hsv" | "manual";

export const inputBase =
  "w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 " +
  "focus:ring-2 focus:ring-slate-500/70 px-3 py-2";

function rgbToHsv(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (mx === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: (mx === 0 ? 0 : d / mx) * 100, v: mx * 100 };
}

function hsvColorName(h: number, s: number, v: number): string {
  if (s < 10) {
    if (v < 15) return "Black";
    if (v > 90) return "White";
    return "Grey";
  }
  if (v < 10) return "Black";
  if (h > 20 && h < 70 && s < 30 && v > 75) return v > 92 ? "Cream" : "Beige";
  if (h < 60 && v < 60) return "Brown";
  if (h < 60 && v < 80 && s > 20 && s < 75) return "Brown";
  if (h > 190 && h < 290 && v < 25) return "Navy";
  if (h > 200 && h < 260 && v >= 25 && v < 60 && s > 25 && s < 70) return "Denim";
  if (h > 190 && h < 290 && s < 20) return "Grey";
  if ((h < 12 || h >= 345) && v > 60 && s < 45) return "Pink";
  if (h > 300 && h < 345) return v > 30 ? "Pink" : "Purple";
  if (h < 12 || h >= 345) return "Red";
  if (h < 40) return "Orange";
  if (h < 70) return "Yellow";
  if (h < 165) return "Green";
  if (h < 260) return "Blue";
  if (h < 300) return "Purple";
  return "Pink";
}

export function detectSeason(yoloType?: string, type?: string): string {
  const t = (yoloType || "").toLowerCase();
  if (/outwear|coat$|parka|puffer|sweater|hoodie|jumper|pullover|cardigan/.test(t)) return "Winter";
  if (/short sleeve|tank|shorts|swim|bikini|sundress/.test(t)) return "Summer";
  if (/jacket|blazer|trench/.test(t)) return "Autumn";
  if (/long sleeve|vest/.test(t)) return "Spring";
  if (/jeans|pants|trousers|skirt|denim/.test(t)) return "All";
  if (type === "Bottoms" || type === "Tops") return "All";
  if (type === "Outerwear") return "Winter";
  if (type === "One-Piece") return "Summer";
  return "";
}

export const MAX_IMAGE_DIM = 1200;
const JPEG_QUALITY = 0.8;

export function compressImage(file: Blob): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    const fileName = (file instanceof File ? file.name : 'image.jpg');
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width <= MAX_IMAGE_DIM && height <= MAX_IMAGE_DIM) {
        resolve(new File([file], fileName, { type: 'image/jpeg' }));
        return;
      }
      if (width > height) {
        height = Math.round(height * (MAX_IMAGE_DIM / width));
        width = MAX_IMAGE_DIM;
      } else {
        width = Math.round(width * (MAX_IMAGE_DIM / height));
        height = MAX_IMAGE_DIM;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(new File([blob], fileName, { type: 'image/jpeg' }));
          else reject(new Error('Compression failed'));
        },
        'image/jpeg',
        JPEG_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

export async function dominantColorFromFile(
  blob: Blob,
  box?: [number, number, number, number],
): Promise<string | null> {
  try {
    const img = await blobToImage(blob);
    return dominantColorFromImage(img, box);
  } catch {
    return null;
  }
}

export function dominantColorFromImage(
  img: HTMLImageElement,
  box?: [number, number, number, number],
): string | null {
  const candidates = sampleColorCandidates(img, box);
  return candidates[0] || null;
}

function sampleColorCandidates(
  source: HTMLImageElement | HTMLCanvasElement,
  box?: [number, number, number, number],
  maxCandidates: number = 3,
): string[] {
  const size = HSV_SAMPLE_SIZE;
  const tmp = document.createElement("canvas");
  tmp.width = size;
  tmp.height = size;
  const ctx = tmp.getContext("2d")!;
  if (box) {
    const [x1, y1, x2, y2] = box;
    const w = x2 - x1;
    const h = y2 - y1;
    const safeX = x1 + w * 0.15;
    const safeY = y1 + h * 0.15;
    const safeW = w * 0.7;
    const safeH = h * 0.7;
    ctx.drawImage(source, safeX, safeY, safeW, safeH, 0, 0, size, size);
  } else {
    const crop = 0.65;
    const sx = (source.width * (1 - crop)) / 2;
    const sy = (source.height * (1 - crop)) / 2;
    ctx.drawImage(source, sx, sy, source.width * crop, source.height * crop, 0, 0, size, size);
  }
  const data = ctx.getImageData(0, 0, size, size).data;
  const votes: Record<string, number> = {};
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = (x - half) / half;
      const dy = (y - half) / half;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const weight = dist < 0.5 ? 2 : dist < 0.8 ? 1.2 : 0.6;
      const { h, s, v } = rgbToHsv(data[i], data[i + 1], data[i + 2]);
      const name = hsvColorName(h, s, v);
      votes[name] = (votes[name] || 0) + weight;
    }
  }
  const sorted = Object.entries(votes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCandidates)
    .map(([name]) => name);
  return sorted;
}

export function dominantColorFromCanvas(
  canvas: HTMLCanvasElement,
  box?: [number, number, number, number],
): string | null {
  const candidates = dominantColorCandidatesFromCanvas(canvas, box, 1);
  return candidates[0] || null;
}

export function dominantColorCandidatesFromCanvas(
  canvas: HTMLCanvasElement,
  box?: [number, number, number, number],
  maxCandidates: number = 3,
): string[] {
  return sampleColorCandidates(canvas, box, maxCandidates);
}

export function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

export async function removeImageBackground(blob: Blob): Promise<Blob> {
  const { removeBackground } = await import("@imgly/background-removal");
  const resultBlob = await removeBackground(blob);
  const img = await blobToImage(resultBlob);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return canvasToBlob(canvas, 0.92);
}

export function scaleDetections(
  items: DetectedItem[],
  scaleX: number, scaleY: number,
  imgArea: number,
): DetectedItem[] {
  return items.map(i => ({
    type: i.type || "",
    yolo_type: i.yolo_type || "",
    confidence: i.confidence,
    box: [
      Math.round(i.box[0] * scaleX), Math.round(i.box[1] * scaleY),
      Math.round(i.box[2] * scaleX), Math.round(i.box[3] * scaleY),
    ] as [number, number, number, number],
  })).filter(i => {
    const [x1, y1, x2, y2] = i.box;
    return (x2 - x1) * (y2 - y1) / imgArea < OVERSCAN_RATIO;
  });
}

export function smoothBoxes(
  items: DetectedItem[],
  prev: Array<[number, number, number, number]> | null,
): DetectedItem[] {
  if (!prev || prev.length !== items.length) return items;
  return items.map((item, idx) => ({
    ...item,
    box: [
      Math.round((item.box[0] + prev[idx][0]) / 2),
      Math.round((item.box[1] + prev[idx][1]) / 2),
      Math.round((item.box[2] + prev[idx][2]) / 2),
      Math.round((item.box[3] + prev[idx][3]) / 2),
    ] as [number, number, number, number],
  }));
}

export function checkBrightnessFromThumb(data: ImageData): boolean {
  let sum = 0;
  for (let i = 0; i < data.data.length; i += 4) {
    sum += (data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3;
  }
  const pixelCount = data.data.length / 4;
  return sum / pixelCount >= BRIGHTNESS_MIN;
}

export function isWellPositioned(
  items: Array<{ box: [number, number, number, number] }>,
  frameW: number,
  frameH: number,
): boolean {
  const marginX = frameW * POSITION_MARGIN;
  const marginY = frameH * POSITION_MARGIN;
  return items.every(({ box }) => {
    const cx = (box[0] + box[2]) / 2;
    const cy = (box[1] + box[3]) / 2;
    return cx > marginX && cx < frameW - marginX && cy > marginY && cy < frameH - marginY;
  });
}

export function drawBoundingBoxes(
  ctx: CanvasRenderingContext2D,
  items: Array<{ box: [number, number, number, number]; label: string }>,
  scaleX: number,
  scaleY: number,
) {
  items.forEach((item, idx) => {
    const [x1, y1, x2, y2] = item.box;
    const c = BOX_COLORS[idx % BOX_COLORS.length];
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.strokeRect(x1 * scaleX, y1 * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY);
    ctx.fillStyle = c + "33";
    ctx.fillRect(x1 * scaleX, y1 * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY);
    ctx.font = "12px monospace";
    ctx.fillStyle = c;
    const lbl = `  ${item.label}  `;
    const tw = ctx.measureText(lbl).width;
    ctx.fillRect(x1 * scaleX, y1 * scaleY - 20, tw + 8, 20);
    ctx.fillStyle = "#000";
    ctx.fillText(lbl, x1 * scaleX + 4, y1 * scaleY - 6);
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.5): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error("toBlob failed")), "image/jpeg", quality);
  });
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = GEMINI_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const signal = options.signal
      ? mergeAbortSignals(options.signal, controller.signal)
      : controller.signal;
    return await fetch(url, { ...options, signal });
  } finally {
    clearTimeout(timer);
  }
}

function mergeAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (a.aborted || b.aborted) {
    controller.abort();
  } else {
    a.addEventListener("abort", onAbort, { once: true });
    b.addEventListener("abort", onAbort, { once: true });
  }
  return controller.signal;
}
