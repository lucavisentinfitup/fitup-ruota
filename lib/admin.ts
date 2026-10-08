import "server-only";
import { NextResponse } from "next/server";
import { auth, isAllowedEmail } from "@/auth";
import { accessFor } from "@/lib/access";
import { db } from "@/lib/db";
import type { SpinFilters, Wheel } from "@/lib/types";

export interface AdminUser {
  email: string;
  name: string | null;
  image: string | null;
  /** "global" = amministratore; "club" = vede solo la ruota del suo club */
  role: "global" | "club";
  clubId: string | null;
  clubName: string | null;
}

export const devBypass = () => process.env.NODE_ENV !== "production" && process.env.DEV_ADMIN_BYPASS === "1";

export async function getAdmin(): Promise<AdminUser | null> {
  if (devBypass()) {
    // in sviluppo DEV_ADMIN_EMAIL permette di provare la vista di un club (es. seregno@fitup.it)
    const devEmail = process.env.DEV_ADMIN_EMAIL;
    const a = devEmail ? accessFor(devEmail) : ({ role: "global" } as const);
    if (!a) return null;
    return {
      email: devEmail || "sviluppo@fitup.it", name: "Sviluppo locale", image: null,
      role: a.role, clubId: a.role === "club" ? a.clubId : null, clubName: a.role === "club" ? a.clubName : null,
    };
  }
  const session = await auth();
  const email = session?.user?.email;
  if (!isAllowedEmail(email)) return null;
  const a = accessFor(email);
  if (!a) return null;
  return {
    email: email!, name: session!.user!.name ?? null, image: session!.user!.image ?? null,
    role: a.role, clubId: a.role === "club" ? a.clubId : null, clubName: a.role === "club" ? a.clubName : null,
  };
}

/** Per le route API: restituisce l'utente o una risposta 401 già pronta. */
export async function requireAdmin(): Promise<AdminUser | NextResponse> {
  const user = await getAdmin();
  return user ?? NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
}

/** Come requireAdmin, ma solo per gli amministratori (non gli account dei club). */
export async function requireGlobalAdmin(): Promise<AdminUser | NextResponse> {
  const user = await requireAdmin();
  if (user instanceof NextResponse || user.role === "global") return user;
  return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
}

/** La ruota del club dell'utente (null per gli amministratori o se il club non ha una ruota). */
export async function clubWheel(user: AdminUser): Promise<Wheel | null> {
  if (user.role !== "club" || !user.clubId) return null;
  return (await (await db()).listWheels()).find((w) => w.clubId === user.clubId) ?? null;
}

/** Limita i filtri delle giocate alla ruota del club; gli amministratori vedono tutto. */
export async function scopeFilters(user: AdminUser, f: SpinFilters): Promise<SpinFilters> {
  if (user.role === "global") return f;
  return { ...f, wheelId: (await clubWheel(user))?.id ?? "-" };
}

/** Lo staff può giocare "in prova" fuori dai giorni dell'evento: gli amministratori ovunque, i club solo sulla propria ruota. */
export async function canTestWheel(wheel: Wheel): Promise<boolean> {
  const user = await getAdmin();
  if (!user) return false;
  return user.role === "global" || (!!user.clubId && wheel.clubId === user.clubId);
}
