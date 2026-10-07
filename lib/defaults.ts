import type { PublicWheel, Segment, SegmentKind, Wheel, WheelSettings } from "./types";

export const BRAND = {
  green: "#94C424",
  black: "#0D0D0D",
  white: "#FFFFFF",
};

export const PALETTE = [
  { name: "Verde FitUP", value: "#94C424" },
  { name: "Nero", value: "#0D0D0D" },
  { name: "Bianco", value: "#FFFFFF" },
  { name: "Grigio scuro", value: "#33373D" },
  { name: "Grigio chiaro", value: "#F2F2F2" },
  { name: "Verde scuro", value: "#5E7F12" },
];

/** I 15 sticker (scritta bianca su trasparente). `label` è il nome che compare nel report. */
export const STICKERS: { file: string; label: string; kind: SegmentKind }[] = [
  { file: "/stickers/01.png", label: "10 Squat", kind: "penitenza" },
  { file: "/stickers/02.png", label: "10 Jumping Jack", kind: "penitenza" },
  { file: "/stickers/03.png", label: "10 Addominali", kind: "penitenza" },
  { file: "/stickers/04.png", label: "10 Affondi", kind: "penitenza" },
  { file: "/stickers/05.png", label: "5 Burpees", kind: "penitenza" },
  { file: "/stickers/06.png", label: "Borsone FitUP", kind: "premio" },
  { file: "/stickers/07.png", label: "Shaker FitUP", kind: "premio" },
  { file: "/stickers/08.png", label: "Asciugamano FitUP", kind: "premio" },
  { file: "/stickers/09.png", label: "T-Shirt FitUP", kind: "premio" },
  { file: "/stickers/10.png", label: "Straps FitUP", kind: "premio" },
  { file: "/stickers/11.png", label: "Yamamoto 1 – Amino compresse", kind: "premio" },
  { file: "/stickers/12.png", label: "Yamamoto 2 – Creatina tavolette", kind: "premio" },
  { file: "/stickers/13.png", label: "Yamamoto 3 – 2 Barrette", kind: "premio" },
  { file: "/stickers/14.png", label: "1 Settimana gratis", kind: "premio" },
  { file: "/stickers/15.png", label: "1 Settimana gratis x un tuo amico", kind: "premio" },
];

/**
 * Disposizione del render "Premi Ruota della Fortuna x Promo Ottobre", in senso orario
 * partendo dallo spicchio sotto la lancetta. Numeri = sticker (01–15). Colori bianco/verde/nero.
 */
export const PROMO_OTTOBRE_ORDER = [6, 11, 2, 14, 7, 3, 12, 15, 4, 8, 13, 5, 9, 10, 1];

export const DEFAULT_SETTINGS: WheelSettings = {
  title: "Gira la ruota",
  subtitle: "Tocca la ruota e sfida la fortuna. Zero scuse!",
  askName: "optional",
  namePlaceholder: "Nome o ID tessera (facoltativo)",
  limitPerDevicePerDay: 0,
  spinSeconds: 6,
  sound: true,
  winTitle: "Hai vinto!",
  penaltyTitle: "Penitenza!",
  neutralTitle: "Risultato",
  footer: "Mostra il codice alla reception per ritirare il premio.",
};

export function uid(len = 10): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function defaultSegments(): Segment[] {
  const colors = [BRAND.white, BRAND.green, BRAND.black];
  return PROMO_OTTOBRE_ORDER.map((n, i) => {
    const s = STICKERS[n - 1];
    return {
      id: uid(),
      label: s.label,
      display: "image" as const,
      image: s.file,
      imageMode: "auto" as const,
      color: colors[i % 3],
      textColor: null,
      kind: s.kind,
      weight: 1,
      stock: null,
    };
  });
}

