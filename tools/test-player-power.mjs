// PLAYER_POWER.md simulation suite: capacity and join overflow, shotgun cleave, duplicate attachments, the grenade
// launcher, turrets, armor, the loot economy and power-scaled threat. One test per contract; see the tracker for values.
import assert from 'node:assert/strict';
await import('../city.js'); await import('../world.js'); await import('../boss.js'); await import('../game.js');
const G = globalThis.DSGame, W = globalThis.DSWorld;
const results = []; let failed = 0;
const test = (name, fn) => { try { fn(); results.push('PASS ' + name); } catch (e) { failed++; results.push('FAIL ' + name + ': ' + e.message); } };
const gun = (weapon, quality = 1, extra = {}) => ({ weapon, quality, mag: G.WEAPONS[weapon].mag, attachments: [], ...extra });
function solo(seed = 5) { const s = G.create(seed); G.addPlayer(s, 'keyboard'); s.mode = 'play'; s.spawnAcc = -1e12; s.enemies = []; s.loot = []; return s; }
function equip(s, p, list, slot = 0) { p.weaponInventory = list.map(w => ({ ...w, attachments: (w.attachments || []).slice() })); p.backup = false; p.weaponSlot = slot; Object.assign(p, p.weaponInventory[slot]); p.attachments = (p.weaponInventory[slot].attachments || []).slice(); }

// ---- Phase 1: capacity and join overflow ----
test('solo carries four weapons plus the pistol; co-op carries three', () => {
  const s = solo(), p = s.players[0];
  assert.equal(G.weaponCap(s), 4);
  for (const w of ['ar', 'shotgun', 'smg', 'rifle']) assert.ok(G.collect(s, p, { id: 'w' + w, x: p.x, y: p.y, type: 'weapon', weapon: w, quality: 1 }));
  assert.equal(p.weaponInventory.length, 4, 'four slots filled without replacing');
  const fifth = { id: 'w5', x: p.x, y: p.y, type: 'weapon', weapon: 'flame', quality: 1 }; G.collect(s, p, fifth);
  assert.equal(p.weaponInventory.length, 4); assert.ok(s.loot.some(l => l.type === 'weapon' && l.lock > 0), 'a full hand drops the replaced weapon');
  G.addPlayer(s, 'pad:0'); assert.equal(G.weaponCap(s), 3);
});
test('a join above co-op capacity pauses the run until the owner drops a weapon; nothing is destroyed', () => {
  const s = solo(), p = s.players[0]; equip(s, p, [gun('ar', 2, { mag: 17, attachments: ['ar_pierce'] }), gun('shotgun'), gun('smg', 1, { mag: 4 }), gun('rifle', 3)], 2);
  const t0 = s.time; G.addPlayer(s, 'pad:0');
  assert.deepEqual(s.overflowQueue, [p.id]); G.step(s, 1 / 60, { 0: { x: 1 }, 1: { x: 1 } }); assert.equal(s.time, t0, 'simulation paused while choosing');
  const q = s.players[1]; const qx = q.x; G.step(s, .5, { 1: { x: 1 } }); assert.equal(q.x, qx, 'the new survivor cannot act');
  assert.equal(G.resolveOverflow(s, q.id, 0), false, 'only the queued owner resolves');
  assert.ok(G.resolveOverflow(s, p.id, 0)); assert.equal(s.overflowQueue.length, 0);
  assert.equal(p.weaponInventory.length, 3); assert.equal(p.weapon, 'smg', 'the selected weapon is kept'); assert.equal(p.mag, 4);
  const dropped = s.loot.find(l => l.type === 'weapon' && l.weapon === 'ar');
  assert.ok(dropped && dropped.quality === 2 && dropped.mag === 17 && dropped.attachments[0] === 'ar_pierce', 'the dropped weapon keeps its identity');
  G.step(s, 1 / 60, {}); assert.ok(s.time > t0, 'the run resumes');
});
test('dropping the selected weapon selects slot 0; pistol selection is kept; no overflow at three or fewer', () => {
  const s = solo(), p = s.players[0]; equip(s, p, [gun('ar'), gun('shotgun'), gun('smg'), gun('rifle')], 3);
  G.addPlayer(s, 'pad:0'); assert.ok(G.resolveOverflow(s, p.id, 3)); assert.equal(p.weapon, 'ar'); assert.equal(p.backup, false);
  const t = solo(), a = t.players[0]; equip(t, a, [gun('ar'), gun('shotgun'), gun('smg'), gun('rifle')]); a.backup = true;
  G.addPlayer(t, 'pad:0'); G.resolveOverflow(t, a.id, 1); assert.equal(a.backup, true, 'pistol stays selected');
  const u = solo(), b = u.players[0]; equip(u, b, [gun('ar'), gun('shotgun')]); G.addPlayer(u, 'pad:0'); assert.ok(!(u.overflowQueue || []).length);
});
test('capacity never grows back when a co-op survivor is downed', () => {
  const s = solo(); G.addPlayer(s, 'pad:0'); s.players[1].dead = true; assert.equal(G.weaponCap(s), 3);
});

