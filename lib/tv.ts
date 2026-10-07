import "server-only";
import { db } from "./db";
import type { TvEvent, TvScreen, TvState } from "./types";

/** La TV manda un heartbeat ogni 20 s: oltre questa soglia la consideriamo spenta. */
export const TV_ONLINE_MS = 50_000;
/** Sotto questi fps (misurati dall'autotest sulla TV) l'animazione non sarebbe fluida: non ci colleghiamo. */
export const TV_MIN_FPS = 24;
/** Sessione telefono↔TV chiusa dopo questa inattività */
export const TV_SESSION_IDLE_MS = 5 * 60_000;
const KEEP_EVENTS = 8;

export function tvStatus(tv: TvScreen) {
  const online = !!tv.lastSeenAt && Date.now() - new Date(tv.lastSeenAt).getTime() < TV_ONLINE_MS;
  const capable = tv.bootFps !== null && tv.bootFps >= TV_MIN_FPS;
  return { online, capable };
}

export const normalizeCode = (c: unknown) => String(c ?? "").replace(/\D/g, "").slice(0, 6);

export async function newTvCode(): Promise<string> {
  const store = await db();
  for (;;) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 900000;
    const code = String(100000 + n);
    if (!(await store.getTvByCode(code))) return code;
  }
}

export const realtimeMode = () => (process.env.ABLY_API_KEY ? "ably" : "poll");

/**
 * Invia un evento a una TV: lo salva nello stato (letto dalle TV in polling) e, se configurato,
 * lo pubblica in tempo reale su Ably. `mutate` aggiorna sessione/occupazione nella stessa scrittura;
 * se restituisce false l'evento non viene inviato.
 */
export async function emitTv(code: string, event: TvEvent, mutate?: (s: TvState) => boolean | void) {
  const store = await db();
  const at = Date.now();
  let seq = 0;
  const next = await store.updateTvState(code, (s) => {
    seq = 0;
    if (mutate?.(s) === false) return null;
    seq = s.seq + 1;
    s.seq = seq;
    s.events = [...s.events, { seq, at, event }].slice(-KEEP_EVENTS);
    return s;
  });
  if (!seq) return null;
  if (realtimeMode() === "ably") {
    await ablyPublish(`tv:${code}`, { seq, at, event }).catch((e) => console.error("Ably publish", e));
  }
  return next;
}

// ---------------------------------------------------------------- Ably (REST, nessuna libreria)
const ABLY = "https://rest.ably.io";
const basic = () => "Basic " + Buffer.from(process.env.ABLY_API_KEY!).toString("base64");

async function ablyPublish(channel: string, payload: unknown) {
  const res = await fetch(`${ABLY}/channels/${encodeURIComponent(channel)}/messages`, {
    method: "POST",
    headers: { authorization: basic(), "content-type": "application/json" },
    body: JSON.stringify({ name: "tv", data: JSON.stringify(payload) }),
  });
  if (!res.ok) throw new Error(`Ably ${res.status}`);
}

/** Token in sola lettura per un singolo canale TV (la chiave API resta sul server). */
export async function ablyToken(code: string): Promise<{ token: string; expires: number }> {
  const keyName = process.env.ABLY_API_KEY!.split(":")[0];
  const res = await fetch(`${ABLY}/keys/${encodeURIComponent(keyName)}/requestToken`, {
    method: "POST",
    headers: { authorization: basic(), "content-type": "application/json" },
    body: JSON.stringify({
      keyName,
      capability: JSON.stringify({ [`tv:${code}`]: ["subscribe"] }),
      ttl: 3 * 3600_000,
      timestamp: Date.now(),
    }),
  });
  if (!res.ok) throw new Error(`Ably token ${res.status}`);
  const t = (await res.json()) as { token: string; expires: number };
  return { token: t.token, expires: t.expires };
}
