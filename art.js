(function(root){
  'use strict';

  // Sprite registry. Art families live in art/<family>.js and call
  // DSArt.define(family, specs). A spec is one of
  //   {rows:[...]}                       one static sprite
  //   {frames:{down:[rows..],up:[..],side:[..]}, fps}   facings x walk frames
  //   {variants:[rows..]}                hash-picked ground/roof variants
  //   {mask:[rows x16]}                  edge bitmask N|E|S|W = 1|2|4|8
  // plus pal ('MAT.name' | {letter:hex} | tint=>palette), anchor ('feet' |
  // 'center' | 'tile' | {x,y}), den (default 1: one texel per world unit),
  // light {r,col,a} for the lighting pass, and a free-text note.
  // Rows are strings of palette letters, '.' transparent; a pipe-joined
  // string is accepted in place of an array.
  var DEN=2; // legacy density of the SPECS table below (two world units per texel)
  var MAT={
    basalt:{K:'#0a1014',D:'#111b20',M:'#18262b',L:'#26383d',H:'#3b5053'},
    road:{K:'#0b1216',D:'#121c21',M:'#19262b',L:'#26363b',H:'#405155'},
    grave:{K:'#100e24',D:'#28213f',M:'#4b3f69',L:'#786b91',H:'#ada5c2',W:'#e3ddf5'},
    rot:{K:'#10170e',D:'#263422',M:'#485943',L:'#75846c',H:'#aeb99b',W:'#e2e7cc'},
    ember:{K:'#180b08',D:'#4b170f',M:'#8b2b1d',L:'#ff543b',O:'#ff7b35',Y:'#ffd249',W:'#fff0bd'},
    iron:{K:'#0b1014',D:'#1b222a',M:'#3a444e',L:'#69737d',H:'#a0a8ae',R:'#8f3d29',O:'#ff6a2a',Y:'#ffad36',W:'#fff0bd'},
    loot:{K:'#0b1216',D:'#26302d',M:'#59645a',L:'#b9c1a9',C:'#79e2cf',G:'#9fd39f',Y:'#ffd249',O:'#ff8b3d',W:'#f5f0d9',
      A:'#3e8948',B:'#6e1f1a',E:'#d1453a',F:'#8fe07a',H:'#ffb877',I:'#8a231d',J:'#10151a',
      N:'#120f0d',P:'#a6a4a0',Q:'#7f7a73',R:'#59534b',S:'#1d080a',T:'#4d201c',U:'#794332',V:'#9d6f56',
      X:'#b98c03',Z:'#5c5433',c:'#339c89',d:'#1b222a',m:'#3a444e',o:'#af3b00'},
    // material ramps (tools/art/ramp.mjs, OKLCH L 0.17..0.72, hue shift 22)
    asphalt:{K:'#0c1013',D:'#273237',M:'#48575b',L:'#707e80',H:'#9ea6a6'},
    concrete:{K:'#120f0d',D:'#352e29',M:'#59534b',L:'#7f7a73',H:'#a6a4a0'},
    brick:{K:'#1d070f',D:'#4f1c26',M:'#7e3e3d',L:'#a46a5d',H:'#bb9d90'},
    rust:{K:'#20050c',D:'#56151e',M:'#863730',L:'#ab6650',H:'#bf9c89'},
    glass:{K:'#021217',D:'#01373c',M:'#245e5e',L:'#57857e',H:'#94aaa3'},
    wood:{K:'#1d080a',D:'#4d201c',M:'#794332',L:'#9d6f56',H:'#b6a08e'},
    sandbag:{K:'#1a0b09',D:'#46261c',M:'#6f4a35',L:'#92745c',H:'#afa293'},
    olive:{K:'#0f1106',D:'#323116',M:'#5c5433',L:'#87795e',H:'#ada396'},
    blood:{K:'#200314',D:'#580b2e',M:'#8c2d43',L:'#b45e5e',H:'#c7988e'}
  };

  function rows(source){return Array.isArray(source)?source:String(source).split('|');}
  function makeSprite(source,palette,den){
    var data=rows(source),w=data[0].length,h=data.length,i,x,y,ch;
    for(i=0;i<h;i++)if(data[i].length!==w)throw new Error('Ragged sprite row '+i+' ('+data[i].length+' != '+w+')');
    var c=document.createElement('canvas'),g=c.getContext('2d');den=den||1;c.width=w*den;c.height=h*den;g.imageSmoothingEnabled=false;
    for(y=0;y<h;y++)for(x=0;x<w;x++){ch=data[y][x];if(ch==='.'||ch===' ')continue;if(!palette[ch])throw new Error('Unknown sprite colour '+ch);g.fillStyle=palette[ch];g.fillRect(x*den,y*den,den,den);}
    return{canvas:c,w:c.width,h:c.height};
  }

  // Legacy den-2 sprites; each family migrates to art/<family>.js and is then removed here.
  var SPECS={
    survivorA:{pal:'survivor',rows:rows(
      '................|......KKKK......|.....KDDDDK.....|....KDLLLLDK....|....KDLHLLDK....|.....KDDDDK.....|....KKKCCKKK....|....KCCCCCCK....|...KKCCDDCCKK...|...KCCCCCCCCK...|....KCCCCCCK....|...KKDCCDCKK....|.....KDKKDK.....|....KK....KK....|....KD....DK....|...KKK....KKK...|...KDK....KDK...|................')},
    survivorB:{pal:'survivor',rows:rows(
      '................|......KKKK......|.....KDDDDK.....|....KDLLLLDK....|....KDLHLLDK....|.....KDDDDK.....|....KKKCCKKK....|....KCCCCCCK....|...KKCCDDCCKK...|...KCCCCCCCCK...|....KCCCCCCK....|.....KDCCDK.....|....KKDKKD......|....KD..KK......|...KKK...KD.....|...KDK..KKK.....|........KDK.....|................')},
    down:{pal:'survivor',rows:rows(
      '................|................|................|................|................|................|................|................|................|...KKKKKKKKK....|..KDDCCCCDDDK...|.KDDCCCCCCCCDK..|.KDCLCCCCCCDK...|..KDDDDDDDDDK...|...KKKKKKKKK....|................|................|................')},
    walkerA:{pal:'rot',rows:rows(
      '................|.....KKKKKK.....|....KDDDDDDK....|...KDMMMMMMDK...|...KDMLMHMMDK...|....KMMMMMMK....|...KKDMMMMDKK...|..KDMMMMMMMMMK..|..KMMMMMMMMMMK..|..KDMMDDDDMMDK..|...KMMK..KMMK...|...KDDK..KDDK...|..KKK......KKK..|..KDK......KDK..|................|................')},
    walkerB:{pal:'rot',rows:rows(
      '................|.....KKKKKK.....|....KDDDDDDK....|...KDMMMMMMDK...|...KDMMHMLMDK...|....KMMMMMMK....|...KKDMMMMDKK...|..KDMMMMMMMMMK..|..KMMMMMMMMMMK..|...KMMDDDDMMK...|....KMK..KMDK...|....KDK.KDDK....|....KKK.KKK.....|.......KDK......|................|................')},
    runnerA:{pal:'grave',rows:rows(
      '..............|.....KKKK.....|....KDDDDK....|...KDMMMMDK...|...KMLHHLMK...|....KMMMMK....|..KKDMMMMDKK..|.KDMMMMMMMMMK.|.KMMMMMMMMMMK.|..KMDK..KDMK..|...KK....KK...|..KDK....KDK..|.KKK......KKK.|..............')},
    runnerB:{pal:'grave',rows:rows(
      '..............|.....KKKK.....|....KDDDDK....|...KDMMMMDK...|...KMLHHLMK...|....KMMMMK....|..KKDMMMMDKK..|.KDMMMMMMMMMK.|.KMMMMMMMMMMK.|...KDK.KDMK...|....KK.KK.....|...KDK.KDK....|..KKK...KKK...|..............')},
    ghostA:{pal:'ghost',rows:rows(
      '..................|.......KKKK.......|.....KKDDDDKK.....|....KDMMMMMMDK....|...KDMLWMLWMDK....|...KMMMMMMMMMMK...|..KDMMMMMMMMMMDK..|..KMMMMMMMMMMMMK..|..KMMMMMMMMMMMMK..|..KDMMMMMMMMMMDK..|...KMMMMMMMMMMK...|...KMMKMMKMMMK....|....KK.KK.KK......|....K..KK..K......|..................|..................')},
    ghostB:{pal:'ghost',rows:rows(
      '..................|.......KKKK.......|.....KKDDDDKK.....|....KDMMMMMMDK....|...KDMLWMLWMDK....|...KMMMMMMMMMMK...|..KDMMMMMMMMMMDK..|..KMMMMMMMMMMMMK..|..KMMMMMMMMMMMMK..|...KMMMMMMMMMMK...|...KMMKMMMMMMK....|....KK.KMMK.KK....|......KK..K.......|..................|..................|..................')},
    bruteA:{pal:'brute',rows:rows(
      '........................|........KKKKKK..........|.......KDDDDDDK.........|......KDMMMMMMDK........|.....KDMLHHLMMMDK.......|......KMMMMMMMMK........|...KKKKDMMMMMDKKKK......|..KDDDDMMMMMMMMDDDK.....|.KDMMMMMMMMMMMMMMMMDK...|.KMMMMMMMMMMMMMMMMMMK...|KDDMMMMMMDDDDMMMMMMDDK..|KMMMMMMMK....KMMMMMMMK..|KDMMMMMK....KMMMMMMMDK..|.KMMMMMDK....KDMMMMMK...|..KDDDDK......KDDDDK....|..KKKKK........KKKKK....|..KDDDK........KDDDK....|.KKKKK..........KKKKK...|........................|........................')},
    bruteB:{pal:'brute',rows:rows(
      '........................|........KKKKKK..........|.......KDDDDDDK.........|......KDMMMMMMDK........|.....KDMMHHLMMMDK.......|......KMMMMMMMMK........|...KKKKDMMMMMDKKKK......|..KDDDDMMMMMMMMDDDK.....|.KDMMMMMMMMMMMMMMMMDK...|.KMMMMMMMMMMMMMMMMMMK...|KDDMMMMMMDDDDMMMMMMDDK..|KMMMMMMMK....KMMMMMMMK..|.KDMMMMK....KMMMMMMDK...|..KMMMMK......KMMMMK....|...KDDDK......KDDDK.....|...KKKKK......KKKKK.....|....KDDDK....KDDDK......|...KKKKK......KKKKK.....|........................|........................')},
    carrier:{pal:'carrier',rows:rows(
      '..................|......KKKKKK......|.....KDDDDDDK.....|....KDMMMMMMDK....|....KMLHHLMMK.....|.....KMMMMMK......|...KKDDMMDDKK.....|..KDDMMMMMMMMDK...|.KDMMMYYYYMMMMDK..|.KMMMMYWWYMMMMK...|.KDMMMYWWYMMMMDK..|..KDDMYYYYMDDK....|...KMMMMMMMMK.....|...KMMK..KMMK.....|...KDDK..KDDK.....|..KKK....KKK......|..KDK....KDK......|..................')},
    medkit:{pal:'loot',rows:rows(
      '............|....KKKK....|...KDDDDK...|..KDGWWGDK..|..KDWWWWDK..|..KDGWWGDK..|..KDDDDDDK..|..KGGGGGGK..|...KKKKKK...|............')},
    ammo:{pal:'loot',rows:rows(
      '............|...KKKKKK...|..KDDDDDDK..|..KDYYYYDK..|..KDYDDYDK..|..KDYDDYDK..|..KDYDDYDK..|..KDDDDDDK..|...KKKKKK...|............')},
    fuel:{pal:'loot',rows:rows(
      '............|....KKKK....|...KDDDDK...|..KKDDDDKK..|..KDOOOODK..|..KDOWWODK..|..KDOOOODK..|..KDDDDDDK..|...KKKKKK...|............')},
    weapon:{pal:'loot',rows:rows(
      '................|................|...KKKKKKKKK....|..KDDLLLLLLDK...|..KDLLLLLLDKKK..|...KKKKKDDDDDK..|.......KDDKK....|.......KKK......|................|................')},
    furnace:{pal:'iron',rows:rows(
      '................................|...........KKKKKK...............|.........KKDDDDDDKK.............|........KDRRRRRRRRDK............|.......KDRRMMMMMMRRDK...........|....KKKKDMMMMMMMMMMDKKKK........|...KDDDDMMMMMMMMMMMMDDDDK.......|..KDMMMMMMMMMMMMMMMMMMMMDK......|.KDMMMMMMLLLLLLMMMMMMMMMMDK.....|.KMMMMMMLHLLLLHLMMMMMMMMMMK.....|KDDMMMMMMLLLLLLMMMMMMMMMMDDK....|KMMMMMMMMMMMMMMMMMMMMMMMMMMK....|KDMMMMMKKKKKKKKKKMMMMMMMMMDK....|KMMMMMKDOOOOOOOODKMMMMMMMMMK....|KDMMMMKDOYYYYYYODKMMMMMMMMDK....|KMMMMMKDOYWWWWYODKMMMMMMMMMK....|KDMMMMKDOYYYYYYODKMMMMMMMMDK....|KMMMMMKDOOOOOOOODKMMMMMMMMMK....|KDDMMMMKKKKKKKKKKMMMMMMMMDDK....|.KMMMMMMMMMMMMMMMMMMMMMMMMK.....|.KDMMMMMMMMMMMMMMMMMMMMMMDK.....|..KDDMMMMMMMMMMMMMMMMMMDDK......|...KKKDMMMMMDDMMMMMMDKKK........|.....KDDDDDK..KDDDDDK...........|....KKKKKKK....KKKKKKK..........|....KDDDDK......KDDDDK..........|...KKKKKK........KKKKKK.........|................................')}
  };

  function shade(hex,amount){
    var n=parseInt(hex.slice(1),16),r=Math.max(0,Math.min(255,(n>>16)+amount)),g=Math.max(0,Math.min(255,((n>>8)&255)+amount)),b=Math.max(0,Math.min(255,(n&255)+amount));
    return'#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  }
  var NAMED={
    survivor:function(tint){return{K:'#081014',D:'#172329',M:'#40535a',L:'#b8a88c',H:'#e8d9b9',C:tint||'#46d7bd'};},
    ghost:function(){return{K:'#100e24',D:'#28213f',M:'#786b91',L:'#ada5c2',W:'#e3ddf5'};},
    brute:function(){return{K:'#10170e',D:'#263422',M:'#59624f',L:'#8b977b',H:'#ff9a56'};},
    carrier:function(){return{K:'#180b08',D:'#4b170f',M:'#8b2b1d',L:'#bd5a2d',H:'#ff7b35',Y:'#ffd249',W:'#fff0bd'};}
  };
  function paletteFor(spec,tint){
    var p=spec.pal;
    if(typeof p==='function')return p(tint);
    if(typeof p==='string'){
      if(p.indexOf('MAT.')===0){if(!MAT[p.slice(4)])throw new Error('Unknown MAT ramp '+p);return MAT[p.slice(4)];}
      if(NAMED[p])return NAMED[p](tint);
      if(MAT[p])return MAT[p];
      throw new Error('Unknown palette '+p);
    }
    return p||{};
  }

  // ---- registry ----
  var REG={},ALIAS={},FAMS={};
  function normalise(sp){
    if(sp.rows)sp.rows=rows(sp.rows);
    if(sp.variants)sp.variants=sp.variants.map(rows);
    if(sp.mask){if(sp.mask.length!==16)throw new Error(sp.id+': mask needs 16 entries');sp.mask=sp.mask.map(rows);}
    if(sp.frames){var out={};Object.keys(sp.frames).forEach(function(d){out[d]=sp.frames[d].map(rows);});sp.frames=out;}
    if(!sp.rows&&!sp.variants&&!sp.mask&&!sp.frames)throw new Error(sp.id+': needs rows, frames, variants or mask');
    return sp;
  }
  function define(family,specs){
    if(!FAMS[family])FAMS[family]=[];
    Object.keys(specs).forEach(function(name){
      var id=family+'/'+name;
      if(REG[id])throw new Error('Duplicate sprite '+id);
      var sp=normalise(Object.assign({},specs[name],{id:id,family:family,name:name}));
      REG[id]=sp;FAMS[family].push(id);
      // The bare alias is a convenience for the tools (lint/sheet accept `survivors/body` or just
      // `body`); the game itself always uses full ids. Two families legitimately want the same part
      // name -- boss/body and survivors/body, and later core and arm -- so a collision must not be
      // fatal. It used to throw here, which meant defining boss/body stopped art/survivors.js from
      // registering at all, since art/ loads alphabetically. On a collision drop the alias instead:
      // an ambiguous bare lookup then resolves to null and fails loudly, rather than silently
      // returning whichever family happened to load first.
      if(ALIAS[name]===undefined)ALIAS[name]=id;else if(ALIAS[name]!==id)ALIAS[name]=null;
    });
  }
  function families(){return Object.keys(FAMS);}
  function list(family){return(FAMS[family]||[]).map(function(id){return REG[id];});}
  function spec(id){return REG[id]||REG[ALIAS[id]]||null;}
  function anchorOf(sp){var a=sp&&sp.anchor||'feet';if(a==='feet')return{x:.5,y:1};if(a==='center')return{x:.5,y:.5};if(a==='tile')return{x:0,y:0};return a;}
  function wrap(n,len){return((n||0)%len+len)%len;}
  // the rows a draw call resolves to: facing + frame, variant, or mask piece
  function pick(sp,o){
    o=o||{};
    if(sp.frames){var dirs=Object.keys(sp.frames),dir=sp.frames[o.dir]?o.dir:(o.dir==='up'&&sp.frames.down?'down':dirs[0]),fr=sp.frames[dir];return fr[wrap(o.frame,fr.length)];}
    if(sp.variants)return sp.variants[wrap(o.variant,sp.variants.length)];
    if(sp.mask)return sp.mask[(o.mask||0)&15];
    return sp.rows;
  }
  var cache={};
  function sprite(name,opt){
    var o=typeof opt==='string'?{tint:opt}:(opt||{}),sp=spec(name),key;
    if(sp){
      key=sp.id+'|'+(o.tint||'')+'|'+(o.dir||'')+'|'+(o.frame||0)+'|'+(o.variant||0)+'|'+(o.mask||0);
      if(!cache[key])cache[key]=makeSprite(pick(sp,o),paletteFor(sp,o.tint),sp.den||1);
      return cache[key];
    }
    var legacy=SPECS[name];if(!legacy)return null;
    key='legacy:'+name+'|'+(o.tint||'');
    if(!cache[key])cache[key]=makeSprite(legacy.rows,paletteFor(legacy,o.tint),DEN);
    return cache[key];
  }
  // options: tint, dir, frame, variant, mask, scale, alpha (multiplies the caller's globalAlpha), rotate, flip (mirror x),
  // flipY (mirror y, for a rotated side-on object such as a gun aimed left),
  // flash, anchorX/anchorY (default from the spec's anchor)
  function draw(g,name,x,y,options){
    var o=options||{},sp=sprite(name,o);if(!sp)return;
    var an=anchorOf(spec(name)),scale=o.scale||1,ax=o.anchorX==null?an.x:o.anchorX,ay=o.anchorY==null?an.y:o.anchorY;
    g.save();g.imageSmoothingEnabled=false;if(o.alpha!=null)g.globalAlpha*=o.alpha;g.translate(Math.round(x),Math.round(y));
    if(o.rotate)g.rotate(o.rotate);g.scale(o.flip?-scale:scale,o.flipY?-scale:scale);
    if(o.flash)g.filter='brightness(3) saturate(.25)';g.drawImage(sp.canvas,Math.round(-sp.w*ax),Math.round(-sp.h*ay));g.restore();
  }
  function shadow(g,x,y,w,alpha){
    g.save();g.fillStyle='rgba(4,8,11,'+(alpha==null?.55:alpha)+')';g.beginPath();g.ellipse(Math.round(x),Math.round(y),w,Math.max(3,Math.round(w*.34)),0,0,Math.PI*2);g.fill();g.restore();
  }
  var glowCache=new Map();
  function glow(g,x,y,r,color,alpha){
    var key=r+'|'+color+'|'+(alpha||'55'),c=glowCache.get(key);
    if(!c){
      c=document.createElement('canvas');c.width=c.height=Math.ceil(r*2);
      var cg=c.getContext('2d'),q=cg.createRadialGradient(r,r,0,r,r,r);
      q.addColorStop(0,color+(alpha||'55'));q.addColorStop(.35,color+'28');q.addColorStop(1,color+'00');cg.fillStyle=q;cg.fillRect(0,0,c.width,c.height);
      glowCache.set(key,c);if(glowCache.size>48)glowCache.delete(glowCache.keys().next().value);
    }
    g.drawImage(c,x-r,y-r,r*2,r*2);
  }

  root.DSArt={DEN:DEN,MAT:MAT,makeSprite:makeSprite,rows:rows,define:define,families:families,list:list,spec:spec,palette:paletteFor,pick:pick,anchorOf:anchorOf,sprite:sprite,draw:draw,shadow:shadow,glow:glow,shade:shade};
})(typeof window!=='undefined'?window:globalThis);
