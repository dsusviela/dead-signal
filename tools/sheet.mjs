// Family sprite sheet on the software canvas: every sprite of a registry
// family drawn on BOTH review grounds at --zoom with its anchor marked, an x2
// in-game read beside it, and a crowd panel per ground (30 seeded sprites at
// x2). Frame sets show their first frame in the row and every frame in a strip.
//
//   node tools/sheet.mjs sprites --family F [--zoom 4] [--out sheet.png] [--tint #hex] [--seed S]
//   node tools/sheet.mjs sprites --family all
// Marks: magenta cross = anchor (x,y) the game draws at; white line = ground
// contact row for 'feet' anchors; cyan box = a tile's 32x32 cell.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {PixCanvas} from './pixcanvas.mjs';
import {parseArgs,writePng,upscale,mulberry32} from './pixboot.mjs';
import {text} from './font.mjs';
import {bootArt,registryTargets} from './art/targets.mjs';
import {grounds} from './art/grounds.mjs';
export {text};

const BOOL=new Set(['help']);

function anchorOf(sp){const a=sp.anchor||'feet';if(a==='feet')return{x:.5,y:1};if(a==='center')return{x:.5,y:.5};if(a==='tile')return{x:0,y:0};return a;}
// one sprite on one ground at z texels per pixel, anchor at the cell centre-bottom third
function cell(item,sp,gr,z,marks,seedI){
  const w=item.spr.width,h=item.spr.height,an=anchorOf(sp);
  const cw=Math.max(24,w+12),ch=Math.max(24,h+14),c=new PixCanvas(cw*z,ch*z),ctx=c.getContext('2d');
  const gx=(seedI*37)%Math.max(1,gr.width-cw-2),gy=(seedI*53)%Math.max(1,gr.height-ch-2);
  ctx.setTransform(z,0,0,z,0,0);ctx.imageSmoothingEnabled=false;
  ctx.drawImage(gr,gx,gy,cw,ch,0,0,cw,ch);
  const ax=Math.round(cw/2),ay=Math.round(ch/2+h*(an.y-.5));
  ctx.drawImage(item.spr,0,0,w,h,ax-Math.round(w*an.x),ay-Math.round(h*an.y),w,h);
  if(marks){
    ctx.setTransform(1,0,0,1,0,0);
    if(an.y===1){ctx.fillStyle='rgba(255,255,255,0.55)';ctx.fillRect(0,ay*z,cw*z,1);}
    if(an.x===0&&an.y===0){ctx.strokeStyle='rgba(80,220,255,0.7)';ctx.lineWidth=1;ctx.strokeRect(ax*z,ay*z,w*z,h*z);}
    ctx.fillStyle='rgba(255,64,255,0.9)';ctx.fillRect(ax*z-3,ay*z,7,1);ctx.fillRect(ax*z,ay*z-3,1,7);
    if(sp.light){ctx.strokeStyle=sp.light.col||'#fff';ctx.lineWidth=1;ctx.beginPath();ctx.arc(ax*z,(ay-h/2)*z,(sp.light.r||8)*z,0,Math.PI*2);ctx.stroke();}
  }
  return c;
}
export function sheetFamily(fam,targets,grs,o){
  const Z=+(o.zoom||4),TH=2,PAD=6,LABW=200;
  const rows=targets.map((t,i)=>{
    const it=t.items[0],sp=t.spec;
    const cells=grs.map(([,gr])=>cell(it,sp,gr,Z,true,i));
    const thumbs=grs.map(([,gr])=>cell(it,sp,gr,TH,false,i));
    const strip=t.items.length>1?t.items.slice(0,16).map(f=>cell(f,sp,grs[0][1],TH,false,i)):[];
    const stripW=strip.reduce((a,c)=>a+c.width+2,0);
    const h=Math.max(cells[0].height,thumbs[0].height,strip.length?strip[0].height:0,14)+PAD;
    const w=LABW+cells[0].width*2+thumbs[0].width*2+stripW+PAD*6;
    return {t,cells,thumbs,strip,h,w};
  });
  // crowd: 30 seeded family sprites at x2 on each ground
  const crowd=grs.map(([,gr],gi)=>{
    const cw=300,chh=150,c=new PixCanvas(cw*TH,chh*TH),ctx=c.getContext('2d');
    ctx.setTransform(TH,0,0,TH,0,0);ctx.imageSmoothingEnabled=false;
    for(let ty=0;ty<chh;ty+=gr.height)for(let tx=0;tx<cw;tx+=gr.width)ctx.drawImage(gr,0,0,gr.width,gr.height,tx,ty,gr.width,gr.height);
    const rng=mulberry32(+(o.seed||7)+gi);
    for(let i=0;i<30&&targets.length;i++){
      const t=targets[(rng()*targets.length)|0],it=t.items[(rng()*t.items.length)|0],an=anchorOf(t.spec);
      const x=Math.round(10+rng()*(cw-20)),y=Math.round(10+rng()*(chh-20));
      ctx.drawImage(it.spr,0,0,it.spr.width,it.spr.height,x-Math.round(it.spr.width*an.x),y-Math.round(it.spr.height*an.y),it.spr.width,it.spr.height);
    }
    return c;
  });
  const HEAD=40,W=Math.max(...rows.map(r=>r.w),crowd[0].width*2+PAD*3),crowdH=crowd[0].height+PAD*2+12;
  const H=HEAD+rows.reduce((a,r)=>a+r.h,0)+crowdH+PAD*2;
  const sheet=new PixCanvas(W,H),sg=sheet.getContext('2d');
  sg.fillStyle='#0b0b10';sg.fillRect(0,0,W,H);
  text(sheet,PAD,PAD,'FAMILY '+fam+'  ZOOM '+Z+'  '+targets.length+' sprites','#ffffff',2);
  text(sheet,PAD,PAD+12,'checklist: 1 texel = 1 world unit  K outline  MAT ramp  reads at x2 on both grounds  frames share dims+pal  light decided','#9aa2ad',1);
  text(sheet,PAD,PAD+20,'marks: magenta cross = anchor, white line = feet row, cyan box = tile cell, ring = light radius','#9aa2ad',1);
  let y=HEAD;
  for(const r of rows){
    const it=r.t.items[0];
    text(sheet,PAD,y+2,r.t.name.slice(0,30),'#ffffff',1);
    text(sheet,PAD,y+10,it.spr.width+'x'+it.spr.height+' '+(r.t.spec.anchor||'feet')+(r.t.items.length>1?' '+r.t.items.length+'f':''),'#9aa2ad',1);
    if(r.t.spec.note)text(sheet,PAD,y+18,String(r.t.spec.note).slice(0,44),'#7c8986',1);
    let x=LABW;
    for(const c of r.cells){sg.setTransform(1,0,0,1,0,0);sg.drawImage(c,x,y);x+=c.width+PAD;}
    for(const c of r.thumbs){sg.setTransform(1,0,0,1,0,0);sg.drawImage(c,x,y);x+=c.width+PAD;}
    for(const c of r.strip){sg.setTransform(1,0,0,1,0,0);sg.drawImage(c,x,y);x+=c.width+2;}
    y+=r.h;
  }
  y+=PAD;text(sheet,PAD,y,'CROWD x2 on both grounds','#ffffff',1);y+=12;
  let x=PAD;for(const c of crowd){sg.setTransform(1,0,0,1,0,0);sg.drawImage(c,x,y);x+=c.width+PAD;}
  return sheet;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const o=parseArgs(process.argv.slice(2),BOOL),cmd=o._[0];
  if(!cmd||o.help||cmd!=='sprites'||!o.family){console.log(fs.readFileSync(new URL(import.meta.url),'utf8').split('\nimport ')[0]);process.exit(cmd?0:2);}
  const {g,A}=bootArt({...o,game:true}),grs=grounds(g);
  const fams=o.family==='all'?A.families():String(o.family).split(',');
  for(const fam of fams){
    const targets=registryTargets(A,{family:fam,_:[],tint:o.tint});
    if(!targets.length){console.error('family '+fam+' has no sprites');continue;}
    const png=sheetFamily(fam,targets,grs,o);
    writePng(png,fams.length===1&&o.out?o.out:path.join(o.out&&!/\.png$/i.test(o.out)?o.out:'.','sheet-'+fam+'.png'));
  }
}
