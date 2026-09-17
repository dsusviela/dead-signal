// The score: a stealth-aware director, six quarter palettes, one layered arrangement.
//   node tools/test-score.mjs [audio.js]
// Runs the real audio.js against a fake AudioContext that records every voice: when it starts, when it stops,
// which layer it routes into, its pitch, and (for noise) its filter. Nothing here can HEAR the music -- the bench
// (tools/music-bench.mjs) is the review surface for taste. This guards the mechanism and the hard limits.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2] || path.join(root, 'audio.js');
let pass = 0, fail = 0;
const ok = (n, c, d = '') => { if (c) { pass++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (d ? '  -- ' + d : '')); } };

let now = 0, bus = null;
const sched = [];
function mkParam(owner) {
  return {
    owner, value: 0, _target: null, _tau: 0, _t0: 0,
    setValueAtTime(v) { this.value = v; this._target = null; return this; },
    exponentialRampToValueAtTime() { return this; },
    linearRampToValueAtTime() { return this; },
    setTargetAtTime(v, t, tau) { this._settle(t); this._target = v; this._tau = tau; this._t0 = t; return this; },
    _settle(t) {
      if (this._target === null) return;
      const dt = Math.max(0, t - this._t0);
      this.value = this._target + (this.value - this._target) * Math.exp(-dt / Math.max(1e-4, this._tau));
      this._t0 = t;
    },
    read(t) { this._settle(t); return this.value; },
  };
}
function mkNode(type) {
  const n = { __type: type, __to: [] };
  for (const p of ['gain', 'frequency', 'detune', 'delayTime', 'Q', 'pan', 'threshold', 'ratio']) n[p] = mkParam(n);
  n.connect = (d) => { n.__to.push(d.owner || d); return d; };
  n.disconnect = () => {};
  n.setPeriodicWave = () => {};
  return n;
}
// walk the graph forward until a layer gain is reached
function layerOf(node) {
  const names = Object.keys(bus), seen = new Set(), queue = [node];
  while (queue.length) {
    const cur = queue.shift(); if (!cur || seen.has(cur)) continue; seen.add(cur);
    for (const k of names) if (bus[k] === cur) return k;
    queue.push(...cur.__to);
  }
  return null;
}
function source(type) {
  const s = mkNode(type);
  s.start = (at) => { s.__rec = { node: s, type, queued: now, at: at ?? now, until: Infinity, freq: s.frequency.value }; sched.push(s.__rec); };
  s.stop = (t) => { if (s.__rec) s.__rec.until = t ?? now; if (s.onended) { const f = s.onended; s.onended = null; f(); } };
  return s;
}
class FakeCtx {
  constructor() { this.state = 'running'; this.sampleRate = 8000; this.destination = mkNode('dest'); }
  get currentTime() { return now; }
  createGain() { return mkNode('gain'); }
  createOscillator() { return source('osc'); }
  createBufferSource() { return source('buf'); }
  createBiquadFilter() { const f = mkNode('filter'); f.type = 'lowpass'; return f; }
  createStereoPanner() { return mkNode('pan'); }
  createConvolver() { return mkNode('conv'); }
  createDynamicsCompressor() { return mkNode('comp'); }
  createWaveShaper() { return mkNode('shaper'); }
  createDelay() { return mkNode('delay'); }
  createPeriodicWave() { return {}; }
  createBuffer(c, l) { return { getChannelData: () => new Float32Array(l) }; }
  resume() { return Promise.resolve(); }
}
let district = 'checkpoint';
const sandbox = { AudioContext: FakeCtx, document: { hidden: false }, localStorage: { getItem: () => null, setItem: () => {} },
  DSWorld: { district: () => ({ id: district }) }, console, Math, Number, Set, Map, Float32Array, Promise, String, Object };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
const A = sandbox.DSAudio;
A.unlock();
bus = A.musicBus;
ok('the score builds its layer buses', !!bus && ['bed', 'texture', 'motif', 'pulse', 'combat', 'overrun', 'boss', 'sting', 'drone'].every((k) => bus[k]));
// resolve each recorded voice's layer lazily (connections happen before start, so this is stable)
const layerFor = (r) => (r.layer === undefined ? (r.layer = layerOf(r.node)) : r.layer);

