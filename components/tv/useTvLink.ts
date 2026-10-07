"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TvLinkStatus = "off" | "connecting" | "linked";
export type TvFailure = "unreachable" | "busy" | "not_found";

interface Link {
  code: string;
  session: string;
  tvName: string;
}

const KEY = "fu_tv";
const ACK_TIMEOUT_MS = 6000;

/**
 * Collegamento facoltativo telefono → TV del club. Niente permessi: il codice arriva dal QR
 * (aperto dalla fotocamera di sistema) o viene digitato. Il collegamento vale solo se la TV
 * risponde entro pochi secondi; altrimenti si gioca sul telefono.
 */
export function useTvLink(wheel: { id: string; slug: string }, playerName: string) {
  const [status, setStatus] = useState<TvLinkStatus>("off");
  const [link, setLink] = useState<Link | null>(null);
  const [failure, setFailure] = useState<TvFailure | null>(null);
  const [lost, setLost] = useState(false);
  const nameRef = useRef(playerName);
  nameRef.current = playerName;
  const busy = useRef(false);

  const save = (l: Link | null) => {
    try {
      if (l) sessionStorage.setItem(KEY, JSON.stringify(l));
      else sessionStorage.removeItem(KEY);
    } catch {}
  };

  const connect = useCallback(
    async (rawCode: string) => {
      const code = rawCode.replace(/\D/g, "");
      if (busy.current) return;
      if (code.length !== 6) return setFailure("not_found");
      busy.current = true;
      setFailure(null);
      setLost(false);
      setStatus("connecting");
      const fail = (f: TvFailure) => {
        setStatus("off");
        setLink(null);
        save(null);
        setFailure(f);
        busy.current = false;
      };
      try {
        const res = await fetch("/api/tv/pair", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, playerName: nameRef.current.trim() || undefined }),
        });
        const data = await res.json().catch(() => ({}));
        if (!data.ok) return fail(data.reason === "not_found" ? "not_found" : data.reason === "busy" ? "busy" : "unreachable");
        // la TV mostra un'altra ruota: apriamo quella, il collegamento riparte da lì
        if (data.wheelId && data.wheelId !== wheel.id && data.wheelSlug) {
          location.replace(`/gioca/${data.wheelSlug}?tv=${code}`);
          return;
        }
        // attendiamo la conferma della TV: è la prova che riceve davvero gli eventi
        const t0 = Date.now();
        while (Date.now() - t0 < ACK_TIMEOUT_MS) {
          await new Promise((r) => setTimeout(r, 450));
          const st = await fetch(`/api/tv/pair?code=${code}&session=${data.sessionId}`).then((r) => r.json()).catch(() => null);
          if (st?.acked) {
            const l = { code, session: data.sessionId as string, tvName: data.tvName as string };
            setLink(l);
            save(l);
            setStatus("linked");
            busy.current = false;
            return;
          }
        }
        fetch(`/api/tv/pair?code=${code}&session=${data.sessionId}`, { method: "DELETE" }).catch(() => {});
        fail("unreachable");
      } catch {
        fail("unreachable");
      }
    },
    [wheel.id],
  );

  const disconnect = useCallback(() => {
    if (link) fetch(`/api/tv/pair?code=${link.code}&session=${link.session}`, { method: "DELETE" }).catch(() => {});
    setLink(null);
    save(null);
    setStatus("off");
  }, [link]);

  /** Chiamato dopo un giro: il server ci dice se la TV era ancora collegata. */
  const reportSpin = useCallback((tvOk: boolean) => {
    if (tvOk || !link) return;
    setLink(null);
    save(null);
    setStatus("off");
    setLost(true);
  }, [link]);

  // ripristino dopo un ricaricamento, oppure collegamento automatico arrivando dal QR della TV
  useEffect(() => {
    const fromQr = new URLSearchParams(location.search).get("tv");
    let stored: Link | null = null;
    try {
      stored = JSON.parse(sessionStorage.getItem(KEY) || "null");
    } catch {}
    if (fromQr && (!stored || stored.code !== fromQr.replace(/\D/g, ""))) {
      history.replaceState(null, "", location.pathname);
      connect(fromQr);
      return;
    }
    if (fromQr) history.replaceState(null, "", location.pathname);
    if (stored) {
      fetch(`/api/tv/pair?code=${stored.code}&session=${stored.session}`)
        .then((r) => r.json())
        .then((st) => {
          if (st?.acked && st.online) {
            setLink(stored);
            setStatus("linked");
          } else save(null);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // controllo periodico: se la TV si spegne lo diciamo e si continua sul telefono
  useEffect(() => {
    if (status !== "linked" || !link) return;
    const t = setInterval(async () => {
      const st = await fetch(`/api/tv/pair?code=${link.code}&session=${link.session}`).then((r) => r.json()).catch(() => null);
      if (st && (!st.valid || !st.online)) reportSpin(false);
    }, 20000);
    return () => clearInterval(t);
  }, [status, link, reportSpin]);

  return { status, link, failure, lost, connect, disconnect, reportSpin, clearFailure: () => setFailure(null), clearLost: () => setLost(false) };
}
