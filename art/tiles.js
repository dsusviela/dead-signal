(function(){
  'use strict';
  // Ground / floor / decal tiles for Dead Signal. Night city under quarantine:
  // near-black desaturated ground so survivors and glowing eyes pop. Every
  // base tile is generated from small helper functions so rows are always
  // exactly 32x32 and self-seamless (organic noise is stamped with wraparound
  // so a cluster that spills past x=31 continues at x=0, guaranteeing the
  // right edge tiles into the left edge; structural lines - joints, seams,
  // rivet rows, checker grout - sit at fixed positions shared by every
  // variant so any two variants of the same tile border cleanly).
  var MAT=DSArt.MAT, shade=DSArt.shade;

  // ---- grid helpers ----
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function mkGrid(fill){var g=[],y,x,row;for(y=0;y<32;y++){row=[];for(x=0;x<32;x++)row.push(fill);g.push(row);}return g;}
  function wrapIdx(n){return((n%32)+32)%32;}
  function setw(g,x,y,ch){g[wrapIdx(y)][wrapIdx(x)]=ch;}
  function setclip(g,x,y,ch){if(x>=0&&x<32&&y>=0&&y<32)g[y][x]=ch;}
  function toRows(g){return g.map(function(r){return r.join('');});}
  function hash2(x,y,seed){var n=(x*374761393+y*668265263+seed*2246822519)|0;n=(n^(n>>>13))*1274126177;n=n^(n>>>16);return((n>>>0)%1000)/1000;}

  // small blob shapes for wraparound cluster stamping (rule 13: a few clusters, varied spacing, empty areas)
  var BLOB1=[[0,0]];
  var BLOB2=[[0,0],[1,0]];
  var BLOB3=[[0,0],[0,1]];
  var BLOB4=[[0,0],[1,0],[0,1]];
  var BLOB5=[[0,0],[1,0],[-1,0]];
  var BLOB6=[[0,0],[1,0],[0,1],[1,1]];
  var BLOB7=[[0,0],[1,0],[2,0]];
  function scatter(g,rng,n,ch,shapes){
    var i,cx,cy,shape;
    for(i=0;i<n;i++){
      cx=Math.floor(rng()*32);cy=Math.floor(rng()*32);shape=shapes[Math.floor(rng()*shapes.length)];
      shape.forEach(function(o){setw(g,cx+o[0],cy+o[1],ch);});
    }
  }
  // 1-texel-wide staircase, constant 2-step run (rule 1: monotonic, never mixed); clipped (not wrapped) so it stays off the tile edge
  function drawCrack(g,x,y,steps,dx,dy,ch){
    var i,k;
    for(i=0;i<steps;i++){for(k=0;k<2;k++){setclip(g,x,y,ch);x+=dx;}y+=dy;}
  }

  // ---- edge-band mask builder (curb, quarantineStripe): distance-from-edge d for N/E/S/W bits, min across active sides ----
  function edgeDist(x,y,bit){if(bit===1)return y;if(bit===2)return 31-x;if(bit===4)return 31-y;return x;}
  function buildBandMask(width,baseFn,bandFn){
    var out=[],m,g,y,x,d,bestBit;
    for(m=0;m<16;m++){
      g=mkGrid('.');
      for(y=0;y<32;y++)for(x=0;x<32;x++){
        d=null;bestBit=0;
        (function(mm,xx,yy){
          [1,2,4,8].forEach(function(bit){
            if(!(mm&bit))return;
            var dd=edgeDist(xx,yy,bit);
            if(dd<width&&(d===null||dd<d)){d=dd;bestBit=bit;}
          });
        })(m,x,y);
        g[y][x]=d===null?baseFn(x,y,m):bandFn(x,y,d,bestBit,m);
      }
      out.push(toRows(g));
    }
    return out;
  }

  // =====================================================================
  // 1-2. asphalt + asphaltCrack (MAT.asphalt, K/D/M only)
  // =====================================================================
  function makeAsphaltGrid(seed){
    // K/D body (dark, barely lighter than the lots); M only as sparse worn clusters, well under 8% of texels
    var g=mkGrid('D'),rng=mulberry32(seed),cx,cy,dx,dy;
    scatter(g,rng,5,'K',[BLOB1,BLOB2,BLOB3,BLOB4]);
    scatter(g,rng,3,'M',[BLOB1,BLOB2]);
    cx=6+Math.floor(rng()*10);cy=6+Math.floor(rng()*10);dx=rng()<0.5?1:-1;dy=rng()<0.5?1:-1;
    drawCrack(g,cx,cy,3,dx,dy,'K');
    return g;
  }
  function makeAsphalt(seed){return toRows(makeAsphaltGrid(seed));}
  function makeAsphaltCrack(seed,cseed){
    var g=makeAsphaltGrid(seed),rng=mulberry32(cseed),cx,cy,dx,dy;
    cx=8+Math.floor(rng()*6);cy=6+Math.floor(rng()*5);dx=rng()<0.5?1:-1;dy=rng()<0.5?1:-1;
    drawCrack(g,cx,cy,11,dx,dy,'K');
    return toRows(g);
  }

  // =====================================================================
  // 3. laneDash / laneDashV (decal, MAT.asphalt + faded gold Y)
  // =====================================================================
  var LANE=Object.assign({},MAT.asphalt,{Y:'#9a743d'});
  function makeLaneDash(vertical){
    var g=mkGrid('.'),x,y;
    if(!vertical){
      for(y=14;y<17;y++)for(x=6;x<26;x++)g[y][x]='Y';
      for(y=14;y<17;y++){g[y][6]='D';g[y][25]='D';}
      [[10,15],[16,14],[21,16]].forEach(function(p){g[p[1]][p[0]]='.';});
    }else{
      for(x=14;x<17;x++)for(y=6;y<26;y++)g[y][x]='Y';
      for(x=14;x<17;x++){g[6][x]='D';g[25][x]='D';}
      [[15,10],[14,16],[16,21]].forEach(function(p){g[p[1]][p[0]]='.';});
    }
    return toRows(g);
  }

  // =====================================================================
  // 4. crosswalk (asphalt + worn white W, scuffed bars)
  // =====================================================================
  var CROSS=Object.assign({},MAT.asphalt,{W:MAT.concrete.L});
  function makeCrosswalk(seed,vertical){
    var g=mkGrid('D'),rng=mulberry32(seed),bands=[0,8,16,24],bi,t,o,pos,xx,yy;
    scatter(g,rng,4,'K',[BLOB1,BLOB2,BLOB3]);
    for(bi=0;bi<bands.length;bi++)for(t=0;t<4;t++){
      pos=bands[bi]+t;
      for(o=0;o<32;o++){
        xx=vertical?pos:o;yy=vertical?o:pos;
        if(hash2(xx,yy,13)<0.6)g[yy][xx]='W';
      }
    }
    return toRows(g);
  }

  // =====================================================================
  // 5. curb mask x16 (MAT.concrete + MAT.asphalt K shadow line)
  // =====================================================================
  var CURB=Object.assign({},MAT.concrete,{J:MAT.asphalt.K});
  function curbBase(x,y){return hash2(x,y,9)<0.04?'M':'D';}
  function curbBand(x,y,d){return d===0?'J':d===1?'D':'M';}
  var curbMasks=buildBandMask(3,curbBase,curbBand);

  // =====================================================================
  // 6. sidewalk variants x3 (MAT.concrete, joints every 16, one grass tuft)
  // =====================================================================
  var SIDEWALK=Object.assign({},MAT.concrete,{G:'#3a4a2a'});
  function makeSidewalk(seed,tuft){
    var g=mkGrid('M'),rng=mulberry32(seed),x,y;
    for(x=0;x<32;x++){g[8][x]='K';g[24][x]='K';}
    for(y=0;y<32;y++){g[y][8]='K';g[y][24]='K';}
    scatter(g,rng,2,'K',[BLOB1]);
    if(tuft){setclip(g,8,9,'G');setclip(g,8,10,'G');setclip(g,9,10,'G');}
    return toRows(g);
  }

  // =====================================================================
  // 7. sidewalkEdge mask x16 (MAT.concrete + lot dirt, irregular crumble fringe)
  // =====================================================================
  var EDGE=Object.assign({},MAT.concrete,{J:'#182421',I:shade('#182421',-10)});
  var FRINGE_DEPTH=[2,3,4,3,2,4,3,2];
  function fringeDepth(t){return FRINGE_DEPTH[((Math.floor(t)%8)+8)%8];}
  function edgeAlong(x,y,bit){return(bit===1||bit===4)?x:y;}
  function makeSidewalkEdgeMasks(){
    var out=[],m,g,y,x,dirt,h;
    for(m=0;m<16;m++){
      g=mkGrid('M');
      for(y=0;y<32;y++)for(x=0;x<32;x++){
        dirt=false;
        (function(mm,xx,yy){
          [1,2,4,8].forEach(function(bit){
            if(!(mm&bit))return;
            var dd=edgeDist(xx,yy,bit),t=edgeAlong(xx,yy,bit),depth=fringeDepth(t);
            if(dd<depth)dirt=true;
          });
        })(m,x,y);
        if(dirt){h=hash2(x,y,3);g[y][x]=h<0.3?'I':'J';}
        else{h=hash2(x,y,5);g[y][x]=h<0.05?'D':'M';}
      }
      out.push(toRows(g));
    }
    return out;
  }

  // =====================================================================
  // 8. drain + manhole decals
  // =====================================================================
  var DRAIN={K:MAT.asphalt.K,D:MAT.asphalt.D,S:MAT.iron.M,T:MAT.iron.L};
  function makeDrain(){
    var g=mkGrid('.'),x,y;
    for(y=22;y<30;y++)for(x=6;x<26;x++)g[y][x]='D';
    for(x=6;x<26;x++){g[22][x]='K';g[29][x]='K';}
    for(y=22;y<30;y++){g[y][6]='K';g[y][25]='K';}
    [24,26,28].forEach(function(ry){
      for(x=8;x<24;x++)g[ry][x]=(x%3===0)?'T':'S';
    });
    return toRows(g);
  }
  function makeManhole(){
    var g=mkGrid('.'),x,y,dx,dy,r,a,ang,rx,ry;
    for(y=0;y<32;y++)for(x=0;x<32;x++){
      dx=x-15.5;dy=y-15.5;r=Math.sqrt(dx*dx+dy*dy);
      if(r<=8){
        if(r>6.5)g[y][x]='K';
        else if(dx<-2&&dy<-2)g[y][x]='L';
        else g[y][x]='M';
      }
    }
    for(a=0;a<8;a++){ang=a/8*Math.PI*2;rx=Math.round(15.5+7*Math.cos(ang));ry=Math.round(15.5+7*Math.sin(ang));setclip(g,rx,ry,'D');}
    for(x=12;x<20;x++){setclip(g,x,15,'D');setclip(g,x,16,'D');}
    for(y=12;y<20;y++){setclip(g,15,y,'D');setclip(g,16,y,'D');}
    return toRows(g);
  }

  // =====================================================================
  // 9. district lots x5, x3 variants (inline tinted ramps, L kept modest/dark)
  // =====================================================================
  function lotPal(base,extra){
    var p={K:shade(base,-16),D:shade(base,-8),M:base,L:shade(base,14)};
    return extra?Object.assign(p,extra):p;
  }
  var LOT_SOUTH=lotPal('#182421');
  var LOT_RUINS=lotPal('#191925',{B:MAT.brick.D,Z:MAT.brick.M});
  var LOT_WARD=lotPal('#172322',{C:'#79e2cf'});
  var LOT_NORTH=lotPal('#171e25');
  var LOT_ASH=lotPal('#1b211f',{O:'#ff7b35'});
  var LOT_GRASS=lotPal('#233823'); // dead winter park grass, maintained (npm run art:ramp -- --hue 145 --l 0.13,0.5 --chroma 0.045)
  var LOT_GRAVEL=lotPal('#243037'); // graveyard/yard gravel (npm run art:ramp -- --hue 235 --l 0.12,0.48 --chroma 0.02)
  function makeLot(seed,opts){
    opts=opts||{};
    // rule 13: a few 2-4 texel clusters at varied spacing, large empty areas; base stays flat
    var g=mkGrid('M'),rng=mulberry32(seed),i;
    scatter(g,rng,3,'D',[BLOB1,BLOB2,BLOB3]);
    scatter(g,rng,1,'K',[BLOB1]);
    scatter(g,rng,opts.speckle||2,'L',[BLOB1]);
    if(opts.brick){scatter(g,rng,2,'B',[BLOB1]);scatter(g,rng,1,'Z',[BLOB1]);}
    if(opts.cyanPips)for(i=0;i<opts.cyanPips;i++)setw(g,Math.floor(rng()*32),Math.floor(rng()*32),'C');
    if(opts.emberPips)for(i=0;i<opts.emberPips;i++)setw(g,Math.floor(rng()*32),Math.floor(rng()*32),'O');
    return toRows(g);
  }

  // =====================================================================
  // 10-11. quarantinePlate x3 + quarantineStripe mask x16
  // =====================================================================
  var PLATE=Object.assign({},MAT.basalt,{E:MAT.ember.D});
  var STRIPE=Object.assign({},PLATE,{Y:'#ffd249',J:'#180b08'});
  function applyRivets(g){
    [8,24].forEach(function(ry){
      [4,12,20,28].forEach(function(rx){setclip(g,rx,ry,'L');setclip(g,rx+1,ry+1,'E');});
    });
  }
  function makePlate(seed){
    var g=mkGrid('M'),rng=mulberry32(seed);
    scatter(g,rng,7,'D',[BLOB1,BLOB2,BLOB4,BLOB7]);
    scatter(g,rng,2,'K',[BLOB1,BLOB2]);
    applyRivets(g);
    return toRows(g);
  }
  function stripeBaseTexel(x,y){
    if((y===8||y===24)&&(x===4||x===12||x===20||x===28))return 'L';
    if((y===9||y===25)&&(x===5||x===13||x===21||x===29))return 'E';
    return hash2(x,y,11)<0.05?'D':'M';
  }
  function stripeBand(x,y,d){return((x+y)%4<2)?'Y':'J';}
  var stripeMasks=buildBandMask(4,stripeBaseTexel,stripeBand);

  // =====================================================================
  // 12. interior floors: floorWood, floorTile, floorConcrete (x2 each)
  // =====================================================================
  function makeFloorWood(seed,knot){
    // unlit interior: K/D board body only, M restricted to a 1-texel edge highlight per board
    var g=mkGrid('D'),rng=mulberry32(seed),x,y,by,kx,ky;
    for(y=0;y<32;y++){by=Math.floor(y/8);for(x=0;x<32;x++)g[y][x]=(by%2===0)?'D':'K';}
    [1,9,17,25].forEach(function(ey){for(x=0;x<32;x++)g[ey][x]='M';});
    [0,8,16,24].forEach(function(sy){for(x=0;x<32;x++)g[sy][x]='K';});
    if(knot){kx=10+Math.floor(rng()*12);ky=4;setclip(g,kx,ky,'K');setclip(g,kx+1,ky,'D');setclip(g,kx,ky+1,'D');setclip(g,kx-1,ky,'K');}
    return toRows(g);
  }
  // checker stays within glass K/D only (unlit interior, no M/H)
  var TILEFLR={K:MAT.glass.K,D:MAT.glass.D,J:shade(MAT.glass.K,-10)};
  function makeFloorTile(seed,phase){
    var g=mkGrid('K'),x,y,cx,cy,alt;
    for(y=0;y<32;y++)for(x=0;x<32;x++){cx=Math.floor(x/16);cy=Math.floor(y/16);alt=(cx+cy+(phase?1:0))%2;g[y][x]=alt?'D':'K';}
    for(x=0;x<32;x++){g[0][x]='J';g[16][x]='J';}
    for(y=0;y<32;y++){g[y][0]='J';g[y][16]='J';}
    return toRows(g);
  }
  function makeFloorConcrete(seed){
    var g=mkGrid('M'),rng=mulberry32(seed),scx,scy;
    scatter(g,rng,4,'D',[BLOB1,BLOB2,BLOB3]);
    scx=8+Math.floor(rng()*16);scy=8+Math.floor(rng()*16);
    [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[2,0],[0,2]].forEach(function(o){if(rng()<0.7)setw(g,scx+o[0],scy+o[1],'D');});
    setw(g,scx,scy,'K');
    return toRows(g);
  }

  // =====================================================================
  // 13. decals: decalOil, decalTyre, decalBloodOld, decalAsh (x2 each, mostly transparent)
  // =====================================================================
  function makeOilStain(seed){
    var g=mkGrid('.'),rng=mulberry32(seed),cx=10+Math.floor(rng()*12),cy=10+Math.floor(rng()*12);
    [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[2,0],[-2,0],[0,2],[1,-1],[-1,1]].forEach(function(o){if(rng()<0.75)setw(g,cx+o[0],cy+o[1],'D');});
    setw(g,cx,cy,'K');setw(g,cx+1,cy,'K');
    return toRows(g);
  }
  function makeTyreSkid(seed,curve){
    var g=mkGrid('.'),rng=mulberry32(seed),y,off;
    for(y=4;y<28;y++){
      off=curve?Math.round(3*Math.sin((y-4)/24*Math.PI)):0;
      if(rng()<0.85){setclip(g,10+off,y,'K');setclip(g,20+off,y,'K');}
    }
    return toRows(g);
  }
  function makeBloodSplat(seed){
    var g=mkGrid('.'),rng=mulberry32(seed),cx=12+Math.floor(rng()*8),cy=12+Math.floor(rng()*8),i,dx,dy;
    [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1],[2,0],[0,-2]].forEach(function(o){if(rng()<0.8)setw(g,cx+o[0],cy+o[1],'D');});
    setw(g,cx,cy,'K');
    for(i=0;i<5;i++){dx=Math.floor(rng()*14)-7;dy=Math.floor(rng()*14)-7;if(rng()<0.6)setw(g,cx+dx,cy+dy,'D');}
    return toRows(g);
  }
  var ASH=(function(){var m='#3a3a36';return{M:m,D:shade(m,-14)};})();
  function makeAshDrift(seed){
    var g=mkGrid('.'),rng=mulberry32(seed),i,x,y,len,k;
    for(i=0;i<6;i++){
      x=Math.floor(rng()*24);y=8+Math.floor(rng()*16);len=3+Math.floor(rng()*4);
      for(k=0;k<len;k++)if(rng()<0.8)setw(g,x+k,y+Math.floor(k/3),rng()<0.5?'M':'D');
    }
    return toRows(g);
  }

  // =====================================================================
  DSArt.define('tiles',{
    asphalt:{variants:[makeAsphalt(1),makeAsphalt(2),makeAsphalt(3)],pal:'MAT.asphalt',anchor:'tile',note:'32x32 worn road body, K/D/M only, faint cracks and patch clusters, seamless'},
    asphaltCrack:{variants:[makeAsphaltCrack(1,41),makeAsphaltCrack(2,42)],pal:'MAT.asphalt',anchor:'tile',note:'asphalt body plus one longer staircase crack'},
    laneDash:{rows:makeLaneDash(false),pal:LANE,anchor:'tile',note:'decal, horizontal road centre-line dash 20x3, faded gold'},
    laneDashV:{rows:makeLaneDash(true),pal:LANE,anchor:'tile',note:'decal, vertical road centre-line dash 3x20, faded gold'},
    crosswalk:{variants:[makeCrosswalk(301,false),makeCrosswalk(302,true)],pal:CROSS,anchor:'tile',note:'zebra bars over asphalt, scuffed worn white, [0] horizontal bars [1] vertical bars'},
    curb:{mask:curbMasks,pal:CURB,anchor:'tile',note:'concrete band; set bit = road on that side, raised kerb with lit top row and asphalt-shadow drop edge'},
    sidewalk:{variants:[makeSidewalk(401,false),makeSidewalk(402,false),makeSidewalk(403,true)],pal:SIDEWALK,anchor:'tile',note:'concrete slabs, expansion joints every 16, chips, [2] has a grass tuft in a joint'},
    sidewalkEdge:{mask:makeSidewalkEdgeMasks(),pal:EDGE,anchor:'tile',note:'concrete slab; set bit = lot on that side, edge crumbles into dirt fringe 2-4 texels'},
    drain:{rows:makeDrain(),pal:DRAIN,anchor:'tile',note:'decal, storm drain grate 20x8 near bottom, mostly transparent'},
    manhole:{rows:makeManhole(),pal:'MAT.iron',anchor:'tile',note:'decal, round 16-texel iron cover, centred, mostly transparent'},
    lotSouth:{variants:[makeLot(101,{}),makeLot(102,{}),makeLot(103,{})],pal:LOT_SOUTH,anchor:'tile',note:'South Blocks packed dirt, sparse gravel, teal-grey, seamless'},
    lotRuins:{variants:[makeLot(111,{brick:true}),makeLot(112,{brick:true}),makeLot(113,{brick:true})],pal:LOT_RUINS,anchor:'tile',note:'Old Quarter rubble and brick fragments, violet-grey, seamless'},
    lotWard:{variants:[makeLot(121,{cyanPips:2}),makeLot(122,{cyanPips:0}),makeLot(123,{cyanPips:1})],pal:LOT_WARD,anchor:'tile',note:'Civic Ward forecourt tiles, rare cyan-teal pip in joints, seamless'},
    lotNorth:{variants:[makeLot(131,{speckle:3}),makeLot(132,{speckle:3}),makeLot(133,{speckle:3})],pal:LOT_NORTH,anchor:'tile',note:'Northline frost-dusted concrete, faint blue-grey speckle, seamless'},
    lotAsh:{variants:[makeLot(141,{}),makeLot(142,{emberPips:3}),makeLot(143,{})],pal:LOT_ASH,anchor:'tile',note:'Ashworks slag and ash, warm brown-grey, embers only in [1] (max 3), seamless'},
    grass:{variants:[makeLot(151,{speckle:1}),makeLot(152,{speckle:1}),makeLot(153,{speckle:0})],pal:LOT_GRASS,anchor:'tile',note:'dead winter park grass, very dark, maintained, sparse speckle, seamless'},
    gravel:{variants:[makeLot(161,{speckle:4}),makeLot(162,{speckle:4}),makeLot(163,{speckle:5})],pal:LOT_GRAVEL,anchor:'tile',note:'graveyard/yard gravel, very dark, denser speckle than the district lots, seamless'},
    quarantinePlate:{variants:[makePlate(201),makePlate(202),makePlate(203)],pal:PLATE,anchor:'tile',note:'riveted steel plaza plate, basalt + ember-dark rivet shadow, rivet rows every 16, seamless'},
    quarantineStripe:{mask:stripeMasks,pal:STRIPE,anchor:'tile',note:'plate tile; set bit = outside plaza on that side, 4-texel diagonal hazard stripe band'},
    floorWood:{variants:[makeFloorWood(501,false),makeFloorWood(502,true)],pal:'MAT.wood',anchor:'tile',note:'interior planks, 8-texel boards, seams every 8, [1] has a knot'},
    floorTile:{variants:[makeFloorTile(601,false),makeFloorTile(602,true)],pal:TILEFLR,anchor:'tile',note:'interior glass-tinted checker, 16-texel tiles, dark K/D only'},
    floorConcrete:{variants:[makeFloorConcrete(701),makeFloorConcrete(702)],pal:'MAT.concrete',anchor:'tile',note:'plain interior concrete with one stain patch'},
    decalOil:{variants:[makeOilStain(801),makeOilStain(802)],pal:'MAT.asphalt',anchor:'tile',note:'decal, dark oil stain puddle, mostly transparent'},
    decalTyre:{variants:[makeTyreSkid(901,false),makeTyreSkid(902,true)],pal:'MAT.asphalt',anchor:'tile',note:'decal, tyre skid pair, [1] curved, mostly transparent'},
    decalBloodOld:{variants:[makeBloodSplat(1001),makeBloodSplat(1002)],pal:'MAT.blood',anchor:'tile',note:'decal, dried old blood splatter with droplets, mostly transparent'},
    decalAsh:{variants:[makeAshDrift(1101),makeAshDrift(1102)],pal:ASH,anchor:'tile',note:'decal, wind-blown grey ash drift streaks, mostly transparent'}
  });
})();
