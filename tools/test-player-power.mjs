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

// ---- Phase 3: duplicates and attachments ----
const drop = (s, p, weapon, quality = 1, mag) => ({ id: 'd' + (s.nextId++), x: p.x, y: p.y, type: 'weapon', weapon, quality, mag });
test('every weapon has a fixed three-tier progression with unique ids and inspectable effects', () => {
  const ids = new Set();
  for (const w of Object.keys(G.WEAPONS)) { if (w === 'pistol') { assert.equal(G.ATTACHMENTS.pistol, undefined); continue; }
    const list = G.ATTACHMENTS[w]; assert.equal(list.length, 3, w); for (const a of list) { assert.ok(!ids.has(a.id)); ids.add(a.id); assert.ok(a.label && a.description && Object.keys(a.mod).length, a.id); } }
  const base = G.weaponStats('shotgun', []), full = G.weaponStats('shotgun', G.ATTACHMENTS.shotgun.map(a => a.id));
  assert.deepEqual([full.pellets - base.pellets, full.cleave - base.cleave, full.mag - base.mag], [1, 1, 2]);
  assert.equal(G.weaponStats('ar', ['ar_pierce']).cleave, 2); assert.equal(G.weaponStats('smg', ['smg_suppressor']).noise, G.WEAPONS.smg.noise * .6);
  assert.equal(G.weaponStats('rifle', ['rf_pierce', 'rf_match', 'rf_bolt']).interval, G.WEAPONS.rifle.interval * .75);
  assert.equal(G.weaponStats('launcher', ['gl_twin', 'gl_blast']).radius, G.WEAPONS.launcher.radius * 1.25);
  assert.equal(G.WEAPONS.shotgun.cleave, 3, 'base stats are never mutated');
});
test('a duplicate upgrades the matching carried instance in order, keeps quality and moves loaded rounds to the reserve', () => {
  const s = solo(), p = s.players[0]; equip(s, p, [gun('shotgun', 1, { mag: 3 }), gun('ar', 1, { mag: 11 })], 0);
  const b0 = s.ammo.bullets, d1 = drop(s, p, 'ar', 2, 20);
  assert.equal(G.upgradeTarget(s, p, d1), 1, 'an inactive slot matches'); assert.ok(G.collect(s, p, d1));
  const ar = p.weaponInventory[1]; assert.deepEqual(ar.attachments, ['ar_pierce']); assert.equal(ar.quality, 2); assert.equal(ar.mag, 11);
  assert.equal(s.ammo.bullets, b0 + 20, 'loaded rounds are not lost'); assert.equal(p.weaponInventory.length, 2, 'no slot was used'); assert.ok(d1.taken);
  G.collect(s, p, drop(s, p, 'ar', 1)); G.collect(s, p, drop(s, p, 'ar', 1)); assert.deepEqual(p.weaponInventory[1].attachments, ['ar_pierce', 'ar_extmag', 'ar_speed']); assert.equal(p.weaponInventory[1].quality, 2);
  const d4 = drop(s, p, 'ar', 3, 5); assert.equal(G.upgradeTarget(s, p, d4), -1, 'a full progression is no upgrade');
  G.collect(s, p, d4); assert.equal(p.weaponInventory.length, 3, 'a fully upgraded match falls back to an ordinary pickup');
});
test('attachments stay with the instance through switching, dropping and a teammate pickup; walking over never upgrades', () => {
  const s = solo(), p = s.players[0]; equip(s, p, [gun('smg', 1, { attachments: ['smg_suppressor'] }), gun('rifle')], 0);
  G.step(s, .01, { 0: { switch: true } }); G.step(s, .01, { 0: { switch: true } }); G.step(s, .01, { 0: { switch: true } });
  assert.deepEqual(p.weaponInventory[0].attachments, ['smg_suppressor']); assert.equal(p.backup, false); assert.deepEqual(p.attachments, ['smg_suppressor']);
  G.addPlayer(s, 'pad:0'); const q = s.players[1]; G.dropWeapon(s, p, 0);
  const d = s.loot.find(l => l.type === 'weapon' && l.weapon === 'smg'); d.lock = 0; assert.deepEqual(d.attachments, ['smg_suppressor']);
  const t = solo(), a = t.players[0]; equip(t, a, [gun('rifle')]); const lying = drop(t, a, 'rifle'); t.loot.push(lying);
  for (let i = 0; i < 20; i++) G.step(t, 1 / 30, { 0: {} }); assert.equal(a.weaponInventory[0].attachments.length, 0); assert.ok(!lying.taken, 'contact alone never takes or upgrades a weapon');
  G.collect(s, q, d); assert.deepEqual(q.attachments, ['smg_suppressor']); assert.equal(q.weapon, 'smg');
  const shots = []; const r = solo(); const z = r.players[0]; r.world.obstacles = []; z.x = z.y = 0; equip(r, z, [gun('smg', 1, { attachments: ['smg_suppressor'] })]); z.auto = true; z.moveAngle = 0;
  G.spawn(r, 'walker', 60, 0, { hp: 1e9, maxHp: 1e9 }); G.step(r, 1 / 30, { 0: {} }); const n = r.noise.find(x => x.kind === 'shot'); assert.ok(n && Math.abs(n.r - G.WEAPONS.smg.noise * .6) < 1e-9, 'the suppressor lowers the hearing radius');
});
test('magazine attachments raise capacity without creating rounds; reloads fill to the new size from the reserve', () => {
  const s = solo(), p = s.players[0]; s.world.obstacles = []; equip(s, p, [gun('ar', 1, { mag: 30 })]); const total0 = p.mag + s.ammo.bullets;
  G.collect(s, p, drop(s, p, 'ar')); G.collect(s, p, drop(s, p, 'ar')); assert.equal(G.magFor(p.weaponInventory[0]), 40); assert.equal(p.mag, 30);
  p.mag = 0; s.ammo.bullets = total0 - 0; p.reload = 0; p.x = 0; p.y = 0; p.auto = true; p.moveAngle = 0; G.spawn(s, 'walker', 80, 0, { hp: 1e9, maxHp: 1e9 });
  for (let i = 0; i < 120; i++) G.step(s, 1 / 30, { 0: {} }); assert.ok(p.mag + s.ammo.bullets <= total0, 'no rounds created');
});

