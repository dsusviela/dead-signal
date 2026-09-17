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
  // fireTruck_h 150x72 [150x60] / fireTruck_v 60x166 [60x150] / fireTruck_vs:
  // the fire department's pumper, driveable (world.js vehicleSlots). Built
  // like the sedan: oblique 3/4 from the south for _h (lit roof plane over a
  // shaded side face, side-on tyres in arches), top-down with the rear face
  // on the south edge for _v, and a _vs whose south edge is the cab front.
  // NOSE-FIRST at low x / low y. Reads as a fire engine by its parts: a LOW
  // crew cab (roof a step below the equipment body) with a raked windscreen,
  // split side glass and two doors; a TALL equipment body with a pump panel
  // behind the cab, roll-up locker doors with chrome bars, hinged lockers
  // over a tandem rear axle; a reflective stripe the full length; the roof
  // ladder (rails, rungs, cast shadow) overhanging the cab; a hose bed at the
  // rear of the roof; a light-bar across the cab roof (dim lens letters, the
  // lighting pass adds the glow). Paint is a muted, low-chroma brick red
  // (ramp.mjs --hue 22 --chroma 0.08 --l 0.14,0.62: P lit roof L, Q lip H,
  // S side M, s rocker D) — deliberately not the gameplay reds/oranges.
  //   [0] intact  [1] damaged (dents, cracked glass, one dead light-bar cell,
  //   crumpled bumper)  [2] burnt wreck (paint remapped to iron/basalt, glass
  //   blown dark, no lit lenses, rust bloom)
  // letters: paint P Q S s; iron K D M L H; glass G g; E warm lamp; R tail
  // lens (rust); r dim red lens (iron.R); a dim amber; w v basalt D M (burnt).
  // =====================================================================
  var ftPal={K:K,D:MAT.iron.D,M:MAT.iron.M,L:MAT.iron.L,H:MAT.iron.H,G:MAT.glass.M,g:MAT.glass.L,E:EY,
    R:MAT.rust.M,r:MAT.iron.R,a:'#a55300',P:'#86544a',Q:'#9a8075',S:'#662f2f',s:'#3f131c',
    w:MAT.basalt.D,v:MAT.basalt.M};
  var FT_W=150,FT_H=72,FT_VW=60,FT_VH=166,FT_PL=132;
  var FT_BURN={P:'M',Q:'L',S:'D',s:'w',G:'K',g:'v',H:'L',L:'M',M:'D',E:'K',r:'K',a:'K',R:'K'};
  // burnt wreck: remap every texel through FT_BURN at once, then bloom rust
  // clusters and soot blotches at the given spots [x,y,w,h,letter]
  function ftBurn(g,spots){
    var y,x,c;
    for(y=0;y<g.length;y++)for(x=0;x<g[0].length;x++){c=g[y][x];if(FT_BURN[c])g[y][x]=FT_BURN[c];}
    spots.forEach(function(s){for(y=s[1];y<s[1]+s[3];y++)for(x=s[0];x<s[0]+s[2];x++){var cx=(x===s[0]||x===s[0]+s[2]-1),cy=(y===s[1]||y===s[1]+s[3]-1),nib=((x*7+y*3)%5===0)&&(cx||cy);if(g[y]&&g[y][x]&&g[y][x]!=='.'&&!(cx&&cy)&&!nib)setclip(g,x,y,s[4]);}});
  }
  // roll-up locker door: K frame, slats every 3 rows, chrome lift bar
  function rollUp(g,x0,y0,x1,y1){
    rect(g,x0,y0,x1,y1,'K');rect(g,x0+1,y0+1,x1-1,y1-1,'S');
    for(var y=y0+3;y<y1-3;y+=3)hline(g,x0+1,x1-1,y,'s');
    hline(g,x0+1,x1-1,y0+1,'Q');hline(g,x0+3,x1-3,y1-2,'H');
  }
  function arch(g,x0,x1,y0,y1,lip){
    rect(g,x0,y0,x1,y1,'K');
    setclip(g,x0,y0,'S');setclip(g,x0+1,y0,'S');setclip(g,x0,y0+1,'S');setclip(g,x1,y0,'S');setclip(g,x1-1,y0,'S');setclip(g,x1,y0+1,'S');
    hline(g,x0+2,x1-2,y0-1,lip);
  }

  function makeFireTruckH(v){
    var g=mkGrid(FT_W,FT_H),dmg=v===1,x,y,t,a,b,i;
    rect(g,6,61,143,65,'K');                                                            // ground contact
    // equipment body: tall — roof plane high, long side face
    rect(g,42,2,147,22,'P');cutCorners(g,42,2,147,22,2);
    hline(g,43,146,23,'Q');                                                             // lit roof lip
    rect(g,42,24,147,63,'S');hline(g,42,147,25,'s');
    rect(g,42,58,147,63,'s');
    vline(g,43,4,21,'Q');                                                               // lit front roof edge
    // crew cab: a step lower — its roof plane sits 7 rows below the body's
    rect(g,3,30,41,63,'S');rect(g,3,58,41,63,'s');
    rect(g,12,9,41,29,'P');hline(g,13,40,10,'Q');
    // raked windscreen quad from the roof front down to the cowl
    for(x=4;x<=12;x++){t=(12-x)/8;a=Math.round(9+6*t);b=Math.round(29+6*t);vline(g,x,a,b,'G');}
    line(g,12,9,4,15,'K');line(g,12,29,4,35,'S');vline(g,12,10,28,'S');                // header, A-pillar, roof front
    line(g,10,13,7,18,'g');line(g,11,14,8,19,'g');                                     // windscreen sheen
    // split side glass, B-pillar, beltline + chrome trim
    for(y=31;y<=41;y++){a=Math.max(6,Math.round(12-(y-29)*8/6)+2);hline(g,a,38,y,'G');}
    hline(g,4,41,30,'S');rect(g,24,31,25,41,'S');
    hline(g,14,17,33,'g');hline(g,28,31,33,'g');
    hline(g,3,41,42,'K');hline(g,4,40,43,'H');
    vline(g,41,30,57,'K');                                                              // cab / body gap
    // doors: seams, chrome handles
    vline(g,24,44,57,'K');vline(g,40,44,57,'K');hline(g,19,21,47,'H');hline(g,35,37,47,'H');
    // nose: grille slats, headlamp, amber marker, chrome bumper
    for(y=36;y<=40;y+=2)hline(g,1,3,y,'H');
    rect(g,1,43,3,47,'E');setclip(g,3,47,'H');rect(g,4,49,5,50,'a');
    rect(g,0,51,3,59,'L');vline(g,1,52,58,'H');hline(g,0,3,51,'H');
    // light-bar across the cab roof: five dim cells, amber in the middle
    rect(g,15,10,18,27,'K');vline(g,19,11,28,'S');
    [[11,12,'r'],[14,15,'r'],[17,20,'a'],[22,23,'r'],[25,26,'r']].forEach(function(c,k){rect(g,16,c[0],17,c[1],dmg&&k===1?'K':c[2]);});
    // pump panel right behind the cab: gauges, valve levers, discharge caps
    rect(g,44,27,58,53,'K');rect(g,45,28,57,52,'M');hline(g,45,57,28,'L');
    [[47,31],[53,31]].forEach(function(p){rect(g,p[0],p[1],p[0]+3,p[1]+3,'L');rect(g,p[0]+1,p[1]+1,p[0]+2,p[1]+2,'K');setclip(g,p[0],p[1],'H');});
    for(i=0;i<3;i++){hline(g,46+i*4,48+i*4,38,'H');vline(g,47+i*4,39,41,'D');}
    [[47,45],[53,45]].forEach(function(p){rect(g,p[0],p[1],p[0]+3,p[1]+3,'H');rect(g,p[0]+1,p[1]+1,p[0]+2,p[1]+2,'D');});
    // roll-up locker doors mid-body; hinged lockers over the rear axle; rear locker
    rollUp(g,60,27,79,53);rollUp(g,81,27,100,53);
    [[102,120],[122,140]].forEach(function(d){rect(g,d[0],27,d[1],46,'K');rect(g,d[0]+1,28,d[1]-1,45,'S');hline(g,d[0]+1,d[1]-1,28,'Q');vline(g,d[1]-3,35,37,'H');});
    rect(g,142,27,146,53,'K');rect(g,143,28,145,52,'S');
    // reflective stripe the full length, broken by the arches
    hline(g,3,147,55,'H');hline(g,3,147,56,'L');
    // tail lens + amber, rear step
    lens(g,144,28,4,9,'K','R');setclip(g,145,29,'Q');lens(g,144,37,4,4,'K','a');
    hline(g,143,149,58,'H');hline(g,143,149,59,'D');
    // arches: single front axle under the cab, tandem (dual) at the rear
    arch(g,11,33,50,63,'Q');arch(g,101,141,50,63,'Q');
    tyreSide(g,22,54,19,18);tyreSide(g,112,54,19,18);tyreSide(g,131,54,19,18);
    // roof ladder: rails with a cast shadow line, dark bed, rungs; overhangs the cab
    rect(g,44,6,118,17,'S');
    for(x=33;x<=117;x+=5)vline(g,x,6,17,'L');
    hline(g,30,118,4,'H');hline(g,30,118,18,'H');hline(g,31,118,5,'K');hline(g,31,118,19,'K');
    vline(g,30,4,18,'H');rect(g,46,20,47,21,'K');rect(g,114,20,115,21,'K');
    // hose bed at the rear of the roof: flaked hose laid lengthwise
    rect(g,122,4,145,20,'K');
    for(y=5;y<=19;y++)hline(g,124,143,y,['L','M','D'][(y-5)%3]);
    for(y=5;y<=17;y+=3){vline(g,y%2?123:144,y,y+1,'M');hline(g,126,132,y,'H');}
    rect(g,146,6,147,8,'r');setclip(g,146,6,'Q');
    if(dmg){
      line(g,6,19,10,25,'K');line(g,8,23,5,29,'K');line(g,29,32,34,40,'K');line(g,31,36,36,34,'K');   // cracked glass
      rect(g,85,37,92,41,'s');hline(g,86,91,36,'Q');setclip(g,88,39,'K');               // dented roll-up
      rect(g,27,49,33,52,'s');hline(g,28,32,48,'Q');                                    // dented rear door
      hline(g,64,73,55,'S');hline(g,66,71,56,'s');                                      // stripe scraped off
      rect(g,0,55,3,59,'K');setclip(g,1,54,'D');                                        // crumpled bumper
      rect(g,126,8,133,12,'K');                                                         // hose pulled from the bed
    }
    cutCorners(g,0,0,FT_W-1,FT_H-1,1);
    if(v===2)ftBurn(g,[[62,30,10,8,'R'],[86,44,12,5,'R'],[46,8,20,6,'K'],[124,34,12,7,'R'],[18,47,8,6,'R'],[90,10,14,5,'v'],[14,14,14,8,'K']]);
    outlineFromFill(g,'K');
    return toRows(g);
  }

  // the top plane of the _v/_vs truck, nose at row 0, FT_PL rows; south=true
  // leaves the windscreen quad off (the _vs front face carries the glass)
  function ftPlaneV(g,v,south){
    var W1=FT_VW-1,x,y,t,i,dmg=v===1;
    [[16,32],[92,108],[111,127]].forEach(function(r){tyreEnd(g,0,r[0],4,r[1]);tyreEnd(g,W1-4,r[0],W1,r[1]);});
    // crew cab
    rect(g,3,1,W1-3,40,'P');if(!south)cutCorners(g,3,1,W1-3,12,4);
    if(!south){rect(g,4,1,W1-4,4,'S');hline(g,7,W1-7,2,'H');                           // bumper
      rect(g,6,4,11,6,'E');rect(g,W1-11,4,W1-6,6,'E');hline(g,6,11,6,'H');hline(g,W1-11,W1-6,6,'H');}
    else hline(g,4,W1-4,1,'S');
    if(!south)hline(g,6,W1-6,8,'K');
    for(y=9;y<=16;y++){t=(y-9)/7;hline(g,Math.round(6+3*t),Math.round(W1-6-3*t),y,south?'P':'G');}
    if(!south){vline(g,29,9,16,'S');vline(g,30,9,16,'S');hline(g,10,14,10,'g');hline(g,13,16,11,'g');hline(g,34,37,10,'g');}
    hline(g,8,W1-8,17,'K');
    rect(g,4,17,7,33,'G');rect(g,W1-7,17,W1-4,33,'G');hline(g,4,7,25,'S');hline(g,W1-7,W1-4,25,'S');
    setclip(g,5,19,'g');setclip(g,5,20,'g');setclip(g,W1-6,27,'g');
    rect(g,8,18,W1-8,39,'P');hline(g,9,W1-9,south?38:19,'Q');vline(g,8,18,39,'S');vline(g,W1-8,18,39,'S');
    // light-bar
    rect(g,11,21,W1-11,25,'K');hline(g,12,W1-10,26,'S');
    [[12,17,'r'],[19,24,'r'],[26,33,'a'],[35,40,'r'],[42,47,'r']].forEach(function(c,k){rect(g,c[0],22,c[1],24,dmg&&k===1?'K':c[2]);});
    hline(g,3,W1-3,40,'K');
    // equipment body
    rect(g,3,41,W1-3,131,'P');hline(g,4,W1-4,41,'Q');
    rect(g,3,42,6,131,'S');rect(g,W1-6,42,W1-3,131,'S');
    for(y=42;y<=131;y+=18){hline(g,3,6,y,'K');hline(g,W1-6,W1-3,y,'K');setclip(g,5,y+9,'H');setclip(g,W1-5,y+9,'H');}
    vline(g,8,43,113,'s');vline(g,W1-8,43,113,'s');                                   // roof gutters
    rect(g,8,44,9,45,'r');rect(g,W1-9,44,W1-8,45,'r');setclip(g,8,44,'Q');setclip(g,W1-9,44,'Q');
    // roof ladder
    for(y=37;y<=110;y+=5){hline(g,16,44,y,'L');hline(g,17,44,y+1,'S');}
    vline(g,14,34,112,'H');vline(g,45,34,112,'H');vline(g,15,35,112,'K');vline(g,46,35,112,'K');
    hline(g,14,45,34,'H');rect(g,12,48,13,49,'K');rect(g,12,106,13,107,'K');rect(g,47,48,48,49,'K');rect(g,47,106,48,107,'K');
    // hose bed
    rect(g,11,116,48,131,'K');
    for(x=12;x<=47;x++)vline(g,x,117,130,x%2?'L':'M');
    vline(g,29,117,130,'K');vline(g,30,117,130,'K');
    for(x=13;x<=46;x+=6)setclip(g,x,117,'H');
    if(dmg){
      if(!south){line(g,12,10,18,15,'K');line(g,16,12,21,10,'K');}
      rect(g,3,64,6,70,'s');setclip(g,4,63,'Q');rect(g,W1-6,95,W1-3,99,'s');            // flank dents
      rect(g,20,120,27,125,'K');                                                        // hose pulled
      if(!south)rect(g,4,1,9,3,'K');                                                    // crumpled bumper corner
    }
  }

  function makeFireTruckV(v){
    var g=mkGrid(FT_VW,FT_VH),W1=FT_VW-1,y;
    ftPlaneV(g,v,false);
    // rear face (south end): roll-up door, rear ladder, tail lenses, stripe, step
    rect(g,8,156,W1-8,158,'K');
    rect(g,2,132,W1-2,151,'S');hline(g,3,W1-3,132,'Q');
    rect(g,17,134,42,146,'K');rect(g,18,135,41,145,'S');for(y=137;y<145;y+=3)hline(g,18,41,y,'s');hline(g,18,41,135,'Q');hline(g,22,37,144,'H');
    vline(g,11,134,146,'H');vline(g,14,134,146,'H');for(y=137;y<=145;y+=4)hline(g,12,13,y,'L');
    lens(g,3,134,7,8,'K','R');setclip(g,4,135,'Q');lens(g,3,142,7,4,'K','a');
    lens(g,W1-9,134,7,8,'K','R');setclip(g,W1-8,135,'Q');lens(g,W1-9,142,7,4,'K','a');
    rect(g,46,136,50,140,'H');rect(g,47,137,49,139,'D');                               // rear hose outlet
    hline(g,2,W1-2,148,'H');hline(g,2,W1-2,149,'L');
    rect(g,1,152,W1-1,155,'s');hline(g,1,W1-1,152,'H');
    tyreEnd(g,3,154,11,164);tyreEnd(g,12,154,20,164);tyreEnd(g,W1-20,154,W1-12,164);tyreEnd(g,W1-11,154,W1-3,164);
    if(v===1){rect(g,19,139,26,142,'s');hline(g,20,25,138,'Q');rect(g,W1-8,137,W1-6,140,'K');}
    if(v===2)ftBurn(g,[[20,60,16,10,'R'],[8,20,14,10,'K'],[30,90,10,12,'v'],[22,138,14,6,'R'],[4,70,3,20,'R'],[34,20,10,6,'K']]);
    outlineFromFill(g,'K');
    return toRows(g);
  }

  // fireTruck_vs 60x166: heading SOUTH. The top plane runs nose-down, the
  // taller equipment body shows the strip of its front wall above the lower
  // cab (with a cast shadow on the cab roof), and the south band is the cab
  // front: windscreen, grille, headlamps, chrome bumper.
  function makeFireTruckVS(v){
    var g=mkGrid(FT_VW,FT_VH),W1=FT_VW-1,tmp=mkGrid(FT_VW,FT_PL),y,j=FT_PL-1;
    ftPlaneV(tmp,v,true);
    tmp.reverse().forEach(function(row,i){g[i]=row;});
    // body front wall above the cab roof (cab seam lands on row j-40)
    rect(g,3,j-45,W1-3,j-41,'S');hline(g,3,W1-3,j-41,'s');hline(g,4,W1-4,j-45,'Q');
    hline(g,8,W1-8,j-39,'s');hline(g,9,W1-9,j-38,'s');
    vline(g,14,j-46,j-34,'H');vline(g,45,j-46,j-34,'H');
    // cab front face under a sun visor
    rect(g,8,156,W1-8,158,'K');
    hline(g,4,W1-4,127,'Q');rect(g,3,128,W1-3,130,'S');hline(g,3,W1-3,130,'s');
    rect(g,2,132,W1-2,155,'S');hline(g,3,W1-3,132,'Q');
    rect(g,5,134,W1-5,143,'G');rect(g,29,134,30,143,'S');hline(g,5,W1-5,144,'K');
    line(g,8,141,13,136,'g');line(g,9,141,14,136,'g');line(g,34,141,38,137,'g');
    rect(g,4,146,10,149,'E');hline(g,4,10,150,'H');rect(g,W1-10,146,W1-4,149,'E');hline(g,W1-10,W1-4,150,'H');
    rect(g,12,146,13,149,'a');rect(g,W1-13,146,W1-12,149,'a');
    rect(g,18,145,41,151,'K');for(y=146;y<=150;y+=2)hline(g,19,40,y,'H');for(y=147;y<=149;y+=2)hline(g,19,40,y,'D');
    rect(g,1,152,W1-1,155,'L');hline(g,1,W1-1,152,'H');hline(g,1,W1-1,155,'D');
    tyreEnd(g,4,154,13,164);tyreEnd(g,W1-13,154,W1-4,164);
    if(v===1){line(g,40,135,46,142,'K');line(g,44,136,50,139,'K');rect(g,W1-9,151,W1-1,155,'K');setclip(g,W1-10,153,'D');}
    if(v===2)ftBurn(g,[[20,60,16,10,'R'],[8,100,14,10,'K'],[30,70,10,12,'v'],[6,146,6,4,'R'],[4,40,3,20,'R'],[34,110,10,6,'K']]);
    outlineFromFill(g,'K');
    return toRows(g);
  }

  // =====================================================================
  // bulldozer 110x92 [110x80] / 80x122 [80x110] (+ bulldozer_vs): a crawler
  // dozer built like the sedan — oblique 3/4 from the south for _h, top
  // plane + south face for _v/_vs — out of layered parts, each with its own
  // K outline (dzPart), painted back to front. Blade at the front: low x
  // (_h), low y (_v); _vs heads south and shows the blade's concave face,
  // the radiator guard and the lift cylinders on its south band.
  // Parts: grousered tracks on both sides (the near one in _h shows its side
  // face: toothed drive sprocket at the rear, front idler, road wheels, track
  // frame), fenders, engine hood with side louvres, radiator guard, exhaust
  // stack and precleaner, ROPS cab (posts, roof rim, glass, operator seat),
  // rear ripper with shank + tooth, push arms to trunnions, lift cylinders
  // with bright rods, curved blade with a shaded concave face and a worn
  // bright cutting edge. Paint is a dirty industrial ochre:
  //   ramp.mjs --hue 80 --chroma 0.085 --l 0.2,0.72 -> k z Z Y (K D M L)
  // top planes Z, lit creases Y, side faces z, ground grime k; steel is
  // MAT.iron, glass MAT.glass, dim amber beacon lens a (the lighting pass adds
  // the glow). [0] working; [1] broken/stalled: scorched engine patch, rust
  // streaks, cracked glass, beacon gone, a thrown track section.
  // =====================================================================
  var DZO={K:'#231104',D:'#4d2d00',M:'#715215',L:'#8e7c48'};
  var dzPal={K:K,D:MAT.iron.D,M:MAT.iron.M,L:MAT.iron.L,H:MAT.iron.H,G:MAT.glass.M,g:MAT.glass.L,q:MAT.glass.D,
    Y:DZO.L,Z:DZO.M,z:DZO.D,k:DZO.K,a:amb,R:MAT.rust.D};
  var DZ_W=110,DZ_H=92,DZ_VW=80,DZ_VH=122;
  function dzDisc(g,cx,cy,r,ch){for(var y=-r;y<=r;y++)for(var x=-r;x<=r;x++)if(x*x+y*y<=r*r+r*.6)setclip(g,cx+x,cy+y,ch);}
  function dzRing(g,cx,cy,r,ch){for(var y=-r-1;y<=r+1;y++)for(var x=-r-1;x<=r+1;x++){var d=Math.sqrt(x*x+y*y);if(d<=r+.5&&d>r-.5)setclip(g,cx+x,cy+y,ch);}}
  // draw one part on its own layer, K-outline it, stamp it over g
  function dzPart(g,fn,noOutline){
    var q=mkGrid(g[0].length,g.length),x,y;fn(q);if(!noOutline)outlineFromFill(q,'K');
    for(y=0;y<g.length;y++)for(x=0;x<g[0].length;x++)if(q[y][x]!=='.')g[y][x]=q[y][x];
  }

  function makeBulldozerH(variant){
    var g=mkGrid(DZ_W,DZ_H),brk=variant===1,x,y,o;
    // far track: only its grousered top shows behind the hull
    dzPart(g,function(q){rect(q,22,16,101,25,'D');cutCorners(q,22,16,101,25,3);
      for(x=23;x<=100;x++){if(x%4===0)vline(q,x,17,24,'K');else if(x%4===1)vline(q,x,17,18,'M');}});
    // hull behind the hood and cab, rear deck with the fuel tank
    dzPart(g,function(q){rect(q,24,23,103,44,'Z');hline(q,25,102,24,'Y');hline(q,24,103,45,'Y');rect(q,24,46,103,62,'z');
      vline(q,97,25,44,'z');rect(q,99,31,101,33,'M');setclip(q,99,31,'H');});
    // engine hood: lit top, shaded side face with louvres, radiator guard at the nose
    dzPart(g,function(q){rect(q,27,27,61,44,'Z');hline(q,28,60,28,'Y');hline(q,27,61,45,'Y');rect(q,27,46,61,61,'z');
      hline(q,30,58,36,'z');
      for(x=32;x<=58;x+=3){vline(q,x,49,57,'K');setclip(q,x+1,49,'Y');}
      rect(q,20,26,26,61,'z');rect(q,20,26,26,44,'Z');hline(q,21,25,27,'Y');hline(q,20,26,45,'Y');
      for(y=49;y<=58;y+=3){hline(q,21,25,y,'K');hline(q,21,25,y+1,'D');}vline(q,23,29,42,'z');});
    // exhaust stack and precleaner bowl standing on the hood
    dzPart(g,function(q){rect(q,44,10,46,36,'M');vline(q,44,10,36,'L');vline(q,46,10,36,'D');
      rect(q,43,7,47,9,'D');hline(q,43,47,7,'L');rect(q,43,35,47,37,'D');
      rect(q,53,21,55,33,'D');vline(q,53,21,33,'M');rect(q,51,17,57,20,'M');hline(q,51,57,17,'L');});
    // ROPS cab: canopy roof, raked front/rear glass quads, side glass, posts
    dzPart(g,function(q){var rx0=65,rx1=93,ry0=4,ry1=12,bx0=61,bx1=97,by0=16,by1=38,a,b,t;
      for(x=bx0;x<=rx0;x++){t=(rx0-x)/(rx0-bx0);a=Math.round(ry0+(by0-ry0)*t);b=Math.round(ry1+(by1-ry1)*t);vline(q,x,a,b,'G');}
      for(x=rx1;x<=bx1;x++){t=(x-rx1)/(bx1-rx1);a=Math.round(ry0+(by0-ry0)*t);b=Math.round(ry1+(by1-ry1)*t);vline(q,x,a,b,'G');}
      for(y=ry1;y<=by1;y++){t=(y-ry1)/(by1-ry1);hline(q,Math.round(rx0-(rx0-bx0)*t),Math.round(rx1+(bx1-rx1)*t),y,'G');}
      rect(q,84,25,88,37,'q');rect(q,85,23,88,24,'q');                                     // operator seat back
      rect(q,rx0-1,ry0,rx1+1,ry1+1,'Z');hline(q,rx0,rx1,ry0+1,'Y');hline(q,rx0-1,rx1+1,ry1+1,'z');
      for(o=0;o<2;o++){line(q,rx0+o-1,ry1+2,bx0+o,by1,'Z');line(q,rx1-o+1,ry1+2,bx1-o,by1,'Z');}
      vline(q,79,ry1+2,by1,'Z');vline(q,80,ry1+2,by1,'z');
      line(q,rx0-1,ry0,bx0,by0,'K');line(q,rx1+1,ry0,bx1,by0,'K');
      hline(q,bx0,bx1,by1+1,'K');rect(q,bx0,by1+2,bx1,61,'z');hline(q,bx0+1,bx1-1,by1+2,'Y');
      vline(q,80,by1+3,58,'K');hline(q,75,77,by1+7,'H');
      line(q,70,16,65,24,'g');line(q,71,16,66,24,'g');hline(q,82,84,15,'g');
      if(!brk){rect(q,84,1,87,3,'a');hline(q,84,87,3,'D');}
      else{rect(q,85,2,86,3,'D');}});
    // rear ripper: tilt cylinder, frame link, shank and forward-pointing tooth
    dzPart(g,function(q){line(q,97,38,104,49,'D');line(q,98,38,105,49,'D');line(q,101,43,104,48,'H');
      rect(q,99,48,108,54,'Z');hline(q,100,107,49,'Y');hline(q,99,108,54,'z');
      rect(q,103,55,107,82,'D');vline(q,103,55,82,'M');
      rect(q,99,82,106,86,'M');hline(q,100,105,83,'L');hline(q,98,103,86,'H');});
    // near fender walkway
    dzPart(g,function(q){rect(q,17,61,101,65,'Z');hline(q,18,100,62,'Y');hline(q,17,101,65,'Y');rect(q,17,66,101,67,'z');});
    // near track side face: grousered loop, idler, road wheels, sprocket
    dzPart(g,function(q){var i,an;
      rect(q,15,67,102,90,'D');cutCorners(q,15,67,102,90,10);
      rect(q,23,72,95,85,'k');cutCorners(q,23,72,95,85,5);
      for(x=15;x<=102;x++){if(x%4===0){vline(q,x,68,70,'K');vline(q,x,87,89,'K');}else if(x%4===1){setclip(q,x,68,'M');setclip(q,x,87,'M');}}
      rect(q,33,73,83,77,'z');hline(q,34,82,73,'Y');hline(q,33,83,77,'k');
      for(i=0;i<5;i++){x=39+i*10;dzDisc(q,x,82,3,'M');dzRing(q,x,82,3,'K');setclip(q,x,82,'D');setclip(q,x-1,80,'L');setclip(q,x,80,'L');}
      dzDisc(q,26,79,7,'M');dzRing(q,26,79,7,'K');dzDisc(q,26,79,3,'D');setclip(q,26,79,'K');hline(q,24,28,73,'L');
      dzDisc(q,91,78,9,'D');
      for(i=0;i<12;i++){an=i*Math.PI/6;setclip(q,Math.round(91+Math.cos(an)*9),Math.round(78+Math.sin(an)*9),'L');}
      dzDisc(q,91,78,6,'M');dzRing(q,91,78,6,'K');dzDisc(q,91,78,2,'D');setclip(q,91,78,'H');
      for(i=0;i<6;i++){an=i*Math.PI/3+.5;setclip(q,Math.round(91+Math.cos(an)*4),Math.round(78+Math.sin(an)*4),'K');}
      hline(q,89,93,72,'L');});
    // push arm from the blade back to its trunnion
    dzPart(g,function(q){for(o=0;o<4;o++)line(q,13,67+o,53,76+o,o===0?'Y':o===3?'z':'Z');
      dzDisc(q,55,78,3,'z');dzRing(q,55,78,3,'K');setclip(q,55,78,'H');setclip(q,54,77,'L');});
    // lift cylinders: barrel on the radiator guard, bright rod to the blade top
    dzPart(g,function(q){[27,45].forEach(function(y0){for(o=0;o<3;o++)line(q,27,y0+o,19,y0+3+o,o===0?'M':'D');
      line(q,18,y0+4,11,y0+6,'H');line(q,18,y0+5,11,y0+7,'L');});});
    // blade: top plane of the curl (lip, concave face, back), end plate below
    dzPart(g,function(q){var t,fx;
      rect(q,1,13,14,46,'Z');vline(q,2,14,45,'L');vline(q,3,14,45,'M');vline(q,4,14,45,'D');vline(q,5,14,45,'K');
      vline(q,6,14,45,'Y');rect(q,7,14,13,45,'Z');vline(q,13,14,45,'z');
      [21,29,37].forEach(function(yy){hline(q,7,13,yy,'z');hline(q,7,13,yy+1,'k');});
      // end plate: concave front profile, steel face band (dark under the lip, lit low), painted plate behind
      for(y=46;y<=89;y++){t=(y-46)/43;fx=Math.round(1+7*Math.sin(Math.PI*Math.pow(t,.8)));
        hline(q,fx,14,y,'z');hline(q,fx,fx+2,y,t<.3?'D':t<.65?'M':'L');setclip(q,fx+3,y,'k');}
      hline(q,1,13,46,'Y');hline(q,1,3,47,'L');vline(q,13,47,86,'k');
      rect(q,0,86,7,89,'H');hline(q,0,7,89,'L');});
    if(brk){
      // scorched stalled engine, rust streaks, cracked side glass, thrown track
      rect(g,34,30,45,40,'k');cutCorners(g,34,30,45,40,3);rect(g,37,33,42,37,'K');setclip(g,36,32,'K');setclip(g,43,38,'K');
      vline(g,40,47,57,'R');vline(g,41,50,55,'R');vline(g,66,47,56,'R');vline(g,34,74,76,'R');
      line(g,73,15,76,23,'K');line(g,76,23,74,31,'K');line(g,76,23,83,27,'K');line(g,74,31,70,36,'K');
      rect(g,40,67,64,71,'.');hline(g,40,64,66,'K');hline(g,41,63,72,'k');
      for(x=40;x<=64;x++){y=Math.round(69+11*Math.sin(Math.PI*(x-40)/24));vline(g,x,y-1,y+3,'K');if(x%3){setclip(g,x,y,'L');setclip(g,x,y+1,'M');setclip(g,x,y+2,'D');}}
    }
    return toRows(g);
  }

  // top plane of bulldozer_v (rows 14..101 hold the machine behind the blade)
  function dzPlaneV(brk){
    var g=mkGrid(DZ_VW,DZ_VH),x,y,W1=DZ_VW-1;
    // tracks: transverse grouser shoes, rounded ends
    [[4,18],[61,75]].forEach(function(tr){dzPart(g,function(q){rect(q,tr[0],17,tr[1],104,'D');cutCorners(q,tr[0],17,tr[1],104,4);
      for(y=18;y<=103;y++){if(y%4===0)hline(q,tr[0]+1,tr[1]-1,y,'K');else if(y%4===1)hline(q,tr[0]+1,tr[1]-1,y,'M');}});});
    // push arms outside the tracks, trunnion balls mid-track
    [0,W1-4].forEach(function(ax){dzPart(g,function(q){rect(q,ax,12,ax+4,57,'Z');vline(q,ax+2,13,56,'Y');
      dzDisc(q,ax+2,59,3,'z');dzRing(q,ax+2,59,3,'K');setclip(q,ax+2,59,'H');});});
    // hull, fender walkways over the cab zone
    dzPart(g,function(q){rect(q,19,20,60,101,'z');rect(q,16,60,63,101,'Z');hline(q,17,62,61,'Y');});
    // radiator guard + engine hood with shaded louvred side slopes
    dzPart(g,function(q){rect(q,20,15,59,22,'Z');hline(q,21,58,16,'Y');for(x=23;x<=56;x+=2)vline(q,x,18,21,'K');
      rect(q,22,23,57,59,'Z');hline(q,26,53,24,'Y');rect(q,22,23,25,59,'z');rect(q,54,23,57,59,'z');
      for(y=27;y<=56;y+=3){hline(q,22,24,y,'K');hline(q,55,57,y,'K');}
      hline(q,26,53,41,'z');hline(q,26,53,42,'k');});
    // lift cylinders: barrels on the guard, rods forward to the blade
    [20,57].forEach(function(cx){dzPart(g,function(q){rect(q,cx,13,cx+2,22,'D');vline(q,cx,13,22,'M');vline(q,cx+1,5,12,'H');});});
    // ROPS cab: front/rear glass wedges, side glass, roof, posts, seat
    dzPart(g,function(q){var ws0=59,rf0=65,rf1=87,rw1=94,t;
      for(y=ws0;y<rf0;y++){t=(y-ws0)/(rf0-ws0);hline(q,Math.round(19+5*t),Math.round(60-5*t),y,'G');}
      for(y=rf1+1;y<=rw1;y++){t=(y-rf1)/(rw1-rf1);hline(q,Math.round(24-5*t),Math.round(55+5*t),y,'G');}
      rect(q,19,rf0-1,23,rf1+1,'G');rect(q,56,rf0-1,60,rf1+1,'G');
      rect(q,35,rf1+2,44,rf1+5,'q');
      rect(q,23,rf0,56,rf1,'Z');hline(q,24,55,rf0+1,'Y');hline(q,24,55,rf1,'z');
      line(q,19,ws0,24,rf0,'Z');line(q,60,ws0,55,rf0,'Z');line(q,24,rf1,19,rw1,'Z');line(q,55,rf1,60,rw1,'Z');
      rect(q,19,75,23,76,'Z');rect(q,56,75,60,76,'Z');
      hline(q,19,60,ws0,'K');hline(q,19,60,rw1+1,'K');
      hline(q,27,31,ws0+2,'g');hline(q,30,33,ws0+3,'g');vline(q,20,67,71,'g');vline(q,57,79,82,'g');
      if(!brk){rect(q,47,68,50,70,'a');hline(q,47,50,70,'D');}else rect(q,48,69,49,70,'D');});
    // rear deck / fuel tank
    dzPart(g,function(q){rect(q,17,96,62,101,'Z');hline(q,18,61,97,'Y');rect(q,27,98,29,99,'M');});
    if(brk){
      rect(g,29,32,45,48,'k');cutCorners(g,29,32,45,48,4);rect(g,33,36,41,44,'K');setclip(g,31,34,'K');setclip(g,43,46,'K');
      vline(g,23,40,52,'R');vline(g,56,30,38,'R');
      line(g,28,59,33,64,'K');line(g,33,64,36,63,'K');vline(g,21,68,80,'K');
      rect(g,61,38,75,62,'.');rect(g,63,38,73,62,'k');vline(g,63,38,62,'K');vline(g,73,38,62,'K');
      for(y=40;y<=60;y+=5){setclip(g,66,y,'M');setclip(g,70,y,'M');}
      for(y=62;y<=96;y++){x=W1-1-Math.round(Math.abs(Math.sin(y*.18))*2);setclip(g,x-1,y,'K');setclip(g,x,y,y%3?'D':'K');setclip(g,x+1,y,'K');}
      outlineFromFill(g,'K');
    }
    return g;
  }
  // exhaust stack and precleaner standing on the hood, rising up-screen from their base row by (either heading)
  function dzStackV(g,by,py){
    dzPart(g,function(q){rect(q,32,by-10,34,by,'M');vline(q,32,by-10,by,'L');vline(q,34,by-10,by,'D');
      rect(q,31,by-12,35,by-10,'D');hline(q,31,35,by-12,'L');rect(q,31,by,35,by+1,'D');});
    dzPart(g,function(q){rect(q,47,py-5,48,py,'D');vline(q,47,py-5,py,'M');rect(q,45,py-9,50,py-6,'M');hline(q,45,50,py-9,'L');});
  }
  // the blade seen from above: lip, curl, concave shadow, back and ribs
  function dzBladeTop(q){var x,d,t0,r,ch,seq='KHMDKYZZZZzk';
    for(x=0;x<DZ_VW;x++){d=Math.abs(x-39.5)/39.5;t0=Math.round(1+(1-d*d)*4);
      for(r=0;r<seq.length;r++){ch=seq[r];if(r>=6&&r<=9&&(x===14||x===28||x===51||x===65))ch='k';setclip(q,x,t0+r,ch);}}
  }
  function makeBulldozerV(variant){
    var g=dzPlaneV(variant===1),W1=DZ_VW-1;
    dzStackV(g,38,33);
    dzPart(g,dzBladeTop);
    // south face: track rear ends, hull rear with work lamps, ripper
    [[4,18],[61,75]].forEach(function(tr){dzPart(g,function(q){rect(q,tr[0],103,tr[1],114,'D');hline(q,tr[0]+1,tr[1]-1,104,'M');
      for(var y=106;y<=113;y+=2)hline(q,tr[0]+1,tr[1]-1,y,'K');});});
    dzPart(g,function(q){rect(q,17,102,62,110,'z');hline(q,18,61,102,'Y');lens(q,21,104,4,3,'K','R');lens(q,55,104,4,3,'K','R');
      rect(q,26,99,28,107,'D');rect(q,51,99,53,107,'D');vline(q,27,99,103,'H');vline(q,52,99,103,'H');});
    dzPart(g,function(q){rect(q,13,107,66,111,'Z');hline(q,14,65,108,'Y');hline(q,13,66,111,'z');
      rect(q,36,112,43,118,'D');vline(q,37,112,118,'M');rect(q,37,118,42,121,'M');hline(q,38,41,120,'H');});
    return toRows(g);
  }
  // bulldozer_vs 80x122: heading south. The top plane is mirrored blade-down
  // (ripper top view at the north end), and the south band shows the front:
  // radiator guard, lift cylinders, the blade's concave face and cutting edge.
  function makeBulldozerVS(variant){
    var p=dzPlaneV(variant===1),g=mkGrid(DZ_VW,DZ_VH),x,y;
    for(y=12;y<=104;y++)g[(104-y)+4]=p[y].slice();
    dzStackV(g,70,75);
    dzPart(g,function(q){rect(q,13,0,66,4,'Z');hline(q,14,65,1,'Y');rect(q,36,0,43,2,'D');});
    // radiator guard face, lift cylinders
    dzPart(g,function(q){rect(q,20,90,59,99,'Z');hline(q,21,58,91,'Y');for(y=93;y<=98;y+=2){hline(q,23,56,y,'K');hline(q,23,56,y+1,'D');}});
    [16,60].forEach(function(cx){dzPart(g,function(q){rect(q,cx,88,cx+3,96,'D');vline(q,cx,88,96,'M');rect(q,cx+1,97,cx+2,101,'H');});});
    // blade face: lip, upper curl, deep concave shadow, lower curl, bolt seam, worn edge
    dzPart(g,function(q){var d,t0,r,seq='KYZKHDDDDDDDDMMMMMMLLLKHHLK',ch;
      for(x=0;x<DZ_VW;x++){d=Math.abs(x-39.5)/39.5;t0=94;
        for(r=0;r<seq.length;r++){ch=seq[r];
          if(r===22&&x%7===3)ch='L';if(r>=7&&r<=10&&x%13===6)ch='M';
          if((x===10||x===69)&&r>=4&&r<=21)ch='k';
          setclip(q,x,t0+r,ch);}}
      if(variant===1){vline(q,24,106,113,'R');vline(q,25,108,114,'R');vline(q,57,104,110,'R');}});
    return toRows(g);
  }

  A.define('vehicles',{
    sedan_h:{variants:[makeSedanH(0),makeSedanH(1)],pal:sedanPal,anchor:'feet',
      note:'96x58 [96x48], matches wrecks/car_h: [0] slate-blue saloon, [1] brick-maroon estate; unbroken glass, closed doors, round wheels, glassy head/tail lenses'},
    sedan_vs:{variants:[makeSedanVS(0),makeSedanVS(1)],pal:sedanPal,anchor:'feet',note:'48x106 [48x96], heading south: nose at the bottom with its front face (headlamps, grille, chrome) where sedan_v shows the rear'},
    sedan_v:{variants:[makeSedanV(0),makeSedanV(1)],pal:sedanPal,anchor:'feet',
      note:'48x106 [48x96], matches wrecks/car_v: same two liveries, vertical'},
    fireTruck_h:{variants:[makeFireTruckH(0),makeFireTruckH(1),makeFireTruckH(2)],pal:ftPal,anchor:'feet',
      note:'150x72 [150x60]: [0] intact, [1] damaged (dents, cracked glass, one dead light-bar cell), [2] burnt wreck; low crew cab, tall body, roof ladder, hose bed, pump panel, roll-up lockers, tandem rear axle'},
    fireTruck_v:{variants:[makeFireTruckV(0),makeFireTruckV(1),makeFireTruckV(2)],pal:ftPal,anchor:'feet',
      note:'60x166 [60x150]: top-down, nose north, rear face (roll-up door, tail lenses, step) on the south edge; same three states'},
    fireTruck_vs:{variants:[makeFireTruckVS(0),makeFireTruckVS(1),makeFireTruckVS(2)],pal:ftPal,anchor:'feet',
      note:'60x166 [60x150], heading south: cab front face (windscreen, grille, headlamps, chrome bumper) on the south edge'},
    bulldozer_h:{variants:[makeBulldozerH(0),makeBulldozerH(1)],pal:dzPal,anchor:'feet',
      note:'110x92 [110x80]: crawler dozer, oblique 3/4 from the south, blade at the front (low x); [0] working (dim amber beacon), [1] broken/stalled (scorched engine, cracked glass, no beacon, thrown track)'},
    bulldozer_v:{variants:[makeBulldozerV(0),makeBulldozerV(1)],pal:dzPal,anchor:'feet',
      note:'80x122 [80x110]: top plane + rear face, blade at the front (low y), ripper on the south band; same two states'},
    bulldozer_vs:{variants:[makeBulldozerVS(0),makeBulldozerVS(1)],pal:dzPal,anchor:'feet',
      note:'80x122 [80x110], heading south: blade at the bottom showing its concave face, cutting edge, radiator guard and lift cylinders'}
  });
})();
