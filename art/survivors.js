// Dead Signal survivors: the four players — walk, idle, downed — and every
// weapon they carry. One texel = one world unit (den 1).
//
// Palette is the tinted `survivor` ramp in art.js: K outline, D dark (hair,
// gloves, belt, boots), M mid (sleeves, trousers), L/H skin, and C = the
// player tint. C is reserved for the jacket (plus a sleeve band on the side
// facing): with four survivors on one dark street the jacket block is the only
// thing that tells them apart, so it stays the biggest single hue after the
// outline and never gets used on gear.
//
// Camera is top-down at a slight 3/4 tilt, one light from the top-left: you
// see the crown of the head, the shoulders and a foreshortened body. 'down'
// faces the camera, 'up' is the back of the head (no face, hood on the back),
// 'side' faces +x and render.js mirrors it with `flip` when aiming left.
//
// Bodies are built silhouette-first: fill the shape, run outlineFromFill for a
// 1-texel K ring, then paint the interior (pin() never touches the outline).
// The torso/head spans are one shared table stamped with a dy of 0 or -1, so
// the walk is contact / passing(+1) / contact / passing(+1) with the two
// contacts on opposite legs and every unchanged region byte-identical.
//
// Weapons are horizontal with the muzzle on the sprite's right edge
// (render.js puts the flash at w*.8 along the aim) and the grip at x≈.18w.
// Each is stepped — stock taller than receiver taller than barrel — so the
// top-lit ramp never lands two equal-extent runs on top of each other.
(function(){
  'use strict';
  var A=(typeof window!=='undefined'?window:globalThis).DSArt;
  var MAT=A.MAT;

  // ---- grid helpers (art/wrecks.js style: build on a grid, emit rows) ----
  function mkGrid(w,h){var g=[],y,x,row;for(y=0;y<h;y++){row=[];for(x=0;x<w;x++)row.push('.');g.push(row);}return g;}
  function setclip(g,x,y,ch){if(y>=0&&y<g.length&&x>=0&&x<g[0].length)g[y][x]=ch;}
  function rect(g,x0,y0,x1,y1,ch){var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)setclip(g,x,y,ch);}
  function toRows(g){return g.map(function(r){return r.join('');});}

  // cut a small staircase off each of the 4 corners of a rect (rounded look)
  function cutCorners(g,x0,y0,x1,y1,c){
    var x,y,dl,dr,dt,db;
    for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++){
      dl=x-x0;dr=x1-x;dt=y-y0;db=y1-y;
      if((dl<c&&dt<c&&dl+dt<c)||(dr<c&&dt<c&&dr+dt<c)||(dl<c&&db<c&&dl+db<c)||(dr<c&&db<c&&dr+db<c))setclip(g,x,y,'.');
    }
  }
  // 1-texel K outline wherever a filled texel touches transparent or the edge
  function outlineFromFill(g,K){
    var h=g.length,w=g[0].length,x,y,copy=g.map(function(r){return r.slice();});
    function at(px,py){return px<0||py<0||px>=w||py>=h?'.':copy[py][px];}
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      if(copy[y][x]==='.')continue;
      if(at(x-1,y)==='.'||at(x+1,y)==='.'||at(x,y-1)==='.'||at(x,y+1)==='.')g[y][x]=K;
    }
  }
  // paint interior only: skips transparent and never eats the K outline
  function pin(g,x0,y0,x1,y1,ch){
    var x,y,c;
    for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++){
      if(y<0||y>=g.length||x<0||x>=g[0].length)continue;
      c=g[y][x];if(c==='.'||c==='K')continue;g[y][x]=ch;
    }
  }
  // stamp a [row, x0, x1] span table with a vertical offset
  function spans(g,list,dy,ch){list.forEach(function(s){rect(g,s[1],s[0]+dy,s[2],s[0]+dy,ch);});}
  // top-lit metal: the topmost interior texel of a column is L, the lowest D,
  // everything between M; a one-texel column stays M so thin barrels stay dark
  function shadeTopDown(g,L,M,D){
    var w=g[0].length,h=g.length,x,y,top,bot,c;
    for(x=0;x<w;x++){
      top=-1;bot=-1;
      for(y=0;y<h;y++){c=g[y][x];if(c==='.'||c==='K')continue;if(top<0)top=y;bot=y;}
      if(top<0)continue;
      for(y=top;y<=bot;y++){c=g[y][x];if(c==='.'||c==='K')continue;g[y][x]=top===bot?M:(y===top?L:(y===bot?D:M));}
    }
  }

  // =====================================================================
  // body 32x32, anchor feet. Head y2..y10, shoulders/torso y11..y23,
  // legs y24..y31. Shoulders are 16 wide with the outline, the head 10.
  // =====================================================================
  var SIL_DOWN=[
    [2,12,19],[3,11,20],[4,11,20],[5,11,20],[6,11,20],[7,11,20],[8,11,20],[9,12,19],[10,12,19],
    [11,10,21],[12,9,22],[13,8,23],[14,8,23],[15,8,23],[16,8,23],[17,8,23],[18,8,23],
    [19,9,22],[20,9,22],[21,10,21],[22,10,21],[23,10,21]];
  // side view: head pushed one texel toward +x, torso 12 wide, hips narrow
  var SIL_SIDE=[
    [2,13,20],[3,12,21],[4,12,21],[5,12,21],[6,12,21],[7,12,21],[8,12,21],[9,13,20],[10,13,20],
    [11,11,20],[12,10,21],[13,10,21],[14,10,21],[15,10,21],[16,10,21],[17,10,21],[18,10,21],
    [19,11,20],[20,11,20],[21,11,20],[22,11,20],[23,11,20]];

  // one leg: trousers M down to the ankle, a D boot at the bottom. The boot's
  // top row stops one texel short of the heel so the M/D pair never hugs
  // across the full width of the leg (rule 12).
  function legFill(g,x0,x1,yTop,yBot,heelLeft){
    pin(g,x0,yTop,x1,yBot,'M');
    if(heelLeft)pin(g,x0,yBot-2,x1-2,yBot-2,'D');else pin(g,x0+2,yBot-2,x1,yBot-2,'D');
    pin(g,x0,yBot-1,x1,yBot,'D');
  }
  function legDark(g,x0,x1,yTop,yBot){pin(g,x0,yTop,x1,yBot,'D');}
  // sleeves, gloves, belt and hips: identical on the front and back facings,
  // so the two share one routine and stay byte-identical where nothing moves
  function paintGear(g,dy,gl,gr){
    pin(g,9,13+dy,10,18+dy,'M');           // sleeves
    pin(g,21,13+dy,22,18+dy,'M');
    pin(g,9,13+dy,10,13+dy,'C');           // the jacket carries over the shoulder
    pin(g,21,13+dy,22,13+dy,'C');
    pin(g,10,19+gl+dy,11,20+gl+dy,'D');    // gloves (swing 1 texel)
    pin(g,20,19+gr+dy,21,20+gr+dy,'D');
    pin(g,11,21+dy,20,21+dy,'D');          // belt
    pin(g,15,21+dy,16,21+dy,'H');          // buckle
    pin(g,11,22+dy,19,23+dy,'M');          // hips
    pin(g,20,22+dy,20,23+dy,'D');
    jacketDown(g,dy);
  }
  // The tint block is the whole point of the sprite, so it stays the biggest
  // single hue — but a 10x9 field of flat C reads as a rectangle, not a body.
  // A zip seam one texel left of centre, an armhole wedge on each side (deeper
  // on the right, the light is top-left), a hem shadow where the jacket sits on
  // the belt, and a lit cap on the near shoulder give it front and depth.
  function jacketDown(g,dy){
    pin(g,10,12+dy,12,12+dy,'L');          // lit shoulder cap
    pin(g,14,13+dy,14,19+dy,'D');          // zip placket
    pin(g,20,14+dy,20,16+dy,'M');          // armhole shadow, shade side only
    pin(g,16,20+dy,19,20+dy,'M');          // hem shadow above the belt
  }

  // ---- down: face to camera ----
  function paintDown(g,dy,gl,gr){
    pin(g,12,3+dy,19,5+dy,'D');            // hair mass + fringe
    pin(g,12,3+dy,15,3+dy,'M');            // skull lit down the top-left, staggered parting
    pin(g,12,4+dy,14,4+dy,'M');
    pin(g,12,5+dy,13,5+dy,'M');
    pin(g,12,6+dy,12,7+dy,'D');            // side hair, parted to the light
    pin(g,19,4+dy,19,6+dy,'D');
    pin(g,13,6+dy,18,10+dy,'L');           // face
    pin(g,12,8+dy,19,8+dy,'L');            // cheeks widen at the ears
    pin(g,19,7+dy,19,8+dy,'L');
    pin(g,13,6+dy,14,6+dy,'H');            // lit brow
    pin(g,18,9+dy,18,10+dy,'D');           // jaw in shadow (light top-left)
    pin(g,13,10+dy,13,10+dy,'D');
    setclip(g,14,7+dy,'K');setclip(g,17,7+dy,'K');   // eyes
    pin(g,12,11+dy,19,11+dy,'D');          // collar: reads the head off the body
    paintGear(g,dy,gl,gr);
  }
  // ---- up: back of the head, hood down across the shoulders ----
  function paintUp(g,dy,gl,gr){
    pin(g,12,3+dy,19,10+dy,'D');           // all hair, no face
    pin(g,12,3+dy,16,3+dy,'M');            // skull lit down the top-left, staggered parting
    pin(g,12,4+dy,15,4+dy,'M');
    pin(g,12,5+dy,14,5+dy,'M');
    pin(g,12,6+dy,13,6+dy,'M');
    pin(g,15,10+dy,16,10+dy,'L');          // nape
    paintGear(g,dy,gl,gr);
  }
  // ---- side: facing +x, near arm across the body front ----
  function paintSide(g,dy,ga){
    pin(g,13,3+dy,20,5+dy,'D');            // hair
    pin(g,13,3+dy,16,3+dy,'M');            // skull lit down the top-left, staggered parting
    pin(g,13,4+dy,15,4+dy,'M');
    pin(g,13,5+dy,14,5+dy,'M');
    pin(g,13,6+dy,15,8+dy,'D');            // back of the head
    pin(g,16,6+dy,20,8+dy,'L');            // face in profile
    pin(g,16,6+dy,17,6+dy,'H');            // lit brow
    pin(g,15,9+dy,19,10+dy,'L');           // jaw
    pin(g,14,9+dy,14,10+dy,'D');
    setclip(g,18,7+dy,'K');                // eye
    pin(g,13,11+dy,19,11+dy,'D');          // collar
    pin(g,19,13+dy,20,18+dy,'M');          // near sleeve
    pin(g,19,15+dy,20,16+dy,'C');          // armband: the tint again on the arm
    pin(g,18,19+ga+dy,19,20+ga+dy,'D');    // glove
    pin(g,12,21+dy,19,21+dy,'D');          // belt
    pin(g,15,21+dy,16,21+dy,'H');          // buckle
    pin(g,12,22+dy,19,23+dy,'M');
    pin(g,11,12+dy,13,12+dy,'L');          // lit shoulder cap
    pin(g,18,13+dy,18,19+dy,'D');          // jacket front edge, hard against the arm
    pin(g,13,20+dy,17,20+dy,'M');          // hem shadow above the belt
  }

  // legs: [leftX0,leftX1,leftBottom, rightX0,rightX1,rightBottom, farLeg]
  // farLeg is 0/1/2: 0 = neither (front view, both legs lit), 1 = the right
  // leg is the far one, 2 = the left. The far leg drops to D so the side walk
  // still scissors when the two legs overlap.
  function makeBody(sil,paint,dy,legs,arms){
    var g=mkGrid(32,32),top=24+dy,far=legs[6];
    spans(g,sil,dy,'C');
    rect(g,legs[0],top,legs[1],legs[2],'C');
    rect(g,legs[3],top,legs[4],legs[5],'C');
    outlineFromFill(g,'K');
    paint.apply(null,[g,dy].concat(arms));
    if(far===1){legDark(g,legs[3],legs[4],top,legs[5]);legFill(g,legs[0],legs[1],top,legs[2],1);}
    else if(far===2){legDark(g,legs[0],legs[1],top,legs[2]);legFill(g,legs[3],legs[4],top,legs[5],1);}
    else{legFill(g,legs[0],legs[1],top,legs[2],1);legFill(g,legs[3],legs[4],top,legs[5],0);}
    return toRows(g);
  }
  // front-facing walk: contact (left leg planted, right trailing) / passing /
  // contact (opposite leg) / passing. The two contacts are different poses and
  // the two passings differ by the arm swing, because render.js runs
  // floor(time*8)&3 straight through with no ping-pong.
  function downWalk(f){
    var poses=[
      [0,[10,14,31,17,21,28,0],[0,1]],
      [-1,[10,14,31,17,21,30,0],[0,0]],
      [0,[10,14,28,17,21,31,0],[1,0]],
      [-1,[10,14,30,17,21,31,0],[1,1]]];
    // one foot always reaches row 31, so the 1-texel bob rides the planted
    // leg instead of floating the whole figure off its feet anchor
    return poses[f];
  }
  function makeDown(f){var p=downWalk(f);return makeBody(SIL_DOWN,paintDown,p[0],p[1],p[2]);}
  function makeUp(f){var p=downWalk(f);return makeBody(SIL_DOWN,paintUp,p[0],p[1],p[2]);}
  // side walk: the legs scissor along x. Slot A is always the far leg (D),
  // slot B the near one (M + boot). The two contacts split into two separate
  // legs with a 2-texel gap of daylight between them — that gap is the walk;
  // the passing frames close it back into one column. This deliberately drops
  // the frame IoU below the lint's 0.85 advisory: a side cycle whose contacts
  // share a silhouette is not a walk, and the read wins over the warning.
  function makeSide(f){
    var poses=[
      [0,[10,14,30,17,21,31,2],[0]],
      [-1,[13,17,30,15,19,31,2],[1]],
      [0,[17,21,30,10,14,31,2],[1]],
      [-1,[14,18,30,12,16,31,2],[0]]];
    var p=poses[f];
    return makeBody(SIL_SIDE,paintSide,p[0],p[1],p[2]);
  }
  // idle: both feet planted, breathing lifts the chest and head one texel
  function makeIdle(kind,f){
    var dy=f?-1:0;
    if(kind==='side')return makeBody(SIL_SIDE,paintSide,dy,[12,16,30,16,20,31,2],[0]);
    return makeBody(SIL_DOWN,kind==='up'?paintUp:paintDown,dy,[10,14,31,17,21,31,0],[0,0]);
  }

  // =====================================================================
  // downed 32x20, anchor {.5,.68}, drawn at p.y+4 — so the head ends up
  // nearest the camera and the legs run up-screen. Flat on its back with the
  // limbs staggered round the body: nothing about it reads as a standing
  // survivor, and the jacket is still the block you name the player by.
  // =====================================================================
  function makeDowned(){
    var g=mkGrid(32,20);
    // limbs are staggered, never mirrored: a symmetric star reads as a
    // standing figure squashed, a pinwheel reads as somebody who fell
    var torso=[[4,11,21],[5,10,22],[6,10,22],[7,10,22],[8,10,22],[9,10,22],[10,10,22],[11,10,22]];
    var head=[[11,13,19],[12,12,20],[13,12,20],[14,12,20],[15,12,20],[16,12,20],[17,12,20],[18,12,20],[19,13,19]];
    var legA=[[0,8,12],[1,8,12],[2,9,13],[3,9,13],[4,10,14]];          // legs run up-screen
    var legB=[[0,17,21],[1,17,21],[2,18,22],[3,18,22],[4,19,23],[5,19,23]];
    var armA=[[5,4,11],[6,3,11],[7,3,11],[8,4,11]];                    // near arm out at the shoulder
    var armB=[[8,21,28],[9,21,29],[10,21,29],[11,22,28]];              // far arm dropped low
    [torso,head,legA,legB,armA,armB].forEach(function(sp){spans(g,sp,0,'C');});
    outlineFromFill(g,'K');
    pin(g,11,4,22,5,'D');     // belt across the hips
    pin(g,16,4,17,4,'H');     // buckle
    pin(g,13,11,19,11,'D');   // collar
    pin(g,4,6,10,7,'M');      // sleeves
    pin(g,22,9,27,10,'M');
    pin(g,3,6,4,7,'D');       // gloves at both arm ends
    pin(g,27,9,28,10,'D');
    pin(g,9,1,13,3,'M');      // trousers
    pin(g,18,1,22,4,'M');
    pin(g,9,1,11,1,'D');      // boot soles pointing away from the camera
    pin(g,18,1,20,1,'D');
    pin(g,12,12,20,15,'D');   // hair
    pin(g,13,16,19,18,'L');   // face, slack, eyes shut
    pin(g,14,16,15,16,'H');
    pin(g,14,17,15,17,'K');
    pin(g,17,17,18,17,'K');
    pin(g,18,18,19,18,'D');   // jaw in shadow
    return toRows(g);
  }

  // =====================================================================
  // civilian 32x32, anchor feet, frames:{down:[idle,step,cower]}: an
  // unarmed civilian in muted grey/brown winter clothes (MAT.sandbag —
  // deliberately not the 'survivor' ramp, so the tint never reads as a
  // squad member), hood up, no weapon. Built as its own simple silhouette
  // rather than reusing the player's jacket/gear system.
  // =====================================================================
  var CIV_HOOD=[[0,14,17],[1,13,18]];
  var CIV_TORSO=[
    [2,12,19],[3,11,20],[4,11,20],[5,11,20],[6,11,20],[7,11,20],[8,11,20],[9,12,19],[10,12,19],
    [11,9,22],[12,8,23],[13,7,24],[14,7,24],[15,7,24],[16,7,24],[17,7,24],[18,7,24],
    [19,8,23],[20,8,23],[21,9,22],[22,9,22],[23,9,22]];
  function civHeadFace(g){
    pin(g,13,2,18,3,'D');       // hood peak, dark
    pin(g,13,4,18,4,'M');
    pin(g,14,5,17,9,'L');       // face under the hood
    pin(g,14,5,15,5,'H');
    setclip(g,15,7,'K');setclip(g,16,7,'K'); // eyes
    pin(g,13,10,18,10,'D');     // collar
  }
  function makeCivIdle(){
    var g=mkGrid(32,32);
    spans(g,CIV_HOOD.concat(CIV_TORSO),0,'M');
    rect(g,10,24,14,31,'M');rect(g,17,24,21,31,'M');
    outlineFromFill(g,'K');
    pin(g,10,30,14,31,'D');pin(g,17,30,21,31,'D'); // boots
    civHeadFace(g);
    pin(g,15,14,16,20,'D');     // coat seam
    pin(g,9,22,22,23,'D');      // hem shadow
    return toRows(g);
  }
  function makeCivStep(){
    var g=mkGrid(32,32);
    spans(g,CIV_HOOD.concat(CIV_TORSO),0,'M');
    rect(g,9,24,13,31,'M');rect(g,18,24,22,29,'M'); // one leg trails
    outlineFromFill(g,'K');
    pin(g,9,30,13,31,'D');pin(g,18,28,22,29,'D');
    civHeadFace(g);
    pin(g,15,14,16,20,'D');
    pin(g,9,22,22,23,'D');
    return toRows(g);
  }
  function makeCivCower(){
    var g=mkGrid(32,32),head=[
      [9,13,18],[10,12,19],[11,12,19],[12,12,19],[13,12,19],[14,12,19],[15,12,19],[16,13,18]];
    var torso=[
      [17,10,21],[18,9,22],[19,9,22],[20,9,22],[21,9,22],[22,9,22],[23,9,22],[24,9,22],
      [25,10,21],[26,10,21],[27,11,20]];
    spans(g,head.concat(torso),0,'M');
    rect(g,9,28,14,31,'M');rect(g,17,28,22,31,'M');   // bent legs, wide crouch stance
    rect(g,7,9,9,17,'M');rect(g,22,9,24,17,'M');      // arms raised beside the head
    rect(g,6,7,10,9,'M');rect(g,21,7,25,9,'M');       // mitts, raised above head height
    outlineFromFill(g,'K');
    pin(g,9,30,14,31,'D');pin(g,17,30,22,31,'D');     // boots
    pin(g,6,7,10,8,'D');pin(g,21,7,25,8,'D');         // gloves
    pin(g,13,10,18,15,'D');     // hood, head tucked low between the raised arms
    pin(g,14,11,17,14,'L');
    setclip(g,15,12,'K');setclip(g,16,12,'K');
    pin(g,10,27,21,27,'D');     // hem
    return toRows(g);
  }

  // =====================================================================
  // weapons, all horizontal with the muzzle on the right edge, anchor
  // {x:.4,y:.5}; render.js swings anchorX to .18 while firing, which is where
  // the grip sits, and flips them top-to-bottom when the aim goes left.
  // =====================================================================
  function ironAccents(g,list){list.forEach(function(p){setclip(g,p[0],p[1],p[2]);});}
  // the top-lit ramp leaves single texels at every taper; fold each one into
  // its commonest neighbour so a gun is clusters, not confetti (rule 11)
  function despeckle(g){
    var h=g.length,w=g[0].length,x,y,c,copy=g.map(function(r){return r.slice();});
    function at(px,py){return px<0||py<0||px>=w||py>=h?'.':copy[py][px];}
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      c=copy[y][x];if(c==='.'||c==='K')continue;
      var nb=[at(x-1,y),at(x+1,y),at(x,y-1),at(x,y+1)],counts={},best=null,k;
      if(nb.indexOf(c)>=0)continue;
      nb.forEach(function(v){if(v==='.'||v==='K')return;counts[v]=(counts[v]||0)+1;});
      for(k in counts)if(!best||counts[k]>counts[best])best=k;
      if(best)g[y][x]=best;
    }
  }

  function makePistol(){
    var g=mkGrid(20,10);
    rect(g,3,2,16,6,'M');      // slide
    rect(g,16,3,19,5,'M');     // barrel
    rect(g,2,5,6,9,'M');       // grip, centre x4 = .20w
    outlineFromFill(g,'K');
    shadeTopDown(g,'L','M','D');
    despeckle(g);
    pin(g,3,6,5,8,'D');        // grip is dark rubber, not slide steel
    ironAccents(g,[[7,3,'H'],[8,3,'H'],[9,3,'H'],[12,4,'K'],[13,4,'K'],[5,4,'D']]);
    return toRows(g);
  }
  function makeSmg(){
    var g=mkGrid(26,12);
    rect(g,0,4,6,7,'M');       // folding stock
    rect(g,5,3,17,8,'M');      // receiver
    rect(g,17,4,25,7,'M');     // barrel shroud
    rect(g,3,8,7,11,'M');      // grip, centre x5 = .19w
    rect(g,9,8,12,11,'M');     // magazine
    outlineFromFill(g,'K');
    shadeTopDown(g,'L','M','D');
    despeckle(g);
    pin(g,4,9,6,10,'D');
    pin(g,10,9,11,10,'D');
    ironAccents(g,[[7,4,'H'],[8,4,'H'],[9,4,'H'],[10,4,'H'],[13,5,'K'],[14,5,'K'],[20,5,'K'],[22,5,'K'],[2,5,'D']]);
    return toRows(g);
  }
  function makeAr(){
    var g=mkGrid(34,12);
    rect(g,0,3,7,8,'M');       // stock
    rect(g,6,2,18,8,'M');      // receiver
    rect(g,18,3,27,7,'M');     // handguard
    rect(g,27,4,33,6,'M');     // barrel
    rect(g,4,8,8,11,'M');      // grip, centre x6 = .18w
    rect(g,11,8,15,11,'M');    // magazine
    rect(g,21,0,23,3,'M');     // front sight
    rect(g,15,0,17,2,'M');     // rear sight
    outlineFromFill(g,'K');
    shadeTopDown(g,'L','M','D');
    despeckle(g);
    pin(g,5,9,7,10,'D');
    pin(g,12,9,14,10,'D');
    ironAccents(g,[[8,3,'H'],[9,3,'H'],[10,3,'H'],[11,3,'H'],[12,3,'H'],[13,3,'K'],[14,3,'K'],[19,4,'H'],[20,4,'H'],[21,4,'H'],[22,4,'H'],[24,4,'K'],[3,5,'D'],[4,5,'D']]);
    return toRows(g);
  }
  function makeShotgun(){
    var g=mkGrid(34,12);
    rect(g,0,4,9,9,'M');       // stock
    rect(g,9,3,18,8,'M');      // receiver stands a texel proud of the rest
    rect(g,18,4,33,6,'M');     // barrel
    rect(g,18,7,29,8,'M');     // magazine tube
    rect(g,20,6,27,9,'M');     // pump
    rect(g,4,8,8,11,'M');      // grip, centre x6 = .18w
    outlineFromFill(g,'K');
    shadeTopDown(g,'L','M','D');
    despeckle(g);
    pin(g,5,9,7,10,'D');
    pin(g,21,7,26,9,'D');      // the pump is the dark block you read it by
    ironAccents(g,[[11,4,'H'],[12,4,'H'],[13,4,'H'],[15,5,'K'],[16,5,'K'],[24,5,'H'],[25,5,'H'],[26,5,'H'],[2,6,'D'],[3,6,'D']]);
    return toRows(g);
  }
  function makeRifle(){
    var g=mkGrid(40,12);
    rect(g,0,4,11,9,'M');      // stock with a cheek rest
    rect(g,11,3,21,8,'M');     // receiver
    rect(g,21,5,39,7,'M');     // long barrel
    rect(g,14,0,25,2,'M');     // scope tube
    rect(g,16,2,17,3,'M');     // scope mounts
    rect(g,22,2,23,3,'M');
    rect(g,19,8,22,10,'M');    // bolt handle
    rect(g,5,8,9,11,'M');      // grip, centre x7 = .18w
    outlineFromFill(g,'K');
    shadeTopDown(g,'L','M','D');
    despeckle(g);
    pin(g,6,9,8,10,'D');
    pin(g,20,9,21,9,'D');
    ironAccents(g,[[18,1,'H'],[19,1,'H'],[20,1,'H'],[23,1,'D'],[24,1,'D'],[15,1,'D'],[16,1,'D'],[13,4,'K'],[14,4,'K'],[3,6,'D'],[4,6,'D'],[7,5,'H'],[8,5,'H'],[9,5,'H'],[10,5,'H']]);
    return toRows(g);
  }
  function makeFlame(){
    var g=mkGrid(36,16);
    rect(g,0,4,9,11,'M');      // fuel tank slung at the back
    cutCorners(g,0,4,9,11,1);
    rect(g,8,5,17,10,'M');     // body, bottom edge stepped so the ramp cannot band
    rect(g,16,5,23,9,'M');
    rect(g,5,11,9,15,'M');     // grip, centre x7 = .19w
    rect(g,23,6,32,9,'M');     // nozzle
    outlineFromFill(g,'K');
    shadeTopDown(g,'L','M','D');
    despeckle(g);
    pin(g,6,12,8,14,'D');      // grip
    pin(g,2,5,4,10,'D');       // tank strap, vertical: no stacked bands
    pin(g,1,8,1,9,'D');        // seam
    pin(g,5,5,7,6,'H');        // tank glint
    pin(g,12,7,18,8,'D');      // pressure drum
    pin(g,24,7,29,7,'D');      // vent groove along the nozzle
    ironAccents(g,[[13,6,'H'],[14,6,'H'],[15,6,'H'],[31,8,'D']]);
    // ember pilot light past the nozzle tip: near-white core, a ring of the
    // saturated hue, one darker ring (rule 35). It sits on the sprite's right
    // edge, which is where render.js hangs the muzzle flash.
    ironAccents(g,[
      [34,4,'O'],[33,5,'O'],[34,5,'O'],
      [33,6,'Y'],[34,6,'W'],
      [33,7,'Y'],[34,7,'W'],[35,7,'Y'],
      [33,8,'Y'],[34,8,'W'],[35,8,'Y'],
      [34,9,'W'],[35,9,'Y'],
      [34,10,'O'],[35,10,'O']]);
    return toRows(g);
  }

  var IRON='MAT.iron';
  var flamePal=Object.assign({},MAT.rust,{O:MAT.ember.O,Y:MAT.ember.Y,W:MAT.ember.W});

  A.define('survivors',{
    body:{
      frames:{
        down:[makeDown(0),makeDown(1),makeDown(2),makeDown(3)],
        up:[makeUp(0),makeUp(1),makeUp(2),makeUp(3)],
        side:[makeSide(0),makeSide(1),makeSide(2),makeSide(3)]
      },
      pal:'survivor',fps:8,anchor:'feet',
      note:'32x32 walk, contact/pass/contact/pass, opposite legs; C jacket is the player tag'},
    bodyIdle:{
      frames:{
        down:[makeIdle('down',0),makeIdle('down',1)],
        up:[makeIdle('up',0),makeIdle('up',1)],
        side:[makeIdle('side',0),makeIdle('side',1)]
      },
      pal:'survivor',fps:3,anchor:'feet',
      note:'32x32 idle, feet planted, 1-texel breathing lift'},
    downed:{rows:makeDowned(),pal:'survivor',anchor:{x:.5,y:.68},
      note:'32x20 sprawled toward the camera, jacket tint still reads'},
    civilian:{frames:{down:[makeCivIdle(),makeCivStep(),makeCivCower()]},pal:'MAT.sandbag',anchor:'feet',
      note:'32x32, unarmed hooded civilian in muted sandbag-tan winter clothes, no jacket tint; frame 2 crouches with arms up'},
    wpn_pistol:{rows:makePistol(),pal:IRON,anchor:{x:.4,y:.5},note:'20x10 sidearm, muzzle on the right edge'},
    wpn_smg:{rows:makeSmg(),pal:IRON,anchor:{x:.4,y:.5},note:'26x12 folding-stock SMG, box mag'},
    wpn_ar:{rows:makeAr(),pal:IRON,anchor:{x:.4,y:.5},note:'34x12 assault rifle, curved mag, iron sights'},
    wpn_shotgun:{rows:makeShotgun(),pal:IRON,anchor:{x:.4,y:.5},note:'34x12 pump shotgun, dark foreend'},
    wpn_rifle:{rows:makeRifle(),pal:IRON,anchor:{x:.4,y:.5},note:'40x12 scoped bolt rifle, long barrel'},
    wpn_flame:{rows:makeFlame(),pal:flamePal,anchor:{x:.4,y:.5},note:'36x16 flamethrower, rust tank, ember pilot light'}
  });
})();
