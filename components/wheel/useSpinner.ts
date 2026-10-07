"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { WheelHandle } from "./WheelView";
import { setMuted, tick, unlockAudio } from "./sound";
import { MOTION, blurFor, decelAt, easeInOut, pegIndex, planDecel as plan, smooth, stepPointer } from "./motion";

export type Outcome = { ok: true; index: number } | { ok: false; error: string };

/** Esito del giro. `jitter` e `decelAt` arrivano dal server quando c'è una TV da tenere sincronizzata. */
export interface SpinTarget {
  index: number;
  /** -1..1: dove fermarsi dentro lo spicchio */
  jitter?: number;
  /** istante (performance.now) in cui deve iniziare la frenata */
  decelAt?: number;
}

interface Options {
  wheel: RefObject<WheelHandle | null>;
  count: number;
  /** durata della frenata, in secondi */
  decelSeconds: number;
  sound: boolean;
  /** chiede l'esito (al server, o in locale per l'anteprima). Deve lanciare Error in caso di problemi. */
  resolve: () => Promise<SpinTarget>;
  onSettled: (o: Outcome) => void;
  canSpin?: () => boolean;
}

type Phase = "idle" | "drag" | "windup" | "accel" | "cruise" | "decel" | "settle";
const { VMAX, WINDUP_MS, WINDUP_DEG, ACCEL_MS, MIN_CRUISE_MS } = MOTION;

