import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Link corto per le TV: `<dominio>/440140` porta a `/tv/440140`.
 * Solo cifre, così si digita in fretta col telecomando.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code;
  if (!/^\d{6}$/.test(code)) return new NextResponse("Pagina non trovata", { status: 404 });
  return NextResponse.redirect(new URL(`/tv/${code}`, req.url), 307);
}
