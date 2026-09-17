// Dead Signal building signs: wall plaques hung beside a public door (anchor
// feet), one per signed archetype (world.js `signs()`). Readable by pictogram
// alone at gameplay zoom -- no reliance on text, at most a 1-texel dash
// suggesting lettering. Night city, day 9 of a quarantine: muted iron frame,
// pale worn panel; medical crosses stay off pure green/cyan (pale sage
// instead) and the depot cone stays off gameplay-bright orange (a faded
// hazard amber instead). One texel = one world unit (den 1).
(function(){
  'use strict';
  var A=(typeof window!=='undefined'?window:globalThis).DSArt;
  var MAT=A.MAT,shade=A.shade;

  // ---- grid helpers (same shape as art/lots.js) ----
  function mkGrid(w,h){var g=[],y,x,row;for(y=0;y<h;y++){row=[];for(x=0;x<w;x++)row.push('.');g.push(row);}return g;}
  function setclip(g,x,y,ch){if(y>=0&&y<g.length&&x>=0&&x<g[0].length)g[y][x]=ch;}
  function rect(g,x0,y0,x1,y1,ch){var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)setclip(g,x,y,ch);}
  function toRows(g){return g.map(function(r){return r.join('');});}
  function pal2(base,extra){return Object.assign({},base,extra);}
  function disc(g,cx,cy,rx,ry,ch){var x,y;for(y=-ry;y<=ry;y++)for(x=-rx;x<=rx;x++)if((x*x)/(rx*rx)+(y*y)/(ry*ry)<=1)setclip(g,cx+x,cy+y,ch);}
  function bevel(g,x0,y0,x1,y1,K,L,M,D){
    rect(g,x0,y0,x1,y1,M);
    rect(g,x0,y0,x1,y0,K);rect(g,x0,y1,x1,y1,K);rect(g,x0,y0,x0,y1,K);rect(g,x1,y0,x1,y1,K);
    if(x1-x0>=2&&y1-y0>=2){
      rect(g,x0+1,y0+1,x1-1,y0+1,L);
      rect(g,x0+1,y0+1,x0+1,y1-1,L);
      rect(g,x0+1,y1-1,x1-1,y1-1,D);
      rect(g,x1-1,y0+1,x1-1,y1-1,D);
    }
  }
  function outlineFrom(g,fillLetters,K){
    var h=g.length,w=g[0].length,x,y,src=g.map(function(r){return r.slice();});
    function isFill(ch){return fillLetters.indexOf(ch)>=0;}
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      if(!isFill(src[y][x]))continue;
      if(x===0||x===w-1||y===0||y===h-1||src[y][x-1]==='.'||src[y][x+1]==='.'||src[y-1][x]==='.'||src[y+1][x]==='.')g[y][x]=K;
    }
  }
  function line(g,x0,y0,x1,y1,ch){
    x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
    var dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy,e2;
    for(;;){
      setclip(g,x0,y0,ch);
      if(x0===x1&&y0===y1)break;
      e2=2*err;
      if(e2>=dy){err+=dy;x0+=sx;}
      if(e2<=dx){err+=dx;y0+=sy;}
    }
  }
  // concentric ring segment, right half only (radio waves fanning off a mast)
  function arcRing(g,cx,cy,r,thick,ch){
    var x,y,d;
    for(y=-r;y<=r;y++)for(x=0;x<=r;x++){d=Math.sqrt(x*x+y*y);if(d<=r&&d>r-thick)setclip(g,cx+x,cy+y,ch);}
  }

  // ---- palette: shared iron frame + pale panel + a few muted accents ----
  var SAGE={K:'#323e38',D:'#44594b',M:'#5f745f',L:'#808d78',H:'#a2a79a'}; // pale sage medical cross, off pure green/cyan (npm run art:ramp -- --hue 145 --l 0.35,0.72 --chroma 0.04 --name sage)
  var HAZARD={K:'#412e23',D:'#5c3c1b',M:'#6d4f20',L:'#78653a',H:'#807b64'}; // faded hazard amber, well below gameplay-orange (npm run art:ramp -- --hue 75 --l 0.32,0.58 --chroma 0.075 --name hazard)
  var SIGN_PAL=pal2(MAT.iron,{
    P:MAT.concrete.M,Q:MAT.concrete.L,          // panel backing / pale glyph fill
    X:SAGE.M,Y:SAGE.L,                          // medical cross
    F:MAT.ember.D,                              // muted warm (fire helmet)
    Z:HAZARD.M,V:HAZARD.D,                      // traffic cone
    B:MAT.wood.M,C:MAT.wood.D                   // wood/handle tones
  });

  // =====================================================================
  // shared plaque frame: 32x24, anchor feet, iron frame + pale backing panel
  // =====================================================================
  function panelBase(){
    var g=mkGrid(32,24);
    bevel(g,0,0,31,23,'K','L','M','D');
    rect(g,3,3,28,20,'P');
    rect(g,3,3,28,3,'K');rect(g,3,20,28,20,'K');rect(g,3,3,3,20,'K');rect(g,28,3,28,20,'K');
    setclip(g,2,2,'H');setclip(g,29,2,'H');setclip(g,2,21,'H');setclip(g,29,21,'H'); // mounting screws
    return g;
  }

  function makeMarket(){ // shopping cart
    var g=panelBase(),x;
    rect(g,7,8,24,13,'Q');
    for(x=10;x<=21;x+=4)rect(g,x,8,x,13,'M');
    rect(g,7,10,24,10,'M');
    line(g,7,8,4,5,'Q');line(g,4,5,4,4,'Q');
    disc(g,10,16,2,2,'Q');disc(g,21,16,2,2,'Q');
    outlineFrom(g,['Q'],'K');
    return toRows(g);
  }
  function makePharmacy(){ // pill capsule + pale-sage cross
    var g=panelBase();
    rect(g,9,6,22,10,'X');rect(g,15,6,16,10,'Y');
    rect(g,14,12,17,19,'X');rect(g,10,14,21,16,'X');
    outlineFrom(g,['X','Y'],'K');
    return toRows(g);
  }
  function makeClinic(){ // cross outline, centred and larger
    var g=panelBase();
    rect(g,13,5,18,19,'X');rect(g,7,10,24,14,'X');
    outlineFrom(g,['X'],'K');
    return toRows(g);
  }
  function makeHospital(){ // large H
    var g=panelBase();
    rect(g,8,5,11,19,'Q');rect(g,20,5,23,19,'Q');rect(g,8,10,23,13,'Q');
    outlineFrom(g,['Q'],'K');
    return toRows(g);
  }
  function makePolice(){ // badge/shield
    var g=panelBase(),y,inset;
    rect(g,10,5,21,14,'H');
    for(y=15;y<=18;y++){inset=y-14;rect(g,10+inset,y,21-inset,y,'H');}
    rect(g,14,9,17,9,'P');
    outlineFrom(g,['H'],'K');
    return toRows(g);
  }
  function makeFire(){ // helmet + crossed axes
    var g=panelBase();
    disc(g,16,9,7,5,'F');rect(g,8,12,24,13,'F');
    line(g,9,20,20,10,'B');line(g,8,20,19,10,'B');
    line(g,23,20,12,10,'B');line(g,24,20,13,10,'B');
    rect(g,7,19,10,21,'L');rect(g,22,19,25,21,'L');
    outlineFrom(g,['F','B','L'],'K');
    return toRows(g);
  }
  function makeRadio(){ // antenna mast + waves
    var g=panelBase();
    rect(g,15,5,16,19,'L');
    rect(g,11,8,20,8,'L');rect(g,12,11,19,11,'L');
    rect(g,13,19,18,20,'D');
    arcRing(g,15,9,9,2,'Q');arcRing(g,15,9,6,2,'Q');
    outlineFrom(g,['L','D','Q'],'K');
    return toRows(g);
  }
  function makeMachineShop(){ // gear
    var g=panelBase();
    disc(g,16,12,7,7,'L');
    rect(g,15,3,17,5,'L');rect(g,15,19,17,21,'L');
    rect(g,7,11,9,13,'L');rect(g,23,11,25,13,'L');
    rect(g,9,6,11,8,'L');rect(g,21,6,23,8,'L');
    rect(g,9,16,11,18,'L');rect(g,21,16,23,18,'L');
    outlineFrom(g,['L'],'K');
    disc(g,16,12,3,3,'K');disc(g,16,12,2,2,'P');
    return toRows(g);
  }
  function makeWarehouse(){ // two crates of different heights, a gap between them, lid bands only
    var g=panelBase();
    rect(g,7,13,14,20,'B');rect(g,7,13,14,14,'C');
    rect(g,17,9,24,20,'B');rect(g,17,9,24,10,'C');
    outlineFrom(g,['B','C'],'K');
    return toRows(g);
  }
  function makeChapel(){ // bell
    var g=panelBase(),y,half;
    rect(g,15,4,16,6,'B');
    disc(g,16,12,6,7,'B');
    for(y=17;y<=19;y++){half=7+(y-16);rect(g,16-half,y,16+half,y,'B');}
    rect(g,15,19,16,21,'C');rect(g,15,21,16,21,'D');
    outlineFrom(g,['B'],'K');
    return toRows(g);
  }
  function makeMorgue(){ // drawer + tag
    var g=panelBase();
    rect(g,7,7,24,17,'L');rect(g,14,15,17,15,'D');
    rect(g,21,4,26,9,'Q');line(g,21,7,18,9,'K');
    outlineFrom(g,['L','Q'],'K');
    return toRows(g);
  }
  function makeDepot(){ // traffic cone + wrench
    var g=panelBase(),y,half;
    for(y=6;y<=18;y++){half=Math.max(1,Math.round((18-y)/12*7));rect(g,16-half,y,16+half,y,'Z');}
    rect(g,10,11,22,11,'V');rect(g,11,15,21,15,'V');
    rect(g,9,19,23,21,'V');
    line(g,7,21,25,6,'L');line(g,8,21,26,6,'L');
    disc(g,7,21,2,2,'L');disc(g,25,6,2,2,'L');
    outlineFrom(g,['Z','V','L'],'K');
    disc(g,7,21,1,1,'P');disc(g,25,6,1,1,'P');
    return toRows(g);
  }
  function makeHolding(){ // barred window
    var g=panelBase(),x;
    rect(g,9,6,22,18,'D');
    outlineFrom(g,['D'],'K');
    for(x=11;x<=20;x+=3)rect(g,x,7,x,17,'K');
    return toRows(g);
  }
  function makeArmoury(){ // crossed rifles
    var g=panelBase();
    line(g,7,20,25,6,'L');line(g,8,20,26,6,'L');
    line(g,25,20,7,6,'L');line(g,26,20,8,6,'L');
    rect(g,6,19,9,21,'C');rect(g,23,19,26,21,'C');
    outlineFrom(g,['L','C'],'K');
    return toRows(g);
  }
  function makeCommand(){ // stacked chevrons
    var g=panelBase();
    function chevron(y0){
      line(g,10,y0+4,16,y0,'Q');line(g,16,y0,22,y0+4,'Q');
      line(g,10,y0+5,16,y0+1,'Q');line(g,16,y0+1,22,y0+5,'Q');
    }
    chevron(5);chevron(10);chevron(15);
    outlineFrom(g,['Q'],'K');
    return toRows(g);
  }
  function makeShop(){ // striped awning
    var g=panelBase(),i,x0,k;
    rect(g,7,7,24,13,'B');
    for(i=0;i<4;i++){x0=9+i*4;rect(g,x0,7,x0+1,13,'Q');}
    for(i=0;i<4;i++){x0=7+i*4.25|0;for(k=0;k<3;k++)rect(g,x0+k,14+k,x0+4-k,14+k,'B');}
    outlineFrom(g,['B','Q'],'K');
    return toRows(g);
  }

  A.define('signs',{
    market:{rows:makeMarket(),pal:SIGN_PAL,anchor:'feet',note:'32x24 plaque, shopping cart pictogram'},
    pharmacy:{rows:makePharmacy(),pal:SIGN_PAL,anchor:'feet',note:'32x24 plaque, pill capsule over a pale-sage cross'},
    clinic:{rows:makeClinic(),pal:SIGN_PAL,anchor:'feet',note:'32x24 plaque, pale-sage cross outline'},
    hospital:{rows:makeHospital(),pal:SIGN_PAL,anchor:'feet',note:'32x24 plaque, large block H'},
    police:{rows:makePolice(),pal:SIGN_PAL,anchor:'feet',note:'32x24 plaque, badge/shield'},
    fire:{rows:makeFire(),pal:SIGN_PAL,anchor:'feet',note:'32x24 plaque, helmet over crossed axes'},
    radio:{rows:makeRadio(),pal:SIGN_PAL,anchor:'feet',note:'32x24 plaque, antenna mast with waves'},
    machineShop:{rows:makeMachineShop(),pal:SIGN_PAL,anchor:'feet',note:'32x24 plaque, gear'},
    warehouse:{rows:makeWarehouse(),pal:SIGN_PAL,anchor:'feet',note:'32x24 plaque, stacked crates'},
    chapel:{rows:makeChapel(),pal:SIGN_PAL,anchor:'feet',note:'32x24 plaque, bell'},
    morgue:{rows:makeMorgue(),pal:SIGN_PAL,anchor:'feet',note:'32x24 plaque, drawer with a tag'},
    depot:{rows:makeDepot(),pal:SIGN_PAL,anchor:'feet',note:'32x24 plaque, traffic cone and wrench'},
    holding:{rows:makeHolding(),pal:SIGN_PAL,anchor:'feet',note:'32x24 plaque, barred window'},
    armoury:{rows:makeArmoury(),pal:SIGN_PAL,anchor:'feet',note:'32x24 plaque, crossed rifles'},
    command:{rows:makeCommand(),pal:SIGN_PAL,anchor:'feet',note:'32x24 plaque, stacked chevrons'},
    shop:{rows:makeShop(),pal:SIGN_PAL,anchor:'feet',note:'32x24 plaque, striped awning'}
  });
})();
