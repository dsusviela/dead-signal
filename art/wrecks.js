// Dead Signal wrecks: abandoned/burnt vehicles left on the streets. One texel
// = one world unit (den 1). Anchor 'feet': sprite bottom-centre sits on the
// collision box's bottom-centre; sprite width == box width, sprite height ==
// box height + a roof overhang (the top-down 3/4 tilt lets you see the roof
// rising above the footprint). Light comes from the top: paint is lit near
// the roof, shaded toward the rocker/ground line; the last few rows are a
// dark ground-contact shadow band. Windows are glass D/M with one L glint.
// Burnt shells drop paint and glass entirely for basalt char + rust patches.
(function(){
  'use strict';
  var A=(typeof window!=='undefined'?window:globalThis).DSArt;
  var MAT=A.MAT;

  // ---- grid helpers (art/loot.js style: build on a grid, emit rows) ----
  function mkGrid(w,h){var g=[],y,x,row;for(y=0;y<h;y++){row=[];for(x=0;x<w;x++)row.push('.');g.push(row);}return g;}
  function setclip(g,x,y,ch){if(y>=0&&y<g.length&&x>=0&&x<g[0].length)g[y][x]=ch;}
  function rect(g,x0,y0,x1,y1,ch){var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)setclip(g,x,y,ch);}
  function toRows(g){return g.map(function(r){return r.join('');});}

  // cut a small staircase off each of the 4 corners of a rect (rounded-box look)
  function cutCorners(g,x0,y0,x1,y1,c){
    var x,y,dl,dr,dt,db;
    for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++){
      dl=x-x0;dr=x1-x;dt=y-y0;db=y1-y;
      if((dl<c&&dt<c&&dl+dt<c)||(dr<c&&dt<c&&dr+dt<c)||(dl<c&&db<c&&dl+db<c)||(dr<c&&db<c&&dr+db<c))setclip(g,x,y,'.');
    }
  }
  // 1-texel K outline wherever a filled texel touches transparent or the grid edge
  function outlineFromFill(g,K){
    var h=g.length,w=g[0].length,x,y,copy=g.map(function(r){return r.slice();});
    function at(px,py){return px<0||py<0||px>=w||py>=h?'.':copy[py][px];}
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      if(copy[y][x]==='.')continue;
      if(at(x-1,y)==='.'||at(x+1,y)==='.'||at(x,y-1)==='.'||at(x,y+1)==='.')g[y][x]=K;
    }
  }
  // a wheel/well patch: dark rounded rect with a 1px K ring and a small rim tick
  function wheelPatch(g,x0,y0,w,h,D,K,rim,flat){
    var x1=x0+w-1,y1=y0+h-1,x,y;
    rect(g,x0,y0,x1,y1,D);
    cutCorners(g,x0,y0,x1,y1,2);
    for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++){
      if(g[y][x]==='.')continue;
      if(x===x0||x===x1||y===y0||y===y1)g[y][x]=K;
    }
    cutCorners(g,x0,y0,x1,y1,2);
    if(flat)rect(g,x0+2,y0+Math.floor(h/2),x1-2,y0+Math.floor(h/2),rim);
    else{setclip(g,x0+Math.floor(w/2),y0+Math.floor(h/2)-1,rim);setclip(g,x0+Math.floor(w/2),y0+Math.floor(h/2)+1,rim);}
  }
  // an open panel: a filled rect with a thin K ring, distinct from a wheel well
  function panelHole(g,x0,y0,x1,y1,fill,K){
    rect(g,x0,y0,x1,y1,fill);
    var x,y;
    for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)if(x===x0||x===x1||y===y0||y===y1)setclip(g,x,y,K);
  }
  // a few small scattered rust blotches (never one big saturated block)
  function rustFleck(g,cx,cy,R,X,Y){
    setclip(g,cx,cy,R);setclip(g,cx+1,cy,R);setclip(g,cx,cy+1,R);setclip(g,cx-1,cy+1,R);setclip(g,cx+1,cy+1,X);
    setclip(g,cx,cy-1,X);setclip(g,cx-1,cy,X);
    setclip(g,cx+1,cy-1,Y);
  }

  // =====================================================================
  // car 96x58 [96x48] / 48x106 [48x96]: one saloon body in the game's
  // oblique 3/4 view (camera south of the car, looking down), NOSE-FIRST at
  // low x (_h) / low y (_v); the renderer mirrors it for the other heading.
  //   _h: top plane (hood | windshield | roof | rear window | trunk) rows
  //       4-35, the south side face (doors, wheel arches, tyres) rows 36-57.
  //       The greenhouse is the hull of the roof rect lifted above its base
  //       on the deck, so windshield and rear window are slanted quads and
  //       the side glass is a trapezoid split by the B-pillar.
  //   _v: top plane rows 0-86 (push bar, hood, thin windshield, roof, tall
  //       rear window, trunk), the south rear face rows 87-100 (taillights,
  //       plate, bumper) and the rear tyres under it; front/rear tyres peek
  //       out along both flanks.
  // kinds: 'police' black-and-white cruiser (black hood/trunk/fenders, white
  // roof and doors, dead red/blue lightbar, push bar, small door shield),
  // 'hatch' dull blue-grey hatchback, 'burnt' basalt+rust shell.
  // =====================================================================
  var CAR_W=96,CAR_H_=58,CAR_VW=48,CAR_VH=106;
  function hline(g,x0,x1,y,ch){for(var x=x0;x<=x1;x++)setclip(g,x,y,ch);}
  function vline(g,x,y0,y1,ch){for(var y=y0;y<=y1;y++)setclip(g,x,y,ch);}
  function line(g,x0,y0,x1,y1,ch){
    var dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,e=dx+dy,e2;
    for(;;){setclip(g,x0,y0,ch);if(x0===x1&&y0===y1)break;e2=2*e;if(e2>=dy){e+=dy;x0+=sx;}if(e2<=dx){e+=dx;y0+=sy;}}
  }
  // replace one letter by another inside a rect (repaint a region of a layer)
  function swap(g,x0,y0,x1,y1,from,to){var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)if(y>=0&&y<g.length&&x>=0&&x<g[0].length&&g[y][x]===from)g[y][x]=to;}
  function carLetters(kind){
    if(kind==='police')return {top:'M',hi:'L',side:'D',low:'K',roof:'W',roofS:'w',door:'V',doorS:'v',glass:'G',glint:'g',trim:'H',hub:'L',tyre:'D'};
    if(kind==='hatch')return {top:'P',hi:'L',side:'p',low:'q',roof:'P',roofS:'p',door:'p',doorS:'q',glass:'G',glint:'g',trim:'H',hub:'L',tyre:'D'};
    return {top:'L',hi:'H',side:'M',low:'D',roof:'L',roofS:'H',door:'M',doorS:'D',glass:'K',glint:'D',trim:'M',hub:'X',tyre:'K'};
  }
  // side-on tyre in an arch: K well, K ring, D rubber, steel hub with a lit top
  function tyreSide(g,cx,y0,w,h,c,hubL,hubH,rub,flat){
    var x0=cx-(w>>1),x1=x0+w-1,y1=y0+h-1,x,y;
    rect(g,x0,y0,x1,y1,rub);cutCorners(g,x0,y0,x1,y1,flat?3:4);
    for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++){if(g[y][x]==='.')continue;
      if(x===x0||x===x1||y===y0||y===y1||g[y][x-1]==='.'||g[y][x+1]==='.'||g[y-1]&&g[y-1][x]==='.'||g[y+1]&&g[y+1][x]==='.')g[y][x]='K';}
    cutCorners(g,x0,y0,x1,y1,flat?3:4);
    var hy=flat?y0+Math.floor(h/2):y0+Math.floor(h/2)-1;
    if(hubL){rect(g,cx-2,hy-2,cx+2,hy+2,hubL);setclip(g,cx-2,hy-2,rub);setclip(g,cx+2,hy-2,rub);setclip(g,cx-2,hy+2,rub);setclip(g,cx+2,hy+2,rub);
      rect(g,cx-1,hy-1,cx+1,hy+1,'K');setclip(g,cx,hy-2,hubH);setclip(g,cx-1,hy-2,hubH);}
  }
  // round a rect's corners by painting them with the surrounding letter (no transparent holes)
  function roundIn(g,x0,y0,x1,y1,ch){[[x0,y0,1,1],[x1,y0,-1,1],[x0,y1,1,-1],[x1,y1,-1,-1]].forEach(function(c){setclip(g,c[0],c[1],ch);setclip(g,c[0]+c[2],c[1],ch);setclip(g,c[0],c[1]+c[3],ch);});}
  function makeCarH(kind){
    var g=mkGrid(CAR_W,CAR_H_),C=carLetters(kind),police=kind==='police',hatch=kind==='hatch',burnt=kind==='burnt';
    var x,y,t,a,b;
    // roof rect and the greenhouse base on the deck
    var rx0=42,rx1=hatch?74:66,ry0=10,ry1=22,bx0=28,bx1=hatch?84:80,by0=17,by1=31;
    // under-body shadow and body masses
    rect(g,7,50,88,53,'K');
    rect(g,3,15,92,35,C.top);cutCorners(g,3,15,92,35,4);
    rect(g,2,36,93,51,C.side);
    hline(g,3,92,36,C.hi);                  // shoulder crease catches the light
    rect(g,2,48,93,51,C.low);               // rocker in shadow
    if(police){                             // white doors + white door tops
      rect(g,31,36,bx1-3,47,C.door);hline(g,31,bx1-3,36,C.roofS);rect(g,31,44,bx1-3,47,C.doorS);
      rect(g,bx0+2,33,bx1-3,35,C.roofS);
    }
    // bumpers wrap the ends
    rect(g,0,35,3,47,C.side);rect(g,92,35,95,47,C.side);
    hline(g,0,3,35,C.hi);hline(g,92,95,35,C.hi);
    // greenhouse: windshield quad, rear window quad, side glass trapezoid, roof
    for(x=bx0;x<=rx0;x++){t=(rx0-x)/(rx0-bx0);a=Math.round(ry0+(by0-ry0)*t);b=Math.round(ry1+(by1-ry1)*t);vline(g,x,a,b,C.glass);}
    for(x=rx1;x<=bx1;x++){t=(x-rx1)/(bx1-rx1);a=Math.round(ry0+(by0-ry0)*t);b=Math.round(ry1+(by1-ry1)*t);vline(g,x,a,b,C.glass);}
    for(y=ry1;y<=by1;y++){t=(y-ry1)/(by1-ry1);hline(g,Math.round(rx0-(rx0-bx0)*t),Math.round(rx1+(bx1-rx1)*t),y,C.glass);}
    rect(g,rx0,ry0,rx1,ry1,C.roof);roundIn(g,rx0,ry0,rx1,ry1,C.glass);
    hline(g,rx0+1,rx1-1,ry1,C.roofS);vline(g,rx1,ry0+2,ry1,C.roofS);
    line(g,rx0,ry1,bx0,by1,C.roofS);line(g,rx1,ry1,bx1,by1,C.roofS);                  // A / C pillars
    line(g,rx0,ry0,bx0,by0,'K');line(g,rx1,ry0,bx1,by0,'K');                          // top edges of the glass
    t=hatch?60:54;vline(g,t,ry1,by1,C.roofS);vline(g,t+1,ry1+1,by1,C.roofS);            // B-pillar
    hline(g,bx0,bx1,by1,'K');                                                          // beltline
    if(!burnt){
      line(g,rx0-3,ry0+4,rx0-7,ry0+9,C.glint);line(g,rx0-2,ry0+5,rx0-6,ry0+10,C.glint);   // windshield sheen
      hline(g,rx0+3,rx0+6,ry1+2,C.glint);hline(g,t+4,t+7,ry1+2,C.glint);
    }
    // wheel wells and tyres
    var fx=21,bxw=hatch?76:74;
    [fx,bxw].forEach(function(cx){rect(g,cx-10,41,cx+10,51,'K');setclip(g,cx-10,41,C.side);setclip(g,cx-9,41,C.side);setclip(g,cx-10,42,C.side);setclip(g,cx+10,41,C.side);setclip(g,cx+9,41,C.side);setclip(g,cx+10,42,C.side);});
    if(police){for(y=41;y<=42;y++)for(x=bxw-10;x<=bxw+10;x++)if(g[y][x]===C.door||g[y][x]===C.doorS)g[y][x]=C.side;}
    if(burnt){
      tyreSide(g,fx,45,15,13,4,'X','Y','D',true);tyreSide(g,bxw,45,15,13,4,'X','Y','D',true);
    }else{
      tyreSide(g,fx,police?45:43,police?19:17,police?13:15,4,C.hub,C.trim,C.tyre,police);
      tyreSide(g,bxw,hatch?46:43,hatch?19:17,hatch?12:15,4,C.hub,C.trim,C.tyre,hatch);
    }
    // door seams, handles, lights
    vline(g,31,33,47,'K');vline(g,t,33,47,'K');vline(g,bx1-3,33,47,'K');
    if(!burnt){hline(g,t-6,t-5,39,C.trim);hline(g,bx1-9,bx1-8,39,C.trim);}
    if(!burnt){rect(g,1,37,2,39,C.trim);setclip(g,1,39,C.hub);rect(g,4,17,5,19,C.hub);rect(g,4,31,5,33,C.hub);}
    rect(g,93,37,94,40,burnt?'K':'R');if(!burnt){rect(g,90,17,91,19,'r');rect(g,90,31,91,33,'r');}
    // hood / trunk panel lines on the deck
    if(!burnt){hline(g,6,bx0-4,16,C.hi);vline(g,bx0-2,18,31,'K');vline(g,bx1+3,18,31,'K');}
    if(police){
      // push bar in front of the nose
      vline(g,0,27,47,'K');vline(g,1,27,47,C.side);vline(g,2,27,47,'K');setclip(g,1,28,C.trim);setclip(g,1,29,C.trim);
      // lightbar across the roof: red (far) and blue (near) lenses, both dead
      rect(g,50,7,55,19,'K');rect(g,51,8,54,12,'R');rect(g,51,14,54,18,'B');hline(g,51,54,8,'r');hline(g,51,54,14,'b');
      rect(g,50,20,55,21,'D');
      // restrained shield on the front door
      rect(g,37,38,40,41,'S');setclip(g,37,41,C.door);setclip(g,40,41,C.door);hline(g,38,39,42,'S');
      // day 9: spiderweb crack, driver door sprung, grime on the lower doors
      line(g,35,21,31,25,'K');line(g,35,21,38,16,'K');line(g,35,21,36,27,'K');
      vline(g,32,37,47,'K');vline(g,33,37,46,C.roofS);
      rect(g,58,45,60,46,'v');rect(g,66,44,67,46,'v');rect(g,44,45,45,46,'v');
    }
    if(hatch){
      // rear door hanging open toward the camera, cabin interior dark behind it
      rect(g,t+2,36,bx1-4,47,'K');rect(g,t+4,38,bx1-6,45,'D');hline(g,t+4,bx1-6,38,C.top);
      for(y=36;y<=56;y++){a=t+2+Math.floor((y-36)/4);rect(g,a,y,a+4,y,C.door);setclip(g,a,y,'K');setclip(g,a+5,y,'K');}
      hline(g,t+2,t+7,36,'K');hline(g,t+7,t+12,56,'K');rect(g,t+4,39,t+6,43,C.glass);
      rect(g,6,20,9,21,'p');rect(g,86,25,88,26,'p');
    }
    if(burnt){
      rustFleck(g,10,22,'R','X','Y');rustFleck(g,86,20,'R','X','Y');rustFleck(g,50,10,'R','X','Y');rustFleck(g,40,42,'R','X','Y');rustFleck(g,66,39,'R','X','Y');
      // warped hood lifted off its latch at the nose
      line(g,4,20,20,24,'K');line(g,4,19,19,23,'L');
      rect(g,58,24,64,29,'D');rect(g,33,24,37,28,'D');
    }
    cutCorners(g,0,0,CAR_W-1,CAR_H_-1,1);
    outlineFromFill(g,'K');
    return toRows(g);
  }
  // back-on tyre peeking under the rear bumper / out of a flank
  function tyreEnd(g,x0,y0,x1,y1,rub){rect(g,x0,y0,x1,y1,'K');rect(g,x0+1,y0,x1-1,y1-1,rub);for(var y=y0+1;y<y1;y+=2)hline(g,x0+2,x1-2,y,'K');}
  function makeCarV(kind){
    var g=mkGrid(CAR_VW,CAR_VH),C=carLetters(kind),police=kind==='police',hatch=kind==='hatch',burnt=kind==='burnt';
    var x,y,t,a,b,W1=CAR_VW-1;
    // flank tyres (front, rear) peeking out on both sides
    [[12,28],[64,80]].forEach(function(r){tyreEnd(g,0,r[0],4,r[1],burnt?'D':C.tyre);tyreEnd(g,W1-4,r[0],W1,r[1],burnt?'D':C.tyre);});
    if(hatch){rect(g,W1-4,64,W1,80,'.');tyreEnd(g,W1-5,66,W1,80,C.tyre);}
    // top plane
    rect(g,3,2,W1-3,86,C.top);cutCorners(g,3,2,W1-3,86,6);
    rect(g,3,80,W1-3,86,C.top);
    // rear face (south end): trunk lip, lights, plate, bumper
    rect(g,2,87,W1-2,99,C.side);hline(g,3,W1-3,87,C.hi);
    rect(g,1,95,W1-1,99,C.side);hline(g,1,W1-1,95,C.hi);rect(g,2,99,W1-2,100,C.low);
    rect(g,4,89,10,92,burnt?'K':'R');rect(g,W1-10,89,W1-4,92,burnt?'K':'R');
    if(!burnt){hline(g,5,9,89,'r');hline(g,W1-9,W1-5,89,'r');rect(g,19,90,28,93,police?C.door:C.roofS);hline(g,19,28,93,'K');}
    rect(g,8,101,W1-8,102,'K');
    tyreEnd(g,5,99,13,105,burnt?'D':C.tyre);
    if(police){tyreEnd(g,W1-14,101,W1-4,105,C.tyre);}else tyreEnd(g,W1-13,99,W1-5,105,burnt?'D':C.tyre);
    // hood: centre crease, headlamps, panel gap
    if(!burnt){vline(g,23,5,24,C.hi);rect(g,5,4,10,6,C.trim);rect(g,W1-10,4,W1-5,6,C.trim);hline(g,6,9,6,C.hub);hline(g,W1-9,W1-6,6,C.hub);hline(g,6,W1-6,26,'K');}
    // greenhouse
    var ws0=28,rf0=34,rf1=hatch?66:57,rw1=hatch?76:68;
    for(y=ws0;y<rf0;y++){t=(y-ws0)/(rf0-ws0);hline(g,Math.round(7+3*t),Math.round(W1-7-3*t),y,C.glass);}  // windshield, thin
    for(y=rf1+1;y<=rw1;y++){t=(y-rf1)/(rw1-rf1);hline(g,Math.round(10-3*t),Math.round(W1-10+3*t),y,C.glass);} // rear window, tall
    rect(g,6,rf0-1,9,rf1+4,C.glass);rect(g,W1-9,rf0-1,W1-6,rf1+4,C.glass);        // side glass seen over the tumblehome
    rect(g,10,rf0,W1-10,rf1,C.roof);roundIn(g,10,rf0,W1-10,rf1,C.glass);
    hline(g,11,W1-11,rf1,C.roofS);vline(g,10,rf0+2,rf1,C.roofS);vline(g,W1-10,rf0+2,rf1,C.roofS);
    hline(g,7,W1-7,ws0,'K');hline(g,7,W1-7,rw1+1,'K');
    t=Math.round((rf0+rf1)/2)+2;hline(g,6,9,t,C.roofS);hline(g,W1-9,W1-6,t,C.roofS);  // B-pillars
    if(police){rect(g,3,30,5,rf1+6,C.door);rect(g,W1-5,30,W1-3,rf1+6,C.door);vline(g,3,30,rf1+6,C.roofS);vline(g,W1-3,30,rf1+6,C.roofS);}
    if(!burnt){hline(g,9,13,ws0+2,C.glint);hline(g,12,15,rf1+3,C.glint);hline(g,13,16,rf1+4,C.glint);}
    if(!burnt)hline(g,6,W1-6,rw1+3,'K');   // trunk / hatch lid gap
    if(police){
      // push bar across the nose
      hline(g,9,W1-9,0,'K');hline(g,9,W1-9,1,C.side);hline(g,9,W1-9,2,'K');setclip(g,10,1,C.trim);setclip(g,11,1,C.trim);
      rect(g,9,0,10,3,'K');rect(g,W1-10,0,W1-9,3,'K');
      // lightbar across the roof
      rect(g,11,37,W1-11,42,'K');rect(g,12,38,22,41,'R');rect(g,25,38,W1-12,41,'B');hline(g,12,22,38,'r');hline(g,25,W1-12,38,'b');
      hline(g,11,W1-11,43,'D');
      // day 9: cracked rear window, grime on the trunk lid
      line(g,30,62,25,67,'K');line(g,30,62,36,59,'K');line(g,30,62,32,67,'K');
      rect(g,14,78,16,79,'q');rect(g,30,83,31,84,'q');
    }
    if(hatch){
      // smashed hatch glass: dark hole with shards, rear-right tyre flat
      rect(g,14,rf1+3,W1-14,rw1-1,'K');line(g,14,rf1+3,19,rw1-1,C.glint);hline(g,W1-16,W1-14,rf1+3,C.glint);
      rect(g,8,14,10,15,'p');rect(g,36,50,37,52,'p');
    }
    if(burnt){
      rustFleck(g,9,12,'R','X','Y');rustFleck(g,38,18,'R','X','Y');rustFleck(g,23,45,'R','X','Y');rustFleck(g,12,76,'R','X','Y');rustFleck(g,36,82,'R','X','Y');rustFleck(g,24,92,'R','X','Y');
      line(g,5,8,22,14,'K');line(g,5,7,21,13,'L');   // warped hood edge
      rect(g,16,60,22,65,'D');
    }
    outlineFromFill(g,'K');
    return toRows(g);
  }

  // =====================================================================
  // van 110x62 [110x52] / 52x120 [52x110]: off-white box body, olive stripe,
  // rear doors open. letters: K,D,M,L,H (concrete) O olive stripe, G glass
  // dark, g glass glint
  // =====================================================================
  function makeVanH(){
    var W_=110,H_=62,c=3;
    var g=mkGrid(W_,H_);
    var K='K',D='D',M='M',L='L',H='H',O='O',G='G',GG='g';
    rect(g,0,0,W_-1,49,L);
    rect(g,0,50,W_-1,H_-1,M);
    rect(g,0,H_-3,W_-1,H_-1,D);
    rect(g,6,10,22,24,G);setclip(g,8,11,GG);
    rect(g,8,28,103,32,O);
    rect(g,100,8,109,49,D);
    rect(g,100,8,100,49,K);setclip(g,100,28,H);setclip(g,100,32,H);
    setclip(g,2,25,H);setclip(g,3,25,H);setclip(g,4,25,H);
    wheelPatch(g,16,48,14,13,D,K,H,false);
    wheelPatch(g,80,48,14,13,D,K,H,false);
    cutCorners(g,0,0,W_-1,H_-1,c);
    outlineFromFill(g,K);
    return toRows(g);
  }
  function makeVanV(){
    var W_=52,H_=120,c=3;
    var g=mkGrid(W_,H_);
    var K='K',D='D',M='M',L='L',H='H',O='O',G='G',GG='g';
    rect(g,0,0,W_-1,107,L);
    rect(g,0,4,47,17,D);
    rect(g,0,4,47,4,K);setclip(g,20,4,H);setclip(g,26,4,H);
    rect(g,8,46,43,50,O);
    rect(g,8,85,43,99,G);setclip(g,10,86,GG);
    rect(g,0,100,W_-1,H_-1,M);
    rect(g,0,H_-3,W_-1,H_-1,D);
    setclip(g,2,20,H);setclip(g,2,21,H);setclip(g,2,22,H);
    wheelPatch(g,4,104,14,14,D,K,H,false);
    wheelPatch(g,34,104,14,14,D,K,H,false);
    cutCorners(g,0,0,W_-1,H_-1,c);
    outlineFromFill(g,K);
    return toRows(g);
  }
  function makeVanBurntH(){
    var W_=110,H_=62,c=3;
    var g=mkGrid(W_,H_);
    var K='K',D='D',M='M',L='L',R='R',X='X',Y='Y';
    rect(g,0,0,W_-1,49,M);
    rect(g,0,50,W_-1,H_-1,D);
    rect(g,0,H_-3,W_-1,H_-1,D);
    rect(g,6,10,22,24,K);
    rect(g,100,8,109,49,K);
    rustFleck(g,30,16,R,X,Y);rustFleck(g,55,35,R,X,Y);rustFleck(g,70,20,R,X,Y);rustFleck(g,90,40,R,X,Y);rustFleck(g,12,45,R,X,Y);
    setclip(g,0,16,'.');setclip(g,1,16,'.');setclip(g,0,17,'.');setclip(g,0,15,L);
    wheelPatch(g,16,48,14,13,D,K,R,false);
    wheelPatch(g,80,48,14,13,D,K,R,false);
    cutCorners(g,0,0,W_-1,H_-1,c);
    outlineFromFill(g,K);
    return toRows(g);
  }
  function makeVanBurntV(){
    var W_=52,H_=120,c=3;
    var g=mkGrid(W_,H_);
    var K='K',D='D',M='M',L='L',R='R',X='X',Y='Y';
    rect(g,0,0,W_-1,107,M);
    rect(g,0,4,47,17,K);
    rect(g,8,85,43,99,K);
    rustFleck(g,10,25,R,X,Y);rustFleck(g,40,30,R,X,Y);rustFleck(g,20,50,R,X,Y);rustFleck(g,45,65,R,X,Y);rustFleck(g,15,80,R,X,Y);
    rect(g,0,100,W_-1,H_-1,D);
    rect(g,0,H_-3,W_-1,H_-1,D);
    setclip(g,2,22,'.');setclip(g,3,22,'.');setclip(g,2,23,'.');setclip(g,2,21,L);
    wheelPatch(g,4,104,14,14,D,K,R,false);
    wheelPatch(g,34,104,14,14,D,K,R,false);
    cutCorners(g,0,0,W_-1,H_-1,c);
    outlineFromFill(g,K);
    return toRows(g);
  }

  // =====================================================================
  // bus 180x72 [180x60] / 60x190 [60x180]: muted teal-grey city bus, long
  // window strip, one smashed pane, roof hatch. letters: K,D,M,L (glass) H
  // (iron highlight)
  // =====================================================================
  function busPanes(g,x0,x1,y0,y1,step,gap,D,L,smashIdx,K,H){
    var x=x0,i=0,px1;
    while(x<x1){
      px1=Math.min(x+step-gap-1,x1);
      if(i===smashIdx){
        rect(g,x,y0,px1,y1,K);
        setclip(g,x+1,y0+1,H);setclip(g,x+2,y0+2,'.');setclip(g,x+3,y0+1,H);
      }else{
        rect(g,x,y0,px1,y1,D);
        setclip(g,x+1,y0+1,L);
      }
      x+=step;i++;
    }
  }
  function busPanesV(g,y0,y1,x0,x1,step,gap,D,L,smashIdx,K,H){
    var y=y0,i=0,py1;
    while(y<y1){
      py1=Math.min(y+step-gap-1,y1);
      if(i===smashIdx){
        rect(g,x0,y,x1,py1,K);
        setclip(g,x0+1,y+1,H);setclip(g,x0+2,y+2,'.');setclip(g,x0+1,y+3,H);
      }else{
        rect(g,x0,y,x1,py1,D);
        setclip(g,x0+1,y+1,L);
      }
      y+=step;i++;
    }
  }
  function makeBusH(){
    var W_=180,H_=72,c=5;
    var g=mkGrid(W_,H_);
    var K='K',D='D',M='M',L='L',H='H';
    rect(g,0,0,W_-1,13,L);
    rect(g,0,14,W_-1,49,M);
    rect(g,0,50,W_-1,H_-1,M);
    rect(g,0,H_-3,W_-1,H_-1,D);
    busPanes(g,8,171,17,32,20,2,D,L,3,K,H);
    rect(g,82,3,97,9,M);setclip(g,82,3,K);setclip(g,97,3,K);setclip(g,82,9,K);setclip(g,97,9,K);setclip(g,89,5,H);
    setclip(g,2,52,H);setclip(g,3,52,H);setclip(g,4,52,H);
    wheelPatch(g,30,58,17,13,D,K,H,false);
    wheelPatch(g,132,58,17,13,D,K,H,false);
    cutCorners(g,0,0,W_-1,H_-1,c);
    outlineFromFill(g,K);
    return toRows(g);
  }
  function makeBusV(){
    var W_=60,H_=190,c=5;
    var g=mkGrid(W_,H_);
    var K='K',D='D',M='M',L='L',H='H';
    rect(g,0,0,W_-1,9,L);
    rect(g,0,10,W_-1,178,M);
    rect(g,0,179,W_-1,H_-1,M);
    rect(g,0,H_-3,W_-1,H_-1,D);
    busPanesV(g,20,163,8,51,20,2,D,L,3,K,H);
    rect(g,22,3,37,9,M);setclip(g,22,3,K);setclip(g,37,3,K);setclip(g,22,9,K);setclip(g,37,9,K);setclip(g,29,5,H);
    setclip(g,2,12,H);setclip(g,2,13,H);setclip(g,2,14,H);
    wheelPatch(g,6,176,14,13,D,K,H,false);
    wheelPatch(g,38,176,14,13,D,K,H,false);
    cutCorners(g,0,0,W_-1,H_-1,c);
    outlineFromFill(g,K);
    return toRows(g);
  }
  function makeBusBurntH(){
    var W_=180,H_=72,c=5;
    var g=mkGrid(W_,H_);
    var K='K',D='D',M='M',L='L',R='R',X='X',Y='Y';
    rect(g,0,0,W_-1,13,M);
    rect(g,0,14,W_-1,49,D);
    rect(g,0,50,W_-1,H_-1,D);
    rect(g,0,H_-3,W_-1,H_-1,D);
    var x=8;while(x<171){rect(g,x,17,Math.min(x+17,171),32,K);x+=20;}
    rect(g,82,3,97,9,K);
    rustFleck(g,20,40,R,X,Y);rustFleck(g,60,43,R,X,Y);rustFleck(g,100,38,R,X,Y);rustFleck(g,140,45,R,X,Y);rustFleck(g,165,10,R,X,Y);rustFleck(g,14,8,R,X,Y);
    setclip(g,0,30,'.');setclip(g,1,30,'.');setclip(g,0,31,'.');setclip(g,2,29,'.');setclip(g,0,29,M);
    wheelPatch(g,30,58,17,13,D,K,R,false);
    wheelPatch(g,132,58,17,13,D,K,R,false);
    cutCorners(g,0,0,W_-1,H_-1,c);
    outlineFromFill(g,K);
    return toRows(g);
  }
  function makeBusBurntV(){
    var W_=60,H_=190,c=5;
    var g=mkGrid(W_,H_);
    var K='K',D='D',M='M',L='L',R='R',X='X',Y='Y';
    rect(g,0,0,W_-1,9,M);
    rect(g,0,10,W_-1,178,D);
    rect(g,0,179,W_-1,H_-1,D);
    rect(g,0,H_-3,W_-1,H_-1,D);
    var y=20;while(y<163){rect(g,8,y,51,Math.min(y+17,163),K);y+=20;}
    rect(g,22,3,37,9,K);
    rustFleck(g,15,40,R,X,Y);rustFleck(g,42,90,R,X,Y);rustFleck(g,20,120,R,X,Y);rustFleck(g,45,150,R,X,Y);rustFleck(g,10,10,R,X,Y);rustFleck(g,45,12,R,X,Y);
    setclip(g,2,60,'.');setclip(g,3,60,'.');setclip(g,2,61,'.');setclip(g,4,59,'.');setclip(g,2,58,M);
    wheelPatch(g,6,176,14,13,D,K,R,false);
    wheelPatch(g,38,176,14,13,D,K,R,false);
    cutCorners(g,0,0,W_-1,H_-1,c);
    outlineFromFill(g,K);
    return toRows(g);
  }

  // ---- palettes (rule 17 budget <=8, distinct hexes actually used per row set) ----
  // cruiser white (ramp.mjs --hue 210 --chroma 0.012 --l 0.52,0.84): W roof lit, w roof edge/pillars,
  // V door side, v grime; B/b dead blue lens (ramp --hue 255 --chroma 0.07); R/r dead red lens + taillights
  // (MAT.rust); S door shield (MAT.olive.L); P/p/q hatchback blue-grey (ramp --hue 235 --chroma 0.035 --l 0.3,0.56)
  var carPal={K:MAT.iron.K,D:MAT.iron.D,M:MAT.iron.M,L:MAT.iron.L,H:MAT.iron.H,W:'#c7cccb',w:'#a1abac',V:'#818a8d',v:'#66696b',
    G:MAT.glass.M,g:MAT.glass.L,R:MAT.rust.M,r:MAT.rust.L,B:'#264265',b:'#526773',S:MAT.olive.L,P:'#6a777a',p:'#3d5360',q:'#292e36'};
  var burntPal=Object.assign({},MAT.basalt,{R:MAT.rust.D,X:MAT.rust.M,Y:MAT.rust.L});
  var vanPal=Object.assign({},MAT.concrete,{O:MAT.olive.M,G:MAT.glass.D,g:MAT.glass.L});
  var busPal=Object.assign({},MAT.glass,{H:MAT.iron.H});

  A.define('wrecks',{
    car_h:{variants:[makeCarH('hatch'),makeCarH('police')],pal:carPal,anchor:'feet',note:'96x58 [96x48], nose at x=0: [0] blue-grey hatchback, rear door hanging open, flat rear tyre; [1] black-and-white police cruiser, dead red/blue lightbar, push bar, door shield, cracked windshield, sprung door, flat front tyre'},
    car_v:{variants:[makeCarV('hatch'),makeCarV('police')],pal:carPal,anchor:'feet',note:'48x106 [48x96], nose at y=0, rear face at the bottom: same two liveries'},
    carBurnt_h:{rows:makeCarH('burnt'),pal:burntPal,anchor:'feet',note:'96x58, basalt+rust burnt shell, window holes, warped bonnet'},
    carBurnt_v:{rows:makeCarV('burnt'),pal:burntPal,anchor:'feet',note:'48x106, burnt shell vertical'},
    van_h:{rows:makeVanH(),pal:vanPal,anchor:'feet',note:'110x62 [110x52]: off-white delivery van, olive stripe, rear doors open'},
    van_v:{rows:makeVanV(),pal:vanPal,anchor:'feet',note:'52x120 [52x110]: same van, vertical'},
    vanBurnt_h:{rows:makeVanBurntH(),pal:burntPal,anchor:'feet',note:'110x62, burnt van shell'},
    vanBurnt_v:{rows:makeVanBurntV(),pal:burntPal,anchor:'feet',note:'52x120, burnt van shell vertical'},
    bus_h:{rows:makeBusH(),pal:busPal,anchor:'feet',note:'180x72 [180x60]: teal-grey city bus, window strip, smashed pane, roof hatch'},
    bus_v:{rows:makeBusV(),pal:busPal,anchor:'feet',note:'60x190 [60x180]: same bus, vertical'},
    busBurnt_h:{rows:makeBusBurntH(),pal:burntPal,anchor:'feet',note:'180x72, burnt bus shell'},
    busBurnt_v:{rows:makeBusBurntV(),pal:burntPal,anchor:'feet',note:'60x190, burnt bus shell vertical'}
  });
})();
