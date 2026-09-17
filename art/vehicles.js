// Dead Signal vehicles: the handful of cars a survivor can actually drive.
// One texel = one world unit (den 1). Same footprint family as art/wrecks.js
// ('car' 96x48 / 48x96, WRECK.car in world.js) so a car that breaks down and
// swaps to wrecks/car_h|v mid-frame never jumps in size, position or model:
// same 96x58 / 48x106 canvas, same rounded-box corner cut, same body/shade/
// ground-contact banding, same glass rect and wheel-well positions as
// wrecks/car_h|v. What makes it read "intact" against a street of burnt
// shells: unbroken glass with a clean specular streak (not a blown-out
// cavity), two round un-flattened wheels, closed panels (no open-door hole),
// glassy headlight and taillight lenses instead of a dead lightbar. Paint is
// dirty and desaturated — two low-chroma custom ramps (tools/art/ramp.mjs),
// D+K steps only, never the light steps — this is a nine-day-old quarantined
// city, not a showroom. 2 variants really render (render.js carId%2): a
// dull slate-blue saloon and a dull brick-maroon estate, both flippable/
// flippable-Y on their own long axis with no one-sided mirrors or badges.
(function(){
  'use strict';
  var A=(typeof window!=='undefined'?window:globalThis).DSArt;
  var MAT=A.MAT;

  // ---- grid helpers (art/wrecks.js style) ----
  function mkGrid(w,h){var g=[],y,x,row;for(y=0;y<h;y++){row=[];for(x=0;x<w;x++)row.push('.');g.push(row);}return g;}
  function setclip(g,x,y,ch){if(y>=0&&y<g.length&&x>=0&&x<g[0].length)g[y][x]=ch;}
  function rect(g,x0,y0,x1,y1,ch){var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)setclip(g,x,y,ch);}
  function toRows(g){return g.map(function(r){return r.join('');});}

  function cutCorners(g,x0,y0,x1,y1,c){
    var x,y,dl,dr,dt,db;
    for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++){
      dl=x-x0;dr=x1-x;dt=y-y0;db=y1-y;
      if((dl<c&&dt<c&&dl+dt<c)||(dr<c&&dt<c&&dr+dt<c)||(dl<c&&db<c&&dl+db<c)||(dr<c&&db<c&&dr+db<c))setclip(g,x,y,'.');
    }
  }
  function outlineFromFill(g,K){
    var h=g.length,w=g[0].length,x,y,copy=g.map(function(r){return r.slice();});
    function at(px,py){return px<0||py<0||px>=w||py>=h?'.':copy[py][px];}
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      if(copy[y][x]==='.')continue;
      if(at(x-1,y)==='.'||at(x+1,y)==='.'||at(x,y-1)==='.'||at(x,y+1)==='.')g[y][x]=K;
    }
  }
  // round, un-flattened wheel: dark tyre body, K ring, one small rim highlight
  function wheel(g,x0,y0,w,h,D,K,rim){
    var x1=x0+w-1,y1=y0+h-1,x,y;
    rect(g,x0,y0,x1,y1,D);
    cutCorners(g,x0,y0,x1,y1,2);
    for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++){if(g[y][x]==='.')continue;if(x===x0||x===x1||y===y0||y===y1)g[y][x]=K;}
    cutCorners(g,x0,y0,x1,y1,2);
    setclip(g,x0+Math.floor(w/2),y0+Math.floor(h/2)-1,rim);
    setclip(g,x0+Math.floor(w/2),y0+Math.floor(h/2)+1,rim);
  }
  // a small glassy lens: dark socket ring, 1-2px bright core (headlight warm,
  // taillight dull red) — never a big saturated block, just enough to read
  // as glass catching light
  function lens(g,x0,y0,w,h,K,core){
    rect(g,x0,y0,x0+w-1,y0+h-1,core);
    var x,y;for(y=y0;y<=y0+h-1;y++)for(x=x0;x<=x0+w-1;x++)if(x===x0||x===x0+w-1||y===y0||y===y0+h-1)setclip(g,x,y,K);
  }
  // one clean windscreen glint: a short 2-step staircase, light source top-left
  function glint(g,x0,y0,g1,g2){
    setclip(g,x0,y0,g1);setclip(g,x0+1,y0,g1);setclip(g,x0+1,y0+1,g2);setclip(g,x0+2,y0+1,g2);
  }
  // filled ellipse (radii rx,ry around cx,cy) for a hose reel / beacon
  function discFill(g,cx,cy,rx,ry,ch){
    var x,y;
    for(y=-ry;y<=ry;y++)for(x=-rx;x<=rx;x++)if((x*x)/(rx*rx)+(y*y)/(ry*ry)<=1)setclip(g,cx+x,cy+y,ch);
  }
  // equipment locker doors along a horizontal span [x0,x1] at [y0,y1]: n cells,
  // K divider seams (plus outer edges), a small H handle tick per door
  function lockers(g,x0,x1,y0,y1,n,K,H){
    var w=(x1-x0)/n,i,dx;
    rect(g,x0,y0,x0,y1,K);rect(g,x1,y0,x1,y1,K);
    for(i=1;i<n;i++){dx=Math.round(x0+i*w);rect(g,dx,y0,dx,y1,K);}
    for(i=0;i<n;i++){dx=Math.round(x0+i*w+w/2);setclip(g,dx,y1-2,H);}
  }
  // locker doors along a vertical span [y0,y1] at [x0,x1]: transpose of lockers()
  function lockersV(g,y0,y1,x0,x1,n,K,H){
    var h=(y1-y0)/n,i,dy;
    rect(g,x0,y0,x1,y0,K);rect(g,x0,y1,x1,y1,K);
    for(i=1;i<n;i++){dy=Math.round(y0+i*h);rect(g,x0,dy,x1,dy,K);}
    for(i=0;i<n;i++){dy=Math.round(y0+i*h+h/2);setclip(g,x1-2,dy,H);}
  }

  // shared shell across both liveries (rule 23: one dark shared across ramps)
  var K=MAT.basalt.K, T=MAT.iron.D, H=MAT.iron.H, G=MAT.glass.D, GG=MAT.glass.L,
      EY=MAT.iron.W, RR=MAT.rust.D;
  // paint ramps: low-chroma custom ramps (tools/art/ramp.mjs --hue H --chroma
  // 0.032|0.035 --l 0.17,0.72), dirtier than any stock MAT hue at this size —
  // mid (top-lit plane) + dark (rocker/shade), never the light step
  var slate={K:'#0c1014',D:'#26313a',M:'#465760',L:'#6d7e85',H:'#9da7a9'};   // hue 232
  var brick2={K:'#140d10',D:'#3b2b2d',M:'#634e4e',L:'#897673',H:'#aca29f'}; // hue 18
  // top plane uses the D step (not M — keeps the whole car dark enough to
  // clear rule 24's contrast band against both grounds without going bright)
  // and the rocker shade drops to the ramp's own K step, one notch above the
  // shared outline so the hue still reads in shadow
  var A_M=slate.D, A_D=slate.K;    // [0] saloon: dull slate-blue
  var B_M=brick2.D, B_D=brick2.K;  // [1] estate: dull brick-maroon

  var sedanPal={K:K,T:T,H:H,G:G,g:GG,E:EY,R:RR,A:A_M,a:A_D,B:B_M,b:B_D};

  // service-vehicle paint: low-chroma custom ramps (ramp.mjs --hue 22 --chroma
  // 0.11 --l 0.16,0.66 / --hue 80 --chroma 0.085 --l 0.2,0.72), muted per Day 9
  // and deliberately not the gameplay reds/oranges (damage floor, incendiary
  // fuel). F/f = fire-engine red lit/rocker, Z/z = bulldozer yellow-ochre
  // lit/rocker, r = dim unlit light-bar/beacon lens (MAT.iron.R; the lighting
  // pass adds the actual glow), M2 = flat steel (MAT.iron.M, for the blade).
  var F='#7b2c2e', f='#4e0e1e', Z='#715215', z='#4d2d00', r=MAT.iron.R, M2=MAT.iron.M, amb='#a55300';
  var truckPal={K:K,T:T,H:H,G:G,g:GG,E:EY,R:RR,F:F,f:f,r:r,a:amb};
  var dozerPal={K:K,T:T,H:H,G:G,g:GG,Z:Z,z:z,r:r,M:M2};

  // =====================================================================
  // sedan_h 96x58 [96x48]: matches wrecks/car_h exactly. Front lens block
  // near x=0 (headlight), rear lens block near x=95 (taillight) — this
  // front/back split only ever mirrors under render.js's x-flip, which is
  // exactly the case where the car is facing the other way, so it stays
  // correct after flip. No detail differs between the top and bottom long
  // edges (never mirrored for the horizontal sprite).
  // =====================================================================
  var W=96,H_=58,C=4;
  function makeSedanH(v){
    var g=mkGrid(W,H_);
    var P=v?'B':'A', p=v?'b':'a';
    rect(g,0,0,W-1,40,P);
    rect(g,0,41,W-1,H_-1,p);
    rect(g,0,H_-3,W-1,H_-1,'T');
    // greenhouse: windscreen, B-pillar, rear window — unbroken glass, clean streak
    rect(g,15,8,80,24,'G');
    rect(g,46,8,47,24,P);
    glint(g,18,10,'g','g');
    glint(g,60,10,'g','g');
    setclip(g,20,20,'g');setclip(g,63,20,'g');
    // closed-door seams (two doors per side), 2px ticks so they read as a
    // seam end rather than a stray orphan texel
    setclip(g,34,26,p);setclip(g,34,27,p);setclip(g,34,38,p);setclip(g,34,39,p);
    setclip(g,64,26,p);setclip(g,64,27,p);setclip(g,64,38,p);setclip(g,64,39,p);
    setclip(g,30,31,'H');setclip(g,31,31,'H');setclip(g,60,31,'H');setclip(g,61,31,'H'); // door handles
    // bumper trim
    setclip(g,1,42,'H');setclip(g,2,42,'H');setclip(g,W-3,42,'H');setclip(g,W-2,42,'H');
    // headlight (front, x low) / taillight (rear, x high) — glassy lens, not dead
    lens(g,3,32,4,6,'K','E');
    lens(g,W-7,32,4,6,'K','R');
    // two round, un-flattened wheels
    wheel(g,14,47,14,11,'T','K','H');
    wheel(g,68,47,14,11,'T','K','H');
    cutCorners(g,0,0,W-1,H_-1,C);
    outlineFromFill(g,'K');
    return toRows(g);
  }

  // =====================================================================
  // sedan_v 48x106 [48x96]: matches wrecks/car_v exactly. Front near y=0,
  // rear near y=105 — mirrors under flipY only, i.e. when heading swaps
  // north/south, same reasoning as sedan_h.
  // =====================================================================
  function makeSedanV(v){
    var W_=48,H2=106,c=C;
    var g=mkGrid(W_,H2);
    var P=v?'B':'A', p=v?'b':'a';
    rect(g,0,0,W_-1,14,P);
    rect(g,0,15,W_-1,H2-1,p);
    rect(g,0,15,W_-1,84,P);
    rect(g,0,H2-3,W_-1,H2-1,'T');
    rect(g,8,15,39,28,'G');
    rect(g,8,71,39,84,'G');
    glint(g,10,17,'g','g');
    glint(g,10,73,'g','g');
    setclip(g,20,20,'g');setclip(g,20,76,'g');
    setclip(g,10,42,p);setclip(g,11,42,p);setclip(g,23,42,p);setclip(g,24,42,p);
    setclip(g,10,58,p);setclip(g,11,58,p);setclip(g,23,58,p);setclip(g,24,58,p);
    setclip(g,15,48,'H');setclip(g,15,49,'H');setclip(g,15,54,'H');setclip(g,15,55,'H');
    setclip(g,2,17,'H');setclip(g,3,17,'H');setclip(g,W_-4,17,'H');setclip(g,W_-3,17,'H');
    lens(g,18,3,6,4,'K','E');
    lens(g,18,H2-7,6,4,'K','R');
    wheel(g,3,92,14,13,'T','K','H');
    wheel(g,31,92,14,13,'T','K','H');
    cutCorners(g,0,0,W_-1,H2-1,c);
    outlineFromFill(g,'K');
    return toRows(g);
  }

  // =====================================================================
  // fireTruck_h 150x72 [150x60]: CARS.md service vehicle already referenced
  // by world.js (vehicleSlots vehicleType 'fireTruck'). Cab at low x (front,
  // same convention as sedan_h's headlight), long equipment body toward high
  // x: roof ladder rails, a rear hose-reel disc, two locker-door rows with
  // seam+handle ticks, a light-bar over the cab (dim lens letters — the
  // lighting pass adds the glow). variant 0 intact, 1 damaged (dented panel,
  // cracked glass, one dead light-bar cell), 2 wrecked (paint swapped to
  // burnt iron tones, no lit lenses at all).
  // =====================================================================
  var FT_W=150,FT_H=72,FT_C=6;
  function makeFireTruckH(variant){
    var g=mkGrid(FT_W,FT_H),burnt=variant===2,dmg=variant===1;
    var P=burnt?'T':'F', p=burnt?'K':'f';
    // equipment body (rear): tall, full length, holds the roof ladder
    rect(g,34,0,FT_W-1,52,P);
    rect(g,34,53,FT_W-1,FT_H-1,p);
    // cab (front, low x): short — about a third the old footprint — and its
    // roofline sits lower and darker than the equipment body: a real step
    // in the silhouette (the cab has no ladder-rack overhang), not just a
    // colour change
    rect(g,0,20,33,52,P);
    rect(g,0,16,33,19,p);
    rect(g,0,53,33,FT_H-1,p);
    rect(g,0,FT_H-3,FT_W-1,FT_H-1,'T');
    // windscreen — about a third the area it used to be
    rect(g,8,24,24,31,'G');
    glint(g,10,25,'g','g');
    // pale chrome front bumper + grille line (inset 1px so it survives the
    // auto outline instead of being swallowed by it)
    rect(g,1,47,2,52,'H');
    rect(g,3,44,10,45,'H');
    setclip(g,4,44,'K');setclip(g,6,44,'K');setclip(g,8,44,'K');
    // light-bar across the cab roof: two dim red lenses + one small amber
    rect(g,6,16,28,18,'K');
    if(!burnt){
      rect(g,8,17,12,17,dmg?'T':'r');
      rect(g,15,17,19,17,'r');
      setclip(g,23,17,'a');setclip(g,24,17,'a');
    }
    // roof ladder: two pale rails, rungs, a 1-texel shadow cast on the body
    rect(g,38,3,148,3,'H');rect(g,38,11,148,11,'H');
    for(var rx=41;rx<148;rx+=8)rect(g,rx,4,rx,10,'T');
    rect(g,38,12,148,12,'K');
    // hose reel on the rear lower deck, clear of the ladder and lockers
    discFill(g,128,61,9,8,'T');discFill(g,128,61,4,4,'K');
    setclip(g,128,55,'H');setclip(g,128,67,'H');
    // equipment lockers: distinct vertical panels, 1-texel dark seams
    lockers(g,36,148,20,35,6,'K','H');
    lockers(g,36,148,37,51,6,'K','H');
    // head lens (front, low x) / tail lens (rear, high x)
    lens(g,2,36,4,6,'K',burnt?'K':'E');
    lens(g,FT_W-7,40,4,6,'K',burnt?'K':'R');
    if(dmg){
      rect(g,1,49,4,52,'K'); // crumpled bumper corner
      rect(g,74,22,90,34,'T'); // one scorched/dark locker
    }
    wheel(g,12,FT_H-13,16,12,'T','K','H');
    wheel(g,110,FT_H-13,16,12,'T','K','H');
    cutCorners(g,0,0,FT_W-1,FT_H-1,FT_C);
    outlineFromFill(g,'K');
    return toRows(g);
  }

  // =====================================================================
  // fireTruck_v 60x166 [60x150]: transpose of fireTruck_h (front at low y,
  // ladder rails and locker doors run along the length, wheel pair sits
  // across the width at one axle, matching sedan_v's own left/right layout).
  // =====================================================================
  function makeFireTruckV(variant){
    var W_=60,H2=166,g=mkGrid(W_,H2),burnt=variant===2,dmg=variant===1;
    var P=burnt?'T':'F', p=burnt?'K':'f';
    // equipment body (rear): full width, holds the roof ladder on the
    // overhang edge
    rect(g,0,34,W_-1,H2-53,P);
    rect(g,0,H2-52,W_-1,H2-1,p);
    // cab (front, low y): short, and narrower — misses the ladder/overhang
    // edge, a real step in the silhouette; roof band darker at the very front
    rect(g,12,0,W_-1,33,P);
    rect(g,12,0,W_-1,4,p);
    rect(g,0,H2-3,W_-1,H2-1,'T');
    // windscreen — about a third the area it used to be
    rect(g,20,9,36,16,'G');
    glint(g,22,10,'g','g');
    // pale chrome front bumper + grille line (inset 1px so it survives the
    // auto outline instead of being swallowed by it)
    rect(g,24,1,35,1,'H');
    rect(g,18,4,20,10,'H');
    setclip(g,18,6,'K');setclip(g,19,6,'K');setclip(g,20,6,'K');
    setclip(g,18,9,'K');setclip(g,19,9,'K');setclip(g,20,9,'K');
    // light-bar across the cab roof: two dim red lenses + one small amber
    rect(g,16,2,38,4,'K');
    if(!burnt){
      rect(g,18,3,22,3,dmg?'T':'r');
      rect(g,25,3,29,3,'r');
      setclip(g,33,3,'a');setclip(g,34,3,'a');
    }
    // roof ladder: two pale rails, rungs, a 1-texel shadow cast on the body
    rect(g,3,38,3,148,'H');rect(g,11,38,11,148,'H');
    for(var ry=41;ry<148;ry+=8)rect(g,4,ry,10,ry,'T');
    rect(g,12,38,12,148,'K');
    // hose reel below the lockers, clear of the ladder
    discFill(g,30,155,10,7,'T');discFill(g,30,155,4,3,'K');
    setclip(g,24,155,'H');setclip(g,36,155,'H');
    // equipment lockers: distinct panels, 1-texel dark seams
    lockersV(g,38,150,15,29,6,'K','H');
    lockersV(g,38,150,31,45,6,'K','H');
    // head lens (front, low y) / tail lens (rear, high y)
    lens(g,26,3,7,4,'K',burnt?'K':'E');
    lens(g,26,H2-9,7,4,'K',burnt?'K':'R');
    if(dmg){
      rect(g,32,1,35,4,'K'); // crumpled bumper corner
      rect(g,17,102,29,118,'T'); // one scorched/dark locker
    }
    wheel(g,3,90,17,15,'T','K','H');
    wheel(g,W_-20,90,17,15,'T','K','H');
    cutCorners(g,0,0,W_-1,H2-1,FT_C);
    outlineFromFill(g,'K');
    return toRows(g);
  }

  // =====================================================================
  // bulldozer_h 110x92 [110x80]: blade at the front (low x, same convention
  // as the sedan/fire-truck front). Tracks run the hull's length on both
  // sides (top and bottom bands here); cab glass sits on the hull between
  // them. variant 0 working, 1 broken/stalled (dark stalled-engine patch,
  // cracked glass, no beacon).
  // =====================================================================
  var DZ_W=110,DZ_H=92,DZ_C=8;
  function makeBulldozerH(variant){
    var g=mkGrid(DZ_W,DZ_H),broken=variant===1,by,t,d,fx;
    var P=broken?'T':'Z', p=broken?'K':'z';
    // tracks: top and bottom bands the length of the hull, tread ticks
    rect(g,26,8,DZ_W-1,22,'T');rect(g,26,DZ_H-23,DZ_W-1,DZ_H-9,'T');
    for(var i=30;i<DZ_W-4;i+=8){rect(g,i,10,i+3,20,'K');rect(g,i,DZ_H-21,i+3,DZ_H-11,'K');}
    // hull
    rect(g,26,24,DZ_W-1,DZ_H-25,P);
    rect(g,26,DZ_H-9,DZ_W-1,DZ_H-1,p);
    // ROPS cab frame around the glass, so the hull isn't a flat slab
    rect(g,58,28,90,58,'H');
    rect(g,62,32,86,54,'G');
    glint(g,64,34,'g','g');
    setclip(g,58,28,'K');setclip(g,90,28,'K');setclip(g,58,58,'K');setclip(g,90,58,'K');
    // exhaust stack on the hull, forward of the cab
    rect(g,42,26,45,42,'T');
    rect(g,41,23,46,26,'H');
    setclip(g,41,23,'K');setclip(g,46,23,'K');
    // blade at the front (low x): dark steel, slightly curved, spanning
    // wider than the tracks; the arms bridge it to the hull
    var bY0=2,bY1=DZ_H-3,bX1=24;
    for(by=bY0;by<=bY1;by++){
      t=(by-bY0)/(bY1-bY0);d=Math.abs(t-0.5)*2;fx=Math.round(3+d*d*7);
      rect(g,fx,by,bX1,by,'T');
    }
    rect(g,bX1-4,bY0+6,bX1,bY1-6,'M');
    // arms connecting blade to hull
    rect(g,22,28,28,32,'T');rect(g,22,DZ_H-34,28,DZ_H-30,'T');
    if(!broken){setclip(g,88,25,'r');setclip(g,89,25,'r');}
    if(broken){rect(g,70,40,80,48,'K');setclip(g,40,26,'K');setclip(g,41,27,'K');}
    cutCorners(g,26,8,DZ_W-1,DZ_H-9,4);
    outlineFromFill(g,'K');
    // worn bright cutting edge, a single line — painted after the auto
    // outline so it isn't swallowed by it along the blade's own silhouette
    for(by=bY0;by<=bY1;by++){
      t=(by-bY0)/(bY1-bY0);d=Math.abs(t-0.5)*2;fx=Math.round(3+d*d*7);
      setclip(g,fx,by,'H');
    }
    return toRows(g);
  }

  // =====================================================================
  // bulldozer_v 80x122 [80x110]: transpose of bulldozer_h — blade at the
  // front (low y), tracks flank the hull left/right.
  // =====================================================================
  function makeBulldozerV(variant){
    var W4=80,H4=122,g=mkGrid(W4,H4),broken=variant===1,bx,t,d,fy;
    var P=broken?'T':'Z', p=broken?'K':'z';
    rect(g,8,26,22,H4-1,'T');rect(g,W4-23,26,W4-9,H4-1,'T');
    for(var i=30;i<H4-4;i+=8){rect(g,10,i,20,i+3,'K');rect(g,W4-21,i,W4-11,i+3,'K');}
    rect(g,23,26,W4-24,H4-1,P);
    rect(g,23,H4-9,W4-24,H4-1,p);
    // ROPS cab frame around the glass, so the hull isn't a flat slab
    rect(g,30,56,58,84,'H');
    rect(g,32,58,56,82,'G');
    glint(g,34,60,'g','g');
    setclip(g,30,56,'K');setclip(g,58,56,'K');setclip(g,30,84,'K');setclip(g,58,84,'K');
    // exhaust stack on the hull, forward of the cab
    rect(g,36,30,39,44,'T');
    rect(g,34,27,41,30,'H');
    setclip(g,34,27,'K');setclip(g,41,27,'K');
    // blade at the front (low y): dark steel, slightly curved, spanning
    // wider than the tracks; the arms bridge it to the hull
    var bX0=2,bX1=W4-3,bY1=24;
    for(bx=bX0;bx<=bX1;bx++){
      t=(bx-bX0)/(bX1-bX0);d=Math.abs(t-0.5)*2;fy=Math.round(3+d*d*7);
      rect(g,bx,fy,bx,bY1,'T');
    }
    rect(g,bX0+6,bY1-4,bX1-6,bY1,'M');
    // arms connecting blade to hull
    rect(g,28,22,32,28,'T');rect(g,W4-34,22,W4-30,28,'T');
    if(!broken){setclip(g,24,88,'r');setclip(g,25,88,'r');}
    if(broken){rect(g,40,70,48,80,'K');setclip(g,26,40,'K');setclip(g,27,41,'K');}
    cutCorners(g,23,26,W4-24,H4-1,4);
    outlineFromFill(g,'K');
    // worn bright cutting edge, a single line — painted after the auto
    // outline so it isn't swallowed by it along the blade's own silhouette
    for(bx=bX0;bx<=bX1;bx++){
      t=(bx-bX0)/(bX1-bX0);d=Math.abs(t-0.5)*2;fy=Math.round(3+d*d*7);
      setclip(g,bx,fy,'H');
    }
    return toRows(g);
  }

  A.define('vehicles',{
    sedan_h:{variants:[makeSedanH(0),makeSedanH(1)],pal:sedanPal,anchor:'feet',
      note:'96x58 [96x48], matches wrecks/car_h: [0] slate-blue saloon, [1] brick-maroon estate; unbroken glass, closed doors, round wheels, glassy head/tail lenses'},
    sedan_v:{variants:[makeSedanV(0),makeSedanV(1)],pal:sedanPal,anchor:'feet',
      note:'48x106 [48x96], matches wrecks/car_v: same two liveries, vertical'},
    fireTruck_h:{variants:[makeFireTruckH(0),makeFireTruckH(1),makeFireTruckH(2)],pal:truckPal,anchor:'feet',
      note:'150x72 [150x60]: [0] intact, [1] damaged (dent, cracked glass, one dead light-bar cell), [2] wrecked (burnt iron, no lights); cab, ladder rails, hose reel, locker doors'},
    fireTruck_v:{variants:[makeFireTruckV(0),makeFireTruckV(1),makeFireTruckV(2)],pal:truckPal,anchor:'feet',
      note:'60x166 [60x150]: vertical transpose of fireTruck_h, same three states'},
    bulldozer_h:{variants:[makeBulldozerH(0),makeBulldozerH(1)],pal:dozerPal,anchor:'feet',
      note:'110x92 [110x80]: [0] working (lit beacon), [1] broken/stalled (dark engine patch, cracked glass, no beacon); tracks both sides, blade at the front (low x)'},
    bulldozer_v:{variants:[makeBulldozerV(0),makeBulldozerV(1)],pal:dozerPal,anchor:'feet',
      note:'80x122 [80x110]: vertical transpose of bulldozer_h, blade at the front (low y)'}
  });
})();
