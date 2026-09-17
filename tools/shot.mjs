// Real-browser scene screenshots through playwright-core (the only check that
// covers HUD text, menus, glows and the vignette). Run the server first.
//
//   node tools/shot.mjs [scene|all] [--url http://127.0.0.1:4177] [--w 1920] [--h 1080] [--seed 12345] [--out artifacts]
// Scenes: street house barricade radio boss pause map manual end lost compact car night journal cordon gate
// PLAYWRIGHT_PATH points at a playwright-core index.mjs; a default is tried.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from './pixboot.mjs';

const o=parseArgs(process.argv.slice(2),new Set(['help']));
if(o.help){console.log('node tools/shot.mjs [scene|all] [--url U] [--w W] [--h H] [--seed S] [--out dir]');process.exit(0);}
const modulePath=process.env.PLAYWRIGHT_PATH||'C:/Users/daniel/Documents/development/project-fantasy/attempt_vibe_code/node_modules/playwright-core/index.mjs';
const {chromium}=await import(pathToFileURL(modulePath).href);
const url=o.url||'http://127.0.0.1:4177',seed=o.seed||12345,W=+(o.w||1920),H=+(o.h||1080),outDir=o.out||'artifacts';
await fs.mkdir(outDir,{recursive:true});

const PARTY=`const s=DeadSignal.state;for(let i=1;i<4;i++)DSGame.addPlayer(s,'test:'+i);for(const p of s.players){p.weapon=['ar','shotgun','flame','smg'][p.id];p.backup=false;p.mag=DSGame.WEAPONS[p.weapon].mag;p.invuln=100;}`;
// place: --at <locationId> [--door n] frames a location from outside its first door (or its centre), quiet streets
const AT=JSON.stringify(o.at||'crossroads-supermarket'),DOOR=+(o.door||0),INSIDE=!!o.inside;
const SCENES={
  // reading the St. Orison records: the document panel and the objective card update
  records:{setup:PARTY+`s.spawnAcc=-1e9;s.enemies=[];const it=s.loot.find(i=>i.evidence==='patientRecords');for(const p of s.players){p.x=it.x+(p.id?(p.id-1.5)*30:0);p.y=it.y+(p.id?40:0);p.invuln=99;}`,settle:900},
  // the Blackglass transmitter mid-transmission with the circuit live
  transmit:{setup:PARTY+`s.spawnAcc=-1e9;s.enemies=[];s.circuit.emergency=true;Object.assign(s.campaign,{prepared:true,payload:true,holding:'transmit',transmitProgress:18});const a=DSGame.holdPoint(s,'transmit');for(const p of s.players){p.x=a.x+(p.id-1.5)*22;p.y=a.y+14;p.invuln=99;}`,settle:900},
  // the cordon fence on the west edge of the Old Quarter, where the avenue dies against it
  cordon:{setup:PARTY+`s.spawnAcc=-1e9;s.enemies=[];const E=DSWorld.EDGE;for(const p of s.players){p.x=-E+230+(p.id-1.5)*30;p.y=-1430+(p.id%2)*30;p.invuln=99;}`,settle:900},
  // Checkpoint Nine from inside: the locked evacuation gate in the cordon, the only way out of the city
  gate:{setup:PARTY+`s.spawnAcc=-1e9;s.enemies=[];const a=DSGame.holdPoint(s,'gate');for(const p of s.players){p.x=a.x+(p.id-1.5)*36;p.y=a.y-30;p.invuln=99;}`,settle:900},
  // the escape: barrier open, the squad walking out through the cordon
  escape:{setup:PARTY+`s.spawnAcc=-1e9;s.enemies=[];s.circuit.emergency=true;Object.assign(s.campaign,{prepared:true,payload:true,override:true,transmitted:true,holding:'gate',gateProgress:7.95});const a=DSGame.holdPoint(s,'gate');for(const p of s.players){p.x=a.x+(p.id-1.5)*40;p.y=a.y+10;p.invuln=99;}`,settle:2500},
  // the run's bulldozer on its pad before anyone drives it
  dozer:{setup:PARTY+`s.spawnAcc=-1e9;s.enemies=[];const v=s.vehicles.find(q=>q.vehicleType==='bulldozer');for(const p of s.players){p.x=v.x+90+(p.id-1.5)*26;p.y=v.y+40;p.invuln=99;}`,settle:1200},
  // the fire truck with the whole squad aboard, out on the Northline road
  truckDrive:{setup:PARTY+`s.spawnAcc=-1e9;s.enemies=[];const v=s.vehicles.find(q=>q.vehicleType==='fireTruck');v.fuel=v.maxFuel;for(const p of s.players){p.x=v.x+50;p.y=v.y;if(!DSGame.enterVehicle(s,v,p))throw new Error('boarding failed');}v.x=-300;v.y=-1400;v.angle=0;v.speed=120;`,settle:900},
  // the truck broken down beside its bay: the station's side door stays open on foot
  truckWreck:{setup:PARTY+`s.spawnAcc=-1e9;s.enemies=[];const v=s.vehicles.find(q=>q.vehicleType==='fireTruck');v.obstacle.hp=1;v.integrity=0;v.dead=true;v.obstacle.driveable=false;for(const p of s.players){p.x=v.x+70+(p.id-1.5)*26;p.y=v.y+20;p.invuln=99;}`,settle:1200},
  // the chapel and graveyard from the lane, emergency circuit off (chapelOff) or restored (chapelOn)
  chapelOff:{setup:PARTY+`s.spawnAcc=-1e9;s.enemies=[];const b=s.world.buildings.find(b=>b.archetypeId==='chapel');for(const p of s.players){p.x=b.x+b.w+90+(p.id-1.5)*30;p.y=b.y+b.h/2+120;p.invuln=99;}`,settle:1200},
  chapelOn:{setup:PARTY+`s.spawnAcc=-1e9;s.enemies=[];s.circuit.emergency=true;const b=s.world.buildings.find(b=>b.archetypeId==='chapel');for(const p of s.players){p.x=b.x+b.w+90+(p.id-1.5)*30;p.y=b.y+b.h/2+120;p.invuln=99;}`,settle:1200},
  // Blackglass with the circuit restored: the tower beacon over Northline
  beacon:{setup:PARTY+`s.spawnAcc=-1e9;s.enemies=[];s.circuit.emergency=true;s.radio.done=true;const m=s.world.setpieces.find(p=>p.kind==='radio');for(const p of s.players){p.x=m.x+120+(p.id-1.5)*30;p.y=m.y+80;p.invuln=99;}`,settle:1500},
  // street read: the squad strung along the y=1400 avenue looking across at the market, its parking and nearby fabric (daylight-free: gameplay lighting)
  streetread:{setup:PARTY+`s.spawnAcc=-1e9;s.enemies=[];const xs=[-1150,-750,-350,50];for(const p of s.players){p.x=xs[p.id];p.y=1480;p.invuln=99;p.angle=Math.PI/2;p.viewAngle=p.angle;p.moveAngle=p.angle;}`,settle:1500},
  // the police station and sealed frontage south along the evac road
  policeread:{setup:PARTY+`s.spawnAcc=-1e9;s.enemies=[];const ys=[2000,2150,2300,2450];for(const p of s.players){p.x=40;p.y=ys[p.id];p.invuln=99;p.angle=0;p.viewAngle=0;p.moveAngle=0;}`,settle:1500},
  // map states: South Blocks places visited, one cleared, a nothing-found home and revealed street caches; open the full map
  mapstates:{setup:`const s=DeadSignal.state,L=s.locationState;for(const l of s.world.locations){const c=l.rect.x+l.rect.w/2,d=l.rect.y+l.rect.h/2;if(d>1400&&c<1400){L[l.id].discovered=true;L[l.id].visited=true;}}
    L['police-station'].cleared=true;L['market-parking'].cleared=true;DeadSignal.ui&&DeadSignal.ui.open('fullmap');`,settle:400,keyboard:'Tab'},
  // the 1.4 km local map at the market crossroads with visited places around
  localmap:{setup:PARTY+`s.spawnAcc=-1e9;s.enemies=[];const L=s.locationState;for(const l of s.world.locations){const c=l.rect.x+l.rect.w/2,d=l.rect.y+l.rect.h/2;if(Math.abs(c+400)<800&&Math.abs(d-1900)<700){L[l.id].discovered=true;L[l.id].visited=true;}}L['police-station'].cleared=true;
    for(const p of s.players){p.x=-100+(p.id-1.5)*30;p.y=1450;}s.camera.x=-100;s.camera.y=1450;`,settle:700},
  // the new expedition stock: a ration pack and a jerrycan on the pavement, and the squad's counters
  supplies:{setup:PARTY+`s.spawnAcc=-1e9;s.enemies=[];for(const p of s.players){p.x=(p.id-1.5)*35;p.y=2620;}s.camera.x=0;s.camera.y=2600;s.supplies.provisions=3;s.supplies.vehicleFuel=40;s.players[0].fed=60;
    s.loot.push({id:'shot-ration',x:-70,y:2560,type:'provision',amount:1,label:'ration pack'},{id:'shot-can',x:70,y:2560,type:'vehicleFuel',amount:20,label:'jerrycan'});`,settle:600},
  // a secured interior door mid-force: the supermarket's locked back room from the sales floor
  secured:{setup:PARTY+`s.spawnAcc=-1e9;s.enemies=[];const b=s.world.buildings.find(b=>b.archetypeId==='supermarket'),d=b.interiorDoors.find(d=>d.kind==='secured'&&d.rooms.some(r=>r.endsWith('sales'))&&d.rooms.some(r=>r.endsWith('backroom')));for(const p of s.players){p.x=d.rect.x+d.rect.w/2+(p.id-1.5)*26;p.y=d.rect.y-40;p.invuln=99;}s.doorState[d.id].active=true;s.doorState[d.id].progress=.6;`,settle:500},
  // roof zones: one survivor in the St. Orison reception, or the squad split between the west and east wings
  roofs1:{setup:`const s=DeadSignal.state;s.spawnAcc=-1e9;s.enemies=[];const b=s.world.buildings.find(b=>b.archetypeId==='hospital'),r=b.rooms.find(r=>r.id.endsWith('reception'));const p=s.players[0];p.x=r.rect.x+r.rect.w/2;p.y=r.rect.y+r.rect.h/2;p.invuln=99;s.camera.x=b.x+b.w/2;s.camera.y=b.y+b.h/2;`,settle:1500},
  roofs4:{setup:PARTY+`s.spawnAcc=-1e9;s.enemies=[];const b=s.world.buildings.find(b=>b.archetypeId==='hospital'),west=b.rooms.find(r=>r.id.endsWith('offices')),east=b.rooms.find(r=>r.id.endsWith('records'));for(const p of s.players){const r=p.id<2?west:east;p.x=r.rect.x+r.rect.w/2+(p.id%2)*30;p.y=r.rect.y+r.rect.h/2;p.invuln=99;}`,settle:1800},
  place:{setup:PARTY+`s.spawnAcc=-1e9;s.enemies=[];const W=DSWorld,l=W.locationById(s.world,${AT});if(!l)throw new Error('no location '+${AT});
    const b=s.world.buildings.find(b=>b.locationId===l.id),d=b&&b.exteriorDoors[${DOOR}],lot=s.world.lots.find(q=>q.locationId===l.id);
    let x=l.rect.x+l.rect.w/2,y=l.rect.y+l.rect.h/2;
    if(d){const out={n:[0,-60],s:[0,60],e:[60,0],w:[-60,0]}[d.side];x=d.rect.x+d.rect.w/2+(${INSIDE}?-out[0]*1.6:out[0]);y=d.rect.y+d.rect.h/2+(${INSIDE}?-out[1]*1.6:out[1]);}
    else if(lot&&lot.entrances[0]){const e=lot.entrances[0];x=e.rect.x+e.rect.w/2;y=e.rect.y+e.rect.h/2;}
    for(const p of s.players){p.x=x+(p.id-1.5)*24;p.y=y;p.invuln=99;}s.camera.x=x;s.camera.y=y;`,settle:1200},
  car:{setup:PARTY+`s.spawnAcc=-1000;s.enemies=[];s.loot=[];const v=s.vehicles.find(v=>Math.hypot(v.x-150,v.y-2560)<280);if(!v)throw new Error('no checkpoint car');v.fuel=2000;for(const p of s.players){p.x=v.x;p.y=v.y+70;if(!DSGame.enterVehicle(s,v,p))throw new Error('boarding failed');}v.x=0;v.y=2150;v.angle=-Math.PI/2;v.speed=180;v.integrity=28;DSGame.vehicleTick(s,v,{},0);s.camera.x=0;s.camera.y=2070;s.camera.w=740;s.camera.h=740*innerHeight/innerWidth;for(let i=0;i<8;i++)DSGame.spawn(s,'walker',(i%4-1.5)*60,1850+Math.floor(i/4)*70,{speed:0});`,settle:700},
  street:{setup:PARTY+`for(const p of s.players){p.x=(p.id-1.5)*35;p.y=2620+(p.id%2)*35;}s.camera.x=0;s.camera.y=2620;for(let i=0;i<22;i++)DSGame.spawn(s,i%4===0?'brute':i%3===0?'runner':i%5===0?'ghost':'walker',(i%6-3)*110,2450+(i%4)*40);`,settle:1500},
  house:{setup:PARTY+`const h=(s.world.buildings||[])[0];if(!h)throw new Error('no houses');for(const p of s.players){p.x=h.x+h.w/2+(p.id-1.5)*20;p.y=h.y+h.h/2;}s.camera.x=h.x+h.w/2;s.camera.y=h.y+h.h/2;for(let i=0;i<3;i++)DSGame.spawn(s,'walker',h.x+h.w/2+(i-1)*30,h.y+h.h+60);`,settle:1500},
  barricade:{setup:PARTY+`const b=(s.world.setpieces||[]).find(p=>p.kind==='barricade');if(!b)throw new Error('no barricades');for(const p of s.players){p.x=b.x+(p.id-1.5)*30;p.y=b.y+120;}s.camera.x=b.x;s.camera.y=b.y;`,settle:1200},
  radio:{setup:PARTY+`const r=s.world.landmarks.find(l=>l.id==='radio');for(const p of s.players){p.x=r.x+(p.id-1.5)*30;p.y=r.y+70;}s.camera.x=r.x;s.camera.y=r.y;s.radio.active=true;s.radio.progress=18;`,settle:1200},
  boss:{setup:PARTY+`for(const p of s.players){p.x=(p.id-1.5)*40;p.y=140;}s.enemies=[];DSBoss.start(s,DSGame.api(s));s.boss.hp=s.boss.maxHp*.3;s.camera.x=0;s.camera.y=0;`,settle:3500},
  // the pause journal mid-campaign: power restored, Blackglass ready, the payload still sealed; records read along the way
  journal:{setup:PARTY+`s.spawnAcc=-1e9;s.enemies=[];for(const kind of ['refugeLedger','patientRecords','furnaceClue']){const it=s.loot.find(i=>i.evidence===kind);const p=s.players[0];p.x=it.x;p.y=it.y;DSGame.step(s,1/60,{});}const n=s.world.props.find(p=>p.notice&&p.locationId==='checkpoint-nine');s.players[0].x=n.x;s.players[0].y=n.y+30;DSGame.step(s,1/60,{});s.document=null;s.circuit.emergency=true;s.campaign.prepared=true;DeadSignal.ui&&DeadSignal.ui.open('pause');DeadSignal.ui&&DeadSignal.ui.open('journal');`,settle:600},
  pause:{setup:`DeadSignal.ui?DeadSignal.ui.open('pause'):(DeadSignal.state.paused=true);`,settle:400,keyboard:'Escape'},
  options:{setup:`DeadSignal.ui.open('pause');DeadSignal.ui.open('options');`,settle:400},
  map:{setup:`DeadSignal.ui&&DeadSignal.ui.open('fullmap');`,settle:400,keyboard:'Tab'},
  manual:{setup:`DeadSignal.ui&&DeadSignal.ui.open('manual');`,settle:400},
  end:{setup:PARTY+`s.mode='won';`,settle:600},
  lost:{setup:`const s=DeadSignal.state;s.players.forEach(p=>{p.dead=true;p.hp=0;});`,settle:800},
  // the night look: party on the Northline avenue facing up the street with a working and a dead lamp in frame, infected half in the dark
  night:{setup:PARTY+`for(const p of s.players){p.x=1400+(p.id-1.5)*30;p.y=-1400+(p.id%2)*30;p.angle=-Math.PI/2+(p.id-1.5)*.5;p.viewAngle=p.angle;}s.camera.x=1400;s.camera.y=-1500;for(let i=0;i<22;i++)DSGame.spawn(s,i%4===0?'brute':i%3===0?'runner':i%5===0?'ghost':'walker',1400+(i%6-3)*110,-1900+(i%4)*60+(i>10?520:0));`,settle:1500},
  compact:{setup:PARTY+`for(const p of s.players){p.x=(p.id-1.5)*35;p.y=2620+(p.id%2)*35;}s.camera.x=0;s.camera.y=2620;for(let i=0;i<22;i++)DSGame.spawn(s,i%3?'walker':'runner',(i%6-3)*110,2450+(i%4)*40);`,settle:1200,viewport:{width:1024,height:600}},
};
const want=(o._[0]&&o._[0]!=='all')?o._[0].split(','):Object.keys(SCENES);
const browser=await chromium.launch({headless:true});
for(const name of want){
  const sc=SCENES[name];if(!sc){console.error('unknown scene '+name);continue;}
  const page=await browser.newPage({viewport:sc.viewport||{width:W,height:H}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(url+'/?seed='+seed);
    await page.getByRole('button',{name:'ENTER THE CITY'}).click();
    await page.waitForFunction(()=>window.DeadSignal&&DeadSignal.state.time>.2);
    await page.evaluate(sc.setup);
    if(sc.keyboard&&!(await page.evaluate(()=>!!DeadSignal.ui)))await page.keyboard.press(sc.keyboard);
    await page.waitForTimeout(sc.settle);
    const file=path.join(outDir,'scene-'+name+'.png');
    // --clip x,y,w,h keeps review crops small
    const clip=o.clip?(([cx,cy,cw,ch])=>({x:cx,y:cy,width:cw,height:ch}))(String(o.clip).split(',').map(Number)):undefined;
    await page.screenshot({path:file,clip});
    console.log('wrote',file,errors.length?'PAGE ERRORS: '+errors.join(' | '):'');
  }catch(e){console.error('scene '+name+' failed: '+e.message);}
  await page.close();
}
await browser.close();
