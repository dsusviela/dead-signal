import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PATH).href);
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4177/?seed=11');
  await page.getByRole('button',{name:'ENTER THE CITY'}).click();
  await page.waitForFunction(()=>DeadSignal.state.time>.2);
  assert.equal(await page.evaluate(()=>DeadSignal.state.settings.drivingStyle),'steering');
  assert.ok(!await page.evaluate(()=>DeadSignal.ui.rects().some(r=>r.id==='sound')),'no sound control remains on the HUD');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>DeadSignal.menu==='pause');
  await page.keyboard.press('ArrowDown');await page.waitForTimeout(80);await page.keyboard.press('ArrowDown');await page.waitForTimeout(80);await page.keyboard.press('Enter');await page.waitForFunction(()=>DeadSignal.menu==='options');
  const pausedAt=await page.evaluate(()=>DeadSignal.state.time);
  await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>DeadSignal.state.settings.drivingStyle==='directional');
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.waitForFunction(()=>DSAudio.musicMuted);
  assert.equal(await page.evaluate(()=>DSAudio.muted),false,'music setting does not mute effects');
  await page.keyboard.press('m');assert.equal(await page.evaluate(()=>DSAudio.musicMuted),true);
  assert.equal(await page.evaluate(()=>DSAudio.muted),false,'M does not control audio in menus');
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.waitForFunction(()=>DSAudio.muted);
  assert.equal(await page.evaluate(()=>DeadSignal.state.time),pausedAt,'changing preferences never advances simulation');
  await fs.mkdir(new URL('../artifacts/options/',import.meta.url),{recursive:true});
  await page.screenshot({path:new URL('../artifacts/options/menu.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')});
  for(const viewport of [{width:1024,height:600},{width:1920,height:600}]){
    await page.setViewportSize(viewport);
    await page.waitForFunction(({width,height})=>DeadSignal.ui.rects().length===6&&DeadSignal.ui.rects().every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=width&&r.y+r.h<=height),viewport);
  }
  await page.screenshot({path:new URL('../artifacts/options/wide.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')});
  const back=await page.evaluate(()=>DeadSignal.ui.rects().find(r=>r.id==='back'));
  await page.mouse.click(back.x+back.w/2,back.y+back.h/2);await page.waitForFunction(()=>DeadSignal.menu==='pause');
  assert.equal(await page.evaluate(()=>DeadSignal.state.paused),true,'Back returns to paused parent');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>DeadSignal.menu===null);
  await page.evaluate(()=>DeadSignal.restart());
  assert.deepEqual(await page.evaluate(()=>[DeadSignal.state.settings.drivingStyle,DSAudio.musicMuted,DSAudio.muted]),['directional',true,true]);
  await page.reload();await page.getByRole('button',{name:'ENTER THE CITY'}).click();
  assert.deepEqual(await page.evaluate(()=>[DeadSignal.state.settings.drivingStyle,DSAudio.musicMuted,DSAudio.muted]),['directional',true,true],'preferences survive reload');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>DeadSignal.menu==='pause');await page.keyboard.press('ArrowDown');await page.waitForTimeout(80);await page.keyboard.press('ArrowDown');await page.waitForTimeout(80);await page.keyboard.press('Enter');await page.waitForFunction(()=>DeadSignal.menu==='options');
  const driving=await page.evaluate(()=>DeadSignal.ui.rects().find(r=>r.id==='driving-style'));
  await page.mouse.click(driving.x+driving.w/2,driving.y+driving.h/2);await page.waitForFunction(()=>DeadSignal.state.settings.drivingStyle==='steering');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>DeadSignal.menu==='pause');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>DeadSignal.menu===null);
  assert.deepEqual(errors,[]);
  console.log('PASS options: default/persisted driving, independent music/master sound, keyboard/mouse navigation, nested pause, viewport bounds, restart/reload, M removed');
}finally{await browser.close();}