const st = { mode: 'play', paused: false, time: 0, wave: 1, threat: 1, surge: 'SWELL', camera: { x: 0, y: 0 }, players: [{ id: 0, x: 0, y: 0, dead: false }], enemies: [], audioEvents: [], boss: null };
// n infected, all inside the 330u radius, `chase` of them chasing and `alert` of them investigating
const crowd = (n, chase = 0, alert = 0) => {
  st.enemies = Array.from({ length: n }, (_, i) => {
    const r = 30 + (i % 24) * 11;
    return { x: Math.cos(i * 2.4) * r, y: Math.sin(i * 2.4) * r, dead: false,
      state: i < chase ? 'chase' : i < chase + alert ? 'investigate' : 'roam', alert: i < chase + alert };
  });
};
const run = (secs, each) => { const f = Math.round(secs * 60); for (let i = 0; i < f; i++) { now += 1 / 60; st.time += 1 / 60; if (each) each(i); A.update(st); } };
const state = () => A.status.musicState;

// ---- the director ----
crowd(0); run(3);
ok('an empty street is calm', state() === 'calm', state());
crowd(3, 0, 1); run(1);
ok('one infected investigating -> suspense', state() === 'suspense', state());
crowd(5, 5); run(1);
ok('five chasing -> fight, within a beat', state() === 'fight', state());
crowd(80, 60); run(2);
ok('a chasing horde -> overrun', state() === 'overrun', state());
crowd(0); run(3);
ok('overrun does not drop the moment the horde is gone', state() === 'overrun', state());
run(30);
ok('losing the horde walks back down to calm', state() === 'calm', state());
crowd(16); run(4);
ok('sixteen unaware infected nearby -> suspense', state() === 'suspense', state());
crowd(10); run(1); const early = state(); run(12);
ok('suspense holds on a small crowd inside its margin', early === 'suspense' && state() === 'suspense', `${early} -> ${state()} (10 nearby is inside the hold margin)`);
crowd(0); run(16);
ok('suspense falls to calm after its dwell', state() === 'calm', state());
crowd(2); run(1);
st.audioEvents.push({ type: 'hurt' }); run(1);
ok('taking damage is a fight', state() === 'fight', state());
crowd(0); run(25);
crowd(0); st.audioEvents.push({ type: 'shot', detail: 'pistol' }); run(1);
ok('a shot with nobody near does not start a fight', state() === 'calm', state());
crowd(0); run(25); crowd(2); st.audioEvents.push({ type: 'shot', detail: 'pistol' }); run(1);
ok('picking off a straggler or two is not a fight', state() !== 'fight', state());
crowd(0); run(25);

// the regression the old score had: a held situation must not drain
crowd(45); run(6); const held = state(); let changed = 0;
run(25, () => { if (state() !== held) changed++; });
ok('a held crowd of 45 holds its state', held === 'fight' && changed === 0, `${held}, ${changed} frames changed`);
// hovering on the 40 boundary must not flap
crowd(41); run(4); let flips = 0, last = state();
for (let i = 0; i < 12; i++) { crowd(i % 2 ? 39 : 41); run(1.5); if (state() !== last) { flips++; last = state(); } }
ok('hovering on the 40 boundary does not flap', flips === 0, `${flips} changes`);
// CREST lifts a real fight into overrun
crowd(45, 16); st.surge = 'CREST'; run(2);
ok('CREST over a fight is overrun', state() === 'overrun', state());
st.surge = 'SWELL'; crowd(0); run(40);

// ---- quarters ----
ok('starts in the camera\'s quarter', A.status.quarter === 'checkpoint', A.status.quarter);
district = 'ruins'; run(1.2); district = 'checkpoint'; run(6);
ok('passing through a quarter for a second does not switch', A.status.quarter === 'checkpoint', A.status.quarter);
district = 'ruins'; run(9);
ok('staying in a new quarter switches at the next bar', A.status.quarter === 'ruins', A.status.quarter);

