import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.dirname(here);
const context = { console, Math, Uint8Array, Int16Array, setTimeout, clearTimeout };
context.window = context;
vm.createContext(context);
for (const file of ['city.js', 'world.js', 'game.js', 'boss.js']) {
  vm.runInContext(fs.readFileSync(path.join(project, file), 'utf8'), context, { filename: file });
}

const { DSWorld, DSGame, DSBoss } = context;
assert.ok(DSWorld && DSGame && DSBoss, 'world, game and boss modules load in one browser-like VM');

function makeState(players = 4, startTime = 0, threat = 1) {
  const s = DSGame.create(12345);
  for (let i = 0; i < players; i++) DSGame.addPlayer(s, `test-${i}`);
  s.mode = 'play';
  s.time = startTime; s.threat = threat;
  const raw = DSGame.api(s);
  const announcements = [];
  const api = {
    ...raw,
    // Keep cast tests alive long enough to inspect choreography. The carrier
    // and knockback cases below use focused API behavior checks separately.
    hurt: () => {},
    announce: text => { announcements.push(text); raw.announce(text); }
  };
  DSBoss.start(s, api);
  // This mirrors the parent objective: the old wave actors leave as the party
  // enters the plaza. The boss spawns its own adds after that point.
  s.enemies = [];
  return { s, api, announcements };
}

function step(s, api, seconds, dt = 0.05) {
  for (let t = 0; t < seconds; t += dt) {
    s.time += dt;
    DSBoss.update(s, dt, api);
  }
}

// Start state and difficulty are locked at engagement.
{
  const { s, api } = makeState(4);
  const b = s.boss;
  assert.equal(b.name, 'PATIENT FURNACE');
  assert.equal(b.phase, 1);
  assert.equal(b.difficulty.players, 4);
  assert.equal(b.difficulty.tier, 1);
  assert.equal(b.difficulty.partyScale, 3.7);
  // HP is priced on squad power, not the clock: a level 1 party meets the base furnace.
  assert.equal(b.difficulty.level, 1);
  assert.equal(b.difficulty.hpScale, 1);
  assert.ok(s.players.every(p => Math.hypot(p.x, p.y) < 110), 'party starts in the safe center');
  const hp = b.maxHp, locked = JSON.stringify(b.difficulty);
  s.time = 5000;
  DSBoss.hit(s, 100, api);
  assert.equal(b.maxHp, hp);
  assert.equal(JSON.stringify(b.difficulty), locked, 'late elapsed time cannot retune boss difficulty');
}

// Two prices, both locked at entry. The outbreak tier (squad power + campaign progress, PLAYER_POWER Phase 10)
// buys the furnace a harder swing but never more health; the clock alone buys nothing.
{
  const early = makeState(2, 0).s;
  const idleLate = makeState(2, 360).s;
  assert.equal(idleLate.boss.difficulty.tier, 1, 'waiting alone does not raise the tier');
  assert.equal(JSON.stringify(idleLate.boss.difficulty), JSON.stringify(early.boss.difficulty), 'an idle late entry meets the same furnace');
  const latePack = makeState(2, 360, 5);
  assert.equal(latePack.s.boss.difficulty.tier, 5);
  assert.equal(latePack.s.boss.maxHp, early.boss.maxHp, 'a higher tier at the same level meets the same health bar');
  assert.ok(latePack.s.boss.difficulty.damageScale > early.boss.difficulty.damageScale, 'a pushed outbreak captures higher mechanic damage pressure');
  const lateLocked = JSON.stringify(latePack.s.boss.difficulty);
  latePack.s.time = 9999;
  DSBoss.update(latePack.s, 0.05, latePack.api);
  assert.equal(JSON.stringify(latePack.s.boss.difficulty), lateLocked, 'outbreak tier remains locked after engagement');
}

// Levelling pays: the furnace grows at half the exponent of the damage upgrade,
// so a level 19 squad meets a bigger boss but kills it in fewer damage-seconds.
{
  const base = makeState(1, 0).s;
  const strongPack = DSGame.create(12345);
  DSGame.addPlayer(strongPack, 'test-0');
  strongPack.mode = 'play'; strongPack.level = 19;
  DSBoss.start(strongPack, DSGame.api(strongPack));
  const strong = strongPack.boss;
  assert.ok(strong.maxHp > base.boss.maxHp, 'a stronger squad meets a bigger furnace');
  // 18 levels is ~6 damage picks at 1.13 each; the boss took the same 18 at half
  // the exponent, so the health bar must grow strictly slower than the damage.
  const hpRatio = strong.maxHp / base.boss.maxHp, dmgRatio = Math.pow(1.13, 18 / 3);
  assert.ok(hpRatio < dmgRatio, `boss hp x${hpRatio.toFixed(2)} must trail player damage x${dmgRatio.toFixed(2)}`);
}

