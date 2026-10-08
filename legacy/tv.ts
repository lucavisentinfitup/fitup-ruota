// Schermo TV della ruota FitUP (16:9). Compilato in ES5 da scripts/build-tv.mjs insieme a
// lib/color.ts, components/wheel/motion.ts, components/wheel/draw.ts e legacy/common.ts:
// stessa grafica e stessa fisica del telefono. Regole: niente Promise/fetch/Map/Set/Array.from/String.includes, perché
// i motori web dei TV VIDAA U3.0 (2019) e U5 sono datati. Gli import vengono rimossi in build.
import { MOTION, blurFor, decelAt, pegIndex, planDecel, smooth, stepPointer, type DecelPlan } from "../components/wheel/motion";
import { drawBlur, drawWheel } from "../components/wheel/draw";
import { autoTextColor, shouldInvert } from "../lib/color";
import { $, confettiOn, escapeHtml, now, raf, setTransform, show, tickSound, audioUnlock, winSound, xhr } from "./common";
import type { PublicWheel, TvEvent } from "../lib/types";

declare const TV_CODE: string;

interface Config {
  tv: { code: string; name: string };
  wheel: PublicWheel;
  wheelVersion: string;
  eventText: string;
  realtime: "ably" | "poll";
  /** "rules": il QR apre il regolamento (le giocate si fanno in reception) */
  qrMode: "play" | "rules";
  tagline: string;
  playUrl: string;
  now: number;
}
type EventRec = { seq: number; at: number; event: TvEvent };
type SpinEvent = Extract<TvEvent, { type: "spin" }>;

// ------------------------------------------------------------------ stato
var api = "/api/tv/" + TV_CODE;
var cfg: Config | null = null;
var clockOffset = 0; // ms: oraServer - Date.now()
var lastSeq = -1;
var session: { id: string; playerName: string | null; lastActive: number } | null = null;
var count = 15;
var bootFps: number | null = null;
var frames = 0;
var framesFrom = now();
var fpsAvg: number | null = null;

var W = {
  theta: 0,
  v: 0,
  phase: "boot" as "boot" | "idle" | "accel" | "cruise" | "decel" | "result",
  t0: 0,
  vFrom: 0,
  spin: null as SpinEvent | null,
  decelLocal: 0,
  plan: null as DecelPlan | null,
  pointer: { ptr: 0, ptrV: 0 },
  lastK: 0,
  last: 0,
  resultUntil: 0,
  /** ruota in ricarica: la frenata aspetta la configurazione giusta */
  waiting: false,
};

// ------------------------------------------------------------------ layout 16:9 scalato
function fit() {
  var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  var stage = $("stage");
  setTransform(stage, "scale(" + s + ")");
  stage.style.left = Math.round((window.innerWidth - 1920 * s) / 2) + "px";
  stage.style.top = Math.round((window.innerHeight - 1080 * s) / 2) + "px";
  return s;
}

// ------------------------------------------------------------------ disegno ruota
var images: Record<string, HTMLImageElement> = {};
/** Sotto questa soglia la TV non è usabile; tra MIN_FPS e LOW_POWER_FPS si gioca con grafica alleggerita. */
var MIN_FPS = 12;
var LOW_POWER_FPS = 40;
function lowPower() {
  return bootFps !== null && bootFps < LOW_POWER_FPS;
}
function renderWheel() {
  if (!cfg) return;
  var s = fit();
  var dpr = window.devicePixelRatio || 1;
  // TV lente: bitmap più piccola e niente layer di motion blur, così l'animazione resta fluida
  var px = Math.min(lowPower() ? 900 : 1400, Math.round(940 * s * dpr));
  $("blur").style.display = lowPower() ? "none" : "";
  var sharp = $("sharp") as HTMLCanvasElement;
  var blur = $("blur") as HTMLCanvasElement;
  sharp.width = sharp.height = px;
  blur.width = blur.height = px;
  drawWheel(sharp, cfg.wheel.segments, { get: function (k: string) { return images[k]; } }, "Oswald, 'Arial Narrow', sans-serif");
  var small = document.createElement("canvas");
  small.width = small.height = Math.round(px / 2);
  drawBlur(small, sharp);
  var b = blur.getContext("2d")!;
  b.clearRect(0, 0, px, px);
  b.drawImage(small, 0, 0, px, px);
}

