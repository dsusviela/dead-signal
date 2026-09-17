// Dead Signal district-lot dressing: perimeter fencing/walls/hedges that tile
// along their run, standing lot furniture (graves, trees, yard/industrial
// gear), and flat ground decals (world.js prop()/solid()/decal() calls under
// 'lots/<name>'). One texel = one world unit (den 1). Night city, day 9 of a
// quarantine: near-black desaturated ground, muted materials, no overgrowth
// or ancient decay. Every solid mass gets a 1-texel K outline and a top-left
// bevel (light edge top+left, dark edge bottom+right, rule 27/28); ground
// decals stay minimal (their own K/D shading, no forced silhouette outline)
// like the existing tiles.js decals.
//
// Tiling: every *_h strip is 32 wide (the tiled run axis), every *_v strip is
// 32 tall (the tiled run axis). All periodic texture (mesh hatch, joints,
// canopy bumps, hazard stripes) is sampled with `local coordinate % period`
// where period divides 32, so tile N's far edge and tile N+1's near edge are
// literally the same phase of the same infinite periodic function -- true
// seamless tiling with zero special-casing at the seam. Both variants of a
// strip reuse the exact same period table for the silhouette-defining marks
// (posts, rails, joints, canopy line, stripe phase); only interior fleck/
// speckle placement differs between variants, and that speckle never touches
// the two boundary columns/rows so a mismatched variant pair still reads clean.
(function(){
  'use strict';
  var A=(typeof window!=='undefined'?window:globalThis).DSArt;
  var MAT=A.MAT,shade=A.shade;

  // ---- grid helpers (same shape as art/props.js) ----
  function mkGrid(w,h){var g=[],y,x,row;for(y=0;y<h;y++){row=[];for(x=0;x<w;x++)row.push('.');g.push(row);}return g;}
  function setclip(g,x,y,ch){if(y>=0&&y<g.length&&x>=0&&x<g[0].length)g[y][x]=ch;}
  function rect(g,x0,y0,x1,y1,ch){var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)setclip(g,x,y,ch);}
  function toRows(g){return g.map(function(r){return r.join('');});}
  function pal2(base,extra){return Object.assign({},base,extra);}
  function disc(g,cx,cy,rx,ry,ch){
    var x,y;
    for(y=-ry;y<=ry;y++)for(x=-rx;x<=rx;x++)if((x*x)/(rx*rx)+(y*y)/(ry*ry)<=1)setclip(g,cx+x,cy+y,ch);
  }
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
  function outlineFrom(g,fillLetters,K){
    var h=g.length,w=g[0].length,x,y,src=g.map(function(r){return r.slice();});
    function isFill(ch){return fillLetters.indexOf(ch)>=0;}
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      if(!isFill(src[y][x]))continue;
      if(x===0||x===w-1||y===0||y===h-1||src[y][x-1]==='.'||src[y][x+1]==='.'||src[y-1][x]==='.'||src[y+1][x]==='.')g[y][x]=K;
    }
  }
  function pmod(n,p){return((n%p)+p)%p;}
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

  // periodic diagonal crosshatch (chain-link): period-8 lattice tiles both axes
  function chainMesh(g,x0,y0,x1,y1,period,ch){
    var x,y;
    for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++){
      if(pmod(x-y,period)===0||pmod(x+y,period)===0)setclip(g,x,y,ch);
    }
  }
  // periodic diagonal hazard stripe, tiles both axes at period
  function hazardStripe(g,x0,y0,x1,y1,period,A_,B_){
    var x,y;
    for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)setclip(g,x,y,pmod(x+y,period)<period/2?A_:B_);
  }

  // ---- palettes ----
  var HEDGE={K:'#020a06',D:'#0a2013',M:'#233823',L:'#414f39',H:'#616559'}; // dead-winter clipped hedge (npm run art:ramp -- --hue 145 --l 0.13,0.5 --chroma 0.045)
  var GRAVEL_PAL={K:'#040609',D:'#121920',M:'#243037',L:'#3b474c',H:'#585f61'}; // graveyard/yard gravel (npm run art:ramp -- --hue 235 --l 0.12,0.48 --chroma 0.02)
  var HAZARD_Y='#6d4f20'; // muted faded amber (npm run art:ramp -- --hue 75 --l 0.32,0.58 --chroma 0.075 --name hazard), well below gameplay-orange saturation
  var HOARD_PAL=pal2(MAT.wood,{Y:HAZARD_Y}); // plywood hoarding, faded hazard amber
  var CRANE_PAL=pal2(MAT.concrete,{I:MAT.iron.M,J:MAT.iron.D});
  var GANTRY_PAL=pal2(MAT.iron,{C:MAT.concrete.M,E:MAT.concrete.D});
  var PIPEBANK_PAL=pal2(MAT.iron,{S:MAT.wood.M,T:MAT.wood.D});
  var CONVEYOR_PAL=pal2(MAT.iron,{B:MAT.basalt.D,C:MAT.basalt.K});
  var NOTICE_PAL=pal2(MAT.wood,{P:MAT.concrete.H,Q:MAT.concrete.M});
  var PLANTBED_PAL=pal2(MAT.wood,{G:HEDGE.M,S:HEDGE.L});
  var RUBBLE2_PAL=pal2(MAT.concrete,{B:MAT.brick.M,C:MAT.brick.L});
  var PAINT_PAL={D:MAT.asphalt.D,K:shade(MAT.ember.K,-6),Y:HAZARD_Y,W:MAT.concrete.L};
  var CHECKLIST_PAL=pal2(MAT.concrete,{C:MAT.iron.M});
  var PARKING_PAL={K:MAT.asphalt.K,D:MAT.asphalt.D,W:MAT.concrete.L};

  // =====================================================================
  // chain_h 32x16 / chain_v 8x32: chain-link mesh, iron post at x=0 (h) /
  // a top rail bar repeating every tile (v). period-8 diagonal lattice.
  // =====================================================================
  function makeChainH(variant){
    var w=32,h=16,g=mkGrid(w,h);
    rect(g,0,1,31,2,'D');rect(g,0,0,31,0,'K'); // top rail
    chainMesh(g,3,3,31,14,8,'M');
    rect(g,0,15,31,15,'K'); // ground contact
    rect(g,0,0,2,15,'D');rect(g,0,0,0,15,'K');rect(g,2,0,2,15,'K'); // post
    if(variant===1){rect(g,17,7,19,9,'.');} // a small tear in the mesh, away from both edges
    return toRows(g);
  }
  function makeChainV(variant){
    var w=8,h=32,g=mkGrid(w,h);
    rect(g,1,0,2,31,'D');rect(g,0,0,0,31,'K');rect(g,3,0,3,31,'K'); // rail post running the length
    chainMesh(g,4,0,7,31,8,'M');
    if(variant===1){rect(g,5,14,6,16,'.');}
    return toRows(g);
  }

  // =====================================================================
  // hedge_h 32x22 / hedge_v 16x32: clipped dark hedge, period-8 wavy canopy
  // line shared by both variants; interior fleck differs.
  // =====================================================================
  var HEDGE_BUMP=[0,1,2,1,0,1,2,1];
  function makeHedgeH(variant){
    var w=32,h=22,g=mkGrid(w,h),rng=mulberry32(variant===0?77:78),x,y,top;
    for(x=0;x<w;x++){
      top=3+HEDGE_BUMP[x%8];
      rect(g,x,top,x,21,'M');
      setclip(g,x,top,'L');
    }
    rect(g,0,20,31,21,'D'); // ground shadow band
    outlineFrom(g,['M','L','D'],'K');
    for(x=2;x<30;x++){ // interior flecks only, never on the boundary columns
      if(rng()<0.22)setclip(g,x,6+Math.floor(rng()*10),'H');
    }
    return toRows(g);
  }
  function makeHedgeV(variant){
    var w=16,h=32,g=mkGrid(w,h),rng=mulberry32(variant===0?79:80),x,y,inL,inR;
    for(y=0;y<h;y++){
      inL=2+HEDGE_BUMP[y%8];inR=2+HEDGE_BUMP[(y+4)%8];
      rect(g,inL,y,w-1-inR,y,'M');
      setclip(g,inL,y,'L');
    }
    outlineFrom(g,['M','L'],'K');
    for(y=2;y<30;y++){
      if(rng()<0.22)setclip(g,4+Math.floor(rng()*8),y,'H');
    }
    return toRows(g);
  }

  // =====================================================================
  // stone_h 32x14 / stone_v 12x32: low cemetery stone wall with a lit cap,
  // period-8 mortar joints shared by both variants.
  // =====================================================================
  function makeStoneH(variant){
    var w=32,h=14,g=mkGrid(w,h),rng=mulberry32(variant===0?61:62),x;
    bevel(g,0,2,31,13,'K','L','M','D');
    for(x=0;x<w;x+=8)rect(g,x,3,x,12,'K');
    rect(g,0,0,31,1,'L');rect(g,0,0,31,0,'H'); // coping cap
    for(x=1;x<31;x++)if(rng()<0.15)setclip(g,x,9+Math.floor(rng()*3),'D');
    return toRows(g);
  }
  function makeStoneV(variant){
    var w=12,h=32,g=mkGrid(w,h),rng=mulberry32(variant===0?63:64),y;
    bevel(g,3,0,11,31,'K','L','M','D');
    for(y=0;y<h;y+=8)rect(g,4,y,11,y,'K');
    rect(g,0,0,2,31,'H');rect(g,0,0,1,31,'L'); // coping cap running the length
    for(y=1;y<31;y++)if(rng()<0.15)setclip(g,6+Math.floor(rng()*4),y,'D');
    return toRows(g);
  }

  // =====================================================================
  // hoarding_h 32x22 / hoarding_v 10x32: plywood construction hoarding,
  // faded hazard band. Board seams every 8, stripe period 8 (both axes).
  // =====================================================================
  function makeHoardingH(variant){
    var w=32,h=22,g=mkGrid(w,h),rng=mulberry32(variant===0?65:66),x;
    bevel(g,0,0,31,17,'K','L','M','D');
    for(x=8;x<32;x+=8)rect(g,x,1,x,16,'K');
    hazardStripe(g,0,18,31,21,8,'Y','K');
    rect(g,0,17,31,17,'K');rect(g,0,18,31,18,'K');rect(g,0,21,31,21,'K');
    for(x=2;x<30;x++)if(rng()<0.1)setclip(g,x,3+Math.floor(rng()*10),'D');
    return toRows(g);
  }
  function makeHoardingV(variant){
    var w=10,h=32,g=mkGrid(w,h),rng=mulberry32(variant===0?67:68),y;
    bevel(g,3,0,9,31,'K','L','M','D');
    for(y=8;y<32;y+=8)rect(g,4,y,9,y,'K');
    hazardStripe(g,0,0,2,31,8,'Y','K');
    rect(g,3,0,3,31,'K');rect(g,2,0,2,31,'K');
    for(y=2;y<30;y++)if(rng()<0.1)setclip(g,4+Math.floor(rng()*5),y,'D');
    return toRows(g);
  }

  // =====================================================================
  // grave 16x18 x3: headstone shapes -- rounded, cross, squat block
  // =====================================================================
  function makeGrave(variant){
    var w=16,h=18,g=mkGrid(w,h);
    rect(g,3,14,12,17,'D');rect(g,3,14,12,14,'K');rect(g,3,17,12,17,'K');rect(g,3,14,3,17,'K');rect(g,12,14,12,17,'K'); // plinth
    if(variant===0){ // rounded top
      disc(g,7,7,4,7,'M');
      rect(g,4,7,10,13,'M');
      outlineFrom(g,['M'],'K');
      setclip(g,5,4,'L');setclip(g,6,3,'L');
    }else if(variant===1){ // cross
      rect(g,6,1,9,13,'M');
      rect(g,3,5,12,8,'M');
      outlineFrom(g,['M'],'K');
      setclip(g,7,2,'L');setclip(g,8,2,'L');
    }else{ // squat block, chamfered top corners
      rect(g,3,4,12,13,'M');
      setclip(g,3,4,'.');setclip(g,12,4,'.');
      outlineFrom(g,['M'],'K');
      rect(g,4,5,11,5,'L');
    }
    return toRows(g);
  }

  // continuous 1px line (Bresenham), so bare branches never gap into dots
  function line(g,x0,y0,x1,y1,ch){
    x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
    var dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy,e2;
    for(;;){
      setclip(g,x0,y0,ch);
      if(x0===x1&&y0===y1)break;
      e2=2*err;
      if(e2>=dy){err+=dy;x0+=sx;}
      if(e2<=dx){err+=dx;y0+=sy;}
    }
  }

  // =====================================================================
  // tree 48x56: bare late-winter city tree, canopy over an 18-wide trunk base
  // =====================================================================
  function makeTree(){
    var w=48,h=56,g=mkGrid(w,h);
    rect(g,15,48,32,55,'D'); // flared base, 18 wide
    rect(g,19,40,28,47,'D'); // lower trunk
    rect(g,21,30,26,39,'D'); // mid trunk
    rect(g,22,22,25,29,'D'); // stem into the canopy
    var limbs=[ // primary limbs off the stem top, drawn 2px thick
      [23,23,14,10],[24,23,33,9],[23,22,19,6],[24,22,29,4]
    ];
    limbs.forEach(function(b){line(g,b[0],b[1],b[2],b[3],'D');line(g,b[0]+1,b[1],b[2]+1,b[3],'D');});
    var twigs=[ // secondary twigs off each limb tip, 1px
      [14,10,8,4],[14,10,10,2],[14,10,18,3],
      [33,9,40,4],[33,9,37,2],[33,9,29,10],
      [19,6,15,1],[19,6,22,1],
      [29,4,33,1],[29,4,26,0],
      [24,23,24,15],[24,15,20,11],[24,15,28,12]
    ];
    twigs.forEach(function(b){line(g,b[0],b[1],b[2],b[3],'M');});
    outlineFrom(g,['D','M'],'K');
    setclip(g,20,49,'L');setclip(g,21,49,'L');
    return toRows(g);
  }

  // =====================================================================
  // lightPole 12x72: straight parking-lot light, head at top
  // =====================================================================
  function makeLightPole(){
    var w=12,h=72,g=mkGrid(w,h);
    bevel(g,2,68,9,71,'K','M','D','K'); // base plate
    rect(g,5,8,6,67,'D');setclip(g,5,8,'K');setclip(g,6,67,'K');
    rect(g,4,9,4,66,'L');
    bevel(g,1,0,10,7,'K','L','M','D'); // head
    setclip(g,3,1,'H');setclip(g,4,1,'H');
    return toRows(g);
  }

  // =====================================================================
  // utilityBox 24x22: iron cabinet, seam and vent slats
  // =====================================================================
  function makeUtilityBox(){
    var w=24,h=22,g=mkGrid(w,h);
    bevel(g,1,2,22,21,'K','L','M','D');
    rect(g,11,3,12,20,'D');
    var y;for(y=6;y<18;y+=3)rect(g,3,y,9,y,'D');
    setclip(g,3,3,'H');
    return toRows(g);
  }

  // =====================================================================
  // spoilHeap 60x34: mounded excavated dirt
  // =====================================================================
  function makeSpoilHeap(){
    var w=60,h=34,g=mkGrid(w,h),rng=mulberry32(91),x;
    disc(g,30,30,29,10,'D');disc(g,24,25,18,7,'M');disc(g,32,20,10,4,'L');
    outlineFrom(g,['D','M','L'],'K');
    for(x=6;x<54;x++)if(rng()<0.2)setclip(g,x,26+Math.floor(rng()*6),'K');
    return toRows(g);
  }

  // =====================================================================
  // conveyor 90x26: belt on legs, roller drums at each end
  // =====================================================================
  function makeConveyor(){
    var w=90,h=26,g=mkGrid(w,h),x;
    for(x=8;x<82;x+=20){rect(g,x,14,x+3,25,'M');setclip(g,x,14,'K');setclip(g,x+3,25,'K');setclip(g,x,25,'K');setclip(g,x+3,14,'K');}
    bevel(g,2,4,87,13,'K','L','M','D');
    rect(g,2,9,87,9,'B');rect(g,2,10,87,10,'C');
    disc(g,6,8,5,5,'K');disc(g,6,8,3,3,'D');
    disc(g,83,8,5,5,'K');disc(g,83,8,3,3,'D');
    return toRows(g);
  }

  // =====================================================================
  // craneBase 40x48: concrete footing block, steel stub rising from it
  // =====================================================================
  function makeCraneBase(){
    var w=40,h=48,g=mkGrid(w,h);
    bevel(g,1,32,38,47,'K','L','M','D');
    bevel(g,14,4,25,32,'K','I','I','J');
    setclip(g,16,6,'H');
    var y;for(y=32;y<47;y+=5)rect(g,3,y,36,y,'D');
    return toRows(g);
  }

  // =====================================================================
  // gantryLeg 20x56: tall steel leg on a concrete plinth
  // =====================================================================
  function makeGantryLeg(){
    var w=20,h=56,g=mkGrid(w,h);
    bevel(g,1,44,18,55,'K','C','C','E');
    bevel(g,6,2,13,44,'K','L','M','D');
    var y;for(y=6;y<44;y+=10)rect(g,6,y,13,y,'K');
    setclip(g,7,3,'H');
    return toRows(g);
  }

  // =====================================================================
  // pipeBank 90x28: stacked pipes on wood sleepers
  // =====================================================================
  function makePipeBank(){
    var w=90,h=28,g=mkGrid(w,h),x;
    for(x=4;x<86;x+=14)rect(g,x,20,x+3,25,'S');
    for(x=4;x<86;x+=14){setclip(g,x,20,'T');setclip(g,x+3,25,'T');}
    disc(g,45,15,8,8,'D');disc(g,45,15,6,6,'M');
    disc(g,45,6,7,7,'D');disc(g,45,6,5,5,'M');
    outlineFrom(g,['D','M'],'K');
    [10,25,40,55,70].forEach(function(cx){
      disc(g,cx,15,7,7,'D');disc(g,cx,15,5,5,'M');
      disc(g,cx,6,6,6,'D');disc(g,cx,6,4,4,'M');
    });
    outlineFrom(g,['D','M'],'K');
    setclip(g,42,3,'L');setclip(g,42,12,'L');
    return toRows(g);
  }

  // =====================================================================
  // noticeBoard 22x28: wood frame, pale pinned notices
  // =====================================================================
  function makeNoticeBoard(){
    var w=22,h=28,g=mkGrid(w,h);
    bevel(g,4,22,9,27,'K','M','D','K');
    bevel(g,12,22,17,27,'K','M','D','K');
    bevel(g,0,0,21,21,'K','L','M','D');
    rect(g,3,3,18,18,'P');setclip(g,3,3,'K');setclip(g,18,3,'K');setclip(g,3,18,'K');setclip(g,18,18,'K');
    rect(g,5,6,10,10,'Q');rect(g,12,12,17,16,'Q');
    return toRows(g);
  }

  // =====================================================================
  // hoardingSign 30x26: sign board on two stakes
  // =====================================================================
  function makeHoardingSign(){
    var w=30,h=26,g=mkGrid(w,h);
    rect(g,5,16,7,25,'D');setclip(g,5,16,'K');setclip(g,7,25,'K');
    rect(g,22,16,24,25,'D');setclip(g,22,16,'K');setclip(g,24,25,'K');
    bevel(g,1,0,28,17,'K','L','M','D');
    hazardStripe(g,1,14,28,16,8,'Y','K');
    return toRows(g);
  }

  // =====================================================================
  // graveFlat 16x10 x2: flush ground marker (decal)
  // =====================================================================
  function makeGraveFlat(variant){
    var w=16,h=10,g=mkGrid(w,h);
    rect(g,1,1,14,8,'M');
    rect(g,1,1,14,1,'L');rect(g,1,8,14,8,'D');rect(g,1,1,1,8,'K');rect(g,14,1,14,8,'K');
    if(variant===1){rect(g,7,3,8,6,'D');rect(g,5,4,10,5,'D');}
    return toRows(g);
  }

  // =====================================================================
  // plantingBed 48x32 x2: tended bed, bare soil + low shrubs (decal)
  // =====================================================================
  function makePlantingBed(variant){
    var w=48,h=32,g=mkGrid(w,h),rng=mulberry32(variant===0?95:96),x;
    rect(g,2,2,45,29,'D');
    rect(g,2,2,45,2,'M');rect(g,2,29,45,29,'K');rect(g,2,2,2,29,'K');rect(g,45,2,45,29,'K');
    for(x=6;x<44;x+=9){
      disc(g,x,10,4,3,'G');disc(g,x,10,2,1,'S');
    }
    for(x=0;x<42;x++)if(rng()<0.1)setclip(g,3+x,18+Math.floor(rng()*9),'K');
    return toRows(g);
  }

  // =====================================================================
  // pathCross 64x64: gravel path junction (decal, cross of gravel over transparent)
  // =====================================================================
  function makePathCross(){
    var w=64,h=64,g=mkGrid(w,h),rng=mulberry32(97),x,y;
    rect(g,0,24,63,39,'M');rect(g,24,0,39,63,'M');
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      if(g[y][x]!=='M')continue;
      if(rng()<0.12)g[y][x]='D';else if(rng()<0.06)g[y][x]='L';
    }
    rect(g,0,24,63,24,'D');rect(g,0,39,63,39,'D');rect(g,24,0,24,63,'D');rect(g,39,0,39,63,'D');
    return toRows(g);
  }

  // =====================================================================
  // pathGravel 48x48: worn gravel yard patch (decal, blob fading to edges)
  // =====================================================================
  function makePathGravel(){
    var w=48,h=48,g=mkGrid(w,h),rng=mulberry32(98);
    disc(g,24,24,22,20,'M');
    var x,y,d;
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      if(g[y][x]!=='M')continue;
      d=Math.sqrt((x-24)*(x-24)+(y-24)*(y-24))/22;
      if(rng()<d*0.6)g[y][x]='.';
      else if(rng()<0.12)g[y][x]='D';
      else if(rng()<0.06)g[y][x]='L';
    }
    return toRows(g);
  }

  // =====================================================================
  // parkingLine_v 4x60: worn white paint stripe (decal)
  // =====================================================================
  function makeParkingLineV(){
    var w=4,h=60,g=mkGrid(w,h),rng=mulberry32(99),y;
    for(y=2;y<58;y++)if(rng()<0.85){setclip(g,1,y,'W');setclip(g,2,y,'W');}
    for(y=0;y<h;y++)if(rng()<0.08)setclip(g,rng()<0.5?1:2,y,'D');
    return toRows(g);
  }

  // =====================================================================
  // trolley 20x16: tipped shopping trolley, thin iron wireframe (decal)
  // =====================================================================
  function makeTrolley(){
    var w=20,h=16,g=mkGrid(w,h);
    rect(g,2,4,16,4,'M');rect(g,2,4,2,11,'M');rect(g,16,4,16,10,'M');
    rect(g,2,11,10,11,'M');
    rect(g,3,5,15,10,'.'); // basket interior stays open (wire mesh, not filled)
    var x;for(x=4;x<16;x+=3)rect(g,x,5,x,9,'M');
    disc(g,15,13,2,2,'D');disc(g,7,12,2,2,'D');
    outlineFrom(g,['M','D'],'K');
    return toRows(g);
  }

  // =====================================================================
  // padMarking 90x120: painted machine pad outline, hazard corners (decal,
  // mostly transparent inside)
  // =====================================================================
  function makePadMarking(){
    var w=90,h=120,g=mkGrid(w,h),cs=18,x,y;
    rect(g,4,4,85,4,'W');rect(g,4,115,85,115,'W');rect(g,4,4,4,115,'W');rect(g,85,4,85,115,'W');
    var corners=[[4,4],[85-cs,4],[4,115-cs],[85-cs,115-cs]];
    corners.forEach(function(c){
      for(y=0;y<cs;y++)for(x=0;x<cs;x++)setclip(g,c[0]+x,c[1]+y,pmod(x+y,8)<4?'Y':'K');
    });
    return toRows(g);
  }

  // =====================================================================
  // hazardPaint 64x40: painted hazard stripe patch (decal)
  // =====================================================================
  function makeHazardPaint(){
    var w=64,h=40,g=mkGrid(w,h);
    hazardStripe(g,2,2,61,37,8,'Y','K');
    rect(g,2,2,61,2,'D');rect(g,2,37,61,37,'D');rect(g,2,2,2,37,'D');rect(g,61,2,61,37,'D');
    return toRows(g);
  }

  // =====================================================================
  // refugeNotice 14x18 / shutdownChecklist 14x18: dropped paper sheets (decal)
  // =====================================================================
  function makeRefugeNotice(){
    var w=14,h=18,g=mkGrid(w,h);
    rect(g,1,1,12,16,'H');
    rect(g,1,1,12,1,'K');rect(g,1,16,12,16,'K');rect(g,1,1,1,16,'K');rect(g,12,1,12,16,'K');
    var y;for(y=4;y<14;y+=3)rect(g,3,y,10,y,'M');
    return toRows(g);
  }
  function makeShutdownChecklist(){
    var w=14,h=18,g=mkGrid(w,h);
    rect(g,1,2,12,17,'H');
    rect(g,1,2,12,2,'K');rect(g,1,17,12,17,'K');rect(g,1,2,1,17,'K');rect(g,12,2,12,17,'K');
    rect(g,5,0,8,2,'C');
    var y;for(y=5;y<15;y+=2){rect(g,3,y,3,y,'K');rect(g,5,y,10,y,'M');}
    return toRows(g);
  }

  // =====================================================================
  // dispositionBoard 26x30: board with pinned forms (decal, flat/leaning)
  // =====================================================================
  function makeDispositionBoard(){
    var w=26,h=30,g=mkGrid(w,h);
    bevel(g,1,1,24,28,'K','L','M','D');
    rect(g,4,4,12,12,'P');setclip(g,4,4,'K');setclip(g,12,12,'K');
    rect(g,14,6,22,15,'P');setclip(g,14,6,'K');setclip(g,22,15,'K');
    rect(g,6,16,16,25,'P');setclip(g,6,16,'K');setclip(g,16,25,'K');
    var y;for(y=6;y<11;y+=2)rect(g,5,y,11,y,'Q');
    return toRows(g);
  }

  // =====================================================================
  // rubbleSpill 40x18 x2: fresh brick/plaster spill (decal)
  // =====================================================================
  function makeRubbleSpill(variant){
    var w=40,h=18,g=mkGrid(w,h),rng=mulberry32(variant===0?85:86),x,y,d,cx=variant===0?16:24;
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      d=Math.sqrt(((x-cx)/18)*((x-cx)/18)+((y-10)/7)*((y-10)/7));
      if(d<1&&rng()<(1-d)*0.9)g[y][x]=rng()<0.3?'B':(rng()<0.5?'C':'D');
    }
    return toRows(g);
  }

  A.define('lots',{
    chain_h:{variants:[makeChainH(0),makeChainH(1)],pal:'MAT.iron',anchor:{x:0,y:1},note:'32x16 chain-link mesh, period-8 lattice, iron post at x0-2; tiles left-right, [1] has a small tear'},
    chain_v:{variants:[makeChainV(0),makeChainV(1)],pal:'MAT.iron',anchor:{x:.5,y:0},note:'8x32 chain-link mesh with a running rail post at x1-3; tiles top-bottom, [1] has a small tear'},
    hedge_h:{variants:[makeHedgeH(0),makeHedgeH(1)],pal:HEDGE,anchor:{x:0,y:1},note:'32x22 clipped dark hedge, period-8 wavy canopy line shared by both variants; tiles left-right'},
    hedge_v:{variants:[makeHedgeV(0),makeHedgeV(1)],pal:HEDGE,anchor:{x:.5,y:0},note:'16x32 clipped dark hedge, period-8 canopy bumps on both long edges; tiles top-bottom'},
    stone_h:{variants:[makeStoneH(0),makeStoneH(1)],pal:'MAT.grave',anchor:{x:0,y:1},note:'32x14 low cemetery stone wall, lit coping cap, period-8 mortar joints; tiles left-right'},
    stone_v:{variants:[makeStoneV(0),makeStoneV(1)],pal:'MAT.grave',anchor:{x:.5,y:0},note:'12x32 low cemetery stone wall, lit coping cap running the length, period-8 joints; tiles top-bottom'},
    hoarding_h:{variants:[makeHoardingH(0),makeHoardingH(1)],pal:HOARD_PAL,anchor:{x:0,y:1},note:'32x22 plywood construction hoarding, board seams every 8, faded hazard band at the foot; tiles left-right'},
    hoarding_v:{variants:[makeHoardingV(0),makeHoardingV(1)],pal:HOARD_PAL,anchor:{x:.5,y:0},note:'10x32 plywood construction hoarding, faded hazard band down one edge; tiles top-bottom'},
    grave:{variants:[makeGrave(0),makeGrave(1),makeGrave(2)],pal:'MAT.grave',anchor:'feet',note:'16x18 headstone on a plinth, [0] rounded, [1] cross, [2] squat block'},
    tree:{rows:makeTree(),pal:'MAT.wood',anchor:'feet',note:'48x56 bare late-winter city tree, canopy over an 18-wide trunk base'},
    lightPole:{rows:makeLightPole(),pal:'MAT.iron',anchor:'feet',note:'12x72 straight parking-lot light pole, boxy head at top'},
    utilityBox:{rows:makeUtilityBox(),pal:'MAT.iron',anchor:'feet',note:'24x22 iron utility cabinet, seam and vent slats'},
    spoilHeap:{rows:makeSpoilHeap(),pal:'MAT.wood',anchor:'feet',note:'60x34 mounded excavated dirt spoil heap'},
    conveyor:{rows:makeConveyor(),pal:CONVEYOR_PAL,anchor:'feet',note:'90x26 belt conveyor on legs, roller drums at each end'},
    craneBase:{rows:makeCraneBase(),pal:CRANE_PAL,anchor:'feet',note:'40x48 concrete footing with a steel stub rising from it'},
    gantryLeg:{rows:makeGantryLeg(),pal:GANTRY_PAL,anchor:'feet',note:'20x56 steel gantry leg on a concrete plinth'},
    pipeBank:{rows:makePipeBank(),pal:PIPEBANK_PAL,anchor:'feet',note:'90x28 stacked iron pipes on wood sleepers'},
    noticeBoard:{rows:makeNoticeBoard(),pal:NOTICE_PAL,anchor:'feet',note:'22x28 wood-framed notice board, pale pinned notices'},
    hoardingSign:{rows:makeHoardingSign(),pal:HOARD_PAL,anchor:'feet',note:'30x26 hazard-striped sign board on two stakes'},
    graveFlat:{variants:[makeGraveFlat(0),makeGraveFlat(1)],pal:'MAT.grave',anchor:'center',note:'16x10 flush ground grave marker, [1] carved'},
    plantingBed:{variants:[makePlantingBed(0),makePlantingBed(1)],pal:PLANTBED_PAL,anchor:'center',note:'48x32 tended planting bed, bare soil border, low shrub clusters'},
    pathCross:{rows:makePathCross(),pal:GRAVEL_PAL,anchor:'center',note:'64x64 gravel path junction, cross-shaped, transparent corners'},
    pathGravel:{rows:makePathGravel(),pal:GRAVEL_PAL,anchor:'center',note:'48x48 worn gravel yard patch, fades to transparent at the edge'},
    parkingLine_v:{rows:makeParkingLineV(),pal:PARKING_PAL,anchor:'center',note:'4x60 worn white paint stripe, scuffed'},
    trolley:{rows:makeTrolley(),pal:'MAT.iron',anchor:'center',note:'20x16 tipped shopping trolley, wire basket'},
    padMarking:{rows:makePadMarking(),pal:PAINT_PAL,anchor:'center',note:'90x120 painted machine pad outline, hazard-striped corners, mostly transparent inside'},
    hazardPaint:{rows:makeHazardPaint(),pal:PAINT_PAL,anchor:'center',note:'64x40 painted hazard stripe patch'},
    refugeNotice:{rows:makeRefugeNotice(),pal:'MAT.concrete',anchor:'center',note:'14x18 dropped paper notice sheet'},
    shutdownChecklist:{rows:makeShutdownChecklist(),pal:CHECKLIST_PAL,anchor:'center',note:'14x18 dropped clipboard with a checklist'},
    dispositionBoard:{rows:makeDispositionBoard(),pal:NOTICE_PAL,anchor:'center',note:'26x30 board with pinned disposition forms'},
    rubbleSpill:{variants:[makeRubbleSpill(0),makeRubbleSpill(1)],pal:RUBBLE2_PAL,anchor:'center',note:'40x18 fresh brick and plaster spill'}
  });
})();
