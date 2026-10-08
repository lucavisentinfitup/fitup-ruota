import { neon } from "@neondatabase/serverless";
import { emptyTvState, type Store } from "./index";
import type { Spin, SpinFilters, SpinReport, TvScreen, TvState, Wheel } from "../types";

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

function rowToWheel(r: Row): Wheel {
  return {
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    active: r.active as boolean,
    isDefault: r.is_default as boolean,
    segments: r.segments as Wheel["segments"],
    settings: r.settings as Wheel["settings"],
    clubId: (r.club_id as string) ?? null,
    clubName: (r.club_name as string) ?? null,
    event: (r.event as Wheel["event"]) ?? null,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

function rowToSpin(r: Row): Spin {
  return {
    id: r.id as string,
    code: r.code as string,
    wheelId: r.wheel_id as string,
    wheelName: r.wheel_name as string,
    segmentId: r.segment_id as string,
    segmentLabel: r.segment_label as string,
    kind: r.kind as Spin["kind"],
    playerName: (r.player_name as string) ?? null,
    deviceId: (r.device_id as string) ?? null,
    createdAt: iso(r.created_at)!,
    redeemedAt: iso(r.redeemed_at),
    redeemedBy: (r.redeemed_by as string) ?? null,
  };
}

function rowToTv(r: Row): TvScreen {
  return {
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
    wheelId: (r.wheel_id as string) ?? null,
    createdAt: iso(r.created_at)!,
    lastSeenAt: iso(r.last_seen_at),
    bootFps: (r.boot_fps as number) ?? null,
    fps: (r.fps as number) ?? null,
    userAgent: (r.user_agent as string) ?? null,
    screen: (r.screen as string) ?? null,
    qrMode: r.qr_mode === "rules" ? "rules" : "play",
    state: (r.state as TvState) ?? emptyTvState(),
  };
}

/** WHERE condiviso da elenco, report ed export. Ogni "?" diventa lo stesso parametro posizionale. */
function where(f: SpinFilters, params: unknown[]) {
  const parts: string[] = [];
  const add = (clause: string, v?: unknown) => {
    if (v !== undefined) params.push(v);
    parts.push(clause.replaceAll("?", `$${params.length}`));
  };
  if (f.from) add("created_at >= ?", f.from);
  if (f.to) add("created_at < ?", f.to);
  if (f.wheelId) add("wheel_id = ?", f.wheelId);
  if (f.kind) add("kind = ?", f.kind);
  if (f.q) add("(player_name ilike ? or code ilike ?)", `%${f.q}%`);
  if (f.toRedeem) add("kind = 'premio' and redeemed_at is null");
  return parts.length ? "where " + parts.join(" and ") : "";
}

export async function createPostgresStore(url: string): Promise<Store> {
  const sql = neon(url);

  await sql`create table if not exists wheels (
    id text primary key,
    slug text unique not null,
    name text not null,
    active boolean not null default true,
    is_default boolean not null default false,
    segments jsonb not null,
    settings jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;
  await sql`alter table wheels add column if not exists club_id text`;
  await sql`alter table wheels add column if not exists club_name text`;
  await sql`alter table wheels add column if not exists event jsonb`;
  await sql`create table if not exists spins (
    id text primary key,
    code text not null,
    wheel_id text not null,
    wheel_name text not null,
    segment_id text not null,
    segment_label text not null,
    kind text not null,
    player_name text,
    device_id text,
    created_at timestamptz not null default now(),
    redeemed_at timestamptz,
    redeemed_by text
  )`;
  await sql`create index if not exists spins_created on spins (created_at desc)`;
  await sql`create index if not exists spins_wheel_created on spins (wheel_id, created_at desc)`;
  await sql`create index if not exists spins_device_created on spins (device_id, created_at desc)`;
  await sql`create table if not exists tv_screens (
    id text primary key,
    code text unique not null,
    name text not null,
    wheel_id text,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz,
    boot_fps real,
    fps real,
    user_agent text,
    screen text,
    state jsonb not null
  )`;
  await sql`alter table tv_screens add column if not exists qr_mode text not null default 'play'`;

  return {
    async listWheels() {
      const rows = await sql`select * from wheels order by is_default desc, created_at asc`;
      return rows.map(rowToWheel);
    },
    async getWheel(id) {
      const rows = await sql`select * from wheels where id = ${id}`;
      return rows[0] ? rowToWheel(rows[0]) : null;
    },
    async getWheelBySlug(slug) {
      const rows = await sql`select * from wheels where slug = ${slug}`;
      return rows[0] ? rowToWheel(rows[0]) : null;
    },
    async insertWheel(w) {
      await sql`insert into wheels (id, slug, name, active, is_default, segments, settings, club_id, club_name, event, created_at, updated_at)
        values (${w.id}, ${w.slug}, ${w.name}, ${w.active}, ${w.isDefault}, ${JSON.stringify(w.segments)}::jsonb,
                ${JSON.stringify(w.settings)}::jsonb, ${w.clubId}, ${w.clubName}, ${w.event ? JSON.stringify(w.event) : null}::jsonb, ${w.createdAt}, ${w.updatedAt})`;
    },
    async updateWheel(w) {
      await sql`update wheels set slug = ${w.slug}, name = ${w.name}, active = ${w.active}, is_default = ${w.isDefault},
        segments = ${JSON.stringify(w.segments)}::jsonb, settings = ${JSON.stringify(w.settings)}::jsonb,
        club_id = ${w.clubId}, club_name = ${w.clubName}, event = ${w.event ? JSON.stringify(w.event) : null}::jsonb, updated_at = ${w.updatedAt} where id = ${w.id}`;
    },
    async deleteWheel(id) {
      await sql`delete from wheels where id = ${id}`;
    },
    async setDefault(id) {
      await sql`update wheels set is_default = (id = ${id})`;
    },

    async insertSpin(s) {
      await sql`insert into spins (id, code, wheel_id, wheel_name, segment_id, segment_label, kind, player_name, device_id, created_at)
        values (${s.id}, ${s.code}, ${s.wheelId}, ${s.wheelName}, ${s.segmentId}, ${s.segmentLabel}, ${s.kind},
                ${s.playerName}, ${s.deviceId}, ${s.createdAt})`;
    },
    async countDeviceSpinsSince(wheelId, deviceId, sinceIso) {
      const rows = await sql`select count(*)::int as n from spins
        where wheel_id = ${wheelId} and device_id = ${deviceId} and created_at >= ${sinceIso}`;
      return (rows[0]?.n as number) ?? 0;
    },
    async countWinsBySegment(wheelId) {
      const rows = await sql`select segment_id, count(*)::int as n from spins where wheel_id = ${wheelId} group by segment_id`;
      return Object.fromEntries(rows.map((r) => [r.segment_id as string, r.n as number]));
    },
    async listSpins(f) {
      const params: unknown[] = [];
      const w = where(f, params);
      params.push(Math.min(f.limit ?? 100, 50000), Math.max(0, f.offset ?? 0));
      const rows = await sql.query(
        `select * from spins ${w} order by created_at desc limit $${params.length - 1} offset $${params.length}`,
        params,
      );
      return (rows as Row[]).map(rowToSpin);
    },
    async reportSpins(f) {
      const params: unknown[] = [];
      const w = where(f, params);
      const [k, days, labels, perWheel] = await Promise.all([
        sql.query(
          `select count(*)::int total,
             count(*) filter (where kind = 'premio')::int prizes,
             count(*) filter (where kind = 'penitenza')::int penalties,
             count(player_name)::int named,
             count(*) filter (where kind = 'premio' and redeemed_at is not null)::int redeemed
           from spins ${w}`,
          params,
        ),
        sql.query(
          `select to_char(created_at at time zone 'Europe/Rome', 'YYYY-MM-DD') as day, kind, count(*)::int n
           from spins ${w} group by 1, 2 order by 1`,
          params,
        ),
        sql.query(
          `select segment_label as label, kind, count(*)::int n, count(redeemed_at)::int redeemed
           from spins ${w} group by 1, 2 order by 3 desc limit 200`,
          params,
        ),
        sql.query(
          `select wheel_id as "wheelId", max(wheel_name) as "wheelName", count(*)::int n,
             count(*) filter (where kind = 'premio')::int prizes,
             count(*) filter (where kind = 'penitenza')::int penalties,
             count(*) filter (where kind = 'premio' and redeemed_at is not null)::int redeemed
           from spins ${w} group by 1 order by 3 desc`,
          params,
        ),
      ]);
      const kpi = (k as Row[])[0] ?? {};
      return {
        total: (kpi.total as number) ?? 0,
        prizes: (kpi.prizes as number) ?? 0,
        penalties: (kpi.penalties as number) ?? 0,
        named: (kpi.named as number) ?? 0,
        redeemed: (kpi.redeemed as number) ?? 0,
        byDay: days as SpinReportDay[],
        byLabel: labels as SpinReportLabel[],
        byWheel: perWheel as SpinReport["byWheel"],
      };
    },
    async setRedeemed(id, by, onlyWheelId) {
      const w = onlyWheelId ?? null;
      const rows = by
        ? await sql`update spins set redeemed_at = now(), redeemed_by = ${by} where id = ${id} and (${w}::text is null or wheel_id = ${w}) returning *`
        : await sql`update spins set redeemed_at = null, redeemed_by = null where id = ${id} and (${w}::text is null or wheel_id = ${w}) returning *`;
      return rows[0] ? rowToSpin(rows[0]) : null;
    },

    async listTvs() {
      const rows = await sql`select * from tv_screens order by name asc`;
      return rows.map(rowToTv);
    },
    async getTvByCode(code) {
      const rows = await sql`select * from tv_screens where code = ${code}`;
      return rows[0] ? rowToTv(rows[0]) : null;
    },
    async insertTv(tv) {
      await sql`insert into tv_screens (id, code, name, wheel_id, qr_mode, created_at, state)
        values (${tv.id}, ${tv.code}, ${tv.name}, ${tv.wheelId}, ${tv.qrMode}, ${tv.createdAt}, ${JSON.stringify(tv.state)}::jsonb)`;
    },
    async updateTvMeta(id, m) {
      await sql`update tv_screens set name = ${m.name}, wheel_id = ${m.wheelId}, qr_mode = ${m.qrMode} where id = ${id}`;
    },
    async deleteTv(id) {
      await sql`delete from tv_screens where id = ${id}`;
    },
    async heartbeatTv(code, hb) {
      await sql`update tv_screens set last_seen_at = now(), boot_fps = coalesce(${hb.bootFps}, boot_fps),
        fps = ${hb.fps}, user_agent = ${hb.userAgent}, screen = ${hb.screen} where code = ${code}`;
    },
    async updateTvState(code, fn) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const rows = await sql`select state from tv_screens where code = ${code}`;
        if (!rows[0]) return null;
        const cur = (rows[0].state as TvState) ?? emptyTvState();
        const next = fn(structuredClone(cur));
        if (!next) return cur;
        const upd = await sql`update tv_screens set state = ${JSON.stringify(next)}::jsonb
          where code = ${code} and coalesce((state->>'seq')::int, 0) = ${cur.seq} returning id`;
        if (upd.length) return next;
      }
      throw new Error("Stato TV conteso, riprova");
    },
  };
}

type SpinReportDay = { day: string; kind: Spin["kind"]; n: number };
type SpinReportLabel = { label: string; kind: Spin["kind"]; n: number; redeemed: number };
