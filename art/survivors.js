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
  // civilian 32x32, anchor feet. frames:{down:[walkA,walkB,cower, ...]}:
  // the Linden Street evacuees. Frames come in groups of three per person —
  // 0-1 walking toward the camera, 2 cowering — so render.js keeps reading
  // frames 0/1/2 and may add 3*k to pick person k (ART.draw wraps frames).
  //
  // They are ordinary people who left in a hurry on Day 9: coats over
  // indoor clothes, a bag grabbed on the way out, no weapons, no tint. Each
  // person is a different build (tall/thin, stout, broad, slight) and a
  // different coat hue, so a group of four reads as four people, and skin is
  // kept to the face and hands so nobody reads as a bare flesh-toned block.
  // Fear is carried by pose: shoulders hunched up to the jaw, an open mouth,
  // a bag clutched to the chest, arms wrapped round the body, and a crouch
  // with both forearms over the head.
  //
  // Palette: one shared outline K and shoe/deep-shadow D; coat ramps are
  // hue-shifted ramp.mjs steps (blue-grey 240, plum 10, olive 120, camel 70),
  // skin from the 55/45/40 ramps, all well above the night ground's value.
  // =====================================================================
  var CIV_PAL={
    K:'#0f0f11',D:'#1d1f28',
    A:'#24374b',B:'#335166',E:'#4c6b7a',          // blue-grey parka
    F:'#4b202f',G:'#6c343e',I:'#83504f',          // plum wool coat
    J:'#2c3b1e',N:'#49522b',P:'#686946',          // olive field jacket
    Q:'#533319',U:'#6e4e27',X:'#826d47',          // camel hoodie / leather bag
    j:'#2f3a40',c:'#333235',                      // denim, charcoal trousers
    s:'#b6774a',h:'#c79867',                      // skin, light
    m:'#81462b',n:'#916241',                      // skin, brown
    d:'#562a1a',e:'#65412b',                      // skin, dark
    b:'#28231d',g:'#8f9394',o:'#68696c'           // dark hair, grey hair + shade
  };
  // one person: coat [shade,mid,light], trousers, skin [mid,light], hair,
  // head half-width hh, torso half-width th, arm width aw (outline incl.),
  // leg width lw, head top row t, coat hem row, flare (hem widening), style, carry
  var CIVS=[
    {coat:'ABE',legs:'j',skin:'sh',hair:'b',hh:4,th:3,aw:3,lw:4,t:1,hem:21,flare:0,style:'hair',carry:'pack'},
    {coat:'FGI',legs:'c',skin:'hs',hair:'g',hh:5,th:5,aw:3,lw:5,t:4,hem:26,flare:1,style:'bun',carry:'clutch'},
    {coat:'JNP',legs:'U',skin:'mn',hair:'b',hh:5,th:4,aw:4,lw:5,t:2,hem:21,flare:0,style:'beanie',carry:'case'},
    {coat:'QUX',legs:'j',skin:'de',hair:'b',hh:4,th:3,aw:3,lw:4,t:6,hem:23,flare:0,style:'hood',carry:'hug'}
  ];
  // head silhouette rows t..t+8, rounded one texel at top and bottom
  function civHeadSil(g,cx,t,hh){
    var y;for(y=0;y<9;y++){var w=(y===0||y===8)?hh-1:hh;rect(g,cx-w,t+y,cx+w-1,t+y,'x');}
  }
  // face and hair inside a head whose top outline row is t
  function civFace(g,cx,t,hh,p,look){
    var sk=p.skin[0],li=p.skin[1],x0=cx-hh+1,x1=cx+hh-2;
    pin(g,x0,t+1,x1,t+7,sk);
    pin(g,x0,t+3,cx-1,t+3,li);                   // lit brow, top-left light
    pin(g,x1,t+5,x1,t+7,'D');                    // jaw side in shadow
    var ex=look||0;
    if(p.style==='hair'||p.style==='bun'){
      var hc=p.hair,hs=p.hair==='g'?'o':'D';
      pin(g,x0,t+1,x1,t+2,hc);
      pin(g,x0,t+3,x0,t+5,hc);pin(g,x1,t+3,x1,t+4,hs);
      pin(g,cx,t+1,x1,t+1,hs);                   // parting, shade side
      if(p.style==='bun'){pin(g,x0,t+3,x0,t+6,hc);}
    }else if(p.style==='beanie'){
      pin(g,x0,t+1,x1,t+2,'c');                  // charcoal knit cap
      pin(g,x0,t+3,x1,t+3,'o');                  // rolled brim
      pin(g,x0,t+1,cx-2,t+1,'o');
      pin(g,x1,t+4,x1,t+5,p.hair);
    }else if(p.style==='hood'){
      pin(g,x0,t+1,x1,t+2,p.coat[1]);            // hood up, drawn close round the face
      pin(g,x0,t+1,cx-1,t+1,p.coat[2]);
      pin(g,x0,t+3,x0,t+7,p.coat[1]);pin(g,x1,t+3,x1,t+7,p.coat[0]);
      pin(g,x0+1,t+3,x1-1,t+3,p.hair);           // fringe under the hood
    }
    setclip(g,cx-2+ex,t+5,'K');setclip(g,cx+1+ex,t+5,'K');   // eyes
    pin(g,cx-1+ex,t+7,cx+ex,t+7,'K');            // open mouth
  }
  // coat body shading: light on the near (left) shoulder, shade down the right
  function civCoat(g,cx,p,y0,y1,th){
    var sh=p.coat[0],md=p.coat[1],lt=p.coat[2];
    pin(g,cx-th+1,y0,cx+th-2,y1,md);
    pin(g,cx-th+1,y0,cx-1,y0,lt);
    pin(g,cx+th-2,y0+2,cx+th-2,y1-1,sh);
    if(p.carry!=='hug')pin(g,cx-1,y0+1,cx-1,y1-2,sh);   // zip / button line
    pin(g,cx-th+2,y1,cx+th-2,y1,sh);             // hem shadow
  }
  function makeCivWalk(p,f){
    var g=mkGrid(32,32),cx=16,t=p.t,hh=p.hh,th=p.th,aw=p.aw,sh=th+aw;
    var sy=t+9,arm0=sy+1,hand=sy+10,hem=p.hem;
    var handL=hand+(f?1:0),handR=hand+(f?0:1);
    var legL=f?29:31,legR=f?31:29;                // the lifted foot is the stepping one
    var lw=p.lw;                                  // leg width with outline
    civHeadSil(g,cx,t,hh);
    rect(g,cx-sh+1,sy,cx+sh-2,sy,'x');            // hunched shoulders tight under the jaw
    rect(g,cx-sh,sy+1,cx+sh-1,sy+2,'x');
    rect(g,cx-th,sy+1,cx+th-1,hem,'x');           // coat
    if(p.flare)rect(g,cx-th-1,hem-3,cx+th,hem,'x');
    var clutch=p.carry==='clutch',hug=p.carry==='hug';
    // arms: hanging (with a swing) unless the pose holds something to the body
    if(hug){handL=sy+6;handR=sy+6;}
    if(clutch)handR=sy+7;
    rect(g,cx-sh,arm0,cx-th-1,handL,'x');
    rect(g,cx+th,arm0,cx+sh-1,handR,'x');
    rect(g,cx-1-lw,hem+1,cx-2,legL,'x');          // two legs with a 2-texel gap of daylight
    rect(g,cx+1,hem+1,cx+lw,legR,'x');
    if(p.carry==='pack'){rect(g,cx-sh-1,sy-2,cx-sh+1,sy+3,'x');rect(g,cx+sh-2,sy-2,cx+sh,sy+3,'x');}
    if(p.carry==='case')rect(g,cx+sh-1,handR+1,cx+sh+4,handR+6,'x');
    if(clutch)rect(g,cx-3,sy+4,cx+2,sy+9,'x');
    outlineFromFill(g,'K');
    // seams: a K line between each hanging arm and the coat (rule 16)
    if(!hug){
      pin(g,cx-th,sy+3,cx-th,Math.min(handL,hem),'K');
      if(!clutch)pin(g,cx+th-1,sy+3,cx+th-1,Math.min(handR,hem),'K');
    }
    civCoat(g,cx,p,sy,hem,th);
    // sleeves
    var md=p.coat[1],lt=p.coat[2],sd=p.coat[0];
    pin(g,cx-sh+1,arm0,cx-th-1,handL-3,md);
    pin(g,cx-sh+1,arm0,cx-sh+1,handL-4,lt);
    pin(g,cx+th,arm0,cx+sh-2,handR-3,sd);
    pin(g,cx-sh+1,sy,cx-th,sy,lt);               // lit shoulder
    // hands
    pin(g,cx-sh+1,handL-2,cx-th-1,handL-1,p.skin[0]);
    pin(g,cx+th,handR-2,cx+sh-2,handR-1,p.skin[0]);
    pin(g,cx-sh+1,handL-2,cx-sh+1,handL-2,p.skin[1]);
    // legs and shoes
    pin(g,cx-lw,hem+1,cx-3,legL-2,p.legs);
    pin(g,cx+2,hem+1,cx+lw-1,legR-2,p.legs);
    pin(g,cx+lw-1,hem+2,cx+lw-1,legR-3,'D');      // shade side of the far leg
    pin(g,cx-lw,legL-1,cx-3,legL-1,'D');          // shoes
    pin(g,cx+2,legR-1,cx+lw-1,legR-1,'D');
    // carried things
    if(p.carry==='pack'){                          // backpack peeking over both shoulders, straps down the front
      pin(g,cx-sh,sy-1,cx-sh,sy+2,'U');pin(g,cx+sh-1,sy-1,cx+sh-1,sy+2,'Q');   // canvas pack, not hair
      pin(g,cx-th+1,sy+1,cx-th+1,sy+5,'D');pin(g,cx+th-2,sy+1,cx+th-2,sy+5,'D');
    }
    if(p.carry==='case'){                          // a suitcase grabbed on the way out
      pin(g,cx+sh,handR+2,cx+sh+3,handR+5,'c');
      pin(g,cx+sh,handR+2,cx+sh+2,handR+2,'o');   // lit lid edge
      pin(g,cx+sh,handR+5,cx+sh+3,handR+5,'D');
      pin(g,cx+sh+1,handR+3,cx+sh+2,handR+3,'D');   // latch strap
    }
    if(clutch){                                    // handbag hugged to the chest with both hands
      pin(g,cx-2,sy+5,cx+1,sy+8,'Q');
      pin(g,cx-2,sy+5,cx,sy+5,'X');
      pin(g,cx-2,sy+7,cx-2,sy+8,p.skin[0]);        // fingers over the bag
      pin(g,cx+1,sy+6,cx+1,sy+7,p.skin[0]);
    }
    if(hug){                                       // arms wrapped round the body
      pin(g,cx-th,sy+4,cx+th-1,sy+5,sd);
      pin(g,cx-th,sy+4,cx-1,sy+4,md);
      pin(g,cx-sh+1,sy+4,cx-th-1,sy+5,p.skin[0]);
      pin(g,cx+th,sy+4,cx+sh-2,sy+5,p.skin[0]);
    }
    civHeadSil2(g,cx,t,hh);
    civFace(g,cx,t,hh,p,f&&p.carry==='pack'?-1:0);
    civFill(g);
    return toRows(g);
  }
  // collar shadow on the chin row reads the head off the hunched shoulders
  function civHeadSil2(g,cx,t,hh){pin(g,cx-hh+1,t+8,cx+hh-2,t+8,'D');}
  function civFill(g){g.forEach(function(r){for(var i=0;i<r.length;i++)if(r[i]==='x')r[i]='D';});}
  // cower: crouched into a ball with the head bowed, hands clasped on the
  // crown and both forearms making a roof down to the elbows, knees and
  // shoes under the folded body. Authored as the left half (rows 11-31) and
  // mirrored, swapping light for shade on the right; roles are mapped per
  // person: 1 coat mid, 3 coat light, 2 coat shade, h hair/hood/cap,
  // s skin, l lit skin, t trousers. Broad builds widen the body a texel a side.
  var CIV_COWER=[
    '.............KKK',
    '...........KKlss',
    '.........KK31Kss',
    '........K311Khhh',
    '.......K311Khhhh',
    '......K311Khhhhh',
    '......K311Khhhhh',
    '......K311KDhhhh',
    '......K211KDsKss',
    '.......K21KKDDDD',
    '........K3111111',
    '........K3111111',
    '........K1111111',
    '........K1111111',
    '........K1111112',
    '.......KK2222222',
    '.......KttttttKD',
    '.......KttttttKD',
    '......KKttttttKD',
    '......KDDDDDDDKD',
    '......KKKKKKKKKK'];
  function makeCivCower(p){
    var wide=p.th>=4,out=[],y;
    var hair=p.style==='hood'?p.coat[0]:p.style==='beanie'?'c':p.hair;
    var hairShade=p.hair==='g'&&p.style!=='hood'?'o':(p.style==='hood'?'D':'D');
    function mapL(ch){return ({'1':p.coat[1],'2':p.coat[0],'3':p.coat[2],h:hair,s:p.skin[0],l:p.skin[1],t:p.legs})[ch]||ch;}
    for(y=0;y<11;y++)out.push(Array(33).join('.'));
    CIV_COWER.forEach(function(L,i){
      if(wide&&i>=10)L=L.slice(1)+L[15];
      var R=L.split('').reverse().map(function(ch){return ch==='3'?'2':ch==='l'?'s':ch;}).join('');
      out.push((L+R).split('').map(mapL).join(''));
    });
    var g=out.map(function(r){return r.split('');});
    pin(g,17,15,19,17,hair===p.hair?hairShade:p.coat[0]);   // crown in shade on the right
    if(hair!==p.hair)pin(g,13,18,18,18,p.hair);   // fringe under a hood or cap
    return toRows(g);
  }
  function civFrames(){
    var out=[];
    CIVS.forEach(function(p){out.push(makeCivWalk(p,0),makeCivWalk(p,1),makeCivCower(p));});
    return out;
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
  function makeLauncher(){ // stubby break-open grenade launcher: skeletal stock, fat revolving drum, short wide barrel
    var g=mkGrid(34,12);
    rect(g,0,5,7,8,'M');rect(g,0,4,2,9,'M');  // skeletal stock and butt pad
    rect(g,7,4,13,8,'M');                        // receiver
    rect(g,12,2,21,10,'M');                      // drum, taller than the rest
    rect(g,21,3,33,8,'M');                       // barrel
    rect(g,5,8,8,11,'M');                        // grip, centre x6 = .18w
    outlineFromFill(g,'K');
    shadeTopDown(g,'L','M','D');
    despeckle(g);
    pin(g,14,4,19,8,'D');                        // drum face reads dark
    ironAccents(g,[[14,5,'K'],[16,5,'K'],[18,5,'K'],[14,7,'K'],[16,7,'K'],[18,7,'K'],[23,4,'H'],[24,4,'H'],[25,4,'H'],[32,5,'K'],[32,6,'K'],[1,6,'D']]);
    return toRows(g);
  }
  // deployed sentry turret, seen from the 3/4 camera: a splayed tripod, a squat post and a side ammo box.
  // The gun head is a separate sprite so render.js can turn it toward its target without turning the legs.
  function makeTurretBase(){
    var g=mkGrid(26,16),i;
    for(i=0;i<=8;i++){rect(g,9-i,7+i*.9|0,11-i,8+i*.9|0,'M');rect(g,14+i,7+i*.9|0,16+i,8+i*.9|0,'M');}rect(g,0,14,3,15,'M');rect(g,22,14,25,15,'M'); // front legs splay down-left and down-right
    rect(g,12,2,13,4,'M');                       // rear leg foreshortened behind the post
    rect(g,10,4,15,10,'M');                      // post collar
    rect(g,16,6,21,10,'M');                      // ammo box on the right
    outlineFromFill(g,'K');
    shadeTopDown(g,'L','M','D');
    despeckle(g);
    pin(g,17,8,20,9,'D');ironAccents(g,[[18,7,'H'],[11,5,'H'],[12,5,'H'],[12,8,'D'],[13,8,'D']]);
    return toRows(g);
  }
  function makeTurretHead(){ // faces +x like the weapons: receiver with a top rail, perforated shroud, short muzzle
    var g=mkGrid(24,10);
    rect(g,0,2,9,8,'M');                         // receiver
    rect(g,2,1,7,1,'M');                         // top rail
    rect(g,9,3,17,7,'M');                        // shroud
    rect(g,17,4,23,6,'M');                       // barrel
    outlineFromFill(g,'K');
    shadeTopDown(g,'L','M','D');
    despeckle(g);
    ironAccents(g,[[11,5,'K'],[13,5,'K'],[15,5,'K'],[3,4,'D'],[4,4,'D'],[5,4,'D'],[22,5,'K'],[1,3,'H']]);
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
    civilian:{frames:{down:civFrames()},pal:CIV_PAL,anchor:'feet',
      note:'32x32, four evacuees x [walkA, walkB, cower]; frame 3k+i is person k (tall parka + pack, stout plum coat + bag, broad olive jacket + case, slight camel hood hugging herself)'},
    wpn_pistol:{rows:makePistol(),pal:IRON,anchor:{x:.4,y:.5},note:'20x10 sidearm, muzzle on the right edge'},
    wpn_smg:{rows:makeSmg(),pal:IRON,anchor:{x:.4,y:.5},note:'26x12 folding-stock SMG, box mag'},
    wpn_ar:{rows:makeAr(),pal:IRON,anchor:{x:.4,y:.5},note:'34x12 assault rifle, curved mag, iron sights'},
    wpn_shotgun:{rows:makeShotgun(),pal:IRON,anchor:{x:.4,y:.5},note:'34x12 pump shotgun, dark foreend'},
    turret_base:{rows:makeTurretBase(),pal:IRON,anchor:'feet',note:'26x16 deployed sentry tripod, post collar and side ammo box'},
    turret_head:{rows:makeTurretHead(),pal:IRON,anchor:{x:.3,y:.5},note:'24x10 sentry gun head facing +x, perforated shroud'},
    wpn_launcher:{rows:makeLauncher(),pal:IRON,anchor:{x:.4,y:.5},note:'34x12 grenade launcher, revolving drum, short wide barrel'},
    wpn_rifle:{rows:makeRifle(),pal:IRON,anchor:{x:.4,y:.5},note:'40x12 scoped bolt rifle, long barrel'},
    wpn_flame:{rows:makeFlame(),pal:flamePal,anchor:{x:.4,y:.5},note:'36x16 flamethrower, rust tank, ember pilot light'}
  });
})();
