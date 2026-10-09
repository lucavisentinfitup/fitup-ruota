// Gioco "lite" per telefoni e browser vecchi (iOS < 16.4, Android con Chrome datato) che non
// eseguono il runtime di Next.js 16. Compilato in ES5 da scripts/build-tv.mjs con gli stessi
// moduli di disegno e fisica del gioco principale: aspetto e movimento identici.
import { MOTION, blurFor, decelAt, easeInOut, pegIndex, planDecel, smooth, stepPointer, type DecelPlan } from "../components/wheel/motion";
import { drawBlur, drawWheel } from "../components/wheel/draw";
import { autoTextColor, shouldInvert } from "../lib/color";
import { $, audioUnlock, beep, confettiOn, escapeHtml, now, raf, setTransform, show, tickSound, winSound, xhr } from "./common";
import type { PublicWheel, SegmentKind } from "../lib/types";

declare const LITE: { wheel: PublicWheel; remaining: number | null; eventText: string; closed: string | null; test: boolean };

var wheel = LITE.wheel;
var S = wheel.settings;
var count = wheel.segments.length;
var remaining = LITE.remaining;
var muted = false;
try {
  muted = window.localStorage.getItem("fu_muted") === "1";
} catch (e) {}

var W = {
  theta: 0,
  v: 0,
  phase: "idle" as "idle" | "windup" | "accel" | "cruise" | "decel" | "settle",
  t0: 0,
  from: 0,
  plan: null as DecelPlan | null,
  pointer: { ptr: 0, ptrV: 0 },
  lastK: 0,
  last: 0,
  frameTheta: 0,
  result: null as null | { index: number; jitter: number; decelAt: number | null; code: string; kind: SegmentKind; label: string },
  error: null as string | null,
  running: false,
};
var tv: { code: string; session: string; tvName: string } | null = null;
var tvConnecting = false;

// ------------------------------------------------------------------ disegno
var images: Record<string, HTMLImageElement> = {};
function size() {
  var px = Math.round(Math.min(window.innerWidth * 0.92, window.innerHeight * 0.56, 640));
  var box = $("wheel");
  box.style.width = px + "px";
  box.style.height = px + "px";
  return px;
}
function render() {
  var px = size();
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var b = Math.min(1400, Math.round(px * dpr));
  var sharp = $("sharp") as HTMLCanvasElement;
  var blur = $("blur") as HTMLCanvasElement;
  sharp.width = sharp.height = b;
  blur.width = blur.height = b;
  drawWheel(sharp, wheel.segments, { get: function (k: string) { return images[k]; } }, "Oswald, 'Arial Narrow', sans-serif");
  var small = document.createElement("canvas");
  small.width = small.height = Math.round(b / 2);
  drawBlur(small, sharp);
  var g = blur.getContext("2d")!;
  g.clearRect(0, 0, b, b);
  g.drawImage(small, 0, 0, b, b);
  $("wheel").className = "wheel is-ready";
}
function loadAssets(cb: () => void) {
  var pending = 0;
  var done = false;
  var finish = function () {
    if (!done) {
      done = true;
      cb();
    }
  };
  for (var i = 0; i < wheel.segments.length; i++) {
    var s = wheel.segments[i];
    if (s.display !== "image" || !s.image || images[s.image]) continue;
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
    })(s.image);
  }
  var fonts = (document as unknown as { fonts?: { ready?: { then: (f: () => void) => void } } }).fonts;
  if (fonts && fonts.ready && fonts.ready.then) {
    pending++;
    fonts.ready.then(function () {
      if (--pending === 0) finish();
    });
  }
  if (pending === 0) finish();
  window.setTimeout(finish, 3000);
}

