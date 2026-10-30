/* ═══════════════════════════════════════════════════════════════════
   YILDIZ PİLOTU — tam ekran uzay pinbalı (Oyun Köşesi'nin 8. oyunu)
   Bağımsız modül: kendi tuvali, ses motoru, müziği ve tuş dinleyicileri var.
     window.YildizPilotu.open({ onClose, muted })  ·  window.YildizPilotu.isOpen()
   Fizik masanın üstten görünümünde (W x H birim) çalışır. Her kare önce bu düzlemde bir ara
   tuvale çizilir, sonra satır satır yamuğa bükülerek (perspektif) ekrana basılır.
   Görseller ve sesler tamamen burada üretilir; dış dosya yok.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
"use strict";

const W = 360, H = 640, R = 9, S = 1.6; // masa birimleri, top yarıçapı, ara tuval ölçeği
const GRAV = 1000, VMAX = 2300, SUB = 16;
const VW = 1000, VH = 700; // sanal ekran (ekrana sığacak şekilde ölçeklenir)
const TRAP = { y0: 14, y1: 686, cx: 320, wTop: 456, wBot: 608 }; // masanın ekrandaki yamuğu
const HI_KEY = "js-hi-pinbal";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const fmt = (n) => String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const PX = '"Press Start 2P", monospace', BG = 'Bungee, "Press Start 2P", sans-serif';

/* ─────────────────────────── ses motoru ─────────────────────────── */
const Snd = {
  ctx: null, on: true, musOn: true,
  init() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = (this.ctx = new AC());
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(c.destination);
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.85 : 0; this.master.connect(comp);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.mus = c.createGain(); this.mus.gain.value = this.musOn ? 0.32 : 0; this.mus.connect(this.master);
    // yankı: üretilmiş darbe tepkisi
    const len = c.sampleRate * 2.2, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    this.rev = c.createConvolver(); this.rev.buffer = ir;
    const rg = c.createGain(); rg.gain.value = 0.32; this.rev.connect(rg); rg.connect(this.master);
    this.revSend = c.createGain(); this.revSend.gain.value = 1; this.revSend.connect(this.rev);
    this.sfx.connect(this.revSend);
    const ms = c.createGain(); ms.gain.value = 0.5; this.mus.connect(ms); ms.connect(this.rev);
    this.nbuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const nd = this.nbuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  },
  setOn(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? 0.85 : 0, this.ctx.currentTime, 0.03); if (!v && window.speechSynthesis) speechSynthesis.cancel(); },
  setMus(v) { this.musOn = v; if (this.mus) this.mus.gain.setTargetAtTime(v ? 0.32 : 0, this.ctx.currentTime, 0.05); },
  t(at = 0) { return this.ctx.currentTime + at; },
  tone(f, at, dur, o = {}) {
    if (!this.ctx || !this.on) return;
    const c = this.ctx, t = this.t(at), osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || "square"; osc.frequency.setValueAtTime(f, t);
    if (o.detune) osc.detune.value = o.detune;
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + (o.slideT || dur));
    const v = o.vol || 0.08, a = o.attack || 0.004;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = g;
    if (o.lp) { const f2 = c.createBiquadFilter(); f2.type = "lowpass"; f2.frequency.setValueAtTime(o.lp, t); if (o.lpTo) f2.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur); f2.Q.value = o.q || 1; g.connect(f2); out = f2; }
    osc.connect(g); out.connect(o.dest || this.sfx); osc.start(t); osc.stop(t + dur + 0.05);
    if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vib; lg.gain.value = f * 0.03; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05); }
  },
  noise(at, dur, o = {}) {
    if (!this.ctx || !this.on) return;
    const c = this.ctx, t = this.t(at), src = c.createBufferSource(); src.buffer = this.nbuf;
    const f = c.createBiquadFilter(); f.type = o.type || "bandpass"; f.frequency.setValueAtTime(o.freq || 2000, t); f.Q.value = o.q || 1;
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
    const g = c.createGain(), v = o.vol || 0.1;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.002)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || this.sfx); src.start(t, Math.random() * 1.5, dur + 0.05);
  },
  voiceTr: null,
  speak(txt) {
    if (!this.on || !window.speechSynthesis) return;
    try {
      if (!this.voiceTr) this.voiceTr = speechSynthesis.getVoices().find((v) => /^tr/i.test(v.lang)) || false;
      if (this.voiceTr === false) return; // Türkçe ses yoksa sessiz geç
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(txt); u.voice = this.voiceTr; u.lang = "tr-TR"; u.rate = 1.05; u.pitch = 0.7; u.volume = 0.9;
      speechSynthesis.speak(u);
    } catch (e) {}
  },
};
const fx = {
  flipUp() { Snd.noise(0, 0.07, { freq: 900, q: 0.8, vol: 0.22, type: "lowpass" }); Snd.tone(110, 0, 0.08, { vol: 0.12, slide: 55 }); Snd.noise(0, 0.025, { freq: 4000, q: 2, vol: 0.08 }); },
  flipDown() { Snd.noise(0, 0.05, { freq: 700, vol: 0.08, type: "lowpass" }); Snd.tone(80, 0, 0.05, { vol: 0.05, type: "triangle" }); },
  bumper(i) {
    const f = [262, 311, 349][i % 3];
    Snd.tone(f, 0, 0.22, { vol: 0.09, slide: f / 2, lp: 3000, lpTo: 400 }); Snd.tone(f * 1.01, 0, 0.22, { vol: 0.07, type: "sawtooth", slide: f / 2, lp: 2500, lpTo: 300 });
    Snd.tone(f * 4, 0, 0.12, { vol: 0.05, type: "sine" }); Snd.noise(0, 0.06, { freq: 600, vol: 0.2, type: "lowpass" });
  },
  sling() { Snd.noise(0, 0.07, { freq: 2600, q: 2, vol: 0.18 }); Snd.tone(620, 0, 0.08, { vol: 0.06, slide: 260 }); Snd.noise(0, 0.05, { freq: 300, vol: 0.15, type: "lowpass" }); },
  rollover(p = 1) { Snd.tone(1760 * p, 0, 0.18, { vol: 0.07, type: "sine" }); Snd.tone(2637 * p, 0.03, 0.22, { vol: 0.04, type: "sine" }); },
  drop() { Snd.noise(0, 0.1, { freq: 500, vol: 0.25, type: "lowpass" }); Snd.tone(140, 0, 0.12, { vol: 0.1, type: "triangle", slide: 70 }); Snd.noise(0, 0.02, { freq: 5000, q: 3, vol: 0.06 }); },
  standup() { Snd.tone(2400, 0, 0.09, { vol: 0.06, type: "triangle" }); Snd.noise(0, 0.04, { freq: 3500, q: 4, vol: 0.12 }); },
  bank() { [523, 659, 784, 1047, 1319].forEach((f, i) => { Snd.tone(f, i * 0.06, 0.2, { vol: 0.06 }); Snd.tone(f * 2, i * 0.06, 0.12, { vol: 0.02, type: "sine" }); }); },
  rampIn() { Snd.noise(0, 0.7, { freq: 300, sweep: 4000, q: 1.5, vol: 0.14 }); Snd.tone(180, 0, 0.7, { vol: 0.05, type: "sawtooth", slide: 900, lp: 2000 }); },
  rampOut() { Snd.noise(0, 0.1, { freq: 400, vol: 0.2, type: "lowpass" }); Snd.tone(98, 0, 0.15, { vol: 0.08, type: "triangle" }); },
  orbit() { Snd.noise(0, 0.5, { freq: 3000, sweep: 400, q: 1.2, vol: 0.1 }); [659, 880, 1109, 1319, 1760].forEach((f, i) => Snd.tone(f, 0.05 + i * 0.05, 0.14, { vol: 0.045, type: "square" })); },
  hole() { Snd.tone(1600, 0, 1.1, { vol: 0.08, type: "sine", slide: 45, vib: 9 }); Snd.noise(0, 1.1, { freq: 4000, sweep: 120, q: 2, vol: 0.12 }); Snd.tone(55, 0.3, 0.9, { vol: 0.12, type: "sine" }); },
  eject() { Snd.noise(0, 0.25, { freq: 350, vol: 0.3, type: "lowpass" }); Snd.tone(70, 0, 0.3, { vol: 0.16, type: "sine", slide: 35 }); Snd.tone(900, 0, 0.15, { vol: 0.04, slide: 2400 }); },
  pull(c) { Snd.tone(120 + c * 520, 0, 0.04, { vol: 0.025, type: "sawtooth", lp: 1500 }); },
  launch(p) { Snd.noise(0, 0.08, { freq: 400, vol: 0.3, type: "lowpass" }); Snd.noise(0.02, 0.4, { freq: 600, sweep: 3000, q: 1, vol: 0.06 + p * 0.08 }); Snd.tone(90, 0, 0.12, { vol: 0.1, type: "triangle", slide: 50 }); },
  wall(v) { Snd.noise(0, 0.03, { freq: 1500 + Math.min(v, 1500), q: 3, vol: Math.min(0.12, v / 9000) }); },
  rubber() { Snd.tone(330, 0, 0.05, { vol: 0.04, type: "triangle", slide: 200 }); },
  drain() { [392, 370, 349, 330].forEach((f, i) => Snd.tone(f, i * 0.22, 0.3, { vol: 0.07, type: "sawtooth", lp: 1200, lpTo: 300, vib: 6 })); Snd.tone(55, 0.9, 0.8, { vol: 0.1, type: "sine" }); },
  save() { [1047, 1319, 1568, 2093].forEach((f, i) => Snd.tone(f, i * 0.07, 0.15, { vol: 0.06, type: "square" })); },
  kick() { Snd.noise(0, 0.15, { freq: 300, vol: 0.35, type: "lowpass" }); Snd.tone(60, 0, 0.25, { vol: 0.18, type: "sine", slide: 30 }); Snd.tone(1200, 0, 0.3, { vol: 0.05, slide: 300 }); },
  brass(notes, step = 0.12, last = 0.5) {
    notes.forEach((f, i) => {
      const d = i === notes.length - 1 ? last : step * 0.95;
      Snd.tone(f, i * step, d, { vol: 0.07, type: "sawtooth", lp: 600, lpTo: 2600, attack: 0.02 });
      Snd.tone(f * 1.005, i * step, d, { vol: 0.05, type: "sawtooth", lp: 800, lpTo: 2200, attack: 0.02 });
      Snd.tone(f / 2, i * step, d, { vol: 0.05, type: "square", lp: 500 });
    });
  },
  mStart() { this.brass([392, 523, 659, 784]); Snd.noise(0, 0.6, { freq: 6000, q: 0.7, vol: 0.04, type: "highpass" }); },
  mDone() { this.brass([523, 659, 784, 1047, 784, 1047, 1319], 0.1, 0.8); Snd.tone(65, 0, 1.2, { vol: 0.12, type: "sine" }); },
  rank() { this.brass([392, 392, 523, 659, 784, 1047], 0.14, 1.2); [2093, 2637, 3136].forEach((f, i) => Snd.tone(f, 0.9 + i * 0.08, 0.5, { vol: 0.03, type: "sine" })); },
  extra() { [784, 988, 1175, 1568, 1175, 1568, 2093].forEach((f, i) => Snd.tone(f, i * 0.08, 0.16, { vol: 0.06, type: "triangle" })); },
  lock() { Snd.tone(220, 0, 0.5, { vol: 0.1, type: "sawtooth", lp: 400, lpTo: 3000 }); Snd.tone(330, 0.15, 0.5, { vol: 0.08, type: "sawtooth", lp: 400, lpTo: 3000 }); Snd.noise(0.3, 0.2, { freq: 400, vol: 0.2, type: "lowpass" }); },
  multi() {
    for (let i = 0; i < 6; i++) { Snd.tone(600, i * 0.25, 0.12, { vol: 0.06, slide: 1200 }); Snd.tone(1200, i * 0.25 + 0.12, 0.12, { vol: 0.06, slide: 600 }); }
    this.brass([523, 523, 784, 1047], 0.2, 0.9);
  },
  jackpot() { this.brass([784, 988, 1175, 1568, 1568, 2093], 0.09, 1); Snd.noise(0, 1, { freq: 8000, q: 0.5, vol: 0.05, type: "highpass" }); },
  tiltWarn() { Snd.tone(196, 0, 0.35, { vol: 0.1 }); Snd.tone(208, 0, 0.35, { vol: 0.08 }); },
  tilt() { Snd.tone(98, 0, 1.4, { vol: 0.14, type: "sawtooth", slide: 49 }); Snd.tone(104, 0, 1.4, { vol: 0.1, type: "sawtooth", slide: 52 }); },
  nudge() { Snd.noise(0, 0.15, { freq: 200, vol: 0.3, type: "lowpass" }); Snd.tone(50, 0, 0.15, { vol: 0.12, type: "sine" }); },
  skill() { [1047, 1319, 1568, 2093, 2637].forEach((f, i) => Snd.tone(f, i * 0.06, 0.2, { vol: 0.05 })); this.brass([1047], 0.1, 0.6); },
  laneDone() { [1319, 1568, 2093].forEach((f, i) => Snd.tone(f, i * 0.07, 0.25, { vol: 0.06, type: "sine" })); },
  over() { [523, 494, 440, 392, 349, 330, 294, 262].forEach((f, i) => Snd.tone(f, i * 0.2, 0.35, { vol: 0.06, type: "triangle", vib: 5 })); },
  bonusTick(i) { Snd.tone(880 + (i % 8) * 110, 0, 0.04, { vol: 0.035 }); },
  start() { this.brass([262, 392, 523, 659, 784], 0.1, 0.7); },
};

