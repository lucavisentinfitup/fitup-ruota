import { NextResponse } from "next/server";
import { requireGlobalAdmin } from "@/lib/admin";
import { db, invalidateWheelCache } from "@/lib/db";
import { sanitizeWheel } from "@/lib/defaults";
import type { Wheel } from "@/lib/types";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const u = await requireGlobalAdmin();
  if (u instanceof NextResponse) return u;
  const w = await (await db()).getWheel((await params).id);
  return w ? NextResponse.json(w) : NextResponse.json({ error: "Non trovata" }, { status: 404 });
}

export async function PUT(req: Request, { params }: Ctx) {
  const u = await requireGlobalAdmin();
  if (u instanceof NextResponse) return u;
  const { id } = await params;
  const store = await db();
  const current = await store.getWheel(id);
  if (!current) return NextResponse.json({ error: "Non trovata" }, { status: 404 });
  let next: Wheel;
  try {
    next = sanitizeWheel((await req.json()) as Partial<Wheel>, current);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  // La ruota di default non può essere "tolta": si cambia impostando un'altra ruota come default.
  if (current.isDefault) next.isDefault = true;
  try {
    await store.updateWheel(next);
  } catch (e) {
    const msg = /duplicate|unique/i.test(String(e)) ? "Questo indirizzo è già usato da un'altra ruota." : "Salvataggio non riuscito.";
    return NextResponse.json({ error: msg }, { status: 409 });
  }
  if (next.isDefault && !current.isDefault) await store.setDefault(next.id);
  invalidateWheelCache();
  return NextResponse.json(next);
}

export async function DELETE(_: Request, { params }: Ctx) {
  const u = await requireGlobalAdmin();
  if (u instanceof NextResponse) return u;
  const { id } = await params;
  const store = await db();
  const all = await store.listWheels();
  if (all.length <= 1) return NextResponse.json({ error: "Deve restare almeno una ruota." }, { status: 400 });
  const target = all.find((w) => w.id === id);
  await store.deleteWheel(id);
  if (target?.isDefault) await store.setDefault(all.find((w) => w.id !== id)!.id);
  invalidateWheelCache();
  return NextResponse.json({ ok: true });
}
