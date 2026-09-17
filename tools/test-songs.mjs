// Five discrete songs, one playing at a time, chosen by headcount.
//   node test-songs.mjs <audio.js>
import fs from 'node:fs';
import vm from 'node:vm';

const file = process.argv[2];
let pass = 0, fail = 0;
const ok = (n, c, d = '') => { if (c) { pass++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (d ? '  -- ' + d : '')); } };

let now = 0, gains = [], tracks = null;
const sched = [];
function mkParam() {
  const p = {
    value: 0, _target: null, _tau: 0, _t0: 0,
    setValueAtTime(v) { this.value = v; this._target = null; return this; },
    exponentialRampToValueAtTime() { return this; },
    linearRampToValueAtTime() { return this; },
    // model the real exponential approach so a held state can be checked for drift
    setTargetAtTime(v, t, tau) { this._settle(t); this._target = v; this._tau = tau; this._t0 = t; return this; },
    _settle(t) {
      if (this._target === null) return;
      const dt = Math.max(0, t - this._t0);
      this.value = this._target + (this.value - this._target) * Math.exp(-dt / Math.max(1e-4, this._tau));
      this._t0 = t;
    },
    read(t) { this._settle(t); return this.value; },
  };
  return p;
}
function mkNode(type) {
  const n = { __type: type, __to: null };
  n.gain = mkParam(); n.frequency = mkParam(); n.detune = mkParam();
  n.Q = { value: 0 }; n.pan = { value: 0 }; n.threshold = { value: 0 }; n.ratio = { value: 0 };
  n.connect = (d) => { n.__to = d; return d; };
  n.disconnect = () => {};
  n.start = () => {}; n.stop = () => { if (n.onended) { const f = n.onended; n.onended = null; f(); } };
  return n;
}
function trackOf(node) {
  let hops = 0, cur = node;
  while (cur && hops++ < 14) { const i = tracks ? tracks.indexOf(cur) : -1; if (i >= 0) return i; cur = cur.__to; }
  return -1;
}
class FakeCtx {
  constructor() { this.state = 'running'; this.sampleRate = 48000; this.destination = mkNode('dest'); }
  get currentTime() { return now; }
  createGain() { const g = mkNode('gain'); gains.push(g); return g; }
  // record when each voice starts AND when it is told to stop, so peak SIMULTANEITY can be
  // measured -- that is what the 48-voice cap actually counts, not the scheduling rate.
  createOscillator() {
    const o = mkNode('osc');
    o.start = (at) => { o.__rec = { track: trackOf(o.__to), freq: o.frequency.value, at: at ?? now, until: Infinity }; sched.push(o.__rec); };
    o.stop = (t) => { if (o.__rec) o.__rec.until = t ?? now; if (o.onended) { const f = o.onended; o.onended = null; f(); } };
    return o;
  }
  createBufferSource() {
    const b = mkNode('buf');
    b.start = (at) => { b.__rec = { track: trackOf(b.__to), freq: 0, at: at ?? now, until: Infinity }; sched.push(b.__rec); };
    b.stop = (t) => { if (b.__rec) b.__rec.until = t ?? now; if (b.onended) { const f = b.onended; b.onended = null; f(); } };
    return b;
  }
  createBiquadFilter() { return mkNode('filter'); }
  createStereoPanner() { return mkNode('pan'); }
  createConvolver() { return mkNode('conv'); }
  createDynamicsCompressor() { return mkNode('comp'); }
  createBuffer(c, l) { return { getChannelData: () => new Float32Array(l) }; }
  resume() { return Promise.resolve(); }
}
const sandbox = { AudioContext: FakeCtx, document: { hidden: false }, localStorage: { getItem: () => null, setItem: () => {} }, console, Math, Number, Set, Map, Float32Array, Promise, String };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
const A = sandbox.DSAudio;
A.unlock();
for (let i = gains.length - 5; i >= 0; i--) {
  const g = gains.slice(i, i + 5);
  if (g[0].gain.value === 1 && g.slice(1).every((x) => x.gain.value === 0)) { tracks = g; break; }
}
ok('five song buses exist, only the first up at boot', !!tracks, `found ${gains.length} gains`);

const st = { mode: 'play', paused: false, time: 0, wave: 1, threat: 1, surge: 'SWELL', players: [{ id: 0, x: 0, y: 0, dead: false }], enemies: [], audioEvents: [], boss: null };
// every enemy must sit INSIDE the 330u radius audio.js counts, or the fixture silently
// under-reports: a linear spread put anything past i=48 out of range and capped the tier at fight.
const setCrowd = (n) => {
  st.enemies = Array.from({ length: n }, (_, i) => {
    const r = 30 + (i % 24) * 11;                 // 30..283, always well inside 330
    return { x: Math.cos(i * 2.4) * r, y: Math.sin(i * 2.4) * r, dead: false };
  });
};
const run = (secs) => { const f = Math.round(secs * 60); for (let i = 0; i < f; i++) { now += 1 / 60; st.time += 1 / 60; A.update(st); } };
const mix = () => tracks.map((g) => Math.max(0, Math.min(1, g.gain.read(now))));
const loudest = () => { const m = mix(); return m.indexOf(Math.max(...m)); };

