// City revamp acceptance checks (CITY.md). Fixed-world checks live here; live mechanics
// belong in the vehicle, boss and audio suites.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadGame, measure, tally, fixturePath, root } from './city-baseline.mjs';

const c = loadGame(), W = c.DSWorld;
const results = [];
function test(name, fn) { try { fn(); results.push(`PASS ${name}`); } catch (e) { results.push(`FAIL ${name}: ${e.message}`); } }

test('fixed geometry is identical across run seeds', () => {
  const a = W.create(11), b = W.create(29);
  for (const k of ['obstacles', 'roads', 'landmarks', 'locations', 'buildings', 'lots', 'vehicleSlots', 'props', 'setpieces', 'lights']) assert.deepEqual(a[k], b[k], k);
});

test('one canonical district table with unique ids', () => {
  const ids = W.DISTRICTS.map(d => d.id);
  assert.deepEqual([...ids].sort(), ['checkpoint', 'hospital', 'industry', 'northline', 'quarantine', 'ruins']);
  for (const d of W.DISTRICTS) {
    assert.equal(W.districtById(d.id), d);
    assert.equal(W.THEME[d.id], d.theme, `${d.id} theme`);
    for (const k of ['name', 'role', 'color', 'ground', 'road', 'enemy', 'landmark', 'anchor', 'mapLabel']) assert.ok(d[k], `${d.id}.${k}`);
    assert.ok(Array.isArray(d.required) && d.required.length, `${d.id}.required`);
  }
  const req = W.DISTRICTS.flatMap(d => d.required);
  assert.equal(new Set(req).size, req.length, 'required location ids are unique');
});

test('classifier, markings, map cells and landmarks agree', () => {
  const expect = { checkpoint: 'checkpoint', radio: 'northline', hospital: 'hospital', ruins: 'ruins', industry: 'industry' };
  for (const l of W.create(1).landmarks) assert.equal(W.district(l.x, l.y).id, expect[l.id], l.id);
  for (const d of W.DISTRICTS) if (d.marking) assert.equal(W.district(d.marking.x, d.marking.y), d, `${d.id} marking`);
  assert.equal(W.district(0, 0).id, 'quarantine');
  assert.equal(W.district(2000, 1300).id, 'hospital'); // district edges follow the avenues at +-1400
  assert.equal(W.district(2000, 1500).id, 'industry'); assert.equal(W.district(-1500, -1500).id, 'ruins'); assert.equal(W.district(0, -1500).id, 'northline');
  // city_v2: the four central blocks are Central Quarantine's support streets; South Blocks keeps the south-west
  assert.equal(W.district(700, 700).id, 'quarantine'); assert.equal(W.district(-1300, 1300).id, 'quarantine'); assert.equal(W.district(700, 1500).id, 'checkpoint');
  const cells = W.districtCells();
  assert.equal(cells.reduce((n, q) => n + q.w * q.h, 0), 7200 * 7200, 'map cells tile the world');
  for (const q of cells) for (const [fx, fy] of [[.1, .1], [.9, .9], [.1, .9], [.9, .1]]) assert.equal(W.district(q.x + q.w * fx, q.y + q.h * fy), q.district, 'cell is one district');
});

test('36 authored block owners: every district owns blocks, territory tiles the city exactly once with half-open edges', () => {
  const expect = [['ruins','ruins','northline','northline','hospital','hospital'],['ruins','ruins','northline','northline','hospital','hospital'],['ruins','ruins','quarantine','quarantine','hospital','hospital'],['ruins','ruins','quarantine','quarantine','hospital','hospital'],['checkpoint','checkpoint','checkpoint','checkpoint','industry','industry'],['checkpoint','checkpoint','checkpoint','checkpoint','industry','industry']];
  const w = W.create(1), counts = {};
  assert.equal(w.blocks.length, 36);
  for (const b of w.blocks) { assert.ok(W.districtById(b.districtId), b.id); assert.equal(b.districtId, expect[b.row][b.col], b.id); counts[b.districtId] = (counts[b.districtId] || 0) + 1; }
  assert.equal(JSON.stringify(Object.keys(counts).sort()), JSON.stringify(W.DISTRICTS.map(d => d.id).sort()), 'all six districts own blocks');
  assert.equal(W.districtCells().length, 36);
  // every sample point resolves once: shared road centre lines go east/south, the outer edge and beyond clamp
  const G = W.GRID;
  for (let i = 1; i < 6; i++) { assert.equal(W.gridIndex(G[i]), i); assert.equal(W.gridIndex(G[i] - .001), i - 1); }
  assert.equal(W.gridIndex(3600), 5); assert.equal(W.gridIndex(-3600), 0); assert.equal(W.gridIndex(9999), 5); assert.equal(W.gridIndex(-9999), 0);
  for (let y = -3600; y <= 3600; y += 100) for (let x = -3600; x <= 3600; x += 100) {
    const hits = W.districtCells().filter(q => x >= q.x && y >= q.y && (x < q.x + q.w || q.col === 5 && x === 3600) && (y < q.y + q.h || q.row === 5 && y === 3600));
    assert.equal(hits.length, 1, x + ',' + y + ' is in exactly one territory cell'); assert.equal(W.district(x, y), hits[0].district, x + ',' + y + ' map and classifier agree');
  }
  // semantic owners: required places and compounds sit wholly inside one district
  for (const l of w.locations.filter(l => l.required)) {
    const r = l.rect, ids = new Set([[r.x, r.y], [r.x + r.w - 1, r.y], [r.x, r.y + r.h - 1], [r.x + r.w - 1, r.y + r.h - 1], [r.x + r.w / 2, r.y + r.h / 2]].map(([x, y]) => W.district(x, y).id));
    assert.equal(ids.size, 1, l.id + ' straddles ' + [...ids]); assert.equal(l.districtId, [...ids][0], l.id + ' owner');
  }
  for (const d of W.DISTRICTS) for (const id of d.required) assert.equal(w.locations.find(l => l.id === id).districtId, d.id, id + ' in ' + d.id);
  // the wider district never grows the sealed yard: the arena is still the authored ±370 disposal yard
  assert.deepEqual({ ...w.locations.find(l => l.id === 'inner-arena').rect }, { x: -380, y: -380, w: 760, h: 760 });
  assert.ok(w.buildings.filter(b => b.districtId === 'quarantine' || W.district(b.x + b.w / 2, b.y + b.h / 2).id === 'quarantine').length >= 6, 'support blocks are furnished, not empty');
  for (const d of W.DISTRICTS) { assert.ok(d.mapPalette && /^#[0-9a-f]{6}$/.test(d.mapPalette.fill), d.id + ' map palette'); }
});

test('HUD and map draw districts from the world table only', () => {
  const hud = fs.readFileSync(path.join(root, 'hud.js'), 'utf8'), world = fs.readFileSync(path.join(root, 'world.js'), 'utf8');
  for (const name of ['SOUTH BLOCKS', 'OLD QUARTER', 'CIVIC WARD', 'ASHWORKS', "'NORTHLINE'"]) assert.ok(!hud.includes(name), `hud.js hard-codes ${name}`);
  assert.ok(hud.includes('DSWorld.DISTRICTS'));
  assert.equal((world.match(/'Civic Ward'/g) || []).length, 1, 'world.js names each district once');
});

test('spawn reaches every landmark, house door and driveable car on foot', () => {
  const w = W.create(4), cell = 40, n = 7200 / cell, R = 12, key = (x, y) => y * n + x;
  const pass = (x, y) => !W.blocked(w, -3600 + (x + .5) * cell, -3600 + (y + .5) * cell, R);
  const toCell = v => Math.max(0, Math.min(n - 1, Math.floor((v + 3600) / cell)));
  const seen = new Uint8Array(n * n), start = [toCell(0), toCell(2800)], q = [start]; seen[key(...start)] = 1;
  for (let h = 0; h < q.length; h++) { const [x, y] = q[h]; for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) if (nx >= 0 && ny >= 0 && nx < n && ny < n && !seen[key(nx, ny)] && pass(nx, ny)) { seen[key(nx, ny)] = 1; q.push([nx, ny]); } }
  const near = (px, py, r) => { for (let y = toCell(py - r); y <= toCell(py + r); y++) for (let x = toCell(px - r); x <= toCell(px + r); x++) if (seen[key(x, y)]) return true; return false; };
  for (const l of w.landmarks) assert.ok(near(l.x, l.y, 120), `landmark ${l.id}`);
  for (const h of w.buildings) for (const { rect: d, id } of h.exteriorDoors) assert.ok(near(d.x + d.w / 2, d.y + d.h / 2, 30), `door ${id}`);
  for (const o of w.obstacles.filter(o => o.driveable)) assert.ok(near(o.x + o.w / 2, o.y + o.h / 2, 60), `car ${o.carId}`);
});

const inside = (p, r, pad = 0) => p.x >= r.x - pad && p.y >= r.y - pad && p.x <= r.x + r.w + pad && p.y <= r.y + r.h + pad;
const contains = (outer, inner) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

test('location, building, lot, site and slot ids are unique and owners resolve', () => {
  const w = W.create(5), all = new Set();
  for (const k of ['locations', 'buildings', 'lots', 'sites', 'vehicleSlots']) for (const e of w[k]) { assert.ok(e.id, `${k} entry has an id`); assert.ok(!all.has(e.id), `duplicate id ${e.id}`); all.add(e.id); }
  const loc = new Map(w.locations.map(l => [l.id, l])), owners = { buildingIds: new Map(), lotIds: new Map(), siteIds: new Map() };
  for (const l of w.locations) {
    assert.ok(W.districtById(l.districtId), `${l.id} district ${l.districtId}`);
    if (l.compoundId) { assert.ok(loc.has(l.compoundId), `${l.id} compound`); assert.ok(contains(loc.get(l.compoundId).rect, l.rect), `${l.id} inside its compound`); }
    for (const key of Object.keys(owners)) for (const id of l[key]) { assert.ok(!owners[key].has(id), `${id} has one primary owner`); owners[key].set(id, l.id); }
    for (const p of l.lootProfiles) assert.ok(c.DSCity.LOOT_PROFILES[p], `${l.id} profile ${p}`);
  }
  for (const b of w.buildings) {
    assert.equal(owners.buildingIds.get(b.id), b.locationId, `${b.id} owner`);
    assert.ok(c.DSCity.ARCHETYPES[b.archetypeId], `${b.id} archetype`);
    assert.ok(contains(loc.get(b.locationId).rect, b.rect), `${b.id} inside its location`);
    for (const z of [...b.rooms, ...b.roofZones]) assert.ok(contains(b.rect, z.rect), `${z.id} inside ${b.id}`);
  }
  for (const lot of w.lots) { assert.equal(owners.lotIds.get(lot.id), lot.locationId, `${lot.id} owner`); assert.ok(c.DSCity.LOT_KINDS[lot.kind], `${lot.id} kind`); }
  for (const s of w.sites) {
    assert.equal(owners.siteIds.get(s.id), s.locationId, `${s.id} owner`);
    assert.ok(c.DSCity.LOOT_PROFILES[s.lootProfile], `${s.id} profile`);
    if (s.buildingId) assert.equal(w.buildings.find(b => b.id === s.buildingId)?.locationId, s.locationId, `${s.id} building`);
    const sockets = new Set(s.sockets.map(k => k.id));
    for (const i of s.loot) {
      assert.equal(i.siteId, s.id, `${i.id} siteId`); assert.equal(i.locationId, s.locationId, `${i.id} locationId`);
      assert.ok(sockets.has(i.socketId), `${i.id} socket ${i.socketId}`);
      assert.ok(inside(i, loc.get(s.locationId).rect), `${i.id} inside ${s.locationId}`);
    }
  }
  const obstacleOwners = w.obstacles.filter(o => o.buildingId);
  assert.ok(obstacleOwners.length > 0);
  for (const o of obstacleOwners) assert.equal(w.buildings.find(b => b.id === o.buildingId)?.locationId, o.locationId, 'obstacle owner');
  for (const v of w.vehicleSlots.filter(v => v.vehicleType === 'sedan' || v.prop)) assert.ok(w.obstacles.some(o => o.slotId === v.id), `${v.id} has its parked car`);
});

test('archetypes are valid and every required archetype has a district placement rule', () => {
  const { ARCHETYPES, LOT_KINDS, PLACES, STYLE_ARCHETYPE } = c.DSCity;
  const required = ['home', 'shop', 'supermarket', 'pharmacy', 'clinic', 'hospital', 'police', 'fireStation', 'radioStation', 'machineShop', 'warehouse', 'chapel', 'morgue', 'depot', 'holding', 'armoury', 'commandPost'];
  for (const id of required) assert.ok(ARCHETYPES[id], `archetype ${id}`);
  for (const [id, a] of Object.entries(ARCHETYPES)) { assert.equal(a.size.length, 4, `${id} size`); assert.ok(a.profiles.every(p => c.DSCity.LOOT_PROFILES[p]), `${id} profiles`); assert.ok(a.styles.length, `${id} styles`); }
  for (const lot of ['park', 'parkingLot', 'graveyard', 'serviceYard', 'demolitionLot', 'machineryYard']) assert.ok(LOT_KINDS[lot], `lot kind ${lot}`);
  for (const s of Object.values(STYLE_ARCHETYPE)) assert.ok(ARCHETYPES[s]);
  const reachable = new Set();
  for (const d of W.DISTRICTS) {
    for (const a of Object.keys(d.fabric)) { assert.ok(ARCHETYPES[a], `${d.id} fabric ${a}`); reachable.add(a); }
    for (const id of d.required) {
      const p = PLACES[id]; assert.ok(p, `place ${id}`);
      if (p.archetype) { assert.ok(ARCHETYPES[p.archetype], `${id} archetype`); reachable.add(p.archetype); }
      if (p.lot) assert.ok(LOT_KINDS[p.lot], `${id} lot`);
      if (p.compound) assert.ok(d.required.includes(p.compound), `${id} compound ${p.compound} in same district`);
    }
  }
  assert.deepEqual([...Object.keys(PLACES)].sort(), [...W.DISTRICTS.flatMap(d => d.required)].sort(), 'every place is required by exactly one district');
  for (const id of required) assert.ok(reachable.has(id), `${id} reachable from a district rule`);
});

test('story landmarks own stable compound locations', () => {
  const w = W.create(9);
  for (const k of w.landmarks) {
    const l = W.locationById(w, k.locationId);
    assert.ok(l && l.story, `${k.id} location`);
    assert.ok(inside(k, l.rect), `${k.id} inside its compound`);
    assert.ok(W.districtById(l.districtId).required.includes(l.id), `${l.id} required by ${l.districtId}`);
  }
  assert.ok(W.locationById(w, 'patient-furnace')?.story);
  for (const o of w.obstacles.filter(o => o.setpiece === 'radio' || o.setpiece === 'checkpoint')) assert.ok(o.locationId, 'set piece owned');
});

test('run-owned site state clears a location once, after its final authored item', () => {
  const G = c.DSGame, s = G.create(12); G.addPlayer(s); s.mode = 'play';
  const loc = s.world.locations.find(l => l.kind === 'building' && l.siteIds.some(id => s.siteState[id].remainingItemIds.length > 1));
  const items = s.loot.filter(i => i.locationId === loc.id), p = s.players[0];
  assert.equal(s.locationState[loc.id].cleared, false);
  G.collect(s, p, items[0]);
  assert.equal(s.locationState[loc.id].cleared, false, 'partial collection is not cleared');
  assert.ok(s.siteState[items[0].siteId].collectedItemIds.includes(items[0].id));
  p.medkits = 0; for (const i of items.slice(1)) { assert.ok(G.collect(s, p, i), `collect ${i.id}`); p.medkits = 0; }
  assert.equal(s.locationState[loc.id].cleared, true);
  s.loot.push({ id: 'drop', x: items[0].x, y: items[0].y, type: 'xp', amount: 3 }); G.collect(s, p, s.loot.at(-1));
  assert.equal(s.locationState[loc.id].cleared, true, 'unowned drops never reopen');
  assert.equal(Object.keys(s.locationState).length, s.world.locations.length);
});

// ---- Phase 2: urban layout, reservations and routes ----
const world = W.create(4);
// flood fill over walkable cell centres; `extra` obstacles are added only for the query
function reach(w, from, R = 12, extra = [], cell = 40) {
  w.obstacles.push(...extra);
  const n = 7200 / cell, key = (x, y) => y * n + x, toCell = v => Math.max(0, Math.min(n - 1, Math.floor((v + 3600) / cell)));
  const pass = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) pass[key(x, y)] = W.blocked(w, -3600 + (x + .5) * cell, -3600 + (y + .5) * cell, R) ? 0 : 1;
  for (const o of extra) w.obstacles.splice(w.obstacles.indexOf(o), 1);
  const seen = new Uint8Array(n * n), q = [];
  let best = null, bd = Infinity;
  for (let y = toCell(from.y - 80); y <= toCell(from.y + 80); y++) for (let x = toCell(from.x - 80); x <= toCell(from.x + 80); x++) if (pass[key(x, y)]) { const d = Math.hypot(-3600 + (x + .5) * cell - from.x, -3600 + (y + .5) * cell - from.y); if (d < bd) { bd = d; best = [x, y]; } }
  assert.ok(best, `start ${from.x},${from.y} is walkable at radius ${R}`);
  q.push(best); seen[key(...best)] = 1;
  for (let h = 0; h < q.length; h++) { const [x, y] = q[h]; for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) if (nx >= 0 && ny >= 0 && nx < n && ny < n && !seen[key(nx, ny)] && pass[key(nx, ny)]) { seen[key(nx, ny)] = 1; q.push([nx, ny]); } }
  return { near: (px, py, r) => { for (let y = toCell(py - r); y <= toCell(py + r); y++) for (let x = toCell(px - r); x <= toCell(px + r); x++) if (seen[key(x, y)]) return true; return false; } };
}
const centre = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

