import { NextResponse } from "next/server";
import { requireGlobalAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { emitTv } from "@/lib/tv";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const u = await requireGlobalAdmin();
  if (u instanceof NextResponse) return u;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { name?: string; wheelId?: string | null; qrMode?: string };
  const store = await db();
  const tv = (await store.listTvs()).find((t) => t.id === id);
  if (!tv) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  const name = (body.name ?? tv.name).trim().slice(0, 80) || tv.name;
  const wheelId = body.wheelId === undefined ? tv.wheelId : body.wheelId || null;
  const qrMode = body.qrMode === "rules" || body.qrMode === "play" ? body.qrMode : tv.qrMode ?? "play";
  await store.updateTvMeta(id, { name, wheelId, qrMode });
  // la TV ricarica subito la configurazione (nome/ruota)
  await emitTv(tv.code, { type: "reload" });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const u = await requireGlobalAdmin();
  if (u instanceof NextResponse) return u;
  await (await db()).deleteTv((await params).id);
  return NextResponse.json({ ok: true });
}
