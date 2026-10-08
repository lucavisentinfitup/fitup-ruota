// Store su file per lo sviluppo locale senza database. Non usato in produzione.
import { promises as fs } from "fs";
import path from "path";
import { emptyTvState, type Store } from "./index";
import type { Spin, SpinFilters, SpinReport, TvScreen, Wheel } from "../types";
import { romeDay } from "../time";

interface Data {
  wheels: Wheel[];
  spins: Spin[];
  tvs: TvScreen[];
}

const FILE = path.join(process.cwd(), ".data", "db.json");

export async function createJsonStore(): Promise<Store> {
  // In sviluppo Next carica questo modulo più volte (una copia per sezione dell'app): ognuna
  // terrebbe i propri dati in memoria. Per questo rileggiamo il file ogni volta che cambia.
  let data: Data = { wheels: [], spins: [], tvs: [] };
  let mtime = -1;
  const load = async () => {
    try {
      const st = await fs.stat(FILE);
      if (st.mtimeMs !== mtime) {
        data = JSON.parse(await fs.readFile(FILE, "utf8"));
        data.tvs ??= [];
        mtime = st.mtimeMs;
      }
    } catch {
      if (mtime !== -1) data = { wheels: [], spins: [], tvs: [] };
    }
  };
  let queue = Promise.resolve();
  const save = () => {
    queue = queue.then(async () => {
      await fs.mkdir(path.dirname(FILE), { recursive: true });
      const tmp = FILE + "." + process.pid + ".tmp";
      await fs.writeFile(tmp, JSON.stringify(data, null, 1));
      await fs.rename(tmp, FILE);
      mtime = (await fs.stat(FILE)).mtimeMs;
    });
    return queue;
  };
  const clone = <T>(v: T): T => structuredClone(v);

  const filter = (f: SpinFilters) => {
    const q = f.q?.toLowerCase();
    return data.spins
      .filter(
        (s) =>
          (!f.from || s.createdAt >= f.from) &&
          (!f.to || s.createdAt < f.to) &&
          (!f.wheelId || s.wheelId === f.wheelId) &&
          (!f.kind || s.kind === f.kind) &&
          (!f.toRedeem || (s.kind === "premio" && !s.redeemedAt)) &&
          (!q || (s.playerName ?? "").toLowerCase().includes(q) || s.code.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  };

  return {
    async listWheels() {
      await load();
      return clone([...data.wheels].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.createdAt.localeCompare(b.createdAt)));
    },
    async getWheel(id) {
      await load();
      return clone(data.wheels.find((w) => w.id === id) ?? null);
    },
    async getWheelBySlug(slug) {
      await load();
      return clone(data.wheels.find((w) => w.slug === slug) ?? null);
    },
    async insertWheel(w) {
      await load();
      if (data.wheels.some((x) => x.slug === w.slug)) throw new Error("duplicate key slug");
      data.wheels.push(clone(w));
      await save();
    },
    async updateWheel(w) {
      await load();
      if (data.wheels.some((x) => x.slug === w.slug && x.id !== w.id)) throw new Error("duplicate key slug");
      data.wheels = data.wheels.map((x) => (x.id === w.id ? clone(w) : x));
      await save();
    },
    async deleteWheel(id) {
      await load();
      data.wheels = data.wheels.filter((w) => w.id !== id);
      await save();
    },
    async setDefault(id) {
      await load();
      data.wheels.forEach((w) => (w.isDefault = w.id === id));
      await save();
    },

    async insertSpin(s) {
      await load();
      data.spins.push(clone(s));
      await save();
    },
    async countDeviceSpinsSince(wheelId, deviceId, since) {
      await load();
      return data.spins.filter((s) => s.wheelId === wheelId && s.deviceId === deviceId && s.createdAt >= since).length;
    },
    async countWinsBySegment(wheelId) {
      await load();
      const out: Record<string, number> = {};
      for (const s of data.spins) if (s.wheelId === wheelId) out[s.segmentId] = (out[s.segmentId] ?? 0) + 1;
      return out;
    },
    async listSpins(f) {
      await load();
      const off = f.offset ?? 0;
      return clone(filter(f).slice(off, off + (f.limit ?? 100)));
    },
    async reportSpins(f) {
      await load();
      const list = filter(f);
      const byDay = new Map<string, SpinReport["byDay"][number]>();
      const byLabel = new Map<string, SpinReport["byLabel"][number]>();
      const byWheel = new Map<string, SpinReport["byWheel"][number]>();
      for (const s of list) {
        const ww = byWheel.get(s.wheelId) ?? { wheelId: s.wheelId, wheelName: s.wheelName, n: 0, prizes: 0, penalties: 0, redeemed: 0 };
        ww.n++;
        if (s.kind === "premio") ww.prizes++;
        if (s.kind === "penitenza") ww.penalties++;
        if (s.kind === "premio" && s.redeemedAt) ww.redeemed++;
        byWheel.set(s.wheelId, ww);
        const d = romeDay(s.createdAt);
        const dk = `${d}|${s.kind}`;
        byDay.set(dk, { day: d, kind: s.kind, n: (byDay.get(dk)?.n ?? 0) + 1 });
        const lk = `${s.segmentLabel}|${s.kind}`;
        const e = byLabel.get(lk) ?? { label: s.segmentLabel, kind: s.kind, n: 0, redeemed: 0 };
        e.n++;
        if (s.redeemedAt) e.redeemed++;
        byLabel.set(lk, e);
      }
      return {
        total: list.length,
        prizes: list.filter((s) => s.kind === "premio").length,
        penalties: list.filter((s) => s.kind === "penitenza").length,
        named: list.filter((s) => s.playerName).length,
        redeemed: list.filter((s) => s.kind === "premio" && s.redeemedAt).length,
        byDay: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
        byLabel: [...byLabel.values()].sort((a, b) => b.n - a.n),
        byWheel: [...byWheel.values()].sort((a, b) => b.n - a.n),
      };
    },
    async setRedeemed(id, by, onlyWheelId) {
      await load();
      const s = data.spins.find((x) => x.id === id && (!onlyWheelId || x.wheelId === onlyWheelId));
      if (!s) return null;
      s.redeemedAt = by ? new Date().toISOString() : null;
      s.redeemedBy = by;
      await save();
      return clone(s);
    },

    async listTvs() {
      await load();
      return clone([...data.tvs].sort((a, b) => a.name.localeCompare(b.name)));
    },
    async getTvByCode(code) {
      await load();
      return clone(data.tvs.find((t) => t.code === code) ?? null);
    },
    async insertTv(tv) {
      await load();
      if (data.tvs.some((t) => t.code === tv.code)) throw new Error("duplicate key code");
      data.tvs.push(clone(tv));
      await save();
    },
    async updateTvMeta(id, m) {
      await load();
      const t = data.tvs.find((x) => x.id === id);
      if (t) Object.assign(t, m);
      data.tvs.forEach((x) => (x.qrMode ??= "play"));
      await save();
    },
    async deleteTv(id) {
      await load();
      data.tvs = data.tvs.filter((t) => t.id !== id);
      await save();
    },
    async heartbeatTv(code, hb) {
      await load();
      const t = data.tvs.find((x) => x.code === code);
      if (!t) return;
      t.lastSeenAt = new Date().toISOString();
      t.bootFps = hb.bootFps ?? t.bootFps;
      t.fps = hb.fps;
      t.userAgent = hb.userAgent;
      t.screen = hb.screen;
      await save();
    },
    async updateTvState(code, fn) {
      await load();
      const t = data.tvs.find((x) => x.code === code);
      if (!t) return null;
      const next = fn(clone(t.state ?? emptyTvState()));
      if (!next) return clone(t.state);
      t.state = next;
      await save();
      return clone(next);
    },
  };
}