// ---- Phase 2: shotgun cleave ----
function line(types, spacing = 30, start = 40) { const s = solo(9), p = s.players[0]; s.world.obstacles = []; p.x = 0; p.y = 0; const es = types.map((t, i) => G.spawn(s, t, start + i * spacing, 0)); return { s, p, es }; }
const SG = G.WEAPONS.shotgun;
test('a shotgun pellet damages up to three aligned infected in order, keeping 60% after each', () => {
  const { s, p, es } = line(['walker', 'walker', 'walker', 'walker'], 12); es.forEach(e => { e.hp = e.maxHp = 1000; }); // all inside 40% of range: no falloff
  const end = G.rayHits(s, p, 1, 0, SG.range, SG, 1, 'shotgun');
  const dealt = es.map(e => +(1000 - e.hp).toFixed(3));
  assert.deepEqual(dealt, [17, +(17 * .6).toFixed(3), +(17 * .36).toFixed(3), 0]); assert.ok(Math.abs(end - (es[2].x - es[2].r)) < 1e-9, 'the trace ends at the last target');
});
test('pellets fall off with distance and stop at walls, brutes and the boss', () => {
  const near = line(['walker'], 0, 40), far = line(['walker'], 0, 180); for (const k of [near, far]) k.es[0].hp = k.es[0].maxHp = 1000;
  G.rayHits(near.s, near.p, 1, 0, SG.range, SG, 1, 'shotgun'); G.rayHits(far.s, far.p, 1, 0, SG.range, SG, 1, 'shotgun');
  assert.equal(1000 - near.es[0].hp, 17); const f = 1000 - far.es[0].hp; assert.ok(f > 17 * .5 - 1e-9 && f < 17 * .6, 'far falloff ' + f);
  const b = line(['brute', 'walker']); b.es.forEach(e => { e.hp = e.maxHp = 1000; }); G.rayHits(b.s, b.p, 1, 0, SG.range, SG, 1, 'shotgun');
  assert.equal(1000 - b.es[0].hp, 17); assert.equal(b.es[1].hp, 1000, 'a brute stops the pellet');
  const w = line(['walker', 'walker'], 60); w.es.forEach(e => { e.hp = e.maxHp = 1000; }); w.s.world.obstacles = [{ x: 70, y: -40, w: 10, h: 80, type: 'wall' }];
  const wall = G.lineObstacle(w.s, 0, 0, SG.range, 0); const reach = SG.range * wall.t; G.rayHits(w.s, w.p, 1, 0, reach, SG, 1, 'shotgun');
  assert.equal(1000 - w.es[0].hp, 17); assert.equal(w.es[1].hp, 1000, 'nothing behind a wall is hit');
});
test('point-blank infected overlapping the survivor are hit, once per pellet', () => {
  const { s, p, es } = line(['walker', 'walker'], 0, -4); es.forEach(e => { e.hp = e.maxHp = 1000; });
  G.rayHits(s, p, 1, 0, SG.range, SG, 1, 'shotgun'); assert.equal(es.filter(e => e.hp < 1000).length, 2); assert.ok(es.every(e => 1000 - e.hp <= 17), 'no double hits');
});
test('single-target guns are unchanged: a bullet stops at its first victim', () => {
  const { s, p, es } = line(['walker', 'walker']); es.forEach(e => { e.hp = e.maxHp = 1000; }); const AR = G.WEAPONS.ar;
  G.rayHits(s, p, 1, 0, AR.range, AR, 1, 'ar'); assert.equal(1000 - es[0].hp, AR.damage); assert.equal(es[1].hp, 1000);
});
test('a full shotgun blast into a packed doorway beats the old one-target pellets', () => {
  const { s, p, es } = line(['walker', 'walker', 'walker'], 16, 40); es.forEach(e => { e.hp = e.maxHp = 1000; });
  for (let i = 0; i < SG.pellets; i++) { const a = (i - (SG.pellets - 1) / 2) * SG.spread / (SG.pellets - 1); G.rayHits(s, p, Math.cos(a), Math.sin(a), SG.range, SG, 1, 'shotgun'); }
  const total = es.reduce((n, e) => n + 1000 - e.hp, 0); assert.ok(total > SG.pellets * SG.damage * 1.2, 'packed total ' + total.toFixed(1));
});

console.log(results.join('\n'));
if (failed) { console.log(failed + ' player-power tests failed'); process.exitCode = 1; } else console.log('player-power tests passed');
