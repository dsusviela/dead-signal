// Dead Signal barricade: the military containment line thrown across each
// quarantine avenue, abandoned in a hurry and then overrun. One texel = one
// world unit (den 1).
//
// Orientation: `jersey`, `sandbagNest`, `humvee` and `tentMil` are placed with
// rot:1 on the east/west barricades, which makes render.js drawSolid draw them
// CENTRED and rotated -90 instead of standing on their feet. So every one of
// them is authored horizontal (long axis = +x, front/entrance to the left), its
// sprite exactly fills its collision rect (no roof overhang, unlike wrecks.js),
// and its mass is spread over the whole canvas so the rotated copy does not
// float inside its box. A -90 turn maps the sprite's top edge onto the screen's
// left, so "lit from the top" becomes "lit from the left" when rotated: both
// are legal top-down keys (rule 27), which is why the light here is straight
// top and never top-left.
//
// Flat decals (`razorWire`, `bodyBag`, `bloodSplat`) are anchor 'center' and
// are drawn under everything at ground level. There are four splats and three
// bags per barricade before the fight adds any, so they stay in the K/D end of
// their ramps with no highlights at all.
(function(){
  'use strict';
  var A=(typeof window!=='undefined'?window:globalThis).DSArt;
  var MAT=A.MAT;

  // ---- grid helpers (art/wrecks.js style: build on a grid, emit rows) ----
  function mkGrid(w,h){var g=[],y,x,row;for(y=0;y<h;y++){row=[];for(x=0;x<w;x++)row.push('.');g.push(row);}return g;}
  function setclip(g,x,y,ch){if(y>=0&&y<g.length&&x>=0&&x<g[0].length)g[y][x]=ch;}
  function at(g,x,y){return(y<0||y>=g.length||x<0||x>=g[0].length)?'.':g[y][x];}
  function rect(g,x0,y0,x1,y1,ch){var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)setclip(g,x,y,ch);}
  function toRows(g){return g.map(function(r){return r.join('');});}
  function pal2(base,extra){return Object.assign({},base,extra);}
  // filled ellipse, for wheels, turret rings and blood pools
  function disc(g,cx,cy,rx,ry,ch){
    var x,y;
    for(y=-ry;y<=ry;y++)for(x=-rx;x<=rx;x++)if((x*x)/(rx*rx)+(y*y)/(ry*ry)<=1)setclip(g,cx+x,cy+y,ch);
  }
  // bite a staircase off each of the four corners; `corner` is '.' for a real
  // silhouette cut or a shade letter to keep the mass and only round the read
  function cutCorners(g,x0,y0,x1,y1,c,corner){
    var x,y,dl,dr,dt,db;
    for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++){
      dl=x-x0;dr=x1-x;dt=y-y0;db=y1-y;
      if((dl<c&&dt<c&&dl+dt<c)||(dr<c&&dt<c&&dr+dt<c)||(dl<c&&db<c&&dl+db<c)||(dr<c&&db<c&&dr+db<c))setclip(g,x,y,corner);
    }
  }
  // a rounded filled box
  function lump(g,x0,y0,x1,y1,c,fill,corner){rect(g,x0,y0,x1,y1,fill);cutCorners(g,x0,y0,x1,y1,c,corner);}
  // 1-texel K outline wherever a filled texel meets transparent or the canvas edge
  function outlineFrom(g,K){
    var h=g.length,w=g[0].length,x,y,src=g.map(function(r){return r.slice();});
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      if(src[y][x]==='.')continue;
      if(x===0||x===w-1||y===0||y===h-1||src[y][x-1]==='.'||src[y][x+1]==='.'||src[y-1][x]==='.'||src[y+1][x]==='.')g[y][x]=K;
    }
  }
  // drop a 1-texel dark under-edge below every texel of `ltr` that has open
  // ground below it; gives thin ground art (wire, zips) weight without an outline
  function underShadow(g,ltr,K){
    var h=g.length,w=g[0].length,x,y,src=g.map(function(r){return r.slice();});
    for(y=0;y<h;y++)for(x=0;x<w;x++)if(ltr.indexOf(src[y][x])>=0&&at(g,x,y+1)==='.')setclip(g,x,y+1,K);
  }
  // turn every texel of `from` whose four neighbours are all `from` into `to`:
  // a blob keeps a 1-texel rim of the lighter shade and goes dark in the middle,
  // which is how a dried pool actually sits and keeps the decals near-black
  function erode(g,from,to){
    var h=g.length,w=g[0].length,x,y,src=g.map(function(r){return r.slice();});
    function s(px,py){return(py<0||py>=h||px<0||px>=w)?'.':src[py][px];}
    for(y=0;y<h;y++)for(x=0;x<w;x++)
      if(src[y][x]===from&&s(x-1,y)===from&&s(x+1,y)===from&&s(x,y-1)===from&&s(x,y+1)===from)g[y][x]=to;
  }
  // one sandbag: a rounded loaf, lit across the crown, bedded in the D shade
  // that fills the interstices so a packed course reads as lumps and not as
  // brickwork (rule 16: a value step instead of a gap).
  function bag(g,x0,y0,bw,bh,seed){
    var x1=x0+bw-1,y1=y0+bh-1;
    rect(g,x0,y0,x1,y1,'D');
    lump(g,x0+1,y0+1,x1-1,y1-2,2,'M','D');
    rect(g,x0+3,y0+1,x1-3,y0+2,'L');
    setclip(g,x0+2,y0+2,'L');setclip(g,x1-2,y0+2,'L');
    // the tie at one end, offset per bag so the pile is not a grid; a seam run
    // up the whole bag read as a keyhole punched through it
    var sx=x0+2+(seed%3)*4;
    rect(g,sx,y0+4,sx+1,y0+5,'D');
    if(seed%3===0){setclip(g,x0+4,y0+1,'H');setclip(g,x0+5,y0+1,'H');}
  }
  function bagRow(g,xs,y,bw,bh,seed){for(var i=0;i<xs.length;i++)bag(g,xs[i],y,bw,bh,seed+i);}

  // =====================================================================
  // jersey 48x24 [48x24], anchor feet, rot 0 or 1. A concrete barrier segment
  // seen from above: a lit crown band, the near slope falling away to a dark
  // base flare, a strip of hazard tape and a knocked-off corner with rusted
  // rebar in the scar. The row in world.js:79 abuts segments end to end, so
  // the cut corners double as the seam between them.
  // =====================================================================
  function makeJersey(){
    var w=48,h=24,g=mkGrid(w,h),x,y,i;
    // band edges wobble by +-1 per 4-column group: cast concrete rather than a
    // gradient, and no two full-width runs hug in parallel (rule 12)
    var wob=[0,0,1,0,-1,0,1,0,0,-1,0,1];
    function jog(x,o){return wob[(((x>>2)+o)%wob.length+wob.length)%wob.length];}
    for(x=0;x<w;x++){
      var a=4+jog(x,0),b=12+jog(x,4),c=19+jog(x,8);
      rect(g,x,0,x,a,'L');
      rect(g,x,a+1,x,b,'M');
      rect(g,x,b+1,x,c,'D');
      rect(g,x,c+1,x,h-1,'K');
    }
    // crown highlight: three short dashes, never a full-length line (rule 14)
    rect(g,5,1,12,1,'H');rect(g,22,1,28,1,'H');rect(g,36,1,40,1,'H');
    // weathering: a few grime clusters on the lit face (rule 13)
    rect(g,15,2,17,3,'M');rect(g,31,3,33,4,'M');rect(g,7,9,9,10,'D');rect(g,40,10,43,11,'D');
    // reflective hazard tape: the only saturated accent on a grey mass (rule 21)
    for(y=6;y<=8;y++)for(x=17;x<=30;x++)setclip(g,x,y,((x+y)%6)<3?'K':'Y');
    rect(g,17,6,17,8,'K');rect(g,30,6,30,8,'K');
    // a crack off the crown, 2-texel steps
    var cx=9,cy=2;
    for(i=0;i<6;i++){setclip(g,cx,cy,'D');setclip(g,cx,cy+1,'D');cy+=2;if(i%2)cx+=1;}
    // the far corner knocked off, rusted rebar stubs standing in the scar
    for(y=0;y<=5;y++)for(x=43+(y>>1)*2;x<w;x++)setclip(g,x,y,'.');
    setclip(g,43,5,'R');setclip(g,43,6,'R');setclip(g,45,7,'S');setclip(g,45,8,'S');
    setclip(g,44,6,'S');setclip(g,46,8,'R');setclip(g,46,9,'R');
    cutCorners(g,0,0,w-1,h-1,2,'.');
    outlineFrom(g,'K');
    return toRows(g);
  }

  // =====================================================================
  // sandbagNest 56x30 [56x30], anchor feet, rot 0 or 1. Two full courses of
  // bags across the back and two broken legs running forward, so the silhouette
  // is a C that still reads as an emplacement after a quarter turn. The mouth
  // widens toward the near side, the floor inside is trampled dark with spent
  // brass, a dropped ammo can and a dried pool where the gunner was.
  // =====================================================================
  function makeNest(){
    var w=56,h=30,g=mkGrid(w,h);
    // trampled floor first; the bags are laid over it
    // the mouth and the trampled floor: near-black, so the C of bags reads as a
    // C and not as a solid wall (the first pass filled it in sandbag D and the
    // emplacement vanished)
    rect(g,0,8,55,29,'K');
    rect(g,16,10,39,27,'D');
    erode(g,'D','K');
    // three courses: two full across the back, the third only at the two legs
    bagRow(g,[-2,10,22,34,46],0,12,9,0);
    bagRow(g,[-2,10],9,12,9,3);bagRow(g,[38,50],9,12,9,5);
    bagRow(g,[2,14],18,12,9,1);bagRow(g,[34,46],18,12,9,4);
    // the leg the runners came over: the inner bag burst, sand spilled inward
    rect(g,30,18,39,26,'D');
    lump(g,31,19,38,25,2,'M','D');
    rect(g,26,24,32,27,'D');
    setclip(g,25,25,'M');setclip(g,26,25,'M');setclip(g,28,27,'M');setclip(g,29,27,'M');
    // inside the mouth: an ammo can on its side, spent brass, a dried pool
    rect(g,17,13,25,18,'I');rect(g,17,13,25,13,'J');rect(g,17,18,25,18,'K');
    rect(g,19,15,23,16,'K');
    setclip(g,27,14,'H');setclip(g,28,14,'H');setclip(g,16,22,'H');setclip(g,17,22,'H');
    setclip(g,29,10,'H');setclip(g,30,10,'H');
    disc(g,24,23,4,2,'B');setclip(g,20,20,'B');setclip(g,21,20,'B');
    erode(g,'B','K');
    outlineFrom(g,'K');
    return toRows(g);
  }

  // =====================================================================
  // sandbagWall 48x20 [48x20], anchor feet, never rotated (world.js:194,198).
  // Two staggered courses, the top one gapped where a bag was dragged out.
  // =====================================================================
  function makeSandbagWall(){
    var w=48,h=20,g=mkGrid(w,h);
    rect(g,0,14,47,19,'K');
    rect(g,3,15,44,18,'D');
    bagRow(g,[0,12,24,36],0,12,9,0);
    bagRow(g,[-6,6,18,30,42],8,12,9,2);
    // a bag hauled out of the top course; the one under it split open
    rect(g,24,0,34,7,'.');
    rect(g,25,5,33,8,'D');
    setclip(g,27,4,'M');setclip(g,28,4,'M');setclip(g,30,3,'M');setclip(g,31,3,'M');
    setclip(g,4,2,'H');setclip(g,5,2,'H');setclip(g,40,10,'H');setclip(g,41,10,'H');
    outlineFrom(g,'K');
    return toRows(g);
  }

  // =====================================================================
  // humvee 84x48 [84x48], anchor feet, rot 0 or 1. Plan view, front at the
  // left: bonnet louvres, a shattered windscreen, an open and empty turret
  // ring (the gunner's hatch is the read that survives the quarter turn), a
  // spare on the rear deck, four wheels with the near-rear one flat. Blood
  // down the driver's door, bullet holes rimmed in rust.
  // =====================================================================
  function makeHumvee(){
    var w=84,h=48,g=mkGrid(w,h),i;
    // body: lit toward the top, shaded toward the near side (rule 28)
    rect(g,3,6,80,41,'M');
    rect(g,3,6,80,17,'L');
    rect(g,3,36,80,41,'D');
    rect(g,2,42,81,45,'K');
    // bonnet, louvres and grille
    rect(g,3,8,25,39,'M');
    rect(g,3,8,25,16,'L');
    for(i=0;i<3;i++)rect(g,8+i*5,13,8+i*5,34,'D');
    rect(g,3,10,5,37,'I');rect(g,3,10,3,37,'K');
    rect(g,26,8,27,39,'K');
    // windscreen: glass, one glint, then punched through
    rect(g,28,10,35,37,'G');
    setclip(g,29,12,'g');setclip(g,30,12,'g');setclip(g,29,13,'g');
    rect(g,31,20,33,27,'K');
    setclip(g,30,19,'K');setclip(g,34,24,'K');setclip(g,32,29,'K');setclip(g,32,30,'K');
    // cab roof and doors
    rect(g,36,8,60,39,'M');
    rect(g,38,10,58,20,'L');
    rect(g,44,8,44,39,'D');rect(g,58,8,58,39,'D');
    setclip(g,42,32,'H');setclip(g,43,32,'H');setclip(g,56,32,'H');setclip(g,57,32,'H');
    // turret ring, open and empty: a lit rim on the light side, hatch dogs round it
    disc(g,50,24,9,9,'J');
    disc(g,50,24,8,8,'I');
    disc(g,50,24,6,6,'K');
    rect(g,47,16,52,16,'J');rect(g,47,32,52,32,'K');
    setclip(g,41,23,'J');setclip(g,41,24,'J');setclip(g,59,25,'J');setclip(g,59,26,'J');
    // rear deck: cross ribs and the spare
    rect(g,61,8,80,39,'M');
    rect(g,61,10,80,17,'L');
    rect(g,66,8,67,39,'D');rect(g,75,8,76,39,'D');
    disc(g,71,26,7,7,'J');disc(g,71,26,5,5,'K');disc(g,71,26,2,2,'I');
    rect(g,70,19,72,20,'K');rect(g,70,32,72,33,'K');rect(g,64,25,65,27,'K');rect(g,77,25,78,27,'K');
    // wheels: rounded dark blocks, near-rear one squashed flat
    lump(g,9,0,23,9,2,'J','.');rect(g,11,3,21,5,'I');rect(g,9,8,23,9,'K');
    lump(g,9,37,23,46,2,'J','.');rect(g,11,41,21,43,'I');rect(g,9,37,23,38,'K');
    lump(g,60,0,74,9,2,'J','.');rect(g,62,3,72,5,'I');rect(g,60,8,74,9,'K');
    lump(g,59,40,75,46,2,'J','.');rect(g,61,43,73,44,'I');rect(g,59,40,75,41,'K');
    // it was fought over: blood down the driver's door, holes rimmed in rust
    rect(g,46,36,53,41,'K');rect(g,48,41,51,44,'K');
    setclip(g,46,36,'B');setclip(g,53,37,'B');setclip(g,49,44,'B');setclip(g,50,44,'B');
    setclip(g,47,34,'K');setclip(g,48,34,'K');
    function hole(x,y){rect(g,x,y,x+1,y+1,'K');setclip(g,x-1,y,'R');setclip(g,x-1,y+1,'R');setclip(g,x+2,y,'R');setclip(g,x+2,y+1,'R');}
    hole(40,14);hole(63,32);hole(21,22);hole(70,13);hole(55,15);
    rect(g,14,28,17,29,'R');rect(g,78,20,79,23,'R');
    cutCorners(g,2,0,81,46,3,'.');
    outlineFrom(g,'K');
    return toRows(g);
  }

  // =====================================================================
  // truckMil 120x52 [120x52], anchor feet, never rotated (world.js:194).
  // A five-ton with the canvas tilt still on: cab and bonnet at the left, six
  // wheels, hooped canvas whose crown catches the light and whose flanks fall
  // into shadow, one rib torn open, tailgate down at the right.
  // =====================================================================
  function makeTruck(){
    var w=120,h=52,g=mkGrid(w,h),i,x;
    rect(g,3,45,116,49,'K');
    // bonnet + cab
    rect(g,3,7,36,44,'M');
    rect(g,3,7,36,18,'L');
    rect(g,3,39,36,44,'D');
    for(i=0;i<3;i++)rect(g,7+i*4,12,7+i*4,38,'D');
    rect(g,3,10,5,41,'I');rect(g,3,10,3,41,'K');
    rect(g,17,9,17,42,'K');
    rect(g,19,11,25,40,'G');setclip(g,20,13,'g');setclip(g,21,13,'g');setclip(g,20,14,'g');
    rect(g,26,9,26,42,'K');
    rect(g,27,11,36,40,'M');rect(g,28,12,35,18,'L');
    setclip(g,30,36,'H');setclip(g,31,36,'H');
    // stencilled unit mark on the bonnet
    rect(g,8,22,14,23,'c');setclip(g,8,26,'c');setclip(g,9,26,'c');setclip(g,12,26,'c');setclip(g,13,26,'c');
    // the gap over the chassis between cab and bed
    rect(g,37,10,40,42,'K');
    // canvas tilt: the hooped crown catches the light and the flanks fall away
    // (rule 30). Weathered canvas, not fresh: the pale sandbag L shows only as a
    // narrow crown band, or a 120-texel tilt becomes the brightest thing in the
    // street at night.
    rect(g,41,5,114,47,'K');
    rect(g,41,7,114,45,'E');
    rect(g,41,12,114,38,'C');
    rect(g,41,20,114,27,'c');
    rect(g,41,28,114,33,'C');
    for(x=45;x<=110;x+=9)rect(g,x,6,x,46,'E');
    for(x=45;x<=110;x+=9)rect(g,x+1,20,x+1,27,'C');
    // lacing along the near flank, broken so it is not a dotted line
    for(x=46;x<=108;x+=9){setclip(g,x+2,42,'C');setclip(g,x+3,42,'C');}
    // a rib torn out: the hoop shows and the canvas hangs in
    rect(g,85,21,92,30,'K');rect(g,83,23,85,28,'K');rect(g,92,19,94,26,'K');
    rect(g,86,21,91,22,'I');rect(g,87,29,90,30,'E');
    rect(g,84,20,86,20,'E');rect(g,90,31,93,31,'E');
    setclip(g,82,22,'C');setclip(g,82,23,'C');setclip(g,94,27,'C');setclip(g,94,28,'C');
    // tailgate down at the rear, dark load bed behind it
    rect(g,115,9,119,42,'D');
    rect(g,112,12,115,39,'K');
    setclip(g,117,20,'J');setclip(g,117,21,'J');setclip(g,117,30,'J');setclip(g,117,31,'J');
    // wheels
    function wheel(x0,y0,y1){lump(g,x0,y0,x0+14,y1,2,'J','.');rect(g,x0+2,y0+3,x0+12,y0+4,'I');}
    wheel(7,0,8);wheel(7,43,51);
    wheel(74,0,8);wheel(74,43,51);
    wheel(92,0,8);wheel(92,43,51);
    rect(g,9,7,21,8,'K');rect(g,76,7,88,8,'K');rect(g,94,7,106,8,'K');
    rect(g,9,43,21,44,'K');rect(g,76,43,88,44,'K');rect(g,94,43,106,44,'K');
    rect(g,22,33,25,34,'R');rect(g,110,14,111,17,'R');
    cutCorners(g,3,0,116,51,3,'.');
    outlineFrom(g,'K');
    return toRows(g);
  }

  // =====================================================================
  // crateMil 24x24 [24x24], anchor feet, never rotated. Ammunition crate seen
  // from above: iron corner brackets, two latches, rope beckets at the ends, a
  // stencil bar, and the lid levered off one corner onto a dark interior.
  // =====================================================================
  function makeCrate(){
    var w=24,h=24,g=mkGrid(w,h);
    rect(g,1,1,22,22,'M');
    rect(g,2,2,21,8,'L');
    rect(g,2,18,21,21,'D');
    rect(g,1,1,22,1,'L');
    // lid rim
    rect(g,3,3,20,3,'D');rect(g,3,3,3,20,'D');rect(g,20,3,20,20,'D');rect(g,3,20,20,20,'D');
    // corner brackets and latches
    rect(g,1,1,5,2,'I');rect(g,1,1,2,5,'I');
    rect(g,18,1,22,2,'I');rect(g,21,1,22,5,'I');
    rect(g,1,21,5,22,'I');rect(g,1,18,2,22,'I');
    rect(g,18,21,22,22,'I');rect(g,21,18,22,22,'I');
    rect(g,10,1,13,3,'I');rect(g,10,20,13,22,'I');
    setclip(g,11,2,'J');setclip(g,12,2,'J');
    // rope beckets
    rect(g,0,9,1,14,'S');rect(g,22,9,23,14,'S');
    setclip(g,0,9,'K');setclip(g,0,14,'K');setclip(g,23,9,'K');setclip(g,23,14,'K');
    // stencil
    rect(g,6,11,15,12,'S');setclip(g,6,14,'S');setclip(g,7,14,'S');setclip(g,10,14,'S');setclip(g,11,14,'S');setclip(g,14,14,'S');setclip(g,15,14,'S');
    // lid levered off the far corner
    rect(g,14,1,22,7,'K');
    rect(g,13,1,14,8,'L');rect(g,14,8,22,8,'L');
    setclip(g,17,3,'J');setclip(g,18,3,'J');
    cutCorners(g,0,0,23,23,2,'.');
    outlineFrom(g,'K');
    return toRows(g);
  }

  // =====================================================================
  // tentMil 64x40 [64x40], anchor feet, rot 0 or 1. Command tent in plan: a
  // ridge running along +x with the far slope lit, a broken crest highlight,
  // the near slope falling to a dark eave. The right-hand pole is gone so the
  // ridge sags and the canvas pulls in; the entrance flap at the left end is
  // thrown back over the near slope. Guy lines are 2-texel staircases (a bare
  // 1px diagonal is all orphan texels, rule 11).
  // =====================================================================
  function makeTent(){
    var w=64,h=40,g=mkGrid(w,h),x,y;
    // the right-hand pole is gone: the ridge drops and the eaves pull in there
    function collapse(x){return x<44?0:Math.min(5,(x-44)>>1);}
    // the gable ends taper 1 texel every 2 columns; a 45 taper made every
    // end texel a 1-texel step, i.e. an orphan on both edges (rule 11)
    function halfW(x){
      var e=15;
      if(x<14)e=9+((x-2)>>1);
      else if(x>50)e=15-((x-50)>>1);
      if(e>15)e=15;
      return e-collapse(x);
    }
    // one ramp across the canvas rather than two flat halves: dark far eave,
    // up through mid to a light band either side of the crest, then down the
    // near slope to a dark near eave (rule 30 -- the ramp runs along the curve)
    for(x=2;x<=61;x++){
      var hw=halfW(x);if(hw<4)continue;
      var t=20-hw,b=20+hw,r=15+((collapse(x)*2/3)|0);
      rect(g,x,t,x,t+1,'D');
      rect(g,x,t+2,x,r-5,'M');
      rect(g,x,r-4,x,r+1,'L');
      rect(g,x,r+2,x,r+8,'M');
      rect(g,x,r+9,x,b-2,'D');
      rect(g,x,b-1,x,b,'K');
    }
    // crest: three dashes, not a seam running the whole ridge (rule 14)
    rect(g,13,14,20,14,'H');rect(g,27,14,33,14,'H');rect(g,40,14,44,14,'H');
    // creases pulling off the ridge, each one shade down from what it crosses
    var STEP={H:'L',L:'M',M:'D',D:'K'};
    function crease(x0,dir){var yy=16,xx=x0,i;for(i=0;i<6;i++){
      if(STEP[at(g,xx,yy)])setclip(g,xx,yy,STEP[at(g,xx,yy)]);
      if(STEP[at(g,xx,yy+1)])setclip(g,xx,yy+1,STEP[at(g,xx,yy+1)]);
      yy+=2;if(i%2)xx+=dir;}}
    crease(19,-1);crease(35,1);crease(52,1);
    // the entrance: the gable end unlaced, one door panel thrown back over the
    // near slope. Kept small and tucked into the taper so it reads as a doorway
    // and not as a hole punched in the canvas.
    rect(g,4,14,10,26,'K');
    rect(g,5,13,10,13,'D');
    rect(g,10,22,16,30,'M');rect(g,11,23,15,29,'L');rect(g,10,30,16,31,'D');
    setclip(g,9,21,'M');setclip(g,10,21,'M');
    // a slash torn in the near slope, and the slack canvas pooling at the
    // collapsed end
    rect(g,32,25,33,29,'K');rect(g,34,28,35,31,'K');
    rect(g,47,27,56,30,'D');rect(g,49,28,55,29,'M');
    // dried pool at the mouth
    disc(g,9,30,4,2,'B');setclip(g,13,32,'B');setclip(g,14,32,'B');
    erode(g,'B','K');
    // ground shadow band under the canvas
    rect(g,14,36,48,37,'K');
    cutCorners(g,2,4,61,34,3,'.');
    outlineFrom(g,'K');
    // guy lines and pegs go on after the outline pass, or they would all be K
    function guy(x0,y0,dx,dy,n){var i,xx=x0,yy=y0;for(i=0;i<n;i++){setclip(g,xx,yy,'M');setclip(g,xx,yy+1,'M');xx+=dx;yy+=dy*2;}setclip(g,xx,yy,'I');setclip(g,xx,yy+1,'I');}
    guy(3,12,-1,-1,3);guy(3,28,-1,1,3);guy(60,14,1,-1,2);guy(58,30,1,1,3);
    return toRows(g);
  }

  // =====================================================================
  // floodlight 40x90, anchor feet, prop. Mast head at the TOP, two lamp heads
  // on a crossbar, tripod feet at the bottom. world.js:83 passes no light.dy,
  // so render.js drops the corona 24 texels above the feet -- down by the legs,
  // nowhere near the heads. The lenses therefore carry their own emissive core
  // (rule 35: W core, Y ring, O outer, plus a Y rim on the crossbar under each
  // head) so the sprite reads as the source whatever the corona does.
  // =====================================================================
  function makeFlood(){
    var w=40,h=90,g=mkGrid(w,h),i,x;
    // tripod: two splayed legs and a back leg, 2-texel staircase steps
    function leg(x0,y0,dx,n){var i,xx=x0,yy=y0;for(i=0;i<n;i++){rect(g,xx,yy,xx+1,yy+1,'M');rect(g,xx,yy,xx,yy+1,'L');xx+=dx;yy+=2;}return xx;}
    var lx=leg(17,74,-2,7),rx=leg(21,74,2,7);
    rect(g,18,74,21,88,'M');rect(g,18,74,18,88,'L');
    rect(g,lx-2,87,lx+3,89,'D');rect(g,rx-2,87,rx+3,89,'D');rect(g,16,87,23,89,'D');
    // mast with a sleeve joint
    rect(g,18,20,21,75,'M');rect(g,18,20,18,75,'L');rect(g,21,20,21,75,'D');
    rect(g,16,49,23,54,'M');rect(g,16,49,23,49,'L');rect(g,16,54,23,54,'D');
    setclip(g,17,51,'H');setclip(g,17,52,'H');
    // crossbar
    rect(g,4,17,35,21,'M');rect(g,4,17,35,17,'L');rect(g,4,21,35,21,'D');
    rect(g,4,17,5,21,'D');rect(g,34,17,35,21,'D');
    // two lamp heads: shell, then the lens as a hot core inside two rings
    function head(x0,dead){
      var x1=x0+12;
      rect(g,x0,2,x1,16,'M');
      rect(g,x0,2,x1,3,'L');
      rect(g,x0,15,x1,16,'D');
      rect(g,x0,2,x0+1,16,'D');rect(g,x1-1,2,x1,16,'D');
      rect(g,x0+2,5,x1-2,14,'O');
      rect(g,x0+3,7,x1-3,13,'Y');
      if(dead){
        rect(g,x0+3,7,x1-3,13,'D');
        rect(g,x0+4,8,x0+5,12,'K');rect(g,x0+6,10,x1-4,11,'K');
        setclip(g,x0+3,7,'O');setclip(g,x1-3,13,'O');
      }else{
        rect(g,x0+5,9,x1-5,11,'W');
        rect(g,x0+4,17,x1-4,17,'Y');
        setclip(g,x0+6,18,'Y');setclip(g,x0+7,18,'Y');
      }
      rect(g,x0+5,0,x0+7,1,'M');
    }
    head(3,0);head(23,1);
    // cable from the crossbar down the mast and off the base
    for(i=0;i<9;i++){setclip(g,23+((i>3)?0:1),22+i*2,'D');setclip(g,23+((i>3)?0:1),23+i*2,'D');}
    rect(g,22,40,23,72,'D');
    rect(g,22,84,29,85,'D');rect(g,29,85,33,86,'D');
    cutCorners(g,2,0,37,89,2,'.');
    outlineFrom(g,'K');
    // the lit lens must survive the outline pass: repaint its core
    rect(g,6,9,13,11,'W');rect(g,5,7,14,8,'Y');rect(g,5,12,14,13,'Y');
    return toRows(g);
  }

  // =====================================================================
  // signQuarantine 28x36, anchor feet, prop (y-sorted, stands up). A stake
  // sign, not another placard: a hazard triangle reads as danger at a glance
  // at this size where lettering would not (rule 39), with a chevron band
  // along the foot of the board, one bullet hole and a leaning post.
  // =====================================================================
  function makeSign(){
    var w=28,h=36,g=mkGrid(w,h),x,y,r;
    // post, leaning a little, with a kicked foot plate
    rect(g,12,19,15,35,'M');rect(g,12,19,12,35,'L');rect(g,15,19,15,35,'D');
    rect(g,13,29,16,35,'M');rect(g,16,29,16,35,'D');
    rect(g,11,33,18,35,'D');
    // board: amber field in a dark frame. Black symbol on amber, not the other
    // way round -- at 26 texels wide that is the only version that reads.
    rect(g,1,1,26,20,'K');
    rect(g,2,2,25,19,'Y');
    // header band, broken into blocks so it suggests stencilled type
    rect(g,2,2,25,4,'K');
    rect(g,5,3,6,3,'Y');rect(g,10,3,11,3,'Y');rect(g,16,3,17,3,'Y');rect(g,21,3,22,3,'Y');
    // hazard triangle: solid K, then an amber core three texels inside it
    for(r=0;r<=11;r++)rect(g,13-r,5+r,14+r,5+r,'K');
    rect(g,2,16,25,16,'K');
    for(r=0;r<=7;r++)rect(g,13-r,8+r,14+r,8+r,'Y');
    rect(g,13,10,14,13,'K');rect(g,13,15,14,15,'K');
    // chevron band along the foot
    for(y=17;y<=19;y++)for(x=2;x<=25;x++)setclip(g,x,y,((x+y)%6)<3?'K':'Y');
    // weathering: the amber field is the loudest thing in the family, so it gets
    // scrubbed back with the ramp's darker orange in a few clusters rather than
    // sitting as 24x18 of flat high-sat paint (rules 13 and 21)
    rect(g,3,13,8,15,'O');rect(g,2,9,4,11,'O');rect(g,22,12,25,15,'O');
    rect(g,17,5,20,6,'O');rect(g,9,17,12,17,'O');rect(g,6,6,7,7,'O');
    rect(g,24,7,25,8,'O');rect(g,14,17,15,18,'O');
    // punched through, and a dented top corner
    rect(g,21,6,22,7,'K');setclip(g,20,6,'H');setclip(g,23,7,'H');
    rect(g,1,1,4,2,'.');setclip(g,5,1,'K');setclip(g,4,3,'K');
    cutCorners(g,1,1,26,20,2,'.');
    outlineFrom(g,'K');
    return toRows(g);
  }

  // =====================================================================
  // razorWire 48x16, anchor CENTER, flat:true, rot 0 or 1. A concertina coil
  // lying on the road. Every loop is a rounded ring whose staircase steps are
  // 2 texels or longer, so there is not a single orphan texel in it, and the
  // whole coil carries a 1-texel dark under-edge instead of an outline -- it is
  // drawn under everything at ground level and must not read as a bright line.
  // =====================================================================
  function makeWire(){
    var w=48,h=16,g=mkGrid(w,h),i,x,y;
    var LOOP=['...MMMMMM...',
              '.MM......MM.',
              'M..........M',
              'M..........M',
              'M..........M',
              'M..........M',
              'M..........M',
              'M..........M',
              'M..........M',
              '.MM......MM.',
              '...MMMMMM...'];
    var xs=[0,9,18,27,36];
    for(i=0;i<xs.length;i++)for(y=0;y<LOOP.length;y++)for(x=0;x<LOOP[y].length;x++)
      if(LOOP[y][x]==='M')setclip(g,xs[i]+x,3+y,'M');
    // blades: 2-texel stubs off the crown and the foot of each loop
    for(i=0;i<xs.length;i++){
      rect(g,xs[i]+4,1,xs[i]+4,2,'M');rect(g,xs[i]+7,1,xs[i]+7,2,'M');
      rect(g,xs[i]+5,14,xs[i]+5,15,'M');
    }
    // a glint on three crowns only (rule 14)
    rect(g,3,3,5,3,'L');rect(g,21,3,23,3,'L');rect(g,39,3,41,3,'L');
    underShadow(g,'ML','K');
    return toRows(g);
  }

  // =====================================================================
  // bodyBag 40x18, anchor CENTER, flat:true, rot 0 or 1. Zipped, tagged, lying
  // where it was dragged. Dark olive with one pale tag: the only light texels
  // in the decal set, and three of these lie at every barricade.
  // =====================================================================
  function makeBodyBag(){
    var w=40,h=18,g=mkGrid(w,h),x;
    // the bag: wider at the shoulders (left), tapering to the feet
    for(x=2;x<=37;x++){
      var hw=x<10?3+((x-2)>>1):x<20?7:x<30?6:6-((x-30)>>1);
      if(hw<2)continue;
      rect(g,x,9-hw,x,9+hw,'D');
      rect(g,x,9-hw,x,9-hw+1,'M');
      rect(g,x,9+hw-1,x,9+hw,'K');
    }
    // zip running the length, with a pull tab
    rect(g,4,8,34,8,'K');
    setclip(g,30,7,'M');setclip(g,31,7,'M');
    // strapping across the middle
    rect(g,14,3,15,15,'K');rect(g,25,4,26,14,'K');
    // the tag at the foot end
    rect(g,36,6,38,8,'T');setclip(g,35,7,'T');
    // seeping at the shoulder
    disc(g,7,13,4,2,'B');setclip(g,3,14,'B');setclip(g,4,14,'B');
    outlineFrom(g,'K');
    setclip(g,37,7,'T');
    return toRows(g);
  }

  // =====================================================================
  // bloodSplat 28x20, anchor CENTER, flat:true, 3 variants (world.js:90 passes
  // variant d%3 and this is the ONLY sprite here that is ever asked for a
  // variant). All three stay in blood K/D with at most a couple of M texels:
  // four of these per barricade plus whatever the fight adds, so a bright
  // decal would turn the road into a rash.
  //   [0] a pool with run-off   [1] a drag smear   [2] arterial spatter
  // =====================================================================
  function makeBlood(variant){
    var w=28,h=20,g=mkGrid(w,h),i;
    if(variant===0){
      // a pool: black where it went thick, dried maroon only where it ran thin
      disc(g,13,10,8,5,'K');
      disc(g,8,8,4,3,'K');disc(g,19,13,4,3,'K');
      var x=21,y=14;
      for(i=0;i<3;i++){rect(g,x,y,x+1,y,'D');x+=2;y+=1;}
      rect(g,4,6,5,7,'D');rect(g,24,8,25,9,'D');
      rect(g,6,12,9,13,'D');rect(g,17,5,20,5,'D');
      setclip(g,12,9,'M');setclip(g,13,9,'M');
    }else if(variant===1){
      // a body dragged: a thick head tapering into finger streaks
      disc(g,6,10,5,4,'K');
      for(i=0;i<3;i++){
        var yy=7+i*3,len=10+i*4;
        rect(g,9,yy,9+len,yy,'K');
        rect(g,9,yy+1,9+(len>>1),yy+1,'K');
        rect(g,7+len,yy,9+len,yy,'D');
      }
      rect(g,19,7,24,7,'D');rect(g,17,13,23,13,'K');rect(g,21,13,23,13,'D');
      setclip(g,5,9,'M');setclip(g,6,9,'M');
    }else{
      // cast off a blade: an arc of droplets away from a small pool
      disc(g,7,13,4,3,'K');
      var arc=[[11,9],[14,7],[17,6],[20,6],[23,7],[25,9]];
      for(i=0;i<arc.length;i++)rect(g,arc[i][0],arc[i][1],arc[i][0]+1,arc[i][1],i>2?'D':'K');
      rect(g,13,11,14,12,'K');rect(g,18,10,19,11,'K');rect(g,22,12,23,13,'D');
      setclip(g,16,3,'D');setclip(g,17,3,'D');setclip(g,25,15,'D');setclip(g,26,15,'D');
      setclip(g,6,12,'M');setclip(g,7,12,'M');
    }
    return toRows(g);
  }

  // ---- palettes: one MAT ramp per sprite where possible, small merges where a
  // second material genuinely shows (rule 23 keeps the base ramp's K as the
  // shared shadow). Glass for windscreens matches art/wrecks.js.
  var JERSEY_PAL=pal2(MAT.concrete,{R:MAT.rust.M,S:MAT.rust.D,Y:MAT.iron.Y});
  var SAND_PAL=pal2(MAT.sandbag,{B:MAT.blood.D,I:MAT.iron.M,J:MAT.iron.L});
  var HUMVEE_PAL=pal2(MAT.olive,{I:MAT.iron.M,J:MAT.iron.D,G:MAT.glass.D,g:MAT.glass.L,B:MAT.blood.D,R:MAT.rust.D});
  var TRUCK_PAL=pal2(MAT.olive,{C:MAT.sandbag.M,c:MAT.sandbag.L,E:MAT.sandbag.D,I:MAT.iron.M,J:MAT.iron.D,G:MAT.glass.D,g:MAT.glass.L,R:MAT.rust.D});
  var CRATE_PAL=pal2(MAT.olive,{I:MAT.iron.M,J:MAT.iron.L,S:MAT.sandbag.H});
  var TENT_PAL=pal2(MAT.olive,{B:MAT.blood.D,I:MAT.iron.M});
  var BODYBAG_PAL=pal2(MAT.olive,{T:MAT.sandbag.H,B:MAT.blood.D});

  A.define('barricade',{
    jersey:{rows:makeJersey(),pal:JERSEY_PAL,anchor:'feet',note:'48x24 [48x24] solid, rot 0/1: concrete barrier segment, lit crown, hazard tape, knocked-off corner with rusted rebar; cut corners are the seam between abutting segments'},
    sandbagNest:{rows:makeNest(),pal:SAND_PAL,anchor:'feet',note:'56x30 [56x30] solid, rot 0/1: a C of sandbags - one full course across the back, two courses of legs, a near-black mouth between them; the inner bag of the right leg is burst and spilling, ammo can, brass and a dried pool on the trampled floor'},
    sandbagWall:{rows:makeSandbagWall(),pal:SAND_PAL,anchor:'feet',note:'48x20 [48x20] solid, never rotated: two staggered courses with a bag hauled out of the top one'},
    humvee:{rows:makeHumvee(),pal:HUMVEE_PAL,anchor:'feet',note:'84x48 [84x48] solid, rot 0/1: plan view, front left, shattered windscreen, open empty turret ring, spare on the rear deck, flat near-rear tyre, blood down the door'},
    truckMil:{rows:makeTruck(),pal:TRUCK_PAL,anchor:'feet',note:'120x52 [120x52] solid, never rotated: five-ton with the canvas tilt on, six wheels, torn rib, tailgate down'},
    crateMil:{rows:makeCrate(),pal:CRATE_PAL,anchor:'feet',note:'24x24 [24x24] solid, never rotated: ammunition crate, iron brackets and latches, rope beckets, stencil, lid levered off one corner'},
    tentMil:{rows:makeTent(),pal:TENT_PAL,anchor:'feet',note:'64x40 [64x40] solid, rot 0/1: ridge tent in plan, sagging where the right pole is gone, entrance flap thrown back, slashed near slope, guy lines and pegs'},
    floodlight:{rows:makeFlood(),pal:'MAT.iron',anchor:'feet',light:{r:140,col:'#ffd249',a:'ff'},note:'40x90 prop: tripod mast, crossbar, two lamp heads at the TOP - one lit with a W/Y/O emissive lens, one dead and cracked. world.js:83 sets no light.dy so the corona lands 24 above the feet, by the legs; the lens is the sprite-side source'},
    signQuarantine:{rows:makeSign(),pal:'MAT.iron',anchor:'feet',note:'28x36 prop, y-sorted: stake sign, black hazard triangle on a weathered amber field (black-on-amber is the only way round that reads at 24 texels), chevron band, bullet hole, leaning post'},
    razorWire:{rows:makeWire(),pal:'MAT.iron',anchor:'center',note:'48x16 flat decal, rot 0/1: concertina coil, five rounded loops with blades, dark under-edge instead of an outline'},
    bodyBag:{rows:makeBodyBag(),pal:BODYBAG_PAL,anchor:'center',note:'40x18 flat decal, rot 0/1: zipped bag tapering to the feet, strapping, pale toe tag, seep at the shoulder'},
    bloodSplat:{variants:[makeBlood(0),makeBlood(1),makeBlood(2)],pal:'MAT.blood',anchor:'center',note:'28x20 flat decal, 3 variants (the only sprite here that is ever given one): [0] pool with run-off, [1] drag smear, [2] cast-off spatter. Near-black K bodies with blood D only where the pool ran thin - four of these lie on every barricade'}
  });
})();
