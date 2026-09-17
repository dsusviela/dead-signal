// Real-browser frame cost (CITY.md Phase 13): render and simulation milliseconds per frame plus peak
// audio voices/engines/loops, for one and four survivors across the city's heaviest scenes.
// Run the server first; PLAYWRIGHT_PATH points at playwright-core. Headless timings are relative:
// compare runs on the same machine, not against real-device frame rates.
//   node tools/bench-browser.mjs [--seconds 6] [--url http://127.0.0.1:4177]
import {pathToFileURL} from 'node:url';
import {parseArgs} from './pixboot.mjs';
const o=parseArgs(process.argv.slice(2),new Set());
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PATH).href);
const url=o.url||'http://127.0.0.1:4177',ms=1000*(+o.seconds||6);
const PARTY=n=>`const s=DeadSignal.state;for(let i=1;i<${n};i++)DSGame.addPlayer(s,'bench:'+i);for(const p of s.players)p.invuln=1e9;`;
const SCENES={
  solo:{setup:PARTY(1)+`s.time=s.elapsed=720;`},
  four:{setup:PARTY(4)+`s.time=s.elapsed=720;s.players.forEach((p,i)=>{p.x=s.players[0].x+(i-1.5)*30;p.y=s.players[0].y;});`},
  // every point light and flood live: Checkpoint Nine and the ring with the emergency circuit on
  circuit4:{setup:PARTY(4)+`s.time=s.elapsed=720;s.circuit.emergency=true;s.players.forEach((p,i)=>{p.x=(i-1.5)*30;p.y=2700;});`},
  // four aboard the fire truck, throttle held: vehicle collisions, headlights, the diesel loop
  truck4:{setup:PARTY(4)+`s.time=s.elapsed=720;const v=s.vehicles.find(q=>q.vehicleType==='fireTruck');v.fuel=v.maxFuel;for(const p of s.players){p.x=v.x+50;p.y=v.y;DSGame.enterVehicle(s,v,p);}`,keys:['KeyS']},
  // the furnace fight with four: boss casts, hazards, the sealed square yard
  arena4:{setup:PARTY(4)+`s.players.forEach((p,i)=>{p.x=(i-1.5)*40;p.y=60;});DSBoss.start(s,DSGame.api(s));`},
};
const browser=await chromium.launch({headless:true});
try{
  for(const [name,sc] of Object.entries(SCENES)){
    const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url+'/?seed=12345');
    await page.getByRole('button',{name:'ENTER THE CITY'}).click();
    await page.waitForFunction(()=>window.DeadSignal&&DeadSignal.state.time>.2);
    await page.evaluate(sc.setup);
    await page.evaluate(()=>{
      const b=window.__bench={render:[],step:[],voices:0,engines:0,loops:0,enemies:0,frames:0};
      const scene=DSRender.scene,step=DSGame.step;
      DSRender.scene=function(...a){const t=performance.now();scene.apply(this,a);b.render.push(performance.now()-t);b.frames++;
        const st=DSAudio.status;b.voices=Math.max(b.voices,st.voices);b.engines=Math.max(b.engines,st.engines);b.loops=Math.max(b.loops,st.loops.length);b.enemies=Math.max(b.enemies,DeadSignal.state.enemies.length);};
      DSGame.step=function(...a){const t=performance.now();step.apply(this,a);b.step.push(performance.now()-t);};
    });
    for(const k of sc.keys||[])await page.keyboard.down(k);
    await page.waitForTimeout(ms);
    for(const k of sc.keys||[])await page.keyboard.up(k);
    const r=await page.evaluate(()=>{const b=window.__bench,st=a=>{const s=[...a].sort((x,y)=>x-y);return {avg:+(s.reduce((x,y)=>x+y,0)/s.length).toFixed(2),p95:+s[Math.floor(s.length*.95)].toFixed(2),max:+s[s.length-1].toFixed(1)};};
      const s=DeadSignal.state;return {frames:b.frames,renderMs:st(b.render),stepMs:st(b.step),peakVoices:b.voices,peakEngines:b.engines,peakLoops:b.loops,peakEnemies:b.enemies,
        players:s.players.length,aboard:s.players.filter(p=>p.vehicle).length,mode:s.mode,audio:DSAudio.status.state};});
    console.log(JSON.stringify({scene:name,...r,errors:errors.length}));
    await page.close();
  }
}finally{await browser.close();}
