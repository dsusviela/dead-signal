// A live composed frame through the real DSRender.scene on the software canvas
// (no text, no glows, no vignette, no dashes: see pixboot.mjs). Builds a game
// state in node, dresses a scene, steps the simulation a little and renders.
//
//   node tools/frame.mjs [out.png] [--scene street|boss|radio|house|barricade|quarantine]
//        [--seed 12345] [--np 4] [--w 1440] [--h 900] [--steps 90]
//        [--crop x,y,w,h] [--zoom Z]
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {bootDS,gameFiles,parseArgs,writePng,upscale,crop} from './pixboot.mjs';

const BOOL=new Set(['help']);

// scene setups run inside the sandbox; they receive the state and the globals
export const SCENES={
  street:`(s)=>{for(const p of s.players){p.weapon=['ar','shotgun','flame','smg'][p.id%4];p.backup=false;p.mag=DSGame.WEAPONS[p.weapon].mag;p.x=(p.id-1.5)*35;p.y=2620+(p.id%2)*35;p.invuln=100;p.angle=-Math.PI/2+p.id*.9;}
    s.camera.x=0;s.camera.y=2620;
    for(let i=0;i<22;i++)DSGame.spawn(s,i%4===0?'brute':i%3===0?'runner':i%5===0?'ghost':'walker',(i%6-3)*110,2450+(i%4)*40);}`,
  boss:`(s)=>{for(const p of s.players){p.weapon=['ar','shotgun','flame','smg'][p.id%4];p.backup=false;p.mag=DSGame.WEAPONS[p.weapon].mag;p.x=(p.id-1.5)*40;p.y=140;p.invuln=100;}
    DSBoss.start(s,DSGame.api(s));s.boss.hp=s.boss.maxHp*.3;s.camera.x=0;s.camera.y=0;}`,
  radio:`(s)=>{const r=s.world.landmarks.find(l=>l.id==='radio');for(const p of s.players){p.x=r.x+(p.id-1.5)*30;p.y=r.y+70;p.invuln=100;}s.camera.x=r.x;s.camera.y=r.y;s.radio.active=true;s.radio.progress=18;}`,
  quarantine:`(s)=>{for(const p of s.players){p.x=(p.id-1.5)*30;p.y=560;p.invuln=100;}s.camera.x=0;s.camera.y=520;}`,
  house:`(s)=>{const h=(s.world.buildings||[])[0];if(!h)throw new Error('no houses in this world yet');for(const p of s.players){p.x=h.x+h.w/2+(p.id-1.5)*20;p.y=h.y+h.h/2;p.invuln=100;}s.camera.x=h.x+h.w/2;s.camera.y=h.y+h.h/2;
    for(let i=0;i<3;i++)DSGame.spawn(s,'walker',h.x+h.w/2+(i-1)*30,h.y+h.h+60);}`,
  barricade:`(s)=>{const b=(s.world.setpieces||[]).find(p=>p.kind==='barricade');if(!b)throw new Error('no barricade set pieces yet');for(const p of s.players){p.x=b.x+(p.id-1.5)*30;p.y=b.y+120;p.invuln=100;}s.camera.x=b.x;s.camera.y=b.y;}`,
};

export function runFrame(o={}){
  const W=+(o.w||1440),H=+(o.h||900),np=+(o.np||4),steps=+(o.steps||90);
  const g=bootDS({files:gameFiles(),seed:+(o.seed||12345),screenW:W,screenH:H});
  const setup=SCENES[o.scene||'street'];if(!setup)throw new Error('unknown scene '+o.scene+'; have '+Object.keys(SCENES).join('|'));
  const s=g.ev('(()=>{const s=DSGame.create('+(+(o.seed||12345))+');s.mode="play";return s;})()');
  for(let i=0;i<np;i++)g.ev('DSGame.addPlayer')(s,i?'test:'+i:'keyboard');
  g.ev('('+setup+')')(s);
  const viewport=g.has('DSHud')?g.ev('DSHud.layout')(W,H):{top:H>760?68:60,bottom:H>760?170:160};
  const aspect=W/Math.max(160,H-viewport.top-viewport.bottom);
  for(let i=0;i<steps;i++)g.ev('DSGame.step')(s,1/60,{},aspect);
  // lock the camera on the scene after the step settles it
  const ctx=g.screen.getContext('2d');
  g.ev('DSRender.scene')(ctx,s,W,H,viewport);
  if(g.has('DSHud'))g.ev('DSHud.draw')(ctx,s,W,H,{menu:null,focus:0});
  return {g,s,screen:g.screen};
}
export function finish(c,o){
  if(o.crop){const [x,y,w,h]=String(o.crop).split(',').map(Number);c=crop(c,x,y,w,h);}
  if(o.zoom&&+o.zoom>1)c=upscale(c,+o.zoom);
  return c;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const o=parseArgs(process.argv.slice(2),BOOL);
  if(o.help){console.log(fs.readFileSync(new URL(import.meta.url),'utf8').split('\nimport ')[0]);process.exit(0);}
  const out=o._[0]||o.out||'frame.png';
  const r=runFrame(o);
  writePng(finish(r.screen,o),out);
}
