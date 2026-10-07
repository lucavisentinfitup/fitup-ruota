# Ruota della Fortuna FitUP – contesto per Claude

Leggere prima di lavorare. Il brand si scrive sempre **FitUP** (mai "Fitup" o "fit up"). Lingua di lavoro: italiano.

## Cos'è
Web app "Ruota della Fortuna FitUP" per la **Promo Ottobre 2026**: i clienti dei club girano una ruota da telefono (premi o penitenze), il backend (solo account Google @fitup.it) gestisce ruote e report vincite, e le TV dei club mostrano la ruota in 16:9 sincronizzata col telefono.

- **Codice:** https://github.com/lucavisentinfitup/fitup-ruota (privato). Ogni push su `main` ripubblica in automatico su Vercel.
- **Produzione:** https://fitup-ruota.vercel.app (Vercel, account `lucavisentin-3821`, team `luca-visentins-projects`, progetto `fitup-ruota`, piano Hobby → da passare a Pro per uso commerciale)
- **Database:** Neon Postgres (integrazione Vercel `fitup-ruota-db`), immagini su Vercel Blob (`fitup-ruota-immagini`)
- Stack: Next.js 16, React 19, Auth.js v5 (Google), nessun framework CSS. Design system di fitup.it: nero, verde `#94C424`, Oswald (titoli maiuscoli) + Poppins.

## Mappa del codice
- `components/wheel/draw.ts` + `motion.ts`: disegno e fisica della ruota, **condivisi** tra telefono, TV e versione lite (non usare API moderne lì: vengono compilati anche in ES5).
- `components/Game.tsx`, `components/wheel/useSpinner.ts`: gioco sul telefono.
- `legacy/tv.ts` (schermo TV), `legacy/lite.ts` (telefoni vecchi): compilati in ES5 da `scripts/build-legacy.mjs` (parte da solo con `npm run dev`/`build`).
- `app/api/spin`: estrazione **lato server**, registra la giocata, sincronizza la TV (istante di frenata comune, spicchio identificato per ID, versione ruota).
- `app/api/tv/*`, `lib/tv.ts`: abbinamento telefono↔TV (QR o codice 6 cifre), eventi via Ably (se `ABLY_API_KEY`) o polling, autotest fps (< 24 fps → TV "non fluida").
- `app/admin/*`: ruote, editor, report, schermi TV. `lib/admin.ts`: accesso solo @fitup.it.
- `lib/db/`: Postgres (produzione) o `.data/db.json` (sviluppo locale senza `DATABASE_URL`).
- `lib/event.ts`: calendario evento per ruota (si gioca solo nei giorni dell'evento; lo staff loggato gioca "in prova", non registrato).

## Dati della promo
- `data/clubs.json`: 86 club FitUP da CORE (export del 07/10/2026). Esclusi su richiesta: Cogliate, Trecastagni, Casalgrande.
- `data/promo-ottobre.json`: calendario dal PDF "Appunti Promo Ottobre" (Open Day / Compleanno, 17-19-24-26 ottobre, area manager).
- Ogni club ha la ruota "Ruota della Fortuna FitUP [Club]" (`/gioca/<slug>`) e uno schermo TV (`/tv/<codice>`). Elenco completo: `LINK-RUOTE-FITUP.csv`.
- Ruota modello (predefinita, sempre aperta): `/`. Disposizione spicchi = render "Premi Ruota della Fortuna x Promo Ottobre" (`PROMO_OTTOBRE_ORDER` in `lib/defaults.ts`), 15 sticker in `public/stickers/`.
- Backend → "Applica il modello a tutti i club" copia spicchi/impostazioni sulle 86 ruote mantenendo date e area manager.

## Da fare / aperti (aggiornare questa lista)
- [ ] **Login backend:** creare in Google Cloud (org fitup.it, consenso "Interno") un ID client OAuth web con redirect `https://fitup-ruota.vercel.app/api/auth/callback/google`; aggiungere `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET` su Vercel (Production) e ripubblicare.
- [ ] Passare Vercel a piano **Pro** (uso commerciale).
- [ ] Abbiategrasso e Caresanablot: aperti su CORE ma assenti dal calendario → ruote "sempre attive"; decidere se disattivarle o dare una data.
- [ ] Verificare le date: con il calendario fornito il 19 e il 26 ottobre cadono di **lunedì**.
- [ ] Facoltativo: `ABLY_API_KEY` per eventi TV in tempo reale (oggi polling).
- [ ] Provare su TV reali (Hisense VIDAA U3.0 e Samsung Tizen) e su telefoni vecchi; test di carico prima del lancio.

## Comandi
```bash
npm install
npm run dev                     # locale: dati in .data/db.json; .env.local con DEV_ADMIN_BYPASS=1 per entrare in /admin
npm run build                   # build di produzione (compila anche i bundle ES5)
npx vercel@latest login         # una volta per computer
npx vercel@latest link --project fitup-ruota
npx vercel@latest env pull .env.production.vercel --environment production   # credenziali produzione (mai su git)
git push                                                                     # pubblica (deploy automatico da main)
npx vercel@latest deploy --prod --yes                                        # pubblicazione manuale, se serve
node scripts/migrate-local-to-db.mjs .env.production.vercel                  # copia ruote/TV locali nel DB di produzione (non le giocate)
```

## Regole
- Le credenziali non vanno mai nel repository (`.env*` è ignorato). Le gestisce Vercel.
- Non tenere `DATABASE_URL` in `.env.local`: il server locale finirebbe sul database di produzione (con accesso admin libero in sviluppo).
- Dopo modifiche a `legacy/*`, `draw.ts`, `motion.ts` o `lib/color.ts` il build ES5 deve passare (`npm run build:legacy`).
- Prima di lavorare: `git pull`. Alla fine: commit e `git push`.