function loadWheelAssets(cb: () => void) {
  if (!cfg) return cb();
  var pending = 0;
  var done = false;
  var finish = function () {
    if (done) return;
    done = true;
    cb();
  };
  var segs = cfg.wheel.segments;
  for (var i = 0; i < segs.length; i++) {
    var src = segs[i].image;
    if (segs[i].display !== "image" || !src || images[src]) continue;
    pending++;
    (function (url: string) {
      var img = new Image();
      img.onload = function () {
        images[url] = img;
        if (--pending === 0) finish();
      };
      img.onerror = function () {
        if (--pending === 0) finish();
      };
      img.src = url;
    })(src);
  }
  // il font Oswald (Google Fonts) serve per gli spicchi di solo testo
  var fonts = (document as unknown as { fonts?: { ready?: { then: (f: () => void) => void } } }).fonts;
  var fontWait = 0;
  if (fonts && fonts.ready && fonts.ready.then) {
    fontWait++;
    fonts.ready.then(function () {
      if (--fontWait === 0 && pending === 0) finish();
    });
  }
  if (pending === 0 && fontWait === 0) finish();
  window.setTimeout(finish, 4000); // non restiamo mai bloccati
}

function applyConfig(c: Config) {
  cfg = c;
  count = c.wheel.segments.length;
  $("title").innerHTML = escapeHtml(c.wheel.settings.title || "Gira la ruota");
  $("tvname").innerHTML = escapeHtml(c.tv.name);
  $("event").innerHTML = escapeHtml(c.eventText || "");
  var rules = c.qrMode === "rules";
  $("tagline").innerHTML = rules ? escapeHtml(c.tagline || "") : "";
  show("tagline", rules && !!c.tagline);
  $("side").className = rules ? "has-tagline" : "";
  $("qr-title").innerHTML = rules ? "Inquadra il QR e scopri come giocare" : "Inquadra il QR e gioca sulla TV";
  $("qr-text").innerHTML = rules ? "Il regolamento completo si apre sul tuo telefono." : "Apri la fotocamera del telefono: la ruota gira qui e sul tuo schermo.";
  ($("qr") as HTMLImageElement).src = api + "/qr?v=" + encodeURIComponent(c.wheelVersion) + "&m=" + (c.qrMode || "play");
  $("code").innerHTML = c.tv.code.slice(0, 3) + " " + c.tv.code.slice(3);
}

// ------------------------------------------------------------------ orologio
function syncClock(cb?: () => void) {
  var best = Infinity;
  var n = 0;
  var one = function () {
    var t0 = Date.now();
    xhr("GET", "/api/time?_=" + t0, null, function (err, d) {
      var t1 = Date.now();
      if (!err && d && t1 - t0 < best) {
        best = t1 - t0;
        clockOffset = d.now - (t0 + t1) / 2;
      }
      if (++n < 3) one();
      else if (cb) cb();
    });
  };
  one();
}

// ------------------------------------------------------------------ pannelli laterali
/** Dopo il collegamento, se il giocatore non gira entro questo tempo, torna il QR per i prossimi. */
var PAIRED_IDLE_MS = 60000;
var currentPanel = "idle";
/** giocatore collegato che non ha ancora girato (da mostrare dopo il risultato di chi c'era prima) */
var freshPair = false;
var pairedShownAt = 0;
function panel(name: "idle" | "paired" | "spin" | "result") {
  if (name === "paired" && currentPanel !== "paired") pairedShownAt = Date.now();
  currentPanel = name;
  // QR e codice restano sempre visibili: spariscono solo durante il giro e il risultato.
  // Con un giocatore collegato compare solo un'etichetta sotto al codice.
  show("panel-idle", name === "idle" || name === "paired");
  show("paired-note", name === "paired");
  show("panel-paired", false);
  show("panel-spin", name === "spin");
  show("panel-result", name === "result");
}
function playerLabel(n: string | null) {
  return n ? escapeHtml(n) : "te!";
}

