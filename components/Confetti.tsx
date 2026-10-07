"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#94C424", "#FFFFFF", "#a9d93a", "#0D0D0D", "#cfe88a"];

/** Coriandoli leggeri su canvas, si fermano da soli. Cambia `burst` per lanciarne di nuovi. */
export default function Confetti({ burst }: { burst: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!burst || !ref.current) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = ref.current;
    const ctx = c.getContext("2d")!;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = (c.width = innerWidth * dpr);
    const H = (c.height = innerHeight * dpr);
    const parts = Array.from({ length: 170 }, (_, i) => {
      const fromLeft = i % 2 === 0;
      const ang = (fromLeft ? -60 : -120) + (Math.random() * 40 - 20);
      const sp = (9 + Math.random() * 11) * dpr;
      return {
        x: fromLeft ? -10 : W + 10,
        y: H * (0.55 + Math.random() * 0.25),
        vx: Math.cos((ang * Math.PI) / 180) * sp,
        vy: Math.sin((ang * Math.PI) / 180) * sp,
        w: (6 + Math.random() * 7) * dpr,
        h: (9 + Math.random() * 10) * dpr,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.35,
        flip: Math.random() * Math.PI,
        color: COLORS[i % COLORS.length],
      };
    });
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      const life = (t - start) / 1000;
      for (const p of parts) {
        p.vy += 0.32 * dpr;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.flip += 0.12;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.flip));
        ctx.globalAlpha = Math.max(0, Math.min(1, 4.2 - life));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        if (p.color === "#FFFFFF") {
          ctx.strokeStyle = "rgba(0,0,0,.25)";
          ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      if (life < 4.3) raf = requestAnimationFrame(step);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [burst]);

  return <canvas ref={ref} className="confetti" aria-hidden />;
}
