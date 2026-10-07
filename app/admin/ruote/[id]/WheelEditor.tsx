"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BRAND, PALETTE, STICKERS, defaultSegments, uid } from "@/lib/defaults";
import { autoTextColor, shouldInvert } from "@/lib/color";
import type { Segment, Wheel, WheelSettings } from "@/lib/types";
import PreviewWheel from "./PreviewWheel";

type Status = { kind: "idle" | "ok" | "err"; text: string };

export default function WheelEditor({ initial, wins }: { initial: Wheel; wins: Record<string, number> }) {
  const router = useRouter();
  const [w, setW] = useState<Wheel>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<number | null>(null);
  const dirty = JSON.stringify(w) !== saved;

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    addEventListener("beforeunload", h);
    return () => removeEventListener("beforeunload", h);
  }, [dirty]);

  const totalWeight = useMemo(
    () => w.segments.reduce((a, s) => a + (s.stock !== null && (wins[s.id] ?? 0) >= s.stock ? 0 : s.weight), 0),
    [w.segments, wins],
  );

  const set = <K extends keyof Wheel>(k: K, v: Wheel[K]) => setW((p) => ({ ...p, [k]: v }));
  const setS = <K extends keyof WheelSettings>(k: K, v: WheelSettings[K]) => setW((p) => ({ ...p, settings: { ...p.settings, [k]: v } }));
  const setEvent = (patch: Partial<NonNullable<Wheel["event"]>>) =>
    setW((p) => {
      const ev = { dates: [], type: "Open Day", areaManager: null, ...(p.event ?? {}), ...patch };
      return { ...p, event: ev.dates.length ? ev : null };
    });
  const setSeg = (i: number, patch: Partial<Segment>) =>
    setW((p) => ({ ...p, segments: p.segments.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const move = (i: number, d: number) =>
    setW((p) => {
      const segs = [...p.segments];
      const j = (i + d + segs.length) % segs.length;
      [segs[i], segs[j]] = [segs[j], segs[i]];
      return { ...p, segments: segs };
    });
  const remove = (i: number) => {
    if (w.segments.length <= 2) return;
    setW((p) => ({ ...p, segments: p.segments.filter((_, j) => j !== i) }));
  };
  const duplicate = (i: number) =>
    setW((p) => {
      const segs = [...p.segments];
      segs.splice(i + 1, 0, { ...segs[i], id: uid() });
      return { ...p, segments: segs };
    });
  const add = () =>
    setW((p) => {
      const colors = [BRAND.white, BRAND.green, BRAND.black];
      const last = p.segments[p.segments.length - 1]?.color ?? BRAND.black;
      const color = colors[(colors.findIndex((c) => c.toLowerCase() === last.toLowerCase()) + 1) % 3] ?? BRAND.white;
      return {
        ...p,
        segments: [
          ...p.segments,
          { id: uid(), label: "Nuovo premio", display: "text", image: null, imageMode: "auto", color, textColor: null, kind: "premio", weight: 1, stock: null },
        ],
      };
    });
  const resetFitup = () => {
    if (confirm("Sostituire tutti gli spicchi con i 15 sticker FitUP standard?")) set("segments", defaultSegments());
  };

  const save = async () => {
    setSaving(true);
    setStatus({ kind: "idle", text: "Salvataggio…" });
    const res = await fetch(`/api/admin/wheels/${w.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(w),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setStatus({ kind: "err", text: data.error || "Errore nel salvataggio" });
    setW(data);
    setSaved(JSON.stringify(data));
    setStatus({ kind: "ok", text: "Salvato ✓ — la ruota pubblica è già aggiornata" });
    router.refresh();
  };

  const del = async () => {
    if (!confirm(`Eliminare definitivamente la ruota “${w.name}”? Le giocate già registrate restano nel report.`)) return;
    const res = await fetch(`/api/admin/wheels/${w.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setStatus({ kind: "err", text: data.error || "Errore" });
    router.push("/admin");
    router.refresh();
  };

  const pct = (s: Segment) => {
    const out = s.stock !== null && (wins[s.id] ?? 0) >= s.stock;
    return totalWeight > 0 && !out ? ((s.weight / totalWeight) * 100).toFixed(1).replace(".", ",") + "%" : "0%";
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="small" style={{ margin: 0 }}><Link href="/admin">← Tutte le ruote</Link></p>
          <h1>{w.name || "Ruota"}</h1>
          <p>Modifica spicchi, probabilità e testi. L’anteprima a destra si aggiorna in tempo reale.</p>
        </div>
        <div className="row">
          <a className="btn btn-ghost btn-sm" href={`/gioca/${(JSON.parse(saved) as Wheel).slug}`} target="_blank" rel="noreferrer">Apri gioco ↗</a>
        </div>
      </div>

      <div className="editor">
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <section className="panel">
            <h2>Impostazioni</h2>
            <div className="settings-grid">
              <label className="field">Nome interno
                <input className="input" value={w.name} onChange={(e) => set("name", e.target.value)} />
              </label>
              <label className="field">Indirizzo del gioco: /gioca/…
                <input className="input" value={w.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
              </label>
              <label className="field">Titolo
                <input className="input" value={w.settings.title} onChange={(e) => setS("title", e.target.value)} />
              </label>
              <label className="field">Sottotitolo
                <input className="input" value={w.settings.subtitle} onChange={(e) => setS("subtitle", e.target.value)} />
              </label>
              <label className="field">Nome del giocatore
                <select className="input" value={w.settings.askName} onChange={(e) => setS("askName", e.target.value as WheelSettings["askName"])}>
                  <option value="optional">Facoltativo</option>
                  <option value="required">Obbligatorio</option>
                  <option value="off">Non chiedere</option>
                </select>
              </label>
              <label className="field">Testo campo nome
                <input className="input" value={w.settings.namePlaceholder} onChange={(e) => setS("namePlaceholder", e.target.value)} />
              </label>
              <label className="field">Giocate per dispositivo al giorno (0 = illimitate)
                <input className="input" type="number" min={0} max={100} value={w.settings.limitPerDevicePerDay}
                  onChange={(e) => setS("limitPerDevicePerDay", Number(e.target.value))} />
              </label>
              <label className="field">Durata frenata: {w.settings.spinSeconds.toString().replace(".", ",")} s
                <input type="range" min={3} max={12} step={0.5} value={w.settings.spinSeconds} onChange={(e) => setS("spinSeconds", Number(e.target.value))} style={{ accentColor: "#94C424" }} />
              </label>
              <label className="field">Titolo vincita
                <input className="input" value={w.settings.winTitle} onChange={(e) => setS("winTitle", e.target.value)} />
              </label>
              <label className="field">Titolo penitenza
                <input className="input" value={w.settings.penaltyTitle} onChange={(e) => setS("penaltyTitle", e.target.value)} />
              </label>
              <label className="field full">Messaggio sotto al premio
                <input className="input" value={w.settings.footer} onChange={(e) => setS("footer", e.target.value)} />
              </label>
              <div className="row full" style={{ gap: 22 }}>
                <label className="check"><input type="checkbox" checked={w.active} onChange={(e) => set("active", e.target.checked)} /> Ruota attiva</label>
                <label className="check"><input type="checkbox" checked={w.settings.sound} onChange={(e) => setS("sound", e.target.checked)} /> Suoni</label>
                <label className="check">
                  <input type="checkbox" checked={w.isDefault} disabled={initial.isDefault} onChange={(e) => set("isDefault", e.target.checked)} />
                  Ruota predefinita (link principale)
                </label>
              </div>
            </div>
          </section>

          <section className="panel">
            <h2>Giorni di gioco{w.clubName ? ` · ${w.clubName}` : ""}</h2>
            <p className="small muted" style={{ marginTop: -6 }}>
              Il gioco è aperto al pubblico solo in questi giorni (ora italiana). Senza giorni la ruota è sempre attiva. Lo staff collegato può provarla in qualsiasi momento: le prove non vengono registrate.
            </p>
            <div className="settings-grid">
              <div className="field full">Giorni
                <div className="row">
                  {(w.event?.dates ?? []).map((d, i) => (
                    <span key={d + i} className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                      <input className="input" type="date" value={d} style={{ width: 170, padding: "8px 10px" }}
                        onChange={(e) => setEvent({ dates: (w.event?.dates ?? []).map((x, j) => (j === i ? e.target.value : x)) })} />
                      <button className="btn btn-ghost btn-sm" title="Togli giorno" onClick={() => setEvent({ dates: (w.event?.dates ?? []).filter((_, j) => j !== i) })}>✕</button>
                    </span>
                  ))}
                  <button className="btn btn-ghost btn-sm" onClick={() => setEvent({ dates: [...(w.event?.dates ?? []), new Date().toISOString().slice(0, 10)] })}>+ Aggiungi giorno</button>
                </div>
              </div>
              {w.event && (
                <>
                  <label className="field">Tipo di evento
                    <input className="input" value={w.event.type} onChange={(e) => setEvent({ type: e.target.value })} placeholder="Open Day / Compleanno" />
                  </label>
                  <label className="field">Area manager
                    <input className="input" value={w.event.areaManager ?? ""} onChange={(e) => setEvent({ areaManager: e.target.value || null })} />
                  </label>
                </>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Spicchi ({w.segments.length})</h2>
              <div className="row">
                <button className="btn btn-ghost btn-sm" onClick={resetFitup}>Ripristina 15 sticker FitUP</button>
                <button className="btn btn-sm" onClick={add}>+ Aggiungi spicchio</button>
              </div>
            </div>
            <div className="seg-list">
              {w.segments.map((s, i) => (
                <div key={s.id} className="seg">
                  <div className="seg-num">{i + 1}</div>
                  <button className="seg-swatch" style={{ background: s.color }} onClick={() => setPicker(i)} title="Cambia immagine">
                    {s.display === "image" && s.image ? (
                      <img src={s.image} alt="" style={{ filter: shouldInvert(s.imageMode, s.color) ? "invert(1)" : undefined }} />
                    ) : (
                      <span style={{ color: s.textColor || autoTextColor(s.color) }}>{s.label}</span>
                    )}
                  </button>
                  <div className="seg-fields">
                    <label className="field span-3">Testo / nome nel report
                      <input className="input" value={s.label} onChange={(e) => setSeg(i, { label: e.target.value })} />
                    </label>
                    <label className="field">Tipo
                      <select className="input" value={s.kind} onChange={(e) => setSeg(i, { kind: e.target.value as Segment["kind"] })}>
                        <option value="premio">Premio</option>
                        <option value="penitenza">Penitenza</option>
                        <option value="neutro">Neutro</option>
                      </select>
                    </label>
                    <label className="field">Mostra
                      <select className="input" value={s.display} onChange={(e) => setSeg(i, { display: e.target.value as Segment["display"] })}>
                        <option value="image" disabled={!s.image}>Immagine</option>
                        <option value="text">Testo</option>
                      </select>
                    </label>
                    <label className="field">Probabilità <span className="pct">{pct(s)}</span>
                      <input className="input" type="number" min={0} step={0.5} value={s.weight} onChange={(e) => setSeg(i, { weight: Number(e.target.value) })} />
                    </label>
                    <div className="field span-3">Colore spicchio
                      <div className="swatches">
                        {PALETTE.map((c) => (
                          <button key={c.value} title={c.name} style={{ background: c.value }}
                            className={s.color.toLowerCase() === c.value.toLowerCase() ? "is-on" : ""} onClick={() => setSeg(i, { color: c.value })} />
                        ))}
                        <input type="color" value={s.color} onChange={(e) => setSeg(i, { color: e.target.value.toUpperCase() })} title="Colore personalizzato" />
                      </div>
                    </div>
                    {s.display === "text" ? (
                      <div className="field span-2">Colore testo
                        <div className="swatches">
                          <button className={!s.textColor ? "is-on" : ""} onClick={() => setSeg(i, { textColor: null })} title="Automatico"
                            style={{ background: "linear-gradient(135deg,#fff 50%,#0d0d0d 50%)" }} />
                          {["#FFFFFF", "#0D0D0D", "#94C424"].map((c) => (
                            <button key={c} style={{ background: c }} className={s.textColor === c ? "is-on" : ""} onClick={() => setSeg(i, { textColor: c })} />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <label className="field span-2">Colori sticker
                        <select className="input" value={s.imageMode} onChange={(e) => setSeg(i, { imageMode: e.target.value as Segment["imageMode"] })}>
                          <option value="auto">Automatico</option>
                          <option value="original">Originali</option>
                          <option value="invert">Invertiti</option>
                        </select>
                      </label>
                    )}
                    <label className="field">Quantità
                      <input className="input" type="number" min={0} placeholder="∞" value={s.stock ?? ""}
                        onChange={(e) => setSeg(i, { stock: e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value))) })} />
                    </label>
                    {s.stock !== null && (
                      <p className="small muted span-6" style={{ margin: 0 }}>
                        Usciti finora: {wins[s.id] ?? 0} / {s.stock}
                        {(wins[s.id] ?? 0) >= s.stock && <span className="badge badge-red" style={{ marginLeft: 8 }}>Esaurito: non esce più</span>}
                      </p>
                    )}
                  </div>
                  <div className="seg-actions">
                    <button onClick={() => move(i, -1)} title="Sposta su">↑</button>
                    <button onClick={() => move(i, 1)} title="Sposta giù">↓</button>
                    <button onClick={() => duplicate(i)} title="Duplica">⧉</button>
                    <button className="del" onClick={() => remove(i)} title="Elimina" disabled={w.segments.length <= 2}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="row">
            <button className="btn btn-danger btn-sm" onClick={del}>Elimina ruota</button>
          </div>
        </div>

        <aside className="editor-preview">
          <div className="panel">
            <h2>Anteprima</h2>
            <PreviewWheel segments={w.segments} seconds={w.settings.spinSeconds} />
          </div>
        </aside>
      </div>

      <div className="savebar">
        <span className={`status ${status.kind === "ok" ? "toast-ok" : status.kind === "err" ? "toast-err" : ""}`}>
          {status.text || (dirty ? "Modifiche non salvate" : "Tutto salvato")}
        </span>
        <button className="btn btn-ghost btn-sm" disabled={!dirty || saving} onClick={() => (setW(JSON.parse(saved)), setStatus({ kind: "idle", text: "" }))}>
          Annulla modifiche
        </button>
        <button className="btn" disabled={!dirty || saving} onClick={save}>Salva</button>
      </div>

      {picker !== null && (
        <ImagePicker
          onClose={() => setPicker(null)}
          onPick={(url, label) => {
            const cur = w.segments[picker];
            const sticker = STICKERS.find((st) => st.file === url);
            setSeg(picker, {
              image: url,
              display: url ? "image" : "text",
              ...(label && (cur.label === "Nuovo premio" || STICKERS.some((st) => st.label === cur.label)) ? { label } : {}),
              ...(sticker ? { kind: sticker.kind } : {}),
            });
            setPicker(null);
          }}
        />
      )}
    </>
  );
}

function ImagePicker({ onPick, onClose }: { onPick: (url: string | null, label?: string) => void; onClose: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState("");
  const file = useRef<HTMLInputElement>(null);

  const upload = async (f: File) => {
    setUploading(true);
    setErr(null);
    const fd = new FormData();
    fd.append("file", f);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) return setErr(data.error || "Upload non riuscito");
    onPick(data.url);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal picker" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 22 }}>Scegli lo sticker</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Chiudi</button>
        </div>
        <div className="picker-grid">
          {STICKERS.map((s) => (
            <button key={s.file} onClick={() => onPick(s.file, s.label)} title={s.label}>
              <img src={s.file} alt={s.label} />
            </button>
          ))}
        </div>
        <div className="row">
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button className="btn btn-sm" onClick={() => file.current?.click()} disabled={uploading}>
            {uploading ? "Caricamento…" : "Carica immagine (PNG trasparente)"}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => onPick(null)}>Solo testo, senza immagine</button>
        </div>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input className="input" placeholder="…oppure incolla un URL https://" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className="btn btn-ghost btn-sm" disabled={!/^https:\/\//.test(url)} onClick={() => onPick(url)}>Usa</button>
        </div>
        {err && <div className="alert">{err}</div>}
      </div>
    </div>
  );
}
