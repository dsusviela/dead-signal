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
  // sedan paint (see the sedan block): top lit plane / shoulder crease + arch
  // lips / side face / rocker, M L D K steps of each ramp. Door faces stay in
  // shade (D), the hood and roof take the light (M), same banding as the
  // wreck cruiser's iron body so the two read as one family.
  var maroon={K:'#180a12',D:'#391a28',M:'#59303a',L:'#734d4f'};   // ramp.mjs --hue 5 --chroma 0.06 --l 0.17,0.56
  var slateB={K:'#11161f',D:'#213243',M:'#365163',L:'#55707e'};   // ramp.mjs --hue 240 --chroma 0.045 --l 0.2,0.64
  var sedanPal={K:MAT.iron.K,D:MAT.iron.D,M:MAT.iron.M,L:MAT.iron.L,H:MAT.iron.H,G:MAT.glass.M,g:MAT.glass.L,
    R:MAT.rust.M,r:MAT.rust.L,E:MAT.iron.W,
    A:maroon.M,B:maroon.L,a:maroon.D,b:maroon.K, C:slateB.M,F:slateB.L,c:slateB.D,f:slateB.K};

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
  // sedan 96x58 [96x48] / 48x106 [48x96]: the driveable saloon, built with
  // the same parametric body as wrecks/car_h|v (makeCarH/V there): oblique
  // 3/4 view from the south, NOSE-FIRST at low x (_h) / low y (_v); the
  // renderer mirrors it for the other heading. Same greenhouse hull, pillars,
  // arches, bumpers and lamp positions as the police cruiser, so a driven
  // car that breaks down and swaps to the wreck never jumps. What reads
  // "intact": clean unbroken glass with one sheen, two round tyres with lit
  // hubs, shut doors with seams and handles, pale warm headlamp lenses at
  // the true front, red tail lenses at the back, chrome bumper and window
  // trim. No lightbar, no damage; the roof is one quiet panel so seated
  // survivors (game.js SEATS) read on top of it.
  //   [0] dark maroon      (ramp.mjs --hue 5 --chroma 0.06 --l 0.17,0.56)
  //   [1] faded slate blue (ramp.mjs --hue 240 --chroma 0.045 --l 0.2,0.64)
  // letters: paint top/hi/side/low = A B a b ([0]) | C F c f ([1]);
  // shared iron K D M L H, glass G g, rust R r (tail lenses), E warm lamp.
  // =====================================================================
  var SED_W=96,SED_H=58,SED_VW=48,SED_VH=106;
  function hline(g,x0,x1,y,ch){for(var x=x0;x<=x1;x++)setclip(g,x,y,ch);}
  function vline(g,x,y0,y1,ch){for(var y=y0;y<=y1;y++)setclip(g,x,y,ch);}
  function line(g,x0,y0,x1,y1,ch){
    var dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,e=dx+dy,e2;
    for(;;){setclip(g,x0,y0,ch);if(x0===x1&&y0===y1)break;e2=2*e;if(e2>=dy){e+=dy;x0+=sx;}if(e2<=dx){e+=dx;y0+=sy;}}
  }
  function roundIn(g,x0,y0,x1,y1,ch){[[x0,y0,1,1],[x1,y0,-1,1],[x0,y1,1,-1],[x1,y1,-1,-1]].forEach(function(c){setclip(g,c[0],c[1],ch);setclip(g,c[0]+c[2],c[1],ch);setclip(g,c[0],c[1]+c[3],ch);});}
  // side-on tyre in an arch: K ring, D rubber, steel hub with a lit top
  function tyreSide(g,cx,y0,w,h){
    var x0=cx-(w>>1),x1=x0+w-1,y1=y0+h-1,x,y;
    rect(g,x0,y0,x1,y1,'D');cutCorners(g,x0,y0,x1,y1,4);
    for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++){if(g[y][x]==='.')continue;
      if(x===x0||x===x1||y===y0||y===y1||g[y][x-1]==='.'||g[y][x+1]==='.'||g[y-1]&&g[y-1][x]==='.'||g[y+1]&&g[y+1][x]==='.')g[y][x]='K';}
    cutCorners(g,x0,y0,x1,y1,4);
    var hy=y0+Math.floor(h/2)-1;
    rect(g,cx-2,hy-2,cx+2,hy+2,'L');setclip(g,cx-2,hy-2,'D');setclip(g,cx+2,hy-2,'D');setclip(g,cx-2,hy+2,'D');setclip(g,cx+2,hy+2,'D');
    rect(g,cx-1,hy-1,cx+1,hy+1,'K');setclip(g,cx,hy-2,'H');setclip(g,cx-1,hy-2,'H');
  }
  // back-on tyre peeking under a bumper / out of a flank
  function tyreEnd(g,x0,y0,x1,y1){rect(g,x0,y0,x1,y1,'K');rect(g,x0+1,y0,x1-1,y1-1,'D');for(var y=y0+1;y<y1;y+=2)hline(g,x0+2,x1-2,y,'K');}
  function paint(v){return v?{top:'C',hi:'F',side:'c',low:'f'}:{top:'A',hi:'B',side:'a',low:'b'};}

  function makeSedanH(v){
    var g=mkGrid(SED_W,SED_H),C=paint(v),x,y,t,a,b;
    var rx0=42,rx1=66,ry0=10,ry1=22,bx0=28,bx1=80,by0=17,by1=31;
    rect(g,7,50,88,53,'K');
    rect(g,3,15,92,35,C.top);cutCorners(g,3,15,92,35,4);
    rect(g,2,36,93,51,C.side);
    hline(g,3,92,36,C.hi);
    rect(g,2,48,93,51,C.low);
    // bumpers wrap the ends
    rect(g,0,35,3,47,C.side);rect(g,92,35,95,47,C.side);
    hline(g,0,3,35,C.hi);hline(g,92,95,35,C.hi);
    // greenhouse: windshield quad, rear window quad, side glass, roof
    for(x=bx0;x<=rx0;x++){t=(rx0-x)/(rx0-bx0);a=Math.round(ry0+(by0-ry0)*t);b=Math.round(ry1+(by1-ry1)*t);vline(g,x,a,b,'G');}
    for(x=rx1;x<=bx1;x++){t=(x-rx1)/(bx1-rx1);a=Math.round(ry0+(by0-ry0)*t);b=Math.round(ry1+(by1-ry1)*t);vline(g,x,a,b,'G');}
    for(y=ry1;y<=by1;y++){t=(y-ry1)/(by1-ry1);hline(g,Math.round(rx0-(rx0-bx0)*t),Math.round(rx1+(bx1-rx1)*t),y,'G');}
    rect(g,rx0,ry0,rx1,ry1,C.top);roundIn(g,rx0,ry0,rx1,ry1,'G');
    hline(g,rx0+2,rx1-2,ry0+1,C.hi);                                                    // lit front edge of the roof
    hline(g,rx0+1,rx1-1,ry1,C.side);vline(g,rx1,ry0+2,ry1,C.side);
    line(g,rx0,ry1,bx0,by1,C.side);line(g,rx1,ry1,bx1,by1,C.side);                      // A / C pillars
    line(g,rx0,ry0,bx0,by0,'K');line(g,rx1,ry0,bx1,by0,'K');
    t=54;vline(g,t,ry1,by1,C.side);vline(g,t+1,ry1+1,by1,C.side);                      // B-pillar
    hline(g,bx0,bx1,by1,'K');                                                          // beltline
    hline(g,bx0+1,bx1-1,by1+1,'H');                                                    // chrome window trim
    line(g,rx0-3,ry0+4,rx0-7,ry0+9,'g');line(g,rx0-2,ry0+5,rx0-6,ry0+10,'g');            // windshield sheen
    hline(g,rx0+3,rx0+6,ry1+2,'g');hline(g,t+4,t+7,ry1+2,'g');
    // wheel arches and round tyres
    var fx=21,rxw=74;
    [fx,rxw].forEach(function(cx){rect(g,cx-10,41,cx+10,51,'K');setclip(g,cx-10,41,C.side);setclip(g,cx-9,41,C.side);setclip(g,cx-10,42,C.side);setclip(g,cx+10,41,C.side);setclip(g,cx+9,41,C.side);setclip(g,cx+10,42,C.side);
      hline(g,cx-8,cx+8,40,C.hi);});                                                   // arch lip catches the light
    tyreSide(g,fx,43,17,15);tyreSide(g,rxw,43,17,15);
    // door seams, handles
    vline(g,31,33,47,'K');vline(g,t,33,47,'K');vline(g,bx1-3,33,47,'K');
    hline(g,t-6,t-5,39,'H');hline(g,bx1-9,bx1-8,39,'H');
    hline(g,33,t-2,43,C.low);hline(g,t+2,bx1-5,43,C.low);                              // door crease under the handles
    // front: bumper chrome + headlamp at the true nose; deck-top lamp lenses
    vline(g,1,41,46,'H');rect(g,1,36,2,39,'E');setclip(g,2,39,'H');
    rect(g,4,17,6,19,'E');setclip(g,6,19,'H');rect(g,4,31,6,33,'E');setclip(g,6,33,'H');
    // rear: bumper chrome + tail lenses
    vline(g,94,42,46,'H');rect(g,93,36,94,40,'R');hline(g,93,94,36,'r');
    rect(g,89,17,91,19,'R');setclip(g,89,17,'r');rect(g,89,31,91,33,'R');setclip(g,89,31,'r');
    // hood / trunk panel lines
    hline(g,7,bx0-4,16,C.hi);vline(g,bx0-2,18,31,'K');vline(g,bx1+3,18,31,'K');
    hline(g,8,bx0-5,24,C.side);                                                        // hood centre crease
    cutCorners(g,0,0,SED_W-1,SED_H-1,1);
    outlineFromFill(g,'K');
    return toRows(g);
  }
  function makeSedanV(v){
    var g=mkGrid(SED_VW,SED_VH),C=paint(v),y,t,W1=SED_VW-1;
    [[12,28],[64,80]].forEach(function(r){tyreEnd(g,0,r[0],4,r[1]);tyreEnd(g,W1-4,r[0],W1,r[1]);});
    rect(g,3,2,W1-3,86,C.top);cutCorners(g,3,2,W1-3,86,6);
    rect(g,3,80,W1-3,86,C.top);
    // rear face (south end): trunk lip, tail lenses, plate, bumper
    rect(g,2,87,W1-2,99,C.side);hline(g,3,W1-3,87,C.hi);
    rect(g,1,95,W1-1,99,C.side);hline(g,1,W1-1,95,'H');rect(g,2,99,W1-2,100,C.low);
    rect(g,4,89,10,92,'R');rect(g,W1-10,89,W1-4,92,'R');
    hline(g,5,9,89,'r');hline(g,W1-9,W1-5,89,'r');
    rect(g,19,90,28,93,'L');hline(g,19,28,93,'K');hline(g,20,27,91,'M');
    rect(g,8,101,W1-8,102,'K');
    tyreEnd(g,5,99,13,105);tyreEnd(g,W1-13,99,W1-5,105);
    // front: chrome bumper at the nose, headlamps, hood crease, cowl gap
    hline(g,8,W1-8,2,'H');
    rect(g,5,3,10,6,'E');rect(g,W1-10,3,W1-5,6,'E');hline(g,5,10,6,'H');hline(g,W1-10,W1-5,6,'H');
    vline(g,23,8,24,C.hi);hline(g,6,W1-6,26,'K');
    // greenhouse
    var ws0=28,rf0=34,rf1=57,rw1=68;
    for(y=ws0;y<rf0;y++){t=(y-ws0)/(rf0-ws0);hline(g,Math.round(7+3*t),Math.round(W1-7-3*t),y,'G');}
    for(y=rf1+1;y<=rw1;y++){t=(y-rf1)/(rw1-rf1);hline(g,Math.round(10-3*t),Math.round(W1-10+3*t),y,'G');}
    rect(g,6,rf0-1,9,rf1+4,'G');rect(g,W1-9,rf0-1,W1-6,rf1+4,'G');
    rect(g,10,rf0,W1-10,rf1,C.top);roundIn(g,10,rf0,W1-10,rf1,'G');
    hline(g,11,W1-11,rf1,C.side);vline(g,10,rf0+2,rf1,C.side);vline(g,W1-10,rf0+2,rf1,C.side);
    hline(g,7,W1-7,ws0,'K');hline(g,7,W1-7,rw1+1,'K');
    t=Math.round((rf0+rf1)/2)+2;hline(g,6,9,t,C.side);hline(g,W1-9,W1-6,t,C.side);      // B-pillars
    hline(g,9,13,ws0+2,'g');hline(g,12,15,rf1+3,'g');hline(g,13,16,rf1+4,'g');
    hline(g,6,W1-6,rw1+3,'K');                                                         // trunk lid gap
    // flank door seams + handles on the tumblehome
    setclip(g,3,t,'K');setclip(g,4,t,'K');setclip(g,W1-3,t,'K');setclip(g,W1-4,t,'K');
    setclip(g,4,t-4,'H');setclip(g,W1-4,t-4,'H');setclip(g,4,t+7,'H');setclip(g,W1-4,t+7,'H');
    outlineFromFill(g,'K');
    return toRows(g);
  }
  // sedan_vs 48x106: the same car heading SOUTH as the south-looking camera sees it. The top plane is mirrored nose-down
  // and the band that shows the rear face in sedan_v becomes the FRONT face: headlamps where the tail lenses were, a slatted
  // grille in place of the plate. render.js uses it instead of flipping sedan_v, which put the rear face on the north edge.
  function makeSedanVS(v){
    var rows=makeSedanV(v),W=rows[0].length,blank=new Array(W+1).join('.'),plane=rows.slice(2,87).reverse();
    var face=rows.slice(87).map(function(r,i){var y=87+i;return r.split('').map(function(ch,x){
      if(ch==='R')return 'E';if(ch==='r')return 'H';
      if(x>=19&&x<=28&&y>=90&&y<=93)return y%2?'K':'M';
      return ch;}).join('');});
    return [blank,blank].concat(plane,face);
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
    sedan_vs:{variants:[makeSedanVS(0),makeSedanVS(1)],pal:sedanPal,anchor:'feet',note:'48x106 [48x96], heading south: nose at the bottom with its front face (headlamps, grille, chrome) where sedan_v shows the rear'},
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
