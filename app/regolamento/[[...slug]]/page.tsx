import type { Metadata } from "next";
import { getDefaultWheel, getWheelBySlugCached } from "@/lib/db";
import { eventText } from "@/lib/event";
import { CONTACTS_PER_SPIN, REFERRAL_HEADLINE } from "@/lib/referral";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Regolamento – Ruota della Fortuna FitUP" };

type Props = { params: Promise<{ slug?: string[] }> };

/** Regolamento "Gira i contatti e Gira la ruota", aperto dal QR sulle TV in modalità regolamento. */
export default async function Regolamento({ params }: Props) {
  const slug = (await params).slug?.[0];
  const wheel = (slug && (await getWheelBySlugCached(slug))) || (await getDefaultWheel());
  const prizes = wheel?.segments.filter((s) => s.kind === "premio").map((s) => s.label) ?? [];
  const penalties = wheel?.segments.filter((s) => s.kind === "penitenza").map((s) => s.label) ?? [];
  const steps = [1, 2, 3].map((n) => ({ contacts: n * CONTACTS_PER_SPIN, spins: n }));

  return (
    <main className="rules">
      <img className="rules-logo" src="/brand/fitup-logo.png" alt="FitUP" />
      {wheel?.clubName && <p className="rules-club">FitUP {wheel.clubName}</p>}
      <h1>{REFERRAL_HEADLINE}</h1>
      {wheel?.event && <p className="rules-event">{eventText(wheel.event)}</p>}
      <p className="rules-lead">
        Porta in FitUP i tuoi amici: ogni <b>{CONTACTS_PER_SPIN} contatti</b> che presenti in reception vinci un giro della Ruota della Fortuna.
      </p>

      <div className="rules-steps">
        {steps.map((s) => (
          <div key={s.spins} className="rules-step">
            <strong>{s.contacts}</strong>
            <span>contatti</span>
            <i>=</i>
            <strong>{s.spins}</strong>
            <span>{s.spins === 1 ? "giro" : "giri"}</span>
          </div>
        ))}
        <p className="rules-more">…e così via: più contatti porti, più giri fai!</p>
      </div>

      <section className="rules-box">
        <h2>Come funziona</h2>
        <ol>
          <li>Raccogli i contatti (nome e telefono) di amici, parenti o colleghi interessati a provare FitUP, con il loro consenso a essere ricontattati.</li>
          <li>Presentali alla reception del club: ogni {CONTACTS_PER_SPIN} contatti validi hai diritto a un giro.</li>
          <li>Gira la ruota in reception: la vedi girare anche sulla TV del club.</li>
          <li>Se vinci un premio, ritiralo subito in reception mostrando il codice della giocata. Se esce una penitenza… niente scuse, si fa!</li>
        </ol>
      </section>

      {prizes.length > 0 && (
        <section className="rules-box">
          <h2>In palio</h2>
          <ul className="rules-tags">{prizes.map((p) => <li key={p}>{p}</li>)}</ul>
          {penalties.length > 0 && (
            <>
              <h3>Le penitenze</h3>
              <ul className="rules-tags is-pen">{penalties.map((p) => <li key={p}>{p}</li>)}</ul>
            </>
          )}
        </section>
      )}

      <p className="rules-foot">
        I giri si fanno solo in reception, nei giorni dell’iniziativa e fino a esaurimento premi. Lo staff FitUP verifica i contatti presentati.
      </p>
    </main>
  );
}
