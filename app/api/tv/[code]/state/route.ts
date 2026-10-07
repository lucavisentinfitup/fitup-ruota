import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeCode } from "@/lib/tv";

export const dynamic = "force-dynamic";

/** Polling di riserva: eventi con seq > since. Usato quando il realtime non è disponibile. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  const since = Number(new URL(req.url).searchParams.get("since") ?? 0) || 0;
  const tv = await (await db()).getTvByCode(code);
  if (!tv) return NextResponse.json({ error: "Schermo non registrato" }, { status: 404 });
  const s = tv.state;
  return NextResponse.json(
    {
      seq: s.seq,
      events: s.events.filter((e) => e.seq > since),
      // se la TV è appena ripartita (since=0) le basta sapere chi è collegato ora
      session: s.session ? { id: s.session.id, playerName: s.session.playerName } : null,
      now: Date.now(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
