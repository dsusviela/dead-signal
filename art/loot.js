// Dead Signal loot: pickups dropped in the street. One texel = one world
// unit (den 1). Ground is near-black, so every pickup gets a double outline
// (rule 37): a dark K ring on the outside, a bright accent ring just inside
// it, then the body fill and a saturated icon core. Gameplay colours stay
// reserved to their meaning: green (#9fd39f/#63c74d) heals, gold (#ffd249)
// is ammo/weapons, orange (#ff8b3d) is fuel, cyan (#79e2cf) is signal.
(function(){
  'use strict';
  var A=(typeof window!=='undefined'?window:globalThis).DSArt;
  var MAT=A.MAT, shade=A.shade;

  // ---- grid helpers (tools/art/pix.mjs style: build on a grid, emit rows) ----
  function mkGrid(w,h){var g=[],y,x,row;for(y=0;y<h;y++){row=[];for(x=0;x<w;x++)row.push('.');g.push(row);}return g;}
  function setclip(g,x,y,ch){if(y>=0&&y<g.length&&x>=0&&x<g[0].length)g[y][x]=ch;}
  function rect(g,x0,y0,x1,y1,ch){var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)setclip(g,x,y,ch);}
  function toRows(g){return g.map(function(r){return r.join('');});}

  // double outline box: K perimeter, RING one texel in, fill split light
  // (top-left, toward the one light source) vs shadow (bottom-right).
  function boxDouble(g,x0,y0,x1,y1,K,RING,LIT,SHADE){
    var x,y,half=((x1-x0)+(y1-y0))/2;
    for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++){
      if(x===x0||x===x1||y===y0||y===y1)setclip(g,x,y,K);
      else if(x===x0+1||x===x1-1||y===y0+1||y===y1-1)setclip(g,x,y,RING);
      else setclip(g,x,y,((x-x0)+(y-y0)<half)?LIT:SHADE);
    }
  }
  // chamfer the four corner texels of a box (drop to '.') for a softer case
  function chamfer(g,x0,y0,x1,y1){[[x0,y0],[x1,y0],[x0,y1],[x1,y1]].forEach(function(p){setclip(g,p[0],p[1],'.');});}

  // =====================================================================
  // medkit 20x18: white case, green cross, red latch
  // =====================================================================
  function makeMedkit(){
    var g=mkGrid(20,18);
    var K='K',W='W',L='L',D='D',GR='G',GE='A',R='E',RD='B';
    boxDouble(g,2,3,17,16,K,W,L,D);
    chamfer(g,2,3,17,16);
    rect(g,8,5,11,14,GR);
    rect(g,4,8,15,11,GR);
    rect(g,11,5,11,14,GE);
    rect(g,4,11,15,11,GE);
    setclip(g,8,6,'F');
    rect(g,9,1,10,2,R);
    setclip(g,9,2,RD);setclip(g,10,2,RD);
    return toRows(g);
  }

  // =====================================================================
  // ammoBullets 20x16: olive/gold box with a bullet icon
  // =====================================================================
  function makeAmmoBullets(){
    var g=mkGrid(20,16);
    var K='K',Y='Y',OM='Z',OD='J',Y2='X',W='W';
    boxDouble(g,2,2,17,13,K,Y,OM,OD);
    chamfer(g,2,2,17,13);
    rect(g,5,6,12,9,Y2);
    rect(g,5,6,12,6,Y);
    rect(g,13,6,13,9,Y2);
    rect(g,14,7,14,8,Y2);
    setclip(g,6,7,W);
    return toRows(g);
  }

  // =====================================================================
  // ammoShells 20x16: red shell box with two shells poking out
  // =====================================================================
  function makeAmmoShells(){
    var g=mkGrid(20,16);
    var K='K',W='W',RM='E',RD='B',R='E',R2='I',Y='Y';
    boxDouble(g,2,5,17,14,K,W,RM,RD);
    chamfer(g,2,5,17,14);
    rect(g,6,1,8,7,R);
    rect(g,6,5,8,6,R2);
    rect(g,6,4,8,4,Y);
    setclip(g,6,1,K);setclip(g,8,1,K);
    rect(g,11,2,13,7,R);
    rect(g,11,5,13,6,R2);
    rect(g,11,4,13,4,Y);
    setclip(g,11,2,K);setclip(g,13,2,K);
    return toRows(g);
  }

  // =====================================================================
  // fuelCan 18x22: orange jerry can, cap, a dark handle
  // =====================================================================
  function makeFuelCan(){
    var g=mkGrid(18,22);
    var K='K',W='W',O='O',O2='o',D='d',M='m';
    rect(g,6,1,11,2,D);
    rect(g,7,0,10,0,D);
    setclip(g,6,1,K);setclip(g,11,1,K);setclip(g,7,0,K);setclip(g,10,0,K);
    rect(g,7,3,10,3,M);
    setclip(g,7,3,K);setclip(g,10,3,K);
    boxDouble(g,2,5,15,20,K,W,O,O2);
    chamfer(g,2,5,15,20);
    rect(g,4,12,13,12,O2);
    setclip(g,8,7,'H');
    return toRows(g);
  }

  // =====================================================================
  // weaponCrate 28x18: gold-latched dark case, slightly open, a glint
  // =====================================================================
  function makeWeaponCrate(){
    var g=mkGrid(28,18);
    var K='K',L='L',M='M',D='D',Y='Y',Y2='X',W='W';
    boxDouble(g,1,4,26,16,K,L,M,D);
    chamfer(g,1,4,26,16);
    rect(g,3,6,24,6,K);
    rect(g,3,7,24,7,'J');
    rect(g,6,10,7,12,Y);
    setclip(g,6,10,K);setclip(g,7,10,K);setclip(g,6,12,K);setclip(g,7,12,K);
    rect(g,19,10,20,12,Y);
    setclip(g,19,10,K);setclip(g,20,10,K);setclip(g,19,12,K);setclip(g,20,12,K);
    setclip(g,13,7,W);setclip(g,14,7,W);setclip(g,13,8,Y2);setclip(g,14,8,Y2);
    return toRows(g);
  }

  // =====================================================================
  // pallet 32x26: abandoned quarantine supply pallet — wooden pallet deck,
  // strapped olive crates with a stencilled cross/label. No parachute: this
  // sat here since before the quarantine, it wasn't dropped in (rule: no
  // rescue canon).
  // =====================================================================
  function makePallet(){
    var g=mkGrid(32,26);
    var WK='S',WD='T',WM='U',WL='V';
    var R='E',R2='I',Y='Y',W='P';
    // wood pallet deck: three slats on two runners, visible either side of the crates
    rect(g,1,20,30,22,WM);rect(g,1,20,30,20,WL);rect(g,1,22,30,22,WD);
    setclip(g,1,20,WK);setclip(g,30,20,WK);setclip(g,1,22,WK);setclip(g,30,22,WK);
    rect(g,3,23,6,25,WD);rect(g,25,23,28,25,WD); // runner feet
    // olive crate stack on the deck
    boxDouble(g,4,4,27,19,WK,WL,WM,WD);
    chamfer(g,4,4,27,19);
    rect(g,4,10,27,11,R);
    setclip(g,4,10,R2);setclip(g,27,10,R2);setclip(g,4,11,R2);setclip(g,27,11,R2);
    rect(g,14,4,17,19,R);
    setclip(g,14,4,R2);setclip(g,17,4,R2);setclip(g,14,19,R2);setclip(g,17,19,R2);
    // stencilled cross/label on the crate face
    setclip(g,9,13,W);setclip(g,10,13,W);setclip(g,9,14,W);setclip(g,10,14,W);
    setclip(g,20,13,Y);setclip(g,21,13,Y);setclip(g,20,14,Y);setclip(g,21,14,Y);
    return toRows(g);
  }

  // =====================================================================
  // xpShard 10x10: cyan signal shard, three tiny rotation frames (rule 57)
  // =====================================================================
  function makeShardFrame(phase){
    var g=mkGrid(10,10);
    var K='K',W='W',C='C',C2='c';
    var body=[[4,0],[5,0],[3,1],[6,1],[2,2],[7,2],[2,3],[7,3],[2,4],[7,4],
      [3,5],[6,5],[3,6],[6,6],[4,7],[5,7],[4,8],[5,8]];
    var fill=[[3,2],[4,2],[5,2],[6,2],[3,3],[4,3],[5,3],[6,3],[3,4],[4,4],[5,4],[6,4],
      [4,5],[5,5],[4,6],[5,6]];
    body.forEach(function(p){setclip(g,p[0],p[1],K);});
    fill.forEach(function(p){setclip(g,p[0],p[1],C);});
    setclip(g,4,3,C2);setclip(g,5,4,C2);
    // facet highlight rotates one texel per phase
    var hi=[[4,1],[5,2]];
    if(phase===1)hi=[[5,1],[6,3]];
    if(phase===2)hi=[[4,2],[5,6]];
    hi.forEach(function(p){setclip(g,p[0],p[1],W);});
    return toRows(g);
  }

  // =====================================================================
  // provision 20x18: ration case, same case ramp as medkit (K/D/M/L) but a
  // sage-green label (F — unused elsewhere in this family, distinct from the
  // medkit cross's G/A greens) instead of a cross, twist-tie tab, two tin
  // lids peeking above the label.
  // =====================================================================
  function makeProvision(){
    var g=mkGrid(20,18);
    var K='K',D='D',M='M',L='L',F2='F';
    rect(g,9,0,10,2,D);
    setclip(g,9,0,K);setclip(g,10,0,K);
    boxDouble(g,2,3,17,16,K,L,M,D);
    chamfer(g,2,3,17,16);
    rect(g,5,5,7,6,L);setclip(g,5,5,K);setclip(g,7,5,K);
    rect(g,12,5,14,6,L);setclip(g,12,5,K);setclip(g,14,5,K);
    rect(g,4,9,15,11,F2);
    setclip(g,4,9,K);setclip(g,15,9,K);setclip(g,4,11,K);setclip(g,15,11,K);
    setclip(g,6,10,K);setclip(g,8,10,K);setclip(g,10,10,K);setclip(g,12,10,K);
    return toRows(g);
  }

  // =====================================================================
  // jerrycan 20x18: squared vehicle-fuel can, yellow-ochre (matches the
  // in-game vehicleFuel glow #ffd249 = MAT.loot Y) — clearly different from
  // the rounded, orange incendiary fuelCan: an offset twist cap (not a
  // centred funnel), a hollow carrying-handle loop, one embossed rib instead
  // of a sight-glass stripe.
  // =====================================================================
  function makeJerrycan(){
    var g=mkGrid(20,18);
    var K='K',Y='Y',X2='X',Z2='Z',W='W';
    rect(g,4,1,7,4,Z2);
    setclip(g,4,1,K);setclip(g,7,1,K);setclip(g,4,3,K);setclip(g,7,3,K);
    rect(g,11,0,16,4,K);
    rect(g,12,1,15,3,'.');
    boxDouble(g,2,5,17,16,K,W,Y,X2);
    chamfer(g,2,5,17,16);
    rect(g,5,11,14,11,Z2);
    setclip(g,5,7,W);
    return toRows(g);
  }

  // =====================================================================
  // evidence 20x18: bundle of patient records/forms — a folder-brown case
  // (the pallet crate's wood-tan ramp S/T/U/V, reused so no new ramp is
  // needed), a cover flap, page edges peeking from both sides, a red
  // CONFIDENTIAL stamp.
  // =====================================================================
  function makeEvidence(){
    var g=mkGrid(20,18);
    var K='K',T2='T',U2='U',V2='V',W='W',E2='E';
    rect(g,7,1,12,3,T2);
    setclip(g,7,1,K);setclip(g,12,1,K);setclip(g,7,3,K);setclip(g,12,3,K);
    boxDouble(g,2,4,17,16,K,V2,U2,T2);
    chamfer(g,2,4,17,16);
    rect(g,4,6,5,13,W);
    rect(g,14,6,15,13,W);
    setclip(g,4,7,K);setclip(g,5,9,K);setclip(g,14,10,K);setclip(g,15,12,K);
    rect(g,8,9,11,11,E2);
    setclip(g,8,9,K);setclip(g,11,9,K);setclip(g,8,11,K);setclip(g,11,11,K);
    return toRows(g);
  }

  // =====================================================================
  // payload 20x18: hard data case — a grey shell (the loot ramp's grey
  // P/Q/R), rivets, a cyan label strip (the reserved signal colour, an exact
  // fit for "hard data").
  // =====================================================================
  function makePayload(){
    var g=mkGrid(20,18);
    var K='K',P2='P',Q2='Q',R2='R',C2='C',W='W';
    rect(g,8,1,11,3,K);
    rect(g,9,2,10,2,'.');
    boxDouble(g,2,4,17,16,K,W,P2,Q2);
    chamfer(g,2,4,17,16);
    setclip(g,4,6,R2);setclip(g,15,6,R2);setclip(g,4,14,R2);setclip(g,15,14,R2);
    rect(g,4,9,15,11,C2);
    setclip(g,4,9,K);setclip(g,15,9,K);setclip(g,4,11,K);setclip(g,15,11,K);
    setclip(g,6,10,W);
    return toRows(g);
  }

  // =====================================================================
  // override 20x18: keycard/key module on a lanyard — a small dedicated
  // violet ramp (tools/art/ramp.mjs --hue 300 --chroma 0.09 --l 0.17,0.72;
  // no reserved hue fit "access override"), a grey contact chip, a status
  // dot.
  // =====================================================================
  var OVERRIDE_PAL=Object.assign({},MAT.loot,{v:'#5c477e',u:'#8a6e9d',t:'#2f2754'});
  function makeOverride(){
    var g=mkGrid(20,18);
    var K='K',v='v',t='t',P2='P',W='W';
    rect(g,6,1,7,3,t);rect(g,12,1,13,3,t);
    boxDouble(g,2,4,17,16,K,'u',v,t);
    chamfer(g,2,4,17,16);
    rect(g,7,10,12,13,P2);
    setclip(g,7,10,K);setclip(g,12,10,K);setclip(g,7,13,K);setclip(g,12,13,K);
    setclip(g,8,11,K);setclip(g,10,11,K);setclip(g,8,12,K);setclip(g,10,12,K);
    setclip(g,5,7,W);
    return toRows(g);
  }

  // =====================================================================
  // ammoGrenades 20x16: olive ammo can, lid open, two grenade rounds with brass bands
  function makeAmmoGrenades(){
    var g=mkGrid(20,16),x;
    boxDouble(g,1,6,18,15,'K','M','L','D');chamfer(g,1,6,18,15);
    [[5,1],[11,2]].forEach(function(p){var x0=p[0],y0=p[1];rect(g,x0,y0+1,x0+3,y0+7,'M');rect(g,x0+1,y0,x0+2,y0,'L');rect(g,x0,y0+4,x0+3,y0+4,'Y');setclip(g,x0+1,y0+1,'W');
      setclip(g,x0-1,y0+2,'K');setclip(g,x0+4,y0+2,'K');setclip(g,x0,y0,'K');setclip(g,x0+3,y0,'K');});
    rect(g,15,5,18,5,'D');                         // lid edge standing open
    return toRows(g);
  }
  A.define('loot',{
    medkit:{rows:makeMedkit(),pal:'MAT.loot',anchor:'feet',note:'20x18, white case double outline, green cross, red latch'},
    ammoBullets:{rows:makeAmmoBullets(),pal:'MAT.loot',anchor:'feet',note:'20x16, olive/gold box with a bullet icon'},
    ammoGrenades:{rows:makeAmmoGrenades(),pal:'MAT.loot',anchor:'feet',note:'20x16, olive ammo can with two brass-banded grenade rounds'},
    ammoShells:{rows:makeAmmoShells(),pal:'MAT.loot',anchor:'feet',note:'20x16, red shell box, two shells poking out'},
    fuelCan:{rows:makeFuelCan(),pal:'MAT.loot',anchor:'feet',note:'18x22, orange jerry can, cap, dark handle'},
    weaponCrate:{rows:makeWeaponCrate(),pal:'MAT.loot',anchor:'feet',note:'28x18, gold-latched dark case, slightly open, glint'},
    pallet:{rows:makePallet(),pal:'MAT.loot',anchor:'feet',note:'32x26, abandoned wood pallet, strapped olive crates with a stencilled cross/label, no chute'},
    xpShard:{frames:{down:[makeShardFrame(0),makeShardFrame(1),makeShardFrame(2)]},pal:'MAT.loot',anchor:'center',fps:6,note:'10x10, cyan signal shard, tiny rotation glint'},
    provision:{rows:makeProvision(),pal:'MAT.loot',anchor:'feet',note:'20x18, olive ration case, sage-green label, two tin lids, twist-tie tab'},
    jerrycan:{rows:makeJerrycan(),pal:'MAT.loot',anchor:'feet',note:'20x18, squared yellow-ochre vehicle-fuel can, offset cap, hollow handle loop'},
    evidence:{rows:makeEvidence(),pal:'MAT.loot',anchor:'feet',note:'20x18, brown folder bundle, page edges, red CONFIDENTIAL stamp'},
    payload:{rows:makePayload(),pal:'MAT.loot',anchor:'feet',note:'20x18, grey hard data case, rivets, cyan label strip'},
    override:{rows:makeOverride(),pal:OVERRIDE_PAL,anchor:'feet',note:'20x18, violet keycard on a lanyard, grey contact chip'}
  });
})();
