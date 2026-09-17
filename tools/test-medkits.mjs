import assert from 'node:assert/strict';
await import('../city.js');await import('../world.js');await import('../boss.js');await import('../game.js');
const G=globalThis.DSGame,W=globalThis.DSWorld,s=G.create(12345);
G.addPlayer(s);G.addPlayer(s,'pad:0');s.mode='play';
const [a,b]=s.players;
assert.equal(a.medkits,1);
assert.equal(G.useMedkit(s,a),false,'full health preserves kit');
a.hp=20;b.hp=30;
G.step(s,1/60,{0:{heal:true}});
assert.equal(a.hp,70);assert.equal(a.medkits,0);assert.equal(b.hp,30,'healing is personal');
assert.equal(G.useMedkit(s,a),false,'empty inventory cannot heal');
const kit=()=>({type:'medkit',x:a.x,y:a.y,amount:1});
for(let i=0;i<3;i++)assert.equal(G.collect(s,a,kit()),true);
const extra=kit();assert.equal(G.collect(s,a,extra),false);assert.ok(!extra.taken,'full inventory leaves pickup');
assert.equal(a.hp,70,'collecting does not automatically heal');
s.paused=true;assert.equal(G.useMedkit(s,a),false);s.paused=false;
a.dead=true;assert.equal(G.useMedkit(s,a),false);a.dead=false;
assert.equal(a.medkits,3);
a.hp=a.maxHp-7;assert.equal(G.useMedkit(s,a),true);assert.equal(a.hp,a.maxHp);assert.equal(a.medkits,2);
const shared=kit();assert.equal(G.collect(s,b,shared),true);assert.equal(G.collect(s,a,shared),false,'same pickup cannot be collected twice');
const stock=s.loot.filter(l=>l.type==='medkit');assert.ok(stock.length>0);assert.ok(stock.every(l=>!W.blocked(s.world,l.x,l.y,0)));
assert.ok(s.audioEvents.some(e=>e.type==='heal'));
console.log('PASS medkits: inventory, pickup limits, personal healing, cap, pause, downed players, empty inventory, co-op ownership');

// Compare the optimized broad phase against the original collision semantics.
const w=W.create(9);let seed=42;
const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<6000;i++){
  const x=rand()*7100-3550,y=rand()*7100-3550,r=rand()*25;
  const expected=w.obstacles.find(o=>x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h)||null;
  assert.equal(W.blocked(w,x,y,r),expected);
}
const indexed=W.queryObstacles;
for(let i=0;i<1000;i++){
  const x=rand()*7000-3500,y=rand()*7000-3500,tx=x+rand()*1000-500,ty=y+rand()*1000-500;
  const actual=G.lineObstacle({world:w},x,y,tx,ty);
  W.queryObstacles=world=>world.obstacles;
  const expected=G.lineObstacle({world:w},x,y,tx,ty);
  W.queryObstacles=indexed;assert.deepEqual(actual,expected);
}
const custom={obstacles:[{x:250,y:250,w:50,h:50,hp:10}]},o=custom.obstacles[0];
assert.equal(W.blocked(custom,256,256,1),o);W.removeObstacle(custom,o);assert.equal(W.blocked(custom,256,256,1),null);
custom.obstacles.push(o);assert.equal(W.blocked(custom,256,256,1),o);
custom.obstacles=[];assert.equal(W.blocked(custom,256,256,1),null);
console.log('PASS spatial queries: 6000 collision and 1000 ray comparisons; cell boundaries and obstacle removal');
