export type SegmentKind = "premio" | "penitenza" | "neutro";

export interface Segment {
  id: string;
  /** Testo usato nel report e, se display = "text", disegnato nello spicchio. */
  label: string;
  display: "image" | "text";
  image: string | null;
  /** auto = inverte gli sticker bianchi sugli spicchi chiari */
  imageMode: "auto" | "original" | "invert";
  color: string;
  /** null = contrasto automatico */
  textColor: string | null;
  kind: SegmentKind;
  /** Peso relativo per la probabilità (0 = non esce mai) */
  weight: number;
  /** Quantità disponibile; null = illimitata */
  stock: number | null;
}

export interface WheelSettings {
  title: string;
  subtitle: string;
  askName: "off" | "optional" | "required";
  namePlaceholder: string;
  /** 0 = illimitate */
  limitPerDevicePerDay: number;
  spinSeconds: number;
  sound: boolean;
  winTitle: string;
  penaltyTitle: string;
  neutralTitle: string;
  footer: string;
}

/** Evento del club (es. Open Day del 19 ottobre): la ruota si gioca solo in questi giorni. */
export interface WheelEvent {
  /** giorni "YYYY-MM-DD" (ora di Roma) */
  dates: string[];
  type: string;
  areaManager: string | null;
}

export interface Wheel {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  isDefault: boolean;
  segments: Segment[];
  settings: WheelSettings;
  /** club CORE a cui è legata la ruota (null = ruota generica) */
  clubId: string | null;
  clubName: string | null;
  /** null = si gioca sempre */
  event: WheelEvent | null;
  createdAt: string;
  updatedAt: string;
}

/** Quello che vede il giocatore: niente pesi né quantità. */
export type PublicSegment = Omit<Segment, "weight" | "stock">;
export interface PublicWheel {
  id: string;
  slug: string;
  name: string;
  /** cambia a ogni salvataggio: telefono e TV lo confrontano col server */
  version: string;
  event: WheelEvent | null;
  segments: PublicSegment[];
  settings: WheelSettings;
}

export interface Spin {
  id: string;
  code: string;
  wheelId: string;
  wheelName: string;
  segmentId: string;
  segmentLabel: string;
  kind: SegmentKind;
  playerName: string | null;
  deviceId: string | null;
  createdAt: string;
  redeemedAt: string | null;
  redeemedBy: string | null;
}

export interface SpinFilters {
  from?: string; // ISO
  to?: string; // ISO
  wheelId?: string;
  kind?: SegmentKind;
  q?: string;
  /** solo premi non ancora consegnati */
  toRedeem?: boolean;
  limit?: number;
  offset?: number;
}

export interface SpinReport {
  total: number;
  prizes: number;
  penalties: number;
  named: number;
  redeemed: number;
  byDay: { day: string; kind: SegmentKind; n: number }[];
  byLabel: { label: string; kind: SegmentKind; n: number; redeemed: number }[];
  byWheel: { wheelId: string; wheelName: string; n: number; prizes: number; penalties: number; redeemed: number }[];
}

/** Evento inviato allo schermo TV (via realtime o polling). */
export type TvEvent =
  | { type: "paired"; sessionId: string; playerName: string | null }
  | { type: "unpaired"; sessionId: string }
  | {
      type: "spin";
      sessionId: string;
      index: number;
      segmentId: string;
      wheelVersion: string;
      jitter: number;
      /** ora server (ms epoch) in cui parte la frenata */
      decelAt: number;
      decelSeconds: number;
      label: string;
      kind: SegmentKind;
      code: string;
      playerName: string | null;
    }
  | { type: "reload" };

export interface TvState {
  seq: number;
  /** ultimi eventi (per chi legge in polling) */
  events: { seq: number; at: number; event: TvEvent }[];
  session: null | { id: string; playerName: string | null; pairedAt: number; ackAt: number | null; lastActive: number };
  /** fino a quando la TV è impegnata da un giro (ms epoch) */
  busyUntil: number;
}

export interface TvScreen {
  id: string;
  code: string;
  name: string;
  /** null = ruota predefinita */
  wheelId: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  /** fps misurati dall'autotest all'avvio della pagina TV */
  bootFps: number | null;
  fps: number | null;
  userAgent: string | null;
  screen: string | null;
  /** cosa apre il QR sulla TV: il gioco ("play") o il regolamento ("rules", si gioca in reception) */
  qrMode: "play" | "rules";
  state: TvState;
}
