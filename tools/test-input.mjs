// city_v2 Section 0 input contract: contextual analog triggers, separate heal / ration actions, player-owned
// feedback and one binding-label source. Simulation only; tools/test-controls.mjs drives the same paths in a browser.
import assert from 'node:assert/strict';
await import('../city.js');await import('../world.js');await import('../boss.js');await import('../game.js');
const G=globalThis.DSGame;
const results=[];let failed=0;
function test(name,fn){try{fn();results.push('PASS '+name);}catch(e){failed++;results.push('FAIL '+name+': '+e.message);}}
const pad=(extra={})=>({x:0,y:0,pedals:true,rt:0,lt:0,...extra});
// an open stretch of avenue with one sedan, a keyboard driver and a pad passenger
function yard(style='steering'){
  const s=G.create(11);G.addPlayer(s,'pad:0');G.addPlayer(s,'pad:1');s.mode='play';s.settings.drivingStyle=style;
  const v=s.vehicles.find(q=>q.vehicleType==='sedan');s.vehicles=[v];s.world.obstacles=[v.obstacle]; // an empty lot: nothing to crash into
  s.spawnAcc=-1e9;s.enemies=[];s.loot=[];Object.assign(v,{fuel:v.maxFuel});
  const [a,b]=s.players;for(const p of s.players){p.x=v.x+40;p.y=v.y;p.invuln=1e9;}
  assert.ok(G.enterVehicle(s,v,a),'driver boards');assert.ok(G.enterVehicle(s,v,b),'passenger boards');
  v.x=0;v.y=1400;v.angle=0;v.speed=0;
  const run=(secs,inputs)=>{for(let t=0;t<secs;t+=1/60)G.step(s,1/60,inputs);};
  return {s,v,a,b,run};
}

