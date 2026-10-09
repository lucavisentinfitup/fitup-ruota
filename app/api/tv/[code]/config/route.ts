import { NextResponse } from "next/server";
import { db, getDefaultWheel, getWheelCached, getWheelFresh } from "@/lib/db";
import { toPublicWheel } from "@/lib/defaults";
import { normalizeCode, realtimeMode } from "@/lib/tv";
import { eventText, eventTextToday, tvCleanToday } from "@/lib/event";
import { REFERRAL_TAGLINE } from "@/lib/referral";

export const dynamic = "force-dynamic";

/** Configurazione per la pagina TV: ruota da mostrare e modalità di ricezione eventi. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  const tv = await (await db()).getTvByCode(code);
  if (!tv) return NextResponse.json({ error: "Schermo non registrato" }, { status: 404 });
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  let wheel = (tv.wheelId && (await getWheelCached(tv.wheelId))) || (await getDefaultWheel());
  // la TV ha visto un giro su una versione diversa: niente cache
  if (wheel && fresh) wheel = await getWheelFresh(wheel.id);
  if (!wheel) return NextResponse.json({ error: "Nessuna ruota attiva" }, { status: 404 });
  const origin = new URL(req.url).origin;
  const qrMode = tv.qrMode === "rules" ? "rules" : "play";
  const clean = tvCleanToday(wheel.event, qrMode);
  return NextResponse.json(
    {
      tv: { code: tv.code, name: tv.name },
      wheel: toPublicWheel(wheel),
      wheelVersion: wheel.updatedAt,
      eventText: clean ? eventTextToday(wheel.event!) : eventText(wheel.event),
      clean,
      realtime: realtimeMode(),
      qrMode,
      tagline: tv.qrMode === "rules" ? REFERRAL_TAGLINE : "",
      playUrl: `${origin}/gioca/${wheel.slug}?tv=${tv.code}`,
      now: Date.now(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
