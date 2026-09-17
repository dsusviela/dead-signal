// Every art id the city references must be a defined sprite, so a missing asset cannot hide behind
// the renderer's hasArt() fallbacks (CITY.md Phase 8). Also checks sprite footprints against the
// collision rects they are drawn over, and that every door family and sign has its pieces.
import assert from 'node:assert/strict';
import { bootArt } from './art/targets.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { loadGame, root } from './city-baseline.mjs';

const { A } = bootArt(), c = loadGame(), W = c.DSWorld, results = [];
function test(name, fn) { try { fn(); results.push(`PASS ${name}`); } catch (e) { results.push(`FAIL ${name}: ${e.message}`); } }
const size = id => { const sp = A.spec(id), r = sp && (sp.rows || sp.variants?.[0] || (sp.frames && Object.values(sp.frames)[0][0])); return r ? { w: r[0].length, h: r.length } : null; };
const w = W.create(1);

test('every world prop and obstacle art id is defined', () => {
  const missing = new Set();
  for (const o of [...w.obstacles, ...w.props]) if (o.art && !A.spec(o.art)) missing.add(o.art);
  for (const o of w.obstacles) if (o.type === 'fence') for (const s of ['_h', '_v']) if (!A.spec('lots/' + o.fence + s)) missing.add('lots/' + o.fence + s);
  for (const id of ['buildings/doorSecured_h', 'buildings/doorSecured_v', 'buildings/sealedFacade_h', 'buildings/sealedFacade_v']) if (!A.spec(id)) missing.add(id);
  assert.deepEqual([...missing].sort(), []);
});

test('furniture sprites match their collision rects', () => {
  const bad = [];
  for (const o of w.obstacles.filter(o => o.type === 'furniture' && o.art.startsWith('buildings/') && A.spec(o.art))) {
    const s = size(o.art), fits = (s.w === o.w && s.h === o.h) || (o.art === 'buildings/furn_shelf' && s.w === 60 && s.h === 16) || o.art === 'landmarks/generator';
    if (!fits) bad.push(`${o.art} ${s.w}x${s.h} vs ${o.w}x${o.h}`);
  }
  assert.deepEqual([...new Set(bad)], []);
});

test('every door family has jamb and leaf, and every sign is drawn', () => {
  const missing = new Set();
  for (const b of w.buildings) for (const d of b.exteriorDoors) { const f = W.doorFamily(b, d); for (const p of ['_jamb', '_leaf']) if (!A.spec('doors/' + f + p)) missing.add('doors/' + f + p); }
  for (const id of ['doors/sill_h', 'doors/sill_v']) if (!A.spec(id)) missing.add(id);
  for (const p of w.props.filter(p => p.sign)) if (!A.spec(p.art)) missing.add(p.art);
  assert.deepEqual([...missing].sort(), []);
});

test('new pickups, service vehicles, debris and campaign states have sprites', () => {
  const need = ['loot/provision', 'loot/jerrycan', 'vehicles/fireTruck_h', 'vehicles/fireTruck_v', 'vehicles/bulldozer_h', 'vehicles/bulldozer_v', 'tiles/grass', 'tiles/gravel', 'props/debrisPile', 'props/debrisCleared', 'vfx/dust',
    // campaign states (CITY.md Phase 12): gates, bollards, the evac barrier, circuit boxes, the running generator, the live transmitter, civilians, the pallet, records
    'quarantine/gate_h', 'quarantine/gate_v', 'quarantine/bollard_h', 'quarantine/bollard_v', 'quarantine/evacBarrier', 'props/circuitBox', 'landmarks/generatorRunning', 'buildings/transmitterLive', 'survivors/civilian', 'loot/pallet', 'loot/evidence', 'loot/payload', 'loot/override'];
  assert.equal(A.spec('loot/airdrop'), null, 'the orphaned airdrop chute is gone');
  assert.deepEqual(need.filter(id => !A.spec(id)), []);
});

// city_v2 Section 4: the renderer wraps frame indexes, so a missing state frame would silently repeat frame 0
test('state-dependent sprites supply every frame the renderer selects', () => {
  const frames = id => { const sp = A.spec(id); return sp && sp.frames ? Math.min(...Object.values(sp.frames).map(f => f.length)) : sp ? 1 : 0; };
  const need = { 'survivors/civilian': 3, 'landmarks/generatorRunning': 2, 'buildings/transmitterLive': 3, 'props/circuitBox': 2, 'quarantine/evacBarrier': 2 };
  const short = Object.entries(need).filter(([id, n]) => frames(id) < n).map(([id, n]) => `${id} has ${frames(id)} of ${n}`);
  assert.deepEqual(short, []);
  for (const p of w.props.filter(p => p.circuitBox || p.evacGate)) assert.ok(frames(p.art) >= 2, p.art + ' needs off/on frames');
  for (const o of w.obstacles.filter(o => o.type === 'gate')) { const base = o.bollard ? 'quarantine/bollard' : 'quarantine/gate'; assert.ok(A.spec(base + (o.w >= o.h ? '_h' : '_v')), 'gate strip at ' + o.x + ',' + o.y); }
});

// Node tooling auto-discovers art/*.js; the browser only loads what index.html lists
test('every art family script is registered in index.html', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), listed = new Set([...html.matchAll(/src="(art\/[^"]+\.js)"/g)].map(m => m[1]));
  const files = fs.readdirSync(path.join(root, 'art')).filter(f => f.endsWith('.js')).map(f => 'art/' + f);
  assert.deepEqual(files.filter(f => !listed.has(f)), []);
  assert.ok(html.indexOf('src="art.js"') < html.indexOf('src="art/'), 'art.js loads before its families');
});

console.log(results.join('\n'));
if (results.some(r => r.startsWith('FAIL'))) process.exit(1);
