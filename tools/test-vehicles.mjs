import assert from 'node:assert/strict';
await import('../city.js');await import('../world.js');
await import('../boss.js');
await import('../game.js');
const G=globalThis.DSGame,W=globalThis.DSWorld;
function test(name,fn){fn();console.log('PASS '+name);}

test('vehicles preserve fixed geometry across seeds',()=>{
  // fixed geometry is compared before live vehicles exist; run state only adds the bulldozer on its selected pad
  assert.deepEqual(W.create(11).obstacles,W.create(29).obstacles);
  const a=G.create(11),b=G.create(29),fixed=q=>q.world.obstacles.filter(o=>o.vehicleType!=='bulldozer');
  assert.deepEqual(fixed(a),fixed(b));
  assert.ok(a.vehicles.length>=28&&a.vehicles.length<=40,a.vehicles.length);
  assert.equal(a.vehicles.length,b.vehicles.length);
  for(const v of a.vehicles){assert.equal(v.obstacle.burning,undefined);assert.ok(!a.world.lights.some(l=>l.o===v.obstacle));}
});
test('parked cars never overlap geometry or cache loot',()=>{
  const s=G.create(11);
  for(const v of s.vehicles){const a=v.obstacle;
    for(const b of s.world.obstacles)if(a!==b)assert.ok(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y),v.id);
  }
  for(const l of s.loot)assert.equal(W.blocked(s.world,l.x,l.y,0),null,l.id);
  // every authored sedan slot (evac car beside the spawn, market bays) holds its driveable car
  for(const slot of s.world.vehicleSlots.filter(v=>v.vehicleType==='sedan'))assert.ok(s.vehicles.some(v=>v.slotId===slot.id),slot.id);
  assert.ok(s.vehicles.some(v=>v.slotId==='evac-car'&&Math.hypot(v.x-124,v.y-2608)<5));
});
test('vehicle fuel is repeatable, seed dependent and separate from weapon fuel',()=>{
  const fuels=seed=>G.create(seed).vehicles.map(v=>v.fuel);
  assert.deepEqual(fuels(3),fuels(3));assert.notDeepEqual(fuels(3),fuels(9));
  assert.ok(fuels(3).some(f=>f===0));assert.ok(fuels(3).some(f=>f>0));assert.ok(G.create(3).vehicles.every(v=>{const d=G.VEHICLES[v.vehicleType];return v.fuel===0||v.fuel>=d.minFuel&&v.fuel<=d.maxFuel;}),'each tank is inside its own vehicle range');
  assert.equal(G.CAR.minFuel,Math.round(400*1.4));assert.equal(G.CAR.maxFuel,Math.round(2800*1.4));
  assert.equal(G.create(3).ammo.fuel,65);
});

