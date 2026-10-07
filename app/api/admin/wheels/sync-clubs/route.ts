import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db, invalidateWheelCache } from "@/lib/db";
import { slugify, uid } from "@/lib/defaults";
import clubsFile from "@/data/clubs.json";
import promoFile from "@/data/promo-ottobre.json";
import type { Wheel, WheelEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

const CLUBS = (clubsFile as { clubs: { coreId: string; name: string }[] }).clubs;
const EXCLUDED = new Set(((clubsFile as { excluded?: { coreId: string }[] }).excluded ?? []).map((c) => c.coreId));
const EVENTS = (promoFile as { events: { date: string; type: string; club: string; areaManager: string }[] }).events;
const clubWheelName = (club: string) => `Ruota della Fortuna FitUP ${club}`;

/** Evento della promo per un club (dal calendario "Appunti Promo Ottobre"); null se il club non partecipa. */
function eventFor(club: string): WheelEvent | null {
  const rows = EVENTS.filter((e) => e.club === club);
  if (!rows.length) return null;
  return { dates: [...new Set(rows.map((r) => r.date))].sort(), type: rows[0].type, areaManager: rows[0].areaManager || null };
}

/**
 * Ruote dei club (elenco CORE in data/clubs.json, calendario in data/promo-ottobre.json).
 * - default: crea le ruote mancanti clonando la ruota modello, con l'evento del club;
 *   elimina le ruote dei club esclusi; aggiorna il calendario di quelle esistenti.
 * - { applyTemplate: true }: copia spicchi e impostazioni del modello su tutte le ruote club,
 *   lasciando invariati nome, indirizzo, club ed evento.
 */
export async function POST(req: Request) {
  const u = await requireAdmin();
  if (u instanceof NextResponse) return u;
  const body = (await req.json().catch(() => ({}))) as { applyTemplate?: boolean };
  const store = await db();
  const wheels = await store.listWheels();
  const template = wheels.find((w) => w.isDefault) ?? wheels[0];
  if (!template) return NextResponse.json({ error: "Nessuna ruota modello" }, { status: 400 });
  const now = new Date().toISOString();
  const cloneSegments = () => template.segments.map((s) => ({ ...s, id: uid() }));

  if (body.applyTemplate) {
    let updated = 0;
    for (const w of wheels) {
      if (!w.clubId || w.id === template.id) continue;
      await store.updateWheel({ ...w, segments: cloneSegments(), settings: structuredClone(template.settings), updatedAt: now });
      updated++;
    }
    invalidateWheelCache();
    return NextResponse.json({ created: 0, updated, removed: 0, total: CLUBS.length });
  }

  let removed = 0;
  let updated = 0;
  for (const w of wheels) {
    if (w.clubId && EXCLUDED.has(w.clubId)) {
      await store.deleteWheel(w.id);
      removed++;
      continue;
    }
    // calendario aggiornato per le ruote già esistenti
    if (w.clubId && w.clubName) {
      const ev = eventFor(w.clubName);
      if (JSON.stringify(ev) !== JSON.stringify(w.event ?? null)) {
        await store.updateWheel({ ...w, event: ev, updatedAt: now });
        updated++;
      }
    }
  }

  const byClub = new Set(wheels.map((w) => w.clubId).filter(Boolean));
  const slugs = new Set(wheels.map((w) => w.slug));
  let created = 0;
  for (const club of CLUBS) {
    if (byClub.has(club.coreId)) continue;
    let slug = slugify(club.name);
    while (slugs.has(slug)) slug = `${slugify(club.name)}-${uid(3)}`;
    slugs.add(slug);
    const wheel: Wheel = {
      id: uid(),
      slug,
      name: clubWheelName(club.name),
      active: true,
      isDefault: false,
      segments: cloneSegments(),
      settings: structuredClone(template.settings),
      clubId: club.coreId,
      clubName: club.name,
      event: eventFor(club.name),
      createdAt: now,
      updatedAt: now,
    };
    await store.insertWheel(wheel);
    created++;
  }
  invalidateWheelCache();
  return NextResponse.json({ created, updated, removed, total: CLUBS.length });
}