// ---- which song for which headcount ----
const NAMES = ['explore', 'prowl', 'fight', 'swarm', 'furnace'];
const cases = [[0, 0], [5, 0], [20, 1], [45, 2], [80, 3]];
for (const [crowd, want] of cases) {
  setCrowd(crowd); run(8);
  ok(`${String(crowd).padStart(2)} infected -> ${NAMES[want]}`, loudest() === want,
     `got ${NAMES[loudest()]}  mix ${mix().map((v) => v.toFixed(2)).join(' ')}`);
}

// ---- only one song is up once a swap has settled ----
setCrowd(45); run(10);
const m = mix();
ok('only one song is audible at rest', m.filter((v) => v > 0.05).length === 1, m.map((v) => v.toFixed(2)).join(' '));

// ---- THE REGRESSION: a held headcount must not drain ----
setCrowd(45); run(10);
const a = mix()[2];
run(25);
const b = mix()[2];
ok('a held headcount does not drain the song', Math.abs(a - b) < 0.02, `after settle ${a.toFixed(3)} -> 25s later ${b.toFixed(3)}`);

// ---- hysteresis: hovering on a boundary must not flap ----
setCrowd(30); run(8);
const before = loudest();
let flips = 0, last = before;
for (let i = 0; i < 12; i++) { setCrowd(i % 2 ? 29 : 31); run(1.5); const cur = loudest(); if (cur !== last) { flips++; last = cur; } }
ok('hovering on the 30 boundary does not flap the song', flips === 0, `${flips} swaps while oscillating 29/31`);

// ---- losing the horde returns to exploration ----
setCrowd(80); run(8);
setCrowd(0); run(14);
ok('losing the horde fades back to exploration', loudest() === 0, `mix ${mix().map((v) => v.toFixed(2)).join(' ')}`);

// ---- the boss takes the room ----
st.boss = { active: true, phase: 1, hp: 100, maxHp: 100, ai: { mode: 'active' } };
setCrowd(40); run(4);
ok('the furnace takes over from any song', loudest() === 4, `mix ${mix().map((v) => v.toFixed(2)).join(' ')}`);
st.boss = null; setCrowd(0); run(14);

// ---- each song is materially its own piece ----
// NOTE: an earlier version of this asserted that each tier schedules MORE voices than the one
// below it. That was an assumption about what intensity means, not a requirement -- a heavier
// song can be sparser and lower. It was also actively harmful: the swarm song it passed sat at
// ~47 voices a bar against a global cap of 48 that gunfire shares, so it dropped its own notes
// in the exact situation it exists for. What actually matters is voice headroom and distinctness.
const rates = [];
for (const [crowd, idx] of [[0, 0], [20, 1], [45, 2], [80, 3]]) {
  setCrowd(crowd); run(10);
  sched.length = 0; run(12);
  const mine = sched.filter((x) => x.track === idx);
  const f = mine.map((x) => x.freq).filter((x) => x > 0).sort((a, b) => a - b);
  // sweep the start/stop events to find the most voices this song ever has live at once
  const ev = [];
  for (const v of mine) { ev.push([v.at, 1]); ev.push([Number.isFinite(v.until) ? v.until : v.at + .2, -1]); }
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let live = 0, peak = 0;
  for (const [, d] of ev) { live += d; if (live > peak) peak = live; }
  rates.push({ name: NAMES[idx], n: mine.length, med: f.length ? f[Math.floor(f.length / 2)] : 0,
               // the rule is the GUN BAND specifically (1.5-4kHz), not "anything high". An earlier
               // version checked >2000, which also condemned the deliberate 4.7-7.5kHz whine that
               // gives the swarm song its dread -- the label said 1.5-4k while the code said >2k.
               hi: f.filter((x) => x >= 1500 && x <= 4000).length,
               above: f.filter((x) => x > 4000).length, peak });
}
console.log('\nper 12s: ' + rates.map((r) => `${r.name} ${r.n} voices, median ${Math.round(r.med)}Hz, ${r.hi} in gun band, ${r.above} above 4k, peak ${r.peak} live`).join('\n         '));

ok('every song leaves real headroom under the 48-voice cap',
   rates.every((r) => r.peak <= 16),
   rates.map((r) => r.name + ' peak ' + r.peak).join(' ') + ' (gunfire shares the same 48)');
ok('no song fights the guns in the 1.5-4kHz band they own',
   rates.every((r) => r.hi === 0), rates.map((r) => r.name + '=' + r.hi).join(' '));
const dens = rates.map((r) => r.n);
ok('the four songs are materially different from each other',
   new Set(dens).size === 4 && Math.max(...dens) > Math.min(...dens) * 2,
   dens.join(' '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