// A clear avenue fixture isolates handling from the city and ambient wave spawns.
function setup(count=1){
  const s=G.create(11);s.mode='play';s.loot=[];s.enemies=[];s.spawnAcc=-10000;
  s.settings.drivingStyle='directional'; // Keep the original handling regression suite explicit.
  const v=s.vehicles[0];s.vehicles=[v];Object.assign(v,{x:0,y:1800,angle:-Math.PI/2,fuel:G.CAR.maxFuel});
  Object.assign(v.obstacle,{x:-24,y:1752,w:48,h:96});s.world.obstacles=[v.obstacle];
  for(let i=0;i<count;i++){G.addPlayer(s,'test-'+i);Object.assign(s.players[i],{x:40+i*2,y:1800,invuln:0});}
  return {s,v,p:s.players[0]};
}
function tick(s,seconds,inputs={}){for(let i=0;i<Math.round(seconds*60);i++)G.step(s,1/60,inputs);}
function board(f){assert.equal(G.enterVehicle(f.s,f.v,f.p),true);return f;}
test('enter/exit restores geometry, invalidates navigation and leaves the door clear',()=>{
  const {s,v,p}=setup(),o=v.obstacle;
  G.step(s,1/60,{0:{interact:true}});assert.equal(p.vehicle,v.id);assert.ok(!s.world.obstacles.includes(o));assert.equal(s.navVersion,1);assert.equal(v.parked,false);
  G.step(s,1/60,{0:{interact:true}});assert.equal(p.vehicle,null);assert.ok(v.obstacle&&s.world.obstacles.includes(v.obstacle));assert.equal(s.navVersion,2);assert.equal(v.parked,true);
  assert.equal(W.blocked(s.world,p.x,p.y,p.r),null);G.step(s,1/60,{0:{interact:true}});assert.equal(p.vehicle,null);
});
test('24 exit headings beside a building stay outside geometry',()=>{
  for(let i=0;i<24;i++){
    const {s,v,p}=board(setup());v.x=140;v.angle=i*Math.PI/12;
    s.world.obstacles=[{x:200,y:1500,w:300,h:600,type:'building'}];
    G.exitVehicle(s,p);assert.equal(W.blocked(s.world,p.x,p.y,p.r),null,'heading '+i);
    assert.equal(v.parked,v.obstacle!==null);
  }
});
test('nearby weapon keeps interaction priority over a car',()=>{
  const {s,v,p}=setup();const item={id:'test-gun',x:p.x+20,y:p.y,type:'weapon',weapon:'ar'};s.loot=[item];
  G.step(s,1/60,{0:{interact:true}});assert.equal(p.weapon,'ar');assert.equal(p.vehicle,null);assert.equal(v.parked,true);
});
test('four seconds driving beats sprinting by >1.4x including acceleration',()=>{
  const car=board(setup()),foot=setup();foot.s.world.obstacles=[];foot.s.vehicles=[];foot.p.x=0;
  const cy=car.v.y,fy=foot.p.y;tick(car.s,4,{0:{y:-1}});tick(foot.s,4,{0:{y:-1,run:true}});
  const driven=cy-car.v.y,walked=fy-foot.p.y;assert.ok(driven>walked*1.4,`${driven} / ${walked}`);assert.ok(car.v.speed<=300);
});
test('fuel drains by actual distance and never touches flamethrower ammo',()=>{
  for(const dt of [1/60,1/30]){const {s,v}=board(setup());let distance=0;
    for(let i=0;i<5/dt;i++){const x=v.x,y=v.y;G.step(s,dt,{0:{y:-1}});distance+=Math.hypot(v.x-x,v.y-y);}
    assert.ok(Math.abs(v.maxFuel-v.fuel-distance)<1e-7);assert.equal(s.ammo.fuel,65);
  }
  const {s,v,p}=board(setup());v.fuel=3;tick(s,5,{0:{y:-1}});
  assert.equal(v.fuel,0);assert.equal(v.speed,0);assert.equal(p.vehicle,null);assert.equal(v.parked,true);assert.equal(G.enterVehicle(s,v,p),false);
});
test('full throttle into a wall never crosses either end probe',()=>{
  const {s,v}=board(setup());s.world.obstacles=[{x:-300,y:1350,w:600,h:40,type:'building'}];
  for(let i=0;i<180;i++){G.step(s,1/60,{0:{y:-1}});assert.equal(G.carBlocked(s,v),null);}
  assert.ok(v.speed<40);assert.ok(v.integrity<100);
});
test('passengers stay seated, shoot and reload; drivers cannot shoot; driver promotes',()=>{
  const f=board(setup(2)),{s,v,p}=f,q=s.players[1];assert.equal(G.enterVehicle(s,v,q),true);
  for(const rider of [p,q])Object.assign(rider,{weapon:'ar',backup:false,mag:1,auto:true});
  G.spawn(s,'brute',0,1660,{hp:10000,speed:0});const ammo=s.ammo.bullets;
  tick(s,3);assert.ok(s.ammo.bullets<ammo);assert.equal(p.mag,1);assert.ok(Math.hypot(q.x-v.x,q.y-v.y)<40);
  G.exitVehicle(s,p);assert.equal(v.driver,q.id);assert.equal(q.vehicle,v.id);assert.equal(v.obstacle,null);
});
test('squad tether reduces acceleration away from a distant walking teammate',()=>{
  const a=board(setup(2)),b=board(setup());a.s.players[1].y=a.v.y+1000;
  tick(a.s,1,{0:{y:-1}});tick(b.s,1,{0:{y:-1}});assert.ok(a.v.speed<b.v.speed*.3);assert.equal(a.v.tether,true);
});