test('the road grid is 36 blocks of frontage parcels that never overlap reservations', () => {
  assert.equal(world.blocks.length, 36);
  const blocks = new Map(world.blocks.map(b => [b.id, b]));
  for (const b of world.blocks) { assert.equal(W.district(centre(b.rect).x, centre(b.rect).y).id, b.districtId, b.id); for (const s of b.frontage) assert.ok('nesw'.includes(s)); }
  for (const p of world.parcels) {
    assert.ok(contains(blocks.get(p.blockId).rect, p.rect), `${p.id} inside its block`);
    assert.ok(['sealed', 'enterable'].includes(p.use), p.id);
    for (const q of world.parcels) if (q !== p) assert.ok(!(p.rect.x < q.rect.x + q.rect.w && p.rect.x + p.rect.w > q.rect.x && p.rect.y < q.rect.y + q.rect.h && p.rect.y + p.rect.h > q.rect.y), `${p.id} overlaps ${q.id}`);
    for (const r of world.reserved) if (r.kind === 'location' || r.kind === 'lot' || r.kind === 'driveway') assert.ok(!(p.rect.x < r.x + r.w && p.rect.x + p.rect.w > r.x && p.rect.y < r.y + r.h && p.rect.y + p.rect.h > r.y), `${p.id} overlaps ${r.kind} ${r.id}`);
  }
});

test('every required place exists once in its district with its archetype or lot', () => {
  const { PLACES } = c.DSCity;
  for (const d of W.DISTRICTS) for (const id of d.required) {
    const all = world.locations.filter(l => l.id === id); assert.equal(all.length, 1, `${id} exists once`);
    const l = all[0], p = PLACES[id], cc = centre(l.rect);
    assert.equal(l.districtId, d.id, `${id} district`); assert.equal(W.district(cc.x, cc.y).id, d.id, `${id} classifier`);
    if (p.archetype && p.kind === 'building') assert.equal(world.buildings.filter(b => b.locationId === id && b.archetypeId === p.archetype).length, 1, `${id} building`);
    if (p.archetype && p.kind === 'landmark') assert.ok(world.buildings.some(b => b.locationId === id && b.archetypeId === p.archetype), `${id} landmark building`);
    if (p.lot) assert.ok(world.lots.some(q => q.locationId === id && q.kind === p.lot), `${id} lot`);
  }
});

test('Ashworks and Quarantine fabric is district-specific: workshops, sheds and offices, not a home/shop default', () => {
  const inD = (b, id) => W.district(centre(b.rect).x, centre(b.rect).y).id === id && !c.DSCity.PLACES[b.locationId];
  const ash = world.buildings.filter(b => inD(b, 'industry')), q = world.buildings.filter(b => inD(b, 'quarantine'));
  assert.ok(ash.filter(b => ['workshop', 'storageShed', 'dispatchOffice'].includes(b.archetypeId)).length > ash.length / 2, 'Ashworks ordinary buildings are mostly industrial: ' + ash.map(b => b.archetypeId));
  assert.ok(q.some(b => ['requisitionOffice', 'stagingDepot'].includes(b.archetypeId)), 'Quarantine support blocks hold requisitioned buildings: ' + q.map(b => b.archetypeId));
});

