// city_v2 Section 0 evidence: capture the play HUD across viewports, player counts and states, and record
// the persistent panel rectangles plus the camera-safe play rectangle for each capture.
//
//   node tools/hud-matrix.mjs [--out artifacts/city/v2/hud] [--url http://127.0.0.1:4177] [--only 1280x720]
// Needs the dev server (npm run serve) and PLAYWRIGHT_PATH (a default is tried).
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from './pixboot.mjs';

const o=parseArgs(process.argv.slice(2),new Set());
const modulePath=process.env.PLAYWRIGHT_PATH||'C:/Users/daniel/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs';
const {chromium}=await import(pathToFileURL(modulePath).href);
const url=o.url||'http://127.0.0.1:4177',outDir=o.out||'artifacts/city/v2/hud';
await fs.mkdir(outDir,{recursive:true});
const VIEWPORTS=[[1280,720],[1920,1080],[2048,1002],[1024,768]].filter(([w,h])=>!o.only||String(o.only).split(',').includes(w+'x'+h));
const party=n=>`const s=DeadSignal.state;for(let i=1;i<${n};i++)DSGame.addPlayer(s,i%2?'pad:'+i:'test:'+i);s.spawnAcc=-1e9;s.enemies=[];
  for(const p of s.players){p.weapon=['ar','shotgun','flame','smg'][p.id];p.weaponInventory=[{weapon:p.weapon,quality:2,mag:DSGame.WEAPONS[p.weapon].mag}];p.weaponSlot=0;p.backup=false;p.mag=DSGame.WEAPONS[p.weapon].mag;p.invuln=1e9;p.x=(p.id-1.5)*35;p.y=2620+(p.id%2)*35;}
  s.camera.x=0;s.camera.y=2620;s.supplies.provisions=2;s.supplies.vehicleFuel=40;`;
const STATES={
  calm1:{setup:party(1)},
  calm4:{setup:party(4)+`s.players[1].hp=40;s.players[2].medkits=0;s.players[2].hp=55;`},
  upgrades4:{setup:party(4)+`for(const p of s.players)p.upgrades=2;`},
  combat4:{setup:party(4)+`for(const p of s.players)p.auto=true;for(let i=0;i<18;i++)DSGame.spawn(s,i%4?'walker':'runner',Math.cos(i)*260,2620+Math.sin(i)*200);`},
  vehicle4:{setup:party(4)+`const v=s.vehicles.find(q=>q.vehicleType==='fireTruck');v.fuel=v.maxFuel;for(const p of s.players){p.x=v.x+50;p.y=v.y;if(!DSGame.enterVehicle(s,v,p))throw new Error('boarding failed');}`},
  downed4:{setup:party(4)+`const p=s.players[3];p.hp=0;p.dead=true;p.revive=1.2;s.players[0].x=p.x+20;`},
  // PLAYER_POWER Phase 9: fully upgraded co-op loadouts, launcher and grenades, armor states, a carried and a deployed turret
  power4:{setup:party(4)+`const full=w=>({weapon:w,quality:3,mag:DSGame.magFor({weapon:w,attachments:DSGame.ATTACHMENTS[w].map(a=>a.id)}),attachments:DSGame.ATTACHMENTS[w].map(a=>a.id)});s.ammo.grenades=24;
    s.players.forEach((p,i)=>{p.weaponInventory=[['ar','rifle','launcher'],['shotgun','smg','flame'],['launcher','ar','smg'],['rifle','shotgun','ar']][i].map(full);p.weaponSlot=0;Object.assign(p,p.weaponInventory[0]);p.attachments=p.weaponInventory[0].attachments.slice();p.armor=[50,32,9,0][i];});
    s.players[3].armorBroken=1.2;s.players[1].turret={id:901,ammo:60,durability:150};s.turrets=[{id:900,ownerId:0,x:40,y:2560,angle:-.5,ammo:84,durability:90,cd:0,searchCd:0,target:null}];s.players[2].deploying={t:.4};s.players[2].turret={id:902,ammo:120,durability:150};`},
  boss4:{setup:party(4)+`for(const p of s.players){p.x=(p.id-1.5)*40;p.y=140;}DSBoss.start(s,DSGame.api(s));s.boss.hp=s.boss.maxHp*.4;`},
};
const report=[];
const browser=await chromium.launch({headless:true});
for(const [w,h] of VIEWPORTS)for(const [name,st] of Object.entries(STATES)){
  const page=await browser.newPage({viewport:{width:w,height:h}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(url+'/?seed=12345');await page.getByRole('button',{name:'ENTER THE CITY'}).click();
    await page.waitForFunction(()=>window.DeadSignal&&DeadSignal.state.time>.2);
    await page.evaluate(st.setup);await page.waitForTimeout(name==='boss4'?1500:700);
    const file=path.join(outDir,`${w}x${h}-${name}.png`);await page.screenshot({path:file});
    const info=await page.evaluate(()=>{const H=window.DSHud,r=H.report?H.report():null;return r||{legacy:true,layout:H.layout(innerWidth,innerHeight)};});
    report.push({...info,viewport:[w,h],state:name,file,errors});
    console.log(file,errors.length?'ERRORS '+errors.join(' | '):'',info.budget?JSON.stringify(info.budget):JSON.stringify(info.layout||''));
  }catch(e){console.error(`${w}x${h} ${name} failed: ${e.message}`);report.push({viewport:[w,h],state:name,failed:e.message});}
  await page.close();
}
await browser.close();
await fs.writeFile(path.join(outDir,'report.json'),JSON.stringify(report,null,1));