test('roadkill grants kills and XP drops while damaging the chassis',()=>{
  const {s,v}=board(setup());
  for(let i=0;i<6;i++)G.spawn(s,'walker',0,1500-i*100,{speed:0});
  tick(s,4,{0:{y:-1}});
  assert.equal(s.kills,6);assert.ok(v.integrity<85&&v.integrity>0);
  assert.ok(s.xp+s.loot.filter(l=>l.type==='xp').reduce((n,l)=>n+l.amount,0)>=12);
  assert.equal(s.decals.length,6);
});

test('rotated roadkill hits each body once per step, knocks back and ignores ghosts',()=>{
  const {s,v}=board(setup());v.angle=Math.PI/4;v.speed=300;
  const target=G.spawn(s,'brute',v.x+20,v.y+20,{hp:1000,speed:0});
  const ghost=G.spawn(s,'ghost',v.x,v.y,{speed:0});
  const miss=G.spawn(s,'walker',v.x+60,v.y-60,{speed:0});
  G.vehicleTick(s,v,{x:1,y:1},.05); // Three motion samples, only one hit.
  assert.equal(target.hp,860);assert.ok(target.x>v.x+40&&target.y>v.y+40);
  assert.equal(ghost.hp,ghost.maxHp);assert.equal(miss.hp,miss.maxHp);
  assert.equal(v.integrity,82.5);
});

test('damage reduces driving distance and breakdown permanently ejects the whole squad',()=>{
  const a=board(setup()),b=board(setup());b.v.integrity=12;
  tick(a.s,3,{0:{y:-1}});tick(b.s,3,{0:{y:-1}});
  const ratio=(1800-a.v.y)/(1800-b.v.y);assert.ok(ratio>1.6&&ratio<2.6,ratio);
  const {s,v,p}=board(setup(4));for(const q of s.players.slice(1))assert.ok(G.enterVehicle(s,v,q));
  v.integrity=0;tick(s,1/60);
  assert.equal(v.dead,true);assert.equal(v.parked,true);assert.equal(v.driver,null);assert.deepEqual(v.riders,[]);
  for(const q of s.players){assert.equal(q.vehicle,null);assert.equal(W.blocked(s.world,q.x,q.y,q.r),null);}
  tick(s,1);assert.equal(G.enterVehicle(s,v,p),false);
});

test('stalled-car contact damages the hull first; ghosts phase through and moving riders are safe',()=>{
  const {s,v,p}=board(setup(2));G.enterVehicle(s,v,s.players[1]);
  G.spawn(s,'ghost',v.x,v.y,{speed:0});tick(s,.1);
  assert.equal(v.integrity,100);assert.equal(p.hp,100);
  s.enemies=[];const e=G.spawn(s,'walker',v.x+30,v.y,{speed:0});
  tick(s,1/60);assert.equal(v.integrity,91);assert.equal(p.hp,100);
  assert.equal(s.players[1].hp,100); // One claw cannot hit the hull once per seat.
  v.integrity=1;e.hitCd=0;tick(s,1/60);assert.ok(v.dead);assert.equal(p.vehicle,null);
  Object.assign(e,{x:p.x,y:p.y,hitCd:0});tick(s,1/60);assert.ok(p.hp<100);
  const fast=board(setup());fast.v.speed=200;
  G.spawn(fast.s,'ghost',fast.p.x,fast.p.y,{speed:0});tick(fast.s,1/60);assert.equal(fast.p.hp,100);
});

