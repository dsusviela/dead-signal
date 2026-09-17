// Dead Signal quarantine-line hardware: the containment gate that seals a
// district crossing, the bollard posts that stand in an open gate's middle,
// and the Checkpoint Nine south evacuation barrier. One texel = one world
// unit (den 1). MAT.iron only: muted steel, its own Y/W accents cover the
// warning chevrons and status lamp (the same amber already used for street
// lamps and the traffic light, not the brighter gameplay orange/red).
//
// gate_h/gate_v and bollard_h/bollard_v tile the way art/lots.js's fence
// strips do: period-8 marks (seam bolts, hazard stripe) sampled with
// `local coordinate % period` so tile N's far edge and tile N+1's near edge
// are the same phase of the same periodic function. Both variants of a strip
// share the structural marks; only sparse interior fleck differs, and that
// fleck never touches the boundary columns/rows.
(function(){
  'use strict';
  var A=(typeof window!=='undefined'?window:globalThis).DSArt;
  var MAT=A.MAT;

  // ---- grid helpers (art/lots.js style) ----
  function mkGrid(w,h){var g=[],y,x,row;for(y=0;y<h;y++){row=[];for(x=0;x<w;x++)row.push('.');g.push(row);}return g;}
  function setclip(g,x,y,ch){if(y>=0&&y<g.length&&x>=0&&x<g[0].length)g[y][x]=ch;}
  function rect(g,x0,y0,x1,y1,ch){var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)setclip(g,x,y,ch);}
  function toRows(g){return g.map(function(r){return r.join('');});}
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
  // periodic diagonal hazard stripe, tiles both axes at period
  function hazardStripe(g,x0,y0,x1,y1,period,A_,B_){
    var x,y;
    for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)setclip(g,x,y,pmod(x+y,period)<period/2?A_:B_);
  }

  // =====================================================================
  // gate_h 32x20 / gate_v 12x32: closed steel containment gate panel, hazard
  // chevron band, period-8 seam bolts shared by both variants; interior
  // fleck differs.
  // =====================================================================
  function makeGateH(variant){
    var w=32,h=20,g=mkGrid(w,h),rng=mulberry32(variant===0?401:402),x;
    bevel(g,0,0,31,15,'K','L','M','D');
    for(x=8;x<32;x+=8)rect(g,x,1,x,14,'K');
    hazardStripe(g,0,16,31,18,8,'Y','K');
    rect(g,0,19,31,19,'D');
    for(x=2;x<30;x++)if(rng()<0.08)setclip(g,x,3+Math.floor(rng()*10),'D');
    return toRows(g);
  }
  function makeGateV(variant){
    var w=12,h=32,g=mkGrid(w,h),rng=mulberry32(variant===0?403:404),y;
    bevel(g,3,0,11,31,'K','L','M','D');
    for(y=8;y<32;y+=8)rect(g,4,y,11,y,'K');
    hazardStripe(g,0,0,2,31,8,'Y','K');
    rect(g,3,0,3,31,'K');rect(g,2,0,2,31,'K');
    for(y=2;y<30;y++)if(rng()<0.08)setclip(g,5+Math.floor(rng()*5),y,'D');
    return toRows(g);
  }

  // =====================================================================
  // bollard_h 20x16 / bollard_v 16x20: single steel bollard/post that stands
  // in an open gate's middle; margins on every side so drawStrip's repeat
  // reads as spaced posts, not a solid wall.
  // =====================================================================
  function makeBollardH(variant){
    var w=20,h=16,g=mkGrid(w,h);
    bevel(g,6,0,13,15,'K','L','M','D');
    setclip(g,8,2,'H');setclip(g,9,2,'H');
    if(variant===1)setclip(g,10,10,'D');
    return toRows(g);
  }
  function makeBollardV(variant){
    var w=16,h=20,g=mkGrid(w,h);
    bevel(g,4,4,11,19,'K','L','M','D');
    setclip(g,6,6,'H');setclip(g,7,6,'H');
    if(variant===1)setclip(g,8,14,'D');
    return toRows(g);
  }

  // =====================================================================
  // evacBarrier 180x40, anchor feet, frames:{down:[closed,open]}: the
  // Checkpoint Nine south evacuation barrier across a 170-wide avenue —
  // two steel posts, a dark control box with a lit indicator, and the boom:
  // closed = swung across the avenue, open = raised alongside the left post.
  // =====================================================================
  function makeEvacBarrier(open){
    var w=180,h=40,g=mkGrid(w,h);
    bevel(g,4,2,18,39,'K','L','M','D');
    bevel(g,162,2,176,39,'K','L','M','D');
    setclip(g,8,4,'H');setclip(g,168,4,'H');
    bevel(g,20,22,46,38,'K','L','M','D');
    disc(g,33,29,2,2,'K');disc(g,33,29,1,1,'Y');setclip(g,33,29,'W');
    if(open){
      rect(g,18,3,22,19,'M');
      outlineFrom(g,['M'],'K');
      hazardStripe(g,18,3,22,19,8,'Y','K');
    }else{
      rect(g,18,16,162,20,'M');
      outlineFrom(g,['M'],'K');
      hazardStripe(g,18,16,162,20,8,'Y','K');
    }
    return toRows(g);
  }

  A.define('quarantine',{
    gate_h:{variants:[makeGateH(0),makeGateH(1)],pal:'MAT.iron',anchor:{x:0,y:1},note:'32x20 closed steel containment gate panel, hazard chevron band, period-8 seam bolts; tiles left-right'},
    gate_v:{variants:[makeGateV(0),makeGateV(1)],pal:'MAT.iron',anchor:{x:.5,y:0},note:'12x32 closed steel containment gate panel, hazard band down one edge, period-8 seam bolts; tiles top-bottom'},
    bollard_h:{variants:[makeBollardH(0),makeBollardH(1)],pal:'MAT.iron',anchor:{x:0,y:1},note:'20x16 single steel bollard post, margins for spaced repeats; tiles left-right'},
    bollard_v:{variants:[makeBollardV(0),makeBollardV(1)],pal:'MAT.iron',anchor:{x:.5,y:0},note:'16x20 single steel bollard post, margins for spaced repeats; tiles top-bottom'},
    evacBarrier:{frames:{down:[makeEvacBarrier(false),makeEvacBarrier(true)]},pal:'MAT.iron',anchor:'feet',note:'180x40, Checkpoint Nine evacuation barrier, frame 0 closed boom / 1 raised open, dark control box with a lit amber indicator'}
  });
})();
