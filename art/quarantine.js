// Dead Signal quarantine-line hardware (den 1, one texel = one world unit): the sliding containment gates
// in the disposal-yard fence, the crash bollard that stands in an open gate's centre socket, and the
// Checkpoint Nine south evacuation barrier.
//
// One mechanism, read the same way everywhere:
//   * two box posts with a status lamp on the cap: amber = locked, cyan (#79e2cf, the map's "open gate"
//     colour) = open;
//   * a flush steel track across the opening on the ground, present in both states;
//   * leaves that roll on that track: closed they meet in the middle at a lock box; open they are
//     parked outside the posts, against the fence, and the opening between the posts is bare track.
//
// Ids and how the renderer places them (render.js drawStrip, game.js setGate):
//   gate_h 100x30 anchor x0 y1 / gate_v 16x100: the whole closed assembly for a 100-unit entrance, so
//     drawStrip's one tile shows post - leaf | leaf - post. Narrower/wider rects still tile.
//   bollard_h / bollard_v 20x20: the crash bollard in its socket plate; drawn by drawStrip over the
//     20-unit centre obstacle of an open gate, with its base on the gate's track line.
//   gateOpen_h 184x30 anchor x.5 y1 / gateOpen_v 16x184 anchor centre: NEW. The open assembly (posts,
//     empty track, parked leaves, cyan lamps) -- drawn once per open arena gate over its full rect,
//     which drawStrip cannot do from the 20-unit bollard obstacle (see notes in the delivery report).
//   evacBarrier 180x40 feet, frames down[0 closed, 1 open]: a folding (bi-fold) steel palisade gate with
//     razor wire, heavy concrete-footed posts and the same lamp/track language; open, the panels are
//     folded into stacks against both posts.
(function(){
  'use strict';
  var A=(typeof window!=='undefined'?window:globalThis).DSArt;
  var MAT=A.MAT,I=MAT.iron,CO=MAT.concrete;
  // iron ramp + amber lamp/hazard + cyan open lamp + concrete footings
  var GATE_PAL={K:I.K,D:I.D,M:I.M,L:I.L,H:I.H,Y:I.Y,C:'#79e2cf',E:CO.D,S:CO.M,T:CO.L};

  // ---- grid helpers ----
  function mkGrid(w,h){var g=[],y,x,row;for(y=0;y<h;y++){row=[];for(x=0;x<w;x++)row.push('.');g.push(row);}return g;}
  function set(g,x,y,ch){if(y>=0&&y<g.length&&x>=0&&x<g[0].length)g[y][x]=ch;}
  function rect(g,x0,y0,x1,y1,ch){var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)set(g,x,y,ch);}
  function toRows(g){return g.map(function(r){return r.join('');});}
  function box(g,x0,y0,x1,y1){rect(g,x0,y0,x1,y1,'K');}
  // lit-from-top-left steel box: K rim, L top/left, D bottom/right, M body
  function bevel(g,x0,y0,x1,y1){
    rect(g,x0,y0,x1,y1,'M');
    rect(g,x0,y0,x1,y0,'K');rect(g,x0,y1,x1,y1,'K');rect(g,x0,y0,x0,y1,'K');rect(g,x1,y0,x1,y1,'K');
    if(x1-x0>=2&&y1-y0>=2){rect(g,x0+1,y0+1,x1-1,y0+1,'L');rect(g,x0+1,y0+1,x0+1,y1-1,'L');rect(g,x1-1,y0+2,x1-1,y1-1,'D');rect(g,x0+2,y1-1,x1-1,y1-1,'D');}
  }
  function line(g,x0,y0,x1,y1,ch){
    var dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,e=dx+dy;
    for(;;){set(g,x0,y0,ch);if(x0===x1&&y0===y1)break;var e2=2*e;if(e2>=dy){e+=dy;x0+=sx;}if(e2<=dx){e+=dx;y0+=sy;}}
  }
  function pmod(n,p){return((n%p)+p)%p;}
  function hazard(g,x0,y0,x1,y1,period){
    var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)set(g,x,y,pmod(x+y,period)<period/2?'Y':'K');
  }

  // =====================================================================
  // Horizontal pieces (rows share one baseline: track rows 26..28, row 29 is ground shadow)
  // =====================================================================
  // the flush ground track between x0..x1
  function trackH(g,x0,x1){rect(g,x0,26,x1,26,'K');rect(g,x0,27,x1,27,'L');rect(g,x0,28,x1,28,'K');for(var x=x0+3;x<=x1;x+=10)set(g,x,27,'H');rect(g,x0,29,x1,29,'D');}
  // a box post occupying x0..x0+5, lamp on the cap
  function postH(g,x0,lamp){
    bevel(g,x0,3,x0+5,29);
    rect(g,x0+1,26,x0+4,28,'D');rect(g,x0,29,x0+5,29,'K');              // foot plate in shadow
    box(g,x0+1,0,x0+4,3);rect(g,x0+2,1,x0+3,2,lamp);
    set(g,x0+1,9,'H');set(g,x0+1,20,'H');                                 // bolt heads
  }
  // one sliding leaf spanning x0..x1 (width 44): frame, mesh with bars, a diagonal truss brace,
  // mid rail, hazard kick plate, two rollers on the track. `latch` is the side that meets the other leaf.
  function leafH(g,x0,x1,latch,rng){
    bevel(g,x0,6,x1,25);
    rect(g,x0+1,7,x1-1,7,'H');rect(g,x0+1,8,x1-1,8,'L');                 // lit top rail
    rect(g,x0+2,9,x1-2,17,'D');                                           // mesh infill
    for(var x=x0+3;x<x1-1;x+=4)rect(g,x,9,x,17,'M');                       // palisade bars
    if(latch==='r')line(g,x0+2,17,x1-2,9,'L');else line(g,x0+2,9,x1-2,17,'L'); // truss brace rising to the latch side
    rect(g,x0+1,18,x1-1,18,'L');rect(g,x0+1,19,x1-1,19,'K');              // mid rail
    hazard(g,x0+1,20,x1-1,23,8);                                          // kick plate
    rect(g,x0+1,24,x1-1,24,'D');rect(g,x0,25,x1,25,'K');
    [x0+5,x1-6].forEach(function(rx){box(g,rx,24,rx+2,26);set(g,rx+1,25,'L');}); // rollers on the track
    if(rng)for(var i=0;i<3;i++){var fx=x0+4+Math.floor(rng()*(x1-x0-8)),fy=10+Math.floor(rng()*7);if(g[fy][fx]==='D')set(g,fx,fy,'K');}
  }
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

  // gate_h 100x30: post | leaf -> <- leaf | post, locked at the centre
  function makeGateH(variant){
    var g=mkGrid(100,30),rng=mulberry32(variant?412:411);
    trackH(g,0,99);
    leafH(g,6,49,'r',rng);leafH(g,50,93,'l',rng);
    // centre lock box straddling the leaf joint
    rect(g,49,6,50,25,'K');bevel(g,45,11,54,17);set(g,49,14,'Y');set(g,50,14,'Y');set(g,49,15,'K');set(g,50,15,'K');
    postH(g,0,'Y');postH(g,94,'Y');
    return toRows(g);
  }
  // gateOpen_h 184x30: the same posts at x42 and x136 (the 100-unit opening is x42..141), bare track
  // with the centre bollard socket, the two leaves parked outside the posts over the fence line.
  function makeGateOpenH(){
    var g=mkGrid(184,30),O=42;
    trackH(g,0,183);
    // centre socket plate where the leaves used to meet (the bollard is drawn over it)
    box(g,O+44,25,O+55,29);rect(g,O+45,26,O+54,28,'D');set(g,O+45,26,'L');set(g,O+54,26,'L');
    // floor chevrons either side of the socket: this is the walkable passage
    [O+20,O+76].forEach(function(cx){set(g,cx,27,'Y');set(g,cx+1,27,'Y');set(g,cx-1,28,'Y');set(g,cx+2,28,'Y');});
    leafH(g,0,43,'l',null);leafH(g,140,183,'r',null);
    postH(g,O,'C');postH(g,O+94,'C');
    return toRows(g);
  }

  // =====================================================================
  // Vertical pieces (seen from above: track runs down the centre, posts are square caps)
  // =====================================================================
  function trackV(g,y0,y1){rect(g,6,y0,6,y1,'K');rect(g,7,y0,8,y1,'L');rect(g,9,y0,9,y1,'K');for(var y=y0+3;y<=y1;y+=10){set(g,7,y,'H');}}
  function postV(g,y0,lamp){
    bevel(g,1,y0,14,y0+9);
    box(g,5,y0+3,10,y0+6);set(g,6,y0+4,lamp);set(g,7,y0+4,lamp);set(g,8,y0+4,lamp);set(g,9,y0+4,lamp);set(g,7,y0+5,lamp);set(g,8,y0+5,lamp);
    set(g,2,y0+2,'H');set(g,12,y0+7,'D');
  }
  // a leaf seen from above: a thick top rail with hazard ticks, rollers either side of the track
  function leafV(g,y0,y1){
    bevel(g,3,y0,12,y1);
    rect(g,5,y0+2,10,y1-2,'D');rect(g,5,y0+2,5,y1-2,'L');
    for(var y=y0+3;y<y1-2;y+=4){rect(g,6,y,10,y,'M');}
    for(var y2=y0+2;y2<=y1-2;y2++)if(pmod(y2,8)<3){set(g,9,y2,'Y');set(g,10,y2,'Y');}
    [y0+3,y1-5].forEach(function(ry){box(g,1,ry,2,ry+2);box(g,13,ry,14,ry+2);set(g,1,ry+1,'L');});
  }
  function makeGateV(variant){
    var g=mkGrid(16,100);
    trackV(g,0,99);
    leafV(g,10,49);leafV(g,50,89);
    rect(g,3,49,12,50,'K');bevel(g,2,45,13,54);set(g,7,49,'Y');set(g,8,49,'Y');set(g,7,50,'Y');set(g,8,50,'Y');
    if(variant)set(g,4,47,'H');
    postV(g,0,'Y');postV(g,90,'Y');
    return toRows(g);
  }
  function makeGateOpenV(){
    var g=mkGrid(16,184),O=42;
    trackV(g,0,183);
    box(g,4,O+52,11,O+59);rect(g,5,O+53,10,O+58,'D');set(g,5,O+53,'L');
    [O+20,O+76].forEach(function(cy){set(g,4,cy,'Y');set(g,11,cy,'Y');set(g,3,cy+1,'Y');set(g,12,cy+1,'Y');});
    leafV(g,2,41);leafV(g,142,181);
    postV(g,O,'C');postV(g,O+90,'C');
    return toRows(g);
  }

  // =====================================================================
  // bollard 20x20: a squat crash bollard (steel cylinder, domed cap, two amber reflective bands)
  // bolted into a socket plate. Base rows 15..18 sit on the gate track line; row 19 is shadow.
  // =====================================================================
  function makeBollard(variant){
    var g=mkGrid(20,20),y;
    // socket plate
    rect(g,2,14,17,18,'K');rect(g,3,15,16,17,'D');set(g,3,15,'L');set(g,16,15,'L');set(g,3,17,'M');set(g,16,17,'M');rect(g,3,19,16,19,'D');
    // cylinder body
    for(y=3;y<=16;y++){set(g,5,y,'K');set(g,6,y,'L');set(g,7,y,'L');rect(g,8,y,11,y,'M');set(g,12,y,'D');set(g,13,y,'D');set(g,14,y,'K');}
    rect(g,5,17,14,17,'K');
    // domed cap
    rect(g,7,0,12,0,'K');rect(g,6,1,13,1,'K');rect(g,7,1,10,1,'H');set(g,11,1,'L');set(g,12,1,'M');
    rect(g,5,2,14,2,'K');rect(g,6,2,8,2,'H');rect(g,9,2,11,2,'L');set(g,12,2,'M');set(g,13,2,'D');
    rect(g,6,3,13,3,'K');
    // reflective bands
    [6,11].forEach(function(by){rect(g,6,by,11,by+1,'Y');set(g,12,by,'K');set(g,13,by,'K');set(g,12,by+1,'D');set(g,13,by+1,'D');});
    if(variant)set(g,9,14,'D');
    return toRows(g);
  }

  // =====================================================================
  // evacBarrier 180x40, feet anchor: the south Checkpoint Nine evacuation gate across the 170-unit
  // avenue. Heavy posts on concrete footings with lamp heads, a bi-fold steel palisade gate topped with
  // razor wire, a track across the road. Frame 0 closed: four panels span the avenue, locked in the
  // middle. Frame 1 open: the panels are folded into two stacks against the posts, lamps cyan.
  // =====================================================================
  function evacPost(g,x0,lamp){
    rect(g,x0-1,33,x0+12,39,'K');rect(g,x0,34,x0+11,38,'S');rect(g,x0,34,x0+11,34,'T');rect(g,x0,38,x0+11,38,'E'); // footing
    bevel(g,x0+1,7,x0+10,34);
    set(g,x0+3,14,'H');set(g,x0+3,26,'H');rect(g,x0+2,20,x0+9,20,'K');
    // lamp head
    box(g,x0+2,0,x0+9,6);rect(g,x0+3,1,x0+8,4,lamp);rect(g,x0+3,5,x0+8,5,'D');
    set(g,x0+4,2,'H');
  }
  function evacTrack(g){rect(g,12,35,167,35,'K');rect(g,12,36,167,36,'L');rect(g,12,37,167,37,'K');rect(g,12,38,167,38,'D');for(var x=16;x<168;x+=12)set(g,x,36,'H');}
  // one flat panel x0..x1 (rows 10..35), razor wire above
  function evacPanel(g,x0,x1){
    bevel(g,x0,10,x1,34);
    rect(g,x0+1,11,x1-1,11,'H');
    rect(g,x0+2,13,x1-2,24,'D');
    for(var x=x0+3;x<x1-1;x+=3)rect(g,x,13,x,24,'M');
    rect(g,x0+1,25,x1-1,25,'L');rect(g,x0+1,26,x1-1,26,'K');
    hazard(g,x0+1,27,x1-1,32,10);
    rect(g,x0,34,x1,34,'K');box(g,x0+3,33,x0+5,35);box(g,x1-5,33,x1-3,35);
    // razor-wire coil along the top rail
    for(var cx=x0+1;cx<x1;cx+=5){set(g,cx,9,'L');set(g,cx+1,8,'H');set(g,cx+2,7,'L');set(g,cx+3,8,'D');set(g,cx+4,9,'D');}
  }
  // the four panels folded concertina-style into a stack 20 wide starting at x0: alternating lit and
  // shadowed faces with a zig-zag top, the hazard kick plate broken into the same folds, wire on top.
  // dir 1 folds against a post on the left, -1 against a post on the right (mirrors the light faces).
  function evacStack(g,x0,dir){
    var i,x,y,xx,lit,top;
    for(i=0;i<4;i++){
      x=x0+i*6;lit=(i%2===0)===(dir>0);top=lit?10:12;
      rect(g,x,top,x+5,35,'K');
      rect(g,x+1,top+1,x+4,25,lit?'L':'M');
      for(y=top+3;y<25;y+=3)rect(g,x+2,y,x+3,y,lit?'M':'D');
      rect(g,x+1,top+1,x+4,top+1,lit?'H':'L');
      rect(g,x+1,26,x+4,26,'K');
      for(y=27;y<=32;y++)for(xx=x+1;xx<=x+4;xx++)set(g,xx,y,pmod(xx+(lit?y:-y),6)<3?'Y':'K');
      rect(g,x+1,33,x+4,34,lit?'M':'D');
    }
    for(i=0;i<24;i+=4){set(g,x0+i,9,'L');set(g,x0+i+1,8,'H');set(g,x0+i+2,7,'L');set(g,x0+i+3,8,'D');}
  }
  function makeEvacBarrier(open){
    var g=mkGrid(180,40);
    evacTrack(g);
    if(open){
      evacStack(g,12,1);evacStack(g,144,-1);
      // the centre lock socket left on the cleared track
      box(g,86,34,93,38);rect(g,87,35,92,37,'D');set(g,87,35,'L');
    }else{
      evacPanel(g,12,50);evacPanel(g,51,89);evacPanel(g,90,128);evacPanel(g,129,167);
      [50,128].forEach(function(hx){rect(g,hx,10,hx+1,34,'K');set(g,hx,14,'L');set(g,hx,30,'L');}); // fold hinges
      rect(g,89,6,90,35,'K');bevel(g,84,14,95,23);rect(g,88,17,91,19,'Y');rect(g,88,19,91,19,'K');  // centre lock
    }
    evacPost(g,0,open?'C':'Y');evacPost(g,168,open?'C':'Y');
    return toRows(g);
  }

  A.define('quarantine',{
    gate_h:{variants:[makeGateH(0),makeGateH(1)],pal:GATE_PAL,anchor:{x:0,y:1},note:'100x30 closed sliding containment gate: box posts with amber lamps at both ends, two braced palisade leaves on rollers meeting at a centre lock box, flush track; one tile spans a 100-unit entrance'},
    gate_v:{variants:[makeGateV(0),makeGateV(1)],pal:GATE_PAL,anchor:{x:.5,y:0},note:'16x100 closed sliding containment gate seen from above: square post caps with amber lamps, leaves on a centre track, lock box'},
    gateOpen_h:{rows:makeGateOpenH(),pal:GATE_PAL,anchor:{x:.5,y:1},note:'184x30 open gate assembly for a 100-unit entrance (x42..141): cyan-lamp posts, bare track with the bollard socket and walk chevrons, leaves parked outside the posts; draw at (rect centre x, rect bottom)'},
    gateOpen_v:{rows:makeGateOpenV(),pal:GATE_PAL,anchor:'center',note:'16x184 open vertical gate assembly (opening rows 42..141): cyan-lamp posts, bare track, leaves parked beyond the posts; draw at the rect centre'},
    bollard_h:{variants:[makeBollard(0),makeBollard(1)],pal:GATE_PAL,anchor:{x:0,y:1},note:'20x20 crash bollard with amber reflective bands in a socket plate; fills the open gate centre obstacle'},
    bollard_v:{variants:[makeBollard(0),makeBollard(1)],pal:GATE_PAL,anchor:{x:.5,y:0},note:'20x20 crash bollard (same drawing as bollard_h) for vertical gates'},
    evacBarrier:{frames:{down:[makeEvacBarrier(false),makeEvacBarrier(true)]},pal:GATE_PAL,anchor:'feet',note:'180x40 Checkpoint Nine evacuation gate: concrete-footed posts with lamp heads (amber locked / cyan open), bi-fold razor-wired palisade on a road track; frame 0 closed across the avenue, 1 folded into stacks at both posts'}
  });
})();