// ---- a survivor going down is its own sound, not part of the arrangement ----
st.players.push({ id: 1, x: 10, y: 0, dead: false }); run(1);
const downFrom = now; st.players[1].dead = true; run(3);
const downVoices = sched.filter((r) => r.at >= downFrom && layerFor(r) === 'down');
ok('a survivor going down plays its own sting on its own bus', downVoices.length >= 5, downVoices.length + ' voices');
ok('the down sting stays out of the gun band', downVoices.every((r) => r.freq < 1500 || r.freq > 4000),
  downVoices.map((r) => Math.round(r.freq)).join(' '));
st.players.pop(); run(1);
// with the music off a survivor going down still sounds, on the effects bus
A.toggleMusic(); st.players.push({ id: 1, x: 10, y: 0, dead: false }); run(.5);
const offFrom = now; st.players[1].dead = true; run(1);
const offDown = sched.filter((r) => r.at >= offFrom);
ok('with the music off a survivor going down still sounds, off the music bus', offDown.length >= 5 && offDown.every((r) => !layerFor(r)), offDown.length + ' voices');
st.players.pop(); A.toggleMusic(); run(1);
// a level-up is the notification chime, on the same bus: a ring far above the guns and a low bell
const levelFrom = now; st.audioEvents.push({ type: 'level' }); run(1);
const chime = sched.filter((r) => r.at >= levelFrom && layerFor(r) === 'down');
ok('a level-up chimes: a ring above 4 kHz and a low bell, nothing in the gun band', chime.some((r) => r.freq > 4000) && chime.some((r) => r.freq < 120) && chime.every((r) => r.freq < 1500 || r.freq > 4000), chime.map((r) => Math.round(r.freq)).join(' '));

// ---- the boss takes the room ----
st.boss = { active: true, phase: 1, hp: 100, maxHp: 100, ai: { mode: 'active' } };
crowd(40, 20); run(3);
const mixAt = (k) => bus[k].gain.read(now);
ok('the furnace takes over from any state', state() === 'boss' && mixAt('boss') > .9 && mixAt('combat') < .05, `${state()} boss ${mixAt('boss').toFixed(2)} combat ${mixAt('combat').toFixed(2)}`);
st.boss.phase = 3; run(6);
st.boss = null; crowd(0); run(40);
ok('after the boss the city score returns', state() === 'calm' && mixAt('boss') < .05, `${state()} boss ${mixAt('boss').toFixed(2)}`);

// ---- every quarter x state: voices, the gun band, no beds, distinctness ----
const SCEN = { calm: [0, 0, 0], suspense: [12, 0, 4], fight: [40, 20, 0], overrun: [80, 60, 0] };
const results = [];
const sweep = (q, name, setup, secs = 16) => {
  district = q; st.surge = 'SWELL'; crowd(0); run(40);   // settle to calm in this quarter first
  setup(); run(6);
  sched.length = 0; const from = now; run(secs);
  const mine = sched.filter((r) => r.at >= from && layerFor(r));
  const ev = [];
  // the drone is live for the whole window even though it started earlier
  const persistent = sched.filter((r) => r.at < from && r.until > from && layerFor(r)).length;
  // the cap counts a voice from the moment it is QUEUED (up to 120ms of lookahead), not from when it sounds
  for (const r of mine) { ev.push([r.queued, 1]); ev.push([Number.isFinite(r.until) ? r.until : now, -1]); }
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let live = persistent, peak = live;
  for (const [, d] of ev) { live += d; peak = Math.max(peak, live); }
  const pitched = mine.filter((r) => r.type === 'osc');
  // the frequency of an oscillator that drives another's frequency param is still a sound in the room
  const gunBand = pitched.filter((r) => r.freq >= 1500 && r.freq <= 4000).map((r) => Math.round(r.freq));
  const noiseFilters = mine.filter((r) => r.type === 'buf').map((r) => ({ r, f: r.node.__to[0] }));
  const noiseInBand = noiseFilters.filter(({ f }) => f && f.frequency.value >= 1500 && f.frequency.value <= 4000).map(({ f }) => f.type + Math.round(f.frequency.value));
  const longNoise = noiseFilters.filter(({ r }) => r.until - r.at > 2.05).length;
  const onsets = mine.filter((r) => r.until - r.at <= .3 && r.until > r.at).length / secs;
  const sig = [...new Set(pitched.map((r) => Math.round(12 * Math.log2(r.freq / 440)) % 12))].sort((a, b) => a - b).join(',');
  results.push({ q, name, state: state(), peak, gunBand, noiseInBand, longNoise, onsets, sig, count: mine.length });
};
for (const q of A.QUARTERS) for (const [name, [n, chase, alert]] of Object.entries(SCEN)) sweep(q, name, () => crowd(n, chase, alert));
// overrun while crossing into another quarter
sweep('industry', 'overrun+cross', () => { crowd(80, 60); run(3); district = 'quarantine'; });
// the furnace in its heaviest phase
sweep('quarantine', 'boss3', () => { st.boss = { active: true, phase: 3, ai: { mode: 'active' } }; crowd(40, 20); });
st.boss = null;