test('engine pulses attract infected, scale with speed and stop when parked or dry',()=>{
  const {s,v,p}=board(setup());
  const e=G.spawn(s,'walker',v.x+400,v.y,{speed:0});v.speed=300;
  tick(s,1,{0:{y:-1}});
  const noises=s.noise.filter(n=>n.kind==='engine');assert.equal(noises.length,3);
  assert.ok(noises.every(n=>n.r>G.NOISE.run));assert.ok(e.heardNoise>0);
  assert.ok(s.audioEvents.some(e=>e.type==='engine'));
  G.exitVehicle(s,p);s.noise=[];tick(s,1);assert.ok(!s.noise.some(n=>n.kind==='engine'));
  const dry=board(setup());dry.v.fuel=0;tick(dry.s,.1);assert.ok(!dry.s.noise.some(n=>n.kind==='engine'));
});

test('plaza interaction ejects all riders into the boss arena and locks vehicle entry',()=>{
  const {s,v,p}=board(setup(4));for(const q of s.players.slice(1))assert.ok(G.enterVehicle(s,v,q));
  v.x=0;v.y=100;G.vehicleTick(s,v,{},0);
  G.step(s,1/60,{0:{interact:true}});
  assert.ok(s.boss?.active);assert.equal(v.driver,null);assert.deepEqual(v.riders,[]);
  for(const q of s.players){assert.equal(q.vehicle,null);assert.ok(Math.hypot(q.x,q.y)<350);assert.equal(W.blocked(s.world,q.x,q.y,q.r),null);}
  tick(s,1);p.exitCd=0;assert.equal(G.nearestVehicle(s,p),null);assert.equal(G.enterVehicle(s,v,p),false);
});

test('solo boss entry never places the survivor inside the car just parked by interact',()=>{
  const {s,v,p}=board(setup());v.x=92;v.y=0;G.vehicleTick(s,v,{},0);
  G.step(s,1/60,{0:{interact:true}});
  assert.ok(s.boss?.active);assert.equal(p.vehicle,null);assert.equal(W.blocked(s.world,p.x,p.y,p.r),null);
  assert.equal(v.parked,v.obstacle!==null);
});

test('car-relative driving is the default, accelerates along the hood and never pivots at rest',()=>{
  assert.equal(G.create(11).settings.drivingStyle,'steering');
  const {s,v}=board(setup());s.settings.drivingStyle='steering';v.angle=0;
  tick(s,1,{0:{x:1}});assert.equal(v.angle,0);assert.equal(v.speed,0);
  tick(s,1,{0:{y:-1}});assert.ok(v.x>90);assert.equal(v.y,1800);assert.equal(v.angle,0);
  tick(s,.5,{0:{x:1,y:-1}});assert.ok(v.angle>0&&v.y>1800);
});

test('car-relative brakes through zero before reversing and reverses steering with travel',()=>{
  const {s,v}=board(setup());s.settings.drivingStyle='steering';v.angle=0;v.speed=170;
  tick(s,.5,{0:{y:1}});assert.ok(Math.abs(v.speed)<1e-6);const stopped=v.x;
  tick(s,1,{0:{y:1}});assert.ok(v.speed<0&&v.speed>=-G.CAR.topSpeed*G.CAR.reverse);assert.ok(v.x<stopped);
  tick(s,.25,{0:{x:1,y:1}});assert.ok(v.angle<0,'right steering while reversing turns the nose left');
  s.settings.drivingStyle='directional';const reverse=v.speed;G.step(s,1/60,{0:{x:1}});
  assert.ok(v.speed<0&&v.speed>reverse,'changing styles brakes the existing reverse velocity');
  tick(s,1,{0:{x:1}});assert.ok(v.speed>=0);
});

