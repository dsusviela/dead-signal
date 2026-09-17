// PLAYER_POWER.md Phase 0/10 measurements, simulation only (no rendering):
//   crowd  — time and ammunition for one stationary survivor to clear fixed walker/runner/brute/mixed crowds with every
//            weapon at each quality (and fully attached, once attachments exist)
//   pressure — enemies near a solo and a four-survivor squad, damage taken and downs over fixed stretches
//   node tools/power-bench.mjs [--json out.json] [--only crowd|pressure]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './pixboot.mjs';
await import('../city.js'); await import('../world.js'); await import('../boss.js'); await import('../game.js');
const G = globalThis.DSGame, o = parseArgs(process.argv.slice(2), new Set()), out = {};
const CROWDS = { walkers: [['walker', 12]], runners: [['runner', 10]], brutes: [['brute', 3]], mixed: [['walker', 8], ['runner', 5], ['brute', 1]] };
function arena(players = 1) {
  const s = G.create(7); for (let i = 0; i < players; i++) G.addPlayer(s, i ? 'bench:' + i : 'keyboard'); s.mode = 'play';
  s.world.obstacles = []; s.world.buildings = []; s.world.lots = []; s.world.props = []; s.loot = []; s.vehicles = []; s.spawnAcc = -1e12; s.enemies = [];
  s.ammo = { bullets: 5000, shells: 5000, fuel: 5000, grenades: 5000 }; s.nextXp = 1e12;
  s.players.forEach((p, i) => { p.x = (i - 1.5) * 30; p.y = 0; p.invuln = 0; p.hp = p.maxHp = 1e9; p.auto = true; }); // real knockback, never downed
  return s;
}
function clear(weapon, quality, crowd, attachments = []) {
  const s = arena(), p = s.players[0];
  if (weapon !== 'pistol') { p.weaponInventory = [{ weapon, quality, mag: G.WEAPONS[weapon].mag, attachments: attachments.slice() }]; p.weaponSlot = 0; p.backup = false; Object.assign(p, p.weaponInventory[0]); }
  let n = 0; for (const [type, count] of CROWDS[crowd]) for (let i = 0; i < count; i++, n++) { const a = -Math.PI / 2 + ((n * 0.618) % 1 - .5) * .8, r = 170 + (n % 5) * 22; G.spawn(s, type, Math.cos(a) * r, Math.sin(a) * r, { alert: true, state: 'chase', target: { x: 0, y: 0 }, alertT: 1e9 }); }
  const ammo0 = JSON.stringify(s.ammo), start = { ...s.ammo }; let t = 0;
  p.moveAngle = p.angle = p.viewAngle = -Math.PI / 2;
  for (; t < 90 && s.enemies.some(e => !e.dead); t += 1 / 30) { p.moveAngle = -Math.PI / 2; for (const e of s.enemies) { e.alert = true; e.state = 'chase'; e.target = { x: p.x, y: p.y }; e.alertT = 1e9; } G.step(s, 1 / 30, { 0: { x: 0, y: 0 } }); }
  const spent = Object.fromEntries(Object.keys(start).map(k => [k, start[k] - s.ammo[k]]).filter(([, v]) => v > 0));
  return { seconds: +t.toFixed(2), cleared: !s.enemies.some(e => !e.dead), spent, damageTaken: Math.round(1e9 - p.hp) };
}
if (!o.only || o.only === 'crowd') {
  out.crowd = {};
  const weapons = Object.keys(G.WEAPONS);
  for (const w of weapons) for (const q of w === 'pistol' ? [1] : [1, 2, 3]) for (const c of Object.keys(CROWDS)) out.crowd[`${w}/q${q}/${c}`] = clear(w, q, c);
  if (G.ATTACHMENTS) for (const w of weapons) if (G.ATTACHMENTS[w]) for (const c of Object.keys(CROWDS)) out.crowd[`${w}/q2/full/${c}`] = clear(w, 2, c, G.ATTACHMENTS[w].map(a => a.id));
}
if (!o.only || o.only === 'pressure') {
  out.pressure = {};
  for (const players of [1, 4]) for (const level of [1, 6, 12]) {
    const s = G.create(3); for (let i = 0; i < players; i++) G.addPlayer(s, i ? 'bench:' + i : 'keyboard'); s.mode = 'play'; s.level = level; s.nextXp = 1e12;
    s.players.forEach((p, i) => { p.x = (i - 1.5) * 30; p.y = 1400; p.invuln = 0; p.hp = p.maxHp = 1e9; p.auto = false; });
    let peak = 0, dmg = 0; const hp0 = s.players.map(p => p.hp);
    for (let t = 0; t < 120; t += 1 / 30) { G.step(s, 1 / 30, {}); peak = Math.max(peak, s.enemies.filter(e => !e.dead && Math.hypot(e.x - s.players[0].x, e.y - s.players[0].y) < 600).length); }
    dmg = s.players.reduce((n, p, i) => n + hp0[i] - p.hp, 0);
    out.pressure[`p${players}/level${level}`] = { tier: s.threat, pressure: G.pressure ? +G.pressure(s).toFixed(2) : null, peakNear: peak, enemies: s.enemies.length, damagePer120s: Math.round(dmg) };
  }
}
if (o.json) { fs.mkdirSync(path.dirname(o.json), { recursive: true }); fs.writeFileSync(o.json, JSON.stringify(out, null, 1)); }
console.log(JSON.stringify(out, null, 1));
