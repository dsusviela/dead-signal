// Sprite lint: the mechanical half of the pixel-art rules
// (~/.claude/skills/pixel-art/rules.md) on the rows of a registry sprite or a sketch.
//   errors  ragged rows, letters missing from pal, magenta fallback, frame dims differ
//   warns   colour count over the size budget, pure #000/#fff, >4 orphan texels, hugging runs
//           (banding), no K outline on a small sprite, low value contrast vs both grounds,
//           frame IoU < 0.85, bbox drift > 6/3 px, frame palettes differ
//   info    size / colours / outline coverage / contrast numbers
//
//   node tools/art/lint.mjs --family props|tiles|..|all       every sprite of a family
//   node tools/art/lint.mjs props/hydrant,survivors/body       named sprites (id or bare name)
//   node tools/art/lint.mjs --json sketch.json                 {rows,pal,den} | {name:{..}} | [frames]
//   --budget f.json   warnings fail only where a sprite exceeds its recorded count (--write-budget records)
//   --strict   warnings fail too      --quiet   errors and warnings only      --tint #hex   survivor tint
// Exit 1 on errors (or warnings with --strict).
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from '../pixboot.mjs';
import {lintRows,lintFrames,formatIssues} from './pix.mjs';
import {bootArt,registryTargets,sketchTargets} from './targets.mjs';

const BOOL=new Set(['help','strict','quiet','write-budget']);

export function lintTarget(t){
  const out=[],seen=new Set();
  for(const it of t.items){
    const key=it.rows.join('|');if(seen.has(key))continue;seen.add(key);
    out.push({label:it.label,issues:lintRows(it.rows,it.pal,{den:it.den})});
  }
  for(const grp of t.groups)if(grp.length>1)out.push({label:grp[0].label+' .. '+grp[grp.length-1].label,issues:lintFrames(grp)});
  return out;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const o=parseArgs(process.argv.slice(2),BOOL);
  if(o.help||(!o._.length&&!o.family&&!o.json)){console.log(fs.readFileSync(new URL(import.meta.url),'utf8').split('\nimport ')[0]);process.exit(2);}
  let targets=[];
  if(o.json)targets=sketchTargets(o.json);
  else{const {A}=bootArt(o);targets=registryTargets(A,o);}
  let errors=0,warns=0,over=[];const counts={};
  const budget=o.budget&&!o['write-budget']&&fs.existsSync(o.budget)?JSON.parse(fs.readFileSync(o.budget,'utf8')):null;
  for(const t of targets){
    for(const {label,issues} of lintTarget(t)){
      const w=issues.filter(i=>i.level==='warn').length;if(w)counts[label]=w;
      if(budget&&w>(budget[label]||0))over.push(label+' '+w+'>'+(budget[label]||0));
      const shown=o.quiet?issues.filter(i=>i.level!=='info'):issues;
      errors+=issues.filter(i=>i.level==='error').length;warns+=issues.filter(i=>i.level==='warn').length;
      if(shown.length||!o.quiet)console.log(label+'\n'+formatIssues(label,shown));
    }
  }
  console.log('\n'+targets.length+' target(s): '+errors+' error(s), '+warns+' warning(s)');
  if(o.budget&&o['write-budget']){fs.writeFileSync(o.budget,JSON.stringify(counts,null,1)+String.fromCharCode(10));console.log('budget written: '+o.budget);}
  if(budget){console.log(over.length?'over warning budget: '+over.join('; '):'within warning budget ('+o.budget+')');}
  process.exit(errors||(o.strict&&warns)||over.length?1:0);
}
