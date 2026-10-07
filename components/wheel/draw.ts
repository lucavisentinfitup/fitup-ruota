// Disegno della ruota su canvas, condiviso tra telefono e schermo TV (compilato anche in ES5).
// La ruota viene disegnata UNA volta in un bitmap ad alta risoluzione e poi ruotata via CSS transform (GPU).
import type { PublicSegment } from "@/lib/types";
import { autoTextColor, shouldInvert } from "@/lib/color";

/** Proporzioni rispetto al raggio R (riprese dalla ruota fisica: 1000 mm, mozzo 250 mm). */
export const GEO = {
  rim: 0.965, // bordo interno della cornice nera
  pegs: 0.928, // raggio dei pioli
  hub: 0.26, // raggio del mozzo col logo
  contentOuter: 0.895,
  contentInnerPad: 1.08,
};

type Img = HTMLImageElement;
/** Basta un oggetto con get(): sulla TV non usiamo Map. */
export interface ImageLookup {
  get(src: string): Img | undefined;
}

/**
 * Trova il rettangolo più grande (lungo il raggio) con rapporto `aspect` = lunghezza/altezza
 * che sta dentro uno spicchio di semi-ampiezza `half` tra rMin e rMax.
 */
export function fitBox(aspect: number, half: number, rMin: number, rMax: number) {
  const t = Math.tan(Math.min(half, 0.9)) * 0.9; // margine laterale
  let best = { r0: rMin, len: 0, h: 0 };
  for (let i = 0; i <= 60; i++) {
    const r0 = rMin + ((rMax - rMin) * i) / 60;
    // l'altezza è limitata dal bordo interno (più stretto) e dalla lunghezza disponibile
    const h = Math.min(2 * t * r0, (rMax - r0) / aspect, rMax * 0.42);
    if (h > best.h) best = { r0, len: h * aspect, h };
  }
  // centra il contenuto nello spazio radiale libero
  const slack = rMax - best.r0 - best.len;
  return { ...best, r0: best.r0 + slack * 0.5 };
}

interface TextLayout {
  lines: string[];
  em: number;
}

/** Sceglie a capo e dimensione del testo per riempire bene lo spicchio. */
function layoutText(ctx: CanvasRenderingContext2D, label: string, fam: string, half: number, rMin: number, rMax: number): TextLayout & { r0: number; len: number } {
  ctx.font = `600 100px ${fam}`;
  const capH = (ctx.measureText("H").actualBoundingBoxAscent || 72) / 100;
  const gap = 0.3;
  const text = label.toUpperCase().trim();
  const candidates: string[][] = [];
  if (text.indexOf("\n") >= 0) candidates.push(text.split("\n").map((l) => l.trim()).filter(Boolean));
  else {
    const words = text.split(/\s+/).filter(Boolean);
    const n = words.length;
    candidates.push([words.join(" ")]);
    for (let a = 1; a < n; a++) {
      candidates.push([words.slice(0, a).join(" "), words.slice(a).join(" ")]);
      for (let b = a + 1; b < n; b++) candidates.push([words.slice(0, a).join(" "), words.slice(a, b).join(" "), words.slice(b).join(" ")]);
    }
  }
  let best: TextLayout & { r0: number; len: number; score: number } = { lines: [text], em: 10, r0: rMin, len: 0, score: -1 };
  for (const lines of candidates) {
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) / 100; // in em
    const hEm = lines.length * capH + (lines.length - 1) * gap;
    const box = fitBox(w / hEm, half, rMin, rMax);
    const em = Math.min(box.h / hEm, rMax * 0.13);
    const score = em * (1 - 0.06 * (lines.length - 1)); // a parità, meno righe
    if (score > best.score) best = { lines, em, r0: box.r0 + (box.len - w * em) / 2, len: w * em, score };
  }
  return best;
}

