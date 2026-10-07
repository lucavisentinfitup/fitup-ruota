import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeCode } from "@/lib/tv";

export const dynamic = "force-dynamic";

/** La TV conferma di aver ricevuto il collegamento: solo allora il telefono lo considera riuscito. */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  const { sessionId } = JSON.parse((await req.text()) || "{}") as { sessionId?: string };
  const next = await (await db()).updateTvState(code, (s) => {
    if (!s.session || s.session.id !== sessionId || s.session.ackAt) return null;
    s.session.ackAt = Date.now();
    s.seq++;
    return s;
  });
  return NextResponse.json({ ok: !!next?.session?.ackAt && next.session.id === sessionId });
}