test('ordinary interiors and sealed facades surround civic places in every district', () => {
  for (const d of W.DISTRICTS.filter(d => d.id !== 'quarantine')) {
    const fabric = world.buildings.filter(b => !c.DSCity.PLACES[b.locationId] && W.district(centre(b.rect).x, centre(b.rect).y) === d && c.DSCity.ARCHETYPES[b.archetypeId].placement === 'fabric');
    assert.ok(fabric.length >= 3, `${d.id} has ${fabric.length} ordinary interiors`);
    const sealed = world.obstacles.filter(o => o.type === 'building' && W.district(o.x + o.w / 2, o.y + o.h / 2) === d);
    assert.ok(sealed.length >= 2, `${d.id} keeps background masses`);
  }
  for (const o of world.obstacles.filter(o => o.type === 'building')) { assert.equal(o.sealed, true, 'every mass is marked sealed'); assert.equal(o.protected, true); }
  for (const p of world.parcels.filter(p => p.use === 'sealed')) assert.ok(world.obstacles.some(o => o.parcelId === p.id && o.facade === p.side), `${p.id} faces its street`);
});

test('boundary parcels blend the neighbouring district across the street', () => {
  const blocks = new Map(world.blocks.map(b => [b.id, b]));
  let blended = 0;
  for (const p of world.parcels) {
    const b = blocks.get(p.blockId), col = b.col + (p.side === 'e' ? 1 : p.side === 'w' ? -1 : 0), row = b.row + (p.side === 's' ? 1 : p.side === 'n' ? -1 : 0);
    const nb = world.blocks[row * 6 + col], own = W.districtById(b.districtId).fabric;
    if (p.authored) continue; // authored pilot parcels choose their own archetypes
    if (nb && nb.districtId !== b.districtId) { assert.notDeepEqual({ ...p.weights }, { ...own }, `${p.id} blends`); blended++; }
    else assert.deepEqual({ ...p.weights }, { ...own }, `${p.id} keeps its district`);
  }
  assert.ok(blended > 5, 'some frontage sits on a district boundary');
});

test('debris is tagged; nothing mandatory blocks the base city', () => {
  for (const o of world.obstacles) if (o.debris) assert.ok(['optional-clear', 'decorative'].includes(o.debris), `${o.debris}`);
  assert.ok(world.debris.length >= 4);
  for (const d of world.debris) { assert.equal(d.tag, 'optional-clear'); const o = world.obstacles.find(o => o.debrisId === d.id); assert.ok(o && o.hp === undefined, `${d.id} is not shootable`); }
  assert.ok(!world.obstacles.some(o => o.debris === 'mandatory-clear'));
});

const foot = reach(world, { x: 0, y: 2800 });
test('radius-12 foot navigation reaches every entrance, lot gate, landmark and the evac road', () => {
  for (const b of world.buildings) for (const d of b.exteriorDoors) assert.ok(foot.near(centre(d.rect).x, centre(d.rect).y, 40), `door ${d.id}`);
  for (const l of world.lots) for (const e of l.entrances) assert.ok(foot.near(centre(e.rect).x, centre(e.rect).y, 40), `gate ${e.id}`);
  for (const k of world.landmarks) assert.ok(foot.near(k.x, k.y, 60), `landmark ${k.id}`);
  for (const [x, y] of [[0, 3400], [0, 1400], [0, -1400], [-2800, 1400], [2800, -1400], [1400, 2800], [0, -3300]]) assert.ok(foot.near(x, y, 40), `route ${x},${y}`);
});

test('the fire-truck slot has a truck-sized path to Northline and a foot bypass when occupied', () => {
  const trucks = world.vehicleSlots.filter(v => v.vehicleType === 'fireTruck');
  assert.equal(trucks.length, 1); const t = trucks[0];
  assert.equal(t.locationId, 'fire-station'); assert.equal(W.district(centre(t.rect).x, centre(t.rect).y).id, 'northline');
  const parked = world.obstacles.filter(o => o.slotId === t.id); for (const o of parked) world.obstacles.splice(world.obstacles.indexOf(o), 1);
  const drive = reach(world, centre(t.rect), 34, [], 20); world.obstacles.push(...parked);
  assert.ok(drive.near(-650, -1400, 30) && drive.near(0, -1400, 30), 'truck reaches the Northline road');
  const occupied = reach(world, { x: 0, y: 2800 }, 12, [{ ...t.rect, type: 'car' }]);
  const station = world.buildings.find(b => b.locationId === 'fire-station');
  for (const d of station.exteriorDoors) assert.ok(occupied.near(centre(d.rect).x, centre(d.rect).y, 40), `${d.id} with the truck parked`);
});

test('four fixed bulldozer pads each reach the road and leave the foot routes open', () => {
  const pads = world.vehicleSlots.filter(v => v.vehicleType === 'bulldozer');
  assert.equal(pads.length, 4);
  const yard = world.locations.find(l => l.id === 'machinery-yard');
  for (const p of pads) {
    assert.ok(contains(yard.rect, p.rect), `${p.id} in the machinery yard`);
    const drive = reach(world, centre(p.rect), 40, [], 20);
    assert.ok(drive.near(2800, 2100, 40) || drive.near(2400, 2800, 40), `${p.id} reaches a road`);
    const occupied = reach(world, { x: 0, y: 2800 }, 12, [{ ...p.rect, type: 'car' }]);
    for (const id of ['machine-shop', 'machinery-yard', 'fuel-store', 'loading-yard']) {
      const l = world.locations.find(l => l.id === id);
      for (const b of world.buildings.filter(b => b.locationId === id)) for (const d of b.exteriorDoors) assert.ok(occupied.near(centre(d.rect).x, centre(d.rect).y, 40), `${d.id} with ${p.id} occupied`);
      for (const lot of world.lots.filter(q => q.locationId === l.id)) for (const e of lot.entrances) assert.ok(occupied.near(centre(e.rect).x, centre(e.rect).y, 40), `${e.id} with ${p.id} occupied`);
    }
  }
});

// ---- Phase 3: enterable-building framework ----
const ROOMS = {
  supermarket: ['sales', 'office', 'backroom', 'cage'], hospital: ['ward', 'treatment-a', 'treatment-b', 'trial', 'corridor-w', 'corridor-c', 'corridor-e', 'offices', 'reception', 'records'],
  police: ['lobby', 'hall', 'offices', 'evidence', 'cells', 'service'], fireStation: ['bay', 'duty', 'medical'], radioStation: ['lobby', 'offices', 'studio', 'transmitter', 'control'],
  machineShop: ['dispatch', 'floor-north', 'floor', 'maintenance', 'fuel'], warehouse: ['floor', 'floor-south', 'office'], chapel: ['generator', 'chancel', 'store', 'nave'],
  morgue: ['prep', 'cold'], depot: ['office', 'parts', 'floor', 'lane'], holding: ['processing', 'holding'], armoury: ['counter', 'cage'], commandPost: ['briefing', 'comms'], pharmacy: ['shop', 'dispensary']
};
const SECURED = { supermarket: ['backroom', 'cage'], hospital: ['trial'], police: ['evidence'], armoury: ['cage'] };
const overlapArea = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

test('archetype layouts build their rooms, interior walls and door graph', () => {
  for (const b of world.buildings) {
    const want = ROOMS[b.archetypeId], local = b.rooms.map(r => r.id.slice(b.id.length + 1));
    if (want) { assert.deepEqual([...local].sort(), [...want].sort(), `${b.id} rooms`); assert.ok(b.interiorDoors.length >= 1, `${b.id} interior doors`); }
    else assert.equal(b.rooms.length, 1, `${b.id} one room`);
    for (const r of b.rooms) { assert.ok(contains(b.rect, r.rect), `${r.id} inside`); assert.ok(r.rect.w >= 60 && r.rect.h >= 60, `${r.id} is at least 60 across`); }
    for (let i = 0; i < b.rooms.length; i++) for (let j = i + 1; j < b.rooms.length; j++) assert.equal(overlapArea(b.rooms[i].rect, b.rooms[j].rect), 0, `${b.rooms[i].id} overlaps ${b.rooms[j].id}`);
    for (const d of b.interiorDoors) assert.equal(d.rooms.length, 2, `${d.id} joins two rooms`);
    for (const d of b.interiorDoors.filter(d => d.kind === 'opening')) assert.ok(!world.obstacles.some(o => o.buildingId === b.id && o.type === 'wall' && overlapArea(o, d.rect) > 0), `${d.id} is a real opening`);
    for (const d of b.exteriorDoors) assert.equal(d.rooms.length, 1, `${d.id} opens into one room`);
    // every room is reachable from an exterior door through the door graph
    const seen = new Set(b.exteriorDoors.flatMap(d => d.rooms)), edges = b.interiorDoors.map(d => d.rooms);
    for (let grew = true; grew;) { grew = false; for (const [p, q] of edges) if (seen.has(p) !== seen.has(q)) { seen.add(p); seen.add(q); grew = true; } }
    assert.equal(seen.size, b.rooms.length, `${b.id} door graph reaches every room`);
    const walls = world.obstacles.filter(o => o.buildingId === b.id && o.interior);
    if (want) assert.ok(walls.length >= 1, `${b.id} interior walls`);
  }
});

test('secured doors follow the brief, carry access rules and hide nothing permanently', () => {
  const found = {};
  for (const b of world.buildings) for (const d of b.interiorDoors.filter(d => d.kind === 'secured')) {
    assert.equal(d.access.rule, 'force'); assert.ok(d.access.time > 0 && d.access.noise > 0, d.id);
    assert.ok(world.obstacles.some(o => o.type === 'door' && o.doorId === d.id && o.protected && o.hp === undefined), `${d.id} blocks until forced`);
    (found[b.archetypeId] ||= []).push(...d.rooms.map(id => id.slice(b.id.length + 1)));
  }
  for (const [arch, rooms] of Object.entries(SECURED)) for (const r of rooms) assert.ok(found[arch]?.includes(r), `${arch} secures ${r}`);
  for (const arch of Object.keys(found)) assert.ok(SECURED[arch], `${arch} is not meant to have secured doors`);
});

test('large buildings split their roofs into zones that cover the whole footprint', () => {
  for (const b of world.buildings) {
    assert.ok(b.roofZones.length >= 1);
    if (b.w * b.h > 120000) assert.ok(b.roofZones.length >= 2, `${b.id} has wings`);
    let area = 0;
    for (const z of b.roofZones) { for (const q of z.rects) { assert.ok(contains(b.rect, q), `${z.id} inside`); area += q.w * q.h; } assert.ok(z.rooms.length); }
    assert.ok(area >= (b.w - 2 * b.wallT) * (b.h - 2 * b.wallT), `${b.id} roof covers the interior`);
    for (const r of b.rooms) assert.ok(b.roofZones.some(z => z.id === r.roofZoneId), `${r.id} zone`);
  }
});