/* ── müzik: ileriye zamanlanan basit sıralayıcı (bas, ped, arpej, davul) ── */
const Music = {
  next: 0, step: 0, mode: "calm", timer: null,
  // Am – F – C – G, her biri bir ölçü (16 adım)
  CH: [[220, 261.6, 329.6], [174.6, 220, 261.6], [130.8, 164.8, 196], [196, 246.9, 293.7]],
  BASS: [0, 0, 12, 0, 0, 7, 0, 12, 0, 0, 12, 0, 7, 0, 5, 7],
  start() { if (!Snd.ctx || this.timer) return; this.next = Snd.ctx.currentTime + 0.1; this.timer = setInterval(() => this.tick(), 25); },
  stop() { clearInterval(this.timer); this.timer = null; },
  tick() {
    const c = Snd.ctx; if (!c || !Snd.on) { if (c) this.next = c.currentTime + 0.1; return; }
    const bpm = this.mode === "intense" ? 138 : this.mode === "mission" ? 124 : 112, st = 60 / bpm / 4;
    while (this.next < c.currentTime + 0.12) { this.play(this.step, this.next - c.currentTime); this.next += st; this.step++; }
  },
  play(s, at) {
    const bar = ((s / 16) | 0) % 4, i = s % 16, ch = this.CH[bar], root = ch[0] / 2, d = Snd.mus, m = this.mode;
    const semis = (n) => Math.pow(2, n / 12);
    if (i % 2 === 0) Snd.tone(root * semis(this.BASS[i]), at, 0.2, { vol: 0.11, type: "sawtooth", lp: 900, lpTo: 200, dest: d });
    if (i === 0) ch.forEach((f) => Snd.tone(f, at, 2.1, { vol: 0.025, type: "triangle", attack: 0.4, dest: d }));
    if (m !== "calm" || i % 4 === 2) {
      const f = ch[(i + (i >> 2)) % 3] * (m === "intense" ? 4 : 2);
      if (m !== "calm" || bar % 2 === 0) Snd.tone(f, at, 0.1, { vol: m === "calm" ? 0.012 : 0.02, type: "square", lp: 3000, dest: d });
    }
    if (i % 8 === 0 || (m === "intense" && i === 10)) Snd.tone(110, at, 0.25, { vol: 0.22, type: "sine", slide: 38, slideT: 0.12, dest: d });
    if (m !== "calm" && (i === 4 || i === 12)) Snd.noise(at, 0.14, { freq: 1800, q: 0.8, vol: 0.09, dest: d });
    if (i % 2 === 1 || m === "intense") Snd.noise(at, 0.035, { freq: 8000, q: 0.7, vol: m === "calm" ? 0.015 : 0.03, type: "highpass", dest: d });
  },
};

/* ─────────────────────────── masa geometrisi ─────────────────────────── */
const walls = [];
const poly = (pts, o = {}) => { for (let i = 0; i < pts.length - 1; i++) walls.push(Object.assign({ ax: pts[i][0], ay: pts[i][1], bx: pts[i + 1][0], by: pts[i + 1][1], e: 0.45, rad: 2.5 }, o)); };
const mir = (pts) => pts.map(([x, y]) => [330 - x, y]); // oyun alanı x=165 eksenine göre simetrik
const RIM = [[12, 640], [12, 180]];
for (let i = 1; i < 40; i++) { const a = Math.PI + (Math.PI * i) / 40; RIM.push([180 + Math.cos(a) * 168, 180 + Math.sin(a) * 168]); }
RIM.push([348, 180], [348, 640]);
poly(RIM, { outer: true, e: 0.4 });
poly([[318, 230], [318, 640]], { rail: true });            // fırlatma kanalı
poly([[52, 170], [52, 330]], { rail: true });             // sol yörünge kanalı
poly([[12, 338], [62, 372]], { rail: true, e: 0.3 });
poly([[285, 190], [285, 330]], { rail: true });           // sağ yörünge kanalı
poly([[88, 300], [88, 250], [124, 250], [124, 300]], { rail: true, e: 0.3 }); // rampa ağzı
const LANE_X = [132, 172, 212], SEP_X = [112, 152, 192, 232];
SEP_X.forEach((x) => poly([[x, 80], [x, 116]], { rail: true, e: 0.5 }));
const GUIDE = [[36, 462], [36, 516], [99, 545]], SLING = [[66, 440], [66, 498], [98, 514]];
poly(GUIDE, { rail: true, e: 0.3 }); poly(mir(GUIDE), { rail: true, e: 0.3 });
poly(SLING.slice(0, 3), { e: 0.3, rad: 3 }); poly(mir(SLING), { e: 0.3, rad: 3 });
const slings = [{ ax: 66, ay: 440, bx: 98, by: 514, fl: 0 }, { ax: 264, ay: 440, bx: 232, by: 514, fl: 0 }];
const posts = [[66, 440], [264, 440], [66, 498], [264, 498], [98, 514], [232, 514], [88, 300], [124, 300], [52, 330], [285, 330]].map(([x, y]) => ({ x, y, r: 4.5 }));
SEP_X.forEach((x) => posts.push({ x, y: 80, r: 4 }));
const BUMPERS = [{ x: 130, y: 165, c: "#ff3fa4" }, { x: 202, y: 158, c: "#18e0ff" }, { x: 166, y: 222, c: "#ffd23f" }];
const BR_ = 22;
const DROP_Y = 385, DROPS_X = [135, 165, 195];
const STAND_Y = [215, 255, 295]; // sol kanal duvarındaki kalkan hedefleri (x=55)
const HOLE = { x: 250, y: 290 };
const RAMP_PATH = [[106, 262], [106, 190], [114, 128], [140, 88], [182, 66], [228, 74], [266, 104], [292, 150], [302, 210], [304, 300], [300, 380], [282, 440]];
const FLIP_L = 58;
const PLUNGE_X = 333, FLOOR_Y = 612;

const MISSIONS = [
  { k: "ramp", name: "YAKIT İKMALİ", how: "RAMPAYA ÇIK", need: 3, say: "Yakıt ikmali görevi" },
  { k: "orbit", name: "YÖRÜNGE KEŞFİ", how: "YÖRÜNGEYİ DOLAN", need: 2, say: "Yörünge keşfi görevi" },
  { k: "bumper", name: "ASTEROİT KUŞAĞI", how: "BUMPERLARA VUR", need: 20, say: "Asteroit kuşağı görevi" },
  { k: "lane", name: "RADAR TARAMASI", how: "ÜST ŞERİTLERİ YAK", need: 2, say: "Radar taraması görevi" },
  { k: "drop", name: "HEDEF İMHA", how: "HEDEFLERİ DÜŞÜR", need: 2, say: "Hedef imha görevi" },
  { k: "stand", name: "KALKAN ŞARJI", how: "KALKAN HEDEFLERİ", need: 2, say: "Kalkan şarjı görevi" },
  { k: "hole", name: "OLAY UFKU", how: "KARA DELİĞE DÖN", need: 2, say: "Olay ufku görevi" },
  { k: "sling", name: "SAPAN MANEVRASI", how: "SAPANLARA VUR", need: 15, say: "Sapan manevrası görevi" },
];
const RANKS = ["ÇAYLAK", "KADET", "PİLOT", "TEĞMEN", "YÜZBAŞI", "KAPTAN", "KOMUTAN", "AMİRAL", "YILDIZ AMİRALİ"];

/* ─────────────────────────── oyun durumu ─────────────────────────── */
let G = null; // açık oyun
function newGame() {
  return {
    score: 0, ballNo: 1, extra: 0, rank: 0, done: 0, mission: null, mLast: -1, mProg: 0,
    balls: [], mult: 1, lanes: [0, 0, 0], skillLane: 0, skillT: 0, saveT: 0, launched: false,
    charge: 0, floorY: FLOOR_Y, tilt: 0, tilted: false, shake: { x: 0, y: 0, t: 0 }, bonus: 0, bonusShow: 0, bonusT: 0,
    drops: [1, 1, 1], dropT: 0, stands: [0, 0, 0], kickback: false, lockLit: false, locked: 0, multi: false, jackpot: false,
    holeQ: [], orbitArm: 0, msg: null, msgQ: [], parts: [], pops: [], over: false, overT: 0, paused: false,
    flash: 0, bumpFl: [0, 0, 0], slingFl: [0, 0], dropFl: [0, 0, 0], standFl: [0, 0, 0], kbFl: 0, laneFl: 0, lights: 0,
    flips: [
      { px: 96, py: 556, rest: 0.52, up: -0.5, a: 0.52, w: 0, side: "L" },
      { px: 234, py: 556, rest: Math.PI - 0.52, up: Math.PI + 0.5, a: Math.PI - 0.52, w: 0, side: "R" },
    ],
    ballSerial: 0, autoPlunge: 0, stuckT: 0, later: [], hiAtStart: +(store(HI_KEY) || 0),
  };
}
const ballIn = (b) => b.x > 318 && b.mode === "play";
function mkBall(x, y, vx = 0, vy = 0) { return { x, y, vx, vy, mode: "play", z: 0, rt: 0, id: G.ballSerial++, tick: 0, prev: [] }; }
function serveBall(auto = false) {
  G.balls.push(mkBall(PLUNGE_X, FLOOR_Y - R));
  if (auto) G.autoPlunge = 0.6;
}
function startBall() {
  G.balls = []; G.mult = 1; G.lanes = [0, 0, 0]; G.skillLane = (Math.random() * 3) | 0; G.skillT = 0; G.saveT = 0; G.launched = false; G.saveGiven = false;
  G.tilt = 0; G.tilted = false; G.bonus = 0; G.multi = false; G.jackpot = false; G.holeQ = []; G.charge = 0;
  serveBall();
}
function say(l1, l2 = "", l3 = "", dur = 2.6, hot = false) { G.msg = { l: [l1, l2, l3], t: dur, hot }; }
function after(sec, fn) { G.later.push({ t: sec, fn }); } // oyun saatine bağlı gecikme (duraklatınca bekler)
function add(n) { if (!G.tilted) G.score += n; }
function pop(x, y, txt, col = "#ffd23f") { G.pops.push({ x, y, txt, col, t: 1.1 }); }
function burst(x, y, col, n = 10, sp = 220) {
  for (let i = 0; i < n && G.parts.length < 220; i++) { const a = rand(0, Math.PI * 2), v = rand(sp * 0.3, sp); G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: rand(0.25, 0.6), c: col }); }
}
function musicMode() { Music.mode = G.multi ? "intense" : G.mission ? "mission" : "calm"; }