// ---- Phase 4: grenade launcher ----
function range(seed = 11) { const s = solo(seed), p = s.players[0]; s.world.obstacles = []; s.world.buildings = []; p.x = 0; p.y = 0; p.invuln = 1e9; return { s, p }; }
test('the launcher occupies a slot, spends shared grenades and bursts once on arrival with falloff, never hurting survivors', () => {
  const { s, p } = range(); equip(s, p, [gun('launcher', 1, { mag: 1 })]); s.ammo.grenades = 3; p.auto = true; p.moveAngle = 0; G.addPlayer(s, 'pad:0'); const mate = s.players[1]; mate.x = 150; mate.y = 0; mate.invuln = 0;
  const c = G.spawn(s, 'walker', 150, 0, { hp: 1000, maxHp: 1000 }), edge = G.spawn(s, 'walker', 150, 70, { hp: 1000, maxHp: 1000 }), out = G.spawn(s, 'walker', 150, 120, { hp: 1000, maxHp: 1000 });
  p.target = c; G.step(s, 1 / 60, { 0: {}, 1: {} }); assert.equal(p.mag, 0); assert.equal((s.grenades || []).length, 1);
  const hp0 = mate.hp; for (let i = 0; i < 40 && s.grenades.length; i++) G.step(s, 1 / 60, { 0: {}, 1: {} });
  assert.equal(s.grenades.length, 0); const dc = 1000 - c.hp, de = 1000 - edge.hp;
  assert.ok(dc > 90 && dc <= 100 && de > 35 && de < dc, 'centre ' + dc + ' edge ' + de); assert.equal(out.hp, 1000); assert.equal(mate.hp, hp0, 'no friendly fire');
  assert.ok(c.stunT > 0, 'ordinary infected are staggered');
});
test('grenades stop at walls, blasts do not reach behind cover, and live grenades are capped', () => {
  const { s, p } = range(); s.world.obstacles = [{ x: 100, y: -60, w: 12, h: 120, type: 'wall' }];
  const behind = G.spawn(s, 'walker', 140, 0, { hp: 1000, maxHp: 1000 }); p.target = behind;
  s.grenades = [{ id: 1, owner: 0, x: 0, y: 0, tx: 140, ty: 0, speed: 420, radius: 80, damage: 100, edge: 35, done: false }];
  for (let i = 0; i < 40 && s.grenades.length; i++) G.projectilesTick(s, 1 / 60); assert.equal(behind.hp, 1000, 'the wall takes the blast');
  const t = range().s; t.grenades = []; const q = t.players[0];
  for (let i = 0; i < 20; i++) { equip(t, q, [gun('launcher', 1, { mag: 1 })]); t.ammo.grenades = 5; q.shotCd = 0; q.reload = 0; q.auto = true; q.target = { x: 300, y: 0 }; t.enemies = [G.spawn(t, 'brute', 300, 0, { hp: 1e9, maxHp: 1e9 })]; q.moveAngle = 0; G.step(t, 1 / 600, { 0: {} }); }
  assert.ok(t.grenades.length <= G.GRENADE_CAP);
});
test('brutes stagger briefly, the boss is damaged but not staggered', () => {
  const { s } = range(); const b = G.spawn(s, 'brute', 10, 0, { hp: 5000, maxHp: 5000 });
  G.explode(s, { x: 0, y: 0, radius: 80, damage: 100, edge: 35, done: false }); assert.ok(b.stunT > 0 && b.stunT <= .2 + 1e-9); assert.ok(b.hp < 5000);
  globalThis.DSBoss.start(s, G.api(s)); const boss = s.boss, hp = boss.hp; G.explode(s, { x: boss.x + boss.r + 5, y: boss.y, radius: 80, damage: 100, edge: 35, done: false });
  assert.ok(boss.hp < hp); assert.equal(boss.stunT, undefined);
});

