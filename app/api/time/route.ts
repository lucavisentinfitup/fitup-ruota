import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Orologio del server: telefono e TV lo usano per sincronizzare la frenata. */
export function GET() {
  return NextResponse.json({ now: Date.now() }, { headers: { "cache-control": "no-store" } });
}
