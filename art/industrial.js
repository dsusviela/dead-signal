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
  var HAZ='#6d4f20'; // faded hazard amber, same value as lots.js HAZARD_Y
  var I=MAT.iron,C=MAT.concrete,G=MAT.glass,R=MAT.rust,E=MAT.ember,W=MAT.wood;
  var ROOF_PAL=pal2(MAT.asphalt,{G:G.K,g:G.D,s:G.M,R:R.D});
  var WALL_PAL=pal2(CLAD,{C:C.M,c:C.L,d:C.D,R:R.D,r:R.M});
  var DOOR_PAL=pal2(CLAD,{I:I.M,J:I.D,N:I.L,C:C.M,c:C.L,d:C.D,Y:HAZ,B:W.D,b:W.M});
  var DOCK_PAL=pal2(C,{I:I.M,J:I.D,N:I.L,Y:HAZ,B:MAT.basalt.K,b:MAT.basalt.M});
  var SHOP_PAL=pal2(C,{I:I.M,J:I.D,N:I.L,G:G.K,g:G.D,s:G.M,Y:HAZ,B:W.D,b:W.M,k:CLAD.K,d:C.K});
  var OFFICE_PAL=pal2(CLAD,{C:C.M,c:C.L,d:C.D,e:C.H,G:G.K,g:G.D,s:G.M,P:ASH.H,Y:HAZ});
  var PIPE_PAL={K:I.K,D:I.D,M:I.M,L:I.L,H:I.H,R:R.M,r:R.D,Y:HAZ};
  var CONV_PAL={K:I.K,D:I.D,M:I.M,L:I.L,H:I.H,B:MAT.basalt.D,b:MAT.basalt.M,a:ASH.M,s:ASH.L,Y:HAZ};
  var HOPPER_PAL={K:I.K,D:I.D,M:I.M,L:I.L,H:I.H,a:ASH.M,s:ASH.L,d:ASH.D,Y:HAZ};
  var GANTRY_PAL={K:I.K,D:I.D,M:I.M,L:I.L,H:I.H,Y:HAZ,C:C.M,c:C.L,d:C.D};
  var SCRAP_PAL=pal2(CLAD,{I:I.M,J:I.D,N:I.L,R:R.M,r:R.D,a:ASH.M});
  var PALLET_PAL=pal2(W,{s:ASH.L,S:ASH.H,a:ASH.M,I:I.M,J:I.D,N:I.L,k:I.K});
  var SKIP_PAL=pal2(CLAD,{a:ASH.M,s:ASH.L,d:ASH.D,Y:HAZ});
  var SKIPWARM_PAL=pal2(SKIP_PAL,{e:E.D,o:E.M,O:E.L});
  var DRUM_PAL=pal2(I,{R:R.M,r:R.D,B:MAT.basalt.K,Y:HAZ});
  var SPILL_PAL={K:ASH.K,D:ASH.D,M:ASH.M,L:ASH.L};
  var STACK_PAL={K:C.K,D:C.D,M:C.M,L:C.L,H:C.H,J:I.D,e:E.K,o:E.D,O:E.M};

  // =====================================================================
  // ROOFS
  // =====================================================================
  // sawtoothRoof 32x32: one tooth per 32 rows. Row 0 ridge cap, rows 1-5 the
  // north-light glazing face (in shade), row 6 gutter, rows 7-31 the sheet
  // slope rising back to the next ridge (dark at the gutter, light at the top).
  function sawtoothCore(variant){
    var g=mkGrid(32,32),x,y,base;
    for(y=0;y<32;y++)for(x=0;x<32;x++){
      if(y===0)base='H';
      else if(y<=5)base=(y===1||y===5)?'K':(pmod(x,8)===0?'D':(y===2?'s':'g'));
      else if(y===6)base='K';
      else{
        base=y<12?'D':(y<24?'M':'L');
        var rib=pmod(x,4);
        if(rib===3)base=base==='L'?'M':(base==='M'?'D':'K');
        else if(rib===1&&base!=='D')base=base==='M'?'L':'H';
      }
      g[y][x]=base;
    }
    // bolt row just under the ridge on the sheet side
    for(x=2;x<32;x+=8)setclip(g,x,29,'H');
    if(variant===1){ // two broken panes, one bent sheet corner
      rect(g,9,2,14,4,'G');setclip(g,11,3,'s');rect(g,25,3,29,4,'G');
      setclip(g,20,16,'R');setclip(g,20,17,'R');setclip(g,21,17,'R');
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
      if(y<=11){ch=y<4?'D':'M';if(rib===1)ch=ch==='M'?'L':'M';if(rib===3)ch=ch==='M'?'D':'K';}
      else if(y===12||y===16||y===30||y===35)ch='K';
      else if(y>=13&&y<=15)ch=pmod(x,8)===0?'D':(y===13?'s':'g');
      else if(y===17)ch='H';
      else if(y>=18&&y<=22)ch=pmod(x,8)===4?'M':'L';
      else if(y===23)ch='H';
      else if(y>=24&&y<=28)ch=pmod(x,8)===4?'D':'M';
      else if(y===29)ch='D';
      else if(y>=31&&y<=34)ch=pmod(x,8)===0?'K':'G';
      else{ch=y>43?'D':'M';if(rib===1)ch=ch==='M'?'L':'M';if(rib===3)ch=ch==='M'?'D':'K';}
      g[y][x]=ch;
    }
    for(x=4;x<32;x+=16){setclip(g,x,20,'H');setclip(g,x,26,'L');}
    if(variant===1){rect(g,17,13,22,15,'G');setclip(g,19,14,'s');rect(g,5,32,9,33,'g');}
    return g;
  }
  function makeMonitorH(v){return toRows(monitorCore(v));}
  function makeMonitorV(v){return toRows(transpose(monitorCore(v)));}

  // metalRoof 32x32: corrugated sheet field (ribs along y), sheet lap at row 0.
  function metalRoofCore(variant){
    var g=mkGrid(32,32),x,y,ch,rib,rng=mulberry32(300+variant);
    for(y=0;y<32;y++)for(x=0;x<32;x++){
      rib=pmod(x,4);ch=rib===1?'L':(rib===3?'D':'M');
      if(y===0)ch=rib===1?'M':'D';
      g[y][x]=ch;
    }
    for(x=1;x<32;x+=8)setclip(g,x,1,'H');
    if(variant===1){ // translucent roof light panel, grimed
      for(y=6;y<=21;y++)for(x=9;x<=18;x++)g[y][x]=pmod(x,4)===1?'H':'L';
      rect(g,9,6,18,6,'D');rect(g,9,21,18,21,'D');
      setclip(g,13,12,'M');setclip(g,14,13,'M');
    }
    if(variant===2){ // short rust run from a fastener, patch plate
      setclip(g,17,1,'R');setclip(g,17,2,'R');setclip(g,17,3,'R');setclip(g,18,3,'R');
      rect(g,5,18,12,24,'M');rect(g,5,18,12,18,'L');rect(g,5,18,5,24,'L');rect(g,5,24,12,24,'K');rect(g,12,18,12,24,'K');
      setclip(g,7,20,'H');setclip(g,10,22,'H');
    }
    if(rng()<0)g[0][0]='M';
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
  function flashing(s,B,u0,u1){
    var u;for(u=u0;u<=u1;u++){
      s.put(u,B.f0,'K');s.put(u,B.f0+1,'H');
      if(B.f1-B.f0>=3)s.put(u,B.f0+2,'L');
      s.put(u,B.f1,'D');
      if(pmod(u,8)===6)s.put(u,B.f0+1,'L'); // flashing joints
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
    flashing(s,B,0,31);corrugated(s,B,0,31);plinth(s,B,0,31,'c','C');
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
    flashing(s,B,0,63);
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
  // LOADING DOCK APRON (flat): concrete dock slab, lowered steel dock plate,
  // edge paint, two rubber bumpers on the drop face. _h sits directly south of a
  // loadingDoor_h (its top row touches the door's ground row).
  // =====================================================================
  function dockCore(vertical){
    var s=strip(64,24,vertical),u,t;
    for(u=0;u<=63;u++){
      for(t=0;t<=17;t++)s.put(u,t,t===0?'L':'M');
      s.put(u,1,'D');
      s.put(u,17,pmod(u,8)<4?'Y':'K');
      for(t=18;t<=22;t++)s.put(u,t,'D');
      s.put(u,23,'K');
      if(pmod(u,16)===0)for(t=2;t<=16;t++)s.put(u,t,'D'); // slab joints
    }
    for(t=0;t<=23;t++){s.put(0,t,'K');s.put(63,t,'K');}
    // dock leveller plate
    for(u=16;u<=47;u++)for(t=3;t<=16;t++){
      var edge=u===16||u===47||t===3;
      s.put(u,t,edge?'K':(pmod(u+t*2,4)===0?'N':(pmod(u-t,4)===2?'J':'I')));
    }
    for(u=17;u<=46;u++){s.put(u,4,'N');s.put(u,16,'H');}
    for(u=17;u<=46;u++)s.put(u,17,'K');
    // bumpers
    [5,51].forEach(function(u0){
      for(u=u0;u<=u0+7;u++)for(t=16;t<=23;t++){
        var e=u===u0||u===u0+7||t===16||t===23;
        s.put(u,t,e?'B':(t===17?'b':(pmod(t,3)===0?'B':'b')));
      }
    });
    // a scrap of shrink-wrap and chalk tally left on the slab
    s.put(9,8,'H');s.put(10,8,'L');s.put(10,9,'H');
    s.put(55,6,'L');s.put(56,6,'L');s.put(57,6,'L');s.put(58,6,'L');s.put(56,5,'L');
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
    if(variant===1){ // bolted flanges on both pipes + a pipe clamp strap
      for(y=0;y<12;y++){g[y][14]=y%6===0||y%6===5?'K':'H';g[y][15]=y%6===0||y%6===5?'K':'D';g[y][13]='K';g[y][16]='K';}
      g[2][14]='M';g[8][14]='M';
      for(y=0;y<12;y++)g[y][26]=y%6===0||y%6===5?'K':'D';
    }
    if(variant===2){ // handwheel valve on the upper pipe, red-oxide wheel
      rect(g,12,0,19,5,'K');
      rect(g,13,1,18,4,'r');rect(g,14,1,17,1,'R');rect(g,13,2,13,3,'R');
      rect(g,15,2,16,3,'M');g[2][15]='H';
      rect(g,14,2,14,3,'K');rect(g,17,2,17,3,'K');
      // valve body on the lower pipe too (bolted bonnet)
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
    rect(g,4,4,7,7,'K');rect(g,5,5,6,6,'R');g[5][5]='r';g[6][6]='r';
    return toRows(g);
  }
  function buildPipeJoint(){var out=[],m;for(m=0;m<16;m++)out.push(pipeJointPiece(m));return out;}

  // pipeBent_h 16x28: goalpost support for an overhead run -- two H-columns on
  // concrete pads north and south of the bundle, crossbeam the pipes rest on.
  function bentCore(){
    var g=mkGrid(16,28),y,x;
    // crossbeam (mostly hidden under the pipes)
    rect(g,5,6,10,21,'D');rect(g,5,6,5,21,'K');rect(g,10,6,10,21,'K');rect(g,6,6,6,21,'M');
    [0,21].forEach(function(y0){
      bevel(g,1,y0,14,y0+6,'K','L','M','D');
      // H column seen from above
      rect(g,4,y0+1,11,y0+1,'K');rect(g,4,y0+5,11,y0+5,'K');rect(g,7,y0+1,8,y0+5,'K');
      rect(g,5,y0+2,6,y0+4,'D');rect(g,9,y0+2,10,y0+4,'D');
      setclip(g,5,y0+2,'M');setclip(g,9,y0+2,'M');
      // anchor bolts
      setclip(g,2,y0+1,'H');setclip(g,13,y0+5,'H');
    });
    for(x=6;x<=9;x++)for(y=7;y<=20;y++)if(get(g,x,y)==='D'&&(y===7||y===20))setclip(g,x,y,'L');
    return g;
  }

  // =====================================================================
  // CONVEYOR (solid, waist-high cover)
  // =====================================================================
  function conveyorCore(variant){ // 32x16 horizontal
    var g=mkGrid(32,16),x,y,rng=mulberry32(410+variant);
    for(x=0;x<32;x++){
      g[0][x]='K';g[1][x]='H';g[2][x]='L';g[3][x]='D';
      for(y=4;y<=11;y++)g[y][x]=pmod(x,8)===0?'K':(y===4?'b':'B');
      g[12][x]='K';g[13][x]='M';g[14][x]='D';g[15][x]='K';
      if(pmod(x,16)===8){g[1][x]='M';g[13][x]='L';} // frame splice bolts
    }
    // idler roller ends poking out of the frame
    for(x=4;x<32;x+=16){g[2][x]='H';g[13][x]='H';}
    if(variant===1){ // clinker and ash left on the belt when the line stopped
      var lumps=[[3,6],[6,8],[10,5],[13,9],[17,7],[22,6],[25,9],[28,7]];
      lumps.forEach(function(p){
        g[p[1]][p[0]]='s';g[p[1]][p[0]+1]='a';g[p[1]+1][p[0]]='a';
        if(rng()<.5)g[p[1]+1][p[0]+1]='a';
      });
      for(x=1;x<31;x++)if(pmod(x,8)!==0&&rng()<.35)g[10][x]='a';
    }
    return g;
  }
  function makeConveyorH(v){return toRows(conveyorCore(v));}
  function makeConveyorV(v){return toRows(transpose(conveyorCore(v)));}
  // conveyorHead 16x16: head drum and geared motor where a run ends.
  // _h [0] end on the east, [1] end on the west; _v [0] end on the south, [1] end on the north.
  function headCore(){ // east end, horizontal
    var g=mkGrid(16,16),x,y;
    for(x=0;x<=9;x++){
      g[0][x]='K';g[1][x]='H';g[2][x]='L';g[3][x]='D';
      for(y=4;y<=11;y++)g[y][x]=pmod(x,8)===0?'K':(y===4?'b':'B');
      g[12][x]='K';g[13][x]='M';g[14][x]='D';g[15][x]='K';
    }
    // drum: belt wraps over it, cylinder axis across the belt
    for(y=3;y<=12;y++){g[y][10]='K';g[y][11]='L';g[y][12]='M';g[y][13]='D';g[y][14]='K';}
    rect(g,10,2,14,2,'K');rect(g,10,13,14,13,'K');
    // frame end plates with bearing blocks
    bevel(g,9,0,15,3,'K','L','M','D');bevel(g,9,12,15,15,'K','L','M','D');
    setclip(g,12,1,'H');setclip(g,12,14,'H');
    // motor box on the south side bearing
    rect(g,11,14,14,15,'K');setclip(g,12,15,'Y');setclip(g,13,15,'Y');
    return g;
  }
  function makeHeadH(end){
    var g=headCore(),x,y,o;
    if(end===0)return toRows(g);
    o=mkGrid(16,16);for(y=0;y<16;y++)for(x=0;x<16;x++)o[y][x]=g[y][15-x];
    // re-light the mirrored drum and plates (light stays top-left)
    for(y=3;y<=12;y++){o[y][1]='K';o[y][2]='L';o[y][3]='M';o[y][4]='D';o[y][5]='K';}
    rect(o,1,2,5,2,'K');rect(o,1,13,5,13,'K');
    bevel(o,0,0,6,3,'K','L','M','D');bevel(o,0,12,6,15,'K','L','M','D');
    setclip(o,3,1,'H');setclip(o,3,14,'H');rect(o,1,14,4,15,'K');setclip(o,2,15,'Y');setclip(o,3,15,'Y');
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
  // GANTRY (overhead)
  // =====================================================================
  function gantryCore(variant){ // 32x14 horizontal: twin I-beams + lacing
    var g=mkGrid(32,14),x,y,prof=['K','L','M','D','K'];
    for(x=0;x<32;x++){
      for(y=0;y<5;y++)g[y][x]=prof[y];
      for(y=9;y<14;y++)g[y][x]=prof[y-9];
    }
    for(y=5;y<=8;y++)for(x=0;x<32;x++){
      if(pmod(x-(y-5),8)===0||pmod(x+(y-5)-3,8)===0)g[y][x]='D';
    }
    for(x=0;x<32;x+=8){g[5][x]='K';g[8][x+3<32?x+3:x]='K';}
    for(x=2;x<32;x+=16){g[1][x]='H';g[10][x+6]='H';}
    if(variant===1){ // bolted splice plates and a faded load-rating band
      rect(g,13,0,18,4,'K');rect(g,14,1,17,3,'M');rect(g,14,1,17,1,'L');g[2][14]='H';g[2][17]='H';
      rect(g,13,9,18,13,'K');rect(g,14,10,17,12,'M');rect(g,14,10,17,10,'L');
      for(x=24;x<=29;x++)g[2][x]=x%2?'Y':'M';
    }
    return g;
  }
  function makeGantryH(v){return toRows(gantryCore(v));}
  function makeGantryV(v){return toRows(transpose(gantryCore(v)));}
  // gantryTrolley 24x24 (horizontal beam): hoist trolley straddling the twin
  // beams, cable drum, motor, hook block hanging dead centre where it stopped.
  function trolleyCore(){
    var g=mkGrid(24,24),x,y;
    // end carriages over each beam
    bevel(g,0,3,23,8,'K','L','M','D');bevel(g,0,15,23,20,'K','L','M','D');
    // wheels
    [[2,2],[19,2],[2,20],[19,20]].forEach(function(p){rect(g,p[0],p[1],p[0]+2,p[1]+1,'K');setclip(g,p[0]+1,p[1],'D');});
    // cable drum (axis along x)
    rect(g,4,9,19,14,'K');
    for(x=5;x<=18;x++){g[10][x]='L';g[11][x]='M';g[12][x]='M';g[13][x]='D';}
    for(x=6;x<=18;x+=3){g[11][x]='D';g[12][x]='D';}
    // motor + brake box
    bevel(g,17,5,23,18,'K','L','M','D');
    rect(g,19,8,21,8,'D');rect(g,19,10,21,10,'D');rect(g,19,12,21,12,'D');
    setclip(g,19,15,'Y');setclip(g,20,15,'Y');
    // hook block
    rect(g,8,10,12,14,'K');rect(g,9,11,11,13,'H');setclip(g,11,13,'L');setclip(g,10,12,'M');
    // chain drop
    setclip(g,10,15,'D');setclip(g,10,16,'K');setclip(g,10,17,'D');
    return g;
  }
  function makeTrolleyH(){return toRows(trolleyCore());}
  function makeTrolleyV(){return toRows(transpose(trolleyCore()));}
  // gantryPier 24x24 (solid): concrete footing, box leg, bolted base plate, amber collision guard.
  function makeGantryPier(){
    var g=mkGrid(24,24),x;
    bevel(g,0,0,23,23,'K','c','C','d');
    rect(g,3,3,20,20,'K');rect(g,4,4,19,19,'D');rect(g,4,4,19,4,'M');rect(g,4,4,4,19,'M');
    [[5,5],[18,5],[5,18],[18,18]].forEach(function(p){setclip(g,p[0],p[1],'H');});
    bevel(g,7,7,16,16,'K','H','L','M');
    rect(g,9,9,14,14,'D');rect(g,9,9,14,9,'K');rect(g,9,9,9,14,'K');
    // guard stripes on the leg corners
    for(x=0;x<4;x++){setclip(g,7+x,7,x%2?'K':'Y');setclip(g,16-x,16,x%2?'K':'Y');}
    return toRows(g);
  }

  // =====================================================================
  // SERVICE-YARD CLUSTERS (solid, anchor feet). Top face plus a short dark
  // front face (3-4 rows) so they stand up from the yard.
  // =====================================================================
  // scrapPile 44x28: offcut cladding sheets, rebar, a crushed drum, lids.
  function makeScrapPile(variant){
    var g=mkGrid(44,28),rng=mulberry32(500+variant);
    if(variant===0){
      // sheet stack (skewed pieces)
      rect(g,3,12,24,23,'M');rect(g,3,12,24,12,'L');
      rect(g,6,8,27,18,'M');rect(g,6,8,27,8,'H');rect(g,6,9,6,18,'L');
      var x;for(x=8;x<27;x+=4)rect(g,x,9,x,17,'D');
      rect(g,10,4,20,13,'N');rect(g,10,4,20,4,'H');rect(g,10,5,10,13,'H');rect(g,20,5,20,13,'J');rect(g,11,13,20,13,'J');
      // crushed drum lying across the right
      rect(g,26,14,40,23,'I');rect(g,26,14,40,14,'N');rect(g,26,22,40,23,'J');
      rect(g,30,14,30,23,'J');rect(g,36,14,36,23,'J');
      rect(g,40,15,41,22,'J');
      setclip(g,33,17,'R');setclip(g,34,18,'r');
      // rebar
      line(g,1,20,20,6,'r');line(g,2,21,21,7,'R');line(g,24,4,38,12,'r');
      // front face
      rect(g,3,24,40,25,'D');
      // lid discs
      rect(g,30,6,35,10,'I');rect(g,30,6,35,6,'N');rect(g,30,10,35,10,'J');
    }else{
      rect(g,4,10,38,23,'M');
      var y;for(y=11;y<23;y+=3)rect(g,5,y,37,y,'D');
      rect(g,4,10,38,10,'L');
      rect(g,8,4,22,14,'I');rect(g,8,4,22,4,'N');rect(g,8,5,8,14,'N');rect(g,22,5,22,14,'J');rect(g,9,14,22,14,'J');
      rect(g,24,7,34,16,'R');rect(g,24,7,34,7,'L');rect(g,24,8,24,16,'r');rect(g,34,8,34,16,'r');
      line(g,2,6,14,22,'r');line(g,26,22,42,11,'R');line(g,27,22,43,12,'r');
      rect(g,4,24,38,25,'D');
      setclip(g,15,9,'a');setclip(g,16,10,'a');setclip(g,30,12,'a');
    }
    if(rng()<0)g[0][0]='.';
    outlineFrom(g,'K');
    return toRows(g);
  }
  // palletCluster 40x30: two pallet stacks -- one bare, one of wrapped ash
  // sacks -- and a pallet jack left in the loading position.
  function makePalletCluster(){
    var g=mkGrid(40,30),x,y;
    // bare pallet stack (top slats run along y)
    rect(g,2,4,17,17,'M');for(x=2;x<=17;x++){if(x%3===2)rect(g,x,4,x,17,'D');}
    rect(g,2,4,17,4,'L');rect(g,2,5,2,17,'L');
    rect(g,2,18,17,23,'D');for(y=18;y<=23;y+=2)rect(g,2,y,17,y,'K');rect(g,5,19,6,22,'K');rect(g,13,19,14,22,'K');
    // sack stack
    rect(g,19,2,37,18,'M');
    [[19,2],[25,2],[31,2],[19,8],[25,8],[31,8],[19,13],[25,13],[31,13]].forEach(function(p,i){
      rect(g,p[0],p[1],p[0]+5,p[1]+(i<6?4:4),'s');
      rect(g,p[0],p[1],p[0]+5,p[1],'S');rect(g,p[0]+5,p[1]+1,p[0]+5,p[1]+4,'a');rect(g,p[0],p[1]+4,p[0]+5,p[1]+4,'a');
      setclip(g,p[0]+2,p[1]+2,'a');
    });
    rect(g,19,18,37,23,'D');for(y=19;y<=23;y+=2)rect(g,19,y,37,y,'K');rect(g,22,19,23,22,'K');rect(g,33,19,34,22,'K');
    // pallet jack forks under the sacks, handle out front
    rect(g,24,24,26,26,'I');rect(g,31,24,33,26,'I');rect(g,24,26,33,26,'J');
    rect(g,28,25,29,28,'N');rect(g,26,28,31,28,'J');
    outlineFrom(g,'k');
    return toRows(g);
  }
  // ashSkip 40x28 [0,1]: open steel skip half-full of ash and clinker.
  // ashSkipWarm 40x28: the same skip beside the furnace, clinker still holding heat.
  function skipCore(variant,warm){
    var g=mkGrid(40,28),rng=mulberry32(600+variant+(warm?7:0)),x,y;
    bevel(g,1,2,38,21,'K','H','L','D');
    rect(g,3,4,36,19,'K');
    rect(g,4,5,35,18,'d');
    // heap: mound centred slightly right
    for(y=5;y<=18;y++)for(x=4;x<=35;x++){
      var d=Math.sqrt(((x-(variant?17:22))/15)*((x-(variant?17:22))/15)+((y-12)/8)*((y-12)/8));
      if(d<1){var r=rng();g[y][x]=d<.45?(r<.25?'s':'a'):(r<.5?'a':'d');}
    }
    // clinker lumps
    [[12,9],[20,8],[27,13],[15,14],[24,11]].forEach(function(p){setclip(g,p[0],p[1],'K');setclip(g,p[0]+1,p[1],'s');setclip(g,p[0],p[1]+1,'a');});
    if(warm){[[21,10],[25,14],[18,13]].forEach(function(p,i){setclip(g,p[0],p[1],'e');setclip(g,p[0]+1,p[1],i===0?'O':'o');setclip(g,p[0],p[1]+1,'e');});}
    // front face with lifting lugs and hazard chevrons
    rect(g,1,22,38,26,'D');rect(g,1,22,38,22,'M');rect(g,1,27,38,27,'K');
    rect(g,0,22,0,27,'K');rect(g,39,22,39,27,'K');
    for(x=4;x<36;x++)if(pmod(x,6)<3)setclip(g,x,24,'Y');
    rect(g,0,8,1,12,'M');rect(g,38,8,39,12,'M');setclip(g,0,8,'K');setclip(g,39,12,'K');
    return toRows(g);
  }
  // drumCluster 32x26: four upright drums (one open, ash-filled) and a leaking one on its side.
  function makeDrumCluster(){
    var g=mkGrid(32,26);
    function drum(cx,cy,open){
      disc(g,cx,cy,5,5,'K');disc(g,cx,cy,4,4,'M');disc(g,cx-1,cy-1,2,2,'L');
      if(open){disc(g,cx,cy,3,3,'D');setclip(g,cx,cy,'B');}else{setclip(g,cx+2,cy-2,'H');rect(g,cx-3,cy,cx+3,cy,'D');}
    }
    drum(6,6,false);drum(17,6,true);drum(6,17,false);
    // tipped drum
    rect(g,13,14,28,21,'K');rect(g,14,15,27,20,'R');rect(g,14,15,27,15,'L');rect(g,14,20,27,20,'r');
    rect(g,18,15,18,20,'r');rect(g,23,15,23,20,'r');rect(g,28,15,29,20,'K');setclip(g,29,17,'D');
    // dark spill (oil, not fire) from the bung
    rect(g,30,19,31,23,'B');rect(g,26,22,31,24,'B');
    rect(g,1,23,11,24,'D');
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
    sawtoothRoof_h:{variants:[makeSawtoothH(0),makeSawtoothH(1)],pal:ROOF_PAL,anchor:'tile',note:'ROOF 32x32 sawtooth shed roof, ridges along x, one tooth per 32 rows (ridge cap row 0, north-light glazing rows 1-5, gutter row 6, sheet slope 7-31); seamless both axes; [1] two broken panes'},
    sawtoothRoof_v:{variants:[makeSawtoothV(0),makeSawtoothV(1)],pal:ROOF_PAL,anchor:'tile',note:'ROOF 32x32 sawtooth roof, ridges along y (transposed _h); seamless both axes'},
    monitorRoof_h:{variants:[makeMonitorH(0),makeMonitorH(1)],pal:ROOF_PAL,anchor:'tile',note:'ROOF 32x48 raised monitor spine along x with clerestory glazing both sides; tiles along x; top/bottom rows continue metalRoof_h; [1] broken panes'},
    monitorRoof_v:{variants:[makeMonitorV(0),makeMonitorV(1)],pal:ROOF_PAL,anchor:'tile',note:'ROOF 48x32 monitor spine along y; tiles along y; pairs with metalRoof_v'},
    metalRoof_h:{variants:[makeMetalRoofH(0),makeMetalRoofH(1),makeMetalRoofH(2)],pal:ROOF_PAL,anchor:'tile',note:'ROOF 32x32 corrugated sheet field, ribs along y, sheet lap on row 0; seamless both axes; [1] grimy roof-light panel, [2] patch plate + fastener rust'},
    metalRoof_v:{variants:[makeMetalRoofV(0),makeMetalRoofV(1),makeMetalRoofV(2)],pal:ROOF_PAL,anchor:'tile',note:'ROOF 32x32 corrugated sheet field, ribs along x (transposed _h); seamless both axes'},
    stackTop:{rows:makeStackTop(),pal:STACK_PAL,anchor:'center',light:{r:34,col:'#ff7b35',a:'18'},note:'ROOF PROP 28x28 flue stack seen from above, furnace hall only; bore holds a dim residual ember (the plant\'s only warm spot)'},
    // ---- FACADE (anchor tile, inside the building edge; _h south face street at bottom, _v east face street at right) ----
    corrugatedWall_h:{variants:[wallCore(false,0),wallCore(false,1)],pal:WALL_PAL,anchor:'tile',note:'FACADE 32x20 corrugated cladding, flashing rows 0-3, concrete plinth 17-18, ground row 19; tiles along x; [1] fastener rust streak + dent'},
    corrugatedWall_v:{variants:[wallCore(true,0),wallCore(true,1)],pal:WALL_PAL,anchor:'tile',note:'FACADE 12x32 corrugated cladding, flashing cols 0-2, plinth col 10, ground col 11; tiles along y'},
    loadingDoor_h:{variants:[loadingDoorCore(false,0),loadingDoorCore(false,1)],pal:DOOR_PAL,anchor:'tile',note:'FACADE 64x20 broad roller loading door in cladding (replaces two corrugatedWall_h tiles); [0] shut, [1] jammed half-up with a pallet edge in the dark bay'},
    loadingDoor_v:{variants:[loadingDoorCore(true,0),loadingDoorCore(true,1)],pal:DOOR_PAL,anchor:'tile',note:'FACADE 12x64 loading door on an east face (replaces two corrugatedWall_v tiles); [0] shut, [1] half-up'},
    workshopFront_h:{variants:[workshopCore(false,0),workshopCore(false,1)],pal:SHOP_PAL,anchor:'tile',note:'FACADE 48x20 small workshop: block wall, 26-wide roller door, wired window, steel door; [0] shut, [1] roller half-up, cracked window'},
    workshopFront_v:{variants:[workshopCore(true,0),workshopCore(true,1)],pal:SHOP_PAL,anchor:'tile',note:'FACADE 12x48 small workshop on an east face; [0] shut, [1] roller half-up'},
    officeFront_h:{variants:[officeCore(false,0),officeCore(false,1)],pal:OFFICE_PAL,anchor:'tile',note:'FACADE 48x20 dispatch/maintenance office: panel wall, long window with half-drawn blinds, glazed door with taped step, call panel; [1] shift board in the glass + cracked pane'},
    officeFront_v:{variants:[officeCore(true,0),officeCore(true,1)],pal:OFFICE_PAL,anchor:'tile',note:'FACADE 12x48 dispatch office on an east face'},
    // ---- FLAT ----
    loadingDock_h:{rows:dockCore(false),pal:DOCK_PAL,anchor:'tile',note:'FLAT 64x24 dock apron directly south of loadingDoor_h (same x): slab, lowered dock plate, amber edge paint, rubber bumpers on the drop face; walkable; optional solids = bumpers 8x8 at x5 and x51, y16'},
    loadingDock_v:{rows:dockCore(true),pal:DOCK_PAL,anchor:'tile',note:'FLAT 24x64 dock apron directly east of loadingDoor_v (same y); bumpers 8x8 at y5 and y51, x16'},
    ashSpill:{variants:[makeAshSpill(0),makeAshSpill(1)],pal:SPILL_PAL,anchor:'center',note:'FLAT 48x28 dropped ash drift with clinker specks and a jack drag mark'},
    // ---- OVERHEAD (non-colliding, drawn above actors) ----
    pipe_h:{variants:[makePipeH(0),makePipeH(1),makePipeH(2)],pal:PIPE_PAL,anchor:'tile',note:'OVERHEAD 32x12 twin pipe run along x; tiles along x; [1] flanges + clamp strap, [2] handwheel valve'},
    pipe_v:{variants:[makePipeV(0),makePipeV(1),makePipeV(2)],pal:PIPE_PAL,anchor:'tile',note:'OVERHEAD 12x32 twin pipe run along y; tiles along y'},
    pipeJoint:{mask:buildPipeJoint(),pal:PIPE_PAL,anchor:'tile',note:'OVERHEAD 12x12 pipe node, mask N|E|S|W=1|2|4|8: 5/10 straight, 3/6/9/12 mitred elbow, single bit blind-flange end, 0 and 3+ bits bolted manifold'},
    gantryBeam_h:{variants:[makeGantryH(0),makeGantryH(1)],pal:GANTRY_PAL,anchor:'tile',note:'OVERHEAD 32x14 twin I-beam crane girder with open lacing along x; tiles along x; [1] splice plates + load band'},
    gantryBeam_v:{variants:[makeGantryV(0),makeGantryV(1)],pal:GANTRY_PAL,anchor:'tile',note:'OVERHEAD 14x32 crane girder along y; tiles along y'},
    gantryTrolley_h:{rows:makeTrolleyH(),pal:GANTRY_PAL,anchor:'center',note:'OVERHEAD 24x24 hoist trolley stopped on a gantryBeam_h (centre on the beam centreline): end carriages, cable drum, motor, hook block'},
    gantryTrolley_v:{rows:makeTrolleyV(),pal:GANTRY_PAL,anchor:'center',note:'OVERHEAD 24x24 hoist trolley on a gantryBeam_v'},
    // ---- SOLID ----
    pipeBent_h:{rows:toRows(bentCore()),pal:PIPE_PAL,anchor:'center',note:'SOLID 16x28 goalpost support under a pipe_h run (centre on the run centreline); collide only the two column pads 14x7 at rows 0-6 and 21-27; the beam between is under the pipes'},
    pipeBent_v:{rows:toRows(transpose(bentCore())),pal:PIPE_PAL,anchor:'center',note:'SOLID 28x16 goalpost support under a pipe_v run; collide the pads 7x14 at cols 0-6 and 21-27'},
    gantryPier:{rows:makeGantryPier(),pal:GANTRY_PAL,anchor:'center',note:'SOLID 24x24 gantry leg footing + box column, amber guard; place under each gantryBeam end; collide 18x18 centred'},
    conveyor_h:{variants:[makeConveyorH(0),makeConveyorH(1)],pal:CONV_PAL,anchor:'tile',note:'SOLID cover 32x16 belt conveyor segment along x; tiles along x; [0] bare belt, [1] ash and clinker left on the belt'},
    conveyor_v:{variants:[makeConveyorV(0),makeConveyorV(1)],pal:CONV_PAL,anchor:'tile',note:'SOLID cover 16x32 belt conveyor along y; tiles along y'},
    conveyorHead_h:{variants:[makeHeadH(0),makeHeadH(1)],pal:CONV_PAL,anchor:'tile',note:'SOLID 16x16 head drum + motor ending a conveyor_h run; [0] end on the east, [1] end on the west'},
    conveyorHead_v:{variants:[makeHeadV(0),makeHeadV(1)],pal:CONV_PAL,anchor:'tile',note:'SOLID 16x16 head drum ending a conveyor_v run; [0] end on the south, [1] end on the north'},
    hopper:{rows:makeHopper(),pal:HOPPER_PAL,anchor:'center',note:'SOLID 32x32 feed hopper over a conveyor tail (centre on the belt, overlapping 8 into the first segment); ash-choked throat'},
    scrapPile:{variants:[makeScrapPile(0),makeScrapPile(1)],pal:SCRAP_PAL,anchor:'feet',note:'SOLID cover 44x28 scrap cluster: offcut sheets, rebar, crushed drum; collide 40x14 at the foot'},
    palletCluster:{rows:makePalletCluster(),pal:PALLET_PAL,anchor:'feet',note:'SOLID cover 40x30 bare pallet stack + wrapped ash sacks + pallet jack; collide 38x16 at the foot (jack handle rows 24-28 are walk-over)'},
    ashSkip:{variants:[skipCore(0,false),skipCore(1,false)],pal:SKIP_PAL,anchor:'feet',note:'SOLID cover 40x28 steel skip half-full of cold ash/clinker; collide 38x16 at the foot'},
    ashSkipWarm:{rows:skipCore(0,true),pal:SKIPWARM_PAL,anchor:'feet',light:{r:30,col:'#ff7b35',a:'14'},note:'SOLID 40x28 the same skip beside the furnace only; three clinker cores still faintly warm'},
    drumCluster:{rows:makeDrumCluster(),pal:DRUM_PAL,anchor:'feet',note:'SOLID cover 32x26 three drums (one open) + one tipped with a dark oil leak; collide 30x14 at the foot'}
  });
})();