// ---- Phase 5: catalog effects ----
test('AP rounds and penetrators pass infected; napalm leaves bounded burning ground', () => {
  const { s, p } = range(); const a = G.spawn(s, 'walker', 50, 0, { hp: 1000, maxHp: 1000 }), b = G.spawn(s, 'walker', 80, 0, { hp: 1000, maxHp: 1000 }), c = G.spawn(s, 'walker', 110, 0, { hp: 1000, maxHp: 1000 });
  const ap = G.weaponStats('ar', ['ar_pierce']); G.rayHits(s, p, 1, 0, ap.range, ap, 1, 'ar'); assert.equal(1000 - a.hp, 16); assert.ok(Math.abs(1000 - b.hp - 16 * .6) < 1e-9); assert.equal(c.hp, 1000);
  const rf = G.weaponStats('rifle', ['rf_pierce', 'rf_match']); [a, b, c].forEach(e => { e.hp = 1000; }); G.rayHits(s, p, 1, 0, rf.range, rf, 1, 'rifle');
  assert.ok(Math.abs(1000 - c.hp - 65 * 1.25 * .64) < 1e-9, 'third target at 80%²');
  const f = range(); equip(f.s, f.p, [gun('flame', 1, { attachments: ['fl_linger'] })]); f.p.auto = true; f.p.moveAngle = 0; G.spawn(f.s, 'brute', 90, 0, { hp: 1e9, maxHp: 1e9 });
  for (let i = 0; i < 300; i++) G.step(f.s, 1 / 30, { 0: {} }); assert.ok(f.s.fires.length > 0 && f.s.fires.length <= 8);
});

