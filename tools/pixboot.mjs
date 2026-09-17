// Node sandbox for the art tools: evaluates the game's classic scripts inside
// a vm with PixCanvas standing in for every canvas, a seeded Math.random, and
// stub DOM/audio. Art tools boot art.js + art/*.js; frame.mjs boots the whole
// game (never main.js, which owns the RAF loop, the DOM and the audio graph).
//
// Software-canvas limits (pixcanvas.mjs): fillText, measureText and
// setLineDash are no-ops and gradients paint nothing, so frames from this
// sandbox have no text, no glow halos, no vignette and no dashed boss tells.
// Verify those through tools/shot.mjs in a real browser.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PixCanvas,readPng} from './pixcanvas.mjs';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function resolveFile(file){
  if(!file)return ROOT+'/art.js';
  if(path.isAbsolute(file))return file;
  if(fs.existsSync(path.resolve(file)))return path.resolve(file);
  return ROOT+'/'+file;
}
export function readSource(file){return fs.readFileSync(resolveFile(file),'utf8');}
// art.js plus every art/<family>.js in name order
export function artFiles(){
  const dir=ROOT+'/art',fam=fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.endsWith('.js')).sort().map(f=>'art/'+f):[];
  return ['art.js',...fam];
}
// the whole game except main.js, in index.html order; absent files are skipped so a phase can land early
export function gameFiles(){
  return artFiles().concat(['city.js','world.js','chunks.js','boss.js','game.js','hud.js','lights.js','render.js'].filter(f=>fs.existsSync(ROOT+'/'+f)));
}

// opts: {files, seed, search, screenW, screenH}
export function bootDS(opts={}){
  const files=opts.files||artFiles();
  const screen=new PixCanvas(opts.screenW||1440,opts.screenH||900);
  const pads=[];
  const M=Object.create(Math);M.random=mulberry32(opts.seed===undefined?1:opts.seed);
  const sandbox={console,Math:M,JSON,Date,Set,Map,WeakSet,WeakMap,Array,Object,String,Number,Boolean,Error,Promise,Symbol,RegExp,
    Uint8ClampedArray,Uint8Array,Int16Array,Int32Array,Float32Array,Float64Array,isNaN,isFinite,parseInt,parseFloat,URLSearchParams,
    setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
    performance:{now:()=>Date.now()},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},
    localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
    navigator:{getGamepads:()=>pads},
    AudioContext:function(){return{currentTime:0,state:'running',destination:{},sampleRate:44100,
      createOscillator:()=>({connect:()=>{},start:()=>{},stop:()=>{},frequency:{setValueAtTime:()=>{},linearRampToValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{}},type:''}),
      createGain:()=>({connect:()=>{},gain:{setValueAtTime:()=>{},setTargetAtTime:()=>{},linearRampToValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{},cancelScheduledValues:()=>{},value:0}}),
      resume:()=>Promise.resolve()};},
    location:{search:opts.search||'',protocol:'file:',href:'file:///index.html'+(opts.search||'')},
  };
  sandbox.webkitAudioContext=sandbox.AudioContext;
  sandbox.Image=class{constructor(){this.onload=null;this._src='';}
    set src(v){this._src=v;const m=/^data:image\/png;base64,(.*)$/.exec(v);if(!m)throw new Error('sandbox Image: data:image/png;base64 only');
      const im=readPng(Buffer.from(m[1],'base64'));this.width=im.width;this.height=im.height;this.get=(x,y)=>im.get(x,y);if(this.onload)this.onload();}
    get src(){return this._src;}};
  sandbox.addEventListener=()=>{};sandbox.removeEventListener=()=>{};
  sandbox.innerWidth=screen.width;sandbox.innerHeight=screen.height;sandbox.devicePixelRatio=1;
  sandbox.window=sandbox;sandbox.globalThis=sandbox;
  sandbox.document={getElementById:()=>screen,querySelector:()=>({style:{},classList:{toggle:()=>{},add:()=>{},remove:()=>{},contains:()=>false}}),
    createElement:t=>t==='canvas'?new PixCanvas(1,1):{style:{},appendChild:()=>{}},
    addEventListener:()=>{},body:{appendChild:()=>{},style:{}},documentElement:{style:{}}};
  const vmctx=vm.createContext(sandbox);
  for(const f of files)vm.runInContext(fs.readFileSync(ROOT+'/'+f,'utf8'),vmctx,{filename:f});
  const ev=e=>vm.runInContext(e,vmctx);
  return {files,screen,pads,vmctx,ev,sandbox,
    has(name){return ev('typeof '+name+'!=="undefined"');},
    addPad(){pads.push({index:pads.length,connected:true,buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0],mapping:'standard'});},
  };
}

// ---- small arg parser shared by the tools ----
// BOOL flags take no value; everything else `--k v`; bare words are positionals
export function parseArgs(argv,BOOL){
  const o={_:[]};
  for(let i=0;i<argv.length;i++){
    const a=argv[i];
    if(a.startsWith('--')){const k=a.slice(2);if(BOOL.has(k)||i+1>=argv.length||argv[i+1].startsWith('--'))o[k]=true;else o[k]=argv[++i];}
    else o._.push(a);
  }
  return o;
}
export function writePng(canvas,out){
  const abs=path.resolve(out);
  fs.mkdirSync(path.dirname(abs),{recursive:true});
  fs.writeFileSync(abs,canvas.png());
  console.log('wrote',abs,canvas.width+'x'+canvas.height);
  return abs;
}
// box-filter downsample by an integer K (alpha-weighted colour average)
export function downsample(src,K){
  const w=Math.floor(src.width/K),h=Math.floor(src.height/K),out=new PixCanvas(w,h),d=out.data,s=src.data,sw=src.width;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let r=0,g=0,b=0,a=0;
    for(let j=0;j<K;j++)for(let i=0;i<K;i++){const o=((y*K+j)*sw+x*K+i)*4,al=s[o+3];r+=s[o]*al;g+=s[o+1]*al;b+=s[o+2]*al;a+=al;}
    const o=(y*w+x)*4;if(a>0){d[o]=r/a;d[o+1]=g/a;d[o+2]=b/a;}d[o+3]=a/(K*K);
  }
  return out;
}
// nearest upscale by an integer Z
export function upscale(src,Z){
  if(Z===1)return src;
  const out=new PixCanvas(src.width*Z,src.height*Z);
  out.getContext('2d').drawImage(src,0,0,src.width*Z,src.height*Z);
  return out;
}
export function crop(src,x,y,w,h){
  const out=new PixCanvas(w,h);
  out.getContext('2d').drawImage(src,x,y,w,h,0,0,w,h);
  return out;
}
// mean/max abs channel diff and % of pixels with any channel > 8 apart
export function comparePng(a,b){
  if(a.width!==b.width||a.height!==b.height)return {error:'size mismatch '+a.width+'x'+a.height+' vs '+b.width+'x'+b.height};
  let sum=0,max=0,over=0;const n=a.width*a.height;
  for(let i=0;i<n;i++){
    const o=i*4;let px=0;
    for(let c=0;c<3;c++){const d=Math.abs(a.data[o+c]*a.data[o+3]-b.data[o+c]*b.data[o+3]);sum+=d;if(d>max)max=d;if(d>px)px=d;}
    if(px>8)over++;
  }
  return {mean:sum/(n*3),max,pctOver8:100*over/n,pixels:n};
}
