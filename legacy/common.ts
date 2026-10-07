// Utilità ES5 condivise dai bundle "legacy" (schermo TV e gioco lite per telefoni vecchi).
// Niente Promise/fetch/Map/Set/Array.from/String.includes: i motori web di destinazione sono datati.

export var raf: (cb: (t: number) => void) => number =
  window.requestAnimationFrame ||
  (window as unknown as { webkitRequestAnimationFrame: typeof requestAnimationFrame }).webkitRequestAnimationFrame ||
  function (cb: (t: number) => void) {
    return window.setTimeout(function () {
      cb(now());
    }, 16);
  };

export function now(): number {
  return window.performance && performance.now ? performance.now() : Date.now();
}

export function $(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

export function setTransform(el: HTMLElement, v: string) {
  el.style.transform = v;
  (el.style as unknown as Record<string, string>).webkitTransform = v;
}

export function show(id: string, on: boolean) {
  var el = $(id);
  if (on) el.className = el.className.replace(/\s*hidden/g, "");
  else if (el.className.indexOf("hidden") < 0) el.className += " hidden";
}

export function escapeHtml(s: string) {
  return String(s).replace(/[&<>"]/g, function (ch) {
    return ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&quot;";
  });
}

/** XHR con JSON. `asJson` = invia application/json (serve alle API del gioco); altrimenti text/plain senza preflight. */
export function xhr(method: string, url: string, body: unknown, cb: (err: string | null, data?: any, status?: number) => void, asJson?: boolean) {
  var r = new XMLHttpRequest();
  r.open(method, url, true);
  r.timeout = 10000;
  if (body !== null) r.setRequestHeader("Content-Type", asJson ? "application/json" : "text/plain;charset=UTF-8");
  r.onreadystatechange = function () {
    if (r.readyState !== 4) return;
    var data: unknown = null;
    try {
      data = JSON.parse(r.responseText);
    } catch (e) {}
    if (r.status >= 200 && r.status < 300) cb(null, data, r.status);
    else cb("HTTP " + r.status, data, r.status);
  };
  r.ontimeout = function () {
    cb("timeout");
  };
  r.send(body === null ? null : JSON.stringify(body));
}

/** Coriandoli su un canvas a tutto schermo. */
export function confettiOn(c: HTMLCanvasElement, W: number, H: number) {
  var ctx = c.getContext("2d");
  if (!ctx) return;
  var g = ctx;
  c.width = W;
  c.height = H;
  var colors = ["#94C424", "#FFFFFF", "#a9d93a", "#cfe88a"];
  var k = W / 1920;
  var parts: { x: number; y: number; vx: number; vy: number; w: number; h: number; r: number; vr: number; f: number; c: string }[] = [];
  for (var i = 0; i < 160; i++) {
    var left = i % 2 === 0;
    var ang = ((left ? -60 : -120) + (Math.random() * 40 - 20)) * (Math.PI / 180);
    var sp = (16 + Math.random() * 16) * Math.max(0.55, k);
    parts.push({ x: left ? 0 : W, y: H * (0.6 + Math.random() * 0.3), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, w: (10 + Math.random() * 10) * Math.max(0.6, k), h: (14 + Math.random() * 14) * Math.max(0.6, k), r: Math.random() * 3, vr: (Math.random() - 0.5) * 0.3, f: Math.random() * 3, c: colors[i % colors.length] });
  }
  var start = now();
  var step = function () {
    var life = (now() - start) / 1000;
    g.clearRect(0, 0, W, H);
    for (var j = 0; j < parts.length; j++) {
      var p = parts[j];
      p.vy += 0.55 * Math.max(0.55, k);
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      p.f += 0.12;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.r);
      g.scale(1, Math.cos(p.f));
      g.globalAlpha = Math.max(0, Math.min(1, 4.2 - life));
      g.fillStyle = p.c;
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      g.restore();
    }
    if (life < 4.3) raf(step);
    else g.clearRect(0, 0, W, H);
  };
  raf(step);
}

/** Audio semplice via WebAudio (dove disponibile). */
var actx: AudioContext | null = null;
export function audioUnlock() {
  var AC =
    (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  try {
    if (!actx) actx = new AC();
    if (actx.state === "suspended") actx.resume();
  } catch (e) {}
}
export function beep(freq: number, dur: number, vol: number, type: OscillatorType, delay: number) {
  if (!actx || actx.state !== "running") return;
  try {
    var t = actx.currentTime + delay;
    var o = actx.createOscillator();
    var g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(actx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch (e) {}
}
export function tickSound(i: number) {
  beep(1500 + Math.random() * 300, 0.03, 0.15 * i, "triangle", 0);
}
export function winSound() {
  var f = [523.25, 659.25, 783.99, 1046.5];
  for (var i = 0; i < f.length; i++) beep(f[i], 0.35, 0.2, "triangle", i * 0.09);
}