// ------------------------------------------------------------------ eventi
function handle(rec: EventRec) {
  if (rec.seq <= lastSeq) return;
  lastSeq = rec.seq;
  var ev = rec.event;
  if (ev.type === "reload") return window.location.reload();
  if (ev.type === "paired") {
    session = { id: ev.sessionId, playerName: ev.playerName, lastActive: Date.now() };
    freshPair = true;
    xhr("POST", api + "/ack", { sessionId: ev.sessionId }, function () {});
    $("player").innerHTML = playerLabel(ev.playerName);
    $("player-note").innerHTML = ev.playerName ? escapeHtml(ev.playerName) : "un giocatore";
    if (W.phase !== "result" && W.phase !== "accel" && W.phase !== "cruise" && W.phase !== "decel") panel("paired");
    return;
  }
  if (ev.type === "unpaired") {
    if (session && session.id === ev.sessionId) session = null;
    if (W.phase === "idle") panel("idle");
    return;
  }
  if (ev.type === "spin") {
    if (!session || session.id !== ev.sessionId) return;
    session.lastActive = Date.now();
    var spinEv = ev;
    // la ruota mostrata deve essere la stessa usata per l'estrazione: se è cambiata la ricarichiamo
    // (la frenata è a un'ora fissa, quindi il giro resta sincronizzato col telefono)
    if (!cfg || cfg.wheelVersion !== ev.wheelVersion || segmentIndex(ev) < 0) {
      startSpin(ev, true);
      reloadConfig(function () {
        if (W.spin === spinEv) W.spin = withIndex(spinEv);
      }, true);
    } else startSpin(withIndex(ev));
  }
}

/** Posizione dello spicchio estratto nella ruota di questa TV, cercato per ID (non per posizione). */
function segmentIndex(ev: SpinEvent) {
  if (!cfg) return -1;
  var segs = cfg.wheel.segments;
  for (var i = 0; i < segs.length; i++) if (segs[i].id === ev.segmentId) return i;
  return -1;
}
function withIndex(ev: SpinEvent): SpinEvent {
  var i = segmentIndex(ev);
  if (i < 0 || i === ev.index) return ev;
  var copy = JSON.parse(JSON.stringify(ev)) as SpinEvent;
  copy.index = i;
  return copy;
}

function startSpin(ev: SpinEvent, waitingConfig?: boolean) {
  W.waiting = !!waitingConfig;
  freshPair = false;
  W.spin = ev;
  W.decelLocal = ev.decelAt - clockOffset; // in Date.now()
  W.phase = "accel";
  W.vFrom = W.v;
  W.t0 = now();
  $("player2").innerHTML = playerLabel(ev.playerName);
  panel("spin");
  unlockAudio();
}

function showResult(ev: SpinEvent) {
  var seg = cfg ? cfg.wheel.segments[ev.index] : null;
  var titles = cfg ? cfg.wheel.settings : null;
  $("rkicker").innerHTML = escapeHtml(
    ev.kind === "premio" ? (titles ? titles.winTitle : "Hai vinto!") : ev.kind === "penitenza" ? (titles ? titles.penaltyTitle : "Penitenza!") : "Risultato",
  );
  $("rlabel").innerHTML = escapeHtml(ev.label);
  $("rplayer").innerHTML = ev.playerName ? escapeHtml(ev.playerName) : "";
  $("rcode").innerHTML = "Codice " + ev.code;
  var prize = $("rprize");
  prize.style.background = seg ? seg.color : "#94C424";
  prize.innerHTML = "";
  if (seg && seg.display === "image" && seg.image) {
    var img = document.createElement("img");
    img.src = seg.image;
    if (shouldInvert(seg.imageMode, seg.color)) {
      img.style.filter = "invert(1)";
      (img.style as unknown as Record<string, string>).webkitFilter = "invert(1)";
    }
    prize.appendChild(img);
  } else {
    var span = document.createElement("span");
    span.style.color = (seg && seg.textColor) || autoTextColor(seg ? seg.color : "#94C424");
    span.appendChild(document.createTextNode(ev.label));
    prize.appendChild(span);
  }
  $("panel-result").className = "panel result-" + ev.kind;
  panel("result");
  if (ev.kind === "premio") {
    confettiOn($("confetti") as HTMLCanvasElement, 1920, 1080);
    winSound();
  }
  W.resultUntil = Date.now() + 9000;
  // 5 s per leggere l'esito, poi il telefono viene scollegato (se non l'ha già fatto lui):
  // la TV torna libera per il prossimo cliente
  var sid = ev.sessionId;
  window.setTimeout(function () {
    if (!session || session.id !== sid) return;
    xhr("DELETE", "/api/tv/pair?code=" + TV_CODE + "&session=" + encodeURIComponent(sid), null, function () {});
    session = null;
    freshPair = false;
  }, 5000);
}

