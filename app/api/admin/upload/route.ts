import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireAdmin } from "@/lib/admin";
import { uid } from "@/lib/defaults";

export const dynamic = "force-dynamic";
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

export async function POST(req: Request) {
  const u = await requireAdmin();
  if (u instanceof NextResponse) return u;
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Nessun file" }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Formato non supportato (PNG, JPG, WEBP, SVG)" }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "File troppo grande (max 4 MB)" }, { status: 400 });
  const name = `${uid(8)}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`ruota/${name}`, file, { access: "public", contentType: file.type });
    return NextResponse.json({ url: blob.url });
  }
  if (process.env.VERCEL) {
    return NextResponse.json({ error: "Upload non configurato: collega Vercel Blob al progetto." }, { status: 500 });
  }
  // Sviluppo locale: salva in public/uploads
  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url: `/uploads/${name}` });
}