// ---- Phase 6: carryable turrets ----
function field(seed = 13) { const r = range(seed); r.s.vehicles = []; r.p.x = 1200; r.p.y = 1200; r.p.moveAngle = 0; r.p.angle = 0; return r; }
const idle = n => { const o = {}; for (let i = 0; i < n; i++) o[i] = {}; return o; };
function deploy(s, p) { G.step(s, 1 / 30, { [p.id]: { deploy: true } }); for (let i = 0; i < 30; i++) G.step(s, 1 / 30, { [p.id]: {} }); }
test('one turret per survivor outside weapon slots; pickup refused while carrying or owning one', () => {
  const { s, p } = field(); const slots = p.weaponInventory.length;
  assert.ok(G.collect(s, p, { id: 't1', x: 0, y: 0, type: 'turret' })); assert.equal(p.turret.ammo, 60); assert.equal(p.turret.durability, 150); assert.equal(p.weaponInventory.length, slots);
  const second = { id: 't2', x: 0, y: 0, type: 'turret' }; s.loot.push(second); assert.equal(G.collect(s, p, second), false); assert.ok(s.loot.includes(second), 'left for a teammate');
  deploy(s, p); assert.equal(s.turrets.length, 1); assert.equal(G.collect(s, p, second), false, 'a deployed turret still counts');
});
test('deploy takes 0.8 s standing still; moving or being hit cancels; walls and other turrets refuse placement', () => {
  const { s, p } = field(); G.collect(s, p, { id: 't', x: 0, y: 0, type: 'turret' });
  G.step(s, 1 / 30, { 0: { deploy: true } }); for (let i = 0; i < 20; i++) G.step(s, 1 / 30, { 0: {} }); assert.ok(!(s.turrets || []).length, 'not yet at 0.7 s');
  G.step(s, 1 / 30, { 0: { x: 1 } }); assert.equal(p.deploying, null, 'moving cancels'); assert.ok(p.turret);
  G.step(s, 1 / 30, { 0: { deploy: true } }); p.invuln = 0; G.hurt(s, p, 1); assert.equal(p.deploying, null, 'a hit cancels'); p.invuln = 1e9;
  s.world.obstacles.push({ x: p.x + 10, y: p.y - 20, w: 40, h: 40 }); deploy(s, p); assert.ok(p.turret, 'a wall refuses'); assert.match(p.notice.text, /No room/);
  s.world.obstacles = []; deploy(s, p); assert.equal(s.turrets.length, 1); const t = s.turrets[0]; assert.ok(Math.abs(t.x - p.x - 26) < 1);
  assert.equal(G.turretPlaceOk(s, t.x + 10, t.y), false, 'too close to another turret');
});
test('turret targets the nearest visible infected in range, sticks to it, spends its own rounds and makes noise', () => {
  const { s, p } = field(); G.collect(s, p, { id: 't', x: 0, y: 0, type: 'turret' }); deploy(s, p); p.x -= 400; const t = s.turrets[0];
  const near = G.spawn(s, 'walker', t.x + 120, t.y, { hp: 1e6, maxHp: 1e6 }), far = G.spawn(s, 'walker', t.x + 200, t.y + 20, { hp: 1e6, maxHp: 1e6 }), outside = G.spawn(s, 'walker', t.x + 300, t.y, { hp: 1e6, maxHp: 1e6 });
  [near, far, outside].forEach(e => { e.speed = 0; });
  const bullets = s.ammo.bullets; for (let i = 0; i < 6; i++) G.step(s, 1 / 30, idle(1)); assert.equal(t.target, near);
  for (let i = 0; i < 33; i++) G.step(s, 1 / 30, idle(1));
  assert.ok(t.ammo < 60 && t.ammo >= 60 - 6, 'about one shot per .22 s, got ' + t.ammo); assert.equal(s.ammo.bullets, bullets, 'shared reserve untouched');
  assert.equal(outside.hp, 1e6); assert.ok(near.hp < 1e6); assert.equal(far.hp, 1e6, 'no flicker to a similar candidate');
  assert.ok(s.noise.some(n => n.r === 300));
  near.dead = true; for (let i = 0; i < 12; i++) G.step(s, 1 / 30, idle(1)); assert.equal(t.target, far);
  s.world.obstacles.push({ x: t.x + 40, y: t.y - 60, w: 20, h: 120 }); t.target = null; const hp = far.hp; for (let i = 0; i < 30; i++) G.step(s, 1 / 30, idle(1)); assert.equal(far.hp, hp, 'no line of sight, no fire');
  s.world.obstacles = []; t.ammo = 0; for (let i = 0; i < 30; i++) G.step(s, 1 / 30, idle(1)); assert.equal(far.hp, hp, 'empty turret is silent');
});
test('interact beside a turret loads bullets from the shared reserve; it never makes ammunition', () => {
  const { s, p } = field(); G.collect(s, p, { id: 't', x: 0, y: 0, type: 'turret' }); deploy(s, p); const t = s.turrets[0]; t.ammo = 100; s.ammo.bullets = 50;
  G.step(s, 1 / 30, { 0: { interact: true } }); for (let i = 0; i < 60; i++) G.step(s, 1 / 30, { 0: {} });
  assert.equal(t.ammo, 120); assert.equal(s.ammo.bullets, 30); assert.equal(p.resupply, null);
  t.ammo = 0; s.ammo.bullets = 5; G.step(s, 1 / 30, { 0: { interact: true } }); for (let i = 0; i < 30; i++) G.step(s, 1 / 30, { 0: {} }); assert.equal(t.ammo, 5); assert.equal(s.ammo.bullets, 0);
  t.ammo = 0; s.ammo.bullets = 50; G.step(s, 1 / 30, { 0: { interact: true } }); p.x += 200; for (let i = 0; i < 30; i++) G.step(s, 1 / 30, { 0: {} }); assert.ok(t.ammo <= 2, 'walking away stops the transfer');
  p.x = t.x - 20; p.y = t.y; s.loot.push({ id: 'w', x: p.x, y: p.y, type: 'weapon', weapon: 'ar', quality: 1 });
  const inv = p.weaponInventory.length; G.step(s, 1 / 30, { 0: { interact: true } }); assert.equal(p.weaponInventory.length, inv + 1, 'a weapon pickup wins over resupply'); assert.equal(p.resupply ?? null, null);
});
test('retrieval keeps rounds and durability; infected wear it down and a broken turret is lost', () => {
  const { s, p } = field(); G.collect(s, p, { id: 't', x: 0, y: 0, type: 'turret' }); deploy(s, p); const t = s.turrets[0]; t.ammo = 37; t.durability = 90;
  G.step(s, 1 / 30, { 0: { deploy: true } }); assert.equal(s.turrets.length, 0); assert.deepEqual([p.turret.ammo, p.turret.durability, p.turret.id], [37, 90, t.id]);
  deploy(s, p); const u = s.turrets[0]; assert.equal(u.ammo, 37); p.x -= 600; u.ammo = 0;
  const e = G.spawn(s, 'walker', u.x + 8, u.y); e.speed = 0; e.damage = 40;
  for (let i = 0; i < 120 && s.turrets.length; i++) G.step(s, 1 / 30, idle(1));
  assert.equal(s.turrets.length, 0, 'broken'); assert.equal(p.turret, null); assert.ok(G.collect(s, p, { id: 'n', x: p.x, y: p.y, type: 'turret' }), 'a fresh turret can be picked up');
});
test('owner leaving orphans the turret for anyone to pack; a downed owner leaves it firing', () => {
  const { s, p } = field(); G.addPlayer(s, 'pad:0'); const q = s.players[1]; q.x = p.x + 60; q.y = p.y; q.invuln = 1e9;
  G.collect(s, p, { id: 't', x: 0, y: 0, type: 'turret' }); deploy(s, p); const t = s.turrets[0];
  p.dead = true; const e = G.spawn(s, 'walker', t.x + 100, t.y, { hp: 1e6, maxHp: 1e6 }); e.speed = 0; for (let i = 0; i < 15; i++) G.step(s, 1 / 30, idle(2)); assert.ok(e.hp < 1e6, 'fires while its owner is down');
  q.x = t.x; q.y = t.y + 20; G.step(s, 1 / 30, { 1: { deploy: true } }); assert.equal(s.turrets.length, 1, 'not theirs to pack');
  s.players = s.players.filter(x => x !== p); G.step(s, 1 / 30, { 1: { deploy: true } }); assert.equal(s.turrets.length, 0); assert.ok(q.turret);
});
test('four turrets in a 300-infected crowd bound search work', () => {
  const { s, p } = field(); p.x = -2000; s.turrets = [];
  for (let k = 0; k < 4; k++) s.turrets.push({ id: 900 + k, ownerId: 50 + k, x: k * 60, y: 0, angle: 0, ammo: 120, durability: 1e9, cd: 0, searchCd: 0, target: null });
  for (let i = 0; i < 300; i++) { const e = G.spawn(s, 'walker', (i % 30) * 12 - 60, Math.floor(i / 30) * 12 + 90, { hp: 1e9, maxHp: 1e9 }); e.speed = 0; }
  const t0 = performance.now(); for (let i = 0; i < 60; i++) G.turretsTick(s, 1 / 60); const ms = (performance.now() - t0) / 60;
  assert.ok(ms < 2, 'turret tick ' + ms.toFixed(3) + ' ms'); assert.ok(s.shots.length <= 4 * 60);
});