test('reverse fuel, collision, roadkill, noise and passenger entry use travel speed',()=>{
  const {s,v}=board(setup(2));s.settings.drivingStyle='steering';v.speed=-130;
  assert.equal(G.enterVehicle(s,v,s.players[1]),false,'cannot board fast reverse');
  const e=G.spawn(s,'walker',0,v.y+60,{speed:0});const start=v.y,fuel=v.fuel;
  G.step(s,1/60,{0:{y:1}});assert.ok(e.dead);assert.ok(e.y>v.y+60,'knockback follows reverse travel');
  assert.ok(Math.abs(fuel-v.fuel-(v.y-start))<1e-7);
  assert.ok(s.noise.find(n=>n.kind==='engine').r>G.NOISE.engine*.7);
  s.players[1].dead=true;s.world.obstacles=[{x:-300,y:1950,w:600,h:40,type:'building'}];
  for(let i=0;i<180;i++){G.step(s,1/60,{0:{y:1}});assert.equal(G.carBlocked(s,v),null);}
  assert.ok(Math.abs(v.speed)<40);assert.ok(v.integrity<90);
  const dry=board(setup());dry.s.settings.drivingStyle='steering';dry.v.speed=-100;dry.v.fuel=0;
  tick(dry.s,5,{0:{y:1}});assert.equal(dry.v.speed,0);assert.equal(dry.p.vehicle,null);assert.ok(dry.v.parked);
});

// ---- CITY.md Phase 10: service vehicles, refuelling and route clearing ----
test('one bulldozer per run on a fixed pad (all four occur), one fire truck in its bay, fuel from run state',()=>{
  const pads=new Set(),truckFuel=new Set(),byPad={};
  for(let seed=1;seed<=40;seed++){const s=G.create(seed),dozers=s.vehicles.filter(v=>v.vehicleType==='bulldozer'),trucks=s.vehicles.filter(v=>v.vehicleType==='fireTruck');
    assert.equal(dozers.length,1);assert.equal(trucks.length,1);pads.add(s.activePad);truckFuel.add(Math.round(trucks[0].fuel));
    const pad=s.world.vehicleSlots.find(q=>q.id===s.activePad),o=dozers[0].obstacle;assert.ok(o.x>=pad.rect.x&&o.y>=pad.rect.y&&o.x+o.w<=pad.rect.x+pad.rect.w&&o.y+o.h<=pad.rect.y+pad.rect.h,'dozer on its pad');
    const slot=s.world.vehicleSlots.find(q=>q.vehicleType==='fireTruck'),t=trucks[0].obstacle;assert.deepEqual([t.x,t.y,t.w,t.h],[slot.rect.x,slot.rect.y,slot.rect.w,slot.rect.h]);assert.ok(trucks[0].fuel>0);
    // within one spawn variant the live obstacles are identical
    if(byPad[s.activePad])assert.deepEqual(s.world.obstacles,byPad[s.activePad].world.obstacles);else byPad[s.activePad]=s;}
  assert.equal(pads.size,4,'every pad is used across the sample');assert.ok(truckFuel.size>20,'truck fuel varies by run');
  const d=G.VEHICLES.bulldozer;
  assert.ok(d.minFuel/d.burn>=3600,'even the lowest starting tank lasts at least nine 400-unit blocks');
});

