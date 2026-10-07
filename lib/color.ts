export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Testo nero su verde/bianco, bianco su nero/scuri. */
export const autoTextColor = (bg: string) => (luminance(bg) > 0.35 ? "#0D0D0D" : "#FFFFFF");

/** Sfondi abbastanza chiari da rendere poco leggibili gli sticker bianchi. */
export const isLight = (bg: string) => luminance(bg) > 0.6;

export const shouldInvert = (mode: "auto" | "original" | "invert", bg: string) =>
  mode === "invert" || (mode === "auto" && isLight(bg));
