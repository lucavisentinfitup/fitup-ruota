import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { tvStatus } from "@/lib/tv";

export const dynamic = "force-dynamic";

/**
 * Lo schermo TV del club per una ruota: il telefono si abbina con "Guarda sulla TV del club"
 * senza digitare il codice (nel giorno dell'evento la TV non mostra né QR né codice).
 * Se ci sono più TV accese per la stessa ruota, quella con il segnale più recente.
 */
export async function GET(req: NextRequest) {
  const wheelId = req.nextUrl.searchParams.get("wheel") ?? "";
  const tvs = (await (await db()).listTvs())
    .filter((t) => wheelId && t.wheelId === wheelId && tvStatus(t).online)
    .sort((a, b) => (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? ""));
  return NextResponse.json({ code: tvs[0]?.code ?? null }, { headers: { "cache-control": "no-store" } });
}
