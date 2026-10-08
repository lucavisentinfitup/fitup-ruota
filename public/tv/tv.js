/* FitUP ruota – schermo TV (ES5, generato da scripts/build-legacy.mjs) */
(function(){
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
function luminance(hex) {
    var n = parseInt(hex.slice(1), 16);
    var ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (c) {
        var s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow(((s + 0.055) / 1.055), 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
var autoTextColor = function (bg) { return (luminance(bg) > 0.35 ? "#0D0D0D" : "#FFFFFF"); };
var isLight = function (bg) { return luminance(bg) > 0.6; };
var shouldInvert = function (mode, bg) {
    return mode === "invert" || (mode === "auto" && isLight(bg));
};
var MOTION = {
    VMAX: 1150,
    WINDUP_MS: 260,
    WINDUP_DEG: 11,
    ACCEL_MS: 520,
    MIN_CRUISE_MS: 380,
    EASE_POWER: 3.3,
    MAX_DEFLECT: 26,
    K: 1500,
    DAMP: 24,
    TV_DECEL_DELAY_MS: 1400,
};
function mod(x, m) {
    return ((x % m) + m) % m;
}
function smooth(u) {
    return u * u * (3 - 2 * u);
}
function easeInOut(u) {
    return 0.5 - Math.cos(Math.PI * u) / 2;
}
function planDecel(theta, v, dir, index, jitter, count, decelSeconds) {
    var a = 360 / Math.max(2, count);
    var speed = Math.abs(v) || MOTION.VMAX;
    var tgt = index === null ? Math.random() * 360 : mod(-index * a + jitter * a * 0.33, 360);
    var S0 = (speed * decelSeconds) / MOTION.EASE_POWER;
    var S = dir > 0 ? S0 + mod(tgt - (theta + S0), 360) : -(S0 + mod(theta - S0 - tgt, 360));
    return { start: theta, S: S, D: (MOTION.EASE_POWER * Math.abs(S)) / speed };
}
function decelAt(p, t) {
    var u = Math.min(1, Math.max(0, t / p.D));
    var P = MOTION.EASE_POWER;
    return {
        theta: p.start + p.S * (1 - Math.pow(1 - u, P)),
        v: (p.S * P * Math.pow(1 - u, P - 1)) / p.D,
        done: u >= 1,
    };
}
function stepPointer(p, theta, v, dir, count, dt) {
    var a = 360 / Math.max(2, count);
    var c = Math.min(a * 0.42, 10);
    var x = mod(theta + a / 2, a);
    var moving = Math.abs(v) > 1 ? (v > 0 ? 1 : -1) : dir;
    var geom = 0;
    if (moving > 0 && a - x < c)
        geom = -MOTION.MAX_DEFLECT * (1 - (a - x) / c);
    if (moving < 0 && x < c)
        geom = MOTION.MAX_DEFLECT * (1 - x / c);
    for (var i = 0; i < 2; i++) {
        var h = dt / 2;
        p.ptrV += (-MOTION.K * p.ptr - MOTION.DAMP * p.ptrV) * h;
        p.ptr += p.ptrV * h;
    }
    if (geom < 0 && p.ptr > geom) {
        p.ptr = geom;
        p.ptrV = Math.min(0, p.ptrV);
    }
    if (geom > 0 && p.ptr < geom) {
        p.ptr = geom;
        p.ptrV = Math.max(0, p.ptrV);
    }
}
function pegIndex(theta, count) {
    var a = 360 / Math.max(2, count);
    return Math.floor((theta + a / 2) / a);
}
function blurFor(v) {
    return Math.max(0, Math.min(0.9, (Math.abs(v) - 240) / 750));
}
var GEO = {
    rim: 0.965,
    pegs: 0.928,
    hub: 0.26,
    contentOuter: 0.895,
    contentInnerPad: 1.08,
};
function fitBox(aspect, half, rMin, rMax) {
    var t = Math.tan(Math.min(half, 0.9)) * 0.9;
    var best = { r0: rMin, len: 0, h: 0 };
    for (var i = 0; i <= 60; i++) {
        var r0 = rMin + ((rMax - rMin) * i) / 60;
        var h = Math.min(2 * t * r0, (rMax - r0) / aspect, rMax * 0.42);
        if (h > best.h)
            best = { r0: r0, len: h * aspect, h: h };
    }
    var slack = rMax - best.r0 - best.len;
    return __assign(__assign({}, best), { r0: best.r0 + slack * 0.5 });
}
function layoutText(ctx, label, fam, half, rMin, rMax) {
    ctx.font = "600 100px ".concat(fam);
    var capH = (ctx.measureText("H").actualBoundingBoxAscent || 72) / 100;
    var gap = 0.3;
    var text = label.toUpperCase().trim();
    var candidates = [];
    if (text.indexOf("\n") >= 0)
        candidates.push(text.split("\n").map(function (l) { return l.trim(); }).filter(Boolean));
    else {
        var words = text.split(/\s+/).filter(Boolean);
        var n = words.length;
        candidates.push([words.join(" ")]);
        for (var a = 1; a < n; a++) {
            candidates.push([words.slice(0, a).join(" "), words.slice(a).join(" ")]);
            for (var b = a + 1; b < n; b++)
                candidates.push([words.slice(0, a).join(" "), words.slice(a, b).join(" "), words.slice(b).join(" ")]);
        }
    }
    var best = { lines: [text], em: 10, r0: rMin, len: 0, score: -1 };
    for (var _i = 0, candidates_1 = candidates; _i < candidates_1.length; _i++) {
        var lines = candidates_1[_i];
        var w = Math.max.apply(Math, lines.map(function (l) { return ctx.measureText(l).width; })) / 100;
        var hEm = lines.length * capH + (lines.length - 1) * gap;
        var box = fitBox(w / hEm, half, rMin, rMax);
        var em = Math.min(box.h / hEm, rMax * 0.13);
        var score = em * (1 - 0.06 * (lines.length - 1));
        if (score > best.score)
            best = { lines: lines, em: em, r0: box.r0 + (box.len - w * em) / 2, len: w * em, score: score };
    }
    return best;
}
function invertedImage(img, w, h) {
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    var x = c.getContext("2d");
    x.drawImage(img, 0, 0, c.width, c.height);
    x.globalCompositeOperation = "difference";
    if (x.globalCompositeOperation !== "difference")
        return null;
    x.fillStyle = "#fff";
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = "destination-in";
    x.drawImage(img, 0, 0, c.width, c.height);
    return c;
}
function drawWheel(canvas, segments, images, fam) {
    var size = canvas.width;
    var ctx = canvas.getContext("2d");
    var R = size / 2;
    var n = segments.length;
    var a = (Math.PI * 2) / n;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(R, R);
    var rs = R * GEO.rim;
    segments.forEach(function (s, i) {
        var c = -Math.PI / 2 + i * a;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, rs + 1, c - a / 2, c + a / 2);
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.fill();
    });
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = Math.max(1, R * 0.004);
    segments.forEach(function (s, i) {
        var next = segments[(i + 1) % n];
        if (next.color.toLowerCase() !== s.color.toLowerCase())
            return;
        var b = -Math.PI / 2 + i * a + a / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(b) * R * GEO.hub, Math.sin(b) * R * GEO.hub);
        ctx.lineTo(Math.cos(b) * rs, Math.sin(b) * rs);
        ctx.stroke();
    });
    var rMin = R * GEO.hub * GEO.contentInnerPad;
    var rMax = R * GEO.contentOuter;
    segments.forEach(function (s, i) {
        ctx.save();
        ctx.rotate(-Math.PI / 2 + i * a);
        var img = s.display === "image" && s.image ? images.get(s.image) : undefined;
        if (img) {
            var box = fitBox(img.naturalWidth / img.naturalHeight, a / 2, rMin, rMax);
            var invert = shouldInvert(s.imageMode, s.color);
            var src = (invert && invertedImage(img, box.len, box.h)) || img;
            ctx.drawImage(src, box.r0, -box.h / 2, box.len, box.h);
        }
        else {
            var t = layoutText(ctx, s.label, fam, a / 2, rMin, rMax);
            ctx.font = "600 ".concat(t.em, "px ").concat(fam);
            ctx.fillStyle = s.textColor || autoTextColor(s.color);
            ctx.textBaseline = "alphabetic";
            ctx.textAlign = "center";
            var capH_1 = ctx.measureText("H").actualBoundingBoxAscent || t.em * 0.72;
            var gap_1 = t.em * 0.3;
            var total_1 = t.lines.length * capH_1 + (t.lines.length - 1) * gap_1;
            var cx_1 = t.r0 + t.len / 2;
            t.lines.forEach(function (line, li) {
                ctx.fillText(line, cx_1, -total_1 / 2 + capH_1 + li * (capH_1 + gap_1));
            });
        }
        ctx.restore();
    });
    var inner = ctx.createRadialGradient(0, 0, rs * 0.82, 0, 0, rs);
    inner.addColorStop(0, "rgba(0,0,0,0)");
    inner.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(0, 0, rs, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, R - 1, 0, Math.PI * 2);
    ctx.arc(0, 0, rs, 0, Math.PI * 2, true);
    ctx.fillStyle = "#0d0d0d";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, rs, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = Math.max(1, R * 0.006);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, R - R * 0.012, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(148,196,36,0.9)";
    ctx.lineWidth = Math.max(1, R * 0.008);
    ctx.stroke();
    var pr = R * 0.019;
    for (var i = 0; i < n; i++) {
        var b = -Math.PI / 2 + i * a + a / 2;
        var x = Math.cos(b) * R * GEO.pegs;
        var y = Math.sin(b) * R * GEO.pegs;
        ctx.beginPath();
        ctx.arc(x + pr * 0.25, y + pr * 0.35, pr, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fill();
        var g = ctx.createRadialGradient(x - pr * 0.35, y - pr * 0.35, pr * 0.1, x, y, pr);
        g.addColorStop(0, "#ffffff");
        g.addColorStop(0.55, "#cfd3d6");
        g.addColorStop(1, "#7d8287");
        ctx.beginPath();
        ctx.arc(x, y, pr, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
    }
    ctx.restore();
}
function drawBlur(target, source, spreadDeg, steps) {
    if (spreadDeg === void 0) { spreadDeg = 9; }
    if (steps === void 0) { steps = 14; }
    var ctx = target.getContext("2d");
    var s = target.width;
    ctx.clearRect(0, 0, s, s);
    for (var i = 0; i < steps; i++) {
        var off = ((i / (steps - 1)) * 2 - 1) * ((spreadDeg * Math.PI) / 180);
        ctx.save();
        ctx.globalAlpha = 1 / (i + 1);
        ctx.translate(s / 2, s / 2);
        ctx.rotate(off);
        ctx.drawImage(source, -s / 2, -s / 2, s, s);
        ctx.restore();
    }
}
var raf = window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    function (cb) {
        return window.setTimeout(function () {
            cb(now());
        }, 16);
    };
function now() {
    return window.performance && performance.now ? performance.now() : Date.now();
}
function $(id) {
    return document.getElementById(id);
}
function setTransform(el, v) {
    el.style.transform = v;
    el.style.webkitTransform = v;
}
function show(id, on) {
    var el = $(id);
    if (on)
        el.className = el.className.replace(/\s*hidden/g, "");
    else if (el.className.indexOf("hidden") < 0)
        el.className += " hidden";
}
function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
        return ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&quot;";
    });
}
function xhr(method, url, body, cb, asJson) {
    var r = new XMLHttpRequest();
    r.open(method, url, true);
    r.timeout = 10000;
    if (body !== null)
        r.setRequestHeader("Content-Type", asJson ? "application/json" : "text/plain;charset=UTF-8");
    r.onreadystatechange = function () {
        if (r.readyState !== 4)
            return;
        var data = null;
        try {
            data = JSON.parse(r.responseText);
        }
        catch (e) { }
        if (r.status >= 200 && r.status < 300)
            cb(null, data, r.status);
        else
            cb("HTTP " + r.status, data, r.status);
    };
    r.ontimeout = function () {
        cb("timeout");
    };
    r.send(body === null ? null : JSON.stringify(body));
}
function confettiOn(c, W, H) {
    var ctx = c.getContext("2d");
    if (!ctx)
        return;
    var g = ctx;
    c.width = W;
    c.height = H;
    var colors = ["#94C424", "#FFFFFF", "#a9d93a", "#cfe88a"];
    var k = W / 1920;
    var parts = [];
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
        if (life < 4.3)
            raf(step);
        else
            g.clearRect(0, 0, W, H);
    };
    raf(step);
}
var actx = null;
function audioUnlock() {
    var AC = window.AudioContext ||
        window.webkitAudioContext;
    if (!AC)
        return;
    try {
        if (!actx)
            actx = new AC();
        if (actx.state === "suspended")
            actx.resume();
    }
    catch (e) { }
}
function beep(freq, dur, vol, type, delay) {
    if (!actx || actx.state !== "running")
        return;
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
    }
    catch (e) { }
}
function tickSound(i) {
    beep(1500 + Math.random() * 300, 0.03, 0.15 * i, "triangle", 0);
}
function winSound() {
    var f = [523.25, 659.25, 783.99, 1046.5];
    for (var i = 0; i < f.length; i++)
        beep(f[i], 0.35, 0.2, "triangle", i * 0.09);
}
var api = "/api/tv/" + TV_CODE;
var cfg = null;
var clockOffset = 0;
var lastSeq = -1;
var session = null;
var count = 15;
var bootFps = null;
var frames = 0;
var framesFrom = now();
var fpsAvg = null;
var W = {
    theta: 0,
    v: 0,
    phase: "boot",
    t0: 0,
    vFrom: 0,
    spin: null,
    decelLocal: 0,
    plan: null,
    pointer: { ptr: 0, ptrV: 0 },
    lastK: 0,
    last: 0,
    resultUntil: 0,
    waiting: false,
};
function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    var stage = $("stage");
    setTransform(stage, "scale(" + s + ")");
    stage.style.left = Math.round((window.innerWidth - 1920 * s) / 2) + "px";
    stage.style.top = Math.round((window.innerHeight - 1080 * s) / 2) + "px";
    return s;
}
var images = {};
function renderWheel() {
    if (!cfg)
        return;
    var s = fit();
    var dpr = window.devicePixelRatio || 1;
    var px = Math.min(1400, Math.round(940 * s * dpr));
    var sharp = $("sharp");
    var blur = $("blur");
    sharp.width = sharp.height = px;
    blur.width = blur.height = px;
    drawWheel(sharp, cfg.wheel.segments, { get: function (k) { return images[k]; } }, "Oswald, 'Arial Narrow', sans-serif");
    var small = document.createElement("canvas");
    small.width = small.height = Math.round(px / 2);
    drawBlur(small, sharp);
    var b = blur.getContext("2d");
    b.clearRect(0, 0, px, px);
    b.drawImage(small, 0, 0, px, px);
}
function loadWheelAssets(cb) {
    if (!cfg)
        return cb();
    var pending = 0;
    var done = false;
    var finish = function () {
        if (done)
            return;
        done = true;
        cb();
    };
    var segs = cfg.wheel.segments;
    for (var i = 0; i < segs.length; i++) {
        var src = segs[i].image;
        if (segs[i].display !== "image" || !src || images[src])
            continue;
        pending++;
        (function (url) {
            var img = new Image();
            img.onload = function () {
                images[url] = img;
                if (--pending === 0)
                    finish();
            };
            img.onerror = function () {
                if (--pending === 0)
                    finish();
            };
            img.src = url;
        })(src);
    }
    var fonts = document.fonts;
    var fontWait = 0;
    if (fonts && fonts.ready && fonts.ready.then) {
        fontWait++;
        fonts.ready.then(function () {
            if (--fontWait === 0 && pending === 0)
                finish();
        });
    }
    if (pending === 0 && fontWait === 0)
        finish();
    window.setTimeout(finish, 4000);
}
function applyConfig(c) {
    cfg = c;
    count = c.wheel.segments.length;
    $("title").innerHTML = escapeHtml(c.wheel.settings.title || "Gira la ruota");
    $("tvname").innerHTML = escapeHtml(c.tv.name);
    $("event").innerHTML = escapeHtml(c.eventText || "");
    $("qr").src = api + "/qr?v=" + encodeURIComponent(c.wheelVersion);
    $("code").innerHTML = c.tv.code.slice(0, 3) + " " + c.tv.code.slice(3);
}
function syncClock(cb) {
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
            if (++n < 3)
                one();
            else if (cb)
                cb();
        });
    };
    one();
}
var PAIRED_IDLE_MS = 60000;
var currentPanel = "idle";
var freshPair = false;
var pairedShownAt = 0;
function panel(name) {
    if (name === "paired" && currentPanel !== "paired")
        pairedShownAt = Date.now();
    currentPanel = name;
    show("panel-idle", name === "idle" || name === "paired");
    show("paired-note", name === "paired");
    show("panel-paired", false);
    show("panel-spin", name === "spin");
    show("panel-result", name === "result");
}
function playerLabel(n) {
    return n ? escapeHtml(n) : "te!";
}
function handle(rec) {
    if (rec.seq <= lastSeq)
        return;
    lastSeq = rec.seq;
    var ev = rec.event;
    if (ev.type === "reload")
        return window.location.reload();
    if (ev.type === "paired") {
        session = { id: ev.sessionId, playerName: ev.playerName, lastActive: Date.now() };
        freshPair = true;
        xhr("POST", api + "/ack", { sessionId: ev.sessionId }, function () { });
        $("player").innerHTML = playerLabel(ev.playerName);
        $("player-note").innerHTML = ev.playerName ? escapeHtml(ev.playerName) : "un giocatore";
        if (W.phase !== "result" && W.phase !== "accel" && W.phase !== "cruise" && W.phase !== "decel")
            panel("paired");
        return;
    }
    if (ev.type === "unpaired") {
        if (session && session.id === ev.sessionId)
            session = null;
        if (W.phase === "idle")
            panel("idle");
        return;
    }
    if (ev.type === "spin") {
        if (!session || session.id !== ev.sessionId)
            return;
        session.lastActive = Date.now();
        var spinEv = ev;
        if (!cfg || cfg.wheelVersion !== ev.wheelVersion || segmentIndex(ev) < 0) {
            startSpin(ev, true);
            reloadConfig(function () {
                if (W.spin === spinEv)
                    W.spin = withIndex(spinEv);
            }, true);
        }
        else
            startSpin(withIndex(ev));
    }
}
function segmentIndex(ev) {
    if (!cfg)
        return -1;
    var segs = cfg.wheel.segments;
    for (var i = 0; i < segs.length; i++)
        if (segs[i].id === ev.segmentId)
            return i;
    return -1;
}
function withIndex(ev) {
    var i = segmentIndex(ev);
    if (i < 0 || i === ev.index)
        return ev;
    var copy = JSON.parse(JSON.stringify(ev));
    copy.index = i;
    return copy;
}
function startSpin(ev, waitingConfig) {
    W.waiting = !!waitingConfig;
    freshPair = false;
    W.spin = ev;
    W.decelLocal = ev.decelAt - clockOffset;
    W.phase = "accel";
    W.vFrom = W.v;
    W.t0 = now();
    $("player2").innerHTML = playerLabel(ev.playerName);
    panel("spin");
    unlockAudio();
}
function showResult(ev) {
    var seg = cfg ? cfg.wheel.segments[ev.index] : null;
    var titles = cfg ? cfg.wheel.settings : null;
    $("rkicker").innerHTML = escapeHtml(ev.kind === "premio" ? (titles ? titles.winTitle : "Hai vinto!") : ev.kind === "penitenza" ? (titles ? titles.penaltyTitle : "Penitenza!") : "Risultato");
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
            img.style.webkitFilter = "invert(1)";
        }
        prize.appendChild(img);
    }
    else {
        var span = document.createElement("span");
        span.style.color = (seg && seg.textColor) || autoTextColor(seg ? seg.color : "#94C424");
        span.appendChild(document.createTextNode(ev.label));
        prize.appendChild(span);
    }
    $("panel-result").className = "panel result-" + ev.kind;
    panel("result");
    if (ev.kind === "premio") {
        confettiOn($("confetti"), 1920, 1080);
        winSound();
    }
    W.resultUntil = Date.now() + 9000;
}
var pollTimer = 0;
function poll() {
    window.clearTimeout(pollTimer);
    xhr("GET", api + "/state?since=" + Math.max(0, lastSeq) + "&_=" + Date.now(), null, function (err, d) {
        if (!err && d) {
            if (lastSeq < 0) {
                lastSeq = d.seq;
                if (d.session) {
                    session = { id: d.session.id, playerName: d.session.playerName, lastActive: Date.now() };
                    freshPair = true;
                    xhr("POST", api + "/ack", { sessionId: d.session.id }, function () { });
                    $("player").innerHTML = playerLabel(d.session.playerName);
                    $("player-note").innerHTML = d.session.playerName ? escapeHtml(d.session.playerName) : "un giocatore";
                    if (W.phase === "idle")
                        panel("paired");
                }
            }
            else
                for (var i = 0; i < d.events.length; i++)
                    handle(d.events[i]);
        }
        var fast = cfg && cfg.realtime === "poll" && session;
        var interval = cfg && cfg.realtime === "ably" && sse ? 15000 : fast ? 400 : 2000;
        pollTimer = window.setTimeout(poll, interval);
    });
}
var sse = null;
var sseFails = 0;
function connectRealtime() {
    var ES = window.EventSource;
    if (!cfg || cfg.realtime !== "ably" || !ES || sseFails >= 3)
        return;
    xhr("GET", api + "/token?_=" + Date.now(), null, function (err, t) {
        if (err || !t || !t.token) {
            sseFails++;
            return window.setTimeout(connectRealtime, 5000);
        }
        var url = "https://realtime.ably.io/sse?v=1.2&channels=" + encodeURIComponent("tv:" + TV_CODE) + "&accessToken=" + encodeURIComponent(t.token);
        var es = new ES(url);
        sse = es;
        es.onmessage = function (m) {
            sseFails = 0;
            try {
                var msg = JSON.parse(m.data);
                handle(JSON.parse(msg.data));
            }
            catch (e) { }
        };
        es.onerror = function () {
            es.close();
            if (sse === es)
                sse = null;
            sseFails++;
            window.setTimeout(connectRealtime, 3000);
        };
    });
}
function hello() {
    var screen = window.innerWidth + "x" + window.innerHeight + "@" + (window.devicePixelRatio || 1);
    xhr("POST", api + "/hello", { bootFps: bootFps, fps: fpsAvg, screen: screen }, function (err, d) {
        if (!err && d && cfg && d.wheelVersion && d.wheelVersion !== cfg.wheelVersion && W.phase === "idle")
            reloadConfig();
    });
}
function reloadConfig(cb, fresh) {
    xhr("GET", api + "/config?_=" + Date.now() + (fresh ? "&fresh=1" : ""), null, function (err, c) {
        if (err || !c) {
            if (err === "HTTP 404")
                fatal("Schermo non registrato (codice " + TV_CODE + "). Controlla il link nel backend.");
            return window.setTimeout(function () {
                reloadConfig(cb, fresh);
            }, fresh ? 600 : 5000);
        }
        applyConfig(c);
        loadWheelAssets(function () {
            renderWheel();
            W.waiting = false;
            if (cb)
                cb();
        });
    });
}
function fatal(msg) {
    $("err").innerHTML = escapeHtml(msg);
    show("err", true);
}
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
                if (bootFps < 24)
                    fatal("Questo televisore non è abbastanza fluido per la ruota (" + bootFps + " fps). Nuovo test tra un minuto.");
                else
                    show("err", false);
            }
            break;
        }
        case "idle":
            W.v += (8 - W.v) * Math.min(1, dt * 2);
            W.theta += W.v * dt;
            if (bootFps !== null && bootFps < 24 && !session && t - lastTest > 60000) {
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
            if (ua >= 1)
                W.phase = "cruise";
            if (Date.now() >= W.decelLocal)
                beginDecel();
            break;
        }
        case "cruise":
            W.theta += W.v * dt;
            if (Date.now() >= W.decelLocal)
                beginDecel();
            break;
        case "decel": {
            var d = decelAt(W.plan, (Date.now() - W.decelLocal) / 1000);
            W.theta = d.theta;
            W.v = d.v;
            if (d.done) {
                W.v = 0;
                W.phase = "result";
                showResult(W.spin);
            }
            break;
        }
        case "result":
            if (Date.now() > W.resultUntil) {
                W.phase = "idle";
                panel(session && freshPair ? "paired" : "idle");
            }
            break;
    }
    if (session && Date.now() - session.lastActive > 5 * 60000 && W.phase === "idle") {
        session = null;
        panel("idle");
    }
    if (currentPanel === "paired" && W.phase === "idle" && Date.now() - pairedShownAt > PAIRED_IDLE_MS)
        panel("idle");
    stepPointer(W.pointer, W.theta, W.v, 1, count, dt);
    var k = pegIndex(W.theta, count);
    if (k !== W.lastK) {
        W.lastK = k;
        if (W.phase !== "boot" && W.phase !== "idle")
            tickSound(Math.min(1, 0.35 + Math.abs(W.v) / 1400));
    }
    setTransform($("rotor"), "rotate(" + W.theta + "deg)");
    setTransform($("pointer"), "translateX(-50%) rotate(" + W.pointer.ptr + "deg)");
    $("blur").style.opacity = String(blurFor(W.v));
    raf(frame);
}
function beginDecel() {
    if (W.waiting)
        return;
    var ev = W.spin;
    W.plan = planDecel(W.theta, W.v || MOTION.VMAX, 1, ev.index, ev.jitter, count, ev.decelSeconds);
    W.phase = "decel";
}
function unlockAudio() {
    if (cfg && cfg.wheel.settings.sound)
        audioUnlock();
}
function boot() {
    fit();
    window.addEventListener("resize", function () {
        renderWheel();
    });
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

})();