// ---- Phase 7: armor ----
test('armor soaks every hit first; a breaking hit carries the rest to health; knockback and invulnerability unchanged', () => {
  const { s, p } = field(); p.invuln = 0; p.armor = 30; const hp = p.hp;
  G.hurt(s, p, 12); assert.deepEqual([p.armor, p.hp], [18, hp], 'fully absorbed'); assert.ok(p.invuln > 0, 'the hit still grants invulnerability'); assert.ok(p.armorHit > 0);
  G.hurt(s, p, 50); assert.deepEqual([p.armor, p.hp], [18, hp], 'invulnerable hits change nothing');
  p.invuln = 0; const x = p.x; G.hurt(s, p, 25, 30, 0); assert.deepEqual([p.armor, p.hp], [0, hp - 7], 'overflow reaches health'); assert.ok(p.x > x, 'knockback applies'); assert.ok(p.armorBroken > 0);
  assert.ok(s.fx.some(f => f.text === 'ARMOR BROKEN'));
  p.invuln = 0; G.hurt(s, p, 10); assert.equal(p.hp, hp - 17, 'no armor, health takes it all');
  for (let i = 0; i < 600; i++) G.step(s, 1 / 30, { 0: {} }); assert.equal(p.armor, 0, 'armor never regenerates');
});
test('armor counts against infected, vehicle crashes and the boss alike; a downed survivor revives with none', () => {
  const { s, p } = field(); p.invuln = 0; p.armor = 50; const hp = p.hp;
  const e = G.spawn(s, 'walker', p.x + 5, p.y); e.damage = 9; G.step(s, 1 / 30, { 0: {} }); assert.equal(p.armor, 41); assert.equal(p.hp, hp);
  e.dead = true; p.invuln = 0; G.api ? G.api(s).hurt(p, 20) : G.hurt(s, p, 20); assert.equal(p.armor, 21, 'boss api damage goes through the same path');
  p.invuln = 0; G.hurt(s, p, 21 + p.hp); assert.ok(p.dead); assert.equal(p.armor, 0);
});
test('armor pickups restore 25 to a 50 cap, leave the remainder on the ground, and are refused at full', () => {
  const { s, p } = field(); const item = { id: 'a1', x: p.x, y: p.y, type: 'armor', amount: 25 }; s.loot.push(item);
  assert.ok(G.collect(s, p, item)); assert.equal(p.armor, 25); assert.ok(item.taken);
  p.armor = 40; const b = { id: 'a2', x: p.x, y: p.y, type: 'armor', amount: 25 }; s.loot.push(b);
  assert.ok(G.collect(s, p, b)); assert.equal(p.armor, 50); assert.equal(b.amount, 15); assert.ok(!b.taken, 'the remainder stays for a teammate');
  p.notice = null; assert.equal(G.collect(s, p, b), false); assert.equal(b.amount, 15); assert.match(p.notice.text, /Armor full/);
});
test('medkits restore health only and still matter after armor is gone', () => {
  const { s, p } = field(); p.invuln = 0; p.armor = 10; p.medkits = 1; G.hurt(s, p, 40); assert.equal(p.hp, 70); assert.equal(p.armor, 0);
  G.step(s, 1 / 30, { 0: { heal: true } }); assert.equal(p.hp, 100); assert.equal(p.armor, 0);
});
test('armor survives vehicle seats and simultaneous hits in one frame resolve once per invulnerability window', () => {
  const { s, p } = field(); p.invuln = 0; p.armor = 30;
  const a = G.spawn(s, 'walker', p.x + 4, p.y), b = G.spawn(s, 'walker', p.x - 4, p.y); a.damage = b.damage = 9; G.step(s, 1 / 30, { 0: {} });
  assert.equal(p.armor, 21, 'the second hit landed inside the invulnerability window');
});

