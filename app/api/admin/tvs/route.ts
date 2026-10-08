import { NextResponse } from "next/server";
import { requireGlobalAdmin } from "@/lib/admin";
import { db, emptyTvState } from "@/lib/db";
import { uid } from "@/lib/defaults";
import { newTvCode, tvStatus } from "@/lib/tv";
import type { TvScreen } from "@/lib/types";

export const dynamic = "force-dynamic";

const view = (t: TvScreen) => ({ ...t, state: undefined, session: t.state.session, ...tvStatus(t) });

export async function GET() {
  const u = await requireGlobalAdmin();
  if (u instanceof NextResponse) return u;
  return NextResponse.json((await (await db()).listTvs()).map(view));
}

export async function POST(req: Request) {
  const u = await requireGlobalAdmin();
  if (u instanceof NextResponse) return u;
  const body = (await req.json().catch(() => ({}))) as { name?: string; wheelId?: string | null };
  const name = (body.name ?? "").trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "Dai un nome allo schermo (es. FitUP Rosà – Sala pesi)" }, { status: 400 });
  const tv: TvScreen = {
    id: uid(),
    code: await newTvCode(),
    name,
    wheelId: body.wheelId || null,
    createdAt: new Date().toISOString(),
    lastSeenAt: null,
    bootFps: null,
    fps: null,
    userAgent: null,
    screen: null,
    qrMode: "play",
    state: emptyTvState(),
  };
  await (await db()).insertTv(tv);
  return NextResponse.json(view(tv), { status: 201 });
}
