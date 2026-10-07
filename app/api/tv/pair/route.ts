import { NextResponse, type NextRequest } from "next/server";
import { db, getDefaultWheel, getWheelCached } from "@/lib/db";
import { uid } from "@/lib/defaults";
import { emitTv, normalizeCode, TV_SESSION_IDLE_MS, tvStatus } from "@/lib/tv";

export const dynamic = "force-dynamic";

type Reason = "not_found" | "offline" | "not_capable" | "busy";
const fail = (reason: Reason, status = 409) => NextResponse.json({ ok: false, reason }, { status });

/** Il giocatore chiede di vedere il suo giro sulla TV del club. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { code?: string; playerName?: string };
  const code = normalizeCode(body.code);
  if (code.length !== 6) return fail("not_found", 404);
  const store = await db();
  const tv = await store.getTvByCode(code);
  if (!tv) return fail("not_found", 404);
  const { online, capable } = tvStatus(tv);
  if (!online) return fail("offline");
  if (!capable) return fail("not_capable");

  const now = Date.now();
  const s = tv.state.session;
  // un altro giocatore sta girando proprio adesso
  if (tv.state.busyUntil > now && s) return fail("busy");

  const sessionId = uid(16);
  const playerName = (body.playerName ?? "").replace(/\s+/g, " ").trim().slice(0, 40) || null;
  await emitTv(code, { type: "paired", sessionId, playerName }, (st) => {
    st.session = { id: sessionId, playerName, pairedAt: now, ackAt: null, lastActive: now };
    st.busyUntil = 0;
  });
  const wheel = (tv.wheelId && (await getWheelCached(tv.wheelId))) || (await getDefaultWheel());
  return NextResponse.json({ ok: true, sessionId, tvName: tv.name, wheelId: wheel?.id, wheelSlug: wheel?.slug });
}

/** Il telefono controlla se la TV ha confermato il collegamento (o se la sessione è ancora valida). */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const code = normalizeCode(p.get("code"));
  const tv = await (await db()).getTvByCode(code);
  const s = tv?.state.session;
  const valid = !!s && s.id === p.get("session") && Date.now() - s.lastActive < TV_SESSION_IDLE_MS;
  return NextResponse.json({ acked: valid && !!s!.ackAt, valid, online: tv ? tvStatus(tv).online : false });
}

/** Scollega il telefono dalla TV. */
export async function DELETE(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const code = normalizeCode(p.get("code"));
  const sessionId = p.get("session") ?? "";
  const tv = await (await db()).getTvByCode(code);
  if (tv?.state.session?.id === sessionId) {
    await emitTv(code, { type: "unpaired", sessionId }, (st) => {
      st.session = null;
      st.busyUntil = 0;
    });
  }
  return NextResponse.json({ ok: true });
}
