// Dead Signal street-life dressing: the flat litter/debris/wear family that
// explains how a street was used up to Day 9 of the quarantine. Everything
// here is a NON-SOLID ground decal (world.js flat()/decal() under
// 'streetlife/<name>'), drawn under actors. One texel = one world unit (den 1).
//
// Colour discipline: muted material ramps only (bin-bag plastic, cardboard,
// soil, concrete, brick, wood, glass, asphalt). Nothing is pickup-coloured
// (no cyan/gold/orange/pink), nothing glows, and the brightest texels are a
// handful of 2-texel paper/glass glints so litter stays quieter than pickups.
// Small objects (bags, boxes, bins, planks, bricks) get a 1-texel K outline and
// a top-left light (L top/left inner edge, D bottom/right); wear decals
// (damp, dirt, paint) stay outline-free like tiles.js decals.
//
// Orientation contract (flat props support {rot:1} = -90deg and {flip:true}):
//   * source-side pieces (glassShards, brickSpill) draw their wall side on the
//     TOP edge; rot:1 (-90deg) puts the wall on the LEFT. A wall on the RIGHT
//     needs rotate:+PI/2 (or rot:1 + flipY) -- ART.draw supports both, but
//     render.js's flat-prop path currently forwards only rot/flip.
//   * *_h strips tile left-right (32 wide), *_v strips tile top-bottom
//     (32 tall). Periodic marks use x%period with period | 32 and edge
//     profiles built from sin(2*pi*k*x/32) terms, so every variant meets every
//     other variant at the same boundary height -- seamless in any order.
//   * paperEdge_h / gutterDamp_h / drain_h / wallDirt_h: the edge (curb,
//     fence, wall) is the TOP row. paperEdge_h, gutterDamp_h and drain_h
//     append vertically mirrored variants (edge on the BOTTOM row) because
//     flat props cannot flipY. The _v twins are transposes of variants [0..n)
//     (edge on the LEFT column); flip mirrors them to a right-hand edge.
//   * curbCut_h: road on the BOTTOM edge ([2-3] mirrored: road TOP), drawn
//     over a tiles/curb piece and mostly transparent;
//     curbCut_v (transpose): road RIGHT, flip for road LEFT.
(function(){
  'use strict';
  var A=(typeof window!=='undefined'?window:globalThis).DSArt;
  var MAT=A.MAT,shade=A.shade;

  // ---- grid helpers (same shape as art/lots.js) ----
  function mkGrid(w,h){var g=[],y,x,row;for(y=0;y<h;y++){row=[];for(x=0;x<w;x++)row.push('.');g.push(row);}return g;}
  function setclip(g,x,y,ch){if(y>=0&&y<g.length&&x>=0&&x<g[0].length)g[y][x]=ch;}
  function at(g,x,y){return(y>=0&&y<g.length&&x>=0&&x<g[0].length)?g[y][x]:'.';}
  function rect(g,x0,y0,x1,y1,ch){var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)setclip(g,x,y,ch);}
  function toRows(g){return g.map(function(r){return r.join('');});}
  function transpose(rows){var out=[],x,y,s;for(x=0;x<rows[0].length;x++){s='';for(y=0;y<rows.length;y++)s+=rows[y][x];out.push(s);}return out;}
  function disc(g,cx,cy,rx,ry,ch){
    var x,y;
    for(y=-ry;y<=ry;y++)for(x=-rx;x<=rx;x++)if((x*x)/(rx*rx)+(y*y)/(ry*ry)<=1.05)setclip(g,Math.round(cx+x),Math.round(cy+y),ch);
  }
  function pmod(n,p){return((n%p)+p)%p;}
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  // convex polygon fill, sampled at texel centres
  function poly(g,pts,ch){
    var minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9,i,x,y,n=pts.length;
    pts.forEach(function(p){minx=Math.min(minx,p[0]);maxx=Math.max(maxx,p[0]);miny=Math.min(miny,p[1]);maxy=Math.max(maxy,p[1]);});
    for(y=Math.floor(miny);y<=Math.ceil(maxy);y++)for(x=Math.floor(minx);x<=Math.ceil(maxx);x++){
      var px=x+.5,py=y+.5,pos=0,neg=0;
      for(i=0;i<n;i++){var a=pts[i],b=pts[(i+1)%n],c=(b[0]-a[0])*(py-a[1])-(b[1]-a[1])*(px-a[0]);if(c>0)pos++;else if(c<0)neg++;}
      if(!(pos&&neg))setclip(g,x,y,ch);
    }
  }
  // rotated rectangle (a plank, a flattened sheet)
  function box(g,cx,cy,len,wid,ang,ch){
    var c=Math.cos(ang),s=Math.sin(ang),hl=len/2,hw=wid/2;
    poly(g,[[cx-c*hl+s*hw,cy-s*hl-c*hw],[cx+c*hl+s*hw,cy+s*hl-c*hw],[cx+c*hl-s*hw,cy+s*hl+c*hw],[cx-c*hl-s*hw,cy-s*hl+c*hw]],ch);
  }
  // continuous 1px line (Bresenham)
  function line(g,x0,y0,x1,y1,ch){
    x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
    var dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy,e2;
    for(;;){setclip(g,x0,y0,ch);if(x0===x1&&y0===y1)break;e2=2*err;if(e2>=dy){err+=dy;x0+=sx;}if(e2<=dx){err+=dx;y0+=sy;}}
  }
  // An object is drawn alone on a scratch grid in its fill letter, then given a
  // 1-texel K outline and a top-left light (L inside the top/left outline, D
  // inside the bottom/right), then stamped over the target. Stamping objects
  // back-to-front keeps an outline between overlapping bags/boards (rule 16).
  function shaded(w,h,draw,c){
    var t=mkGrid(w,h),x,y;draw(t);
    var src=t.map(function(r){return r.slice();});
    function empty(xx,yy){return at(src,xx,yy)==='.';}
    for(y=0;y<h;y++)for(x=0;x<w;x++){if(src[y][x]==='.')continue;
      if(empty(x-1,y)||empty(x+1,y)||empty(x,y-1)||empty(x,y+1))t[y][x]=c.K;}
    var o=t.map(function(r){return r.slice();});
    for(y=0;y<h;y++)for(x=0;x<w;x++){if(o[y][x]!==c.M)continue;
      if(c.L&&(at(o,x,y-1)===c.K||at(o,x-1,y)===c.K))t[y][x]=c.L;
      else if(c.D&&(at(o,x,y+1)===c.K||at(o,x+1,y)===c.K))t[y][x]=c.D;}
    return t;
  }
  function stamp(g,t){var x,y;for(y=0;y<t.length;y++)for(x=0;x<t[0].length;x++)if(t[y][x]!=='.')setclip(g,x,y,t[y][x]);}
  // 2-texel crumbs (never single orphans): horizontal or vertical pair
  function crumb(g,x,y,ch,vert){setclip(g,x,y,ch);if(vert)setclip(g,x,y+1,ch);else setclip(g,x+1,y,ch);}
  // a small flat chip with a drop shadow below-right instead of an outline
  function chip(g,x,y,w,h,top,body,sh){
    rect(g,x,y,x+w-1,y+h-1,body);rect(g,x,y,x+w-1,y,top);
    rect(g,x+1,y+h,x+w,y+h,sh);rect(g,x+w,y+1,x+w,y+h-1,sh);
  }

  // ---- palettes (ramps from npm run art:ramp; hexes noted per ramp) ----
  var BAG={K:'#030305',D:'#10141c',M:'#222933',L:'#384148',H:'#53595c'};       // --hue 255 --l 0.1,0.46 --chroma 0.02
  var BAGG={K:'#020705',D:'#0e1d16',M:'#253528',L:'#424d3f',H:'#61655d'};      // --hue 150 --l 0.12,0.5 --chroma 0.03
  var CARD={K:'#1c1410',D:'#3b2b20',M:'#574736',L:'#716654',H:'#89867c'};      // --hue 70 --l 0.2,0.62 --chroma 0.035
  var SOIL={K:'#0a0404',D:'#1e100a',M:'#2f2016',L:'#3f3327',H:'#4c4740'};      // --hue 55 --l 0.12,0.4 --chroma 0.03
  var HAZARD_Y='#6d4f20'; // same muted faded amber as art/lots.js hazard paint

  var BAGS_PAL={K:BAG.K,D:BAG.D,M:BAG.M,L:BAG.L,H:BAG.H,E:BAGG.D,F:BAGG.M,G:BAGG.L,P:CARD.H,Q:CARD.L,C:CARD.M,S:SOIL.M,T:MAT.iron.L};
  var BOX_PAL={K:CARD.K,D:CARD.D,M:CARD.M,L:CARD.L,H:CARD.H,B:BAG.D};
  var PAPER_PAL={K:'#1d1d1f',P:'#94918a',Q:'#6c685f',N:'#77746c',O:MAT.concrete.D,B:BAG.L,C:BAG.M};   // P/N pale sheets (below concrete.H), Q folded face, K soft cast shadow
  var SHARD={K:'#050a0c',D:'#2b373a',M:'#46555a',L:'#7b8b8d',H:'#a3adac'};      // grey glass, not window teal: dark see-through body + pale cool edge; H glints stay at concrete.H, never brighter
  var GLASS_PAL={K:SHARD.K,D:SHARD.D,M:SHARD.M,L:SHARD.L,H:SHARD.H,F:MAT.iron.M,G:MAT.iron.K};
  var BRICK_PAL={K:MAT.brick.K,D:MAT.brick.D,M:MAT.brick.M,L:MAT.brick.L,P:MAT.concrete.L,Q:MAT.concrete.M,U:MAT.concrete.D,V:shade(MAT.concrete.D,-6),W:MAT.wood.D};
  var WEATHERED={K:'#140d0a',D:'#30251c',M:'#4b3e31',L:'#665846',H:'#857760'};  // --hue 65 --l 0.16,0.56 --chroma 0.03: rain-greyed softwood, far below brick red
  var PLY={K:'#16110c',D:'#3d3629',M:'#554c3b',L:'#6d6450'};                    // exterior plywood, grey-beige
  var TIMBER_PAL={K:WEATHERED.K,D:WEATHERED.D,M:WEATHERED.M,L:WEATHERED.L,H:WEATHERED.H,N:MAT.iron.L,P:PLY.M,Q:PLY.D,R:PLY.L,S:PLY.K};
  var BIN_G={D:'#1f2c22',M:'#33453a',L:'#4d5e4f',H:'#667263'};                  // municipal green wheelie bin, dusty
  var BIN_K={D:'#1d2329',M:'#333b43',L:'#4c555e',H:'#657079'};                  // charcoal wheelie bin
  var TIP_PAL={K:BAG.K,E:BIN_G.D,F:BIN_G.M,G:BIN_G.L,A:BIN_G.H,D:BIN_K.D,M:BIN_K.M,L:BIN_K.L,H:BIN_K.H,B:BAG.M,C:BAG.L,W:BAG.D,I:MAT.iron.D,J:MAT.iron.M,O:MAT.iron.L,P:CARD.H,Q:CARD.L,S:SOIL.M,U:MAT.concrete.D,V:shade(MAT.concrete.D,-8)};
  var DRAIN_PAL={K:MAT.asphalt.K,D:MAT.iron.D,M:MAT.iron.M,L:MAT.iron.L,W:MAT.asphalt.D,S:SOIL.M,P:CARD.L};
  var DAMP_PAL={K:MAT.asphalt.K,D:shade(MAT.asphalt.D,-6),L:MAT.asphalt.M};
  var DIRT_PAL={K:MAT.concrete.K,D:shade(MAT.concrete.D,-8),M:MAT.concrete.D,S:SOIL.D};
  var PAINT_PAL={W:MAT.concrete.L,V:MAT.concrete.M,D:MAT.asphalt.D,Y:HAZARD_Y,Z:shade(HAZARD_Y,-12)};
  var CURB_PAL={K:MAT.concrete.K,D:MAT.concrete.D,M:MAT.concrete.M,L:MAT.concrete.L,J:MAT.asphalt.K,E:'#28221e',T:'#7a6f5c',U:'#5e5444'};

  var BAGC={K:'K',D:'D',M:'M',L:'L'},GBAGC={K:'K',D:'E',M:'F',L:'G'};

  // =====================================================================
  // binBags 32x24 x3: torn bin-bag clusters at a collection point.
  // [0] three black bags, one torn; [1] two black + a green garden bag;
  // [2] one burst bag, contents strewn (a knocked-over pile)
  // =====================================================================
  function bag(g,cx,cy,rx,ry,c,opt){
    opt=opt||{};
    var t=shaded(32,24,function(t){
      disc(t,cx,cy,rx,ry,'M');
      if(!opt.open){rect(t,cx-1,cy-ry-2,cx,cy-ry,'M');} // twisted knot
      else{rect(t,cx-rx+1,cy-1,cx-rx+2,cy+1,'.');}
    },{K:c.K,M:c.M,L:c.L,D:c.D});
    // plastic sheen: one short lit crease upper-left
    if(c.M==='M'){setclip(t,cx-Math.round(rx*.45),cy-Math.round(ry*.4),'H');setclip(t,cx-Math.round(rx*.45)+1,cy-Math.round(ry*.4),'H');}
    // fold creases
    line(t,cx+1,cy-ry+2,cx+Math.round(rx*.5),cy+1,c.D);
    if(opt.tear){line(t,cx-2,cy+ry-2,cx+2,cy+ry-3,'K');setclip(t,cx,cy+ry-2,'K');}
    stamp(g,t);
  }
  function spill(g,rng,x0,y0,x1,y1,n){
    var i,x,y,k;
    for(i=0;i<n;i++){
      x=x0+Math.floor(rng()*(x1-x0));y=y0+Math.floor(rng()*(y1-y0));k=rng();
      if(k<.35){rect(g,x,y,x+2,y,'P');rect(g,x+1,y+1,x+3,y+1,'Q');}          // paper scrap
      else if(k<.55){rect(g,x,y,x+1,y,'T');rect(g,x,y+1,x+1,y+1,'K');}       // crushed can
      else if(k<.8){rect(g,x,y,x+2,y+1,'S');setclip(g,x+3,y+1,'S');}          // food waste
      else{rect(g,x,y,x+3,y+1,'C');rect(g,x,y+2,x+3,y+2,'K');}                // card scrap
    }
  }
  function makeBinBags(v){
    var g=mkGrid(32,24),rng=mulberry32(310+v);
    if(v===0){
      spill(g,rng,20,17,29,22,3);
      bag(g,21,10,7,6,BAGC,{});
      bag(g,10,13,8,7,BAGC,{});
      bag(g,23,17,5,4,BAGC,{tear:true});
    }else if(v===1){
      spill(g,rng,2,16,10,22,2);
      bag(g,20,9,8,6,GBAGC,{});
      bag(g,11,11,7,6,BAGC,{});
      bag(g,22,17,7,5,BAGC,{tear:true});
    }else{
      spill(g,rng,1,14,31,22,7);
      bag(g,12,10,9,7,BAGC,{open:true,tear:true});
      spill(g,rng,1,2,6,12,2);
    }
    return toRows(g);
  }

  // =====================================================================
  // flatBoxes 32x24 x3: flattened cardboard left behind a shop.
  // [0] two sheets crossed; [1] a neat stack of three; [2] a sheet + a
  // crushed box still standing on its side
  // =====================================================================
  var BOXC={K:'K',M:'M',L:'L',D:'D'};
  function sheet(g,cx,cy,len,wid,ang,opt){
    opt=opt||{};
    var t=shaded(32,24,function(t){box(t,cx,cy,len,wid,ang,'M');},BOXC);
    var c=Math.cos(ang),s=Math.sin(ang);
    // centre fold crease across the short axis, packing tape along the long seam
    line(t,cx-s*(wid/2-1),cy+c*(wid/2-1),cx+s*(wid/2-1),cy-c*(wid/2-1),'D');
    if(opt.tape)line(t,cx-c*(len/2-2),cy-s*(len/2-2),cx+c*(len/2-2),cy+s*(len/2-2),'H');
    if(opt.print){var px=Math.round(cx+c*len*.22),py=Math.round(cy+s*len*.22)+1;rect(t,px,py,px+2,py,'B');rect(t,px+1,py-1,px+1,py-1,'B');}
    stamp(g,t);
  }
  function makeFlatBoxes(v){
    var g=mkGrid(32,24);
    if(v===0){
      sheet(g,13,13,22,13,.18,{tape:true});
      sheet(g,20,10,18,10,-.42,{print:true});
    }else if(v===1){
      sheet(g,15,15,24,14,.05,{});
      sheet(g,16,12,24,14,-.06,{});
      sheet(g,17,9,22,12,.1,{tape:true,print:true});
    }else{
      sheet(g,12,14,20,12,-.3,{tape:true});
      // crushed box on its side: lit top face, shadowed side face
      var t=shaded(32,24,function(t){poly(t,[[19,8],[29,6],[30,15],[20,18]],'M');},BOXC);
      line(t,20,12,29,10,'K');rect(t,21,13,28,15,'D');rect(t,22,13,27,13,'M');
      line(t,21,9,27,8,'H');
      stamp(g,t);
    }
    return toRows(g);
  }

  // =====================================================================
  // paperEdge_h 32x10 x3 (edge = top row; bottom=true puts it on the bottom
  // row) / paperEdge_v 10x32 x3 (edge = left column): pale irregular paper
  // stencils, each with a soft shadow on its lower side, tight to the edge.
  // =====================================================================
  function crumple(g,x,y,a,b){rect(g,x,y,x+2,y,a);rect(g,x,y+1,x+1,y+1,a);setclip(g,x+2,y+1,b);rect(g,x+1,y+2,x+3,y+2,'K');}
  function sheetFlat(g,x,y,w,a,b){rect(g,x,y,x+w-1,y,a);rect(g,x+1,y+1,x+w,y+1,a);rect(g,x+2,y+2,x+w,y+2,b);}
  function makePaperEdgeH(v,bottom){
    var g=mkGrid(32,10),rng=mulberry32(330+v),i,x,y,w,k;
    var gapMax=[6,9,3][v],reach=[2,2,4][v];
    function stencil(s,px,py){var yy,xx,ch;for(yy=0;yy<s.length;yy++)for(xx=0;xx<s[yy].length;xx++){ch=s[yy][xx];if(ch!=='.')setclip(g,px+xx,py+yy,ch);}}
    // pale irregular paper shapes; the K is a soft cast shadow on the lower edge only
    var SHEETS=[
      ['PPPPPP.','.PPNNPP','.PPPPPQ','..KKKKK'],   // skewed flat sheet, print line, sharp corners
      ['PPPPQ','PNNPQ','PPPPP','PPP..','.KK..'],   // sheet with its corner folded under
      ['.PP.','PPPQ','PQQ.','.KK.'],               // crumpled ball
      ['NNNNNN','NQQNQN','NNNNNN','NQQQNN','.KKKKK'], // newsprint page, column text
      ['CBC','CCC','.KK']                          // crisp packet
    ];
    x=1+Math.floor(rng()*3);
    for(i=0;i<12&&x<28;i++){
      k=rng();y=Math.floor(rng()*rng()*reach);
      var s=SHEETS[k<.25?0:k<.45?1:k<.75?2:k<.9?3:4];
      stencil(s,x,bottom?10-s.length-y:y);w=s[0].length;
      x+=w+1+Math.floor(rng()*gapMax);
    }
    // wind-packed grit in the gaps along the edge
    for(x=1;x<30;x++){var ey=bottom?9:0;if(at(g,x,ey)==='.'&&at(g,x+1,ey)==='.'&&at(g,x-1,ey)==='.'&&pmod(x*7+v*3,9)===0){setclip(g,x,ey,'O');setclip(g,x+1,ey,'O');}}
    return toRows(g);
  }

  // =====================================================================
  // glassShards 32x16 x3: broken shop glass below a storefront (wall side =
  // top edge). [0] a light scatter; [1] a dense fall with a bent frame bar;
  // [2] a wide kicked spread
  // =====================================================================
  function shard(g,x,y,s,rng){
    if(s===0){setclip(g,x,y,'M');setclip(g,x+1,y,'L');setclip(g,x+1,y+1,'K');setclip(g,x+2,y+1,'K');}
    else if(s===1){setclip(g,x,y,'L');setclip(g,x,y+1,'M');setclip(g,x+1,y+1,'M');setclip(g,x+1,y+2,'K');setclip(g,x+2,y+2,'K');}
    else{poly(g,[[x,y],[x+4+Math.floor(rng()*2),y+1],[x+1,y+3]],'M');setclip(g,x+1,y,'L');setclip(g,x+2,y,'L');rect(g,x+1,y+3,x+2,y+3,'K');setclip(g,x+4,y+2,'K');}
  }
  function makeGlassShards(v){
    var w=32,h=16,g=mkGrid(w,h),rng=mulberry32(340+v),i,x,y;
    // shard stencils: dark see-through body (D/M), a pale lit edge (L) and one
    // glint corner (H). Big ones lie in a band at the wall foot.
    var BIG=[
      ['HLLLL','LMMML','.LMM.','..DD.'],
      ['LLH','LMM','MM.','D..'],
      ['.LLH','LMMM','LMM.','.DD.'],
      ['HLL.','LMML','.MMM','..DD'],
      ['LLLH.','LMMMM','.DDD.']
    ];
    var SMALL=[['LH','DM'],['LL','MD'],['HL','DM'],['LL','D.']];
    function stencil(s,px,py){var yy,xx,ch;for(yy=0;yy<s.length;yy++)for(xx=0;xx<s[yy].length;xx++){ch=s[yy][xx];if(ch!=='.')setclip(g,px+xx,py+yy,ch);}}
    // 1) the band along the wall
    var skip=[.3,.05,.45][v];
    x=[2,1,1][v];
    while(x<29){
      var s=BIG[Math.floor(rng()*BIG.length)];
      if(rng()>skip)stencil(s,x,Math.floor(rng()*(v===1?3:2)));
      x+=s[0].length+(v===1?0:1)+Math.floor(rng()*2);
    }
    // 2) smaller pieces thinning out below the band
    var mid=[6,9,12][v];
    for(i=0;i<mid;i++){x=1+Math.floor(rng()*29);y=4+Math.floor(Math.pow(rng(),1.4)*(v===2?9:6));
      if(at(g,x,y)==='.'&&at(g,x+1,y)==='.'&&at(g,x,y+1)==='.')stencil(SMALL[Math.floor(rng()*SMALL.length)],x,y);}
    // 3) far glints: a pale texel with its dark body under it
    var far=[3,4,6][v];
    for(i=0;i<far;i++){x=1+Math.floor(rng()*30);y=(v===2?9:8)+Math.floor(rng()*(v===2?6:5));if(at(g,x,y)==='.'&&at(g,x,y+1)==='.'){setclip(g,x,y,'L');setclip(g,x,y+1,'D');}}
    if(v===1){line(g,5,5,15,7,'F');line(g,5,6,15,8,'G');setclip(g,16,8,'F');}   // bent shopfront frame bar
    return toRows(g);
  }

  // =====================================================================
  // brickSpill 40x24 x3: fresh brick and plaster fallen from a broken facade
  // (wall side = top edge). A dust bed densest at the wall, big chunks in the
  // pile, small crumbs thrown further out. [2] includes a snapped lath.
  // =====================================================================
  function brick(g,x,y,w){rect(g,x,y,x+w-1,y+1,'M');rect(g,x,y,x+w-1,y,'L');rect(g,x+1,y+2,x+w,y+2,'K');rect(g,x+w,y+1,x+w,y+1,'K');}
  function plaster(g,x,y,w){rect(g,x,y,x+w-1,y+1,'Q');rect(g,x,y,x+w-2,y,'P');rect(g,x+1,y+2,x+w,y+2,'V');}
  function makeBrickSpill(v){
    var w=40,h=24,g=mkGrid(w,h),rng=mulberry32(350+v),x,y,i,cx=v===1?23:v===2?20:16,hw=v===2?19:15,depth=v===2?7:10;
    for(x=0;x<w;x++){
      var u=(x-cx)/hw;if(Math.abs(u)>=1)continue;
      var d=Math.round(depth*Math.sqrt(1-u*u)*(.75+.25*(1-u*u))+Math.sin(x*1.7+v)*1.1);
      if(d<1)continue;
      rect(g,x,0,x,d,'U');
      if(d>4)rect(g,x,0,x,Math.floor(d*.45),'V');
    }
    // pile: big chunks near the wall, sized down with distance
    var n=v===2?26:22;
    for(i=0;i<n;i++){
      y=Math.floor(Math.pow(rng(),1.4)*(depth+4));
      var spread=hw*(1-y/(depth+8));
      x=Math.round(cx+(rng()*2-1)*spread);
      var big=y<depth*.6;
      if(rng()<.62)brick(g,x,y,big?4:3);else plaster(g,x,y,big?4:3);
    }
    // thrown crumbs past the dust edge
    for(i=0;i<6;i++){x=Math.round(cx+(rng()*2-1)*hw*1.1);y=depth+2+Math.floor(rng()*(h-depth-5));crumb(g,x,y,rng()<.5?'M':'Q');setclip(g,x+1,y+1,'K');}
    if(v===2){line(g,6,3,19,7,'W');line(g,7,3,20,7,'W');line(g,6,4,19,8,'K');}
    return toRows(g);
  }

  // =====================================================================
  // timberScrap 32x20 x3: offcuts and pulled boards at a boarded entrance.
  // [0] two crossed boards + offcut; [1] a pile of four; [2] plywood offcut
  // with a nailed board
  // =====================================================================
  var WOODC={K:'K',M:'M',L:'L',D:'D'};
  function board(g,cx,cy,len,wid,ang,opt){
    opt=opt||{};
    var c=Math.cos(ang),s=Math.sin(ang),x,y;
    var t=shaded(32,20,function(t){
      box(t,cx,cy,len,wid,ang,'M');
      if(opt.snap){var ex=cx+c*len/2,ey=cy+s*len/2;setclip(t,Math.round(ex),Math.round(ey-1),'.');setclip(t,Math.round(ex-c),Math.round(ey-s+1),'.');}
    },WOODC);
    if(wid>=4)line(t,cx-c*(len/2-3),cy-s*(len/2-3)+.4,cx+c*(len/2-3)-1,cy+s*(len/2-3)+.4,'D');
    // pale sawn end grain at both ends
    for(y=0;y<20;y++)for(x=0;x<32;x++){
      var ch=t[y][x];if(ch==='.'||ch==='K')continue;
      var along=(x+.5-cx)*c+(y+.5-cy)*s;
      if(Math.abs(along)>=len/2-1.6&&!(opt.snap&&along>0))t[y][x]='H';
    }
    if(opt.nails){[-1,1].forEach(function(k){var nx=Math.round(cx+k*c*(len/2-4)),ny=Math.round(cy+k*s*(len/2-4));setclip(t,nx,ny,'N');setclip(t,nx,ny+1,'K');});}
    stamp(g,t);
  }
  function makeTimberScrap(v){
    var g=mkGrid(32,20);
    if(v===0){
      board(g,15,13,26,5,0,{nails:true});
      board(g,15,8,22,5,-.46,{snap:true});
      board(g,27,17,8,4,0,{});
    }else if(v===1){
      board(g,16,15,26,4,.03,{});
      board(g,15,11,24,4,-.04,{nails:true});
      board(g,17,7,22,4,.08,{});
      board(g,13,4,16,3,-.12,{snap:true});
    }else{
      // a rectangular plywood sheet pulled off a window, one straight batten nailed across it
      var t=shaded(32,20,function(t){box(t,14,10,22,15,.08,'P');},{K:'S',M:'P',L:'R',D:'Q'});
      line(t,6,6,21,7,'Q');line(t,5,13,20,14,'Q');                       // ply face grain
      rect(t,20,4,21,4,'S');rect(t,7,15,7,16,'S');                        // screw holes torn out
      stamp(g,t);
      board(g,17,10,29,4,-.05,{nails:true});
    }
    return toRows(g);
  }

  // =====================================================================
  // tippedBin 36x24 x3: a knocked-over container, spill out of its mouth.
  // [0] green wheelie bin, lid open, bags out; [1] grey wheelie bin, lid shut;
  // [2] round municipal litter bin on its side, paper and ash out
  // =====================================================================
  function makeTippedBin(v){
    var g=mkGrid(36,24),rng=mulberry32(360+v),i,x,y;
    var BAGL={K:'K',M:'B',L:'C',D:'W'};
    if(v<2){
      var c=v===0?{K:'K',M:'F',L:'G',D:'E'}:{K:'K',M:'M',L:'L',D:'D'};
      var hi=v===0?'A':'H';
      // grime and ash fanning out of the mouth
      for(x=0;x<13;x++){var d=Math.round((13-x)*(v===0?.55:.3)+Math.sin(x*1.3)*.8);if(d>0)rect(g,x,12-d,x,12+d,'V');}
      if(v===0){
        stamp(g,shaded(36,24,function(t){disc(t,5,14,4,3,'B');rect(t,8,13,11,15,'B');},BAGL)); // bag dragged out
        setclip(g,3,12,'H');
        [[1,5],[2,19],[8,20],[8,5]].forEach(function(p){rect(g,p[0],p[1],p[0]+2,p[1],'P');rect(g,p[0],p[1]+1,p[0]+2,p[1]+1,'Q');rect(g,p[0]+1,p[1]+2,p[0]+3,p[1]+2,'K');});
      }else{
        rect(g,3,15,5,15,'P');rect(g,3,16,5,16,'Q');rect(g,4,17,6,17,'K');
      }
      // body: tapers from the wide mouth end (left) to the base (right)
      var body=shaded(36,24,function(t){poly(t,[[13,4.5],[31,7.5],[31,17.5],[13,20.5]],'M');},c);
      for(y=9;y<=16;y++){setclip(body,21,y,c.D);setclip(body,26,y,c.D);}           // moulded ribs
      rect(body,15,7,19,7,hi);
      stamp(g,body);
      if(v===0){
        // open mouth: a lit rim ring round a black interior
        stamp(g,shaded(36,24,function(t){disc(t,13,12,4,8,'M');},c));
        disc(g,13,12,2,6,'K');rect(g,14,8,14,16,'W');rect(g,11,6,12,6,hi);
        // lid: a flat plate hinged at the top of the rim, flopped open
        stamp(g,shaded(36,24,function(t){poly(t,[[2,0],[13,1],[12,4.6],[1,3.6]],'M');},c));
        rect(g,3,1,10,1,hi);rect(g,12,4,13,4,'O');
      }else{
        // lid shut: a raised lip plate over the mouth end, dark seam, handle nub
        stamp(g,shaded(36,24,function(t){rect(t,9,4,13,21,'M');},c));
        rect(g,10,6,10,19,hi);rect(g,14,6,14,19,'K');rect(g,7,10,8,14,'K');rect(g,8,11,8,13,'O');
      }
      // base end: one fat rubber wheel side-on at the lower corner, handle bar across the back
      stamp(g,shaded(36,24,function(t){rect(t,25,16,30,21,'J');},{K:'K',M:'I'}));
      setclip(g,25,16,'.');setclip(g,30,16,'.');setclip(g,25,21,'.');setclip(g,30,21,'.');
      rect(g,27,18,28,19,'O');
      rect(g,32,8,32,17,'J');rect(g,32,8,32,9,'O');rect(g,33,8,33,17,'K');rect(g,32,7,32,7,'K');rect(g,32,18,32,18,'K');
    }else{
      // ash/grit fan from the mouth
      for(x=0;x<16;x++){var d2=Math.round((16-x)*.35+Math.sin(x*1.3)*.8);if(d2>0)rect(g,x,12-d2,x,12+d2,'U');}
      for(i=0;i<5;i++){x=1+Math.floor(rng()*13);y=6+Math.floor(rng()*11);if(rng()<.6){rect(g,x,y,x+2,y,'P');rect(g,x+1,y+1,x+3,y+1,'Q');}else{rect(g,x,y,x+2,y+1,'S');}}
      var can=shaded(36,24,function(t){rect(t,14,6,31,18,'J');disc(t,14,12,3,6,'J');},{K:'K',M:'J',L:'O',D:'I'});
      for(x=18;x<31;x+=4)line(can,x,7,x,17,'I');
      stamp(g,can);
      disc(g,14,12,2,5,'K');rect(g,13,9,13,15,'D');   // dark open mouth
    }
    return toRows(g);
  }

  // =====================================================================
  // drain_h 16x10 x3 / drain_v 10x16 x3: road gully grate against the curb
  // (curb = top edge for _h, left edge for _v). [0] clear; [1] clogged with
  // paper and muck; [2] damp stain spreading into the road
  // =====================================================================
  function makeDrainH(v){
    var g=mkGrid(16,10),x,y;
    if(v===2){for(x=0;x<16;x++){var d=7+Math.round(Math.sin(Math.PI*x/15)*2+Math.sin(x*2.1)*.7);rect(g,x,0,x,Math.min(9,d),'W');}}
    rect(g,1,0,14,6,'K');
    rect(g,2,0,13,0,'L');rect(g,2,1,2,5,'M');rect(g,13,1,13,5,'D');rect(g,2,5,13,5,'D');
    for(x=4;x<12;x+=2)rect(g,x,1,x,4,'M');
    for(x=3;x<13;x+=2)rect(g,x,2,x,3,'K');
    if(v===1){rect(g,3,1,7,2,'S');rect(g,4,3,6,3,'S');rect(g,9,3,11,4,'P');rect(g,8,4,9,4,'S');}
    if(v===2){rect(g,5,7,9,8,'K');rect(g,4,7,4,7,'K');}
    return toRows(g);
  }

  // =====================================================================
  // gutterDamp_h 32x8 x3 / gutterDamp_v 8x32 x3: damp run-off along the
  // gutter (curb = top edge). Profile = 3 + sin terms: every variant meets at
  // depth 3 on both ends, so any order tiles seamlessly.
  // =====================================================================
  function makeGutterDampH(v){
    var g=mkGrid(32,8),x,T=2*Math.PI/32;
    var k=[[1.4,.8],[2,-.6],[-1.2,1.1]][v];
    for(x=0;x<32;x++){
      var d=Math.round(3+k[0]*Math.sin(T*x)+k[1]*Math.sin(2*T*x));
      d=Math.max(1,Math.min(7,d));
      rect(g,x,0,x,d,'D');
      if(d>=3)rect(g,x,0,x,d-2,'K');
    }
    // a wet sheen streak in the deepest part (interior only, 3 texels)
    var best=4,bd=0;for(x=4;x<27;x++){var dd=Math.round(3+k[0]*Math.sin(T*x)+k[1]*Math.sin(2*T*x));if(dd>bd){bd=dd;best=x;}}
    if(bd>=4)rect(g,best-1,1,best+1,1,'L');
    return toRows(g);
  }

  // =====================================================================
  // wallDirt_h 32x6 x3 / wallDirt_v 6x32 x3: grime and splash-back along a
  // wall base (wall = top edge). Seamless (sin profile, depth 2 at both
  // ends). [2] adds a downpipe outfall stain mid-tile.
  // =====================================================================
  function makeWallDirtH(v){
    var g=mkGrid(32,6),x,T=2*Math.PI/32;
    var k=[[.9,.6],[-1,.7],[.6,-.9]][v];
    for(x=0;x<32;x++){
      var d=Math.round(2+k[0]*Math.sin(T*x)+k[1]*Math.sin(3*T*x));
      if(v===2&&x>=13&&x<=18)d=5-(x===13||x===18?1:0);
      d=Math.max(1,Math.min(5,d));
      rect(g,x,0,x,0,'K');
      rect(g,x,1,x,d,'D');
      if(d>=3)setclip(g,x,d,'M');
    }
    if(v===2)rect(g,15,1,16,3,'S');
    return toRows(g);
  }

  // =====================================================================
  // crossing_h 32x28 x3 / crossing_v 28x32 x3: zebra crossing section. _h
  // bars run top-bottom and the crossing tiles left-right (a crossing over a
  // north-south road); _v is the transpose. Period-16 bars (8 paint, 8 road),
  // wear kept inside the bars so their outline stays a clean rectangle.
  // [0] sound; [1] worn in the wheel tracks; [2] mostly scrubbed
  // =====================================================================
  function makeCrossingH(v){
    var g=mkGrid(32,28),rng=mulberry32(380+v),x,y,i;
    // bars 8 wide on a 16 period, 26 long (rows 1-26), square crisp ends
    for(y=1;y<27;y++)for(x=0;x<32;x++)if(pmod(x-4,16)<8)g[y][x]='W';
    // tyre wear: short streaks along the traffic direction (down the bars),
    // inside a bar only, so every bar keeps a clean rectangular outline
    var n=[3,9,18][v];
    for(i=0;i<n;i++){
      var bx=pmod(4+16*Math.floor(rng()*2)+1+Math.floor(rng()*5),32);
      var track=v>=1&&rng()<.7;
      y=track?(rng()<.5?7:16)+Math.floor(rng()*4):3+Math.floor(rng()*19);
      var len=2+Math.floor(rng()*3),ch=rng()<(v===2?.4:.15)?'D':'V';
      rect(g,bx,y,bx,Math.min(24,y+len-1),ch);
      if(v===2&&rng()<.5)rect(g,bx+1,y+1,bx+1,Math.min(24,y+len),'V');
    }
    return toRows(g);
  }

  // =====================================================================
  // curbCut_h 32x16 x2 / curbCut_v 16x32 x2: dropped kerb at a crossing,
  // drawn over the curb tile (road = bottom edge for _h): the kerb line dips
  // and a tactile panel sits flush on the road edge. [1] cracked, worn
  // =====================================================================
  function makeCurbCutH(v){
    var g=mkGrid(32,16),x,y;
    // Drawn over the curb tile (road below). Most of it is transparent: the
    // kerb line itself dips. Outside x4-27 the kerb stays raised; across the
    // flares its lit top row slides down and the black drop shadow thins out;
    // across the ramp (x10-21) the kerb is flush -- no lit top, no shadow.
    for(x=2;x<30;x++){
      var o=x<16?x:31-x;                 // distance in from the outer end
      var k=o<4?0:o<8?1:o<10?2:3;       // 0 raised .. 3 flush
      if(k===0)continue;
      if(k===1){setclip(g,x,13,'D');setclip(g,x,14,'M');setclip(g,x,15,'J');}
      else if(k===2){setclip(g,x,13,'D');setclip(g,x,14,'D');setclip(g,x,15,'M');}
      else{setclip(g,x,13,'D');setclip(g,x,14,'D');setclip(g,x,15,'E');}
    }
    rect(g,9,9,22,9,'E');                           // ramp head joint above the panel
    line(g,5,13,8,10,'E');line(g,26,13,23,10,'E');  // short flare joints
    // tactile blister panel, flush against the road edge
    rect(g,10,10,21,15,'U');
    for(y=11;y<15;y+=2)for(x=11+((y-11)/2)%2;x<21;x+=2)setclip(g,x,y,'T');
    if(v===1){line(g,5,11,7,13,'K');line(g,25,10,26,12,'K');setclip(g,14,13,'U');setclip(g,17,11,'U');rect(g,19,14,20,14,'D');}
    return toRows(g);
  }

  // =====================================================================
  // service-lane markings: laneArrow 16x32 x3 (points up; rot for others),
  // laneHatch 32x32 x2 (seamless keep-clear hatch, faded amber),
  // laneEdge_h 32x6 x2 / laneEdge_v 6x32 x2 (double no-parking line)
  // =====================================================================
  function makeLaneArrow(v){
    var g=mkGrid(16,32),rng=mulberry32(390+v),x,y;
    poly(g,[[8,0],[15,13],[1,13]],'W');rect(g,6,13,9,31,'W');
    var wear=[.06,.16,.28][v];
    for(y=1;y<31;y+=2)for(x=0;x<15;x+=2){if(g[y][x]!=='W')continue;var r=rng();if(r<wear)rect(g,x,y,x+1,y+1,'.');else if(r<wear*2+.04)rect(g,x,y,x+1,y+1,'V');}
    return toRows(g);
  }
  function makeLaneHatch(v){
    var g=mkGrid(32,32),rng=mulberry32(395+v),x,y;
    for(y=0;y<32;y++)for(x=0;x<32;x++)if(pmod(x+y,16)<3)g[y][x]='Y';
    for(y=1;y<31;y+=2)for(x=1;x<31;x+=2){if(g[y][x]!=='Y')continue;var r=rng();if(r<.08+v*.08)rect(g,x,y,x+1,y,'.');else if(r<.25)rect(g,x,y,x+1,y,'Z');}
    return toRows(g);
  }
  function makeLaneEdgeH(v){
    var g=mkGrid(32,6),x;
    rect(g,0,1,31,1,'Y');rect(g,0,4,31,4,'Y');
    if(v===1){rect(g,5,1,8,1,'Z');rect(g,20,4,22,4,'.');rect(g,12,4,15,4,'Z');rect(g,26,1,27,1,'.');}
    return toRows(g);
  }

  function vs(fn,n){var out=[],i;for(i=0;i<n;i++)out.push(fn(i));return out;}
  function vsT(fn,n){return vs(fn,n).map(transpose);}
  // variants followed by their vertical mirrors (edge moved from top to bottom)
  function vsM(fn,n){var a=vs(fn,n);return a.concat(a.map(function(r){return r.slice().reverse();}));}

  A.define('streetlife',{
    binBags:{variants:vs(makeBinBags,3),pal:BAGS_PAL,anchor:'center',note:'32x24 flat. torn bin-bag cluster at a collection point: [0] three black bags, one torn; [1] two black + green garden bag; [2] one burst bag, contents strewn'},
    flatBoxes:{variants:vs(makeFlatBoxes,3),pal:BOX_PAL,anchor:'center',note:'32x24 flat. flattened cardboard behind a shop: [0] two crossed sheets; [1] stack of three; [2] sheet + crushed box'},
    paperEdge_h:{variants:vs(makePaperEdgeH,3).concat([0,1,2].map(function(i){return makePaperEdgeH(i,true);})),pal:PAPER_PAL,anchor:'center',note:'32x10 flat. paper sheets, a crumpled ball, a newsprint page and a crisp packet caught against a curb or fence, each with a soft shadow on its lower side; the edge is the TOP row in [0-2] and the BOTTOM row in [3-5] (redrawn, not mirrored, so shadows still fall down); [2]/[5] denser'},
    paperEdge_v:{variants:vsT(makePaperEdgeH,3),pal:PAPER_PAL,anchor:'center',note:'10x32 flat. transpose of paperEdge_h[0-2]; the edge is the LEFT column (flip for a right-hand edge)'},
    glassShards:{variants:vs(makeGlassShards,3),pal:GLASS_PAL,anchor:'center',note:'32x16 flat. broken shop glass, the storefront wall on the TOP edge (rot:1 = wall left): a band of pale-edged plates at the wall foot thinning to small chips and single glints: [0] light; [1] dense with a bent frame bar; [2] wide kicked spread'},
    brickSpill:{variants:vs(makeBrickSpill,3),pal:BRICK_PAL,anchor:'center',note:'40x24 flat. fresh brick/plaster below a broken facade, wall on the TOP edge (rot:1 = wall left): dust bed at the wall, chunks, thrown crumbs. [2] wide, with a snapped lath'},
    timberScrap:{variants:vs(makeTimberScrap,3),pal:TIMBER_PAL,anchor:'center',note:'32x20 flat. weathered grey-brown offcuts and pulled boards with pale sawn ends at a boarded entrance: [0] two crossed boards + offcut; [1] pile of four; [2] rectangular plywood sheet with a batten nailed straight across'},
    tippedBin:{variants:vs(makeTippedBin,3),pal:TIP_PAL,anchor:'center',note:'36x24 flat (non-solid). knocked-over wheelie bin tapering from the mouth end (LEFT, flip for right) to a wheel and handle at the base: [0] green bin, black mouth in a lit rim, lid flopped open, bag and paper fanned out; [1] charcoal bin, lid shut; [2] round municipal bin, paper and ash out'},
    drain_h:{variants:vsM(makeDrainH,3),pal:DRAIN_PAL,anchor:'center',note:'16x10 flat. gully grate against the curb, curb on the TOP edge in [0-2], BOTTOM edge in mirrored [3-5]: [0]/[3] clear; [1]/[4] clogged with paper/muck; [2]/[5] damp stain into the road'},
    drain_v:{variants:vsT(makeDrainH,3),pal:DRAIN_PAL,anchor:'center',note:'10x16 flat. transpose of drain_h, curb on the LEFT edge (flip for right)'},
    gutterDamp_h:{variants:vsM(makeGutterDampH,3),pal:DAMP_PAL,anchor:'center',note:'32x8 flat strip, tiles left-right in any variant order. damp run-off along the gutter, curb on the TOP edge in [0-2], BOTTOM edge in mirrored [3-5]'},
    gutterDamp_v:{variants:vsT(makeGutterDampH,3),pal:DAMP_PAL,anchor:'center',note:'8x32 flat strip, tiles top-bottom. transpose of gutterDamp_h, curb on the LEFT edge'},
    wallDirt_h:{variants:vs(makeWallDirtH,3),pal:DIRT_PAL,anchor:'center',note:'32x6 flat strip, tiles left-right in any order. grime along a wall base, wall on the TOP edge; [2] downpipe outfall stain'},
    wallDirt_v:{variants:vsT(makeWallDirtH,3),pal:DIRT_PAL,anchor:'center',note:'6x32 flat strip, tiles top-bottom. transpose of wallDirt_h, wall on the LEFT edge'},
    crossing_h:{variants:vs(makeCrossingH,3),pal:PAINT_PAL,anchor:'center',note:'32x28 flat, tiles left-right. zebra section over a north-south road: bars 8 wide on a 16 period, 26 long (rows 1-26) with crisp square ends; wear is tyre streaks inside the bars only: [0] sound; [1] worn in wheel tracks; [2] scrubbed'},
    crossing_v:{variants:vsT(makeCrossingH,3),pal:PAINT_PAL,anchor:'center',note:'28x32 flat, tiles top-bottom. transpose of crossing_h (zebra over an east-west road: horizontal bars stacked down the road)'},
    curbCut_h:{variants:vsM(makeCurbCutH,2),pal:CURB_PAL,anchor:'center',note:'32x16 flat, mostly transparent. laid over a tiles/curb piece whose road side is BOTTOM ([0-1]) or TOP ([2-3]), bottom edge on the road edge: the kerb line dips (lit top and asphalt shadow fade across the flares, flush in the middle) and a buff tactile panel x10-21 sits flush on the road edge; [1]/[3] cracked flare, worn blisters'},
    curbCut_v:{variants:vsT(makeCurbCutH,2),pal:CURB_PAL,anchor:'center',note:'16x32 flat. transpose of curbCut_h, road on the RIGHT edge (flip for left)'},
    laneArrow:{variants:vs(makeLaneArrow,3),pal:PAINT_PAL,anchor:'center',note:'16x32 flat. worn white service-lane arrow pointing up (rot:1 = left): [0] sound; [1] worn; [2] half scrubbed'},
    laneHatch:{variants:vs(makeLaneHatch,2),pal:PAINT_PAL,anchor:'center',note:'32x32 flat, seamless both axes. faded amber keep-clear hatch for loading bays and lane mouths; [1] more worn'},
    laneEdge_h:{variants:vs(makeLaneEdgeH,2),pal:PAINT_PAL,anchor:'center',note:'32x6 flat strip, tiles left-right. faded amber double no-parking line along a service lane; [1] worn'},
    laneEdge_v:{variants:vsT(makeLaneEdgeH,2),pal:PAINT_PAL,anchor:'center',note:'6x32 flat strip, tiles top-bottom. transpose of laneEdge_h'}
  });
})();
