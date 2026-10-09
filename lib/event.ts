import type { WheelEvent } from "./types";
import { romeDay } from "./time";

/** Si può giocare oggi (ora di Roma)? Senza evento si gioca sempre. */
export function isOpenToday(event: WheelEvent | null | undefined, now: Date = new Date()) {
  return !event || event.dates.includes(romeDay(now));
}

/** "domenica 19 ottobre" */
export function formatEventDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "Open Day · domenica 19 ottobre" */
export function eventText(event: WheelEvent | null | undefined) {
  if (!event) return "";
  return `${event.type} · ${event.dates.map(formatEventDay).join(", ")}`;
}

/**
 * Schermo TV "pulito" nel giorno dell'evento: solo ruota, titolo e data di oggi (niente QR né codice).
 * Le ruote senza calendario (sempre aperte) e gli schermi in modalità regolamento restano come prima.
 */
export function tvCleanToday(event: WheelEvent | null | undefined, qrMode: "play" | "rules", now: Date = new Date()) {
  return !!event && qrMode === "play" && event.dates.includes(romeDay(now));
}

/** "Compleanno · venerdì 9 ottobre": solo la giornata di oggi. */
export function eventTextToday(event: WheelEvent, now: Date = new Date()) {
  return `${event.type} · ${formatEventDay(romeDay(now))}`;
}

/** Messaggio per il giocatore quando la ruota non è aperta oggi. */
export function closedMessage(event: WheelEvent, now: Date = new Date()) {
  const today = romeDay(now);
  const next = event.dates.find((d) => d > today);
  return next
    ? `La ruota si gira ${formatEventDay(next)}, durante l'${event.type === "Open Day" ? "Open Day" : event.type === "Compleanno" ? "evento Compleanno" : "evento"} del club. Ti aspettiamo!`
    : "L'evento di questo club è terminato. Grazie a tutti per aver giocato!";
}