// an isolated test yard: one vehicle of the type on an empty avenue, up to four survivors beside it
function yard(type,style='steering',count=4){
  const s=G.create(12);s.mode='play';s.loot=[];s.enemies=[];s.spawnAcc=-1e9;s.settings.drivingStyle=style;
  const v=s.vehicles.find(q=>q.vehicleType===type),d=G.VEHICLES[type];s.vehicles=[v];
  s.world.obstacles=[v.obstacle];Object.assign(v,{x:0,y:1800,angle:-Math.PI/2,fuel:d.maxFuel,speed:0});Object.assign(v.obstacle,{x:-d.wid/2,y:1800-d.len/2,w:d.wid,h:d.len});
  for(let i=0;i<count;i++){G.addPlayer(s,'yard-'+i);Object.assign(s.players[i],{x:d.wid/2+14,y:1800-20+i*14,invuln:1e9});}
  return {s,v,d};
}
for(const type of ['fireTruck','bulldozer'])for(const style of ['steering','directional'])test(`${type} (${style}): seats, promotion, driving, depletion, damage, tether and boss lockout`,()=>{
  const {s,v,d}=yard(type,style),p3=s.players[3];
  for(const p of s.players)G.enterVehicle(s,v,p);
  assert.equal(1+v.riders.length,Math.min(4,d.seats.length),'fills its seats');
  if(d.seats.length<4)assert.equal(p3.vehicle,null,'a full vehicle refuses more riders');
  const y0=v.y;for(let i=0;i<60;i++)G.step(s,1/60,{[v.driver]:{y:-1,x:0}});assert.ok(v.y<y0-10,'drives forward');
  assert.ok(Math.abs(v.speed)<=d.topSpeed+1);if(type==='fireTruck')assert.ok(d.topSpeed<G.VEHICLES.sedan.topSpeed&&d.turn<G.VEHICLES.sedan.turn,'heavier than a sedan');
  const rider=v.riders[0];G.exitVehicle(s,s.players[v.driver]);assert.equal(v.driver,rider,'the next rider takes the wheel');
  if(type==='bulldozer'&&style==='steering'){v.speed=0;const a0=v.angle;G.step(s,.5,{[v.driver]:{x:1,y:0}});assert.notEqual(v.angle,a0,'tracks pivot at rest');}
  const idle=v.fuel;if(d.idleBurn){G.step(s,.5,{});assert.ok(v.fuel<idle,'a running bulldozer burns fuel');}
  v.integrity=0;v.speed=0;G.step(s,1/60,{});assert.equal(v.dead,true);assert.equal(v.driver,null);assert.ok(s.players.every(p=>p.vehicle==null),'a wreck ejects everyone');
  const f=yard(type,style,1);G.enterVehicle(f.s,f.v,f.s.players[0]);f.v.fuel=10;for(let i=0;i<300&&f.v.driver!=null;i++)G.step(f.s,1/60,{0:{y:-1}});
  assert.equal(f.v.driver,null,'an empty tank stops and parks');assert.ok(f.v.obstacle&&f.s.world.obstacles.includes(f.v.obstacle));
  const t=yard(type,style,2);G.enterVehicle(t.s,t.v,t.s.players[0]);t.s.players[1].y=t.v.y+2000;G.step(t.s,1/60,{0:{y:-1}});assert.equal(t.v.tether,true,'the squad tether holds service vehicles too');
  const b=yard(type,style,1);b.s.boss={active:true};assert.equal(G.nearestVehicle(b.s,b.s.players[0]),null,'no boarding during the fight');
});

test('safe dismount at every heading beside a wall and a parked car',()=>{
  for(const type of ['sedan','fireTruck','bulldozer'])for(let k=0;k<8;k++){
    const {s,v,d}=yard(type,'steering',1),p=s.players[0],ang=k*Math.PI/4;
    G.enterVehicle(s,v,p);Object.assign(v,{x:0,y:1800,angle:ang});
    const c=Math.cos(ang),n=Math.sin(ang),side=d.wid/2+40;
    s.world.obstacles.push({x:-n*side-50,y:1800+c*side-50,w:100,h:100,type:'wall',protected:true});
    s.world.obstacles.push({x:n*side-48,y:1800-c*side-24,w:96,h:48,type:'car',kind:'car',hp:200,maxHp:200});
    G.exitVehicle(s,p,false);
    assert.equal(W.blocked(s.world,p.x,p.y,p.r),null,`${type} heading ${k}: dismount point is clear`);
    const along=(p.x-v.x)*c+(p.y-v.y)*n,across=-(p.x-v.x)*n+(p.y-v.y)*c;
    assert.ok(Math.abs(along)>=d.len/2+p.r-1||Math.abs(across)>=d.wid/2+p.r-1,`${type} heading ${k}: outside the hull`);
  }
});

