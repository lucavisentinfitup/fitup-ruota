import { addDays, romeMidnight } from "./time";
import type { SpinFilters } from "./types";

/** Legge i filtri del report dalla query string. `from`/`to` sono giorni "YYYY-MM-DD" (inclusi), ora di Roma. */
export function parseFilters(url: URL): SpinFilters {
  const p = url.searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const from = p.get("from");
  const to = p.get("to");
  const kind = p.get("kind");
  return {
    from: from && day.test(from) ? romeMidnight(from).toISOString() : undefined,
    to: to && day.test(to) ? romeMidnight(addDays(to, 1)).toISOString() : undefined,
    wheelId: p.get("wheelId") || undefined,
    kind: kind === "premio" || kind === "penitenza" || kind === "neutro" ? kind : undefined,
    q: p.get("q")?.trim().slice(0, 60) || undefined,
    toRedeem: p.get("toRedeem") === "1" || undefined,
    limit: Math.min(500, Math.max(1, Number(p.get("limit")) || 100)),
    offset: Math.max(0, Number(p.get("offset")) || 0),
  };
}
