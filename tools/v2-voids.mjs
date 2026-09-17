// city_v2 V2-0: find the broad open "filler" patches (outside roads, sidewalks, buildings and authored lots)
// that render as the sparse district lot tile, largest first. The 00:34 South Blocks reference has no
// coordinates, so these are the candidates to reproduce and review, not a confirmed match.
//   node tools/v2-voids.mjs [--district checkpoint] [--top 8] [--min 40000] [--json out.json]
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { parseArgs } from './pixboot.mjs';
import { loadGame, root } from './city-baseline.mjs';

const o = parseArgs(process.argv.slice(2), new Set());
const c = loadGame(), W = c.DSWorld, w = W.create(1), CELL = 32;
// chunks.js decides the ground kind; run it against the same world with a stub art registry that has every tile
const chunkCtx = { Math, window: null, DSWorld: W, DSArt: { spec: () => true } };chunkCtx.window = chunkCtx;vm.createContext(chunkCtx);
vm.runInContext(fs.readFileSync(path.join(root, 'chunks.js'), 'utf8'), chunkCtx);
const kind = chunkCtx.DSChunks.groundKind ? (x, y) => chunkCtx.DSChunks.groundKind(x, y, { world: w }) : null;
if (!kind) throw new Error('chunks.js does not expose groundKind');
const want = o.district || null, n = 7200 / CELL, open = new Uint8Array(n * n);
for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
  const x = -3600 + (i + .5) * CELL, y = -3600 + (j + .5) * CELL;
  if (want && W.district(x, y).id !== want) continue;
  if (!kind(x, y).startsWith('lot')) continue;
  if (W.blocked(w, x, y, 4)) continue;
  open[j * n + i] = 1;
}
const seen = new Uint8Array(n * n), patches = [];
for (let s0 = 0; s0 < n * n; s0++) {
  if (!open[s0] || seen[s0]) continue;
  const q = [s0]; seen[s0] = 1; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, sx = 0, sy = 0;
  for (let h = 0; h < q.length; h++) {
    const k = q[h], i = k % n, j = (k / n) | 0, x = -3600 + i * CELL, y = -3600 + j * CELL;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + CELL); y1 = Math.max(y1, y + CELL); sx += x + CELL / 2; sy += y + CELL / 2;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj, kk = b * n + a; if (a >= 0 && b >= 0 && a < n && b < n && open[kk] && !seen[kk]) { seen[kk] = 1; q.push(kk); } }
  }
  const area = q.length * CELL * CELL, cx = Math.round(sx / q.length), cy = Math.round(sy / q.length);
  if (area < +(o.min || 40000)) continue;
  const near = w.locations.filter(l => l.kind !== 'cache').map(l => ({ id: l.id, d: Math.hypot(l.rect.x + l.rect.w / 2 - cx, l.rect.y + l.rect.h / 2 - cy) })).sort((a, b) => a.d - b.d).slice(0, 3);
  const bi = [-3600, -2800, -1400, 0, 1400, 2800, 3600].findLastIndex(v => v <= cx), bj = [-3600, -2800, -1400, 0, 1400, 2800, 3600].findLastIndex(v => v <= cy);
  patches.push({ area, centre: [cx, cy], bounds: [x0, y0, x1 - x0, y1 - y0], district: W.district(cx, cy).id, gridCell: [bj, bi], ground: kind(cx, cy), fromSpawn: Math.round(Math.hypot(cx, cy - 2800)), nearestLocations: near.map(l => l.id + ' @' + Math.round(l.d)) });
}
patches.sort((a, b) => b.area - a.area);
const top = patches.slice(0, +(o.top || 8));
console.log(JSON.stringify(top, null, 1));
if (o.json) { fs.mkdirSync(path.dirname(o.json), { recursive: true }); fs.writeFileSync(o.json, JSON.stringify({ totalPatches: patches.length, totalArea: patches.reduce((s, p) => s + p.area, 0), top }, null, 1)); }
