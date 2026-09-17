// Campaign dependency chain (CITY.md Phase 12): facts set by physical actions, free exploration, refusals for missing
// prerequisites, persistence through retreat, and a win only at the actual escape.
import assert from 'node:assert/strict';
import nodeFs from 'node:fs';
const await_fs = () => nodeFs;
await import('../city.js'); await import('../world.js'); await import('../boss.js'); await import('../game.js');
const G = globalThis.DSGame, B = globalThis.DSBoss, W = globalThis.DSWorld;
const results = [];
function test(name, fn) { try { fn(); results.push(`PASS ${name}`); } catch (e) { results.push(`FAIL ${name}: ${e.message}`); } }

function game(players = 1, seed = 90) {
  const s = G.create(seed);
  for (let i = 0; i < players; i++) G.addPlayer(s, 'camp-' + i);
  s.mode = 'play'; s.spawnAcc = -1e12; s.enemies = [];
  for (const p of s.players) p.invuln = 1e12;
  return s;
}
// keep the city quiet so only the campaign is exercised
function run(s, seconds, inputs = {}) { for (let i = 0; i < Math.round(seconds * 20); i++) { s.spawnAcc = -1e12; s.enemies = []; G.step(s, .05, inputs); } }
const press = (s, ids) => Object.fromEntries(ids.map(id => [id, { interact: true }]));
const put = (p, pt, dy = 12) => Object.assign(p, { x: pt.x, y: pt.y + dy });
function hold(s, action, seconds, who = s.players) {
  const pt = G.holdPoint(s, action); who.forEach((p, i) => put(p, pt, 8 + i * 6));
  run(s, .05, press(s, who.map(p => p.id))); run(s, seconds);
}
function fuelGenerator(s) { const p = s.players[0], a = G.generatorAnchor(s); s.supplies.vehicleFuel = 30; put(p, a, 20); run(s, .05, { [p.id]: { interact: true } }); run(s, 3.5); }
function killBoss(s) { const api = G.api(s); s.players.forEach((p, i) => Object.assign(p, { x: (i - .5) * 40, y: 40 })); B.start(s, api); B.hit(s, s.boss.maxHp + 1, api); }
function takeItem(s, type) { const it = s.loot.find(i => i.type === type && !i.taken); assert.ok(it, `${type} exists`); const p = s.players[0]; put(p, it, 0); run(s, .1); assert.ok(it.taken, `${type} taken`); }
function takeAllEvidence(s) { for (const it of s.loot.filter(i => i.type === 'evidence')) { const p = s.players[0]; put(p, it, 0); run(s, .1); } }

test('facts start unset; evidence waits where the anchors are; notices point onward without waypoints', () => {
  const s = game();
  const c = s.campaign;
  for (const k of ['generator', 'prepared', 'payload', 'override', 'transmitted', 'gateOpen', 'escaped']) assert.equal(c[k], false, k);
  const ev = s.loot.filter(i => i.type === 'evidence').map(i => i.evidence).sort();
  assert.deepEqual(ev, Object.keys(G.EVIDENCE).sort());
  assert.equal(s.loot.filter(i => i.type === 'payload' || i.type === 'override').length, 0, 'payload and override are sealed while the subject lives');
  const notice = s.world.props.find(p => p.notice && p.locationId === 'checkpoint-nine'); assert.ok(notice);
  assert.equal(s.locationState['machine-shop'].discovered, true); // signed civic places are known anyway
  put(s.players[0], notice, 30); run(s, .1);
  assert.ok(notice.read && s.document && s.campaign.known.includes('chapel'), 'reading the notice reveals the chapel');
  assert.ok(!s.civilians, 'nobody waits behind the barrier: the squad walks out alone');
});

test('illegal orders refuse with reasons and change nothing; exploration stays free', () => {
  const s = game(); s.nextXp = 1e9; // a level-up banner must not replace the refusal being checked
  hold(s, 'transmit', 5); assert.equal(s.campaign.transmitProgress, 0, 'no transmit without preparation and payload');
  assert.match(s.banner, /NOT PREPARED|PAYLOAD/);
  hold(s, 'prepare', 5); assert.equal(s.campaign.prepareProgress, 0, 'no preparation without power');
  hold(s, 'gate', 5); assert.equal(s.campaign.gateProgress, 0, 'no gate without power, override and transmission');
  assert.match(s.banner, /POWER/);
  // committing to the boss early is allowed; so is reading records in any order
  takeAllEvidence(s); assert.ok(Object.values(s.campaign.evidence).every(Boolean));
  killBoss(s); assert.equal(s.campaign.bossDown, true); assert.equal(s.mode, 'play');
  run(s, .1); assert.equal(s.loot.filter(i => i.type === 'payload').length, 1);
  takeItem(s, 'payload'); takeItem(s, 'override');
  hold(s, 'transmit', 5); assert.equal(s.campaign.transmitProgress, 0, 'payload alone does not transmit without a prepared station');
  hold(s, 'gate', 5); assert.equal(s.campaign.gateProgress, 0, 'override alone does not open the gate');
});

