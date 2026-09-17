// Dead Signal civic vocabulary (city_v2.md Section 3 / P1): Civic Ward
// hospital campus pieces, Northline fire-station / depot / utility-yard /
// broadcast frontages, and Central Quarantine support hardware that matches
// quarantine/gate_*. One texel = one world unit (den 1). Night city, day 9 of
// a quarantine: muted materials, fresh abandonment, no overgrowth or ancient
// decay, no gameplay orange/red/cyan/green (the hospital reads by pale tile,
// long ward roofs, canopy and glass links -- never a lit cross).
//
// Layers (what world.js/render.js should do with each id is in the notes):
//   overhead  roofs, canopies, covered links: drawn above actors, no collision
//             except where a note names posts/columns
//   solid     standing masses/frontages: collision on their footprint
//   flat      ground paint: no collision, drawn under everything
//
// Tiling: every *_h strip is 32 wide, every *_v strip 32 tall. All periodic
// marks are sampled with `local coordinate % period` (period divides 32), so
// adjacent tiles meet on the same phase. Variant fleck never touches the two
// boundary columns/rows. Overhead strips are drawn through an axis painter
// (u = run axis, v = across), with v=0 on the top (h) / left (v) side, so the
// light edge stays top-left in both orientations.
(function(){
  'use strict';
  var A=(typeof window!=='undefined'?window:globalThis).DSArt;
  var MAT=A.MAT,shade=A.shade;

  // ---- grid helpers (art/lots.js style) ----
  function mkGrid(w,h){var g=[],y,x,row;for(y=0;y<h;y++){row=[];for(x=0;x<w;x++)row.push('.');g.push(row);}return g;}
  function setclip(g,x,y,ch){if(y>=0&&y<g.length&&x>=0&&x<g[0].length)g[y][x]=ch;}
  function get(g,x,y){return(y>=0&&y<g.length&&x>=0&&x<g[0].length)?g[y][x]:'.';}
  function rect(g,x0,y0,x1,y1,ch){var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)setclip(g,x,y,ch);}
  function toRows(g){return g.map(function(r){return r.join('');});}
  function pal2(base,extra){return Object.assign({},base,extra);}
  function disc(g,cx,cy,rx,ry,ch){
    var x,y;
    for(y=-ry;y<=ry;y++)for(x=-rx;x<=rx;x++)if((x*x)/(rx*rx||1)+(y*y)/(ry*ry||1)<=1)setclip(g,cx+x,cy+y,ch);
  }
  function box(g,x0,y0,x1,y1,K){rect(g,x0,y0,x1,y0,K);rect(g,x0,y1,x1,y1,K);rect(g,x0,y0,x0,y1,K);rect(g,x1,y0,x1,y1,K);}
  function bevel(g,x0,y0,x1,y1,K,L,M,D){
    rect(g,x0,y0,x1,y1,M);box(g,x0,y0,x1,y1,K);
    if(x1-x0>=2&&y1-y0>=2){
      rect(g,x0+1,y0+1,x1-1,y0+1,L);rect(g,x0+1,y0+1,x0+1,y1-1,L);
      rect(g,x0+1,y1-1,x1-1,y1-1,D);rect(g,x1-1,y0+1,x1-1,y1-1,D);
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
  function hazardStripe(g,x0,y0,x1,y1,period,A_,B_){
    var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)setclip(g,x,y,pmod(x+y,period)<period/2?A_:B_);
  }
  function line(g,x0,y0,x1,y1,ch){
    x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
    var dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy,e2;
    for(;;){setclip(g,x0,y0,ch);if(x0===x1&&y0===y1)break;e2=2*err;if(e2>=dy){err+=dy;x0+=sx;}if(e2<=dx){err+=dx;y0+=sy;}}
  }
  // axis painter: u runs along the tiled axis, v across it
  function axis(vert,run,across){
    var g=vert?mkGrid(across,run):mkGrid(run,across);
    function s(u,v,ch){if(vert)setclip(g,v,u,ch);else setclip(g,u,v,ch);}
    return{g:g,set:s,rect:function(u0,v0,u1,v1,ch){var u,v;for(v=v0;v<=v1;v++)for(u=u0;u<=u1;u++)s(u,v,ch);}};
  }
  // 3x5 stencil digits for bay numbers
  var DIGITS={1:['.X.','XX.','.X.','.X.','XXX'],2:['XX.','..X','.X.','X..','XXX'],3:['XX.','..X','.X.','..X','XX.']};
  function digit(g,x,y,n,ch){DIGITS[n].forEach(function(r,j){for(var i=0;i<3;i++)if(r[i]==='X')setclip(g,x+i,y+j,ch);});}

  // ---- palettes (new ramps from tools/art/ramp.mjs) ----
  var WARD={K:'#131718',D:'#343c3f',M:'#5a6668',L:'#879292',H:'#b9bfbe'}; // pale hospital tile/membrane (ramp --hue 210 --l 0.2,0.8 --chroma 0.014)
  var CANVAS={K:'#0f130d',D:'#292d1f',M:'#484937',L:'#6a6756',H:'#89867d'}; // requisitioned canvas/tarp (ramp --hue 110 --l 0.18,0.62 --chroma 0.03)
  var HAZARD_Y='#6d4f20'; // same faded amber as art/lots.js
  var WARD_PAL=pal2(WARD,{G:MAT.glass.D,B:MAT.glass.M,E:MAT.glass.L,I:MAT.iron.M,J:MAT.iron.D});
  var LINK_PAL=pal2(WARD,{G:MAT.glass.D,B:MAT.glass.M,E:MAT.glass.L,F:MAT.glass.H});
  var CANOPY_PAL=pal2(WARD,{G:MAT.glass.D,B:MAT.glass.M,I:MAT.iron.M,J:MAT.iron.D});
  var SERVICE_PAL=pal2(WARD,{G:MAT.glass.D,I:MAT.iron.M,J:MAT.iron.D,S:MAT.iron.L,Y:HAZARD_Y});
  var BAYPAINT_PAL={K:MAT.asphalt.K,D:MAT.asphalt.D,W:MAT.concrete.L,H:MAT.concrete.H,Y:HAZARD_Y};
  var FIREBRICK={K:'#190e10',D:'#3d2324',M:'#5e3f39',L:'#7a5f55',H:'#91837b'}; // muted station brick (ramp --hue 30 --l 0.18,0.62 --chroma 0.045)
  var FIRE_PAL=pal2(FIREBRICK,{C:MAT.concrete.L,P:MAT.concrete.H,Q:MAT.concrete.M,I:MAT.iron.M,J:MAT.iron.D,S:MAT.iron.L,N:MAT.iron.K,G:MAT.glass.D,B:MAT.glass.M,Y:'#b8894a'});
  var DEPOT_PAL=pal2(MAT.iron,{C:MAT.concrete.M,E:MAT.concrete.D,P:MAT.concrete.L,G:MAT.glass.D,B:MAT.glass.M,Y:HAZARD_Y});
  var YARD_PAL=pal2(MAT.iron,{C:MAT.concrete.M,E:MAT.concrete.D,P:MAT.concrete.L,Q:MAT.concrete.H,Y:HAZARD_Y,S:MAT.wood.M,T:MAT.wood.D,U:MAT.wood.L});
  var CABLE_PAL=pal2(MAT.iron,{C:MAT.concrete.M,E:MAT.concrete.D,B:'#15181b'});
  var BROADCAST_PAL=pal2(MAT.concrete,{G:MAT.glass.D,B:MAT.glass.M,E:MAT.glass.L,I:MAT.iron.M,J:MAT.iron.D,S:MAT.iron.L,N:MAT.iron.K});
  var QFENCE_PAL=pal2(MAT.iron,{I:MAT.iron.M,C:MAT.concrete.M,E:MAT.concrete.D,P:MAT.concrete.L});
  var QUEUE_PAL=pal2(MAT.iron,{B:'#56627a',N:'#333b4f'}); // muted navy tensile belt
  var TENT_PAL=pal2(CANVAS,{P:WARD.H,Q:WARD.L,R:WARD.M,S:WARD.D,I:MAT.iron.M});
  var TARP_PAL=pal2(CANVAS,{I:MAT.iron.M,S:MAT.iron.L,J:MAT.iron.D});
  var REQ_PAL=pal2(MAT.iron,{P:MAT.concrete.H,Q:MAT.concrete.L,W:MAT.concrete.M,U:MAT.rust.M,Y:HAZARD_Y,S:MAT.wood.M,T:MAT.wood.D});

  // =====================================================================
  // CIVIC WARD
  // =====================================================================

  // wardRoof_h 32x48 / wardRoof_v 48x32 (overhead, anchor tile): long pale
  // ward-wing roof. Parapet lips on both long sides, pale membrane with
  // sheet laps every 16, a continuous rooflight run down the middle (glass
  // panes, mullions every 8), a vent box every 32.
  function makeWardRoof(vert,variant){
    var P=axis(vert,32,48),rng=mulberry32(vert?(variant?504:503):(variant?502:501)),u,v;
    P.rect(0,0,31,47,'L');
    P.rect(0,0,31,0,'K');P.rect(0,1,31,2,'H');P.rect(0,3,31,3,'M');P.rect(0,4,31,4,'D'); // near parapet + shadow
    P.rect(0,43,31,43,'M');P.rect(0,44,31,45,'H');P.rect(0,46,31,46,'D');P.rect(0,47,31,47,'K'); // far parapet
    for(u=0;u<32;u++)if(pmod(u,16)===7){P.rect(u,5,u,17,'M');P.rect(u,30,u,42,'M');} // membrane laps
    // rooflight run v 19..28
    P.rect(0,18,31,18,'D');P.rect(0,19,31,19,'K');P.rect(0,29,31,29,'K');
    P.rect(0,20,31,28,'G');P.rect(0,20,31,20,'B');
    for(u=0;u<32;u++){if(pmod(u,8)===3)P.rect(u,20,u,28,'K');if(pmod(u,8)===5){P.set(u,22,'E');P.set(u+1,21,'E');}}
    P.rect(0,30,31,30,'M');
    // vent box
    P.rect(22,34,27,39,'I');P.rect(22,34,27,34,'L');P.rect(22,39,27,39,'J');P.rect(22,40,27,40,'D');
    for(u=2;u<30;u++)if(rng()<0.12){v=rng()<0.5?7+Math.floor(rng()*9):32+Math.floor(rng()*9);if(P.g&&(vert?get(P.g,v,u):get(P.g,u,v))==='L')P.set(u,v,'M');}
    return toRows(P.g);
  }

  // entranceCanopy 80x44 (overhead slab, solid columns, anchor feet): the
  // public entrance canopy -- pale slab seen from above, a dark fascia with
  // pale sign bars on the street edge, two slim columns down to the kerb.
  function makeEntranceCanopy(){
    var w=80,h=52,g=mkGrid(w,h),x,y;
    // columns first (behind fascia)
    bevel(g,8,42,11,51,'K','L','M','D');bevel(g,68,42,71,51,'K','L','M','D');
    rect(g,6,50,13,51,'J');rect(g,66,50,73,51,'J');box(g,6,50,13,51,'K');box(g,66,50,73,51,'K');
    // slab top: deep pale deck falling to a front gutter
    bevel(g,0,0,79,37,'K','H','L','M');
    for(y=2;y<33;y++)for(x=2;x<78;x++)if(pmod(x,10)===5)g[y][x]='M'; // standing-seam ribs
    rect(g,2,33,77,34,'D');rect(g,2,33,77,33,'M'); // front gutter
    rect(g,32,10,47,21,'G');box(g,32,10,47,21,'K');rect(g,33,11,46,11,'B');rect(g,39,11,40,20,'K');setclip(g,34,13,'B');setclip(g,42,13,'B'); // rooflight
    // fascia
    rect(g,0,36,79,41,'D');box(g,0,36,79,41,'K');rect(g,1,37,78,37,'M');
    [[22,5],[29,3],[34,7],[43,4],[49,6]].forEach(function(b){rect(g,b[0],39,b[0]+b[1]-1,39,'H');});
    rect(g,58,38,61,40,'L');setclip(g,59,39,'M'); // wayfinding plaque
    return toRows(g);
  }

  // glassLink_h 32x24 / glassLink_v 24x32 (overhead, anchor tile): covered
  // glass corridor between wings -- pale frame rails, glazed roof, mullions
  // every 8, glints on a fixed period.
  function makeGlassLink(vert,variant){
    var P=axis(vert,32,24),u;
    P.rect(0,0,31,0,'K');P.rect(0,1,31,2,'H');P.rect(0,3,31,3,'M');
    P.rect(0,20,31,20,'L');P.rect(0,21,31,22,'M');P.rect(0,23,31,23,'K');
    P.rect(0,4,31,19,'G');P.rect(0,4,31,4,'K');P.rect(0,19,31,19,'K');
    P.rect(0,11,31,12,'B'); // ridge flashing
    P.rect(0,11,31,11,'L');
    for(u=0;u<32;u++){
      if(pmod(u,8)===0){P.rect(u,5,u,18,'K');}
      if(pmod(u,16)===3){P.set(u,6,'F');P.set(u+1,6,'E');P.set(u,7,'E');}
      if(pmod(u,16)===11){P.set(u,14,'E');P.set(u+1,14,'B');}
    }
    if(variant===1){P.set(21,16,'B');P.set(22,16,'B');P.set(22,17,'E');} // cracked pane
    return toRows(P.g);
  }

  // serviceWall_h 32x24 (solid facade strip, anchor {x:0,y:1}): pale glazed
  // tile wall on the service side -- tile courses, a louvre panel, downpipe,
  // scuffed dark kick band. serviceDoor 32x24 is a drop-in tile of the same
  // run: wide steel double doors with a bump rail and hazard-edged step.
  function wallCourses(g,w,h,variant){
    var x,y,rng=mulberry32(variant?512:511);
    rect(g,0,0,w-1,h-1,'L');
    rect(g,0,0,w-1,0,'K');rect(g,0,1,w-1,1,'H');rect(g,0,2,w-1,2,'M');
    for(y=3;y<h-5;y++)for(x=0;x<w;x++){if(pmod(y,5)===2)g[y][x]='M';else if(pmod(x+(pmod(Math.floor((y-3)/5),2)?4:0),8)===0)g[y][x]='M';}
    rect(g,0,h-5,w-1,h-2,'D');rect(g,0,h-5,w-1,h-5,'M');rect(g,0,h-1,w-1,h-1,'K');
    for(x=2;x<w-2;x++)if(rng()<0.12)setclip(g,x,h-4+Math.floor(rng()*2),'K');
  }
  function makeServiceWall(variant){
    var g=mkGrid(32,24);wallCourses(g,32,24,variant);
    bevel(g,15,6,26,14,'K','S','I','J');
    var y;for(y=8;y<14;y+=2)rect(g,16,y,25,y,'J');
    rect(g,3,1,4,22,'I');rect(g,3,1,3,22,'S');setclip(g,3,11,'J');setclip(g,4,11,'J');rect(g,2,21,5,22,'J');
    return toRows(g);
  }
  function makeServiceDoor(){
    var g=mkGrid(32,24);wallCourses(g,32,24,0);
    rect(g,4,4,27,19,'K');
    bevel(g,5,5,15,19,'K','S','I','J');bevel(g,16,5,26,19,'K','S','I','J');
    rect(g,6,12,25,13,'J');rect(g,6,12,25,12,'S'); // bump rail
    rect(g,8,7,12,9,'G');box(g,8,7,12,9,'K');rect(g,19,7,23,9,'G');box(g,19,7,23,9,'K'); // vision panels
    rect(g,14,11,15,14,'K');rect(g,16,11,17,14,'K');
    hazardStripe(g,3,20,28,22,8,'Y','K');
    rect(g,3,5,3,19,'H');
    return toRows(g);
  }

  // ambulanceBay 48x80 (flat decal, anchor center): painted ambulance bay --
  // worn pale box outline, hatched keep-clear block against the service
  // door end (top), stencil bars and a lead-in chevron at the open end.
  function makeAmbulanceBay(){
    var w=48,h=80,g=mkGrid(w,h),rng=mulberry32(521),x,y;
    box(g,2,2,45,77,'W');box(g,3,3,44,76,'W');
    for(y=4;y<20;y++)for(x=4;x<44;x++)if(pmod(x+y,8)<3)g[y][x]='Y';
    rect(g,4,20,43,21,'W');
    [[12,6],[20,4],[26,10]].forEach(function(b){rect(g,b[0],30,b[0]+b[1]-1,32,'H');});
    rect(g,10,36,37,37,'W');
    for(y=0;y<10;y++){setclip(g,23-y,62-y,'W');setclip(g,24+y,62-y,'W');setclip(g,23-y,63-y,'W');setclip(g,24+y,63-y,'W');}
    for(y=2;y<78;y++)for(x=2;x<46;x++)if(g[y][x]!=='.'&&rng()<0.14)g[y][x]=(g[y][x]==='Y')?'D':'.';
    return toRows(g);
  }

  // =====================================================================
  // NORTHLINE
  // =====================================================================

  // fireBays 152x52 (solid frontage, anchor feet on the street facade line):
  // fire-station front -- brick with a pale parapet cap, three apparatus
  // roller doors under numbered plaques 1-2-3, pale pilasters, and a narrow
  // glazed duty entrance with a lamp and step on the right.
  function makeFireBays(){
    var w=152,h=52,g=mkGrid(w,h),x,y,i;
    bevel(g,0,0,151,51,'K','L','M','D');
    for(y=6;y<49;y++)for(x=1;x<151;x++)if(pmod(y,3)===2||pmod(x+(pmod(Math.floor(y/3),2)?3:0),6)===0)g[y][x]='D'; // brick courses
    rect(g,0,0,151,5,'C');rect(g,0,0,151,0,'K');rect(g,0,1,151,1,'P');rect(g,0,5,151,5,'Q');rect(g,0,6,151,6,'K');
    box(g,0,0,151,51,'K');
    for(i=0;i<3;i++){
      x=6+i*38;
      rect(g,x-3,7,x-1,50,'C');rect(g,x-3,7,x-3,50,'P');rect(g,x-1,7,x-1,50,'Q'); // pilaster
      rect(g,x,17,x+31,50,'N'); // door reveal
      rect(g,x,17,x+31,18,'Q');rect(g,x,17,x+31,17,'P'); // lintel
      rect(g,x+1,19,x+30,49,'I');
      for(y=20;y<49;y+=3)rect(g,x+1,y,x+30,y,'J');
      rect(g,x+1,19,x+1,49,'S');
      if(i===1){rect(g,x+1,44,x+30,49,'N');for(y=45;y<49;y+=2)rect(g,x+2,y,x+29,y,'J');} // bay 2 left half-raised
      rect(g,x+13,47,x+18,48,'N'); // handle
      rect(g,x+11,8,x+19,16,'P');box(g,x+11,8,x+19,16,'K');rect(g,x+12,15,x+18,15,'Q');digit(g,x+14,9,i+1,'K');
    }
    rect(g,117,7,119,50,'C');rect(g,117,7,117,50,'P');rect(g,119,7,119,50,'Q');
    // duty entrance
    rect(g,127,18,142,50,'N');rect(g,127,18,142,19,'Q');rect(g,127,18,142,18,'P');
    bevel(g,129,21,140,48,'K','S','I','J');
    rect(g,131,23,138,35,'G');box(g,131,23,138,35,'K');setclip(g,132,24,'B');setclip(g,133,24,'B');
    rect(g,136,39,137,41,'N');
    rect(g,125,49,144,51,'Q');rect(g,125,49,144,49,'P');box(g,125,49,144,51,'K');
    bevel(g,132,10,137,15,'K','S','I','J');rect(g,134,12,135,13,'Y'); // lamp
    rect(g,146,20,149,26,'P');box(g,146,20,149,26,'K'); // duty plaque
    return toRows(g);
  }

  // fireApron_h 32x20 / fireApron_v 20x32 (flat decal, tiles along the
  // bay front): cleared apron paint -- pale stop line and hatched keep-clear
  // band in faded amber.
  function makeFireApron(vert,variant){
    var P=axis(vert,32,20),rng=mulberry32(vert?532:531),u,v;
    P.rect(0,0,31,1,'W');
    for(u=0;u<32;u++)for(v=4;v<=15;v++)if(pmod(u+v,8)<3)P.set(u,v,'Y');
    P.rect(0,3,31,3,'W');P.rect(0,16,31,16,'W');
    for(u=2;u<30;u++)for(v=0;v<18;v++)if(rng()<0.1)P.set(u,v,variant?'.':'D');
    for(u=2;u<30;u++)if(rng()<0.25)P.set(u,1,'.');
    return toRows(P.g);
  }

  // depotWall_h 32x32 (solid frontage strip, anchor {x:0,y:1}): corrugated
  // depot shed wall -- dark eaves, clerestory glazing (mullions every 8),
  // period-4 ribs, concrete kick wall. depotDoor_h is a drop-in tile of the
  // same bands with a roller door and hazard-striped jambs.
  // depotWall_v 12x32 (solid, anchor {x:.5,y:0}): the side run seen from
  // above -- eaves cap and gutter line with rib ticks, tiles top-bottom.
  function depotBands(g,variant){
    var x,y,rng=mulberry32(variant?542:541),r;
    rect(g,0,0,31,3,'D');rect(g,0,0,31,0,'K');rect(g,0,1,31,1,'L');rect(g,0,3,31,3,'K');
    rect(g,0,4,31,8,'G');rect(g,0,4,31,4,'B');rect(g,0,8,31,8,'K');
    for(x=0;x<32;x++)if(pmod(x,8)===0)rect(g,x,4,x,8,'K');
    for(y=9;y<26;y++)for(x=0;x<32;x++){r=pmod(x,4);g[y][x]=r===0?'L':(r===3?'D':'M');}
    rect(g,0,9,31,9,'K');
    rect(g,0,26,31,31,'C');rect(g,0,26,31,26,'P');rect(g,0,31,31,31,'K');rect(g,0,30,31,30,'E');
    for(x=2;x<30;x++)if(rng()<0.15)setclip(g,x,27+Math.floor(rng()*3),'E');
    for(x=2;x<30;x++)if(rng()<0.06)setclip(g,x,12+Math.floor(rng()*12),'K');
  }
  function makeDepotWall(variant){var g=mkGrid(32,32);depotBands(g,variant);return toRows(g);}
  function makeDepotDoor(){
    var g=mkGrid(32,32),y;depotBands(g,0);
    rect(g,3,10,28,31,'K');
    for(y=11;y<31;y++)rect(g,5,y,26,y,pmod(y,3)===0?'D':'M');
    rect(g,5,11,26,11,'L');
    hazardStripe(g,3,10,4,30,8,'Y','K');hazardStripe(g,27,10,28,30,8,'Y','K');
    rect(g,3,31,28,31,'K');rect(g,13,28,18,29,'K');
    return toRows(g);
  }
  function makeDepotWallV(variant){
    var g=mkGrid(12,32),y;
    for(y=0;y<32;y++){g[y][0]='K';g[y][1]='L';g[y][2]='M';g[y][3]='D';g[y][4]='K';
      for(var x=5;x<11;x++)g[y][x]=pmod(y,4)===0?'L':(pmod(y,4)===3?'D':'M');g[y][11]='K';}
    if(variant===1){setclip(g,7,14,'K');setclip(g,8,15,'K');}
    return toRows(g);
  }

  // transformer 44x48 (solid, anchor feet): utility-yard pad transformer --
  // concrete plinth, iron tank with radiator fins both sides, three bushings
  // on the lid, faded amber warning plate, conduit into the ground.
  function makeTransformer(){
    var w=44,h=48,g=mkGrid(w,h),x,y;
    bevel(g,1,39,42,47,'K','P','C','E');
    for(x=3;x<41;x+=9)setclip(g,x,44,'E');
    bevel(g,9,14,34,39,'K','L','M','D');
    for(x=2;x<9;x++)if(pmod(x,2)===0)rect(g,x,18,x,36,'M');
    for(x=35;x<42;x++)if(pmod(x,2)===1)rect(g,x,18,x,36,'D');
    rect(g,2,17,8,17,'K');rect(g,2,37,8,37,'K');rect(g,35,17,41,17,'K');rect(g,35,37,41,37,'K');
    for(x=2;x<9;x++)if(pmod(x,2)===1)rect(g,x,18,x,36,'K');
    for(x=35;x<42;x++)if(pmod(x,2)===0)rect(g,x,18,x,36,'K');
    rect(g,9,12,34,14,'D');rect(g,9,12,34,12,'L');box(g,9,12,34,14,'K');
    [14,21,28].forEach(function(cx){
      for(y=4;y<12;y+=2){rect(g,cx-1,y,cx+2,y,'P');rect(g,cx,y+1,cx+1,y+1,'C');}
      rect(g,cx,2,cx+1,3,'Q');rect(g,cx-1,11,cx+2,11,'C');
    });
    outlineFrom(g,['P','C','Q'],'K');
    [14,21,28].forEach(function(cx){rect(g,cx,4,cx,10,'Q');setclip(g,cx,1,'K');setclip(g,cx+1,1,'K');});
    rect(g,9,12,34,14,'D');rect(g,9,12,34,12,'L');box(g,9,12,34,14,'K');
    bevel(g,9,14,34,39,'K','L','M','D');
    rect(g,18,21,25,28,'Y');box(g,18,21,25,28,'K');rect(g,21,23,22,25,'K');setclip(g,21,27,'K');setclip(g,22,27,'K');
    rect(g,12,31,31,31,'D');rect(g,12,34,31,34,'D');
    setclip(g,11,16,'H');setclip(g,12,16,'H');
    return toRows(g);
  }

  // cablePole 24x72 (solid post, anchor feet): creosoted utility pole with a
  // crossarm, three insulators and cut cable drops -- the crew left mid-job.
  function makeCablePole(){
    var w=24,h=72,g=mkGrid(w,h),y;
    rect(g,10,6,13,71,'T');rect(g,10,6,10,71,'S');
    for(y=12;y<70;y+=11)setclip(g,12,y,'K');
    rect(g,1,10,22,12,'T');rect(g,1,10,22,10,'S');
    [3,11,19].forEach(function(x){rect(g,x,7,x+1,9,'Q');setclip(g,x,7,'P');});
    rect(g,15,20,17,21,'M');
    outlineFrom(g,['T','S','Q','P','M'],'K');
    line(g,3,13,1,24,'D');line(g,20,13,23,22,'D');
    rect(g,7,68,16,71,'E');rect(g,7,68,16,68,'C');box(g,7,68,16,71,'K');
    rect(g,14,40,16,48,'D');box(g,14,40,16,48,'K'); // step bolts / tag
    return toRows(g);
  }

  // cableDrum 32x28 (solid, anchor feet): wooden cable reel on its side,
  // wound dark cable, a loose tail to the ground.
  function makeCableDrum(){
    // reel standing on edge, seen three-quarter: back flange up-right, wound
    // cable drum between, front flange face with planks and hub
    var w=32,h=28,g=mkGrid(w,h),x,y;
    disc(g,19,10,10,10,'T');outlineFrom(g,['T'],'K');
    for(y=4;y<20;y++)for(x=10;x<24;x++)if(g[y][x]==='T')g[y][x]=pmod(x+y,3)===0?'K':'D'; // wound cable between flanges
    var back=g.map(function(r){return r.slice();});
    disc(g,13,15,11,11,'T');
    for(y=4;y<27;y++)for(x=2;x<25;x++)if(g[y][x]==='T'&&pmod(y,6)===3)g[y][x]='K';
    outlineFrom(g,['T'],'K');
    for(y=0;y<28;y++)for(x=0;x<32;x++)if(g[y][x]==='.'&&back[y][x]!=='.')g[y][x]=back[y][x];
    line(g,5,9,8,6,'S');line(g,4,11,4,14,'S');setclip(g,9,5,'U');
    disc(g,13,15,2,2,'K');setclip(g,13,15,'M');
    line(g,24,21,31,27,'D');line(g,24,22,30,27,'K');
    return toRows(g);
  }

  // cableRack_h 32x16 / cableRack_v 12x32 (solid low run, anchors {x:0,y:1}
  // / {x:.5,y:0}): steel ladder tray on short legs every 16 carrying three
  // bundled cables; see-through underneath.
  function makeCableRackH(variant){
    var g=mkGrid(32,16),x;
    for(x=0;x<32;x++)if(pmod(x,16)===2){rect(g,x,8,x+2,15,'M');rect(g,x,8,x,15,'L');rect(g,x+2,8,x+2,15,'K');rect(g,x-1,15,x+3,15,'K');}
    rect(g,0,3,31,7,'D');rect(g,0,3,31,3,'L');rect(g,0,7,31,7,'K');rect(g,0,2,31,2,'K');
    for(x=0;x<32;x++)if(pmod(x,8)===5)rect(g,x,4,x,6,'M');
    // three bundled cables resting on the tray
    rect(g,0,0,31,0,'K');rect(g,0,1,31,1,'M');rect(g,0,2,31,2,'B');
    for(x=0;x<32;x++)if(pmod(x,8)===1){setclip(g,x,1,'K');setclip(g,x,2,'K');}
    if(variant===1){setclip(g,20,1,'L');setclip(g,21,1,'L');}
    return toRows(g);
  }
  function makeCableRackV(variant){
    var g=mkGrid(12,32),y;
    for(y=0;y<32;y++){g[y][2]='K';g[y][3]='L';g[y][4]='D';g[y][5]='B';g[y][6]='B';g[y][7]='K';g[y][8]='D';g[y][9]='K';
      if(pmod(y,8)===5){g[y][4]='M';g[y][8]='M';}}
    for(y=0;y<32;y++)if(pmod(y,16)===10){rect(g,1,y,10,y+2,'M');rect(g,1,y,10,y,'L');box(g,1,y,10,y+2,'K');rect(g,5,y+1,6,y+1,'B');}
    if(variant===1){setclip(g,5,20,'D');}
    return toRows(g);
  }

  // broadcastFront 120x60 (solid frontage, anchor feet): municipal broadcast
  // building -- concrete bands, ribbon windows, glazed double entrance under
  // a hood with pale call-sign bars, a wall dish and a lattice mast stub
  // rising off the parapet corner.
  function makeBroadcastFront(){
    var w=120,h=60,g=mkGrid(w,h),x,y;
    bevel(g,0,14,119,59,'K','L','M','D');
    rect(g,0,14,119,17,'L');rect(g,0,15,119,15,'H');box(g,0,14,119,59,'K');rect(g,0,17,119,17,'D');
    // ribbon windows
    rect(g,4,22,115,29,'G');box(g,4,22,115,29,'K');rect(g,5,23,114,23,'B');
    for(x=4;x<116;x+=10)rect(g,x,22,x,29,'K');
    for(x=9;x<116;x+=20){setclip(g,x,25,'E');setclip(g,x+1,24,'E');}
    rect(g,1,30,118,31,'L');rect(g,1,31,118,31,'D');
    // entrance
    rect(g,40,34,71,36,'I');rect(g,40,34,71,34,'S');box(g,40,33,71,37,'K');
    [[44,4],[50,3],[55,5],[62,3]].forEach(function(b){rect(g,b[0],35,b[0]+b[1]-1,35,'H');});
    rect(g,44,38,67,57,'N');
    rect(g,45,39,55,57,'G');rect(g,56,39,66,57,'G');box(g,45,39,55,57,'K');box(g,56,39,66,57,'K');
    rect(g,46,40,54,40,'B');rect(g,57,40,65,40,'B');rect(g,54,46,54,50,'S');rect(g,57,46,57,50,'S');
    rect(g,40,57,71,59,'L');rect(g,40,57,71,57,'H');box(g,40,57,71,59,'K');
    // service grille left, plaque right
    bevel(g,10,40,26,53,'K','S','I','J');for(y=42;y<52;y+=2)rect(g,12,y,24,y,'J');
    rect(g,80,40,95,46,'H');box(g,80,40,95,46,'K');rect(g,82,43,93,43,'D');
    // call-sign band on the parapet
    rect(g,2,18,117,20,'D');[[6,6],[14,3],[19,8],[30,4]].forEach(function(b){rect(g,b[0],19,b[0]+b[1]-1,19,'L');});
    // roof kit behind the parapet: two whip antennas and a dish on a stand
    rect(g,10,0,10,13,'S');rect(g,11,2,11,13,'J');setclip(g,10,0,'H');
    rect(g,30,4,30,13,'S');rect(g,31,6,31,13,'J');
    disc(g,98,6,8,6,'L');disc(g,99,7,6,5,'M');disc(g,100,8,4,3,'D');setclip(g,94,3,'H');setclip(g,95,2,'H');line(g,100,8,93,1,'J');
    rect(g,96,10,100,13,'I');rect(g,92,13,104,13,'J');
    outlineFrom(g,['L','M','D','I','J','S','H'],'K');
    // re-seat the facade after outlining the roof kit (outline pass touched only open-edge texels)
    rect(g,1,15,118,15,'H');rect(g,0,14,119,14,'K');
    // wall-mounted relay box and cable to the dish
    bevel(g,100,38,112,50,'K','S','I','J');rect(g,102,41,110,41,'J');rect(g,102,44,110,44,'J');setclip(g,110,47,'H');
    line(g,106,37,106,21,'J');
    return toRows(g);
  }

  // =====================================================================
  // CENTRAL QUARANTINE
  // =====================================================================

  // qFence_h 32x24 / qFence_v 12x32 (solid, see-through mesh, anchors
  // {x:0,y:1} / {x:.5,y:0}): bolted welded-mesh containment fence matching
  // quarantine/gate_* -- iron post + clamp bolts at x0-3, mesh panel, hazard
  // band on the lower rail, concrete foot block straddling the post.
  function makeQFenceH(variant){
    var g=mkGrid(32,24),x,y,rng=mulberry32(variant?552:551);
    for(y=3;y<17;y++)for(x=4;x<32;x++)if(pmod(x,4)===2||pmod(y,4)===1)g[y][x]='M';
    rect(g,0,1,31,2,'L');rect(g,0,0,31,0,'K');rect(g,0,3,31,3,'K');
    hazardStripe(g,0,17,31,18,8,'Y','K');rect(g,0,16,31,16,'K');rect(g,0,19,31,19,'K');
    for(x=0;x<32;x++)if(pmod(x,8)===6)setclip(g,x,1,'H');
    bevel(g,0,0,3,21,'K','H','L','D');
    [5,13].forEach(function(yy){rect(g,4,yy,5,yy+1,'D');setclip(g,4,yy,'H');});
    rect(g,28,20,31,23,'C');rect(g,0,20,3,23,'C');rect(g,28,20,31,20,'P');rect(g,0,20,3,20,'P');rect(g,0,23,31,23,'.');rect(g,0,23,3,23,'K');rect(g,28,23,31,23,'K');setclip(g,27,21,'K');setclip(g,27,22,'K');setclip(g,4,21,'K');setclip(g,4,22,'K');
    if(variant===1){rect(g,15,8,17,10,'.');setclip(g,16,9,'D');}
    for(x=8;x<26;x++)if(rng()<0.05)setclip(g,x,4+Math.floor(rng()*11),'L');
    return toRows(g);
  }
  function makeQFenceV(variant){
    var g=mkGrid(12,32),y;
    hazardStripe(g,0,0,2,31,8,'Y','K');
    for(y=0;y<32;y++){g[y][3]='K';g[y][4]='L';g[y][5]='M';g[y][6]='D';g[y][7]='K';
      if(pmod(y,4)===1){g[y][8]='M';g[y][9]='M';}}
    for(y=0;y<32;y++)if(pmod(y,8)===4){g[y][4]='H';}
    rect(g,2,0,9,3,'C');rect(g,2,0,9,0,'P');rect(g,2,3,9,3,'E');rect(g,2,29,9,31,'C');rect(g,2,29,9,29,'P');
    rect(g,1,0,1,3,'K');rect(g,10,0,10,3,'K');rect(g,1,29,1,31,'K');rect(g,10,29,10,31,'K');
    rect(g,4,0,5,31,'L');rect(g,4,0,4,31,'H');rect(g,3,0,3,31,'K');rect(g,6,0,6,31,'K');
    if(variant===1)setclip(g,8,17,'.');
    return toRows(g);
  }
  // qFencePost 12x28 / qFenceCorner 24x28 (solid, anchor feet): standalone
  // post and corner post, same iron + clamp bolts + concrete foot as qFence.
  function makeQFencePost(){
    var g=mkGrid(12,28);
    bevel(g,4,0,7,23,'K','H','L','D');
    [4,12].forEach(function(y){rect(g,1,y,3,y+2,'M');rect(g,8,y,10,y+2,'M');box(g,1,y,3,y+2,'K');box(g,8,y,10,y+2,'K');});
    bevel(g,0,22,11,27,'K','P','C','E');
    rect(g,4,17,7,18,'Y');rect(g,4,19,7,19,'K');
    return toRows(g);
  }
  function makeQFenceCorner(){
    var g=mkGrid(24,28),x,y;
    for(y=6;y<20;y++)for(x=13;x<24;x++)if(pmod(x,4)===2||pmod(y,4)===1)g[y][x]='M';
    rect(g,12,4,23,5,'L');rect(g,12,3,23,3,'K');rect(g,12,6,23,6,'K');
    hazardStripe(g,12,18,23,19,8,'Y','K');rect(g,12,20,23,20,'K');
    line(g,3,21,9,4,'D');line(g,2,21,8,4,'K'); // raking brace behind
    bevel(g,8,0,12,23,'K','H','L','D');
    [4,12].forEach(function(y){rect(g,13,y,14,y+2,'D');setclip(g,13,y,'H');});
    bevel(g,5,21,16,27,'K','P','C','E');bevel(g,0,23,5,27,'K','P','C','E');
    setclip(g,10,1,'H');
    return toRows(g);
  }
  // qFenceGate 48x28 (solid when closed, anchor feet, frames down:[closed,
  // open]): bolted mesh swing gate between two posts -- closed: braced mesh
  // leaf with chained padlock; open: leaf swung back against the left post.
  function makeQFenceGate(open){
    var g=mkGrid(48,28),x,y;
    if(!open){
      for(y=4;y<19;y++)for(x=6;x<42;x++)if(pmod(x,4)===2||pmod(y,4)===1)g[y][x]='M';
      rect(g,6,2,41,3,'L');rect(g,6,1,41,1,'K');rect(g,6,4,41,4,'K');
      hazardStripe(g,6,18,41,19,8,'Y','K');rect(g,6,17,41,17,'K');rect(g,6,20,41,20,'K');
      rect(g,6,1,7,20,'L');rect(g,40,1,41,20,'D');line(g,8,17,39,4,'L');line(g,8,18,39,5,'D');
      rect(g,22,1,23,20,'D');
      rect(g,21,8,24,9,'I');disc(g,23,12,1,1,'H');rect(g,22,11,24,13,'M');box(g,22,11,24,13,'K');setclip(g,23,12,'Y');
    }else{
      for(y=3;y<19;y++)for(x=6;x<12;x++)if(pmod(x,2)===0||pmod(y,4)===1)g[y][x]='M';
      rect(g,11,1,11,20,'D');rect(g,6,1,11,1,'L');rect(g,6,20,11,20,'K');rect(g,11,0,11,21,'K');
      hazardStripe(g,6,17,10,18,4,'Y','K');
      rect(g,12,22,40,23,'K');for(x=14;x<40;x+=6)setclip(g,x,23,'D');
    }
    bevel(g,0,0,5,23,'K','H','L','D');bevel(g,42,0,47,23,'K','H','L','D');
    [5,13].forEach(function(yy){setclip(g,2,yy,'H');setclip(g,44,yy,'H');});
    bevel(g,0,22,7,27,'K','P','C','E');bevel(g,40,22,47,27,'K','P','C','E');
    return toRows(g);
  }

  // queueRail_h 32x14 / queueRail_v 10x32 (solid but low and see-through,
  // anchors {x:0,y:1} / {x:.5,y:0}): registration queue stanchions every
  // 16 with a slack navy tensile belt between.
  function makeQueueRailH(variant){
    var g=mkGrid(32,14),x;
    for(x=0;x<32;x++){var s=pmod(x,16);var sag=(s>=5&&s<=12)?1:0;setclip(g,x,4+sag,'B');setclip(g,x,5+sag,'N');}
    // stanchion centred on the tile seam (columns 31,0,1 and 15,16,17), drawn per column so it tiles
    for(x=0;x<32;x++){var q=pmod(x+1,16);
      if(q<=2){rect(g,x,2,x,11,q===0?'L':(q===1?'M':'K'));setclip(g,x,1,q===2?'K':'H');setclip(g,x,0,'K');}
      if(q<=4||q>=14){setclip(g,x,12,(q===14||q===4)?'K':'D');setclip(g,x,13,'K');}
      if(q===3||q===15){setclip(g,x,1,'K');setclip(g,x,2,'K');}
    }
    if(variant===1)setclip(g,24,5,'N');
    return toRows(g);
  }
  function makeQueueRailV(variant){
    var g=mkGrid(10,32),y;
    for(y=0;y<32;y++){g[y][4]='B';g[y][5]='N';}
    for(y=0;y<32;y++)if(pmod(y,16)===5){rect(g,1,y,8,y+5,'D');box(g,1,y,8,y+5,'K');rect(g,3,y+1,6,y+3,'M');rect(g,3,y+1,6,y+1,'L');rect(g,4,y+2,5,y+2,'H');}
    if(variant===1)setclip(g,5,6,'K');
    return toRows(g);
  }

  // tentGroup 112x72 (solid, anchor feet): three requisitioned ridge tents
  // -- two olive canvas stores tents and a pale clinical tent in front,
  // lit/shadow roof slopes, dark door flaps, guy lines and pegs.
  function tent(g,x0,y0,w,h,pale){
    // ridge runs toward the viewer: roof seen from above as a lit west slope
    // and a shaded east slope split by the ridge; the south gable end is a
    // pentagon (apex at the ridge, short walls) with a dark door slit.
    var L=pale?'P':'L',M=pale?'Q':'M',D=pale?'R':'D',S=pale?'S':'K',x,y;
    var dc=x0+Math.floor(w/2),gy=y0+Math.floor(h*0.45),wall=y0+h-5,half=Math.floor(w/2);
    for(y=y0;y<y0+h;y++)for(x=x0;x<x0+w;x++){
      var ch;
      if(y>=gy){
        var t=(y-gy)/Math.max(1,wall-gy),hw=Math.min(half,Math.round(t*half));
        ch=(Math.abs(x-dc+0.5)<=hw||y>=wall)?D:(x<dc?L:M);
      }else ch=x<dc?L:M;
      g[y][x]=ch;
    }
    setclip(g,x0,y0,'.');setclip(g,x0+w-1,y0,'.');
    rect(g,dc,y0,dc,gy,'H'); // ridge line
    if(pale)rect(g,dc,y0,dc,gy,'P');
    for(y=y0+5;y<gy;y+=7){rect(g,x0+1,y,dc-2,y,M);rect(g,dc+2,y,x0+w-2,y,D);} // frame hoops
    // door slit + tied-back flap
    rect(g,dc-3,wall-6,dc+2,y0+h-1,S);line(g,dc-3,wall-6,dc-6,y0+h-1,L);
    outlineFrom(g,[L,M,D,S,'H','P'],'K');
    line(g,x0,gy,x0-5,y0+h+1,'I');line(g,x0+w-1,gy,x0+w+4,y0+h+1,'I');
    setclip(g,x0-5,y0+h+1,'K');setclip(g,x0+w+4,y0+h+1,'K');
    rect(g,x0+1,y0+h,x0+w-2,y0+h,'K');
  }
  function makeTentGroup(){
    var g=mkGrid(112,72);
    tent(g,6,2,50,32,false);
    tent(g,62,6,44,30,false);
    tent(g,30,34,52,34,true);
    // store tent stencil patch
    rect(g,14,26,21,28,'H');box(g,14,26,21,28,'K');
    rect(g,94,29,99,31,'H');box(g,94,29,99,31,'K');
    return toRows(g);
  }

  // processingLink_h 32x32 / processingLink_v 32x32 (overhead, anchor tile,
  // scaffold legs at the frame ribs are the only collision): tarp-covered
  // processing walkway -- canvas roof with iron frame ribs every 16, sag
  // shading between ribs, roped valance hems on both long edges.
  function makeProcessingLink(vert,variant){
    var P=axis(vert,32,32),rng=mulberry32(vert?(variant?564:563):(variant?562:561)),u,v,s;
    for(u=0;u<32;u++){s=pmod(u,16);
      for(v=3;v<=28;v++)P.set(u,v,(s>=6&&s<=10)?'D':((s<=2||s>=14)?'L':'M'));}
    P.rect(0,15,31,16,'H');P.rect(0,16,31,16,'L'); // ridge line
    for(u=0;u<32;u++){s=pmod(u,16);if(s>=6&&s<=10){P.set(u,15,'M');P.set(u,16,'M');}}
    for(u=0;u<32;u++)if(pmod(u,16)===0){P.rect(u,1,u,30,'S');P.rect(u+1,1,u+1,30,'J');}
    P.rect(0,0,31,0,'K');P.rect(0,1,31,2,'I');P.rect(0,1,31,1,'S');P.rect(0,3,31,3,'K');
    P.rect(0,28,31,28,'K');P.rect(0,29,31,30,'J');P.rect(0,31,31,31,'K');
    for(u=0;u<32;u++)if(pmod(u,8)===4){P.set(u,3,'H');P.set(u,28,'D');}
    for(u=3;u<29;u++)if(rng()<0.06)P.set(u,5+Math.floor(rng()*9),'K');
    return toRows(P.g);
  }

  // requisitionBoard 30x40 (solid small, anchor feet): steel-framed plywood
  // board on two stakes -- dark stencil header band with pale bars, pinned
  // requisition forms with muted rust stamps, hazard kick strip.
  function makeRequisitionBoard(){
    var w=30,h=40,g=mkGrid(w,h),y;
    rect(g,5,28,7,39,'M');rect(g,5,28,5,39,'L');rect(g,7,28,7,39,'D');
    rect(g,22,28,24,39,'M');rect(g,22,28,22,39,'L');rect(g,24,28,24,39,'D');
    outlineFrom(g,['M','L','D'],'K');
    rect(g,3,38,9,39,'K');rect(g,20,38,26,39,'K');
    bevel(g,0,0,29,29,'K','L','M','D');
    rect(g,2,2,27,25,'S');rect(g,2,2,27,2,'T');
    rect(g,2,3,27,7,'K');[[5,4],[10,6],[17,3],[21,4]].forEach(function(b){rect(g,b[0],5,b[0]+b[1]-1,5,'Q');});
    function form(x0,y0,x1,y1,stamp){rect(g,x0,y0,x1,y1,'P');box(g,x0,y0,x1,y1,'K');for(var yy=y0+2;yy<y1-1;yy+=2)rect(g,x0+2,yy,x1-3,yy,'W');if(stamp){rect(g,x1-5,y1-4,x1-2,y1-2,'U');setclip(g,x1-4,y1-3,'P');}setclip(g,Math.floor((x0+x1)/2),y0,'Y');}
    form(4,9,13,23,true);form(15,10,25,19,false);form(16,21,25,25,true);
    hazardStripe(g,1,26,28,28,8,'Y','K');rect(g,1,25,28,25,'K');rect(g,1,28,28,28,'K');
    return toRows(g);
  }

  A.define('civic',{
    // Civic Ward
    wardRoof_h:{variants:[makeWardRoof(false,0),makeWardRoof(false,1)],pal:WARD_PAL,anchor:'tile',note:'32x48 OVERHEAD pale ward-wing roof: parapets both long sides, membrane laps every 16, central rooflight run (mullions every 8), vent box; tiles left-right'},
    wardRoof_v:{variants:[makeWardRoof(true,0),makeWardRoof(true,1)],pal:WARD_PAL,anchor:'tile',note:'48x32 OVERHEAD pale ward-wing roof, north-south wing; tiles top-bottom'},
    entranceCanopy:{rows:makeEntranceCanopy(),pal:CANOPY_PAL,anchor:'feet',note:'80x52 OVERHEAD public entrance canopy: standing-seam deck, rooflight, front gutter, fascia with pale sign bars; SOLID only at the two column feet (x6-13, x66-73, bottom 2 rows)'},
    glassLink_h:{variants:[makeGlassLink(false,0),makeGlassLink(false,1)],pal:LINK_PAL,anchor:'tile',note:'32x24 OVERHEAD covered glass corridor between wings, pale frame rails, mullions every 8; tiles left-right, [1] cracked pane'},
    glassLink_v:{variants:[makeGlassLink(true,0),makeGlassLink(true,1)],pal:LINK_PAL,anchor:'tile',note:'24x32 OVERHEAD covered glass corridor, tiles top-bottom'},
    serviceWall_h:{variants:[makeServiceWall(0),makeServiceWall(1)],pal:SERVICE_PAL,anchor:{x:0,y:1},note:'32x24 SOLID facade strip, pale glazed tile service wall, louvre, downpipe, dark kick band; tiles left-right'},
    serviceDoor:{rows:makeServiceDoor(),pal:SERVICE_PAL,anchor:{x:0,y:1},note:'32x24 SOLID facade tile (door gap in collision): steel double service doors with bump rail and hazard step; drops into a serviceWall_h run'},
    ambulanceBay:{rows:makeAmbulanceBay(),pal:BAYPAINT_PAL,anchor:'center',note:'48x80 FLAT worn ambulance bay paint: box outline, hatched keep-clear block at the door end (top), stencil bars, lead-in chevron; rotate 90 for an east-west bay'},
    // Northline
    fireBays:{rows:makeFireBays(),pal:FIRE_PAL,anchor:'feet',note:'152x52 SOLID fire-station frontage: brick, pale parapet cap, three roller apparatus doors numbered 1-2-3 (bay 2 half-raised), pilasters, glazed duty entrance with lamp and step at x125-144'},
    fireApron_h:{variants:[makeFireApron(false,0),makeFireApron(false,1)],pal:BAYPAINT_PAL,anchor:{x:0,y:0},note:'32x20 FLAT cleared-apron paint: stop line on top edge, hatched keep-clear band; tiles left-right along the bay front'},
    fireApron_v:{variants:[makeFireApron(true,0),makeFireApron(true,1)],pal:BAYPAINT_PAL,anchor:{x:0,y:0},note:'20x32 FLAT cleared-apron paint, stop line on the left edge; tiles top-bottom'},
    depotWall_h:{variants:[makeDepotWall(0),makeDepotWall(1)],pal:DEPOT_PAL,anchor:{x:0,y:1},note:'32x32 SOLID corrugated depot shed frontage: eaves, clerestory glazing (mullions every 8), period-4 ribs, concrete kick wall; tiles left-right'},
    depotDoor:{rows:makeDepotDoor(),pal:DEPOT_PAL,anchor:{x:0,y:1},note:'32x32 SOLID facade tile with roller door + hazard jambs, same bands as depotWall_h; drop into the run'},
    depotWall_v:{variants:[makeDepotWallV(0),makeDepotWallV(1)],pal:DEPOT_PAL,anchor:{x:.5,y:0},note:'12x32 SOLID depot side wall seen from above, eaves cap + rib ticks; tiles top-bottom'},
    transformer:{rows:makeTransformer(),pal:YARD_PAL,anchor:'feet',note:'44x48 SOLID pad transformer: concrete plinth, finned iron tank, three bushings, amber warning plate; collision ~44x14 at the plinth'},
    cablePole:{rows:makeCablePole(),pal:YARD_PAL,anchor:'feet',note:'24x72 SOLID small (collision ~10x4 at foot) utility pole, crossarm, three insulators, cut cable drops'},
    cableDrum:{rows:makeCableDrum(),pal:YARD_PAL,anchor:'feet',note:'32x28 SOLID wooden cable reel on its side with dark cable and a loose tail'},
    cableRack_h:{variants:[makeCableRackH(0),makeCableRackH(1)],pal:CABLE_PAL,anchor:{x:0,y:1},note:'32x16 SOLID low see-through steel ladder tray on legs every 16 carrying bundled cable; tiles left-right'},
    cableRack_v:{variants:[makeCableRackV(0),makeCableRackV(1)],pal:CABLE_PAL,anchor:{x:.5,y:0},note:'12x32 SOLID low cable tray seen from above, cross-feet every 16; tiles top-bottom'},
    broadcastFront:{rows:makeBroadcastFront(),pal:BROADCAST_PAL,anchor:'feet',note:'120x60 SOLID broadcast building frontage: concrete bands, ribbon windows, glazed double entrance under a sign hood at x40-71, service grille, wall dish, lattice mast stub off the parapet (rows 0-13 are above the roofline)'},
    // Central Quarantine
    qFence_h:{variants:[makeQFenceH(0),makeQFenceH(1)],pal:QFENCE_PAL,anchor:{x:0,y:1},note:'32x24 SOLID see-through bolted mesh containment fence matching quarantine/gate_h: iron post + clamps at x0-3, hazard lower rail, concrete foot straddling the seam; tiles left-right'},
    qFence_v:{variants:[makeQFenceV(0),makeQFenceV(1)],pal:QFENCE_PAL,anchor:{x:.5,y:0},note:'12x32 SOLID bolted mesh fence run seen from above, hazard edge like quarantine/gate_v, concrete feet at the tile seam; tiles top-bottom'},
    qFencePost:{rows:makeQFencePost(),pal:QFENCE_PAL,anchor:'feet',note:'12x28 SOLID standalone fence post / run end with clamp bolts and concrete foot'},
    qFenceCorner:{rows:makeQFenceCorner(),pal:QFENCE_PAL,anchor:'feet',note:'24x28 SOLID corner post: panel stub to the east, raking brace behind, double concrete foot; mirror for a west corner'},
    qFenceGate:{frames:{down:[makeQFenceGate(false),makeQFenceGate(true)]},pal:QFENCE_PAL,anchor:'feet',note:'48x28 bolted mesh swing gate between two posts; frame 0 closed (SOLID 48 wide, chained padlock), 1 open (SOLID only at posts, 36 clear)'},
    queueRail_h:{variants:[makeQueueRailH(0),makeQueueRailH(1)],pal:QUEUE_PAL,anchor:{x:0,y:1},note:'32x14 SOLID low queue barrier: stanchions every 16 with slack navy belt; tiles left-right'},
    queueRail_v:{variants:[makeQueueRailV(0),makeQueueRailV(1)],pal:QUEUE_PAL,anchor:{x:.5,y:0},note:'10x32 SOLID low queue barrier seen from above, stanchion bases every 16; tiles top-bottom'},
    tentGroup:{rows:makeTentGroup(),pal:TENT_PAL,anchor:'feet',note:'112x72 SOLID group of three ridge tents (two olive stores tents behind, pale clinical tent in front) with guy lines'},
    processingLink_h:{variants:[makeProcessingLink(false,0),makeProcessingLink(false,1)],pal:TARP_PAL,anchor:'tile',note:'32x32 OVERHEAD tarp-covered processing walkway, iron ribs every 16, roped valances; tiles left-right'},
    processingLink_v:{variants:[makeProcessingLink(true,0),makeProcessingLink(true,1)],pal:TARP_PAL,anchor:'tile',note:'32x32 OVERHEAD tarp-covered processing walkway; tiles top-bottom'},
    requisitionBoard:{rows:makeRequisitionBoard(),pal:REQ_PAL,anchor:'feet',note:'30x40 SOLID small steel-framed requisition notice board on stakes: stencil header, pinned forms with rust stamps, hazard kick strip'}
  });
})();
