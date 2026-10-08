import { NextResponse } from "next/server";
import { clubWheel, requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Segna un premio come consegnato (o annulla la consegna). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireAdmin();
  if (u instanceof NextResponse) return u;
  const { redeemed } = (await req.json().catch(() => ({}))) as { redeemed?: boolean };
  // un club può segnare solo le giocate della propria ruota
  const onlyWheelId = u.role === "club" ? ((await clubWheel(u))?.id ?? "-") : undefined;
  const spin = await (await db()).setRedeemed((await params).id, redeemed ? u.email : null, onlyWheelId);
  return spin ? NextResponse.json(spin) : NextResponse.json({ error: "Non trovata" }, { status: 404 });
}
