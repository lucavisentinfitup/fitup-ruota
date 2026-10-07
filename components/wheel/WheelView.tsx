"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { PublicSegment } from "@/lib/types";
import { drawBlur, drawWheel, ensureFont, GEO, loadAssets } from "./render";

export interface WheelHandle {
  /** rotazione della ruota in gradi (senso orario) */
  setAngle(deg: number): void;
  /** 0..1 opacità del layer con motion blur */
  setBlur(v: number): void;
  /** rotazione della lancetta in gradi */
  setPointer(deg: number): void;
  element(): HTMLDivElement | null;
}

interface Props {
  segments: PublicSegment[];
  className?: string;
  onReady?: () => void;
  interactive?: boolean;
}

const WheelView = forwardRef<WheelHandle, Props>(function WheelView({ segments, className, onReady, interactive }, ref) {
  const root = useRef<HTMLDivElement>(null);
  const rotor = useRef<HTMLDivElement>(null);
  const sharp = useRef<HTMLCanvasElement>(null);
  const blur = useRef<HTMLCanvasElement>(null);
  const pointer = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState(0);
  const [ready, setReady] = useState(false);
  const key = useMemo(() => JSON.stringify(segments), [segments]);

  useImperativeHandle(ref, () => ({
    setAngle(deg) {
      if (rotor.current) rotor.current.style.transform = `rotate(${deg}deg)`;
    },
    setBlur(v) {
      if (blur.current) blur.current.style.opacity = v.toFixed(3);
    },
    setPointer(deg) {
      if (pointer.current) pointer.current.style.transform = `translateX(-50%) rotate(${deg}deg)`;
    },
    element: () => root.current,
  }));

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => setPx(Math.round(el.getBoundingClientRect().width));
    measure();
    // ResizeObserver manca su browser molto vecchi: in quel caso basta il resize della finestra
    if (typeof ResizeObserver === "undefined") {
      addEventListener("resize", measure);
      return () => removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!px || !sharp.current || !blur.current) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const [fam, images] = await Promise.all([ensureFont(), loadAssets(segments)]);
      if (cancelled || !sharp.current || !blur.current) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      // telefoni economici (≤2 GB di RAM): bitmap più piccola, nessuna differenza visibile e niente scatti
      const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      const backing = Math.min(mem && mem <= 2 ? 1100 : 2048, Math.round(px * dpr));
      for (const c of [sharp.current, blur.current]) {
        c.width = backing;
        c.height = backing;
      }
      drawWheel(sharp.current, segments, images, fam);
      // il blur si calcola a risoluzione ridotta: è sfocato comunque
      const small = document.createElement("canvas");
      small.width = small.height = Math.round(backing / 2);
      drawBlur(small, sharp.current);
      const bctx = blur.current.getContext("2d")!;
      bctx.clearRect(0, 0, backing, backing);
      bctx.drawImage(small, 0, 0, backing, backing);
      setReady(true);
      onReady?.();
    }, 30);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [px, key]);

  return (
    <div ref={root} className={`wheel ${ready ? "is-ready" : ""} ${interactive ? "is-interactive" : ""} ${className ?? ""}`}>
      <div className="wheel-shadow" />
      <div ref={rotor} className="wheel-rotor">
        <canvas ref={sharp} className="wheel-canvas" />
        <canvas ref={blur} className="wheel-canvas wheel-blur" style={{ opacity: 0 }} />
      </div>
      <div className="wheel-gloss" />
      <div className="wheel-hub" style={{ width: `${GEO.hub * 100}%`, height: `${GEO.hub * 100}%` }}>
        <img src="/brand/fitup-logo.png" alt="FitUP" draggable={false} />
      </div>
      <div ref={pointer} className="wheel-pointer" style={{ transform: "translateX(-50%)" }}>
        <svg viewBox="0 0 60 92" aria-hidden>
          <defs>
            <linearGradient id="ptr" x1="0" x2="1">
              <stop offset="0" stopColor="#a9d93a" />
              <stop offset="0.5" stopColor="#94C424" />
              <stop offset="1" stopColor="#6f9419" />
            </linearGradient>
          </defs>
          <path d="M30 90 L6 22 A26 26 0 1 1 54 22 Z" fill="url(#ptr)" stroke="#0d0d0d" strokeWidth="4" strokeLinejoin="round" />
          <circle cx="30" cy="26" r="9" fill="#0d0d0d" />
          <circle cx="28" cy="24" r="3" fill="#fff" opacity="0.7" />
        </svg>
      </div>
    </div>
  );
});

export default WheelView;
