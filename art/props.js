// Dead Signal street props: static furniture and clutter placed along the
// avenues and in district lots (world.js prop()/solid() calls under
// 'props/<name>'). One texel = one world unit (den 1). Night city is
// near-black and desaturated, so every solid mass gets a 1-texel K outline
// and a simple top-left bevel (light edge top+left, dark edge bottom+right,
// rule 27/28); flat faces stay one colour, only curved bits (wheels, discs,
// tires) get a ramp. Colour budget stays at or under 7 used letters per
// sprite regardless of size. Most sprites use one MAT ramp untouched
// ('MAT.iron' etc, using that ramp's own K/D/M/L/H and any accent letters it
// already carries); a few genuinely need two materials, so they get a small
// merged palette object built once below (rule 23: share one dark shadow
// colour, so the merges keep the base ramp's own K/D as the shared shadow).
(function(){
  'use strict';
  var A=(typeof window!=='undefined'?window:globalThis).DSArt;
  var MAT=A.MAT;

  // ---- grid helpers (tools/art/pix.mjs style: build on a grid, emit rows) ----
  function mkGrid(w,h){var g=[],y,x,row;for(y=0;y<h;y++){row=[];for(x=0;x<w;x++)row.push('.');g.push(row);}return g;}
  function setclip(g,x,y,ch){if(y>=0&&y<g.length&&x>=0&&x<g[0].length)g[y][x]=ch;}
  function rect(g,x0,y0,x1,y1,ch){var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)setclip(g,x,y,ch);}
  function toRows(g){return g.map(function(r){return r.join('');});}
  function pal2(base,extra){return Object.assign({},base,extra);}
  // filled ellipse (radii rx,ry around cx,cy) for wheels, tires, dishes, rubble blobs
  function disc(g,cx,cy,rx,ry,ch){
    var x,y;
    for(y=-ry;y<=ry;y++)for(x=-rx;x<=rx;x++)if((x*x)/(rx*rx)+(y*y)/(ry*ry)<=1)setclip(g,cx+x,cy+y,ch);
  }
  // box with a 1-texel K perimeter, a flat M fill, a 1px L edge on the top+left
  // (toward the light) and a 1px D edge on bottom+right (rule 27/28); pass the
  // same letter for two args to flatten a face per rule 30.
  function bevel(g,x0,y0,x1,y1,K,L,M,D){
    rect(g,x0,y0,x1,y1,M);
    rect(g,x0,y0,x1,y0,K);rect(g,x0,y1,x1,y1,K);rect(g,x0,y0,x0,y1,K);rect(g,x1,y0,x1,y1,K);
    if(x1-x0>=2&&y1-y0>=2){
      rect(g,x0+1,y0+1,x1-1,y0+1,L);
      rect(g,x0+1,y0+1,x0+1,y1-1,L);
      rect(g,x0+1,y1-1,x1-1,y1-1,D);
      rect(g,x1-1,y0+1,x1-1,y1-1,D);
    }
  }
  // auto-outline: any cell whose colour is in fillLetters and touches transparent
  // (or the canvas edge) becomes K. Used for organic/blob silhouettes (bags,
  // slag, rubble, tires) where a hand-traced perimeter isn't worth it.
  function outlineFrom(g,fillLetters,K){
    var h=g.length,w=g[0].length,x,y,src=g.map(function(r){return r.slice();});
    function isFill(ch){return fillLetters.indexOf(ch)>=0;}
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      if(!isFill(src[y][x]))continue;
      if(x===0||x===w-1||y===0||y===h-1||src[y][x-1]==='.'||src[y][x+1]==='.'||src[y-1][x]==='.'||src[y+1][x]==='.')g[y][x]=K;
    }
  }

  // ---- merged two-material palettes (letters chosen to avoid the base ramp's own keys) ----
  var BENCH_PAL=pal2(MAT.wood,{I:MAT.iron.M,J:MAT.iron.L});
  var BENCHWAIT_PAL=pal2(MAT.concrete,{G:MAT.glass.M,F:MAT.glass.L});
  var BUSSTOP_PAL=pal2(MAT.iron,{G:MAT.glass.M,Z:MAT.glass.D});
  var NEWSBOX_PAL=pal2(MAT.olive,{R:MAT.rust.M,S:MAT.rust.L});
  var PHONEBOOTH_PAL=pal2(MAT.iron,{G:MAT.glass.M,Z:MAT.glass.D});
  var DUMPSTER_PAL=pal2(MAT.olive,{R:MAT.rust.M,S:MAT.rust.L,T:MAT.rust.D,U:MAT.rust.H});
  var CRATESTACK_PAL=pal2(MAT.wood,{S:MAT.olive.M});
  var GURNEY_PAL=pal2(MAT.iron,{S:MAT.concrete.H,T:MAT.concrete.M});
  var IVSTAND_PAL=pal2(MAT.iron,{B:MAT.concrete.H,C:MAT.concrete.M});
  var SLAG_PAL=pal2(MAT.basalt,{E:MAT.ember.M,F:MAT.ember.L});
  var CINDERVENT_PAL=pal2(MAT.concrete,{E:MAT.ember.O,W:MAT.ember.W});
  var PLACARD_PAL=pal2(MAT.iron,{P:MAT.concrete.H,Q:MAT.concrete.M});
  var RUBBLE_PAL=pal2(MAT.concrete,{R:MAT.rust.L});
  var DEBRISPILE_PAL=pal2(MAT.concrete,{B:MAT.brick.M,C:MAT.brick.D,O:MAT.wood.M,P:MAT.wood.D,R:MAT.rust.L,S:MAT.rust.H});
  var BINMEDICAL_PAL=pal2(MAT.concrete,{B:MAT.ember.M});
  var AMBULANCE_PAL=pal2(MAT.concrete,{R:MAT.ember.M,G:MAT.glass.D});

  // =====================================================================
  // streetLamp 28x72: a "cobra head" lamp, asymmetric on purpose: a tall
  // iron pole at the left (x4-7), a curved arm sweeping up and right, and a
  // long thin head hanging over the road near x21. [0] working (ember Y
  // underside with a W core, the only bright cluster in the family), [1]
  // dead (dark head), [2] bent (arm sags so the head hangs lower, pole
  // leans a couple texels partway up). anchor puts the pole base (not the
  // sprite's horizontal middle) at the prop position; world.js flips the
  // sprite for the other side of the road.
  // =====================================================================
  function makeStreetLamp(variant){
    var w=28,h=72,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',H='H',Y='Y',W='W';
    var kinked=variant===2,dy=kinked?8:0;
    var poleTop=14+dy;
    var hx0=15,hx1=26,hy0=2+dy,hy1=5+dy;
    rect(g,2,70,9,71,D); // base plate
    if(!kinked){
      rect(g,4,poleTop,7,69,D);
    }else{
      rect(g,4,50,7,69,D);      // lower pole, unbent
      rect(g,5,47,8,49,D);      // kink transition
      rect(g,6,poleTop,9,46,D); // upper pole, leaned +2
    }
    var baseX=kinked?6:4;
    var armBottom=poleTop-1,armTop=hy1,steps=armBottom-armTop,i,yy,t,xl,xr;
    for(i=0;i<=steps;i++){
      yy=armBottom-i;t=i/steps;
      xl=Math.round(baseX+t*(hx0-baseX));
      xr=Math.round((baseX+3)+t*((hx0+5)-(baseX+3)));
      rect(g,xl,yy,xr,yy,D);
    }
    outlineFrom(g,[D],K);
    // light edge toward the top-left: the pole's left face and the arm's upper rim
    for(yy=poleTop+1;yy<69;yy++)setclip(g,kinked&&yy<47?7:4,yy,M);
    for(i=0;i<=steps;i++){
      yy=armBottom-i;t=i/steps;
      xl=Math.round(baseX+t*(hx0-baseX));
      setclip(g,xl+1,yy,M);
    }
    bevel(g,hx0,hy0,hx1,hy1,K,M,D,K);
    if(variant===0){
      rect(g,hx0+2,hy1-1,hx1-2,hy1,Y);
      setclip(g,((hx0+hx1)/2)|0,hy1,W);
      setclip(g,hx0+2,hy0,L);setclip(g,hx0+3,hy0,H);
    }
    return toRows(g);
  }

  // =====================================================================
  // hydrant 10x18: rust body, cap, two side nozzles
  // =====================================================================
  function makeHydrant(){
    var w=10,h=18,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',H='H';
    bevel(g,1,15,8,17,K,M,D,K);
    bevel(g,2,3,7,15,K,M,D,K);
    bevel(g,3,0,6,3,K,M,D,K);
    rect(g,0,7,1,9,M);setclip(g,0,7,K);setclip(g,0,9,K);setclip(g,1,6,K);setclip(g,1,10,K);
    rect(g,8,7,9,9,M);setclip(g,9,7,K);setclip(g,9,9,K);setclip(g,8,6,K);setclip(g,8,10,K);
    setclip(g,4,1,H);setclip(g,5,1,H);
    return toRows(g);
  }

  // =====================================================================
  // trafficLight 14x60: pole, three-lamp head. dead / amber lit / red lit
  // =====================================================================
  function makeTrafficLight(state){
    var w=14,h=60,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',R='O',AM='Y',W='W';
    bevel(g,3,57,10,59,K,M,D,K);
    bevel(g,5,20,8,57,K,M,D,K);
    bevel(g,2,1,11,19,K,M,D,K);
    disc(g,6,5,2,2,K);disc(g,6,5,1,1,D);
    disc(g,6,10,2,2,K);disc(g,6,10,1,1,D);
    disc(g,6,15,2,2,K);disc(g,6,15,1,1,D);
    if(state==='red'){disc(g,6,5,1,1,R);setclip(g,6,5,W);}
    if(state==='amber'){disc(g,6,10,1,1,AM);setclip(g,6,10,W);}
    return toRows(g);
  }

  // =====================================================================
  // circuitBox 14x22: wall-mounted emergency circuit box, hinged panel door.
  // off = dark dead lamp lens; on = one small lit amber status lamp.
  // =====================================================================
  function makeCircuitBox(on){
    var w=14,h=22,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',Y='Y',W='W';
    bevel(g,1,1,12,20,K,L,M,D);
    rect(g,3,3,10,13,D);setclip(g,3,3,K);setclip(g,10,3,K);setclip(g,3,13,K);setclip(g,10,13,K); // panel door
    rect(g,5,16,8,16,D);rect(g,5,18,8,18,D); // vent slats
    disc(g,6,7,1,1,on?'Y':'K');
    if(on)setclip(g,6,7,W);
    return toRows(g);
  }

  // =====================================================================
  // bench 40x14: wood slats on iron legs
  // =====================================================================
  function makeBench(){
    var w=40,h=14,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',I='I',J='J';
    rect(g,4,9,6,13,I);setclip(g,4,9,K);setclip(g,6,9,K);setclip(g,4,13,K);setclip(g,6,13,K);
    rect(g,33,9,35,13,I);setclip(g,33,9,K);setclip(g,35,9,K);setclip(g,33,13,K);setclip(g,35,13,K);
    setclip(g,5,10,J);setclip(g,34,10,J);
    bevel(g,2,6,37,8,K,M,D,K);
    bevel(g,2,0,37,4,K,M,D,K);
    rect(g,10,1,10,3,D);rect(g,20,1,20,3,D);rect(g,30,1,30,3,D);
    setclip(g,10,7,D);setclip(g,20,7,D);setclip(g,30,7,D);
    return toRows(g);
  }

  // =====================================================================
  // benchWait 40x18: hospital plastic bench, pale seat, glass-tint backrest
  // =====================================================================
  function makeBenchWait(){
    var w=40,h=18,g=mkGrid(w,h);
    var K='K',D='D',M='M',H='H',G='G',F='F';
    rect(g,4,13,6,17,D);setclip(g,4,13,K);setclip(g,6,13,K);setclip(g,4,17,K);setclip(g,6,17,K);
    rect(g,33,13,35,17,D);setclip(g,33,13,K);setclip(g,35,13,K);setclip(g,33,17,K);setclip(g,35,17,K);
    bevel(g,2,10,37,13,K,H,H,M);
    bevel(g,3,0,36,9,K,H,F,G);
    setclip(g,15,3,K);setclip(g,16,4,K);setclip(g,17,5,K);setclip(g,18,3,K);
    return toRows(g);
  }

  // =====================================================================
  // binSmall 10x16: iron street bin, rim
  // =====================================================================
  function makeBinSmall(){
    var w=10,h=16,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',H='H';
    bevel(g,1,3,8,15,K,M,D,K);
    rect(g,0,1,9,2,M);setclip(g,0,1,K);setclip(g,9,1,K);setclip(g,0,2,K);setclip(g,9,2,K);
    setclip(g,2,4,H);
    return toRows(g);
  }

  // =====================================================================
  // binMedical 12x18: white body, thin red band, hinged lid
  // =====================================================================
  function makeBinMedical(){
    var w=12,h=18,g=mkGrid(w,h);
    var K='K',M='M',L='L',H='H',B='B';
    bevel(g,1,2,10,17,K,H,L,M);
    rect(g,1,9,10,10,B);setclip(g,1,9,K);setclip(g,10,9,K);
    rect(g,3,0,8,2,L);setclip(g,3,0,K);setclip(g,8,0,K);
    return toRows(g);
  }

  // =====================================================================
  // busStop 44x64: shelter roof, two iron posts, glass back panel, one
  // cracked pane, a bench inside
  // =====================================================================
  function makeBusStop(){
    var w=44,h=64,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',H='H',G='G',F='F';
    bevel(g,4,20,7,63,K,M,D,K);
    bevel(g,36,20,39,63,K,M,D,K);
    bevel(g,0,14,43,19,K,M,D,K);
    rect(g,0,13,43,13,H);
    bevel(g,8,24,35,58,K,G,'Z',K);
    setclip(g,18,32,K);setclip(g,19,34,K);setclip(g,17,36,K);setclip(g,20,38,K);setclip(g,18,40,K);
    bevel(g,10,50,33,54,K,M,D,K);
    return toRows(g);
  }

  // =====================================================================
  // newsBox 14x20: olive box, rust front window, coin-slot lid
  // =====================================================================
  function makeNewsBox(){
    var w=14,h=20,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',R='R',S='S';
    bevel(g,1,3,12,19,K,M,D,K);
    rect(g,2,5,11,12,R);setclip(g,2,5,K);setclip(g,11,5,K);setclip(g,2,12,K);setclip(g,11,12,K);
    setclip(g,4,7,S);setclip(g,5,7,S);
    rect(g,3,0,10,3,L);setclip(g,3,0,K);setclip(g,10,0,K);
    return toRows(g);
  }

  // =====================================================================
  // phoneBooth 20x40: iron frame, glass panel, dark phone unit inside
  // =====================================================================
  function makePhoneBooth(){
    var w=20,h=40,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',G='G',F='F';
    bevel(g,1,0,18,39,K,M,D,K);
    bevel(g,3,2,16,30,K,G,'Z',K);
    rect(g,8,20,11,26,D);setclip(g,8,20,K);setclip(g,11,20,K);setclip(g,8,26,K);setclip(g,11,26,K);
    rect(g,2,36,17,39,M);setclip(g,2,36,K);setclip(g,17,36,K);setclip(g,2,39,K);setclip(g,17,39,K);
    return toRows(g);
  }

  // =====================================================================
  // mailbox 10x18: olive box with a rounded top and a flag
  // =====================================================================
  function makeMailbox(){
    var w=10,h=18,g=mkGrid(w,h);
    var K='K',M='M',L='L',D='D',H='H';
    bevel(g,0,5,9,13,K,M,D,K);
    setclip(g,0,5,'.');setclip(g,9,5,'.');setclip(g,1,5,K);setclip(g,8,5,K);
    bevel(g,2,14,7,17,K,M,D,K);
    setclip(g,4,10,H);setclip(g,5,7,H);
    return toRows(g);
  }

  // =====================================================================
  // signEvac 16x40: post plus two-tone rectangular sign, arrow glyph in H
  // =====================================================================
  function makeSignEvac(){
    var w=16,h=40,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',H='H';
    bevel(g,6,20,9,39,K,M,D,K);
    bevel(g,1,2,14,19,K,L,M,K);
    rect(g,2,11,13,18,D);
    setclip(g,1,11,K);setclip(g,14,11,K);
    rect(g,4,7,9,8,H);
    setclip(g,10,5,H);setclip(g,10,6,H);setclip(g,10,7,H);setclip(g,10,8,H);setclip(g,10,9,H);setclip(g,10,10,H);
    setclip(g,9,4,H);setclip(g,9,11,H);setclip(g,8,3,H);setclip(g,8,12,H);
    return toRows(g);
  }

  // =====================================================================
  // dumpster 40x26: [0] olive closed, [1] rust with the lid open
  // =====================================================================
  function makeDumpster(variant){
    var w=40,h=26,g=mkGrid(w,h);
    var isRust=variant===1;
    var K='K',D=isRust?'T':'D',M=isRust?'R':'M',L=isRust?'S':'L',H=isRust?'U':'H';
    bevel(g,1,10,38,25,K,M,D,K);
    rect(g,10,11,10,24,D);rect(g,20,11,20,24,D);rect(g,30,11,30,24,D);
    if(!isRust)bevel(g,0,4,39,10,K,M,D,K);
    else bevel(g,2,0,37,6,K,M,D,K);
    setclip(g,5,12,H);
    return toRows(g);
  }

  // =====================================================================
  // coneTraffic 10x14: ember cone with a pale reflective band, base plate
  // =====================================================================
  function makeCone(){
    var w=10,h=14,g=mkGrid(w,h);
    var K='K',D='D',M='M',O='O',W='W';
    var cx=4,y,half;
    for(y=0;y<=8;y++){
      half=Math.round(y*4/8);
      rect(g,cx-half,y,cx+half,y,D);
      setclip(g,cx-half,y,K);setclip(g,cx+half,y,K);
    }
    rect(g,cx-2,5,cx+2,5,W);setclip(g,cx-2,5,K);setclip(g,cx+2,5,K);
    bevel(g,0,9,9,13,K,O,D,K);
    return toRows(g);
  }

  // =====================================================================
  // trashBags 26x14: two overlapping black bags, basalt ramp. [1] torn
  // =====================================================================
  function makeTrashBags(variant){
    var w=26,h=14,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L';
    disc(g,7,9,6,4,D);disc(g,6,8,3,2,M);disc(g,5,7,2,1,L);
    disc(g,18,8,7,5,D);disc(g,16,7,4,3,M);disc(g,14,6,2,1,L);
    outlineFrom(g,[M,D,L],K);
    rect(g,12,7,13,9,K); // seam: separate the two bags (rule 16)
    if(variant===1){
      rect(g,16,3,19,5,M); // torn patch, lighter than the bag body
      setclip(g,17,4,L);setclip(g,18,5,L);
      setclip(g,16,3,K);setclip(g,19,3,K);setclip(g,16,5,K);setclip(g,19,5,K); // ragged corners
    }
    return toRows(g);
  }

  // =====================================================================
  // barrelRust 20x22: [0] upright, [1] dented in on one side
  // =====================================================================
  function makeBarrel(variant){
    var w=20,h=22,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',H='H';
    bevel(g,3,2,16,19,K,M,D,K);
    rect(g,3,5,16,5,D);rect(g,3,14,16,14,D);
    bevel(g,2,19,17,21,K,M,D,K);
    setclip(g,5,4,H);
    if(variant===1){
      rect(g,12,8,17,13,'.');
      disc(g,13,10,3,3,D);
      outlineFrom(g,['D','M','L'],K);
    }
    return toRows(g);
  }

  // =====================================================================
  // palletStack 36x22: wood pallets, slatted top with gaps between boards
  // =====================================================================
  function makePalletStack(){
    var w=36,h=22,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L';
    bevel(g,1,10,34,21,K,M,D,K);
    rect(g,1,14,34,14,D);rect(g,1,18,34,18,D);
    var x;
    for(x=2;x<32;x+=5){
      rect(g,x,4,x+3,9,D);
      setclip(g,x,4,K);setclip(g,x+3,4,K);setclip(g,x,9,K);setclip(g,x+3,9,K);
      setclip(g,x+1,5,L);
    }
    return toRows(g);
  }

  // =====================================================================
  // tireStack 26x22: three stacked tire rings (annuli), basalt ramp
  // =====================================================================
  function makeTireStack(){
    var w=26,h=22,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',H='H';
    disc(g,13,16,12,5,D);disc(g,13,16,8,3,'.');
    outlineFrom(g,[D],K);
    disc(g,13,9,9,4,M);disc(g,13,9,6,2,'.');
    outlineFrom(g,[M],K);
    disc(g,13,4,7,3,L);disc(g,13,4,4,1,'.');
    outlineFrom(g,[L],K);
    setclip(g,10,3,H);
    return toRows(g);
  }

  // =====================================================================
  // crateStack 32x28: wood crates, olive stencil marks
  // =====================================================================
  function makeCrateStack(){
    var w=32,h=28,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',S='S';
    bevel(g,1,14,30,27,K,M,D,K);
    bevel(g,4,1,27,13,K,M,D,K);
    rect(g,10,17,21,17,S);rect(g,10,21,21,21,S);
    rect(g,12,4,19,4,S);
    return toRows(g);
  }

  // =====================================================================
  // gurney 36x22: iron frame, wheels, pale sheet
  // =====================================================================
  function makeGurney(){
    var w=36,h=22,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',S='S',T='T';
    disc(g,5,20,3,2,D);disc(g,30,20,3,2,D);
    outlineFrom(g,[D],K);
    rect(g,4,14,6,19,M);setclip(g,4,14,K);setclip(g,6,19,K);
    rect(g,29,14,31,19,M);setclip(g,29,14,K);setclip(g,31,19,K);
    bevel(g,2,11,33,14,K,M,D,K);
    bevel(g,3,2,32,11,K,S,S,T);
    return toRows(g);
  }

  // =====================================================================
  // ivStand 8x40: thin iron pole, small flanged foot, pale bag at the top
  // =====================================================================
  function makeIvStand(){
    var w=8,h=40,g=mkGrid(w,h);
    var K='K',M='M',D='D',B='B',C='C';
    bevel(g,1,36,6,39,K,M,D,K);
    rect(g,3,10,4,37,D);setclip(g,3,10,K);setclip(g,4,37,K);
    rect(g,3,6,5,9,D);setclip(g,3,6,K);setclip(g,5,9,K);
    bevel(g,1,0,6,7,K,B,B,C);
    return toRows(g);
  }

  // =====================================================================
  // wheelchair 22x24: iron frame, big rear wheel, small front caster, tipped
  // =====================================================================
  function makeWheelchair(){
    var w=22,h=24,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L';
    disc(g,15,17,6,6,D);disc(g,15,17,4,4,'.');
    outlineFrom(g,[D],K);
    setclip(g,15,17,M);
    disc(g,4,20,2,2,D);
    outlineFrom(g,[D],K);
    bevel(g,3,6,16,10,K,M,D,K);
    bevel(g,2,0,5,9,K,M,D,K);
    rect(g,3,11,16,11,M);setclip(g,3,11,K);setclip(g,16,11,K);
    return toRows(g);
  }

  // =====================================================================
  // slagPile 40x22: dark slag with glowing ember cracks (spec carries light)
  // =====================================================================
  function makeSlagPile(){
    var w=40,h=22,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',E='E',F='F';
    disc(g,20,16,19,6,D);disc(g,17,12,14,4,M);disc(g,12,9,8,3,L);
    outlineFrom(g,[D,M,L],K);
    var cracks=[[6,16],[8,15],[11,14],[13,13],[16,13],[19,14],[22,14],[25,15],[28,16],[31,17]];
    cracks.forEach(function(p){setclip(g,p[0],p[1],E);});
    setclip(g,13,13,F);setclip(g,19,14,F);setclip(g,25,15,F);
    return toRows(g);
  }

  // =====================================================================
  // cinderVent 24x18: concrete stub with a glowing ember slit
  // =====================================================================
  function makeCinderVent(){
    var w=24,h=18,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',E='E',W='W';
    bevel(g,2,4,21,17,K,M,D,K);
    rect(g,6,9,17,10,K);
    rect(g,7,9,16,9,E);
    setclip(g,11,9,W);
    return toRows(g);
  }

  // =====================================================================
  // brokenPipe 44x16: iron pipe run, jagged broken end, rust drip + stain
  // =====================================================================
  function makeBrokenPipe(){
    var w=44,h=16,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',R='R';
    bevel(g,2,5,33,10,K,M,D,K);
    rect(g,33,5,38,10,'.');
    var jag=[[33,5],[34,6],[33,7],[35,8],[34,9],[33,10]];
    jag.forEach(function(p){rect(g,33,p[1],p[0]+3,p[1],M);});
    outlineFrom(g,[M,D,L],K);
    rect(g,35,11,36,15,R);setclip(g,35,11,K);setclip(g,36,15,K);
    rect(g,20,14,24,15,R);
    return toRows(g);
  }

  // =====================================================================
  // rubbleChunk 44x24 x3: concrete slab silhouettes with rust rebar bits
  // =====================================================================
  function makeRubble(variant){
    var w=44,h=24,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',R='R',rebar;
    if(variant===0){
      disc(g,15,15,14,8,D);disc(g,13,12,10,5,M);disc(g,10,9,5,3,L);
      rebar=[[8,6],[9,5],[9,4]];
    }else if(variant===1){
      disc(g,28,16,15,7,D);disc(g,25,13,10,5,M);disc(g,32,11,6,3,L);
      rebar=[[35,6],[36,5],[36,4]];
    }else{
      disc(g,20,14,18,9,D);disc(g,15,10,8,4,M);disc(g,26,9,6,3,L);
      rebar=[[18,3],[19,2],[19,1]];
    }
    outlineFrom(g,[D,M,L],K);
    rebar.forEach(function(p){setclip(g,p[0],p[1],R);});
    return toRows(g);
  }

  // =====================================================================
  // debrisPile 80x86 x3: an authored collapse pile — the thing a bulldozer
  // clears (Phase 10). Heavier than rubbleChunk: a much bigger concrete
  // mound plus straight-edged brick chunks, broken wood beams and rebar
  // bits jutting out at several points, not just one rebar cluster.
  // =====================================================================
  function makeDebrisPile(variant){
    var w=80,h=86,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',B='B',C='C',O='O',P='P',R='R',S='S';
    var cx,baseY,beams,rebar,bricks;
    if(variant===0){
      cx=34;baseY=70;
      beams=[[10,60,34,66],[46,50,50,74]];
      rebar=[[18,26],[19,25],[19,24],[58,20],[59,19],[60,18]];
      bricks=[[10,56,22,64],[44,44,56,52]];
    }else if(variant===1){
      cx=46;baseY=72;
      beams=[[18,52,48,58],[54,40,58,68]];
      rebar=[[26,22],[27,21],[27,20],[62,30],[63,29],[64,28]];
      bricks=[[18,48,30,56],[52,34,64,42]];
    }else{
      cx=40;baseY=68;
      beams=[[8,44,12,70],[40,48,66,54]];
      rebar=[[20,18],[21,17],[21,16],[52,24],[53,23],[54,22]];
      bricks=[[8,40,20,48],[46,54,58,62]];
    }
    disc(g,cx,baseY,34,20,D);
    disc(g,cx-6,baseY-10,26,15,M);
    disc(g,cx+8,baseY-18,16,10,L);
    disc(g,cx-14,baseY-4,12,8,D);
    disc(g,cx+16,baseY+2,10,7,D);
    // brick chunks: straight-edged blocks set into the mound
    bricks.forEach(function(b){
      rect(g,b[0],b[1],b[2],b[3],B);
      setclip(g,b[0],b[1],C);setclip(g,b[2],b[3],C);setclip(g,b[0],b[3],C);setclip(g,b[2],b[1],C);
    });
    // broken beams jutting from the pile
    beams.forEach(function(bm){
      var x0=bm[0],y0=bm[1],x1=bm[2],y1=bm[3];
      rect(g,x0,y0,x1,y1,O);
      if(x1-x0>=y1-y0)rect(g,x0,y0,x1,y0+2,P);else rect(g,x0,y0,x0+2,y1,P);
      setclip(g,x0,y0,K);setclip(g,x1,y1,K);
    });
    outlineFrom(g,[D,M,L,B,C,O,P],K);
    // rebar bits poking past the silhouette at several points (heavier pile)
    rebar.forEach(function(p){setclip(g,p[0],p[1],R);});
    rebar.forEach(function(p){setclip(g,p[0]+1,p[1]-1,S);});
    return toRows(g);
  }

  // =====================================================================
  // debrisCleared 80x70 x2: what's left after a bulldozer clears a
  // debrisPile — flat scraped ground, a lighter dust patch, a few small
  // fragments left behind.
  // =====================================================================
  function makeDebrisCleared(variant){
    var w=80,h=70,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',R='R';
    var cx=40,cy=35,dx=variant?6:-6;
    disc(g,cx,cy,36,26,D);
    disc(g,cx,cy,30,21,M);
    disc(g,cx+dx,cy-4,18,12,L);
    outlineFrom(g,[D,M,L],K);
    var frags=variant?[[20,44],[54,26],[34,50],[60,40]]:[[24,22],[50,50],[16,50],[58,20]];
    frags.forEach(function(p){setclip(g,p[0],p[1],R);setclip(g,p[0]+2,p[1]+1,K);});
    return toRows(g);
  }

  // =====================================================================
  // antennaMast 12x56: thin iron lattice mast, cross braces, small dish
  // =====================================================================
  function makeAntennaMast(){
    var w=12,h=56,g=mkGrid(w,h);
    var K='K',D='D',M='M',H='H';
    bevel(g,2,40,9,55,K,M,M,D);
    rect(g,5,10,6,40,M);setclip(g,5,10,K);setclip(g,6,40,K);
    var y;for(y=14;y<38;y+=8){rect(g,4,y,7,y,D);setclip(g,4,y,K);setclip(g,7,y,K);}
    disc(g,5,6,5,3,M);disc(g,5,6,3,2,'.');
    outlineFrom(g,[M],K);
    setclip(g,5,5,H);
    return toRows(g);
  }

  // =====================================================================
  // ambulance 72x44: seen from above/3-4, white box, red stripe, dark
  // windows, open rear doors, wheels. Stands on a 72x36 collision box, so
  // the top 8 rows (cab roof) overhang past the solid footprint.
  // =====================================================================
  function makeAmbulance(){
    var w=72,h=44,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',H='H',R='R',G='G';
    bevel(g,4,8,67,39,K,H,L,M);
    bevel(g,4,0,30,11,K,H,L,M);
    rect(g,7,2,13,7,G);setclip(g,7,2,K);setclip(g,13,7,K);
    rect(g,32,12,66,18,G);setclip(g,32,12,K);setclip(g,66,18,K);
    rect(g,4,24,67,27,R);setclip(g,4,24,K);setclip(g,67,27,K);
    rect(g,60,10,66,38,D);setclip(g,60,10,K);setclip(g,66,10,K);setclip(g,60,38,K);setclip(g,66,38,K);
    disc(g,16,39,5,4,K);disc(g,16,39,2,2,D);
    disc(g,52,39,5,4,K);disc(g,52,39,2,2,D);
    return toRows(g);
  }

  // =====================================================================
  // ---- 3x5 stencil face, only the letters the placard needs ----
  // Glyphs are variable width: three columns cannot hold an N's diagonal
  // without it reading as an M, so N takes four. Width comes from the row
  // string, advance is width + 1.
  var GLYPH={
    A:'111,101,111,101,101', B:'110,101,110,101,110', C:'111,100,100,100,111',
    D:'110,101,101,101,110', E:'111,100,111,100,111', F:'111,100,111,100,100',
    I:'111,010,010,010,111', J:'001,001,001,101,111', N:'10001,11001,10101,10011,10001',
    O:'111,101,101,101,111', P:'111,101,111,100,100', Q:'111,101,101,111,001',
    R:'111,101,110,101,101', S:'111,100,111,001,111', T:'111,010,010,010,010',
    U:'101,101,101,101,111', ' ':'00,00,00,00,00'
  };
  function stencil(g,x,y,str,ch){
    var pen=x;
    for(var i=0;i<str.length;i++){
      var def=GLYPH[str[i]]; if(!def)continue;
      var r=def.split(','),a,b;
      for(a=0;a<5;a++)for(b=0;b<r[a].length;b++)if(r[a][b]==='1')setclip(g,pen+b,y+a,ch);
      pen+=r[0].length+1;
    }
  }
  function stencilW(str){
    var total=0;
    for(var i=0;i<str.length;i++){var def=GLYPH[str[i]];if(def)total+=def.split(',')[0].length+1;}
    return Math.max(0,total-1);
  }

  // signPlacard 72x72: the containment notice bolted at each quarantine
  // crossing. Big on purpose — it is the only place the survivors can actually
  // read what the command post decided, so at 72 texels the 3x5 stencil type is
  // legible in world rather than merely suggested. The amber FURNACE stamp is
  // the disposition field, which is where the boss gets its name.
  function makePlacard(){
    var w=72,h=72,g=mkGrid(w,h),x,y;
    var K='K',D='D',M='M',L='L',P='P',Q='Q',Y='Y';
    // posts first, so the board paints over their tops
    rect(g,14,44,18,71,M);rect(g,53,44,57,71,M);
    rect(g,14,44,14,71,K);rect(g,18,44,18,71,K);
    rect(g,53,44,53,71,K);rect(g,57,44,57,71,K);
    // board frame and pale form face
    bevel(g,0,0,71,49,K,L,M,D);
    rect(g,4,4,67,45,P);
    // header band
    rect(g,4,4,67,12,D);
    stencil(g,4+Math.round((64-stencilW('QUARANTINE'))/2),6,'QUARANTINE',P);
    // SUBJECT ..... [REDACTED]
    stencil(g,6,15,'SUBJECT',K);
    for(x=36;x<=40;x+=2)setclip(g,x,19,Q);
    rect(g,43,13,65,21,K);
    // DISPOSITION
    stencil(g,6,24,'DISPOSITION',K);
    // ... FURNACE, stamped amber and reading through the form
    rect(g,6,29,65,38,Y);
    rect(g,6,29,65,29,K);rect(g,6,38,65,38,K);
    stencil(g,6+Math.round((60-stencilW('FURNACE'))/2),31,'FURNACE',K);
    // hazard stripe along the foot of the face
    for(y=41;y<=44;y++)for(x=5;x<=66;x++)setclip(g,x,y,((x+y)%8)<4?K:Y);
    // corner bolts
    setclip(g,2,2,L);setclip(g,69,2,L);setclip(g,2,47,L);setclip(g,69,47,L);
    return toRows(g);
  }

  // =====================================================================
  // manifest 18x12: flat paper manifest sheet, a few text-line ticks
  // =====================================================================
  function makeManifest(){
    var w=18,h=12,g=mkGrid(w,h);
    var K='K',D='D',L='L',H='H';
    rect(g,1,1,16,10,L);setclip(g,1,1,K);setclip(g,16,1,K);setclip(g,1,10,K);setclip(g,16,10,K);
    rect(g,3,3,13,3,D);rect(g,3,5,13,5,D);rect(g,3,7,10,7,D);
    setclip(g,14,8,H);setclip(g,15,9,H);
    return toRows(g);
  }

  A.define('props',{
    streetLamp:{variants:[makeStreetLamp(0),makeStreetLamp(1),makeStreetLamp(2)],pal:'MAT.iron',anchor:{x:.21,y:1},note:'28x72, asymmetric cobra lamp: iron pole left (x4-7), curved arm sweeping right, long head near x21; [0] working (ember Y/W underside), [1] dead, [2] bent (arm sags, pole leans)'},
    hydrant:{rows:makeHydrant(),pal:'MAT.rust',anchor:'feet',note:'10x18, rust fire hydrant, cap and two side nozzles'},
    trafficLight:{frames:{down:[makeTrafficLight('dead'),makeTrafficLight('amber'),makeTrafficLight('red')]},pal:'MAT.iron',anchor:'feet',note:'14x60, pole + three-lamp head, frame 0 dead / 1 amber lit / 2 red lit'},
    circuitBox:{frames:{down:[makeCircuitBox(false),makeCircuitBox(true)]},pal:'MAT.iron',anchor:'feet',note:'14x22, wall-mounted circuit box, frame 0 dead lamp / 1 lit amber status lamp'},
    bench:{rows:makeBench(),pal:BENCH_PAL,anchor:'feet',note:'40x14, wood slats on iron legs'},
    benchWait:{rows:makeBenchWait(),pal:BENCHWAIT_PAL,anchor:'feet',note:'40x18, hospital plastic bench, pale seat, glass-tint backrest with a crack'},
    binSmall:{rows:makeBinSmall(),pal:'MAT.iron',anchor:'feet',note:'10x16, small iron street bin'},
    binMedical:{rows:makeBinMedical(),pal:BINMEDICAL_PAL,anchor:'feet',note:'12x18, white medical bin with a red band and hinged lid'},
    busStop:{rows:makeBusStop(),pal:BUSSTOP_PAL,anchor:'feet',note:'44x64, shelter roof, two posts, glass back panel with one cracked pane, bench inside'},
    newsBox:{rows:makeNewsBox(),pal:NEWSBOX_PAL,anchor:'feet',note:'14x20, olive news box, rust front window, coin-slot lid'},
    phoneBooth:{rows:makePhoneBooth(),pal:PHONEBOOTH_PAL,anchor:'feet',note:'20x40, iron frame, glass panel, dark phone unit inside'},
    mailbox:{rows:makeMailbox(),pal:'MAT.olive',anchor:'feet',note:'10x18, olive mailbox, rounded top, flag'},
    signEvac:{rows:makeSignEvac(),pal:'MAT.olive',anchor:'feet',note:'16x40, post + two-tone evac sign, arrow glyph in H'},
    dumpster:{variants:[makeDumpster(0),makeDumpster(1)],pal:DUMPSTER_PAL,anchor:'feet',note:'40x26, [0] olive closed, [1] rust with the lid open'},
    coneTraffic:{rows:makeCone(),pal:'MAT.ember',anchor:'feet',note:'10x14, ember traffic cone, pale reflective band, base plate'},
    trashBags:{variants:[makeTrashBags(0),makeTrashBags(1)],pal:'MAT.basalt',anchor:'feet',note:'26x14, two black bags, [1] torn open'},
    barrelRust:{variants:[makeBarrel(0),makeBarrel(1)],pal:'MAT.rust',anchor:'feet',note:'20x22, rust barrel, [0] upright, [1] dented'},
    palletStack:{rows:makePalletStack(),pal:'MAT.wood',anchor:'feet',note:'36x22, stacked wood pallets, slatted top'},
    tireStack:{rows:makeTireStack(),pal:'MAT.basalt',anchor:'feet',note:'26x22, three stacked tire rings'},
    crateStack:{rows:makeCrateStack(),pal:CRATESTACK_PAL,anchor:'feet',note:'32x28, wood crates with an olive stencil mark'},
    gurney:{rows:makeGurney(),pal:GURNEY_PAL,anchor:'feet',note:'36x22, iron frame gurney with a pale sheet'},
    ivStand:{rows:makeIvStand(),pal:IVSTAND_PAL,anchor:'feet',note:'8x40, thin iron IV stand, pale bag at the top'},
    wheelchair:{rows:makeWheelchair(),pal:'MAT.iron',anchor:'feet',note:'22x24, iron wheelchair, tipped slightly'},
    slagPile:{rows:makeSlagPile(),pal:SLAG_PAL,anchor:'feet',light:{r:44,col:'#ff7b35',a:'20'},note:'40x22, dark slag with glowing ember cracks'},
    cinderVent:{rows:makeCinderVent(),pal:CINDERVENT_PAL,anchor:'feet',note:'24x18, concrete vent stub with a glowing ember slit'},
    brokenPipe:{rows:makeBrokenPipe(),pal:'MAT.iron',anchor:'feet',note:'44x16, iron pipe run, jagged broken end, rust drip and ground stain'},
    rubbleChunk:{variants:[makeRubble(0),makeRubble(1),makeRubble(2)],pal:RUBBLE_PAL,anchor:'feet',note:'44x24, three concrete slab silhouettes with rust rebar bits'},
    debrisPile:{variants:[makeDebrisPile(0),makeDebrisPile(1),makeDebrisPile(2)],pal:DEBRISPILE_PAL,anchor:'feet',note:'80x86, three collapse piles a bulldozer clears: concrete mound, brick chunks, broken beams, rebar jutting out at several points'},
    debrisCleared:{variants:[makeDebrisCleared(0),makeDebrisCleared(1)],pal:RUBBLE_PAL,anchor:'center',note:'80x70, flat scraped ground with a dust patch and a few fragments'},
    antennaMast:{rows:makeAntennaMast(),pal:'MAT.iron',anchor:'feet',note:'12x56, thin iron lattice mast, cross braces, small dish'},
    signPlacard:{rows:makePlacard(),pal:PLACARD_PAL,anchor:'feet',note:'72x72, bolted containment placard on posts, legible 3x5 stencil, redacted subject line and an amber FURNACE stamp'},
    ambulance:{rows:makeAmbulance(),pal:AMBULANCE_PAL,anchor:'feet',note:'72x44, white box body, red stripe, dark windows, open rear doors, wheels; stands on a 72x36 collision box'},
    manifest:{rows:makeManifest(),pal:'MAT.concrete',anchor:'center',note:'18x12, flat decal, paper manifest sheet with a few text-line ticks'}
  });
})();