// Phase 1 has the readable wind-up and both sides of the Slagmaw ring lesson.
{
  const { s, api } = makeState(4);
  step(s, api, 2.7);
  const seen = new Set();
  for (let i = 0; i < 180; i++) { s.time += 0.05; DSBoss.update(s, 0.05, api); if (s.boss.ai.cast) seen.add(s.boss.ai.cast.key); }
  assert.ok(seen.has('slam'), 'phase 1 schedules a hammer slam');
  assert.ok(seen.has('outerRing'), 'phase 1 schedules an outward ring with an inner safe disc');
}

// Push the actual boss through both health gates and verify phase 2/3 casts.
{
  const { s, api } = makeState(4);
  const b = s.boss;
  DSBoss.hit(s, b.maxHp * 0.35, api);
  DSBoss.update(s, 0.05, api);
  assert.equal(b.phase, 2);
  step(s, api, 2.4);
  assert.equal(b.ai.mode, 'active');
  const phase2 = new Set();
  for (let i = 0; i < 650; i++) { s.time += 0.05; DSBoss.update(s, 0.05, api); if (b.ai.cast) phase2.add(b.ai.cast.key); }
  assert.ok(phase2.has('vent') && phase2.has('marks') && phase2.has('innerRing'), 'rooted phase 2 cycles vent, marks and inward ring');

  // Carriers may have fed during the phase 2 rehearsal, so cross the second
  // gate relative to the current locked pool.
  DSBoss.hit(s, b.hp * 0.8, api);
  DSBoss.update(s, 0.05, api);
  assert.equal(b.phase, 3);
  step(s, api, 2.4);
  b.ai.timer = 0;
  b.ai.next = 'burn';
  DSBoss.update(s, 0.05, api);
  assert.equal(b.ai.cast.key, 'burn', 'phase 3 contains a burning channel');
}

// Carriers are interruptible: hp<=0 is enough to prevent a feed before the
// parent cleanup pass marks the enemy dead.
{
  const { s, api } = makeState(4);
  const b = s.boss;
  b.phase = 2; b.ai.mode = 'active'; b.ai.cast = null; b.ai.timer = 99; b.ai.carrierTimer = 0;
  s.time = 5000; // parent enemy spawns normally scale with elapsed time
  DSBoss.update(s, 0.05, api);
  const carrier = s.enemies.find(e => e.bossCarrier);
  assert.ok(carrier, 'phase 2 spawns an owned carrier');
  assert.equal(carrier.maxHp, 75 * b.difficulty.hpScale, 'carrier hp stays at the locked encounter value late in a run');
  const before = b.hp;
  carrier.hp = 0; carrier.dead = false; carrier.x = b.x; carrier.y = b.y;
  DSBoss.update(s, 0.05, api);
  assert.equal(b.hp, before, 'a carrier at zero hp cannot heal even before cleanup');
  carrier.hp = carrier.maxHp = 75; carrier.dead = false; carrier.x = b.x; carrier.y = b.y;
  b.hp = before - 200;
  DSBoss.update(s, 0.05, api);
  assert.ok(b.hp > before - 200, 'a living carrier reaching the furnace heals it');
  assert.equal(carrier.dead, true);
}

// The parent hurt path receives a knockback vector. The boss clamps that
// vector to the same radius used by game.js player movement.
{
  const { s } = makeState(1);
  const p = s.players[0];
  p.x = 338; p.y = 0; p.invuln = 0;
  let impulse;
  const api = { hurt: (q, amount, kx, ky) => { impulse = [kx, ky]; } };
  // A direct hit on a deliberately broad slam-shaped circle exercises the
  // public damage route while asking for a shove beyond the arena edge.
  s.boss.ai.mode = 'active';
  s.boss.ai.cast = { key: 'slam', t: 0, dur: 1, r: 350 };
  DSBoss.update(s, 0.05, { ...api, move: () => {} });
  assert.ok(impulse && Math.abs(p.x + impulse[0]) <= 350.001 && Math.abs(p.y + impulse[1]) <= 350.001, 'slam knockback stays within the square yard');
}

// Killing through the public API ends the fight, not the run (the escape at Checkpoint Nine does that).
{
  const { s, api } = makeState(2);
  DSBoss.hit(s, s.boss.maxHp + 1, api);
  assert.equal(s.mode, 'play');
  assert.equal(s.boss.active, false);
}

