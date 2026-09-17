import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PATH).href);
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4177/?seed=11');
  await page.getByRole('button',{name:'ENTER THE CITY'}).click();
  await page.waitForFunction(()=>DeadSignal.state.time>.2);
  await page.evaluate(()=>{
    const s=DeadSignal.state,v=s.vehicles[0],p=s.players[0];
    s.spawnAcc=-1000;s.enemies=[];s.loot=[];s.vehicles=[v];s.world.obstacles=[v.obstacle];
    Object.assign(v,{x:0,y:1800,angle:-Math.PI/2,fuel:DSGame.CAR.maxFuel});
    Object.assign(v.obstacle,{x:-24,y:1752,w:48,h:96});Object.assign(p,{x:40,y:1800});
    Object.assign(s.camera,{x:0,y:1800});
  });
  await page.keyboard.press('e');
  await page.waitForFunction(()=>DeadSignal.state.players[0].vehicle!=null&&DSAudio.status.engines===1);
  await page.keyboard.down('w');
  await page.waitForFunction(()=>DeadSignal.state.vehicles[0].speed>140);
  await page.keyboard.up('w');
  const beams=await page.evaluate(()=>{
    const s=DeadSignal.state,v=s.vehicles[0];DSLights.begin(s,s.camera);
    return DSLights.lights().filter(l=>l.col==='#ffe9bd').map(l=>({ahead:(l.x-v.x)*Math.cos(v.angle)+(l.y-v.y)*Math.sin(v.angle),r:l.r,a:l.a}));
  });
  assert.equal(beams.length,2);assert.ok(beams.every(l=>Math.abs(l.ahead-112)<1e-6&&l.r===170&&l.a===.95));
  await page.keyboard.down('s');await page.waitForFunction(()=>DeadSignal.state.vehicles[0].speed< -60);await page.keyboard.up('s');
  const reverseAngle=await page.evaluate(()=>DeadSignal.state.vehicles[0].angle);
  await page.keyboard.down('a');await page.waitForFunction(angle=>DeadSignal.state.vehicles[0].angle>angle+.1,reverseAngle);await page.keyboard.up('a');
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>DeadSignal.state.paused&&DSAudio.status.engines===0);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!DeadSignal.state.paused&&DSAudio.status.engines===1);
  await page.keyboard.press('e');
  await page.waitForFunction(()=>DeadSignal.state.players[0].vehicle===null&&DSAudio.status.engines===0);
  assert.equal(await page.evaluate(()=>{DSLights.begin(DeadSignal.state,DeadSignal.state.camera);return DSLights.lights().filter(l=>l.col==='#ffe9bd').length;}),0);
  assert.deepEqual(errors,[]);
  console.log('PASS browser vehicles: keyboard boarding/driving/braking/reverse/steering/exit, headlights, engine loop pause/resume/stop, no render errors');
}finally{await browser.close();}
