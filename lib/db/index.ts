import "server-only";
import type { Spin, SpinFilters, SpinReport, TvScreen, TvState, Wheel } from "../types";
import { defaultWheel } from "../defaults";

export interface TvHeartbeat {
  bootFps: number | null;
  fps: number | null;
  userAgent: string | null;
  screen: string | null;
}

export interface Store {
  listWheels(): Promise<Wheel[]>;
  getWheel(id: string): Promise<Wheel | null>;
  getWheelBySlug(slug: string): Promise<Wheel | null>;
  insertWheel(w: Wheel): Promise<void>;
  updateWheel(w: Wheel): Promise<void>;
  deleteWheel(id: string): Promise<void>;
  /** Rende `id` l'unica ruota di default */
  setDefault(id: string): Promise<void>;

  insertSpin(s: Spin): Promise<void>;
  countDeviceSpinsSince(wheelId: string, deviceId: string, sinceIso: string): Promise<number>;
  countWinsBySegment(wheelId: string): Promise<Record<string, number>>;
  listSpins(f: SpinFilters): Promise<Spin[]>;
  reportSpins(f: SpinFilters): Promise<SpinReport>;
  setRedeemed(id: string, redeemedBy: string | null): Promise<Spin | null>;

  listTvs(): Promise<TvScreen[]>;
  getTvByCode(code: string): Promise<TvScreen | null>;
  insertTv(tv: TvScreen): Promise<void>;
  updateTvMeta(id: string, meta: { name: string; wheelId: string | null }): Promise<void>;
  deleteTv(id: string): Promise<void>;
  heartbeatTv(code: string, hb: TvHeartbeat): Promise<void>;
  /** Aggiorna lo stato in modo sicuro rispetto alle scritture concorrenti (confronto su `seq`). */
  updateTvState(code: string, fn: (s: TvState) => TvState | null): Promise<TvState | null>;
}

export const emptyTvState = (): TvState => ({ seq: 0, events: [], session: null, busyUntil: 0 });

let storePromise: Promise<Store> | null = null;

async function createStore(): Promise<Store> {
  if (process.env.DATABASE_URL) {
    const { createPostgresStore } = await import("./postgres");
    return createPostgresStore(process.env.DATABASE_URL);
  }
  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL mancante: collega un database Neon al progetto Vercel.");
  }
  const { createJsonStore } = await import("./json");
  return createJsonStore();
}

export async function db(): Promise<Store> {
  if (!storePromise) {
    storePromise = createStore().then(async (s) => {
      // Prima esecuzione: crea la ruota FitUP standard con i 15 sticker.
      if ((await s.listWheels()).length === 0) await s.insertWheel(defaultWheel());
      return s;
    });
    storePromise.catch(() => (storePromise = null));
  }
  return storePromise;
}

// --- cache breve della configurazione ruote: il gioco è aperto a tutti i clienti, evitiamo
// di rileggere il DB a ogni pagina/giro. Le modifiche dal backend arrivano entro WHEEL_TTL.
const WHEEL_TTL = 10_000;
let wheelCache: { at: number; wheels: Wheel[] } | null = null;

async function cachedWheels(): Promise<Wheel[]> {
  if (!wheelCache || Date.now() - wheelCache.at > WHEEL_TTL) {
    wheelCache = { at: Date.now(), wheels: await (await db()).listWheels() };
  }
  return wheelCache.wheels;
}

export function invalidateWheelCache() {
  wheelCache = null;
}

/** Legge dal database saltando la cache (e la aggiorna): usato quando un client ha una versione diversa. */
export async function getWheelFresh(id: string): Promise<Wheel | null> {
  const w = await (await db()).getWheel(id);
  if (w && wheelCache) wheelCache.wheels = wheelCache.wheels.map((x) => (x.id === id ? w : x));
  return w;
}

export async function getWheelCached(id: string) {
  return (await cachedWheels()).find((w) => w.id === id) ?? null;
}
export async function getWheelBySlugCached(slug: string) {
  return (await cachedWheels()).find((w) => w.slug === slug) ?? null;
}
export async function getDefaultWheel(): Promise<Wheel | null> {
  const wheels = await cachedWheels();
  return wheels.find((w) => w.isDefault && w.active) ?? wheels.find((w) => w.active) ?? null;
}