// ------------------------------------------------------------------ trasporto: Ably SSE o polling
var pollTimer = 0;
function poll() {
  window.clearTimeout(pollTimer);
  xhr("GET", api + "/state?since=" + Math.max(0, lastSeq) + "&_=" + Date.now(), null, function (err, d) {
    if (!err && d) {
      if (lastSeq < 0) {
        // appena avviati: non rigiochiamo eventi vecchi, prendiamo solo la sessione in corso
        lastSeq = d.seq;
        if (d.session) {
          session = { id: d.session.id, playerName: d.session.playerName, lastActive: Date.now() };
          freshPair = true;
          xhr("POST", api + "/ack", { sessionId: d.session.id }, function () {});
          $("player").innerHTML = playerLabel(d.session.playerName);
          $("player-note").innerHTML = d.session.playerName ? escapeHtml(d.session.playerName) : "un giocatore";
          if (W.phase === "idle") panel("paired");
        }
      } else for (var i = 0; i < d.events.length; i++) handle(d.events[i]);
    }
    // con un giocatore collegato si interroga spesso, altrimenti con calma
    var fast = cfg && cfg.realtime === "poll" && session;
    var interval = cfg && cfg.realtime === "ably" && sse ? 15000 : fast ? 400 : 2000;
    pollTimer = window.setTimeout(poll, interval);
  });
}

var sse: EventSource | null = null;
var sseFails = 0;
function connectRealtime() {
  var ES = (window as unknown as { EventSource?: typeof EventSource }).EventSource;
  if (!cfg || cfg.realtime !== "ably" || !ES || sseFails >= 3) return;
  xhr("GET", api + "/token?_=" + Date.now(), null, function (err, t) {
    if (err || !t || !t.token) {
      sseFails++;
      return window.setTimeout(connectRealtime, 5000);
    }
    var url = "https://realtime.ably.io/sse?v=1.2&channels=" + encodeURIComponent("tv:" + TV_CODE) + "&accessToken=" + encodeURIComponent(t.token);
    var es = new ES!(url);
    sse = es;
    es.onmessage = function (m) {
      sseFails = 0;
      try {
        var msg = JSON.parse(m.data);
        handle(JSON.parse(msg.data));
      } catch (e) {}
    };
    es.onerror = function () {
      es.close();
      if (sse === es) sse = null;
      sseFails++;
      window.setTimeout(connectRealtime, 3000);
    };
  });
}

// ------------------------------------------------------------------ heartbeat
function hello() {
  var screen = window.innerWidth + "x" + window.innerHeight + "@" + (window.devicePixelRatio || 1);
  xhr("POST", api + "/hello", { bootFps: bootFps, fps: fpsAvg, screen: screen }, function (err, d) {
    if (!err && d && cfg && d.wheelVersion && d.wheelVersion !== cfg.wheelVersion && W.phase === "idle") reloadConfig();
  });
}

function reloadConfig(cb?: () => void, fresh?: boolean) {
  xhr("GET", api + "/config?_=" + Date.now() + (fresh ? "&fresh=1" : ""), null, function (err, c) {
    if (err || !c) {
      if (err === "HTTP 404") fatal("Schermo non registrato (codice " + TV_CODE + "). Controlla il link nel backend.");
      return window.setTimeout(function () {
        reloadConfig(cb, fresh);
      }, fresh ? 600 : 5000);
    }
    applyConfig(c);
    loadWheelAssets(function () {
      renderWheel();
      W.waiting = false;
      if (cb) cb();
    });
  });
}

function fatal(msg: string) {
  $("err").innerHTML = escapeHtml(msg);
  show("err", true);
}

