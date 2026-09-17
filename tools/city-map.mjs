// Plot the fixed city layout (blocks, lots, buildings, doors, sealed masses, debris, slots) to a PNG.
//   node tools/city-map.mjs [--seed 1] [--out artifacts/city/layout.png] [--region x,y,w,h] [--px 2400]
// Uses PLAYWRIGHT_PATH (playwright-core) to rasterize an SVG; no server needed.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from './pixboot.mjs';
import { loadGame } from './city-baseline.mjs';

const o = parseArgs(process.argv.slice(2), new Set());
const c = loadGame(), W = c.DSWorld, w = W.create(+(o.seed || 1));
const [rx, ry, rw, rh] = (o.region || '-3600,-3600,7200,7200').split(',').map(Number);
const px = +(o.px || 2400), scale = px / rw, out = o.out || 'artifacts/city/layout.png';
const R = (r, fill, stroke = 'none', sw = 0, extra = '') => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`;
const parts = [`<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="#0d1216"/>`];
for (const q of W.districtCells()) parts.push(R(q, q.district.mapPalette.fill, 'none', 0, 'fill-opacity=".55"'));
for (const q of w.roads) parts.push(R(q, '#2a353b'));
for (const l of w.locations) if (l.required || l.story) parts.push(R(l.rect, 'none', l.mapColor || '#ff543b', 6, 'stroke-dasharray="30 18" stroke-opacity=".7"'));
const lotFill = { park: '#2e5a33', parkingLot: '#3a3f44', graveyard: '#454052', serviceYard: '#4a4436', demolitionLot: '#5a4632', machineryYard: '#5b4a24', burnYard: '#5a2a24' };
for (const l of w.lots) { parts.push(R(l.rect, lotFill[l.kind] || '#444')); for (const e of l.entrances) parts.push(R(e.rect, '#ffd249')); }
for (const ob of w.obstacles) {
  const col = ob.type === 'wall' ? '#c8d0cc' : ob.type === 'building' ? (ob.sealed ? '#5d6a70' : '#4b5357') : ob.type === 'furniture' ? '#8a6d4a' : ob.type === 'debris' ? '#ff4fd8' : ob.driveable ? '#58c4ff' : ob.type === 'car' ? '#7a4a44' : '#6e6a5e';
  parts.push(R(ob, col));
}
for (const b of w.buildings) for (const d of b.exteriorDoors) parts.push(R(d.rect, d.kind === 'public' ? '#79e2cf' : d.kind === 'vehicleBay' ? '#ffb040' : '#ff8291'));
for (const s of w.vehicleSlots) if (s.vehicleType !== 'sedan') parts.push(R(s.rect, 'none', s.vehicleType === 'fireTruck' ? '#ff3030' : '#ffd249', 8));
for (const l of w.landmarks) parts.push(`<circle cx="${l.x}" cy="${l.y}" r="40" fill="${l.color}" stroke="#fff" stroke-width="6"/>`);
for (const l of w.locations) if (l.required) parts.push(`<text x="${l.rect.x + 12}" y="${l.rect.y + 60}" font-size="${Math.max(40, 14 / scale)}" fill="#fff" font-family="monospace">${l.id}</text>`);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${Math.round(rh * scale)}" viewBox="${rx} ${ry} ${rw} ${rh}">${parts.join('')}</svg>`;
const modulePath = process.env.PLAYWRIGHT_PATH || 'C:/Users/daniel/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs';
const { chromium } = await import(pathToFileURL(modulePath).href);
const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: px, height: Math.round(rh * scale) } });
await page.setContent(`<body style="margin:0">${svg}</body>`);
await fs.mkdir(path.dirname(out), { recursive: true });
await page.screenshot({ path: out }); await browser.close();
console.log(`wrote ${out}`);