test('the full chain in canon order, with retreat and re-entry, ends only at the escape', () => {
  const s = game(2);
  // 1-2 South Blocks and Ashworks: fuel in hand
  takeAllEvidence(s);
  // 3 chapel generator
  fuelGenerator(s); assert.equal(s.circuit.emergency, true);
  // Blackglass preparation (power) -> pallet
  hold(s, 'prepare', 13); assert.equal(s.campaign.prepared, true); assert.equal(s.loot.filter(i => i.rewardId === 'radio-pallet').length, 4);
  // 4-5 hospital evidence already read before the generator: it survived
  assert.equal(s.campaign.evidence.patientRecords, true);
  killBoss(s); run(s, .1); takeItem(s, 'payload'); takeItem(s, 'override');
  assert.equal(s.loot.filter(i => i.type === 'payload').length + s.loot.filter(i => i.type === 'override').length, 0, 'recovered once');
  G.bossDefeated(s); run(s, .1); assert.equal(s.loot.filter(i => i.type === 'payload' || i.type === 'override').length, 0, 'no duplicate spawn');
  // 6 transmit, retreating halfway: progress persists
  hold(s, 'transmit', 20); const mid = s.campaign.transmitProgress; assert.ok(mid > 15 && !s.campaign.transmitted);
  s.players.forEach(p => Object.assign(p, { x: 0, y: 2800 })); run(s, 5); assert.equal(s.campaign.transmitProgress, mid, 'leaving keeps the progress');
  hold(s, 'transmit', 22); assert.equal(s.campaign.transmitted, true); assert.match(s.document.title, /REPLY/); assert.equal(s.mode, 'play');
  // 7 checkpoint: the barrier is the one gap in the cordon; the squad walks through it into the mouth beyond the fence
  Object.assign(s.players[0], { x: 0, y: W.EDGE - 60 }); run(s, 1, { [s.players[0].id]: { y: 1 } });
  assert.ok(s.players[0].y < W.EDGE - 12, 'the closed gate holds the cordon');
  hold(s, 'gate', 9); assert.equal(s.campaign.gateOpen, true); assert.equal(s.finalPush, true); assert.equal(s.mode, 'play', 'opening the gate is not the win');
  run(s, 8); assert.equal(s.mode, 'play', 'not won until the squad is out');
  const [a, b] = s.players; Object.assign(a, { x: 0, y: G.EXIT.y }); Object.assign(b, { x: 0, y: 2700 }); run(s, .2);
  assert.equal(s.mode, 'play', 'co-op regroup: one survivor behind blocks the escape');
  b.dead = true; b.hp = 0; Object.assign(b, { x: 40, y: G.EXIT.y }); run(s, .2); assert.equal(s.mode, 'play', 'a downed survivor must be revived first');
  Object.assign(a, { x: b.x + 10, y: b.y }); run(s, 3.3); assert.equal(b.dead, false);
  run(s, .2); assert.equal(s.mode, 'won'); assert.equal(s.campaign.escaped, true);
});

test('losing mid-chain is a loss; a fresh run starts clean with no duplicates', () => {
  const s = game(1); fuelGenerator(s); s.players[0].dead = true; run(s, .1); assert.equal(s.mode, 'lost');
  const t = game(1); assert.equal(t.circuit.emergency, false); assert.equal(t.campaign.prepared, false);
  assert.equal(t.loot.filter(i => i.type === 'evidence').length, Object.keys(G.EVIDENCE).length);
});

test('convergence drops after the furnace without resetting elapsed pressure', () => {
  const s = game(1); s.time = 600; s.elapsed = 600; const before = s.threat;
  killBoss(s); run(s, .1);
  assert.ok(s.convergence < 1 && s.threat >= before, 'lower pull, same accumulated threat');
  assert.equal(s.boss.active, false);
});


