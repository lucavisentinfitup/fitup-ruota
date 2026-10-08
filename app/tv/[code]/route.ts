import { normalizeCode } from "@/lib/tv";
import { TV_BUILD } from "@/lib/tv-build";

export const dynamic = "force-dynamic";

/**
 * Pagina dello schermo TV. HTML statico + un solo script ES5: niente React/Next sul TV,
 * così gira anche sui motori web dei VIDAA del 2019 e su Tizen.
 */
export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FitUP – Ruota della fortuna (TV)</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Poppins:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/tv/tv.css?v=${TV_BUILD}">
</head>
<body>
<div id="stage">
  <div class="bg"></div>
  <div class="wheel">
    <div class="wheel-shadow"></div>
    <div id="rotor" class="rotor"><canvas id="sharp"></canvas><canvas id="blur"></canvas></div>
    <div class="gloss"></div>
    <div class="hub"><img src="/brand/fitup-logo.png" alt="FitUP"></div>
    <div id="pointer" class="pointer">
      <svg viewBox="0 0 60 92"><path d="M30 90 L6 22 A26 26 0 1 1 54 22 Z" fill="#94C424" stroke="#0d0d0d" stroke-width="4" stroke-linejoin="round"/><circle cx="30" cy="26" r="9" fill="#0d0d0d"/><circle cx="28" cy="24" r="3" fill="#fff" opacity="0.7"/></svg>
    </div>
  </div>
  <div id="side">
    <img class="logo" src="/brand/fitup-logo.png" alt="FitUP">
    <div id="tvname"></div>
    <h1 id="title">Gira la ruota</h1>
    <div class="bar"></div>
    <div id="event" class="tv-event"></div>
    <div id="panel-idle" class="panel">
      <div class="qrbox"><img id="qr" alt=""></div>
      <div class="qrtext">
        <p class="big">Inquadra il QR e gioca sulla TV</p>
        <p class="txt">Apri la fotocamera del telefono: la ruota gira qui e sul tuo schermo.</p>
      </div>
      <div class="codebox"><p>Oppure, dal gioco sul telefono, tocca “Guarda sulla TV” e inserisci il codice:</p><div id="code"></div></div>
      <div id="paired-note" class="paired-note hidden"><span class="dot"></span>Collegato: <b id="player-note"></b> · gira dal telefono</div>
    </div>
    <div id="panel-paired" class="panel hidden">
      <p class="kicker">Tocca a</p>
      <p class="player" id="player"></p>
      <p class="txt">Gira la ruota dal tuo telefono:<br>la vedrai girare anche qui.</p>
    </div>
    <div id="panel-spin" class="panel hidden">
      <p class="kicker">Sta girando…</p>
      <p class="player" id="player2"></p>
      <p class="txt">Incrocia le dita!</p>
    </div>
    <div id="panel-result" class="panel hidden">
      <p class="kicker" id="rkicker"></p>
      <p id="rplayer"></p>
      <div class="prize" id="rprize"></div>
      <p class="rlabel" id="rlabel"></p>
      <p id="rcode"></p>
    </div>
  </div>
  <canvas id="confetti"></canvas>
  <div id="boot" class="boot">Verifica delle prestazioni del televisore…</div>
  <div id="err" class="err hidden"></div>
</div>
<script>var TV_CODE = "${code}";</script>
<script src="/tv/tv.js?v=${TV_BUILD}"></script>
</body>
</html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
