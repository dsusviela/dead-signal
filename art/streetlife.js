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
//     TOP edge; rot:1 puts the wall on the LEFT, rot:1+flip on the RIGHT.
//   * *_h strips tile left-right (32 wide), *_v strips tile top-bottom
//     (32 tall). Periodic marks use x%period with period | 32 and edge
//     profiles built from sin(2*pi*k*x/32) terms, so every variant meets every
//     other variant at the same boundary height -- seamless in any order.
//   * paperEdge_h / gutterDamp_h / wallDirt_h: the edge (curb, fence, wall)
//     is the TOP row; the _v twins are transposes, so the edge is the LEFT
//     column. flip mirrors _v to a right-hand edge.
//   * curbCut_h: road on the BOTTOM edge; curbCut_v (transpose): road RIGHT.
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
  var PAPER_PAL={K:BAG.D,P:CARD.H,Q:CARD.L,N:MAT.concrete.M,O:MAT.concrete.D,B:BAG.L,C:BAG.M};
  var SHARD={K:'#050a0c',D:'#1c292c',M:'#3a4b4c',L:'#60706e',H:'#8c9492'};      // --hue 200 --l 0.14,0.66 --chroma 0.022 (grey glass, not window teal)
  var GLASS_PAL={K:SHARD.K,D:SHARD.D,M:SHARD.M,L:SHARD.L,H:SHARD.H,F:MAT.iron.M,G:MAT.iron.K};
  var BRICK_PAL={K:MAT.brick.K,D:MAT.brick.D,M:MAT.brick.M,L:MAT.brick.L,P:MAT.concrete.L,Q:MAT.concrete.M,U:MAT.concrete.D,V:shade(MAT.concrete.D,-6),W:MAT.wood.D};
  var TIMBER_PAL={K:MAT.wood.K,D:MAT.wood.D,M:MAT.wood.M,L:MAT.wood.L,N:MAT.iron.L,P:MAT.sandbag.M,Q:MAT.sandbag.D,R:MAT.sandbag.L};
  var TIP_PAL={K:BAG.K,E:BAGG.D,F:BAGG.M,G:BAGG.L,D:BAG.D,M:BAG.M,L:BAG.L,I:MAT.iron.D,J:MAT.iron.M,O:MAT.iron.L,P:CARD.H,Q:CARD.L,S:SOIL.M,U:MAT.concrete.D};
  var DRAIN_PAL={K:MAT.asphalt.K,D:MAT.iron.D,M:MAT.iron.M,L:MAT.iron.L,W:MAT.asphalt.D,S:SOIL.M,P:CARD.L};
  var DAMP_PAL={K:MAT.asphalt.K,D:shade(MAT.asphalt.D,-6),L:MAT.asphalt.M};
  var DIRT_PAL={K:MAT.concrete.K,D:shade(MAT.concrete.D,-8),M:MAT.concrete.D,S:SOIL.D};
  var PAINT_PAL={W:MAT.concrete.L,V:MAT.concrete.M,D:MAT.asphalt.D,Y:HAZARD_Y,Z:shade(HAZARD_Y,-12)};
  var CURB_PAL={K:MAT.concrete.K,D:MAT.concrete.D,M:MAT.concrete.M,L:MAT.concrete.L,T:CARD.L,U:CARD.D};

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
  // paperEdge_h 32x10 x3 (edge = top row) / paperEdge_v 10x32 x3 (edge =
  // left column): paper, newsprint and a crisp packet caught against a curb
  // or fence line, densest at the edge.
  // =====================================================================
  function crumple(g,x,y,a,b){rect(g,x,y,x+2,y,a);rect(g,x,y+1,x+1,y+1,a);setclip(g,x+2,y+1,b);rect(g,x+1,y+2,x+3,y+2,'K');}
  function sheetFlat(g,x,y,w,a,b){rect(g,x,y,x+w-1,y,a);rect(g,x+1,y+1,x+w,y+1,a);rect(g,x+2,y+2,x+w,y+2,b);}
  function makePaperEdgeH(v){
    var g=mkGrid(32,10),rng=mulberry32(330+v),i,x,y,k;
    var n=v===2?9:6;
    for(i=0;i<n;i++){
      x=2+Math.floor(rng()*26);y=Math.floor(rng()*rng()*6);k=rng();
      if(k<.35)crumple(g,x,y,'P','Q');
      else if(k<.6)sheetFlat(g,x,y,4,'N','O');
      else if(k<.8)sheetFlat(g,x,y,3,'P','Q');
      else{rect(g,x,y,x+2,y+1,'C');rect(g,x+1,y,x+1,y,'B');rect(g,x,y+2,x+2,y+2,'K');}
    }
    // edge grit line where the wind packs it
    for(x=1;x<31;x++)if(at(g,x,0)==='.'&&pmod(x*7+v*3,5)<2)setclip(g,x,0,'O');
    for(x=1;x<31;x++)if(at(g,x,0)==='O'&&at(g,x-1,0)!=='O'&&at(g,x+1,0)!=='O')setclip(g,x+1,0,'O');
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
    var g=mkGrid(32,16),rng=mulberry32(340+v),i,j,x,y;
    // shards fall in clumps under the broken panes, a few kicked further out
    var clumps=[[[9,2],[22,3]],[[16,2]],[[6,3],[17,5],[26,2]]][v];
    var per=[6,14,4][v],reach=[5,6,9][v];
    if(v===1){for(x=6;x<27;x++){var d=Math.round(1.5+2*Math.sin(Math.PI*(x-6)/21)+Math.sin(x*1.9)*.6);rect(g,x,0,x,d,'D');}}
    for(j=0;j<clumps.length;j++)for(i=0;i<per;i++){
      x=Math.round(clumps[j][0]+(rng()*2-1)*(4+i*.6));y=Math.max(0,Math.round(clumps[j][1]+Math.pow(rng(),1.3)*reach-2));
      shard(g,Math.max(1,Math.min(28,x)),Math.min(12,y),i<2?2:rng()<.4?1:0,rng);
    }
    for(i=0;i<3;i++){x=2+Math.floor(rng()*27);y=9+Math.floor(rng()*5);shard(g,x,y,0,rng);}
    if(v===1){line(g,4,2,14,5,'F');line(g,4,3,14,6,'G');}
    var glints=0;
    for(y=0;y<g.length&&glints<2;y++)for(x=1;x<31&&glints<2;x++)if(g[y][x]==='L'&&g[y][x+1]==='L'){g[y][x]='H';g[y][x+1]='H';glints++;x+=10;}
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
    var c=Math.cos(ang),s=Math.sin(ang);
    var t=shaded(32,20,function(t){
      box(t,cx,cy,len,wid,ang,'M');
      if(opt.snap){var ex=cx+c*len/2,ey=cy+s*len/2;setclip(t,Math.round(ex),Math.round(ey-1),'.');setclip(t,Math.round(ex-c),Math.round(ey-s+1),'.');}
    },WOODC);
    if(wid>=4)line(t,cx-c*(len/2-3),cy-s*(len/2-3)+.4,cx+c*(len/2-3)-1,cy+s*(len/2-3)+.4,'D');
    if(opt.nails){[-1,1].forEach(function(k){var nx=Math.round(cx+k*c*(len/2-2)),ny=Math.round(cy+k*s*(len/2-2));setclip(t,nx,ny,'N');setclip(t,nx,ny+1,'N');});}
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
      var t=shaded(32,20,function(t){poly(t,[[3,4],[18,2],[20,16],[5,17]],'P');},{K:'K',M:'P',L:'R',D:'Q'});
      line(t,7,6,16,5,'Q');line(t,8,11,17,10,'Q');
      stamp(g,t);
      board(g,21,12,20,5,.46,{nails:true});
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
    if(v<2){
      var c=v===0?{K:'K',M:'F',L:'G',D:'E'}:{K:'K',M:'M',L:'L',D:'D'};
      if(v===0){
        // black bag and paper pulled out of the mouth (drawn first, bin over it)
        stamp(g,shaded(36,24,function(t){disc(t,6,15,5,4,'M');rect(t,1,14,2,15,'M');},{K:'K',M:'M',L:'L',D:'D'}));
        rect(g,2,19,4,19,'P');rect(g,3,20,5,20,'Q');rect(g,8,21,10,21,'P');rect(g,9,22,11,22,'Q');rect(g,1,8,3,8,'P');rect(g,2,9,4,9,'Q');
      }
      // wheelie bin lying on its side seen from above: long body, base (wheels,
      // handle) on the right, mouth + lid on the left
      stamp(g,shaded(36,24,function(t){rect(t,12,6,30,18,'M');rect(t,13,5,29,5,'M');},c));
      rect(g,14,8,28,8,c.L);                                 // lit upper flank
      rect(g,16,15,27,15,c.D);rect(g,17,11,26,11,c.D);         // moulded body lines
      rect(g,30,8,30,16,'K');rect(g,31,8,32,16,'J');rect(g,33,8,33,16,'K');rect(g,31,7,32,7,'K');rect(g,31,17,32,17,'K');rect(g,31,9,31,15,'O'); // handle bar
      stamp(g,shaded(36,24,function(t){rect(t,25,2,29,4,'J');rect(t,25,20,29,22,'J');},{K:'K',M:'J',L:'O',D:'I'})); // wheels
      if(v===0){
        rect(g,12,7,13,17,'K');                              // open mouth, dark inside
        stamp(g,shaded(36,24,function(t){poly(t,[[9,2],[13,4],[12,8],[8,6]],'M');},c)); // lid flipped up and back
      }else{
        rect(g,11,6,11,18,c.L);rect(g,10,6,10,18,'K');rect(g,11,5,11,5,'K');rect(g,11,19,11,19,'K'); // closed lid lip
        rect(g,3,13,5,13,'P');rect(g,4,14,6,14,'Q');
      }
    }else{
      // ash/grit fan from the mouth
      for(x=0;x<16;x++){var d=Math.round((16-x)*.35+Math.sin(x*1.3)*.8);if(d>0)rect(g,x,12-d,x,12+d,'U');}
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
  // north-south road); _v is the transpose. Period-16 bars (8 paint, 8 road).
  // [0] sound; [1] worn in the wheel tracks; [2] mostly scrubbed
  // =====================================================================
  function makeCrossingH(v){
    var g=mkGrid(32,28),rng=mulberry32(380+v),x,y;
    for(y=1;y<27;y++)for(x=0;x<32;x++)if(pmod(x-4,16)<8)g[y][x]='W';
    var wear=[.04,.12,.3][v];
    // wear as 2x2 chips (never single texels) and scuffed V patches
    for(y=1;y<26;y+=2)for(x=0;x<31;x+=2){
      if(g[y][x]!=='W')continue;
      var r=rng();
      var track=(v>=1&&(pmod(y,28)>=7&&pmod(y,28)<=10||pmod(y,28)>=17&&pmod(y,28)<=20));
      if(r<wear*(track?2.5:1))rect(g,x,y,x+1,y+1,'.');
      else if(r<wear*(track?4:2)+.05)rect(g,x,y,x+1,y+1,'V');
    }
    // the bar ends at the curb lines stay crisp
    return toRows(g);
  }

  // =====================================================================
  // curbCut_h 32x16 x2 / curbCut_v 16x32 x2: dropped kerb at a crossing,
  // tactile blister panel, flared ramp sides (road = bottom edge for _h).
  // [1] has a cracked flare and grit in the blisters
  // =====================================================================
  function makeCurbCutH(v){
    var g=mkGrid(32,16),x,y;
    rect(g,0,0,31,15,'M');
    rect(g,0,0,31,0,'D');                                     // slab joint to the pavement
    line(g,0,13,7,1,'D');line(g,31,13,24,1,'D');               // flare joints
    rect(g,8,1,23,1,'L');                                      // lip of the ramp top
    rect(g,9,4,22,12,'U');
    for(y=5;y<12;y+=3)for(x=(y%2?10:12);x<21;x+=4){rect(g,x,y,x+1,y,'T');}
    rect(g,0,14,31,14,'L');rect(g,0,15,31,15,'D');             // flush worn lip, no kerb drop
    rect(g,0,14,6,14,'M');rect(g,25,14,31,14,'M');
    if(v===1){line(g,2,5,5,10,'K');line(g,27,3,29,6,'K');rect(g,14,8,15,8,'D');rect(g,17,11,18,11,'D');}
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
    var wear=[.06,.18,.4][v];
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

  A.define('streetlife',{
    binBags:{variants:vs(makeBinBags,3),pal:BAGS_PAL,anchor:'center',note:'32x24 flat. torn bin-bag cluster at a collection point: [0] three black bags, one torn; [1] two black + green garden bag; [2] one burst bag, contents strewn'},
    flatBoxes:{variants:vs(makeFlatBoxes,3),pal:BOX_PAL,anchor:'center',note:'32x24 flat. flattened cardboard behind a shop: [0] two crossed sheets; [1] stack of three; [2] sheet + crushed box'},
    paperEdge_h:{variants:vs(makePaperEdgeH,3),pal:PAPER_PAL,anchor:'center',note:'32x10 flat. paper/newsprint/crisp packet caught against a curb or fence; the edge is the TOP row. [2] denser'},
    paperEdge_v:{variants:vsT(makePaperEdgeH,3),pal:PAPER_PAL,anchor:'center',note:'10x32 flat. transpose of paperEdge_h; the edge is the LEFT column (flip for a right-hand edge)'},
    glassShards:{variants:vs(makeGlassShards,3),pal:GLASS_PAL,anchor:'center',note:'32x16 flat. broken shop glass, the storefront wall on the TOP edge (rot:1 = wall left): [0] light scatter; [1] dense fall with a bent frame bar; [2] wide kicked spread'},
    brickSpill:{variants:vs(makeBrickSpill,3),pal:BRICK_PAL,anchor:'center',note:'40x24 flat. fresh brick/plaster below a broken facade, wall on the TOP edge (rot:1 = wall left): dust bed at the wall, chunks, thrown crumbs. [2] wide, with a snapped lath'},
    timberScrap:{variants:vs(makeTimberScrap,3),pal:TIMBER_PAL,anchor:'center',note:'32x20 flat. offcuts/pulled boards at a boarded entrance: [0] two crossed boards + offcut; [1] pile of four; [2] plywood offcut + nailed board'},
    tippedBin:{variants:vs(makeTippedBin,3),pal:TIP_PAL,anchor:'center',note:'36x24 flat (non-solid). knocked-over container, mouth on the LEFT (flip for right): [0] green wheelie bin, lid open, bags out; [1] grey wheelie bin, lid shut; [2] round municipal bin, paper and ash out'},
    drain_h:{variants:vs(makeDrainH,3),pal:DRAIN_PAL,anchor:'center',note:'16x10 flat. gully grate against the curb, curb on the TOP edge: [0] clear; [1] clogged with paper/muck; [2] damp stain into the road'},
    drain_v:{variants:vsT(makeDrainH,3),pal:DRAIN_PAL,anchor:'center',note:'10x16 flat. transpose of drain_h, curb on the LEFT edge (flip for right)'},
    gutterDamp_h:{variants:vs(makeGutterDampH,3),pal:DAMP_PAL,anchor:'center',note:'32x8 flat strip, tiles left-right in any variant order. damp run-off along the gutter, curb on the TOP edge'},
    gutterDamp_v:{variants:vsT(makeGutterDampH,3),pal:DAMP_PAL,anchor:'center',note:'8x32 flat strip, tiles top-bottom. transpose of gutterDamp_h, curb on the LEFT edge'},
    wallDirt_h:{variants:vs(makeWallDirtH,3),pal:DIRT_PAL,anchor:'center',note:'32x6 flat strip, tiles left-right in any order. grime along a wall base, wall on the TOP edge; [2] downpipe outfall stain'},
    wallDirt_v:{variants:vsT(makeWallDirtH,3),pal:DIRT_PAL,anchor:'center',note:'6x32 flat strip, tiles top-bottom. transpose of wallDirt_h, wall on the LEFT edge'},
    crossing_h:{variants:vs(makeCrossingH,3),pal:PAINT_PAL,anchor:'center',note:'32x28 flat, tiles left-right. zebra section, bars run top-bottom (crossing over a north-south road): [0] sound; [1] worn in wheel tracks; [2] scrubbed'},
    crossing_v:{variants:vsT(makeCrossingH,3),pal:PAINT_PAL,anchor:'center',note:'28x32 flat, tiles top-bottom. transpose of crossing_h (crossing over an east-west road)'},
    curbCut_h:{variants:vs(makeCurbCutH,2),pal:CURB_PAL,anchor:'center',note:'32x16 flat, opaque. dropped kerb with tactile panel, road on the BOTTOM edge; [1] cracked flare, grit'},
    curbCut_v:{variants:vsT(makeCurbCutH,2),pal:CURB_PAL,anchor:'center',note:'16x32 flat, opaque. transpose of curbCut_h, road on the RIGHT edge (flip for left)'},
    laneArrow:{variants:vs(makeLaneArrow,3),pal:PAINT_PAL,anchor:'center',note:'16x32 flat. worn white service-lane arrow pointing up (rot:1 = left): [0] sound; [1] worn; [2] half scrubbed'},
    laneHatch:{variants:vs(makeLaneHatch,2),pal:PAINT_PAL,anchor:'center',note:'32x32 flat, seamless both axes. faded amber keep-clear hatch for loading bays and lane mouths; [1] more worn'},
    laneEdge_h:{variants:vs(makeLaneEdgeH,2),pal:PAINT_PAL,anchor:'center',note:'32x6 flat strip, tiles left-right. faded amber double no-parking line along a service lane; [1] worn'},
    laneEdge_v:{variants:vsT(makeLaneEdgeH,2),pal:PAINT_PAL,anchor:'center',note:'6x32 flat strip, tiles top-bottom. transpose of laneEdge_h'}
  });
})();