// ---- Phase 12A: sound sources the simulation hears (independent of every audio setting) ----
test('footstep events name the floor underfoot; walking and running keep their hearing radii', () => {
  const s = game(1), p = s.players[0], W = globalThis.DSWorld;
  const hosp = s.world.buildings.find(b => b.archetypeId === 'hospital'), wood = s.world.buildings.find(b => b.interior.floor === 'Wood');
  const grave = s.world.lots.find(l => l.kind === 'graveyard');
  assert.equal(W.surfaceAt(s.world, hosp.rooms[0].rect.x + 20, hosp.rooms[0].rect.y + 20), 'tile');
  assert.equal(W.surfaceAt(s.world, wood.rooms[0].rect.x + 20, wood.rooms[0].rect.y + 20), 'wood');
  assert.equal(W.surfaceAt(s.world, grave.rect.x + 30, grave.rect.y + 30), 'grass'); // city_v2: a lawn between the graves
  assert.equal(W.surfaceAt(s.world, 0, 2800), 'asphalt');
  const room = hosp.rooms.find(r => r.id.endsWith('corridor-c')).rect; Object.assign(p, { x: room.x + 20, y: room.y + room.h / 2 });
  s.audioEvents.length = 0; for (let i = 0; i < 40; i++) { s.spawnAcc = -1e12; G.step(s, .05, { 0: { x: 1, run: true } }); }
  assert.ok(s.audioEvents.some(e => e.type === 'step' && e.detail === 'tile'), 'running on tile emits tile steps');
  assert.ok(s.noise.some(n => n.kind === 'run' && n.r === G.NOISE.run), 'hearing radius unchanged');
});

