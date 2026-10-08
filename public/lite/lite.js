/* FitUP ruota – gioco lite (ES5, generato da scripts/build-legacy.mjs) */
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
var wheel = LITE.wheel;
var S = wheel.settings;
var count = wheel.segments.length;
var remaining = LITE.remaining;
var muted = false;
try {
    muted = window.localStorage.getItem("fu_muted") === "1";
}
catch (e) { }
var W = {
    theta: 0,
    v: 0,
    phase: "idle",
    t0: 0,
    from: 0,
    plan: null,
    pointer: { ptr: 0, ptrV: 0 },
    lastK: 0,
    last: 0,
    frameTheta: 0,
    result: null,
    error: null,
    running: false,
};
var tv = null;
var tvConnecting = false;
var images = {};
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
    var sharp = $("sharp");
    var blur = $("blur");
    sharp.width = sharp.height = b;
    blur.width = blur.height = b;
    drawWheel(sharp, wheel.segments, { get: function (k) { return images[k]; } }, "Oswald, 'Arial Narrow', sans-serif");
    var small = document.createElement("canvas");
    small.width = small.height = Math.round(b / 2);
    drawBlur(small, sharp);
    var g = blur.getContext("2d");
    g.clearRect(0, 0, b, b);
    g.drawImage(small, 0, 0, b, b);
    $("wheel").className = "wheel is-ready";
}
function loadAssets(cb) {
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
        if (s.display !== "image" || !s.image || images[s.image])
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
        })(s.image);
    }
    var fonts = document.fonts;
    if (fonts && fonts.ready && fonts.ready.then) {
        pending++;
        fonts.ready.then(function () {
            if (--pending === 0)
                finish();
        });
    }
    if (pending === 0)
        finish();
    window.setTimeout(finish, 3000);
}
function spin() {
    if (W.phase !== "idle" || $("modal").className.indexOf("hidden") < 0)
        return;
    if (remaining === 0 || LITE.closed)
        return;
    var nameEl = $("name");
    var name = nameEl ? nameEl.value.replace(/^\s+|\s+$/g, "") : "";
    if (S.askName === "required" && !name && nameEl) {
        nameEl.className = "input is-error";
        nameEl.focus();
        return;
    }
    if (!muted && S.sound)
        audioUnlock();
    W.result = null;
    W.error = null;
    W.from = W.theta;
    W.phase = "windup";
    W.t0 = now();
    setBusy(true);
    var t0 = now();
    var body = { wheelId: wheel.id, wheelVersion: wheel.version, playerName: name || undefined };
    if (tv)
        body.tv = { code: tv.code, session: tv.session };
    xhr("POST", "/api/spin", body, function (err, d) {
        var t1 = now();
        if (err || !d) {
            if (d && typeof d.remaining === "number")
                remaining = d.remaining;
            W.error = (d && d.error) || "Qualcosa è andato storto, riprova.";
            return;
        }
        if (d.wheel) {
            wheel = d.wheel;
            S = wheel.settings;
            count = wheel.segments.length;
            loadAssets(render);
        }
        var index = d.index;
        for (var i = 0; i < wheel.segments.length; i++)
            if (wheel.segments[i].id === d.segmentId)
                index = i;
        if (typeof d.remaining === "number")
            remaining = d.remaining;
        if (tv && !d.tv) {
            tv = null;
            updateTvUi();
        }
        W.result = {
            index: index,
            jitter: typeof d.jitter === "number" ? d.jitter : Math.random() * 2 - 1,
            decelAt: d.tv ? t1 + d.tv.decelInMs - (t1 - t0) / 2 : null,
            code: d.code,
            kind: d.kind,
            label: d.label,
        };
    }, true);
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
            var d = decelAt(W.plan, (t - W.t0) / 1000);
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
                if (W.result)
                    showResult();
                else
                    showError(W.error || "Errore");
            }
            break;
    }
    W.frameTheta = W.theta;
    stepPointer(W.pointer, W.theta, W.v, 1, count, dt);
    var k = pegIndex(W.theta, count);
    if (k !== W.lastK) {
        W.lastK = k;
        if (!muted && S.sound)
            tickSound(Math.min(1, 0.35 + Math.abs(W.v) / 1400));
        if (Math.abs(W.v) < 500 && navigator.vibrate)
            navigator.vibrate(4);
    }
    setTransform($("rotor"), "rotate(" + W.theta + "deg)");
    setTransform($("pointer"), "translateX(-50%) rotate(" + W.pointer.ptr + "deg)");
    $("blur").style.opacity = String(blurFor(W.v));
    var resting = W.phase === "idle" && Math.abs(W.pointer.ptr) < 0.05 && Math.abs(W.pointer.ptrV) < 0.05;
    if (resting)
        W.running = false;
    else
        raf(frame);
}
function setBusy(b) {
    var btn = $("spin");
    btn.disabled = b || remaining === 0 || !!LITE.closed;
    btn.innerHTML = LITE.closed ? "Non ancora disponibile" : remaining === 0 ? "Giocate finite per oggi" : b ? "Gira…" : "Gira la ruota";
    var tvb = $("tvbtn");
    tvb.disabled = b;
    var hint = $("hint");
    hint.innerHTML = typeof remaining === "number" && remaining > 0 ? "Giocate rimaste oggi: " + remaining : "Tocca la ruota per farla girare";
}
function modal(html, cls) {
    $("modalbox").className = "modal " + cls;
    $("modalbox").innerHTML = html;
    show("modal", true);
}
function closeModal() {
    show("modal", false);
}
function showResult() {
    var r = W.result;
    if (tv) {
        var linked = tv;
        window.setTimeout(function () {
            if (tv && tv.session === linked.session) {
                xhr("DELETE", "/api/tv/pair?code=" + tv.code + "&session=" + tv.session, null, function () { });
                tv = null;
                updateTvUi();
            }
        }, 5000);
    }
    var seg = wheel.segments[r.index];
    var title = r.kind === "premio" ? S.winTitle : r.kind === "penitenza" ? S.penaltyTitle : S.neutralTitle;
    modal('<p class="kicker">' + escapeHtml(title) + '</p><div class="prize" id="mprize"></div><h2 class="label">' + escapeHtml(r.label) + "</h2>" +
        (r.kind === "penitenza" ? '<p class="sub">Niente scuse: falla subito!</p>' : "") +
        '<div class="code"><span>Codice giocata</span><strong>' + escapeHtml(r.code) + "</strong></div>" +
        (r.kind === "premio" && S.footer ? '<p class="sub">' + escapeHtml(S.footer) + "</p>" : "") +
        '<button class="btn" id="mclose">' + (remaining === 0 ? "Chiudi" : "Ok") + "</button>", "result-" + r.kind);
    var box = $("mprize");
    box.style.background = seg.color;
    if (seg.display === "image" && seg.image) {
        var img = document.createElement("img");
        img.src = seg.image;
        if (shouldInvert(seg.imageMode, seg.color)) {
            img.style.filter = "invert(1)";
            img.style.webkitFilter = "invert(1)";
        }
        box.appendChild(img);
    }
    else {
        var span = document.createElement("span");
        span.style.color = seg.textColor || autoTextColor(seg.color);
        span.appendChild(document.createTextNode(seg.label));
        box.appendChild(span);
    }
    $("mclose").onclick = closeModal;
    if (r.kind === "premio") {
        confettiOn($("confetti"), window.innerWidth, window.innerHeight);
        if (!muted && S.sound)
            winSound();
        if (navigator.vibrate)
            navigator.vibrate([30, 40, 60]);
    }
    else if (r.kind === "penitenza") {
        if (!muted && S.sound)
            for (var i = 0; i < 4; i++)
                beep([392, 370, 349, 330][i], 0.25, 0.07, "sawtooth", i * 0.17);
        if (navigator.vibrate)
            navigator.vibrate([120, 60, 120]);
    }
}
function showError(msg) {
    modal('<p class="kicker">Ops!</p><h2 class="label">' + escapeHtml(msg) + '</h2><button class="btn" id="mclose">Ok</button>', "result-error");
    $("mclose").onclick = closeModal;
    setBusy(false);
}
function saveTv() {
    try {
        if (tv)
            window.sessionStorage.setItem("fu_tv", JSON.stringify(tv));
        else
            window.sessionStorage.removeItem("fu_tv");
    }
    catch (e) { }
}
function updateTvUi() {
    show("tvchip", !!tv);
    show("tvbtn", !tv && remaining !== 0 && !LITE.closed);
    if (tv)
        $("tvname").innerHTML = escapeHtml(tv.tvName);
    saveTv();
}
function openTvSheet() {
    modal('<p class="kicker">Guarda il tuo giro sulla TV</p><p class="sub">Inquadra il QR sulla TV del club con la fotocamera del telefono, oppure inserisci il codice di 6 cifre che vedi sullo schermo.</p>' +
        '<input class="input code-input" id="tvcode" type="tel" maxlength="7" placeholder="000 000">' +
        '<p class="err hidden" id="tverr"></p><button class="btn" id="tvgo">Collega</button><button class="btn btn-ghost" id="mclose">Gioca solo sul telefono</button>', "sheet");
    $("mclose").onclick = closeModal;
    $("tvgo").onclick = function () {
        connectTv($("tvcode").value);
    };
}
function tvFailed(reason) {
    tvConnecting = false;
    if (reason === "not_found" || reason === "busy") {
        if ($("tverr")) {
            $("tverr").innerHTML = reason === "busy" ? "La TV è occupata da un altro giocatore: riprova tra qualche secondo, oppure gira qui." : "Codice non trovato: controlla le 6 cifre sulla TV.";
            show("tverr", true);
            return;
        }
    }
    modal('<p class="kicker kicker-muted">TV non disponibile</p><p class="sub big">Ci dispiace, con il televisore individuato non ci è possibile collegarci per sdoppiare lo schermo. Fai qui il tuo giro di Ruota.</p><button class="btn" id="mclose">Gira qui</button>', "sheet");
    $("mclose").onclick = function () {
        closeModal();
        nudge();
    };
}
function nudge() {
    var b = $("spin");
    b.className = "btn btn-spin";
    void b.offsetWidth;
    b.className = "btn btn-spin btn-nudge";
}
function connectTv(raw) {
    var code = String(raw || "").replace(/\D/g, "");
    if (tvConnecting)
        return;
    if (code.length !== 6)
        return tvFailed("not_found");
    tvConnecting = true;
    modal('<p class="kicker">Mi collego alla TV…</p><div class="spinner"></div><p class="sub">Tra un attimo vedrai la ruota anche sul televisore.</p>', "sheet");
    var nameEl = $("name");
    xhr("POST", "/api/tv/pair", { code: code, playerName: nameEl ? nameEl.value : undefined }, function (err, d) {
        if (!d || !d.ok)
            return tvFailed(d && d.reason ? d.reason : "unreachable");
        if (d.wheelId && d.wheelId !== wheel.id && d.wheelSlug)
            return window.location.replace("/lite/" + d.wheelSlug + "?tv=" + code);
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
                    xhr("DELETE", "/api/tv/pair?code=" + code + "&session=" + d.sessionId, null, function () { });
                    return tvFailed("unreachable");
                }
                window.setTimeout(check, 450);
            });
        };
        window.setTimeout(check, 450);
    }, true);
}
function boot() {
    $("title").innerHTML = escapeHtml(S.title);
    $("subtitle").innerHTML = escapeHtml(S.subtitle);
    $("event").innerHTML = escapeHtml(LITE.eventText || "");
    if (LITE.closed || LITE.test) {
        $("banner").innerHTML = escapeHtml(LITE.closed || "Modalità prova staff: oggi la ruota non è aperta al pubblico, le giocate non vengono registrate.");
        $("banner").className = "banner" + (LITE.test ? " banner-test" : "");
    }
    var nameEl = $("name");
    if (S.askName === "off")
        nameEl.parentNode.removeChild(nameEl);
    else {
        nameEl.placeholder = S.askName === "required" ? S.namePlaceholder.replace(/\s*\(facoltativo\)/i, "") : S.namePlaceholder;
        nameEl.oninput = function () {
            nameEl.className = "input";
        };
    }
    if (!S.sound)
        show("mute", false);
    $("mute").innerHTML = muted ? "🔇" : "🔊";
    $("mute").onclick = function () {
        muted = !muted;
        $("mute").innerHTML = muted ? "🔇" : "🔊";
        try {
            window.localStorage.setItem("fu_muted", muted ? "1" : "0");
        }
        catch (e) { }
    };
    $("spin").onclick = spin;
    $("wheel").onclick = spin;
    $("tvbtn").onclick = openTvSheet;
    $("tvoff").onclick = function () {
        if (tv)
            xhr("DELETE", "/api/tv/pair?code=" + tv.code + "&session=" + tv.session, null, function () { });
        tv = null;
        updateTvUi();
    };
    $("modal").onclick = function (e) {
        if (e.target === $("modal") && !tvConnecting)
            closeModal();
    };
    setBusy(false);
    var m = window.location.search.match(/[?&]tv=(\d{6})/);
    try {
        var stored = JSON.parse(window.sessionStorage.getItem("fu_tv") || "null");
        if (stored && (!m || m[1] === stored.code))
            tv = stored;
    }
    catch (e) { }
    updateTvUi();
    if (m && (!tv || tv.code !== m[1]))
        connectTv(m[1]);
    size();
    loadAssets(render);
    window.addEventListener("resize", render);
}
boot();

})();
