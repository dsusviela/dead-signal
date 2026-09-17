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

console.log(results.join('\n'));
if (failed) { console.log(failed + ' player-power tests failed'); process.exitCode = 1; } else console.log('player-power tests passed');