// ---- CITY.md Phase 11: the fenced disposal yard ----
function liveGame(players = 1) {
  const s = DSGame.create(777);
  for (let i = 0; i < players; i++) DSGame.addPlayer(s, `arena-${i}`);
  s.mode = 'play'; s.spawnAcc = -1e9; s.enemies = [];
  for (const p of s.players) p.invuln = 1e9;
  return s;
}
const gateOpen = (s, id) => s.gates[id].open;
const blockedAt = (s, x, y, r) => DSWorld.blocked(s.world, x, y, r);

// Before commitment: gates are closed; walking up to one from outside opens that gate only, and survivors pass
// through its bollard while a sedan cannot.
{
  const s = liveGame(1), p = s.players[0], south = s.world.arenaGates.find(g => g.side === 's');
  assert.ok(Object.values(s.gates).every(g => !g.open), 'all gates start closed');
  const gc = { x: south.rect.x + south.rect.w / 2, y: south.rect.y + south.rect.h / 2 };
  assert.ok(blockedAt(s, gc.x, gc.y, 10), 'a closed gate is solid');
  Object.assign(p, { x: gc.x - 30, y: gc.y + 90 });
  DSGame.step(s, 1 / 60, {});
  assert.equal(gateOpen(s, 'arena-gate-s'), true, 'the approached gate opens');
  assert.ok(['n', 'e', 'w'].every(k => !gateOpen(s, 'arena-gate-' + k)), 'the others stay shut');
  for (let i = 0; i < 120; i++) DSGame.step(s, 1 / 60, { 0: { y: -1 } });
  assert.ok(p.y < gc.y - 20, 'a survivor walks in past the bollard');
  const v = s.vehicles.find(q => q.vehicleType === 'sedan'), d = DSGame.VEHICLES.sedan;
  assert.ok(DSGame.carBlocked(s, v, gc.x, gc.y + 10, -Math.PI / 2) || DSGame.carBlocked(s, v, gc.x - 25, gc.y, -Math.PI / 2), 'no car fits through the gate');
  assert.ok(DSGame.carBlocked(s, v, gc.x + 25, gc.y, -Math.PI / 2), 'either side of the bollard');
}

// Commitment seals every gate; nobody (survivor, furnace, carrier, knockback) leaves the square during the fight;
// the camera frames the party, the furnace and its hazards at every aspect ratio.
{
  const s = liveGame(4), api = DSGame.api(s);
  s.players.forEach((p, i) => Object.assign(p, { x: (i - 1.5) * 40, y: 60 }));
  DSBoss.start(s, api);
  assert.ok(Object.values(s.gates).every(g => !g.open), 'all four gates sealed');
  for (const g of s.world.arenaGates) { const c = { x: g.rect.x + g.rect.w / 2, y: g.rect.y + g.rect.h / 2 }; assert.ok(blockedAt(s, c.x, c.y, 4), `${g.id} solid during the fight`); }
  s.boss.ai.mode = 'intro'; s.boss.ai.intro = 1e9; // hold the furnace still so movement is the only variable
  const dirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: .7, y: .7 }];
  for (const dir of dirs) {
    s.players.forEach((p, i) => Object.assign(p, { x: dir.x * 300 + i * 6, y: dir.y * 300 + i * 6 }));
    for (let t = 0; t < 180; t++) DSGame.step(s, 1 / 60, Object.fromEntries(s.players.map(p => [p.id, { ...dir, run: true }])));
    for (const p of s.players) assert.ok(Math.abs(p.x) <= DSGame.ARENA.play && Math.abs(p.y) <= DSGame.ARENA.play, `stays inside moving ${JSON.stringify(dir)}: ${p.x.toFixed(0)},${p.y.toFixed(0)}`);
  }
  // knockback toward a corner is clamped to the same square
  const p = s.players[0]; Object.assign(p, { x: 340, y: 340 }); let impulse;
  DSBoss.update(s, 0.05, { ...api, hurt: (q, a, kx, ky) => { if (q === p) impulse = [kx, ky]; }, move: () => {} });
  s.boss.ai.mode = 'active'; s.boss.ai.cast = { key: 'slam', t: 0, dur: 1, r: 600 };
  DSBoss.update(s, 0.05, { ...api, hurt: (q, a, kx, ky) => { if (q === p) impulse = [kx, ky]; }, move: () => {} });
  if (impulse) assert.ok(Math.abs(p.x + impulse[0]) <= DSGame.ARENA.play && Math.abs(p.y + impulse[1]) <= DSGame.ARENA.play, 'knockback stays in the yard');
  // the furnace and its carriers never leave
  Object.assign(s.boss, { x: 900, y: -900 }); s.boss.ai.cast = null; s.boss.ai.mode = 'active'; s.boss.ai.timer = 0;
  DSBoss.update(s, 0.05, { ...api, move: (e, dx, dy) => { e.x += dx; e.y += dy; } });
  assert.ok(Math.abs(s.boss.x) <= 370 && Math.abs(s.boss.y) <= 370, 'the furnace is clamped to the yard');
  for (const e of s.enemies.filter(e => e.bossOwned)) assert.ok(Math.abs(e.x) <= 370 && Math.abs(e.y) <= 370, 'carriers spawn inside');
  // camera
  Object.assign(s.boss, { x: 0, y: 0 });
  s.players.forEach((p, i) => Object.assign(p, { x: i % 2 ? 330 : -330, y: i < 2 ? -330 : 330, dead: false }));
  for (const aspect of [16 / 9, 4 / 3, 21 / 9, 1]) {
    for (let t = 0; t < 240; t++) DSGame.camera(s, 1 / 60, aspect);
    const c = s.camera;
    for (const q of [...s.players, s.boss]) assert.ok(Math.abs(q.x - c.x) <= c.w / 2 && Math.abs(q.y - c.y) <= c.h / 2, `aspect ${aspect.toFixed(2)} frames ${q.name || q.id}`);
    assert.ok(Math.abs(c.x) <= 370 && Math.abs(c.y) <= 370, 'camera stays centred on the yard');
  }
}

