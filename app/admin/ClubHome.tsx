"use client";

import { useState } from "react";
import Link from "next/link";
import WheelView from "@/components/wheel/WheelView";
import type { PublicWheel } from "@/lib/types";

interface Props {
  /** senza pesi né quantità: il club non vede le probabilità */
  wheel: PublicWheel;
  active: boolean;
  eventLabel: string | null;
  openToday: boolean;
  origin: string;
  shortHost: string;
  tvs: { id: string; name: string; code: string }[];
}

/** Vista dell'account di un club: la sua ruota (sola lettura) e i link da usare. */
export default function ClubHome({ wheel, active, eventLabel, openToday, origin, shortHost, tvs }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      prompt("Copia il link:", url);
    }
  };
  const LinkRow = ({ label, url, hint, open = true }: { label: string; url: string; hint?: string; open?: boolean }) => (
    <div className="club-link">
      <span className="small muted">{label}</span>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <code>{url.replace(/^https?:\/\//, "")}</code>
        <button className="btn btn-ghost btn-sm" onClick={() => copy(url)}>{copied === url ? "Copiato!" : "Copia"}</button>
        {open && <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noreferrer">Apri</a>}
      </div>
      {hint && <p className="small muted" style={{ margin: 0 }}>{hint}</p>}
    </div>
  );
  const game = `${origin}/gioca/${wheel.slug}`;

  return (
    <section className="panel template-card">
      <div className="thumb"><WheelView segments={wheel.segments} /></div>
      <div className="template-body">
        <div className="row">
          {!active ? <span className="badge badge-red">Disattivata</span> : openToday ? <span className="badge badge-green">Aperta oggi</span> : <span className="badge">In attesa dell&apos;evento</span>}
          {eventLabel && <span className="badge">{eventLabel}</span>}
        </div>
        <h3>{wheel.name}</h3>

        <LinkRow label="Link del gioco (da dare ai clienti)" url={game}
          hint="Lo apre anche il QR che compare sulla TV. Puoi usarlo per WhatsApp, social o locandine." />

        {tvs.length === 0 && <p className="small muted" style={{ margin: 0 }}>Nessuno schermo TV associato alla ruota: chiedi all&apos;amministratore.</p>}
        {tvs.map((t) => (
          <div key={t.id} className="club-tv">
            <LinkRow label={`Link da aprire sulla TV${tvs.length > 1 ? ` – ${t.name}` : ""}`} url={`https://${shortHost}/${t.code}`}
              hint={`Digitalo nel browser della TV (o di un tablet/PC). Codice TV per i clienti: ${t.code.slice(0, 3)} ${t.code.slice(3)}`} />
            <LinkRow label="Link completo dello schermo" url={`${origin}/tv/${t.code}`} open={false} />
          </div>
        ))}

        <div className="row">
          <Link className="btn btn-sm" href="/admin/report">Giocate e premi da consegnare</Link>
        </div>
      </div>
    </section>
  );
}
