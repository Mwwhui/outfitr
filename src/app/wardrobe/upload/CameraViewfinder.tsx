"use client";

import { RefObject } from "react";
import { OverlayBox, COUNTDOWN_SECONDS } from "./upload-utils";

interface Props {
  cameraMode: boolean;
  capturedFrame: Blob | null;
  scanning: boolean;
  flash: boolean;
  readiness: string | null;
  stablePct: number;
  countdownDisplay: number | null;
  overlayBoxes: OverlayBox[] | null;
  capturing: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasOverlayRef: RefObject<HTMLCanvasElement | null>;
  onStopCamera: () => void;
  onCapture: () => void;
}

export default function CameraViewfinder({
  cameraMode, capturedFrame, scanning, flash, readiness, stablePct,
  countdownDisplay, overlayBoxes, capturing,
  videoRef, canvasOverlayRef, onStopCamera, onCapture,
}: Props) {
  if (!cameraMode) return null;

  return (
    <div className={`fixed inset-0 z-50 bg-black flex items-center justify-center ${capturedFrame ? 'hidden' : ''}`}>
      <div className="relative w-screen h-screen bg-black overflow-hidden">
        {flash && <div className="absolute inset-0 z-[60] bg-white animate-flash" />}

        <video ref={videoRef} autoPlay playsInline muted
          className="w-full h-full object-contain" />
        <canvas ref={canvasOverlayRef}
          className="absolute inset-0 w-full h-full pointer-events-none" />

        {scanning && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
            {readiness === "standby" ? (
              <>
                <div className="bg-black/60 text-white text-[10px] px-3 py-1 rounded-full">
                  Hold still...
                </div>
                <div className="w-24 h-1 bg-black/40 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(stablePct * 100, 100)}%` }} />
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Scanning...
              </div>
            )}
          </div>
        )}

        {overlayBoxes && overlayBoxes.length > 0 && (
          <div className="absolute top-3 right-3 bg-black/50 text-white text-[10px] px-2 py-1 rounded-full">
            {overlayBoxes.length} item{overlayBoxes.length !== 1 ? "s" : ""}
          </div>
        )}

        {countdownDisplay !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <svg className="w-40 h-40" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="white" strokeWidth="4"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={2 * Math.PI * 42 * (1 - countdownDisplay / COUNTDOWN_SECONDS)}
                strokeLinecap="round" transform="rotate(-90 50 50)"
                className="transition-all duration-1000 ease-linear" />
            </svg>
            <span className="absolute text-white font-bold text-5xl"
              style={{ textShadow: "0 0 40px rgba(0,0,0,0.6)" }}>
              {countdownDisplay}
            </span>
          </div>
        )}

        <button type="button" onClick={onStopCamera}
          className="absolute top-2 left-2 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full hover:bg-black/70">
          Cancel
        </button>

        <button type="button" onClick={onCapture} disabled={capturing}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white/80 hover:bg-white flex items-center justify-center disabled:opacity-40 transition shadow-lg">
          <span className="w-11 h-11 rounded-full border-[3px] border-black" />
        </button>
      </div>
    </div>
  );
}