// Death, revival and the end of the fight: a downed survivor revives inside; either death path continues the run
// exactly once, reopens every gate, lowers convergence, unlocks the payload and removes boss-only enemies.
for (const path of ['hit', 'update']) {
  const s = liveGame(2), api = DSGame.api(s);
  DSBoss.start(s, api);
  const [a, b] = s.players; b.dead = true; b.hp = 0; Object.assign(b, { x: 300, y: 300 }); Object.assign(a, { x: 310, y: 300 });
  s.boss.ai.mode = 'intro'; s.boss.ai.intro = 1e9;
  for (let t = 0; t < 60 * 3.2; t++) DSGame.step(s, 1 / 60, {});
  assert.equal(b.dead, false, 'revived inside the yard'); assert.ok(Math.abs(b.x) <= 370 && Math.abs(b.y) <= 370);
  DSBoss.start === DSBoss.start;
  s.enemies.push({ id: 999, type: 'carrier', x: 0, y: 0, hp: 10, dead: false, bossOwned: true, r: 12 });
  if (path === 'hit') DSBoss.hit(s, s.boss.maxHp + 1, api); else { s.boss.hp = 0; DSBoss.update(s, 0.05, api); }
  assert.equal(s.mode, 'play', `${path}: the run continues`);
  assert.equal(s.boss.active, false); assert.equal(s.campaign.bossDown, true); assert.equal(s.campaign.payloadUnlocked, true);
  assert.ok(s.convergence < 1, 'local convergence drops');
  assert.ok(Object.values(s.gates).every(g => g.open), 'every gate reopens');
  const conv = s.convergence; DSBoss.hit(s, 10, api); DSGame.bossDefeated(s); assert.equal(s.convergence, conv, 'the transition runs once');
  DSGame.step(s, 1 / 60, {}); assert.ok(!s.enemies.some(e => e.bossOwned), 'boss-only enemies are gone');
  // walk out through the north gate
  const n = s.world.arenaGates.find(g => g.side === 'n'), nx = n.rect.x + n.rect.w / 2 - 30;
  Object.assign(a, { x: nx, y: -300 }); Object.assign(b, { x: nx + 60, y: -300 }); // together, so the squad tether does not hold them
  for (let t = 0; t < 60 * 3; t++) DSGame.step(s, 1 / 60, { [a.id]: { y: -1 }, [b.id]: { y: -1 } });
  assert.ok(a.y < -420, `${path}: out through the reopened gate`);
}

// Losing inside the yard is still a loss; the gates do not matter to it.
{
  const s = liveGame(1), api = DSGame.api(s); DSBoss.start(s, api);
  s.players[0].dead = true; DSGame.step(s, 1 / 60, {}); assert.equal(s.mode, 'lost');
}


console.log('boss tests passed: phases, casts, carrier interruption/healing, square-yard knockback, gates, bounds, camera, revive and the post-boss transition');
