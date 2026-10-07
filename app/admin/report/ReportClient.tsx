"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, formatRome, romeDay } from "@/lib/time";
import type { Spin, SpinReport } from "@/lib/types";

const KIND_LABEL = { premio: "Premio", penitenza: "Penitenza", neutro: "Neutro" } as const;
const PAGE = 100;

export default function ReportClient({ wheels, initialWheelId }: { wheels: { id: string; name: string }[]; initialWheelId: string }) {
  const today = romeDay(new Date());
  const [f, setF] = useState({ from: addDays(today, -29), to: today, wheelId: initialWheelId, kind: "", q: "" });
  const [onlyToRedeem, setOnlyToRedeem] = useState(false);
  const [report, setReport] = useState<SpinReport | null>(null);
  const [spins, setSpins] = useState<Spin[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const qs = useMemo(() => new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString(), [f]);
  const listQs = qs + (onlyToRedeem ? "&toRedeem=1" : "");

  const loadReport = useCallback(async () => {
    const res = await fetch(`/api/admin/report?${qs}`);
    if (!res.ok) return setErr("Impossibile caricare i dati");
    setReport(await res.json());
  }, [qs]);

  const loadPage = useCallback(
    async (offset: number) => {
      const res = await fetch(`/api/admin/spins?${listQs}&limit=${PAGE}&offset=${offset}`);
      if (!res.ok) return setErr("Impossibile caricare i dati");
      const page: Spin[] = await res.json();
      setSpins((prev) => (offset === 0 ? page : [...(prev ?? []), ...page]));
      setHasMore(page.length === PAGE);
    },
    [listQs],
  );

  useEffect(() => {
    setErr(null);
    const t = setTimeout(() => {
      loadReport();
      loadPage(0);
    }, 250);
    return () => clearTimeout(t);
  }, [loadReport, loadPage]);

  const toggleRedeem = async (s: Spin) => {
    const res = await fetch(`/api/admin/spins/${s.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ redeemed: !s.redeemedAt }),
    });
    if (res.ok) {
      const upd: Spin = await res.json();
      setSpins((list) => list?.map((x) => (x.id === upd.id ? upd : x)) ?? null);
      loadReport();
    }
  };

  const stats = useMemo(() => {
    const r = report;
    const byDay = new Map<string, { premio: number; penitenza: number; neutro: number }>();
    for (const d of r?.byDay ?? []) {
      const e = byDay.get(d.day) ?? { premio: 0, penitenza: 0, neutro: 0 };
      e[d.kind] += d.n;
      byDay.set(d.day, e);
    }
    // tutti i giorni del periodo, anche quelli senza giocate
    const days: { day: string; premio: number; penitenza: number; neutro: number }[] = [];
    if (f.from && f.to && f.from <= f.to) {
      for (let d = f.from, i = 0; d <= f.to && i < 400; d = addDays(d, 1), i++) days.push({ day: d, ...(byDay.get(d) ?? { premio: 0, penitenza: 0, neutro: 0 }) });
    }
    return {
      total: r?.total ?? 0,
      prizes: r?.prizes ?? 0,
      penalties: r?.penalties ?? 0,
      named: r?.named ?? 0,
      redeemed: r?.redeemed ?? 0,
      byLabel: r?.byLabel ?? [],
      byWheel: r?.byWheel ?? [],
      days,
      maxDay: Math.max(1, ...days.map((d) => d.premio + d.penitenza + d.neutro)),
    };
  }, [report, f.from, f.to]);

  const rows = spins ?? [];
  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const preset = (n: number) => setF((p) => ({ ...p, from: addDays(today, -(n - 1)), to: today }));
  const labelEvery = Math.ceil(stats.days.length / 10);

  return (
    <>
      <div className="filters">
        <label className="field">Dal<input className="input" type="date" value={f.from} max={f.to} onChange={up("from")} /></label>
        <label className="field">Al<input className="input" type="date" value={f.to} min={f.from} onChange={up("to")} /></label>
        <label className="field">Ruota
          <select className="input" value={f.wheelId} onChange={up("wheelId")}>
            <option value="">Tutte</option>
            {wheels.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        <label className="field">Esito
          <select className="input" value={f.kind} onChange={up("kind")}>
            <option value="">Tutti</option>
            <option value="premio">Solo premi</option>
            <option value="penitenza">Solo penitenze</option>
          </select>
        </label>
        <label className="field">Cerca giocatore o codice<input className="input" value={f.q} onChange={up("q")} placeholder="es. Rossi, K7P2QX" /></label>
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={() => preset(1)}>Oggi</button>
          <button className="btn btn-ghost btn-sm" onClick={() => preset(7)}>7 gg</button>
          <button className="btn btn-ghost btn-sm" onClick={() => preset(30)}>30 gg</button>
        </div>
      </div>

      {err && <div className="alert" style={{ marginBottom: 16 }}>{err}</div>}

      <div className="kpis">
        <div className="kpi"><span>Giocate</span><strong>{stats.total}</strong></div>
        <div className="kpi"><span>Premi vinti</span><strong style={{ color: "var(--green)" }}>{stats.prizes}</strong></div>
        <div className="kpi"><span>Penitenze</span><strong>{stats.penalties}</strong></div>
        <div className="kpi"><span>Premi consegnati</span><strong>{stats.redeemed}<small className="muted" style={{ fontSize: 16 }}> / {stats.prizes}</small></strong></div>
        <div className="kpi"><span>Con nome giocatore</span><strong>{stats.named}</strong></div>
      </div>

      <div className="two-col">
        <section className="panel">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>Giocate per giorno</h2>
            <div className="legend"><span><i style={{ background: "var(--green)" }} />Premi</span><span><i style={{ background: "#555b62" }} />Penitenze</span></div>
          </div>
          <div className="chart">
            {stats.days.map((d, i) => {
              const tot = d.premio + d.penitenza + d.neutro;
              return (
                <div className="col" key={d.day} title={`${formatDay(d.day)}: ${tot} giocate (${d.premio} premi, ${d.penitenza} penitenze)`}>
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                    {d.penitenza + d.neutro > 0 && <i className="pen" style={{ height: `${((d.penitenza + d.neutro) / stats.maxDay) * 100}%` }} />}
                    {d.premio > 0 && <i style={{ height: `${(d.premio / stats.maxDay) * 100}%`, borderRadius: d.penitenza ? "3px 3px 0 0" : undefined }} />}
                    {tot === 0 && <i style={{ background: "#262626" }} />}
                  </div>
                  <small>{i % labelEvery === 0 ? formatDay(d.day, true) : " "}</small>
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel">
          <h2>Cosa è uscito</h2>
          <div className="table-wrap" style={{ maxHeight: 260, border: 0 }}>
            <table className="tbl">
              <thead><tr><th>Esito</th><th>Tipo</th><th className="num">Volte</th><th /><th className="num">Consegnati</th></tr></thead>
              <tbody>
                {stats.byLabel.map((r) => (
                  <tr key={r.kind + r.label}>
                    <td>{r.label}</td>
                    <td><span className={`badge ${r.kind === "premio" ? "badge-green" : ""}`}>{KIND_LABEL[r.kind]}</span></td>
                    <td className="num">{r.n}</td>
                    <td style={{ width: "30%" }}><div className="bar"><i style={{ width: `${(r.n / Math.max(1, stats.byLabel[0]?.n ?? 1)) * 100}%` }} /></div></td>
                    <td className="num">{r.kind === "premio" ? r.redeemed : "–"}</td>
                  </tr>
                ))}
                {stats.byLabel.length === 0 && <tr><td colSpan={5} className="muted">Nessuna giocata nel periodo.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {!f.wheelId && (
        <section className="panel" style={{ marginBottom: 18 }}>
          <h2>Giocate per club</h2>
          <div className="table-wrap" style={{ maxHeight: 320, border: 0 }}>
            <table className="tbl">
              <thead><tr><th>Ruota</th><th className="num">Giocate</th><th /><th className="num">Premi</th><th className="num">Penitenze</th><th className="num">Premi consegnati</th></tr></thead>
              <tbody>
                {stats.byWheel.map((r) => (
                  <tr key={r.wheelId} style={{ cursor: "pointer" }} onClick={() => setF((p) => ({ ...p, wheelId: r.wheelId }))} title="Filtra su questa ruota">
                    <td>{r.wheelName}</td>
                    <td className="num">{r.n}</td>
                    <td style={{ width: "25%" }}><div className="bar"><i style={{ width: `${(r.n / Math.max(1, stats.byWheel[0]?.n ?? 1)) * 100}%` }} /></div></td>
                    <td className="num">{r.prizes}</td>
                    <td className="num">{r.penalties}</td>
                    <td className="num">{r.redeemed} / {r.prizes}</td>
                  </tr>
                ))}
                {stats.byWheel.length === 0 && <tr><td colSpan={6} className="muted">Nessuna giocata nel periodo.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Elenco giocate</h2>
          <div className="row">
            <label className="check small"><input type="checkbox" checked={onlyToRedeem} onChange={(e) => setOnlyToRedeem(e.target.checked)} /> Solo premi da consegnare</label>
            <a className="btn btn-sm" href={`/api/admin/spins/export?${listQs}`}>Scarica Excel (CSV)</a>
          </div>
        </div>
        <div className="table-wrap" style={{ maxHeight: "70vh" }}>
          <table className="tbl">
            <thead>
              <tr><th>Giorno</th><th>Ora</th><th>Giocatore</th><th>Esito</th><th>Tipo</th><th>Codice</th><th>Ruota</th><th>Consegna</th></tr>
            </thead>
            <tbody>
              {spins === null && <tr><td colSpan={8} className="muted">Caricamento…</td></tr>}
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>{formatRome(s.createdAt, { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}</td>
                  <td>{formatRome(s.createdAt, { hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{s.playerName || <span className="zero">—</span>}</td>
                  <td>{s.segmentLabel}</td>
                  <td><span className={`badge ${s.kind === "premio" ? "badge-green" : ""}`}>{KIND_LABEL[s.kind]}</span></td>
                  <td><code>{s.code}</code></td>
                  <td className="muted">{s.wheelName}</td>
                  <td>
                    {s.kind === "premio" ? (
                      <label className="check small" title={s.redeemedAt ? `Consegnato il ${formatRome(s.redeemedAt)} da ${s.redeemedBy}` : "Segna come consegnato"}>
                        <input type="checkbox" checked={!!s.redeemedAt} onChange={() => toggleRedeem(s)} />
                        {s.redeemedAt ? <span className="muted">{formatRome(s.redeemedAt, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span> : "Da consegnare"}
                      </label>
                    ) : (
                      <span className="zero">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {spins && rows.length === 0 && <tr><td colSpan={8} className="muted">Nessuna giocata con questi filtri.</td></tr>}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => loadPage(rows.length)}>Mostra altre</button>
          </div>
        )}
      </section>
    </>
  );
}

function formatDay(day: string, short = false) {
  const [y, m, d] = day.split("-");
  return short ? `${d}/${m}` : `${d}/${m}/${y}`;
}