// local flood fill around one building; secured door obstacles can be lifted for the query
function localReach(w, b, R, openSecured) {
  const lifted = openSecured ? w.obstacles.filter(o => o.type === 'door' && o.buildingId === b.id) : [];
  for (const o of lifted) w.obstacles.splice(w.obstacles.indexOf(o), 1);
  const cell = 6, x0 = b.x - 60, y0 = b.y - 60, nx = Math.ceil((b.w + 120) / cell), ny = Math.ceil((b.h + 120) / cell), pass = new Uint8Array(nx * ny), seen = new Uint8Array(nx * ny);
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) pass[y * nx + x] = W.blocked(w, x0 + (x + .5) * cell, y0 + (y + .5) * cell, R) ? 0 : 1;
  w.obstacles.push(...lifted);
  const q = [];
  for (const d of b.exteriorDoors) {
    // seed from the street approach: any walkable cell 30-55 units out in front of the opening
    const n = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[d.side], mx = d.rect.x + d.rect.w / 2, my = d.rect.y + d.rect.h / 2, half = Math.max(d.rect.w, d.rect.h) / 2;
    for (let out = 30; out <= 55; out += cell) for (let lat = -half; lat <= half; lat += cell) {
      const px = mx + n[0] * out + (n[0] ? 0 : lat), py = my + n[1] * out + (n[1] ? 0 : lat), cx = Math.floor((px - x0) / cell), cy = Math.floor((py - y0) / cell);
      if (cx >= 0 && cy >= 0 && cx < nx && cy < ny && pass[cy * nx + cx] && !seen[cy * nx + cx]) { seen[cy * nx + cx] = 1; q.push([cx, cy]); }
    }
  }
  for (let h = 0; h < q.length; h++) { const [x, y] = q[h]; for (const [ax, ay] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) if (ax >= 0 && ay >= 0 && ax < nx && ay < ny && pass[ay * nx + ax] && !seen[ay * nx + ax]) { seen[ay * nx + ax] = 1; q.push([ax, ay]); } }
  return (px, py, r) => { for (let y = Math.floor((py - r - y0) / cell); y <= Math.floor((py + r - y0) / cell); y++) for (let x = Math.floor((px - r - x0) / cell); x <= Math.floor((px + r - x0) / cell); x++) if (x >= 0 && y >= 0 && x < nx && y < ny && seen[y * nx + x]) return true; return false; };
}

test('survivors and brutes reach every room, door and socket from the street; furniture never seals a room', () => {
  for (const b of world.buildings) for (const [R, who] of [[12, 'survivor'], [17, 'brute']]) {
    const near = localReach(world, b, R, true);
    for (const d of b.exteriorDoors) assert.ok(near(d.rect.x + d.rect.w / 2, d.rect.y + d.rect.h / 2, 12), `${who} through ${d.id}`);
    for (const d of b.interiorDoors) assert.ok(near(d.rect.x + d.rect.w / 2, d.rect.y + d.rect.h / 2, 12), `${who} reaches ${d.id}`);
    for (const r of b.rooms) { const c = centre(r.rect); assert.ok(near(c.x, c.y, Math.min(r.rect.w, r.rect.h) / 2 - 4), `${who} enters ${r.id}`); }
    if (R === 12) for (const k of b.lootSockets) assert.ok(near(k.x, k.y, 10), `${who} reaches socket ${k.id}`);
  }
});

test('loot sockets are separate from furniture, clear of doorways and inside their rooms', () => {
  for (const b of world.buildings) {
    assert.ok(b.lootSockets.length >= 1, `${b.id} has sockets`);
    for (const k of b.lootSockets) {
      const room = b.rooms.find(r => r.id === k.roomId); assert.ok(room && inside(k, room.rect), `${k.id} in its room`);
      assert.equal(W.blocked(world, k.x, k.y, 14), null, `${k.id} clear`);
      for (const d of [...b.exteriorDoors, ...b.interiorDoors]) assert.ok(!inside(k, d.rect, 28), `${k.id} clear of ${d.id}`);
    }
  }
});

test('forcing a secured door takes one press, time and noise, and opens it exactly once', () => {
  const G = c.DSGame, s = G.create(21); G.addPlayer(s); s.mode = 'play'; s.spawnAcc = -1e9;
  const b = s.world.buildings.find(b => b.archetypeId === 'supermarket'), d = b.interiorDoors.find(d => d.kind === 'secured' && d.rooms.some(r => r.endsWith('backroom')) && d.rooms.some(r => r.endsWith('sales')));
  const p = s.players[0]; p.invuln = 1e9; p.x = d.rect.x + d.rect.w / 2; p.y = d.rect.y - 30;
  const nav = s.navVersion || 0, obstacles = s.world.obstacles.length;
  G.step(s, 1 / 60, { 0: { interact: false } });
  assert.equal(p.nearDoor, d.id, 'the door is offered');
  G.step(s, 1 / 60, { 0: { interact: true } });
  assert.equal(s.doorState[d.id].active, true);
  for (let i = 0; i < 60; i++) G.step(s, 1 / 60, {});
  assert.equal(s.doorState[d.id].open, false, 'forcing takes time');
  assert.ok(s.noise.some(n => n.kind === 'pry'), 'prying is audible');
  for (let i = 0; i < 120 && !s.doorState[d.id].open; i++) G.step(s, 1 / 60, {});
  assert.equal(s.doorState[d.id].open, true);
  assert.equal(s.world.obstacles.length, obstacles - 1); assert.equal(s.navVersion, nav + 1);
  assert.ok(s.noise.some(n => n.kind === 'door' && n.r === d.access.noise));
  assert.equal(G.openDoor(s, d), false, 'a second open does nothing'); assert.equal(s.navVersion, nav + 1);
  G.step(s, 1 / 60, { 0: { interact: true } }); assert.equal(p.nearDoor, null);
  // a door left mid-way keeps its progress for whoever comes back
  const e = b.interiorDoors.find(q => q.kind === 'secured' && q !== d); s.doorState[e.id].active = true; s.doorState[e.id].progress = 1;
  p.x = 3000; p.y = 3000; G.step(s, .5, {}); assert.equal(s.doorState[e.id].progress, 1);
});

test('roof zones fade independently and standing inside marks the location visited', () => {
  const G = c.DSGame, s = G.create(22); G.addPlayer(s); s.mode = 'play'; s.spawnAcc = -1e9;
  const b = s.world.buildings.find(b => b.archetypeId === 'hospital'), lobby = b.rooms.find(r => r.id.endsWith('reception')), p = s.players[0];
  p.invuln = 1e9; Object.assign(p, centre(lobby.rect));
  assert.equal(s.locationState['st-orison'].visited, false);
  for (let i = 0; i < 60; i++) G.step(s, 1 / 60, {});
  const zone = id => b.roofZones.find(z => z.id === b.id + '/roof-' + id);
  assert.ok(zone('centre').alpha < .2, 'the entered wing opens'); assert.ok(zone('east').alpha > .95 && zone('west').alpha > .95, 'other wings stay roofed');
  assert.equal(b.occupied, true); assert.equal(s.locationState['st-orison'].visited, true);
});

// ---- Phase 4: open lots ----
const FENCED = { park: 'hedge', graveyard: 'stone', serviceYard: 'chain', demolitionLot: 'hoarding', machineryYard: 'chain', burnYard: 'chain', compoundYard: 'chain' };
test('lot perimeters match their kind and open exactly at the gates', () => {
  for (const kind of ['park', 'parkingLot', 'graveyard', 'serviceYard', 'demolitionLot', 'machineryYard']) assert.ok(world.lots.some(l => l.kind === kind), `a ${kind} exists`);
  for (const l of world.lots) {
    const fences = world.obstacles.filter(o => o.lotId === l.id && o.type === 'fence');
    if (!FENCED[l.kind]) { assert.equal(fences.length, 0, `${l.id} has no perimeter`); continue; }
    assert.ok(fences.length, `${l.id} perimeter`);
    for (const f of fences) { assert.equal(f.fence, FENCED[l.kind]); assert.equal(f.protected, true); assert.equal(!!f.seeThrough, f.fence === 'chain'); assert.equal(f.hp, undefined); }
    for (const e of l.entrances) {
      assert.ok(!fences.some(f => overlapArea(f, e.rect) > 0), `${e.id} is an opening`);
      const cc = centre(e.rect); assert.ok(!world.obstacles.some(o => o.type === 'fence' && inside(cc, o)), `${e.id} centre is walkable`);
    }
    // every closed side is fenced away from its gates
    for (const side of ['n', 's', 'w', 'e']) {
      if (l.open.includes(side)) continue;
      const R = l.rect, gates = l.entrances.filter(e => e.side === side), horizontal = side === 'n' || side === 's';
      for (let t = .08; t < .95; t += .07) {
        const p = horizontal ? { x: R.x + R.w * t, y: side === 'n' ? R.y : R.y + R.h } : { x: side === 'w' ? R.x : R.x + R.w, y: R.y + R.h * t };
        if (gates.some(e => inside(p, e.rect, 4))) continue;
        assert.ok(fences.some(f => inside(p, f, 1)), `${l.id} ${side} side closed at ${t.toFixed(2)}`);
      }
    }
  }
});

test('lot dressing keeps fences and cover solid, paint and planting flat, and lanes and slots clear', () => {
  const FLAT = ['lots/plantingBed', 'lots/pathCross', 'lots/parkingLine_v', 'lots/trolley', 'lots/graveFlat', 'lots/pathGravel', 'lots/refugeNotice', 'lots/hoardingSign', 'lots/padMarking', 'lots/noticeBoard'];
  for (const p of world.props.filter(p => p.lotId)) if (FLAT.includes(p.art)) assert.equal(p.flat, true, p.art);
  for (const l of world.lots) {
    const solids = world.obstacles.filter(o => o.lotId === l.id && o.type !== 'fence');
    for (const o of solids) {
      assert.ok(contains(l.rect, o), `${o.art} inside ${l.id}`);
      for (const v of world.vehicleSlots.filter(v => v.lotId === l.id)) assert.equal(overlapArea(o, v.rect), 0, `${o.art} clear of ${v.id}`);
    }
    if (l.kind === 'graveyard') assert.ok(solids.filter(o => o.art === 'lots/grave').length >= 10 && world.props.some(p => p.lotId === l.id && p.art === 'lots/graveFlat'), 'graves are mixed cover and flat markers');
    if (l.kind === 'park') assert.ok(l.propZones.some(z => z.kind === 'paths') && l.propZones.some(z => z.kind === 'planting'), `${l.id} zones`);
    if (!l.bare && l.kind !== 'burnYard') assert.ok(l.propZones.length && l.lightAnchors.length + solids.length > 0, `${l.id} is dressed`);
  }
});

