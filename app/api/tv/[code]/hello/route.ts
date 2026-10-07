import { NextResponse } from "next/server";
import { db, getDefaultWheel, getWheelCached } from "@/lib/db";
import { normalizeCode } from "@/lib/tv";

export const dynamic = "force-dynamic";

const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? Math.round(v * 10) / 10 : null);

/** Heartbeat della TV (ogni ~20 s): stato online, fps misurati, versione della ruota da mostrare. */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  // la TV invia text/plain per evitare richieste preflight CORS sui motori web vecchi
  const body = JSON.parse((await req.text()) || "{}") as Record<string, unknown>;
  const store = await db();
  const tv = await store.getTvByCode(code);
  if (!tv) return NextResponse.json({ error: "Schermo non registrato" }, { status: 404 });
  await store.heartbeatTv(code, {
    bootFps: num(body.bootFps),
    fps: num(body.fps),
    userAgent: (req.headers.get("user-agent") ?? "").slice(0, 300) || null,
    screen: typeof body.screen === "string" ? body.screen.slice(0, 40) : null,
  });
  const wheel = (tv.wheelId && (await getWheelCached(tv.wheelId))) || (await getDefaultWheel());
  return NextResponse.json({ now: Date.now(), wheelVersion: wheel?.updatedAt ?? null }, { headers: { "cache-control": "no-store" } });
}