// ------------------------------------------------------------------ giro
function spin() {
  if (W.phase !== "idle" || $("modal").className.indexOf("hidden") < 0) return;
  if (remaining === 0 || LITE.closed) return;
  var nameEl = $("name") as HTMLInputElement | null;
  var name = nameEl ? nameEl.value.replace(/^\s+|\s+$/g, "") : "";
  if (S.askName === "required" && !name && nameEl) {
    nameEl.className = "input is-error";
    nameEl.focus();
    return;
  }
  if (!muted && S.sound) audioUnlock();
  W.result = null;
  W.error = null;
  W.from = W.theta;
  W.phase = "windup";
  W.t0 = now();
  setBusy(true);
  var t0 = now();
  var body: Record<string, unknown> = { wheelId: wheel.id, wheelVersion: wheel.version, playerName: name || undefined };
  if (tv) body.tv = { code: tv.code, session: tv.session };
  xhr(
    "POST",
    "/api/spin",
    body,
    function (err, d) {
      var t1 = now();
      if (err || !d) {
        if (d && typeof d.remaining === "number") remaining = d.remaining;
        W.error = (d && d.error) || "Qualcosa è andato storto, riprova.";
        return;
      }
      // ruota modificata dopo l'apertura della pagina: si usa quella del server (la stessa della TV)
      if (d.wheel) {
        wheel = d.wheel;
        S = wheel.settings;
        count = wheel.segments.length;
        loadAssets(render);
      }
      // lo spicchio si cerca per ID, mai solo per posizione
      var index = d.index;
      for (var i = 0; i < wheel.segments.length; i++) if (wheel.segments[i].id === d.segmentId) index = i;
      if (typeof d.remaining === "number") remaining = d.remaining;
      if (tv && !d.tv) {
        tv = null;
        updateTvUi();
      }
      W.result = {
        index: index,
        jitter: typeof d.jitter === "number" ? d.jitter : Math.random() * 2 - 1,
        // con la TV la frenata parte all'istante fissato dal server, così i due schermi coincidono
        decelAt: d.tv ? t1 + d.tv.decelInMs - (t1 - t0) / 2 : null,
        code: d.code,
        kind: d.kind,
        label: d.label,
      };
    },
    true,
  );
  if (!W.running) {
    W.running = true;
    W.last = 0;
    raf(frame);
  }
}

function frame() {
  var t = now();
  var dt = Math.min(0.05, (t - (W.last || t)) / 1000);
  W.last = t;
  switch (W.phase) {
    case "windup": {
      var u = Math.min(1, (t - W.t0) / MOTION.WINDUP_MS);
      W.theta = W.from - MOTION.WINDUP_DEG * easeInOut(u);
      W.v = dt > 0 ? (W.theta - W.frameTheta) / dt : 0;
      if (u >= 1) {
        W.phase = "accel";
        W.t0 = t;
      }
      break;
    }
    case "accel": {
      var ua = Math.min(1, (t - W.t0) / MOTION.ACCEL_MS);
      W.v = MOTION.VMAX * smooth(ua);
      W.theta += W.v * dt;
      if (ua >= 1) {
        W.phase = "cruise";
        W.t0 = t;
      }
      break;
    }
    case "cruise": {
      W.theta += W.v * dt;
      var r = W.result;
      var ready = r ? (r.decelAt !== null ? t >= r.decelAt : t - W.t0 >= MOTION.MIN_CRUISE_MS) : false;
      if (W.error || ready) {
        W.plan = planDecel(W.theta, W.v, 1, r ? r.index : null, r ? r.jitter : 0, count, S.spinSeconds);
        W.phase = "decel";
        W.t0 = t;
      }
      break;
    }
    case "decel": {
      var d = decelAt(W.plan!, (t - W.t0) / 1000);
      W.theta = d.theta;
      W.v = d.v;
      if (d.done) {
        W.phase = "settle";
        W.t0 = t;
        W.v = 0;
      }
      break;
    }
    case "settle":
      if (t - W.t0 > 420) {
        W.phase = "idle";
        setBusy(false);
        if (W.result) showResult();
        else showError(W.error || "Errore");
      }
      break;
  }
  W.frameTheta = W.theta;
  stepPointer(W.pointer, W.theta, W.v, 1, count, dt);
  var k = pegIndex(W.theta, count);
  if (k !== W.lastK) {
    W.lastK = k;
    if (!muted && S.sound) tickSound(Math.min(1, 0.35 + Math.abs(W.v) / 1400));
    if (Math.abs(W.v) < 500 && navigator.vibrate) navigator.vibrate(4);
  }
  setTransform($("rotor"), "rotate(" + W.theta + "deg)");
  setTransform($("pointer"), "translateX(-50%) rotate(" + W.pointer.ptr + "deg)");
  $("blur").style.opacity = String(blurFor(W.v));
  var resting = W.phase === "idle" && Math.abs(W.pointer.ptr) < 0.05 && Math.abs(W.pointer.ptrV) < 0.05;
  if (resting) W.running = false;
  else raf(frame);
}

function setBusy(b: boolean) {
  var btn = $("spin") as HTMLButtonElement;
  btn.disabled = b || remaining === 0 || !!LITE.closed;
  btn.innerHTML = LITE.closed ? "Non ancora disponibile" : remaining === 0 ? "Giocate finite per oggi" : b ? "Gira…" : "Gira la ruota";
  var tvb = $("tvbtn") as HTMLButtonElement;
  tvb.disabled = b;
  var hint = $("hint");
  hint.innerHTML = typeof remaining === "number" && remaining > 0 ? "Giocate rimaste oggi: " + remaining : "Tocca la ruota per farla girare";
}

