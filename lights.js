(function(root){
 'use strict';
 // Night lighting. A lightmap at one pixel per world unit covers the camera:
 // the district's ambient colour, plus every light source painted additively
 // (lamps, fires, muzzle flashes, the boss, glowing infected, loot) and a
 // shadow-cast vision cone per survivor, each with the shadows of whatever stands
 // in it (render.js registers the casters as it draws them). render.js multiplies
 // it over the world after the actors and before the vignette, so the HUD stays unlit.
 // seen(s,e) says how lit an infected is (0..1); render fades unseen ones out.
 // Everything here is render-only: the only fields written on simulation
 // objects are p.viewAngle and e.lit, which game.js never reads.
 var CONE={half:.61,range:340,near:90,rays:56}; // mirrors game.js SIGHT
 var HEADLESS=typeof root.HTMLCanvasElement==='undefined'; // the tools' software canvas has no multiply
 function W(){return root.DSWorld;}
 var map=null,mg=null,mw=0,mh=0,lastTime=-1,dtR=0;
 var litMap=null,litG=null;
 // how much of the collected light is added back on top of the multiply pass. 0 restores the old
 // shadow-only behaviour; much above .6 and the night stops being dark.
 var LIGHT_ADD=.2;
 // How far a survivor's cone reaches INTO the obstacle it hits, in world units -- the knob that decides
 // whether solid things read as lit. Every car, wall and building STANDS ON the ground it occludes, so
 // a cone that stops dead at the near face leaves the whole object inside its own shadow: lit street
 // all around it and a dark body, however bright the light. The cone now carries on past the near face,
 // fading out over this depth in BITE_STEPS bands (never past the far face, so nothing leaks through).
 // Props and car wrecks light right through; a bus or a building gets a lit near side fading into dark.
 // 0 restores the old dark bodies; much above ~140 and buildings light up like floodlit billboards.
 var LIGHT_BITE=96,BITE_STEPS=4;
 var view={left:0,top:0,right:0,bottom:0}; // the camera rect padded by the HUD bands (in world units), set in begin()
 var lights=[],nl=0,pobs=[],poly=new Float32Array((CONE.rays+2)*2);
 var rayHit=new Float32Array(CONE.rays+1),rayEnd=new Float32Array(CONE.rays+1),rayDx=new Float32Array(CONE.rays+1),rayDy=new Float32Array(CONE.rays+1);
 var gradCache=new Map(),rgbCache={};

 function rgb(hex){var c=rgbCache[hex];if(!c){c=[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];rgbCache[hex]=c;}return c;}
 // a cached radial light: full colour at the centre, half at a third, gone at the rim
 function grad(r,col){
   var key=r+'|'+col,c=gradCache.get(key);
   if(!c){c=document.createElement('canvas');c.width=c.height=r*2;var g=c.getContext('2d'),q=g.createRadialGradient(r,r,0,r,r,r);
     q.addColorStop(0,col+'ff');q.addColorStop(.35,col+'8c');q.addColorStop(1,col+'00');g.fillStyle=q;g.fillRect(0,0,r*2,r*2);
     gradCache.set(key,c);if(gradCache.size>64)gradCache.delete(gradCache.keys().next().value);}
   return c;
 }
 // src: the object the light comes from, which never throws its own shadow from it
 function addLight(x,y,r,col,a,src){var l=lights[nl]||(lights[nl]={});l.x=x;l.y=y;l.r=r;l.col=col;l.a=a;l.src=src||null;nl++;}
 // how bright a lamp is right now: dead lamps 0, strobing ones a hard flicker, the rest a slow sway
 function lampLevel(p,t){
   if(!p.lit)return 0;var h0=W().mix(p.x,p.y);
   if(p.strobe)return Math.sin(t*40+h0*50)>.6?1:.12;
   return .85+.15*Math.sin(t*(2+h0*3)+h0*20);
 }
 function lootColour(l){return (l.type==='heal'||l.type==='medkit')?'#9fd39f':l.type==='evidence'||l.type==='payload'||l.type==='override'?'#d8dbc8':l.type==='provision'?'#b8d86b':l.type==='vehicleFuel'?'#ffd249':l.type==='weapon'?'#ffd249':l.type==='xp'?'#79e2cf':l.ammo==='fuel'?'#ff8b3d':'#d7cda8';}
 function collect(s,c){
   nl=0;var w=s.world,t=s.time,left=view.left,top=view.top,right=view.right,bottom=view.bottom,i,p,o,a,r,x,y;
   var inView=function(x,y,r){return x+r>left&&x-r<right&&y+r>top&&y-r<bottom;};
   var lit=function(p,src){if(!p.light)return;if(p.circuit&&!(s.circuit&&s.circuit[p.circuit]))return;var dy=p.light.dy==null?24:p.light.dy;x=p.x+(p.light.dx||0);y=p.y-dy;r=p.light.r;if(!inView(x,y,r))return;
     a=parseInt(p.light.a||'55',16)/255;a=p.art==='props/streetLamp'||p.strobe?a*lampLevel({x:p.x,y:p.y,lit:true,strobe:p.strobe},t)*(p.art==='props/streetLamp'?1:3):Math.min(1,a*3);
     if(p.flicker)a*=.8+.2*Math.sin(t*6+p.x*.01);if(a>.01)addLight(x,y,r,p.light.col,Math.min(1,a),src||p);};
   var props=w.props||[];for(i=0;i<props.length;i++)lit(props[i]);
   var obs=W().visible(w,{x:(left+right)/2,y:(top+bottom)/2,w:right-left+260,h:bottom-top+260});
   for(i=0;i<obs.length;i++){o=obs[i];if(o.light&&!(o.hp<=0)){lit({x:o.x+o.w/2,y:o.y+o.h,light:o.light},o);}
     if(o.burning&&!(o.hp<=0))addLight(o.x+o.w/2,o.y+o.h/2-6,120,'#ff6a2a',.8+.2*Math.sin(t*13+o.x),o);}
   for(i=0;i<s.players.length;i++){p=s.players[i];if(p.dead||!(p.muzzle>0))continue;var ang=p.angle||0;addLight(p.x+Math.cos(ang)*22,p.y-14+Math.sin(ang)*22,140,'#ffb057',1);}
   for(var v of s.vehicles||[]){
     if(v.dead||v.driver==null||v.fuel<=0||!inView(v.x,v.y,290))continue;
     var ca=Math.cos(v.angle),sa=Math.sin(v.angle);
     for(var side of [-1,1]){
       var level=v.integrity<v.maxIntegrity*.35&&side===-1&&Math.sin(t*37+v.x*.03)>.3?.18:.95;
       var hl=HEADLIGHTS[v.vehicleType]||HEADLIGHTS.sedan;addLight(v.x+ca*hl.ahead-sa*side*hl.side,v.y+sa*hl.ahead+ca*side*hl.side,hl.r,'#ffe9bd',level,v);
     }
   }
   for(i=0;i<s.shots.length;i++){var sh=s.shots[i];if(sh.type!=='flame')continue;addLight(sh.x+Math.cos(sh.angle)*52,sh.y+Math.sin(sh.angle)*52,90,'#ff7b35',.5*Math.max(0,sh.life/sh.maxLife));}
   if(s.boss&&s.boss.active)addLight(s.boss.x,s.boss.y,260,'#ff6a2a',.9,s.boss);
   if(Math.abs(c.x)<c.w/2+430&&Math.abs(c.y)<c.h/2+430)addLight(0,0,320,'#ff543b',.45);
   var mast=null;for(var mi=0;mi<(w.setpieces||[]).length;mi++)if(w.setpieces[mi].kind==='radio')mast=w.setpieces[mi];
   // the restored tower is the strongest light in the city: a wide steady pool plus the pulse, seen from well outside the view
   var live=s.circuit&&s.circuit.emergency||s.radio&&s.radio.done;
   if(mast&&live&&inView(mast.x,mast.y-220,420))addLight(mast.x,mast.y-220,420,'#79e2cf',.35);
   if(mast&&inView(mast.x,mast.y-220,live?260:140)&&Math.floor(t*1.4)%2===0)addLight(mast.x,mast.y-220,live?260:120,live?'#79e2cf':'#ff543b',live?.8:.45);
   var hs=w.buildings||[];
   for(i=0;i<s.loot.length;i++){var l=s.loot[i];if(l.taken||!inView(l.x,l.y,28))continue;
     if(l.interior){var hidden=false;for(var k=0;k<hs.length&&!hidden;k++){var h=hs[k];if(!(l.x>h.x&&l.x<h.x+h.w&&l.y>h.y&&l.y<h.y+h.h))continue;
       for(var zi=0;zi<h.roofZones.length&&!hidden;zi++){var z=h.roofZones[zi];if(z.alpha<=.5)continue;for(var ri=0;ri<z.rects.length;ri++){var q=z.rects[ri];if(l.x>q.x&&l.x<q.x+q.w&&l.y>q.y&&l.y<q.y+q.h){hidden=true;break;}}}}if(hidden)continue;}
     addLight(l.x,l.y,30,lootColour(l),.6);}
   for(i=0;i<s.enemies.length;i++){var e=s.enemies[i];if(e.dead||!inView(e.x,e.y,56))continue;
     if(e.type==='ghost')addLight(e.x,e.y-14,44,'#786b91',.5,e);else if(e.type==='carrier')addLight(e.x,e.y-12,56,'#ff6a2a',.7,e);}
 }
 // nearest hit along a ray against the obstacle list (slab test, no allocation); returns the distance,
 // at most R, and leaves the far side of that same obstacle in rayOut (also R when nothing was hit)
 var rayOut=0;
 // waist-high obstacles (cars, rubble, barriers, debris, open-gate bollards) never stop a flashlight: they would cut a
 // hard dark wedge across their own sprite. They throw a soft 'low' silhouette shadow in castShadows() instead.
 var LOW={car:1,rubble:1,barrier:1,debris:1};
 function rayT(x,y,dx,dy,R,obs){
   var best=R,i,o,tmin,tmax,inv,t1,t2,tmp;rayOut=R;
   for(i=0;i<obs.length;i++){o=obs[i];if(o.hp!==undefined&&o.hp<=0)continue;if(o.type==='furniture'||o.seeThrough||LOW[o.type]||o.bollard||o.post)continue;
     tmin=0;tmax=R;
     if(dx!==0){inv=1/dx;t1=(o.x-x)*inv;t2=(o.x+o.w-x)*inv;if(t1>t2){tmp=t1;t1=t2;t2=tmp;}if(t1>tmin)tmin=t1;if(t2<tmax)tmax=t2;}else if(x<o.x||x>o.x+o.w)continue;
     if(dy!==0){inv=1/dy;t1=(o.y-y)*inv;t2=(o.y+o.h-y)*inv;if(t1>t2){tmp=t1;t1=t2;t2=tmp;}if(t1>tmin)tmin=t1;if(t2<tmax)tmax=t2;}else if(y<o.y||y>o.y+o.h)continue;
     if(tmin<=tmax&&tmin<best){best=tmin;rayOut=tmax;}}
   return best;
 }
 function wrap(a){return Math.atan2(Math.sin(a),Math.cos(a));}
 // the survivor's facing eases toward the aim/move angle so strafing does not snap the cone
 function heading(p){var a=p.moveAngle==null?p.angle||0:p.moveAngle;if(p.viewAngle==null)p.viewAngle=a;p.viewAngle+=wrap(a-p.viewAngle)*Math.min(1,dtR*10);return p.viewAngle;}
 // the visibility polygon of one survivor: apex plus one point per ray, in poly; returns the point count.
 // The rays are cast once here; conePoly() rebuilds poly for any bite depth from the cached hits.
 function cone(s,p,obs){
   var a=heading(p),R=CONE.range,n=CONE.rays,i,ang;
   for(i=0;i<=n;i++){ang=a-CONE.half+2*CONE.half*i/n;rayDx[i]=Math.cos(ang);rayDy[i]=Math.sin(ang);
     rayHit[i]=rayT(p.x,p.y,rayDx[i],rayDy[i],R,obs);rayEnd[i]=rayOut;}
   return conePoly(p,LIGHT_BITE);
 }
 // the cone carried `bite` units into whatever each ray hit, clamped to that obstacle's far face
 function conePoly(p,bite){
   var R=CONE.range,n=CONE.rays,k=2,i,t;poly[0]=p.x;poly[1]=p.y;
   for(i=0;i<=n;i++){t=rayHit[i];if(t<R)t=Math.min(R,rayEnd[i],t+bite);poly[k++]=p.x+rayDx[i]*t;poly[k++]=p.y+rayDy[i]*t;}
   return k/2;
 }
 // once per frame before the world pass: clock, headings, light sources, each survivor's nearby obstacles
 function begin(s,c,pad){
   dtR=lastTime<0?0:Math.max(0,Math.min(.1,s.time-lastTime));lastTime=s.time;
   pad=pad||{top:0,bottom:0};view.left=c.x-c.w/2;view.right=c.x+c.w/2;view.top=c.y-c.h/2-pad.top;view.bottom=c.y+c.h/2+pad.bottom;
   collect(s,c);ncast=0; // render.js registers this frame's shadow casters during the world pass
   var R=CONE.range;
   for(var i=0;i<s.players.length;i++){var p=s.players[i];heading(p);pobs[p.id]=p.dead?null:W().queryObstacles(s.world,p.x-R,p.y-R,p.x+R,p.y+R);}
 }
 // how lit an infected is: inside a survivor's near circle or unblocked cone, or under a light
 function seen(s,e){
   var target=0,ex=e.x,ey=e.y-10,i,p,dx,dy,d,v,obs;
   for(i=0;i<s.players.length&&target<1;i++){p=s.players[i];if(p.dead)continue;
     dx=ex-p.x;dy=ey-p.y;d=Math.sqrt(dx*dx+dy*dy);
     if(d<CONE.near+(e.r||10)){target=1;break;}
     if(d>CONE.range+10)continue;
     var diff=Math.abs(wrap(Math.atan2(dy,dx)-(p.viewAngle==null?p.angle||0:p.viewAngle))),edge=CONE.half+.1;
     if(diff>=edge)continue;
     v=Math.min(Math.min(1,(edge-diff)/.25),Math.min(1,(CONE.range+10-d)/80));
     if(v<=target)continue;
     obs=pobs[p.id];if(obs&&rayT(p.x,p.y,dx/d,dy/d,d,obs)<d-1)continue;
     target=v;}
   for(i=0;i<nl&&target<1;i++){var l=lights[i];if(l.r<44)continue;dx=ex-l.x;dy=ey-l.y;d=Math.sqrt(dx*dx+dy*dy);if(d>=l.r)continue;v=Math.min(1,1-d/l.r)*Math.min(1,l.a*1.6);if(v<=target)continue;
     if(root.DSGame&&root.DSGame.occluded&&root.DSGame.occluded(s,l.x,l.y,ex,ey))continue;target=v;}
   if(e.lit==null)e.lit=0;e.lit+=(target-e.lit)*Math.min(1,dtR*8);return e.lit;
 }
 // ambient colour under the camera, blended toward neighbouring districts near a border
 var ambBuf=[0,0,0];
 function ambient(s,c){
   var pts=[[0,0],[300,0],[-300,0],[0,300],[0,-300]],i,col,k;ambBuf[0]=ambBuf[1]=ambBuf[2]=0;
   for(i=0;i<5;i++){col=rgb(W().district(c.x+pts[i][0],c.y+pts[i][1]).theme.ambient);for(k=0;k<3;k++)ambBuf[k]+=col[k]*(i?.125:.5);}
   return 'rgb('+Math.round(ambBuf[0])+','+Math.round(ambBuf[1])+','+Math.round(ambBuf[2])+')';
 }

 // ---- shadows ----
 // render.js registers each caster as it draws it (caster()), so the silhouette is exactly the frame on screen.
 // A caster reached by exactly ONE light throws its silhouette away from that light: standing things (actors,
 // props, feet-anchored obstacles) sheared along the ground, cars (low, seen from above) as a copy slid away.
 // A caster reached by two or more lights throws none. Where lights overlap, shadows are left out on purpose:
 // painting one light's shadow wipes out the others under it (a second light made the ground darker), and
 // doing it properly per light is not worth the frame time. All shadows go into one layer, each caster's own
 // body is cut back out (a light behind something never paints its shadow over it), and the layer is laid on
 // the map once, in the ambient colour.
 var SHADOW=.8;   // how dark a shadow is right next to its light (it fades toward the light's rim)
 var CAR_H=20;    // how tall a car stands, in world units; sets how far its shadow slides
 var casters=[],ncast=0,silCache=new WeakMap(),shadeMap=null,shG=null;
 function silhouette(sp){
   var c=silCache.get(sp.canvas);
   if(!c){c=document.createElement('canvas');c.width=sp.w;c.height=sp.h;var g=c.getContext('2d');g.drawImage(sp.canvas,0,0);g.globalCompositeOperation='source-in';g.fillStyle='#000';g.fillRect(0,0,sp.w,sp.h);silCache.set(sp.canvas,c);}
   return c;
 }
 // render.js, right after drawing sprite `sp` at (x,y) with the ART.draw options in o (anchorX/Y resolved, flip, flipY,
 // rotate, scale). o.kind 'stand' (default) or 'low'; o.src the simulation object, whose own lights never shadow it;
 // o.occ for solid obstacles, which the cone rays already stop at; o.vid a vehicle whose passengers' lights skip it.
 function caster(sp,x,y,o){
   if(HEADLESS||!sp)return;
   var c=casters[ncast]||(casters[ncast]={});ncast++;
   var sc=o.scale||1,fl=o.flip?-1:1,ax=o.anchorX==null?.5:o.anchorX,ay=o.anchorY==null?1:o.anchorY;
   c.img=silhouette(sp);c.w=sp.w;c.h=sp.h;c.x=Math.round(x);c.y=Math.round(y);c.ax=ax;c.ay=ay;c.sc=sc;c.fl=fl;c.flY=o.flipY?-1:1;c.rot=o.rotate||0;
   c.kind=o.kind||'stand';c.src=o.src||null;c.occ=!!o.occ;c.vid=o.vid==null?null:o.vid;
   // the point the shadow hangs from: bottom centre of a standing sprite (2 below the feet, so it tucks under them), centre of a low one
   c.gx=c.x+(.5-ax)*sp.w*sc*fl;c.gy=c.kind==='low'?c.y+(.5-ay)*sp.h*sc:c.y+(1-ay)*sp.h*sc+2;
 }
 // the caster's silhouette where render.js drew it, slid by (dx,dy); the map's top-left is world (ox,oy)
 function body(g,c,ox,oy,dx,dy){
   g.save();g.translate(c.x-ox+dx,c.y-oy+dy);if(c.rot)g.rotate(c.rot);g.scale(c.fl*c.sc,c.flY*c.sc);
   g.drawImage(c.img,Math.round(-c.w*c.ax),Math.round(-c.h*c.ay));g.restore();
 }
 // c's shadow from a light at (lx,ly) of radius lr, at alpha a
 function throwShadow(g,c,ox,oy,lx,ly,lr,a){
   var dx=c.gx-lx,dy=c.gy-ly,d=Math.sqrt(dx*dx+dy*dy)||1,ux=dx/d,uy=dy/d,k=.4+1.1*d/lr,len;
   g.globalAlpha=a;
   // a waist-high body throws a short, half-strength offset of itself: a contact shadow, not a black copy of the car
   if(c.kind==='low'){len=Math.min(12,CAR_H*.45*k);g.globalAlpha=a*.5;body(g,c,ox,oy,ux*len,uy*len);return;}
   len=c.h*c.sc*k;
   g.save();g.translate(c.gx-ox,c.gy-oy);g.transform(c.fl*c.sc,0,-ux*len/c.h,-uy*len/c.h,0,0);g.drawImage(c.img,-c.w/2,-c.h);g.restore();
 }
 // the one light reaching the point (x,y), left in one.{x,y,r,st}; returns how many reach it (stops counting at 2).
 // src is the caster's own object (its own glow, headlights or near circle never count); occ marks a solid
 // obstacle, which the cone rays already stop at, so only a survivor's near circle counts for it.
 var one={x:0,y:0,r:0,st:0};
 function lightsAt(s,x,y,src,occ,vid){
   var n=0,i,l,p,dx,dy,d2,d,st,obs;
   for(i=0;i<nl&&n<2;i++){l=lights[i];if(l.r<44||(src&&l.src===src))continue;
     dx=x-l.x;dy=y-l.y;d2=dx*dx+dy*dy;if(d2<400||d2>=l.r*l.r)continue; // within 20 of the feet is the caster's own glow
     n++;one.x=l.x;one.y=l.y;one.r=l.r;one.st=Math.min(1,l.a);}
   for(i=0;i<s.players.length&&n<2;i++){p=s.players[i];if(p.dead||p===src||(vid!=null&&p.vehicle===vid))continue;
     dx=x-p.x;dy=y-p.y;d2=dx*dx+dy*dy;if(d2<16||d2>=CONE.range*CONE.range)continue;d=Math.sqrt(d2);
     if(d<CONE.near)st=1;
     else{if(occ)continue;
       var diff=Math.abs(wrap(Math.atan2(dy,dx)-(p.viewAngle==null?p.angle||0:p.viewAngle)));
       st=diff<CONE.half?1:diff<CONE.half+.12?(CONE.half+.12-diff)/.12:0;if(!st)continue;
       obs=pobs[p.id];if(obs&&rayT(p.x,p.y,dx/d,dy/d,d,obs)<d-1)continue;} // a wall between them: the cone never gets there
     n++;one.x=p.x;one.y=p.y;one.r=CONE.range;one.st=st;}
   return n;
 }
 // the boss has no registered sprite: a plain wedge
 function bossWedge(g,s,ox,oy,lx,ly,lr,st){
   var x=s.boss.x,y=s.boss.y+30,rad=40,dx=x-lx,dy=y-ly,d=Math.sqrt(dx*dx+dy*dy);if(d<4||d>=lr)return false;
   var a=.5*(1-d/lr)*st;if(a<.03)return false;
   var len=Math.min(120,10+d*.25)*(rad/12),ux=dx/d,uy=dy/d,px=-uy,py=ux,w0=rad*.9,w1=rad*1.3;
   g.globalAlpha=a;g.fillStyle='#000';g.beginPath();
   g.moveTo(x+px*w0-ox,y+py*w0-oy);g.lineTo(x+ux*len+px*w1-ox,y+uy*len+py*w1-oy);
   g.lineTo(x+ux*len-px*w1-ox,y+uy*len-py*w1-oy);g.lineTo(x-px*w0-ox,y-py*w0-oy);g.closePath();g.fill();
   return true;
 }
 function castShadows(s,left,top,lw,lh,amb){
   var i,c,any=false,f,a;
   shG.setTransform(1,0,0,1,0,0);shG.globalCompositeOperation='source-over';shG.globalAlpha=1;shG.clearRect(0,0,lw,lh);
   for(i=0;i<ncast;i++){c=casters[i];c.hit=false;
     if(lightsAt(s,c.gx,c.gy,c.src,c.occ&&c.kind!=='low',c.vid)!==1)continue; // low solids take flashlight shadows too
     f=1-Math.hypot(c.gx-one.x,c.gy-one.y)/one.r;a=SHADOW*Math.min(1,f*2.4)*one.st;if(a<.03)continue;
     throwShadow(shG,c,left,top,one.x,one.y,one.r,a);c.hit=any=true;}
   if(s.boss&&s.boss.active&&lightsAt(s,s.boss.x,s.boss.y+30,s.boss,false,null)===1&&bossWedge(shG,s,left,top,one.x,one.y,one.r,one.st))any=true;
   if(!any)return;
   shG.globalAlpha=1;shG.globalCompositeOperation='destination-out';
   for(i=0;i<ncast;i++){c=casters[i];if(c.hit)body(shG,c,left,top,0,0);}
   shG.globalCompositeOperation='source-in';shG.fillStyle=amb;shG.fillRect(0,0,lw,lh);
   mg.globalCompositeOperation='source-over';mg.globalAlpha=1;mg.drawImage(shadeMap,0,0);
 }
 // Point lights stop at walls, buildings, closed doors and solid fences (chain-link lets light through). The
 // visibility polygon is cached per source until the geometry changes (navVersion), and bites a few units into
 // what it hits so a lit wall face still reads lit.
 var OCC={wall:1,building:1,door:1,fence:1},occCache=new WeakMap(),OCC_RAYS=40,OCC_BITE=10,occPts=new Float32Array((OCC_RAYS+1)*2);
 var HEADLIGHTS={sedan:{ahead:112,side:18,r:170},fireTruck:{ahead:150,side:24,r:210},bulldozer:{ahead:110,side:30,r:150}};
 function lightPoly(s,l){
   var src=l.src&&typeof l.src==='object'?l.src:null,ver=s.navVersion||0,c=src&&occCache.get(src);
   if(c&&c.ver===ver&&c.x===l.x&&c.y===l.y&&c.r===l.r)return c.pts;
   var obs=W().queryObstacles(s.world,l.x-l.r,l.y-l.r,l.x+l.r,l.y+l.r).filter(function(o){return OCC[o.type]&&!o.seeThrough&&!(o.hp<=0)&&!(l.x>o.x&&l.x<o.x+o.w&&l.y>o.y&&l.y<o.y+o.h);}),pts=null;
   if(obs.length){var clear=true,out=new Float32Array(OCC_RAYS*2);
     for(var i=0;i<OCC_RAYS;i++){var an=i/OCC_RAYS*Math.PI*2,dx=Math.cos(an),dy=Math.sin(an),tt=rayT(l.x,l.y,dx,dy,l.r,obs);if(tt<l.r){clear=false;tt=Math.min(l.r,tt+OCC_BITE);}out[i*2]=l.x+dx*tt;out[i*2+1]=l.y+dy*tt;}
     pts=clear?null:out;}
   if(src)occCache.set(src,{ver:ver,x:l.x,y:l.y,r:l.r,pts:pts});return pts;
 }
 function paintLight(g,l,ox,oy,s){
   var pts=s&&l.src!==s.boss&&!(l.src&&l.src.vehicleType)?lightPoly(s,l):null;
   if(pts){g.save();g.beginPath();g.moveTo(pts[0]-ox,pts[1]-oy);for(var k=1;k<OCC_RAYS;k++)g.lineTo(pts[k*2]-ox,pts[k*2+1]-oy);g.closePath();g.clip();}
   g.globalAlpha=l.a;g.drawImage(grad(l.r,l.col),Math.round(l.x-l.r-ox),Math.round(l.y-l.r-oy));
   if(pts)g.restore();
 }
 // BITE_STEPS nested cone polygons at 1/BITE_STEPS each: open ground is inside all of them and gets the full
 // cone, while the inside of an obstacle steps down band by band with depth past its lit face
 function paintCone(g,p,ox,oy){
   var R=CONE.range,j,k,n;
   for(j=1;j<=BITE_STEPS;j++){n=conePoly(p,LIGHT_BITE*j/BITE_STEPS);
     g.save();g.beginPath();g.moveTo(poly[0]-ox,poly[1]-oy);for(k=1;k<n;k++)g.lineTo(poly[k*2]-ox,poly[k*2+1]-oy);g.closePath();g.clip();
     g.globalAlpha=1/BITE_STEPS;g.drawImage(grad(R,'#cfd9e0'),Math.round(p.x-R-ox),Math.round(p.y-R-oy));g.restore();}
   g.globalAlpha=.9;g.drawImage(grad(CONE.near,'#cfd9e0'),Math.round(p.x-CONE.near-ox),Math.round(p.y-CONE.near-oy));
 }
 function draw(g,s,c){
   if(HEADLESS)return;
   var left=Math.floor(view.left)-1,top=Math.floor(view.top)-1,lw=Math.ceil(view.right)-left+2,lh=Math.ceil(view.bottom)-top+2,i,p,l;
   // three canvases the size of the lightmap: the map itself, litMap for the additive pass, shadeMap for the shadows
   if(!map||lw!==mw||lh!==mh){map=document.createElement('canvas');map.width=mw=lw;map.height=mh=lh;mg=map.getContext('2d');
     litMap=document.createElement('canvas');litMap.width=lw;litMap.height=lh;litG=litMap.getContext('2d');
     shadeMap=document.createElement('canvas');shadeMap.width=lw;shadeMap.height=lh;shG=shadeMap.getContext('2d');}
   var amb=ambient(s,c);
   mg.globalCompositeOperation='source-over';mg.globalAlpha=1;mg.fillStyle=amb;mg.fillRect(0,0,lw,lh);
   mg.globalCompositeOperation='lighter';
   for(i=0;i<nl;i++)paintLight(mg,lights[i],left,top,s);
   for(i=0;i<s.players.length;i++){p=s.players[i];
     if(p.dead){mg.globalAlpha=.6;mg.drawImage(grad(50,'#cfd9e0'),Math.round(p.x-50-left),Math.round(p.y-50-top));continue;}
     cone(s,p,pobs[p.id]||[]);paintCone(mg,p,left,top);}
   castShadows(s,left,top,lw,lh,amb);
   mg.globalCompositeOperation='source-over';mg.globalAlpha=1;
   g.save();g.imageSmoothingEnabled=false;
   // Shadow pass: multiply can only darken, so on its own the brightest a lit prop can ever get is
   // its own raw sprite colour -- and this game's art is authored dark. Everything in a lamp pool
   // read as "not shaded" rather than "lit", which is not what a light looks like.
   g.globalCompositeOperation='multiply';g.drawImage(map,left,top);
   // Light pass: the same map with the ambient floor removed, so only the light the lamps and cones
   // actually contributed is left (|map - ambient| is 0 wherever nothing lit it, and shadows are laid
   // in the ambient colour, so they stay dark here too). Added on top, this is what puts warm light
   // ONTO a surface instead of merely failing to darken it.
   litG.globalCompositeOperation='source-over';litG.globalAlpha=1;litG.clearRect(0,0,lw,lh);litG.drawImage(map,0,0);
   litG.globalCompositeOperation='difference';litG.fillStyle=amb;litG.fillRect(0,0,lw,lh);
   g.globalCompositeOperation='lighter';g.globalAlpha=LIGHT_ADD;g.drawImage(litMap,left,top);
   g.restore();
 }
 root.DSLights={CONE:CONE,active:!HEADLESS,begin:begin,draw:draw,caster:caster,seen:seen,cone:cone,lampLevel:lampLevel,collect:collect,lights:function(){return lights.slice(0,nl);}};
})(typeof window!=='undefined'?window:globalThis);