// ------------------------------------------------------------------ animazione
var BOOT_MS = 2400;
var lastTest = 0;
function frame() {
  var t = now();
  var dt = Math.min(0.05, (t - (W.last || t)) / 1000);
  W.last = t;
  frames++;
  if (t - framesFrom >= 5000) {
    fpsAvg = (frames * 1000) / (t - framesFrom);
    frames = 0;
    framesFrom = t;
  }

  switch (W.phase) {
    case "boot": {
      // autotest: giro veloce con motion blur, misuriamo se la TV regge l'animazione
      var u = (t - W.t0) / BOOT_MS;
      W.v = u < 0.25 ? MOTION.VMAX * smooth(u / 0.25) : u < 0.75 ? MOTION.VMAX : MOTION.VMAX * (1 - smooth((u - 0.75) / 0.25));
      W.theta += W.v * dt;
      if (u >= 1) {
        bootFps = Math.round(((frames * 1000) / (t - framesFrom)) * 10) / 10;
        W.phase = "idle";
        W.v = 0;
        lastTest = t;
        show("boot", false);
        panel(session ? "paired" : "idle");
        hello();
        // solo una TV davvero inutilizzabile mostra l'avviso; altrimenti si gioca, alleggerendo la grafica se serve
        if (bootFps < MIN_FPS) fatal("Questo televisore non è abbastanza fluido per la ruota (" + bootFps + " fps). Nuovo test tra un minuto.");
        else show("err", false);
        if (lowPower()) renderWheel();
      }
      break;
    }
    case "idle":
      // "attract mode": rotazione lenta quando nessuno gioca
      W.v += (8 - W.v) * Math.min(1, dt * 2);
      W.theta += W.v * dt;
      // TV risultata lenta (magari solo all'accensione): ripete l'autotest ogni minuto
      if (bootFps !== null && bootFps < MIN_FPS && !session && t - lastTest > 60000) {
        W.phase = "boot";
        W.t0 = t;
        frames = 0;
        framesFrom = t;
      }
      break;
    case "accel": {
      var ua = Math.min(1, (t - W.t0) / 500);
      W.v = W.vFrom + (MOTION.VMAX - W.vFrom) * smooth(ua);
      W.theta += W.v * dt;
      if (ua >= 1) W.phase = "cruise";
      if (Date.now() >= W.decelLocal) beginDecel();
      break;
    }
    case "cruise":
      W.theta += W.v * dt;
      if (Date.now() >= W.decelLocal) beginDecel();
      break;
    case "decel": {
      var d = decelAt(W.plan!, (Date.now() - W.decelLocal) / 1000);
      W.theta = d.theta;
      W.v = d.v;
      if (d.done) {
        W.v = 0;
        W.phase = "result";
        showResult(W.spin!);
      }
      break;
    }
    case "result":
      // finito il risultato lo schermo torna libero (QR e codice) per il prossimo cliente, a meno che
      // qualcuno si sia già collegato nel frattempo; la sessione resta, così se lo stesso giocatore
      // rigira la TV lo mostra comunque
      if (Date.now() > W.resultUntil) {
        W.phase = "idle";
        panel(session && freshPair ? "paired" : "idle");
      }
      break;
  }

  // sessione scaduta per inattività
  if (session && Date.now() - session.lastActive > 5 * 60000 && W.phase === "idle") {
    session = null;
    panel("idle");
  }
  // collegato ma non ha girato: non teniamo nascosto il QR a chi arriva dopo
  if (currentPanel === "paired" && W.phase === "idle" && Date.now() - pairedShownAt > PAIRED_IDLE_MS) panel("idle");

  stepPointer(W.pointer, W.theta, W.v, 1, count, dt);
  var k = pegIndex(W.theta, count);
  if (k !== W.lastK) {
    W.lastK = k;
    if (W.phase !== "boot" && W.phase !== "idle") tickSound(Math.min(1, 0.35 + Math.abs(W.v) / 1400));
  }
  setTransform($("rotor"), "rotate(" + W.theta + "deg)");
  setTransform($("pointer"), "translateX(-50%) rotate(" + W.pointer.ptr + "deg)");
  $("blur").style.opacity = String(blurFor(W.v));
  raf(frame);
}

function beginDecel() {
  if (W.waiting) return; // si continua a girare finché la ruota aggiornata non è pronta
  var ev = W.spin!;
  // la frenata parte nello stesso istante (ora server) del telefono: stessa durata, stesso punto d'arrivo
  W.plan = planDecel(W.theta, W.v || MOTION.VMAX, 1, ev.index, ev.jitter, count, ev.decelSeconds);
  W.phase = "decel";
}

function unlockAudio() {
  if (cfg && cfg.wheel.settings.sound) audioUnlock();
}

// ------------------------------------------------------------------ avvio
function boot() {
  fit();
  window.addEventListener("resize", function () {
    renderWheel();
  });
  // primo clic/OK col telecomando (se capita) sblocca l'audio sui TV che lo richiedono
  document.addEventListener("keydown", unlockAudio);
  document.addEventListener("click", unlockAudio);
  syncClock(function () {
    reloadConfig(function () {
      unlockAudio();
      W.phase = "boot";
      W.t0 = now();
      frames = 0;
      framesFrom = W.t0;
      raf(frame);
      poll();
      connectRealtime();
      window.setInterval(hello, 20000);
      window.setInterval(syncClock, 5 * 60000);
    });
  });
}

boot();

