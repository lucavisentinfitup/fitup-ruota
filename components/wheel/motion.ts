// Fisica del giro, condivisa tra telefono (React) e schermo TV (bundle ES5).
// Niente import e niente API moderne: questo file viene compilato anche per i TV VIDAA del 2019.

export var MOTION = {
  VMAX: 1150, // gradi/s a regime (~3 giri al secondo)
  WINDUP_MS: 260,
  WINDUP_DEG: 11,
  ACCEL_MS: 520,
  MIN_CRUISE_MS: 380,
  EASE_POWER: 3.3, // più alto = coda finale più lunga e "suspense"
  MAX_DEFLECT: 26, // gradi della lancetta
  K: 1500, // molla della lancetta
  DAMP: 24,
  /** Con la TV collegata la frenata parte a un istante fissato dal server, uguale per tutti e due gli schermi */
  TV_DECEL_DELAY_MS: 1400,
};

export function mod(x: number, m: number) {
  return ((x % m) + m) % m;
}
export function smooth(u: number) {
  return u * u * (3 - 2 * u);
}
export function easeInOut(u: number) {
  return 0.5 - Math.cos(Math.PI * u) / 2;
}

export interface DecelPlan {
  start: number;
  S: number;
  /** durata in secondi */
  D: number;
}

/**
 * Pianifica la frenata in modo da fermarsi sullo spicchio `index`.
 * `jitter` in [-1, 1] sposta il punto d'arrivo dentro lo spicchio (deciso dal server per sincronizzare la TV).
 * La durata è scelta perché la velocità sia continua al passaggio crociera → frenata.
 */
export function planDecel(theta: number, v: number, dir: number, index: number | null, jitter: number, count: number, decelSeconds: number): DecelPlan {
  var a = 360 / Math.max(2, count);
  var speed = Math.abs(v) || MOTION.VMAX;
  var tgt = index === null ? Math.random() * 360 : mod(-index * a + jitter * a * 0.33, 360);
  var S0 = (speed * decelSeconds) / MOTION.EASE_POWER;
  var S = dir > 0 ? S0 + mod(tgt - (theta + S0), 360) : -(S0 + mod(theta - S0 - tgt, 360));
  return { start: theta, S: S, D: (MOTION.EASE_POWER * Math.abs(S)) / speed };
}

/** Posizione e velocità a `t` secondi dall'inizio della frenata. */
export function decelAt(p: DecelPlan, t: number) {
  var u = Math.min(1, Math.max(0, t / p.D));
  var P = MOTION.EASE_POWER;
  return {
    theta: p.start + p.S * (1 - Math.pow(1 - u, P)),
    v: (p.S * P * Math.pow(1 - u, P - 1)) / p.D,
    done: u >= 1,
  };
}

export interface PointerState {
  ptr: number;
  ptrV: number;
}

/** Lancetta: spinta geometrica dai pioli + molla smorzata. */
export function stepPointer(p: PointerState, theta: number, v: number, dir: number, count: number, dt: number) {
  var a = 360 / Math.max(2, count);
  var c = Math.min(a * 0.42, 10);
  var x = mod(theta + a / 2, a); // distanza angolare dal piolo appena passato
  var moving = Math.abs(v) > 1 ? (v > 0 ? 1 : -1) : dir;
  var geom = 0;
  if (moving > 0 && a - x < c) geom = -MOTION.MAX_DEFLECT * (1 - (a - x) / c);
  if (moving < 0 && x < c) geom = MOTION.MAX_DEFLECT * (1 - x / c);
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

/** Indice del piolo appena passato sotto la lancetta (cambia → "tic"). */
export function pegIndex(theta: number, count: number) {
  var a = 360 / Math.max(2, count);
  return Math.floor((theta + a / 2) / a);
}

/** Opacità del layer con motion blur in funzione della velocità. */
export function blurFor(v: number) {
  return Math.max(0, Math.min(0.9, (Math.abs(v) - 240) / 750));
}
