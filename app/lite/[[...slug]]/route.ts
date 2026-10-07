import { cookies } from "next/headers";
import { db, getDefaultWheel, getWheelBySlugCached } from "@/lib/db";
import { toPublicWheel } from "@/lib/defaults";
import { romeDay, romeMidnight } from "@/lib/time";
import { TV_BUILD } from "@/lib/tv-build";
import { closedMessage, eventText, isOpenToday } from "@/lib/event";
import { getAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/**
 * Versione "lite" del gioco per telefoni/browser vecchi (iOS < 16.4, Chrome < 94), dove il
 * runtime di Next.js 16 non parte. Ci si arriva in automatico: vedi il controllo in app/layout.tsx.
 */
export async function GET(_: Request, { params }: { params: Promise<{ slug?: string[] }> }) {
  const slug = (await params).slug?.[0];
  const wheel = slug ? await getWheelBySlugCached(slug) : await getDefaultWheel();
  if (!wheel || !wheel.active) {
    return new Response("<!doctype html><meta charset=utf-8><body style='background:#000;color:#fff;font-family:Arial;text-align:center;padding:40px'><h1>Ruota non disponibile</h1><p>Riprova più tardi!</p>", {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  let remaining: number | null = null;
  const limit = wheel.settings.limitPerDevicePerDay;
  if (limit > 0) {
    const device = (await cookies()).get("fu_dev")?.value;
    const used = device ? await (await db()).countDeviceSpinsSince(wheel.id, device, romeMidnight(romeDay(new Date())).toISOString()) : 0;
    remaining = Math.max(0, limit - used);
  }
  // JSON dentro <script>: niente "</script>" possibile
  const open = isOpenToday(wheel.event);
  const test = !open && !!(await getAdmin());
  const data = JSON.stringify({
    wheel: toPublicWheel(wheel),
    remaining,
    eventText: eventText(wheel.event),
    closed: open || test ? null : closedMessage(wheel.event!),
    test,
  }).replace(/</g, "\\u003c");
  const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#000000">
<title>${wheel.name.replace(/[<&]/g, "")} – FitUP</title>
<link rel="icon" href="/brand/icon.png">
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Poppins:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/lite/lite.css?v=${TV_BUILD}">
</head>
<body>
<div class="game">
  <div class="head"><img src="/brand/fitup-logo.png" alt="FitUP"><button id="mute" aria-label="Audio"></button></div>
  <h1 id="title"></h1>
  <div class="bar"></div>
  <p id="event" class="event"></p>
  <p id="subtitle"></p>
  <div id="banner" class="banner hidden"></div>
  <div class="stage">
    <div id="wheel" class="wheel" role="button" aria-label="Gira la ruota">
      <div class="wheel-shadow"></div>
      <div id="rotor" class="rotor"><canvas id="sharp"></canvas><canvas id="blur"></canvas></div>
      <div class="gloss"></div>
      <div class="hub"><img src="/brand/fitup-logo.png" alt=""></div>
      <div id="pointer" class="pointer"><svg viewBox="0 0 60 92"><path d="M30 90 L6 22 A26 26 0 1 1 54 22 Z" fill="#94C424" stroke="#0d0d0d" stroke-width="4" stroke-linejoin="round"/><circle cx="30" cy="26" r="9" fill="#0d0d0d"/><circle cx="28" cy="24" r="3" fill="#fff" opacity="0.7"/></svg></div>
    </div>
  </div>
  <div class="controls">
    <input id="name" class="input" maxlength="80" autocomplete="name">
    <button id="spin" class="btn btn-spin">Gira la ruota</button>
    <p id="hint" class="hint"></p>
    <div id="tvchip" class="tv-chip hidden">Sulla TV: <b id="tvname"></b> <button id="tvoff">Scollega</button></div>
    <button id="tvbtn" class="btn btn-ghost">Guarda sulla TV del club</button>
  </div>
</div>
<div id="modal" class="backdrop hidden"><div id="modalbox" class="modal"></div></div>
<canvas id="confetti"></canvas>
<script>var LITE = ${data};</script>
<script src="/lite/lite.js?v=${TV_BUILD}"></script>
</body>
</html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
