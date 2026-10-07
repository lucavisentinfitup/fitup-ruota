// Copia ruote e schermi TV dallo store locale (.data/db.json) al database Postgres di produzione.
// Le giocate NON vengono copiate (sono prove locali). Uso:
//   node scripts/migrate-local-to-db.mjs .env.production.vercel
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";

const envFile = process.argv[2] ?? ".env.production.vercel";
const env = Object.fromEntries(
  fs
    .readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);
if (!env.DATABASE_URL) throw new Error(`DATABASE_URL mancante in ${envFile}`);
const sql = neon(env.DATABASE_URL);
const data = JSON.parse(fs.readFileSync(".data/db.json", "utf8"));

// stesso schema di lib/db/postgres.ts (create/alter idempotenti)
await sql`create table if not exists wheels (
  id text primary key, slug text unique not null, name text not null,
  active boolean not null default true, is_default boolean not null default false,
  segments jsonb not null, settings jsonb not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now())`;
await sql`alter table wheels add column if not exists club_id text`;
await sql`alter table wheels add column if not exists club_name text`;
await sql`alter table wheels add column if not exists event jsonb`;
await sql`create table if not exists spins (
  id text primary key, code text not null, wheel_id text not null, wheel_name text not null,
  segment_id text not null, segment_label text not null, kind text not null, player_name text, device_id text,
  created_at timestamptz not null default now(), redeemed_at timestamptz, redeemed_by text)`;
await sql`create index if not exists spins_created on spins (created_at desc)`;
await sql`create index if not exists spins_wheel_created on spins (wheel_id, created_at desc)`;
await sql`create index if not exists spins_device_created on spins (device_id, created_at desc)`;
await sql`create table if not exists tv_screens (
  id text primary key, code text unique not null, name text not null, wheel_id text,
  created_at timestamptz not null default now(), last_seen_at timestamptz, boot_fps real, fps real,
  user_agent text, screen text, state jsonb not null)`;

let w = 0;
for (const x of data.wheels) {
  await sql`insert into wheels (id, slug, name, active, is_default, segments, settings, club_id, club_name, event, created_at, updated_at)
    values (${x.id}, ${x.slug}, ${x.name}, ${x.active}, ${x.isDefault}, ${JSON.stringify(x.segments)}::jsonb,
            ${JSON.stringify(x.settings)}::jsonb, ${x.clubId ?? null}, ${x.clubName ?? null},
            ${x.event ? JSON.stringify(x.event) : null}::jsonb, ${x.createdAt}, ${x.updatedAt})
    on conflict (id) do update set slug = excluded.slug, name = excluded.name, active = excluded.active,
      is_default = excluded.is_default, segments = excluded.segments, settings = excluded.settings,
      club_id = excluded.club_id, club_name = excluded.club_name, event = excluded.event, updated_at = excluded.updated_at`;
  w++;
}
// schermi TV: stato azzerato (in produzione nessuna TV è ancora collegata)
const empty = JSON.stringify({ seq: 0, events: [], session: null, busyUntil: 0 });
let t = 0;
for (const x of data.tvs) {
  await sql`insert into tv_screens (id, code, name, wheel_id, created_at, state)
    values (${x.id}, ${x.code}, ${x.name}, ${x.wheelId ?? null}, ${x.createdAt}, ${empty}::jsonb)
    on conflict (id) do update set name = excluded.name, wheel_id = excluded.wheel_id`;
  t++;
}
const [{ n: nw }] = await sql`select count(*)::int n from wheels`;
const [{ n: nt }] = await sql`select count(*)::int n from tv_screens`;
const [{ n: nd }] = await sql`select count(*)::int n from wheels where is_default`;
console.log(`ruote copiate ${w} (nel DB: ${nw}, predefinite: ${nd}) · TV copiate ${t} (nel DB: ${nt})`);