// ------------------------------------------------------------------ popup
function modal(html: string, cls: string) {
  $("modalbox").className = "modal " + cls;
  $("modalbox").innerHTML = html;
  show("modal", true);
}
function closeModal() {
  show("modal", false);
}

function showResult() {
  var r = W.result!;
  // giro fatto con la TV: dopo 5 s il telefono si scollega e la TV torna libera
  if (tv) {
    var linked = tv;
    window.setTimeout(function () {
      if (tv && tv.session === linked.session) {
        xhr("DELETE", "/api/tv/pair?code=" + tv.code + "&session=" + tv.session, null, function () {});
        tv = null;
        updateTvUi();
      }
    }, 5000);
  }
  var seg = wheel.segments[r.index];
  var title = r.kind === "premio" ? S.winTitle : r.kind === "penitenza" ? S.penaltyTitle : S.neutralTitle;
  modal(
    '<p class="kicker">' + escapeHtml(title) + '</p><div class="prize" id="mprize"></div><h2 class="label">' + escapeHtml(r.label) + "</h2>" +
      (r.kind === "penitenza" ? '<p class="sub">Niente scuse: falla subito!</p>' : "") +
      '<div class="code"><span>Codice giocata</span><strong>' + escapeHtml(r.code) + "</strong></div>" +
      (r.kind === "premio" && S.footer ? '<p class="sub">' + escapeHtml(S.footer) + "</p>" : "") +
      '<button class="btn" id="mclose">' + (remaining === 0 ? "Chiudi" : "Ok") + "</button>",
    "result-" + r.kind,
  );
  var box = $("mprize");
  box.style.background = seg.color;
  if (seg.display === "image" && seg.image) {
    var img = document.createElement("img");
    img.src = seg.image;
    if (shouldInvert(seg.imageMode, seg.color)) {
      img.style.filter = "invert(1)";
      (img.style as unknown as Record<string, string>).webkitFilter = "invert(1)";
    }
    box.appendChild(img);
  } else {
    var span = document.createElement("span");
    span.style.color = seg.textColor || autoTextColor(seg.color);
    span.appendChild(document.createTextNode(seg.label));
    box.appendChild(span);
  }
  $("mclose").onclick = closeModal;
  if (r.kind === "premio") {
    confettiOn($("confetti") as HTMLCanvasElement, window.innerWidth, window.innerHeight);
    if (!muted && S.sound) winSound();
    if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
  } else if (r.kind === "penitenza") {
    if (!muted && S.sound) for (var i = 0; i < 4; i++) beep([392, 370, 349, 330][i], 0.25, 0.07, "sawtooth", i * 0.17);
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  }
}

function showError(msg: string) {
  modal('<p class="kicker">Ops!</p><h2 class="label">' + escapeHtml(msg) + '</h2><button class="btn" id="mclose">Ok</button>', "result-error");
  $("mclose").onclick = closeModal;
  setBusy(false);
}

