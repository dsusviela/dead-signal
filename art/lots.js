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
  var GRAVEL_PAL={K:'#17140f',D:'#2f2a22',M:'#453e33',L:'#5a5244',H:'#776d5b'}; // warm park gravel, beige-grey (npm run art:ramp -- --hue 75 --l 0.17,0.52 --chroma 0.025); never slate blue, so paths do not read as water at night
  var HAZARD_Y='#6d4f20'; // muted faded amber (npm run art:ramp -- --hue 75 --l 0.32,0.58 --chroma 0.075 --name hazard), well below gameplay-orange saturation
  var HOARD_PAL=pal2(MAT.wood,{Y:HAZARD_Y}); // plywood hoarding, faded hazard amber
  var CRANE_PAL=pal2(MAT.concrete,{I:MAT.iron.M,J:MAT.iron.D});
  var GANTRY_PAL=pal2(MAT.iron,{C:MAT.concrete.M,E:MAT.concrete.D});
  var PIPEBANK_PAL=pal2(MAT.iron,{S:MAT.wood.M,T:MAT.wood.D});
  var CONVEYOR_PAL=pal2(MAT.iron,{B:MAT.basalt.D,C:MAT.basalt.K});
  var NOTICE_PAL=pal2(MAT.wood,{P:MAT.concrete.H,Q:MAT.concrete.M});
  var NOTICEB_PAL=pal2(MAT.wood,{C:shade(MAT.concrete.D,-4),P:MAT.concrete.L,Q:MAT.concrete.M,O:MAT.concrete.D,B:MAT.iron.M});
  var GRAVESTONE={K:'#05070c',D:'#222532',M:'#474758',L:'#706d7c',H:'#9a969e',S:'#0a0f0a'}; // npm run art:ramp -- --hue 285 --l 0.13,0.68 --chroma 0.028 (weathered grey stone, faint violet; S = grass contact shadow)
  var SOIL={K:'#0a0404',D:'#1e100a',M:'#2f2016',L:'#3f3327',H:'#4c4740'};   // npm run art:ramp -- --hue 55 --l 0.12,0.4 --chroma 0.03
  var SHRUB={K:'#061008',D:'#142512',M:'#2d3b1e',L:'#494f34',H:'#646456'};  // npm run art:ramp -- --hue 130 --l 0.16,0.5 --chroma 0.05 (sits above the grass tone)
  var BARK={K:'#120b09',D:'#2b1d15',M:'#413226',L:'#554a3d',H:'#67635b'};   // npm run art:ramp -- --hue 60 --l 0.16,0.5 --chroma 0.03 (grey-brown, not plank red)
  var TREE_PAL=pal2(BARK,{S:SOIL.D,T:SOIL.M,P:MAT.wood.D,Q:MAT.wood.M});
  var PLANTBED_PAL={K:SHRUB.K,D:SHRUB.D,M:SHRUB.M,L:SHRUB.L,H:SHRUB.H,E:MAT.concrete.D,F:MAT.concrete.M,J:MAT.concrete.K,S:SOIL.D,T:SOIL.M,P:MAT.concrete.L,Q:MAT.concrete.M};
  var PATH_PAL=pal2(GRAVEL_PAL,{G:'#2c3524',F:'#3a4430'}); // G/F grass blades growing over the gravel edge (a step above tiles/grass)
  var BENCHV_PAL={K:'#1a0e0b',D:'#3f2a22',M:'#62463a',L:'#80655a',I:MAT.iron.L,J:MAT.iron.M,S:'#0d100b'}; // weathered slats (MAT.wood hue, less chroma), iron frames; S = shadow on grass
  var WORN_PAL={T:'#342c22',U:'#443a2d',G:'#2b3124'}; // trodden soil a step above the lawn, G = surviving grass tufts
  var RUBBLE2_PAL=pal2(MAT.concrete,{B:MAT.brick.M,C:MAT.brick.L}); // K/D/M/L concrete: dust, plaster; B/C brick
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
    var w=16,h=18,g=mkGrid(w,h),x,y;
    // contact shadow on the grass, plinth, then the stone
    rect(g,2,17,14,17,'S');
    rect(g,3,14,12,16,'D');rect(g,3,14,12,14,'M');rect(g,2,14,2,16,'K');rect(g,13,14,13,16,'K');rect(g,2,17,13,17,'K');
    var t=mkGrid(w,h);
    if(variant===0){disc(t,7,6,4,4,'M');rect(t,3,6,11,13,'M');}
    else if(variant===1){rect(t,6,1,9,13,'M');rect(t,3,4,12,7,'M');}
    else{rect(t,3,4,12,13,'M');setclip(t,3,4,'.');setclip(t,12,4,'.');}
    var src=t.map(function(r){return r.slice();});
    function e(a,b){return !(src[b]&&src[b][a]==='M');}
    for(y=0;y<h;y++)for(x=0;x<w;x++){if(src[y][x]!=='M')continue;
      if(e(x-1,y)||e(x+1,y)||e(x,y-1)||e(x,y+1))t[y][x]='K';
      else if(e(x-1,y-1)||e(x,y-2)||e(x-2,y))t[y][x]='L';
      else if(e(x+2,y)||e(x+1,y+1))t[y][x]='D';}
    for(y=0;y<14;y++)for(x=0;x<w;x++)if(t[y][x]!=='.')g[y][x]=t[y][x];
    // engraved lines on the face
    if(variant===0){rect(g,5,8,9,8,'D');rect(g,6,10,8,10,'D');}
    if(variant===2){rect(g,5,7,10,7,'D');rect(g,5,9,9,9,'D');setclip(g,6,5,'H');setclip(g,7,5,'H');}
    if(variant===1){setclip(g,7,2,'H');}
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
  // tree 48x56 x3: bare late-winter city tree (anchor feet = trunk base).
  // Tapered trunk with a lit left flank and root flare on a dark soil pit, so
  // the sprite visibly stands on the ground; a sparse branch crown (1-2 px
  // limbs, no leaf mass) so paths and players stay readable through it.
  // [0] broad mature crown; [1] crown leaning right; [2] young staked tree
  // =====================================================================
  function makeTree(variant){
    var w=48,h=56,g=mkGrid(w,h),rng=mulberry32(700+variant),x,y;
    var young=variant===2;
    // soil pit / root contact ellipse (drawn first, trunk over it)
    for(y=-3;y<=3;y++)for(x=-11;x<=11;x++)if((x*x)/121+(y*y)/9<=1)setclip(g,24+x,51+y,'S');
    for(x=-8;x<=10;x++){var d=Math.abs(x)<5?1:0;if(d||pmod(x,3)===0)setclip(g,24+x,53+(Math.abs(x)>6?0:1),'T');}
    rect(g,14,48,15,48,'T');rect(g,32,49,33,49,'T');
    // limbs first (behind the trunk top), then twigs, then trunk
    var crownTop=young?12:1,base=young?32:30,lean=variant===1?5:0;
    var segs=[];
    function branch(x0,y0,ang,len,th,depth){
      var x1=x0+Math.cos(ang)*len,y1=y0+Math.sin(ang)*len,k=1;
      // stay inside the canvas by shortening the limb (never clamping one
      // axis, which would draw flat lines along the crown edge)
      if(y1<crownTop)k=Math.min(k,(y0-crownTop)/(y0-y1));
      if(x1<2)k=Math.min(k,(x0-2)/(x0-x1));
      if(x1>45)k=Math.min(k,(45-x0)/(x1-x0));
      x1=x0+(x1-x0)*k;y1=y0+(y1-y0)*k;
      segs.push([x0,y0,x1,y1,th]);
      if(depth<=0||k<.6)return;
      var n=depth>=2?2:(rng()<.5?2:1),spread=.3+rng()*.18;
      branch(x1,y1,ang-spread+(rng()-.5)*.2,len*(.7+rng()*.1),Math.max(1,th-1),depth-1);
      if(n>1)branch(x1,y1,ang+spread+(rng()-.5)*.2,len*(.64+rng()*.1),Math.max(1,th-1),depth-1);
    }
    var up=-Math.PI/2;
    if(young){
      branch(24,base,up-.35,9,2,2);branch(24,base,up+.4,8,2,2);branch(24,base-2,up+.05,9,1,2);
    }else{
      branch(24+lean*.3,base,up-.55,11,3,3);
      branch(24+lean*.3,base,up+.5+lean*.03,11.5,3,3);
      branch(24+lean*.3,base-2,up-.04+lean*.02,10,2,3);
    }
    // thin twigs (1px, D) first, heavier limbs (2-3px, M with L/D sides) over them
    segs.filter(function(q){return q[4]===1;}).forEach(function(q){line(g,q[0],q[1],q[2],q[3],'M');});
    segs.filter(function(q){return q[4]>1;}).forEach(function(q){
      line(g,q[0],q[1],q[2],q[3],'M');line(g,q[0]+1,q[1],q[2]+1,q[3],'D');
      if(q[4]>2)line(g,q[0]-1,q[1],q[2]-1,q[3],'L');
    });
    // twig tips catch a little light
    segs.filter(function(q){return q[4]===1;}).forEach(function(q){
      var tx=Math.round(q[2]),ty=Math.round(q[3]);if(g[ty]&&g[ty][tx]==='M'&&rng()<.5){setclip(g,tx,ty,'L');}
    });
    // trunk: width tapers from the flare to the crotch, slight lean in [1]
    var yTop=base,yBot=51,wBot=young?4:8,wTop=young?2:4;
    for(y=yTop;y<=yBot;y++){
      var t=(y-yTop)/(yBot-yTop),ww=Math.round(wTop+(wBot-wTop)*t*t),cx=24+Math.round(lean*.3*(1-t));
      var x0=cx-Math.floor(ww/2),x1=x0+ww-1;
      rect(g,x0,y,x1,y,'M');
      setclip(g,x0,y,'L');
      if(ww>=4)setclip(g,x1-1,y,'D');
      setclip(g,x1,y,'K');
      if(ww>=5)setclip(g,x0-1,y,'K');
    }
    if(!young){
      // root flare knuckles into the soil
      rect(g,17,50,19,51,'M');setclip(g,17,50,'L');rect(g,16,51,16,51,'K');rect(g,17,52,19,52,'K');
      rect(g,28,50,31,51,'D');rect(g,32,51,32,51,'K');rect(g,28,52,31,52,'K');
      rect(g,20,52,27,52,'K');                        // contact shadow line at the base
      // bark fissures
      [[23,36],[25,41],[22,45]].forEach(function(b){setclip(g,b[0],b[1],'D');setclip(g,b[0],b[1]+1,'D');setclip(g,b[0],b[1]+2,'D');});
    }else{
      rect(g,22,52,26,52,'K');
      // timber stake and a rubber tie
      rect(g,28,30,29,51,'P');rect(g,28,30,28,51,'Q');rect(g,30,31,30,52,'K');rect(g,28,52,30,52,'K');rect(g,28,29,29,29,'K');
      rect(g,25,37,27,37,'K');
    }
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
  // noticeBoard 22x28: park/municipal notice board on two posts, small
  // pitched cap, dark cork face, a few pinned sheets (muted paper, one
  // council header, one torn) -- quieter than pickups
  // =====================================================================
  function makeNoticeBoard(){
    var w=22,h=28,g=mkGrid(w,h);
    // posts, grounded with a contact shadow
    rect(g,3,19,5,26,'M');rect(g,3,19,3,26,'L');rect(g,5,19,5,26,'D');
    rect(g,16,19,18,26,'M');rect(g,16,19,16,26,'L');rect(g,18,19,18,26,'D');
    rect(g,2,27,6,27,'K');rect(g,15,27,19,27,'K');
    // pitched cap
    rect(g,1,1,20,3,'D');rect(g,3,0,18,0,'K');rect(g,1,1,2,1,'K');rect(g,19,1,20,1,'K');rect(g,0,2,0,3,'K');rect(g,21,2,21,3,'K');
    rect(g,3,1,18,1,'L');rect(g,1,4,20,4,'K');
    // frame + cork face
    rect(g,1,5,20,20,'M');rect(g,1,5,1,20,'L');rect(g,20,5,20,20,'D');rect(g,1,20,20,20,'D');
    rect(g,0,5,0,20,'K');rect(g,21,5,21,20,'K');rect(g,0,21,21,21,'K');
    rect(g,3,6,18,18,'C');
    // sheets
    rect(g,4,7,9,13,'P');rect(g,4,7,9,7,'B');rect(g,5,9,8,9,'Q');rect(g,5,11,8,11,'Q');rect(g,5,14,9,14,'O');
    rect(g,11,8,17,12,'P');rect(g,12,10,16,10,'Q');rect(g,17,8,17,8,'C');rect(g,16,12,17,12,'C');rect(g,12,13,17,13,'O');
    rect(g,10,14,15,17,'Q');rect(g,11,15,14,15,'O');rect(g,15,17,15,17,'C');
    return toRows(g);
  }
  // =====================================================================
  // benchPark_v 16x40 (anchor feet): park bench for a north-south path, seat
  // facing LEFT (flip to face right). Three weathered slats, backrest on the
  // right casting a shadow outward, iron frames at both ends and the middle.
  // =====================================================================
  function makeBenchParkV(){
    var w=16,h=40,g=mkGrid(w,h),x,y;
    // seat: three 2-wide slats (x1-2, x4-5, x7-8) with dark gaps, rows 1-35
    rect(g,0,0,9,36,'K');
    [1,4,7].forEach(function(sx){
      rect(g,sx,1,sx+1,35,'M');rect(g,sx,1,sx,35,'L');
      for(y=6;y<34;y+=9+sx%3)setclip(g,sx+1,y,'D');                     // grain
    });
    // backrest: a raised board on the right with a lit inner face
    rect(g,10,0,13,36,'K');rect(g,11,1,12,35,'M');rect(g,11,1,11,35,'L');
    for(y=9;y<34;y+=12)setclip(g,12,y,'D');
    // cast shadow on the outer (back) side, so the facing reads
    rect(g,14,2,14,37,'S');rect(g,15,4,15,36,'S');
    // iron end frames and a middle support crossing every slat and the backrest
    [2,17,32].forEach(function(fy){
      rect(g,0,fy,13,fy+2,'J');rect(g,0,fy,13,fy,'I');rect(g,0,fy+2,13,fy+2,'K');
      setclip(g,14,fy+1,'K');setclip(g,14,fy+2,'K');
    });
    // legs down to the ground under the end frames, contact shadow row
    rect(g,1,37,2,38,'J');rect(g,11,37,12,38,'J');rect(g,1,37,1,38,'I');rect(g,11,37,11,38,'I');
    rect(g,0,39,4,39,'K');rect(g,10,39,14,39,'K');
    return toRows(g);
  }

  // =====================================================================
  // wornPatch 40x16 x2 (decal): bare trodden soil where people stop -- in
  // front of benches, at gates and the notice board. Lumpy lobes, no outline,
  // dithered out into the grass.
  // =====================================================================
  function makeWornPatch(variant){
    var w=40,h=16,g=mkGrid(w,h),rng=mulberry32(720+variant),x,y;
    // an elongated, lumpy trodden area: three overlapping lobes along the
    // approach, no outline; bare soil thins into grass through a dither
    var lobes=variant===0?[[11,9,9,4.5],[21,7,10,5.5],[31,8,7,4]]:[[9,7,8,4],[19,9,9,5],[30,7,9,5]];
    function hsh(a,b){var n=Math.sin(a*127.1+b*311.7+variant*74.7)*43758.5453;return n-Math.floor(n);}
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      var d=9;
      lobes.forEach(function(l){var dx=(x+.5-l[0])/l[2],dy=(y+.5-l[1])/l[3];d=Math.min(d,dx*dx+dy*dy);});
      var r=hsh(x,y);
      if(d<.35){g[y][x]=r<.12?'G':r<.2?'U':'T';}
      else if(d<.7){g[y][x]=r<.55?'T':r<.62?'U':'.';}
      else if(d<1.1){if(r<.3)g[y][x]='T';}
      else if(d<1.5){if(r<.08)g[y][x]='T';}
    }
    // a few scuffed stones and heel marks in the middle
    for(var i=0;i<4;i++){x=8+Math.floor(rng()*24);y=5+Math.floor(rng()*6);if(g[y][x]==='T'){setclip(g,x,y,'U');}}
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
  // graveFlat 16x10 x2: flush ledger slab with a name line (decal, no cross)
  // =====================================================================
  function makeGraveFlat(variant){
    var w=16,h=10,g=mkGrid(w,h);
    // a long low ledger slab lying flush in the grass: no raised plinth, a
    // lit top edge, a thin grass shadow, and a chiselled name line (no cross)
    rect(g,1,2,14,8,'M');
    rect(g,1,2,14,2,'L');rect(g,0,3,0,8,'K');rect(g,15,3,15,8,'K');rect(g,1,1,14,1,'K');rect(g,1,9,14,9,'S');
    rect(g,14,3,14,8,'D');rect(g,1,8,14,8,'D');
    setclip(g,1,2,'K');setclip(g,14,2,'K');
    if(variant===0){rect(g,4,5,11,5,'D');}
    else{rect(g,3,4,12,4,'D');rect(g,4,6,9,6,'D');setclip(g,11,6,'D');}
    return toRows(g);
  }

  // =====================================================================
  // plantingBed 48x32 x2: tended municipal bed (decal). Low concrete edging
  // with a lit top/left lip, dark raked soil, clipped evergreen mounds that
  // sit above the grass tone (K outline + soil shadow), winter-pruned stubs.
  // [0] a row of clipped mounds + bulb shoots; [1] pruned rose stubs, two
  // mounds and a plant label
  // =====================================================================
  function makePlantingBed(variant){
    var w=48,h=32,g=mkGrid(w,h),rng=mulberry32(variant===0?95:96),x,y;
    // edging kerb, rounded outer corners
    rect(g,1,1,46,30,'E');
    setclip(g,1,1,'.');setclip(g,46,1,'.');setclip(g,1,30,'.');setclip(g,46,30,'.');
    rect(g,2,1,45,1,'F');rect(g,1,2,1,29,'F');                     // lit lip top/left
    rect(g,2,30,45,30,'J');rect(g,46,2,46,29,'J');                 // shadowed lip bottom/right
    // soil
    rect(g,3,3,44,28,'T');
    rect(g,3,3,44,3,'S');rect(g,3,3,3,28,'S');                     // edging shadow falls inside
    for(y=6;y<28;y+=3)for(x=5+pmod(y*5,7);x<42;x+=9+pmod(x+y,5))rect(g,x,y,x+2,y,'S'); // raked furrows
    function mound(cx,cy,rx,ry){
      var t=mkGrid(w,h),xx,yy;disc(t,cx,cy,rx,ry,'M');
      var src=t.map(function(r){return r.slice();});
      for(yy=0;yy<h;yy++)for(xx=0;xx<w;xx++){if(src[yy][xx]!=='M')continue;
        var e=function(a,b){return(src[b]&&src[b][a])!=='M';};
        if(e(xx-1,yy)||e(xx+1,yy)||e(xx,yy-1)||e(xx,yy+1))t[yy][xx]='K';}
      for(yy=0;yy<h;yy++)for(xx=0;xx<w;xx++){if(t[yy][xx]!=='M')continue;
        if(t[yy-1][xx]==='K'||t[yy][xx-1]==='K')t[yy][xx]='L';else if(t[yy+1][xx]==='K'||t[yy][xx+1]==='K')t[yy][xx]='D';}
      // soil shadow below-right
      for(xx=cx-rx+2;xx<=cx+rx+1;xx++)setclip(g,xx,cy+ry+1,'S');
      for(yy=0;yy<h;yy++)for(xx=0;xx<w;xx++)if(t[yy][xx]!=='.')g[yy][xx]=t[yy][xx];
      setclip(g,cx-1,cy-ry+1,'H');setclip(g,cx,cy-ry+1,'H');
    }
    if(variant===0){
      [8,19,30,40].forEach(function(cx,i){mound(cx,10+(i%2),5,4);});
      for(x=7;x<42;x+=5){y=20+pmod(x*3,5);setclip(g,x,y,'L');setclip(g,x,y+1,'D');}
    }else{
      mound(10,20,6,5);mound(37,10,5,4);
      [[19,8],[26,12],[24,21],[33,22]].forEach(function(b){
        var bx=b[0],by=b[1];
        rect(g,bx,by,bx,by+3,'K');rect(g,bx+2,by-1,bx+2,by+3,'K');rect(g,bx+1,by+1,bx+1,by+2,'D');rect(g,bx-1,by+4,bx+3,by+4,'S');
      });
      rect(g,40,20,41,20,'P');rect(g,40,21,41,21,'Q');rect(g,41,22,41,23,'K');
    }
    return toRows(g);
  }

  // =====================================================================
  // Park path system (decals). One cross-section shared by pathCross,
  // pathStrip_h/_v and pathGravel: a 16-texel warm gravel band (L base, M/D
  // stones, H pebble glints), edge rows broken by grass blades (G/F) and gaps
  // on period-32 tables, and 2 rows of stray pebbles on the lawn so a path
  // never floats as a hard rectangle or reads as a channel of water. Every table is period 32 along the
  // path, so strips butt against the cross and each other seamlessly.
  // =====================================================================
  var PATH_JIT='00100110000101000011000001001100';
  var PATH_BLADE='10002000100000200100001000020001'; // 1/2 = grass blade crossing the gravel edge
  var PATH_FR1='01100000011000000000110000011000';
  var PATH_FR2='00000110000000001100000000000110';
  var PATH_TEX=(function(){
    var rng=mulberry32(4242),t=[],a,c,i;
    for(c=0;c<16;c++){t.push([]);for(a=0;a<32;a++)t[c].push('L');}
    function put(a,c,ch){if(c>=0&&c<16)t[c][pmod(a,32)]=ch;}
    for(i=0;i<34;i++){a=Math.floor(rng()*32);c=Math.floor(rng()*16);if(rng()<.5){put(a,c,'M');put(a+1,c,'M');}else{put(a,c,'M');put(a,c+1,'M');}}
    for(i=0;i<10;i++){a=Math.floor(rng()*32);c=1+Math.floor(rng()*14);put(a,c,'D');put(a+1,c,'D');}
    for(i=0;i<5;i++){a=Math.floor(rng()*32);c=4+Math.floor(rng()*8);put(a,c,'H');put(a+1,c,'H');}
    for(i=0;i<9;i++){a=Math.floor(rng()*32);c=2+Math.floor(rng()*12);if(t[c][pmod(a,32)]==='L')put(a,c,'H');}   // 1-texel pebble glints
    return t;
  })();
  // letter at (along, across) where across 0..15 is the band, -2..-1 / 16..17 fringe
  function pathAt(along,across){
    var a=pmod(along,32);
    // lawn side: a few stray pebbles kicked onto the grass
    if(across===-1||across===16)return PATH_FR1[pmod(a+(across>0?11:0),32)]==='1'?(pmod(a,3)===0?'L':'M'):'.';
    if(across===-2||across===17)return PATH_FR2[pmod(a+(across>0?7:0),32)]==='1'?'M':'.';
    if(across<0||across>15)return '.';
    var j=PATH_JIT[a]==='1',j2=PATH_JIT[pmod(a+13,32)]==='1';
    // edge rows: gravel broken by grass blades growing in from the lawn
    var e=across<=1?across:across>=14?15-across:-1,jj=across<=1?j:j2;
    if(e===0){var b=PATH_BLADE[pmod(a+(across>0?9:0),32)];return b==='1'?'G':b==='2'?'F':jj?'.':PATH_TEX[across][a];}
    if(e===1){var b1=PATH_BLADE[pmod(a+(across>0?9:0),32)];return b1==='1'&&jj?'G':PATH_TEX[across][a];}
    return PATH_TEX[across][a];
  }
  function makePathStripH(variant){
    var w=32,h=20,g=mkGrid(w,h),x,y;
    for(y=0;y<h;y++)for(x=0;x<w;x++)g[y][x]=pathAt(x+(variant===1?16:0),y-2);
    if(variant===1){rect(g,9,8,12,8,'M');rect(g,10,9,14,9,'M');rect(g,20,10,22,10,'M');} // scuffed in the wheel line
    return toRows(g);
  }
  function transposeRows(rows){var out=[],x,y,s;for(x=0;x<rows[0].length;x++){s='';for(y=0;y<rows.length;y++)s+=rows[y][x];out.push(s);}return out;}

  // =====================================================================
  // pathCross 64x64: gravel path junction (decal). Arms 16 wide centred on
  // x/y 24-39 continue pathStrip_h/_v exactly; inner corners filleted r=5.
  // =====================================================================
  function makePathCross(){
    var w=64,h=64,g=mkGrid(w,h),x,y,r=5;
    function core(x,y){
      if(y>=24&&y<=39)return true;if(x>=24&&x<=39)return true;
      var cx=x<24?24-r:40+r-1,cy=y<24?24-r:40+r-1;
      if(Math.abs(x-cx)<=r&&Math.abs(y-cy)<=r&&(x<24?x>=24-r:x<=39+r)&&(y<24?y>=24-r:y<=39+r)){
        var dx=x+.5-(x<24?24-r:40+r),dy=y+.5-(y<24?24-r:40+r);return dx*dx+dy*dy>=r*r;
      }
      return false;
    }
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      var inH=y>=22&&y<=41,inV=x>=22&&x<=41;
      if(core(x,y)&&!(y>=24&&y<=39)&&!(x>=24&&x<=39)){g[y][x]=PATH_TEX[pmod(y,16)][pmod(x,32)];continue;}
      if(inH&&!(x>=18&&x<=45))g[y][x]=pathAt(x,y-24);
      else if(inV&&!(y>=18&&y<=45))g[y][x]=pathAt(y,x-24);
      else if(core(x,y))g[y][x]=PATH_TEX[pmod(y-24,16)][pmod(x,32)];
    }
    // soft lawn edge around the junction fillets (the arms carry their own):
    // grass blades and gaps, never a dark rim
    var src=g.map(function(r){return r.slice();});
    for(y=18;y<=45;y++)for(x=18;x<=45;x++){
      if(src[y][x]==='.')continue;
      var edge=(src[y-1]&&src[y-1][x]==='.')||(src[y+1]&&src[y+1][x]==='.')||src[y][x-1]==='.'||src[y][x+1]==='.';
      if(!edge)continue;
      var k=pmod(x*5+y*3,7);
      g[y][x]=k===0?'G':k===3?'F':k===5?'.':g[y][x];
    }
    // trodden centre where the routes meet: compacted, a few bright pebbles
    rect(g,29,31,34,31,'L');rect(g,30,32,33,32,'L');setclip(g,31,30,'H');setclip(g,34,33,'H');
    return toRows(g);
  }

  // =====================================================================
  // pathGravel 48x48: worn gravel yard / graveyard hub (decal). Same band
  // texture as the path system, a rounded-square outline broken by grass
  // blades, stray pebbles outside, trodden lighter centre.
  // =====================================================================
  function makePathGravel(){
    var w=48,h=48,g=mkGrid(w,h),x,y;
    // a squarish trodden gravel hub (superellipse, not a round pond) whose
    // rim breaks up into grass blades and stray pebbles on the lawn
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      var dx=Math.abs((x+.5-24)/20),dy=Math.abs((y+.5-24)/20),d=Math.pow(Math.pow(dx,4)+Math.pow(dy,4),.25);
      var ang=Math.atan2(y+.5-24,x+.5-24),k=Math.floor((ang+Math.PI)/(2*Math.PI)*32)%32,j=PATH_JIT[k]==='1'?.05:0;
      var t=PATH_TEX[pmod(y,16)][pmod(x,32)];
      if(d<=.93-j)g[y][x]=t;
      else if(d<=1-j){var b=PATH_BLADE[pmod(k*3+x+y,32)];g[y][x]=b==='1'?'G':b==='2'?'F':pmod(x+y,3)===0?'.':t;}
      else if(d<=1.12&&PATH_FR1[pmod(k*2+x,32)]==='1'&&pmod(x*y,4)===0)g[y][x]=pmod(x,2)?'M':'L';
    }
    // trodden lighter centre
    for(y=17;y<31;y++)for(x=17;x<31;x++)if(g[y][x]==='M'&&pmod(x+y,3)===0)g[y][x]='L';
    setclip(g,22,21,'H');setclip(g,27,26,'H');
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
  function makeTrolley(){ // tipped on its side: pale wire basket with a mesh grid, push handle, castors in the air
    var w=20,h=16,g=mkGrid(w,h),x,y;
    for(y=3;y<=11;y++){var x0=2+Math.floor((y-3)/4),x1=15;for(x=x0;x<=x1;x++){var edge=y===3||y===11||x===x0||x===x1;if(edge)g[y][x]=y===3||x===x0?'H':'L';else if((x-x0)%3===0||(y-3)%3===0)g[y][x]='M';}}
    rect(g,15,1,18,1,'H');rect(g,15,2,15,2,'L');setclip(g,18,2,'L');                                   // push handle bar over the back of the basket
    rect(g,3,12,14,12,'M');                                                       // chassis rail
    [[4,14],[13,14]].forEach(function(c){rect(g,c[0]-1,c[1]-1,c[0]+1,c[1],'K');setclip(g,c[0],c[1]-1,'H');}); // castors
    setclip(g,3,3,'H');setclip(g,4,3,'H');                                        // glint on the lit rim
    outlineFrom(g,['L','M','D','H'],'K');
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
  function makeRubbleSpill(variant){ // fresh spill: grey dust fan with distinct brick and plaster chunks, biggest at the source edge
    var w=40,h=18,g=mkGrid(w,h),rng=mulberry32(variant===0?85:86),x,y,d,cx=variant===0?16:24;
    for(y=0;y<h;y++)for(x=0;x<w;x++){d=Math.sqrt(((x-cx)/19)*((x-cx)/19)+((y-5)/12)*((y-5)/12));if(d<1&&rng()<(1-d)*1.3)g[y][x]='D';} // dust fan from the wall (top edge)
    function chunk(px,py,cw,ch,brick){for(var yy=0;yy<ch;yy++)for(var xx=0;xx<cw;xx++)setclip(g,px+xx,py+yy,yy===0?(brick?'C':'L'):(brick?'B':'M'));setclip(g,px+cw-1,py+ch-1,'K');}
    for(var i=0;i<11;i++){var t=i/11,r=rng(),px=Math.round(cx-14+rng()*28),py=Math.round(1+t*t*13+rng()*2),big=t<.45;chunk(px,py,big?3+(r*2|0):2,big?2+(r>.6?1:0):2,rng()<.6);}
    for(i=0;i<6;i++)setclip(g,Math.round(cx-17+rng()*34),Math.round(9+rng()*8),rng()<.5?'L':'C');                 // loose grit at the fan's edge
    return toRows(g);
  }

  A.define('lots',{
    chain_h:{variants:[makeChainH(0),makeChainH(1)],pal:'MAT.iron',anchor:{x:0,y:1},note:'32x16 chain-link mesh, period-8 lattice, iron post at x0-2; tiles left-right, [1] has a small tear'},
    chain_v:{variants:[makeChainV(0),makeChainV(1)],pal:'MAT.iron',anchor:{x:.5,y:0},note:'8x32 chain-link mesh with a running rail post at x1-3; tiles top-bottom, [1] has a small tear'},
    hedge_h:{variants:[makeHedgeH(0),makeHedgeH(1)],pal:HEDGE,anchor:{x:0,y:1},note:'32x22 clipped dark hedge, period-8 wavy canopy line shared by both variants; tiles left-right'},
    hedge_v:{variants:[makeHedgeV(0),makeHedgeV(1)],pal:HEDGE,anchor:{x:.5,y:0},note:'16x32 clipped dark hedge, period-8 canopy bumps on both long edges; tiles top-bottom'},
    stone_h:{variants:[makeStoneH(0),makeStoneH(1)],pal:GRAVESTONE,anchor:{x:0,y:1},note:'32x14 low cemetery stone wall, lit coping cap, period-8 mortar joints; tiles left-right'},
    stone_v:{variants:[makeStoneV(0),makeStoneV(1)],pal:GRAVESTONE,anchor:{x:.5,y:0},note:'12x32 low cemetery stone wall, lit coping cap running the length, period-8 joints; tiles top-bottom'},
    hoarding_h:{variants:[makeHoardingH(0),makeHoardingH(1)],pal:HOARD_PAL,anchor:{x:0,y:1},note:'32x22 plywood construction hoarding, board seams every 8, faded hazard band at the foot; tiles left-right'},
    hoarding_v:{variants:[makeHoardingV(0),makeHoardingV(1)],pal:HOARD_PAL,anchor:{x:.5,y:0},note:'10x32 plywood construction hoarding, faded hazard band down one edge; tiles top-bottom'},
    grave:{variants:[makeGrave(0),makeGrave(1),makeGrave(2)],pal:GRAVESTONE,anchor:'feet',note:'16x18 headstone on a plinth, [0] rounded, [1] cross, [2] squat block'},
    tree:{variants:[makeTree(0),makeTree(1),makeTree(2)],pal:TREE_PAL,anchor:'feet',note:'48x56 bare late-winter city tree on a soil pit, tapered bark trunk with root flare, sparse see-through crown: [0] broad; [1] leaning right; [2] young staked tree'},
    lightPole:{rows:makeLightPole(),pal:'MAT.iron',anchor:'feet',note:'12x72 straight parking-lot light pole, boxy head at top'},
    utilityBox:{rows:makeUtilityBox(),pal:'MAT.iron',anchor:'feet',note:'24x22 iron utility cabinet, seam and vent slats'},
    spoilHeap:{rows:makeSpoilHeap(),pal:'MAT.wood',anchor:'feet',note:'60x34 mounded excavated dirt spoil heap'},
    conveyor:{rows:makeConveyor(),pal:CONVEYOR_PAL,anchor:'feet',note:'90x26 belt conveyor on legs, roller drums at each end'},
    craneBase:{rows:makeCraneBase(),pal:CRANE_PAL,anchor:'feet',note:'40x48 concrete footing with a steel stub rising from it'},
    gantryLeg:{rows:makeGantryLeg(),pal:GANTRY_PAL,anchor:'feet',note:'20x56 steel gantry leg on a concrete plinth'},
    pipeBank:{rows:makePipeBank(),pal:PIPEBANK_PAL,anchor:'feet',note:'90x28 stacked iron pipes on wood sleepers'},
    noticeBoard:{rows:makeNoticeBoard(),pal:NOTICEB_PAL,anchor:'feet',note:'22x28 park notice board on two posts, pitched cap, dark cork face, muted pinned sheets'},
    benchPark_v:{rows:makeBenchParkV(),pal:BENCHV_PAL,anchor:'feet',note:'16x40 park bench for a north-south path, seat of three weathered slats faces LEFT (flip to face right), backrest on the right with a grass shadow behind it, iron end frames + middle support crossing every slat, legs on the bottom row'},
    wornPatch:{variants:[makeWornPatch(0),makeWornPatch(1)],pal:WORN_PAL,anchor:'center',note:'40x16 flat, trodden soil where people stop: elongated lumpy lobes along the approach, no outline, dithered into the grass with surviving tufts. In front of bench seats (not behind), at gates and below notice boards; rot:1 for a north-south approach'},
    hoardingSign:{rows:makeHoardingSign(),pal:HOARD_PAL,anchor:'feet',note:'30x26 hazard-striped sign board on two stakes'},
    graveFlat:{variants:[makeGraveFlat(0),makeGraveFlat(1)],pal:GRAVESTONE,anchor:'center',note:'16x10 flush ledger slab lying in the grass, lit top edge, chiselled name line ([1] two lines); no cross, so it never reads as a medkit'},
    plantingBed:{variants:[makePlantingBed(0),makePlantingBed(1)],pal:PLANTBED_PAL,anchor:'center',note:'48x32 tended bed: concrete edging, raked soil, clipped evergreen mounds; [0] mound row + bulb shoots; [1] pruned rose stubs, two mounds, plant label'},
    pathCross:{rows:makePathCross(),pal:PATH_PAL,anchor:'center',note:'64x64 warm gravel path junction, 16-wide arms on x/y 24-39, grass blades breaking the edges and stray pebbles on the lawn (no dark rim), filleted corners, trodden centre; continues pathStrip_h/_v'},
    pathStrip_h:{variants:[makePathStripH(0),makePathStripH(1)],pal:PATH_PAL,anchor:'center',note:'32x20 flat, tiles left-right from pathCross arm ends (band rows 2-17, fringe rows 0-1/18-19); [1] scuffed'},
    pathStrip_v:{variants:[transposeRows(makePathStripH(0)),transposeRows(makePathStripH(1))],pal:PATH_PAL,anchor:'center',note:'20x32 flat, tiles top-bottom from pathCross arm ends; transpose of pathStrip_h'},
    pathGravel:{rows:makePathGravel(),pal:PATH_PAL,anchor:'center',note:'48x48 warm gravel hub/yard patch (rounded square, not a round pond), same texture as the path system, edge broken by grass blades, trodden lighter centre'},
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