/* ── görevler, rütbe, kilit ── */
function startMission() {
  let i; do i = (Math.random() * MISSIONS.length) | 0; while (i === G.mLast);
  G.mLast = i; const m = MISSIONS[i];
  G.mission = Object.assign({}, m, { need: Math.round(m.need * (1 + Math.floor(G.rank / 3) * 0.5)) }); G.mProg = 0;
  say("YENİ GÖREV", m.name, m.how, 3.2, true); fx.mStart(); Snd.speak(m.say); musicMode();
}
function progress(k, n = 1) {
  if (!G.mission || G.mission.k !== k || G.tilted) return;
  G.mProg += n;
  if (G.mProg < G.mission.need) return;
  const pts = 250000 + G.rank * 100000;
  add(pts); G.bonus += 25000; G.done++; G.mission = null; musicMode();
  say("GÖREV TAMAMLANDI", "+" + fmt(pts), G.done % 2 ? "BİR GÖREV DAHA = RÜTBE" : "", 3, true); fx.mDone(); Snd.speak("Görev tamamlandı");
  G.flash = 0.6;
  if (G.done % 2 === 0 && G.rank < RANKS.length - 1) {
    after(1.6, () => {
      G.rank++; const rp = 500000 * G.rank; add(rp);
      const eb = G.rank % 3 === 0;
      if (eb) G.extra++;
      say("RÜTBE ATLADIN", RANKS[G.rank], eb ? "EKSTRA TOP!" : "+" + fmt(rp), 3.4, true);
      fx.rank(); if (eb) after(1.2, () => fx.extra());
      Snd.speak(eb ? "Terfi. Ekstra top" : "Terfi. " + RANKS[G.rank].toLowerCase());
      G.flash = 1;
    });
  }
}
function startMulti() {
  G.multi = true; G.jackpot = true; G.lockLit = false; G.locked = 0; G.saveT = 12;
  say("ÇOKLU TOP!", "RAMPA = JACKPOT", "", 3.5, true); fx.multi(); Snd.speak("Çoklu top");
  G.holeQ.push(0.6, 1.4); serveBall(true); musicMode(); G.flash = 1;
}

/* ─────────────────────────── çarpışma ─────────────────────────── */
let hn = { x: 0, y: 0 };
function hitSeg(b, ax, ay, bx, by, rad, e) {
  const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
  const t = clamp(((b.x - ax) * ex + (b.y - ay) * ey) / l2, 0, 1);
  const px = ax + ex * t, py = ay + ey * t, dx = b.x - px, dy = b.y - py, d2 = dx * dx + dy * dy, rr = R + rad;
  if (d2 >= rr * rr || d2 === 0) return 0;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
  b.x = px + nx * rr; b.y = py + ny * rr;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; const tx = -ny, ty = nx, vt = b.vx * tx + b.vy * ty; b.vx -= vt * 0.01 * tx; b.vy -= vt * 0.01 * ty; }
  hn.x = nx; hn.y = ny;
  return Math.max(0.001, -vn);
}
function hitCircle(b, cx, cy, r, e) {
  const dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy, rr = R + r;
  if (d2 >= rr * rr || d2 === 0) return 0;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
  b.x = cx + nx * rr; b.y = cy + ny * rr;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; }
  hn.x = nx; hn.y = ny;
  return Math.max(0.001, -vn);
}
let sndCD = 0, rubCD = 0;
function hitFlipper(b, f) {
  const ex = Math.cos(f.a) * FLIP_L, ey = Math.sin(f.a) * FLIP_L;
  const t = clamp(((b.x - f.px) * ex + (b.y - f.py) * ey) / (FLIP_L * FLIP_L), 0, 1);
  const cx = f.px + ex * t, cy = f.py + ey * t, rad = 10 - t * 4.5;
  const dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy, rr = R + rad;
  if (d2 >= rr * rr || d2 === 0) return;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
  b.x = cx + nx * rr; b.y = cy + ny * rr;
  const fvx = -(cy - f.py) * f.w, fvy = (cx - f.px) * f.w; // palet yüzeyinin o noktadaki hızı
  const vn = (b.vx - fvx) * nx + (b.vy - fvy) * ny;
  if (vn < 0) {
    b.vx -= 1.32 * vn * nx; b.vy -= 1.32 * vn * ny;
    if (vn < -500 && rubCD <= 0) { rubCD = 0.08; fx.rubber(); }
  }
}

/* ── tek alt adım fizik ── */
function physics(h) {
  const keyL = (inp.L && !G.tilted && !G.over), keyR = (inp.R && !G.tilted && !G.over);
  for (const f of G.flips) {
    const up = f.side === "L" ? keyL : keyR, tgt = up ? f.up : f.rest, d = tgt - f.a;
    if (Math.abs(d) < 1e-6) { f.w = 0; continue; }
    const sp = (up ? 30 : 17) * Math.sign(d);
    let na = f.a + sp * h; if ((tgt - na) * Math.sign(d) <= 0) na = tgt;
    f.w = (na - f.a) / h; f.a = na;
  }
  for (const b of G.balls) {
    if (b.mode !== "play") continue;
    b.vy += GRAV * h;
    const sp = Math.hypot(b.vx, b.vy); if (sp > VMAX) { b.vx *= VMAX / sp; b.vy *= VMAX / sp; }
    b.x += b.vx * h; b.y += b.vy * h;
    for (const w of walls) { const v = hitSeg(b, w.ax, w.ay, w.bx, w.by, w.rad, w.e); if (v > 450 && sndCD <= 0) { sndCD = 0.05; fx.wall(v); } }
    for (const p of posts) if (hitCircle(b, p.x, p.y, p.r, 0.6) > 300 && rubCD <= 0) { rubCD = 0.06; fx.rubber(); }
    slings.forEach((s, i) => {
      const v = hitSeg(b, s.ax, s.ay, s.bx, s.by, 3, 0.3);
      if (v > 80 && G.slingFl[i] <= 0.05) {
        b.vx += hn.x * 560; b.vy += hn.y * 560; G.slingFl[i] = 0.14;
        add(1010); G.bonus += 100; fx.sling(); progress("sling");
      }
    });
    BUMPERS.forEach((u, i) => {
      const v = hitCircle(b, u.x, u.y, BR_, 0);
      if (!v) return;
      const out = Math.max(v * 0.5, 200) + 520; // bumper topu daima dışarı fırlatır
      const vt = -b.vx * hn.y + b.vy * hn.x;
      b.vx = hn.x * out - hn.y * vt * 0.8; b.vy = hn.y * out + hn.x * vt * 0.8;
      if (G.bumpFl[i] <= 0.06) {
        const p = 500 * (1 + Math.floor(G.rank / 2)); add(p); G.bonus += 200; fx.bumper(i); burst(u.x + hn.x * BR_, u.y + hn.y * BR_, u.c, 8); pop(u.x, u.y - 30, fmt(p), u.c); progress("bumper");
      }
      G.bumpFl[i] = 0.14;
    });
    G.drops.forEach((up, i) => {
      if (!up) return;
      const x = DROPS_X[i], v = hitSeg(b, x - 13, DROP_Y, x + 13, DROP_Y, 4, 0.35);
      if (v > 90) {
        G.drops[i] = 0; G.dropFl[i] = 0.4; add(1500); G.bonus += 500; fx.drop(); burst(x, DROP_Y, "#ff8a3d", 8, 160);
        if (G.drops.every((q) => !q)) {
          const p = 10000 * G.mult; add(p); G.bonus += 2500; G.dropT = 1.4; fx.bank(); progress("drop");
          if (!G.multi) {
            if (!G.lockLit) { G.lockLit = true; say("HEDEFLER YOK EDİLDİ", "KİLİT AÇIK", "KARA DELİĞE GİR", 2.6); Snd.speak("Kilit açık"); }
            else say("HEDEFLER YOK EDİLDİ", "+" + fmt(p), "", 1.8);
          } else say("HEDEFLER YOK EDİLDİ", "+" + fmt(p), "", 1.8);
        }
      }
    });
    STAND_Y.forEach((y, i) => {
      const v = hitSeg(b, 55, y - 12, 55, y + 12, 3, 0.4);
      if (v > 90 && G.standFl[i] <= 0) {
        G.standFl[i] = 0.25; add(1000); G.bonus += 300; fx.standup();
        if (!G.stands[i]) {
          G.stands[i] = 1;
          if (G.stands.every(Boolean)) {
            G.stands = [0, 0, 0]; add(7500); progress("stand");
            G.kickback = true; G.kbFl = 1.5; say("KALKAN DOLDU", "KICKBACK HAZIR", "+7.500", 2.2); fx.laneDone();
          }
        }
      }
    });
    for (const f of G.flips) hitFlipper(b, f);
    // fırlatma tıpası (hareketli zemin)
    if (b.x > 318 && b.y > G.floorY - R) { b.y = G.floorY - R; if (b.vy > 0) b.vy = b.vy > 80 ? -b.vy * 0.2 : 0; b.vx = 0; }
    sensors(b);
  }
  // toplar arası çarpışma
  const bs = G.balls;
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    const a = bs[i], c = bs[j]; if (a.mode !== "play" || c.mode !== "play") continue;
    const dx = c.x - a.x, dy = c.y - a.y, d2 = dx * dx + dy * dy; if (d2 >= 4 * R * R || d2 === 0) continue;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, o = (2 * R - d) / 2;
    a.x -= nx * o; a.y -= ny * o; c.x += nx * o; c.y += ny * o;
    const vn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
    if (vn < 0) { const j2 = -vn * 0.95; a.vx -= nx * j2; a.vy -= ny * j2; c.vx += nx * j2; c.vy += ny * j2; }
  }
}
function crossed(b, key, inside) { const was = !!b[key]; b[key] = inside; return inside && !was; }
function sensors(b) {
  // üst şeritler
  LANE_X.forEach((lx, i) => {
    if (crossed(b, "ln" + i, Math.abs(b.x - lx) < 12 && Math.abs(b.y - 102) < 10)) {
      add(1000); G.bonus += 250; fx.rollover(1 + i * 0.12); G.laneFl = 0.3;
      if (G.skillT > 0) { G.skillT = 0; if (i === G.skillLane) { add(100000); say("SÜPER ATIŞ!", "+100.000", "", 2.2, true); fx.skill(); Snd.speak("Süper atış"); } }
      if (!G.lanes[i]) {
        G.lanes[i] = 1;
        if (G.lanes.every(Boolean)) {
          G.lanes = [0, 0, 0]; if (G.mult < 5) G.mult++;
          add(5000 * G.mult); say("RADAR TAMAM", "BONUS ÇARPANI x" + G.mult, "", 2); fx.laneDone(); progress("lane");
        }
      }
    }
  });
  // yörünge: sağ kanaldan yukarı → sol kanaldan aşağı
  if (crossed(b, "orR", b.x > 287 && b.x < 316 && Math.abs(b.y - 260) < 14) && b.vy < -250) b.orArm = 2;
  if (crossed(b, "orL", b.x < 50 && Math.abs(b.y - 250) < 14) && b.vy > 0) {
    if (b.orArm > 0) {
      b.orArm = 0; const p = 15000 * G.mult; add(p); G.bonus += 2000; fx.orbit(); pop(32, 230, fmt(p), "#18e0ff"); say("YÖRÜNGE", "+" + fmt(p), "", 1.5); progress("orbit");
    } else { add(2500); fx.rollover(0.8); }
  }
  // rampa ağzı
  if (b.x > 92 && b.x < 120 && b.y > 254 && b.y < 292 && b.vy < -330) { b.mode = "ramp"; b.rt = 0; fx.rampIn(); }
  // kara delik
  if (Math.hypot(b.x - HOLE.x, b.y - HOLE.y) < 12 && Math.hypot(b.vx, b.vy) < 1300 && !(b.holeCD > 0)) capture(b);
  // sol dış şerit: kickback
  if (b.x < 36 && b.y > 528 && b.y < 600 && b.vy > 0) {
    if (G.kickback && !G.tilted) { G.kickback = false; b.vy = -1350; b.vx = 15; b.y = 560; fx.kick(); G.kbFl = 0.6; say("KICKBACK!", "", "", 1.2); }
    else if (crossed(b, "out", true)) add(5000);
  } else if (b.x > 294 && b.x < 318 && b.y > 528) { if (crossed(b, "out", true)) add(5000); }
  else b.out = false;
}
function capture(b) {
  b.mode = "hole"; b.rt = 0; fx.hole(); burst(HOLE.x, HOLE.y, "#b26bff", 16, 160);
  add(7500); G.bonus += 1500;
  if (G.tilted) { b.hold = 1.3; return; }
  if (G.lockLit && !G.multi) {
    G.locked++; G.lockLit = false;
    b.mode = "gone"; fx.lock();
    if (G.locked >= 2) { startMulti(); return; }
    say("TOP KİLİTLENDİ", "KİLİT " + G.locked + "/2", "HEDEFLERİ TEKRAR DÜŞÜR", 2.6, true); Snd.speak("Top kilitlendi");
    after(1.2, () => serveBall());
    return;
  }
  b.hold = 1.5;
  if (!G.mission) startMission();
  else if (G.mission.k === "hole") progress("hole");
  else say(G.mission.name, "GÖREV SÜRÜYOR", "KALAN " + (G.mission.need - G.mProg), 2);
}
function ejectAt(b) {
  b.mode = "play"; b.x = HOLE.x - 10; b.y = HOLE.y + 14; b.vx = -rand(280, 420); b.vy = rand(80, 200); b.holeCD = 1;
  fx.eject(); burst(HOLE.x, HOLE.y, "#18e0ff", 14, 240); G.shake.t = 0.12;
}
function rampPos(t) {
  const n = RAMP_PATH.length - 1, f = clamp(t, 0, 1) * n, i = Math.min(n - 1, f | 0), k = f - i;
  const p0 = RAMP_PATH[Math.max(0, i - 1)], p1 = RAMP_PATH[i], p2 = RAMP_PATH[i + 1], p3 = RAMP_PATH[Math.min(n, i + 2)];
  const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * k + (2 * a - 5 * b + 4 * c - d) * k * k + (-a + 3 * b - 3 * c + d) * k * k * k);
  return [cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])];
}
function rampDone(b) {
  b.mode = "play"; const [x, y] = rampPos(1); b.x = x; b.y = y; b.vx = -90; b.vy = 420; b.z = 0;
  fx.rampOut();
  let p = 10000 * G.mult;
  if (G.multi && G.jackpot) { p = 500000 + 100000 * G.rank; say("JACKPOT!", "+" + fmt(p), "", 2.6, true); fx.jackpot(); Snd.speak("Jackpot"); G.flash = 1; }
  else say("RAMPA", "+" + fmt(p), "", 1.3);
  add(p); G.bonus += 2000; progress("ramp"); pop(270, 420, fmt(p), "#3dff7a");
}

