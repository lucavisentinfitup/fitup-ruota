// Caricamento di font e immagini per il disegno della ruota (solo browser moderni / telefono).
import type { PublicSegment } from "@/lib/types";

export { GEO, drawWheel, drawBlur, fitBox } from "./draw";

type Img = HTMLImageElement;
const imageCache = new Map<string, Promise<Img | null>>();

export function loadImage(src: string): Promise<Img | null> {
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    imageCache.set(src, p);
  }
  return p;
}

export async function loadAssets(segments: PublicSegment[]) {
  const map = new Map<string, Img>();
  await Promise.all(
    segments
      .filter((s) => s.display === "image" && s.image)
      .map(async (s) => {
        const img = await loadImage(s.image!);
        if (img) map.set(s.image!, img);
      }),
  );
  return map;
}

export function fontFamily(): string {
  if (typeof document === "undefined") return "sans-serif";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-oswald").trim();
  return v || "Oswald, 'Arial Narrow', sans-serif";
}

export async function ensureFont() {
  const fam = fontFamily();
  try {
    await document.fonts.load(`600 64px ${fam}`, "ABC");
  } catch {}
  return fam;
}