test('refuelling: one press pours one can, interruptions and full tanks lose nothing, 30 L stay reserved until the generator runs',()=>{
  const s=G.create(14);s.mode='play';s.spawnAcc=-1e9;s.enemies=[];G.addPlayer(s);const p=s.players[0];p.invuln=1e9;
  const v=s.vehicles.find(q=>q.slotId==='evac-car'),L=G.FUEL.distancePerLitre,incendiary=s.ammo.fuel;
  v.fuel=0;s.supplies.vehicleFuel=60;Object.assign(p,{x:v.obstacle.x+v.obstacle.w+16,y:v.y});
  G.step(s,1/60,{0:{interact:true}});assert.ok(p.refuel,'one press starts a pour');assert.equal(p.vehicle,null,'and does not board');
  G.step(s,1/60,{0:{interact:true}});assert.equal(s.supplies.vehicleFuel,60,'a second press does not start another');
  for(let i=0;i<100;i++)G.step(s,1/60,{});assert.equal(s.supplies.vehicleFuel,40);assert.equal(Math.round(v.fuel/L),20);assert.equal(s.ammo.fuel,incendiary);
  G.step(s,1/60,{0:{interact:true}});for(let i=0;i<100;i++)G.step(s,1/60,{});assert.equal(s.supplies.vehicleFuel,30,'only fuel above the reserve pours');assert.equal(Math.round(v.fuel/L),30);
  v.fuel=0;G.step(s,1/60,{0:{interact:true}});for(let i=0;i<100;i++)G.step(s,1/60,{});assert.equal(s.supplies.vehicleFuel,30,'the reserve is untouched');assert.equal(v.fuel,0);
  // interruption: walking away mid-pour moves nothing
  s.supplies.generatorFuelled=true;s.supplies.vehicleFuel=40;G.step(s,1/60,{0:{interact:true}});assert.ok(p.refuel);for(let i=0;i<30;i++)G.step(s,1/60,{});
  p.x+=300;G.step(s,1/60,{});assert.equal(p.refuel,null);assert.equal(s.supplies.vehicleFuel,40);assert.equal(v.fuel,0);
  // a full tank is never a pour target
  p.x-=300;v.fuel=v.maxFuel;assert.equal(G.refuelTarget(s,p),null);
});

test('the chapel generator takes 30 L once and switches the emergency circuit on',()=>{
  const s=G.create(15);s.mode='play';s.spawnAcc=-1e9;s.enemies=[];G.addPlayer(s);const p=s.players[0];p.invuln=1e9;
  const gen=G.generatorAnchor(s);Object.assign(p,{x:gen.x,y:gen.y+20});
  s.supplies.vehicleFuel=20;G.step(s,1/60,{0:{interact:true}});assert.equal(p.refuel,null,'not enough fuel');assert.equal(s.circuit.emergency,false);
  s.supplies.vehicleFuel=50;G.step(s,1/60,{0:{interact:true}});assert.ok(p.refuel);for(let i=0;i<200;i++)G.step(s,1/60,{});
  assert.equal(s.circuit.emergency,true);assert.equal(s.supplies.generatorFuelled,true);assert.equal(s.supplies.vehicleFuel,20);
  G.step(s,1/60,{0:{interact:true}});for(let i=0;i<200;i++)G.step(s,1/60,{});assert.equal(s.supplies.vehicleFuel,20,'fuelled once');
  assert.equal(G.pourable(s),20,'with the generator running nothing is reserved');
});

