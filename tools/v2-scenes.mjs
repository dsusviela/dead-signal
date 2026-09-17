// city_v2 V2-0 / V2-6 comparable views: every district's approach, centre and exit street, the maps, both
// Checkpoint gates, the four arena gates and key campaign states. Each capture also records placeholder
// (fallback) sprite draws seen on that view, so accepted routes can prove there are none.
//
//   node tools/v2-scenes.mjs [--tag before] [--only southBlocks-center,fullmap] [--w 1280 --h 720] [--diag]  (--diag: neutral light, no night lightmap)
// Needs the dev server (npm run serve). Output: artifacts/city/v2/scenes-<tag>/ plus report.json.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from './pixboot.mjs';

const o=parseArgs(process.argv.slice(2),new Set());
const modulePath=process.env.PLAYWRIGHT_PATH||'C:/Users/daniel/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs';
const {chromium}=await import(pathToFileURL(modulePath).href);
const url=o.url||'http://127.0.0.1:4177',tag=o.tag||'current',outDir=path.join('artifacts/city/v2','scenes-'+tag),W=+(o.w||1280),H=+(o.h||720);
await fs.mkdir(outDir,{recursive:true});
// street positions on road centre lines (grid edges -3600,-2800,-1400,0,1400,2800,3600); angle is where the squad faces
const STREETS={
  southBlocks:{approach:[-700,1400,Math.PI/2],center:[-1400,2150,Math.PI/2],exit:[0,3050,Math.PI/2]},
  oldQuarter:{approach:[-1400,-700,Math.PI],center:[-2800,-700,-Math.PI/2],exit:[-2100,1400,Math.PI/2]},
  civicWard:{approach:[1400,-700,0],center:[2800,-700,-Math.PI/2],exit:[2100,1400,Math.PI/2]},
  northline:{approach:[0,-1400,-Math.PI/2],center:[0,-2150,-Math.PI/2],exit:[-700,-2800,Math.PI]},
  ashworks:{approach:[1400,2100,0],center:[2800,2100,Math.PI/2],exit:[2100,2800,0]},
  quarantine:{approach:[0,-1000,Math.PI/2],center:[-700,0,0],exit:[700,1400,Math.PI/2]},
};
const at=(x,y,a)=>`{const st=DeadSignal.state,px=${x},py=${y};st.spawnAcc=-1e9;st.enemies=[];const p=st.players[0];p.x=px;p.y=py;p.invuln=1e9;p.angle=p.viewAngle=p.moveAngle=${a};st.camera.x=px;st.camera.y=py;}`;
const SCENES={};
for(const [d,views] of Object.entries(STREETS))for(const [v,[x,y,a]] of Object.entries(views))SCENES[`${d}-${v}`]={setup:at(x,y,a),settle:900};
Object.assign(SCENES,{
  fullmap:{setup:`DeadSignal.ui.open('fullmap');`,settle:400},
  // P2 art in place: the supermarket sales floor (aisles, trolley) and the police sign
  p2Market:{setup:at(-500,1850,-Math.PI/2),settle:900},p2Police:{setup:at(150,2300,0),settle:900},p2Rubble:{setup:at(-2800,-600,Math.PI/2),settle:900},
  // V2-3 pilots: the South Blocks north alley into police staff parking, and the Ashworks loading lane into the loading court
  pilotSouthAlley:{setup:at(725,1760,Math.PI/2),settle:900},pilotSouthCourt:{setup:at(900,1990,Math.PI),settle:900},pilotAshLane:{setup:at(3100,2200,0),settle:900},pilotAshCourt:{setup:at(3380,1990,-Math.PI/2),settle:900},
  // parks and the graveyard (city_v2 Section 2 finish review): each from inside its main path cross
  parkLinden:{setup:at(-2100,2120,-Math.PI/2),settle:900},parkNorthline:{setup:at(-1020,-2360,-Math.PI/2),settle:900},graveyard:{setup:at(-2310,-740,-Math.PI/2),settle:900},chapelApproach:{setup:at(-1500,-890,Math.PI),settle:900},chapelGraveyardPath:{setup:at(-1960,-860,Math.PI),settle:900},
  // city_v2 set pieces: St. Orison canopy + glass link, the Ashworks gantry, the quarantine processing link, Blackglass front, fire apron
  pieceHospital:{setup:at(2150,-470,-Math.PI/2),settle:900},pieceGantry:{setup:at(1860,2250,0),settle:900},pieceConveyor:{setup:at(1760,2200,Math.PI),settle:900},pieceQueue:{setup:at(265,-330,-Math.PI/2),settle:900},pieceProcessing:{setup:at(-100,-500,Math.PI),settle:900},pieceBroadcast:{setup:at(430,-3080,-Math.PI/2),settle:900},pieceFireApron:{setup:at(-540,-1700,-Math.PI/2),settle:900},
  fullmapStates:{setup:`const s=DeadSignal.state,L=s.locationState;for(const l of s.world.locations){L[l.id].discovered=true;if(l.rect.y>0)L[l.id].visited=true;}L['police-station'].cleared=true;L['warehouse'].cleared=true;const v=s.vehicles.find(q=>q.vehicleType==='fireTruck');v.x=1400;v.y=-600;v.fuel=0;for(const g of s.world.arenaGates)s.gates[g.id].open=g.side!=='n';s.noise.push({x:0,y:2600,r:500,life:1.2,maxLife:1.4,audible:1,kind:'gate'});DeadSignal.ui.open('fullmap');`,settle:300},
  fullmapGray:{setup:`DeadSignal.ui.open('fullmap');document.getElementById('game').style.filter='grayscale(1)';`,settle:400},
  fullmapDeutan:{setup:`DeadSignal.ui.open('fullmap');document.body.insertAdjacentHTML('beforeend','<svg width="0" height="0" style="position:absolute"><filter id="cvd"><feColorMatrix type="matrix" values="0.367 0.861 -0.228 0 0 0.280 0.673 0.047 0 0 -0.012 0.043 0.969 0 0 0 0 0 1 0"/></filter></svg>');document.getElementById('game').style.filter='url(#cvd)';`,settle:400},
  fullmapProtan:{setup:`DeadSignal.ui.open('fullmap');document.body.insertAdjacentHTML('beforeend','<svg width="0" height="0" style="position:absolute"><filter id="cvd"><feColorMatrix type="matrix" values="0.152 1.053 -0.205 0 0 0.115 0.786 0.099 0 0 -0.004 -0.048 1.052 0 0 0 0 0 1 0"/></filter></svg>');document.getElementById('game').style.filter='url(#cvd)';`,settle:400},
  // candidates for the uncoordinated 00:34 South Blocks void (tools/v2-voids.mjs): the police-station block interior
  void0034a:{setup:at(670,2120,Math.PI/2),settle:900},void0034b:{setup:at(420,1850,0),settle:900},void0034c:{setup:at(-2054,2106,0),settle:900},
  localmap:{setup:at(-100,1450,0),settle:600},
  // the decorative Checkpoint boom and the functional evacuation barrier farther south
  checkpointBoom:{setup:`const s=DeadSignal.state,g={x:0,y:2650}; /* the decorative boom was removed in V2-1: this view now shows the inner checkpoint without it */${at('g.x+(g.w||0)/2','g.y+(g.h||0)/2+60',-Math.PI/2)}`,settle:900},
  evacBarrier:{setup:`const s=DeadSignal.state,a=DSGame.holdPoint(s,'gate');${at('a.x','a.y+40',Math.PI/2)}`,settle:900},
  ...Object.fromEntries([0,1,2,3].map(i=>['arenaGate'+i,{setup:`const s=DeadSignal.state,g=s.world.obstacles.filter(q=>q.type==='gate'&&!q.bollard)[${i}]||(s.gates||[]).map(x=>x.rect||x)[${i}];if(!g)throw new Error('no arena gate ${i}');${at('g.x+g.w/2+(g.w>g.h?0:90)','g.y+g.h/2+(g.w>g.h?90:0)',-Math.PI/2)}`,settle:900}])),
  // each arena gate, closed (squad 136 units outside, beyond the 130-unit auto-open trigger) and open
  ...Object.fromEntries(['n','s','e','w'].flatMap(side=>[false,true].map(open=>['gate-'+side+(open?'-open':'-closed'),{setup:`{const st=DeadSignal.state,g=st.world.arenaGates.find(q=>q.side==='${side}');const out={n:[0,-1],s:[0,1],e:[1,0],w:[-1,0]}['${side}'];if(${open})DSGame.setGate(st,g,true,true);const cx=g.rect.x+g.rect.w/2,cy=g.rect.y+g.rect.h/2,p=st.players[0];st.spawnAcc=-1e9;st.enemies=[];p.x=cx+out[0]*136;p.y=cy+out[1]*136;p.invuln=1e9;p.angle=p.viewAngle=Math.atan2(-out[1],-out[0]);st.camera.x=cx+out[0]*120;st.camera.y=cy+out[1]*120;}`,settle:900}]))),
  generatorOff:{setup:`const s=DeadSignal.state,a=DSGame.generatorAnchor?DSGame.generatorAnchor(s):null;if(!a)throw new Error('no generator');${at('a.x+70','a.y+60',Math.PI)}`,settle:900},
  generatorOn:{setup:`const s=DeadSignal.state;s.circuit.emergency=true;s.supplies.generatorFuelled=true;const a=DSGame.generatorAnchor(s);${at('a.x+70','a.y+60',Math.PI)}`,settle:900},
  transmitting:{setup:`const s=DeadSignal.state;s.circuit.emergency=true;Object.assign(s.campaign,{prepared:true,payload:true,holding:'transmit',transmitProgress:18});const a=DSGame.holdPoint(s,'transmit');${at('a.x','a.y+14',-Math.PI/2)}`,settle:900},
  escape:{setup:`const s=DeadSignal.state;s.circuit.emergency=true;Object.assign(s.campaign,{prepared:true,payload:true,override:true,transmitted:true,holding:'gate',gateProgress:7.95});const a=DSGame.holdPoint(s,'gate');${at('a.x','a.y+10',Math.PI/2)}`,settle:2500},
});
const want=o.only?String(o.only).split(','):Object.keys(SCENES),report=[];
const browser=await chromium.launch({headless:true});
for(const name of want){
  const sc=SCENES[name];if(!sc){console.error('unknown scene '+name);continue;}
  const page=await browser.newPage({viewport:{width:W,height:H}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(url+'/?seed=12345');await page.getByRole('button',{name:'ENTER THE CITY'}).click();
    await page.waitForFunction(()=>window.DeadSignal&&DeadSignal.state.time>.2);
    await page.evaluate(diag=>{DeadSignal.state.bannerT=0;DSRender.resetFallbacks&&DSRender.resetFallbacks();if(diag)window.DS_DIAGNOSTIC_LIGHT=true;},!!o.diag);
    await page.evaluate(sc.setup);await page.waitForTimeout(sc.settle);
    const file=path.join(outDir,name+'.png');await page.screenshot({path:file});
    const info=await page.evaluate(()=>{const s=DeadSignal.state,c=s.camera,d=DSWorld.district(c.x,c.y);return {camera:{x:Math.round(c.x),y:Math.round(c.y)},district:d.id,surface:DSWorld.surfaceAt?DSWorld.surfaceAt(s.world,c.x,c.y):null,fallbacks:DSRender.fallbacks?DSRender.fallbacks():null};});
    report.push({name,file,errors,...info});
    console.log(name,info.district,info.fallbacks&&info.fallbacks.length?'FALLBACKS '+info.fallbacks.map(f=>f.id+'×'+f.count).join(' '):'',errors.length?'ERRORS '+errors.join(' | '):'');
  }catch(e){console.error(name+' failed: '+e.message);report.push({name,failed:e.message});}
  await page.close();
}
await browser.close();
await fs.writeFile(path.join(outDir,'report.json'),JSON.stringify(report,null,1));
