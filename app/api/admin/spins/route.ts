import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { parseFilters } from "@/lib/filters";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = await requireAdmin();
  if (u instanceof NextResponse) return u;
  return NextResponse.json(await (await db()).listSpins(parseFilters(new URL(req.url))));
}
