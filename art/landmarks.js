// Dead Signal landmarks: the five things you navigate the city by, seen from
// a long way off across a dark grid. One texel = one world unit (den 1).
// These are silhouettes first: read at the edge of the screen and steered
// toward, so each shape must be unmistakably its own thing at a glance (rule
// 15/39) — the mast a thin vertical lattice, the checkpoint a barrier across
// the road, the hospital a lit canopy, the foundry a fat tapering chimney,
// the ruins a broken diagonal. Ramps are MAT.iron / MAT.rust / MAT.concrete /
// MAT.brick / MAT.glass only; iron's own R/O/Y/W accents cover every warm
// emissive need (lamp, furnace mouth, beacon), glass's L/H cover the cyan
// hospital sign, so nothing outside the five ramps is required. Lights
// themselves are drawn by the engine as a radial corona (render.js/hud.js);
// our job is only to make the emitter — lens, furnace mouth, sign — read on
// its own in tools/frame.mjs, which cannot show glows at all.
(function(){
  'use strict';
  var A=(typeof window!=='undefined'?window:globalThis).DSArt;
  var MAT=A.MAT;

  // ---- grid helpers (art/wrecks.js / art/props.js style: build on a grid, emit rows) ----
  function mkGrid(w,h){var g=[],y,x,row;for(y=0;y<h;y++){row=[];for(x=0;x<w;x++)row.push('.');g.push(row);}return g;}
  function setclip(g,x,y,ch){if(y>=0&&y<g.length&&x>=0&&x<g[0].length)g[y][x]=ch;}
  function rect(g,x0,y0,x1,y1,ch){var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)setclip(g,x,y,ch);}
  function toRows(g){return g.map(function(r){return r.join('');});}
  function pal2(base,extra){return Object.assign({},base,extra);}
  // filled ellipse (radii rx,ry around cx,cy) — dish, rubble mounds
  function disc(g,cx,cy,rx,ry,ch){
    var x,y;
    for(y=-ry;y<=ry;y++)for(x=-rx;x<=rx;x++)if((x*x)/(rx*rx)+(y*y)/(ry*ry)<=1)setclip(g,cx+x,cy+y,ch);
  }
  // box with a 1-texel K perimeter, flat M fill, 1px L edge top+left (toward
  // the light), 1px D edge bottom+right (rule 27/28)
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
  // auto-outline: any cell whose colour is in fillLetters and touches
  // transparent (or the canvas edge) becomes K — for organic/irregular fills
  function outlineFrom(g,fillLetters,K){
    var h=g.length,w=g[0].length,x,y,src=g.map(function(r){return r.slice();});
    function isFill(ch){return fillLetters.indexOf(ch)>=0;}
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      if(!isFill(src[y][x]))continue;
      if(x===0||x===w-1||y===0||y===h-1||src[y][x-1]==='.'||src[y][x+1]==='.'||src[y-1][x]==='.'||src[y+1][x]==='.')g[y][x]=K;
    }
  }
  // a filled trapezoid: width lerps from wTop (at y0) to wBottom (at y1), centred on cx
  function taper(g,cx,y0,y1,wTop,wBottom,ch){
    var y,n=y1-y0;
    for(y=y0;y<=y1;y++){
      var t=n===0?0:(y-y0)/n,wid=Math.max(1,Math.round(wTop+t*(wBottom-wTop))),half=wid/2;
      var x0=Math.round(cx-half),x1=x0+wid-1;
      rect(g,x0,y,x1,y,ch);
    }
  }

  // ---- merged two-material palettes (letters chosen to avoid the base ramp's own keys, rule 23: keep the base ramp's K as the shared shadow) ----
  var SHACK_PAL=pal2(MAT.concrete,{I:MAT.iron.M,J:MAT.iron.D,R:MAT.brick.M});
  var GATE_PAL=pal2(MAT.iron,{S:MAT.concrete.M,T:MAT.concrete.L});
  var HOSP_PAL=pal2(MAT.concrete,{G:MAT.glass.M,F:MAT.glass.L,E:MAT.glass.H,Z:MAT.glass.D});
  var FOUND_PAL=pal2(MAT.iron,{B:MAT.brick.M,C:MAT.brick.D});
  var RUIN_PAL=pal2(MAT.concrete,{B:MAT.brick.M,C:MAT.brick.D,R:MAT.rust.M});

  // =====================================================================
  // mastSection 24x48: one repeating lattice-truss panel. Two iron rails
  // (x3-5, x18-20) joined by horizontal rungs on an exact 16-row period
  // (rows 0/16/32) and diagonal cross-braces between them. Because the
  // whole 48-row block is exactly three periods of 16, three copies stacked
  // (render.js radioMast, step 48) repeat the pattern with no seam: row 47
  // of one copy is immediately followed by row 0 of the next, which is
  // where the period would put a rung anyway.
  // =====================================================================
  function makeMastSection(){
    var w=24,h=48,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',H='H';
    var rL0=3,rL1=5,rR0=18,rR1=20;
    rect(g,rL0,0,rL1,h-1,M);
    rect(g,rR0,0,rR1,h-1,M);
    var ry,band;
    for(ry=0;ry<h;ry+=16)rect(g,rL0,ry,rR1,ry,D);
    for(band=0;band<3;band++){
      var y0=band*16+1,y1=band*16+15,n=y1-y0,i;
      for(i=0;i<=n;i++){
        var t=i/n;
        setclip(g,Math.round(rL1+t*(rR0-rL1)),y0+i,D);
        setclip(g,Math.round(rR0-t*(rR0-rL1)),y0+i,D);
      }
    }
    for(ry=0;ry<h;ry++)if(ry%16!==0){setclip(g,rL0+1,ry,L);setclip(g,rR1-1,ry,D);}
    outlineFrom(g,[M,D,L],K);
    for(ry=0;ry<h;ry+=16){setclip(g,rL0+1,ry,H);setclip(g,rR0+1,ry,H);}
    return toRows(g);
  }

  // =====================================================================
  // mastTop 24x40: the lattice narrows to a platform (an equipment ring)
  // then a thin spike; width at the base matches mastSection exactly (24,
  // rails at the same x3-20 span) so the stack has no step where it lands.
  // The beacon perches at the very tip.
  // =====================================================================
  function makeMastTop(){
    var w=24,h=40,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',H='H';
    var y;
    for(y=h-1;y>=0;y--){
      var width;
      if(y>=h-14){var t=(h-1-y)/13;width=24-Math.round(t*16);}
      else if(y>=8){var t2=(h-15-y)/(h-15-8);width=8-Math.round(t2*5);}
      else width=Math.max(1,3-Math.round((8-y)*0.35));
      var half=width/2,x0=Math.round(w/2-half),x1=x0+width-1;
      rect(g,x0,y,x1,y,M);
    }
    rect(g,4,h-16,19,h-16,D);setclip(g,4,h-16,D);setclip(g,19,h-16,D);
    outlineFrom(g,[M,D],K);
    for(y=h-14;y<h;y++)setclip(g,Math.round(w/2-(24-Math.round(((h-1-y)/13)*16))/2)+1,y,L);
    setclip(g,Math.round(w/2)-1,h-16,H);setclip(g,Math.round(w/2),h-16,H);
    return toRows(g);
  }

  // =====================================================================
  // beacon 12x12, anchor center, 2 frames: [0] dark lens housing, [1] lit —
  // the aircraft-warning light and the brightest thing in the sky. Iron
  // ramp only (K/D/M outline+housing, O/Y/W the emissive core).
  // =====================================================================
  function makeBeaconFrame(lit){
    var w=12,h=12,g=mkGrid(w,h);
    var K='K',D='D',M='M',O='O',Y='Y',W='W';
    disc(g,6,7,4,4,M);
    outlineFrom(g,[M],K);
    rect(g,4,1,7,3,D);setclip(g,4,1,K);setclip(g,7,1,K);setclip(g,4,3,K);setclip(g,7,3,K);
    if(lit){
      setclip(g,5,6,O);setclip(g,6,6,O);setclip(g,5,7,O);setclip(g,6,7,O);
      setclip(g,5,7,W);setclip(g,6,7,Y);
      setclip(g,3,7,Y);setclip(g,8,7,Y);
    }
    return toRows(g);
  }

  // =====================================================================
  // mastBase 48x40, anchor feet, solid: the pedestal directly under the
  // lattice — its top row lines up under mastSection's rail span (x centred
  // 24 wide) and splays out to a 48-wide footing, so it reads as the base
  // the tower is bolted to.
  // =====================================================================
  function makeMastBase(){
    var w=48,h=40,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',R='R';
    taper(g,24,0,32,22,42,M);
    rect(g,2,33,45,39,D);
    outlineFrom(g,[M,D],K);
    var y;
    for(y=1;y<32;y++){setclip(g,12-Math.round(y*0.12),y,L);setclip(g,36+Math.round(y*0.12),y,D);}
    rect(g,3,34,44,34,L);
    setclip(g,9,10,R);setclip(g,10,11,R);setclip(g,8,12,R);
    return toRows(g);
  }

  // =====================================================================
  // shack 88x56, anchor feet, solid: the radio equipment shed east of the
  // mast base. Concrete-block walls (kept desaturated on purpose: saturated
  // red at the Act I objective would pull the eye off the mast), iron-framed
  // door, stepped roof overhang, a couple of small rust-stain accents.
  // =====================================================================
  function makeShack(){
    var w=88,h=56,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',I='I',J='J',R='R';
    bevel(g,4,14,83,53,K,L,M,D);
    rect(g,0,8,87,13,D);rect(g,4,3,83,7,D);
    rect(g,18,0,26,3,M);
    outlineFrom(g,[M,D],K);
    var x;for(x=10;x<58;x+=6)rect(g,x,16,x,52,D);
    rect(g,60,28,73,53,I);setclip(g,60,28,K);setclip(g,73,28,K);setclip(g,60,53,K);setclip(g,73,53,K);
    setclip(g,70,41,J);setclip(g,70,42,J);
    // a couple of small rust-stain accents below the roof line — colour kept to a handful of texels, not the body
    setclip(g,16,15,R);setclip(g,16,16,R);setclip(g,17,17,R);
    setclip(g,50,15,R);setclip(g,50,16,R);
    setclip(g,20,1,K);setclip(g,24,1,K);
    return toRows(g);
  }

  // =====================================================================
  // generator 40x28, anchor feet, solid, carries an amber light (dy default
  // 24). MAT.iron only — its own O/Y/W accents are the lit vent panel, the
  // emitter the engine's corona blooms from.
  // =====================================================================
  function makeGenerator(){
    var w=40,h=28,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',O='O',Y='Y',W='W';
    bevel(g,2,10,37,25,K,L,M,D);
    rect(g,4,25,10,27,D);rect(g,29,25,35,27,D);
    rect(g,6,3,13,10,D);setclip(g,6,3,K);setclip(g,13,3,K);
    setclip(g,9,2,M);setclip(g,10,2,M);
    bevel(g,20,14,33,20,K,Y,O,D);
    setclip(g,26,17,W);setclip(g,27,17,W);
    return toRows(g);
  }

  // =====================================================================
  // generatorRunning 40x28, anchor feet, frames:{down:[a,b]}: the same
  // generator running — exhaust puff drifting up-left, the vent lamp lit
  // brighter, and the whole silhouette shifted 1 texel between frames for
  // an idle-engine vibration. MAT.iron only, matching the static generator.
  // =====================================================================
  function makeGeneratorRunning(phase){
    var w=40,h=28,g=mkGrid(w,h),dx=phase?1:0;
    var K='K',D='D',M='M',L='L',O='O',Y='Y',W='W';
    bevel(g,2+dx,10,37+dx,25,K,L,M,D);
    rect(g,4+dx,25,10+dx,27,D);rect(g,29+dx,25,35+dx,27,D);
    rect(g,6+dx,3,13+dx,10,D);setclip(g,6+dx,3,K);setclip(g,13+dx,3,K);
    setclip(g,9+dx,2,M);setclip(g,10+dx,2,M);
    bevel(g,20+dx,14,33+dx,20,K,Y,O,D);
    setclip(g,26+dx,17,W);setclip(g,27+dx,17,W);
    // exhaust puff off the stack top, drifting between frames
    if(phase){setclip(g,8,1,'M');setclip(g,7,0,'L');setclip(g,9,0,'M');}
    else{setclip(g,9,2,'M');setclip(g,8,1,'M');setclip(g,10,1,'L');}
    return toRows(g);
  }

  // =====================================================================
  // gate 120x44, anchor feet, prop: the checkpoint boom barrier — two iron
  // posts, a raised striped arm across the avenue, concrete Jersey barriers
  // flanking each post.
  // =====================================================================
  function makeGate(){
    var w=120,h=44,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',O='O',S='S',T='T';
    rect(g,6,4,16,43,M);rect(g,104,4,114,43,M);
    rect(g,10,4,112,10,M);
    rect(g,0,33,20,43,S);rect(g,100,33,119,43,S);
    outlineFrom(g,[M,S],K);
    var x;for(x=14;x<108;x+=12)rect(g,x,5,x+5,9,O);
    setclip(g,9,16,L);setclip(g,107,16,L);
    rect(g,2,34,18,34,T);rect(g,102,34,117,34,T);
    return toRows(g);
  }

  // =====================================================================
  // watchtower 52x104, anchor feet, prop, carries a bright amber light at
  // dy:83 (lit window band rows 17-25, centre row 21 -> 104-21 = 83 above
  // the feet): a checkpoint guard tower in 3/4 view. Hip roof in three
  // facets (lit left, corrugated front, shadow right) over an olive-clad
  // cabin with a dark right side plane; a railed iron deck wider than the
  // cabin; knee braces under the deck; four splayed legs (front pair iron
  // mid, back pair set in, darker, standing higher because further away)
  // with two-texel X bracing and girts; a ladder up the right bay to a deck
  // hatch; concrete footing pads under every leg.
  // =====================================================================
  var TOWER_PAL=pal2(MAT.iron,{A:MAT.olive.D,B:MAT.olive.M,C:MAT.olive.L,S:MAT.concrete.M,T:MAT.concrete.L,U:MAT.concrete.D});
  function makeWatchtower(){
    var w=52,h=104,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',H='H',O='O',Y='Y',W='W',A='A',B='B',C='C',S='S',T='T',U='U';
    var y,x;
    function strut(x0,y0,x1,y1,top,bot){ // 2-texel strut: top texel over a shadow texel
      var n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0)),k;
      for(k=0;k<=n;k++){var t=n?k/n:0,px=Math.round(x0+t*(x1-x0)),py=Math.round(y0+t*(y1-y0));setclip(g,px,py,top);setclip(g,px,py+1,bot);}
    }
    function lerpX(x0,x1,y0,y1,yy){return Math.round(x0+(yy-y0)/(y1-y0)*(x1-x0));}

    // --- hip roof + cabin (one mass, outlined together) ---
    for(y=0;y<=10;y++){
      var t=y/10,x0=Math.round(15-t*12),x1=Math.round(36+t*12);
      rect(g,x0,y,x1,y,M);
      rect(g,x0,y,Math.round(15-t*1),y,L);         // lit left facet
      rect(g,Math.round(36+t*1),y,x1,y,D);         // shadow right facet
    }
    rect(g,2,11,49,11,D);                           // eave fascia
    rect(g,7,12,40,33,B);                           // front wall
    rect(g,41,12,45,33,A);                          // right side plane
    for(y=30;y<=33;y++)rect(g,42+(33-y),y,45,y,'.'); // side plane recedes: its foot climbs away
    outlineFrom(g,[M,L,D,A,B],K);
    for(x=18;x<35;x+=4)rect(g,x,3,x,10,D);          // corrugation on the front facet
    rect(g,17,1,26,1,H);rect(g,29,1,33,1,H);                            // ridge catch-light
    rect(g,7,12,40,13,A);                           // shadow under the eave
    rect(g,8,14,8,32,C);                            // lit left corner post
    rect(g,41,12,41,33,K);                          // wall/side corner
    rect(g,43,17,44,23,K);rect(g,44,18,44,22,O);setclip(g,44,18,Y); // side window slit, dimmer
    // window band, the emitter: rows 17-25
    rect(g,10,17,37,25,K);
    rect(g,11,18,36,24,Y);rect(g,11,24,36,24,O);rect(g,11,23,13,23,O);rect(g,20,23,21,23,O);rect(g,33,23,36,23,O);
    rect(g,19,18,19,24,K);rect(g,28,18,28,24,K);
    rect(g,14,19,15,20,W);rect(g,22,19,23,19,W);rect(g,31,19,31,20,W);
    rect(g,7,26,40,26,A);for(x=13;x<40;x+=7)rect(g,x,27,x,33,A); // plank seams

    // --- legs: back pair (dark, set in), front pair (mid, splayed), pads ---
    for(y=42;y<=92;y++){x=lerpX(13,11,42,92,y);rect(g,x,y,x+1,y,D);x=lerpX(37,39,42,92,y);rect(g,x,y,x+1,y,D);}
    rect(g,9,92,15,95,U);rect(g,36,92,42,95,U);
    for(y=42;y<=98;y++){x=lerpX(6,2,42,98,y);rect(g,x,y,x+2,y,M);x=lerpX(43,47,42,98,y);rect(g,x,y,x+2,y,M);}
    rect(g,0,98,8,103,S);rect(g,43,98,51,103,S);
    (function(){ // outline only the legs + pads (below the deck)
      var sub=g.slice(42);outlineFrom(sub,[M,D,S,U],K);
    })();
    for(y=43;y<=97;y++){setclip(g,lerpX(6,2,42,98,y)+1,y,L);setclip(g,lerpX(43,47,42,98,y)+1,y,D);}
    rect(g,1,99,7,99,T);rect(g,44,99,50,99,T);rect(g,10,93,14,93,S);rect(g,37,93,41,93,S);

    // --- girts, X bracing, knee braces (2-texel struts read at x2) ---
    strut(8,47,44,47,L,D);strut(6,71,46,71,L,D);
    strut(9,50,43,69,L,D);strut(43,50,9,69,L,D);
    strut(7,74,45,95,L,D);strut(45,74,6,95,L,D);
    strut(8,54,16,42,M,D);strut(44,54,36,42,M,D);

    // --- deck: K edge, lit top plane, mid lip, dark fascia ---
    rect(g,0,34,51,41,K);
    rect(g,1,35,50,36,L);rect(g,1,37,50,37,M);rect(g,1,38,50,40,D);
    for(x=5;x<50;x+=8)setclip(g,x,39,K);            // joist ends
    rect(g,32,35,37,36,K);                          // hatch over the ladder

    // --- railing over the cabin foot, overhanging the deck ends ---
    rect(g,0,27,0,33,K);rect(g,51,27,51,33,K);
    rect(g,1,27,6,27,K);rect(g,45,27,50,27,K);
    rect(g,1,28,50,28,L);rect(g,1,29,50,29,D);rect(g,1,31,50,31,M);
    [1,12,24,39,50].forEach(function(px){rect(g,px,28,px,33,px===1?L:M);});
    rect(g,2,30,5,30,K);rect(g,46,30,49,30,K);rect(g,2,32,5,33,K);rect(g,46,32,49,33,K);

    // --- ladder: right bay, deck hatch to the ground ---
    for(y=37;y<=101;y++){
      if(y>41)for(x=33;x<=36;x++)g[y][x]='.';
      setclip(g,31,y,K);setclip(g,32,y,L);setclip(g,37,y,M);setclip(g,38,y,K);
    }
    for(y=43;y<=98;y+=5){rect(g,33,y,36,y,L);rect(g,33,y+1,36,y+1,K);}
    rect(g,30,102,39,103,U);rect(g,30,102,39,102,K);
    return toRows(g);
  }

  // =====================================================================
  // dish 36x40, anchor feet, prop, beside the mast: a satellite dish on a
  // short mount, concave shading (rim lit, centre in shadow), a feed arm to
  // a small LNB horn.
  // =====================================================================
  function makeDish(){
    var w=36,h=40,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',H='H';
    rect(g,16,26,19,38,M);
    rect(g,10,36,25,39,D);
    disc(g,18,14,15,12,M);
    disc(g,18,14,11,9,D);
    rect(g,16,3,20,5,M);
    outlineFrom(g,[M,D],K);
    setclip(g,9,8,L);setclip(g,10,8,L);setclip(g,8,9,L);
    rect(g,18,6,18,13,D);setclip(g,18,6,K);setclip(g,18,13,K);
    setclip(g,17,3,H);
    return toRows(g);
  }

  // =====================================================================
  // hospitalEntrance 96x64, anchor feet, prop, carries a cyan light
  // (dy:40): a concrete canopy on two pillars over a mullioned glass
  // double door. The canopy underside sits in shadow — only a small lit
  // sign at its centre is bright, so the cyan sign is the single accent
  // that reads from a distance instead of competing with its own roof.
  // =====================================================================
  function makeHospitalEntrance(){
    var w=96,h=64,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',G='G',F='F',E='E',Z='Z';
    bevel(g,2,2,93,17,K,L,M,D);
    rect(g,4,18,91,25,D);
    rect(g,0,26,95,29,D);
    rect(g,10,29,16,63,M);rect(g,79,29,85,63,M);
    outlineFrom(g,[M,D],K);
    bevel(g,30,34,65,63,K,F,G,Z);
    rect(g,47,34,48,63,K); // vertical mullion, splits the doors in two
    rect(g,30,48,65,49,K); // horizontal mullion, transom line
    setclip(g,38,40,F);setclip(g,56,40,F);setclip(g,38,56,F);setclip(g,56,56,F);
    // the sign: a small bright cyan lens centred on the shadowed canopy underside — the emitter
    rect(g,40,20,55,23,F);setclip(g,40,20,K);setclip(g,55,20,K);setclip(g,40,23,K);setclip(g,55,23,K);
    rect(g,44,21,51,22,E);
    return toRows(g);
  }

  // =====================================================================
  // foundryStack 40x112, 2 variants, anchor feet, prop, carries an amber
  // light at dy:130 (near the chimney mouth): a tapering iron shaft on a
  // brick plinth, soot bands, a lit lip at the very top — the emitter.
  // variant 1 leans the shaft and shifts the soot band phase for a
  // distinct-enough second stack (world.js places both close together).
  // =====================================================================
  function makeFoundryStack(variant){
    var w=40,h=112,g=mkGrid(w,h);
    var K='K',D='D',M='M',O='O',Y='Y',W='W',B='B',C='C';
    var lean=variant===1?3:0;
    var y;
    for(y=20;y<=104;y++){
      var t=(y-20)/84,wid=Math.round(14+t*16),cx=20+Math.round(lean*(1-t)),half=wid/2;
      rect(g,cx-Math.round(half),y,cx-Math.round(half)+wid-1,y,M);
    }
    rect(g,2,104,37,111,B);
    outlineFrom(g,[M,B],K);
    var by,phase=variant===1?7:0;
    for(by=30+phase;by<100;by+=14){var t2=(by-20)/84,cx2=20+Math.round(lean*(1-t2)),wid2=Math.round(14+t2*16);rect(g,cx2-Math.round(wid2/2)+1,by,cx2-Math.round(wid2/2)+wid2-2,by,D);}
    var topCx=20;
    rect(g,topCx-7,20,topCx+6,22,O);
    setclip(g,topCx-1,20,W);setclip(g,topCx,20,W);
    setclip(g,topCx-7,20,K);setclip(g,topCx+6,20,K);
    rect(g,topCx-9,23,topCx+8,24,Y);
    return toRows(g);
  }

  // =====================================================================
  // ruinsCollapse 110x70, anchor feet, prop: a leaning broken slab (the
  // diagonal read), cracked and spalled along one edge so it doesn't read
  // as a flat ramp, over a rubble mound built from concrete chunks. Brick
  // is a scatter of a handful of small chips, never the base material —
  // a mass of brick red at the ground line reads as a blood pool, not
  // debris.
  // =====================================================================
  function makeRuinsCollapse(){
    var w=110,h=70,g=mkGrid(w,h);
    var K='K',D='D',M='M',L='L',B='B',C='C',R='R';
    var y;
    for(y=8;y<48;y++){var shift=Math.round((y-8)*0.85);rect(g,20+shift,y,20+shift+32,y,M);}
    // spall along the slab's lower-left edge (a bite taken out, not a flat ramp)
    rect(g,40,40,52,47,'.');disc(g,46,43,7,5,'.');
    // rubble mound: several overlapping irregular concrete chunks (never one
    // smooth blob, which reads as a puddle)
    disc(g,22,61,15,7,D);disc(g,40,57,13,6,M);disc(g,58,61,15,7,D);
    disc(g,75,58,13,6,M);disc(g,92,61,12,6,D);
    outlineFrom(g,[M,D],K);
    // brick rubble: a handful of small chips scattered through the mound, not a mass
    setclip(g,30,63,B);setclip(g,31,63,B);setclip(g,30,64,C);
    setclip(g,63,62,B);setclip(g,64,63,C);
    setclip(g,85,63,B);setclip(g,86,63,C);
    setclip(g,47,65,B);
    for(y=8;y<48;y++){var shift2=Math.round((y-8)*0.85);setclip(g,20+shift2+1,y,L);}
    // cracks across the slab face
    setclip(g,32,20,K);setclip(g,33,21,K);setclip(g,33,22,K);setclip(g,34,23,K);
    setclip(g,48,30,K);setclip(g,49,31,K);setclip(g,49,32,K);
    setclip(g,40,16,R);setclip(g,40,17,R);setclip(g,41,18,R);
    setclip(g,53,22,R);setclip(g,53,23,R);
    setclip(g,62,30,R);
    setclip(g,28,53,L);setclip(g,58,51,L);setclip(g,84,54,L);
    return toRows(g);
  }

  A.define('landmarks',{
    mastSection:{rows:makeMastSection(),pal:'MAT.iron',anchor:'feet',note:'24x48, one repeating lattice-truss panel on an exact 16-row period; stacked 3x by render.js radioMast() with no seam'},
    mastTop:{rows:makeMastTop(),pal:'MAT.iron',anchor:'feet',note:'24x40, lattice narrows to an equipment ring then a spike; base width matches mastSection'},
    beacon:{frames:{idle:[makeBeaconFrame(false),makeBeaconFrame(true)]},pal:'MAT.iron',anchor:'center',note:'12x12, frame 0 dark lens, frame 1 lit (aircraft-warning amber core)'},
    mastBase:{rows:makeMastBase(),pal:'MAT.iron',anchor:'feet',note:'48x40 solid, pedestal under the lattice, top row centred under the rail span'},
    shack:{rows:makeShack(),pal:SHACK_PAL,anchor:'feet',note:'88x56 solid, concrete equipment shed beside the mast, iron door frame, a couple of small rust-stain accents'},
    generator:{rows:makeGenerator(),pal:'MAT.iron',anchor:'feet',note:'40x28 solid, carries an amber light; lit vent panel is the emitter'},
    generatorRunning:{frames:{down:[makeGeneratorRunning(0),makeGeneratorRunning(1)]},pal:'MAT.iron',anchor:'feet',note:'40x28, the generator running: exhaust puff, lit vent lamp, 1-texel vibration shift between frames'},
    gate:{rows:makeGate(),pal:GATE_PAL,anchor:'feet',note:'120x44 prop, checkpoint boom barrier, iron posts + striped arm, concrete Jersey barriers'},
    watchtower:{rows:makeWatchtower(),pal:TOWER_PAL,anchor:'feet',note:'52x104 prop, carries a bright amber light at dy:83; lit window band (rows 17-25) is the emitter; hip roof, side plane, railed deck, ladder, footings'},
    dish:{rows:makeDish(),pal:'MAT.iron',anchor:'feet',note:'36x40 prop, satellite dish beside the mast, concave shading'},
    hospitalEntrance:{rows:makeHospitalEntrance(),pal:HOSP_PAL,anchor:'feet',note:'96x64 prop, carries a cyan light dy:40; shadowed canopy underside with a small lit cyan sign as the single bright accent, mullioned glass doors'},
    foundryStack:{variants:[makeFoundryStack(0),makeFoundryStack(1)],pal:FOUND_PAL,anchor:'feet',note:'40x112 prop x2, carries an amber light dy:130; lit lip at the chimney mouth is the emitter'},
    ruinsCollapse:{rows:makeRuinsCollapse(),pal:RUIN_PAL,anchor:'feet',note:'110x70 prop, cracked/spalled leaning slab over a concrete rubble mound, brick reduced to a handful of small chips'}
  });
})();
