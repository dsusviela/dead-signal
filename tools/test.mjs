import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = n => fs.readFileSync(path.join(root, n), 'utf8');
function load() {
  const c = { console, Math, Date, Map, Set, Uint8Array, URLSearchParams };
  c.window = c; vm.createContext(c); vm.runInContext(src('city.js'), c, { filename: 'city.js' }); vm.runInContext(src('world.js'), c, { filename: 'world.js' });
  vm.runInContext(src('boss.js'), c, { filename: 'boss.js' });
  vm.runInContext(src('game.js'), c, { filename: 'game.js' });
  return c;
}
const c = load(), W = c.DSWorld, G = c.DSGame;
const tests = [];
function test(name, fn) { try { fn(); tests.push(`PASS ${name}`); } catch (e) { tests.push(`FAIL ${name}: ${e.message}`); } }
const input = (extra = {}) => ({ x: 0, y: 0, interact: false, toggle: false, switch: false, pause: false, upgrade: -1, ...extra });

test('world geometry is fixed while loot varies by seed', () => {
  const a = W.create(11), b = W.create(29);
  assert.deepEqual(a.bounds, b.bounds); assert.deepEqual(a.roads, b.roads); assert.deepEqual(a.obstacles, b.obstacles); assert.deepEqual(a.landmarks, b.landmarks);
  assert.notDeepEqual(a.sites.map(x => x.loot), b.sites.map(x => x.loot));
});
test('landmarks are reachable from spawn on the walkable grid', () => {
  const w = W.create(4), cell = 80, n = 90, key = (x, y) => `${x},${y}`;
  const pass = (x, y) => !W.blocked(w, -3600 + (x + .5) * cell, -3600 + (y + .5) * cell, 12);
  const start = [45, 80], seen = new Set([key(...start)]), q = [start];
  for (let h = 0; h < q.length; h++) { const [x, y] = q[h]; for (const [nx, ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) if(nx>=0&&ny>=0&&nx<n&&ny<n&&pass(nx,ny)&&!seen.has(key(nx,ny))){seen.add(key(nx,ny));q.push([nx,ny]);} }
  for (const l of w.landmarks) { const x = Math.max(0, Math.min(89, Math.floor((l.x + 3600) / cell))), y = Math.max(0, Math.min(89, Math.floor((l.y + 3600) / cell))); assert.ok(seen.has(key(x,y)), l.id); }
});
test('loot sites avoid solid obstacle footprints', () => { const w = W.create(8); for (const s of w.sites) for (const i of s.loot) assert.equal(W.blocked(w, i.x, i.y, 0), null, `${s.id}/${i.id}`); });

test('ammo, firing and reload conserve ammunition', () => {
  const s = G.create(2); G.addPlayer(s); s.mode = 'play'; s.loot = []; // nothing underfoot: only firing and reloading move ammunition
  const p = s.players[0]; p.auto = true; p.weapon = 'ar'; p.backup = false; p.mag = 1; s.ammo.bullets = 10; const e = G.spawn(s, 'walker', p.x + 35, p.y, { alert: true });
  G.step(s, .05, { 0: input() }); assert.equal(p.mag, 0); assert.equal(s.ammo.bullets, 10); assert.ok(e.hp < e.maxHp); p.auto=false;
  for(let i=0;i<45;i++) G.step(s, .05, { 0: input() }); assert.ok(p.mag > 0); assert.equal(p.mag + s.ammo.bullets, 10);
});
test('autofire toggle, backup and weapon swap keep loaded ammo distinct', () => {
  const s = G.create(3); G.addPlayer(s); s.mode='play'; const p = s.players[0]; p.weapon = 'ar'; p.backup = false; p.mag = 7; p.auto = true; s.ammo.bullets = 30; G.step(s, .01, {0: input({toggle:true})}); assert.equal(p.auto, false); G.step(s, .01, {0: input({toggle:true})}); assert.equal(p.auto, true);
  G.step(s, .01, {0: input({switch:true})}); assert.equal(p.backup, true); G.step(s, .01, {0: input({switch:true})}); assert.equal(p.backup, false);
  const old = s.ammo.bullets + p.mag; G.collect(s, p, {id:999,x:p.x,y:p.y,type:'weapon',weapon:'smg',quality:1}); assert.equal(s.ammo.bullets + p.weaponInventory.reduce((n,w)=>n+w.mag,0), old);
});

const takeGun=(s,p,weapon,quality=1,mag)=>G.collect(s,p,{id:s.nextId++,x:p.x,y:p.y,type:'weapon',weapon,quality,mag});
const cycle=(s,p=s.players[0])=>G.step(s,.01,{[p.id]:input({switch:true})});
test('two carried slots cycle in order with the permanent pistol and retain magazines and quality',()=>{
  const s=G.create(301);G.addPlayer(s);s.mode='play';const p=s.players[0];
  cycle(s);assert.equal(p.backup,true);assert.equal(p.weaponInventory.length,0);
  takeGun(s,p,'ar',2,7);takeGun(s,p,'shotgun',3,4);
  assert.equal(p.weaponInventory.length,2);assert.equal(p.weapon,'shotgun');assert.equal(p.mag,4);
  cycle(s);assert.equal(p.backup,true);
  cycle(s);assert.equal(p.backup,false);assert.equal(p.weapon,'ar');assert.equal(p.mag,7);assert.equal(p.quality,2);
  cycle(s);assert.equal(p.weapon,'shotgun');assert.equal(p.mag,4);assert.equal(p.quality,3);
});
test('full inventory replaces selected gun and passes its loaded rounds to a teammate',()=>{
  const s=G.create(302);G.addPlayer(s);G.addPlayer(s,'pad');s.mode='play';const [p,q]=s.players;
  takeGun(s,p,'ar',2,7);takeGun(s,p,'shotgun',3,4);takeGun(s,p,'rifle',1,5);cycle(s);cycle(s); // co-op capacity is three (PLAYER_POWER Phase 1)
  const reserve={...s.ammo};takeGun(s,p,'smg',1,12);
  assert.equal(p.weaponInventory.length,3);assert.equal(p.weaponInventory[1].weapon,'shotgun');
  const drop=s.loot.find(w=>w.type==='weapon'&&w.lock===1);assert.ok(drop);
  assert.equal(drop.weapon,'ar');assert.equal(drop.mag,7);assert.equal(drop.quality,2);
  G.collect(s,q,drop);assert.equal(q.weapon,'ar');assert.equal(q.mag,7);assert.equal(q.quality,2);
  assert.deepEqual({...s.ammo},reserve);assert.equal(G.collect(s,q,drop),false);
  // While the pistol is selected, replacement targets the last carried slot.
  cycle(s);cycle(s);cycle(s);assert.equal(p.backup,true);takeGun(s,p,'flame',1,0); // a type not carried (a carried type would be a duplicate upgrade)
  assert.equal(p.weaponInventory[0].weapon,'smg');assert.equal(p.weaponInventory[2].weapon,'flame');assert.equal(p.weaponInventory[2].mag,0);
  assert.equal(p.backup,false);assert.equal(p.mag,0);assert.deepEqual({...s.ammo},reserve);
});
test('identical gun types occupy distinct slots and switching cannot finish a reload for free',()=>{
  const s=G.create(303);G.addPlayer(s);s.mode='play';const p=s.players[0];p.invuln=999;
  // two same-type instances can still be carried (e.g. a teammate's drop taken as an ordinary pickup); a duplicate drop itself upgrades (PLAYER_POWER Phase 3)
  p.weaponInventory=[{weapon:'ar',quality:1,mag:7,attachments:[]},{weapon:'ar',quality:3,mag:1,attachments:[]}];p.backup=false;p.weaponSlot=1;Object.assign(p,p.weaponInventory[1]);p.attachments=[];s.ammo.bullets=20;p.auto=true;p.shotCd=0;
  G.spawn(s,'walker',p.x+35,p.y,{alert:true});G.step(s,.01,{0:input()});
  assert.equal(p.mag,0);assert.ok(p.reload>0);assert.equal(p.weaponInventory[1].mag,0);
  p.auto=false;cycle(s);assert.equal(p.backup,true);assert.equal(p.reload,0);
  for(let i=0;i<40;i++)G.step(s,.05,{});
  assert.equal(s.ammo.bullets,20);cycle(s);assert.equal(p.mag,7);assert.equal(p.quality,1);
  cycle(s);assert.equal(p.mag,0);assert.equal(p.quality,3);assert.equal(p.reload,0);
  p.auto=true;p.shotCd=0;G.spawn(s,'walker',p.x+35,p.y,{alert:true});G.step(s,.01,{});
  assert.ok(p.reload>0);p.auto=false;for(let i=0;i<40;i++)G.step(s,.05,{});
  assert.equal(p.mag,20);assert.equal(s.ammo.bullets,0);assert.equal(p.weaponInventory[0].mag,7);
});
test('pistol fires without spending carried ammunition and dead survivors cannot cycle',()=>{
  const s=G.create(304);G.addPlayer(s);G.addPlayer(s,'pad');s.mode='play';const p=s.players[0];
  takeGun(s,p,'shotgun',1,0);takeGun(s,p,'ar',1,0);cycle(s);
  const reserve={...s.ammo};p.auto=true;p.shotCd=0;const e=G.spawn(s,'walker',p.x+35,p.y,{alert:true});
  G.step(s,.01,{});assert.ok(e.hp<e.maxHp);assert.deepEqual({...s.ammo},reserve);
  assert.ok(p.weaponInventory.every(w=>w.mag===0));p.dead=true;cycle(s);assert.equal(p.backup,true);
});
test('XP grants levels and stat upgrades', () => { const s=G.create(4); G.addPlayer(s); const p=s.players[0], old=p.speed; p.upgrades=1; p.offers=['speed','damage','health']; assert.equal(G.upgrade(s,p,0),true); assert.ok(p.speed>old); const before=s.level; G.collect(s,p,{id:1,x:0,y:0,type:'xp',amount:100}); assert.ok(s.level>before&&p.upgrades>0); });
test('co-op shared healing, revive and squad wipe', () => {
  const s=G.create(5); G.addPlayer(s); G.addPlayer(s,'gamepad'); const [a,b]=s.players; a.hp=40;b.hp=50; G.collect(s,a,{id:2,x:0,y:0,type:'heal',amount:20}); assert.equal(a.hp,60); assert.equal(b.hp,70);
  s.mode='play'; a.dead=true;a.hp=0;a.x=b.x;a.y=b.y; for(let i=0;i<61;i++)G.step(s,.1,{1:input()}); assert.equal(a.dead,false); assert.ok(a.hp>0); b.dead=true; a.dead=true; G.step(s,.01,{}); assert.equal(s.mode,'lost');
});
test('waves keep global time across a district change', () => { const s=G.create(6); G.addPlayer(s); s.mode='play'; const p=s.players[0]; p.invuln=999; s.time=44; s.elapsed=44; p.x=0;p.y=2800; const before=W.district(p.x,p.y).id; G.step(s,.2,{0:input()}); const t=s.time; assert.equal(s.wave,1); const radio=s.world.landmarks.find(x=>x.id==='radio'); p.x=radio.x;p.y=radio.y; G.step(s,.2,{0:input()}); assert.ok(s.time>t); assert.notEqual(W.district(p.x,p.y).id,before); assert.equal(s.wave,1); s.time=44.95; G.step(s,.05,{0:input()}); assert.equal(s.wave,2); });
test('station preparation needs power, persists through retreat and drops the pallet once', () => { const s=G.create(7); G.addPlayer(s); s.mode='play'; s.spawnAcc=-1e9; const p=s.players[0]; p.invuln=999; const a=G.campaignAnchor(s,'radioPrepare'); Object.assign(p,{x:a.x,y:a.y+10}); G.step(s,.01,{0:input({interact:true})}); assert.equal(s.campaign.holding,null,'no power, no hold'); s.circuit.emergency=true; G.step(s,.01,{0:input({interact:true})}); assert.equal(s.campaign.holding,'prepare'); for(let i=0;i<100;i++)G.step(s,.1,{0:input()}); const progress=s.campaign.prepareProgress; assert.ok(progress>4,'progress '+progress); p.x=0;p.y=2800;G.step(s,.1,{}); assert.equal(s.campaign.prepareProgress,progress); Object.assign(p,{x:a.x,y:a.y+10}); for(let i=0;i<200;i++)G.step(s,.1,{0:input()}); assert.equal(s.campaign.prepared,true); const n=s.loot.filter(x=>x.rewardId==='radio-pallet').length; assert.equal(n,4); for(let i=0;i<30;i++)G.step(s,.1,{0:input({interact:true})}); assert.equal(s.loot.filter(x=>x.rewardId==='radio-pallet').length,4,'the pallet drops once'); });
test('boss starts only after the living party gathers', () => { const s=G.create(8); G.addPlayer(s); G.addPlayer(s,'pad'); s.mode='play'; const [a,b]=s.players;a.x=0;a.y=0;b.x=1000;b.y=1000;G.step(s,.01,{0:input({interact:true})});assert.equal(s.boss,null);b.x=0;b.y=0;G.step(s,.01,{0:input({interact:true})});assert.ok(s.boss&&s.boss.active); });
test('one, two and four player simulations stay bounded for three waves', () => { for (const n of [1,2,4]) { const s=G.create(10+n); for(let i=1;i<n;i++)G.addPlayer(s,'p'+i); G.addPlayer(s,'p0'); s.mode='play'; s.players.forEach(p=>p.invuln=999); for(let i=0;i<2800;i++)G.step(s,.05,{}); assert.ok(s.wave>=4); const cap=Math.round((75+s.players.filter(p=>!p.dead).length*20)*Math.min(2.5,1+s.time/900)); assert.ok(s.enemies.length<=cap,`${n}p: ${s.enemies.length} enemies over cap ${cap}`); assert.ok(s.loot.length<1000); } });

for (const line of tests) console.log(line);
if (tests.some(x => x.startsWith('FAIL'))) process.exitCode = 1;