function lotReach(w, l, R) {
  const cell = 8, x0 = l.rect.x - 100, y0 = l.rect.y - 100, nx = Math.ceil((l.rect.w + 200) / cell), ny = Math.ceil((l.rect.h + 200) / cell), pass = new Uint8Array(nx * ny), seen = new Uint8Array(nx * ny), q = [];
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) pass[y * nx + x] = W.blocked(w, x0 + (x + .5) * cell, y0 + (y + .5) * cell, R) ? 0 : 1;
  for (const e of l.entrances) {
    const n = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[e.side], c = centre(e.rect), half = Math.max(e.rect.w, e.rect.h) / 2;
    for (let out = 40; out <= 80; out += cell) for (let lat = -half; lat <= half; lat += cell) {
      const cx = Math.floor((c.x + n[0] * out + (n[0] ? 0 : lat) - x0) / cell), cy = Math.floor((c.y + n[1] * out + (n[1] ? 0 : lat) - y0) / cell);
      if (cx >= 0 && cy >= 0 && cx < nx && cy < ny && pass[cy * nx + cx] && !seen[cy * nx + cx]) { seen[cy * nx + cx] = 1; q.push([cx, cy]); }
    }
  }
  for (let h = 0; h < q.length; h++) { const [x, y] = q[h]; for (const [ax, ay] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) if (ax >= 0 && ay >= 0 && ax < nx && ay < ny && pass[ay * nx + ax] && !seen[ay * nx + ax]) { seen[ay * nx + ax] = 1; q.push([ax, ay]); } }
  return (px, py, r) => { for (let y = Math.floor((py - r - y0) / cell); y <= Math.floor((py + r - y0) / cell); y++) for (let x = Math.floor((px - r - x0) / cell); x <= Math.floor((px + r - x0) / cell); x++) if (x >= 0 && y >= 0 && x < nx && y < ny && seen[y * nx + x]) return true; return false; };
}
test('every gate leads survivors and brutes into its lot, to its sockets and vehicle slots', () => {
  // the disposal yard's gates are closed in fixed geometry; the boss suite walks them open
  for (const l of world.lots.filter(l => l.entrances.length && l.locationId !== 'inner-arena')) for (const R of [12, 17]) {
    const near = lotReach(world, l, R);
    for (const e of l.entrances) assert.ok(near(centre(e.rect).x, centre(e.rect).y, 16), `${R} through ${e.id}`);
    if (R === 12) for (const k of l.lootSockets) assert.ok(near(k.x, k.y, 12), `${k.id} reachable`);
    for (const v of world.vehicleSlots.filter(v => v.lotId === l.id)) assert.ok(near(centre(v.rect).x, centre(v.rect).y, Math.max(v.rect.w, v.rect.h) / 2 + 30), `${v.id} reachable at ${R}`);
  }
});

test('lots own sites, appear on the map and clear without a roof', () => {
  for (const id of ['graveyard', 'residential-park', 'northline-park', 'market-parking']) {
    const l = world.locations.find(l => l.id === id); assert.ok(l.lotIds.length, `${id} owns a lot`);
    assert.ok(world.sites.some(s => s.locationId === id && s.lotId && s.sockets.length), `${id} owns a loot site`);
  }
  assert.equal(world.locations.find(l => l.id === 'graveyard').lootProfiles[0], 'evidence');
  assert.equal(world.locations.find(l => l.id === 'residential-park').lootProfiles[0], 'evidence');
  // the map paints every lot footprint
  const fills = [], ctx = new Proxy({ fillRect: (...a) => fills.push([ctx._fill, ...a]), measureText: () => ({ width: 10 }) }, { get: (t, k) => k in t ? t[k] : () => {}, set: (t, k, v) => { if (k === 'fillStyle') t._fill = v; t[k] = v; return true; } });
  const G = c.DSGame, s = G.create(31); W.drawMap(ctx, s, 0, 0, 720, 720);
  for (const kind of ['park', 'parkingLot', 'graveyard', 'serviceYard']) assert.ok(fills.some(f => f[0] && f[0].length === 7 && s.world.lots.some(l => l.kind === kind && Math.abs(f[1] - (l.rect.x + 3600) * .1) < 1)), `${kind} drawn`);
  // standing in the graveyard marks it visited; taking every authored item there clears it
  G.addPlayer(s); s.mode = 'play'; s.spawnAcc = -1e9; const p = s.players[0]; p.invuln = 1e9;
  const grave = s.world.lots.find(l => l.kind === 'graveyard'); Object.assign(p, { x: grave.rect.x + grave.rect.w / 2 + 10, y: grave.rect.y + grave.rect.h / 2 });
  G.step(s, 1 / 60, {}); assert.equal(s.locationState.graveyard.visited, true);
  const lotLoc = s.world.lots.map(l => l.locationId).find(id => s.loot.some(i => i.locationId === id && s.world.sites.find(x => x.id === i.siteId).lotId));
  assert.ok(lotLoc, 'some lot holds loot this run'); assert.equal(s.locationState[lotLoc].cleared, false);
  for (const it of s.loot.filter(i => i.locationId === lotLoc)) { p.medkits = 0; s.supplies.provisions = 0; s.supplies.vehicleFuel = 0; assert.ok(G.collect(s, p, it)); }
  assert.equal(s.locationState[lotLoc].cleared, true);
  // parking bays are ordinary driveable cars from the existing spawner
  const bays = s.world.vehicleSlots.filter(v => v.lotId && s.world.lots.find(l => l.id === v.lotId).kind === 'parkingLot');
  assert.ok(bays.length >= 3); for (const b of bays) assert.ok(s.vehicles.some(v => v.slotId === b.id && v.vehicleType === 'sedan'), b.id);
});

test('chain-link fences let sight and shots through; hedges, stone walls and hoardings do not', () => {
  const G = c.DSGame, s = G.create(32);
  for (const kind of ['chain', 'hedge', 'stone', 'hoarding']) {
    const f = s.world.obstacles.find(o => o.type === 'fence' && o.fence === kind && Math.max(o.w, o.h) > 60); assert.ok(f, kind);
    const horizontal = f.w > f.h, cx = f.x + f.w / 2, cy = f.y + f.h / 2, a = horizontal ? [cx, cy - 20] : [cx - 20, cy], b = horizontal ? [cx, cy + 20] : [cx + 20, cy];
    const hit = G.lineObstacle(s, ...a, ...b);
    if (kind === 'chain') assert.ok(!hit || hit.obstacle !== f, 'chain-link is see-through'); else assert.equal(hit?.obstacle, f, `${kind} blocks sight`);
    assert.ok(W.blocked(s.world, cx, cy, 4), `${kind} blocks movement`);
  }
});

// ---- Phase 5: district briefs ----
const bld = arch => world.buildings.find(b => b.archetypeId === arch);
const room = (b, id) => b.rooms.find(r => r.id === `${b.id}/${id}`);
const anchor = (b, kind) => b.anchors.find(a => a.kind === kind);
function anchorsReachable(b) {
  const near = localReach(world, b, 12, true);
  for (const a of b.anchors) {
    assert.ok(inside(a, b.rooms.find(r => r.id === a.roomId).rect), `${a.id} in its room`);
    assert.equal(W.blocked(world, a.x, a.y, 12), null, `${a.id} clear`); assert.ok(near(a.x, a.y, 12), `${a.id} reachable`);
  }
}

test('5A South Blocks: stripped market with stock rooms, police, parking and park beside a clear evac road', () => {
  const m = bld('supermarket'), pub = m.exteriorDoors.find(d => d.kind === 'public');
  assert.equal(m.locationId, 'crossroads-supermarket'); assert.ok(pub.rect.w >= 140 && pub.side === 'n', 'double entrance on the crossroads');
  const furn = world.obstacles.filter(o => o.buildingId === m.id && o.type === 'furniture');
  assert.ok(furn.filter(o => o.art === 'buildings/furn_checkout').length >= 2 && furn.filter(o => o.art === 'buildings/furn_shelfAisle' && o.stripped).length >= 4, 'checkouts and stripped aisles');
  const use = u => m.lootSockets.filter(k => k.use === u);
  assert.ok(use('stock').some(k => k.roomId.endsWith('backroom')) && use('stock').some(k => k.roomId.endsWith('cage')), 'back room and cage stock');
  assert.equal(use('vending').length, 1); assert.ok(use('pocket').length >= 2);
  assert.ok(!m.lootSockets.some(k => k.roomId.endsWith('sales') && k.use === 'stock'), 'public shelves hold no stock');
  assert.ok(world.sites.some(s => s.lotId === 'crossroads-supermarket/loading' && s.sockets.length && s.lootProfile === 'provisions'), 'loading yard stock site');
  const police = bld('police'); assert.ok(police.exteriorDoors.some(d => d.kind === 'barred'), 'barred service entrance');
  const evac = { x: -130, y: 1400, w: 260, h: 2200 };
  for (const id of ['market-parking', 'crossroads-supermarket', 'police-station']) assert.equal(overlapArea(world.locations.find(l => l.id === id).rect, evac), 0, `${id} keeps off the evac road`);
  const park = world.lots.find(l => l.locationId === 'residential-park'), around = world.buildings.filter(b => ['home', 'shop'].includes(b.archetypeId) && Math.hypot(centre(b.rect).x - centre(park.rect).x, centre(b.rect).y - centre(park.rect).y) < 700);
  assert.ok(around.length >= 3, `homes and shops around the park (${around.length})`);
  const road = reach(world, { x: 0, y: 1400 }, 60, [], 40);
  assert.ok(road.near(0, 2750, 40) && road.near(0, 3400, 40), 'the final approach stays wide open');
  assert.equal(W.locationById(world, 'checkpoint-nine').story, true);
});

