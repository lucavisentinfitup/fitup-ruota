export const TZ = "Europe/Rome";

/** "YYYY-MM-DD" del giorno a Roma per un istante. */
export function romeDay(d: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(d),
  );
}

/** Mezzanotte (ora di Roma) del giorno "YYYY-MM-DD", come Date UTC. */
export function romeMidnight(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  // offset di Roma in quell'istante (CET/CEST)
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hourCycle: "h23", day: "2-digit" }).formatToParts(guess);
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  const dayOut = Number(parts.find((p) => p.type === "day")!.value);
  const offsetH = dayOut === d ? hour : hour - 24;
  return new Date(guess.getTime() - offsetH * 3600_000);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function formatRome(iso: string, opts: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" }) {
  return new Intl.DateTimeFormat("it-IT", { timeZone: TZ, ...opts }).format(new Date(iso));
}
