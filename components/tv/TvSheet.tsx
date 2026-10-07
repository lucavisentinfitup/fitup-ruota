"use client";

import { useState } from "react";
import type { TvFailure, TvLinkStatus } from "./useTvLink";

interface Props {
  status: TvLinkStatus;
  failure: TvFailure | null;
  lost: boolean;
  onConnect: (code: string) => void;
  onClose: () => void;
  onPlayHere: () => void;
}

/** Pannello (bottom sheet) per collegare facoltativamente il telefono alla TV del club. */
export default function TvSheet({ status, failure, lost, onConnect, onClose, onPlayHere }: Props) {
  const [code, setCode] = useState("");

  // TV individuata ma non collegabile (spenta, non fluida, nessuna risposta): messaggio di cortesia
  if (failure === "unreachable" || lost) {
    return (
      <div className="modal-backdrop sheet-backdrop" onClick={onPlayHere}>
        <div className="modal sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
          <div className="sheet-icon is-sad" aria-hidden>
            <svg viewBox="0 0 24 24"><path d="M21 3H3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h7v2H8v2h8v-2h-2v-2h7a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 13H3V5h18v11z" /></svg>
          </div>
          <h2 className="sheet-title">{lost ? "TV scollegata" : "TV non disponibile"}</h2>
          <p className="sheet-text">
            {lost
              ? "Il collegamento con il televisore si è interrotto. Fai qui il tuo giro di Ruota."
              : "Ci dispiace, con il televisore individuato non ci è possibile collegarci per sdoppiare lo schermo. Fai qui il tuo giro di Ruota."}
          </p>
          <button className="btn" onClick={onPlayHere}>Gira qui</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop sheet-backdrop" onClick={status === "connecting" ? undefined : onClose}>
      <div className="modal sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="sheet-icon" aria-hidden>
          <svg viewBox="0 0 24 24"><path d="M21 3H3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h7v2H8v2h8v-2h-2v-2h7a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 13H3V5h18v11z" /></svg>
        </div>
        {status === "connecting" ? (
          <>
            <h2 className="sheet-title">Mi collego alla TV…</h2>
            <div className="spinner" aria-hidden />
            <p className="sheet-text">Tra un attimo vedrai la ruota anche sul televisore.</p>
          </>
        ) : (
          <>
            <h2 className="sheet-title">Guarda il tuo giro sulla TV</h2>
            <p className="sheet-text">
              Inquadra il QR sulla TV del club con la fotocamera del telefono, oppure inserisci il codice di 6 cifre che vedi sullo schermo.
            </p>
            <form
              className="sheet-form"
              onSubmit={(e) => {
                e.preventDefault();
                onConnect(code);
              }}
            >
              <input
                className={`input code-input ${failure === "not_found" ? "is-error" : ""}`}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]*"
                maxLength={7}
                placeholder="000 000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
                autoFocus
              />
              <button className="btn" type="submit" disabled={code.replace(/\D/g, "").length !== 6}>Collega</button>
            </form>
            {failure === "not_found" && <p className="sheet-err">Codice non trovato: controlla le 6 cifre sulla TV.</p>}
            {failure === "busy" && <p className="sheet-err">La TV è occupata da un altro giocatore: riprova tra qualche secondo, oppure gira qui.</p>}
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Gioca solo sul telefono</button>
          </>
        )}
      </div>
    </div>
  );
}
