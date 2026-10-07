import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db, invalidateWheelCache } from "@/lib/db";
import { defaultWheel, sanitizeWheel, slugify, uid } from "@/lib/defaults";
import type { Wheel } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await requireAdmin();
  if (u instanceof NextResponse) return u;
  return NextResponse.json(await (await db()).listWheels());
}

/** Crea una ruota nuova (dai default FitUP) o duplica `fromId`. */
export async function POST(req: Request) {
  const u = await requireAdmin();
  if (u instanceof NextResponse) return u;
  const body = (await req.json().catch(() => ({}))) as { name?: string; fromId?: string };
  const store = await db();
  const source = body.fromId ? await store.getWheel(body.fromId) : null;
  const base = source ?? defaultWheel();
  const now = new Date().toISOString();
  const name = body.name?.trim() || (source ? `${source.name} (copia)` : "Nuova ruota");
  const existing = new Set((await store.listWheels()).map((w) => w.slug));
  let slug = slugify(name);
  while (existing.has(slug)) slug = `${slugify(name)}-${uid(4)}`;
  const draft: Wheel = { ...structuredClone(base), id: uid(), name, slug, isDefault: false, clubId: null, clubName: null, event: null, createdAt: now, updatedAt: now };
  const wheel = sanitizeWheel(draft, draft);
  wheel.slug = slug;
  await store.insertWheel(wheel);
  invalidateWheelCache();
  return NextResponse.json(wheel, { status: 201 });
}