/* ── kare güncellemesi ── */
function update(dt) {
  dt = Math.min(dt, 1 / 30);
  for (const p of G.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97; p.l -= dt; }
  G.parts = G.parts.filter((p) => p.l > 0);
  for (const p of G.pops) { p.t -= dt; p.y -= 30 * dt; }
  G.pops = G.pops.filter((p) => p.t > 0);
  if (G.msg && G.msg.t > 0) G.msg.t -= dt;
  G.flash = Math.max(0, G.flash - dt); G.lights += dt;
  if (G.over) { G.overT += dt; return; }
  if (G.paused) return;
  sndCD -= dt; rubCD -= dt; G.skillT -= dt; G.kbFl -= dt; G.laneFl -= dt;
  [G.bumpFl, G.slingFl, G.dropFl, G.standFl].forEach((a) => a.forEach((v, i) => (a[i] = v - dt)));
  if (G.launched && G.saveT > 0) G.saveT -= dt;
  G.tilt = Math.max(0, G.tilt - dt * 0.5);
  if (G.shake.t > 0) { G.shake.t -= dt; G.shake.x = rand(-3, 3); G.shake.y = rand(-2, 2); } else G.shake.x = G.shake.y = 0;
  for (const l of G.later) if ((l.t -= dt) <= 0) l.fn();
  G.later = G.later.filter((l) => l.t > 0);
  if (G.dropT > 0) { G.dropT -= dt; if (G.dropT <= 0) { G.drops = [1, 1, 1]; Snd.tone(300, 0, 0.15, { vol: 0.06, slide: 900 }); } }

  // paletler (ses + üst şerit ışıklarını kaydırma)
  if (!G.tilted) {
    if (inp.hitL) { fx.flipUp(); G.lanes.push(G.lanes.shift()); }
    if (inp.hitR) { fx.flipUp(); G.lanes.unshift(G.lanes.pop()); }
    if (inp.relL || inp.relR) fx.flipDown();
  }
  // fırlatıcı
  const laneBall = G.balls.find((b) => ballIn(b) && b.y > FLOOR_Y - 60);
  if (G.autoPlunge > 0) { G.autoPlunge -= dt; if (G.autoPlunge <= 0 && laneBall) { laneBall.vy = -2000; fx.launch(1); } }
  if (inp.P && !inp.lockP && laneBall) {
    G.charge = Math.min(1, G.charge + dt * 0.9); G.floorY = FLOOR_Y + G.charge * 18;
    G.pullT = (G.pullT || 0) - dt; if (G.pullT <= 0) { G.pullT = 0.06; fx.pull(G.charge); }
  } else if (G.charge > 0) {
    if (laneBall) {
      laneBall.vy = -(600 + 1600 * G.charge); fx.launch(G.charge);
      G.launched = true;
      if (!G.saveGiven) { G.saveGiven = true; G.saveT = 10; G.skillT = 5; } // kurtarma her topta bir kez verilir
    }
    G.charge = 0; G.floorY = FLOOR_Y;
  }
  // sarsma / tilt
  if (inp.nudge && !G.tilted) {
    const [nx, ny] = inp.nudge; inp.nudge = null;
    G.shake.t = 0.18; G.tilt += 1; fx.nudge();
    for (const b of G.balls) if (b.mode === "play" && b.x < 318) { b.vx += nx * rand(120, 200); b.vy += ny * rand(150, 230); }
    if (G.tilt >= 3.2) { G.tilted = true; say("TILT", "PALETLER KİLİTLİ", "BONUS YOK", 4, true); fx.tilt(); Snd.speak("Tilt"); }
    else if (G.tilt >= 2) { say("DİKKAT!", "MASAYI SARSMA", "", 1.4, true); fx.tiltWarn(); }
  }
  inp.nudge = null;
  // kara delikten bekleyen çıkışlar (çoklu top)
  G.holeQ = G.holeQ.map((t) => t - dt);
  while (G.holeQ.length && G.holeQ[0] <= 0) { G.holeQ.shift(); const b = mkBall(HOLE.x, HOLE.y); G.balls.push(b); ejectAt(b); }

  const h = dt / SUB;
  for (let k = 0; k < SUB; k++) physics(h);

  for (const b of G.balls) {
    if (b.orArm > 0) b.orArm -= dt;
    if (b.holeCD > 0) b.holeCD -= dt;
    if (b.mode === "ramp") {
      b.rt += dt / 1.15; const [x, y] = rampPos(b.rt); b.x = x; b.y = y; b.z = Math.sin(Math.PI * clamp(b.rt, 0, 1)) * 0.7 + 0.3;
      if (b.rt >= 1) rampDone(b);
    } else if (b.mode === "hole") { b.hold -= dt; if (b.hold <= 0) ejectAt(b); }
    if (b.mode === "play") {
      b.prev.unshift([b.x, b.y]); if (b.prev.length > 5) b.prev.pop();
      if (!(b.x > 318) && Math.hypot(b.vx, b.vy) < 8) { b.still = (b.still || 0) + dt; if (b.still > 4) { b.still = 0; b.vy = -400; b.vx = rand(-150, 150); say("TOP SIKIŞTI", "", "", 1); } } else b.still = 0;
      if (b.x < -20 || b.x > W + 20 || b.y < -30 || !isFinite(b.x + b.y)) { b.x = PLUNGE_X; b.y = FLOOR_Y - R; b.vx = b.vy = 0; } // güvenlik
    }
  }
  // kaybedilen toplar
  const lost = G.balls.filter((b) => b.mode === "play" && b.y > H + 20);
  if (lost.length) {
    G.balls = G.balls.filter((b) => !lost.includes(b));
    for (const _ of lost) {
      if (G.saveT > 0 && !G.tilted) { serveBall(G.multi); if (!G.multi) { say("TOP KURTARILDI", "TEKRAR FIRLAT", "", 2); G.launched = false; } fx.save(); Snd.speak("Top kurtarıldı"); }
    }
  }
  G.balls = G.balls.filter((b) => b.mode !== "gone");
  const live = G.balls.length + G.holeQ.length;
  if (G.multi && live <= 1 && lost.length) { G.multi = false; G.jackpot = false; say("ÇOKLU TOP BİTTİ", "", "", 1.8); musicMode(); }
  if (live === 0 && lost.length && !G.bonusT) ballOver();
  if (G.bonusT > 0) {
    G.bonusT -= dt;
    const target = G.tilted ? 0 : G.bonus * G.mult;
    if (G.bonusShow < target) { const st = Math.max(1, target / 40); G.bonusShow = Math.min(target, G.bonusShow + st); G.bTick = (G.bTick || 0) + 1; if (G.bTick % 2 === 0) fx.bonusTick(G.bTick / 2); }
    if (G.bonusT <= 0) { G.bonusT = 0; nextBall(); }
  }
}
function ballOver() {
  fx.drain(); G.bonusT = 3; G.bonusShow = 0;
  const total = G.tilted ? 0 : G.bonus * G.mult;
  const wasTilted = G.tilted; G.tilted = false; add(total); G.tilted = wasTilted;
  say("TOP KAYBEDİLDİ", "BONUS " + fmt(G.bonus) + " x" + G.mult, G.tilted ? "TILT: BONUS YOK" : "= " + fmt(total), 3);
  Music.mode = "calm";
}
function nextBall() {
  if (G.extra > 0) { G.extra--; startBall(); say("EKSTRA TOP", "AYNI OYUNCU", "TEKRAR FIRLAT", 2.6, true); Snd.speak("Ekstra top"); return; }
  G.ballNo++;
  if (G.ballNo > 3) {
    G.over = true; G.overT = 0;
    const hi = +(store(HI_KEY) || 0); if (G.score > hi) store(HI_KEY, String(G.score));
    say("OYUN BİTTİ", G.score > hi ? "YENİ REKOR!" : "SKOR " + fmt(G.score), "BOŞLUK: YENİ OYUN", 999, true); fx.over(); Snd.speak(G.score > hi ? "Oyun bitti. Yeni rekor" : "Oyun bitti");
    return;
  }
  startBall();
  say("TOP " + G.ballNo, G.mission ? G.mission.name : "KARA DELİK = GÖREV", "", 2.4);
}

