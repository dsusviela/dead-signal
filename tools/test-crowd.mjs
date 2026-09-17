// What does the music's headcount ACTUALLY do during real play? Boots the real game
// (world+game, no render) and samples the same count audio.js uses, over several minutes.
import { bootDS, gameFiles } from './pixboot.mjs';

const g = bootDS({ files: gameFiles(), seed: 12345, screenW: 1440, screenH: 900 });
const s = g.ev('(()=>{const s=DSGame.create(12345);s.mode="play";return s;})()');
for (let i = 0; i < 4; i++) g.ev('DSGame.addPlayer')(s, i ? 'test:' + i : 'keyboard');
g.ev(`(s)=>{for(const p of s.players){p.weapon='ar';p.backup=false;p.mag=DSGame.WEAPONS.ar.mag;p.x=(p.id-1.5)*35;p.y=2620;p.invuln=1e9;}s.camera.x=0;s.camera.y=2620;}`)(s);

// the exact rule from audio.js headcount()
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
  if (i % 30 === 0) samples.push({ t: s.time, n: headcount(s), total: s.enemies.filter((e) => !e.dead).length });
}

const counts = samples.map((x) => x.n);
const mix = (n) => Math.min(1, n / 9);
const pct = (f) => (100 * samples.filter(f).length / samples.length).toFixed(1) + '%';
const sorted = [...counts].sort((a, b) => a - b);
const q = (p) => sorted[Math.floor(p * (sorted.length - 1))];

console.log(`${MIN} minutes of real play, 4 survivors, sampled twice a second\n`);
console.log('headcount within 330u of a survivor:');
console.log(`  min ${q(0)}   p25 ${q(.25)}   median ${q(.5)}   p75 ${q(.75)}   p95 ${q(.95)}   max ${q(1)}`);
console.log(`  mean ${(counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1)}`);
console.log('\ntime spent in each band:');
console.log(`  0 alone          ${pct((x) => x.n === 0)}`);
console.log(`  1-3 stalked      ${pct((x) => x.n >= 1 && x.n <= 3)}`);
console.log(`  4-8 fighting     ${pct((x) => x.n >= 4 && x.n <= 8)}`);
console.log(`  9+ overrun       ${pct((x) => x.n >= 9)}`);
console.log('\ncombat layer gain (min(1, n/9)):');
console.log(`  pinned at 1.0    ${pct((x) => mix(x.n) >= 1)}`);
console.log(`  above 0.8        ${pct((x) => mix(x.n) > .8)}`);
console.log(`  below 0.2        ${pct((x) => mix(x.n) < .2)}`);
console.log(`  fully silent     ${pct((x) => mix(x.n) === 0)}`);

// how often does it move enough to be heard at all?
let moved = 0, snapped = 0;
for (let i = 1; i < samples.length; i++) {
  const d = Math.abs(mix(samples[i].n) - mix(samples[i - 1].n));
  if (d > .05) moved++;
  if (d > .5) snapped++;
}
console.log(`\nhalf-second-to-half-second change in the mix:`);
console.log(`  moved >0.05      ${(100 * moved / samples.length).toFixed(1)}% of samples`);
console.log(`  big enough to snap (>0.5)  ${snapped} times in ${MIN} minutes`);

// minute by minute, so the drift over a run is visible
console.log('\nper minute  median / max headcount:');
for (let m = 0; m < MIN; m++) {
  const w = samples.filter((x) => x.t >= m * 60 && x.t < (m + 1) * 60).map((x) => x.n).sort((a, b) => a - b);
  if (!w.length) continue;
  console.log(`  min ${m + 1}     ${w[Math.floor(w.length / 2)]} / ${w[w.length - 1]}`);
}
