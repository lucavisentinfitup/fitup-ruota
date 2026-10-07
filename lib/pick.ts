import type { Segment } from "./types";

/** Estrazione pesata crittograficamente sicura. Restituisce l'indice o -1 se nessuno spicchio è disponibile. */
export function pickWeighted(segments: Pick<Segment, "weight" | "stock" | "id">[], wins: Record<string, number> = {}): number {
  const w = segments.map((s) => (s.weight > 0 && (s.stock === null || (wins[s.id] ?? 0) < s.stock) ? s.weight : 0));
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return -1;
  const r = (crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * total;
  let acc = 0;
  for (let i = 0; i < w.length; i++) {
    acc += w[i];
    if (r < acc) return i;
  }
  for (let i = w.length - 1; i >= 0; i--) if (w[i] > 0) return i;
  return -1;
}

export function spinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(b, (x) => alphabet[x % alphabet.length]).join("");
}
