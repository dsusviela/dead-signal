import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const playwrightPath = process.env.PLAYWRIGHT_PATH || 'C:/Users/daniel/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs';
const { chromium } = await import(pathToFileURL(playwrightPath).href);

const URL = process.env.DEAD_SIGNAL_URL || 'http://127.0.0.1:4177/';
const pads = new Map();
function makePad(index) { return { id: `mock-${index}`, index, connected: true, mapping: 'standard', axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) }; }
function analog(padIndex, buttonIndex, value) { const p = pads.get(padIndex) || makePad(padIndex); p.buttons[buttonIndex] = { pressed: value > .5, value }; pads.set(padIndex, p); }
function button(padIndex, buttonIndex, pressed) { const p = pads.get(padIndex) || makePad(padIndex); p.buttons[buttonIndex] = { pressed, value: pressed ? 1 : 0 }; pads.set(padIndex, p); }
function setConnected(index, connected) { const p = pads.get(index) || makePad(index); p.connected = connected; pads.set(index, p); }
async function press(buttonIndex, sync, padIndex = 0, n = 1) { button(padIndex, buttonIndex, true); await sync(); await new Promise(r => setTimeout(r, n * 70)); button(padIndex, buttonIndex, false); await sync(); await new Promise(r => setTimeout(r, 70)); }
const browser = await chromium.launch({ headless: true });
let page;
const results = [];
const check = (condition, name) => { assert.ok(condition, name); results.push(`PASS ${name}`); };
const state = () => page.evaluate(() => window.DeadSignal.state);
const waitFor = async (fn, ms = 2500) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await new Promise(r => setTimeout(r, 30)); } throw new Error('timed out'); };
try {
  page = await browser.newPage();
  await page.addInitScript(({ initial }) => {
    window.__fakePads = initial;
    navigator.getGamepads = () => window.__fakePads.map(p => p && ({ ...p, axes: [...p.axes], buttons: p.buttons.map(b => ({ ...b })) }));
  }, { initial: [] });
  await page.goto(URL, { waitUntil: 'load' });
  const sync = () => page.evaluate(next => { window.__fakePads = next.map(p => p && p.connected ? p : null); }, [...pads.values()]);
  pads.set(0, makePad(0)); await sync();
  await press(9, sync);
  await waitFor(async () => (await state()).mode === 'play');
  let s = await state(); check(s.players.length === 1 && s.players[0].source === 'pad:0', `controller-only Start creates one controller survivor (${JSON.stringify(s.players)})`); check(!s.players.some(p => p.source === 'keyboard'), 'controller-only Start does not create a keyboard survivor'); check(!s.paused, 'controller-only Start does not instantly pause');

  pads.get(0).axes=[0,-1];button(0,7,true);await sync();await new Promise(r=>setTimeout(r,250));
  check((await state()).players[0].stamina<100&&(await state()).players[0].running,'held RT runs and drains stamina');
  button(0,7,false);pads.get(0).axes=[0,0];await sync();
  // city_v2 Section 0: analog triggers drive, the stick only steers, LT brakes then reverses, held triggers re-arm
  await page.evaluate(()=>{const s=DeadSignal.state,v=s.vehicles.find(q=>q.vehicleType==='sedan'),p=s.players[0];s.spawnAcc=-1e9;s.enemies=[];s.vehicles=[v];s.world.obstacles=[v.obstacle];
    Object.assign(v,{fuel:v.maxFuel});p.x=v.x+40;p.y=v.y;p.invuln=1e9;if(!DSGame.enterVehicle(s,v,p))throw new Error('board');Object.assign(v,{x:0,y:1400,angle:0,speed:0});});
  const car=()=>page.evaluate(()=>DeadSignal.state.vehicles[0].speed);
  pads.get(0).axes=[1,-1];await sync();await new Promise(r=>setTimeout(r,300));check(Math.abs(await car())<1,'stick alone never accelerates the controller driver');pads.get(0).axes=[0,0];
  analog(0,7,.45);await sync();await new Promise(r=>setTimeout(r,500));const partial=await car();check(partial>10,'a partial RT accelerates ('+partial.toFixed(0)+')');
  analog(0,7,1);await sync();await new Promise(r=>setTimeout(r,500));check(await car()>partial,'full RT accelerates harder');analog(0,7,0);
  analog(0,6,1);await sync();await waitFor(async()=>(await car())<-15,4000);check(true,'held LT brakes to rest and then reverses');
  analog(0,7,1);await sync();await waitFor(async()=>(await car())>=-1,3000);analog(0,7,0);analog(0,6,0);await sync();check(true,'RT brakes a reversing car');
  analog(0,7,1);analog(0,6,1);await sync();await waitFor(async()=>Math.abs(await car())<1,3000);await new Promise(r=>setTimeout(r,250));check(Math.abs(await car())<1,'both triggers hold the car at rest');
  analog(0,6,0);analog(0,7,0);await sync();await new Promise(r=>setTimeout(r,100));
  await press(9,sync);analog(0,7,1);await sync();await new Promise(r=>setTimeout(r,100));await press(9,sync);await new Promise(r=>setTimeout(r,300));{const sp=await car(),info=await page.evaluate(()=>{const p=DeadSignal.state.players[0];return {menu:DeadSignal.menu,paused:DeadSignal.state.paused,ctx:p.triggerContext,hold:p.triggerHold,veh:p.vehicle};});check(Math.abs(sp)<1,'RT pressed during pause does not accelerate on resume '+sp+' '+JSON.stringify(info));}
  analog(0,7,0);await sync();await new Promise(r=>setTimeout(r,70));
  analog(0,7,1);await sync();await press(0,sync);analog(0,7,0);await sync();
  check((await state()).players[0].vehicle==null,'A leaves the car');
  await page.evaluate(()=>{const s=DeadSignal.state,p=s.players[0];p.x=0;p.y=2800;});
  for (const i of [1, 2, 3]) { pads.set(i, makePad(i)); await sync(); await press(0, sync, i); await waitFor(async () => (await state()).players.length === i + 1); }
  check((await state()).players.length === 4, 'A drop-in reaches four survivors');
  const p0 = () => page.evaluate(() => window.DeadSignal.state.players.find(p => p.source === 'pad:0'));

  await page.evaluate(()=>{const s=DeadSignal.state,p=s.players[0];p.hp=10;p.medkits=3;p.invuln=100;s.supplies.provisions=2;});
  button(0,1,true);await sync();await new Promise(r=>setTimeout(r,220));
  check((await p0()).hp===60&&(await p0()).medkits===2,'held B heals once and consumes one medkit');
  button(0,1,false);await sync();await new Promise(r=>setTimeout(r,70));await press(1,sync);
  check((await p0()).hp===100&&(await p0()).medkits===1,'second B press heals up to max HP');
  await press(1,sync);check((await p0()).medkits===1&&(await state()).supplies.provisions===2&&(await p0()).notice?.text==='Health full','B at full health explains itself and never eats');
  await press(6,sync);check((await p0()).medkits===1&&(await state()).supplies.provisions===2,'LT on foot consumes nothing');
  await press(5,sync);check((await state()).supplies.provisions===1&&(await p0()).hp===100,'RB eats one squad ration');
  const auto0 = (await p0()).auto; button(0, 2, true); await sync(); await new Promise(r => setTimeout(r, 180)); const held = (await p0()).auto; check(held !== auto0, 'X toggles autofire on its press edge'); await new Promise(r => setTimeout(r, 180)); check((await p0()).auto === held, 'held X does not retrigger every frame'); button(0, 2, false); await sync();
  await page.evaluate(() => { const s = window.DeadSignal.state, p = s.players[0]; window.DSGame.collect(s, p, { id: 99999, x: p.x, y: p.y, type: 'weapon', weapon: 'ar', quality: 1 }); });
  await press(3, sync); const backup = (await p0()).backup; check(backup === true, 'Y selects backup after a primary weapon is equipped');
  await page.evaluate(()=>{const s=DeadSignal.state,p=s.players[0];p.auto=false;DSGame.collect(s,p,{id:99998,x:p.x,y:p.y,type:'weapon',weapon:'shotgun',quality:2,mag:4});});
  button(0,3,true);await sync();await new Promise(r=>setTimeout(r,250));
  check((await p0()).backup,'held Y cycles once from slot two to the pistol');button(0,3,false);await sync();await new Promise(r=>setTimeout(r,70));
  await press(3,sync);check(!(await p0()).backup&&(await p0()).weapon==='ar','Y cycles from pistol to slot one');
  await press(3,sync);check((await p0()).weapon==='shotgun'&&(await p0()).mag===4&&(await p0()).quality===2,'Y cycles to slot two with magazine and quality intact');
  // upgrades: a badge in play, chosen only by the owner in a paused panel
  await page.evaluate(() => { const s=window.DeadSignal.state; s.players[0].upgrades = 1; s.players[1].upgrades = 1; s.players[0].hp=50; });
  await press(1, sync); await press(5, sync); check((await p0()).upgrades === 1, 'B / RB in play never spend an upgrade');
  await page.evaluate(()=>{DeadSignal.state.players[0].hp=100;DeadSignal.state.players[0].medkits=1;});
  await press(9, sync); await waitFor(async () => await page.evaluate(() => DeadSignal.menu === 'pause'));
  await press(13, sync, 1); await waitFor(async () => await page.evaluate(() => DeadSignal.ui.items[DeadSignal.ui.focus] === 'upgrade:0'));
  await press(0, sync, 1); await waitFor(async () => await page.evaluate(() => DeadSignal.menu === 'upgrade' && DSHud.upgradeFor === 0));
  check((await state()).paused, 'the upgrade panel keeps the squad paused');
  await press(0, sync, 1); check((await p0()).upgrades === 1, 'another survivor cannot spend P1\'s upgrade');
  await press(5, sync); await press(0, sync); check((await p0()).upgrades === 0, 'the owner moves with RB and takes it with A');
  check(await page.evaluate(() => DeadSignal.menu === 'pause'), 'spending the last point returns to Pause');
  await press(9, sync); await waitFor(async () => !(await state()).paused); check((await p0()).medkits === 1, 'closing the menus never heals, eats or boards');
  await press(8,sync);await waitFor(async()=>await page.evaluate(()=>DeadSignal.menu==='fullmap'));
  check(!(await state()).paused,'Back opens live full map');await press(8,sync);
  await press(9, sync); await waitFor(async () => (await state()).paused === true); check((await state()).paused, 'Start pauses during play'); await press(9, sync); await waitFor(async () => (await state()).paused === false); check(!(await state()).paused, 'Start resumes from pause');
  await press(9,sync);for(let i=0;i<8&&await page.evaluate(()=>DeadSignal.ui.items[DeadSignal.ui.focus]!=='options');i++)await press(13,sync);await press(0,sync);
  await waitFor(async()=>await page.evaluate(()=>DeadSignal.menu==='options'));
  check((await state()).paused,'controller opens Options while paused');
  await press(15,sync);check((await state()).settings.drivingStyle==='directional','D-pad changes driving mode');
  pads.get(0).axes=[-1,0];await sync();await new Promise(r=>setTimeout(r,200));
  check((await state()).settings.drivingStyle==='steering','left stick changes driving mode once while held');
  pads.get(0).axes=[0,0];await sync();await press(13,sync);await press(0,sync);
  check(await page.evaluate(()=>DSAudio.musicMuted&&!DSAudio.muted),'controller can mute only music');
  await press(1,sync);check(await page.evaluate(()=>DeadSignal.menu==='pause'&&DeadSignal.state.paused),'B returns to Pause');
  await press(9,sync);check(!(await state()).paused,'Start resumes after Options');
  for (const p of pads.values()) p.connected = false; await sync(); await waitFor(async () => (await state()).paused === true); check((await state()).paused, 'disconnecting all controllers pauses the run'); for (const p of pads.values()) p.connected = true; await sync(); await new Promise(r => setTimeout(r, 120)); check((await state()).paused, 'reconnecting keeps the pause screen active'); await press(9, sync); await waitFor(async () => (await state()).paused === false); check(!(await state()).paused, 'Start resumes after controller reconnect');
  console.log(results.join('\n'));
} catch (error) {
  console.log(results.join('\n'));console.error('FAIL ' + error.message + (page ? ' menu=' + await page.evaluate(() => DeadSignal.menu + ' focus=' + DeadSignal.ui.focus + ' items=' + DeadSignal.ui.items) : ''));
  process.exitCode = 1;
} finally { await browser.close(); }
