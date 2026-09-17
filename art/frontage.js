// Dead Signal building frontage: modular street/rear faces that sit ON a
// building footprint edge, drawn over the roof (world.js/render.js under
// 'frontage/<name>'). One texel = one world unit (den 1). Night city, day 9
// of a quarantine: muted brick and masonry, taped windows, rolled shutters,
// fresh (not ancient) collapse damage. No overgrowth, no moss.
//
// Two districts:
//   South Blocks (brick*, shop*, shutter*, awning*, rear*, backDoor*, binNook*,
//     court*, rearExt*)          joined brick rows, corner shops, rear courts
//   Old Quarter  (terrace*, masonry*, collapse*, partyWall*, collapseFloor,
//     collapseSpill)             masonry terraces, party walls, fresh cuts
//
// Orientation contract (every piece in this file):
//   *_h  street/yard is the BOTTOM row: the wall face is seen three-quarter
//        from the south. Draw at the footprint's SOUTH edge with anchorY 1
//        (the sprite lies inside the footprint). For a north-facing edge use
//        the matching *Eaves_n strip (plan-view parapet), or flipY:true with
//        anchorY 1 at o.y when a face must show there.
//   *_v  plan-view wall edge, street/yard is COLUMN 0. Draw at the footprint's
//        WEST edge with anchorX 0; for an east edge draw at o.x+o.w with
//        flip:true, anchorX 0 (the sprite then lies inside the footprint with
//        column 0 on the street).
//   *_n  plan-view parapet for a north-facing edge, street is ROW 0: draw at
//        o.y with anchorY 0.
//
// Tiling: every tiling *_h strip is 32 wide and every tiling *_v strip 32 tall
// (the run axis). All texture along the run (brick head joints, ashlar
// joints, slats, awning stripes, valance scallops) is sampled with
// `coordinate % period` where the period divides 32, so neighbours meet in
// phase. The attached-section divider (party pier) sits at run coordinate
// 0..2 of every tile, so a mixed run of variants/pieces always reads as
// joined houses and any step in the Old Quarter eave line lands on a pier.
(function(){
  'use strict';
  var A=(typeof window!=='undefined'?window:globalThis).DSArt;
  var MAT=A.MAT;

  // ---- grid helpers (same shape as art/lots.js) ----
  function mkGrid(w,h){var g=[],y,x,row;for(y=0;y<h;y++){row=[];for(x=0;x<w;x++)row.push('.');g.push(row);}return g;}
  function setclip(g,x,y,ch){if(y>=0&&y<g.length&&x>=0&&x<g[0].length)g[y][x]=ch;}
  function get(g,x,y){return(y>=0&&y<g.length&&x>=0&&x<g[0].length)?g[y][x]:'.';}
  function rect(g,x0,y0,x1,y1,ch){var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)setclip(g,x,y,ch);}
  function box(g,x0,y0,x1,y1,ch){rect(g,x0,y0,x1,y0,ch);rect(g,x0,y1,x1,y1,ch);rect(g,x0,y0,x0,y1,ch);rect(g,x1,y0,x1,y1,ch);}
  function toRows(g){return g.map(function(r){return r.join('');});}
  function pal2(base,extra){return Object.assign({},base,extra);}
  function pmod(n,p){return((n%p)+p)%p;}
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function line(g,x0,y0,x1,y1,ch){
    var dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,e=dx+dy,e2;
    for(;;){setclip(g,x0,y0,ch);if(x0===x1&&y0===y1)break;e2=2*e;if(e2>=dy){e+=dy;x0+=sx;}if(e2<=dx){e+=dx;y0+=sy;}}
  }
  // rotate a grid 90deg clockwise-ish into plan: (x,y) -> (y, w-1-x) is not
  // used; _v strips are drawn natively so their light stays top-left.
  function outlineFrom(g,fill,K){
    var h=g.length,w=g[0].length,x,y,src=g.map(function(r){return r.slice();});
    function isF(ch){return fill.indexOf(ch)>=0;}
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      if(!isF(src[y][x]))continue;
      if(x===0||x===w-1||y===0||y===h-1||src[y][x-1]==='.'||src[y][x+1]==='.'||src[y-1][x]==='.'||src[y+1][x]==='.')g[y][x]=K;
    }
  }
  // 1-texel K outline OUTSIDE the filled shape (4-neighbour), so small chunks keep their fill
  function outlineOut(g,K){
    var h=g.length,w=g[0].length,x,y,src=g.map(function(r){return r.slice();});
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      if(src[y][x]!=='.')continue;
      if((x>0&&src[y][x-1]!=='.')||(x<w-1&&src[y][x+1]!=='.')||(y>0&&src[y-1][x]!=='.')||(y<h-1&&src[y+1][x]!=='.'))g[y][x]=K;
    }
  }
  // periodic stone/brick tint lookup: period 4 units of 8 = 32, seamless
  var TINT=[0,2,1,0,1,0,2,1,2,0,0,1,1,2,0,0];
  function tintAt(unit,course){return TINT[pmod(unit,4)*4+pmod(course,4)];}

  // ---- palettes ----
  // masonry: npm run art:ramp -- --hue 70 --l 0.14,0.62 --chroma 0.025 --name masonry
  var MASONRY={K:'#0d0806',D:'#2c221a',M:'#4b4034',L:'#6a6256',H:'#88867f'};
  // slate:   npm run art:ramp -- --hue 250 --l 0.12,0.45 --chroma 0.02 --name slate
  var SLATE={K:'#050609',D:'#12171f',M:'#232b34',L:'#374147',H:'#505659'};
  // brickDim: npm run art:ramp -- --hue 26 --l 0.16,0.64 --chroma 0.065 --name brickDim
  // (MAT.brick is L .45 mid / chroma .08: too fresh for soot-dark day-9 rows)
  var BRICKD={K:'#18080c',D:'#401c20',M:'#663935',L:'#865e52',H:'#9c877d'};
  // canvasTeal: npm run art:ramp -- --hue 200 --l 0.2,0.62 --chroma 0.035 --name canvasTeal
  var TEAL={K:'#0e181b',D:'#1c3338',M:'#335052',L:'#546d6b',H:'#7d8986'};
  // paper:  npm run art:ramp -- --hue 85 --l 0.3,0.72 --chroma 0.03 --name paper  (exposed wallpaper / plaster)
  var PAPER={K:'#2e2e27',D:'#4d4939',M:'#6e6553',L:'#898574',H:'#a5a59c'};
  var BRICK_PAL=pal2(BRICKD,{
    C:MAT.concrete.L,E:MAT.concrete.M,F:MAT.concrete.D, // stone coping, lintels, sills, steps
    G:MAT.glass.K,J:MAT.glass.D,                        // dark night glass + faint glint
    I:MAT.iron.M,N:MAT.iron.D,Z:MAT.iron.L,             // pipes, shutters, frames
    U:MAT.wood.M,X:MAT.wood.D,                          // doors, boards
    A:TEAL.M,B:TEAL.D,Y:TEAL.L,W:PAPER.L,O:TEAL.K,      // faded teal awning canvas + pale stripe, valance shade
    P:MAT.concrete.H,                                   // tape, chalk marks
    V:PAPER.M,R:PAPER.D,                                // sheet / towel hung in a window
    S:SLATE.M,T:SLATE.D,Q:SLATE.L                       // extension roof
  });
  var MASON_PAL=pal2(MASONRY,{
    S:SLATE.M,T:SLATE.D,Q:SLATE.L,                      // slate roof
    G:MAT.glass.K,J:MAT.glass.D,
    U:MAT.wood.D,X:MAT.wood.K,Y:MAT.wood.M,             // joists, boards, doors (shadow tones)
    P:PAPER.L,V:PAPER.M,W:PAPER.D,R:PAPER.K,            // exposed wallpaper / plaster, lit to shaded
    Z:MAT.concrete.H,                                   // fresh break faces (small)
    I:MAT.iron.M,N:MAT.iron.D,
    B:BRICKD.M,C:BRICKD.D,E:BRICKD.L                    // brick backing inside the cut, brick rubble
  });

  // =====================================================================
  // shared South Blocks brick face pieces
  // =====================================================================
  // brick courses: 3 rows (2 brick + bed joint), head joints period 8
  // staggered 4 per course. Sampled on absolute coords -> seamless along x.
  function brickFaceH(g,x0,y0,x1,y1,yRef){
    var x,y,c,u,off;
    for(y=y0;y<=y1;y++){
      c=Math.floor((yRef-y)/3);off=pmod(c,2)*4;
      for(x=x0;x<=x1;x++){
        if(pmod(yRef-y,3)===0){setclip(g,x,y,'D');continue;}
        if(pmod(x+off,8)===0){setclip(g,x,y,'D');continue;}
        u=Math.floor((x+off)/8);
        var t=tintAt(u,c);
        setclip(g,x,y,t===2&&pmod(yRef-y,3)===2?'L':'M');
      }
    }
  }
  function brickFaceV(g,x0,y0,x1,y1,xRef){
    var x,y,c,u,off;
    for(x=x0;x<=x1;x++){
      c=Math.floor((x-xRef)/3);off=pmod(c,2)*4;
      for(y=y0;y<=y1;y++){
        if(pmod(x-xRef,3)===2){setclip(g,x,y,'D');continue;}
        if(pmod(y+off,8)===0){setclip(g,x,y,'D');continue;}
        u=Math.floor((y+off)/8);
        setclip(g,x,y,tintAt(u,c)===2&&pmod(x-xRef,3)===0?'L':'M');
      }
    }
  }
  // 3/4 sash window: lintel, K frame, dark glass, meeting rail, glint, sill
  function sashH(g,x,y,w,h,kind){
    rect(g,x-1,y-1,x+w,y-1,'C');
    box(g,x,y,x+w-1,y+h-1,'K');
    rect(g,x+1,y+1,x+w-2,y+h-2,'G');
    rect(g,x+1,y+Math.floor(h/2),x+w-2,y+Math.floor(h/2),'N');
    setclip(g,x+1,y+1,'J');
    if(kind==='boarded'){var yy;for(yy=y+1;yy<=y+h-2;yy++)rect(g,x+1,yy,x+w-2,yy,pmod(yy-y,3)===0?'X':'U');}
    if(kind==='taped'){line(g,x+1,y+1,x+w-2,y+h-2,'P');line(g,x+w-2,y+1,x+1,y+h-2,'P');}
    rect(g,x-1,y+h,x+w,y+h,'E');
    rect(g,x,y+h+1,x+w-1,y+h+1,'F');
  }
  // plan-view window on a _v strip: a wall top cannot show glass, so it is a
  // stone sill tick on the street side with a dark reveal behind it
  function slotV(g,x,y,w,h,kind){
    var sill=kind==='boarded'?'U':'E',top=kind==='boarded'?'X':'C';
    rect(g,1,y,2,y+h-1,sill);rect(g,1,y,2,y,top);rect(g,3,y+1,3,y+h-2,'D');
    if(kind==='taped')setclip(g,2,y+Math.floor(h/2),'P');
  }
  // the common top + bottom of every brick _h face: coping rows 0..3,
  // plinth + ground contact on the last two rows, party pier cols 0..2
  function brickShellH(g,w,h){
    rect(g,0,0,w-1,0,'K');rect(g,0,1,w-1,1,'C');rect(g,0,2,w-1,2,'E');rect(g,0,3,w-1,3,'F');
    brickFaceH(g,0,4,w-1,h-3,h-3);
    rect(g,0,h-2,w-1,h-2,'D');rect(g,0,h-1,w-1,h-1,'K');
    rect(g,0,1,0,h-1,'K');rect(g,1,4,1,h-3,'L');rect(g,2,4,2,h-3,'D');
    setclip(g,1,1,'P');
  }
  function brickShellV(g,w,h){
    rect(g,0,0,0,h-1,'K');rect(g,1,0,1,h-1,'D');
    brickFaceV(g,2,0,w-5,h-1,2);
    rect(g,w-4,0,w-4,h-1,'F');rect(g,w-3,0,w-3,h-1,'E');rect(g,w-2,0,w-2,h-1,'C');rect(g,w-1,0,w-1,h-1,'K');
    rect(g,0,0,w-2,0,'K');rect(g,1,1,w-5,1,'L');rect(g,1,2,w-5,2,'D');
  }

  // brickRow_h 32x24 x3: attached brick house section.
  // [0] two sash windows [1] window + front door [2] boarded + taped window
  function makeBrickRowH(v){
    var w=32,h=24,g=mkGrid(w,h);
    brickShellH(g,w,h);
    if(v===0){
      sashH(g,7,7,6,10);sashH(g,21,7,6,10);
      rect(g,8,8,11,15,'V');rect(g,10,8,10,15,'R');rect(g,8,8,11,8,'R');setclip(g,11,16,'V');   // sheet hung across the left window
      rect(g,21,4,26,4,'D');rect(g,22,5,25,5,'K');rect(g,23,4,24,4,'K');setclip(g,22,3,'D');setclip(g,25,3,'D'); // soot over the right window
    }
    if(v===1){
      sashH(g,7,7,6,10);
      rect(g,18,9,26,9,'C');
      box(g,19,10,25,22,'K');rect(g,20,11,24,12,'G');rect(g,20,13,24,13,'K');
      rect(g,20,14,24,21,'U');rect(g,21,15,21,20,'X');rect(g,23,15,23,20,'X');setclip(g,24,17,'C');
      rect(g,18,22,26,22,'E');rect(g,18,23,26,23,'K');
      line(g,20,15,24,19,'P');line(g,24,15,20,19,'P');                        // chalked search cross on the door
      rect(g,28,12,30,14,'P');setclip(g,29,13,'E');                             // taped notice
    }
    if(v===2){sashH(g,7,7,6,10,'boarded');sashH(g,21,7,6,10,'taped');}
    return toRows(g);
  }
  // brickRow_v 14x32 x3: the same section in plan along a N-S street
  function makeBrickRowV(v){
    var w=14,h=32,g=mkGrid(w,h);
    brickShellV(g,w,h);
    if(v===0){slotV(g,3,7,5,7);slotV(g,3,21,5,7);}
    if(v===1){slotV(g,3,7,5,7);rect(g,0,20,3,27,'E');rect(g,0,20,3,20,'C');rect(g,1,27,3,27,'F');rect(g,4,20,4,27,'K');rect(g,5,21,5,26,'X');}
    if(v===2){slotV(g,3,7,5,7,'boarded');slotV(g,3,21,5,7,'taped');}
    return toRows(g);
  }
  // brickEaves_n 32x8 x1: north-facing brick edge in plan (street row 0)
  function makeBrickEavesN(){
    var w=32,h=8,g=mkGrid(w,h),x;
    rect(g,0,0,w-1,0,'K');rect(g,0,1,w-1,1,'D');
    brickFaceH(g,0,2,w-1,4,4);
    rect(g,0,5,w-1,5,'C');rect(g,0,6,w-1,6,'E');rect(g,0,7,w-1,7,'F');
    rect(g,0,0,0,7,'K');rect(g,1,1,1,4,'L');rect(g,2,1,2,4,'D');
    for(x=5;x<w;x+=8)setclip(g,x,6,'F');
    return toRows(g);
  }
  // brickCorner 14x24: SW street corner, quoined return (flip for SE)
  function makeBrickCorner(){
    var w=14,h=24,g=mkGrid(w,h),y,q;
    rect(g,0,0,w-1,0,'K');rect(g,0,1,w-1,1,'C');rect(g,0,2,w-1,2,'E');rect(g,0,3,w-1,3,'F');
    brickFaceH(g,1,4,w-1,h-3,h-3);
    rect(g,0,h-2,w-1,h-2,'D');rect(g,0,h-1,w-1,h-1,'K');
    rect(g,0,0,0,h-1,'K');
    for(y=4,q=0;y<=h-3;y+=3,q++){
      var len=q%2?3:5;
      rect(g,1,y,len,y+1,'E');rect(g,1,y,len,y,'C');rect(g,len+1,y,len+1,y+1,'F');
      rect(g,1,y+2,len+1,y+2,'F');
    }
    rect(g,1,1,1,3,'P');
    return toRows(g);
  }
  // entrance_h 32x24: recessed porch entrance slotted into a brick run
  function makeEntranceH(){
    var w=32,h=24,g=mkGrid(w,h);
    brickShellH(g,w,h);
    rect(g,7,5,24,5,'C');rect(g,7,6,24,6,'E');                // stone lintel
    rect(g,8,7,23,21,'K');
    rect(g,10,8,21,19,'D');                                   // shadowed back wall of the porch
    rect(g,9,8,9,21,'L');rect(g,22,8,22,21,'N');              // lit left reveal, dark right reveal
    box(g,11,9,20,19,'K');rect(g,12,10,19,11,'G');setclip(g,12,10,'J');rect(g,12,12,19,12,'K');
    rect(g,12,13,19,18,'U');rect(g,15,13,16,18,'X');rect(g,13,14,13,17,'X');rect(g,18,14,18,17,'X');
    setclip(g,14,16,'C');setclip(g,17,16,'C');
    rect(g,10,20,21,21,'F');rect(g,10,20,21,20,'E');setclip(g,13,21,'E');setclip(g,18,21,'E'); // tiled porch floor
    rect(g,7,22,24,22,'C');rect(g,7,23,24,23,'K');           // front step
    return toRows(g);
  }
  // entrance_v 14x32: the recess in plan (notch cut in from the street)
  function makeEntranceV(){
    var w=14,h=32,g=mkGrid(w,h);
    brickShellV(g,w,h);
    rect(g,0,8,8,23,'F');rect(g,0,8,8,8,'K');rect(g,0,23,8,23,'K');
    rect(g,1,9,7,9,'E');rect(g,1,9,1,22,'E');setclip(g,4,14,'E');setclip(g,3,19,'E');
    rect(g,8,9,8,22,'K');rect(g,9,11,9,20,'U');rect(g,9,11,9,11,'K');rect(g,9,20,9,20,'K');setclip(g,9,15,'X');
    return toRows(g);
  }
  // shopfront_h 32x24 x2: fascia, plate glass, stallriser, shop door
  // [0] intact dark shop [1] cracked glass, one pane boarded, taped notice
  function shopShellH(g,w,h){
    brickShellH(g,w,h);
    rect(g,3,4,w-1,7,'N');rect(g,3,4,w-1,4,'I');rect(g,3,7,w-1,7,'K'); // fascia board
    var x;for(x=6;x<w-3;x+=4)if(pmod(x,8)!==2)rect(g,x,5,x+1,6,'I');     // worn lettering blocks, no legible text
    rect(g,3,8,w-1,8,'F');
  }
  function makeShopfrontH(v){
    var w=32,h=24,g=mkGrid(w,h);
    shopShellH(g,w,h);
    box(g,3,9,31,19,'K');rect(g,4,10,30,18,'G');
    rect(g,4,10,30,10,'N');rect(g,13,10,13,18,'K');                    // transom rail, mullion
    box(g,22,9,29,22,'K');rect(g,23,10,28,21,'G');rect(g,23,15,28,15,'I');setclip(g,23,10,'J'); // shop door
    rect(g,3,20,21,21,'D');rect(g,3,20,21,20,'M');rect(g,30,20,31,21,'D');  // stallriser
    setclip(g,5,11,'J');setclip(g,6,12,'J');setclip(g,15,11,'J');
    rect(g,21,22,30,22,'E');
    if(v===1){
      line(g,6,17,11,11,'Z');line(g,9,14,12,17,'Z');                       // crack star
      rect(g,14,11,20,18,'U');rect(g,14,13,20,13,'X');rect(g,14,16,20,16,'X'); // boarded pane
      rect(g,24,11,26,13,'P');setclip(g,25,12,'E');                        // taped notice on the door
    }
    return toRows(g);
  }
  function makeShopfrontV(v){
    var w=14,h=32,g=mkGrid(w,h);
    brickShellV(g,w,h);
    rect(g,6,3,9,h-1,'N');rect(g,9,3,9,h-1,'K');rect(g,6,3,6,h-1,'I');
    rect(g,1,3,5,h-1,'K');rect(g,2,4,4,h-1,'G');rect(g,2,13,4,13,'K');rect(g,2,22,4,22,'K');
    rect(g,1,24,1,29,'E');setclip(g,2,5,'J');setclip(g,2,15,'J');
    if(v===1){rect(g,2,14,4,21,'U');rect(g,3,14,3,21,'X');setclip(g,3,7,'Z');setclip(g,2,8,'Z');setclip(g,4,6,'Z');}
    return toRows(g);
  }
  // shutter_h 32x24 x2: rolled steel shutter shopfront
  // [0] down and locked [1] jammed half-open, dark gap below
  function makeShutterH(v){
    var w=32,h=24,g=mkGrid(w,h),y,bot=v===1?15:21;
    shopShellH(g,w,h);
    rect(g,3,9,31,10,'I');rect(g,3,9,31,9,'Z');rect(g,3,10,31,10,'N');    // roller box
    for(y=11;y<=bot;y++)rect(g,3,y,31,y,pmod(y,2)?'I':'N');
    rect(g,3,11,3,21,'K');rect(g,4,11,4,21,'N');                          // guide rail
    rect(g,3,bot+1,31,bot+1,'K');rect(g,5,bot,31,bot,'Z');
    if(v===0){rect(g,16,bot,18,bot+1,'K');setclip(g,17,bot-1,'Z');rect(g,3,21,31,21,'K');}
    else{rect(g,5,bot+2,31,21,'K');rect(g,6,bot+2,31,bot+2,'G');setclip(g,12,20,'N');setclip(g,23,19,'N');}
    rect(g,3,22,31,22,'E');
    return toRows(g);
  }
  function makeShutterV(v){
    var w=14,h=32,g=mkGrid(w,h),x,top=v===1?6:3;
    brickShellV(g,w,h);
    rect(g,1,3,9,h-1,'K');
    for(x=2;x<=8;x++)rect(g,x,3,x,h-1,pmod(x,2)?'I':'N');
    rect(g,9,3,9,h-1,'Z');
    if(v===1){rect(g,2,3,4,h-1,'K');rect(g,5,3,5,h-1,'Z');}
    else{rect(g,1,15,2,17,'K');}
    return toRows(g);
  }
  // awning_h 32x16 x2: faded teal/putty striped canvas shop awning, drawn
  // OUTSIDE the footprint (row 0 = wall rail on the footprint edge).
  // rows 0-1 rail, 2-10 sloped canvas (dark under the rail, lit fold at 10),
  // 11-12 scalloped valance, 13-15 cast shadow on the pavement.
  // Stripes period 8 and scallops period 4, so it tiles along x at 32.
  // [0] intact [1] torn panel hanging from the rail, bare frame
  function awningShadeH(x,y){        // canvas colour for a stripe at slope row y
    var st=pmod(x,8)<4;
    if(y<=3)return st?'B':'R';
    if(y>=10)return st?'Y':'W';
    return st?'A':'V';
  }
  function makeAwningH(v){
    var w=32,h=16,g=mkGrid(w,h),x,y,st,q;
    rect(g,0,0,w-1,0,'K');rect(g,0,1,w-1,1,'N');
    for(x=0;x<w;x++){
      st=pmod(x,8)<4;q=pmod(x,4);
      for(y=2;y<=10;y++)g[y][x]=awningShadeH(x,y);
      g[11][x]=st?'B':'R';
      if(q===1||q===2){g[12][x]=st?'B':'R';g[13][x]='K';g[14][x]='O';g[15][x]='O';}
      else{g[12][x]='K';g[13][x]='O';g[14][x]='O';}
    }
    for(x=0;x<w;x+=16)setclip(g,x,1,'Z');                                // bracket bolts
    if(v===1){
      rect(g,10,2,21,15,'.');
      rect(g,10,2,21,2,'N');rect(g,10,2,10,11,'N');rect(g,21,2,21,11,'N');rect(g,10,11,21,11,'N');rect(g,11,7,20,7,'I'); // bare frame
      rect(g,10,12,21,12,'O');
      // flap still hooked on the rail, hanging straight down, torn bottom
      var FL=[9,11,8,10,7];
      for(x=12;x<=16;x++)for(y=2;y<=FL[x-12];y++)g[y][x]=pmod(x,8)<4?(y<=3?'B':'A'):(y<=3?'R':'V');
      for(x=12;x<=16;x++)setclip(g,x,FL[x-12]+1,'K');
      rect(g,11,2,11,9,'K');rect(g,17,2,17,7,'K');
      rect(g,18,3,20,3,'B');rect(g,18,4,19,4,'K');setclip(g,20,4,'K');    // shred stub
    }
    return toRows(g);
  }
  function makeAwningV(v){
    var w=16,h=32,g=mkGrid(w,h),x,y,st,q;
    rect(g,w-1,0,w-1,h-1,'K');rect(g,w-2,0,w-2,h-1,'N');
    for(y=0;y<h;y++){
      st=pmod(y,8)<4;q=pmod(y,4);
      for(x=4;x<=13;x++)g[y][x]=x>=12?(st?'B':'R'):(x===4?(st?'Y':'W'):(st?'A':'V'));
      g[y][3]=st?'B':'R';
      if(q===1||q===2){g[y][2]=st?'B':'R';g[y][1]='K';g[y][0]='O';}
      else{g[y][2]='K';g[y][1]='O';g[y][0]='O';}
    }
    for(y=0;y<h;y+=16)setclip(g,14,y,'Z');
    if(v===1){
      rect(g,0,10,13,21,'.');
      rect(g,4,10,13,10,'N');rect(g,4,21,13,21,'N');rect(g,4,10,4,21,'N');rect(g,9,11,9,20,'I');
      rect(g,3,11,3,20,'O');
      var FL=[6,8,5,7];
      for(y=12;y<=15;y++)for(x=FL[y-12];x<=13;x++)g[y][x]=pmod(y,8)<4?'A':'V';
      for(y=12;y<=15;y++)setclip(g,FL[y-12]-1,y,'K');
      rect(g,6,11,13,11,'K');rect(g,6,16,13,16,'K');
    }
    return toRows(g);
  }

  // =====================================================================
  // rear: rear walls, back door, bin nook, court walls, narrow extensions
  // =====================================================================
  function rearShellH(g,w,h){
    rect(g,0,0,w-1,0,'K');rect(g,0,1,w-1,1,'L');rect(g,0,2,w-1,2,'D');        // soldier course, no stone
    brickFaceH(g,0,3,w-1,h-3,h-3);
    rect(g,0,h-2,w-1,h-2,'D');rect(g,0,h-1,w-1,h-1,'K');
    rect(g,0,1,0,h-1,'K');rect(g,1,3,1,h-3,'L');rect(g,2,3,2,h-3,'D');
  }
  function drainpipeH(g,x,y0,y1){
    rect(g,x-1,y0,x+1,y0+1,'I');box(g,x-1,y0,x+1,y0+1,'N');                  // hopper head
    rect(g,x,y0+2,x,y1,'I');rect(g,x+1,y0+2,x+1,y1,'K');
    var y;for(y=y0+4;y<y1;y+=5){setclip(g,x-1,y,'N');setclip(g,x+1,y,'N');}
    rect(g,x,y1,x+2,y1,'N');                                                  // shoe
  }
  function smallWinH(g,x,y,kind){
    rect(g,x-1,y-1,x+5,y-1,'D');box(g,x,y,x+4,y+5,'K');rect(g,x+1,y+1,x+3,y+4,kind==='frosted'?'J':'G');
    if(kind!=='frosted')setclip(g,x+1,y+1,'J');rect(g,x-1,y+6,x+5,y+6,'F');
  }
  // rearWall_h 32x20 x2: plain rear brick. [0] small window + drainpipe [1] two small windows
  function makeRearWallH(v){
    var w=32,h=20,g=mkGrid(w,h);
    rearShellH(g,w,h);
    if(v===0){smallWinH(g,8,6,'frosted');drainpipeH(g,26,2,17);}
    else{smallWinH(g,8,6);smallWinH(g,20,6,'frosted');}
    return toRows(g);
  }
  function makeRearWallV(v){
    var w=12,h=32,g=mkGrid(w,h);
    rect(g,0,0,0,h-1,'K');rect(g,1,0,1,h-1,'D');
    brickFaceV(g,2,0,w-4,h-1,2);
    rect(g,w-3,0,w-3,h-1,'D');rect(g,w-2,0,w-2,h-1,'L');rect(g,w-1,0,w-1,h-1,'K');
    rect(g,0,0,w-2,0,'K');rect(g,1,1,w-4,1,'L');rect(g,1,2,w-4,2,'D');
    if(v===0){box(g,2,8,6,12,'K');rect(g,3,9,5,11,'J');rect(g,0,24,2,26,'I');box(g,0,24,2,26,'N');setclip(g,1,25,'K');}
    else{box(g,2,8,6,12,'K');rect(g,3,9,5,11,'G');box(g,2,20,6,24,'K');rect(g,3,21,5,23,'J');}
    return toRows(g);
  }
  // backDoor_h 32x20: rear wall with a plank back door, step and drainpipe
  function makeBackDoorH(){
    var w=32,h=20,g=mkGrid(w,h);
    rearShellH(g,w,h);
    rect(g,9,5,18,5,'D');
    box(g,10,6,17,18,'K');rect(g,11,7,16,17,'U');
    rect(g,11,9,16,9,'X');rect(g,11,14,16,14,'X');rect(g,13,7,13,17,'X');setclip(g,15,12,'C');
    line(g,11,10,15,13,'X');
    rect(g,8,18,19,18,'E');rect(g,9,18,18,18,'C');rect(g,8,19,19,19,'K');
    drainpipeH(g,25,2,17);
    return toRows(g);
  }
  function makeBackDoorV(){
    var w=12,h=32,g=makeRearWallVgrid();
    rect(g,0,10,4,21,'K');rect(g,0,11,0,20,'E');rect(g,1,11,1,20,'C');
    rect(g,2,11,3,20,'U');rect(g,2,15,3,15,'X');rect(g,4,11,4,20,'K');
    return toRows(g);
  }
  function makeRearWallVgrid(){
    var w=12,h=32,g=mkGrid(w,h);
    rect(g,0,0,0,h-1,'K');rect(g,1,0,1,h-1,'D');
    brickFaceV(g,2,0,w-4,h-1,2);
    rect(g,w-3,0,w-3,h-1,'D');rect(g,w-2,0,w-2,h-1,'L');rect(g,w-1,0,w-1,h-1,'K');
    rect(g,0,0,w-2,0,'K');rect(g,1,1,w-4,1,'L');rect(g,1,2,w-4,2,'D');
    return g;
  }
  // binNook_h 32x20: rear wall with a recessed bin bay, two wheelie bins
  function makeBinNookH(){
    var w=32,h=20,g=mkGrid(w,h);
    rearShellH(g,w,h);
    rect(g,5,6,27,19,'K');rect(g,6,7,26,17,'D');rect(g,5,5,27,5,'F');rect(g,6,7,6,17,'M');
    rect(g,6,18,26,18,'F');
    function bin(x,body,lid,hi){
      box(g,x,7,x+8,10,'K');rect(g,x+1,8,x+7,8,hi);rect(g,x+1,9,x+7,9,lid);            // overhanging lid
      box(g,x+1,10,x+7,17,'K');rect(g,x+2,11,x+6,16,body);rect(g,x+2,11,x+2,16,lid);   // body, lit left edge
      rect(g,x+4,12,x+5,12,'K');                                                        // front grip
      rect(g,x+1,18,x+2,18,'K');rect(g,x+6,18,x+7,18,'K');                             // wheels
    }
    bin(6,'B','A','Y');bin(16,'N','I','Z');
    rect(g,25,14,26,17,'N');box(g,24,13,27,18,'K');setclip(g,25,14,'I');               // tied bag
    rect(g,5,19,27,19,'K');
    return toRows(g);
  }
  function makeBinNookV(){
    var w=16,h=32,g=mkGrid(w,h);
    rect(g,4,0,4,h-1,'K');rect(g,5,0,5,h-1,'D');
    brickFaceV(g,6,0,w-4,h-1,6);
    rect(g,w-3,0,w-3,h-1,'D');rect(g,w-2,0,w-2,h-1,'L');rect(g,w-1,0,w-1,h-1,'K');
    rect(g,4,0,w-2,0,'K');rect(g,5,1,w-4,1,'L');rect(g,5,2,w-4,2,'D');
    rect(g,5,5,10,27,'K');rect(g,6,6,10,26,'D');
    function bin(y,body,lid){rect(g,1,y,9,y+8,body);rect(g,7,y,9,y+8,lid);box(g,1,y,9,y+8,'K');rect(g,2,y+1,2,y+7,lid==='A'?'P':'Z');}
    bin(6,'B','A');bin(17,'N','I');
    return toRows(g);
  }
  // courtWall_h 32x14 x2: brick yard wall with stone coping, pier every 32
  function makeCourtWallH(v){
    var w=32,h=14,g=mkGrid(w,h),x;
    rect(g,0,0,w-1,0,'K');rect(g,0,1,w-1,1,'C');rect(g,0,2,w-1,2,'E');rect(g,0,3,w-1,3,'F');
    brickFaceH(g,0,4,w-1,h-3,h-3);
    rect(g,0,h-2,w-1,h-2,'D');rect(g,0,h-1,w-1,h-1,'K');
    rect(g,0,0,3,0,'K');rect(g,0,1,3,1,'P');rect(g,0,2,3,h-3,'M');rect(g,0,2,0,h-1,'K');rect(g,1,2,1,h-3,'L');rect(g,3,2,3,h-3,'D');
    for(x=8;x<w;x+=8)setclip(g,x,2,'F');
    if(v===1){rect(g,19,1,23,3,'M');rect(g,19,1,23,1,'K');rect(g,19,2,23,2,'L');setclip(g,19,2,'P');rect(g,24,1,24,3,'K');} // fresh knocked-off coping
    return toRows(g);
  }
  function makeCourtWallV(v){
    var w=10,h=32,g=mkGrid(w,h),y;
    rect(g,0,0,0,h-1,'K');rect(g,1,0,1,h-1,'D');
    brickFaceV(g,2,0,4,h-1,2);
    rect(g,5,0,5,h-1,'F');rect(g,6,0,6,h-1,'E');rect(g,7,0,7,h-1,'C');rect(g,8,0,8,h-1,'C');rect(g,9,0,9,h-1,'K');
    rect(g,0,0,9,0,'K');rect(g,1,1,8,2,'M');rect(g,1,1,8,1,'P');rect(g,1,3,8,3,'D');
    for(y=8;y<h;y+=8)setclip(g,6,y,'F');
    if(v===1){rect(g,6,18,8,22,'M');rect(g,6,18,6,22,'L');setclip(g,6,18,'P');rect(g,6,17,8,17,'K');rect(g,6,23,8,23,'K');}
    return toRows(g);
  }
  // courtGate_h 32x14 / courtGate_v 10x32: court wall with a timber back gate
  function makeCourtGateH(){
    var g=mkGrid(32,14),x;
    var base=makeCourtWallH(0);for(var y=0;y<14;y++)g[y]=base[y].split('');
    rect(g,10,0,23,13,'.');
    rect(g,9,1,9,13,'K');rect(g,24,1,24,13,'K');
    rect(g,10,3,23,12,'U');for(x=11;x<23;x+=3)rect(g,x,3,x,12,'X');
    rect(g,10,5,23,5,'X');rect(g,10,10,23,10,'X');line(g,11,10,22,5,'X');
    rect(g,10,2,23,2,'K');rect(g,10,13,23,13,'K');setclip(g,21,8,'I');
    return toRows(g);
  }
  function makeCourtGateV(){
    var g=mkGrid(10,32),y;
    var base=makeCourtWallV(0);for(y=0;y<32;y++)g[y]=base[y].split('');
    rect(g,0,9,9,22,'.');
    rect(g,0,8,9,8,'K');rect(g,0,23,9,23,'K');
    rect(g,3,9,6,22,'U');rect(g,2,9,2,22,'K');rect(g,7,9,7,22,'K');
    for(y=11;y<22;y+=3)rect(g,3,y,6,y,'X');setclip(g,4,19,'I');
    return toRows(g);
  }
  // narrow rear extensions (outriggers): mono-pitch slate roof, brick end wall
  // rearExt_s 20x44: projects SOUTH from a rear edge; its end face with a back
  // door is seen three-quarter at the bottom. Anchor {x:.5,y:0} on the rear edge.
  function makeRearExtS(){
    var w=20,h=44,g=mkGrid(w,h),y,x;
    for(y=0;y<=29;y++)for(x=1;x<=18;x++)g[y][x]=pmod(y,4)===3?'T':(x<=4?'Q':'S');
    rect(g,1,0,18,0,'T');
    rect(g,15,0,15,29,'K');rect(g,16,0,16,29,'C');rect(g,17,0,17,29,'E');rect(g,18,0,18,29,'D'); // shadowed parapet side
    rect(g,1,29,18,29,'K');rect(g,1,30,18,30,'C');rect(g,1,31,18,31,'E');
    brickFaceH(g,1,32,18,41,41);
    rect(g,1,42,18,42,'D');rect(g,0,43,19,43,'K');
    box(g,6,33,12,42,'K');rect(g,7,34,11,41,'U');rect(g,7,37,11,37,'X');setclip(g,11,39,'C');
    drainpipeH(g,16,30,42);
    rect(g,0,0,0,43,'K');rect(g,19,0,19,43,'K');
    return toRows(g);
  }
  // rearExt_n 20x36: projects NORTH from a rear edge (roof only in plan).
  // Anchor {x:.5,y:1} on the rear edge.
  function makeRearExtN(){
    var w=20,h=36,g=mkGrid(w,h),y;
    for(y=0;y<h;y++){rect(g,1,y,4,y,'Q');rect(g,5,y,14,y,pmod(y,4)===0?'T':'S');rect(g,15,y,18,y,'D');}
    rect(g,15,0,15,h-1,'K');
    rect(g,1,0,18,0,'K');rect(g,1,1,14,1,'C');rect(g,1,2,14,2,'F');
    rect(g,0,0,0,h-1,'K');rect(g,19,0,19,h-1,'K');
    rect(g,16,2,17,3,'I');box(g,16,2,17,3,'N');                     // pipe outlet at the gutter end
    rect(g,1,h-1,18,h-1,'T');
    return toRows(g);
  }
  // rearExt_h 40x22: projects EAST from a rear/side edge; its long south
  // face is seen at the bottom. Anchor {x:0,y:1} with the base on the
  // building's south line; flip for a west projection.
  function makeRearExtH(){
    var w=40,h=22,g=mkGrid(w,h),x;
    for(x=0;x<w;x++){rect(g,x,1,x,10,pmod(x,4)===3?'T':'S');setclip(g,x,1,'Q');setclip(g,x,2,'Q');}
    rect(g,0,0,w-1,0,'K');rect(g,w-1,0,w-1,h-1,'K');
    rect(g,0,11,w-1,11,'K');rect(g,0,12,w-1,12,'C');rect(g,0,13,w-1,13,'E');
    brickFaceH(g,0,14,w-2,h-3,h-3);
    rect(g,0,h-2,w-2,h-2,'D');rect(g,0,h-1,w-1,h-1,'K');
    smallWinH(g,8,14,'frosted');
    box(g,24,14,30,20,'K');rect(g,25,15,29,19,'U');rect(g,25,17,29,17,'X');
    drainpipeH(g,36,12,20);
    return toRows(g);
  }

  // =====================================================================
  // Old Quarter masonry terraces
  // =====================================================================
  // ashlar courses 4 rows, head joints period 8 staggered 4, per-stone tint
  // from a period-32 table. yRef keeps courses aligned across stepped eaves.
  function ashlarH(g,x0,y0,x1,y1,yRef){
    var x,y,c,off,t,r;
    for(y=y0;y<=y1;y++){
      r=pmod(yRef-y,4);c=Math.floor((yRef-y)/4);off=pmod(c,2)*4;
      for(x=x0;x<=x1;x++){
        if(r===0){setclip(g,x,y,'D');continue;}
        if(pmod(x+off,8)===0){setclip(g,x,y,'D');continue;}
        t=tintAt(Math.floor((x+off)/8),c);
        setclip(g,x,y,r===3&&t!==1?'L':(t===2&&r===1?'D':'M'));
      }
    }
  }
  function ashlarV(g,x0,y0,x1,y1,xRef){
    var x,y,c,off,t,r;
    for(x=x0;x<=x1;x++){
      r=pmod(x-xRef,4);c=Math.floor((x-xRef)/4);off=pmod(c,2)*4;
      for(y=y0;y<=y1;y++){
        if(r===3){setclip(g,x,y,'D');continue;}
        if(pmod(y+off,8)===0){setclip(g,x,y,'D');continue;}
        t=tintAt(Math.floor((y+off)/8),c);
        setclip(g,x,y,r===0&&t!==1?'L':'M');
      }
    }
  }
  // tall sash with stone lintel and sill in masonry
  function sashM(g,x,y,w,h,kind){
    rect(g,x-1,y-2,x+w,y-1,'H');rect(g,x-1,y-1,x+w,y-1,'L');setclip(g,x+Math.floor(w/2),y-2,'L');
    box(g,x,y,x+w-1,y+h-1,'K');rect(g,x+1,y+1,x+w-2,y+h-2,'G');rect(g,x+1,y+Math.floor(h/2),x+w-2,y+Math.floor(h/2),'N');setclip(g,x+1,y+1,'J');
    if(kind==='shutters'){rect(g,x+1,y+1,x+w-2,y+h-2,'U');var yy;for(yy=y+2;yy<y+h-1;yy+=2)rect(g,x+1,yy,x+w-2,yy,'Y');}
    if(kind==='lamp'){setclip(g,x+2,y+h-3,'Y');}
    rect(g,x-1,y+h,x+w,y+h,'L');rect(g,x,y+h+1,x+w-1,y+h+1,'D');
  }
  // terrace_h 32x28 x3: masonry terrace house front with a raised party-wall
  // parapet at x0..2 and a per-house eave height (stepped roof edge).
  // [0] eave row 0, two sashes [1] eave row 3, door with fanlight [2] eave row 6, shuttered
  var TERRACE_TOP=[0,3,6];
  function makeTerraceH(v){
    var w=32,h=28,g=mkGrid(w,h),t=TERRACE_TOP[v];
    rect(g,3,t,w-1,t,'H');rect(g,3,t+1,w-1,t+1,'K');rect(g,3,t+2,w-1,t+2,'H');rect(g,3,t+3,w-1,t+3,'L');rect(g,3,t+4,w-1,t+4,'D'); // lit coping cap, gutter, cornice, shadow
    if(t>0){rect(g,3,0,3,t-1,'T');rect(g,3,t-1,6,t-1,'T');}                    // shadow of the higher neighbour's parapet on this lower roof
    var x;for(x=4;x<w;x+=4)setclip(g,x,t+3,'M');                                                   // dentils (period 4)
    ashlarH(g,3,t+5,w-1,h-3,h-3);
    rect(g,3,h-2,w-1,h-2,'D');rect(g,0,h-1,w-1,h-1,'K');
    // party-wall parapet: always full height so any eave step lands on it
    rect(g,0,0,0,h-1,'K');rect(g,1,0,1,h-2,'L');rect(g,2,0,2,h-2,'D');rect(g,0,0,2,0,'K');rect(g,1,1,2,1,'H');rect(g,0,1,0,1,'K');
    if(v===0){sashM(g,8,t+9,5,10);sashM(g,21,t+9,5,10);}
    if(v===1){
      sashM(g,8,t+9,5,10);
      rect(g,19,t+6,27,t+7,'H');box(g,20,t+8,26,25,'K');rect(g,21,t+9,25,t+10,'J');rect(g,21,t+11,25,t+11,'K');rect(g,23,t+9,23,t+10,'N');
      rect(g,21,t+12,25,24,'U');rect(g,22,t+13,22,23,'Y');rect(g,24,t+13,24,23,'Y');setclip(g,25,t+17,'H');
      rect(g,19,26,27,26,'L');rect(g,18,27,28,27,'K');
    }
    if(v===2){sashM(g,8,t+9,5,9,'shutters');sashM(g,21,t+9,5,9);}
    return toRows(g);
  }
  // terrace_v 14x32 x3: plan along a N-S street. Party wall across rows 0..2;
  // the eave step is a 0/1/2-column change in the slate lip width.
  function makeTerraceV(v){
    var w=14,h=32,g=mkGrid(w,h),s=v;
    rect(g,0,0,0,h-1,'K');rect(g,1,0,1,h-1,'D');
    ashlarV(g,2,0,8-s,h-1,2);
    rect(g,9-s,0,9-s,h-1,'L');rect(g,10-s,0,10-s,h-1,'H');rect(g,11-s,0,11-s,h-1,'T');
    rect(g,12-s,0,w-2,h-1,'S');rect(g,w-1,0,w-1,h-1,'K');
    rect(g,0,0,w-1,0,'K');rect(g,1,1,w-2,1,'H');rect(g,1,2,w-2,2,'D');
    var y;for(y=4;y<h;y+=4)setclip(g,9-s,y,'M');
    function tick(y0,y1,ch,top){rect(g,1,y0,2,y1,ch);rect(g,1,y0,2,y0,top);rect(g,3,y0+1,3,y1-1,'D');}
    if(v===1){rect(g,0,17,3,25,'L');rect(g,0,17,3,17,'H');rect(g,1,25,3,25,'D');rect(g,4,17,4,25,'K');rect(g,5,18,5,24,'U');}
    else{tick(8,13,v===2?'U':'L',v===2?'Y':'H');tick(21,26,'L','H');}
    return toRows(g);
  }
  // masonryEaves_n 32x8: north-facing terrace edge in plan (street row 0)
  function makeMasonryEavesN(){
    var w=32,h=8,g=mkGrid(w,h),x;
    rect(g,0,0,w-1,0,'K');rect(g,0,1,w-1,1,'D');
    ashlarH(g,3,2,w-1,3,4);
    rect(g,0,4,w-1,4,'L');rect(g,0,5,w-1,5,'H');rect(g,0,6,w-1,6,'T');rect(g,0,7,w-1,7,'S');
    for(x=4;x<w;x+=4)setclip(g,x,4,'M');
    rect(g,0,0,0,7,'K');rect(g,1,1,1,7,'H');rect(g,2,1,2,7,'D');
    return toRows(g);
  }
  // terraceCorner 14x28: SW terrace corner with long-and-short quoins (flip for SE)
  function makeTerraceCorner(){
    var w=14,h=28,g=mkGrid(w,h),y,q;
    rect(g,0,0,w-1,0,'H');rect(g,0,0,0,0,'K');rect(g,1,1,w-1,1,'K');rect(g,1,2,w-1,2,'H');rect(g,1,3,w-1,3,'L');rect(g,1,4,w-1,4,'D');
    ashlarH(g,1,5,w-1,h-3,h-3);
    rect(g,1,h-2,w-1,h-2,'D');rect(g,0,h-1,w-1,h-1,'K');rect(g,0,0,0,h-1,'K');
    for(y=5,q=0;y+3<=h-3;y+=4,q++){var len=q%2?3:6;rect(g,1,y,len,y+2,'L');rect(g,1,y,len,y,'H');rect(g,len+1,y,len+1,y+2,'D');rect(g,1,y+3,len+1,y+3,'D');}
    return toRows(g);
  }
  // chunk helper for rubble: fill, lit top row, optional glint
  function chunk(g,x,y,w,h,fill,top,glint){
    rect(g,x,y,x+w-1,y+h-1,fill);rect(g,x,y,x+w-1,y,top);
    if(glint)setclip(g,x,y,glint);
  }
  // shadow ring: base-colour texels right of / below a chunk turn K, so chunks
  // separate from the dark heap mass (light from the upper left)
  function ringOn(g,base,K){
    var h=g.length,w=g[0].length,x,y,src=g.map(function(r){return r.slice();});
    function solid(ch){return ch!=='.'&&ch!==base&&ch!==K;}
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      if(src[y][x]!==base)continue;
      if((x>0&&solid(src[y][x-1]))||(y>0&&solid(src[y-1][x])))g[y][x]=K;
    }
  }
  // collapse_h 32x28: fresh collapse cross-section ending a terrace run, gap
  // to the RIGHT. Reads as one light room interior framed by dark broken
  // edges: torn slate roof with cut rafter ends (rows 0-6), a narrow stepped
  // stub of the front wall (left), the far party-wall end (x28-31), a heap at
  // the foot. Inside: pale papered back wall, the first-floor slab snapped
  // into two dark joist stubs, a fireplace on the ground floor.
  function makeCollapseH(){
    var w=32,h=28,g=mkGrid(w,h),x,y;
    // roof: slate courses down to a ragged tear
    var RB=[0,0,0,4,4,4,4,3,3,3,4,4,4,3,3,3,4,5,5,4,4,3,3,3,4,4,3,3,3,3,3,3];
    for(x=3;x<=27;x++)for(y=0;y<=RB[x];y++)g[y][x]=pmod(y,3)===2?'T':(pmod(x+y*2,6)===0?'Q':'S');
    // room: upper floor (lit paper) / floor line / ground floor (shaded paper)
    function paper(x,y){
      if(y<=12)return pmod(x,4)===1?'V':'P';
      if(y<=14)return 'R';
      if(y===15)return 'W';
      return pmod(x,4)===1?'W':'V';
    }
    for(x=3;x<=27;x++)for(y=RB[x]+1;y<=22;y++){
      if(y===RB[x]+1){g[y][x]='K';continue;}
      if(y===RB[x]+2){g[y][x]='W';continue;}
      g[y][x]=paper(x,y);
    }
    rect(g,19,7,23,10,'V');rect(g,20,8,22,9,'P');rect(g,21,6,21,6,'W');                       // pale ghost of a picture frame
    // cut rafter ends hanging from the tear
    [[11,5],[18,6],[24,5]].forEach(function(r){rect(g,r[0],r[1],r[0],r[1]+2,'Y');rect(g,r[0]+1,r[1],r[0]+1,r[1]+2,'K');setclip(g,r[0],r[1]+3,'K');});
    // joist stubs: horizontal dark bars left in both walls, the middle gone
    rect(g,8,13,16,14,'U');rect(g,8,13,15,13,'Y');rect(g,8,15,16,15,'K');rect(g,17,13,17,14,'K');
    rect(g,22,13,27,14,'U');rect(g,23,13,27,13,'Y');rect(g,21,13,21,14,'K');rect(g,21,15,27,15,'K');
    rect(g,14,16,16,17,'U');rect(g,14,18,16,18,'K');setclip(g,13,16,'K');setclip(g,13,17,'K');  // snapped end sagging
    // fireplace: light surround, dark 4x5 opening, hearth
    rect(g,17,16,24,16,'H');rect(g,18,17,23,22,'P');rect(g,19,17,22,21,'K');rect(g,18,22,23,22,'L');rect(g,17,17,17,22,'R');
    // front wall stub, broken back in steps along its courses
    var ED=[5,5,5,5,5,5,5,5,5,5,5,6,6,6,6,6,6,8,8,8,8,8,9,9,9,9,9,9]; // last masonry column per row
    var tmp=mkGrid(w,h);ashlarH(tmp,3,5,10,27,25);
    for(y=5;y<=25;y++){
      for(x=3;x<=ED[y];x++)g[y][x]=tmp[y][x];
      setclip(g,ED[y],y,'L');setclip(g,ED[y]+1,y,'K');
      if(y>5&&ED[y]>ED[y-1]){rect(g,ED[y-1]+1,y,ED[y],y,'H');setclip(g,ED[y],y,'Z');rect(g,ED[y-1]+2,y-1,ED[y]+1,y-1,get(g,ED[y]+1,y-1)==='K'?'K':'K');}
    }
    // intact eave over the stub
    rect(g,3,0,6,0,'H');rect(g,3,1,6,1,'K');rect(g,3,2,6,2,'H');rect(g,3,3,6,3,'L');rect(g,3,4,6,4,'D');rect(g,7,0,7,4,'K');
    // far party-wall end, ragged top, lit break face
    var PT=[4,2,3,5];
    for(x=28;x<=31;x++)for(y=PT[x-28];y<=26;y++)g[y][x]=x===28?'K':x===29?'L':x===30?(pmod(y,4)===0?'D':'M'):'K';
    setclip(g,29,4,'Z');setclip(g,30,2,'Z');setclip(g,29,3,'K');setclip(g,30,1,'K');setclip(g,31,4,'K');setclip(g,28,3,'K');
    // heap at the foot: dark base mass, chunks, a slate shard, plaster lumps
    var HT=[27,27,27,24,23,22,21,21,21,22,22,21,20,21,21,22,22,21,21,22,23,22,21,21,22,22,23,23,22,21,21,22];
    for(x=3;x<=31;x++)for(y=HT[x];y<=26;y++)g[y][x]='D';
    [[4,22,3,2,'M','L','Z'],[8,21,3,2,'M','L',0],[12,20,2,2,'M','H',0],[15,22,3,2,'V','P',0],[19,21,3,2,'M','L','Z'],[23,22,2,2,'M','L',0],[26,23,3,2,'M','L',0],[29,21,2,2,'M','L',0],[10,24,2,2,'M','L',0],[21,24,3,1,'S','Q',0],[6,25,2,1,'M','L',0]]
      .forEach(function(c){chunk(g,c[0],c[1],c[2],c[3],c[4],c[5],c[6]||null);});
    ringOn(g,'D','K');
    for(x=3;x<=31;x++)if(get(g,x,HT[x]-1)!=='.'&&'DMLHZVPSQ'.indexOf(get(g,x,HT[x]))<0)continue;else if(HT[x]>0&&get(g,x,HT[x])==='D')setclip(g,x,HT[x]-1,'K');
    // party-wall parapet on the intact side + ground contact
    rect(g,0,0,0,h-1,'K');rect(g,1,0,1,h-2,'L');rect(g,2,0,2,h-2,'D');rect(g,0,0,2,0,'K');rect(g,1,1,2,1,'H');
    rect(g,0,h-1,w-1,h-1,'K');
    return toRows(g);
  }
  // collapse_v 14x32: the same break in plan along a N-S street, gap BELOW.
  // Wall band intact at the top, a ~6-deep jagged tear with lit break faces,
  // dark void of the lost house behind it, three separate joist ends.
  function makeCollapseV(){
    var w=14,h=32,g=mkGrid(w,h),y,x;
    var BOT=[17,16,14,11,13,10,12,15,12,10,13,11,14,16];
    rect(g,0,0,0,h-1,'K');rect(g,1,0,1,h-1,'D');
    ashlarV(g,2,0,8,h-1,2);
    rect(g,9,0,9,h-1,'L');rect(g,10,0,10,h-1,'H');rect(g,11,0,11,h-1,'T');rect(g,12,0,12,h-1,'S');rect(g,w-1,0,w-1,h-1,'K');
    rect(g,0,0,w-1,0,'K');rect(g,1,1,w-2,1,'H');rect(g,1,2,w-2,2,'D');
    for(x=0;x<w;x++){for(y=BOT[x]+1;y<h;y++)g[y][x]='K';setclip(g,x,BOT[x],pmod(x,3)===0?'Z':'H');}
    // dust and shards lying in the void
    chunk(g,2,25,2,2,'M','L');chunk(g,8,27,3,2,'M','L');chunk(g,9,21,2,2,'W','P');rect(g,4,29,6,29,'S');setclip(g,4,29,'Q');
    // joist ends: separate 1x3 bars out of the tear
    [2,6,11].forEach(function(jx){rect(g,jx,BOT[jx]+1,jx,BOT[jx]+3,'Y');});
    return toRows(g);
  }
  // partyWall_v 10x32 x2: exposed party wall left standing along a collapse
  // gap, in plan. Stone top x1-4 (lit edge with chipped notches), the torn
  // room's pale papered face x5-8 (same paper as collapse_h), joist pockets.
  // [1] a fresh chunk knocked out of the top.
  function makePartyWallV(v){
    var w=10,h=32,g=mkGrid(w,h),y;
    for(y=0;y<h;y++){
      g[y][0]='K';g[y][1]='L';g[y][2]=pmod(y,8)===0?'D':'M';g[y][3]=pmod(y+4,8)===0?'D':'M';g[y][4]='D';
      g[y][5]='R';g[y][6]=pmod(y,4)===2?'V':'P';g[y][7]='P';g[y][8]='V';g[y][9]='K';
    }
    [[3,1],[19,2],[26,1]].forEach(function(n){rect(g,1,n[0],n[1],n[0]+1,'K');setclip(g,n[1]+1,n[0],'Z');});
    [5,21].forEach(function(py){rect(g,7,py,8,py+1,'K');setclip(g,6,py,'W');});
    rect(g,5,13,8,13,'W');rect(g,5,29,8,29,'W');
    if(v===1){rect(g,3,11,9,17,'.');rect(g,2,11,2,17,'K');rect(g,3,10,8,10,'K');rect(g,3,18,8,18,'K');rect(g,3,11,3,17,'Z');rect(g,1,12,1,16,'H');}
    return toRows(g);
  }
  function makePartyWallH(v){
    var w=32,h=10,g=mkGrid(w,h),x;
    for(x=0;x<w;x++){
      g[0][x]='K';g[1][x]='L';g[2][x]=pmod(x,8)===0?'D':'M';g[3][x]=pmod(x+4,8)===0?'D':'M';g[4][x]='D';
      g[5][x]='R';g[6][x]=pmod(x,4)===2?'V':'P';g[7][x]='P';g[8][x]='V';g[9][x]='K';
    }
    [[3,1],[19,2],[26,1]].forEach(function(n){rect(g,n[0],1,n[0]+1,n[1],'K');setclip(g,n[0],n[1]+1,'Z');});
    [5,21].forEach(function(px){rect(g,px,7,px+1,8,'K');setclip(g,px,6,'W');});
    rect(g,13,5,13,8,'W');rect(g,29,5,29,8,'W');
    if(v===1){rect(g,11,3,17,9,'.');rect(g,11,2,17,2,'K');rect(g,10,3,10,8,'K');rect(g,18,3,18,8,'K');rect(g,11,3,17,3,'Z');rect(g,12,1,16,1,'H');}
    return toRows(g);
  }
  // collapseFloor 32x32 x3: FLAT, tileable in x and y. The exposed ground
  // floor of a fallen house from above: dark cellar void, joists every 8 rows
  // (rows 3-4 of each period), dusty surviving boards across them, big open
  // holes, plaster lumps and slate shards. Joists span the full width;
  // everything else stays inside x1-30 / y1-30, so any variant order tiles.
  function makeCollapseFloor(v){
    var w=32,h=32,g=mkGrid(w,h),x,y,rng=mulberry32(900+v*37);
    rect(g,0,0,w-1,h-1,'K');
    for(y=3;y<h;y+=8){rect(g,0,y,w-1,y,'W');rect(g,0,y+1,w-1,y+1,'D');}
    // boards: [x0,x1,y0,y1] patches running N-S across the joists, ragged ends
    var BOARDS=[[[2,12,1,13],[20,29,17,29]],[[15,28,2,21],[3,9,18,27]],[[2,8,2,12],[12,24,10,20],[22,29,24,30]]][v];
    BOARDS.forEach(function(b){
      for(x=b[0];x<=b[1];x++){
        var t=b[2]+Math.floor(rng()*3),bo=b[3]-Math.floor(rng()*3);
        for(y=t;y<=bo;y++)g[y][x]=pmod(x-b[0],3)===2?'D':(pmod(y*2+x,11)===0?'L':'M');
        setclip(g,x,bo+1,'K');
      }
    });
    // holes punched through the surviving boards (at least 6x4 of void); joists stay
    var HOLES=[[[5,6,10,10]],[[19,6,24,10]],[[14,13,19,17]]][v];
    HOLES.forEach(function(r){for(y=r[1];y<=r[3];y++)for(x=r[0];x<=r[2];x++)g[y][x]=pmod(y,8)===3?'W':pmod(y,8)===4?'D':'K';});
    // lumps: plaster (paper) and masonry, lit top, K shadow right/below
    var LUMPS=[[[16,8,'V'],[25,5,'M'],[7,22,'M'],[13,26,'V']],[[6,6,'V'],[26,25,'M'],[10,12,'M']],[[24,6,'M'],[5,23,'V'],[26,13,'M']]][v];
    LUMPS.forEach(function(l){chunk(g,l[0],l[1],2,2,l[2],l[2]==='V'?'P':'L');rect(g,l[0],l[1]+2,l[0]+2,l[1]+2,'K');rect(g,l[0]+2,l[1],l[0]+2,l[1]+1,'K');});
    var SH=[[[22,13],[9,29]],[[4,14],[18,27]],[[16,4],[9,15]]][v];
    SH.forEach(function(s2){rect(g,s2[0],s2[1],s2[0]+2,s2[1],'S');setclip(g,s2[0],s2[1],'Q');rect(g,s2[0],s2[1]+1,s2[0]+2,s2[1]+1,'K');});
    return toRows(g);
  }
  // collapseSpill 48x36 x2: rubble heap poured out of a collapse gap; its
  // source is the gap itself. Rows 0-11 sit INSIDE the gap, piled highest
  // against both flanking party walls (x0-6, x41-47) and dipping in the
  // middle; row 12 is the street line; rows 12-35 fan onto the pavement.
  // Chunks 2x2..5x3 with lit tops and K shadow rings on a dark base mass,
  // snapped joists stick out. [0] masonry + plaster + fallen slate shards
  // [1] South Blocks brick. Anchor {x:.5,y:1/3}: row 12 on the street line.
  function makeCollapseSpill(v){
    var w=48,h=36,g=mkGrid(w,h),rng=mulberry32(v?1521:1517),x,y,i;
    var M_=v?'B':'M',L_=v?'E':'L',B_='D';
    var TOPE=[];
    for(x=0;x<w;x++){var d=Math.min(x,w-1-x);TOPE.push(d<=6?Math.floor(d/3):Math.min(8,2+Math.floor((d-6)/2))+(pmod(x*7,5)===0?1:0));}
    function inside(x,y){
      if(x<0||x>=w||y<0||y>=h)return false;
      if(y<TOPE[x])return false;
      if(y<=13)return true;
      var f=(y-13)/23,hw=Math.round(24*Math.sqrt(Math.max(0,1-f*f))-2*f+(pmod(y*5+x*3,4)===0?-1:0));
      return Math.abs(x-23.5)<=hw;
    }
    for(y=0;y<h;y++)for(x=0;x<w;x++)if(inside(x,y))g[y][x]=B_;
    // chunks: big and dense near the gap, small and sparse on the fan
    for(i=0;i<400;i++){
      x=Math.floor(rng()*w);y=Math.floor(rng()*h);
      var big=y<14,cw=big?3+Math.floor(rng()*3):2+Math.floor(rng()*2),chh=big&&rng()<0.5?3:2;
      if(y>26)cw=2;
      if(!inside(x,y)||!inside(x+cw-1,y+chh-1)||!inside(x,y+chh-1)||!inside(x+cw-1,y))continue;
      var ok=true,xx,yy;for(yy=y-1;yy<=y+chh;yy++)for(xx=x-1;xx<=x+cw;xx++){var q=get(g,xx,yy);if(q!==B_&&q!=='.')ok=false;}
      if(!ok)continue;
      if(y>22&&rng()<(y-22)/16)continue;
      var plaster=rng()<(v?0.3:0.18);
      chunk(g,x,y,cw,chh,plaster?(v?'M':'V'):M_,plaster?(v?'L':'P'):L_,y<12&&rng()<0.3?'Z':null);
    }
    // snapped joists poking out of the heap
    line(g,7,2,19,8,'U');line(g,8,2,20,8,'U');line(g,8,1,20,7,'Y');
    rect(g,33,5,40,6,'U');rect(g,33,5,40,5,'Y');
    // fallen slate shards (Old Quarter) / broken brick halves (South Blocks)
    var SL=v===0?[[14,15],[29,18],[22,24],[35,12],[10,10]]:[[14,15],[30,19],[22,25]];
    SL.forEach(function(p2){rect(g,p2[0],p2[1],p2[0]+2,p2[1],v===0?'S':'B');setclip(g,p2[0],p2[1],v===0?'Q':'E');});
    ringOn(g,B_,'K');
    outlineOut(g,'K');
    // a few loose 2x2 lumps just past the fan edge
    [[7,28],[39,26],[14,33],[32,33]].forEach(function(p3){if(get(g,p3[0],p3[1])==='.'&&get(g,p3[0]+1,p3[1]+1)==='.'&&get(g,p3[0]+2,p3[1]+2)==='.'){chunk(g,p3[0],p3[1],2,2,M_,L_);rect(g,p3[0],p3[1]+2,p3[0]+2,p3[1]+2,'K');rect(g,p3[0]+2,p3[1],p3[0]+2,p3[1]+1,'K');}});
    return toRows(g);
  }

  A.define('frontage',{

    // ---- South Blocks: street front ----
    brickRow_h:{variants:[makeBrickRowH(0),makeBrickRowH(1),makeBrickRowH(2)],pal:BRICK_PAL,anchor:{x:0,y:1},note:'32x24 attached brick house section, face seen from the south, street = bottom row; party pier at x0-2; [0] two sashes [1] sash + front door [2] boarded + taped; tiles along x at 32'},
    brickRow_v:{variants:[makeBrickRowV(0),makeBrickRowV(1),makeBrickRowV(2)],pal:BRICK_PAL,anchor:{x:0,y:0},note:'14x32 brick section in plan, street = column 0, coping on the roof side; party wall at y0-2; tiles along y at 32; flip for east edges'},
    brickEaves_n:{rows:makeBrickEavesN(),pal:BRICK_PAL,anchor:{x:0,y:0},note:'32x8 north-facing brick edge in plan, street = row 0; tiles along x at 32'},
    brickCorner:{rows:makeBrickCorner(),pal:BRICK_PAL,anchor:{x:0,y:1},note:'14x24 SW street corner with stone quoins; caps a _h run and a _v run; flip for SE'},
    entrance_h:{rows:makeEntranceH(),pal:BRICK_PAL,anchor:{x:0,y:1},note:'32x24 recessed porch entrance (tiled floor, door at the back), replaces one brickRow_h tile'},
    entrance_v:{rows:makeEntranceV(),pal:BRICK_PAL,anchor:{x:0,y:0},note:'14x32 recessed entrance in plan, notch y8-23 from the street, replaces one brickRow_v tile'},
    shopfront_h:{variants:[makeShopfrontH(0),makeShopfrontH(1)],pal:BRICK_PAL,anchor:{x:0,y:1},note:'32x24 corner-shop front: fascia, plate glass, shop door x22-29; [1] cracked, boarded pane, taped notice; tiles along x at 32'},
    shopfront_v:{variants:[makeShopfrontV(0),makeShopfrontV(1)],pal:BRICK_PAL,anchor:{x:0,y:0},note:'14x32 shopfront in plan, glass on the street side, fascia inboard; tiles along y at 32'},
    shutter_h:{variants:[makeShutterH(0),makeShutterH(1)],pal:BRICK_PAL,anchor:{x:0,y:1},note:'32x24 rolled steel shutter shop; [0] down and padlocked [1] jammed half-open, dark gap; tiles along x at 32'},
    shutter_v:{variants:[makeShutterV(0),makeShutterV(1)],pal:BRICK_PAL,anchor:{x:0,y:0},note:'14x32 shutter in plan; [1] half-open; tiles along y at 32'},
    awning_h:{variants:[makeAwningH(0),makeAwningH(1)],pal:BRICK_PAL,anchor:{x:0,y:0},note:'32x16 faded blue-grey striped awning, NON-SOLID overlay OUTSIDE the footprint: row 0 = wall rail on the south edge; period-8 stripes/scallops; [1] torn panel; tiles along x at 32'},
    awning_v:{variants:[makeAwningV(0),makeAwningV(1)],pal:BRICK_PAL,anchor:{x:1,y:0},note:'16x32 awning in plan, rail = right column on the west footprint edge, projects west; flip for east; tiles along y at 32'},
    // ---- South Blocks: rear ----
    rearWall_h:{variants:[makeRearWallH(0),makeRearWallH(1)],pal:BRICK_PAL,anchor:{x:0,y:1},note:'32x20 plain rear brick face (yard = bottom row); [0] frosted window + drainpipe [1] two small windows; tiles along x at 32'},
    rearWall_v:{variants:[makeRearWallV(0),makeRearWallV(1)],pal:BRICK_PAL,anchor:{x:0,y:0},note:'12x32 rear wall in plan, yard = column 0; [0] pipe shoe [1] two windows; tiles along y'},
    backDoor_h:{rows:makeBackDoorH(),pal:BRICK_PAL,anchor:{x:0,y:1},note:'32x20 rear wall with plank back door x10-17, step and drainpipe; one rearWall_h slot'},
    backDoor_v:{rows:makeBackDoorV(),pal:BRICK_PAL,anchor:{x:0,y:0},note:'12x32 back door in plan, door y10-21; one rearWall_v slot'},
    binNook_h:{rows:makeBinNookH(),pal:BRICK_PAL,anchor:{x:0,y:1},note:'32x20 rear wall with recessed bin bay x5-27 holding two wheelie bins and a bag; one rearWall_h slot'},
    binNook_v:{rows:makeBinNookV(),pal:BRICK_PAL,anchor:{x:0,y:0},note:'16x32 bin bay in plan: wall at x4-15, bins stand x1-9 in the yard; one rearWall_v slot (2 wider)'},
    courtWall_h:{variants:[makeCourtWallH(0),makeCourtWallH(1)],pal:BRICK_PAL,anchor:{x:0,y:1},note:'32x14 freestanding brick court/yard wall, stone coping, pier x0-3; [1] fresh knocked-off coping; tiles along x at 32'},
    courtWall_v:{variants:[makeCourtWallV(0),makeCourtWallV(1)],pal:BRICK_PAL,anchor:{x:.5,y:0},note:'10x32 court wall in plan, pier cap rows 0-3; [1] chipped coping; tiles along y at 32'},
    courtGate_h:{rows:makeCourtGateH(),pal:BRICK_PAL,anchor:{x:0,y:1},note:'32x14 court wall with timber back gate x10-23 (passable); one courtWall_h slot'},
    courtGate_v:{rows:makeCourtGateV(),pal:BRICK_PAL,anchor:{x:.5,y:0},note:'10x32 court gate in plan, gate y9-22 (passable); one courtWall_v slot'},
    rearExt_s:{rows:makeRearExtS(),pal:BRICK_PAL,anchor:{x:.5,y:0},note:'20x44 narrow rear extension projecting SOUTH: slate lean-to roof rows 0-29, brick end face with back door + drainpipe rows 30-43; solid'},
    rearExt_n:{rows:makeRearExtN(),pal:BRICK_PAL,anchor:{x:.5,y:1},note:'20x36 narrow rear extension projecting NORTH, roof only in plan; solid'},
    rearExt_h:{rows:makeRearExtH(),pal:BRICK_PAL,anchor:{x:0,y:1},note:'40x22 narrow rear extension projecting EAST: roof rows 0-10, south face with window, door, pipe rows 11-21; flip for WEST; solid'},
    // ---- Old Quarter ----
    terrace_h:{variants:[makeTerraceH(0),makeTerraceH(1),makeTerraceH(2)],pal:MASON_PAL,anchor:{x:0,y:1},note:'32x28 masonry terrace house front, street = bottom row; raised party-wall parapet x0-2 full height; stepped eave: [0] row0 two sashes [1] row3 panelled door + fanlight [2] row6 shuttered; tiles along x at 32'},
    terrace_v:{variants:[makeTerraceV(0),makeTerraceV(1),makeTerraceV(2)],pal:MASON_PAL,anchor:{x:0,y:0},note:'14x32 terrace in plan, street = column 0; party wall y0-2; slate lip steps 0/1/2 columns per variant; [1] door; tiles along y at 32'},
    masonryEaves_n:{rows:makeMasonryEavesN(),pal:MASON_PAL,anchor:{x:0,y:0},note:'32x8 north-facing terrace edge in plan, street = row 0, party pier x0-2; tiles along x at 32'},
    terraceCorner:{rows:makeTerraceCorner(),pal:MASON_PAL,anchor:{x:0,y:1},note:'14x28 SW terrace corner, long-and-short quoins; flip for SE'},
    collapse_h:{rows:makeCollapseH(),pal:MASON_PAL,anchor:{x:0,y:1},note:'32x28 fresh collapse cross-section ending a terrace run: torn slate roof with rafter ends, stepped front-wall stub, pale papered room with joist stubs and fireplace, far party-wall end, heap; gap to the RIGHT, flip for the other side; no transparent rows'},
    collapse_v:{rows:makeCollapseV(),pal:MASON_PAL,anchor:{x:0,y:0},note:'14x32 collapse in plan: wall band intact to y10-17, jagged lit tear, dark void below with three 1x3 joist ends; gap BELOW, flipY for gap above'},
    partyWall_v:{variants:[makePartyWallV(0),makePartyWallV(1)],pal:MASON_PAL,anchor:{x:.5,y:0},note:'10x32 exposed party wall in plan along a collapse gap: stone top x1-4 with chipped lit edge, pale papered face x5-8 with joist pockets (face on the right, flip for left); [1] knocked chunk; tiles along y at 32; solid'},
    partyWall_h:{variants:[makePartyWallH(0),makePartyWallH(1)],pal:MASON_PAL,anchor:{x:0,y:.5},note:'32x10 exposed party wall top in plan, plaster face on the south; [1] knocked chunk; tiles along x at 32; solid'},
    collapseFloor:{variants:[makeCollapseFloor(0),makeCollapseFloor(1),makeCollapseFloor(2)],pal:MASON_PAL,anchor:{x:0,y:0},note:'32x32 FLAT tileable floor of a collapsed house: joists every 8 rows over a dark cellar, dusty boards, open holes, plaster lumps, slate shards; tile wall to wall across a collapse gap'},
    collapseSpill:{variants:[makeCollapseSpill(0),makeCollapseSpill(1)],pal:MASON_PAL,anchor:{x:.5,y:1/3},note:'48x36 rubble heap poured out of a collapse gap: rows 0-11 inside the gap piled against both party walls, row 12 on the street line, rows 12-35 fan onto the pavement; [0] masonry + plaster + slates [1] brick'}
  });
})();
