# Ruota FitUP – TV, compatibilità e carico

## 1. Mirroring sulle TV dei club: cosa si può fare davvero

Parco TV (dalla matrice): **18 Hisense VIDAA** (U3.0 2019 → U9.5 2026) e **2 Samsung Tizen 2025** (U7000F). Nessuno ha Chromecast integrato.

| Opzione | Senza permessi del giocatore | Senza telecomando | Grafica 16:9 adattata | Copre il parco | Esito |
| --- | --- | --- | --- | --- | --- |
| **AirPlay** (iPhone → TV) | No: lo avvia l’utente dal Centro di controllo, e la prima volta la TV mostra un codice da digitare | Sì, dopo il primo abbinamento | **No**: duplica il telefono in verticale con bande nere | Solo Samsung 2025 e i VIDAA recenti con AirPlay 2; nessun VIDAA 2019; esclude Android | Scartato come soluzione principale |
| **Miracast / Anyview Cast / Smart View** (Android → TV) | No: avvio manuale dalle impostazioni del telefono | Spesso **no**: molti VIDAA chiedono “Consenti” col telecomando | No (verticale) | Variabile per marca di telefono | Scartato |
| **Chromecast / Presentation API** (browser → TV) | Sì | Sì | Sì | **Nessuna TV del parco** è ricevitore Cast | Non applicabile (lo diventa con una chiavetta Google TV) |
| **Schermo TV sincronizzato** (implementato) | **Sì**: si inquadra un QR con la fotocamera di sistema, nessun permesso nell’app | **Sì**: la TV resta su una pagina web; nessun intervento per ogni giocata | **Sì**: layout 16:9 dedicato, stessa animazione | **Tutte**: VIDAA U3.0+ e Tizen eseguono HTML5; bundle ES5 apposito | **Scelto** |

**Perché il mirroring “vero” non è pilotabile:** un sito web non può avviare AirPlay o Miracast della propria pagina. Safari permette AirPlay solo di un elemento `<video>`, non della pagina. Chrome trasmette solo verso dispositivi Cast. Qualunque mirroring di sistema è un’azione manuale dell’utente e mostra il telefono in 9:16.

### Come funziona lo schermo sincronizzato
1. Ogni TV apre una volta il proprio link `https://<dominio>/tv/<codice>` (backend → *Schermi TV*). La pagina mostra la ruota in 16:9, un QR e il codice a 6 cifre.
2. Il giocatore, **solo se vuole**, inquadra il QR (oppure tocca “Guarda sulla TV del club” e digita il codice). Il telefono chiede l’abbinamento e attende la **conferma della TV** (massimo 6 s).
3. A ogni giro il server decide l’esito e un **istante di frenata comune** (adesso + 1,4 s), poi lo invia alla TV. Telefono e TV usano lo stesso codice di fisica: si fermano sullo stesso spicchio, nello stesso punto e nello stesso momento. Il margine è di circa ±100 ms, dovuto alla sincronizzazione degli orologi.
4. Se la TV è spenta, non risponde, è occupata o all’autotest ha misurato **meno di 24 fps**, il telefono mostra: *«Ci dispiace, con il televisore individuato non ci è possibile collegarci per sdoppiare lo schermo. Fai qui il tuo giro di Ruota»* e il bottone “Gira la ruota” si richiama con una lieve animazione.

Trasporto eventi: **Ably** (SSE, push istantaneo) se è impostata `ABLY_API_KEY`, altrimenti **polling** (ogni 2 s a riposo, ogni 0,4 s con un giocatore collegato). Il polling è stato provato: la TV riceve il giro circa 1,35 s prima dell’inizio della frenata.

### Messa in opera delle TV senza telecomando
- **Consigliato:** chiavetta HDMI economica (Android TV / Fire TV / Google TV, 30–60 €) con un browser in modalità kiosk che all’avvio apre il link della TV. Con **HDMI-CEC** attivo la TV si accende e passa all’ingresso giusto da sola. Con una chiavetta Google TV diventa possibile anche il Cast nativo.
- **Senza hardware:** aprire il link una volta nel browser della TV (VIDAA “Browser”, Samsung “Internet”) e lasciarlo aperto. Si può anche pubblicare la stessa pagina come app web negli store VIDAA (programma partner) e Samsung (Tizen .wgt), ma ogni modello dovrà essere provato sul televisore fisico.
- Da verificare sul campo, per serie: VIDAA U3.0 (BE7000, AE7000F) ha il motore web più vecchio. Il bundle è ES5 apposta e l’autotest esclude automaticamente le TV non fluide.

## 2. Compatibilità telefoni e browser

| Dispositivo | Versione servita |
| --- | --- |
| iOS 16.4+, Android con Chrome 94+, Samsung Internet 17+, Firefox 93+, desktop moderni | Gioco completo (Next.js) |
| iOS 10 → 16.3, Android con browser datati | **Versione lite** in ES5, stessa grafica e fisica; reindirizzamento automatico |

Il runtime di Next.js 16 usa sintassi recente (`static {}` nelle classi), che non può essere convertita. Per questo uno script ES5 in testa alla pagina prova quella sintassi e, se manca, apre `/lite/...` mantenendo l’eventuale `?tv=`. La versione lite non ha il trascinamento col dito (solo tocco) e non ha la vibrazione su iOS (non supportata dal sistema).

Ottimizzazioni per telefoni economici:
- canvas ridotta sui dispositivi con 2 GB di RAM o meno;
- motion blur pre-calcolato;
- rotazione solo via GPU;
- nessun re-render React durante il giro.

## 3. Carico: 150 utenti backend e gioco aperto a tutta Italia
- **Hosting Vercel:** scala in automatico; pagine e immagini statiche (sticker, logo, bundle TV/lite) servite dalla CDN.
- **Configurazione ruote in cache** per 10 s su ogni istanza: il gioco non interroga il database a ogni pagina. Le modifiche dal backend arrivano entro 10 s.
- **Ogni giro richiede poche query:**
  - 1 inserimento;
  - 1 conteggio, se è attivo il limite di giocate per dispositivo;
  - 1 lettura dei premi già usciti, se ci sono quantità limitate.
- **Report** calcolato dal database (aggregati SQL) ed elenco **paginato a 100 righe**: 150 persone in contemporanea non scaricano più migliaia di righe a testa. Export CSV fino a 50.000 righe.
- **Neon Postgres** serverless con driver HTTP: nessun limite di connessioni lato funzioni. Indici su data, ruota e dispositivo.
- **TV:** con Ably zero richieste a riposo; in polling circa 0,5 richieste/s per TV accesa.
- Non è ancora stato fatto un test di carico reale. Va fatto in staging su Vercel + Neon prima del lancio nazionale (es. k6 con 500 giri/s).
