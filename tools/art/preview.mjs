// Review preview for one or more sprites: the texels at a big zoom with a grid
// (every texel, ember line every 8) on BOTH review grounds, the in-game read
// (x2: one texel is about two screen pixels at the default camera), the
// palette legend, and a frame strip when the sprite is a frame set. The rows
// are printed as text with the legend so picture and grid read side by side
// (rule 63).
//
//   node tools/art/preview.mjs ID[,ID..] [--zoom Z] [--out dir|file.png] [--tint #hex]
//   node tools/art/preview.mjs --json sketch.json [--zoom Z] [--out ..]     ({rows,pal,den} before it is in any file)
//   node tools/art/preview.mjs --family props                             (every sprite of the family)
// Zoom defaults to the largest of 4..24 that keeps a panel under ~600 px.
// Output: preview-<id>.png in --out (a dir) or the cwd; --out file.png for a single id.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {PixCanvas} from '../pixcanvas.mjs';
import {parseArgs,writePng,upscale} from '../pixboot.mjs';
import {text} from '../font.mjs';
import {bootArt,registryTargets,sketchTargets} from './targets.mjs';
import {grounds,CHPX} from './grounds.mjs';

const BOOL=new Set(['help','quiet']);

// sprite on a ground crop, 2 texels of padding
function panel(spr,gr,seed){
  const w=spr.width,h=spr.height,pad=2;
  const pw=w+pad*2,ph=h+pad*2,c=new PixCanvas(pw,ph),ctx=c.getContext('2d');
  const gx=((seed*37)%Math.max(1,gr.width-pw-2)),gy=((seed*53)%Math.max(1,gr.height-ph-2));
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(gr,gx,gy,pw,ph,0,0,pw,ph);
  ctx.drawImage(spr,0,0,w,h,pad,pad,w,h);
  return {c,pad,w,h};
}
function grid(c,step,pad){
  const g=c.getContext('2d');g.setTransform(1,0,0,1,0,0);
  const minor='rgba(255,255,255,0.16)',major='rgba(255,144,64,0.6)';
  for(let x=pad;x<=c.width-pad+0.01;x+=step){const i=Math.round((x-pad)/step);g.fillStyle=i%8?minor:major;g.fillRect(Math.round(x),0,1,c.height);}
  for(let y=pad;y<=c.height-pad+0.01;y+=step){const i=Math.round((y-pad)/step);g.fillStyle=i%8?minor:major;g.fillRect(0,Math.round(y),c.width,1);}
}
// tiles: a 6x4 field of the variants (or the mask pieces around a 4x2 island) at x2, to read seams
function tilePanel(t){
  const sp=t.spec;if(!sp||sp.anchor!=='tile')return null;
  const w=t.items[0].spr.width,h=t.items[0].spr.height,cols=6,rowsN=4,c=new PixCanvas(w*cols,h*rowsN),g=c.getContext('2d');
  g.fillStyle='#182421';g.fillRect(0,0,c.width,c.height);
  for(let y=0;y<rowsN;y++)for(let x=0;x<cols;x++){
    let it;
    if(sp.mask){const inside=x>=1&&x<=4&&y>=1&&y<=2;if(!inside)continue;
      const m=(y===1?1:0)|(x===4?2:0)|(y===2?4:0)|(x===1?8:0);it=t.items[m];}
    else it=t.items[(x*7+y*3+x*y)%t.items.length];
    g.drawImage(it.spr,0,0,w,h,x*w,y*h,w,h);
  }
  return upscale(c,2);
}
export function previewTarget(t,grs,o){
  const it=t.items[0],spr=it.spr,dims=spr.width+'x'+spr.height+' den'+(it.den||1);
  const tiles=tilePanel(t);
  const Z=+(o.zoom||Math.max(4,Math.min(24,Math.floor(600/Math.max(spr.width,spr.height)))));
  const PAD=8,LEG=14;
  const big=grs.map(([lb,gr],i)=>{const p=panel(spr,gr,i+1);const c=upscale(p.c,Z);grid(c,Z,p.pad*Z);return [lb,c];});
  const thumbs=grs.map(([lb,gr])=>['x2 '+lb,upscale(panel(spr,gr,3).c,2)]);
  const legend=Object.entries(it.pal).filter(([k])=>it.rows.some(r=>r.includes(k)));
  const frames=t.groups.length?t.groups.flat():t.items.length>1?t.items:[];
  const FZ=Math.max(2,Math.min(Z,6,Math.floor(1500/Math.max(1,Math.min(16,frames.length))/(spr.width+4))));
  const fstrip=frames.slice(0,16).map(f=>{const p=panel(f.spr,grs[0][1],5);const c=upscale(p.c,FZ);grid(c,FZ,p.pad*FZ);return [f.label.slice(t.name.length),c];});
  const bigW=big.reduce((a,[,c])=>a+c.width+PAD,0),thW=thumbs.reduce((a,[,c])=>a+c.width+PAD,0),fsW=fstrip.reduce((a,[,c])=>a+c.width+PAD,0);
  const W=Math.max(bigW,thW,fsW,legend.length*70,420,tiles?tiles.width:0)+PAD*2;
  const bigH=Math.max(...big.map(([,c])=>c.height)),thH=Math.max(...thumbs.map(([,c])=>c.height)),fsH=fstrip.length?Math.max(...fstrip.map(([,c])=>c.height))+LEG:0;
  const legRows=Math.ceil(legend.length/Math.max(1,Math.floor((W-PAD*2)/70)));
  const H=40+bigH+LEG+PAD+thH+LEG+PAD+legRows*16+PAD+(fsH?fsH+PAD+LEG:0)+(tiles?tiles.height+PAD+LEG:0)+PAD;
  const out=new PixCanvas(W,H),g=out.getContext('2d');
  g.fillStyle='#0b0b10';g.fillRect(0,0,W,H);
  text(out,PAD,PAD,t.name.slice(0,40)+'  '+dims+'  ZOOM '+Z,'#ffffff',2);
  text(out,PAD,PAD+16,'grid: 1 texel, ember every 8 - x2 = in-game read (about 2 screen px per texel)','#9aa2ad',1);
  let y=40,x=PAD;
  for(const [lb,c] of big){g.setTransform(1,0,0,1,0,0);g.drawImage(c,x,y);text(out,x,y+c.height+2,lb,'#c9a4ff',1);x+=c.width+PAD;}
  y+=bigH+LEG+PAD;x=PAD;
  for(const [lb,c] of thumbs){g.setTransform(1,0,0,1,0,0);g.drawImage(c,x,y);text(out,x,y+c.height+2,lb,'#c9a4ff',1);x+=c.width+PAD;}
  y+=thH+LEG+PAD;x=PAD;
  for(const [k,h] of legend){if(x+66>W){x=PAD;y+=16;}g.fillStyle=h;g.fillRect(x,y,12,12);text(out,x+15,y+3,k+' '+h,'#ffffff',1);x+=70;}
  y+=16+PAD;
  if(fstrip.length){text(out,PAD,y,'FRAMES ('+frames.length+') x'+FZ,'#ffffff',1);y+=LEG;x=PAD;
    for(const [lb,c] of fstrip){g.setTransform(1,0,0,1,0,0);g.drawImage(c,x,y);text(out,x,y+c.height+2,lb.slice(0,12),'#9aa2ad',1);x+=c.width+PAD;}
    y+=fsH+PAD;}
  if(tiles){text(out,PAD,y,t.spec.mask?'MASK PIECES around an island x2 (bits N1 E2 S4 W8 = that side faces outside)':'TILED x2 (variants by position): read the seams','#ffffff',1);y+=LEG;
    g.setTransform(1,0,0,1,0,0);g.drawImage(tiles,PAD,y);}
  const txt=[t.name+' '+dims+(t.items.length>1?' ('+t.items.length+' items)':'')];
  const show=frames.length&&frames.length<=8?frames:[it];
  for(const f of show){if(show.length>1)txt.push('-- '+f.label);txt.push(...f.rows);}
  txt.push('pal '+legend.map(([k,h])=>k+'='+h).join(' '));
  return {png:out,txt:txt.join('\n')};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const o=parseArgs(process.argv.slice(2),BOOL);
  if(o.help||(!o._.length&&!o.family&&!o.json)){console.log(fs.readFileSync(new URL(import.meta.url),'utf8').split('\nimport ')[0]);process.exit(2);}
  const {g,A}=bootArt({...o,game:true}),grs=grounds(g);
  const targets=o.json?sketchTargets(o.json):registryTargets(A,o);
  if(!targets.length){console.error('nothing to preview');process.exit(2);}
  const outIsFile=o.out&&/\.png$/i.test(o.out)&&targets.length===1;
  for(const t of targets){
    const {png,txt}=previewTarget(t,grs,o);
    const dest=outIsFile?o.out:path.join(o.out||'.','preview-'+t.name.replace(/[^\w.-]/g,'_')+'.png');
    if(!o.quiet)console.log(txt);
    writePng(png,dest);
  }
}
