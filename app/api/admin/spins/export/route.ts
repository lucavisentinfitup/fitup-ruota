import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { parseFilters } from "@/lib/filters";
import { formatRome, romeDay } from "@/lib/time";

export const dynamic = "force-dynamic";

const KIND = { premio: "Premio", penitenza: "Penitenza", neutro: "Neutro" } as const;
const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: Request) {
  const u = await requireAdmin();
  if (u instanceof NextResponse) return u;
  const spins = await (await db()).listSpins({ ...parseFilters(new URL(req.url)), limit: 50000, offset: 0 });
  const head = ["Data", "Ora", "Ruota", "Esito", "Tipo", "Giocatore", "Codice", "Consegnato il", "Consegnato da"];
  const rows = spins.map((s) =>
    [
      formatRome(s.createdAt, { dateStyle: "short" }),
      formatRome(s.createdAt, { timeStyle: "medium" }),
      s.wheelName,
      s.segmentLabel,
      KIND[s.kind],
      s.playerName,
      s.code,
      s.redeemedAt ? formatRome(s.redeemedAt) : "",
      s.redeemedBy,
    ]
      .map(cell)
      .join(";"),
  );
  // BOM + separatore ";" così Excel in italiano lo apre già in colonne
  const csv = "﻿" + [head.join(";"), ...rows].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ruota-fitup-giocate-${romeDay(new Date())}.csv"`,
    },
  });
}
