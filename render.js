(function(root){
 'use strict';
 const TAU=Math.PI*2,ART=root.DSArt,L=root.DSLights||null;
 // Shadows: with the night lighting on, lights.js throws each sprite's own silhouette away from every light that
 // reaches it, so cars and props lose the flat contact ellipse (it read as a blob, not as a shadow). cast()
 // registers a sprite that was just drawn, with the same name, position and options as its ART.draw call.
 const LIT=!!(L&&L.active&&L.caster);
 function cast(name,x,y,opt,extra){
   if(!LIT)return;const sp=ART.sprite(name,opt);if(!sp)return;const an=ART.anchorOf(ART.spec(name));
   L.caster(sp,x,y,{anchorX:opt.anchorX==null?an.x:opt.anchorX,anchorY:opt.anchorY==null?an.y:opt.anchorY,flip:opt.flip,flipY:opt.flipY,rotate:opt.rotate,scale:opt.scale,kind:extra.kind,src:extra.src,occ:extra.occ,vid:extra.vid});
 }
 function rect(g,x,y,w,h,c){g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
 function circle(g,x,y,r,c){g.fillStyle=c;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();}
 function text(g,t,x,y,c='#d8dbc8',size=8,align='center'){
   g.font='bold '+size+'px "Courier New",monospace';g.textAlign=align;g.textBaseline='alphabetic';
   g.fillStyle='#071014cc';g.fillText(t,Math.round(x+1),Math.round(y+1));g.fillStyle=c;g.fillText(t,Math.round(x),Math.round(y));
 }
 function diamond(g,x,y,r,outer,inner){
   g.fillStyle=outer;g.beginPath();g.moveTo(x,y-r);g.lineTo(x+r,y);g.lineTo(x,y+r);g.lineTo(x-r,y);g.closePath();g.fill();
   g.fillStyle=inner;g.beginPath();g.moveTo(x,y-r+2);g.lineTo(x+r-2,y);g.lineTo(x,y+r-2);g.lineTo(x-r+2,y);g.closePath();g.fill();
 }
 // facing from an angle: down/up when mostly vertical, else side (mirrored when aiming left)
 function facing(angle){const ca=Math.cos(angle||0),sa=Math.sin(angle||0),dir=Math.abs(sa)>Math.abs(ca)?(sa>0?'down':'up'):'side';return {dir,flip:dir==='side'&&ca<0};}
 const GUN_SIZE={pistol:'S',smg:'S',ar:'M',shotgun:'L',rifle:'M',flame:'L'};
 function muzzleFlash(g,x,y,angle,key,s){
   const size=GUN_SIZE[key]||'M';ART.glow(g,x,y,26,'#ff9a35','77');
   if(ART.spec('vfx/muzzle'+size))ART.draw(g,'vfx/muzzle'+size,x,y,{rotate:angle,frame:Math.floor(s.time*30)%3});
   else{g.save();g.translate(x,y);g.rotate(angle);rect(g,-3,-4,7,8,'#ff7135');rect(g,0,-2,7,4,'#fff0bd');g.restore();}
 }
 function playerWeapon(g,p,bob,s){
   const angle=p.angle||0,key=p.backup||!p.weapon?'pistol':p.weapon,id='survivors/wpn_'+key;
   if(ART.spec(id)){
     const sp=ART.sprite(id),hy=p.y-14+bob,firing=p.muzzle>0||p.auto;
     ART.draw(g,id,p.x,hy,{rotate:angle+(firing?0:.7),flipY:Math.cos(angle)<0,anchorX:firing?.18:.4});
     if(p.muzzle>0){const len=sp.w*.8;muzzleFlash(g,p.x+Math.cos(angle)*len,hy+Math.sin(angle)*len,angle,key,s);}
     return;
   }
   const long=key==='flame'||key==='rifle'||key==='ar',firing=p.muzzle>0||p.auto;
   g.save();g.translate(Math.round(p.x),Math.round(p.y-15+bob));g.rotate(angle);g.imageSmoothingEnabled=false;
   if(firing){
     // auto fire on: both arms out along the aim (the ready pose is the indicator), two sleeves from the shoulders to the grip, then the gun at full reach
     const sleeve=ART.shade(p.color,-70);rect(g,-1,-5,9,3,'#081014');rect(g,-1,2,9,3,'#081014');rect(g,0,-4,7,2,sleeve);rect(g,0,3,7,2,sleeve);
     rect(g,2,-3,long?24:18,6,'#081014');rect(g,5,-2,long?17:12,3,key==='flame'?'#8b2b1d':'#69737d');rect(g,7,1,5,5,'#26383d');
     if(p.muzzle>0){ART.glow(g,long?29:23,0,28,'#ff9a35','88');rect(g,long?26:20,-4,7,8,'#ff7135');rect(g,long?29:23,-2,7,4,'#fff0bd');}
   }else{
     // holding fire: the gun rests low across the body, tilted down from the aim
     g.rotate(.7);rect(g,-2,2,long?18:13,5,'#081014');rect(g,0,3,long?13:9,3,key==='flame'?'#8b2b1d':'#69737d');rect(g,2,5,4,4,'#26383d');
   }
   g.restore();
 }
 function survivor(g,p,s,seated=false){
   const moving=p.moving&&!p.dead,fresh=!!ART.spec('survivors/body');
   if(!seated)ART.shadow(g,p.x,p.y+2,p.dead?19:13,.62);
   if(p.dead){
     if(fresh&&ART.spec('survivors/downed'))ART.draw(g,'survivors/downed',p.x,p.y+4,{tint:p.color});else ART.draw(g,'down',p.x,p.y+4,{tint:p.color,anchorY:.68});
     g.strokeStyle=p.color;g.lineWidth=2;g.beginPath();g.arc(p.x,p.y,22,-Math.PI/2,-Math.PI/2+TAU*p.revive/3);g.stroke();text(g,'DOWN',p.x,p.y-24,p.color,8);return;
   }
   g.save();if(p.invuln>0&&Math.sin(s.time*36)<0)g.globalAlpha=.4;
   if(seated){g.beginPath();g.rect(p.x-40,p.y-48,80,33);g.clip();}
   else{g.strokeStyle=p.color+'88';g.lineWidth=1;g.beginPath();g.ellipse(Math.round(p.x),Math.round(p.y+2),15,7,0,0,TAU);g.stroke();}
   if(fresh){
     const f=facing(p.angle),name=moving||!ART.spec('survivors/bodyIdle')?'survivors/body':'survivors/bodyIdle';
     const frame=moving?Math.floor(s.time*8+p.id*.37)&3:Math.floor(s.time*3+p.id)&1;
     const opt={tint:p.color,dir:f.dir,frame,flip:f.flip,flash:p.flash>0};
     if(f.dir==='up'){playerWeapon(g,p,0,s);ART.draw(g,name,p.x,p.y,opt);}
     else{ART.draw(g,name,p.x,p.y,opt);playerWeapon(g,p,0,s);}
     if(!seated)cast(name,p.x,p.y,opt,{src:p});
   }else{
     const bob=moving?(Math.floor(s.time*10+p.id)%2?0:-2):0,frame=moving&&(Math.floor(s.time*10+p.id)%2)?'survivorB':'survivorA';
     ART.draw(g,frame,p.x,p.y+bob,{tint:p.color,flash:p.flash>0,flip:Math.cos(p.angle||0)<-.15});playerWeapon(g,p,bob,s);
     if(!seated)cast(frame,p.x,p.y+bob,{tint:p.color,flip:Math.cos(p.angle||0)<-.15},{src:p});
   }
   g.restore();
   text(g,'P'+(p.id+1),p.x,p.y-44,p.color,8);
   if(p.reload>0){g.strokeStyle='#ffd249';g.lineWidth=2;g.beginPath();g.arc(p.x,p.y-10,23,-Math.PI/2,-Math.PI/2+TAU*(1-p.reload/root.DSGame.WEAPONS[p.weapon].reload));g.stroke();}
 }
 const INFECTED_FPS={walker:8,runner:12,ghost:8,brute:6,carrier:6,band:12};
 // sedans alternate paint by id; service vehicles show their damage: intact, damaged, wrecked (the bulldozer: working/broken)
 function civilian(g,v,s){
   const id='survivors/civilian',frame=v.state==='moving'&&!v.cower?Math.floor(s.time*6+v.x)%2:0;
   if(!LIT)ART.shadow(g,v.x,v.y+2,8,.5);
   // four distinct people, three frames each (walk A, walk B, cower): a stable person per civilian id
   const who=(parseInt(String(v.id).split('-').pop(),10)||0)%4;
   if(hasArt(id,v))ART.draw(g,id,v.x,v.y,{frame:(v.cower?2:frame)+3*who,flip:v.x>0});
   else{rect(g,v.x-5,v.y-18,10,16,v.cower?'#5b6468':'#8a9a94');rect(g,v.x-4,v.y-24,8,7,'#c9b9a0');}
 }
 function vehicleVariant(v){
   if((v.vehicleType||'sedan')==='sedan')return parseInt(String(v.carId).split('-').pop(),10)%2||0;
   if(v.vehicleType==='bulldozer')return v.dead||v.integrity<v.maxIntegrity*.35?1:0;
   return v.dead?2:v.integrity<v.maxIntegrity*.5?1:0;
 }
 function vehicleDraw(g,v,s){
   const ca=Math.cos(v.angle),sa=Math.sin(v.angle),vertical=Math.abs(sa)>Math.abs(ca);
   const cardinal=vertical?(sa>0?Math.PI/2:-Math.PI/2):(ca<0?Math.PI:0),residual=Math.atan2(Math.sin(v.angle-cardinal),Math.cos(v.angle-cardinal));
   const type=v.vehicleType||'sedan',south=vertical&&sa>0&&hasArt('vehicles/'+type+'_vs'),intact='vehicles/'+type+'_'+(vertical?(south?'vs':'v'):'h'),name=(!v.dead||type!=='sedan')&&hasArt(intact)?intact:'wrecks/car_'+(vertical?'v':'h');
   // vehicle art is drawn nose-first at low x (_h) / low y (_v): mirror when heading east or south
   const opt={anchorX:.5,anchorY:.5,variant:name.startsWith('wrecks/')?0:vehicleVariant(v),rotate:residual, /* a destroyed sedan is the civilian hatch wreck, never the police variant */flip:!vertical&&ca>0,flipY:vertical&&sa>0&&!name.endsWith('_vs')},def=root.DSGame.VEHICLES[type]||root.DSGame.VEHICLES.sedan;
   if(!LIT)ART.shadow(g,v.x,v.y+def.wid/2-2,vertical?def.wid*.58:def.len*.51,.6);
   ART.draw(g,name,v.x,v.y-5,opt);cast(name,v.x,v.y-5,opt,{kind:'low',src:v,vid:v.id});
   for(const id of [v.driver,...v.riders]){const p=s.players.find(p=>p.id===id);if(!p)continue;
     survivor(g,id===v.driver?{...p,auto:false,muzzle:0}:p,s,true);}
   vehicleSmoke(g,v,s);
 }
 function vehicleSmoke(g,v,s){
   if(v.dead||v.integrity>=v.maxIntegrity*.35)return;
   const x=v.x+Math.cos(v.angle)*32,y=v.y+Math.sin(v.angle)*32-8,t=s.time;
   if(v.integrity<v.maxIntegrity*.15)ART.glow(g,x,y,28,'#ff6a2a','40');
   g.save();
   for(let i=0;i<3;i++){const ph=(t*.6+i/3)%1,sz=6+ph*15,sx=x+Math.sin(t*1.3+i)*6-Math.cos(v.angle)*ph*18,sy=y-12-ph*54;
     g.globalAlpha=.42*(1-ph);rect(g,sx-sz/2,sy-sz/2,sz,sz,'#75756a');}
   g.restore();
 }
 // No contact blob under the infected: lights.js throws them a real silhouette from every light that reaches them,
 // and the two read as two shadows. Survivors keep theirs, which is what grounds them in the dark.
 function enemy(g,e,s){
   const type=e.type==='band'?'runner':e.type,id='infected/'+type;
   if(ART.spec(id)){
     const angle=e.type==='band'?Math.atan2(e.vy||0,e.vx||1):(e.angle||0),f=facing(angle),dir=f.dir==='side'?'side':'down';
     const frame=Math.floor(s.time*(INFECTED_FPS[e.type]||8)+e.id*.61)&3,sp=ART.sprite(id,{dir,frame});
     if(e.type==='ghost')ART.glow(g,e.x,e.y-14,36,'#786b91','30');
     else if(e.type==='carrier')ART.glow(g,e.x,e.y-12,40,'#ff6a2a','38');
     ART.draw(g,id,e.x,e.y,{dir,frame,flip:f.flip,flash:e.flash>0,alpha:e.type==='ghost'?.76:1});
     if(e.type!=='ghost')cast(id,e.x,e.y,{dir,frame,flip:f.flip},{src:e});
     if(e.type==='carrier'&&ART.spec('infected/carrierCore'))ART.draw(g,'infected/carrierCore',e.x,e.y-14,{frame:Math.floor(s.time*6)&1});
     if(e.hp<e.maxHp){const w=Math.max(18,sp.w-6),top=e.y-sp.h-7;rect(g,e.x-w/2,top,w,3,'#180b08');rect(g,e.x-w/2,top,w*Math.max(0,e.hp/e.maxHp),3,'#ff543b');}
     if(e.type==='carrier')text(g,'FEEDER',e.x,e.y-sp.h-12,'#ffd249',7);
     return;
   }
   const walk=Math.floor(s.time*(e.type==='runner'?13:8)+e.id)%2,bob=walk?-1:1,flip=Math.cos(e.angle||0)<0;
   let name=e.type==='ghost'?'ghost'+(walk?'B':'A'):e.type==='brute'?'brute'+(walk?'B':'A'):e.type==='carrier'?'carrier':e.type==='runner'||e.type==='band'?'runner'+(walk?'B':'A'):'walker'+(walk?'B':'A');
   const scale=e.type==='brute'?1.08:e.type==='carrier'?1.08:1;
   if(e.type==='ghost'){ART.glow(g,e.x,e.y-11,34,'#786b91','30');ART.draw(g,name,e.x,e.y+bob,{alpha:.76,flip:flip,flash:e.flash>0});}
   else {if(e.type==='carrier')ART.glow(g,e.x,e.y-8,38,'#ff6a2a','38');ART.draw(g,name,e.x,e.y+bob,{scale:scale,flip:flip,flash:e.flash>0});cast(name,e.x,e.y+bob,{scale:scale,flip:flip},{src:e});}
   if(e.hp<e.maxHp){const w=e.type==='brute'?32:22;rect(g,e.x-w/2,e.y-(e.type==='brute'?50:39),w,3,'#180b08');rect(g,e.x-w/2,e.y-(e.type==='brute'?50:39),w*Math.max(0,e.hp/e.maxHp),3,'#ff543b');}
   if(e.type==='carrier')text(g,'FEEDER',e.x,e.y-44,'#ffd249',7);
 }
 function loot(g,l,s){
   const x=l.x,y=l.y,pulse=Math.floor(s.time*5+l.x*.01)%2?0:-2;
   if(l.type==='xp'){if(hasArt('loot/xpShard'))ART.draw(g,'loot/xpShard',x,y+pulse,{frame:Math.floor(s.time*6+l.x*.01)%3});else diamond(g,x,y+pulse,5,'#0b1216','#79e2cf');ART.glow(g,x,y,20,'#79e2cf','2d');return;}
   const fresh=hasArt('loot/medkit'),name=fresh?((l.type==='heal'||l.type==='medkit')?'loot/medkit':l.type==='evidence'?'loot/evidence':l.type==='payload'?'loot/payload':l.type==='override'?'loot/override':l.type==='provision'?'loot/provision':l.type==='vehicleFuel'?'loot/jerrycan':l.type==='weapon'?'loot/weaponCrate':l.ammo==='fuel'?'loot/fuelCan':l.ammo==='shells'?'loot/ammoShells':'loot/ammoBullets'):((l.type==='heal'||l.type==='medkit')?'medkit':l.type==='weapon'?'weapon':l.ammo==='fuel'?'fuel':'ammo'),col=(l.type==='heal'||l.type==='medkit')?'#9fd39f':l.type==='evidence'||l.type==='payload'||l.type==='override'?'#d8dbc8':l.type==='provision'?'#b8d86b':l.type==='vehicleFuel'?'#ffd249':l.type==='weapon'?'#ffb866':l.ammo==='fuel'?'#ff8b3d':'#d7cda8';
   const hidden=l.interior&&(s.world.buildings||[]).some(h=>x>h.x&&x<h.x+h.w&&y>h.y&&y<h.y+h.h&&h.roofZones.some(z=>z.alpha>.5&&z.rects.some(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h)));
   if(!hidden){ART.glow(g,x,y,32,col,'2b');}ART.shadow(g,x,y+9,14,.45);ART.draw(g,name,x,y+pulse,fresh?{}:{anchorY:.65});
   if(!hidden){g.strokeStyle=col+'66';g.lineWidth=1;g.strokeRect(Math.round(x-16),Math.round(y-16+pulse),32,29);}
   if(l.type==='weapon')for(let i=0;i<(l.quality||1);i++)rect(g,x-5+i*6,y-22+pulse,3,3,col);
   const close=s.players.find(p=>Math.hypot(p.x-x,p.y-y)<85),key=a=>close?root.DSGame.label(close,a):'';if(close)text(g,l.type==='weapon'?root.DSGame.WEAPONS[l.weapon].name:l.type==='medkit'?'MEDKIT · WALK OVER · '+key('heal')+' HEALS':l.type==='heal'?'SQUAD FIRST AID · WALK OVER':l.type==='evidence'?'RECORDS · WALK OVER TO READ':l.type==='payload'?'TRANSMITTER PAYLOAD':l.type==='override'?'CHECKPOINT OVERRIDE':l.type==='provision'?'RATION · WALK OVER · '+key('eat')+' EATS':l.type==='vehicleFuel'?l.amount+' L JERRYCAN · VEHICLE FUEL':l.amount+' '+l.ammo.toUpperCase(),x,y+31,col,7);
 }

 // ---- the world pass: everything standing on the ground, y-sorted with the actors ----
 const PLACEHOLDER={gate:['#1a0b09','#8b2b1d'],fence:['#0a1014','#5b6a66'],door:['#1a0b09','#8a6a3a'],wall:['#0a1014','#3b3630'],furniture:['#1d080a','#794332'],barrier:['#1a0b09','#6f4a35'],car:['#0a1014','#4c5652'],rubble:['#0a1014','#3a444e']};
 // city_v2 Section 4: every lookup that falls back to a placeholder is counted with the positions it was drawn
 // at, so accepted routes can prove zero fallback draws (DSRender.fallbacks()).
 const FALLBACKS=new Map();
 function hasArt(name,src){const ok=!!(name&&ART.spec(name));if(!ok&&name){let f=FALLBACKS.get(name);if(!f){f={id:name,count:0,at:[]};FALLBACKS.set(name,f);}f.count++;if(src&&src.x!=null&&f.at.length<12){const k=Math.round(src.x)+','+Math.round(src.y);if(!f.at.includes(k))f.at.push(k);}}return ok;}
 function placeholder(g,o){const c=PLACEHOLDER[o.type]||PLACEHOLDER.rubble;rect(g,o.x,o.y,o.w,o.h,c[0]);rect(g,o.x+2,o.y+2,o.w-4,o.h-4,c[1]);}
 // a solid obstacle with an art name: vehicles and flat set-piece parts sit centred in their rect, standing props put their feet on the rect's bottom edge
 function drawSolid(g,o,s){
   if(o.driveable||o.vehicleType&&o.vehicleType!=='sedan'){
     const id='vehicles/'+(o.vehicleType||'sedan')+'_'+(o.h>o.w?'v':'h'),v=(s.vehicles||[]).find(v=>v.obstacle===o);
     if(hasArt(id)){
       const opt={anchorX:.5,anchorY:.5,variant:v?vehicleVariant(v):0,flip:v&&o.w>o.h&&Math.cos(v.angle)>0,flipY:v&&o.h>o.w&&Math.sin(v.angle)>0};
       if(!LIT)ART.shadow(g,o.x+o.w/2,o.y+o.h/2+22,o.w*.5,.6);
       ART.draw(g,id,o.x+o.w/2,o.y+o.h/2-5,opt);cast(id,o.x+o.w/2,o.y+o.h/2-5,opt,{kind:'low',src:v||o,occ:true,vid:v?v.id:null});
       if(v)vehicleSmoke(g,v,s);return;
     }
   }
   if(o.type==='car'&&!o.art){root.DSWorld.legacy.wreck(g,o);if(o.burning)fire(g,o.x+o.w/2,o.y+o.h/2,s,o.x);return;}
   if(!hasArt(o.art,o)){if(o.type==='rubble'||o.type==='barrier'){root.DSWorld.legacy.wreck(g,o);return;}placeholder(g,o);return;}
   const sp=ART.spec(o.art),an=ART.anchorOf(sp);
   const vid=o.driveable?((s.vehicles||[]).find(v=>v.obstacle===o)||{}).id:null;
   // tile-anchored set-piece solids (conveyor runs) draw from their rect's top-left
   if(an.x===0&&an.y===0&&!o.rot){ART.draw(g,o.art,o.x,o.y,{variant:o.variant||0});cast(o.art,o.x,o.y,{anchorX:0,anchorY:0},{kind:'low',src:o,occ:true,vid});return;}
   if(an.y===1&&!o.rot){if(!LIT)ART.shadow(g,o.x+o.w/2,o.y+o.h,Math.round(o.w*.45),.45);ART.draw(g,o.art,o.x+o.w/2,o.y+o.h,{variant:o.variant||0,flash:o.flash>0});
     cast(o.art,o.x+o.w/2,o.y+o.h,{variant:o.variant||0},{kind:o.type==='car'?'low':'stand',src:o,occ:true,vid});}
   else{const opt={anchorX:.5,anchorY:.5,rotate:o.rot?-Math.PI/2:0,variant:o.variant||0};ART.draw(g,o.art,o.x+o.w/2,o.y+o.h/2,opt);cast(o.art,o.x+o.w/2,o.y+o.h/2,opt,{kind:'low',src:o,occ:true,vid});}
   if(o.burning)fire(g,o.x+o.w/2,o.y+o.h/2,s,o.x);
   if(o.driveable){ART.glow(g,o.x+o.w/2,o.y+o.h/2-4,22,'#ffd249','30');const v=(s.vehicles||[]).find(v=>v.obstacle===o);if(v)vehicleSmoke(g,v,s);}
 }
 function drawWall(g,o){
   if(hasArt('buildings/wallH')){
     g.save();g.beginPath();g.rect(o.x,o.y,o.w,o.h);g.clip();
     if(o.w>=o.h){for(let x=o.x;x<o.x+o.w;x+=32)ART.draw(g,'buildings/wallH',x,o.y,{anchorX:0,anchorY:0,variant:(root.DSWorld.hash(x,o.y)*2)|0});}
     else{for(let y=o.y;y<o.y+o.h;y+=32)ART.draw(g,'buildings/wallV',o.x,y,{anchorX:0,anchorY:0,variant:(root.DSWorld.hash(o.x,y)*2)|0});}
     g.restore();return;
   }
   rect(g,o.x,o.y,o.w,o.h,'#0a1014');rect(g,o.x+1,o.y+1,o.w-2,o.h-2,'#3b3630');rect(g,o.x+1,o.y+1,o.w-2,3,'#59534b');
 }
 // street lamps: variant 0 works (its head glows by the flicker level from lights.js), 1 is dead, 2 is bent;
 // traffic lights are dead unless the crossing still blinks amber; other lights get a small corona (the pool is in the lightmap)
 function drawProp(g,p,s){
   const lampish=p.art==='props/streetLamp',level=lampish&&L?L.lampLevel(p,s.time):1;
   let frame=p.frame||0;if(p.art==='props/trafficLight')frame=p.blink&&Math.floor(s.time*1.5)%2?1:0;
   if(p.circuitBox)frame=s.circuit&&s.circuit.emergency?1:0;if(p.evacGate)frame=s.campaign&&s.campaign.gateOpen?1:0;
   if(hasArt(p.art,p)){const opt={variant:p.variant||0,rotate:p.rot?-Math.PI/2:0,frame,flip:!!p.flip};ART.draw(g,p.art,p.x,p.y,opt);if(!p.flat)cast(p.art,p.x,p.y,opt,{kind:p.rot?'low':'stand',src:p});}
   else if(!p.flat){rect(g,p.x-3,p.y-14,6,14,'#69777a');rect(g,p.x-4,p.y-18,8,5,lampish&&p.lit&&level>.3?'#ffd9a0':'#4b555a');}
   if(!p.light||p.circuit&&!(s.circuit&&s.circuit[p.circuit]))return;
   const dy=p.light.dy==null?24:p.light.dy,lx=p.x+(p.light.dx||0);
   if(lampish){if(level>.05)ART.glow(g,lx,p.y-dy,30,p.light.col,level>.5?'66':'22');}
   else if(L)ART.glow(g,lx,p.y-dy,Math.min(p.light.r,48),p.light.col,p.light.a);
   else ART.glow(g,lx,p.y-dy,p.light.r,p.light.col,p.light.a);
 }
 // house roof: fades while somebody is inside (h.roofAlpha from game.js)
 function drawRoof(g,h,s){
   for(const z of h.roofZones){if(z.alpha<=.02)continue;g.save();g.globalAlpha=z.alpha;g.beginPath();for(const q of z.rects)g.rect(q.x,q.y,q.w,q.h);g.clip();
     const d=root.DSWorld.district(h.x+h.w/2,h.y+h.h/2),b=z.rect;
     const shedRoof=d.id==='industry'&&(h.style==='industrial'||h.style==='shack')&&hasArt('industrial/metalRoof_h'),wardRoof=h.style==='hospital'&&hasArt('civic/wardRoof_h');
     if(wardRoof){for(let y=b.y;y<b.y+b.h;y+=48)for(let x=b.x;x<b.x+b.w;x+=32)ART.draw(g,'civic/wardRoof_h',x,y,{anchorX:0,anchorY:0,variant:((root.DSWorld.hash(x,y)*6)|0)>4?1:0});}else
     if(shedRoof){for(let y=b.y;y<b.y+b.h;y+=32)for(let x=b.x;x<b.x+b.w;x+=32)ART.draw(g,b.w>=b.h?'industrial/metalRoof_h':'industrial/metalRoof_v',x,y,{anchorX:0,anchorY:0,variant:((root.DSWorld.hash(x,y)*8)|0)>5?2:0});}
     else if(hasArt('buildings/roofFill')){for(let y=b.y;y<b.y+b.h;y+=32)for(let x=b.x;x<b.x+b.w;x+=32)ART.draw(g,'buildings/roofFill',x,y,{anchorX:0,anchorY:0,variant:(root.DSWorld.hash(x,y)*3)|0});}
     else{rect(g,b.x,b.y,b.w,b.h,h.style==='clinic'?'#243636':h.style==='shack'?'#30322d':'#263539');}
     for(const q of z.rects){if(q.x===h.x)rect(g,q.x,q.y,4,q.h,'#0a1014');if(q.y===h.y)rect(g,q.x,q.y,q.w,4,'#0a1014');if(q.x+q.w===h.x+h.w)rect(g,q.x+q.w-4,q.y,4,q.h,'#0a1014');if(q.y+q.h===h.y+h.h)rect(g,q.x,q.y+q.h-4,q.w,4,'#0a1014');}
     if(h.roofZones.length>1)for(const q of z.rects){if(q.x!==h.x)rect(g,q.x,q.y,2,q.h,'#0a101488');if(q.y!==h.y)rect(g,q.x,q.y,q.w,2,'#0a101488');}
     rect(g,b.x+10,b.y+10,Math.max(0,b.w-20),4,d.color+'22');
     g.restore();
     if(!hasArt('doors/sill_h')){g.save();g.globalAlpha=z.alpha;for(const dd of h.exteriorDoors){const dr=dd.rect,cx=dr.x+dr.w/2,cy=dr.y+dr.h/2;if(z.rects.some(q=>cx>=q.x-8&&cx<=q.x+q.w+8&&cy>=q.y-8&&cy<=q.y+q.h+8))rect(g,dr.x,dr.y,dr.w,dr.h,'#111a1e');}g.restore();}
   }
 }

 // a burning wreck: fire frames when the vfx family has them, else flickering squares, plus rising smoke and an ember glow
 function fire(g,x,y,s,seed){
   const t=s.time;ART.glow(g,x,y-6,90,'#ff6a2a','44');
   if(hasArt('vfx/fire'))ART.draw(g,'vfx/fire',x,y+6,{frame:Math.floor(t*12+seed)%5});
   else{for(let i=0;i<4;i++){const f=Math.sin(t*14+i*1.7+seed)*3;rect(g,x-10+i*6,y-6-Math.abs(f)*2,4,6+Math.abs(f),i%2?'#ffd249':'#ff7135');}rect(g,x-4,y-4,8,5,'#fff0bd');}
   for(let i=0;i<3;i++){const ph=(t*.35+i*.33+(seed%7)*.1)%1,sx=x-8+i*8+Math.sin(t*1.3+i)*6,sy=y-20-ph*70,sz=6+ph*10;g.globalAlpha=.28*(1-ph);rect(g,sx-sz/2,sy-sz/2,sz,sz,'#3a3a36');}
   g.globalAlpha=1;
 }
 // the radio mast: stacked sections above the solid base, beacon on top, guy wires to the ground
 function radioMast(g,s,mast){
   const x=mast.x,base=mast.y-40,top=base-144;
   if(hasArt('landmarks/mastSection')){for(let i=0;i<3;i++)ART.draw(g,'landmarks/mastSection',x,base-i*48);ART.draw(g,'landmarks/mastTop',x,top);}
   else{rect(g,x-6,top-36,12,base-top+36,'#0a1014');rect(g,x-4,top-34,8,base-top+34,'#71818a');for(let y=top-30;y<base;y+=16)rect(g,x-8,y,16,2,'#0a1014');}
   const on=Math.floor(s.time*1.4)%2===0;
   if(hasArt('landmarks/beacon'))ART.draw(g,'landmarks/beacon',x,top-36,{frame:on?1:0});else rect(g,x-4,top-40,8,8,on?'#ff543b':'#4b170f');
   if(on)ART.glow(g,x,top-38,60,s.radio.done?'#79e2cf':'#ff543b','30');
   g.strokeStyle='#4b5a55';g.lineWidth=1;for(const dx of [-60,60]){g.beginPath();g.moveTo(x,top-20);g.lineTo(x+dx,base+30);g.stroke();}
 }
 // sprite size in world units (den 1)
 function artSize(id){const sp=ART.spec(id),r=sp&&(sp.rows||(sp.variants&&sp.variants[0])||(sp.frames&&Object.values(sp.frames)[0][0]));return r?{w:r[0].length,h:r.length}:null;}
 // a long thin solid (fence run, secured door) tiled from a _h or _v strip sprite: horizontal strips stand on
 // the rect's bottom edge, vertical ones run down its centre line; both are clipped to the run's length
 function drawStrip(g,o,base){
   const hz=o.w>=o.h,id=base+(hz?'_h':'_v'),sz=hasArt(id,o)&&artSize(id);if(!sz){placeholder(g,o);return;}
   g.save();g.beginPath();if(hz)g.rect(o.x,o.y+o.h-sz.h-2,o.w,sz.h+4);else g.rect(o.x+o.w/2-sz.w/2-2,o.y-sz.h,sz.w+4,o.h+sz.h);g.clip();
   if(hz)for(let x=o.x;x<o.x+o.w;x+=sz.w)ART.draw(g,id,x,o.y+o.h,{anchorX:0,anchorY:1,variant:(root.DSWorld.hash(x,o.y)*2)|0});
   else for(let y=o.y;y<o.y+o.h;y+=sz.h)ART.draw(g,id,o.x+o.w/2,y+sz.h,{anchorX:.5,anchorY:1,variant:(root.DSWorld.hash(o.x,y)*2)|0});
   g.restore();
 }
 // ---- city_v2 facade kits (frontage and industrial families) ----
 // The street face of an ordinary building, per district and use: South Blocks brick rows and shopfronts under awnings,
 // Old Quarter masonry terraces, Ashworks corrugated sheds with workshop and office fronts. Horizontal strips stand on the
 // south edge; frontage _v strips face west (flip for east), industrial _v strips face east (flip for west); a north
 // face shows only its eaves. Districts without a kit keep the generic sealed facade.
 const KITS={
   checkpoint:{h:'frontage/brickRow_h',v:'frontage/brickRow_v',n:'frontage/brickEaves_n',
     shop:{h:'frontage/shopfront_h',v:'frontage/shopfront_v',awning:'frontage/awning'},sealed:{h:'frontage/shutter_h',v:'frontage/shutter_v'}},
   ruins:{h:'frontage/terrace_h',v:'frontage/terrace_v',n:'frontage/masonryEaves_n'},
   industry:{h:'industrial/corrugatedWall_h',v:'industrial/corrugatedWall_v',vEast:true,northFlip:true,
     workshop:{h:'industrial/workshopFront_h',v:'industrial/workshopFront_v'},dispatchOffice:{h:'industrial/officeFront_h',v:'industrial/officeFront_v'}}
 };
 // back walls per district (north faces show eaves only, as the street kit does)
 const REAR={checkpoint:{h:'frontage/rearWall_h',v:'frontage/rearWall_v',n:'frontage/brickEaves_n',doorH:'frontage/backDoor_h',doorV:'frontage/backDoor_v',nookH:'frontage/binNook_h'},
   ruins:{h:'frontage/rearWall_h',v:'frontage/rearWall_v',n:'frontage/masonryEaves_n',doorH:'frontage/backDoor_h',doorV:'frontage/backDoor_v'},
   industry:{h:'industrial/corrugatedWall_h',v:'industrial/corrugatedWall_v',vEast:true,northFlip:true,doorH:'industrial/loadingDoor_h',doorV:'industrial/loadingDoor_v'}};
 function kitFor(d,arch,sealed){const k=KITS[d.id];if(!k)return null;return Object.assign({},k,(sealed?k.sealed:k[arch])||{});}
 function variants(id){const sp=ART.spec(id);return sp&&sp.variants?sp.variants.length:1;}
 // one face of rect r along side, skipping tiles that overlap a doorway; returns false when the kit has no art for it
 function facadeFace(g,r,side,kit,doors){
   const H=root.DSWorld.hash,blocked=(x0,x1,y0,y1)=>doors.some(d=>{const q=d.rect;return q.x<x1+4&&q.x+q.w>x0-4&&q.y<y1+4&&q.y+q.h>y0-4;});
   if(side==='n'){
     const id=kit.northFlip?kit.h:kit.n;if(!id||!hasArt(id))return false;const sz=artSize(id);
     g.save();g.beginPath();g.rect(r.x,r.y,r.w,sz.h+2);g.clip();
     for(let x=r.x;x<r.x+r.w;x+=sz.w){if(blocked(x,x+sz.w,r.y,r.y+sz.h))continue;ART.draw(g,id,x,r.y,kit.northFlip?{anchorX:0,anchorY:1,flipY:true,variant:(H(x,r.y)*variants(id))|0}:{anchorX:0,anchorY:0,variant:(H(x,r.y)*variants(id))|0});}
     g.restore();return true;
   }
   const hz=side==='s',id=hz?kit.h:kit.v;if(!id||!hasArt(id))return false;const sz=artSize(id);
   g.save();g.beginPath();g.rect(r.x,r.y,r.w,r.h);g.clip();
   if(hz){for(let x=r.x;x<r.x+r.w;x+=sz.w){if(blocked(x,x+sz.w,r.y+r.h-sz.h,r.y+r.h))continue;ART.draw(g,id,x,r.y+r.h,{anchorX:0,anchorY:1,variant:(H(x,r.y)*variants(id))|0});}}
   else{const east=side==='e';for(let y=r.y;y<r.y+r.h;y+=sz.h){const x0=east?r.x+r.w-sz.w:r.x;if(blocked(x0,x0+sz.w,y,y+sz.h))continue;
     const o=kit.vEast?{anchorX:1,anchorY:0,flip:!east}:{anchorX:0,anchorY:0,flip:east};ART.draw(g,id,east?r.x+r.w:r.x,y,Object.assign(o,{variant:(H(r.x,y)*variants(id))|0}));}}
   g.restore();
   // shop awnings project over the pavement in front of the glazing (not over the doorway)
   if(kit.awning&&side!=='n'){const aid=kit.awning+(hz?'_h':'_v');if(hasArt(aid)){const az=artSize(aid);
     if(hz)for(let x=r.x;x+az.w<=r.x+r.w;x+=az.w){if(!blocked(x,x+az.w,r.y+r.h-4,r.y+r.h+4))ART.draw(g,aid,x,r.y+r.h,{anchorX:0,anchorY:0,variant:(H(x,r.y+1)*variants(aid))|0});}
     else for(let y=r.y;y+az.h<=r.y+r.h;y+=az.h){const east=side==='e',ex=east?r.x+r.w:r.x;if(!blocked(ex-4,ex+4,y,y+az.h))ART.draw(g,aid,ex,y,{anchorX:east?0:1,anchorY:0,flip:east,variant:(H(r.x+1,y)*variants(aid))|0});}}}
   return true;
 }
 // an enterable ordinary building: its street face (the public door side) plus the eaves of a north face
 function buildingFacade(g,b){
   const A=root.DSCity&&root.DSCity.ARCHETYPES[b.archetypeId];if(!A||A.placement!=='fabric')return;
   const kit=kitFor(root.DSWorld.district(b.x+b.w/2,b.y+b.h/2),b.archetypeId,false);if(!kit)return;
   const pub=b.exteriorDoors.find(d=>d.kind==='public')||b.exteriorDoors[0];if(!pub)return;
   facadeFace(g,b,pub.side,kit,b.exteriorDoors);
   // rear frontage: a building with a service door shows its back wall on that side (rear wall, back door, bin nook)
   const rear=b.exteriorDoors.find(d=>d.kind==='service');const R=REAR[root.DSWorld.district(b.x+b.w/2,b.y+b.h/2).id];
   if(rear&&R&&rear.side!==pub.side){facadeFace(g,b,rear.side,R,[rear]);const hz=rear.side==='n'||rear.side==='s',id=hz?R.doorH:R.doorV;
     if(id&&hasArt(id)){const d=rear.rect;if(hz&&rear.side==='s')ART.draw(g,id,Math.round(d.x+d.w/2-16),b.y+b.h,{anchorX:0,anchorY:1});else if(!hz)ART.draw(g,id,rear.side==='e'?b.x+b.w-12:b.x,Math.round(d.y+d.h/2-16),{anchorX:0,anchorY:0,flip:rear.side==='e'});}
     if(R.nookH&&hz&&rear.side==='s'&&hasArt(R.nookH))ART.draw(g,R.nookH,Math.round(rear.rect.x+rear.rect.w/2+24),b.y+b.h,{anchorX:0,anchorY:1});}
 }
 // background masses read as sealed from their street face: shuttered/boarded frontage along the facade edge
 function sealedFacade(g,o){
   const kit=kitFor(root.DSWorld.district(o.x+o.w/2,o.y+o.h/2),null,true);
   if(kit&&facadeFace(g,o,o.facade,kit,[])){
     // a fresh Old Quarter collapse: torn terrace ends either side of the street face and brick spill from the gap
     if(o.collapsed&&o.facade==='s'&&hasArt('frontage/collapse_h')){const mx=Math.round((o.x+o.w/2)/32)*32;ART.draw(g,'frontage/collapse_h',mx-32,o.y+o.h,{anchorX:0,anchorY:1});ART.draw(g,'frontage/collapse_h',mx+32,o.y+o.h,{anchorX:0,anchorY:1,flip:true});
       if(hasArt('frontage/collapseSpill'))ART.draw(g,'frontage/collapseSpill',mx,o.y+o.h,{variant:0});}
     return;
   }
   const hz=o.facade==='n'||o.facade==='s',id='buildings/sealedFacade_'+(hz?'h':'v'),sz=hasArt(id)&&artSize(id);if(!sz)return;
   g.save();g.beginPath();g.rect(o.x,o.y,o.w,o.h);g.clip();
   if(hz)for(let x=o.x;x<o.x+o.w;x+=sz.w)ART.draw(g,id,x,o.facade==='n'?o.y:o.y+o.h,{anchorX:0,anchorY:o.facade==='n'?0:1,variant:(root.DSWorld.hash(x,o.y)*2)|0});
   else for(let y=o.y;y<o.y+o.h;y+=sz.h)ART.draw(g,id,o.facade==='w'?o.x:o.x+o.w,y,{anchorX:o.facade==='w'?0:1,anchorY:0,variant:(root.DSWorld.hash(o.x,y)*2)|0});
   g.restore();
 }
 // an exterior doorway: shared threshold strip, the family's jambs at both ends, its leaf swung open inside,
 // and warm spill on the threshold while the room behind is open to view
 function drawDoorway(g,b,d){
   const fam=root.DSWorld.doorFamily(b,d),r=d.rect,v=r.h>r.w,sill='doors/sill_'+(v?'v':'h'),jamb='doors/'+fam+'_jamb',leaf='doors/'+fam+'_leaf';
   if(!hasArt(sill))return;
   const sz=artSize(sill);g.save();g.beginPath();g.rect(r.x,r.y,r.w,r.h);g.clip();
   if(!v)for(let x=r.x;x<r.x+r.w;x+=sz.w)ART.draw(g,sill,x,r.y,{anchorX:0,anchorY:0});else for(let y=r.y;y<r.y+r.h;y+=sz.h)ART.draw(g,sill,r.x,y,{anchorX:0,anchorY:0});
   g.restore();
   const inward={n:[0,1],s:[0,-1],e:[-1,0],w:[1,0]}[d.side];
   if(hasArt(leaf)&&fam!=='fireRoller'&&fam!=='loadingBay'){const lx=v?r.x+r.w/2+inward[0]*14:r.x+14,ly=v?r.y+14:r.y+r.h/2+inward[1]*14;ART.draw(g,leaf,lx,ly,{anchorX:0,anchorY:.5,rotate:v?Math.PI/2*(inward[0]>0?1:-1):(inward[1]>0?.35:-.35)});}
   if(hasArt(jamb)){if(v){ART.draw(g,jamb,r.x+r.w/2,r.y+2);ART.draw(g,jamb,r.x+r.w/2,r.y+r.h+2);}else{ART.draw(g,jamb,r.x,r.y+r.h);ART.draw(g,jamb,r.x+r.w,r.y+r.h);}}
   const z=b.roofZones.find(z=>z.rooms.includes(d.rooms[0]));if(z&&z.alpha<.5)ART.glow(g,r.x+r.w/2+inward[0]*18,r.y+r.h/2+inward[1]*18,Math.max(r.w,r.h)*.6,'#ffcf8a','1c');
 }
 function bigRoof(g,o){
   const W=root.DSWorld,hash=W.hash,d=W.district(o.x+o.w/2,o.y+o.h/2);
   rect(g,o.x+10,o.y+12,o.w,o.h,'#05090c88');
   g.save();g.beginPath();g.rect(o.x,o.y,o.w,o.h);g.clip();
   const x0=Math.floor(o.x/32)*32,y0=Math.floor(o.y/32)*32;
   // Ashworks masses are sheds: corrugated metal, or sawtooth north-light roofs on the big ones
   const shed=d.id==='industry'&&hasArt('industrial/metalRoof_h'),fillId=shed?(o.w*o.h>=60000&&hasArt('industrial/sawtoothRoof_h')?(o.w>=o.h?'industrial/sawtoothRoof_h':'industrial/sawtoothRoof_v'):(o.w>=o.h?'industrial/metalRoof_h':'industrial/metalRoof_v')):'buildings/roofFillBig';
   for(let y=y0;y<o.y+o.h;y+=32)for(let x=x0;x<o.x+o.w;x+=32)ART.draw(g,fillId,x,y,{anchorX:0,anchorY:0,variant:shed?((hash(x,y)*8)|0)>5?1:0:(hash(x,y)*3)|0});
   g.restore();
   if(hasArt('buildings/roofEdge')){g.save();g.beginPath();g.rect(o.x,o.y,o.w,o.h);g.clip();
     for(let y=o.y;y<o.y+o.h;y+=32)for(let x=o.x;x<o.x+o.w;x+=32){const m=(y===o.y?1:0)|(x+32>=o.x+o.w?2:0)|(y+32>=o.y+o.h?4:0)|(x===o.x?8:0);if(m)ART.draw(g,'buildings/roofEdge',Math.min(x,o.x+o.w-32),Math.min(y,o.y+o.h-32),{anchorX:0,anchorY:0,mask:m});}
     g.restore();}
   rect(g,o.x+12,o.y+12,o.w-24,4,d.color+'22');
   const h=hash(o.x,o.y),props=['roofVent','roofAC','roofWater','roofSkylight','roofAntenna','roofStair'];
   for(let i=0;i<3+(o.w>300?2:0);i++){const p='buildings/'+props[(hash(o.x+i,o.y)*props.length)|0];if(!hasArt(p))continue;const sp=ART.sprite(p),px=o.x+24+hash(i,o.x)*(o.w-48-sp.w)+sp.w/2,py=o.y+30+hash(o.y,i)*(o.h-60-sp.h)+sp.h;ART.draw(g,p,px,py);}
   if(o.w>240&&hasArt('buildings/roofBillboard')&&h>.6)ART.draw(g,'buildings/roofBillboard',o.x+o.w-40,o.y+o.h-8);
 }
 // status lamps on arena gate posts: amber closed, cyan open, a small glow so the state reads at night
 // a closed gate running north-south is seen almost edge-on: give it height with a cast shadow on the ground, the leaf strip
 // raised by its top rail and a dark face below, so it reads as a barrier and not as lane paint
 function verticalGate(g,o){
   const H=18,x=o.x+o.w/2;g.save();g.fillStyle='#05090c8c';g.fillRect(Math.round(x+2),o.y+6,12,o.h-4);g.fillStyle='#0b1216';g.fillRect(Math.round(x-5),o.y+4,10,o.h-4);g.restore();
   const top={x:o.x,y:o.y-H,w:o.w,h:o.h};drawStrip(g,top,'quarantine/gate');
   g.save();g.fillStyle='#ffad3655';for(let y=o.y-H+8;y<o.y+o.h-H;y+=16)g.fillRect(Math.round(x-5),y,10,2);g.restore();
 }
 function gateLamps(g,ag,open){const r=ag.rect,hz=r.w>=r.h,col=open?'#79e2cf':'#ffad36',pts=hz?[[r.x+3,r.y+r.h-29],[r.x+r.w-3,r.y+r.h-29]]:[[r.x+r.w/2,r.y+3],[r.x+r.w/2,r.y+r.h-3]];for(const [x,y] of pts)ART.glow(g,x,y,12,col,'70');}
 // overhead pieces: tile anchors at their top-left (centre for trolleys), a flat dark copy offset onto the ground below
 function overheadOpt(p){return {anchorX:p.center||p.feet?.5:0,anchorY:p.feet?1:p.center?.5:0,variant:p.variant||0,mask:p.mask||0};}
 function overheadShadow(g,p){if(!hasArt(p.art))return;const o=overheadOpt(p);o.tint='shadow';o.alpha=.45;ART.draw(g,p.art,p.x+4,p.y+10,o);}
 function worldPass(g,s,c){
   const W=root.DSWorld,w=s.world,items=[],push=(y,fn)=>items.push({y,fn});
   for(const o of W.visible(w,c)){
     if(o.type==='building')push(o.y+o.h,()=>{hasArt('buildings/roofFillBig')?bigRoof(g,o):W.legacy.roof(g,o);if(o.facade)sealedFacade(g,o);});
     else if(o.type==='fence')push(o.y+o.h,()=>drawStrip(g,o,'lots/'+o.fence));
     else if(o.type==='door')push(o.y+o.h,()=>drawStrip(g,o,'buildings/doorSecured'));
     // gates (city_v2 V2-1): the Checkpoint barrier is one prop assembly, so its collision strip draws nothing; an open
     // arena gate shows its posts and parked leaves around the centre bollard; post solids are drawn by those sprites
     else if(o.type==='gate'&&(o.gateId==='evac-gate'||o.post)){}
     else if(o.type==='gate'){const ag=o.bollard&&(w.arenaGates||[]).find(q=>q.id===o.gateId);
       if(ag&&hasArt('quarantine/gateOpen_h')){const r=ag.rect,hz=r.w>=r.h;push(r.y+r.h,()=>{if(hz)ART.draw(g,'quarantine/gateOpen_h',r.x+r.w/2,r.y+r.h);else ART.draw(g,'quarantine/gateOpen_v',r.x+r.w/2,r.y+r.h/2);drawStrip(g,o,'quarantine/bollard');gateLamps(g,ag,true);});}
       else push(o.y+o.h,()=>{if(o.h>o.w&&!o.bollard)verticalGate(g,o);else drawStrip(g,o,o.bollard?'quarantine/bollard':'quarantine/gate');const ag2=(w.arenaGates||[]).find(q=>q.id===o.gateId);if(ag2)gateLamps(g,ag2,false);});}
     else if(o.type==='wall')push(o.y+o.h,()=>drawWall(g,o));
     else if(o.type==='furniture')push(o.y+o.h,()=>{
       // campaign states: the chapel generator runs once fuelled; Blackglass's transmitter rack lights once prepared
       const running=o.generator&&s.circuit&&s.circuit.emergency&&hasArt('landmarks/generatorRunning');
       if(running)ART.draw(g,'landmarks/generatorRunning',o.x+o.w/2,o.y+o.h,{frame:Math.floor(s.time*8)%2});else if(hasArt(o.art,o))ART.draw(g,o.art,o.x+o.w/2,o.y+o.h);else placeholder(g,o);
       if(o.art==='buildings/furn_transmitter'&&s.campaign&&s.campaign.prepared&&hasArt('buildings/transmitterLive'))ART.draw(g,'buildings/transmitterLive',o.x+o.w/2,o.y+o.h,{frame:s.campaign.holding==='transmit'||s.campaign.transmitted?Math.floor(s.time*4)%2+1:0});});
     else push(o.y+o.h,()=>drawSolid(g,o,s));
   }
   const overhead=[];
   for(const p of W.visibleProps(w,c)){if(p.overhead){overhead.push(p);overheadShadow(g,p);}else if(p.flat)drawProp(g,p,s);else push(p.y,()=>drawProp(g,p,s));}
   for(const l of s.loot)if(Math.abs(l.x-c.x)<c.w/2+60&&Math.abs(l.y-c.y)<c.h/2+60)push(l.y,()=>loot(g,l,s));
   // infected outside every survivor's cone and every light stay hidden (lights.js seen); they fade in as they enter light
   for(const e of s.enemies)if(Math.abs(e.x-c.x)<c.w/2+70&&Math.abs(e.y-c.y)<c.h/2+70){const a=L?L.seen(s,e):1;if(a<.03)continue;push(e.y,()=>{if(a>=.99){enemy(g,e,s);return;}g.save();g.globalAlpha=a;enemy(g,e,s);g.restore();});}
   for(const v of s.vehicles||[])if(!v.obstacle&&!v.removed&&Math.abs(v.x-c.x)<c.w/2+100&&Math.abs(v.y-c.y)<c.h/2+130)push(v.y+26,()=>vehicleDraw(g,v,s));
   // the waiting civilians: grey survivors, cowering when infected are close
   for(const v of s.civilians||[])if(Math.abs(v.x-c.x)<c.w/2+60&&Math.abs(v.y-c.y)<c.h/2+60)push(v.y,()=>civilian(g,v,s));
   for(const p of s.players)if(p.vehicle==null&&Math.abs(p.x-c.x)<c.w/2+70&&Math.abs(p.y-c.y)<c.h/2+70)push(p.y,()=>survivor(g,p,s));
   if(s.boss)push(s.boss.y+20,()=>root.DSBoss.drawBody(g,s));
   const mast=(w.setpieces||[]).find(p=>p.kind==='radio');if(mast&&Math.abs(mast.x-c.x)<c.w/2+200&&Math.abs(mast.y-c.y)<c.h/2+260)push(mast.y-40,()=>radioMast(g,s,mast));
   items.sort((a,b)=>a.y-b.y);for(const i of items)i.fn();
   for(const h of w.buildings||[])if(h.x+h.w>c.x-c.w/2&&h.x<c.x+c.w/2&&h.y+h.h>c.y-c.h/2-40&&h.y<c.y+c.h/2+40){drawRoof(g,h,s);buildingFacade(g,h);}
   for(const p of overhead)if(hasArt(p.art,p)){ART.draw(g,p.art,p.x,p.y,overheadOpt(p));if(p.light)drawProp(g,{...p,art:null,flat:true},s);} // pipes, gantries and covered links pass over actors and roofs
   // entrances stay readable from the street: doorways draw over the roof edge they cut through
   for(const b of w.buildings||[])if(b.x+b.w>c.x-c.w/2-40&&b.x<c.x+c.w/2+40&&b.y+b.h>c.y-c.h/2-40&&b.y<c.y+c.h/2+60)for(const d of b.exteriorDoors)drawDoorway(g,b,d);
   for(const k of w.landmarks)if(k.id!=='radio'&&k.id!=='checkpoint'&&k.x>c.x-c.w/2-150&&k.x<c.x+c.w/2+150&&k.y>c.y-c.h/2-170&&k.y<c.y+c.h/2+150&&!hasArt('landmarks/hospitalEntrance'))W.legacy.landmark(g,k,s);
   W.legacy.districtMarkings(g,c);
 }
 function ambient(g,s,c){
   const d=root.DSWorld.district(c.x,c.y),left=c.x-c.w/2,top=c.y-c.h/2;
   g.save();g.globalAlpha=.34;
   for(let i=0;i<18;i++){const x=left+((i*193+(s.time*3))%Math.max(1,c.w)),y=top+((i*i*79)%Math.max(1,c.h));rect(g,x,y,2+(i%3===0?2:0),2,(d.theme&&d.theme.specks)||d.atmosphere||'#53616a');}
   g.restore();
 }
 function containment(g,s,c){
   if(Math.abs(c.x)>c.w/2+430||Math.abs(c.y)>c.h/2+430)return;
   ART.glow(g,0,0,245,'#ff543b','20');// the disposal yard floor: a dark square inside the fence, scorched rings around the furnace pit
   rect(g,-367,-367,734,734,'#100f12cc');
   for(const q of [210,292]){g.strokeStyle='#6c3b3155';g.lineWidth=2;g.beginPath();g.arc(0,0,q,0,TAU);g.stroke();}
   if(!s.boss){ART.shadow(g,0,29,43,.7);rect(g,-37,-33,74,64,'#0b1014');rect(g,-31,-28,62,54,'#29323a');rect(g,-22,-18,44,35,'#4b170f');rect(g,-16,-12,32,24,'#8b2b1d');rect(g,-11,-8,22,16,'#ff6a2a');rect(g,-6,-4,12,8,'#fff0bd');text(g,'CENTRAL QUARANTINE',0,-60,'#ff7b35',10);text(g,'PATIENT FURNACE',0,63,'#ffd249',9);text(g,'[ E / A ] BREACH',0,81,'#d8dbc8',7);}
 }
 function dangerBand(g,s,c,left,top){
   if(!s.band)return;const b=s.band,age=s.time-b.at;g.fillStyle=age<3?'#ff7b3523':'#8b2b1d22';
   if(b.vertical)g.fillRect(b.coord-62,top,124,c.h);else g.fillRect(left,b.coord-62,c.w,124);
   g.strokeStyle='#ff9b4a99';g.lineWidth=2;g.setLineDash([8,8]);for(const off of [-62,62]){g.beginPath();if(b.vertical){g.moveTo(b.coord+off,top);g.lineTo(b.coord+off,top+c.h);}else{g.moveTo(left,b.coord+off);g.lineTo(left+c.w,b.coord+off);}g.stroke();}g.setLineDash([]);
 }
 function projectiles(g,s){
   for(const shot of s.shots){const q=Math.max(0,shot.life/shot.maxLife);g.globalAlpha=q;
     if(shot.type==='flame'){const a=shot.angle;ART.glow(g,shot.x+Math.cos(a)*52,shot.y+Math.sin(a)*52,72,'#ff6a2a','3f');
       if(hasArt('vfx/flameTongue')){for(let i=0;i<5;i++){const d=22+i*22,j=Math.sin(s.time*28+i*2.1)*6*(i/5),px=shot.x+Math.cos(a)*d-Math.sin(a)*j,py=shot.y+Math.sin(a)*d+Math.cos(a)*j;g.globalAlpha=q*(1-i*.12);ART.draw(g,'vfx/flameTongue',px,py,{rotate:a,frame:(Math.floor(s.time*24)+i)%5,scale:1+i*.15});}g.globalAlpha=q;continue;}
       for(let i=0;i<7;i++){const d=18+i*13,j=Math.sin(s.time*28+i*2.1)*8*(i/7),px=shot.x+Math.cos(a)*d-Math.sin(a)*j,py=shot.y+Math.sin(a)*d+Math.cos(a)*j,r=9-i*.7;diamond(g,px,py,r,'#4b170f',i<3?'#fff0bd':i<5?'#ffd249':'#ff543b');}}
     else {g.strokeStyle='#0a1014';g.lineWidth=4;g.beginPath();g.moveTo(shot.x,shot.y);g.lineTo(shot.tx,shot.ty);g.stroke();g.strokeStyle=shot.type==='rifle'?'#fff0bd':'#ffd249';g.lineWidth=shot.type==='rifle'?2:1;g.beginPath();g.moveTo(shot.x,shot.y);g.lineTo(shot.tx,shot.ty);g.stroke();if(hasArt('vfx/impactSpark'))ART.draw(g,'vfx/impactSpark',shot.tx,shot.ty,{frame:Math.min(2,Math.floor((1-q)*3))});else rect(g,shot.tx-2,shot.ty-2,4,4,'#ff7b35');}
   }g.globalAlpha=1;
 }
 let vignette=null,vignetteKey='';
 function scene(g,s,width,height,viewport={top:0,bottom:0}){
   const c=s.camera,scale=width/c.w,playHeight=height-viewport.top-viewport.bottom;g.clearRect(0,0,width,height);g.fillStyle='#070a0d';g.fillRect(0,0,width,height);g.save();g.translate(width/2,viewport.top+playHeight/2);g.scale(scale,scale);g.translate(-c.x,-c.y);g.imageSmoothingEnabled=false;
   // the ground and the night cover the HUD bands too (the world shows through their translucent panels), so pad the camera rect by them
   const pad={top:viewport.top/scale+4,bottom:viewport.bottom/scale+4},ground={x:c.x,y:c.y+(pad.bottom-pad.top)/2,w:c.w,h:c.h+pad.top+pad.bottom};
   if(root.DSChunks){root.DSChunks.beginFrame();root.DSChunks.drawGround(g,s,ground);}else root.DSWorld.drawGround(g,s,ground);
   // everything standing in the world is culled with the same padded rect, so nothing pops out under the HUD bands
   const v=ground,left=v.x-v.w/2,top=v.y-v.h/2;if(L)L.begin(s,c,pad);ambient(g,s,c);containment(g,s,v);
   const radio=s.world.landmarks.find(l=>l.id==='radio');if(radio&&Math.abs(radio.x-v.x)<v.w/2+140&&Math.abs(radio.y-v.y)<v.h/2+180){ART.glow(g,radio.x,radio.y-20,105,s.radio.done?'#79e2cf':'#ffd249','24');g.strokeStyle=s.radio.done?'#79e2cf':'#ffd249';g.lineWidth=2;g.beginPath();g.arc(radio.x,radio.y,95,0,TAU);g.stroke();if(s.radio.active){g.lineWidth=5;g.beginPath();g.arc(radio.x,radio.y,95,-Math.PI/2,-Math.PI/2+TAU*s.radio.progress/32);g.stroke();}text(g,s.radio.done?'SIGNAL RESTORED':'BLACKGLASS RADIO',radio.x,radio.y+117,s.radio.done?'#79e2cf':'#ffd249',9);}
   if(hasArt('vfx/bloodDecal'))for(const d of s.decals||[])if(Math.abs(d.x-v.x)<v.w/2+30&&Math.abs(d.y-v.y)<v.h/2+30)ART.draw(g,'vfx/bloodDecal',d.x,d.y,{variant:d.variant,alpha:.85});
   root.DSBoss.drawGround(g,s);
   worldPass(g,s,v);projectiles(g,s);
   for(const f of s.fx){g.globalAlpha=Math.min(1,f.life*2);if(f.sprite&&hasArt(f.sprite)){ART.draw(g,f.sprite,f.x,f.y,{frame:Math.min(f.frames-1,Math.floor((1-f.life/f.maxLife)*f.frames)),variant:f.variant||0});continue;}text(g,f.text,f.x,f.y-(1-f.life/f.maxLife)*22,f.color,8);}g.globalAlpha=1;
   // DS_DIAGNOSTIC_LIGHT (development only, city_v2 art review): skip the night so materials are judged in neutral light
   if(L&&!root.DS_DIAGNOSTIC_LIGHT)L.draw(g,s,c); // the night: multiply the lightmap over everything in the world, before the vignette and the HUD
   g.restore();
   const key=width+','+playHeight;
   if(key!==vignetteKey){
     vignetteKey=key;vignette=document.createElement('canvas');vignette.width=width;vignette.height=Math.max(1,playHeight);
     const vg=vignette.getContext('2d'),vig=vg.createRadialGradient(width/2,playHeight/2,Math.min(width,playHeight)*.20,width/2,playHeight/2,width*.7);
     vig.addColorStop(0,'transparent');vig.addColorStop(.68,'#05090d10');vig.addColorStop(1,L?'#03070b70':'#03070bc4');vg.fillStyle=vig;vg.fillRect(0,0,width,playHeight);
   }
   g.drawImage(vignette,0,viewport.top);
 }
 root.DSRender={fallbacks:()=>[...FALLBACKS.values()].map(f=>({...f,at:f.at.slice()})),resetFallbacks:()=>FALLBACKS.clear(),scene,chunkCanvas:(cx,cy,s)=>root.DSChunks?root.DSChunks.chunkCanvas(cx,cy,s):null};
})(typeof window!=='undefined'?window:globalThis);