export function defaultWheel(): Wheel {
  const now = new Date().toISOString();
  return {
    id: uid(),
    slug: "fitup",
    name: "Ruota della Fortuna FitUP",
    active: true,
    isDefault: true,
    segments: defaultSegments(),
    settings: { ...DEFAULT_SETTINGS },
    clubId: null,
    clubName: null,
    event: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function toPublicWheel(w: Wheel): PublicWheel {
  return {
    id: w.id,
    slug: w.slug,
    name: w.name,
    version: w.updatedAt,
    event: w.event ?? null,
    settings: w.settings,
    segments: w.segments.map(({ weight: _w, stock: _s, ...rest }) => rest),
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const str = (v: unknown, max: number, fallback = "") =>
  typeof v === "string" ? v.slice(0, max) : fallback;

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "ruota"
  );
}

function sanitizeEvent(e: unknown): Wheel["event"] {
  if (!e || typeof e !== "object") return null;
  const ev = e as Partial<NonNullable<Wheel["event"]>>;
  const dates = Array.isArray(ev.dates) ? [...new Set(ev.dates.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort() : [];
  if (!dates.length) return null;
  return { dates, type: str(ev.type, 40).trim() || "Evento", areaManager: str(ev.areaManager, 80).trim() || null };
}

/** Valida e ripulisce una ruota proveniente dal backend. Lancia Error con messaggio leggibile. */
export function sanitizeWheel(input: Partial<Wheel>, base: Wheel): Wheel {
  const segsIn = Array.isArray(input.segments) ? input.segments : base.segments;
  if (segsIn.length < 2) throw new Error("La ruota deve avere almeno 2 spicchi.");
  if (segsIn.length > 36) throw new Error("Massimo 36 spicchi.");
  const seen = new Set<string>();
  const segments: Segment[] = segsIn.map((s: Partial<Segment>) => {
    let id = str(s.id, 32) || uid();
    if (seen.has(id)) id = uid();
    seen.add(id);
    const image = str(s.image, 600) || null;
    if (image && !/^(\/|https:\/\/)/.test(image)) throw new Error("URL immagine non valido.");
    const stock = s.stock === null || s.stock === undefined || (s.stock as unknown) === "" ? null : clamp(Math.floor(Number(s.stock)), 0, 1e6);
    return {
      id,
      label: str(s.label, 80).trim() || "Spicchio",
      display: s.display === "text" ? "text" : image ? "image" : "text",
      image,
      imageMode: s.imageMode === "original" || s.imageMode === "invert" ? s.imageMode : "auto",
      color: HEX.test(s.color ?? "") ? s.color! : BRAND.white,
      textColor: HEX.test(s.textColor ?? "") ? s.textColor! : null,
      kind: s.kind === "penitenza" || s.kind === "neutro" ? s.kind : "premio",
      weight: clamp(Number(s.weight) || 0, 0, 1000),
      stock: Number.isFinite(stock as number) ? stock : null,
    };
  });
  if (!segments.some((s) => s.weight > 0)) throw new Error("Almeno uno spicchio deve avere probabilità > 0.");
  const si = (input.settings ?? {}) as Partial<WheelSettings>;
  const bs = { ...DEFAULT_SETTINGS, ...base.settings };
  const settings: WheelSettings = {
    title: str(si.title, 60, bs.title),
    subtitle: str(si.subtitle, 160, bs.subtitle),
    askName: si.askName === "off" || si.askName === "required" || si.askName === "optional" ? si.askName : bs.askName,
    namePlaceholder: str(si.namePlaceholder, 80, bs.namePlaceholder),
    limitPerDevicePerDay: clamp(Math.floor(Number(si.limitPerDevicePerDay ?? bs.limitPerDevicePerDay)) || 0, 0, 100),
    spinSeconds: clamp(Number(si.spinSeconds ?? bs.spinSeconds) || 6, 3, 12),
    sound: typeof si.sound === "boolean" ? si.sound : bs.sound,
    winTitle: str(si.winTitle, 40, bs.winTitle),
    penaltyTitle: str(si.penaltyTitle, 40, bs.penaltyTitle),
    neutralTitle: str(si.neutralTitle, 40, bs.neutralTitle),
    footer: str(si.footer, 200, bs.footer),
  };
  return {
    ...base,
    name: str(input.name, 80, base.name).trim() || base.name,
    slug: slugify(str(input.slug, 60, base.slug)),
    active: typeof input.active === "boolean" ? input.active : base.active,
    isDefault: typeof input.isDefault === "boolean" ? input.isDefault : base.isDefault,
    segments,
    settings,
    event: sanitizeEvent(input.event === undefined ? base.event : input.event),
    updatedAt: new Date().toISOString(),
  };
}
