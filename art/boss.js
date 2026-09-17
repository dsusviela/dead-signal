// Dead Signal boss: the Patient Furnace. One texel = one world unit (den 1).
//
// The rig lives in boss.js and is the reason for every anchor here. The 96x80
// body is anchored 'feet' and drawn at (0,40), so its top edge sits 40 units
// above the boss pivot and its ground line 40 below. Three parts hang off it
// and are rotated about their own TOP-CENTRE, so they are authored hanging
// straight down with the pivot on the top edge:
//   arm        24x56, rotated about (col 11.5, row 4)  -- drawn at y=-4
//   maulShaft   8x52, rotated about (col  3.5, row 6)  -- drawn at y=-6
//   maulHead   40x28, rotated about (col 20,   row 10) -- anchor y .35, where
//              the haft enters the head
//   armRight   20x48, hung from (col 10, row 0), static gantry
// The body carries a rounded pauldron at the left shoulder and a hanger box on
// the right gantry so the joints never show daylight at extreme swing angles.
//
// Light from the top: top-facing planes take iron M, the shell body iron D,
// undersides and the ground line iron K. Heat is the only saturated colour and
// stays a small minority of texels -- ember F/G for banked seams, O/T for open
// vents, Y/W only inside the core and the phase-3 splits. The engine draws the
// glow, the ground shadow and the motes; nothing here paints an aura.
//
// Phases read off the SILHOUETTE first, the glow second:
//   0 ember   shut            capped stack, smooth flanks, tight port collar
//   1 hot     open            stack cap flipped clear of the throat, collar
//                             leaves thrown back, left louvre swung out
//   2 cracked coming apart    stack snapped off short, plate bitten out of the
//                             shoulder, a split running the full height
(function(){
  'use strict';
  var A=(typeof window!=='undefined'?window:globalThis).DSArt;
  var MAT=A.MAT;

  // ---- grid helpers (art/wrecks.js style: build on a grid, emit rows) ----
  function mkGrid(w,h){var g=[],y,x,r;for(y=0;y<h;y++){r=[];for(x=0;x<w;x++)r.push('.');g.push(r);}return g;}
  function put(g,x,y,ch){if(y>=0&&y<g.length&&x>=0&&x<g[0].length)g[y][x]=ch;}
  function rect(g,x0,y0,x1,y1,ch){var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)put(g,x,y,ch);}
  function toRows(g){return g.map(function(r){return r.join('');});}
  // staircase off each corner of a rect; ch defaults to transparent
  function corners(g,x0,y0,x1,y1,c,ch){
    var x,y,dl,dr,dt,db;ch=ch||'.';
    for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++){
      dl=x-x0;dr=x1-x;dt=y-y0;db=y1-y;
      if((dl<c&&dt<c&&dl+dt<c)||(dr<c&&dt<c&&dr+dt<c)||(dl<c&&db<c&&dl+db<c)||(dr<c&&db<c&&dr+db<c))put(g,x,y,ch);
    }
  }
  // linear-interpolated trapezoid: row y0 spans l0..r0, row y1 spans l1..r1
  function trap(g,y0,y1,l0,r0,l1,r1,ch){
    var y,t,l,r;
    for(y=y0;y<=y1;y++){t=y1===y0?0:(y-y0)/(y1-y0);l=Math.round(l0+(l1-l0)*t);r=Math.round(r0+(r1-r0)*t);rect(g,l,y,r,y,ch);}
  }
  function ringRect(g,x0,y0,x1,y1,ch){
    var x,y;
    for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)if(x===x0||x===x1||y===y0||y===y1)put(g,x,y,ch);
  }
  // rivet ticks along a plate edge, never a continuous run
  function rivets(g,x0,x1,y,step,ch){var x;for(x=x0;x<=x1;x+=step)put(g,x,y,ch);}
  // a small rust blotch: dark rust with one mid texel, so it reads as corrosion
  // at 1x and never as a red light (rule 14, prune to a few sweet spots)
  function rustFleck(g,cx,cy,R,X){
    put(g,cx,cy,X);put(g,cx+1,cy,R);put(g,cx,cy+1,R);put(g,cx-1,cy+1,R);
    put(g,cx,cy-1,R);put(g,cx-1,cy,R);
  }
  // only paint where the grid is already filled: a recess cut into the shell
  function overRing(g,x0,y0,x1,y1,ch){
    var x,y;
    for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++){
      if(x!==x0&&x!==x1&&y!==y0&&y!==y1)continue;
      if(y<0||y>=g.length||x<0||x>=g[0].length||g[y][x]==='.')continue;
      g[y][x]=ch;
    }
  }
  // a jagged split: walks y0..y1, wobbling x by a fixed zigzag (no hash())
  var ZIG=[0,1,1,0,-1,-1,0,1,2,1,0,-1,-2,-1,0,1];
  function split(g,x0,y0,x1,y1,wide,core,edge,lip){
    var n=y1-y0,i,t,x,y,w;
    for(i=0;i<=n;i++){
      t=n?i/n:0;y=y0+i;x=Math.round(x0+(x1-x0)*t)+ZIG[i%ZIG.length];
      w=wide+(i%5===0?1:0);
      rect(g,x-w-1,y,x+w+1,y,lip);
      rect(g,x-w,y,x+w,y,edge);
      if(w>0)rect(g,x-w+1,y,x+w-1,y,core);
    }
  }
  // 1-texel K outline wherever a filled texel touches transparent or the edge;
  // the hot letters keep their value so a split can reach the silhouette
  function outline(g,K,skip){
    var h=g.length,w=g[0].length,x,y,copy=g.map(function(r){return r.slice();});
    function at(px,py){return px<0||py<0||px>=w||py>=h?'.':copy[py][px];}
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      if(copy[y][x]==='.'||skip.indexOf(copy[y][x])>=0)continue;
      if(at(x-1,y)==='.'||at(x+1,y)==='.'||at(x,y-1)==='.'||at(x,y+1)==='.')g[y][x]=K;
    }
  }

  // =====================================================================
  // body 96x80, anchor feet. The core sprite lands on rows 23..38, cols
  // 36..59; the left shoulder pivot is (col 19, row 22), the right hanger
  // (col 81, row 22). variant = clamp(phase-1, 0, 2).
  // =====================================================================
  function makeBody(p){
    var g=mkGrid(96,80),i,x;

    // ---- plinth: a building that got up, on two buttressed feet ----------
    rect(g,14,56,80,79,'D');
    rect(g,14,56,80,59,'M');
    for(i=0;i<4;i++){x=[21,30,61,70][i];rect(g,x,60,x+1,74,'K');rect(g,x+2,61,x+3,73,'M');}
    rect(g,14,76,80,79,'K');
    corners(g,14,56,80,79,4);
    trap(g,64,79,44,52,40,56,'.');                       // gap between the feet

    // ---- belly / ash hopper ---------------------------------------------
    trap(g,42,60,12,84,22,74,'D');
    trap(g,42,44,12,84,13,83,'M');                       // top-facing lip
    for(i=0;i<5;i++){x=25+i*9;rect(g,x,49,x+4,55,'K');}  // ash grate slots
    rect(g,16,57,78,58,'K');

    // ---- barrel ----------------------------------------------------------
    rect(g,10,14,86,46,'D');corners(g,10,14,86,46,7);
    rect(g,13,14,83,18,'M');                             // top plane
    rect(g,10,43,86,46,'K');                             // underside
    rect(g,11,21,85,22,'M');rivets(g,13,85,22,7,'K');    // riveted hoops
    rect(g,11,37,85,38,'M');rivets(g,14,85,37,7,'K');

    // ---- deck and stack --------------------------------------------------
    rect(g,24,7,72,16,'D');corners(g,24,7,72,16,4);
    rect(g,26,7,70,10,'M');
    rect(g,52,0,66,12,'D');
    rect(g,52,0,54,12,'M');                              // lit left face
    rect(g,64,0,66,12,'K');                              // shadow face
    rect(g,51,4,67,5,'M');rect(g,51,9,67,9,'K');         // stack collars

    // ---- right gantry, the hanger the spare arm swings from --------------
    rect(g,68,13,93,23,'D');corners(g,68,13,93,23,3);
    rect(g,68,13,93,15,'M');
    rect(g,75,16,87,22,'K');rect(g,76,17,86,21,'M');rect(g,79,18,83,20,'K');
    // a recess the spare arm hangs in: 2 dark texels frame it on every side so
    // the limb never welds itself to the shell behind it (rule 16)
    overRing(g,69,20,92,71,'K');overRing(g,70,21,91,70,'K');

    // ---- left pauldron: backs the arm at every swing angle ---------------
    rect(g,5,10,33,35,'D');corners(g,5,10,33,35,7);
    rect(g,8,10,30,13,'M');
    rivets(g,9,29,14,6,'K');

    // ---- containment placard: the name is a filing decision --------------
    rect(g,14,40,32,52,'M');ringRect(g,14,40,32,52,'K');
    rect(g,16,43,30,43,'K');rect(g,16,46,26,46,'K');rect(g,16,49,30,49,'K');
    rect(g,27,46,30,46,'D');

    // ---- weathering: four sweet spots, not a rash ------------------------
    rustFleck(g,18,27,'R','X');rustFleck(g,66,50,'R','X');
    rustFleck(g,38,62,'R','X');rustFleck(g,24,17,'R','X');

    // ---- phase dressing --------------------------------------------------
    var cx0=35,cy0=22,cx1=60,cy1=39,rim='F';
    if(p===1){cx0=32;cy0=19;cx1=63;cy1=42;rim='G';}
    if(p===2){cx0=29;cy0=16;cx1=66;cy1=45;rim='O';}

    // Every phase tell lives on the deck top, the belly front, the plinth or
    // the port itself: the left arm covers cols 7..31 and the spare arm cols
    // 71..90, so a change on either flank would never be seen.
    if(p===0){
      // stack capped, deck vents shut, the port banked down to a slot
      rect(g,45,0,73,3,'M');rect(g,45,3,73,3,'K');rivets(g,47,71,1,6,'K');
      for(i=0;i<3;i++){x=27+i*7;rect(g,x,7,x+4,10,'K');}
      for(i=0;i<5;i++){x=25+i*9;rect(g,x+1,52,x+3,53,'F');}
    }else{
      // the forge is open: the cap is flipped clear of the throat, the deck
      // vents are drawing and the ash bed lights the ground between the feet
      rect(g,68,0,85,4,'M');rect(g,68,4,85,4,'K');
      rect(g,66,2,71,8,'D');rect(g,67,3,70,7,'K');       // the hinge it swung on
      rect(g,53,0,65,3,'F');rect(g,55,0,63,2,'G');
      for(i=0;i<3;i++){x=27+i*7;rect(g,x,7,x+4,11,'K');rect(g,x+1,8,x+3,10,p===1?'G':'O');}
      for(i=0;i<5;i++){x=25+i*9;rect(g,x+1,51,x+3,54,p===1?'G':'O');put(g,x+2,52,p===1?'O':'T');}
      trap(g,66,77,45,51,42,54,p===1?'F':'G');           // ash light under the feet
    }

    if(p===2){
      // coming apart: the stack snapped off, the deck vent bank torn out, a
      // chunk gone from the plinth and a split running the whole height
      rect(g,52,0,66,6,'.');
      put(g,53,7,'.');put(g,59,7,'.');put(g,65,7,'.');
      rect(g,53,7,65,10,'F');rect(g,55,8,63,10,'O');rect(g,57,9,61,10,'Y');
      rect(g,24,7,40,9,'.');put(g,41,7,'.');put(g,25,10,'.');
      rect(g,41,8,44,12,'F');rect(g,42,9,43,11,'O');
      rect(g,24,10,40,10,'G');rect(g,27,10,37,10,'O');
      rect(g,60,55,76,66,'.');
      trap(g,55,66,60,76,64,78,'.');
      rect(g,57,55,59,65,'G');rect(g,58,56,59,64,'O');
      split(g,44,8,40,18,0,'Y','O','G');
      split(g,52,45,56,63,1,'Y','O','G');
      rustFleck(g,14,62,'R','X');
    }

    // ---- furnace port ----------------------------------------------------
    rect(g,cx0-5,cy0-5,cx1+5,cy1+5,'M');corners(g,cx0-5,cy0-5,cx1+5,cy1+5,6);
    ringRect(g,cx0-5,cy0-5,cx1+5,cy1+5,'K');
    rect(g,cx0-4,cy0-4,cx1+4,cy1+4,'D');corners(g,cx0-4,cy0-4,cx1+4,cy1+4,5,'M');
    rivets(g,cx0-2,cx1+2,cy0-3,6,'K');rivets(g,cx0-2,cx1+2,cy1+3,6,'K');
    rect(g,cx0,cy0,cx1,cy1,'E');corners(g,cx0,cy0,cx1,cy1,3,'K');
    ringRect(g,cx0,cy0,cx1,cy1,rim);
    corners(g,cx0,cy0,cx1,cy1,3,'K');
    rect(g,cx0+2,cy1-2,cx1-2,cy1-1,'F');                 // ember bed on the floor
    for(i=0;i<4;i++)put(g,cx0+5+i*6,cy1-1,p===0?'G':'O');
    if(p>0){                                             // collar leaves thrown back
      rect(g,cx0-12,cy0-1,cx0-7,cy1+1,'M');ringRect(g,cx0-12,cy0-1,cx0-7,cy1+1,'K');
      rect(g,cx1+7,cy0-1,cx1+12,cy1+1,'M');ringRect(g,cx1+7,cy0-1,cx1+12,cy1+1,'K');
    }
    if(p===2){
      rect(g,cx1-6,cy1-1,cx1+6,cy1+6,'.');
      rect(g,cx1-7,cy1-2,cx1-4,cy1+4,'G');rect(g,cx1-6,cy1-1,cx1-5,cy1+3,'O');
    }

    outline(g,'K','OTYW');
    return toRows(g);
  }

  // =====================================================================
  // core 24x16, anchor feet, drawn at (0,-1) over the port. Two frames of one
  // fire bed: the grate and the iron lip never move, only the coals change
  // value, so every iron texel is byte-identical between frames (rule 51).
  // =====================================================================
  function makeCore(f){
    var g=mkGrid(24,16),x,y,d,ch;
    var w=f?[2.0,3.4,4.8,6.2]:[1.2,2.6,4.0,5.4];
    for(y=2;y<=13;y++)for(x=2;x<=21;x++){
      d=Math.sqrt(Math.pow((x-11.5)/1.55,2)+Math.pow(y-7.6,2));
      ch=d<w[0]?'W':d<w[1]?'Y':d<w[2]?'T':d<w[3]?'O':'G';
      put(g,x,y,ch);
    }
    rect(g,2,12,21,13,'G');rect(g,4,13,19,13,'F');       // clinker bed
    put(g,6,12,'F');put(g,13,12,'F');put(g,18,12,'F');
    for(x=5;x<=20;x+=5)rect(g,x,2,x,13,'K');             // grate bars
    rect(g,0,0,23,1,'D');rect(g,0,14,23,15,'D');
    rect(g,0,0,1,15,'D');rect(g,22,0,23,15,'D');
    ringRect(g,0,0,23,15,'K');
    rect(g,2,1,21,1,'M');                                // lintel catches the light
    return toRows(g);
  }

  // =====================================================================
  // arm 24x56, top-anchored, rotated about (11.5, 4). variant=min(2,phase-1)
  // =====================================================================
  function makeArm(v){
    var g=mkGrid(24,56);
    // shoulder ball: rounded so the pivot never shows a corner under rotation
    rect(g,2,0,21,15,'D');corners(g,2,0,21,15,5);
    rect(g,4,0,19,3,'M');
    rect(g,8,5,15,11,'K');rect(g,9,6,14,10,'M');rect(g,11,7,12,9,'K');
    // upper arm
    rect(g,4,14,19,31,'D');
    rect(g,4,14,19,16,'M');rivets(g,6,18,15,5,'K');
    rect(g,5,18,7,30,'M');rect(g,17,18,18,30,'K');
    rect(g,9,20,14,22,'K');rect(g,9,26,14,28,'K');
    // elbow
    rect(g,2,30,21,39,'D');corners(g,2,30,21,39,4);
    rect(g,4,30,19,32,'M');
    rect(g,8,33,15,38,'K');rect(g,9,34,14,37,'M');
    // forearm and piston
    rect(g,6,38,17,45,'D');
    rect(g,7,39,9,45,'L');rect(g,15,39,16,45,'K');
    // clamp jaws; the 8-wide haft passes through cols 8..15
    rect(g,1,42,22,55,'D');corners(g,1,42,22,55,3);
    rect(g,2,43,6,54,'M');rect(g,17,43,21,54,'K');
    rect(g,8,45,15,55,'K');
    rect(g,3,48,5,52,'K');rect(g,18,48,20,52,'D');
    rustFleck(g,17,24,'R','X');rustFleck(g,6,47,'R','X');

    if(v>=1){                                            // seams lit, vents open
      rect(g,10,20,13,22,'G');rect(g,10,26,13,28,'G');
      rect(g,11,21,12,21,'O');rect(g,11,27,12,27,'O');
      rect(g,10,35,13,36,'G');
      rect(g,2,30,21,30,'F');
    }
    if(v===2){                                           // plates peeled off
      rect(g,2,22,5,29,'.');rect(g,18,24,21,31,'.');
      rect(g,6,22,7,29,'O');rect(g,6,23,6,28,'Y');
      rect(g,16,24,17,31,'G');
      rect(g,2,33,4,38,'.');
      rect(g,9,20,14,22,'O');rect(g,10,21,13,21,'Y');
      rect(g,9,26,14,28,'O');rect(g,10,27,13,27,'Y');
      rect(g,9,34,14,37,'O');rect(g,10,35,13,36,'Y');
      rect(g,7,39,9,45,'T');rect(g,8,40,8,44,'Y');
    }
    outline(g,'K','OTYW');
    return toRows(g);
  }

  // =====================================================================
  // maulShaft 8x52, top-anchored, rotated about (3.5, 6): rows 0..5 are the
  // butt above the grip, the rest is the haft the head sits on.
  // =====================================================================
  function makeShaft(){
    var g=mkGrid(8,52),i,y;
    rect(g,0,0,7,51,'D');
    rect(g,1,0,6,4,'M');rect(g,2,1,5,3,'K');             // capped butt
    rect(g,0,5,0,51,'K');rect(g,7,5,7,51,'K');
    for(i=0;i<4;i++){y=7+i*11;rect(g,1,y,2,y+6,'M');}    // broken lit side
    for(i=0;i<3;i++){y=13+i*12;rect(g,0,y,7,y+1,'X');put(g,2,y,'R');put(g,5,y+1,'R');}
    rect(g,3,44,4,51,'K');
    outline(g,'K','OTYW');
    return toRows(g);
  }

  // =====================================================================
  // maulHead 40x28, pivoted at (20, 10) where the haft enters. variants:
  // 0 cold iron, 1 the burn cast, 2 phase 3 (the head has split too)
  // =====================================================================
  function makeHead(v){
    var g=mkGrid(40,28);
    rect(g,15,0,24,8,'D');rect(g,16,0,23,2,'M');         // haft collar
    trap(g,3,9,11,28,4,35,'D');
    rect(g,4,9,35,19,'D');
    trap(g,20,25,3,36,0,39,'D');                         // the face flares out
    rect(g,1,25,38,27,'D');
    rect(g,6,4,33,7,'M');                                // top plane
    rect(g,4,10,7,18,'M');rect(g,31,10,35,18,'K');       // lit left, shadow right
    rect(g,4,19,35,20,'K');rivets(g,7,33,19,6,'D');      // banding strap
    rect(g,2,24,37,27,'K');                              // striking face
    rect(g,3,23,36,23,'D');put(g,4,24,'H');put(g,5,24,'H');
    rustFleck(g,27,14,'R','X');rustFleck(g,9,15,'R','X');

    if(v===1){                                           // the burn cast
      rect(g,2,24,37,27,'O');rect(g,5,25,34,27,'T');rect(g,12,26,27,27,'Y');
      rect(g,3,23,36,23,'G');
      rect(g,12,10,13,19,'G');rect(g,25,12,26,19,'G');
      rect(g,17,0,22,3,'F');
    }
    if(v===2){                                           // split open
      rect(g,29,4,35,10,'.');rect(g,32,11,35,13,'.');
      rect(g,27,5,28,11,'G');rect(g,28,6,28,10,'O');
      split(g,19,4,21,26,1,'Y','O','G');
      rect(g,2,24,37,27,'O');rect(g,5,25,34,27,'T');rect(g,11,26,28,27,'Y');
      rect(g,3,23,36,23,'G');
      rect(g,4,13,6,19,'.');rect(g,7,13,8,19,'G');
      rect(g,17,0,22,3,'F');
    }
    outline(g,'K','OTYW');
    return toRows(g);
  }

  // =====================================================================
  // armRight 20x48, hung from the gantry at (10, 0). Never rotated, but still
  // authored hanging straight down from the centre of its top edge.
  // variant = phase>=3 ? 1 : 0
  // =====================================================================
  function makeArmRight(v){
    var g=mkGrid(20,48);
    rect(g,3,0,16,8,'D');corners(g,3,0,16,8,3);          // yoke
    rect(g,5,0,14,2,'M');
    rect(g,8,2,11,8,'K');
    rect(g,4,7,15,34,'D');                               // limb
    rect(g,5,9,7,33,'M');rect(g,13,9,14,33,'K');
    rect(g,4,13,15,15,'M');rivets(g,6,14,13,4,'K');
    rect(g,4,24,15,26,'M');rivets(g,6,14,25,4,'K');
    rect(g,8,17,11,21,'K');
    rect(g,1,33,18,41,'D');corners(g,1,33,18,41,3);      // dead claw
    rect(g,3,33,16,35,'M');rect(g,7,37,12,40,'K');
    rect(g,0,41,5,47,'D');rect(g,14,41,19,47,'D');rect(g,8,41,11,45,'D');
    rect(g,1,43,3,47,'K');rect(g,16,43,18,47,'K');rect(g,9,43,10,45,'K');
    rustFleck(g,14,20,'R','X');rustFleck(g,6,30,'R','X');

    if(v===1){                                           // phase 3: the seam goes
      rect(g,4,18,15,22,'.');
      rect(g,4,17,15,17,'G');rect(g,4,23,15,23,'G');
      rect(g,5,18,14,18,'O');rect(g,5,22,14,22,'O');
      rect(g,3,19,16,21,'T');rect(g,6,20,13,20,'Y');
      rect(g,8,41,11,45,'G');rect(g,9,42,10,44,'O');
      rect(g,1,33,3,37,'.');put(g,17,40,'.');put(g,18,39,'.');
    }
    outline(g,'K','OTYW');
    return toRows(g);
  }

  // ---- palette: iron + rust shell, ember for everything hot -------------
  var pal={
    K:MAT.iron.K, D:MAT.iron.D, M:MAT.iron.M, L:MAT.iron.L, H:MAT.iron.H,
    R:MAT.rust.D, X:MAT.rust.M, V:MAT.rust.L,
    E:MAT.ember.K, F:MAT.ember.D, G:MAT.ember.M,
    O:MAT.ember.L, T:MAT.ember.O, Y:MAT.ember.Y, W:MAT.ember.W
  };

  A.define('boss',{
    body:{variants:[makeBody(0),makeBody(1),makeBody(2)],pal:pal,anchor:'feet',
      note:'96x80 feet-anchored, drawn at (0,40). [0] ember: capped stack, tight port collar, shut louvre; [1] hot: cap flipped, collar leaves thrown back, louvre swung out past the shell; [2] cracked: stack snapped, shoulder plate bitten out, full-height split. The core sprite lands on rows 23..38 / cols 36..59; left shoulder pivot (19,22), right hanger (81,22).'},
    core:{frames:{down:[makeCore(0),makeCore(1)]},fps:10,pal:pal,anchor:'feet',
      note:'24x16 fire bed behind a 4-bar grate, drawn at (0,-1). Two frames: the grate and the iron lip are byte-identical, only the coal ramp breathes. NOTE: art.js pick() reads frames OR variants, never both, so the phase variant boss.js passes resolves to the same rows; the phase read is carried by the body port around it and by the engine doubling the flicker rate.'},
    arm:{variants:[makeArm(0),makeArm(1),makeArm(2)],pal:pal,anchor:{x:.5,y:0},
      note:'24x56 hanging from the centre of its top edge; boss.js rotates it about (11.5,4). Shoulder ball rounded for that pivot, clamp jaws at rows 42..55 with the 8-wide haft socket at cols 8..15. [0] shut, [1] seams and vents lit, [2] plates peeled, piston glowing.'},
    maulShaft:{rows:makeShaft(),pal:pal,anchor:{x:.5,y:0},
      note:'8x52 haft, rotated about (3.5,6); rows 0..5 are the butt above the grip, the head covers rows 30..46.'},
    maulHead:{variants:[makeHead(0),makeHead(1),makeHead(2)],pal:pal,anchor:{x:.5,y:.35},
      note:'40x28 sledge head, pivot (20,10) where the haft enters. [0] cold iron, [1] the burn cast, [2] phase 3 split with white heat in the crack.'},
    armRight:{variants:[makeArmRight(0),makeArmRight(1)],pal:pal,anchor:{x:.5,y:0},
      note:'20x48 spare arm hung from the right gantry at (33,-18); static. [0] dead and shut, [1] phase 3, the mid seam has burst open.'}
  });
})();
