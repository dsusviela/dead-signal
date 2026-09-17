// Dead Signal Ashworks industrial scene modules (family 'industrial', world.js
// calls under 'industrial/<name>'). One texel = one world unit (den 1). Night
// city, day 9 of a quarantine: the plant was abandoned mid-process -- ash
// still on the belts, a shutter jammed half-up, a skip of clinker that is
// only warm near the furnace. Muted galvanised/painted steel, no overgrowth,
// no ancient decay: rust is limited to fastener streaks and cut edges.
//
// Layers (see the note on every spec):
//   ROOF     anchor tile, drawn over a building footprint like buildings/roofFillBig
//   FACADE   anchor tile, drawn inside the building's street edge like buildings/sealedFacade_*
//            (_h = south face: roof flashing on row 0, street/ground on the last row;
//             _v = east face: flashing on column 0, street on the last column)
//   OVERHEAD anchor tile/center, NON-colliding, drawn above actors (pipes, gantry)
//   SOLID    anchor center/feet, y-sorted with actors, collides (supports, conveyor, yard clusters)
//   FLAT     ground decal under actors (dock apron, ash spill)
//
// Tiling: every *_h strip is 32 (or a multiple) wide on its run, every *_v strip
// 32 (or a multiple) tall. Periodic texture is sampled as `run % period` with a
// period dividing 32, so neighbouring tiles meet on the same phase. Variants only
// change interior detail that never touches the two boundary columns/rows.
// _v strips are built from the same (run u, depth t) painters as _h strips, so a
// light that falls top-left on _h falls top-left on _v too.
(function(){
  'use strict';
  var A=(typeof window!=='undefined'?window:globalThis).DSArt;
  var MAT=A.MAT;

  // ---- grid helpers ----
  function mkGrid(w,h){var g=[],y,x,row;for(y=0;y<h;y++){row=[];for(x=0;x<w;x++)row.push('.');g.push(row);}return g;}
  function setclip(g,x,y,ch){if(y>=0&&y<g.length&&x>=0&&x<g[0].length)g[y][x]=ch;}
  function get(g,x,y){return(y>=0&&y<g.length&&x>=0&&x<g[0].length)?g[y][x]:'.';}
  function rect(g,x0,y0,x1,y1,ch){var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)setclip(g,x,y,ch);}
  function toRows(g){return g.map(function(r){return r.join('');});}
  function pal2(base,extra){return Object.assign({},base,extra);}
  function pmod(n,p){return((n%p)+p)%p;}
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function transpose(g){var h=g.length,w=g[0].length,o=mkGrid(h,w),x,y;for(y=0;y<h;y++)for(x=0;x<w;x++)o[x][y]=g[y][x];return o;}
  // bevelled box: K outline, light top+left, dark bottom+right (rule 27/28)
  function bevel(g,x0,y0,x1,y1,K,L,M,D){
    rect(g,x0,y0,x1,y1,M);
    if(x1-x0>=2&&y1-y0>=2){rect(g,x0+1,y0+1,x1-1,y0+1,L);rect(g,x0+1,y0+1,x0+1,y1-1,L);rect(g,x0+1,y1-1,x1-1,y1-1,D);rect(g,x1-1,y0+1,x1-1,y1-1,D);}
    rect(g,x0,y0,x1,y0,K);rect(g,x0,y1,x1,y1,K);rect(g,x0,y0,x0,y1,K);rect(g,x1,y0,x1,y1,K);
  }
  function disc(g,cx,cy,rx,ry,ch){var x,y;for(y=-ry;y<=ry;y++)for(x=-rx;x<=rx;x++)if((x*x)/((rx+.4)*(rx+.4))+(y*y)/((ry+.4)*(ry+.4))<=1)setclip(g,cx+x,cy+y,ch);}
  function outlineFrom(g,K){
    var h=g.length,w=g[0].length,x,y,src=g.map(function(r){return r.slice();});
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      if(src[y][x]==='.'||src[y][x]===K)continue;
      if(x===0||y===0||x===w-1||y===h-1||src[y][x-1]==='.'||src[y][x+1]==='.'||src[y-1][x]==='.'||src[y+1][x]==='.')g[y][x]=K;
    }
  }
  function line(g,x0,y0,x1,y1,ch){var dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,e=dx+dy,e2;for(;;){setclip(g,x0,y0,ch);if(x0===x1&&y0===y1)break;e2=2*e;if(e2>=dy){e+=dy;x0+=sx;}if(e2<=dx){e+=dx;y0+=sy;}}}
  // a strip painted in (u along the run, t across it); horizontal maps u->x, vertical u->y
  function strip(runLen,depth,vertical){
    var g=vertical?mkGrid(depth,runLen):mkGrid(runLen,depth);
    return {g:g,put:function(u,t,ch){if(vertical)setclip(g,t,u,ch);else setclip(g,u,t,ch);},
      box:function(u0,t0,u1,t1,ch){var u,t;for(t=t0;t<=t1;t++)for(u=u0;u<=u1;u++)this.put(u,t,ch);},
      at:function(u,t){return vertical?get(g,t,u):get(g,u,t);}};
  }

  // ---- palettes (ramps from npm run art:ramp, never hand-picked) ----
  var CLAD={K:'#080e12',D:'#1a2a31',M:'#32494f',L:'#54696b',H:'#7d8988'}; // painted cladding: art:ramp -- --hue 215 --l 0.16,0.62 --chroma 0.03
  var ASH={K:'#0b0907',D:'#2a2621',M:'#4b4741',L:'#6e6c65',H:'#93928f'};  // cold ash/clinker: art:ramp -- --hue 80 --l 0.14,0.66 --chroma 0.012
  // Ashworks signature materials (city_v2.md: rust orange #a86943). Each process
  // system gets its own material so it separates from the blue-grey roofs and ground:
  var OXIDE={K:'#1e0c07',D:'#4b2415',M:'#74452c',L:'#966d52',H:'#ae9a89'};  // oxidised pipework: art:ramp -- --hue 48 --l 0.18,0.7 --chroma 0.075 --shift 14
  var OCHRE={K:'#1f0c00',D:'#492f06',M:'#785716',L:'#a18644',H:'#c1b796'};  // worn safety paint (crane, hazard): art:ramp -- --hue 80 --l 0.18,0.78 --chroma 0.105 --shift 14
  var PAINT={K:'#130b0a',D:'#36241f',M:'#584238',L:'#776558',H:'#938b82'};  // faded oxide-red wall cladding: art:ramp -- --hue 45 --l 0.16,0.64 --chroma 0.035
  var BELT={K:'#181515',D:'#383330',M:'#5a5450',L:'#7c7873',H:'#a09e9b'};   // rubber belt grey: art:ramp -- --hue 60 --l 0.2,0.7 --chroma 0.01
  var HAZ=OCHRE.M; // faded hazard amber
  var I=MAT.iron,C=MAT.concrete,G=MAT.glass,R=MAT.rust,E=MAT.ember,W=MAT.wood,AS=MAT.asphalt;
  // Overhead pieces take tint 'shadow': the same rows as one flat dark colour, so the
  // renderer can drop an offset ground shadow under actors (see the OVERHEAD note).
  var SHADOW_HEX='#04080b';
  function overheadPal(p){var s={},k;for(k in p)s[k]=SHADOW_HEX;return function(t){return t==='shadow'?s:p;};}
  var ROOF_PAL=pal2(AS,{G:G.K,g:G.D,s:G.M,R:OXIDE.M,r:OXIDE.L});
  var FLASH={A:AS.H,a:AS.L,b:AS.D}; // galvanised flashing letters, K shared
  var WALL_PAL=pal2(PAINT,pal2(FLASH,{C:C.M,c:C.L,d:C.D,R:R.M,r:R.L}));
  var DOOR_PAL=pal2(PAINT,pal2(FLASH,{I:I.M,J:I.D,N:I.L,C:C.M,c:C.L,d:C.D,Y:OCHRE.L,B:W.D,b:W.M}));
  var DOCK_PAL=pal2(C,{I:I.M,J:I.D,N:I.L,S:I.H,Y:OCHRE.M,y:OCHRE.L,B:BELT.K,b:BELT.D,t:BELT.M});
  var SHOP_PAL=pal2(C,{I:I.M,J:I.D,N:I.L,G:G.K,g:G.D,s:G.M,Y:HAZ,B:W.D,b:W.M,k:CLAD.K,d:C.K});
  var OFFICE_PAL=pal2(CLAD,{C:C.M,c:C.L,d:C.D,e:C.H,G:G.K,g:G.D,s:G.M,P:ASH.H,Y:HAZ});
  var PIPE_BASE={K:OXIDE.K,D:OXIDE.D,M:OXIDE.M,L:OXIDE.L,H:OXIDE.H,j:I.D,i:I.M,n:I.L,S:I.H};
  var PIPE_PAL=overheadPal(PIPE_BASE);
  var BENT_PAL=pal2(PIPE_BASE,{C:C.M,c:C.L,d:C.D,e:C.K,Y:OCHRE.L,y:OCHRE.M});
  var CONV_PAL={K:I.K,D:I.D,M:I.M,L:I.L,H:I.H,B:BELT.M,b:BELT.L,n:BELT.D,a:ASH.H,s:ASH.L,Y:OCHRE.L,y:OCHRE.M};
  var HOPPER_PAL={K:I.K,D:I.D,M:I.M,L:I.L,H:I.H,a:ASH.M,s:ASH.L,d:ASH.D,Y:OCHRE.L};
  var GANTRY_BASE={K:OCHRE.K,D:OCHRE.D,M:OCHRE.M,L:OCHRE.L,H:OCHRE.H,k:I.K,j:I.D,i:I.M,n:I.L,s:I.H,C:C.M,c:C.L,d:C.D,e:C.K};
  var GANTRY_PAL=overheadPal(GANTRY_BASE);
  var PIER_PAL=GANTRY_BASE;
  var SCRAP_PAL={K:CLAD.K,R:R.M,r:R.L,q:R.D,I:I.M,N:I.L,J:I.D,S:I.H,O:OCHRE.M,o:OCHRE.L,p:OCHRE.D,P:PAINT.M,Q:PAINT.L,x:PAINT.D,a:ASH.L,X:OXIDE.M,Z:OXIDE.L,z:OXIDE.D};
  var PALLET_PAL=pal2(W,{s:ASH.L,S:ASH.H,a:ASH.M,I:I.M,J:I.D,N:I.L,k:I.K,Y:OCHRE.L});
  var SKIP_PAL={K:OCHRE.K,D:OCHRE.D,M:OCHRE.M,L:OCHRE.L,H:OCHRE.H,a:ASH.M,s:ASH.L,S:ASH.H,d:ASH.D,Y:OCHRE.H,k:CLAD.K};
  var SKIPWARM_PAL=pal2(SKIP_PAL,{e:E.D,o:E.M,O:E.L});
  var DRUM_PAL=pal2(CLAD,{i:I.M,n:I.L,s:I.H,R:R.M,r:R.L,B:MAT.basalt.K,b:MAT.basalt.D,Y:OCHRE.L});
  var SPILL_PAL={K:ASH.K,D:ASH.D,M:ASH.M,L:ASH.L};
  var STACK_PAL={K:C.K,D:C.D,M:C.M,L:C.L,H:C.H,J:I.D,e:E.K,o:E.D,O:E.M};

  // =====================================================================
  // ROOFS
  // =====================================================================
  // sawtoothRoof 32x32: one tooth per 32 rows. Row 0 ridge cap, rows 1-5 the
  // north-light glazing face (in shade), row 6 gutter, rows 7-31 the sheet
  // slope rising back to the next ridge (dark at the gutter, light at the top).
  var RAMP='KDMLH';
  function stepL(ch,d){var i=RAMP.indexOf(ch);return i<0?ch:RAMP[Math.max(0,Math.min(4,i+d))];}
  function sawtoothCore(variant){
    var g=mkGrid(32,32),x,y,base,rib;
    for(y=0;y<32;y++)for(x=0;x<32;x++){
      rib=pmod(x,4);
      if(y===0)base='H';                                   // ridge cap catching the light
      else if(y===1)base='K';
      else if(y<=4)base=pmod(x,8)===4&&y>2?'D':(y===2?'s':'g'); // north-light glazing face, in shade
      else if(y===5)base='D';                              // glazing sill
      else if(y===6)base='K';                              // gutter
      else{
        // sheet slope: cast shadow of the glazing face at the gutter, brightening to the ridge
        if(y<=8)base='K';
        else if(y<=15)base='D';
        else if(y<=23)base='M';
        else base='L';
        if(y===9||y===16||y===24){if(rib===0||rib===3)base=stepL(base,-1);} // soft band edges, broken by the ribs
        if(rib===3&&y>=16)base=stepL(base,-1);
        if(y===30||y===31)base=rib===3?'M':'L';
      }
      g[y][x]=base;
    }
    if(variant===1){ // two cracked panes and a short rust run from the gutter strap
      setclip(g,11,3,'G');setclip(g,12,3,'G');setclip(g,12,4,'G');
      setclip(g,26,2,'G');setclip(g,26,3,'G');
      rect(g,20,6,21,6,'r');rect(g,20,7,21,8,'R');setclip(g,21,9,'R');setclip(g,21,10,'R');setclip(g,20,11,'R');
    }
    if(variant===2){ // two fastener rust streaks down the slope
      [[6,7,7],[18,11,5]].forEach(function(p){var t;setclip(g,p[0],p[1],'r');setclip(g,p[0]+1,p[1],'r');
        for(t=1;t<p[2];t++){setclip(g,p[0],p[1]+t,'R');if(t<3)setclip(g,p[0]+1,p[1]+t,'R');}});
    }
    return g;
  }
  function makeSawtoothH(v){return toRows(sawtoothCore(v));}
  function makeSawtoothV(v){return toRows(transpose(sawtoothCore(v)));}

  // monitorRoof_h 32x48: raised monitor spine running along x with clerestory
  // glazing on both sides, sheet slopes above and below that continue metalRoof.
  function monitorCore(variant){
    var g=mkGrid(32,48),x,y,ch,rib;
    for(y=0;y<48;y++)for(x=0;x<32;x++){
      rib=pmod(x,4);
      if(y<=11){ch=y<4?'D':'M';if(rib===3)ch='D';else if(pmod(x,8)===1&&y>=4)ch='L';}
      else if(y===12||y===16||y===30||y===35)ch='K';
      else if(y>=13&&y<=15)ch=pmod(x,8)===0?'D':(y===13?'s':'g');
      else if(y===17)ch='H';
      else if(y>=18&&y<=22)ch=y===18?'L':(pmod(x,8)===4?'D':'M');
      else if(y===23)ch='H';
      else if(y>=24&&y<=28)ch=pmod(x,8)===4?'K':'D';
      else if(y===29)ch='D';
      else if(y>=31&&y<=34)ch=pmod(x,8)===0?'K':'G';
      else{ch=y<39?'D':'M';if(rib===3)ch=ch==='M'?'D':'K';else if(pmod(x,8)===1&&y>=39)ch='L';}
      g[y][x]=ch;
    }
    for(x=4;x<32;x+=16){setclip(g,x,20,'L');setclip(g,x,26,'M');}
    if(variant===1){setclip(g,18,14,'G');setclip(g,19,14,'G');setclip(g,19,15,'G');setclip(g,6,33,'g');setclip(g,7,32,'G');
      setclip(g,25,37,'R');setclip(g,25,38,'r');setclip(g,25,39,'R');setclip(g,25,40,'R');setclip(g,26,40,'R');}
    return g;
  }
  function makeMonitorH(v){return toRows(monitorCore(v));}
  function makeMonitorV(v){return toRows(transpose(monitorCore(v)));}

  // metalRoof 32x32: corrugated sheet field (ribs along y), sheet lap at row 0.
  function metalRoofCore(variant){
    var g=mkGrid(32,32),x,y,ch,rib;
    for(y=0;y<32;y++)for(x=0;x<32;x++){
      rib=pmod(x,4);ch=rib===3?'D':(pmod(x,8)===1?'L':'M');
      if(y===0)ch='D';
      g[y][x]=ch;
    }
    for(x=5;x<32;x+=8)setclip(g,x,1,'L');
    if(variant===1){ // translucent roof light panel, grimed
      for(y=6;y<=21;y++)for(x=9;x<=18;x++)g[y][x]=pmod(x,4)===3?'M':'L';
      rect(g,9,6,18,6,'D');rect(g,9,21,18,21,'D');
      setclip(g,13,12,'M');setclip(g,14,13,'M');
    }
    if(variant===2){ // short rust run from a fastener, patch plate
      setclip(g,17,1,'R');setclip(g,17,2,'r');setclip(g,17,3,'R');setclip(g,17,4,'R');setclip(g,18,5,'R');setclip(g,17,6,'R');
      rect(g,5,18,12,24,'M');rect(g,5,18,12,18,'L');rect(g,5,18,5,24,'L');rect(g,5,24,12,24,'K');rect(g,12,18,12,24,'K');
      setclip(g,7,20,'H');setclip(g,10,22,'H');
    }
    return g;
  }
  function makeMetalRoofH(v){return toRows(metalRoofCore(v));}
  function makeMetalRoofV(v){return toRows(transpose(metalRoofCore(v)));}

  // stackTop 28x28: short roof flue stack (top view) on its base plate. The
  // bore still holds residual furnace heat -- the only warm spot in the plant.
  function makeStackTop(){
    var g=mkGrid(28,28);
    disc(g,14,14,12,12,'M');
    disc(g,14,14,10,10,'L');
    disc(g,15,15,10,10,'M');
    disc(g,14,14,8,8,'D');
    disc(g,14,14,6,6,'K');
    disc(g,15,15,4,4,'e');
    disc(g,15,15,2,2,'o');
    setclip(g,15,15,'O');setclip(g,16,16,'O');
    outlineFrom(g,'K');
    // bolts on the collar
    [[14,3],[3,14],[25,14],[14,25]].forEach(function(p){setclip(g,p[0],p[1],'H');});
    return toRows(g);
  }

  // =====================================================================
  // FACADES -- bands across the depth t: flashing, body, plinth, ground.
  // _h depth 20: flashing 0-3, body 4-16, plinth 17-18, ground 19
  // _v depth 12: flashing 0-2, body 3-9,  plinth 10,    ground 11
  // =====================================================================
  function bands(vertical){return vertical?{f0:0,f1:2,b0:3,b1:9,p0:10,p1:10,gr:11,depth:12}:{f0:0,f1:3,b0:4,b1:16,p0:17,p1:18,gr:19,depth:20};}
  var GALV=['K','A','a','b'];
  function flashing(s,B,u0,u1,Lt){
    var u,F=Lt||['K','H','L','D'];for(u=u0;u<=u1;u++){
      s.put(u,B.f0,F[0]);s.put(u,B.f0+1,F[1]);
      if(B.f1-B.f0>=3)s.put(u,B.f0+2,F[2]);
      s.put(u,B.f1,F[3]);
      if(pmod(u,8)===6)s.put(u,B.f0+1,F[2]); // flashing joints
    }
  }
  function plinth(s,B,u0,u1,top,body){
    var u,t;for(u=u0;u<=u1;u++){
      for(t=B.p0;t<=B.p1;t++)s.put(u,t,t===B.p0&&B.p1>B.p0?top:body);
      if(pmod(u,16)===0&&B.p1>B.p0)s.put(u,B.p1,'d');
      s.put(u,B.gr,'K');
    }
  }
  function corrugated(s,B,u0,u1){
    var u,t,rib;for(u=u0;u<=u1;u++)for(t=B.b0;t<=B.b1;t++){rib=pmod(u,4);s.put(u,t,rib===1?'L':(rib===3?'D':'M'));}
    for(u=u0;u<=u1;u++){if(pmod(u,8)===1){s.put(u,B.b0+1,'H');s.put(u,B.b1-1,'H');}s.put(u,B.b1,pmod(u,4)===1?'M':'D');}
  }
  function wallCore(vertical,variant){
    var B=bands(vertical),s=strip(32,B.depth,vertical);
    flashing(s,B,0,31,GALV);corrugated(s,B,0,31);plinth(s,B,0,31,'c','C');
    if(variant===1){ // rust streak from a fastener and a forklift dent near the plinth
      var t;for(t=B.b0+2;t<=B.b1-1;t++){s.put(17,t,t<B.b0+4?'r':'R');}
      s.put(18,B.b0+2,'R');
      s.put(6,B.b1-1,'K');s.put(7,B.b1-1,'D');s.put(5,B.b1-1,'D');s.put(6,B.b1-2,'D');
    }
    return toRows(s.g);
  }

  // loadingDoor 64 run: steel guide posts with hazard wrap, roller housing,
  // ribbed shutter. [0] shut, [1] jammed half-up, dark bay with a pallet edge.
  function loadingDoorCore(vertical,variant){
    var B=bands(vertical),s=strip(64,B.depth,vertical),u,t;
    flashing(s,B,0,63,GALV);
    corrugated(s,B,0,5);corrugated(s,B,58,63);
    plinth(s,B,0,63,'c','C');
    // guide posts
    [[6,9],[54,57]].forEach(function(p){
      for(t=B.b0;t<=B.gr;t++){s.put(p[0],t,'K');s.put(p[0]+1,t,'N');s.put(p[0]+2,t,'I');s.put(p[1],t,'K');}
      for(t=B.b1-3;t<=B.p1;t++){if(pmod(t,2)===0){s.put(p[0]+1,t,'Y');s.put(p[0]+2,t,'Y');}}
    });
    // roller housing across the head
    for(u=10;u<=53;u++){s.put(u,B.b0,'N');s.put(u,B.b0+1,vertical?'J':'I');if(!vertical)s.put(u,B.b0+2,'J');}
    var s0=B.b0+(vertical?2:3),bottom=variant===1?(vertical?B.b0+4:B.b0+8):B.p1;
    for(u=10;u<=53;u++){
      for(t=s0;t<=bottom;t++)s.put(u,t,pmod(t-s0,3)===0?'N':(pmod(t-s0,3)===1?'I':'J'));
      s.put(u,bottom,'K');
      if(variant===1)for(t=bottom+1;t<=B.gr;t++)s.put(u,t,t===B.gr?'d':'K');
      else s.put(u,B.gr,'K');
    }
    // shutter lock hasp in the middle
    s.put(31,bottom-1,'H');s.put(32,bottom-1,'H');
    if(variant===1){ // pallet edge under the jammed shutter, and scuffed sill
      var p0=bottom+1;
      for(u=22;u<=33;u++){if(p0<=B.gr-1)s.put(u,B.gr-1,pmod(u,3)===0?'B':'b');}
      if(!vertical)for(u=24;u<=31;u++)s.put(u,B.gr-2,pmod(u,4)===0?'B':'K');
      s.put(40,B.gr,'c');s.put(41,B.gr,'c');
    }
    // steel lintel breaks the galvanised flashing over the opening, and the
    // jambs throw a dark reveal so the door reads as a break in the wall line
    for(u=5;u<=58;u++){s.put(u,B.f0+1,u===5||u===58?'K':'N');if(B.f1-B.f0>=3)s.put(u,B.f0+2,'I');}
    for(t=B.f0;t<=B.gr;t++){s.put(5,t,'K');s.put(58,t,'K');if(vertical){s.put(4,t,'b');s.put(59,t,'b');}}
    if(vertical)for(t=B.b0;t<=B.gr;t++){s.put(10,t,'K');s.put(11,t,'J');s.put(53,t,'K');}
    return toRows(s.g);
  }

  // workshopFront 48 run: block-wall front, roller door 26, wired window, steel door.
  function workshopCore(vertical,variant){
    var B=bands(vertical),s=strip(48,B.depth,vertical),u,t;
    flashing(s,B,0,47);
    for(u=0;u<=47;u++)for(t=B.b0;t<=B.b1;t++){
      var course=pmod(t-B.b0,vertical?2:3),off=pmod(t-B.b0,vertical?4:6)<(vertical?2:3)?0:4;
      s.put(u,t,course===0?'D':(pmod(u+off,8)===0?'D':'M'));
    }
    plinth(s,B,0,47,'L','D');
    // roller door
    var bottom=variant===1?B.b0+(vertical?3:6):B.p1;
    for(t=B.b0;t<=B.gr;t++){s.put(2,t,'K');s.put(29,t,'K');s.put(3,t,'N');}
    for(u=3;u<=28;u++){s.put(u,B.b0,'J');}
    for(u=4;u<=28;u++){
      for(t=B.b0+1;t<=bottom;t++)s.put(u,t,pmod(t-B.b0,2)===1?'N':'I');
      s.put(u,bottom,'J');
      for(t=bottom+1;t<=B.gr;t++)s.put(u,t,t===B.gr?'d':'k');
    }
    if(variant===1){ // workbench leg and a dropped rag visible in the dark bay
      s.put(9,B.gr-1,'B');s.put(9,B.gr-2,'B');s.put(20,B.gr-1,'b');s.put(21,B.gr-1,'b');s.put(22,B.gr-2,'b');
    }else{s.put(15,bottom-1,'H');s.put(16,bottom-1,'H');}
    // wired glass window
    var w0=B.b0+1,w1=vertical?B.b0+3:B.b0+6;
    for(u=31;u<=38;u++)for(t=w0;t<=w1;t++){
      var edge=u===31||u===38||t===w0||t===w1;
      s.put(u,t,edge?'K':(pmod(u+t,3)===0?'s':'g'));
    }
    s.put(34,w1+1,'L');s.put(35,w1+1,'L');s.put(36,w1+1,'L'); // sill
    if(variant===1){s.put(33,w0+1,'G');s.put(34,w0+1,'G');s.put(34,w0+2,'G');}
    // steel personnel door
    for(t=B.b0;t<=B.gr;t++){s.put(40,t,'K');s.put(46,t,'K');}
    for(u=41;u<=45;u++){s.put(u,B.b0,'K');for(t=B.b0+1;t<=B.p1;t++)s.put(u,t,u===41?'L':'I');s.put(u,B.gr,'K');}
    s.put(44,vertical?B.b0+4:B.b0+8,'H');
    return toRows(s.g);
  }

  // officeFront 48 run: dispatch/maintenance office. Rendered panel wall, long
  // window with half-drawn blinds, glazed door; [1] a cracked pane and a shift
  // board still taped inside the glass.
  function officeCore(vertical,variant){
    var B=bands(vertical),s=strip(48,B.depth,vertical),u,t;
    flashing(s,B,0,47);
    for(u=0;u<=47;u++)for(t=B.b0;t<=B.b1;t++)s.put(u,t,pmod(u,16)===0?'d':'C');
    for(u=0;u<=47;u++)s.put(u,B.b0,'c');
    plinth(s,B,0,47,'L','D');
    var w0=B.b0+1,w1=vertical?B.b0+5:B.b1-3,blind=vertical?B.b0+2:B.b0+4;
    for(u=2;u<=29;u++)for(t=w0;t<=w1;t++){
      var edge=u===2||u===29||t===w0||t===w1||u===11||u===20;
      var ch=edge?'K':(t<=blind?(pmod(t,2)===0?'c':'d'):(pmod(u-t,5)===0?'s':'g'));
      s.put(u,t,ch);
    }
    for(u=3;u<=28;u++)s.put(u,w1+1,'L'); // sill
    if(variant===1){
      // shift board taped to the glass and a crack across the middle pane
      for(u=14;u<=17;u++)for(t=blind+1;t<=Math.min(w1-1,blind+(vertical?1:3));t++)s.put(u,t,'P');
      s.put(22,blind+1,'G');s.put(23,blind+2,'G');s.put(24,blind+2,'s');s.put(25,Math.min(w1-1,blind+3),'G');
    }else{
      s.put(6,blind+1,'s');s.put(24,blind+1,'s');
    }
    // glazed door with a kick plate and a hazard-taped step
    for(t=B.b0;t<=B.gr;t++){s.put(34,t,'K');s.put(42,t,'K');}
    for(u=35;u<=41;u++){
      s.put(u,B.b0,'K');
      for(t=B.b0+1;t<=B.p1;t++)s.put(u,t,t<=w1?(u===35?'s':'g'):(u===35?'L':'M'));
      s.put(u,B.gr,pmod(u,2)===0?'Y':'K');
    }
    s.put(40,vertical?B.b0+5:B.b0+9,'H');
    // key box / call panel beside the door
    for(u=44;u<=46;u++)for(t=B.b0+2;t<=B.b0+(vertical?4:6);t++)s.put(u,t,u===44?'L':'D');
    return toRows(s.g);
  }

  // =====================================================================
  // LOADING DOCK APRON (flat, ground level, fully walkable): concrete apron in
  // front of a loading door with a steel diamond-tread leveller plate, a painted
  // hazard lip, lane lines and two small rubber bumpers against the wall.
  // _h sits directly south of a loadingDoor_h (its top row touches the door's ground row).
  // =====================================================================
  function dockCore(vertical){
    var s=strip(64,24,vertical),u,t,rng=mulberry32(333);
    for(u=0;u<=63;u++)for(t=0;t<=23;t++){
      var ch='M';
      if(t===0)ch='D';
      else if(pmod(u,32)===0||t===12)ch='D';            // saw joints
      else if(pmod(u,32)===1||t===13)ch='L';
      if((u>=19&&u<=21||u>=42&&u<=44)&&t>=16&&rng()<.45)ch='D'; // tyre wear out of the door
      if(t===23&&rng()<.5)ch='D';
      s.put(u,t,ch);
    }
    // painted lane lines either side of the truck lane
    for(t=1;t<=23;t++)if(pmod(t,6)<4){s.put(3,t,'Y');s.put(60,t,'Y');}
    // leveller plate: diamond tread lugs lit top-left
    for(u=16;u<=47;u++)for(t=1;t<=13;t++){
      var e=u===16||u===47||t===13;
      var lug=pmod(t,2)===1&&pmod(u+(pmod(t,4)===1?0:2),4)===0;
      var sh=pmod(t,2)===0&&pmod(u-1+(pmod(t-1,4)===1?0:2),4)===0;
      s.put(u,t,e?'K':(lug?'S':(sh?'J':'I')));
    }
    for(u=17;u<=46;u++)s.put(u,1,'N');
    for(t=2;t<=12;t++)s.put(17,t,t%2?'N':s.at(17,t));
    // hazard lip stripes along the plate's outer edge
    for(u=16;u<=47;u++)for(t=14;t<=15;t++)s.put(u,t,pmod(u+t,6)<3?'y':'K');
    // bumpers against the wall, clear of the lane
    [6,52].forEach(function(u0){
      for(u=u0;u<=u0+5;u++)for(t=1;t<=4;t++){
        var e2=u===u0||u===u0+5||t===4;
        s.put(u,t,e2?'B':(t===1?'t':'b'));
      }
    });
    // chalk tally left on the apron
    s.put(55,9,'L');s.put(56,9,'H');s.put(57,9,'L');s.put(58,9,'H');s.put(56,8,'L');
    return toRows(s.g);
  }

  // =====================================================================
  // OVERHEAD PIPES: a twin-pipe bundle 12 wide. Lane profile across the bundle
  // (two identical pipes) is K L M M D K K L M M D K, lit from the top/left.
  // =====================================================================
  var PIPE_PROF=['K','L','M','M','D','K'];
  function pipeCore(variant){ // horizontal 32x12
    var g=mkGrid(32,12),x,y;
    for(y=0;y<12;y++)for(x=0;x<32;x++)g[y][x]=PIPE_PROF[y%6];
    // short specular glints, never a full-length line
    for(x=4;x<=8;x++){g[1][x]='H';}
    for(x=21;x<=24;x++){g[7][x]='H';}
    // weld seam every 32 at x=0 and the matching one at x=31 stays plain
    g[2][0]='D';g[3][0]='D';g[8][0]='D';g[9][0]='D';
    if(variant===1){ // bolted flanges on both pipes + a galvanised clamp strap
      for(y=0;y<12;y++){var ed=y%6===0||y%6===5;g[y][13]='K';g[y][14]=ed?'K':'L';g[y][15]=ed?'K':'D';g[y][16]='K';}
      g[2][14]='H';g[8][14]='H';
      for(y=0;y<12;y++)g[y][26]=y%6===0||y%6===5?'K':'n';
      g[1][26]='S';g[7][26]='S';
    }
    if(variant===2){ // steel handwheel valve on the upper pipe, bolted bonnet on the lower
      rect(g,12,0,19,5,'K');
      rect(g,13,1,18,4,'n');rect(g,14,1,17,1,'S');rect(g,13,2,13,3,'S');rect(g,18,2,18,4,'j');
      rect(g,15,2,16,3,'K');g[2][15]='i';
      rect(g,13,6,18,11,'K');rect(g,14,7,17,10,'M');rect(g,14,7,17,7,'L');rect(g,17,8,17,10,'D');g[8][15]='H';
    }
    return g;
  }
  function makePipeH(v){return toRows(pipeCore(v));}
  function makePipeV(v){return toRows(transpose(pipeCore(v)));}
  // pipeJoint mask 12x12: N|E|S|W = 1|2|4|8 -- which neighbours carry pipe.
  // Straights for 5/10, mitred welded elbows for 3/6/9/12, a blind-flange cap
  // for single bits, a bolted manifold casting for 0 and every tee/cross.
  function pipeJointPiece(m){
    var g=mkGrid(12,12),x,y;
    var n=(m&1?1:0)+(m&2?1:0)+(m&4?1:0)+(m&8?1:0);
    if(m===5||m===10){var c=pipeCore(0);c=c.map(function(r){return r.slice(0,12);});for(y=0;y<12;y++)for(x=0;x<12;x++)c[y][x]=PIPE_PROF[y%6];return toRows(m===5?transpose(c):c);}
    if(n===2){
      for(y=0;y<12;y++)for(x=0;x<12;x++){
        var harm;
        if(m===12)harm=y<=11-x;       // W+S
        else if(m===6)harm=y<=x;      // E+S
        else if(m===9)harm=y>=x;      // N+W
        else harm=x+y>=11;            // N+E
        g[y][x]=harm?PIPE_PROF[y%6]:PIPE_PROF[x%6];
      }
      // weld bead on the mitre where it crosses a pipe body
      for(y=0;y<12;y++)for(x=0;x<12;x++){
        var onMitre=(m===12||m===3)?(x+y===11):(y===x);
        if(onMitre&&g[y][x]!=='K')g[y][x]='D';
      }
      return toRows(g);
    }
    if(n===1){
      // pipe comes in from one side, stops at a blind flange in the middle
      var hg=mkGrid(12,12);
      for(y=0;y<12;y++){for(x=0;x<=6;x++)hg[y][x]=PIPE_PROF[y%6];hg[y][7]='K';hg[y][8]=y%6===0||y%6===5?'K':'L';hg[y][9]='K';}
      hg[2][8]='H';hg[8][8]='H';
      // hg enters from W; rotate to the requested side
      if(m===8)return toRows(hg);
      if(m===2){var mr=mkGrid(12,12);for(y=0;y<12;y++)for(x=0;x<12;x++)mr[y][x]=hg[y][11-x];
        for(y=0;y<12;y++){mr[y][2]='K';mr[y][3]=y%6===0||y%6===5?'K':'L';mr[y][4]='K';}mr[2][3]='H';mr[8][3]='H';return toRows(mr);}
      var tv=transpose(hg); // enters from N
      if(m===1)return toRows(tv);
      var mb=mkGrid(12,12);for(y=0;y<12;y++)for(x=0;x<12;x++)mb[y][x]=tv[11-y][x];
      for(x=0;x<12;x++){mb[2][x]='K';mb[3][x]=x%6===0||x%6===5?'K':'L';mb[4][x]='K';}mb[3][2]='H';mb[3][8]='H';
      return toRows(mb);
    }
    // manifold casting
    bevel(g,0,0,11,11,'K','L','M','D');
    [[2,2],[9,2],[2,9],[9,9]].forEach(function(p){g[p[1]][p[0]]='H';});
    rect(g,4,4,7,7,'K');rect(g,5,5,6,6,'i');g[5][5]='S';g[6][6]='j';
    return toRows(g);
  }
  function buildPipeJoint(){var out=[],m;for(m=0;m<16;m++)out.push(pipeJointPiece(m));return out;}

  // pipeBent_h 16x28: goalpost support for an overhead run -- a square steel post
  // standing on a concrete footing north and south of the bundle (the post top
  // is lit, its far faces throw a short shadow onto the footing), and the
  // crossbeam between them that the pipes rest on.
  function bentCore(){
    var g=mkGrid(16,28),y;
    // crossbeam (mostly hidden under the pipes)
    rect(g,6,5,9,22,'D');rect(g,6,5,6,22,'K');rect(g,9,5,9,22,'K');rect(g,7,5,7,22,'M');
    [0,21].forEach(function(y0){
      // footing
      bevel(g,0,y0,15,y0+6,'K','c','C','d');
      // shadow thrown by the post onto the footing (down-right)
      rect(g,6,y0+2,12,y0+5,'e');
      // post seen from above: dark K rim, lit cap
      rect(g,3,y0,10,y0+5,'K');
      rect(g,4,y0+1,9,y0+4,'M');
      rect(g,4,y0+1,9,y0+1,'H');rect(g,4,y0+2,4,y0+4,'L');
      rect(g,9,y0+2,9,y0+4,'D');rect(g,5,y0+4,8,y0+4,'D');
      setclip(g,6,y0+2,'L');
      // amber collision wrap on the post corner, anchor bolts on the footing
      setclip(g,10,y0+1,'Y');setclip(g,10,y0+3,'y');
      setclip(g,13,y0+1,'c');setclip(g,1,y0+5,'c');
    });
    for(y=6;y<=20;y+=14)rect(g,7,y,8,y,'L');
    return g;
  }

  // =====================================================================
  // CONVEYOR (solid, waist-high cover). Profile across a 16-deep run:
  // 0 K | 1-2 lit side frame with idler caps every 8 | 3 K | 4-10 rubber belt
  // (lit top edge, dark lower edge) | 11 K | 12-13 shaded side frame | 14 K |
  // 15 leg stubs every 16 (the rest of row 15 is open ground).
  // =====================================================================
  function beltColumn(g,x,t0){ // one column of the belt profile, starting at row t0
    var y;
    g[t0+0][x]='K';g[t0+1][x]=pmod(x,8)===4?'H':'L';g[t0+2][x]=pmod(x,8)===4?'L':'M';g[t0+3][x]='K';
    for(y=4;y<=10;y++)g[t0+y][x]=y===4?'b':(y===10?'n':(pmod(x,8)===4&&y===5?'b':'B'));
    g[t0+11][x]='K';g[t0+12][x]=pmod(x,8)===4?'H':'M';g[t0+13][x]=pmod(x,8)===4?'L':'M';g[t0+14][x]='K';
    var leg=pmod(x,16);g[t0+15][x]=(leg>=6&&leg<=8)?'K':'.';
  }
  function conveyorCore(variant){ // 32x16 horizontal
    var g=mkGrid(32,16),x,rng=mulberry32(410+variant);
    for(x=0;x<32;x++)beltColumn(g,x,0);
    // belt splice across the belt
    [5,6,7,8,9].forEach(function(y){g[y][19]='n';});
    if(variant===1){ // clinker and ash left on the belt when the line stopped
      var lumps=[[3,6],[6,8],[10,5],[13,8],[17,6],[22,7],[25,5],[28,8]];
      lumps.forEach(function(p){
        g[p[1]][p[0]]='a';g[p[1]][p[0]+1]='s';g[p[1]+1][p[0]]='K';
        if(rng()<.5)g[p[1]+1][p[0]+1]='s';
      });
      for(x=1;x<31;x++)if(rng()<.3)g[9][x]='s';
    }
    return g;
  }
  function makeConveyorH(v){return toRows(conveyorCore(v));}
  function makeConveyorV(v){return toRows(transpose(conveyorCore(v)));}
  // conveyorHead 16x16: the head drum where a run ends. The drum is a lit
  // cylinder (axis across the belt) with rounded ends overhanging the belt by
  // 2 each side, bearing blocks on the frame and a drive box at the far end.
  // _h [0] end on the east, [1] end on the west; _v [0] end on the south, [1] end on the north.
  var DRUM_SHADE=['K','M','H','L','M','n','K'];
  function headCore(){ // east end, horizontal
    var g=mkGrid(16,16),x,y;
    for(x=0;x<=6;x++)beltColumn(g,x,0);
    // drum x6-12, rows 2-12, rounded corners
    for(x=6;x<=12;x++)for(y=2;y<=12;y++){
      var corner=(x===6||x===12)&&(y===2||y===12);
      if(corner)continue;
      g[y][x]=(y===2||y===12)?'K':DRUM_SHADE[x-6];
    }
    for(x=7;x<=11;x++){g[2][x]='K';g[12][x]='K';}
    g[3][8]='H';g[4][8]='H';g[11][9]='n';
    // bearing blocks on the frame lines above and below the drum
    [0,13].forEach(function(y0){rect(g,7,y0,11,y0+1,'K');rect(g,8,y0,10,y0,y0===0?'L':'M');setclip(g,9,y0+1,'M');});
    // drive box beyond the drum
    rect(g,13,3,15,13,'K');rect(g,14,4,14,12,'M');setclip(g,14,4,'L');setclip(g,14,8,'Y');setclip(g,14,9,'Y');
    // leg stub under the drum
    g[15][9]='K';g[15][10]='K';g[15][8]='K';
    return g;
  }
  function makeHeadH(end){
    var g=headCore(),x,y,o;
    if(end===0)return toRows(g);
    o=mkGrid(16,16);for(y=0;y<16;y++)for(x=0;x<16;x++)o[y][x]=g[y][15-x];
    // re-light the mirrored drum (light stays top-left)
    for(x=3;x<=9;x++)for(y=3;y<=11;y++)o[y][x]=DRUM_SHADE[x-3];
    o[3][5]='H';o[4][5]='H';o[11][6]='n';
    return toRows(o);
  }
  function makeHeadV(end){
    var rows=makeHeadH(end).map(function(r){return r.split('');});
    return toRows(transpose(rows));
  }

  // hopper 32x32: feed hopper over a conveyor tail -- thick rim, stepped funnel
  // walls (far walls catch the top-left light), ash-choked throat.
  function makeHopper(){
    var g=mkGrid(32,32),i,x,y;
    bevel(g,0,0,31,31,'K','H','L','D');
    rect(g,2,2,29,29,'K');
    // funnel rings: near (top/left) inner walls in shade, far (bottom/right) lit
    var ring=[['D','M'],['D','M'],['K','L'],['D','M'],['D','M'],['K','L'],['D','M']];
    for(i=0;i<ring.length;i++){
      var a=3+i,b=28-i;
      rect(g,a,a,b,a,ring[i][0]);rect(g,a,a,a,b,ring[i][0]);
      rect(g,a,b,b,b,ring[i][1]);rect(g,b,a,b,b,ring[i][1]);
    }
    rect(g,10,10,21,21,'K');
    // ash in the throat
    var ash=[[12,13,'d'],[13,13,'a'],[14,14,'a'],[15,14,'s'],[13,15,'d'],[16,16,'a'],[17,17,'d'],[18,15,'a'],[12,18,'d'],[15,19,'a'],[19,19,'d']];
    ash.forEach(function(p){setclip(g,p[0],p[1],p[2]);});
    rect(g,11,20,20,20,'d');rect(g,13,19,18,19,'a');setclip(g,15,18,'s');
    // hazard corners on the rim
    for(x=0;x<4;x++){setclip(g,1+x,1,x%2?'K':'Y');setclip(g,30-x,30,x%2?'K':'Y');}
    for(y=4;y<28;y+=8){setclip(g,1,y,'M');setclip(g,30,y+4,'M');}
    return toRows(g);
  }

  // =====================================================================
  // GANTRY: worn safety-ochre paint so the crane separates from roofs and ground.
  // Beam and trolley are OVERHEAD; the piers are SOLID A-frame legs.
  // =====================================================================
  function gantryCore(variant){ // 32x14 horizontal: twin box girders + open lacing
    var g=mkGrid(32,14),x,y,prof=['K','H','L','M','D','K'];
    for(x=0;x<32;x++){
      for(y=0;y<5;y++)g[y][x]=[ 'K','L','M','D','K'][y];
      for(y=9;y<14;y++)g[y][x]=['K','L','M','D','K'][y-9];
    }
    // lacing: diagonals seen through, dark paint
    for(y=5;y<=8;y++)for(x=0;x<32;x++){
      if(pmod(x-(y-5),8)===0||pmod(x+(y-5)-7,8)===0)g[y][x]=y===5?'M':'D';
    }
    // stiffener plates every 8 on both girders
    for(x=0;x<32;x+=8){g[2][x]='D';g[3][x]='K';g[11][x]='D';g[12][x]='K';}
    for(x=3;x<32;x+=16){g[1][x]='H';g[1][x+1]='H';g[10][x+8]='H';}
    if(variant===1){ // bolted splice plates and a stencilled load band
      rect(g,13,0,18,4,'K');rect(g,14,1,17,3,'M');rect(g,14,1,17,1,'H');g[2][14]='s';g[2][17]='s';
      rect(g,13,9,18,13,'K');rect(g,14,10,17,12,'M');rect(g,14,10,17,10,'H');
      for(x=24;x<=29;x++)g[2][x]=x%2?'k':'M';
    }
    return g;
  }
  function makeGantryH(v){return toRows(gantryCore(v));}
  function makeGantryV(v){return toRows(transpose(gantryCore(v)));}
  // gantryTrolley 24x24 (horizontal beam, centred on its centreline): ochre end
  // carriages riding each girder, a light steel cable drum spanning both, the
  // motor box, and the hook block hanging below with its dark drop.
  function trolleyCore(){
    var g=mkGrid(24,24),x,y;
    // end carriages over the two girders (beam rows 5-9 and 14-18 in trolley space)
    bevel(g,0,3,23,9,'K','H','L','D');bevel(g,0,14,23,20,'K','L','M','D');
    // wheels
    [[2,1],[18,1],[2,21],[18,21]].forEach(function(p){rect(g,p[0],p[1],p[0]+3,p[1]+1,'k');setclip(g,p[0]+1,p[1],'i');});
    // cable drum across both girders, axis along y: shaded across x
    var sh=['k','j','n','s','s','n','i','j','k'];
    for(x=4;x<=12;x++)for(y=2;y<=21;y++)g[y][x]=sh[x-4];
    for(x=4;x<=12;x++){g[2][x]='k';g[21][x]='k';g[3][x]=x===4||x===12?'k':'j';g[20][x]=x===4||x===12?'k':'j';}
    for(y=5;y<=18;y+=3){g[y][6]='i';g[y][9]='n';g[y][10]='i';} // cable wraps
    // motor + brake box
    rect(g,15,9,22,14,'k');rect(g,16,10,21,13,'i');rect(g,16,10,21,10,'n');rect(g,21,11,21,13,'j');setclip(g,17,12,'D');setclip(g,19,12,'D');
    // hook block: bright ochre block with its dark drop south-east
    rect(g,15,16,19,19,'K');rect(g,16,17,18,18,'L');setclip(g,16,17,'H');
    rect(g,17,21,20,23,'k');rect(g,19,20,20,20,'k');
    return g;
  }
  function makeTrolleyH(){return toRows(trolleyCore());}
  function makeTrolleyV(){return toRows(transpose(trolleyCore()));}
  // gantryPier_h 24x40 (solid): portal A-frame leg under a gantryBeam_h end. Two
  // concrete footings north and south of the beam; the leg plates rise from them
  // to the saddle under the beam (north plate faces the light, south plate in shade).
  function pierCore(){
    var g=mkGrid(24,40),x,y;
    [0,32].forEach(function(y0){
      bevel(g,0,y0,23,y0+7,'K','c','C','d');
      // hazard stripes on the footing's outer edge
      var ey=y0===0?y0+1:y0+6;
      for(x=1;x<=22;x++)setclip(g,x,ey,pmod(x,4)<2?'L':'k');
      setclip(g,2,y0===0?6:33,'c');setclip(g,21,y0===0?6:33,'c');
    });
    // leg plates: trapezoids from the footings (width 16) to the saddle (width 10)
    for(y=3;y<=36;y++){
      var d=y<20?(20-y):(y-19); // distance from the saddle
      var half=Math.round(5+d*3/16);
      if(y>=15&&y<=24)half=5;
      for(x=12-half;x<12+half;x++){
        var edge=x===12-half||x===12+half-1;
        var ch;
        if(y<15)ch=edge?'K':(x===12-half+1?'H':(pmod(y,4)===0?'M':'L')); // north plate, lit
        else if(y>24)ch=edge?'K':(x===12-half+1?'M':(pmod(y,4)===0?'K':'D')); // south plate, shade
        else ch=edge?'K':'M';
        g[y][x]=ch;
      }
    }
    // saddle cap under the beam
    rect(g,6,15,17,24,'K');rect(g,7,16,16,23,'M');rect(g,7,16,16,16,'H');rect(g,7,17,7,23,'L');rect(g,16,17,16,23,'D');rect(g,7,23,16,23,'D');
    [[8,18],[15,18],[8,21],[15,21]].forEach(function(p){setclip(g,p[0],p[1],'s');});
    // leg-to-footing base plates
    rect(g,4,3,19,4,'K');rect(g,5,3,18,3,'j');rect(g,4,35,19,36,'K');rect(g,5,36,18,36,'j');
    return g;
  }

  // =====================================================================
  // SERVICE-YARD CLUSTERS (solid, anchor feet). Lit top planes plus a short
  // dark front face so they stand up from the yard as cover.
  // =====================================================================
  function inPoly(px,py,pts){
    var c=false,i,j;
    for(i=0,j=pts.length-1;i<pts.length;j=i++){
      var xi=pts[i][0],yi=pts[i][1],xj=pts[j][0],yj=pts[j][1];
      if(((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi))c=!c;
    }
    return c;
  }
  // one flat plate lying at an angle: fill, lit edges where the plate meets
  // open space above/left, shaded edges below/right, optional rib pattern.
  function plate(g,pts,Lc,Mc,Dc,pattern){
    var h=g.length,w=g[0].length,x,y,m=[];
    for(y=0;y<h;y++){m.push([]);for(x=0;x<w;x++)m[y].push(inPoly(x+.5,y+.5,pts));}
    function inside(x,y){return y>=0&&y<h&&x>=0&&x<w&&m[y][x];}
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      if(!m[y][x])continue;
      var ch=pattern?pattern(x,y):Mc;
      if(!inside(x,y-1)||!inside(x-1,y))ch=Lc;
      else if(!inside(x,y+1)||!inside(x+1,y))ch=Dc;
      g[y][x]=ch;
    }
  }
  // scrapPile 44x28: a jagged heap -- rusted sheet, a galvanised ribbed sheet
  // at an angle, a painted offcut, an I-beam stub and rebar poking past the
  // outline, a crushed drum. Mixed materials; rust is on the cut steel.
  function makeScrapPile(variant){
    var g=mkGrid(44,28),x;
    function diagRib(a,b,c){return function(x,y){var k=pmod(x+y,4);return k===0?c:(k===1?a:b);};}
    // a low backing mass of mixed dark scrap so the heap reads as one jagged pile
    function backing(pts){plate(g,pts,'x','J','K',function(x,y){var k=pmod(x*3+y*5,7);return k===0?'q':(k<3?'x':(k===3?'I':'J'));});}
    if(variant===0){
      backing([[0,25],[2,17],[8,11],[15,9],[22,5],[30,8],[36,7],[43,15],[42,25]]);
      plate(g,[[1,24],[4,15],[11,12],[19,14],[23,22],[20,25]],'r','R','q');
      plate(g,[[10,9],[27,3],[33,13],[16,20]],'S','N','J',diagRib('S','N','J'));
      plate(g,[[24,14],[38,9],[42,19],[29,24]],'o','O','p');
      plate(g,[[5,22],[13,19],[16,25],[6,25]],'Q','P','x');
      plate(g,[[27,20],[37,18],[40,25],[29,25]],'N','I','J');
      rect(g,33,19,33,24,'J');rect(g,30,21,30,24,'J');setclip(g,36,21,'R');setclip(g,37,22,'q');
      outlineFrom(g,'K');
      // I-beam stub poking out past the heap to the east
      rect(g,30,6,43,8,'K');rect(g,31,6,43,6,'S');rect(g,31,7,43,7,'I');setclip(g,43,7,'q');setclip(g,43,6,'r');
      // rebar stubs poking out of the top
      line(g,14,12,11,2,'q');setclip(g,11,2,'r');setclip(g,12,5,'r');
      line(g,21,9,24,0,'q');setclip(g,24,0,'r');
      line(g,4,16,1,11,'q');
      for(x=2;x<=40;x++)if(get(g,x,25)!=='.'&&pmod(x*7,5)!==0)setclip(g,x,26,'K');
    }else{
      backing([[1,25],[4,14],[10,6],[18,3],[26,7],[34,4],[42,13],[40,25]]);
      plate(g,[[3,25],[6,13],[17,8],[22,18],[18,25]],'Q','P','x');
      plate(g,[[9,17],[14,5],[21,4],[23,15]],'r','R','q');
      plate(g,[[20,12],[36,6],[41,16],[26,23]],'S','N','J',function(x){return pmod(x,4)===2?'J':(pmod(x,4)===0?'S':'N');});
      // pipe offcut (oxide) lying across the front
      plate(g,[[14,20],[35,19],[35,24],[14,25]],'Z','X','z');
      rect(g,15,22,34,22,'X');
      outlineFrom(g,'K');
      setclip(g,34,21,'K');setclip(g,34,22,'K');setclip(g,35,21,'K');setclip(g,35,22,'z');
      // bent angle iron sticking up and out west, rebar out east
      line(g,6,14,0,6,'K');line(g,7,14,1,6,'N');setclip(g,0,6,'q');
      line(g,30,9,38,1,'q');setclip(g,38,1,'r');
      setclip(g,27,13,'a');setclip(g,28,14,'a');setclip(g,11,15,'a');
      for(x=3;x<=38;x++)if(get(g,x,25)!=='.'&&pmod(x*5,7)!==0)setclip(g,x,26,'K');
    }
    return toRows(g);
  }
  // palletCluster 40x30: two pallet stacks -- one bare, one of wrapped ash
  // sacks -- and a pallet jack left in the loading position.
  function makePalletCluster(){
    var g=mkGrid(40,30),x,y;
    rect(g,2,4,17,17,'L');for(x=2;x<=17;x++){if(x%3===2)rect(g,x,4,x,17,'M');}
    rect(g,2,4,17,4,'H');rect(g,2,5,2,17,'H');rect(g,3,10,17,10,'M');
    rect(g,2,18,17,23,'D');for(y=18;y<=23;y+=2)rect(g,2,y,17,y,'K');rect(g,5,19,6,22,'K');rect(g,13,19,14,22,'K');
    rect(g,19,2,37,18,'s');
    [[19,2],[25,2],[31,2],[19,8],[25,8],[31,8],[19,13],[25,13],[31,13]].forEach(function(p){
      rect(g,p[0],p[1],p[0]+5,p[1]+4,'S');
      rect(g,p[0],p[1],p[0]+5,p[1],'H');rect(g,p[0]+5,p[1]+1,p[0]+5,p[1]+4,'s');rect(g,p[0],p[1]+4,p[0]+5,p[1]+4,'a');
      setclip(g,p[0]+2,p[1]+2,'s');
    });
    rect(g,19,18,37,23,'D');for(y=19;y<=23;y+=2)rect(g,19,y,37,y,'K');rect(g,22,19,23,22,'K');rect(g,33,19,34,22,'K');
    rect(g,24,24,26,26,'I');rect(g,31,24,33,26,'I');rect(g,24,26,33,26,'J');
    rect(g,28,25,29,28,'Y');rect(g,26,28,31,28,'J');
    outlineFrom(g,'k');
    return toRows(g);
  }
  // ashSkip 40x28 [0,1]: open ochre-painted steel skip half-full of ash and clinker.
  // ashSkipWarm 40x28: the same skip beside the furnace, clinker still holding heat.
  function skipCore(variant,warm){
    var g=mkGrid(40,28),rng=mulberry32(600+variant+(warm?7:0)),x,y,cx=variant?17:22;
    bevel(g,1,2,38,21,'K','H','L','M');
    rect(g,3,4,36,19,'K');
    rect(g,4,5,35,18,'d');
    for(y=5;y<=18;y++)for(x=4;x<=35;x++){
      var d=Math.sqrt(((x-cx)/15)*((x-cx)/15)+((y-12)/8)*((y-12)/8));
      if(d<1){var r=rng();g[y][x]=d<.5?(r<.3?'S':'s'):(r<.55?'s':'a');}
    }
    [[12,9],[20,8],[27,13],[15,14],[24,11]].forEach(function(p){setclip(g,p[0],p[1],'k');setclip(g,p[0]+1,p[1],'S');setclip(g,p[0],p[1]+1,'d');});
    if(warm){[[21,10],[25,14],[18,13]].forEach(function(p,i){setclip(g,p[0],p[1],'e');setclip(g,p[0]+1,p[1],i===0?'O':'o');setclip(g,p[0],p[1]+1,'e');});}
    rect(g,1,22,38,26,'M');rect(g,1,22,38,22,'L');rect(g,1,26,38,26,'D');rect(g,1,27,38,27,'K');
    rect(g,0,22,0,27,'K');rect(g,39,22,39,27,'K');
    for(x=4;x<36;x++)if(pmod(x,6)<3)setclip(g,x,24,'D');
    rect(g,0,8,1,12,'L');rect(g,38,8,39,12,'M');setclip(g,0,8,'K');setclip(g,39,12,'K');
    return toRows(g);
  }
  // drumCluster 32x26: three upright painted drums (one open, ash-filled) and
  // one tipped with a dark oil leak from the bung.
  function makeDrumCluster(){
    var g=mkGrid(32,26);
    function drum(cx,cy,open){
      disc(g,cx,cy,5,5,'K');disc(g,cx,cy,4,4,'n');disc(g,cx-1,cy-1,3,3,'H');disc(g,cx-1,cy-1,1,1,'s');
      if(open){disc(g,cx,cy,3,3,'K');setclip(g,cx-1,cy,'D');setclip(g,cx,cy+1,'D');}
      else{setclip(g,cx+2,cy-2,'s');setclip(g,cx-2,cy+2,'D');setclip(g,cx+2,cy+2,'R');}
    }
    drum(6,6,false);drum(17,6,true);drum(6,17,false);
    rect(g,13,14,28,21,'H');rect(g,13,14,28,14,'s');rect(g,13,20,28,21,'n');
    rect(g,17,15,17,20,'n');rect(g,23,15,23,20,'n');rect(g,28,14,29,21,'D');setclip(g,29,17,'K');
    setclip(g,20,17,'r');setclip(g,21,18,'R');
    outlineFrom(g,'K');
    rect(g,30,19,31,23,'B');rect(g,25,22,31,24,'B');setclip(g,24,23,'b');setclip(g,27,23,'b');
    return toRows(g);
  }
  // ashSpill 48x28 [0,1] (flat): grey ash dropped from a skip/belt, clinker specks.
  function makeAshSpill(variant){
    var g=mkGrid(48,28),rng=mulberry32(700+variant),x,y,cx=variant?20:26;
    for(y=0;y<28;y++)for(x=0;x<48;x++){
      var d=Math.sqrt(((x-cx)/22)*((x-cx)/22)+((y-14)/12)*((y-14)/12));
      if(d<1&&rng()<(1-d)*1.3){var r=rng();g[y][x]=d<.4?(r<.2?'L':'M'):(r<.35?'M':'D');}
    }
    for(var i=0;i<7;i++){x=Math.round(cx-12+rng()*24);y=Math.round(7+rng()*14);setclip(g,x,y,'K');setclip(g,x+1,y,'D');}
    // drag marks (tyre of a pallet jack)
    for(x=cx-10;x<cx+14;x++){if(get(g,x,17)!=='.')setclip(g,x,17,'D');}
    return toRows(g);
  }

  A.define('industrial',{
    // ---- ROOF (anchor tile, drawn over the building footprint; collision is the building) ----
    sawtoothRoof_h:{variants:[makeSawtoothH(0),makeSawtoothH(1),makeSawtoothH(2)],pal:ROOF_PAL,anchor:'tile',note:'ROOF 32x32 sawtooth shed roof, ridges along x, one tooth per 32 rows: ridge cap row 0, shaded north-light glazing rows 1-5, gutter row 6, sheet slope 7-31 ramping dark (glazing shadow) to light (ridge); seamless both axes; [1] cracked panes + gutter rust, [2] fastener rust streaks'},
    sawtoothRoof_v:{variants:[makeSawtoothV(0),makeSawtoothV(1),makeSawtoothV(2)],pal:ROOF_PAL,anchor:'tile',note:'ROOF 32x32 sawtooth roof, ridges along y (transposed _h); seamless both axes'},
    monitorRoof_h:{variants:[makeMonitorH(0),makeMonitorH(1)],pal:ROOF_PAL,anchor:'tile',note:'ROOF 32x48 raised monitor spine along x with clerestory glazing both sides; tiles along x; top/bottom rows continue metalRoof_h; [1] cracked panes + rust streak'},
    monitorRoof_v:{variants:[makeMonitorV(0),makeMonitorV(1)],pal:ROOF_PAL,anchor:'tile',note:'ROOF 48x32 monitor spine along y; tiles along y; pairs with metalRoof_v'},
    metalRoof_h:{variants:[makeMetalRoofH(0),makeMetalRoofH(1),makeMetalRoofH(2)],pal:ROOF_PAL,anchor:'tile',note:'ROOF 32x32 corrugated sheet field, ribs along y, sheet lap on row 0; seamless both axes; [1] grimy roof-light panel, [2] patch plate + fastener rust run'},
    metalRoof_v:{variants:[makeMetalRoofV(0),makeMetalRoofV(1),makeMetalRoofV(2)],pal:ROOF_PAL,anchor:'tile',note:'ROOF 32x32 corrugated sheet field, ribs along x (transposed _h); seamless both axes'},
    stackTop:{rows:makeStackTop(),pal:STACK_PAL,anchor:'center',light:{r:34,col:'#ff7b35',a:'18'},note:'ROOF PROP 28x28 flue stack seen from above, furnace hall only; bore holds a dim residual ember (the plant\'s only warm spot)'},
    // ---- FACADE (anchor tile, inside the building edge; _h south face street at bottom, _v east face street at right).
    //      North/west faces: draw with flipY (_h) / flip (_v); never unflipped, or the flashing lands on the street side. ----
    corrugatedWall_h:{variants:[wallCore(false,0),wallCore(false,1)],pal:WALL_PAL,anchor:'tile',note:'FACADE 32x20 faded oxide-paint corrugated cladding, galvanised flashing rows 0-3, concrete plinth 17-18, ground row 19; tiles along x; [1] fastener rust streak + dent'},
    corrugatedWall_v:{variants:[wallCore(true,0),wallCore(true,1)],pal:WALL_PAL,anchor:'tile',note:'FACADE 12x32 corrugated cladding, flashing cols 0-2, plinth col 10, ground col 11; tiles along y'},
    loadingDoor_h:{variants:[loadingDoorCore(false,0),loadingDoorCore(false,1)],pal:DOOR_PAL,anchor:'tile',note:'FACADE 64x20 broad roller loading door in cladding (replaces two corrugatedWall_h tiles), steel lintel + dark jamb reveals; [0] shut, [1] jammed half-up with a pallet edge in the dark bay'},
    loadingDoor_v:{variants:[loadingDoorCore(true,0),loadingDoorCore(true,1)],pal:DOOR_PAL,anchor:'tile',note:'FACADE 12x64 loading door on an east face (replaces two corrugatedWall_v tiles), lintel breaks the flashing, dark jambs; [0] shut, [1] half-up'},
    workshopFront_h:{variants:[workshopCore(false,0),workshopCore(false,1)],pal:SHOP_PAL,anchor:'tile',note:'FACADE 48x20 small workshop: block wall, 26-wide roller door, wired window, steel door; [0] shut, [1] roller half-up, cracked window'},
    workshopFront_v:{variants:[workshopCore(true,0),workshopCore(true,1)],pal:SHOP_PAL,anchor:'tile',note:'FACADE 12x48 small workshop on an east face; [0] shut, [1] roller half-up'},
    officeFront_h:{variants:[officeCore(false,0),officeCore(false,1)],pal:OFFICE_PAL,anchor:'tile',note:'FACADE 48x20 dispatch/maintenance office: panel wall, long window with half-drawn blinds, glazed door with taped step, call panel; [1] shift board in the glass + cracked pane'},
    officeFront_v:{variants:[officeCore(true,0),officeCore(true,1)],pal:OFFICE_PAL,anchor:'tile',note:'FACADE 12x48 dispatch office on an east face'},
    // ---- FLAT (ground level, walkable) ----
    loadingDock_h:{rows:dockCore(false),pal:DOCK_PAL,anchor:'tile',note:'FLAT 64x24 ground-level dock apron directly south of loadingDoor_h (same x): concrete apron, diamond-tread leveller plate, painted hazard lip and lane lines; fully walkable; optional small solids = rubber bumpers 6x4 at local (6,1) and (52,1) against the wall'},
    loadingDock_v:{rows:dockCore(true),pal:DOCK_PAL,anchor:'tile',note:'FLAT 24x64 dock apron directly east of loadingDoor_v (same y); optional bumpers 4x6 at local (1,6) and (1,52)'},
    ashSpill:{variants:[makeAshSpill(0),makeAshSpill(1)],pal:SPILL_PAL,anchor:'center',note:'FLAT 48x28 dropped ash drift with clinker specks and a jack drag mark'},
    // ---- OVERHEAD (non-colliding). Renderer: before actors draw the same sprite with {tint:'shadow',alpha:.45} at (+4,+10)
    //      as its ground shadow, then draw the piece itself after actors. ----
    pipe_h:{variants:[makePipeH(0),makePipeH(1),makePipeH(2)],pal:PIPE_PAL,anchor:'tile',note:'OVERHEAD 32x12 oxidised twin pipe run along x; tiles along x; [1] flanges + galvanised clamp strap, [2] steel handwheel valve; tint shadow = ground shadow'},
    pipe_v:{variants:[makePipeV(0),makePipeV(1),makePipeV(2)],pal:PIPE_PAL,anchor:'tile',note:'OVERHEAD 12x32 twin pipe run along y; tiles along y; tint shadow = ground shadow'},
    pipeJoint:{mask:buildPipeJoint(),pal:PIPE_PAL,anchor:'tile',note:'OVERHEAD 12x12 pipe node, mask N|E|S|W=1|2|4|8 (set bit = pipe on that side): 5/10 straight, 3/6/9/12 mitred elbow, single bit blind-flange end, 0 and 3+ bits bolted manifold; tint shadow = ground shadow'},
    gantryBeam_h:{variants:[makeGantryH(0),makeGantryH(1)],pal:GANTRY_PAL,anchor:'tile',note:'OVERHEAD 32x14 safety-ochre twin girder with open lacing along x; tiles along x; [1] splice plates + load band; tint shadow = ground shadow'},
    gantryBeam_v:{variants:[makeGantryV(0),makeGantryV(1)],pal:GANTRY_PAL,anchor:'tile',note:'OVERHEAD 14x32 crane girder along y; tiles along y'},
    gantryTrolley_h:{rows:makeTrolleyH(),pal:GANTRY_PAL,anchor:'center',note:'OVERHEAD 24x24 hoist trolley stopped on a gantryBeam_h (centre on the beam centreline): ochre end carriages, light steel cable drum across both girders, motor box, hook block with its drop'},
    gantryTrolley_v:{rows:makeTrolleyV(),pal:GANTRY_PAL,anchor:'center',note:'OVERHEAD 24x24 hoist trolley on a gantryBeam_v'},
    // ---- SOLID ----
    pipeBent_h:{rows:toRows(bentCore()),pal:BENT_PAL,anchor:'center',note:'SOLID 16x28 goalpost support under a pipe_h run (centre on the run centreline): two square posts on concrete footings; collide only the footings 16x7 at rows 0-6 and 21-27; the crossbeam between is under the pipes'},
    pipeBent_v:{rows:toRows(transpose(bentCore())),pal:BENT_PAL,anchor:'center',note:'SOLID 28x16 goalpost support under a pipe_v run; collide the footings 7x16 at cols 0-6 and 21-27'},
    gantryPier_h:{rows:toRows(pierCore()),pal:PIER_PAL,anchor:'center',note:'SOLID 24x40 A-frame portal leg under a gantryBeam_h end (centre on the beam centreline): concrete footings north and south with hazard edges, lit north leg plate, shaded south plate, saddle cap; collide 24x40 (or just the two footings 24x8 at rows 0-7 and 32-39)'},
    gantryPier_v:{rows:toRows(transpose(pierCore())),pal:PIER_PAL,anchor:'center',note:'SOLID 40x24 A-frame leg under a gantryBeam_v end; collide 40x24 or the footings 8x24 at cols 0-7 and 32-39'},
    conveyor_h:{variants:[makeConveyorH(0),makeConveyorH(1)],pal:CONV_PAL,anchor:'tile',note:'SOLID cover 32x16 belt conveyor along x: galvanised side frames with idler caps every 8, rubber belt, leg stubs every 16 on row 15; tiles along x; [0] bare belt, [1] ash and clinker left on the belt'},
    conveyor_v:{variants:[makeConveyorV(0),makeConveyorV(1)],pal:CONV_PAL,anchor:'tile',note:'SOLID cover 16x32 belt conveyor along y; tiles along y'},
    conveyorHead_h:{variants:[makeHeadH(0),makeHeadH(1)],pal:CONV_PAL,anchor:'tile',note:'SOLID 16x16 head drum (lit cylinder overhanging the belt by 2 each side) + drive box ending a conveyor_h run; [0] end on the east, [1] end on the west'},
    conveyorHead_v:{variants:[makeHeadV(0),makeHeadV(1)],pal:CONV_PAL,anchor:'tile',note:'SOLID 16x16 head drum ending a conveyor_v run; [0] end on the south, [1] end on the north'},
    hopper:{rows:makeHopper(),pal:HOPPER_PAL,anchor:'center',note:'SOLID 32x32 feed hopper over a conveyor tail (centre on the belt, overlapping 8 into the first segment); ash-choked throat'},
    scrapPile:{variants:[makeScrapPile(0),makeScrapPile(1)],pal:SCRAP_PAL,anchor:'feet',note:'SOLID cover 44x28 jagged scrap heap: rusted sheet, tilted galvanised sheet, painted offcut, crushed drum or pipe offcut, beam/rebar stubs past the outline; collide 40x14 at the foot'},
    palletCluster:{rows:makePalletCluster(),pal:PALLET_PAL,anchor:'feet',note:'SOLID cover 40x30 bare pallet stack + wrapped ash sacks + pallet jack; collide 38x16 at the foot (jack handle rows 24-28 are walk-over)'},
    ashSkip:{variants:[skipCore(0,false),skipCore(1,false)],pal:SKIP_PAL,anchor:'feet',note:'SOLID cover 40x28 ochre steel skip half-full of cold ash/clinker; collide 38x16 at the foot'},
    ashSkipWarm:{rows:skipCore(0,true),pal:SKIPWARM_PAL,anchor:'feet',light:{r:30,col:'#ff7b35',a:'14'},note:'SOLID 40x28 the same skip beside the furnace only; three clinker cores still faintly warm'},
    drumCluster:{rows:makeDrumCluster(),pal:DRUM_PAL,anchor:'feet',note:'SOLID cover 32x26 three drums (one open) + one tipped with a dark oil leak; collide 30x14 at the foot'}
  });
})();
