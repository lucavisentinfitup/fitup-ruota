import "server-only";
import { NextResponse } from "next/server";
import { auth, isAllowedEmail } from "@/auth";

export interface AdminUser {
  email: string;
  name: string | null;
  image: string | null;
}

export const devBypass = () => process.env.NODE_ENV !== "production" && process.env.DEV_ADMIN_BYPASS === "1";

export async function getAdmin(): Promise<AdminUser | null> {
  if (devBypass()) return { email: "sviluppo@fitup.it", name: "Sviluppo locale", image: null };
  const session = await auth();
  const email = session?.user?.email;
  if (!isAllowedEmail(email)) return null;
  return { email: email!, name: session!.user!.name ?? null, image: session!.user!.image ?? null };
}

/** Per le route API: restituisce l'utente o una risposta 401 già pronta. */
export async function requireAdmin(): Promise<AdminUser | NextResponse> {
  const user = await getAdmin();
  return user ?? NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
}
