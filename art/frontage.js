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
  // periodic stone/brick tint lookup: period 4 units of 8 = 32, seamless
  var TINT=[0,2,1,0,1,0,2,1,2,0,0,1,1,2,0,0];
  function tintAt(unit,course){return TINT[pmod(unit,4)*4+pmod(course,4)];}

  // ---- palettes ----
  // masonry: npm run art:ramp -- --hue 70 --l 0.14,0.62 --chroma 0.025 --name masonry
  var MASONRY={K:'#0d0806',D:'#2c221a',M:'#4b4034',L:'#6a6256',H:'#88867f'};
  // slate:   npm run art:ramp -- --hue 250 --l 0.12,0.45 --chroma 0.02 --name slate
  var SLATE={K:'#050609',D:'#12171f',M:'#232b34',L:'#374147',H:'#505659'};
  var BRICK_PAL=pal2(MAT.brick,{
    C:MAT.concrete.L,E:MAT.concrete.M,F:MAT.concrete.D, // stone coping, lintels, sills, steps
    G:MAT.glass.K,J:MAT.glass.D,                        // dark night glass + faint glint
    I:MAT.iron.M,N:MAT.iron.D,Z:MAT.iron.L,             // pipes, shutters, frames
    U:MAT.wood.M,X:MAT.wood.D,                          // doors, boards
    A:MAT.olive.L,B:MAT.olive.D,P:MAT.concrete.H,       // faded awning canvas stripes, tape
    S:SLATE.M,T:SLATE.D,Q:SLATE.L                       // extension roof
  });
  var MASON_PAL=pal2(MASONRY,{
    S:SLATE.M,T:SLATE.D,Q:SLATE.L,                      // slate roof
    G:MAT.glass.K,J:MAT.glass.D,
    U:MAT.wood.M,X:MAT.wood.D,Y:MAT.wood.L,             // joists, boards, doors
    P:MAT.concrete.L,V:MAT.sandbag.L,                   // fresh plaster, faded wallpaper stripe
    Z:MAT.concrete.H,                                   // fresh break faces (small)
    I:MAT.iron.M,N:MAT.iron.D,
    B:MAT.brick.M,C:MAT.brick.D                         // brick backing inside the cut
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
  // plan-view window slot on a _v strip (street col 0 side)
  function slotV(g,x,y,w,h,kind){
    box(g,x,y,x+w-1,y+h-1,'K');
    rect(g,x+1,y+1,x+w-2,y+h-2,'G');
    setclip(g,x+1,y+1,'J');
    if(kind==='boarded'){var xx;for(xx=x+1;xx<=x+w-2;xx++)rect(g,xx,y+1,xx,y+h-2,pmod(xx,2)?'U':'X');}
    if(kind==='taped'){setclip(g,x+1,y+Math.floor(h/2),'P');setclip(g,x+w-2,y+Math.floor(h/2)-1,'P');}
    rect(g,x-1,y,x-1,y+h-1,'E'); // sill toward the street
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
    if(v===0){sashH(g,7,7,6,10);sashH(g,21,7,6,10);}
    if(v===1){
      sashH(g,7,7,6,10);
      rect(g,18,9,26,9,'C');
      box(g,19,10,25,22,'K');rect(g,20,11,24,12,'G');rect(g,20,13,24,13,'K');
      rect(g,20,14,24,21,'U');rect(g,21,15,21,20,'X');rect(g,23,15,23,20,'X');setclip(g,24,17,'C');
      rect(g,18,22,26,22,'E');rect(g,18,23,26,23,'K');
    }
    if(v===2){sashH(g,7,7,6,10,'boarded');sashH(g,21,7,6,10,'taped');}
    return toRows(g);
  }
  // brickRow_v 14x32 x3: the same section in plan along a N-S street
  function makeBrickRowV(v){
    var w=14,h=32,g=mkGrid(w,h);
    brickShellV(g,w,h);
    if(v===0){slotV(g,3,7,5,7);slotV(g,3,21,5,7);}
    if(v===1){slotV(g,3,7,5,7);box(g,2,19,9,27,'K');rect(g,3,20,8,26,'U');rect(g,3,23,8,23,'X');setclip(g,1,23,'E');setclip(g,1,24,'E');}
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
    rect(g,8,7,23,8,'C');rect(g,8,8,23,8,'E');
    rect(g,9,9,22,22,'K');
    rect(g,10,10,21,17,'D');                       // shadowed back wall of the recess
    rect(g,9,9,9,22,'L');rect(g,22,9,22,22,'D');   // lit left reveal, dark right reveal
    box(g,13,10,18,19,'K');rect(g,14,11,17,11,'J');rect(g,14,12,17,18,'U');rect(g,15,13,15,17,'X');setclip(g,17,15,'C');
    rect(g,10,18,21,21,'F');                        // recess floor tiles
    rect(g,10,18,21,18,'E');setclip(g,12,20,'E');setclip(g,16,19,'E');setclip(g,19,21,'E');
    rect(g,8,22,23,22,'E');rect(g,8,23,23,23,'K');rect(g,9,22,22,22,'C');
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
  // awning_h 32x12 x2: faded canvas shop awning, drawn OUTSIDE the footprint
  // (row 0 = wall rail). [0] intact [1] torn panel hanging, frame visible
  function makeAwningH(v){
    var w=32,h=12,g=mkGrid(w,h),x,y,s;
    rect(g,0,0,w-1,0,'K');rect(g,0,1,w-1,1,'N');
    for(y=2;y<=8;y++)for(x=0;x<w;x++){s=pmod(x,8)<4;g[y][x]=s?(y<4?'A':'A'):(y<4?'B':'B');}
    for(x=0;x<w;x++){if(pmod(x,8)<4)setclip(g,x,2,'P');}
    rect(g,0,8,w-1,8,'K');
    for(x=0;x<w;x++){s=pmod(x,4);var d=s===0||s===3?9:10;rect(g,x,9,x,d,pmod(x,8)<4?'A':'B');setclip(g,x,d+1,'K');}
    if(v===1){
      rect(g,11,2,20,10,'.');rect(g,11,11,20,11,'.');
      rect(g,11,2,11,9,'N');rect(g,20,2,20,9,'N');rect(g,11,8,20,8,'N');     // bare frame
      rect(g,13,2,16,7,'B');rect(g,14,8,15,10,'B');setclip(g,15,11,'K');setclip(g,13,8,'K');setclip(g,16,8,'K'); // hanging flap
      rect(g,12,2,12,7,'K');rect(g,17,2,17,7,'K');
    }
    return toRows(g);
  }
  function makeAwningV(v){
    var w=12,h=32,g=mkGrid(w,h),x,y,s;
    rect(g,w-1,0,w-1,h-1,'K');rect(g,w-2,0,w-2,h-1,'N');
    for(x=3;x<=w-3;x++)for(y=0;y<h;y++){s=pmod(y,8)<4;g[y][x]=s?'A':'B';}
    for(y=0;y<h;y++)if(pmod(y,8)<4)setclip(g,w-3,y,'P');
    rect(g,3,0,3,h-1,'K');
    for(y=0;y<h;y++){s=pmod(y,4);var d=s===0||s===3?2:1;rect(g,d,y,2,y,pmod(y,8)<4?'A':'B');setclip(g,d-1,y,'K');}
    if(v===1){
      rect(g,0,11,9,20,'.');rect(g,3,11,9,11,'N');rect(g,3,20,9,20,'N');rect(g,3,11,3,20,'N');
      rect(g,5,13,9,16,'B');rect(g,4,14,4,15,'B');rect(g,5,12,9,12,'K');rect(g,5,17,9,17,'K');setclip(g,3,14,'K');
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
    function bin(x,body,lid){
      rect(g,x,8,x+8,10,lid);rect(g,x,8,x+8,8,'P'===lid?'C':lid);box(g,x,8,x+8,10,'K');
      rect(g,x+1,11,x+7,17,body);box(g,x+1,11,x+7,17,'K');rect(g,x+2,12,x+2,16,lid);
      rect(g,x+2,18,x+3,18,'K');rect(g,x+6,18,x+7,18,'K');
    }
    bin(7,'B','A');bin(17,'N','I');
    setclip(g,8,9,'P');setclip(g,18,9,'Z');
    rect(g,25,15,27,18,'N');box(g,25,15,27,18,'K');setclip(g,26,16,'I');     // tied bag
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
    if(v===1){rect(g,19,1,23,3,'.');rect(g,19,4,23,4,'K');setclip(g,18,1,'K');setclip(g,24,1,'K');rect(g,20,5,22,5,'L');} // fresh knocked-off coping
    return toRows(g);
  }
  function makeCourtWallV(v){
    var w=10,h=32,g=mkGrid(w,h),y;
    rect(g,0,0,0,h-1,'K');rect(g,1,0,1,h-1,'D');
    brickFaceV(g,2,0,4,h-1,2);
    rect(g,5,0,5,h-1,'F');rect(g,6,0,6,h-1,'E');rect(g,7,0,7,h-1,'C');rect(g,8,0,8,h-1,'C');rect(g,9,0,9,h-1,'K');
    rect(g,0,0,9,0,'K');rect(g,1,1,8,2,'M');rect(g,1,1,8,1,'P');rect(g,1,3,8,3,'D');
    for(y=8;y<h;y+=8)setclip(g,6,y,'F');
    if(v===1){rect(g,6,18,8,22,'M');rect(g,9,18,9,22,'.');rect(g,8,17,8,17,'K');rect(g,8,23,8,23,'K');}
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
    rect(g,15,0,18,29,'D');for(y=0;y<=29;y+=3)rect(g,15,y,18,y,'K');rect(g,15,0,15,29,'K'); // shadowed parapet side
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
    if(kind==='shutters'){rect(g,x+1,y+1,x+w-2,y+h-2,'X');var yy;for(yy=y+2;yy<y+h-1;yy+=2)rect(g,x+1,yy,x+w-2,yy,'U');}
    if(kind==='lamp'){setclip(g,x+2,y+h-3,'Y');}
    rect(g,x-1,y+h,x+w,y+h,'L');rect(g,x,y+h+1,x+w-1,y+h+1,'D');
  }
  // terrace_h 32x28 x3: masonry terrace house front with a raised party-wall
  // parapet at x0..2 and a per-house eave height (stepped roof edge).
  // [0] eave row 0, two sashes [1] eave row 3, door with fanlight [2] eave row 6, shuttered
  var TERRACE_TOP=[0,3,6];
  function makeTerraceH(v){
    var w=32,h=28,g=mkGrid(w,h),t=TERRACE_TOP[v];
    rect(g,3,t,w-1,t,'K');rect(g,3,t+1,w-1,t+1,'T');rect(g,3,t+2,w-1,t+2,'H');rect(g,3,t+3,w-1,t+3,'L');rect(g,3,t+4,w-1,t+4,'D'); // slate lip, cornice, shadow
    var x;for(x=4;x<w;x+=4)setclip(g,x,t+3,'M');                                                   // dentils (period 4)
    ashlarH(g,3,t+5,w-1,h-3,h-3);
    rect(g,3,h-2,w-1,h-2,'D');rect(g,0,h-1,w-1,h-1,'K');
    // party-wall parapet: always full height so any eave step lands on it
    rect(g,0,0,0,h-1,'K');rect(g,1,0,1,h-2,'L');rect(g,2,0,2,h-2,'D');rect(g,0,0,2,0,'K');rect(g,1,1,2,1,'H');rect(g,0,1,0,1,'K');
    if(v===0){sashM(g,8,t+9,5,10);sashM(g,21,t+9,5,10);}
    if(v===1){
      sashM(g,8,t+9,5,10);
      rect(g,19,t+6,27,t+7,'H');box(g,20,t+8,26,25,'K');rect(g,21,t+9,25,t+10,'J');rect(g,21,t+11,25,t+11,'K');rect(g,23,t+9,23,t+10,'N');
      rect(g,21,t+12,25,24,'X');rect(g,22,t+13,22,23,'U');rect(g,24,t+13,24,23,'U');setclip(g,25,t+17,'H');
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
    if(v===1){box(g,2,17,7,25,'K');rect(g,3,18,6,24,'X');setclip(g,1,20,'L');setclip(g,1,21,'L');}
    else{box(g,2,8,5,13,'K');rect(g,3,9,4,12,v===2?'X':'G');box(g,2,21,5,26,'K');rect(g,3,22,4,25,'G');}
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
    rect(g,0,0,w-1,0,'K');rect(g,1,1,w-1,1,'T');rect(g,1,2,w-1,2,'H');rect(g,1,3,w-1,3,'L');rect(g,1,4,w-1,4,'D');
    ashlarH(g,1,5,w-1,h-3,h-3);
    rect(g,1,h-2,w-1,h-2,'D');rect(g,0,h-1,w-1,h-1,'K');rect(g,0,0,0,h-1,'K');
    for(y=5,q=0;y+3<=h-3;y+=4,q++){var len=q%2?3:6;rect(g,1,y,len,y+2,'L');rect(g,1,y,len,y,'H');rect(g,len+1,y,len+1,y+2,'D');rect(g,1,y+3,len+1,y+3,'D');}
    return toRows(g);
  }
  // collapse_h 32x28: fresh collapse cross-section terminating a terrace run.
  // Intact house on the left (pier + one sash); from x~13 the front wall is
  // torn away in a jagged line, exposing the first-floor slab with joist ends,
  // plastered/papered party wall inside, a dangling board, and a heap at the
  // foot. The gap is to the RIGHT; flip:true to end a run on the gap's far side.
  function makeCollapseH(){
    var w=32,h=28,g=mkGrid(w,h),x,y,t=3;
    // inner party wall (the far side of the lost room): plaster with faded paper stripes
    for(y=t+2;y<=h-2;y++)for(x=12;x<=w-1;x++)g[y][x]=pmod(x,4)===1?'V':'P';
    rect(g,12,t+2,w-1,t+2,'C');                                    // brick backing shows at the torn top
    for(x=12;x<w;x+=5)setclip(g,x,t+3,'B');
    rect(g,w-1,t+2,w-1,h-2,'D');
    // upper floor gone: dark void band above the first-floor slab
    rect(g,14,t+5,w-1,12,'K');rect(g,14,t+5,w-1,t+5,'C');
    // first-floor slab: boards (Y top), joist ends every 3 (X), ceiling plaster under
    rect(g,13,13,w-1,13,'Y');rect(g,13,14,w-1,15,'U');for(x=14;x<w;x+=3)rect(g,x,14,x,15,'X');
    rect(g,13,16,w-1,16,'P');
    for(x=26;x<w;x++)if(pmod(x,2))setclip(g,x,16,'.');             // ceiling torn at the far end
    line(g,26,13,30,19,'Y');line(g,27,13,31,19,'U');                // dangling board
    // ground floor room behind: dim, a doorway ghost on the party wall
    rect(g,14,17,w-1,h-3,'D');rect(g,19,18,23,h-3,'K');rect(g,19,18,23,18,'C');
    rect(g,14,17,w-1,17,'M');
    // intact masonry front on the left with a jagged torn edge
    var edge=[13,13,14,14,13,13,12,12,13,14,14,13,13,12,12,11,11,12,13,13,14,15,16,17,17,18];
    for(y=t;y<h-2;y++){var ex=edge[y-t]||12;for(x=0;x<=ex;x++)g[y][x]='M';}
    ashlarH(g,3,t+5,13,h-3,h-3);
    for(y=t+5;y<h-2;y++){var e=edge[y-t]||12;for(x=e+1;x<=w-1&&x<=e+1;x++){}rect(g,e+1,y,w,y,get(g,e+1,y));for(x=0;x<=e;x++)if(x>=3&&get(g,x,y)==='.')setclip(g,x,y,'M');}
    for(y=t+5;y<h-2;y++){var ee=edge[y-t];for(x=ee+1;x<w;x++)if(x<=13&&x>12)g[y][x]=g[y][x];setclip(g,ee,y,'Z');setclip(g,ee+1,y,'K');}
    // cornice on the intact part, broken off above the tear
    rect(g,3,t,14,t,'K');rect(g,3,t+1,13,t+1,'T');rect(g,3,t+2,13,t+2,'H');rect(g,3,t+3,13,t+3,'L');rect(g,3,t+4,13,t+4,'D');
    setclip(g,14,t+1,'K');setclip(g,14,t+2,'Z');setclip(g,14,t+3,'K');
    sashM(g,6,t+9,4,10);
    // party-wall pier
    rect(g,0,0,0,h-1,'K');rect(g,1,0,1,h-2,'L');rect(g,2,0,2,h-2,'D');rect(g,0,0,2,0,'K');rect(g,1,1,2,1,'H');
    // fresh heap at the foot of the tear: blocks with lit break faces, plaster dust
    var heap=[[14,24,3,2],[18,23,4,3],[23,24,3,2],[27,22,4,4],[12,25,2,1],[21,26,5,1]];
    heap.forEach(function(b){rect(g,b[0],b[1],b[0]+b[2]-1,b[1]+b[3]-1,'M');rect(g,b[0],b[1],b[0]+b[2]-1,b[1],'Z');box(g,b[0]-1,b[1]-1,b[0]+b[2],b[1]+b[3],'K');});
    rect(g,13,h-2,w-1,h-2,'D');setclip(g,16,26,'P');setclip(g,25,26,'P');setclip(g,30,27,'P');
    rect(g,0,h-1,w-1,h-1,'K');
    return toRows(g);
  }
  // collapse_v 14x32: the same break in plan along a N-S street. Wall band
  // intact at the top, torn from y~12, joists (wood) protruding into the gap.
  function makeCollapseV(){
    var w=14,h=32,g=mkGrid(w,h),y,x;
    var edge=[31,31,31,31,31,31,31,31,31,31,31,31,13,12,14,15,13,16,17,15,14,18,19,18,17,20,21,20,19,22,23,22];
    for(x=0;x<w;x++){
      var len=edge[Math.min(31,12+x*2)]||31;
      for(y=0;y<Math.min(h,len);y++)g[y][x]='M';
    }
    ashlarV(g,2,0,8,h-1,2);
    for(x=0;x<w;x++){var L=edge[Math.min(31,12+x*2)]||31;for(y=L;y<h;y++)g[y][x]='.';if(L<h){setclip(g,x,L-1,'Z');}}
    rect(g,0,0,0,h-1,'K');rect(g,w-1,0,w-1,13,'K');
    rect(g,9,0,9,12,'L');rect(g,10,0,10,12,'H');rect(g,11,0,11,12,'T');rect(g,12,0,12,12,'S');
    rect(g,0,0,w-1,0,'K');rect(g,1,1,w-2,1,'H');rect(g,1,2,w-2,2,'D');
    for(y=14;y<=28;y+=3){var jl=6+pmod(y,4);rect(g,w-jl,y,w-1,y,'U');setclip(g,w-jl,y,'Y');setclip(g,w-1,y,'X');}
    rect(g,2,28,5,30,'M');rect(g,2,28,5,28,'Z');box(g,1,27,6,31,'K');
    outlineFrom(g,['M','L','H','D','Z'],'K');
    return toRows(g);
  }
  // partyWall_v 10x32 x2: exposed party wall top in plan, running from the
  // street into the block across a collapse gap. Stone core, the torn room's
  // plaster + wallpaper face on the right with joist pockets every 8.
  // [1] a fresh chunk knocked off the top.
  function makePartyWallV(v){
    var w=10,h=32,g=mkGrid(w,h),y;
    rect(g,1,0,6,h-1,'M');ashlarV(g,1,0,6,h-1,1);
    rect(g,7,0,7,h-1,'P');rect(g,8,0,8,h-1,'V');for(y=0;y<h;y+=4)setclip(g,8,y,'P');
    for(y=4;y<h;y+=8){rect(g,7,y,8,y+1,'K');}
    rect(g,0,0,0,h-1,'K');rect(g,9,0,9,h-1,'K');rect(g,1,0,1,h-1,'L');
    if(v===1){rect(g,4,12,8,18,'.');rect(g,3,12,3,18,'K');rect(g,4,11,8,11,'K');rect(g,4,19,8,19,'K');rect(g,4,12,4,18,'Z');setclip(g,9,12,'.');rect(g,9,13,9,17,'.');}
    return toRows(g);
  }
  function makePartyWallH(v){
    var w=32,h=10,g=mkGrid(w,h),x;
    rect(g,0,1,w-1,6,'M');ashlarH(g,0,1,w-1,6,6);
    rect(g,0,7,w-1,7,'P');rect(g,0,8,w-1,8,'V');for(x=0;x<w;x+=4)setclip(g,x,8,'P');
    for(x=4;x<w;x+=8)rect(g,x,7,x+1,8,'K');
    rect(g,0,0,w-1,0,'K');rect(g,0,9,w-1,9,'K');rect(g,0,1,w-1,1,'L');
    if(v===1){rect(g,12,2,18,8,'.');rect(g,12,1,18,1,'K');rect(g,11,2,11,8,'K');rect(g,19,2,19,8,'K');rect(g,12,2,18,2,'Z');rect(g,13,9,17,9,'.');}
    return toRows(g);
  }
  // collapseFloor 48x40: flat plan view of a collapsed house's exposed ground
  // floor inside a gap: joists across a dark cellar, surviving boards, plaster
  // dust and fallen slates. Anchor center.
  function makeCollapseFloor(){
    var w=48,h=40,g=mkGrid(w,h),rng=mulberry32(311),x,y;
    rect(g,1,1,w-2,h-2,'K');
    for(y=4;y<h-2;y+=6){rect(g,1,y,w-2,y+1,'U');rect(g,1,y,w-2,y,'Y');}
    for(y=4;y<h-2;y+=6)if(y>=16){rect(g,30+(y%5),y,33+(y%5),y+1,'K');}
    rect(g,2,2,19,15,'U');for(x=2;x<=19;x+=3)rect(g,x,2,x,15,'X');rect(g,2,2,19,2,'Y');     // surviving floorboards corner
    line(g,20,15,28,21,'U');line(g,21,15,29,21,'Y');                                         // snapped board
    for(var i=0;i<40;i++){x=2+Math.floor(rng()*44);y=2+Math.floor(rng()*36);setclip(g,x,y,rng()<0.6?'P':'D');}
    [[34,8],[40,26],[12,30],[26,33]].forEach(function(s){rect(g,s[0],s[1],s[0]+3,s[1]+1,'S');rect(g,s[0],s[1],s[0]+3,s[1],'Q');box(g,s[0]-1,s[1]-1,s[0]+4,s[1]+2,'T');});
    rect(g,0,0,w-1,0,'M');rect(g,0,h-1,w-1,h-1,'M');rect(g,0,0,0,h-1,'M');rect(g,w-1,0,w-1,h-1,'M');
    box(g,0,0,w-1,h-1,'D');rect(g,0,0,w-1,0,'L');
    return toRows(g);
  }
  // collapseSpill 48x36 x2: rubble spill with its SOURCE visible. Rows 0..8 are
  // the broken stub of the fallen wall (jagged top, lit fresh break faces,
  // snapped joist); rubble fans from its foot toward the street, big blocks
  // near the stub, small chunks and plaster dust further out.
  // [0] Old Quarter masonry [1] South Blocks brick. Anchor {x:.5,y:0} on the
  // footprint edge the wall fell from; spill lies outside, toward the street.
  function makeCollapseSpill(v){
    var w=48,h=36,g=mkGrid(w,h),rng=mulberry32(v?521:517),x,y,i;
    var wallM=v?'B':'M',wallL=v?'B':'L',wallD=v?'C':'D';
    var top=[4,3,3,2,2,3,5,6,6,4,3,1,1,2,4,7,8,8,6,4,3,3,5,7,8,8,7,5,4,3,2,2,3,5,7,8,8,8];
    for(x=5;x<=42;x++){var t=top[x-5];for(y=t;y<=8;y++)g[y][x]=wallM;setclip(g,x,t,'Z');}
    if(v===0)ashlarH(g,6,4,41,7,8);else brickFaceH(g,6,4,41,7,8);
    for(x=5;x<=42;x++){var tt=top[x-5];for(y=0;y<tt;y++)g[y][x]='.';setclip(g,x,tt,'Z');}
    if(v===1){for(x=5;x<=42;x++)for(y=0;y<=8;y++){if(g[y][x]==='M')g[y][x]='B';if(g[y][x]==='D'&&y>top[x-5])g[y][x]='C';if(g[y][x]==='L')g[y][x]='B';}}
    rect(g,5,9,42,9,wallD);
    line(g,16,5,24,15,'U');line(g,17,5,25,15,'Y');                     // snapped joist fallen out of the stub
    // big blocks near the stub, smaller further out
    var blocks=[[8,11,5,3],[27,11,6,3],[35,12,4,3],[13,15,4,2],[31,17,4,2],[20,18,3,2],[9,20,3,2],[38,20,3,2],[16,24,2,2],[27,24,3,2],[34,26,2,1],[11,27,2,1],[22,29,2,1],[40,28,2,1]];
    blocks.forEach(function(b){rect(g,b[0],b[1],b[0]+b[2]-1,b[1]+b[3]-1,wallM);rect(g,b[0],b[1],b[0]+b[2]-1,b[1],v?'L':'Z');box(g,b[0]-1,b[1]-1,b[0]+b[2],b[1]+b[3],'K');});
    for(i=0;i<70;i++){
      y=10+Math.floor(rng()*25);var spread=6+(y-10)*0.9;x=Math.round(24+(rng()*2-1)*Math.min(22,spread));
      if(get(g,x,y)==='.')setclip(g,x,y,rng()<0.45?'P':(rng()<0.5?wallD:'K'));
    }
    if(v===0){rect(g,24,21,27,22,'S');rect(g,24,21,27,21,'Q');box(g,23,20,28,23,'T');}
    outlineFrom(g,[wallM,wallL,'Z'],'K');
    for(x=5;x<=42;x++)setclip(g,x,top[x-5],'Z');
    rect(g,4,0,4,9,'.');
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
    awning_h:{variants:[makeAwningH(0),makeAwningH(1)],pal:BRICK_PAL,anchor:{x:0,y:0},note:'32x12 faded striped awning, NON-SOLID overlay OUTSIDE the footprint: row 0 = wall rail on the south edge; period-8 stripes/scallops; [1] torn panel; tiles along x at 32'},
    awning_v:{variants:[makeAwningV(0),makeAwningV(1)],pal:BRICK_PAL,anchor:{x:1,y:0},note:'12x32 awning in plan, rail = right column on the west footprint edge, projects west; flip for east; tiles along y at 32'},
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
    collapse_h:{rows:makeCollapseH(),pal:MASON_PAL,anchor:{x:0,y:1},note:'32x28 fresh collapse cross-section ending a terrace run: intact left, torn front exposing joists, papered party wall, dangling board, heap; gap to the RIGHT, flip for the other side'},
    collapse_v:{rows:makeCollapseV(),pal:MASON_PAL,anchor:{x:0,y:0},note:'14x32 collapse in plan: wall intact y0-12, torn below with joists protruding; gap BELOW, flipY for gap above'},
    partyWall_v:{variants:[makePartyWallV(0),makePartyWallV(1)],pal:MASON_PAL,anchor:{x:.5,y:0},note:'10x32 exposed party wall top in plan across a gap, plaster/paper face + joist pockets on the right; [1] knocked chunk; tiles along y at 32; solid'},
    partyWall_h:{variants:[makePartyWallH(0),makePartyWallH(1)],pal:MASON_PAL,anchor:{x:0,y:.5},note:'32x10 exposed party wall top in plan, plaster face on the south; [1] knocked chunk; tiles along x at 32; solid'},
    collapseFloor:{rows:makeCollapseFloor(),pal:MASON_PAL,anchor:'center',note:'48x40 FLAT decal: exposed ground floor of a collapsed house, joists over dark cellar, surviving boards, plaster dust, slates'},
    collapseSpill:{variants:[makeCollapseSpill(0),makeCollapseSpill(1)],pal:MASON_PAL,anchor:{x:.5,y:0},note:'48x36 rubble spill with its source: broken wall stub rows 0-9 + snapped joist, blocks fan out toward the street; [0] masonry [1] brick; stub solid, spill flat'}
  });
})();