/** Inverte i colori di un'immagine mantenendo la trasparenza (senza leggere i pixel: niente problemi CORS). */
function invertedImage(img: Img, w: number, h: number): HTMLCanvasElement | null {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const x = c.getContext("2d")!;
  x.drawImage(img, 0, 0, c.width, c.height);
  x.globalCompositeOperation = "difference";
  // motori web vecchi (alcuni TV) non supportano "difference": meglio l'originale che una sagoma bianca
  if (x.globalCompositeOperation !== "difference") return null;
  x.fillStyle = "#fff";
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = "destination-in";
  x.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** Disegna la parte rotante della ruota (spicchi, contenuti, cornice, pioli) su un canvas quadrato. */
export function drawWheel(canvas: HTMLCanvasElement, segments: PublicSegment[], images: ImageLookup, fam: string) {
  const size = canvas.width;
  const ctx = canvas.getContext("2d")!;
  const R = size / 2;
  const n = segments.length;
  const a = (Math.PI * 2) / n;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(R, R);

  // spicchi: lo spicchio i è centrato a i*a, misurato in senso orario dall'alto
  const rs = R * GEO.rim;
  segments.forEach((s, i) => {
    const c = -Math.PI / 2 + i * a;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, rs + 1, c - a / 2, c + a / 2);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
  });

  // sottili divisori per gli spicchi dello stesso colore adiacenti
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = Math.max(1, R * 0.004);
  segments.forEach((s, i) => {
    const next = segments[(i + 1) % n];
    if (next.color.toLowerCase() !== s.color.toLowerCase()) return;
    const b = -Math.PI / 2 + i * a + a / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(b) * R * GEO.hub, Math.sin(b) * R * GEO.hub);
    ctx.lineTo(Math.cos(b) * rs, Math.sin(b) * rs);
    ctx.stroke();
  });

  // contenuti: letti dal centro verso l'esterno
  const rMin = R * GEO.hub * GEO.contentInnerPad;
  const rMax = R * GEO.contentOuter;
  segments.forEach((s, i) => {
    ctx.save();
    ctx.rotate(-Math.PI / 2 + i * a);
    const img = s.display === "image" && s.image ? images.get(s.image) : undefined;
    if (img) {
      const box = fitBox(img.naturalWidth / img.naturalHeight, a / 2, rMin, rMax);
      const invert = shouldInvert(s.imageMode, s.color);
      const src: CanvasImageSource = (invert && invertedImage(img, box.len, box.h)) || img;
      ctx.drawImage(src, box.r0, -box.h / 2, box.len, box.h);
    } else {
      const t = layoutText(ctx, s.label, fam, a / 2, rMin, rMax);
      ctx.font = `600 ${t.em}px ${fam}`;
      ctx.fillStyle = s.textColor || autoTextColor(s.color);
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "center";
      const capH = ctx.measureText("H").actualBoundingBoxAscent || t.em * 0.72;
      const gap = t.em * 0.3;
      const total = t.lines.length * capH + (t.lines.length - 1) * gap;
      const cx = t.r0 + t.len / 2;
      t.lines.forEach((line, li) => {
        ctx.fillText(line, cx, -total / 2 + capH + li * (capH + gap));
      });
    }
    ctx.restore();
  });

  // ombra interna leggera vicino alla cornice (profondità)
  const inner = ctx.createRadialGradient(0, 0, rs * 0.82, 0, 0, rs);
  inner.addColorStop(0, "rgba(0,0,0,0)");
  inner.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(0, 0, rs, 0, Math.PI * 2);
  ctx.fill();

  // cornice nera
  ctx.beginPath();
  ctx.arc(0, 0, R - 1, 0, Math.PI * 2);
  ctx.arc(0, 0, rs, 0, Math.PI * 2, true);
  ctx.fillStyle = "#0d0d0d";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, rs, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = Math.max(1, R * 0.006);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, R - R * 0.012, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(148,196,36,0.9)";
  ctx.lineWidth = Math.max(1, R * 0.008);
  ctx.stroke();

  // pioli sul confine di ogni spicchio
  const pr = R * 0.019;
  for (let i = 0; i < n; i++) {
    const b = -Math.PI / 2 + i * a + a / 2;
    const x = Math.cos(b) * R * GEO.pegs;
    const y = Math.sin(b) * R * GEO.pegs;
    ctx.beginPath();
    ctx.arc(x + pr * 0.25, y + pr * 0.35, pr, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fill();
    const g = ctx.createRadialGradient(x - pr * 0.35, y - pr * 0.35, pr * 0.1, x, y, pr);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.55, "#cfd3d6");
    g.addColorStop(1, "#7d8287");
    ctx.beginPath();
    ctx.arc(x, y, pr, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.restore();
}

/** Motion blur rotazionale pre-calcolato: tante copie ruotate di poco e mediate. */
export function drawBlur(target: HTMLCanvasElement, source: HTMLCanvasElement, spreadDeg = 9, steps = 14) {
  const ctx = target.getContext("2d")!;
  const s = target.width;
  ctx.clearRect(0, 0, s, s);
  for (let i = 0; i < steps; i++) {
    const off = ((i / (steps - 1)) * 2 - 1) * ((spreadDeg * Math.PI) / 180);
    ctx.save();
    ctx.globalAlpha = 1 / (i + 1); // media progressiva: ogni copia pesa uguale
    ctx.translate(s / 2, s / 2);
    ctx.rotate(off);
    ctx.drawImage(source, -s / 2, -s / 2, s, s);
    ctx.restore();
  }
}
