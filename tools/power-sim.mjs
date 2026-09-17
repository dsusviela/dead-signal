// PLAYER_POWER Phase 10 run simulations, shared by tools/test-player-power.mjs and ad-hoc balance checks.
//   node tools/power-sim.mjs [seeds...]   print power at 5 and 20 minutes, best crowd clear, and a 3-minute street hold
//
// route(seed, minutes): a solo scavenger walks (straight-line distance x1.4 at walking speed, 1.5 s per pickup) to the
//   nearest pickup, takes it the way a player would (weapons only into a free slot or as an upgrade), eats kill XP at
//   a steady 6 walkers a minute, and picks the first upgrade offered. No combat damage: it measures what a route yields.
// clearTime(route, seed): the best time any carried weapon needs to clear 24 standing walkers in a front arc.
// hold(route, seed, seconds): the same kit on an open street under the real pressure-scaled spawner; a kiting bot with
//   autofire, medkits and its turret. Downs are counted and revived in place so the whole window is measured.
await import('../city.js'); await import('../world.js'); await import('../boss.js'); await import('../game.js');
const G = globalThis.DSGame;
export const MINUTE = 60;

export function route(seed, minutes, { killsPerMin = 6 } = {}) {
  const s = G.create(seed); G.addPlayer(s, 'keyboard'); s.mode = 'play'; const p = s.players[0];
  const skip = new Set(['evidence', 'payload', 'override']), passed = new Set(); let t = 0, kills = 0;
  while (t < minutes * MINUTE) {
    let best = null, bd = Infinity;
    for (const l of s.loot) { if (l.taken || skip.has(l.type) || passed.has(l) || (l.type === 'weapon' && !l.siteId)) continue; const d = Math.hypot(l.x - p.x, l.y - p.y); if (d < bd) { bd = d; best = l; } }
    if (!best) break;
    t += bd * 1.4 / p.speed + 1.5;
    for (const want = Math.floor(t / MINUTE * killsPerMin); kills < want; kills++) G.hitEnemy(s, G.spawn(s, 'walker', p.x + 900, p.y), 1e9, null);
    p.x = best.x; p.y = best.y;
    if (best.type === 'weapon') { if (G.upgradeTarget(s, p, best) >= 0 || p.weaponInventory.length < G.weaponCap(s)) G.collect(s, p, best); else passed.add(best); }
    else if (!G.collect(s, p, best)) passed.add(best);
    for (const l of s.loot) if (l.type === 'xp' && !l.siteId && !l.taken) G.collect(s, p, l);
    while (p.upgrades > 0) G.upgrade(s, p, 0);
  }
  return { s, p, minutes };
}

function kit(r, seed) {
  const s = G.create(seed); G.addPlayer(s, 'keyboard'); s.mode = 'play'; const p = s.players[0], q = r.p;
  s.world.obstacles = []; s.world.buildings = []; s.vehicles = []; s.loot = []; s.enemies = []; p.x = 1200; p.y = 1200;
  for (const k of ['damage', 'fireRate', 'speed', 'maxHp', 'maxStamina', 'armor', 'medkits']) if (q[k] != null) p[k] = q[k];
  p.hp = p.maxHp; p.weaponInventory = q.weaponInventory.map(w => ({ ...w, attachments: (w.attachments || []).slice() })); p.backup = false; p.weaponSlot = 0; Object.assign(p, p.weaponInventory[0]); p.attachments = p.weaponInventory[0].attachments.slice();
  if (q.turret) p.turret = { ...q.turret };
  s.level = r.s.level; s.nextXp = r.s.nextXp; s.xp = r.s.xp; s.ammo = { ...r.s.ammo }; s.campaign = r.s.campaign; s.circuit = r.s.circuit;
  return { s, p };
}
const value = (s, w) => { const d = G.weaponStats(w.weapon, w.attachments); return !d.ammo || (s.ammo[d.ammo] || 0) + (w.mag || 0) > 0 ? d.damage * (d.pellets || 1) * (d.cleave || 1) / d.interval * Math.min(1, d.range / 240) : 0; };
function bestSlot(s, p) { let bi = -1, bv = 0; p.weaponInventory.forEach((w, i) => { const v = value(s, w); if (v > bv) { bv = v; bi = i; } }); if (bi >= 0 && (p.backup || bi !== p.weaponSlot)) G.selectWeapon(s, p, bi); }

export function clearTime(r, seed, n = 24) {
  let best = Infinity;
  for (let slot = 0; slot < r.p.weaponInventory.length; slot++) {
    const { s, p } = kit(r, seed); s.spawnAcc = -1e12; p.invuln = 1e9; p.auto = true; p.moveAngle = 0; s.ammo.bullets += 999; s.ammo.shells += 999; s.ammo.fuel += 999; s.ammo.grenades += 99;
    G.selectWeapon(s, p, slot);
    for (let i = 0; i < n; i++) { const a = (i / n - .5) * 1.2, d = 120 + (i % 4) * 25; G.spawn(s, 'walker', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, { speed: 0 }); }
    let t = 0; while (s.enemies.some(e => !e.dead) && t < 60) { G.step(s, 1 / 20, { 0: {} }); t += 1 / 20; }
    best = Math.min(best, t);
  }
  return best;
}

export function hold(r, seed, seconds = 180) {
  const { s, p } = kit(r, seed); p.auto = true; p.invuln = 2; bestSlot(s, p); let downs = 0;
  if (p.turret) { G.step(s, 1 / 20, { 0: { deploy: true } }); for (let i = 0; i < 20; i++) G.step(s, 1 / 20, { 0: {} }); }
  for (let i = 0; i < seconds * 20; i++) {
    const inp = {}, near = s.enemies.filter(e => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 90);
    if (near.length) { let ax = 0, ay = 0; for (const e of near) { const d = Math.hypot(p.x - e.x, p.y - e.y) || 1; ax += (p.x - e.x) / d / d; ay += (p.y - e.y) / d / d; } const l = Math.hypot(ax, ay) || 1; inp.x = ax / l; inp.y = ay / l; inp.run = p.stamina > 20; }
    if (p.hp < 50 && p.medkits > 0) inp.heal = true;
    if (i % 40 === 0) bestSlot(s, p);
    G.step(s, 1 / 20, { 0: inp });
    if (s.mode === 'lost') { downs++; s.mode = 'play'; p.dead = false; p.hp = p.maxHp * .45; p.invuln = 3; }
  }
  return { downs, kills: s.kills, pressure: +G.pressure(s).toFixed(2), tier: s.threat, crowd: s.enemies.filter(e => !e.dead).length };
}

export function snapshot(r) {
  const { s, p } = r;
  return { pressure: +G.pressure(s).toFixed(2), power: +G.squadPower(s).toFixed(2), level: s.level, attachments: p.weaponInventory.reduce((n, w) => n + (w.attachments || []).length, 0), armor: p.armor, turret: !!p.turret, weapons: p.weaponInventory.map(w => w.weapon + '+' + (w.attachments || []).length).join(' ') };
}

if (process.argv[1] && process.argv[1].endsWith('power-sim.mjs')) {
  const seeds = process.argv.slice(2).map(Number).filter(Boolean); if (!seeds.length) seeds.push(1, 7, 21, 42);
  for (const seed of seeds) for (const m of [5, 20]) { const r = route(seed, m); console.log(seed, m + ' min', JSON.stringify({ ...snapshot(r), clear: +clearTime(r, seed).toFixed(2), hold: hold(r, seed) })); }
}
