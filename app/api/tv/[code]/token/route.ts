import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ablyToken, normalizeCode, realtimeMode } from "@/lib/tv";

export const dynamic = "force-dynamic";

/** Token realtime in sola lettura per il canale di questa TV. */
export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  if (realtimeMode() !== "ably") return NextResponse.json({ error: "Realtime non configurato" }, { status: 404 });
  if (!(await (await db()).getTvByCode(code))) return NextResponse.json({ error: "Schermo non registrato" }, { status: 404 });
  try {
    return NextResponse.json(await ablyToken(code), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