// ------------------------------------------------------------------ TV (facoltativa)
function saveTv() {
  try {
    if (tv) window.sessionStorage.setItem("fu_tv", JSON.stringify(tv));
    else window.sessionStorage.removeItem("fu_tv");
  } catch (e) {}
}
function updateTvUi() {
  show("tvchip", !!tv);
  show("tvbtn", !tv && remaining !== 0 && !LITE.closed);
  if (tv) $("tvname").innerHTML = escapeHtml(tv.tvName);
  saveTv();
}
function openTvSheet() {
  modal(
    '<p class="kicker">Guarda il tuo giro sulla TV</p><p class="sub">Inquadra il QR sulla TV del club con la fotocamera del telefono, oppure inserisci il codice di 6 cifre che vedi sullo schermo.</p>' +
      '<input class="input code-input" id="tvcode" type="tel" maxlength="7" placeholder="000 000">' +
      '<p class="err hidden" id="tverr"></p><button class="btn" id="tvgo">Collega</button><button class="btn btn-ghost" id="mclose">Gioca solo sul telefono</button>',
    "sheet",
  );
  $("mclose").onclick = closeModal;
  $("tvgo").onclick = function () {
    connectTv(($("tvcode") as HTMLInputElement).value);
  };
}
function tvFailed(reason: string) {
  tvConnecting = false;
  if (reason === "not_found" || reason === "busy") {
    if ($("tverr")) {
      $("tverr").innerHTML = reason === "busy" ? "La TV è occupata da un altro giocatore: riprova tra qualche secondo, oppure gira qui." : "Codice non trovato: controlla le 6 cifre sulla TV.";
      show("tverr", true);
      return;
    }
  }
  modal(
    '<p class="kicker kicker-muted">TV non disponibile</p><p class="sub big">Ci dispiace, con il televisore individuato non ci è possibile collegarci per sdoppiare lo schermo. Fai qui il tuo giro di Ruota.</p><button class="btn" id="mclose">Gira qui</button>',
    "sheet",
  );
  $("mclose").onclick = function () {
    closeModal();
    nudge();
  };
}
/** Richiamo leggero del bottone "Gira la ruota" */
function nudge() {
  var b = $("spin");
  b.className = "btn btn-spin";
  void b.offsetWidth; // riavvia l'animazione CSS
  b.className = "btn btn-spin btn-nudge";
}
function connectTv(raw: string) {
  var code = String(raw || "").replace(/\D/g, "");
  if (tvConnecting) return;
  if (code.length !== 6) return tvFailed("not_found");
  tvConnecting = true;
  modal('<p class="kicker">Mi collego alla TV…</p><div class="spinner"></div><p class="sub">Tra un attimo vedrai la ruota anche sul televisore.</p>', "sheet");
  var nameEl = $("name") as HTMLInputElement | null;
  xhr(
    "POST",
    "/api/tv/pair",
    { code: code, playerName: nameEl ? nameEl.value : undefined },
    function (err, d) {
      if (!d || !d.ok) return tvFailed(d && d.reason ? d.reason : "unreachable");
      if (d.wheelId && d.wheelId !== wheel.id && d.wheelSlug) return window.location.replace("/lite/" + d.wheelSlug + "?tv=" + code);
      var started = Date.now();
      var check = function () {
        xhr("GET", "/api/tv/pair?code=" + code + "&session=" + d.sessionId + "&_=" + Date.now(), null, function (e2, st) {
          if (st && st.acked) {
            tvConnecting = false;
            tv = { code: code, session: d.sessionId, tvName: d.tvName };
            updateTvUi();
            closeModal();
            return;
          }
          if (Date.now() - started > 6000) {
            xhr("DELETE", "/api/tv/pair?code=" + code + "&session=" + d.sessionId, null, function () {});
            return tvFailed("unreachable");
          }
          window.setTimeout(check, 450);
        });
      };
      window.setTimeout(check, 450);
    },
    true,
  );
}

// ------------------------------------------------------------------ avvio
function boot() {
  $("title").innerHTML = escapeHtml(S.title);
  $("subtitle").innerHTML = escapeHtml(S.subtitle);
  $("event").innerHTML = escapeHtml(LITE.eventText || "");
  if (LITE.closed || LITE.test) {
    $("banner").innerHTML = escapeHtml(LITE.closed || "Modalità prova staff: oggi la ruota non è aperta al pubblico, le giocate non vengono registrate.");
    $("banner").className = "banner" + (LITE.test ? " banner-test" : "");
  }
  var nameEl = $("name") as HTMLInputElement;
  if (S.askName === "off") nameEl.parentNode!.removeChild(nameEl);
  else {
    nameEl.placeholder = S.askName === "required" ? S.namePlaceholder.replace(/\s*\(facoltativo\)/i, "") : S.namePlaceholder;
    nameEl.oninput = function () {
      nameEl.className = "input";
    };
  }
  if (!S.sound) show("mute", false);
  $("mute").innerHTML = muted ? "🔇" : "🔊";
  $("mute").onclick = function () {
    muted = !muted;
    $("mute").innerHTML = muted ? "🔇" : "🔊";
    try {
      window.localStorage.setItem("fu_muted", muted ? "1" : "0");
    } catch (e) {}
  };
  $("spin").onclick = spin;
  $("wheel").onclick = spin;
  // TV del club accesa: collegamento diretto senza codice; altrimenti il pannello come prima
  $("tvbtn").onclick = function () {
    xhr("GET", "/api/tv/club?wheel=" + encodeURIComponent(wheel.id) + "&_=" + Date.now(), null, function (err, d) {
      if (!err && d && d.code) connectTv(d.code);
      else openTvSheet();
    });
  };
  $("tvoff").onclick = function () {
    if (tv) xhr("DELETE", "/api/tv/pair?code=" + tv.code + "&session=" + tv.session, null, function () {});
    tv = null;
    updateTvUi();
  };
  $("modal").onclick = function (e) {
    if (e.target === $("modal") && !tvConnecting) closeModal();
  };
  setBusy(false);
  // TV: dal QR (?tv=) oppure sessione precedente
  var m = window.location.search.match(/[?&]tv=(\d{6})/);
  try {
    var stored = JSON.parse(window.sessionStorage.getItem("fu_tv") || "null");
    if (stored && (!m || m[1] === stored.code)) tv = stored;
  } catch (e) {}
  updateTvUi();
  if (m && (!tv || tv.code !== m[1])) connectTv(m[1]);
  size();
  loadAssets(render);
  window.addEventListener("resize", render);
}

boot();