test('noisy interactions have explicit hearing radii; atmosphere does not', () => {
  const s = game(1), p = s.players[0];
  // pouring is quiet
  const car = s.vehicles.find(v => v.slotId === 'evac-car'); car.fuel = 0; s.supplies.vehicleFuel = 60; Object.assign(p, { x: car.obstacle.x + car.obstacle.w + 16, y: car.y });
  run(s, .05, { 0: { interact: true } }); assert.ok(s.noise.some(n => n.kind === 'pour' && n.r === 110));
  // the running generator calls infected every four seconds; not before the circuit is live
  const t = game(1), q = t.players[0]; Object.assign(q, { x: 0, y: 2800 });
  run(t, 9); assert.ok(!t.noise.some(n => n.kind === 'generatorRun'));
  t.circuit.emergency = true; let calls = 0; for (let i = 0; i < 20 * 9; i++) { t.spawnAcc = -1e12; t.enemies = []; G.step(t, .05, {}); calls += t.noise.filter(n => n.kind === 'generatorRun' && n.life >= 1.35).length; }
  assert.ok(calls >= 2 && calls <= 4, `generator noise cadence (${calls} in 9 s)`); assert.equal(G.NOISE.generatorRun, 260);
  // gate motors and the transmission are loud; paper and eating are silent
  assert.equal(G.NOISE.gate, 380); assert.equal(G.NOISE.radio, 500); assert.ok(G.NOISE.strain > 0 && G.NOISE.clear > G.NOISE.strain);
  const u = game(1), r = u.players[0]; const ev = u.loot.find(i => i.type === 'evidence'); Object.assign(r, { x: ev.x, y: ev.y }); u.noise.length = 0; run(u, .1);
  assert.ok(u.campaign.evidence[ev.evidence] && !u.noise.some(n => n.kind !== 'walk' && n.kind !== 'run'), 'reading records makes no noise');
  // hearing never depends on the sound settings: the simulation does not read the audio module
  const fs = await_fs(); for (const f of ['game.js', 'boss.js', 'world.js']) assert.ok(!fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').includes('DSAudio'), `${f} is independent of audio`);
});

// ---- Phase 13: fuel reserve through a whole run, revisits, arena return, restart, long-run loot ----
test('spending all optional fuel still powers the chapel; cleared places, the arena and a restart behave', () => {
  const s = game(1), p = s.players[0], L = G.FUEL.distancePerLitre;
  // pour every optional litre into an empty car: the last 30 L refuse to leave the can
  const car = s.vehicles.find(v => v.slotId === 'evac-car'); car.fuel = 0; s.supplies.vehicleFuel = 60;
  Object.assign(p, { x: car.obstacle.x + car.obstacle.w + 16, y: car.y });
  for (let k = 0; k < 4; k++) { run(s, .05, { [p.id]: { interact: true } }); run(s, 3); }
  assert.equal(s.supplies.vehicleFuel, 30, 'the generator charge survives optional spending'); assert.ok(car.fuel >= 30 * L - 1);
  // drive the fuel away and back: nothing respawns, nothing is lost
  // loose finds only: walking over them collects (the first of these places that rolled any loot this seed)
  const loc = ['graveyard', 'residential-park', 'northline-park'].map(id => s.world.locations.find(l => l.id === id)).find(l => s.loot.some(i => l.siteIds.includes(i.siteId) && i.type !== 'evidence'));
  for (const it of s.loot.filter(i => loc.siteIds.includes(i.siteId) && !i.taken && i.type !== 'evidence')) { put(p, it, 0); run(s, .1); }
  assert.ok(!s.loot.some(i => loc.siteIds.includes(i.siteId) && !i.taken), loc.id + ' emptied'); {
    assert.equal(s.locationState[loc.id].cleared, true, loc.id + ' cleared');
    Object.assign(p, { x: 0, y: 2800 }); run(s, 2); const c = s.loot.length; put(p, s.world.sites.find(q => q.id === loc.siteIds[0]), 0); run(s, 2);
    assert.equal(s.locationState[loc.id].cleared, true, 'revisiting keeps it cleared'); assert.ok(s.loot.length <= c, 'no respawn on revisit');
  }
  const fuelBefore = s.supplies.vehicleFuel; fuelGenerator(s); assert.equal(s.circuit.emergency, true); assert.equal(s.supplies.vehicleFuel, fuelBefore - 30);
  hold(s, 'prepare', 13); killBoss(s); run(s, .1);
  // back into the yard after the furnace: the gates stay open, pressing E never restarts the fight, the squad can leave
  Object.assign(p, { x: 0, y: 40 }); run(s, .1, { [p.id]: { interact: true } }); run(s, 1);
  assert.equal(s.boss.active, false); assert.ok((s.world.arenaGates || []).every(g => s.gates[g.id].open), 'gates open');
  const gate = s.world.arenaGates.find(g => g.rect.y < 0 && g.rect.w >= g.rect.h); Object.assign(p, { x: gate.rect.x + 20, y: -G.ARENA.play + 30 }); // beside the centre bollard run(s, 2, { [p.id]: { y: -1 } }); assert.ok(Math.abs(p.y) > G.ARENA.play, 'the squad can walk back out');
  takeItem(s, 'payload'); takeItem(s, 'override');
  hold(s, 'transmit', 42); assert.equal(s.campaign.transmitted, true);
  hold(s, 'gate', 9); run(s, 8); Object.assign(p, { x: 0, y: G.EXIT.y }); run(s, .3); assert.equal(s.mode, 'won');
  // restart: a fresh run, same city, nothing carried over
  const t = game(1, 90);
  assert.equal(t.mode, 'play'); assert.equal(t.campaign.bossDown, false); assert.equal(t.supplies.vehicleFuel, 0); assert.equal(t.circuit.emergency, false);
  assert.deepEqual(t.world.obstacles.length, G.create(91).world.obstacles.length);
});

test('long runs: unowned drops compact at 700 while authored and campaign loot is never merged away', () => {
  const s = game(1); const authored = s.loot.filter(i => i.siteId), xpBefore = s.loot.filter(i => i.type === 'xp' && !i.siteId).reduce((n, i) => n + i.amount, 0);
  for (let i = 0; i < 1400; i++) s.loot.push({ id: s.nextId++, x: 2400 + (i % 40) * 8, y: -2400 + Math.floor(i / 40) * 8, type: 'xp', amount: 1, label: 'experience' });
  run(s, .5);
  assert.ok(s.loot.length <= 700, 'compacted to ' + s.loot.length); assert.ok(authored.every(i => i.taken || s.loot.includes(i)), 'authored loot untouched (only what the survivor walked over is gone)');
  assert.equal(s.loot.filter(i => i.type === 'xp' && !i.siteId).reduce((n, i) => n + i.amount, 0), xpBefore + 1400, 'no experience lost');
});

test('the journal lists only what the squad has learned, ticks tasks off, and keeps every record read', () => {
  const s = game(), ids = () => G.journal(s).tasks.map(q => q.id), done = id => G.journal(s).tasks.find(q => q.id === id)?.done;
  assert.deepEqual(ids(), [], 'a fresh run knows nothing');
  const notice = s.world.props.find(p => p.notice && p.locationId === 'checkpoint-nine'); put(s.players[0], notice, 30); run(s, .1);
  assert.deepEqual(ids(), ['power', 'override', 'gate'], 'the evacuation notice names power, the override and the barrier');
  assert.equal(G.journal(s).records.length, 1); assert.match(G.journal(s).records[0].title, /EVACUATION/);
  put(s.players[0], notice, 30); run(s, .1); assert.equal(G.journal(s).records.length, 1, 'rereading does not duplicate a record');
  // a refusal teaches its prerequisites
  const pt = G.holdPoint(s, 'transmit'); put(s.players[0], pt, 8); run(s, .05, press(s, [s.players[0].id]));
  assert.ok(['prepare', 'payload', 'transmit'].every(id => ids().includes(id)), 'refused transmit adds the station and the payload: ' + ids());
  assert.ok(!G.journal(s).tasks.find(q => q.id === 'transmit').note.includes('Blackglass is ready'), 'the transmit task says what it waits on');
  takeAllEvidence(s); assert.ok(ids().includes('subject')); assert.equal(G.journal(s).records.length, 1 + Object.keys(G.EVIDENCE).length);
  fuelGenerator(s); assert.equal(done('power'), true);
  hold(s, 'prepare', 13); assert.equal(done('prepare'), true);
  killBoss(s); run(s, .1); assert.equal(done('subject'), true); takeItem(s, 'payload'); takeItem(s, 'override');
  hold(s, 'transmit', 42); assert.equal(done('transmit'), true); assert.ok(ids().includes('escape'));
  assert.ok(G.journal(s).records.some(r => /REPLY/.test(r.title)), 'the reply is kept as a record');
  assert.deepEqual(ids(), ['power', 'prepare', 'subject', 'payload', 'transmit', 'override', 'gate', 'escape'], 'tasks keep the chain order');
  assert.equal(G.journal(s).unknown, 0);
});

test('the cordon: fence on every edge, nothing crosses it, the gate mouth is the only way out', () => {
  const s = game(1), w = s.world, E = W.EDGE, p = s.players[0];
  assert.ok(w.obstacles.filter(o => o.cordon).length >= 5, 'fence runs on all four sides');
  for (const [x, y, dx, dy] of [[-1400, -E + 40, 0, -1], [-E + 40, 1400, -1, 0], [E - 40, -1400, 1, 0], [1400, E - 40, 0, 1]]) { Object.assign(p, { x, y }); run(s, 2, { [p.id]: { x: dx, y: dy } }); assert.ok(Math.abs(p.x) < E - 12 && Math.abs(p.y) < E - 12, `held at the fence near ${x},${y}: ${p.x},${p.y}`); }
  assert.ok(W.blocked(w, 300, E + 20, 8), 'outside the fence is blocked'); assert.ok(!W.blocked(w, 0, E + 20, 8), 'the gate mouth is open ground');
});

test('the objective card walks the whole chain in order: fuel, generator, furnace, command post, radio, gate, escape', () => {
  const s = game(), cur = () => G.objective(s).current.id;
  assert.equal(cur(), 'fuel'); assert.equal(G.objective(s).steps.length, 9);
  fuelGenerator(s); assert.equal(cur(), 'furnace', 'powering the chapel completes the fuel and generator steps');
  killBoss(s); run(s, .1); assert.equal(cur(), 'records'); assert.match(G.objective(s).current.hint, /0 of 2/);
  takeItem(s, 'payload'); assert.match(G.objective(s).current.hint, /1 of 2/); takeItem(s, 'override'); assert.equal(cur(), 'prepare');
  hold(s, 'prepare', 13); assert.equal(cur(), 'broadcast'); hold(s, 'transmit', 42); assert.equal(cur(), 'gate');
  const gate = G.objective(s).steps.find(q => q.id === 'gate'); assert.equal(gate.done, false);
  G.learn(s, ['gate']); assert.ok(G.journal(s).tasks.find(q => q.id === 'gate').needs.length === 0, 'a ready barrier lists nothing left to do');
  s.campaign.override = false; assert.deepEqual(G.journal(s).tasks.find(q => q.id === 'gate').needs.map(n => n.done), [true, false, true], 'the barrier ticks off what it needs');
});

console.log(results.join('\n'));
if (results.some(r => r.startsWith('FAIL'))) process.exit(1);
