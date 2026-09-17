// City revamp resource and geometry baseline (CITY.md Phase 0).
//   node tools/city-baseline.mjs          print the measurement as JSON
//   node tools/city-baseline.mjs --write  refresh tools/fixtures/city-baseline.json
// tools/test-city.mjs compares the live measurement against the fixture, so a change to
// geometry or the loot economy has to be accepted deliberately by re-running --write.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const fixturePath = path.join(root, 'tools', 'fixtures', 'city-baseline.json');
export const SEEDS = Array.from({ length: 50 }, (_, i) => i + 1);

export function loadGame() {
  const c = { console, Math, Date, Map, Set, WeakMap, Uint8Array, URLSearchParams };
  c.window = c; vm.createContext(c);
  for (const f of ['city.js', 'world.js', 'boss.js', 'game.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), c, { filename: f });
  return c;
}

const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const range = a => ({ min: Math.min(...a), median: median(a), max: Math.max(...a) });
const round = v => Math.round(v * 100) / 100;

export function geometry(W) {
  const w = W.create(1), count = {};
  for (const o of w.obstacles) count[o.type] = (count[o.type] || 0) + 1;
  const houses = { byStyle: {}, byDistrict: {} };
  for (const h of w.buildings) {
    houses.byStyle[h.style] = (houses.byStyle[h.style] || 0) + 1;
    const d = W.district(h.x + h.w / 2, h.y + h.h / 2).id;
    houses.byDistrict[d] = (houses.byDistrict[d] || 0) + 1;
  }
  return {
    obstacles: w.obstacles.length, obstaclesByType: count, buildingMasses: count.building || 0,
    buildings: w.buildings.length, ...houses, locations: w.locations.length, lots: w.lots.length, vehicleSlots: w.vehicleSlots.length, sites: w.sites.length, landmarks: w.landmarks.map(l => l.id),
    driveableCars: w.obstacles.filter(o => o.driveable).length, props: w.props.length, lights: w.lights.length,
    burningWrecksByDistrict: w.obstacles.filter(o => o.burning).reduce((m, o) => { const d = W.district(o.x, o.y).id; m[d] = (m[d] || 0) + 1; return m; }, {})
  };
}

// One seed's initial world loot, by resource, plus the district shares the Phase 6 envelopes check.
export function tally(W, w) {
  const t = { pickups: 0, bullets: 0, shells: 0, incendiaryFuel: 0, medkits: 0, xp: 0, weaponQ1: 0, weaponQ2: 0, provisions: 0, vehicleFuel: 0, launchers: 0, armorPoints: 0, grenadeRounds: 0, turrets: 0 }, south = { bullets: 0, medkits: 0, provisions: 0 };
  let ashworksFuel = 0, supermarketProvisions = 0;
  for (const site of w.sites) for (const i of site.loot) {
    t.pickups++;
    const key = i.type === 'weapon' && i.weapon === 'launcher' ? 'launchers' : i.type === 'armor' ? 'armorPoints' : i.type === 'turret' ? 'turrets' : i.type === 'ammo' && i.ammo === 'grenades' ? 'grenadeRounds' : i.type === 'ammo' ? (i.ammo === 'fuel' ? 'incendiaryFuel' : i.ammo) : i.type === 'medkit' ? 'medkits' : i.type === 'xp' ? 'xp' : i.type === 'provision' ? 'provisions' : i.type === 'vehicleFuel' ? 'vehicleFuel' : i.type === 'weapon' ? (i.quality > 1 ? 'weaponQ2' : 'weaponQ1') : null;
    const n = i.type === 'weapon' || i.type === 'turret' ? 1 : i.amount;
    t[key] += n;
    const d = W.district(i.x, i.y).id;
    if (d === 'checkpoint' && key in south) south[key] += n;
    if (d === 'industry' && key === 'vehicleFuel') ashworksFuel += n;
    if (i.locationId === 'crossroads-supermarket' && key === 'provisions') supermarketProvisions += n;
  }
  return { ...t, southBlocksShare: Object.fromEntries(Object.entries(south).map(([k, v]) => [k, t[k] ? v / t[k] : 0])), ashworksFuel, supermarketProvisions };
}

export function measure(c = loadGame()) {
  const W = c.DSWorld, G = c.DSGame, per = { pickups: [], bullets: [], shells: [], incendiaryFuel: [], medkits: [], xp: [], provisions: [], vehicleFuel: [], launchers: [], armorPoints: [], grenadeRounds: [], turrets: [], vehicleTank: [], emptyTanks: [] };
  const weapons = {};
  for (const seed of SEEDS) {
    const w = W.create(seed), t = tally(W, w);
    for (const site of w.sites) for (const i of site.loot) if (i.type === 'weapon') { const k = `${i.weapon}/q${i.quality}`; (weapons[k] ||= []).push(seed); }
    for (const k of ['pickups', 'bullets', 'shells', 'incendiaryFuel', 'medkits', 'xp', 'provisions', 'vehicleFuel', 'launchers', 'armorPoints', 'grenadeRounds', 'turrets']) per[k].push(t[k]);
    const s = G.create(seed);
    per.vehicleTank.push(round(s.vehicles.reduce((n, v) => n + v.fuel, 0)));
    per.emptyTanks.push(s.vehicles.filter(v => v.fuel <= 0).length);
  }
  const weaponPickups = {};
  for (const k of Object.keys(weapons).sort()) {
    const counts = SEEDS.map(seed => weapons[k].filter(x => x === seed).length);
    weaponPickups[k] = range(counts);
  }
  const s = G.create(1); G.addPlayer(s);
  const p = s.players[0];
  return {
    seeds: `${SEEDS[0]}-${SEEDS[SEEDS.length - 1]}`,
    geometry: geometry(W),
    worldLoot: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, range(v)])),
    weaponPickups,
    nonWorldSources: {
      startingSharedAmmo: { ...s.ammo },
      startingPerPlayer: { medkits: p.medkits, weapon: p.weapon, backupPistol: p.backup, loadedRounds: p.mag },
      enemyDrops: 'XP only: walker 2, runner 2, ghost 3, brute 7, band 2, carrier 5 (game.js ENEMY.xp)',
      radioPallet: { bullets: 240, shells: 45, incendiaryFuel: 130, medkits: 1, objectiveXp: 65 },
      provisionsCarryCap: c.DSCity.ECONOMY.provisions.carryCap, vehicleFuelCarryCapLitres: c.DSCity.ECONOMY.fuel.carryCap
    }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const m = measure();
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
    fs.writeFileSync(fixturePath, JSON.stringify(m, null, 2) + '\n');
    console.log(`wrote ${path.relative(root, fixturePath)}`);
  } else console.log(JSON.stringify(m, null, 2));
}
