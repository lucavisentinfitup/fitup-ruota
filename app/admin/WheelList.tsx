"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import WheelView from "@/components/wheel/WheelView";
import type { Wheel } from "@/lib/types";
import { formatEventDay, isOpenToday } from "@/lib/event";

export default function WheelList({ wheels, clubCount }: { wheels: Wheel[]; clubCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const template = wheels.find((w) => w.isDefault) ?? wheels[0];
  const others = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return wheels
      .filter((w) => w.id !== template?.id)
      .filter((w) => !needle || w.name.toLowerCase().includes(needle) || w.slug.includes(needle) || (w.event?.areaManager ?? "").toLowerCase().includes(needle))
      .sort((a, b) => (a.clubName ?? a.name).localeCompare(b.clubName ?? b.name, "it"));
  }, [wheels, template, q]);
  const clubWheels = wheels.filter((w) => w.clubId).length;

  const create = async (fromId?: string) => {
    setBusy(true);
    const res = await fetch("/api/admin/wheels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fromId }),
    });
    setBusy(false);
    if (res.ok) router.push(`/admin/ruote/${(await res.json()).id}`);
  };

  const sync = async (applyTemplate: boolean) => {
    if (applyTemplate && !confirm(`Copiare spicchi e impostazioni della ruota modello su tutte le ${clubWheels} ruote dei club? Le personalizzazioni fatte sulle singole ruote club verranno sostituite.`)) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/wheels/sync-clubs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ applyTemplate }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(data.error || "Errore");
    setMsg(applyTemplate ? `Modello applicato a ${data.updated} ruote club.` : data.created ? `Create ${data.created} nuove ruote club.` : "Tutte le ruote club esistono già.");
    router.refresh();
  };

  const copy = async (slug: string) => {
    const url = `${location.origin}/gioca/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(slug);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      prompt("Copia il link:", url);
    }
  };

  return (
    <>
      {template && (
        <section className="panel template-card">
          <div className="thumb"><WheelView segments={template.segments} /></div>
          <div className="template-body">
            <div className="row">
              <span className="badge badge-green">Ruota modello · link principale</span>
              {template.active ? <span className="badge">Attiva</span> : <span className="badge badge-red">Disattivata</span>}
              <span className="badge">{template.segments.length} spicchi</span>
            </div>
            <h3>{template.name}</h3>
            <p className="muted small" style={{ margin: 0 }}>
              È la base da cui nascono le ruote dei club. Modificala e poi usa “Applica il modello a tutti i club” per aggiornarle tutte insieme.
            </p>
            <div className="row">
              <Link className="btn btn-sm" href={`/admin/ruote/${template.id}`}>Personalizza</Link>
              <a className="btn btn-ghost btn-sm" href={`/gioca/${template.slug}`} target="_blank" rel="noreferrer">Apri gioco</a>
              <button className="btn btn-ghost btn-sm" onClick={() => copy(template.slug)}>{copied === template.slug ? "Copiato!" : "Copia link"}</button>
            </div>
          </div>
        </section>
      )}

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0 }}>Ruote dei club ({clubWheels} di {clubCount})</h2>
            <p className="muted small" style={{ margin: "4px 0 0" }}>Una ruota per ogni palestra FitUP aperta su CORE: vincite e giocate restano separate per club nel report.</p>
          </div>
          <div className="row">
            <button className="btn btn-sm" onClick={() => sync(false)} disabled={busy}>
              {clubWheels < clubCount ? `Crea le ruote mancanti (${clubCount - clubWheels})` : "Controlla nuovi club"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => sync(true)} disabled={busy || !clubWheels}>Applica il modello a tutti i club</button>
            <button className="btn btn-ghost btn-sm" onClick={() => create()} disabled={busy}>+ Ruota libera</button>
          </div>
        </div>
        {msg && <p className="toast-ok small" style={{ margin: "0 0 12px" }}>{msg}</p>}
        <input className="input" placeholder="Cerca club, ruota o area manager…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12, maxWidth: 360 }} />
        <div className="table-wrap" style={{ maxHeight: "65vh" }}>
          <table className="tbl">
            <thead>
              <tr><th>Ruota</th><th>Evento</th><th>Area manager</th><th>Link del gioco</th><th>Stato</th><th /></tr>
            </thead>
            <tbody>
              {others.map((w) => (
                <tr key={w.id}>
                  <td>{w.name}</td>
                  <td>
                    {w.event ? (
                      <>
                        <span className={`badge ${w.event.type === "Open Day" ? "badge-green" : ""}`}>{w.event.type}</span>{" "}
                        <span className="small">{w.event.dates.map(formatEventDay).join(", ")}</span>
                      </>
                    ) : (
                      <span className="small muted">Sempre attiva</span>
                    )}
                  </td>
                  <td className="small muted">{w.event?.areaManager ?? "—"}</td>
                  <td>
                    <div className="row" style={{ flexWrap: "nowrap" }}>
                      <code className="small">/gioca/{w.slug}</code>
                      <button className="btn btn-ghost btn-sm" onClick={() => copy(w.slug)}>{copied === w.slug ? "Copiato!" : "Copia"}</button>
                      <a className="btn btn-ghost btn-sm" href={`/gioca/${w.slug}`} target="_blank" rel="noreferrer">Apri</a>
                    </div>
                  </td>
                  <td>
                    {!w.active ? <span className="badge badge-red">Disattivata</span> : isOpenToday(w.event) ? <span className="badge badge-green">Aperta oggi</span> : <span className="badge">In attesa</span>}
                  </td>
                  <td>
                    <div className="row" style={{ flexWrap: "nowrap" }}>
                      <Link className="btn btn-sm" href={`/admin/ruote/${w.id}`}>Personalizza</Link>
                      <Link className="btn btn-ghost btn-sm" href={`/admin/report?wheelId=${w.id}`}>Report</Link>
                    </div>
                  </td>
                </tr>
              ))}
              {others.length === 0 && (
                <tr><td colSpan={6} className="muted">{q ? "Nessuna ruota trovata." : "Nessuna ruota club: premi “Crea le ruote mancanti”."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
