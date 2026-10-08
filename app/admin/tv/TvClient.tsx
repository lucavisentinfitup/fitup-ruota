"use client";

import { useCallback, useEffect, useState } from "react";
import { formatRome } from "@/lib/time";

interface TvRow {
  id: string;
  code: string;
  name: string;
  wheelId: string | null;
  lastSeenAt: string | null;
  bootFps: number | null;
  fps: number | null;
  userAgent: string | null;
  screen: string | null;
  qrMode?: "play" | "rules";
  online: boolean;
  capable: boolean;
  session: { playerName: string | null; ackAt: number | null; lastActive: number } | null;
}

function platform(ua: string | null) {
  if (!ua) return "—";
  const vidaa = ua.match(/VIDAA\/?\s?([\w.]+)?/i);
  if (vidaa) return `Hisense VIDAA ${vidaa[1] ?? ""}`.trim();
  const tizen = ua.match(/Tizen\s?([\d.]+)?/i);
  if (tizen) return `Samsung Tizen ${tizen[1] ?? ""}`.trim();
  if (/CrKey/i.test(ua)) return "Chromecast";
  if (/Android/i.test(ua)) return "Android TV / box";
  if (/Web0S|webOS/i.test(ua)) return "LG webOS";
  return "Browser";
}

export default function TvClient({ wheels }: { wheels: { id: string; name: string }[] }) {
  const [tvs, setTvs] = useState<TvRow[] | null>(null);
  const [name, setName] = useState("");
  const [wheelId, setWheelId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/tvs");
    if (res.ok) setTvs(await res.json());
  }, []);

  useEffect(() => {
    setOrigin(location.origin);
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const create = async () => {
    setErr(null);
    const res = await fetch("/api/admin/tvs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, wheelId: wheelId || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(data.error || "Errore");
    setName("");
    load();
  };

  const update = async (t: TvRow, patch: Partial<Pick<TvRow, "name" | "wheelId" | "qrMode">>) => {
    setTvs((list) => list?.map((x) => (x.id === t.id ? { ...x, ...patch } : x)) ?? null);
    await fetch(`/api/admin/tvs/${t.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
  };

  const remove = async (t: TvRow) => {
    if (!confirm(`Eliminare lo schermo “${t.name}”? Il suo link smetterà di funzionare.`)) return;
    await fetch(`/api/admin/tvs/${t.id}`, { method: "DELETE" });
    load();
  };

  const copy = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      prompt("Copia il link:", url);
    }
  };

  return (
    <>
      <section className="panel" style={{ marginBottom: 18 }}>
        <h2>Aggiungi uno schermo</h2>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="field" style={{ flex: "1 1 320px" }}>Nome (club e zona)
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="es. FitUP Rosà – Reception" onKeyDown={(e) => e.key === "Enter" && create()} />
          </label>
          <label className="field" style={{ flex: "0 1 280px" }}>Ruota da mostrare
            <select className="input" value={wheelId} onChange={(e) => setWheelId(e.target.value)}>
              <option value="">Predefinita</option>
              {wheels.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <button className="btn" onClick={create}>Aggiungi</button>
        </div>
        {err && <div className="alert" style={{ marginTop: 12 }}>{err}</div>}
      </section>

      <div className="table-wrap" style={{ marginBottom: 18 }}>
        <table className="tbl">
          <thead>
            <tr><th>Schermo</th><th>Stato</th><th>Ruota</th><th>Il QR apre</th><th>Codice</th><th>Link da aprire sulla TV</th><th>TV rilevato</th><th className="num">Fluidità</th><th>Ultimo segnale</th><th /></tr>
          </thead>
          <tbody>
            {tvs === null && <tr><td colSpan={10} className="muted">Caricamento…</td></tr>}
            {tvs?.length === 0 && <tr><td colSpan={10} className="muted">Nessuno schermo. Aggiungine uno qui sopra.</td></tr>}
            {tvs?.map((t) => {
              const url = `${origin}/tv/${t.code}`;
              return (
                <tr key={t.id}>
                  <td><input className="input" style={{ padding: "6px 8px", minWidth: 220 }} defaultValue={t.name} onBlur={(e) => e.target.value !== t.name && update(t, { name: e.target.value })} /></td>
                  <td>
                    {!t.online ? <span className="badge">Spenta</span> : !t.capable ? <span className="badge badge-red">Non fluida</span> : <span className="badge badge-green">Online</span>}
                    {t.online && t.session?.ackAt && <div className="small muted">In gioco: {t.session.playerName || "giocatore"}</div>}
                  </td>
                  <td>
                    <select className="input" style={{ padding: "6px 8px" }} value={t.wheelId ?? ""} onChange={(e) => update(t, { wheelId: e.target.value || null })}>
                      <option value="">Predefinita</option>
                      {wheels.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="input" style={{ padding: "6px 8px" }} value={t.qrMode ?? "play"} onChange={(e) => update(t, { qrMode: e.target.value as "play" | "rules" })}
                      title="Regolamento: il cliente legge come ottenere i giri (5 contatti = 1 giro) e gioca in reception">
                      <option value="play">Il gioco</option>
                      <option value="rules">Il regolamento</option>
                    </select>
                  </td>
                  <td><code style={{ fontSize: 16 }}>{t.code.slice(0, 3)} {t.code.slice(3)}</code></td>
                  <td>
                    <div className="row" style={{ flexWrap: "nowrap" }}>
                      <code className="small">{url.replace(/^https?:\/\//, "")}</code>
                      <button className="btn btn-ghost btn-sm" onClick={() => copy(url, t.id)}>{copied === t.id ? "Copiato!" : "Copia"}</button>
                      <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noreferrer">Prova</a>
                    </div>
                  </td>
                  <td className="small" title={t.userAgent ?? ""}>{platform(t.userAgent)}{t.screen && <div className="muted">{t.screen}</div>}</td>
                  <td className="num">{t.bootFps ? `${Math.round(t.bootFps)} fps` : "—"}</td>
                  <td className="small muted">{t.lastSeenAt ? formatRome(t.lastSeenAt) : "mai"}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => remove(t)}>Elimina</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="panel">
        <h2>Come attivare una TV (una volta sola)</h2>
        <ol className="muted" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
          <li><b style={{ color: "#fff" }}>Consigliato, zero telecomando:</b> collega alla TV una chiavetta HDMI (Android TV / Fire TV con un browser in modalità kiosk) impostata per aprire all’avvio il link qui sopra. Con HDMI-CEC attivo la TV si accende e passa all’ingresso giusto da sola.</li>
          <li><b style={{ color: "#fff" }}>Senza hardware aggiuntivo:</b> apri il link nel browser della TV (Hisense VIDAA: app “Browser”; Samsung: “Internet”) e lascialo aperto. In alternativa l’app web si può pubblicare negli store VIDAA / Samsung come indicato nella matrice TV.</li>
          <li>Al primo avvio la TV fa un autotest di 2 secondi: se l’animazione non è fluida (sotto 12 fps; tra 12 e 40 fps la grafica viene alleggerita in automatico) lo schermo risulta “Non fluida” e i clienti vedono il messaggio di cortesia e giocano solo sul telefono.</li>
        </ol>
      </section>
    </>
  );
}
