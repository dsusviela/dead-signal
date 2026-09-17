// PLAYER_POWER.md browser checks: join overflow dialog ownership and layout, then (as phases land) duplicate previews,
// launcher/turret/armor HUD states. Needs the dev server; PLAYWRIGHT_PATH defaults to the local playwright-core.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_PATH || 'C:/Users/daniel/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs').href);
const out = 'artifacts/power/browser'; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true }), results = [];
const pass = m => results.push('PASS ' + m);
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { window.__pads = []; navigator.getGamepads = () => window.__pads; });
  await page.goto('http://127.0.0.1:4177/?seed=12345'); await page.getByRole('button', { name: 'ENTER THE CITY' }).click();
  await page.waitForFunction(() => DeadSignal.state.time > .2, null, { polling: 50 });
  await page.evaluate(() => { const s = DeadSignal.state, p = s.players[0], g = w => ({ weapon: w, quality: 1, mag: DSGame.WEAPONS[w].mag, attachments: [] });
    p.weaponInventory = [g('ar'), g('shotgun'), g('smg'), g('rifle')]; p.backup = false; p.weaponSlot = 1; Object.assign(p, p.weaponInventory[1]);
    window.__pads = [{ id: 'mock-0', index: 0, connected: true, mapping: 'standard', axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) }]; });
  const padPress = async i => { await page.evaluate(i => { window.__pads[0].buttons[i] = { pressed: true, value: 1 }; }, i); await page.waitForTimeout(80); await page.evaluate(i => { window.__pads[0].buttons[i] = { pressed: false, value: 0 }; }, i); await page.waitForTimeout(80); };
  await padPress(0); // A joins
  await page.waitForFunction(() => DeadSignal.menu === 'overflow', null, { polling: 50 });
  const t0 = await page.evaluate(() => DeadSignal.state.time); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => DeadSignal.state.time), t0); pass('a join over capacity opens the overflow dialog and pauses the run');
  for (const [w, h] of [[1280, 720], [1920, 1080], [2048, 1002], [1024, 768]]) { await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(120);
    const r = await page.evaluate(() => DeadSignal.ui.rects()); assert.ok(r.length >= 4 && r.every(q => q.x >= 0 && q.y >= 0 && q.x + q.w <= w && q.y + q.h <= h), 'dialog fits ' + w + 'x' + h);
    await page.screenshot({ path: `${out}/overflow-${w}x${h}.png` }); }
  pass('the dialog fits every supported viewport');
  await padPress(0); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => DeadSignal.state.players[0].weaponInventory.length), 4, 'another survivor pressing A changes nothing');
  for (const k of ['ArrowDown', 'ArrowDown', 'Enter']) { await page.keyboard.press(k); await page.waitForTimeout(60); }
  await page.waitForTimeout(200);
  await page.waitForFunction(() => DeadSignal.ui.items[0] === 'confirm-drop', null, { polling: 50 });
  assert.equal(await page.evaluate(() => DeadSignal.state.players[0].weaponInventory.length), 4, 'picking is not dropping'); pass('the owner picks explicitly; a pick needs confirmation');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.waitForFunction(() => DeadSignal.ui.items[0] === 'drop:0', null, { polling: 50 }); pass('Esc returns to the list without dropping');
  const key = async k => { await page.keyboard.press(k); await page.waitForTimeout(60); };
  await key('ArrowDown'); await key('ArrowDown'); await key('Enter'); await key('Enter');
  await page.waitForFunction(() => DeadSignal.menu === null && !DeadSignal.state.overflowQueue.length, null, { polling: 50 });
  const st = await page.evaluate(() => { const p = DeadSignal.state.players[0]; return { n: p.weaponInventory.length, weapon: p.weapon, drop: DeadSignal.state.loot.filter(l => l.type === 'weapon' && l.lock > 0).map(l => l.weapon) }; });
  assert.deepEqual(st, { n: 3, weapon: 'shotgun', drop: ['smg'] }); pass('confirming drops the chosen weapon beside the survivor and play resumes');
  // Phase 3–5: duplicate preview, launcher burst, napalm ground (captures reviewed by hand)
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => { const s = DeadSignal.state, p = s.players[0]; s.spawnAcc = -1e12; s.enemies = []; p.x = 0; p.y = 2400; s.camera.x = 0; s.camera.y = 2400; p.invuln = 1e9;
    p.weaponInventory = [{ weapon: 'ar', quality: 1, mag: 30, attachments: ['ar_pierce'] }, { weapon: 'launcher', quality: 1, mag: 1, attachments: [] }]; p.backup = false; p.weaponSlot = 0; Object.assign(p, p.weaponInventory[0]); p.attachments = ['ar_pierce'];
    s.loot.push({ id: 'dup', x: p.x + 10, y: p.y, type: 'weapon', weapon: 'ar', quality: 2, amount: 1, label: 'rifle' }); });
  await page.waitForTimeout(400); await page.screenshot({ path: out + '/duplicate-preview.png' });
  await page.keyboard.press('e'); await page.waitForFunction(() => DeadSignal.state.players[0].weaponInventory[0].attachments.length === 2, null, { polling: 50 }); pass('E on a duplicate upgrades the matching weapon');
  await page.evaluate(() => { const s = DeadSignal.state, p = s.players[0]; s.ammo.grenades = 4; DSGame.selectWeapon(s, p, 1); p.auto = true; p.moveAngle = -Math.PI / 2;
    for (let i = 0; i < 7; i++) DSGame.spawn(s, i % 3 ? 'walker' : 'runner', (i - 3) * 14, 2250 - (i % 2) * 14, { alert: true, state: 'chase', target: { x: 0, y: 2400 }, alertT: 1e9 }); });
  await page.waitForFunction(() => DeadSignal.state.fx.some(f => f.sprite === 'vfx/explosion'), null, { polling: 20, timeout: 8000 });
  await page.screenshot({ path: out + '/launcher-burst.png' }); pass('the launcher fires a round that bursts in a lit explosion');
  // Phase 6: turret pickup, T deploys (prompt shows progress), the turret engages a crowd, E loads it, T packs it up
  await page.evaluate(() => { const s = DeadSignal.state, p = s.players[0]; s.enemies = []; s.grenades = []; s.fires = []; DSGame.selectWeapon(s, p, 0); p.auto = false; p.x = 0; p.y = 2400; p.moveAngle = 0; p.angle = 0;
    s.loot.push({ id: 'turret-test', x: p.x + 8, y: p.y, type: 'turret', label: 'turret' }); });
  await page.waitForFunction(() => DeadSignal.state.players[0].turret, null, { polling: 50, timeout: 4000 });
  await page.keyboard.down('t'); await page.waitForTimeout(80); await page.keyboard.up('t');
  await page.waitForFunction(() => DeadSignal.state.players[0].deploying, null, { polling: 20 });
  await page.waitForTimeout(250); await page.screenshot({ path: out + '/turret-deploying.png' });
  await page.waitForFunction(() => (DeadSignal.state.turrets || []).length === 1, null, { polling: 50, timeout: 4000 }); pass('T deploys a carried turret after standing still');
  await page.evaluate(() => { const s = DeadSignal.state, t = s.turrets[0]; t.ammo = 40;
    for (let i = 0; i < 6; i++) DSGame.spawn(s, 'walker', t.x + 150 + (i % 3) * 16, t.y - 30 + i * 12, { hp: 60, maxHp: 60, speed: 0 }); });
  await page.waitForFunction(() => DeadSignal.state.turrets[0].ammo < 40, null, { polling: 20, timeout: 4000 });
  await page.waitForTimeout(300); await page.screenshot({ path: out + '/turret-firing.png' }); pass('the turret engages infected in range from its own rounds');
  const bul = await page.evaluate(() => DeadSignal.state.ammo.bullets = 200);
  await page.keyboard.press('e'); await page.waitForTimeout(400);
  const loaded = await page.evaluate(() => ({ ammo: DeadSignal.state.turrets[0].ammo, bullets: DeadSignal.state.ammo.bullets }));
  assert.ok(loaded.bullets < bul && loaded.ammo > 0, 'E loads from the squad reserve'); await page.screenshot({ path: out + '/turret-loading.png' }); pass('E beside the turret loads bullets from the shared reserve');
  await page.waitForTimeout(3500); await page.keyboard.press('t'); await page.waitForFunction(() => !(DeadSignal.state.turrets || []).length && DeadSignal.state.players[0].turret, null, { polling: 50, timeout: 3000 });
  pass('T beside your own turret packs it up with its rounds');
  assert.deepEqual(errors, []);
  console.log(results.join('\n')); console.log('power browser checks passed');
} finally { await browser.close(); }
