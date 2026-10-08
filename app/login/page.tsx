import { redirect } from "next/navigation";
import { signIn, ALLOWED_DOMAIN } from "@/auth";
import { getAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getAdmin()) redirect("/admin");
  const { error } = await searchParams;
  const googleReady = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  return (
    <main className="center-page">
      <form
        className="card"
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/admin" });
        }}
      >
        <img src="/brand/fitup-logo.png" alt="FitUP" style={{ height: 44 }} />
        <h1>Area gestione ruota</h1>
        <p>Accedi con il tuo account Google aziendale @{ALLOWED_DOMAIN}.</p>
        {!googleReady && (
          <div className="alert">
            Accesso Google non ancora configurato: mancano AUTH_GOOGLE_ID e AUTH_GOOGLE_SECRET nelle variabili del progetto su Vercel.
          </div>
        )}
        {error && (
          <div className="alert">
            {error === "AccessDenied"
              ? `Accesso negato: questo account non è abilitato. Entra con l'account del club (es. seregno@${ALLOWED_DOMAIN}) o con un account amministratore.`
              : "Accesso non riuscito. Riprova."}
          </div>
        )}
        <button className="btn" type="submit" style={{ width: "100%" }} disabled={!googleReady}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#0d0d0d" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" />
          </svg>
          Accedi con Google
        </button>
      </form>
    </main>
  );
}
