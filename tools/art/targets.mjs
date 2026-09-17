// Boots the art registry and resolves families, sprite ids or a sketch JSON
// into lint/preview/sheet targets:
//   {name, spec, items:[{label,spr,rows,pal,den}], groups:[[item,...],...]}
// items are every row set the spec flattens to (frames, variants, mask
// pieces); groups are animation sets in play order (one per facing), which
// the frame lint compares pairwise. Variants and mask pieces are not groups.
import fs from 'node:fs';
import path from 'node:path';
import {bootDS,artFiles,gameFiles} from '../pixboot.mjs';
import {canvasFromRows} from './pix.mjs';

export const DEFAULT_TINT='#46d7bd';

export function bootArt(o={}){
  const g=bootDS({files:o.game?gameFiles():artFiles(),seed:+(o.seed||1)});
  return {g,A:g.ev('DSArt')};
}
// sprite ids from --family (or 'all') and positionals (ids or bare names)
export function pickIds(A,o){
  const ids=[];
  if(o.family){const fams=o.family==='all'?A.families():String(o.family).split(',');
    for(const f of fams){if(!A.families().includes(f))throw new Error('unknown family '+f+'; have '+A.families().join('|')||'(none defined)');ids.push(...A.list(f).map(s=>s.id));}}
  for(const p of o._||[])for(const n of p.split(',')){if(!n)continue;const sp=A.spec(n);if(!sp)throw new Error('unknown sprite '+n);ids.push(sp.id);}
  return [...new Set(ids)];
}
export function specTarget(A,sp,tint){
  const pal=A.palette(sp,tint||DEFAULT_TINT),den=sp.den||1,items=[],groups=[];
  const mk=(label,rows)=>({label,spr:canvasFromRows(Array.from(rows),pal,den),rows:Array.from(rows),pal,den});
  if(sp.frames){for(const dir of Object.keys(sp.frames)){const grp=Array.from(sp.frames[dir]).map((r,i)=>mk(sp.id+'.'+dir+'['+i+']',r));items.push(...grp);groups.push(grp);}}
  else if(sp.variants)Array.from(sp.variants).forEach((r,i)=>items.push(mk(sp.id+'['+i+']',r)));
  else if(sp.mask)Array.from(sp.mask).forEach((r,i)=>items.push(mk(sp.id+'.m'+i,r)));
  else items.push(mk(sp.id,sp.rows));
  return {name:sp.id,spec:sp,items,groups};
}
export function registryTargets(A,o){
  return pickIds(A,o).map(id=>specTarget(A,A.spec(id),o.tint));
}
// a sketch JSON: {rows,pal,den} or {name:{rows,pal,den},...} or [{rows,pal,den},...] (frames)
export function sketchTargets(file){
  const j=JSON.parse(fs.readFileSync(file,'utf8')),base=path.basename(file,'.json'),out=[];
  const rowsOf=s=>Array.isArray(s.rows)?s.rows:String(s.rows).split('|');
  const mk=(name,s)=>({label:name,spr:canvasFromRows(rowsOf(s),s.pal,s.den||1),rows:rowsOf(s),pal:s.pal,den:s.den||1});
  if(Array.isArray(j)){const items=j.map((s,i)=>mk(base+'['+i+']',s));out.push({name:base,items,groups:[items]});}
  else if(j.rows)out.push({name:base,items:[mk(base,j)],groups:[]});
  else for(const [k,s] of Object.entries(j)){if(Array.isArray(s)){const items=s.map((f,i)=>mk(k+'['+i+']',f));out.push({name:k,items,groups:[items]});}else out.push({name:k,items:[mk(k,s)],groups:[]});}
  return out;
}
