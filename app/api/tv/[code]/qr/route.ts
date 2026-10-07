import QRCode from "qrcode";
import { db, getDefaultWheel, getWheelCached } from "@/lib/db";
import { normalizeCode } from "@/lib/tv";

export const dynamic = "force-dynamic";

/** QR da mostrare sulla TV: inquadrandolo con la fotocamera si apre il gioco già collegato a questa TV. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  const tv = await (await db()).getTvByCode(code);
  if (!tv) return new Response("not found", { status: 404 });
  const wheel = (tv.wheelId && (await getWheelCached(tv.wheelId))) || (await getDefaultWheel());
  const url = `${new URL(req.url).origin}/gioca/${wheel?.slug ?? "fitup"}?tv=${tv.code}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0d0d0d", light: "#ffffff" } });
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=300" } });
}