test('only a bulldozer blade clears authored debris; ramming and gunfire respect protected obstacles',()=>{
  const pile=(s)=>{const o={x:-40,y:1600,w:80,h:70,type:'debris',debris:'optional-clear',debrisId:'test/pile',art:'props/rubbleChunk'};s.world.obstacles.push(o);return o;};
  const car=yard('sedan','steering',1);const cp=pile(car.s);G.enterVehicle(car.s,car.v,car.s.players[0]);car.v.y=1760;
  for(let i=0;i<120;i++)G.step(car.s,1/60,{0:{y:-1}});assert.ok(car.s.world.obstacles.includes(cp),'sedans cannot clear debris');
  const dz=yard('bulldozer','steering',1);const dp=pile(dz.s);G.enterVehicle(dz.s,dz.v,dz.s.players[0]);dz.v.y=1740;const nav=dz.s.navVersion;
  let strained=false;for(let i=0;i<60*8&&dz.s.world.obstacles.includes(dp);i++){G.step(dz.s,1/60,{0:{y:-1}});strained=strained||dz.s.noise.some(n=>n.kind==='strain');}
  assert.ok(strained,'clearing makes noise');assert.ok(!dz.s.world.obstacles.includes(dp),'the blade clears the pile');
  assert.equal(dz.s.navVersion,nav+1,'nav rebuilds once');assert.equal(dz.s.debrisState['test/pile'].cleared,true);
  assert.ok(dz.s.world.props.some(q=>q.debrisId==='test/pile'&&q.art==='props/debrisCleared'));assert.ok(dz.s.noise.some(n=>n.kind==='clear'));
  const fz=yard('bulldozer','steering',1),fence={x:-80,y:1700,w:160,h:8,type:'fence',protected:true};
  fz.s.world.obstacles.push(fence);G.enterVehicle(fz.s,fz.v,fz.s.players[0]);fz.v.y=1780;for(let i=0;i<180;i++)G.step(fz.s,1/60,{0:{y:-1}});
  assert.ok(fz.s.world.obstacles.includes(fence),'protected fences survive the blade');
  const bar={x:200,y:1700,w:48,h:24,type:'barrier',hp:240,maxHp:240,protected:true},shooter=yard('sedan','steering',1),sp=shooter.s.players[0];
  shooter.s.world.obstacles.push(bar);Object.assign(sp,{x:224,y:1740});G.step(shooter.s,1/60,{0:{y:-1}});
  assert.equal(sp.wallTarget,null,'protected barricades are not shot open');assert.equal(bar.hp,240);
});

test('a bulldozer crushes parked vehicles and ordinary obstacles but never walls',()=>{
  const {s,v}=yard('bulldozer','steering',1),p=s.players[0];
  const parked=G.create(13).vehicles.find(q=>q.vehicleType==='sedan'&&q.fuel>0),car=parked.obstacle;
  Object.assign(parked,{x:0,y:1624,angle:0,speed:0});Object.assign(car,{x:-48,y:1600,w:96,h:48,hp:200,maxHp:200});
  const rubble={x:-42,y:1460,w:84,h:55,type:'rubble',hp:120,maxHp:120};
  const wall={x:-100,y:1320,w:200,h:35,type:'wall',hp:100,maxHp:100};
  s.vehicles.unshift(parked);s.world.obstacles.push(car,rubble,wall);G.enterVehicle(s,v,p);
  for(let i=0;i<60*12;i++)G.step(s,1/60,{0:{y:-1}});
  assert.ok(!s.world.obstacles.includes(car),'the parked vehicle is crushed');assert.equal(parked.removed,true,'its live vehicle is retired');
  assert.ok(!s.world.obstacles.includes(rubble),'ordinary street rubble is crushed');
  assert.ok(s.world.obstacles.includes(wall),'the wall remains solid');assert.equal(wall.hp,100,'the blade does not damage walls');
});