test('5B Civic Ward: campus rooms, records and trial evidence, the furnace clue, lit corridors and dark wings', () => {
  const h = bld('hospital'); assert.equal(h.locationId, 'st-orison');
  for (const k of ['patientRecords', 'trialEvidence', 'furnaceClue']) assert.ok(anchor(h, k), k);
  assert.ok(anchor(h, 'trialEvidence').roomId.endsWith('trial') && anchor(h, 'patientRecords').roomId.endsWith('records'));
  anchorsReachable(h);
  const lit = new Set(h.lightAnchors.map(l => l.roomId.slice(h.id.length + 1)));
  for (const r of ['corridor-w', 'corridor-c', 'corridor-e']) assert.ok(lit.has(r), `${r} lit`);
  for (const r of ['ward', 'treatment-a', 'treatment-b', 'trial', 'offices', 'records']) assert.ok(!lit.has(r), `${r} stays dark`);
  assert.ok(h.lightAnchors.some(l => l.strobe), 'some corridor tubes flicker');
  for (const id of ['pharmacy', 'clinic']) assert.ok(!world.locations.find(l => l.id === id).compoundId, `${id} is separate from the campus`);
  assert.ok(world.lots.some(l => l.locationId === 'ambulance-yard') && world.obstacles.some(o => o.art === 'props/ambulance' && o.slotId === 'ambulance'));
});

test('5C Northline: Blackglass rooms, fenced mast yard, two station interactions, fire station and truck slot', () => {
  const r = bld('radioStation'), prep = anchor(r, 'radioPrepare'), tx = anchor(r, 'radioTransmit');
  assert.ok(prep && tx && prep.roomId !== tx.roomId, 'preparation and transmission are separate rooms'); anchorsReachable(r);
  const radio = world.landmarks.find(l => l.id === 'radio'); assert.deepEqual([radio.x, radio.y], [tx.x, tx.y]);
  const yard = world.lots.find(l => l.id === 'blackglass-radio/mast-yard'), mast = world.setpieces.find(p => p.kind === 'radio');
  assert.ok(inside(mast, yard.rect) && world.obstacles.some(o => o.lotId === yard.id && o.type === 'fence'), 'mast stands in a fenced yard');
  assert.ok(room(bld('fireStation'), 'bay') && room(bld('fireStation'), 'duty') && room(bld('fireStation'), 'medical'));
  const trucks = world.obstacles.filter(o => o.vehicleType === 'fireTruck'); assert.equal(trucks.length, 1); assert.equal(trucks[0].locationId, 'fire-station');
  for (const id of ['municipal-depot', 'utility-yard', 'northline-park']) assert.equal(world.locations.find(l => l.id === id).districtId, 'northline');
});

test('5D Ashworks: shop compound, connected yards, pads reach the optional debris, Day 9 shutdown', () => {
  const shop = bld('machineShop'); for (const id of ['dispatch', 'floor', 'maintenance', 'fuel']) assert.ok(room(shop, id), id);
  assert.ok(shop.exteriorDoors.some(d => d.kind === 'vehicleBay' && d.side === 's'), 'rear loading access');
  const yardArt = world.obstacles.filter(o => o.locationId === 'loading-yard').map(o => o.art);
  for (const a of ['lots/conveyor', 'lots/spoilHeap', 'lots/craneBase', 'lots/gantryLeg', 'lots/pipeBank']) assert.ok(yardArt.includes(a), a);
  const pile = world.debris.find(d => d.id === 'machine-shop/ashworks-lane'), lifted = world.obstacles.filter(o => o.debrisId === pile.id);
  for (const o of lifted) world.obstacles.splice(world.obstacles.indexOf(o), 1);
  try { for (const p of world.vehicleSlots.filter(v => v.vehicleType === 'bulldozer')) assert.ok(reach(world, centre(p.rect), 40, [], 20).near(centre(pile.rect).x, centre(pile.rect).y, 50), `${p.id} reaches the lane pile`); }
  finally { world.obstacles.push(...lifted); }
  assert.ok(world.props.some(p => p.art === 'lots/shutdownChecklist') && world.props.some(p => p.art === 'tiles/decalAsh' && p.buildingId === shop.id), 'abrupt shutdown paperwork and fresh ash');
  assert.ok(!world.props.concat(world.obstacles).some(o => /overgrow|vine|moss/i.test(o.art || '')), 'no overgrowth anywhere');
  assert.equal(world.locations.find(l => l.id === 'furnace-plant').story, true);
});

test('5E Old Quarter: graveyard paths and gate on the chapel sightline, chapel refuge and generator, collapsed terraces', () => {
  const G = c.DSGame, s = G.create(4), chapel = s.world.buildings.find(b => b.archetypeId === 'chapel'), side = chapel.exteriorDoors.find(d => d.side === 'w');
  const grave = s.world.lots.find(l => l.kind === 'graveyard'), gate = grave.entrances.find(e => e.side === 'e');
  const from = { x: side.rect.x - 20, y: side.rect.y + side.rect.h / 2 }, to = { x: gate.rect.x - 60, y: gate.rect.y + gate.rect.h / 2 };
  assert.equal(G.lineObstacle(s, from.x, from.y, to.x, to.y), null, 'the chapel side door looks through the graveyard gate');
  assert.ok(grave.propZones.some(z => z.kind === 'paths'));
  const ch = bld('chapel'); for (const id of ['nave', 'generator', 'store']) assert.ok(room(ch, id), id);
  assert.ok(anchor(ch, 'chapelGenerator').roomId.endsWith('generator') && anchor(ch, 'refugeLedger')); anchorsReachable(ch);
  assert.ok(world.props.filter(p => p.art === 'buildings/furn_bedroll' && p.buildingId === ch.id).length >= 3, 'refuge bedrolls');
  const collapsed = world.obstacles.filter(o => o.collapsed);
  assert.ok(collapsed.length >= 2 && collapsed.every(o => W.district(o.x + o.w / 2, o.y + o.h / 2).id === 'ruins'), 'collapsed terraces in the Old Quarter only');
  assert.ok(world.lots.filter(l => l.kind === 'demolitionLot' && W.district(centre(l.rect).x, centre(l.rect).y).id === 'ruins').length >= 2);
});

test('5F Central Quarantine: processing ring, rooms around the disposal yard, paperwork trail and placards', () => {
  for (const id of ['command-post', 'holding-building', 'armoury']) assert.ok(world.buildings.some(b => b.locationId === id), id);
  const cp = bld('commandPost'); assert.ok(anchor(cp, 'commandPayload') && anchor(cp, 'checkpointOverride')); anchorsReachable(cp);
  anchorsReachable(bld('holding'));
  assert.ok(world.obstacles.some(o => o.locationId === 'processing-tents' && o.art === 'barricade/tentMil'), 'processing tents');
  assert.ok(world.obstacles.some(o => o.locationId === 'vehicle-yard' && o.art === 'barricade/humvee'), 'vehicle yard');
  assert.equal(world.props.filter(p => p.quarantineRing && p.light && p.art === 'barricade/floodlight').length, 4, 'floodlit corners');
  assert.ok(world.props.filter(p => p.art === 'barricade/razorWire' && p.locationId === 'patient-furnace').length > 20, 'razor wire on the ring');
  assert.ok(world.props.filter(p => p.trail === 'intake-to-disposal').length >= 3, 'paperwork trail');
  assert.equal(world.props.filter(p => p.art === 'props/signPlacard' && p.setpiece).length, 4, 'placards at the four approaches');
  assert.ok(world.props.some(p => p.art === 'props/signPlacard' && p.gatePlacard), 'the placard at the disposal-yard gate');
  assert.ok(world.props.filter(p => p.queue).length >= 8, 'processing queue outside the south gate');
  assert.equal(world.arenaGates.length, 4); for (const g of world.arenaGates) assert.ok(world.obstacles.some(o => o.gateId === g.id && o.type === 'gate' && o.protected), 'gate starts closed');
  assert.equal(world.obstacles.filter(o => o.arenaCover).length, 4, 'arena cover');
});

// ---- Phase 6: location loot and economy ----
const { ECONOMY, LOOT_PROFILES } = c.DSCity;
const resourceOf = i => i.type === 'ammo' ? (i.ammo === 'fuel' ? 'incendiary' : i.ammo) : i.type === 'weapon' ? (i.quality > 1 ? 'weaponQ2' : 'weapon') : i.type;
const SEED_WORLDS = Array.from({ length: 50 }, (_, k) => W.create(k + 1));

test('loot profiles map the ten categories onto real resources', () => {
  assert.deepEqual([...Object.keys(ECONOMY.profiles)].sort(), [...Object.keys(LOOT_PROFILES)].sort());
  for (const [id, p] of Object.entries(ECONOMY.profiles)) { assert.ok(Object.values(p).some(v => v > 0), id); for (const r of Object.keys(p)) assert.ok(ECONOMY.resources[r], `${id}.${r}`); }
  assert.deepEqual(Object.keys(ECONOMY.profiles.evidence), ['xp'], 'evidence offers intel, not combat supply');
  assert.ok(!ECONOMY.profiles.medical.shells && !ECONOMY.profiles.medical.bullets, 'medical never offers ammunition');
  assert.deepEqual([...ECONOMY.order].sort(), [...Object.keys(ECONOMY.resources)].sort());
});

test('every authored item sits on a clear socket of its own site, away from doors and gates', () => {
  for (const w of SEED_WORLDS.slice(0, 6)) {
    const doors = [...w.buildings.flatMap(b => [...b.exteriorDoors, ...b.interiorDoors]), ...w.lots.flatMap(l => l.entrances)];
    for (const s of w.sites) for (const i of s.loot) {
      const k = s.sockets.find(k => k.id === i.socketId); assert.ok(k, `${i.id} socket`); assert.deepEqual([i.x, i.y], [k.x, k.y]);
      assert.equal(i.siteId, s.id); assert.equal(i.locationId, s.locationId);
      assert.equal(W.blocked(w, i.x, i.y, 12), null, `${i.id} overlaps geometry`);
      if (i.id !== 'checkpoint-nine/spawn-cache#w') for (const d of doors) assert.ok(!inside(i, d.rect, 24), `${i.id} blocks ${d.id}`);
    }
  }
});

test('profile rules hold across 50 seeds: no forbidden drops, no guaranteed high-quality homes', () => {
  const homeQ2 = {};
  for (const w of SEED_WORLDS) {
    const loc = new Map(w.locations.map(l => [l.id, l]));
    for (const s of w.sites) for (const i of s.loot) {
      if (i.id === 'checkpoint-nine/spawn-cache#w') continue;
      const l = loc.get(s.locationId), res = resourceOf(i), profiles = s.sockets.length && l.lootProfiles.length ? l.lootProfiles : [s.lootProfile];
      assert.ok(profiles.some(p => (ECONOMY.profiles[p] || {})[res] > 0) || s.lootProfile && ECONOMY.profiles[s.lootProfile][res] > 0, `${i.id}: ${res} not allowed by ${profiles}`);
      if (s.locationId === 'pharmacy') assert.ok(!['shells', 'bullets', 'weapon', 'weaponQ2'].includes(res), `pharmacy ${res}`);
      if (s.locationId === 'graveyard') assert.ok(!res.startsWith('weapon'), 'graveyard weapon crate');
      if (l.archetypeId === 'home' && res === 'weaponQ2') homeQ2[l.id] = (homeQ2[l.id] || 0) + 1;
    }
  }
  for (const [id, n] of Object.entries(homeQ2)) assert.ok(n <= 12, `${id} holds a quality-2 weapon in ${n}/50 runs`);
});

