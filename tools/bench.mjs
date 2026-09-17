// Deterministic CPU benchmark; excludes drawing and real-device frame timing (tools/bench-browser.mjs renders).
// CITY.md Phase 13: world creation, nav rebuild, simulation under pressure for one and four survivors,
// vehicle collision stepping, point-light occlusion queries, and the long-run loot peak vs its compaction.
import { performance } from 'node:perf_hooks';
await import('../city.js');await import('../world.js');
await import('../boss.js');
await import('../game.js');
const G = globalThis.DSGame, W = globalThis.DSWorld;
const out = (k, v) => console.log(JSON.stringify({ [k]: v }));
const stats = xs => { const a = [...xs].sort((p, q) => p - q), avg = a.reduce((p, q) => p + q, 0) / a.length; return { avgMs: +avg.toFixed(3), p95Ms: +a[Math.floor(a.length * .95)].toFixed(3), maxMs: +a[a.length - 1].toFixed(2) }; };
const time = fn => { const t = performance.now(); fn(); return performance.now() - t; };

// world creation: fixed geometry plus run loot, five seeds (first call includes JIT warm-up)
{ const ms = [1, 11, 29, 74, 12345].map(seed => time(() => W.create(seed))); const w = W.create(12345);
  out('world', { createMs: ms.map(m => +m.toFixed(1)), obstacles: w.obstacles.length, buildings: w.buildings.length,
    rooms: w.buildings.reduce((n, b) => n + b.rooms.length, 0), lots: w.lots.length, sites: w.sites.length,
    loot: w.sites.reduce((n, q) => n + q.loot.length, 0), lights: (w.props || []).filter(p => p.light || p.glowAt).length }); }

function game(players, seed = 12345) {
  const s = G.create(seed); for (let i = 0; i < players; i++) G.addPlayer(s, 'bench:' + i);
  s.mode = 'play'; s.players.forEach(p => { p.invuln = 1e9; }); return s;
}

// nav rebuild: the same crowd stepped with and without a collision change every step
{ const s = game(1); const p = s.players[0], h = s.world.buildings.find(b => b.archetypeId === 'hospital'), r = h.rooms[0].rect;
  Object.assign(p, { x: r.x + r.w / 2, y: r.y + r.h / 2 }); // inside walls: the chasers have no straight line and must path
  for (let i = 0; i < 24; i++) G.spawn(s, 'walker', h.x - 160 - (i % 6) * 30, h.y + 40 + Math.floor(i / 6) * 30, { alert: true, alertT: 1e9, state: 'chase', target: p });
  const run = bump => { const xs = []; for (let i = 0; i < 300; i++) { for (const e of s.enemies) Object.assign(e, { alert: true, alertT: 1e9, state: 'chase', target: p }); if (bump) s.navVersion = (s.navVersion || 0) + 1; s.spawnAcc = -1e12; xs.push(time(() => G.step(s, 1 / 60, {}))); } return stats(xs); };
  run(false); const still = run(false), rebuilt = run(true);
  out('nav', { steady: still, rebuildEveryStep: rebuilt, rebuildCostMs: +(rebuilt.avgMs - still.avgMs).toFixed(3), chasers: s.enemies.length }); }

// simulation: 90 s at 60 Hz with the spawner live and late-run pressure (elapsed 12 min)
for (const count of [1, 4]) {
  const s = game(count); s.time = s.elapsed = 720;
  const startup = time(() => G.step(s, 1 / 60, {}));
  const xs = []; let enemies = 0, loot = 0, noise = 0;
  for (let i = 0; i < 5400; i++) { xs.push(time(() => G.step(s, 1 / 60, {}))); enemies = Math.max(enemies, s.enemies.length); loot = Math.max(loot, s.loot.length); noise = Math.max(noise, s.noise.length); }
  out('sim' + count, { players: count, startupMs: +startup.toFixed(2), ...stats(xs), peakEnemies: enemies, peakLoot: loot, peakNoise: noise, vehicles: s.vehicles.length });
}

// vehicle collisions: four survivors in the fire truck driving into the city at full throttle
{ const s = game(4); s.spawnAcc = -1e12; const v = s.vehicles.find(q => q.vehicleType === 'fireTruck'); v.fuel = v.maxFuel;
  for (const p of s.players) { Object.assign(p, { x: v.x + 50, y: v.y }); G.enterVehicle(s, v, p); }
  const drv = s.players.find(p => p.vehicle && v.driver === p.id) || s.players[0];
  const xs = []; for (let i = 0; i < 1800; i++) { const dir = Math.floor(i / 300) % 4, inp = { x: [0, 1, 0, -1][dir], y: [1, 0, -1, 0][dir] }; s.spawnAcc = -1e12; xs.push(time(() => G.step(s, 1 / 60, { [drv.id]: inp }))); }
  out('truck4', { ...stats(xs), aboard: s.players.filter(p => p.vehicle).length }); }

// point-light occlusion: random light/target pairs within light range
{ const s = game(1); let n = 0, hits = 0; const t = time(() => { for (let i = 0; i < 20000; i++) { const x = (Math.sin(i * 12.9898) * .5) * 4000, y = (Math.cos(i * 78.233) * .5) * 4000, a = i * .37;
    if (G.occluded(s, x, y, x + Math.cos(a) * 240, y + Math.sin(a) * 240)) hits++; n++; } });
  out('occlusion', { queries: n, perQueryUs: +(t / n * 1000).toFixed(2), blockedShare: +(hits / n).toFixed(2) }); }

// long run: 30 simulated minutes of kills far from the squad, nobody collecting the drops
{ const s = game(4); s.spawnAcc = -1e12; let peak = 0, compactions = 0;
  for (let i = 0; i < 36000; i++) {
    if (i % 4 === 0) { const e = G.spawn(s, 'walker', 2400 + (i % 97) * 9, -2400 + (i % 89) * 9); G.hitEnemy(s, e, 1e6); }
    const before = s.loot.length; s.spawnAcc = -1e12; G.step(s, 1 / 20, {}); if (s.loot.length < before - 10) compactions++; peak = Math.max(peak, s.loot.length);
  }
  out('longRun', { minutes: 30, kills: s.kills, peakLoot: peak, compactionThreshold: 700, compactions, finalLoot: s.loot.length }); }
