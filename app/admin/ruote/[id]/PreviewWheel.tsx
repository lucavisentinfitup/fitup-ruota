"use client";

import { useCallback, useRef, useState } from "react";
import WheelView, { type WheelHandle } from "@/components/wheel/WheelView";
import { useSpinner } from "@/components/wheel/useSpinner";
import { pickWeighted } from "@/lib/pick";
import type { Segment } from "@/lib/types";

/** Anteprima dal vivo con giro di prova: estrazione in locale, nulla viene registrato. */
export default function PreviewWheel({ segments, seconds }: { segments: Segment[]; seconds: number }) {
  const ref = useRef<WheelHandle>(null);
  const [last, setLast] = useState<string | null>(null);
  const resolve = useCallback(async () => {
    const index = pickWeighted(segments.map((s) => ({ ...s, stock: null })));
    if (index < 0) throw new Error("Nessuno spicchio con probabilità > 0");
    return { index };
  }, [segments]);
  const { spin, spinning, handlers } = useSpinner({
    wheel: ref,
    count: segments.length,
    decelSeconds: seconds,
    sound: true,
    resolve,
    onSettled: (o) => setLast(o.ok ? segments[o.index]?.label ?? null : o.error),
  });
  return (
    <>
      <div className="preview-wheel" {...handlers}>
        <WheelView ref={ref} segments={segments} interactive={!spinning} />
      </div>
      <div className="row" style={{ justifyContent: "center" }}>
        <button className="btn btn-sm" onClick={() => (setLast(null), spin())} disabled={spinning}>
          Giro di prova
        </button>
        <span className="small muted">{spinning ? "Gira…" : last ? <>Uscito: <b style={{ color: "#fff" }}>{last}</b></> : "Non viene registrato"}</span>
      </div>
    </>
  );
}
