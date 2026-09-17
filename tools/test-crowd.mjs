// What does the score ACTUALLY do during real play? Boots the real game (world+game, no render), runs the real
// audio.js director on a silent AudioContext against the live state, and samples the headcount it counts and the
// music state it picks, over several minutes.
import fs from 'node:fs';
import vm from 'node:vm';
import { bootDS, gameFiles, ROOT } from './pixboot.mjs';

const g = bootDS({ files: gameFiles(), seed: 12345, screenW: 1440, screenH: 900 });
const s = g.ev('(()=>{const s=DSGame.create(12345);s.mode="play";return s;})()');
for (let i = 0; i < 4; i++) g.ev('DSGame.addPlayer')(s, i ? 'test:' + i : 'keyboard');
g.ev(`(s)=>{for(const p of s.players){p.weapon='ar';p.backup=false;p.mag=DSGame.WEAPONS.ar.mag;p.x=(p.id-1.5)*35;p.y=2620;p.invuln=1e9;}s.camera.x=0;s.camera.y=2620;}`)(s);

// the real audio.js on a context that makes no sound, fed the live game state every frame
let now = 0;
const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
function node() {
  return { gain: param(), frequency: param(), detune: param(), delayTime: param(), Q: param(), pan: param(), threshold: param(), ratio: param(),
    connect: (d) => d, disconnect() {}, setPeriodicWave() {}, start() {},
    stop() { if (this.onended) { const f = this.onended; this.onended = null; f(); } } };
}
const silent = { state: 'running', sampleRate: 8000, destination: node(), get currentTime() { return now; },
  createGain: node, createOscillator: node, createBufferSource: node, createBiquadFilter: node, createStereoPanner: node,
  createConvolver: node, createDynamicsCompressor: node, createWaveShaper: node, createDelay: node,
  createPeriodicWave: () => ({}), createBuffer: (c, l) => ({ getChannelData: () => new Float32Array(l) }), resume: () => Promise.resolve() };
const box = { AudioContext: function () { return silent; }, document: { hidden: false }, localStorage: { getItem: () => null, setItem() {} },
  DSWorld: g.ev('DSWorld'), console, Math, Number, Set, Map, WeakMap, Float32Array, Promise, String, Object };
box.window = box; vm.createContext(box);
vm.runInContext(fs.readFileSync(ROOT + '/audio.js', 'utf8'), box);
const A = box.DSAudio; A.unlock();

// the exact rule from audio.js sense()
const headcount = (s) => {
  const living = s.players.filter((p) => !p.dead);
  if (!living.length) return 0;
  let n = 0;
  for (const e of s.enemies || []) {
    if (e.dead) continue;
    for (const p of living) { const dx = e.x - p.x, dy = e.y - p.y; if (dx * dx + dy * dy < 330 * 330) { n++; break; } }
  }
  return n;
};

const MIN = 6;
const samples = [];
const step = g.ev('DSGame.step');
for (let i = 0; i < 60 * 60 * MIN; i++) {
  step(s, 1 / 60, {}, 1.9);
  now += 1 / 60; A.update(s);
  if (i % 30 === 0) samples.push({ t: s.time, n: headcount(s), chase: s.enemies.filter((e) => !e.dead && e.state === 'chase').length,
    music: A.status.musicState, quarter: A.status.quarter });
}

const counts = samples.map((x) => x.n);
const pct = (f) => (100 * samples.filter(f).length / samples.length).toFixed(1) + '%';
const sorted = [...counts].sort((a, b) => a - b);
const q = (p) => sorted[Math.floor(p * (sorted.length - 1))];

console.log(`${MIN} minutes of real play, 4 survivors standing their ground, sampled twice a second\n`);
console.log('headcount within 330u of a survivor:');
console.log(`  min ${q(0)}   p25 ${q(.25)}   median ${q(.5)}   p75 ${q(.75)}   p95 ${q(.95)}   max ${q(1)}`);
console.log(`  mean ${(counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1)}`);

console.log('\ntime the score spends in each state:');
for (const name of A.STATES) console.log(`  ${name.padEnd(10)}${pct((x) => x.music === name)}`);
let swaps = 0;
for (let i = 1; i < samples.length; i++) if (samples[i].music !== samples[i - 1].music) swaps++;
console.log(`  state changes: ${swaps} in ${MIN} minutes`);
console.log(`  quarters heard: ${[...new Set(samples.map((x) => x.quarter))].join(', ')}`);

// minute by minute, so the drift over a run is visible
console.log('\nper minute  median / max headcount, max chasing, music states:');
for (let m = 0; m < MIN; m++) {
  const W = samples.filter((x) => x.t >= m * 60 && x.t < (m + 1) * 60), w = W.map((x) => x.n).sort((a, b) => a - b);
  if (!w.length) continue;
  const states = A.STATES.map((k) => [k, W.filter((x) => x.music === k).length]).filter((e) => e[1])
    .map((e) => `${e[0]} ${Math.round(100 * e[1] / W.length)}%`).join(', ');
  console.log(`  min ${m + 1}     ${w[Math.floor(w.length / 2)]} / ${w[w.length - 1]}   chasing ${Math.max(...W.map((x) => x.chase))}   ${states}`);
}
