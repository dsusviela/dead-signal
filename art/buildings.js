// Dead Signal buildings: house wall caps, roof fills/parapets/props, and
// top-down interior furniture. One texel = one world unit (den 1).
//
// Walls: every wall in the game is a house wall (world.js house(), T=14), and
// render.js clips wallH/wallV to a 14-texel-thick band along the outward
// edge, so both sprites are authored as a top-down wall cap: a bright outer
// lip (K outline + H weathering) falling through a mid band into a dark
// inner shadow, with the true outline on BOTH long edges (the second one
// sits in the 2 texels render.js throws away, which keeps the sheet/frame
// preview honest without costing anything in-game). wallH is a function of y
// only, wallV of x only, so the tiling axis (x for wallH at a 32 step, y for
// wallV) is trivially seamless; per-variant grime/cracks are the only thing
// that varies between [0] and [1], added with wraparound scatter so they
// still tile.
//
// Roof fills: roofFill (small house, tar paper, MAT.asphalt) and
// roofFillBig (block roof, gravel/concrete, MAT.concrete) tile in BOTH axes
// at 32, and every variant must border every other variant (render.js picks
// per-cell by hash(x,y)), so texture is built the tiles.js way: a flat base,
// a couple of felt-seam/joint rows fixed at the same y for every variant
// (structural, guarantees any two variants still line up), and sparse
// wraparound-scattered fleck for the actual per-variant identity. Contrast
// stays low on purpose - these sit behind 3-5 roof props and the whole HUD.
//
// roofEdge is a 16-entry N|E|S|W=1|2|4|8 mask parapet lip, built the same
// min-distance-to-active-edge way as tiles.js's curb/quarantineStripe masks,
// which is what makes the diagonal corners (3,6,12,9) mitre for free: the
// band colour only depends on distance, never on which edge "won".
//
// Roof props and furniture reuse the props.js vocabulary: bevel() for boxy
// things (K outline, L top+left inner edge toward the light, D bottom+right,
// flat M fill - rule 27/28), disc() for round bits, outlineFrom() for
// organic silhouettes. Furniture keeps props.js's established interior read:
// top face dominant, one thin K edge, minimal side.
(function(){
  'use strict';
  var A=(typeof window!=='undefined'?window:globalThis).DSArt;
  var MAT=A.MAT;

  // ---- grid helpers ----
  function mkGrid(w,h,fill){var g=[],y,x,row;fill=fill==null?'.':fill;for(y=0;y<h;y++){row=[];for(x=0;x<w;x++)row.push(fill);g.push(row);}return g;}
  function setclip(g,x,y,ch){if(y>=0&&y<g.length&&x>=0&&x<g[0].length)g[y][x]=ch;}
  function rect(g,x0,y0,x1,y1,ch){var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)setclip(g,x,y,ch);}
  function toRows(g){return g.map(function(r){return r.join('');});}
  function pal2(base,extra){return Object.assign({},base,extra);}
  function disc(g,cx,cy,rx,ry,ch){var x,y;for(y=-ry;y<=ry;y++)for(x=-rx;x<=rx;x++)if((x*x)/(rx*rx)+(y*y)/(ry*ry)<=1)setclip(g,cx+x,cy+y,ch);}
  // box: K perimeter, flat M fill, 1px L edge top+left (toward the light), 1px D edge bottom+right (rule 27/28)
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
  // auto-outline: any cell in fillLetters touching transparent (or the canvas edge) becomes K
  function outlineFrom(g,fillLetters,K){
    var h=g.length,w=g[0].length,x,y,src=g.map(function(r){return r.slice();});
    function isFill(ch){return fillLetters.indexOf(ch)>=0;}
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      if(!isFill(src[y][x]))continue;
      if(x===0||x===w-1||y===0||y===h-1||src[y][x-1]==='.'||src[y][x+1]==='.'||src[y-1][x]==='.'||src[y+1][x]==='.')g[y][x]=K;
    }
  }
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  // 1-texel-wide staircase, constant 2-step run (rule 1); clipped (not wrapped), for cracks well inside a tile
  function drawCrack(g,x,y,steps,dx,dy,ch){var i,k;for(i=0;i<steps;i++){for(k=0;k<2;k++){setclip(g,x,y,ch);x+=dx;}y+=dy;}}

  // ---- wraparound placement for tiling grids ----
  function wrapX(g,n){var w=g[0].length;return((n%w)+w)%w;}
  function wrapY(g,n){var h=g.length;return((n%h)+h)%h;}
  function setwXY(g,x,y,ch){g[wrapY(g,y)][wrapX(g,x)]=ch;}       // wrap both axes (roofFill/roofFillBig)
  function setwX(g,x,y,ch){if(y<0||y>=g.length)return;g[y][wrapX(g,x)]=ch;} // wrap x only (wallH grime)
  function setwY(g,x,y,ch){if(x<0||x>=g[0].length)return;g[wrapY(g,y)][x]=ch;} // wrap y only (wallV grime)
  var BLOB1=[[0,0]],BLOB2=[[0,0],[1,0]],BLOB3=[[0,0],[0,1]],BLOB4=[[0,0],[1,0],[0,1]];
  function scatterXY(g,rng,n,ch,shapes){
    var i,cx,cy,shape;
    for(i=0;i<n;i++){cx=Math.floor(rng()*g[0].length);cy=Math.floor(rng()*g.length);shape=shapes[Math.floor(rng()*shapes.length)];shape.forEach(function(o){setwXY(g,cx+o[0],cy+o[1],ch);});}
  }
  function scatterX(g,rng,n,ch,yMin,yMax){var i,cx,cy;for(i=0;i<n;i++){cx=Math.floor(rng()*g[0].length);cy=yMin+Math.floor(rng()*(yMax-yMin+1));setwX(g,cx,cy,ch);}}
  function scatterY(g,rng,n,ch,xMin,xMax){var i,cx,cy;for(i=0;i<n;i++){cy=Math.floor(rng()*g.length);cx=xMin+Math.floor(rng()*(xMax-xMin+1));setwY(g,cx,cy,ch);}}

  // =====================================================================
  // wallH 32x16 / wallV 16x32: top-down wall cap. Structure is a function of
  // the cross-thickness axis only (y for H, x for V) so the tiling axis is
  // seamless by construction; ramp index 0 = outer edge (K,H lit lip),
  // index 15 = inner edge (K, mostly clipped away by wallT=14 in-game).
  // =====================================================================
  var WALL_RAMP=['K','H','L','M','M','M','M','D','D','D','D','D','D','D','D','K'];
  function makeWallH(seed,cseed){
    var w=32,h=16,g=mkGrid(w,h,'D'),y,x,rng=mulberry32(seed),crng=mulberry32(cseed);
    for(y=0;y<h;y++)for(x=0;x<w;x++)g[y][x]=WALL_RAMP[y];
    scatterX(g,rng,3,'K',5,11);
    scatterX(g,rng,2,'M',2,3);
    var cx=6+Math.floor(crng()*20),dx=crng()<0.5?1:-1;
    drawCrack(g,cx,2,4,dx,1,'K');
    return toRows(g);
  }
  function makeWallV(seed,cseed){
    var w=16,h=32,g=mkGrid(w,h,'D'),y,x,rng=mulberry32(seed),crng=mulberry32(cseed);
    for(y=0;y<h;y++)for(x=0;x<w;x++)g[y][x]=WALL_RAMP[x];
    scatterY(g,rng,3,'K',5,11);
    scatterY(g,rng,2,'M',2,3);
    var cy=6+Math.floor(crng()*20),dy=crng()<0.5?1:-1;
    drawCrack(g,2,cy,4,1,dy,'K');
    return toRows(g);
  }

  // =====================================================================
  // roofFill 32x32 x3 (tar paper, MAT.asphalt) / roofFillBig 32x32 x3
  // (gravel/concrete, MAT.concrete): tile in both axes, low contrast,
  // felt-seam / speckle rows fixed at the same y across every variant so any
  // two variants still line up when render.js mixes them per-cell.
  // =====================================================================
  function makeRoofFill(seed){
    // tar grit: sparse M into the D field is the actual surface texture (rule 13);
    // the D field alone was a void and let the fixed seam rows dominate the read
    var g=mkGrid(32,32,'D'),rng=mulberry32(seed),x;
    scatterXY(g,rng,85,'M',[BLOB1,BLOB2,BLOB3]);
    scatterXY(g,rng,16,'K',[BLOB1,BLOB2]);
    for(x=0;x<32;x++){g[0][x]='M';g[16][x]='M';} // felt strip seams, fixed rows, shared across variants
    return toRows(g);
  }
  function makeRoofFillBig(seed){
    // gravel grain: sparse D (shadow pebbles) and a little L (lit grit) into the M
    // field; each variant's rng seed scatters the grain to different cells so the
    // per-cell hash pick in render.js actually reads as a different patch
    var g=mkGrid(32,32,'M'),rng=mulberry32(seed);
    scatterXY(g,rng,68,'D',[BLOB1,BLOB2,BLOB3,BLOB4]);
    scatterXY(g,rng,22,'L',[BLOB1,BLOB2]);
    scatterXY(g,rng,3,'K',[BLOB1]);
    return toRows(g);
  }

  // =====================================================================
  // roofEdge mask x16: parapet lip. Band colour depends only on distance to
  // the nearest active edge (never which bit "won"), so corners mitre clean.
  // =====================================================================
  function edgeDist(x,y,bit){if(bit===1)return y;if(bit===2)return 31-x;if(bit===4)return 31-y;return x;}
  function buildRoofEdgeMasks(){
    var out=[],m,g,y,x,d,width=3;
    for(m=0;m<16;m++){
      g=mkGrid(32,32,'.');
      for(y=0;y<32;y++)for(x=0;x<32;x++){
        d=null;
        (function(mm,xx,yy){
          [1,2,4,8].forEach(function(bit){
            if(!(mm&bit))return;
            var dd=edgeDist(xx,yy,bit);
            if(dd<width&&(d===null||dd<d))d=dd;
          });
        })(m,x,y);
        if(d!==null)g[y][x]=d===0?'K':(d===1?'H':'D');
      }
      out.push(toRows(g));
    }
    return out;
  }

  // =====================================================================
  // roofVent 16x14: iron flashing base + pipe stack + domed cap
  // =====================================================================
  function makeRoofVent(){
    var w=16,h=14,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',H='H';
    bevel(g,2,10,13,13,K,L,M,D);
    bevel(g,6,3,9,11,K,L,M,D);
    disc(g,7,2,2,2,K);disc(g,7,2,1,1,H);
    return toRows(g);
  }

  // =====================================================================
  // roofAC 28x20: iron condenser box with a round fan grille on top
  // =====================================================================
  function makeRoofAC(){
    var w=28,h=20,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',H='H';
    bevel(g,1,3,26,19,K,L,M,D);
    disc(g,13,11,8,6,K);disc(g,13,11,6,4,D);
    setclip(g,13,7,L);setclip(g,13,15,L);setclip(g,7,11,L);setclip(g,19,11,L);
    setclip(g,13,11,H);
    return toRows(g);
  }

  // =====================================================================
  // roofWater 24x34: tank on 4 splayed legs with a cross brace, domed lid
  // =====================================================================
  function makeRoofWater(){
    var w=24,h=34,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',H='H';
    rect(g,3,23,4,33,D);rect(g,19,23,20,33,D);rect(g,9,25,10,33,D);rect(g,13,25,14,33,D);
    rect(g,4,27,19,27,D);
    rect(g,2,6,21,23,M);
    disc(g,11,5,10,4,M);
    rect(g,15,7,20,22,D);
    rect(g,4,8,7,20,L);
    outlineFrom(g,['D','M','L'],K);
    setclip(g,7,4,H);
    return toRows(g);
  }

  // =====================================================================
  // roofSkylight 26x18: flat glass pane, two panels, corner glints
  // =====================================================================
  function makeRoofSkylight(){
    var w=26,h=18,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',H='H';
    bevel(g,0,0,25,17,K,L,M,D);
    rect(g,12,1,13,16,K);
    setclip(g,3,3,L);setclip(g,4,3,H);setclip(g,17,3,L);setclip(g,18,3,H);
    return toRows(g);
  }

  // =====================================================================
  // roofAntenna 14x30: thin iron lattice mast with a small dish tip
  // =====================================================================
  function makeRoofAntenna(){
    var w=14,h=30,g=mkGrid(w,h);
    var K='K',D='D',M='M',H='H';
    bevel(g,3,24,10,29,K,M,M,D);
    rect(g,6,4,7,24,M);setclip(g,6,4,K);setclip(g,7,24,K);
    var y;for(y=8;y<22;y+=6){rect(g,5,y,8,y,D);setclip(g,5,y,K);setclip(g,8,y,K);}
    disc(g,6,3,2,2,M);disc(g,6,3,1,1,'.');
    outlineFrom(g,['M'],K);
    setclip(g,6,2,H);
    return toRows(g);
  }

  // =====================================================================
  // roofStair 30x26: concrete stairwell head-house, lit roofline cap, door
  // hint, small vent pipe
  // =====================================================================
  function makeRoofStair(){
    var w=30,h=26,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',H='H';
    bevel(g,1,4,28,25,K,L,M,D);
    rect(g,2,5,27,7,H);
    rect(g,11,20,18,24,D);setclip(g,11,20,K);setclip(g,18,20,K);setclip(g,11,24,K);setclip(g,18,24,K);
    setclip(g,23,10,M);setclip(g,23,9,K);
    return toRows(g);
  }

  // =====================================================================
  // roofBillboard 64x48: iron frame + posts, faded pale advert face, a few
  // low-contrast 1-texel bars suggesting type, one faded graphic block
  // =====================================================================
  var BILLBOARD_PAL=pal2(MAT.iron,{P:MAT.concrete.H,Q:MAT.concrete.M,R:MAT.concrete.L});
  function makeRoofBillboard(){
    // "faded" means the board sits in the M/L middle of the ramp; H/P are accents
    // only (frame cap, one bar highlight), not the panel body
    var w=64,h=48,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',H='H',P='P',Q='Q',R='R';
    bevel(g,10,36,13,47,K,M,M,D);
    bevel(g,50,36,53,47,K,M,M,D);
    bevel(g,2,2,61,35,K,L,M,D);
    rect(g,5,5,58,32,Q);
    var rng=mulberry32(909),i,mx,my;
    for(i=0;i<50;i++){mx=5+Math.floor(rng()*54);my=5+Math.floor(rng()*28);setclip(g,mx,my,rng()<0.55?D:R);}
    rect(g,8,10,48,10,D);rect(g,8,14,38,14,R);rect(g,8,18,53,18,D);rect(g,8,22,28,22,R);
    setclip(g,9,10,P);setclip(g,10,10,P);
    rect(g,40,20,55,30,D);setclip(g,40,20,K);setclip(g,55,30,K);
    return toRows(g);
  }

  // =====================================================================
  // furn_bed 60x36: top-down bed, headboard band, pillow, blanket folds
  // =====================================================================
  function makeFurnBed(){
    var w=60,h=36,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L';
    bevel(g,0,0,59,35,K,L,M,D);
    rect(g,0,0,59,5,D);
    // a wood-frame margin separates the mattress from the bed frame (rule 16)
    rect(g,2,6,57,34,D);
    rect(g,4,8,55,32,M);
    rect(g,8,10,24,18,L);setclip(g,8,10,K);setclip(g,24,10,K);setclip(g,8,18,K);setclip(g,24,18,K);
    rect(g,6,24,53,24,D);rect(g,6,30,53,30,D);
    return toRows(g);
  }

  // =====================================================================
  // furn_table 48x32: top-down wood tabletop, grain streaks, leg corners
  // =====================================================================
  function makeFurnTable(){
    var w=48,h=32,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L';
    bevel(g,0,0,47,31,K,L,M,D);
    rect(g,4,6,43,6,L);rect(g,4,14,43,14,L);rect(g,4,22,43,22,L);
    rect(g,2,2,5,5,D);rect(g,42,2,45,5,D);rect(g,2,26,5,29,D);rect(g,42,26,45,29,D);
    return toRows(g);
  }

  // =====================================================================
  // furn_shelf 60x16: top-down wood shelf unit, dividers, a few items
  // =====================================================================
  function makeFurnShelf(){
    var w=60,h=16,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',H='H';
    bevel(g,0,0,59,15,K,L,M,D);
    rect(g,14,2,15,13,D);rect(g,29,2,30,13,D);rect(g,44,2,45,13,D);
    rect(g,4,4,9,11,H);rect(g,34,5,38,11,L);rect(g,49,3,54,11,D);
    return toRows(g);
  }

  // =====================================================================
  // furn_crates 32x28: 2x2 wood crates with iron corner banding
  // =====================================================================
  var FURN_CRATES_PAL=pal2(MAT.wood,{I:MAT.iron.M,J:MAT.iron.L});
  function makeFurnCrates(){
    var w=32,h=28,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',I='I',J='J';
    var boxes=[[0,0],[16,0],[0,14],[16,14]];
    boxes.forEach(function(o){
      bevel(g,o[0],o[1],o[0]+15,o[1]+13,K,L,M,D);
      rect(g,o[0]+2,o[1]+2,o[0]+13,o[1]+3,I);
      rect(g,o[0]+2,o[1]+10,o[0]+13,o[1]+11,I);
      setclip(g,o[0]+7,o[1]+6,J);
    });
    return toRows(g);
  }

  // =====================================================================
  // furn_counter 80x22: top-down shop counter, raised back ledge, two items
  // =====================================================================
  function makeFurnCounter(){
    var w=80,h=22,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',H='H';
    bevel(g,0,4,79,21,K,L,M,D);
    rect(g,0,0,79,5,D);
    setclip(g,0,0,K);setclip(g,79,0,K);setclip(g,0,5,K);setclip(g,79,5,K);
    rect(g,10,0,17,4,H);rect(g,60,0,68,4,L);
    // plank seams across the countertop, and a ground-contact shadow along the front
    rect(g,20,6,20,19,D);rect(g,40,6,40,19,D);rect(g,60,6,60,19,D);
    rect(g,2,19,77,20,D);
    return toRows(g);
  }

  // =====================================================================
  // ---- merged palettes for the interior-furniture batch (letters chosen to
  // avoid each base ramp's own K/D/M/L/H; I/J stay "iron.M/iron accent" by
  // convention across these so the shared-dark-shadow rule holds per sprite)
  // =====================================================================
  var IRON_GLASS_PAL=pal2(MAT.iron,{G:MAT.glass.M,Z:MAT.glass.D});
  var MEDCAB_PAL=pal2(MAT.concrete,{G:MAT.glass.M,F:MAT.glass.L});
  var SCREEN_PAL=pal2(MAT.sandbag,{I:MAT.iron.M});
  var GEAR_PAL=pal2(MAT.iron,{C:MAT.olive.M,E:MAT.olive.L});
  var HOSE_PAL=pal2(MAT.iron,{C:MAT.rust.M,E:MAT.rust.D});
  var DRUM_PAL=pal2(MAT.rust,{I:MAT.iron.M,J:MAT.iron.D});
  var CHECKOUT_PAL=pal2(MAT.wood,{I:MAT.iron.M,J:MAT.iron.D,Z:MAT.glass.D});
  var BENCHWAIT2_PAL=pal2(MAT.concrete,{I:MAT.iron.M});

  // =====================================================================
  // furn_shelfAisle 18x100 x2: stripped store aisle shelving from above,
  // most compartments left bare (rule 13); a knocked-over item in [1]
  // =====================================================================
  function makeFurnShelfAisle(variant){
    var w=18,h=100,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',I='I',J='J',y;
    bevel(g,0,0,17,99,K,L,M,D);
    for(y=12;y<96;y+=14){rect(g,1,y,16,y+1,D);setclip(g,1,y,K);setclip(g,16,y,K);setclip(g,1,y+1,K);setclip(g,16,y+1,K);}
    if(variant===0){
      rect(g,3,4,8,9,I);setclip(g,3,4,K);setclip(g,8,9,K);
      rect(g,4,60,7,63,J);setclip(g,4,60,K);setclip(g,7,63,K);
    }else{
      rect(g,10,32,15,37,I);setclip(g,10,32,K);setclip(g,15,37,K);
      rect(g,2,80,13,83,J);setclip(g,2,80,K);setclip(g,13,83,K); // fallen across the shelf
    }
    return toRows(g);
  }

  // =====================================================================
  // furn_checkout 60x22: shop counter, recessed belt with seam ticks, dead till
  // =====================================================================
  function makeFurnCheckout(){
    var w=60,h=22,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',I='I',J='J',Z='Z',x;
    bevel(g,0,4,59,21,K,L,M,D);
    rect(g,0,0,59,5,D);
    setclip(g,0,0,K);setclip(g,59,0,K);setclip(g,0,5,K);setclip(g,59,5,K);
    rect(g,6,8,40,16,D);setclip(g,6,8,K);setclip(g,40,8,K);setclip(g,6,16,K);setclip(g,40,16,K);
    for(x=10;x<40;x+=6)setclip(g,x,12,K);
    bevel(g,44,1,56,9,K,I,I,I);
    rect(g,46,3,54,6,Z);
    rect(g,44,10,56,10,J);
    return toRows(g);
  }

  // =====================================================================
  // furn_vending 26x18: iron cabinet, smashed glass front, coin slot
  // =====================================================================
  function makeFurnVending(){
    var w=26,h=18,g=mkGrid(w,h);
    var K='K';
    bevel(g,0,0,25,17,K,'H','M','D');
    rect(g,3,3,22,13,'G');setclip(g,3,3,K);setclip(g,22,3,K);setclip(g,3,13,K);setclip(g,22,13,K);
    setclip(g,9,5,K);setclip(g,10,6,K);setclip(g,9,7,K);setclip(g,11,8,K);setclip(g,10,9,K);
    setclip(g,15,4,K);setclip(g,16,5,K);setclip(g,15,6,K);
    setclip(g,12,7,'.');setclip(g,13,7,'.');
    rect(g,11,15,14,16,K);
    return toRows(g);
  }

  // =====================================================================
  // furn_desk 48x26: wood desk, side drawer block, papers
  // =====================================================================
  function makeFurnDesk(){
    var w=48,h=26,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L';
    bevel(g,0,0,47,25,K,L,M,D);
    rect(g,2,2,11,23,D);setclip(g,2,2,K);setclip(g,11,23,K);
    rect(g,2,12,11,12,K);
    rect(g,20,4,34,4,L);rect(g,20,10,34,10,L);
    rect(g,30,15,40,20,M);setclip(g,30,15,K);setclip(g,40,20,K);
    return toRows(g);
  }

  // =====================================================================
  // furn_records 30x18: iron filing cabinet, one drawer pulled open
  // =====================================================================
  function makeFurnRecords(){
    var w=30,h=18,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L';
    bevel(g,6,0,29,17,K,L,M,D);
    rect(g,8,3,27,3,D);rect(g,8,8,27,8,D);rect(g,8,13,27,13,D);
    bevel(g,0,4,7,13,K,L,M,D);
    rect(g,1,6,6,11,D);
    setclip(g,3,7,K);setclip(g,3,10,K);
    return toRows(g);
  }

  // =====================================================================
  // furn_palletStack 36x16: shorter wood pallet stack (buildings-scale rect)
  // =====================================================================
  function makeFurnPalletStack(){
    var w=36,h=16,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',x;
    bevel(g,1,6,34,15,K,M,D,K);
    rect(g,1,10,34,10,D);
    for(x=2;x<32;x+=5){rect(g,x,0,x+3,5,D);setclip(g,x,0,K);setclip(g,x+3,0,K);setclip(g,x,5,K);setclip(g,x+3,5,K);setclip(g,x+1,1,L);}
    return toRows(g);
  }

  // =====================================================================
  // furn_screen 8x40: folding hospital privacy screen, vertical, hinge seams
  // =====================================================================
  function makeFurnScreen(){
    var w=8,h=40,g=mkGrid(w,h);
    var K='K',I='I';
    bevel(g,1,0,6,39,K,'L','M','D');
    rect(g,0,13,7,13,I);rect(g,0,26,7,26,I);
    rect(g,1,38,6,39,I);setclip(g,1,38,K);setclip(g,6,39,K);
    return toRows(g);
  }

  // =====================================================================
  // furn_cabinetMed 40x16: pale glass-front medical cabinet, two shelves
  // =====================================================================
  function makeFurnCabinetMed(){
    var w=40,h=16,g=mkGrid(w,h);
    var K='K',G='G',F='F';
    bevel(g,0,0,39,15,K,'H','L','M');
    rect(g,3,3,36,6,G);setclip(g,3,3,K);setclip(g,36,3,K);setclip(g,3,6,K);setclip(g,36,6,K);
    setclip(g,6,4,F);setclip(g,7,4,F);
    rect(g,3,9,36,12,G);setclip(g,3,9,K);setclip(g,36,9,K);setclip(g,3,12,K);setclip(g,36,12,K);
    setclip(g,6,10,F);setclip(g,7,10,F);
    return toRows(g);
  }

  // =====================================================================
  // furn_console 40x20: iron desk, angled monitor housing (dead glass), switchboard
  // =====================================================================
  function makeFurnConsole(){
    var w=40,h=20,g=mkGrid(w,h);
    var K='K',H='H',Z='Z',x;
    bevel(g,0,6,39,19,K,'L','M','D');
    bevel(g,4,0,24,9,K,H,'M','D');
    rect(g,6,2,22,7,Z);setclip(g,6,2,K);setclip(g,22,7,K);
    for(x=28;x<37;x+=3)setclip(g,x,12,H);
    return toRows(g);
  }

  // =====================================================================
  // furn_benchWait 40x12: low concrete/iron waiting bench, no backrest
  // =====================================================================
  function makeFurnBenchWait(){
    var w=40,h=12,g=mkGrid(w,h);
    var K='K',I='I';
    rect(g,4,9,6,11,I);setclip(g,4,9,K);setclip(g,6,11,K);
    rect(g,33,9,35,11,I);setclip(g,33,9,K);setclip(g,35,11,K);
    bevel(g,2,1,37,8,K,'H','L','M');
    return toRows(g);
  }

  // =====================================================================
  // furn_cellBars 8x70: vertical iron cell bars, top/bottom rails
  // =====================================================================
  function makeFurnCellBars(){
    var w=8,h=70,g=mkGrid(w,h);
    var K='K',M='M',H='H',y;
    rect(g,0,0,7,1,M);rect(g,0,68,7,69,M);
    rect(g,1,2,2,67,M);rect(g,5,2,6,67,M);
    outlineFrom(g,[M],K);
    for(y=4;y<64;y+=12)setclip(g,1,y,H);
    return toRows(g);
  }

  // =====================================================================
  // furn_gearRack 60x16: top rail, hooks; three coats, one bare hook, one helmet
  // =====================================================================
  function makeFurnGearRack(){
    var w=60,h=16,g=mkGrid(w,h);
    var K='K',M='M',H='H',C='C',E='E';
    rect(g,2,1,57,2,M);setclip(g,2,1,K);setclip(g,57,1,K);setclip(g,2,2,K);setclip(g,57,2,K);
    [8,24,40,52].forEach(function(x){setclip(g,x,3,M);setclip(g,x,4,K);});
    [8,24,40].forEach(function(x){rect(g,x-3,5,x+3,13,C);setclip(g,x-1,7,E);setclip(g,x,7,E);});
    outlineFrom(g,[C],K);
    disc(g,52,8,3,3,M);disc(g,52,8,2,2,H);
    return toRows(g);
  }

  // =====================================================================
  // furn_hoseReel 24x24: coiled hose ring on an iron reel, wall mount tab
  // =====================================================================
  function makeFurnHoseReel(){
    var w=24,h=24,g=mkGrid(w,h);
    var K='K',M='M',C='C',E='E';
    disc(g,12,13,10,10,K);disc(g,12,13,9,9,C);
    disc(g,12,13,6,6,K);disc(g,12,13,5,5,M);
    disc(g,12,13,2,2,'.');
    setclip(g,9,10,E);setclip(g,15,10,E);
    rect(g,10,0,13,4,M);setclip(g,10,0,K);setclip(g,13,4,K);
    return toRows(g);
  }

  // =====================================================================
  // furn_transmitter 24x60: tall iron rack, module seams, a few dim LEDs
  // =====================================================================
  function makeFurnTransmitter(){
    var w=24,h=60,g=mkGrid(w,h);
    var K='K',D='D',H='H',y;
    bevel(g,2,0,21,59,K,'L','M',D);
    for(y=10;y<55;y+=10){rect(g,3,y,20,y,D);setclip(g,3,y,K);setclip(g,20,y,K);}
    setclip(g,17,6,H);setclip(g,17,17,H);setclip(g,6,27,H);
    return toRows(g);
  }

  // =====================================================================
  // transmitterLive 24x60: overlay of lit LEDs/VU bars over furn_transmitter,
  // same dims/anchor, mostly transparent except the lights. ready = a few
  // steady green-grey LEDs; live1/live2 alternate bright amber VU bars.
  // =====================================================================
  var TRANSMIT_PAL={G:MAT.rot.L,Y:MAT.iron.Y,W:MAT.iron.W};
  // one 2-wide VU bar, bottom-anchored in its slot, filled up to `height`
  function transmitBar(g,slot,height,ch){
    var bottom=slot[1]+slot[2]-1,top=bottom-height+1;
    rect(g,slot[0],top,slot[0]+1,bottom,ch);
  }
  function makeTransmitterLive(state){
    var w=24,h=60,g=mkGrid(w,h);
    var slots=[[16,3,6],[5,13,6],[16,23,6],[5,33,6],[16,43,6]];
    if(state==='ready'){
      slots.forEach(function(s){transmitBar(g,s,2,'G');});
      return toRows(g);
    }
    var heights=state==='live1'?[6,2,5,2,4]:[2,5,2,6,2];
    slots.forEach(function(s,i){transmitBar(g,s,heights[i],'Y');});
    var peak=heights.indexOf(Math.max.apply(null,heights)),s=slots[peak];
    setclip(g,s[0],s[1]+s[2]-heights[peak],'W');
    return toRows(g);
  }

  // =====================================================================
  // furn_workbench 60x22: wood bench, iron vice with a gap between jaws, tools mid-job
  // =====================================================================
  function makeFurnWorkbench(){
    var w=60,h=22,g=mkGrid(w,h);
    var K='K',D='D',I='I',J='J',x;
    bevel(g,0,2,59,21,K,'L','M',D);
    bevel(g,3,0,16,7,K,I,I,I);
    rect(g,8,3,11,4,'.');
    rect(g,30,9,44,13,D);
    setclip(g,33,10,J);setclip(g,38,11,J);setclip(g,41,10,J);
    for(x=46;x<54;x+=2)setclip(g,x,15,J);
    return toRows(g);
  }

  // =====================================================================
  // furn_lathe 40x24: iron bed, headstock block, chuck, workpiece, tailstock
  // =====================================================================
  function makeFurnLathe(){
    var w=40,h=24,g=mkGrid(w,h);
    var K='K',D='D',M='M';
    bevel(g,0,10,39,17,K,'L',M,D);
    bevel(g,0,2,10,23,K,'L',M,D);
    disc(g,13,13,2,2,D);
    rect(g,16,12,33,14,M);setclip(g,16,12,K);setclip(g,33,14,K);
    bevel(g,33,8,39,18,K,'L',M,D);
    return toRows(g);
  }

  // =====================================================================
  // furn_drumRack 40x20: two rust drums on a flat iron rack frame
  // =====================================================================
  function makeFurnDrumRack(){
    var w=40,h=20,g=mkGrid(w,h);
    var K='K',M='M',D='D',H='H',I='I';
    bevel(g,1,14,38,19,K,I,I,I);
    disc(g,11,9,8,8,K);disc(g,11,9,7,7,M);disc(g,11,9,4,4,D);
    setclip(g,8,5,H);
    disc(g,29,9,8,8,K);disc(g,29,9,7,7,M);disc(g,29,9,4,4,D);
    setclip(g,26,5,H);
    return toRows(g);
  }

  // =====================================================================
  // furn_rack 110x18: long warehouse pallet racking, uprights, sparse goods
  // =====================================================================
  function makeFurnRack(){
    var w=110,h=18,g=mkGrid(w,h);
    var K='K',D='D',L='L',I='I',J='J';
    bevel(g,0,2,109,17,K,'L','M',D);
    [0,36,73,108].forEach(function(x){rect(g,x,0,x+1,17,I);setclip(g,x,0,K);setclip(g,x+1,17,K);});
    rect(g,8,4,26,9,L);
    rect(g,50,4,64,9,J);
    rect(g,84,4,98,9,L);
    return toRows(g);
  }

  // =====================================================================
  // furn_pew 80x14: wood chapel pew, backrest + seat bands, plank seams
  // =====================================================================
  function makeFurnPew(){
    var w=80,h=14,g=mkGrid(w,h);
    var K='K',D='D',x,y;
    bevel(g,0,0,79,4,K,'L','M',D);
    bevel(g,0,6,79,13,K,'L','M',D);
    for(x=8;x<76;x+=12)for(y=8;y<=12;y++)setclip(g,x,y,D);
    return toRows(g);
  }

  // =====================================================================
  // furn_drawers 16x80: stacked morgue cold-storage drawer faces, iron
  // =====================================================================
  function makeFurnDrawers(){
    var w=16,h=80,g=mkGrid(w,h);
    var K='K',D='D',H='H',y;
    for(y=0;y<80;y+=16){
      bevel(g,1,y+1,14,y+14,K,'L','M',D);
      setclip(g,7,y+7,H);setclip(g,8,y+7,H);
    }
    return toRows(g);
  }

  // =====================================================================
  // furn_weaponRack 60x16: wood rack, mostly-empty cradle notches, one rifle left
  // =====================================================================
  function makeFurnWeaponRack(){
    var w=60,h=16,g=mkGrid(w,h);
    var K='K',D='D',I='I',x,i;
    bevel(g,0,0,59,15,K,'L','M',D);
    for(x=6;x<56;x+=8){rect(g,x,2,x+1,4,K);rect(g,x,11,x+1,13,K);}
    for(i=0;i<12;i++)setclip(g,22+Math.floor(i*0.5),2+i,I);
    return toRows(g);
  }

  // =====================================================================
  // furn_paperwork 20x14: two scattered overlapping forms with text ticks
  // =====================================================================
  function makeFurnPaperwork(){
    var w=20,h=14,g=mkGrid(w,h);
    var K='K',D='D',L='L',H='H';
    rect(g,1,3,12,11,L);setclip(g,1,3,K);setclip(g,12,3,K);setclip(g,1,11,K);setclip(g,12,11,K);
    rect(g,6,1,17,9,H);setclip(g,6,1,K);setclip(g,17,1,K);setclip(g,6,9,K);setclip(g,17,9,K);
    rect(g,8,3,14,3,D);rect(g,8,5,14,5,D);rect(g,8,7,12,7,D);
    rect(g,3,6,9,6,D);rect(g,3,8,9,8,D);
    return toRows(g);
  }

  // =====================================================================
  // furn_bedroll 36x14 x2: [0] rolled bedroll, [1] laid-flat blanket, refuge sign
  // =====================================================================
  function makeFurnBedroll(variant){
    var w=36,h=14,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',x;
    if(variant===0){
      disc(g,18,7,17,6,D);disc(g,18,7,16,5,M);
      outlineFrom(g,[D,M],K);
      for(x=6;x<30;x+=6){setclip(g,x,2,K);setclip(g,x,3,K);setclip(g,x,10,K);setclip(g,x,11,K);}
      setclip(g,10,3,L);setclip(g,11,3,L);
    }else{
      rect(g,2,2,33,11,M);
      outlineFrom(g,[M],K);
      rect(g,2,2,20,5,D);
      setclip(g,25,3,L);setclip(g,26,4,L);setclip(g,27,5,L);
      setclip(g,4,9,K);setclip(g,5,9,K);setclip(g,31,4,K);
    }
    return toRows(g);
  }

  // =====================================================================
  // furn_toolsLeft 28x16: a rag with a couple of iron tools left mid-task
  // =====================================================================
  function makeFurnToolsLeft(){
    var w=28,h=16,g=mkGrid(w,h);
    var K='K',D='D',M='M',I='I',J='J';
    rect(g,2,4,25,13,M);
    outlineFrom(g,[M],K);
    rect(g,4,6,20,6,D);
    setclip(g,8,9,I);setclip(g,9,9,I);setclip(g,9,8,I);
    setclip(g,15,10,J);setclip(g,16,10,J);setclip(g,17,11,J);
    setclip(g,22,5,I);
    return toRows(g);
  }

  // =====================================================================
  // ceilingLight 16x8: pale tube fixture seen from above (renderer adds the glow)
  // =====================================================================
  function makeCeilingLight(){
    var w=16,h=8,g=mkGrid(w,h);
    var K='K',M='M',L='L',H='H';
    rect(g,0,1,15,6,M);
    rect(g,1,2,14,5,L);
    rect(g,3,3,12,4,H);
    outlineFrom(g,[M],K);
    return toRows(g);
  }

  // =====================================================================
  // doorSecured_h 32x10 / doorSecured_v 10x32: locked steel mesh gate with a
  // padlock hasp. Structure is a function of the cross-thickness axis and a
  // period-4 mesh (divides 32), so the tiling axis is seamless by construction.
  // =====================================================================
  function makeDoorSecuredH(){
    var w=32,h=10,g=mkGrid(w,h);
    var K='K',D='D',M='M',H='H',x,y;
    for(x=0;x<w;x++){g[0][x]=K;g[1][x]=H;g[8][x]=D;g[9][x]=K;}
    for(y=2;y<8;y++)for(x=0;x<w;x++)g[y][x]=((x+y)%4===0)?D:M;
    bevel(g,14,3,17,6,K,H,M,D);
    setclip(g,15,2,D);setclip(g,16,2,D);
    return toRows(g);
  }
  function makeDoorSecuredV(){
    var w=10,h=32,g=mkGrid(w,h);
    var K='K',D='D',M='M',H='H',x,y;
    for(y=0;y<h;y++){g[y][0]=K;g[y][1]=H;g[y][8]=D;g[y][9]=K;}
    for(x=2;x<8;x++)for(y=0;y<h;y++)g[y][x]=((x+y)%4===0)?D:M;
    bevel(g,3,14,6,17,K,H,M,D);
    setclip(g,2,15,D);setclip(g,2,16,D);
    return toRows(g);
  }

  // =====================================================================
  // sealedFacade_h 32x20 x2 / sealedFacade_v 12x32 x2: boarded-up shopfront,
  // painted cap trim on the street-facing edge, vertical(h)/horizontal(v)
  // plank boards on a period-8 seam (divides 32) so the run tiles seamlessly
  // and every variant shares the same seam columns/rows as every other.
  // =====================================================================
  function makeSealedFacadeH(variant){
    var w=32,h=20,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',I='I',x,y,px;
    for(x=0;x<w;x++){g[0][x]=K;g[1][x]=I;g[2][x]=M;}
    for(y=3;y<h;y++)for(x=0;x<w;x++){px=x%8;g[y][x]=(px===0||px===7)?D:(px<4?M:L);}
    for(x=0;x<w;x++)g[h-1][x]=D;
    for(x=3;x<w;x+=8){
      if(variant===0){setclip(g,x,6,I);setclip(g,x+2,10,I);setclip(g,x,14,I);}
      else{setclip(g,x+1,4,I);setclip(g,x-1,17,I);setclip(g,x,9,K);setclip(g,x+2,13,K);}
    }
    return toRows(g);
  }
  function makeSealedFacadeV(variant){
    var w=12,h=32,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',I='I',x,y,py;
    for(y=0;y<h;y++){g[y][0]=K;g[y][1]=I;g[y][2]=M;}
    for(x=3;x<w;x++)for(y=0;y<h;y++){py=y%8;g[y][x]=(py===0||py===7)?D:(py<4?M:L);}
    for(y=0;y<h;y++)g[y][w-1]=D;
    for(y=3;y<h;y+=8){
      if(variant===0){setclip(g,6,y,I);setclip(g,10,y+2,I);setclip(g,6,y+4,I);}
      else{setclip(g,4,y+1,I);setclip(g,9,Math.max(0,y-1),I);setclip(g,9,y,K);setclip(g,5,y+3,K);}
    }
    return toRows(g);
  }

  // =====================================================================
  A.define('buildings',{
    wallH:{variants:[makeWallH(21,41),makeWallH(22,42)],pal:'MAT.concrete',anchor:'tile',note:'32x16 top-down house wall cap; tiles along x at 32; render.js clips to the top 14 rows'},
    wallV:{variants:[makeWallV(23,43),makeWallV(24,44)],pal:'MAT.concrete',anchor:'tile',note:'16x32 top-down house wall cap; tiles along y at 32; render.js clips to the left 14 columns'},
    roofFill:{variants:[makeRoofFill(1),makeRoofFill(2),makeRoofFill(3)],pal:'MAT.asphalt',anchor:'tile',note:'32x32 small-house tar-paper roof, low contrast, seamless both axes, every variant tiles against every other'},
    roofFillBig:{variants:[makeRoofFillBig(11),makeRoofFillBig(12),makeRoofFillBig(13)],pal:'MAT.concrete',anchor:'tile',note:'32x32 block-roof gravel/concrete cap, low contrast, seamless both axes, every variant tiles against every other'},
    roofEdge:{mask:buildRoofEdgeMasks(),pal:'MAT.concrete',anchor:'tile',note:'32x32 parapet lip mask; set bit = drop on that side, K outer line, H top cap, D shadow falling into the roof, corners mitre by distance'},
    roofVent:{rows:makeRoofVent(),pal:'MAT.iron',anchor:'feet',note:'16x14, iron flashing base, pipe stack, domed cap'},
    roofAC:{rows:makeRoofAC(),pal:'MAT.iron',anchor:'feet',note:'28x20, iron condenser box with a round fan grille'},
    roofWater:{rows:makeRoofWater(),pal:'MAT.iron',anchor:'feet',note:'24x34, tank on 4 splayed legs with a cross brace, domed lid'},
    roofSkylight:{rows:makeRoofSkylight(),pal:'MAT.glass',anchor:'feet',note:'26x18, flat two-panel glass skylight, corner glints'},
    roofAntenna:{rows:makeRoofAntenna(),pal:'MAT.iron',anchor:'feet',note:'14x30, thin iron lattice mast, cross braces, small dish tip'},
    roofStair:{rows:makeRoofStair(),pal:'MAT.concrete',anchor:'feet',note:'30x26, concrete stairwell head-house, lit roofline cap, door hint, vent pipe'},
    roofBillboard:{rows:makeRoofBillboard(),pal:BILLBOARD_PAL,anchor:'feet',note:'64x48, iron frame on two posts, faded pale advert face, low-contrast bars suggest type, no legible lettering'},
    furn_bed:{rows:makeFurnBed(),pal:'MAT.wood',anchor:'feet',note:'60x36, top-down bed, headboard band, pillow, blanket folds'},
    furn_table:{rows:makeFurnTable(),pal:'MAT.wood',anchor:'feet',note:'48x32, top-down wood table, grain streaks, leg corners'},
    furn_shelf:{rows:makeFurnShelf(),pal:'MAT.wood',anchor:'feet',note:'60x16, top-down wood shelf, dividers, a few items; also placed 16x60 unrotated per world.js, overhang is expected'},
    furn_crates:{rows:makeFurnCrates(),pal:FURN_CRATES_PAL,anchor:'feet',note:'32x28, 2x2 wood crates with iron corner banding'},
    furn_counter:{rows:makeFurnCounter(),pal:'MAT.wood',anchor:'feet',note:'80x22, top-down shop counter, raised back ledge, two items'},
    furn_shelfAisle:{variants:[makeFurnShelfAisle(0),makeFurnShelfAisle(1)],pal:FURN_CRATES_PAL,anchor:'feet',note:'18x100, stripped store aisle shelving, mostly bare, one knocked-over item per variant'},
    furn_checkout:{rows:makeFurnCheckout(),pal:CHECKOUT_PAL,anchor:'feet',note:'60x22, checkout counter, recessed belt with seams, dead till'},
    furn_vending:{rows:makeFurnVending(),pal:IRON_GLASS_PAL,anchor:'feet',note:'26x18, iron vending cabinet, smashed glass front, coin slot'},
    furn_desk:{rows:makeFurnDesk(),pal:'MAT.wood',anchor:'feet',note:'48x26, wood desk, side drawer block, papers'},
    furn_records:{rows:makeFurnRecords(),pal:'MAT.iron',anchor:'feet',note:'30x18, iron filing cabinet, one drawer pulled open'},
    furn_palletStack:{rows:makeFurnPalletStack(),pal:'MAT.wood',anchor:'feet',note:'36x16, wood pallet stack, slatted top'},
    furn_screen:{rows:makeFurnScreen(),pal:SCREEN_PAL,anchor:'feet',note:'8x40, folding hospital privacy screen, vertical, hinge seams'},
    furn_cabinetMed:{rows:makeFurnCabinetMed(),pal:MEDCAB_PAL,anchor:'feet',note:'40x16, pale glass-front medical cabinet, two shelves'},
    furn_console:{rows:makeFurnConsole(),pal:IRON_GLASS_PAL,anchor:'feet',note:'40x20, iron desk, angled monitor housing (dead glass), switchboard'},
    furn_benchWait:{rows:makeFurnBenchWait(),pal:BENCHWAIT2_PAL,anchor:'feet',note:'40x12, low concrete/iron waiting bench'},
    furn_cellBars:{rows:makeFurnCellBars(),pal:'MAT.iron',anchor:'feet',note:'8x70, vertical iron cell bars, top/bottom rails'},
    furn_gearRack:{rows:makeFurnGearRack(),pal:GEAR_PAL,anchor:'feet',note:'60x16, iron hook rail, three coats, one bare hook, one helmet'},
    furn_hoseReel:{rows:makeFurnHoseReel(),pal:HOSE_PAL,anchor:'feet',note:'24x24, coiled hose on an iron reel, wall mount tab'},
    furn_transmitter:{rows:makeFurnTransmitter(),pal:'MAT.iron',anchor:'feet',note:'24x60, tall transmitter rack, module seams, a few dim LEDs'},
    transmitterLive:{frames:{down:[makeTransmitterLive('ready'),makeTransmitterLive('live1'),makeTransmitterLive('live2')]},pal:TRANSMIT_PAL,anchor:'feet',note:'24x60 overlay, mostly transparent; frame 0 steady green-grey LEDs, 1/2 alternating bright amber VU bars'},
    furn_workbench:{rows:makeFurnWorkbench(),pal:FURN_CRATES_PAL,anchor:'feet',note:'60x22, wood workbench, iron vice, tools left mid-job'},
    furn_lathe:{rows:makeFurnLathe(),pal:'MAT.iron',anchor:'feet',note:'40x24, iron lathe bed, headstock, chuck, workpiece, tailstock'},
    furn_drumRack:{rows:makeFurnDrumRack(),pal:DRUM_PAL,anchor:'feet',note:'40x20, two rust drums on a flat iron rack'},
    furn_rack:{rows:makeFurnRack(),pal:FURN_CRATES_PAL,anchor:'feet',note:'110x18, long warehouse pallet racking, sparse goods'},
    furn_pew:{rows:makeFurnPew(),pal:'MAT.wood',anchor:'feet',note:'80x14, wood chapel pew, backrest and seat bands'},
    furn_drawers:{rows:makeFurnDrawers(),pal:'MAT.iron',anchor:'feet',note:'16x80, stacked morgue cold-storage drawer faces'},
    furn_weaponRack:{rows:makeFurnWeaponRack(),pal:FURN_CRATES_PAL,anchor:'feet',note:'60x16, wood rack, mostly-empty cradle notches, one rifle left'},
    furn_paperwork:{rows:makeFurnPaperwork(),pal:'MAT.concrete',anchor:'center',note:'20x14, flat decal, two scattered overlapping forms'},
    furn_bedroll:{variants:[makeFurnBedroll(0),makeFurnBedroll(1)],pal:'MAT.olive',anchor:'center',note:'36x14, flat decal, [0] rolled, [1] laid-flat blanket'},
    furn_toolsLeft:{rows:makeFurnToolsLeft(),pal:FURN_CRATES_PAL,anchor:'center',note:'28x16, flat decal, tools left on a rag'},
    ceilingLight:{rows:makeCeilingLight(),pal:'MAT.glass',anchor:'center',note:'16x8, flat decal, pale tube fixture seen from above'},
    doorSecured_h:{rows:makeDoorSecuredH(),pal:'MAT.iron',anchor:'tile',note:'32x10, locked steel mesh gate, padlock hasp, tiles along x at 32'},
    doorSecured_v:{rows:makeDoorSecuredV(),pal:'MAT.iron',anchor:'tile',note:'10x32, locked steel mesh gate, padlock hasp, tiles along y at 32'},
    sealedFacade_h:{variants:[makeSealedFacadeH(0),makeSealedFacadeH(1)],pal:FURN_CRATES_PAL,anchor:'tile',note:'32x20, boarded-up shopfront, painted cap trim on the street edge, tiles along x at 32'},
    sealedFacade_v:{variants:[makeSealedFacadeV(0),makeSealedFacadeV(1)],pal:FURN_CRATES_PAL,anchor:'tile',note:'12x32, boarded-up shopfront, painted cap trim on the street edge, tiles along y at 32'}
  });
})();
