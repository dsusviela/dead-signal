// city_v2 Section 2 density measure: frontage coverage per block and district.
// Coverage = street-facing facade or perimeter length / usable frontage, where usable frontage is each road-facing block edge
// minus explicit access reservations (approaches, driveways) that cross it. A facade counts when a building
// footprint (enterable or sealed mass) comes within DEPTH units of that edge; projected intervals are unioned, so
// overlapping buildings count once. Also reports the unexplained open filler share (ground that renders as the
// district lot tile: not road, sidewalk, lot, building or obstacle).
//   node tools/v2-frontage.mjs [--block block-3-4] [--json out.json] [--depth 40]
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { parseArgs } from './pixboot.mjs';
import { loadGame, root } from './city-baseline.mjs';

const o = parseArgs(process.argv.slice(2), new Set());
const c = loadGame(), W = c.DSWorld, w = W.create(1), DEPTH = +(o.depth || 40);
// initial authoring targets from city_v2 Section 2 ("Density rules to test in representative blocks")
const TARGET = { checkpoint: [.65, .8], ruins: [.7, .85], hospital: [.45, .65], northline: [.45, .65], industry: [.55, .75], quarantine: [.5, .7] };
const chunkCtx = { Math, DSWorld: W, DSArt: { spec: () => true } }; chunkCtx.window = chunkCtx; vm.createContext(chunkCtx);
vm.runInContext(fs.readFileSync(path.join(root, 'chunks.js'), 'utf8'), chunkCtx);
const groundKind = (x, y) => chunkCtx.DSChunks.groundKind(x, y, { world: w });

const union = iv => { const s = iv.filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]), out = []; for (const [a, b] of s) { const l = out[out.length - 1]; if (l && a <= l[1]) l[1] = Math.max(l[1], b); else out.push([a, b]); } return out; };
const len = iv => iv.reduce((n, [a, b]) => n + b - a, 0);
const clip = (iv, lo, hi) => iv.map(([a, b]) => [Math.max(lo, a), Math.min(hi, b)]).filter(([a, b]) => b > a);
const minus = (iv, cut) => { let cur = iv; for (const [ca, cb] of cut) cur = cur.flatMap(([a, b]) => cb <= a || ca >= b ? [[a, b]] : [[a, Math.min(b, ca)], [Math.max(a, cb), b]].filter(([p, q]) => q > p)); return cur; };
// city_v2 counts facade or perimeter: buildings, sealed masses and fenced/walled lots (a hedge, wall or fence edge holds the street line; kerb-only lots and courtyards do not)
const masses = [...w.buildings.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h })), ...w.obstacles.filter(q => q.type === 'building'), ...w.lots.filter(l => l.perimeter && l.perimeter !== 'kerb').map(l => l.rect)];
const access = w.reserved.filter(r => r.kind === 'approach' || r.kind === 'driveway');

const rows = [];
for (const b of w.blocks) {
  const R = b.rect; let usable = 0, covered = 0;
  for (const side of b.frontage) {
    const horiz = side === 'n' || side === 's', lo = horiz ? R.x : R.y, hi = horiz ? R.x + R.w : R.y + R.h;
    const edge = side === 'n' ? R.y : side === 's' ? R.y + R.h : side === 'w' ? R.x : R.x + R.w;
    const near = q => side === 'n' ? q.y - edge < DEPTH : side === 's' ? edge - (q.y + q.h) < DEPTH : side === 'w' ? q.x - edge < DEPTH : edge - (q.x + q.w) < DEPTH;
    const inBlock = q => q.x < R.x + R.w && q.x + q.w > R.x && q.y < R.y + R.h && q.y + q.h > R.y;
    const cuts = union(access.filter(q => inBlock(q) && near(q)).map(q => horiz ? [q.x, q.x + q.w] : [q.y, q.y + q.h]));
    const free = minus([[lo, hi]], cuts);
    const facades = union(masses.filter(q => inBlock(q) && near(q)).map(q => horiz ? [q.x, q.x + q.w] : [q.y, q.y + q.h]));
    usable += len(free); covered += len(clip(minus(facades, cuts), lo, hi));
  }
  // open filler: sampled every 32 units inside the block
  let open = 0, n = 0;
  for (let y = R.y + 16; y < R.y + R.h; y += 32) for (let x = R.x + 16; x < R.x + R.w; x += 32) { n++; if (groundKind(x, y).startsWith('lot') && !W.blocked(w, x, y, 4)) open++; }
  const cov = usable ? covered / usable : 0, t = TARGET[b.districtId];
  rows.push({ block: b.id, district: b.districtId, frontage: Math.round(usable), coverage: +cov.toFixed(3), target: t, inTarget: cov >= t[0] && cov <= t[1], openFiller: +(open / n).toFixed(3) });
}
const pick = o.block ? rows.filter(r => r.block === o.block) : rows;
const byDistrict = {};
for (const r of rows) { const d = byDistrict[r.district] ||= { blocks: 0, usable: 0, covered: 0, open: 0, inTarget: 0, target: r.target }; d.blocks++; d.usable += r.frontage; d.covered += r.frontage * r.coverage; d.open += r.openFiller; d.inTarget += r.inTarget ? 1 : 0; }
const summary = Object.fromEntries(Object.entries(byDistrict).map(([k, d]) => [k, { blocks: d.blocks, coverage: +(d.covered / d.usable).toFixed(3), target: d.target, blocksInTarget: d.inTarget, meanOpenFiller: +(d.open / d.blocks).toFixed(3) }]));
if (o.json) { fs.mkdirSync(path.dirname(o.json), { recursive: true }); fs.writeFileSync(o.json, JSON.stringify({ depth: DEPTH, summary, blocks: rows }, null, 1)); }
for (const r of pick) console.log(`${r.block.padEnd(11)} ${r.district.padEnd(11)} coverage ${(r.coverage * 100).toFixed(0).padStart(3)}% target ${r.target.map(v => v * 100).join('-')}% ${r.inTarget ? 'ok ' : '-- '} open filler ${(r.openFiller * 100).toFixed(0)}%`);
console.log(JSON.stringify(summary, null, 1));