test('stick motion alone never accelerates a controller-driven vehicle, in either driving style',()=>{
  for(const style of ['steering','directional']){const {v,run}=yard(style);run(.2,{0:pad()});run(1,{0:pad({x:1,y:-1})});assert.ok(Math.abs(v.speed)<1,style+' speed '+v.speed);}
});
test('RT is analog gas: a half trigger accelerates, and more trigger accelerates harder',()=>{
  const half=yard(),full=yard();half.run(.2,{0:pad()});full.run(.2,{0:pad()});
  half.run(.5,{0:pad({rt:.5})});full.run(.5,{0:pad({rt:1})});
  assert.ok(half.v.speed>5,'half trigger moves '+half.v.speed);assert.ok(full.v.speed>half.v.speed*1.5,'full '+full.v.speed+' vs half '+half.v.speed);
  const dead=yard();dead.run(.2,{0:pad()});dead.run(.5,{0:pad({rt:G.TRIGGER_DEAD_ZONE*.8})});assert.equal(dead.v.speed,0,'inside the dead zone');
});
test('LT brakes forward motion to rest, then reverses from rest; RT brakes reverse before going forward',()=>{
  const {v,run}=yard();run(.2,{0:pad()});run(1.2,{0:pad({rt:1})});const fast=v.speed;assert.ok(fast>100);
  let rested=false,minSeen=Infinity;
  const trace=[];for(let i=0;i<240;i++){const before=v.speed;run(1/60,{0:pad({lt:1})});trace.push(v.speed);if(before>0&&v.speed===0)rested=true;minSeen=Math.min(minSeen,v.speed);}
  assert.ok(rested,'forward motion reaches rest under LT');assert.ok(minSeen<-20,'continued LT reverses: '+minSeen);
  for(let i=1;i<trace.length;i++)if(trace[i-1]>0)assert.ok(trace[i]>=0,'LT never jumps from forward straight into reverse');
  const back=v.speed;run(.25,{0:pad({rt:1})});assert.ok(v.speed>back&&v.speed<=0||v.speed>=0,'RT first brakes the reverse');
  let crossed=false;const tr=[];for(let i=0;i<240;i++){run(1/60,{0:pad({rt:1})});tr.push(v.speed);}for(let i=1;i<tr.length;i++){if(tr[i-1]<0&&tr[i]>0)crossed=true;}
  assert.ok(!crossed,'RT never jumps from reverse straight to forward in one tick');assert.ok(v.speed>20,'then drives forward: '+v.speed);
});
test('both triggers brake to rest and never accelerate or reverse; releasing both coasts',()=>{
  const {v,run}=yard();run(.2,{0:pad()});run(1,{0:pad({rt:1})});run(3,{0:pad({rt:1,lt:1})});assert.equal(v.speed,0,'held both: rest');
  run(1,{0:pad({rt:1,lt:1})});assert.equal(v.speed,0,'still at rest');
  run(1,{0:pad({rt:1})});run(.2,{0:pad()});const coast=v.speed;run(.2,{0:pad()});assert.ok(v.speed>0&&v.speed<coast,'coasting with drag, not braking hard');
});
test('brakes still work with an empty tank; gas does not',()=>{
  const {v,run}=yard();run(.2,{0:pad()});run(1,{0:pad({rt:1})});v.fuel=0;const moving=v.speed;
  run(.1,{0:pad({lt:1})});assert.ok(v.speed<moving-20,'LT brakes an empty vehicle');
  v.speed=0;run(.5,{0:pad({rt:1})});assert.equal(v.speed,0,'no fuel, no gas');
});
test('only the driver drives; a passenger trigger neither drives nor consumes supplies',()=>{
  const {s,v,a,b,run}=yard();run(.2,{0:pad(),1:pad()});b.hp=40;b.medkits=2;s.supplies.provisions=2;
  run(1,{1:pad({rt:1,lt:.6,x:1})});assert.equal(v.speed,0,'passenger triggers do nothing to the car');assert.equal(b.medkits,2);assert.equal(s.supplies.provisions,2);
  run(1/60,{1:pad({heal:true})});assert.equal(b.medkits,1,'passenger heals with their own button');assert.equal(b.hp,90);
  a.hp=50;a.medkits=1;run(1/60,{0:pad({heal:true,rt:1})});assert.equal(a.hp,100,'driver heals with the dedicated button while driving');
  run(1/60,{0:pad({eat:true})});assert.equal(s.supplies.provisions,1,'driver eats with the dedicated button');
  assert.ok(!a.running&&!b.running,'no sprint while seated');
});
test('held triggers must return to neutral after boarding, leaving and menus',()=>{
  const s=G.create(11);G.addPlayer(s,'pad:0');s.mode='play';s.spawnAcc=-1e9;s.enemies=[];s.loot=[];
  const v=s.vehicles.find(q=>q.vehicleType==='sedan'),p=s.players[0];s.vehicles=[v];s.world.obstacles=[v.obstacle];v.fuel=v.maxFuel;p.x=v.x+40;p.y=v.y;p.invuln=1e9;
  assert.equal(G.conditionInput(p,pad({rt:1})).run,undefined,'a trigger already held when play starts waits for neutral');
  G.conditionInput(p,pad());assert.equal(G.conditionInput(p,pad({rt:1})).run,true,'RT runs on foot');
  assert.ok(G.enterVehicle(s,v,p));v.x=0;v.y=1400;v.angle=0;v.speed=0;
  for(let i=0;i<60;i++)G.step(s,1/60,{0:pad({rt:1})});assert.equal(v.speed,0,'RT held through boarding does not accelerate');
  G.step(s,1/60,{0:pad()});for(let i=0;i<30;i++)G.step(s,1/60,{0:pad({rt:1})});assert.ok(v.speed>10,'after a release RT drives');
  // a menu re-arms: the held trigger coasts instead of accelerating
  G.rearmTriggers(s);const before=v.speed;for(let i=0;i<30;i++)G.step(s,1/60,{0:pad({rt:1})});assert.ok(v.speed<before,'held RT after a menu coasts: '+before+' -> '+v.speed);
  v.speed=0;G.step(s,1/60,{0:pad({interact:true,rt:1})});assert.equal(p.vehicle,null,'A leaves');
  const i=G.conditionInput(p,pad({rt:1}));assert.equal(i.run,undefined,'RT held while leaving does not sprint');
  G.conditionInput(p,pad());assert.equal(G.conditionInput(p,pad({rt:1})).run,true,'after release RT runs again');
  // digital 0/1 triggers work too
  assert.equal(G.conditionInput(p,pad({rt:1})).rt,1);
});
test('heal never falls back to eating; refusals explain themselves and consume nothing; feedback is rate-limited',()=>{
  const s=G.create(3);G.addPlayer(s,'keyboard');G.addPlayer(s,'pad:0');s.mode='play';s.spawnAcc=-1e9;s.enemies=[];
  const [k,c]=s.players;s.supplies.provisions=3;k.medkits=1;
  G.step(s,1/60,{0:{heal:true}});assert.equal(k.notice.text,'Health full');assert.equal(k.medkits,1);assert.equal(s.supplies.provisions,3,'no fallback ration');
  k.medkits=0;k.hp=30;s.elapsed+=2;G.step(s,1/60,{0:{heal:true}});assert.equal(k.notice.text,'No medkits');assert.equal(s.supplies.provisions,3);
  const at=k.noticeAt;G.step(s,1/60,{0:{heal:true}});assert.equal(k.noticeAt,at,'repeated refusal is rate-limited');
  k.medkits=1;G.step(s,1/60,{0:{heal:true}});assert.equal(k.hp,80);assert.equal(k.medkits,0);assert.match(k.notice.text,/^\+50 HP · 0 medkits left/);
  G.step(s,1/60,{0:{eat:true}});assert.equal(s.supplies.provisions,2);assert.equal(k.hp,80,'eating never heals');assert.match(k.notice.text,/2 rations left/);
  s.supplies.provisions=0;G.step(s,1/60,{1:{eat:true}});assert.equal(c.notice.text,'No squad rations');
  c.dead=true;c.notice=null;G.step(s,1/60,{1:{heal:true,eat:true}});assert.equal(c.notice,null,'a downed survivor presses nothing');
});
test('first damage with a kit gives one device-correct heal hint; first pickup explains kits once',()=>{
  const s=G.create(3);G.addPlayer(s,'keyboard');G.addPlayer(s,'pad:0');s.mode='play';const [k,c]=s.players;c.device='playstation';
  k.invuln=0;G.hurt(s,k,5);assert.equal(k.notice.text,'P1 · H: heal 50 HP');
  c.invuln=0;G.hurt(s,c,5);assert.equal(c.notice.text,'P2 · ○: heal 50 HP');
  c.notice=null;c.invuln=0;G.hurt(s,c,5);assert.equal(c.notice,null,'the hint appears once');
  const x=G.create(4);G.addPlayer(x,'pad:1');x.mode='play';const p=x.players[0];
  G.collect(x,p,{id:'m1',x:p.x,y:p.y,type:'medkit',amount:1});assert.match(p.notice.text,/B heals 50 HP/);p.notice=null;
  G.collect(x,p,{id:'m2',x:p.x,y:p.y,type:'medkit',amount:1});assert.equal(p.notice,null,'explained once');assert.equal(p.medkits,3);
});
test('one binding table labels every action for keyboard, Xbox/unknown and PlayStation',()=>{
  for(const action of ['run','gas','brake','interact','heal','eat','fire','cycle','map','pause'])
    for(const dev of ['keyboard','xbox','playstation'])assert.ok(G.BINDINGS[dev][action],dev+' '+action);
  assert.equal(G.label({source:'keyboard'},'eat'),'R');assert.equal(G.label({source:'pad:2'},'heal'),'B');assert.equal(G.label({source:'pad:2',device:'playstation'},'eat'),'R1');
});
test('upgrades are never spent by live input',()=>{
  const s=G.create(5);G.addPlayer(s,'pad:0');s.mode='play';const p=s.players[0];p.upgrades=2;
  G.step(s,1/60,{0:{upgrade:0,heal:true,eat:true,interact:true}});assert.equal(p.upgrades,2);
  assert.equal(G.upgrade(s,p,1),true);assert.equal(p.upgrades,1);
});
console.log(results.join('\n'));
if(failed){console.log(failed+' input tests failed');process.exitCode=1;}else console.log('input tests passed');