console.log('\n' + results.map((r) => `${r.q.padEnd(10)} ${r.name.padEnd(13)} ${r.state.padEnd(9)} peak ${String(r.peak).padStart(2)}  onsets/s ${r.onsets.toFixed(1).padStart(5)}  voices ${r.count}`).join('\n') + '\n');
const wrongState = results.filter((r) => !r.name.includes('+') && !r.name.startsWith('boss') && r.state !== r.name);
ok('every quarter reaches every state', !wrongState.length, wrongState.map((r) => `${r.q}/${r.name}=${r.state}`).join(' '));
const heavy = results.filter((r) => r.peak > 20);
ok('the score never holds more than 20 voices, queued or sounding (gunfire shares the 48)', !heavy.length, heavy.map((r) => `${r.q}/${r.name} ${r.peak}`).join(' '));
const band = results.filter((r) => r.gunBand.length || r.noiseInBand.length);
ok('nothing pitched or filtered into the 1.5-4 kHz gun band', !band.length, band.map((r) => `${r.q}/${r.name} ${[...r.gunBand, ...r.noiseInBand].slice(0, 6)}`).join(' '));
const beds = results.filter((r) => r.longNoise);
ok('no noise voice lasts over two seconds (no static beds)', !beds.length, beds.map((r) => `${r.q}/${r.name}`).join(' '));
const byQ = (name) => results.filter((r) => r.name === name);
const tempoOk = A.QUARTERS.every((q) => { const o = ['calm', 'suspense', 'fight', 'overrun'].map((s) => results.find((r) => r.q === q && r.name === s).onsets); return o[0] < o[1] && o[1] < o[2] && o[2] < o[3]; });
ok('felt tempo climbs calm < suspense < fight < overrun in every quarter', tempoOk,
  A.QUARTERS.map((q) => q + ' ' + ['calm', 'suspense', 'fight', 'overrun'].map((s) => results.find((r) => r.q === q && r.name === s).onsets.toFixed(1)).join('/')).join('  '));
ok('fight is frantic: at least 10 percussive onsets a second', byQ('fight').every((r) => r.onsets >= 10), byQ('fight').map((r) => r.onsets.toFixed(1)).join(' '));
ok('the six quarters are harmonically distinct when calm', new Set(byQ('calm').map((r) => r.sig)).size === 6, byQ('calm').map((r) => r.q + ':' + r.sig).join('  '));

// ---- lifecycle ----
district = 'checkpoint'; crowd(40, 20); run(4);
const beforePause = state(); st.paused = true; run(3);
ok('pause keeps the score playing in its state (it does not stop and restart)', A.status.voices > 0 && state() === beforePause, `voices ${A.status.voices}, ${beforePause} -> ${state()}`);
st.paused = false; run(2);
ok('resuming carries straight on', A.status.voices > 0 && state() === beforePause, `voices ${A.status.voices}, ${state()}`);
A.toggleMusic(); run(2);
ok('music off releases the drone and schedules nothing', A.status.voices === 0, 'voices ' + A.status.voices);
A.toggleMusic();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