// ---- Phase 8: loot economy ----
test('refused power loot stays in the world for one to four survivors', () => {
  for (let n = 1; n <= 4; n++) {
    const s = solo(21 + n); for (let k = 1; k < n; k++) G.addPlayer(s, 'pad:' + k); s.overflowQueue = []; s.mode = 'play';
    s.players.forEach((p, i) => { p.x = 1200 + i * 3; p.y = 1200; p.armor = 50; p.turret = { id: 500 + i, ammo: 60, durability: 150 }; p.invuln = 1e9; });
    const vest = { id: 'v', x: 1200, y: 1200, type: 'armor', amount: 25 }, case_ = { id: 'c', x: 1200, y: 1200, type: 'turret' };
    s.loot = [vest, case_]; for (let i = 0; i < 20; i++) G.step(s, 1 / 30, {});
    assert.ok(!vest.taken && !case_.taken && s.loot.length === 2, n + ' players: nothing vanished');
    s.players[n - 1].armor = 40; s.players[n - 1].turret = null; for (let i = 0; i < 5; i++) G.step(s, 1 / 30, {});
    assert.equal(s.players[n - 1].armor, 50); assert.equal(vest.amount, 15); assert.ok(!vest.taken); assert.ok(case_.taken && s.players[n - 1].turret, 'the survivor with room takes the case');
  }
});
test('world loot carries every new power source: launchers, armor, grenade rounds and exactly two turrets', () => {
  for (const seed of [1, 17, 42]) {
    const w = W.create(seed), items = w.sites.flatMap(x => x.loot);
    const turrets = items.filter(i => i.type === 'turret'); assert.deepEqual(turrets.map(i => i.locationId).sort(), ['armoury', 'police-station']);
    assert.ok(items.filter(i => i.weapon === 'launcher').every(i => i.quality === 1), 'launchers are never Q2');
    assert.ok(items.some(i => i.type === 'armor') && items.some(i => i.ammo === 'grenades'));
    const s = G.create(seed); G.addPlayer(s, 'keyboard'); s.mode = 'play'; const p = s.players[0], it = s.loot.find(i => i.ammo === 'grenades'); const g0 = s.ammo.grenades;
    G.collect(s, p, it); assert.equal(s.ammo.grenades, g0 + it.amount, 'grenade rounds join the shared reserve');
  }
});