/* ─────────────────────────── çizim ─────────────────────────── */
let ov, cv, cx, tbl, tx, bed, rampLayer, panelBg, dpr = 1, scale = 1, offX = 0, offY = 0;
const TW = Math.round(W * S), TH = Math.round(H * S);
function mk(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function rimPath(x) { x.beginPath(); RIM.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); }
function rail(x, pts, w = 5) {
  x.lineCap = "round"; x.lineJoin = "round";
  const path = () => { x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); };
  path(); x.strokeStyle = "rgba(0,0,0,.55)"; x.lineWidth = w + 3; x.save(); x.translate(2, 3); x.stroke(); x.restore();
  path(); x.strokeStyle = "#4a4860"; x.lineWidth = w + 1; x.stroke();
  path(); x.strokeStyle = "#a9a6c8"; x.lineWidth = w - 1.5; x.stroke();
  x.save(); x.translate(-0.8, -0.8); path(); x.strokeStyle = "#f4f2ff"; x.lineWidth = 1.2; x.stroke(); x.restore();
}
function label(x, txt, px, py, size, col, rot = 0, font = BG) {
  x.save(); x.translate(px, py); x.rotate(rot); x.font = `${size}px ${font}`; x.textAlign = "center"; x.textBaseline = "middle";
  x.fillStyle = "rgba(0,0,0,.6)"; x.fillText(txt, 1, 1.5); x.fillStyle = col; x.fillText(txt, 0, 0); x.restore();
}
function insert(x, px, py, r, col) { // sönük ışık yuvası
  x.fillStyle = "#05040c"; x.beginPath(); x.arc(px, py, r + 1.5, 0, Math.PI * 2); x.fill();
  x.fillStyle = hexA(col, 0.22); x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
}
function arrowPath(x, px, py, ang, s) {
  x.save(); x.translate(px, py); x.rotate(ang); x.beginPath();
  x.moveTo(s, 0); x.lineTo(-s * 0.6, -s * 0.75); x.lineTo(-s * 0.25, 0); x.lineTo(-s * 0.6, s * 0.75); x.closePath(); x.restore();
}
// Masadaki ışıklar: konum, şekil ve renk (yanma durumu her karede hesaplanır)
const ARROWS = {
  ramp: { x: 106, y: 322, a: -Math.PI / 2, c: "#3dff7a" },
  orbit: { x: 301, y: 356, a: -Math.PI / 2, c: "#18e0ff" },
  hole: { x: 228, y: 322, a: -Math.PI / 3, c: "#b26bff" },
  orbitL: { x: 30, y: 362, a: -Math.PI / 2 - 0.4, c: "#18e0ff" },
};
function paintBed() {
  bed = mk(TW, TH); const x = bed.getContext("2d"); x.scale(S, S);
  // apron ve dış kasa
  x.fillStyle = "#0b0a12"; x.fillRect(0, 0, W, H);
  rimPath(x); x.lineWidth = 16; x.strokeStyle = "#1b1a28"; x.stroke();
  const gr = x.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, "#1c0f52"); gr.addColorStop(0.45, "#101a5c"); gr.addColorStop(0.8, "#0c0b3a"); gr.addColorStop(1, "#08061e");
  rimPath(x); x.fillStyle = gr; x.fill();
  x.save(); rimPath(x); x.clip();
  for (const [nx, ny, nr, col] of [[70, 300, 190, "rgba(178,107,255,.32)"], [290, 150, 160, "rgba(24,224,255,.20)"], [200, 520, 170, "rgba(255,63,164,.20)"], [160, 60, 120, "rgba(255,138,61,.12)"]]) {
    const rg = x.createRadialGradient(nx, ny, 0, nx, ny, nr); rg.addColorStop(0, col); rg.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = rg; x.fillRect(0, 0, W, H);
  }
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) { const s = rnd() < 0.08 ? 2 : 1; x.fillStyle = `rgba(${rnd() < 0.3 ? "180,220,255" : "255,255,255"},${0.25 + rnd() * 0.7})`; x.fillRect(rnd() * W, rnd() * H, s, s); }
  // reaktör etrafındaki yörünge halkaları
  x.strokeStyle = "rgba(120,200,255,.18)"; x.lineWidth = 1.2;
  for (let k = 1; k <= 4; k++) { x.beginPath(); x.ellipse(165, 470, 30 + k * 26, 12 + k * 11, -0.18, 0, Math.PI * 2); x.stroke(); }
  // enerji çatlakları (rastgele kırık çizgiler)
  x.strokeStyle = "rgba(120,170,255,.22)"; x.lineWidth = 1;
  for (let k = 0; k < 9; k++) {
    let px = rnd() * W, py = 120 + rnd() * 420; x.beginPath(); x.moveTo(px, py);
    for (let s = 0; s < 6; s++) { px += rand(-26, 26); py += rand(-22, 22); x.lineTo(px, py); } x.stroke();
  }
  // kanal zeminleri
  x.fillStyle = "rgba(0,0,0,.45)"; x.fillRect(318, 60, 30, 580); x.fillRect(12, 70, 40, 262); x.fillRect(285, 40, 33, 290);
  x.fillRect(88, 250, 36, 50);
  for (let y = 600; y > 250; y -= 34) { x.fillStyle = "rgba(255,138,61,.45)"; arrowPath(x, PLUNGE_X, y, -Math.PI / 2, 7); x.fill(); }
  // halkalı gezegen çıkartması
  const pg = x.createRadialGradient(158, 320, 2, 165, 328, 26); pg.addColorStop(0, "#9ae0ff"); pg.addColorStop(0.6, "#3a6ad0"); pg.addColorStop(1, "#141a5a");
  x.fillStyle = pg; x.beginPath(); x.arc(165, 328, 22, 0, Math.PI * 2); x.fill();
  x.strokeStyle = "rgba(255,210,63,.75)"; x.lineWidth = 2.5; x.beginPath(); x.ellipse(165, 328, 40, 9, -0.25, 0, Math.PI * 2); x.stroke();
  // paletler arası ışın demeti
  for (let k = -5; k <= 5; k++) {
    const g2 = x.createLinearGradient(0, 520, 0, 640); g2.addColorStop(0, "rgba(178,107,255,0)"); g2.addColorStop(1, "rgba(178,107,255,.45)");
    x.fillStyle = g2; x.beginPath(); x.moveTo(165, 470); x.lineTo(165 + k * 22 - 5, 640); x.lineTo(165 + k * 22 + 5, 640); x.fill();
  }
  // ışık yuvaları
  LANE_X.forEach((lx) => insert(x, lx, 92, 6, "#3dff7a"));
  DROPS_X.forEach((dx) => insert(x, dx, 406, 5, "#ffd23f"));
  STAND_Y.forEach((y) => insert(x, 72, y, 5, "#18e0ff"));
  for (let k = 0; k < 4; k++) insert(x, 129 + k * 24, 432, 7, "#ff3fa4");
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 - Math.PI / 2; insert(x, 165 + Math.cos(a) * 30, 470 + Math.sin(a) * 30, 4, "#18e0ff"); }
  insert(x, 26, 512, 7, "#ff8a3d"); insert(x, 165, 600, 7, "#3dff7a"); insert(x, 240, 334, 4.5, "#ffd23f"); insert(x, 256, 340, 4.5, "#ffd23f");
  Object.values(ARROWS).forEach((a) => { x.fillStyle = hexA(a.c, 0.2); arrowPath(x, a.x, a.y, a.a, 11); x.fill(); x.strokeStyle = "#05040c"; x.lineWidth = 1.5; x.stroke(); });
  x.restore();
  // yazılar
  label(x, "RAMPA", 106, 345, 8, "#3dff7a");
  label(x, "YÖRÜNGE", 301, 375, 7, "#18e0ff");
  label(x, "KARA DELİK", 250, 262, 7, "#d6b4ff");
  label(x, "KALKAN", 72, 186, 7, "#18e0ff");
  label(x, "KICKBACK", 26, 530, 5, "#ff8a3d", -Math.PI / 2);
  label(x, "BONUS ÇARPANI", 165, 448, 6, "#ff9ad0");
  label(x, "2X   3X   4X   5X", 165, 420, 6, "#ffd0ec", 0, PX);
  label(x, "KİLİT", 248, 352, 6, "#ffe08a");
  label(x, "TOP KURTARMA", 165, 617, 6, "#9affb0");
  // sapan plastikleri
  for (const tri of [SLING, mir(SLING)]) {
    const pg2 = x.createLinearGradient(tri[0][0], tri[0][1], tri[2][0], tri[2][1]); pg2.addColorStop(0, "#7a2cff"); pg2.addColorStop(1, "#2a0a6a");
    x.fillStyle = pg2; x.beginPath(); tri.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); x.fill();
    x.fillStyle = "rgba(255,255,255,.25)"; x.beginPath(); x.moveTo(tri[0][0] + 4, tri[0][1] + 12); x.lineTo(tri[1][0] + (tri[2][0] > tri[0][0] ? 4 : -4), tri[1][1] - 6); x.lineTo((tri[1][0] + tri[2][0]) / 2, (tri[1][1] + tri[2][1]) / 2 - 6); x.closePath(); x.fill();
  }
  // üst köşe plastikleri
  x.fillStyle = "rgba(255,63,164,.55)"; x.beginPath(); x.moveTo(52, 170); x.quadraticCurveTo(70, 120, 110, 92); x.lineTo(112, 112); x.quadraticCurveTo(80, 140, 60, 200); x.closePath(); x.fill();
  x.fillStyle = "rgba(24,224,255,.45)"; x.beginPath(); x.moveTo(285, 190); x.quadraticCurveTo(270, 130, 232, 96); x.lineTo(232, 116); x.quadraticCurveTo(262, 150, 276, 210); x.closePath(); x.fill();
  // raylar ve duvarlar
  for (const w of walls) if (w.rail) rail(x, [[w.ax, w.ay], [w.bx, w.by]], 5);
  rimPath(x); x.strokeStyle = "#8a86b0"; x.lineWidth = 4; x.stroke(); x.strokeStyle = "#e0dcff"; x.lineWidth = 1.2; x.stroke();
  // kara delik yuvası
  const hg = x.createRadialGradient(HOLE.x, HOLE.y, 2, HOLE.x, HOLE.y, 22); hg.addColorStop(0, "#000"); hg.addColorStop(0.6, "#12062a"); hg.addColorStop(1, "rgba(80,30,160,0)");
  x.fillStyle = hg; x.beginPath(); x.arc(HOLE.x, HOLE.y, 22, 0, Math.PI * 2); x.fill();
  // apron
  x.fillStyle = "#15131f"; x.beginPath(); x.moveTo(12, 600); x.lineTo(120, 612); x.lineTo(120, 640); x.lineTo(12, 640); x.fill();
  x.beginPath(); x.moveTo(318, 600); x.lineTo(210, 612); x.lineTo(210, 640); x.lineTo(318, 640); x.fill();
  x.strokeStyle = "#6a668a"; x.lineWidth = 1.5;
  x.beginPath(); x.moveTo(12, 600); x.lineTo(120, 612); x.lineTo(120, 640); x.moveTo(318, 600); x.lineTo(210, 612); x.lineTo(210, 640); x.stroke();
  label(x, "YILDIZ", 62, 624, 9, "#b26bff"); label(x, "PİLOTU", 266, 624, 9, "#ffd23f");
  x.fillStyle = "#0e0c16"; x.fillRect(318, 618, 30, 22);

  // rampa plastiği (ayrı katman: topların üstünde çizilir)
  rampLayer = mk(TW, TH); const r = rampLayer.getContext("2d"); r.scale(S, S);
  const pts = []; for (let t = 0; t <= 1.0001; t += 0.02) pts.push(rampPos(t));
  const rp = () => { r.beginPath(); pts.forEach(([px, py], i) => (i ? r.lineTo(px, py) : r.moveTo(px, py))); };
  r.lineCap = "round"; r.lineJoin = "round";
  rp(); r.strokeStyle = "rgba(0,0,0,.35)"; r.lineWidth = 30; r.save(); r.translate(5, 8); r.stroke(); r.restore();
  rp(); r.strokeStyle = "rgba(90,255,170,.22)"; r.lineWidth = 26; r.stroke();
  rp(); r.strokeStyle = "rgba(200,255,230,.25)"; r.lineWidth = 2; r.save(); r.translate(-6, -4); r.stroke(); r.restore();
  for (const off of [-13, 13]) { // iki yan ray
    r.beginPath(); for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(bx - ax, by - ay) || 1;
      const px = pts[i][0] - ((by - ay) / l) * off, py = pts[i][1] + ((bx - ax) / l) * off; i ? r.lineTo(px, py) : r.moveTo(px, py);
    }
    r.strokeStyle = "#d8f8ff"; r.lineWidth = 1.8; r.stroke();
  }
}

