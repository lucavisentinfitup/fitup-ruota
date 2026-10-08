import { NextResponse, type NextRequest } from "next/server";
import { db, getWheelCached, getWheelFresh } from "@/lib/db";
import { pickWeighted, spinCode } from "@/lib/pick";
import { toPublicWheel, uid } from "@/lib/defaults";
import { romeDay, romeMidnight } from "@/lib/time";
import { emitTv, normalizeCode, TV_SESSION_IDLE_MS } from "@/lib/tv";
import { MOTION } from "@/components/wheel/motion";
import type { Spin } from "@/lib/types";
import { closedMessage, isOpenToday } from "@/lib/event";
import { canTestWheel } from "@/lib/admin";

export const dynamic = "force-dynamic";
const DEVICE_COOKIE = "fu_dev";

export async function POST(req: NextRequest) {
  let body: { wheelId?: string; wheelVersion?: string; playerName?: string; tv?: { code?: string; session?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }
  const store = await db();
  let wheel = body.wheelId ? await getWheelCached(String(body.wheelId)) : null;
  // il telefono ha una versione diversa da quella in cache: leggiamo quella vera dal database,
  // così estrazione, telefono e TV usano tutti la stessa ruota
  if (wheel && body.wheelVersion && body.wheelVersion !== wheel.updatedAt) wheel = await getWheelFresh(wheel.id);
  if (!wheel || !wheel.active) return NextResponse.json({ error: "Ruota non disponibile" }, { status: 404 });

  // fuori dal giorno dell'evento del club si gioca solo in prova (staff collegato), senza registrare
  const open = isOpenToday(wheel.event);
  const test = !open && (await canTestWheel(wheel));
  if (!open && !test) {
    return NextResponse.json({ error: closedMessage(wheel.event!), closed: true }, { status: 403 });
  }

  const playerName = (typeof body.playerName === "string" ? body.playerName : "").replace(/\s+/g, " ").trim().slice(0, 80) || null;
  if (wheel.settings.askName === "required" && !playerName) {
    return NextResponse.json({ error: "Inserisci il tuo nome per giocare" }, { status: 400 });
  }

  const deviceId = req.cookies.get(DEVICE_COOKIE)?.value || uid(16);
  const limit = wheel.settings.limitPerDevicePerDay;
  let used = 0;
  if (limit > 0) {
    const since = romeMidnight(romeDay(new Date())).toISOString();
    used = await store.countDeviceSpinsSince(wheel.id, deviceId, since);
    if (used >= limit) {
      return NextResponse.json({ error: "Hai già usato tutte le giocate di oggi. Torna domani!", remaining: 0 }, { status: 429 });
    }
  }

  const wins = wheel.segments.some((s) => s.stock !== null) ? await store.countWinsBySegment(wheel.id) : {};
  const index = pickWeighted(wheel.segments, wins);
  if (index < 0) return NextResponse.json({ error: "Premi esauriti, riprova più tardi" }, { status: 409 });
  const seg = wheel.segments[index];
  // dove fermarsi dentro lo spicchio: deciso qui così telefono e TV si fermano nello stesso punto
  const jitter = (crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * 2 - 1;

  const spin: Spin = {
    id: uid(16),
    code: test ? "PROVA" : spinCode(),
    wheelId: wheel.id,
    wheelName: wheel.name,
    segmentId: seg.id,
    segmentLabel: seg.label,
    kind: seg.kind,
    playerName,
    deviceId,
    createdAt: new Date().toISOString(),
    redeemedAt: null,
    redeemedBy: null,
  };

  // TV collegata: la frenata parte a un istante deciso dal server, uguale per i due schermi
  let tv: { decelInMs: number } | null = null;
  const tvCode = normalizeCode(body.tv?.code);
  const tvSession = body.tv?.session;
  const tvTask = (async () => {
    if (!tvCode || !tvSession) return;
    const now = Date.now();
    const decelAt = now + MOTION.TV_DECEL_DELAY_MS;
    let linked = false;
    await emitTv(
      tvCode,
      {
        type: "spin",
        sessionId: tvSession,
        index,
        segmentId: seg.id,
        wheelVersion: wheel.updatedAt,
        jitter,
        decelAt,
        decelSeconds: wheel.settings.spinSeconds,
        label: seg.label,
        kind: seg.kind,
        code: spin.code,
        playerName,
      },
      (st) => {
        const s = st.session;
        linked = !!s && s.id === tvSession && !!s.ackAt && now - s.lastActive < TV_SESSION_IDLE_MS;
        if (!linked) return false;
        s!.lastActive = now;
        st.busyUntil = decelAt + wheel.settings.spinSeconds * 1600 + 6000;
      },
    ).catch(() => (linked = false));
    if (linked) tv = { decelInMs: decelAt - Date.now() };
  })();

  await Promise.all([test ? null : store.insertSpin(spin), tvTask]);

  const res = NextResponse.json({
    index,
    segmentId: seg.id,
    jitter,
    code: spin.code,
    label: seg.label,
    kind: seg.kind,
    remaining: limit > 0 && !test ? limit - used - 1 : null,
    tv,
    version: wheel.updatedAt,
    test,
    // ruota cambiata dal backend dopo l'apertura della pagina: il telefono si aggiorna prima di fermarsi
    wheel: body.wheelVersion !== wheel.updatedAt ? toPublicWheel(wheel) : undefined,
  });
  res.cookies.set(DEVICE_COOKIE, deviceId, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 365, path: "/" });
  return res;
}
