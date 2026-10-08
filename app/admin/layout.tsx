import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { devBypass, getAdmin } from "@/lib/admin";
import AdminNavLinks from "./NavLinks";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdmin();
  if (!user) redirect("/login");
  return (
    <div className="admin">
      <header className="admin-nav">
        <Link href="/admin">
          <img src="/brand/fitup-logo.png" alt="FitUP" />
        </Link>
        <AdminNavLinks club={user.role === "club"} />
        <div className="who">
          {devBypass() && <span className="badge badge-red">Modalità sviluppo</span>}
          <span>{user.email}</span>
          {!devBypass() && (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="btn btn-ghost btn-sm" type="submit">Esci</button>
            </form>
          )}
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