export function useSpinner(o: Options) {
  const opts = useRef(o);
  opts.current = o;
  const [spinning, setSpinning] = useState(false);

  const s = useRef({
    theta: 0,
    v: 0,
    dir: 1,
    phase: "idle" as Phase,
    t0: 0,
    from: 0,
    plan: null as null | ReturnType<typeof plan>,
    result: null as null | SpinTarget,
    error: null as null | string,
    pointer: { ptr: 0, ptrV: 0 },
    lastK: 0,
    frameTheta: 0,
    lastTick: 0,
    last: 0,
    raf: 0,
    drag: null as null | { cx: number; cy: number; ang: number; moved: number; x: number; y: number; samples: { t: number; th: number }[] },
  });

  useEffect(() => setMuted(!o.sound), [o.sound]);

  const planDecel = useCallback((now: number) => {
    const st = s.current;
    const r = st.result;
    // atterra dentro lo spicchio, non sempre al centro: sembra più naturale
    const jitter = r?.jitter ?? Math.random() * 2 - 1;
    st.plan = plan(st.theta, st.v, st.dir, r ? r.index : null, jitter, opts.current.count, opts.current.decelSeconds);
    st.phase = "decel";
    st.t0 = now;
  }, []);

  const frame = useCallback(
    (now: number) => {
      const st = s.current;
      const w = opts.current.wheel.current;
      const dt = Math.min(0.05, (now - (st.last || now)) / 1000);
      st.last = now;
      switch (st.phase) {
        case "windup": {
          const u = Math.min(1, (now - st.t0) / WINDUP_MS);
          st.theta = st.from - st.dir * WINDUP_DEG * easeInOut(u);
          if (u >= 1) (st.phase = "accel"), (st.t0 = now);
          break;
        }
        case "accel": {
          const u = Math.min(1, (now - st.t0) / ACCEL_MS);
          st.v = st.dir * VMAX * smooth(u);
          st.theta += st.v * dt;
          if (u >= 1) (st.phase = "cruise"), (st.t0 = now);
          break;
        }
        case "cruise": {
          st.theta += st.v * dt;
          const ready = st.result?.decelAt !== undefined ? now >= st.result.decelAt : now - st.t0 >= MIN_CRUISE_MS;
          if (st.error || (st.result && ready)) planDecel(now);
          break;
        }
        case "decel": {
          const d = decelAt(st.plan!, (now - st.t0) / 1000);
          st.theta = d.theta;
          st.v = d.v;
          if (d.done) (st.phase = "settle"), (st.t0 = now), (st.v = 0);
          break;
        }
        case "settle": {
          if (now - st.t0 > 420) {
            st.phase = "idle";
            setSpinning(false);
            const res = st.result;
            const err = st.error;
            opts.current.onSettled(res ? { ok: true, index: res.index } : { ok: false, error: err || "Errore" });
          }
          break;
        }
        case "drag":
        case "idle":
          break;
      }
      // nel trascinamento/rincorsa la velocità si misura tra un frame e l'altro
      if (st.phase === "drag" || st.phase === "windup") st.v = dt > 0 ? (st.theta - st.frameTheta) / dt : 0;
      st.frameTheta = st.theta;

      // --- lancetta: spinta geometrica dai pioli + molla smorzata ---
      stepPointer(st.pointer, st.theta, st.v, st.dir, opts.current.count, dt);

      // --- tick audio/aptico a ogni piolo ---
      const k = pegIndex(st.theta, opts.current.count);
      if (k !== st.lastK) {
        st.lastK = k;
        const speed = Math.abs(st.v);
        if (now - st.lastTick > 28) {
          st.lastTick = now;
          tick(Math.min(1, 0.35 + speed / 1400));
          if (speed < 500 && st.phase !== "drag" && "vibrate" in navigator) navigator.vibrate?.(4);
        }
      }

      w?.setAngle(st.theta);
      w?.setPointer(st.pointer.ptr);
      w?.setBlur(blurFor(st.v));

      const resting = st.phase === "idle" && Math.abs(st.pointer.ptr) < 0.05 && Math.abs(st.pointer.ptrV) < 0.05;
      st.raf = resting ? 0 : requestAnimationFrame(frame);
    },
    [planDecel],
  );

  const ensureLoop = useCallback(() => {
    const st = s.current;
    if (!st.raf) {
      st.last = 0;
      st.raf = requestAnimationFrame(frame);
    }
  }, [frame]);

  useEffect(() => () => cancelAnimationFrame(s.current.raf), []);

  /** Avvia un giro. `flick` = velocità (gradi/s, con segno) data dal dito; senza, parte con la rincorsa. */
  const spin = useCallback(
    (flick?: number) => {
      const st = s.current;
      if (st.phase !== "idle" && st.phase !== "drag") return false;
      if (opts.current.canSpin && !opts.current.canSpin()) {
        st.phase = "idle";
        return false;
      }
      unlockAudio();
      st.result = null;
      st.error = null;
      st.plan = null;
      if (flick) {
        st.dir = Math.sign(flick);
        st.v = st.dir * Math.min(1800, Math.max(750, Math.abs(flick)));
        st.phase = "cruise";
        st.t0 = performance.now();
      } else {
        st.dir = 1;
        st.from = st.theta;
        st.phase = "windup";
        st.t0 = performance.now();
      }
      setSpinning(true);
      opts.current
        .resolve()
        .then((r) => (st.result = r))
        .catch((e: Error) => (st.error = e.message || "Errore di connessione"));
      ensureLoop();
      return true;
    },
    [ensureLoop],
  );

  // --- gesti: trascina per far girare, tocca per lanciare, "flick" per lanciare forte ---
  const angleAt = (e: PointerEvent | React.PointerEvent, cx: number, cy: number) =>
    (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const st = s.current;
      if (st.phase !== "idle") return;
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      el.setPointerCapture(e.pointerId);
      unlockAudio();
      st.drag = { cx, cy, ang: angleAt(e, cx, cy), moved: 0, x: e.clientX, y: e.clientY, samples: [{ t: performance.now(), th: st.theta }] };
      st.phase = "drag";
      ensureLoop();
    },
    [ensureLoop],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const st = s.current;
    const d = st.drag;
    if (st.phase !== "drag" || !d) return;
    const ang = angleAt(e, d.cx, d.cy);
    let delta = ang - d.ang;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    d.ang = ang;
    d.moved += Math.hypot(e.clientX - d.x, e.clientY - d.y);
    d.x = e.clientX;
    d.y = e.clientY;
    st.theta += delta;
    const t = performance.now();
    d.samples.push({ t, th: st.theta });
    while (d.samples.length > 2 && t - d.samples[0].t > 110) d.samples.shift();
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const st = s.current;
      const d = st.drag;
      if (st.phase !== "drag" || !d) return;
      st.drag = null;
      st.phase = "idle";
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      const first = d.samples[0];
      const last = d.samples[d.samples.length - 1];
      const dtS = (performance.now() - first.t) / 1000;
      const v = dtS > 0 ? (last.th - first.th) / dtS : 0;
      if (d.moved < 10) spin();
      else if (Math.abs(v) > 260) spin(v);
      else st.v = 0;
    },
    [spin],
  );

  return { spin, spinning, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } };
}