// Panel arka planı (logo kutusu dahil), sanal koordinatlarda
const PANEL = { x: 646, w: 342 };
const BOX = { logo: [646, 14, 342, 236], player: [646, 258, 58, 62], score: [710, 258, 278, 62], msg: [646, 328, 342, 160], info: [646, 496, 342, 190] };
function bevel(x, [bx, by, bw, bh]) {
  x.fillStyle = "#6c6c80"; x.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
  x.fillStyle = "#c8c8d8"; x.fillRect(bx - 4, by - 4, bw + 8, 3); x.fillRect(bx - 4, by - 4, 3, bh + 8);
  x.fillStyle = "#33333f"; x.fillRect(bx - 4, by + bh + 1, bw + 8, 3); x.fillRect(bx + bw + 1, by - 4, 3, bh + 8);
  x.fillStyle = "#02020a"; x.fillRect(bx, by, bw, bh);
}
function paintPanel() {
  panelBg = mk(VW * 2, VH * 2); const x = panelBg.getContext("2d"); x.scale(2, 2);
  const bg = x.createLinearGradient(0, 0, 0, VH); bg.addColorStop(0, "#08070f"); bg.addColorStop(1, "#000"); x.fillStyle = bg; x.fillRect(0, 0, VW, VH);
  // masa kasası: yamuğun çevresinde metal çerçeve
  const t = TRAP, yt = t.y0, yb = t.y1;
  const quad = (pad) => { x.beginPath(); x.moveTo(t.cx - t.wTop / 2 - pad, yt - pad * 0.6); x.lineTo(t.cx + t.wTop / 2 + pad, yt - pad * 0.6); x.lineTo(t.cx + t.wBot / 2 + pad, yb + pad * 0.4); x.lineTo(t.cx - t.wBot / 2 - pad, yb + pad * 0.4); x.closePath(); };
  const mg = x.createLinearGradient(0, 0, VW * 0.65, 0); mg.addColorStop(0, "#3a3850"); mg.addColorStop(0.5, "#6a6888"); mg.addColorStop(1, "#2a283a");
  quad(12); x.fillStyle = mg; x.fill(); quad(12); x.strokeStyle = "#9a98b8"; x.lineWidth = 1.5; x.stroke();
  quad(4); x.fillStyle = "#000"; x.fill();
  // kutular
  Object.values(BOX).forEach((b) => bevel(x, b));
  const [lx, ly, lw, lh] = BOX.logo;
  x.save(); x.beginPath(); x.rect(lx, ly, lw, lh); x.clip();
  const sg = x.createLinearGradient(0, ly, 0, ly + lh); sg.addColorStop(0, "#050418"); sg.addColorStop(1, "#140a3a"); x.fillStyle = sg; x.fillRect(lx, ly, lw, lh);
  let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 120; i++) { x.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.8})`; x.fillRect(lx + rnd() * lw, ly + rnd() * lh, rnd() < 0.1 ? 2 : 1, rnd() < 0.1 ? 2 : 1); }
  const pg = x.createRadialGradient(lx + 40, ly + lh - 40, 4, lx + 52, ly + lh - 30, 46); pg.addColorStop(0, "#b8ff9a"); pg.addColorStop(0.5, "#3a9a4a"); pg.addColorStop(1, "#0a2a12");
  x.fillStyle = pg; x.beginPath(); x.arc(lx + 50, ly + lh - 30, 42, 0, Math.PI * 2); x.fill();
  x.strokeStyle = "rgba(255,255,255,.12)"; x.lineWidth = 3; for (let k = 0; k < 3; k++) { x.beginPath(); x.arc(lx + 50, ly + lh - 30, 42, 3.6 + k * 0.4, 4.2 + k * 0.4); x.stroke(); }
  x.restore();
}
function drawRocket(x, px, py, t) {
  x.save(); x.translate(px, py); x.rotate(-0.35 + Math.sin(t * 1.3) * 0.04);
  // alev
  const fl = 18 + Math.sin(t * 40) * 5 + Math.random() * 4;
  const fg = x.createLinearGradient(-fl - 30, 0, -30, 0); fg.addColorStop(0, "rgba(255,80,40,0)"); fg.addColorStop(0.5, "#ff8a3d"); fg.addColorStop(1, "#fff6a0");
  x.fillStyle = fg; x.beginPath(); x.moveTo(-30, -8); x.quadraticCurveTo(-30 - fl, 0, -30, 8); x.fill();
  // gövde
  const bg = x.createLinearGradient(0, -14, 0, 14); bg.addColorStop(0, "#ffffff"); bg.addColorStop(0.5, "#c8c8dc"); bg.addColorStop(1, "#6a6a88");
  x.fillStyle = bg; x.beginPath(); x.moveTo(-30, -12); x.lineTo(18, -12); x.quadraticCurveTo(44, -6, 50, 0); x.quadraticCurveTo(44, 6, 18, 12); x.lineTo(-30, 12); x.closePath(); x.fill();
  x.fillStyle = "#ff3f5a"; x.beginPath(); x.moveTo(-26, -12); x.lineTo(-38, -26); x.lineTo(-10, -12); x.fill(); x.beginPath(); x.moveTo(-26, 12); x.lineTo(-38, 26); x.lineTo(-10, 12); x.fill();
  x.fillRect(-30, -3, 44, 6);
  // kokpit ve pilot
  x.fillStyle = "#18e0ff"; x.beginPath(); x.ellipse(20, -9, 13, 9, 0, Math.PI, 0); x.fill();
  x.fillStyle = "#f0c08a"; x.beginPath(); x.arc(20, -10, 5, 0, Math.PI * 2); x.fill();
  x.fillStyle = "#1a1410"; x.beginPath(); x.arc(20, -12, 5, Math.PI, 0); x.fill();
  x.fillStyle = "rgba(255,255,255,.5)"; x.beginPath(); x.ellipse(15, -13, 4, 2, -0.4, 0, Math.PI * 2); x.fill();
  x.restore();
}
function vtext(x, s, px, py, size, col, align = "left", font = PX) {
  x.font = `${size}px ${font}`; x.textAlign = align; x.textBaseline = "top"; x.fillStyle = col; x.fillText(s, px, py);
}
function drawPanel(x, t) {
  const [lx, ly, lw, lh] = BOX.logo;
  x.save(); x.beginPath(); x.rect(lx, ly, lw, lh); x.clip();
  drawRocket(x, lx + 250, ly + 150 + Math.sin(t * 1.7) * 6, t);
  // logo yazısı
  x.save(); x.translate(lx + 20, ly + 18); x.rotate(-0.05);
  x.font = `30px ${BG}`; x.textBaseline = "top";
  x.lineWidth = 6; x.strokeStyle = "#1a0a3a"; x.strokeText("YILDIZ", 0, 0);
  const g1 = x.createLinearGradient(0, 0, 0, 34); g1.addColorStop(0, "#e6c8ff"); g1.addColorStop(1, "#8a3cff"); x.fillStyle = g1; x.fillText("YILDIZ", 0, 0);
  x.font = `46px ${BG}`;
  x.strokeText("PİLOTU", 10, 34);
  const g2 = x.createLinearGradient(0, 34, 0, 86); g2.addColorStop(0, "#fff3a0"); g2.addColorStop(0.5, "#ffb000"); g2.addColorStop(1, "#ff5a1a"); x.fillStyle = g2; x.fillText("PİLOTU", 10, 34);
  x.restore();
  vtext(x, "UZAY PİNBALI", lx + 32, ly + 92, 9, "#9ad0ff");
  // top göstergesi
  vtext(x, "TOP", lx + 196, ly + lh - 38, 16, "#ff3f5a", "right");
  x.fillStyle = "#6c6c80"; x.fillRect(lx + 204, ly + lh - 48, 40, 40); x.fillStyle = "#300810"; x.fillRect(lx + 207, ly + lh - 45, 34, 34);
  vtext(x, String(Math.min(G.ballNo, 3)), lx + 224, ly + lh - 37, 18, "#ff3f5a", "center");
  x.restore();
  // oyuncu ve skor
  const [px, py, pw, ph] = BOX.player; vtext(x, "1", px + pw / 2, py + 20, 22, "#7a9cff", "center");
  const [sx, sy, sw, sh] = BOX.score;
  const sc = fmt(G.score), fs = sc.length > 11 ? 18 : 22;
  x.shadowColor = "#3a6aff"; x.shadowBlur = 10; vtext(x, sc, sx + sw - 12, sy + (sh - fs) / 2, fs, "#9ab4ff", "right"); x.shadowBlur = 0;
  // mesaj kutusu
  const [mx, my, mw, mh] = BOX.msg;
  let L;
  if (G.paused) L = ["DURAKLATILDI", "P: DEVAM", ""];
  else if (G.bonusT > 0) L = ["TOP KAYBEDİLDİ", "BONUS x" + G.mult, fmt(G.bonusShow)];
  else if (G.msg && G.msg.t > 0) L = G.msg.l;
  else if (G.mission) L = [G.mission.name, G.mission.how, "KALAN " + Math.max(0, G.mission.need - G.mProg)];
  else if (!G.launched) L = ["TOP " + Math.min(G.ballNo, 3) + " HAZIR", "BOŞLUK BASILI TUT", "BIRAK: FIRLAT"];
  else if (G.lockLit) L = ["KİLİT AÇIK", "KARA DELİĞE GİR", "KİLİT " + G.locked + "/2"];
  else L = ["GÖREV YOK", "KARA DELİĞE GİR", "YENİ GÖREV AL"];
  const hot = G.msg && G.msg.t > 0 && G.msg.hot && ((t * 6) | 0) % 2;
  [hot ? "#ffffff" : "#ffd23f", "#e9e7f2", "#18e0ff"].forEach((col, i) => {
    const s = L[i]; if (!s) return; const size = s.length > 18 ? 12 : 15;
    vtext(x, s, mx + mw / 2, my + 26 + i * 44, size, col, "center");
  });
  // bilgi kutusu
  const [ix, iy, iw] = BOX.info;
  vtext(x, "RÜTBE", ix + 16, iy + 14, 10, "#8a8aa8");
  vtext(x, RANKS[G.rank], ix + 16, iy + 30, 14, "#ffffff");
  for (let k = 0; k < RANKS.length; k++) { x.fillStyle = k <= G.rank ? "#ffd23f" : "#2a2a3a"; x.fillRect(ix + 16 + k * 36, iy + 52, 30, 6); }
  vtext(x, "ÇARPAN", ix + 16, iy + 72, 10, "#8a8aa8"); vtext(x, "x" + G.mult, ix + 16, iy + 88, 14, "#ff3fa4");
  vtext(x, "KİLİT", ix + 130, iy + 72, 10, "#8a8aa8"); vtext(x, G.multi ? "ÇOKLU" : G.locked + "/2", ix + 130, iy + 88, 14, G.lockLit || G.multi ? "#ffd23f" : "#6a6a7a");
  vtext(x, "EKSTRA", ix + 240, iy + 72, 10, "#8a8aa8"); vtext(x, String(G.extra), ix + 240, iy + 88, 14, G.extra ? "#3dff7a" : "#6a6a7a");
  if (G.mission) {
    x.fillStyle = "#1a1a2a"; x.fillRect(ix + 16, iy + 112, iw - 32, 8);
    x.fillStyle = "#18e0ff"; x.fillRect(ix + 16, iy + 112, (iw - 32) * clamp(G.mProg / G.mission.need, 0, 1), 8);
  }
  vtext(x, "REKOR " + fmt(Math.max(G.hiAtStart, G.score)), ix + 16, iy + 130, 10, "#8a8aa8");
  vtext(x, "Z/← SOL PALET · SAĞ SHIFT/→ SAĞ", ix + 16, iy + 148, 7, "#55557a");
  vtext(x, "BOŞLUK FIRLAT · X . ↑ SARS", ix + 16, iy + 161, 7, "#55557a");
  vtext(x, "P DURAKLAT · M MÜZİK · F2 YENİ · ESC", ix + 16, iy + 174, 7, "#55557a");
}

/* ── dinamik masa çizimi (üstten görünüm ara tuvale) ── */
function glow(x, px, py, r, col, a = 1) {
  const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, hexA(col, 0.9 * a)); g.addColorStop(0.4, hexA(col, 0.4 * a)); g.addColorStop(1, hexA(col, 0));
  x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
}
function lamp(x, px, py, r, col, on) {
  if (!on) return;
  x.globalCompositeOperation = "lighter"; glow(x, px, py, r * 2.6, col, 0.8); x.globalCompositeOperation = "source-over";
  x.fillStyle = col; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
  x.fillStyle = "rgba(255,255,255,.7)"; x.beginPath(); x.arc(px - r * 0.3, py - r * 0.3, r * 0.4, 0, Math.PI * 2); x.fill();
}
function drawBall(x, b) {
  const z = b.mode === "ramp" ? b.z : 0, r = R * (1 + z * 0.35), sx = 3 + z * 14, sy = 4 + z * 18;
  x.fillStyle = `rgba(0,0,0,${0.45 - z * 0.15})`; x.beginPath(); x.ellipse(b.x + sx, b.y + sy, r, r * 0.8, 0, 0, Math.PI * 2); x.fill();
  if (b.mode === "play" && b.prev.length > 3) { // hız izi
    const [ox, oy] = b.prev[b.prev.length - 1], sp = Math.hypot(b.x - ox, b.y - oy);
    if (sp > 20) { x.strokeStyle = "rgba(200,220,255,.18)"; x.lineWidth = R * 1.4; x.lineCap = "round"; x.beginPath(); x.moveTo(ox, oy); x.lineTo(b.x, b.y); x.stroke(); }
  }
  const g = x.createRadialGradient(b.x - r * 0.35, b.y - r * 0.4, r * 0.1, b.x, b.y, r);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.35, "#d8dae8"); g.addColorStop(0.75, "#7a7c94"); g.addColorStop(1, "#2a2a3a");
  x.fillStyle = g; x.beginPath(); x.arc(b.x, b.y - z * 6, r, 0, Math.PI * 2); x.fill();
  x.fillStyle = "rgba(120,180,255,.35)"; x.beginPath(); x.ellipse(b.x + r * 0.2, b.y + r * 0.45 - z * 6, r * 0.55, r * 0.22, 0, 0, Math.PI * 2); x.fill();
}
function drawFlipper(x, f) {
  const c = Math.cos(f.a), s = Math.sin(f.a), tx = f.px + c * FLIP_L, ty = f.py + s * FLIP_L, r0 = 10, r1 = 5.5;
  const shape = (ox, oy) => {
    x.beginPath();
    x.moveTo(f.px + ox - s * r0, f.py + oy + c * r0); x.lineTo(tx + ox - s * r1, ty + oy + c * r1);
    x.arc(tx + ox, ty + oy, r1, f.a + Math.PI / 2, f.a - Math.PI / 2, true);
    x.lineTo(f.px + ox + s * r0, f.py + oy - c * r0);
    x.arc(f.px + ox, f.py + oy, r0, f.a - Math.PI / 2, f.a + Math.PI / 2, true); x.closePath();
  };
  shape(4, 6); x.fillStyle = "rgba(0,0,0,.45)"; x.fill();
  shape(0, 0); x.fillStyle = "#c81e3c"; x.fill(); // kırmızı lastik
  x.save(); x.translate(f.px, f.py); x.scale(0.82, 0.82); x.translate(-f.px, -f.py);
  shape(0, 0);
  const g = x.createLinearGradient(f.px - s * 10, f.py + c * 10, f.px + s * 10, f.py - c * 10);
  g.addColorStop(0, G.tilted ? "#5a5a6a" : "#c8c0a8"); g.addColorStop(1, G.tilted ? "#8a8a9a" : "#fffaf0"); x.fillStyle = g; x.fill();
  x.restore();
  x.fillStyle = "#3a3a4e"; x.beginPath(); x.arc(f.px, f.py, 3.5, 0, Math.PI * 2); x.fill();
  x.fillStyle = "#9a9ab0"; x.beginPath(); x.arc(f.px - 1, f.py - 1, 1.5, 0, Math.PI * 2); x.fill();
}
function drawTable(t) {
  const x = tx; x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(bed, 0, 0); x.setTransform(S, 0, 0, S, 0, 0);
  const blink = (hz = 3, ph = 0) => ((t * hz + ph) | 0) % 2 === 0;
  const mk2 = G.mission && !G.tilted ? G.mission.k : null;
  const attract = G.over;
  // ışıklar
  LANE_X.forEach((lx, i) => lamp(x, lx, 92, 6, "#3dff7a", attract ? blink(4, i * 0.33) : G.lanes[i] || (G.skillT > 0 && i === G.skillLane && blink(8)) || (mk2 === "lane" && blink(2))));
  DROPS_X.forEach((dx, i) => lamp(x, dx, 406, 5, "#ffd23f", attract ? blink(3, i * 0.3) : !G.drops[i] || (mk2 === "drop" && blink(2))));
  STAND_Y.forEach((y, i) => lamp(x, 72, y, 5, "#18e0ff", attract ? blink(3, i * 0.3) : G.stands[i] || (mk2 === "stand" && blink(2))));
  for (let k = 0; k < 4; k++) lamp(x, 129 + k * 24, 432, 7, "#ff3fa4", attract ? blink(2, k * 0.25) : G.mult >= k + 2);
  const bfill = Math.min(10, Math.floor(G.bonus / 4000));
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 - Math.PI / 2; lamp(x, 165 + Math.cos(a) * 30, 470 + Math.sin(a) * 30, 4, "#18e0ff", attract ? ((t * 10) | 0) % 10 === k : k < bfill); }
  x.globalCompositeOperation = "lighter"; glow(x, 165, 470, 20 + Math.sin(t * 3) * 3, G.multi ? "#ff3fa4" : "#18e0ff", 0.5 + bfill * 0.05); x.globalCompositeOperation = "source-over";
  lamp(x, 26, 512, 7, "#ff8a3d", G.kickback && (G.kbFl > 0 ? blink(10) : true));
  lamp(x, 165, 600, 7, "#3dff7a", G.saveT > 0 && G.launched && (G.saveT < 3 ? blink(8) : true));
  lamp(x, 240, 334, 4.5, "#ffd23f", G.locked >= 1 || (G.lockLit && blink(3)) || G.multi);
  lamp(x, 256, 340, 4.5, "#ffd23f", G.locked >= 2 || (G.lockLit && blink(3, 0.5)) || G.multi);
  const want = { ramp: mk2 === "ramp" || (G.multi && G.jackpot), orbit: mk2 === "orbit", orbitL: mk2 === "orbit", hole: !G.mission || mk2 === "hole" || G.lockLit };
  for (const k in ARROWS) {
    const a = ARROWS[k];
    if (!(attract ? blink(2, k.length * 0.2) : want[k] && blink(G.multi && k === "ramp" ? 8 : 3))) continue;
    x.globalCompositeOperation = "lighter"; glow(x, a.x, a.y, 24, a.c, 0.7); x.globalCompositeOperation = "source-over";
    x.fillStyle = a.c; arrowPath(x, a.x, a.y, a.a, 11); x.fill();
  }
  // kara delik sarmalı
  const busy = G.balls.some((b) => b.mode === "hole");
  for (let k = 0; k < 6; k++) {
    x.strokeStyle = hexA(k % 2 ? "#b26bff" : "#18e0ff", 0.35 + 0.1 * k); x.lineWidth = 2;
    const rr = (5 + k * 2.6) * (busy ? 1.25 : 1), sp = busy ? 9 : 2.5;
    x.beginPath(); x.arc(HOLE.x, HOLE.y, rr, -t * (sp + k) + k, -t * (sp + k) + k + 2.4); x.stroke();
  }
  x.fillStyle = "#000"; x.beginPath(); x.arc(HOLE.x, HOLE.y, 6, 0, Math.PI * 2); x.fill();
  if (busy) { x.globalCompositeOperation = "lighter"; glow(x, HOLE.x, HOLE.y, 30, "#b26bff", 0.7); x.globalCompositeOperation = "source-over"; }
  // kalkan hedefleri (sol duvar)
  STAND_Y.forEach((y, i) => {
    x.fillStyle = "rgba(0,0,0,.4)"; x.fillRect(55, y - 11, 8, 26);
    x.fillStyle = G.standFl[i] > 0 ? "#ffffff" : G.stands[i] ? "#18e0ff" : "#1a6a8a"; x.fillRect(53, y - 12, 6, 24);
    x.fillStyle = "rgba(255,255,255,.5)"; x.fillRect(53, y - 12, 2, 24);
  });
  // düşen hedefler
  DROPS_X.forEach((dx, i) => {
    if (G.drops[i]) {
      x.fillStyle = "rgba(0,0,0,.45)"; x.fillRect(dx - 12, DROP_Y + 2, 28, 10);
      const g = x.createLinearGradient(0, DROP_Y - 6, 0, DROP_Y + 6); g.addColorStop(0, "#ffd0a0"); g.addColorStop(0.4, "#ff8a3d"); g.addColorStop(1, "#8a3a10");
      x.fillStyle = g; x.fillRect(dx - 13, DROP_Y - 5, 26, 10);
      x.fillStyle = "#2a0a00"; x.font = `7px ${PX}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("★", dx, DROP_Y + 0.5);
    } else { x.fillStyle = "#1a0e08"; x.fillRect(dx - 13, DROP_Y - 1, 26, 3); if (G.dropFl[i] > 0) { x.globalCompositeOperation = "lighter"; glow(x, dx, DROP_Y, 20, "#ff8a3d", G.dropFl[i] * 2); x.globalCompositeOperation = "source-over"; } }
  });
  // sapan lastikleri ve direkler
  slings.forEach((s, i) => {
    const on = G.slingFl[i] > 0; x.strokeStyle = on ? "#ffffff" : mk2 === "sling" && blink(3) ? "#ffd23f" : "#1a1a22"; x.lineWidth = on ? 5 : 4;
    x.beginPath(); x.moveTo(s.ax, s.ay); x.lineTo(s.bx + (on ? (i ? 3 : -3) : 0), s.by); x.stroke();
    if (on) { x.globalCompositeOperation = "lighter"; glow(x, (s.ax + s.bx) / 2, (s.ay + s.by) / 2, 30, "#b26bff", 0.8); x.globalCompositeOperation = "source-over"; }
  });
  for (const p of posts) {
    x.fillStyle = "rgba(0,0,0,.45)"; x.beginPath(); x.arc(p.x + 2, p.y + 3, p.r + 1, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#16161e"; x.beginPath(); x.arc(p.x, p.y, p.r + 0.5, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#e8e4ff"; x.beginPath(); x.arc(p.x - 0.6, p.y - 0.6, p.r * 0.45, 0, Math.PI * 2); x.fill();
  }
  // bumperlar
  BUMPERS.forEach((u, i) => {
    const on = G.bumpFl[i] > 0, hint = mk2 === "bumper" && blink(3, i * 0.3);
    x.fillStyle = "rgba(0,0,0,.5)"; x.beginPath(); x.ellipse(u.x + 5, u.y + 8, BR_ + 2, BR_, 0, 0, Math.PI * 2); x.fill();
    if (on) { x.globalCompositeOperation = "lighter"; glow(x, u.x, u.y, 48, u.c, 1); x.globalCompositeOperation = "source-over"; }
    x.fillStyle = "#101018"; x.beginPath(); x.arc(u.x, u.y, BR_ + 1, 0, Math.PI * 2); x.fill();
    x.strokeStyle = on || hint ? "#ffffff" : "#dcd8f0"; x.lineWidth = 3; x.beginPath(); x.arc(u.x, u.y, BR_ - 2.5, 0, Math.PI * 2); x.stroke();
    const sk = on ? 0.9 : 1, cg = x.createRadialGradient(u.x - 5, u.y - 6, 2, u.x, u.y, 15 * sk);
    cg.addColorStop(0, "#ffffff"); cg.addColorStop(0.35, on ? "#ffffff" : u.c); cg.addColorStop(1, hexA(u.c, 0.5));
    x.fillStyle = cg; x.beginPath(); x.arc(u.x, u.y - 2, 15 * sk, 0, Math.PI * 2); x.fill();
    x.fillStyle = on ? u.c : "#14121e"; x.font = `12px ${BG}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("★", u.x, u.y - 1);
  });
  // fırlatıcı
  const fy = G.floorY;
  x.fillStyle = "#2a2a36"; x.fillRect(PLUNGE_X - 4, fy + 4, 8, H - fy);
  x.strokeStyle = "#b8b8cc"; x.lineWidth = 1.6; x.beginPath();
  for (let y = fy + 6; y < 636; y += 3 + (1 - G.charge) * 2) { x.moveTo(PLUNGE_X - 7, y); x.lineTo(PLUNGE_X + 7, y + 1.5); } x.stroke();
  const pg = x.createLinearGradient(PLUNGE_X - 10, 0, PLUNGE_X + 10, 0); pg.addColorStop(0, "#8a1020"); pg.addColorStop(0.5, "#ff5a6a"); pg.addColorStop(1, "#6a0a18");
  x.fillStyle = pg; x.fillRect(PLUNGE_X - 11, fy, 22, 6);
  if (G.charge > 0) { x.fillStyle = hexA("#ffd23f", 0.7); x.fillRect(PLUNGE_X + 14 - 4, 630 - G.charge * 60, 3, G.charge * 60); }
  G.flips.forEach((f) => drawFlipper(x, f));
  for (const b of G.balls) if (b.mode === "play") drawBall(x, b);
  x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(rampLayer, 0, 0); x.setTransform(S, 0, 0, S, 0, 0);
  if (G.multi && G.jackpot) { x.globalAlpha = 0.25 + 0.2 * Math.sin(t * 8); x.globalCompositeOperation = "lighter"; x.drawImage(rampLayer, 0, 0, W, H); x.globalCompositeOperation = "source-over"; x.globalAlpha = 1; }
  for (const b of G.balls) if (b.mode === "ramp") drawBall(x, b);
  // parçacıklar ve uçan puanlar
  x.globalCompositeOperation = "lighter";
  for (const p of G.parts) { x.fillStyle = hexA(p.c, Math.min(1, p.l * 3)); x.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4); }
  x.globalCompositeOperation = "source-over";
  x.textAlign = "center"; x.textBaseline = "middle"; x.font = `9px ${PX}`;
  for (const p of G.pops) { x.globalAlpha = Math.min(1, p.t * 2); x.fillStyle = "#000"; x.fillText(p.txt, p.x + 1, p.y + 1); x.fillStyle = p.col; x.fillText(p.txt, p.x, p.y); }
  x.globalAlpha = 1;
  if (G.flash > 0) { x.fillStyle = `rgba(255,255,255,${G.flash * 0.18})`; x.fillRect(0, 0, W, H); }
  if (G.tilted && blink(2)) label(x, "TILT", 165, 300, 54, "#ff3f5a");
  if (G.over) { label(x, "OYUN", 165, 270, 44, "#ffd23f"); label(x, "BİTTİ", 165, 320, 44, "#ffd23f"); if (blink(2)) label(x, "BOŞLUK: YENİ OYUN", 165, 372, 10, "#ffffff", 0, PX); }
}
// Ara tuvali yamuğa bük: her ekran satırı, masanın perspektifle eşleşen satırından örneklenir
function warp(x) {
  const t = TRAP, a = t.wTop, b = t.wBot, y0 = (t.y0 + G.shake.y) * scale + offY, y1 = (t.y1 + G.shake.y) * scale + offY;
  const rows = Math.max(1, Math.round(y1 - y0)), step = rows > 900 ? 2 : 1;
  for (let r = 0; r < rows; r += step) {
    const s0 = r / rows, s1 = Math.min(1, (r + step) / rows);
    const v0 = (s0 * b) / (a + s0 * (b - a)), v1 = (s1 * b) / (a + s1 * (b - a));
    const sm = (s0 + s1) / 2, w = (a + (b - a) * sm) * scale, cxs = (t.cx + G.shake.x) * scale + offX;
    x.drawImage(tbl, 0, v0 * TH, TW, Math.max(0.5, (v1 - v0) * TH), cxs - w / 2, y0 + r, w, step + 0.6);
  }
}

/* ─────────────────────────── giriş ─────────────────────────── */
const inp = { L: false, R: false, P: false, hitL: false, hitR: false, relL: false, relR: false, nudge: null, lockP: false };
const KEYS = {
  KeyZ: "L", ShiftLeft: "L", ArrowLeft: "L",
  Slash: "R", ShiftRight: "R", ArrowRight: "R", NumpadDivide: "R",
  Space: "P", ArrowDown: "P", Enter: "P", NumpadEnter: "P",
};
function press(k) {
  if (k === "L") { if (!inp.L) inp.hitL = true; inp.L = true; }
  if (k === "R") { if (!inp.R) inp.hitR = true; inp.R = true; }
  if (k === "P") {
    if (G.over && G.overT > 1) { restart(); inp.lockP = true; }
    inp.P = true;
  }
}
function release(k) {
  if (k === "L" && inp.L) { inp.L = false; inp.relL = true; }
  if (k === "R" && inp.R) { inp.R = false; inp.relR = true; }
  if (k === "P") { inp.P = false; inp.lockP = false; }
}
function onKey(e) {
  if (!ov) return;
  e.stopImmediatePropagation();
  const down = e.type === "keydown";
  Snd.init(); Music.start();
  if (down && e.code === "Escape") { close(); e.preventDefault(); return; }
  if (down && !e.repeat) {
    if (e.code === "KeyP") G.paused = !G.paused;
    if (e.code === "KeyM") Snd.setMus(!Snd.musOn);
    if (e.code === "F2") { restart(); e.preventDefault(); return; }
    if (e.code === "KeyX") inp.nudge = [1, -0.6];
    if (e.code === "Period" || e.code === "NumpadDecimal") inp.nudge = [-1, -0.6];
    if (e.code === "ArrowUp") inp.nudge = [0, -1];
  }
  const k = KEYS[e.code];
  if (k) { e.preventDefault(); if (down) { if (!e.repeat) press(k); } else release(k); }
  else if (["ArrowUp", "KeyX", "Period", "F2", "Tab"].includes(e.code)) e.preventDefault();
}
// dokunmatik: ekranın sol/sağ yarısı paletler, düğmeler fırlatma ve sarsma
const touches = new Map();
function onPointer(e) {
  if (e.target.closest && e.target.closest("button")) return;
  Snd.init(); Music.start();
  if (e.type === "pointerdown") {
    const side = e.clientX < innerWidth / 2 ? "L" : "R"; touches.set(e.pointerId, side); press(side);
    if (G.over && G.overT > 1) restart();
    e.preventDefault();
  } else { const s = touches.get(e.pointerId); if (s) { touches.delete(e.pointerId); if (![...touches.values()].includes(s)) release(s); } }
}

/* ─────────────────────────── aç / kapat / döngü ─────────────────────────── */
let raf = 0, last = 0, onCloseCb = null, T = 0;
function layout() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  scale = Math.min(cv.width / VW, cv.height / VH);
  offX = (cv.width - VW * scale) / 2; offY = (cv.height - VH * scale) / 2;
}
function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; T += dt;
  update(dt);
  inp.hitL = inp.hitR = inp.relL = inp.relR = false;
  drawTable(T);
  const x = cx; x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = "#000"; x.fillRect(0, 0, cv.width, cv.height);
  x.imageSmoothingEnabled = true;
  x.drawImage(panelBg, offX, offY, VW * scale, VH * scale);
  warp(x);
  x.setTransform(scale, 0, 0, scale, offX, offY);
  drawPanel(x, T);
  // perspektifte uzak kısmı hafif karart
  const sh = x.createLinearGradient(0, TRAP.y0, 0, TRAP.y0 + 200); sh.addColorStop(0, "rgba(0,0,0,.35)"); sh.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = sh; x.beginPath(); x.moveTo(TRAP.cx - TRAP.wTop / 2, TRAP.y0); x.lineTo(TRAP.cx + TRAP.wTop / 2, TRAP.y0); x.lineTo(TRAP.cx + TRAP.wTop / 2 + 16, TRAP.y0 + 200); x.lineTo(TRAP.cx - TRAP.wTop / 2 - 16, TRAP.y0 + 200); x.fill();
  if (G.paused) { x.fillStyle = "rgba(0,0,0,.55)"; x.fillRect(0, 0, VW, VH); vtext(x, "DURAKLATILDI", 500, 320, 28, "#ffd23f", "center"); vtext(x, "P: DEVAM · ESC: ÇIK", 500, 366, 12, "#ffffff", "center"); }
}
function restart() {
  G = newGame(); startBall(); fx.start(); Music.mode = "calm";
  say("YILDIZ PİLOTU", "BOŞLUK BASILI TUT", "BIRAK: FIRLAT", 5);
}
const CSS = `
#ypOv{position:fixed;inset:0;z-index:99999;background:#000;touch-action:none;user-select:none;-webkit-user-select:none}
#ypOv canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#ypOv .yb{position:absolute;border:2px solid #6c6c80;background:rgba(10,10,20,.82);color:#e9e7f2;font:10px "Press Start 2P",monospace;border-radius:8px;padding:10px 12px;cursor:pointer}
#ypOv .yb:hover{border-color:#ffd23f;color:#ffd23f}
#ypTop{position:absolute;top:10px;right:10px;display:flex;gap:8px}#ypTop .yb{position:static}
#ypFire,#ypNudge{display:none;bottom:18px;padding:18px 20px;font-size:12px}
#ypFire{right:18px;border-color:#ff3f5a}#ypNudge{left:50%;transform:translateX(-50%)}
.yp-touch #ypFire,.yp-touch #ypNudge{display:block}
#ypRot{display:none;position:absolute;left:0;right:0;top:40%;text-align:center;color:#ffd23f;font:12px "Press Start 2P",monospace;line-height:2}
@media (orientation:portrait) and (pointer:coarse){#ypRot{display:block}}
`;
function open(opts = {}) {
  if (ov) return;
  onCloseCb = opts.onClose || null;
  Snd.on = !opts.muted; if (Snd.master) Snd.setOn(Snd.on);
  if (!document.getElementById("ypCss")) { const st = document.createElement("style"); st.id = "ypCss"; st.textContent = CSS; document.head.append(st); }
  ov = document.createElement("div"); ov.id = "ypOv";
  if (matchMedia("(pointer: coarse)").matches) ov.classList.add("yp-touch");
  ov.innerHTML = `<canvas></canvas>
    <div id="ypTop"><button class="yb" id="ypM" type="button" aria-label="Müzik">MÜZİK</button>
    <button class="yb" id="ypS" type="button" aria-label="Ses">${Snd.on ? "SES" : "SESSİZ"}</button>
    <button class="yb" id="ypX" type="button" aria-label="Kapat">✕</button></div>
    <button class="yb" id="ypFire" type="button">FIRLAT</button>
    <button class="yb" id="ypNudge" type="button">SARS</button>
    <div id="ypRot">Telefonu yan çevir</div>`;
  document.body.append(ov);
  cv = ov.querySelector("canvas"); cx = cv.getContext("2d");
  tbl = mk(TW, TH); tx = tbl.getContext("2d");
  ov.querySelector("#ypX").onclick = close;
  const sb = ov.querySelector("#ypS"); sb.onclick = () => { Snd.init(); Snd.setOn(!Snd.on); sb.textContent = Snd.on ? "SES" : "SESSİZ"; };
  const mb = ov.querySelector("#ypM"); mb.onclick = () => { Snd.init(); Snd.setMus(!Snd.musOn); mb.style.opacity = Snd.musOn ? 1 : 0.5; };
  const fire = ov.querySelector("#ypFire");
  fire.addEventListener("pointerdown", (e) => { e.preventDefault(); Snd.init(); Music.start(); press("P"); });
  fire.addEventListener("pointerup", () => release("P")); fire.addEventListener("pointerleave", () => release("P"));
  ov.querySelector("#ypNudge").addEventListener("pointerdown", (e) => { e.preventDefault(); inp.nudge = [rand(-1, 1), -0.8]; });
  ov.addEventListener("pointerdown", onPointer); ov.addEventListener("pointerup", onPointer); ov.addEventListener("pointercancel", onPointer);
  ov.addEventListener("contextmenu", (e) => e.preventDefault());
  window.addEventListener("keydown", onKey, true); window.addEventListener("keyup", onKey, true);
  window.addEventListener("resize", layout); window.addEventListener("blur", onBlur);
  layout();
  G = newGame(); startBall();
  paintPanel();
  const ready = Promise.race([Promise.all([document.fonts.load(`20px ${BG}`), document.fonts.load(`10px ${PX}`)]), new Promise((r) => setTimeout(r, 1500))]);
  bed = mk(1, 1); rampLayer = mk(1, 1);
  ready.then(() => { if (!ov) return; paintBed(); paintPanel(); });
  Snd.init(); Music.start(); fx.start();
  say("YILDIZ PİLOTU", "BOŞLUK BASILI TUT", "BIRAK: FIRLAT", 5);
  last = performance.now(); raf = requestAnimationFrame(frame);
}
function onBlur() { if (G && !G.over) G.paused = true; inp.L = inp.R = inp.P = false; }
function close() {
  if (!ov) return;
  cancelAnimationFrame(raf); Music.stop();
  if (window.speechSynthesis) speechSynthesis.cancel();
  window.removeEventListener("keydown", onKey, true); window.removeEventListener("keyup", onKey, true);
  window.removeEventListener("resize", layout); window.removeEventListener("blur", onBlur);
  if (G && G.score > +(store(HI_KEY) || 0)) store(HI_KEY, String(G.score));
  ov.remove(); ov = null; G = null;
  for (const k in inp) inp[k] = k === "nudge" ? null : false;
  if (onCloseCb) onCloseCb();
}

window.YildizPilotu = {
  open, close, isOpen: () => !!ov,
  _test: { state: () => G, walls, update, physics, inp, rampPos, newGame: () => { G = newGame(); startBall(); return G; } }, // test kancası
};
})();
