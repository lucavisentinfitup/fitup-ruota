// Suoni sintetizzati con WebAudio: nessun file da scaricare, latenza minima.
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
}

/** Da chiamare dentro un gesto dell'utente (tap/click) per sbloccare l'audio su iOS. */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.03), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  }
  if (ctx.state === "suspended") ctx.resume();
}

/** "Clack" della lancetta sul piolo. intensity 0..1 */
export function tick(intensity = 1) {
  if (muted || !ctx || !noise) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2300 + Math.random() * 500;
  bp.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5 * (0.35 + 0.65 * intensity), t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(t);
  // piccolo corpo "legnoso"
  const o = ctx.createOscillator();
  const og = ctx.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(900, t);
  o.frequency.exponentialRampToValueAtTime(320, t + 0.025);
  og.gain.setValueAtTime(0.12 * intensity, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  o.connect(og).connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.04);
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, vol: number) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(start);
  o.stop(start + dur + 0.05);
}

export function winSound() {
  if (muted || !ctx) return;
  const t = ctx.currentTime + 0.02;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.09, 0.35, "triangle", 0.22));
  tone(1318.5, t + 0.38, 0.6, "sine", 0.16);
}

export function penaltySound() {
  if (muted || !ctx) return;
  const t = ctx.currentTime + 0.02;
  [392, 370, 349, 330].forEach((f, i) => tone(f, t + i * 0.17, i === 3 ? 0.55 : 0.2, "sawtooth", 0.07));
}