test('world loot stays inside the explicit per-resource envelopes over seeds 1-50', () => {
  const E = ECONOMY.envelopes, fuelByDistrict = {};
  for (const w of SEED_WORLDS) {
    const t = tally(W, w);
    for (const k of ['pickups', 'bullets', 'shells', 'incendiaryFuel', 'medkits', 'xp', 'weaponQ1', 'weaponQ2', 'provisions', 'vehicleFuel']) assert.ok(t[k] >= E[k][0] && t[k] <= E[k][1], `seed ${w.seed} ${k}=${t[k]} outside ${E[k]}`);
    for (const [k, [lo, hi]] of Object.entries(E.southBlocksShare)) assert.ok(t.southBlocksShare[k] >= lo && t.southBlocksShare[k] <= hi, `seed ${w.seed} South Blocks ${k} share ${t.southBlocksShare[k].toFixed(2)}`);
    assert.ok(t.ashworksFuel >= E.ashworksFuelMin, `seed ${w.seed} Ashworks fuel ${t.ashworksFuel}`);
    assert.ok(t.supermarketProvisions >= E.supermarketProvisions[0] && t.supermarketProvisions <= E.supermarketProvisions[1], `seed ${w.seed} market rations ${t.supermarketProvisions}`);
    for (const s of w.sites) for (const i of s.loot) if (i.type === 'vehicleFuel') { const d = W.district(i.x, i.y).id; fuelByDistrict[d] = (fuelByDistrict[d] || 0) + i.amount; }
  }
  const richest = Object.entries(fuelByDistrict).sort((a, b) => b[1] - a[1])[0][0];
  assert.equal(richest, 'industry', 'Ashworks is the richest vehicle-fuel district');
  // the supermarket stock is useful but finite: fewer than a third of all rations
  const market = SEED_WORLDS.reduce((n, w) => n + tally(W, w).supermarketProvisions, 0), all = SEED_WORLDS.reduce((n, w) => n + tally(W, w).provisions, 0);
  assert.ok(market / all < .34, `market share of rations ${(market / all).toFixed(2)}`);
  // weak-supply places still give a reason to enter: graveyard and parks carry intel over the sample
  for (const id of ['graveyard', 'residential-park', 'northline-park']) assert.ok(SEED_WORLDS.some(w => w.sites.some(s => s.locationId === id && s.loot.some(i => i.type === 'xp'))), `${id} intel`);
});

test('rations and jerrycans are shared squad stock with caps; overflow stays on the ground', () => {
  const G = c.DSGame, s = G.create(40); G.addPlayer(s); G.addPlayer(s, 'pad:0'); s.mode = 'play';
  const [p, q] = s.players, fuel = s.ammo.fuel, F = ECONOMY.fuel, P = ECONOMY.provisions;
  assert.equal(G.CAR.maxFuel / F.distancePerLitre, 56, 'a sedan tank holds 56 L'); assert.equal(G.CAR.minFuel / F.distancePerLitre, 8);
  const can = n => ({ id: 'can' + n, x: p.x, y: p.y, type: 'vehicleFuel', amount: 20 });
  for (let n = 0; n < 3; n++) assert.ok(G.collect(s, n % 2 ? q : p, can(n)));
  assert.equal(s.supplies.vehicleFuel, 60); assert.equal(s.ammo.fuel, fuel, 'jerrycans never touch incendiary fuel');
  const extra = can(9); assert.equal(G.collect(s, p, extra), false, 'a full squad leaves the can'); assert.equal(extra.taken, undefined); assert.equal(extra.amount, 20);
  s.supplies.vehicleFuel = 50; const part = can(10); assert.ok(G.collect(s, p, part)); assert.equal(s.supplies.vehicleFuel, 60); assert.equal(part.amount, 10); assert.ok(!part.taken, 'the rest stays in the can');
  G.collect(s, p, { id: 'inc', x: p.x, y: p.y, type: 'ammo', ammo: 'fuel', amount: 30 }); assert.equal(s.supplies.vehicleFuel, 60, 'incendiary fuel never fills jerrycans');
  for (let n = 0; n < P.carryCap; n++) assert.ok(G.collect(s, n % 2 ? q : p, { id: 'r' + n, x: 0, y: 0, type: 'provision', amount: 1 }));
  assert.equal(G.collect(s, p, { id: 'r9', x: 0, y: 0, type: 'provision', amount: 1 }), false, 'ration cap');
  // eating is its own action (city_v2 Section 0): heal never falls back to a ration, eat never heals, once per half meal
  p.hp = 60; p.medkits = 1; G.step(s, 1 / 60, { 0: { heal: true } }); assert.equal(p.medkits, 0); assert.equal(s.supplies.provisions, P.carryCap, 'healing never eats');
  p.hp = p.maxHp; G.step(s, 1 / 60, { 0: { heal: true } }); assert.equal(s.supplies.provisions, P.carryCap, 'a refused heal does not fall back to eating'); assert.equal(p.notice.text, 'No medkits');
  G.step(s, 1 / 60, { 0: { eat: true } }); assert.equal(s.supplies.provisions, P.carryCap - 1); assert.ok(p.fed > 80); assert.match(p.notice.text, /rations? left/);
  G.step(s, 1 / 60, { 0: { eat: true } }); assert.equal(s.supplies.provisions, P.carryCap - 1, 'no double meal');
  assert.equal(p.hp, p.maxHp);
  p.stamina = 10; q.stamina = 10; p.staminaDelay = q.staminaDelay = 0; q.fed = 0; G.step(s, .5, {});
  assert.ok(p.stamina - 10 > (q.stamina - 10) * 1.3, 'fed survivors recover stamina faster');
});

test('authored-site completion ignores drops and rewards, which carry their own ownership', () => {
  const G = c.DSGame, s = G.create(41); G.addPlayer(s); s.mode = 'play';
  const r = G.holdPoint(s, 'prepare'), p = s.players[0]; Object.assign(p, { x: r.x, y: r.y + 10, invuln: 1e9 });
  s.circuit.emergency = true; s.campaign.holding = 'prepare'; s.campaign.prepareProgress = G.HOLDS.prepare - .01; G.step(s, .05, {});
  const pallet = s.loot.filter(i => i.rewardId === 'radio-pallet'); assert.equal(pallet.length, 4);
  assert.ok(pallet.every(i => !i.siteId && !i.locationId));
  const before = JSON.stringify(s.siteState); for (const i of pallet) { p.medkits = 0; G.collect(s, p, i); } assert.equal(JSON.stringify(s.siteState), before);
});

// ---- Phase 7: requisition map ----
function mockCtx() {
  const log = { fills: [], texts: [] }, t = { _fill: null, fillRect: (...a) => log.fills.push([t._fill, ...a]), fillText: (s, x, y) => log.texts.push([s, x, y]), measureText: s => ({ width: s.length * 6 }) };
  return { log, ctx: new Proxy(t, { get: (o, k) => k in o ? o[k] : () => {}, set: (o, k, v) => { if (k === 'fillStyle') o._fill = v; o[k] = v; return true; } }) };
}
test('every required location has a name, district, icon or story marker, and a known map state', () => {
  const G = c.DSGame, s = G.create(51), P = c.DSCity.LOOT_PROFILES;
  for (const d of W.DISTRICTS) for (const id of d.required) {
    const l = W.locationById(s.world, id); assert.ok(l.name && l.districtId === d.id, id);
    assert.ok(l.story || (l.mapIcon && P[l.mapIcon]) || id === 'inner-arena', `${id} icon`);
    assert.equal(W.mapState(s, l), 'unvisited', `${id} known from the start`);
  }
  for (const k of s.world.landmarks) assert.ok(W.locationById(s.world, k.locationId).story);
  const cacheLoc = s.world.locations.find(l => l.kind === 'cache'); assert.equal(W.mapState(s, cacheLoc), null, 'minor caches appear once visited');
  const fabric = s.world.locations.find(l => l.archetypeId === 'home'); assert.equal(W.mapState(s, fabric), null);
  const { ctx, log } = mockCtx(); W.drawMap(ctx, s, 0, 0, 720, 720);
  for (const k of s.world.landmarks) assert.ok(log.texts.some(t => t[0] === k.name.toUpperCase()), `${k.id} named on the full map`);
  const local = mockCtx(); W.drawMap(local.ctx, s, 0, 0, 220, 220, W.mapView(s, true)); assert.equal(local.log.texts.length, 0, 'no names at the local scale');
  assert.ok(fs.readFileSync(path.join(root, 'hud.js'), 'utf8').includes('drawMapLegend'), 'the full map shows the requisition key');
});

test('map states move visit -> partial -> cleared, empty places read as empty, and nothing reopens', () => {
  const G = c.DSGame, s = G.create(52); G.addPlayer(s); s.mode = 'play'; s.spawnAcc = -1e9;
  const p = s.players[0]; p.invuln = 1e9;
  const loc = s.world.locations.find(l => l.required && !l.story && s.loot.filter(i => i.locationId === l.id).length >= 2 && s.world.buildings.some(b => b.locationId === l.id));
  const b = s.world.buildings.find(b => b.locationId === loc.id), room0 = b.rooms[0].rect;
  Object.assign(p, centre(room0)); G.step(s, 1 / 30, {});
  assert.equal(W.mapState(s, loc), 'visited');
  const items = s.loot.filter(i => i.locationId === loc.id); const clearAll = () => { p.medkits = 0; s.supplies.provisions = 0; s.supplies.vehicleFuel = 0; };
  clearAll(); G.collect(s, p, items[0]); assert.equal(W.mapState(s, loc), 'visited', 'partial loot keeps the icon lit');
  for (const i of items.slice(1)) { clearAll(); G.collect(s, p, i); }
  assert.equal(W.mapState(s, loc), 'cleared'); assert.equal(loc.name, W.locationById(s.world, loc.id).name);
  s.loot.push({ id: 'drop2', x: p.x, y: p.y, type: 'weapon', weapon: 'smg', quality: 1, amount: 1 }); assert.equal(W.mapState(s, loc), 'cleared', 'a dropped gun does not reopen it');
  const empty = s.world.locations.find(l => l.archetypeId === 'home' && !s.locationState[l.id].hadSupplies);
  const eb = s.world.buildings.find(q => q.locationId === empty.id); Object.assign(p, centre(eb.rooms[0].rect)); G.step(s, 1 / 30, {});
  assert.equal(W.mapState(s, empty), 'empty', 'a visited place that never held supplies');
  const cache = s.world.locations.find(l => l.kind === 'cache' && l.id.startsWith('street')); Object.assign(p, centre(cache.rect)); for (let i = 0; i < 20; i++) G.step(s, 1 / 30, {});
  assert.ok(['visited', 'empty', 'cleared'].includes(W.mapState(s, cache)), 'reaching a street cache reveals it');
});

