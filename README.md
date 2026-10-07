# Ruota della fortuna FitUP

Web app con due parti:

- **Gioco** (pubblico): `/` apre la ruota predefinita, `/gioca/<indirizzo>` una ruota specifica. Si gioca toccando la ruota, trascinandola/lanciandola col dito o col bottone. Il nome del giocatore è facoltativo (configurabile).
- **Backend** (`/admin`): accesso solo con account Google Workspace **@fitup.it**. Si personalizzano spicchi, sticker o testi, colori, probabilità, quantità disponibili, titoli e limiti di gioco; il **report** mostra chi ha vinto cosa e in quale giorno, permette di segnare i premi consegnati e di scaricare un CSV per Excel.

- **Schermi TV** (`/tv/<codice>`): la ruota in 16:9 sulle TV dei club, sincronizzata col telefono del giocatore che lo sceglie (QR o codice a 6 cifre). Dettagli, alternative valutate (AirPlay, Miracast, Cast) e compatibilità in [docs/TV-e-compatibilita.md](docs/TV-e-compatibilita.md).
- **Versione lite** (`/lite/...`): telefoni con browser vecchi (iOS < 16.4, Chrome < 94) vengono portati qui in automatico; stessa grafica, ES5.

L'esito di ogni giro è deciso **dal server** (estrazione pesata crittograficamente sicura) e registrato prima che la ruota si fermi: il giocatore non può manipolarlo. Ogni giocata ha un codice di 6 caratteri da mostrare alla reception.

## Stack

Next.js 16 (App Router) · Auth.js v5 (Google) · Neon Postgres · Vercel Blob · nessun framework CSS (design system di fitup.it: nero, verde `#94C424`, Oswald + Poppins).

## Avvio in locale

```bash
npm install
cp .env.example .env.local   # poi metti DEV_ADMIN_BYPASS=1 per entrare in /admin senza Google
npm run dev
```

Senza `DATABASE_URL` i dati vanno in `.data/db.json` e gli upload in `public/uploads` (solo sviluppo).

## Deploy (GitHub + Vercel)

1. Crea un repository GitHub privato e fai push di questa cartella.
2. Su Vercel: **Add New → Project →** importa il repository (rileva Next.js da solo).
3. Nel progetto Vercel → **Storage**:
   - **Create Database → Neon** (Postgres) → collegalo al progetto: aggiunge `DATABASE_URL`. Le tabelle si creano da sole al primo avvio.
   - **Create → Blob** → collegalo: aggiunge `BLOB_READ_WRITE_TOKEN` (serve per caricare immagini dal backend).
4. Google Cloud Console (progetto del dominio fitup.it):
   - **Schermata consenso OAuth** → tipo utente **Interno** (così Google stesso accetta solo account @fitup.it).
   - **Credenziali → Crea ID client OAuth → Applicazione web**
     - Origini JavaScript: `https://<tuo-dominio>`
     - URI di reindirizzamento: `https://<tuo-dominio>/api/auth/callback/google`
5. Vercel → **Settings → Environment Variables**:
   - `AUTH_SECRET` → genera con `npx auth secret`
   - `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` → dal punto 4
   - `ALLOWED_DOMAIN` → `fitup.it`
   - `ABLY_API_KEY` → (consigliato) chiave Ably per gli schermi TV in tempo reale; senza, le TV vanno in polling
6. Redeploy. Il link del gioco è la root del dominio; il backend è `/admin`.

Il controllo del dominio è doppio: tipo utente “Interno” lato Google **e** verifica lato server (email verificata che finisce in `@fitup.it` + claim `hd` di Workspace). `DEV_ADMIN_BYPASS` è ignorato in produzione.

## Struttura

| Percorso | Cosa fa |
| --- | --- |
| `components/wheel/draw.ts` | Disegna la ruota su canvas (una volta) + motion blur rotazionale; impagina testi/sticker. Condiviso con TV e lite |
| `components/wheel/motion.ts` | Fisica del giro e della lancetta, condivisa con TV e lite |
| `components/wheel/useSpinner.ts` | Animazione sul telefono: rincorsa, crociera, frenata, gesti touch |
| `components/tv/*` | Collegamento facoltativo telefono → TV e messaggio di cortesia |
| `legacy/tv.ts`, `legacy/lite.ts` | Schermo TV e gioco lite, compilati in ES5 da `scripts/build-legacy.mjs` (parte da sola con `dev`/`build`) |
| `lib/tv.ts`, `app/api/tv/*` | Abbinamento, eventi (Ably o polling), heartbeat e autotest fps delle TV |
| `components/wheel/sound.ts` | Tick e jingle sintetizzati con WebAudio (nessun file audio) |
| `app/api/spin` | Estrae l'esito, applica limiti/quantità, registra la giocata |
| `app/admin/*` | Elenco ruote, editor con anteprima e giro di prova, report |
| `lib/db/` | Postgres (produzione) o file JSON (sviluppo) |
| `public/stickers/` | I 15 sticker FitUP (ritagliati e ottimizzati) |