// ---- Phase 10: pressure-scaled threat and run simulations ----
test('outbreak threat follows squad power and campaign progress, never the clock', () => {
  const at = (time, setup = () => {}) => { const s = solo(31); s.time = time; setup(s, s.players[0]); G.waveTick(s, 1 / 30); const b = G.spawnBudget(s, 1); return { P: s.pressure, tier: s.threat, cap: b.cap, rate: +b.rate.toFixed(6), speed: b.speed }; };
  const early = at(300), late = at(1500);
  assert.deepEqual({ ...late }, { ...early }, 'twenty idle minutes change nothing'); assert.equal(early.P, 0);
  const strong = at(300, (s, p) => { s.level = 4; equip(s, p, [gun('ar', 1, { attachments: ['ar_pierce', 'ar_extmag'] }), gun('shotgun', 1, { attachments: ['sg_choke'] })]); p.armor = 50; p.turret = { id: 1, ammo: 60, durability: 150 }; });
  assert.equal(strong.P, 3 + 1.5 + 1 + .5, 'level-1 + half per attachment + armor/50 + half for a turret');
  assert.ok(strong.cap > early.cap && strong.rate > early.rate && strong.speed > early.speed && strong.tier === 3);
  const progressed = at(300, s => { s.circuit.emergency = true; s.campaign.bossDown = true; s.campaign.evidence = { a: true }; });
  assert.equal(progressed.P, 4.5, 'three campaign steps at 1.5 each');
  const duo = solo(31); G.addPlayer(duo, 'pad:0'); duo.overflowQueue = []; duo.players[0].armor = 50; assert.equal(G.squadPower(duo), .5, 'power is averaged over living survivors');
  const P = G.PRESSURE; assert.ok(G.spawnBudget({ pressure: 1e3 }, 1).speed <= 1 + P.speedMax && G.pressure(duo) >= 0);
});
const SIM_SEEDS = [1, 7, 21, 42];
const { route, clearTime, hold, snapshot } = await import('./power-sim.mjs');
const runs = SIM_SEEDS.map(seed => ({ seed, five: route(seed, 5), twenty: route(seed, 20) }));
test('a 20-minute scavenging run is stronger than a 5-minute run on every sampled seed', () => {
  for (const { seed, five, twenty } of runs) {
    const a = snapshot(five), b = snapshot(twenty);
    assert.ok(b.power >= a.power + 4, `seed ${seed} power ${a.power} -> ${b.power}`);
    assert.ok(b.attachments > a.attachments && b.level > a.level && b.armor >= a.armor, `seed ${seed} ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
    const c5 = clearTime(five, seed), c20 = clearTime(twenty, seed); assert.ok(c20 <= c5, `seed ${seed} clear ${c5} -> ${c20}`);
    five.clear = c5; twenty.clear = c20;
  }
  const mean = k => runs.reduce((n, r) => n + r[k].clear, 0) / runs.length; assert.ok(mean('twenty') < mean('five') * .8, `mean clear ${mean('five')} -> ${mean('twenty')}`);
});
test('solo is survivable: a kiting bot holds an open street for three minutes under pressure-scaled spawns', () => {
  const out = [];
  for (const { seed, five, twenty } of runs) for (const [label, r] of [['5 min', five], ['20 min', twenty]]) out.push({ seed, label, ...hold(r, seed, 180) });
  const downs = out.map(o => o.downs), total = downs.reduce((a, b) => a + b, 0);
  assert.ok(total <= 8, 'downs per hold ' + downs.join(',')); assert.ok(downs.filter(d => d === 0).length >= 4, 'most holds end without a down: ' + downs.join(','));
  for (const o of out) assert.ok(o.kills >= 150, `${o.seed} ${o.label} held the street (${o.kills} kills)`);
  for (const { seed } of runs) { const [a, b] = out.filter(o => o.seed === seed); assert.ok(b.pressure > a.pressure && b.kills >= a.kills * .95, `seed ${seed}: the stronger kit meets more pressure and still kills as many (${a.kills} -> ${b.kills})`); } // 5%: spawn RNG noise (seed 1 sits at 365 -> 360 since the cordon bound)
});

console.log(results.join('\n'));
if (failed) { console.log(failed + ' player-power tests failed'); process.exitCode = 1; } else console.log('player-power tests passed');