test('the fire-truck slot is always marked and the truck marker follows the live truck, empty or wrecked', () => {
  const G = c.DSGame, s = G.create(53), f = W.fireTruckMarks(s);
  assert.ok(f.slot && f.truck && !f.moved && !f.truck.wrecked);
  const t = s.vehicles.find(v => v.vehicleType === 'fireTruck'); assert.ok(t, 'the truck is a live vehicle');
  const tx = t.x; t.x -= 400; assert.equal(W.fireTruckMarks(s).moved, true, 'a moved truck leaves its slot outline empty'); t.x = tx;
  t.fuel = 0; assert.equal(W.fireTruckMarks(s).truck.empty, true);
  t.dead = true; assert.equal(W.fireTruckMarks(s).truck.wrecked, true);
  t.removed = true; assert.equal(W.fireTruckMarks(s).truck, null, 'no replacement truck is advertised');
});

// ---- Phase 9: district lighting ----
test('only Ashworks still burns; cold wrecks elsewhere carry no fire light', () => {
  for (const w of [world, SEED_WORLDS[9]]) {
    const burning = w.obstacles.filter(o => o.burning);
    assert.ok(burning.length > 0, 'Ashworks still smoulders');
    for (const o of burning) assert.equal(W.district(o.x, o.y).id, 'industry', `burning wreck at ${o.x},${o.y}`);
    assert.ok(w.obstacles.some(o => o.cold && o.art.includes('Burnt')), 'cold burnt-out wrecks elsewhere');
    for (const l of w.lights) if (l.o && l.o.cold) assert.fail('a cold wreck is in the light list');
    for (const l of w.lights.filter(l => l.r === 120 && l.o && l.o.type === 'car')) assert.equal(W.district(l.x, l.y).id, 'industry');
  }
  assert.ok(!fs.readFileSync(path.join(root, 'world.js'), 'utf8').includes('o.burning=!!o.forceBurn'), 'no cross-district forceBurn exception');
});

test('district light characters: hospital flicker and a dead wing, Ashworks furnace and beacons, moonlit graveyard, harsh ring', () => {
  const h = bld('hospital'), st = id => h.lightAnchors.filter(l => l.roomId.endsWith(id)).map(l => l.state);
  assert.ok(st('corridor-w').includes('strobe') && st('corridor-e').includes('dead') && st('corridor-c').includes('on'), 'corridor flicker, a failed wing, a holding centre');
  assert.ok(world.props.some(p => p.flicker && p.locationId === 'furnace-plant' && p.light.col === '#ff7b35'), 'furnace glow');
  assert.ok(world.props.filter(p => p.warning && p.strobe).length >= 3, 'Ashworks warning beacons');
  assert.ok(world.props.filter(p => p.moonlight && p.locationId === 'graveyard').length >= 2, 'graveyard moonlight');
  const ring = world.props.filter(p => p.quarantineRing && p.light), inner = ['command-post', 'holding-building', 'armoury'];
  assert.ok(ring.length >= 12, 'harsh ring lighting');
  for (const b of world.buildings.filter(b => inner.includes(b.locationId))) assert.equal(b.lightAnchors.length, 0, `${b.locationId} stays dark inside`);
  for (const p of world.props.filter(p => p.light)) assert.ok(!(p.light.r > 200 && p.art === null && !p.quarantineRing && p.locationId !== 'furnace-plant' && !p.moonlight), 'no waypoint beams');
});

test('circuit-switched practicals light the chapel, Blackglass and Checkpoint Nine only once the emergency circuit runs', () => {
  const G = c.DSGame, s = G.create(61), circuit = s.world.props.filter(p => p.circuit === 'emergency');
  for (const id of ['chapel', 'blackglass-radio', 'checkpoint-nine']) assert.ok(circuit.some(p => p.locationId === id), `${id} has circuit lights`);
  const nave = s.world.buildings.find(b => b.archetypeId === 'chapel').rooms.find(r => r.id.endsWith('nave')).rect, pt = { x: nave.x + nave.w * .5, y: nave.y + nave.h * .45 };
  assert.equal(G.litAt(s, pt.x, pt.y), false, 'dark before the generator'); s.circuit.emergency = true; assert.equal(G.litAt(s, pt.x, pt.y), true, 'lit after');
  s.circuit.emergency = false; const gate = { x: 0, y: 2600 }; const before = s.world.lights.filter(l => l.circuit && Math.hypot(l.x - gate.x, l.y - gate.y) < 200).length; assert.ok(before >= 2, 'gate floods are circuit lights');
});

test('walls occlude point lights for the simulation; chain-link does not; headlights light ahead', () => {
  const G = c.DSGame, s = G.create(62), w = s.world;
  // a lit street lamp and a sealed building face: the point on the far side of the building is not lit by that lamp
  const b = w.obstacles.find(o => o.type === 'building' && o.w > 200 && o.h > 150 && w.lights.some(l => !l.circuit && Math.hypot(l.x - (o.x + o.w / 2), l.y - o.y) < l.r && l.y < o.y));
  const lamp = w.lights.find(l => !l.circuit && Math.hypot(l.x - (b.x + b.w / 2), l.y - b.y) < l.r && l.y < b.y);
  assert.equal(G.occluded(s, lamp.x, lamp.y, b.x + b.w / 2, b.y + b.h + 5), true, 'the building shades its far side');
  const chain = w.obstacles.find(o => o.type === 'fence' && o.seeThrough && o.w > 60), mid = { x: chain.x + chain.w / 2, y: chain.y };
  assert.equal(G.occluded(s, mid.x, mid.y - 30, mid.x, mid.y + 30), false, 'chain-link passes light');
  const room = bld('hospital').rooms.find(r => r.id.endsWith('ward')).rect, inside = { x: room.x + room.w / 2, y: room.y + room.h / 2 };
  assert.equal(w.lights.some(l => !l.circuit && Math.hypot(l.x - inside.x, l.y - inside.y) < l.r * .9 && !G.occluded(s, l.x, l.y, inside.x, inside.y)), false, 'the dark ward is not lit through its walls');
  // headlights: a driven sedan lights the road ahead, not behind; a truck reaches further
  s.vehicles = [{ vehicleType: 'sedan', x: 0, y: 1800, angle: -Math.PI / 2, fuel: 100, driver: 0, dead: false }];
  const clearAhead = !G.occluded(s, 0, 1800, 0, 1650);
  if (clearAhead) assert.equal(G.litAt(s, 0, 1650), true, 'ahead is lit');
  assert.ok(G.HEADLIGHTS.fireTruck.r > G.HEADLIGHTS.sedan.r && G.HEADLIGHTS.bulldozer);
  s.vehicles[0].fuel = 0; assert.equal(G.litAt(s, 0, 1650) && !w.lights.some(l => Math.hypot(l.x, l.y - 1650) < l.r), false, 'an empty tank shows no lights');
});

test('every civic public entrance keeps a battery marker independent of street lamps and circuits', () => {
  for (const b of world.buildings.filter(b => W.locationById(world, b.locationId).required)) for (const d of b.exteriorDoors.filter(d => d.kind === 'public')) {
    const c0 = centre(d.rect), m = world.props.find(p => p.entranceMarker && p.buildingId === b.id && Math.hypot(p.x - c0.x, p.y - c0.y) < 5);
    assert.ok(m && m.light && !m.circuit, `${d.id} marker`);
  }
});

// ---- Phase 10: route clearing on fixed geometry ----
test('every bulldozer pad reaches every authored debris pile; clearing only adds shortcuts', () => {
  const pads = world.vehicleSlots.filter(v => v.vehicleType === 'bulldozer'), piles = world.debris;
  const lifted = world.obstacles.filter(o => o.debris === 'optional-clear');
  for (const o of lifted) world.obstacles.splice(world.obstacles.indexOf(o), 1);
  try {
    for (const p of pads) { const drive = reach(world, centre(p.rect), 40, [], 40); for (const d of piles) assert.ok(drive.near(centre(d.rect).x, centre(d.rect).y, 60), `${p.id} reaches ${d.id}`); }
    const open = reach(world, { x: 0, y: 2800 }), targets = [...world.buildings.flatMap(b => b.exteriorDoors), ...world.lots.flatMap(l => l.entrances)];
    for (const t of targets) assert.equal(open.near(centre(t.rect).x, centre(t.rect).y, 40), foot.near(centre(t.rect).x, centre(t.rect).y, 40), `${t.id}: clearing changes only shortcuts, never reachability`);
  } finally { world.obstacles.push(...lifted); }
});

// ---- Phase 11: the disposal yard ----
test('arena cover leaves open lanes: brutes cross from the furnace pit to every gate and corner', () => {
  const yard = world.lots.find(l => l.locationId === 'inner-arena'), cover = world.obstacles.filter(o => o.arenaCover);
  assert.equal(cover.length, 4);
  for (const o of cover) { assert.ok(contains(yard.rect, o)); assert.ok(Math.hypot(o.x + o.w / 2, o.y + o.h / 2) > 150, 'the centre stays open for recovery'); }
  const lifted = world.obstacles.filter(o => o.type === 'gate'); for (const o of lifted) world.obstacles.splice(world.obstacles.indexOf(o), 1);
  try {
    const near = lotReach(world, yard, 17);
    for (const g of world.arenaGates) assert.ok(near(centre(g.rect).x, centre(g.rect).y, 20), `${g.id} reachable`);
    for (const [x, y] of [[0, 0], [-320, -320], [320, -320], [-320, 320], [320, 320], [0, -200], [200, 0]]) assert.ok(near(x, y, 24), `lane to ${x},${y}`);
  } finally { world.obstacles.push(...lifted); }
});

test('geometry counts and resource baseline match the committed fixture', () => {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  assert.deepEqual(JSON.parse(JSON.stringify(measure(c))), fixture, 'run `node tools/city-baseline.mjs --write` to accept an intended change');
});

console.log(results.join('\n'));
if (results.some(r => r.startsWith('FAIL'))) process.exit(1);
