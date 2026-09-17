import assert from 'node:assert/strict';
await import('../city.js');await import('../world.js');await import('../boss.js');await import('../game.js');await import('../hud.js');
const G=globalThis.DSGame,W=globalThis.DSWorld,H=globalThis.DSHud;
function setup(seed=123){const s=G.create(seed);G.addPlayer(s);s.mode='play';s.players[0].invuln=999;s.loot=[];return s;}
function tick(s,seconds,input={}){for(let t=0;t<seconds-1e-7;t+=.05){s.spawnAcc=-100;G.step(s,.05,{0:input});}}

// Quiet motion, finite hearing radius, and memory of the sound rather than the player.
{
  const s=setup(),p=s.players[0],e=G.spawn(s,'walker',0,2660),far=G.spawn(s,'walker',0,2400);
  assert.equal(p.auto,false);tick(s,.3,{x:1});assert.equal(s.noise.length,0);assert.equal(e.alert,false);
  const origin={x:p.x,y:p.y};G.makeNoise(s,p,'run');tick(s,.05);
  assert.equal(e.state,'investigate');assert.deepEqual(e.target,origin);assert.equal(far.alert,false);
  p.x=350;tick(s,.5);assert.deepEqual(e.target,origin,'quiet relocation must not retarget infected');
  tick(s,16);assert.equal(e.state,'roam');assert.equal(e.alert,false);
}
{
  const s=setup(),p=s.players[0];p.hp=40;
  const e=G.spawn(s,'runner',0,2700);G.useMedkit(s,p);tick(s,.05);assert.equal(e.alert,true);
  const count=s.noiseId;p.hp=p.maxHp;assert.equal(G.useMedkit(s,p),false);assert.equal(s.noiseId,count);
  p.auto=true;tick(s,.05);assert.ok(s.noise.some(n=>n.kind==='shot'));
  const custom=G.makeNoise(s,{x:0,y:2800},'window-break',650);assert.equal(custom.r,650);
  s.paused=true;assert.equal(G.makeNoise(s,p,'run'),null);
}
{
  const s=setup(),p=s.players[0],x=p.x;tick(s,.5,{x:1,run:true});
  assert.ok(p.x-x>75);assert.ok(p.stamina<100);assert.ok(s.noise.some(n=>n.kind==='run'));
  // Use a clear road so collisions cannot end the sprint before exhaustion.
  p.x=0;p.y=2800;tick(s,3.2,{y:-1,run:true});assert.equal(p.stamina,0);
  const y=p.y;tick(s,.1,{y:-1,run:true});assert.equal(p.running,false);assert.ok(Math.abs(p.y-y-(-10.5))<.01);
  tick(s,6);assert.equal(p.stamina,100);tick(s,.1,{y:-1,run:true});assert.equal(p.running,true);
  s.paused=true;const energy=p.stamina;tick(s,2);assert.equal(p.stamina,energy);
}
{
  const s=setup(),p=s.players[0];tick(s,.5,{run:true});assert.equal(p.stamina,100);assert.equal(s.noise.length,0,'stationary sprint is silent');
  s.world.obstacles.push({x:12,y:2770,w:30,h:60});tick(s,.5,{x:1,run:true});
  const n=s.noiseId,energy=p.stamina;tick(s,.3,{x:1,run:true});assert.equal(s.noiseId,n);assert.ok(p.stamina>=energy,'pushing a wall does not drain stamina');
}
// Navigation respects separate sound destinations, including a sound behind a wall.
{
  const s=setup();s.world={obstacles:[{x:-40,y:2610,w:80,h:120}],buildings:[],locations:[],setpieces:[],landmarks:[],roads:[]};
  const e=G.spawn(s,'walker',0,2560);G.makeNoise(s,{x:0,y:2800},'door',500);
  tick(s,11);assert.ok(e.y>2740,'infected navigates around wall to sound');
}
// Bag invariants over many offers, determinism, and all five upgrade effects.
{
  const s=setup(42),t=setup(42),p=s.players[0],q=t.players[0],history=[],counts=Object.fromEntries(G.UPGRADES.map(u=>[u.id,0]));
  p.upgrades=q.upgrades=1000;
  for(let i=0;i<1000;i++){
    assert.deepEqual(p.offers,q.offers);assert.equal(new Set(p.offers).size,3);
    for(const id of p.offers){assert.ok(p.upgradeBag.includes(id));counts[id]++;}
    if(history.length>=2)assert.ok(p.offers.filter(id=>history.at(-1).includes(id)&&history.at(-2).includes(id)).length<2);
    history.push(p.offers.slice());
    // Keep every upgrade eligible while checking the five-option distribution.
    p.speed=q.speed=105;
    const chosen=p.offers[0],remaining=p.upgradeBag.filter(id=>id!==chosen);
    assert.equal(G.upgrade(s,p,0),true);G.upgrade(t,q,0);
    if(p.upgradeBag.length<5){assert.deepEqual(p.upgradeBag,remaining);assert.ok(!p.offers.includes(chosen));}
  }
  for(const count of Object.values(counts))assert.ok(count>480&&count<720,'no systematic option bias: '+JSON.stringify(counts));
  assert.equal(G.upgrade(s,p,0),false);assert.equal(G.upgrade(s,p,3),false);
  const u=setup(),r=u.players[0];r.upgrades=10;r.offers=['stamina','health','damage'];const max=r.maxStamina;
  G.upgrade(u,r,0);assert.equal(r.maxStamina,max+25);assert.equal(r.stamina,max+25);
  r.speed=145;G.upgrade(u,r,0);assert.ok(!r.offers.includes('speed'),'capped speed cannot waste a choice');
  G.addPlayer(u,'pad:0');const teammate=u.players[1],bag=teammate.upgradeBag.slice();G.upgrade(u,r,0);assert.deepEqual(teammate.upgradeBag,bag);
  console.log('PASS upgrade bag: 1000 deterministic offers, no duplicate triples/pair streaks, counts',counts);
}
{
  const s=setup();assert.deepEqual(W.mapView(s,true),{x:0,y:2800,span:1400});assert.equal(W.mapView(s).span,7200);
  H.bind({state:()=>s,resume:()=>{s.paused=false;}});H.press('pause');H.press('map');assert.equal(H.menu,'fullmap');assert.equal(s.paused,true);
  H.press('map');assert.equal(H.menu,'pause');assert.equal(s.paused,true);H.press('pause');assert.equal(s.paused,false);
  H.press('map');assert.equal(s.paused,false);H.press('back');assert.equal(H.menu,'pause');assert.equal(s.paused,true);H.close();
}
console.log('PASS stealth: quiet walking, hearing ranges, sound memory, search timeout, healing/shooting, stamina/exhaustion/recovery, collision, navigation, map/pause');
