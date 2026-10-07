"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicWheel, SegmentKind } from "@/lib/types";
import WheelView, { type WheelHandle } from "./wheel/WheelView";
import { useSpinner, type Outcome } from "./wheel/useSpinner";
import { penaltySound, winSound } from "./wheel/sound";
import Confetti from "./Confetti";
import { autoTextColor, shouldInvert } from "@/lib/color";
import { useTvLink } from "./tv/useTvLink";
import TvSheet from "./tv/TvSheet";
import { eventText } from "@/lib/event";

interface Result {
  index: number;
  code?: string;
  kind: SegmentKind;
  label: string;
}

interface Props {
  wheel: PublicWheel;
  /** giocate rimaste oggi a questo dispositivo (null = illimitate) */
  remaining: number | null;
  /** messaggio se oggi la ruota del club non è aperta (fuori dal giorno dell'evento) */
  closed?: string | null;
  /** staff fuori calendario: si gioca ma non si registra */
  test?: boolean;
}

export default function Game({ wheel: initialWheel, remaining: remainingInit, closed = null, test = false }: Props) {
  // la ruota può essere aggiornata dal server durante un giro (modifiche fatte dal backend)
  const [wheel, setWheel] = useState(initialWheel);
  const wheelRef = useRef(wheel);
  wheelRef.current = wheel;
  const ref = useRef<WheelHandle>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const [muted, setMutedState] = useState(false);
  const [remaining, setRemaining] = useState(remainingInit);
  const pending = useRef<Result | null>(null);
  const [tvOpen, setTvOpen] = useState(false);
  const [nudge, setNudge] = useState(0);
  const { settings, segments } = wheel;
  const tv = useTvLink(wheel, name);
  const tvRef = useRef(tv);
  tvRef.current = tv;

  // arrivando dal QR della TV il pannello si apre da solo e mostra il collegamento in corso
  useEffect(() => {
    if (tv.status === "connecting") setTvOpen(true);
    if (tv.status === "linked") setTvOpen(false);
  }, [tv.status]);

  // TV non collegabile: si chiude il pannello e si "richiama" il bottone per girare qui
  const playHere = () => {
    tv.clearFailure();
    tv.clearLost();
    setTvOpen(false);
    setNudge((n) => n + 1);
  };

  useEffect(() => {
    try {
      setMutedState(localStorage.getItem("fu_muted") === "1");
    } catch {}
  }, []);

  const resolve = useCallback(async () => {
    const link = tvRef.current.status === "linked" ? tvRef.current.link : null;
    const t0 = performance.now();
    const res = await fetch("/api/spin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        wheelId: wheel.id,
        wheelVersion: wheelRef.current.version,
        playerName: name.trim() || undefined,
        tv: link ? { code: link.code, session: link.session } : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    const t1 = performance.now();
    if (!res.ok) {
      if (typeof data.remaining === "number") setRemaining(data.remaining);
      throw new Error(data.error || "Qualcosa è andato storto, riprova.");
    }
    // ruota modificata dopo l'apertura della pagina: usiamo quella del server (la stessa della TV)
    let segs = wheelRef.current.segments;
    if (data.wheel) {
      setWheel(data.wheel);
      wheelRef.current = data.wheel;
      segs = data.wheel.segments;
    }
    // lo spicchio si cerca per ID, mai solo per posizione
    const byId = segs.findIndex((s) => s.id === data.segmentId);
    const index = byId >= 0 ? byId : data.index;
    pending.current = { index, code: data.code, kind: data.kind, label: data.label };
    if (typeof data.remaining === "number") setRemaining(data.remaining);
    if (link) tvRef.current.reportSpin(!!data.tv);
    // con la TV collegata la frenata parte all'istante fissato dal server (meno metà del tempo di risposta)
    const decelAt = data.tv ? t1 + data.tv.decelInMs - (t1 - t0) / 2 : undefined;
    return { index, jitter: typeof data.jitter === "number" ? data.jitter : undefined, decelAt };
  }, [wheel.id, name]);

  const onSettled = useCallback(
    (o: Outcome) => {
      if (!o.ok) {
        setError(o.error);
        return;
      }
      const r = pending.current!;
      setResult(r);
      if (r.kind === "premio") {
        setBurst((b) => b + 1);
        winSound();
        navigator.vibrate?.([30, 40, 60]);
      } else if (r.kind === "penitenza") {
        penaltySound();
        navigator.vibrate?.([120, 60, 120]);
      }
    },
    [],
  );

  const canSpin = useCallback(() => {
    if (result || error) return false;
    if (remaining === 0 || closed) return false;
    if (settings.askName === "required" && !name.trim()) {
      setNameError(true);
      document.getElementById("player-name")?.focus();
      return false;
    }
    return true;
  }, [result, error, remaining, closed, settings.askName, name]);

  const { spin, spinning, handlers } = useSpinner({
    wheel: ref,
    count: segments.length,
    decelSeconds: settings.spinSeconds,
    sound: settings.sound && !muted,
    resolve,
    onSettled,
    canSpin,
  });

  const toggleMute = () => {
    setMutedState((m) => {
      try {
        localStorage.setItem("fu_muted", m ? "0" : "1");
      } catch {}
      return !m;
    });
  };

  const close = () => {
    setResult(null);
    setError(null);
  };

  const seg = result ? segments[result.index] : null;
  const title = result ? (result.kind === "premio" ? settings.winTitle : result.kind === "penitenza" ? settings.penaltyTitle : settings.neutralTitle) : "";
  const out = remaining === 0 || !!closed;

  return (
    <div className={`game ${spinning ? "is-spinning" : ""}`}>
      <header className="game-head">
        <img className="game-logo" src="/brand/fitup-logo.png" alt="FitUP" />
        {settings.sound && (
          <button className="icon-btn" onClick={toggleMute} aria-label={muted ? "Attiva audio" : "Disattiva audio"}>
            {muted ? (
              <svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zm12.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zm11.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM13 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" /></svg>
            )}
          </button>
        )}
      </header>

      <div className="game-titles">
        <h1>{settings.title}</h1>
        {wheel.event && <p className="game-event">{eventText(wheel.event)}</p>}
        {settings.subtitle && <p>{settings.subtitle}</p>}
      </div>
      {test && <div className="test-banner">Modalità prova staff: oggi la ruota non è aperta al pubblico, le giocate non vengono registrate.</div>}
      {closed && <div className="closed-banner">{closed}</div>}

      <div className="game-stage">
        <div className="game-wheel" {...handlers} role="button" tabIndex={0} aria-label="Gira la ruota"
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), spin())}>
          <WheelView ref={ref} segments={segments} interactive={!spinning && !out} />
        </div>
      </div>

      <div className="game-controls">
        {settings.askName !== "off" && (
          <input
            id="player-name"
            className={`input ${nameError ? "is-error" : ""}`}
            value={name}
            maxLength={80}
            autoComplete="name"
            placeholder={settings.askName === "required" ? settings.namePlaceholder.replace(/\s*\(facoltativo\)/i, "") : settings.namePlaceholder}
            onChange={(e) => (setName(e.target.value), setNameError(false))}
            disabled={spinning}
          />
        )}
        <button key={nudge} className={`btn btn-spin ${nudge ? "btn-nudge" : ""}`} onClick={() => spin()} disabled={spinning || out}>
          {closed ? "Non ancora disponibile" : out ? "Giocate finite per oggi" : spinning ? "Gira…" : "Gira la ruota"}
        </button>
        {typeof remaining === "number" && remaining > 0 && <p className="hint">Giocate rimaste oggi: {remaining}</p>}
        {!spinning && !out && <p className="hint">Tocca o trascina la ruota per farla girare</p>}
        {tv.status === "linked" && tv.link ? (
          <div className="tv-chip">
            <span className="tv-dot" /> Sulla TV: <b>{tv.link.tvName}</b>
            <button onClick={tv.disconnect} disabled={spinning}>Scollega</button>
          </div>
        ) : (
          !out && (
            <button className="btn btn-ghost btn-tv" onClick={() => setTvOpen(true)} disabled={spinning}>
              <svg viewBox="0 0 24 24" aria-hidden><path d="M21 3H3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h7v2H8v2h8v-2h-2v-2h7a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 13H3V5h18v11z" /></svg>
              Guarda sulla TV del club
            </button>
          )
        )}
      </div>

      {(tvOpen || tv.failure || tv.lost) && (
        <TvSheet
          status={tv.status}
          failure={tv.failure}
          lost={tv.lost}
          onConnect={tv.connect}
          onClose={() => (setTvOpen(false), tv.clearFailure(), tv.clearLost())}
          onPlayHere={playHere}
        />
      )}

      <Confetti burst={burst} />

      {(result || error) && (
        <div className="modal-backdrop" onClick={close}>
          <div className={`modal result-${result?.kind ?? "error"}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
            {result && seg ? (
              <>
                <p className="modal-kicker">{title}</p>
                <div className="modal-prize" style={{ background: seg.color }}>
                  {seg.display === "image" && seg.image ? (
                    <img src={seg.image} alt={seg.label}
                      style={{ filter: shouldInvert(seg.imageMode, seg.color) ? "invert(1)" : undefined }} />
                  ) : (
                    <span style={{ color: seg.textColor || autoTextColor(seg.color) }}>{seg.label}</span>
                  )}
                </div>
                <h2 className="modal-label">{result.label}</h2>
                {result.kind === "penitenza" && <p className="modal-sub">Niente scuse: falla subito!</p>}
                {result.code && (
                  <div className="modal-code">
                    <span>Codice giocata</span>
                    <strong>{result.code}</strong>
                  </div>
                )}
                {result.kind === "premio" && settings.footer && <p className="modal-sub">{settings.footer}</p>}
              </>
            ) : (
              <>
                <p className="modal-kicker">Ops!</p>
                <h2 className="modal-label">{error}</h2>
              </>
            )}
            <button className="btn" onClick={close}>{remaining === 0 ? "Chiudi" : "Ok"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

