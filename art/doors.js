// Dead Signal exterior doorways: a shared worn threshold strip (tiles along
// the gap), a standing jamb post at each end (anchor feet) and a swung-open
// door leaf lying along its length (anchor tile, render.js rotates it into
// place). One texel = one world unit (den 1). Night city, day 9 of a
// quarantine: muted, fresh abandonment -- no gameplay orange/red/cyan/green
// on any door. Families read by material/silhouette, never text.
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
  function pmod(n,p){return((n%p)+p)%p;}
  // vertical accent lines every `period` columns starting at x0+offset, spanning y0..y1
  function vAccent(g,x0,x1,y0,y1,period,offset,ch){var x;for(x=x0;x<=x1;x++)if(pmod(x-x0+offset,period)===0)rect(g,x,y0,x,y1,ch);}
  // Bresenham 1px line (chapel hinge straps)
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

  // ---- palettes ----
  var PAINT={K:'#0e101e',D:'#182440',M:'#223b5c',L:'#35556e',H:'#596c77'}; // faded barn-blue door paint (npm run art:ramp -- --hue 255 --l 0.18,0.52 --chroma 0.065 --name paint)
  var GLASS_PAL=pal2(MAT.glass,{A:MAT.iron.L,B:MAT.iron.D}); // pale glass panes, aluminium frame accents
  var HOSP_PAL=pal2(MAT.concrete,{V:MAT.glass.L}); // pale clinical panel, glazed vision-strip accent
  var CHAPEL_PAL=pal2(MAT.wood,{S:MAT.iron.M,T:MAT.iron.D}); // dark oak, iron hinge-strap accents
  var MIL_PAL=pal2(MAT.olive,{S:MAT.concrete.H}); // olive steel, pale stencil accent

  // =====================================================================
  // sill_h 16x14 / sill_v 14x16: worn concrete threshold, tiles along its
  // run (period-8 grout seam so repeats read as one continuous slab run;
  // a lighter worn-path band shows where feet cross it).
  // =====================================================================
  function makeSillH(){
    var w=16,h=14,g=mkGrid(w,h);
    bevel(g,0,0,15,13,'K','L','M','D');
    rect(g,8,1,8,12,'K'); // grout seam, period 8 divides the 16-wide tile
    rect(g,2,6,13,8,'L'); // worn path where feet cross
    setclip(g,3,3,'D');setclip(g,11,10,'D');setclip(g,6,11,'D');setclip(g,13,4,'D');
    return toRows(g);
  }
  function makeSillV(){
    var w=14,h=16,g=mkGrid(w,h);
    bevel(g,0,0,13,15,'K','L','M','D');
    rect(g,1,8,12,8,'K'); // grout seam, period 8 divides the 16-tall tile
    rect(g,5,2,8,13,'L'); // worn path where feet cross
    setclip(g,3,3,'D');setclip(g,10,11,'D');setclip(g,6,12,'D');setclip(g,4,13,'D');
    return toRows(g);
  }

  // =====================================================================
  // <family>_jamb 8x24: standing door-frame post, anchor feet, lit cap.
  // =====================================================================
  function jambBase(){var w=8,h=24,g=mkGrid(w,h);bevel(g,0,0,7,23,'K','L','M','D');rect(g,0,0,7,1,'H');return g;}
  function makeJambResidential(){var g=jambBase();rect(g,2,3,5,3,'H');return toRows(g);}
  function makeJambGlassDouble(){var g=jambBase();rect(g,4,3,4,20,'D');rect(g,3,3,3,20,'H');return toRows(g);}
  function makeJambPoliceBars(){var g=jambBase();rect(g,1,10,6,10,'D');rect(g,1,14,6,14,'D');return toRows(g);}
  function makeJambFireRoller(){var g=jambBase();rect(g,3,3,4,20,'D');return toRows(g);}
  function makeJambHospital(){var g=jambBase();rect(g,2,10,5,12,'V');rect(g,2,10,5,10,'K');rect(g,2,12,5,12,'K');return toRows(g);}
  function makeJambLoadingBay(){var g=jambBase();rect(g,3,3,4,20,'D');rect(g,2,3,2,20,'L');return toRows(g);}
  function makeJambChapel(){var g=jambBase();rect(g,1,8,6,9,'S');setclip(g,1,8,'T');setclip(g,6,9,'T');rect(g,1,15,6,16,'S');setclip(g,1,15,'T');setclip(g,6,16,'T');return toRows(g);}
  function makeJambMilitary(){var g=jambBase();rect(g,2,10,3,10,'S');rect(g,5,10,6,10,'S');return toRows(g);}
  function makeJambService(){return toRows(jambBase());}

  // =====================================================================
  // <family>_leaf 40x8: thin open door leaf, hinge at x0 (anchor tile),
  // handle near the far edge unless a family overrides its hardware.
  // =====================================================================
  function leafBase(){var w=40,h=8,g=mkGrid(w,h);bevel(g,0,0,39,7,'K','L','M','D');rect(g,1,3,2,4,'D');return g;}
  function handle(g,ch){setclip(g,34,3,ch||'H');setclip(g,34,4,ch||'H');}

  function makeLeafResidential(){
    var g=leafBase();
    rect(g,3,1,3,6,'K');rect(g,33,1,33,6,'K');rect(g,18,1,19,6,'K'); // stile/muntin panel lines
    handle(g,'H');
    return toRows(g);
  }
  function makeLeafGlassDouble(){
    var g=leafBase();
    rect(g,19,1,20,6,'A'); // centre mullion, double-door split
    rect(g,2,1,39-2,1,'A'); // transom rail
    setclip(g,17,4,'B');setclip(g,17,3,'B'); // push bar
    return toRows(g);
  }
  function makeLeafPoliceBars(){
    var g=leafBase();
    vAccent(g,4,35,1,6,4,0,'D'); // caged bars over the steel backing
    handle(g,'L');
    return toRows(g);
  }
  function makeLeafFireRoller(){
    var g=leafBase();
    vAccent(g,2,37,1,6,3,0,'D'); // narrow ribbed slats
    vAccent(g,3,37,1,3,3,0,'L'); // rib highlight catch
    return toRows(g);
  }
  function makeLeafHospital(){
    var g=leafBase();
    rect(g,10,1,13,6,'V');rect(g,10,1,13,1,'K');rect(g,10,6,13,6,'K');rect(g,10,1,10,6,'K');rect(g,13,1,13,6,'K'); // vision strip
    handle(g,'H');
    return toRows(g);
  }
  function makeLeafLoadingBay(){
    var g=leafBase();
    vAccent(g,2,37,1,6,4,0,'D'); // wider ribs than fireRoller, grey not rust
    vAccent(g,3,37,1,3,4,0,'L');
    return toRows(g);
  }
  function makeLeafChapel(){
    var g=leafBase();
    line(g,4,1,10,6,'S');line(g,5,1,11,6,'S');setclip(g,4,1,'T');setclip(g,10,6,'T');
    line(g,35,1,29,6,'S');line(g,34,1,28,6,'S');setclip(g,35,1,'T');setclip(g,29,6,'T');
    return toRows(g);
  }
  function makeLeafMilitary(){
    var g=leafBase();
    [6,11,16,21,26,31].forEach(function(x){rect(g,x,3,x+2,3,'S');}); // stencil dash band, no letters
    return toRows(g);
  }
  function makeLeafService(){
    var g=leafBase();
    handle(g,'L');
    return toRows(g);
  }

  A.define('doors',{
    sill_h:{rows:makeSillH(),pal:'MAT.concrete',anchor:'tile',note:'16x14 worn concrete threshold, period-8 grout seam, worn path band; tiles left-right'},
    sill_v:{rows:makeSillV(),pal:'MAT.concrete',anchor:'tile',note:'14x16 worn concrete threshold, period-8 grout seam, worn path band; tiles top-bottom'},

    residential_jamb:{rows:makeJambResidential(),pal:'MAT.wood',anchor:'feet',note:'8x24 natural-wood frame post, lit cap'},
    residential_leaf:{rows:makeLeafResidential(),pal:PAINT,anchor:'tile',note:'40x8 painted-wood panel door leaf, hinge at x0'},
    glassDouble_jamb:{rows:makeJambGlassDouble(),pal:'MAT.iron',anchor:'feet',note:'8x24 aluminium frame post with an extruded channel'},
    glassDouble_leaf:{rows:makeLeafGlassDouble(),pal:GLASS_PAL,anchor:'tile',note:'40x8 pale glass leaf, aluminium mullion and push bar'},
    policeBars_jamb:{rows:makeJambPoliceBars(),pal:'MAT.iron',anchor:'feet',note:'8x24 dark steel frame post, bar-socket marks'},
    policeBars_leaf:{rows:makeLeafPoliceBars(),pal:'MAT.iron',anchor:'tile',note:'40x8 dark steel leaf caged with vertical bars'},
    fireRoller_jamb:{rows:makeJambFireRoller(),pal:'MAT.rust',anchor:'feet',note:'8x24 red-brown frame post with a roller guide-rail groove'},
    fireRoller_leaf:{rows:makeLeafFireRoller(),pal:'MAT.rust',anchor:'tile',note:'40x8 muted red-brown ribbed roller-shutter leaf'},
    hospital_jamb:{rows:makeJambHospital(),pal:HOSP_PAL,anchor:'feet',note:'8x24 pale clinical frame post, small glazed accent'},
    hospital_leaf:{rows:makeLeafHospital(),pal:HOSP_PAL,anchor:'tile',note:'40x8 pale clinical panel leaf with a glazed vision strip'},
    loadingBay_jamb:{rows:makeJambLoadingBay(),pal:'MAT.iron',anchor:'feet',note:'8x24 grey steel frame post with a roller guide-rail groove'},
    loadingBay_leaf:{rows:makeLeafLoadingBay(),pal:'MAT.iron',anchor:'tile',note:'40x8 ribbed grey roller-shutter leaf'},
    chapel_jamb:{rows:makeJambChapel(),pal:CHAPEL_PAL,anchor:'feet',note:'8x24 heavy dark-oak frame post, iron strap wraps'},
    chapel_leaf:{rows:makeLeafChapel(),pal:CHAPEL_PAL,anchor:'tile',note:'40x8 heavy dark-oak leaf with diagonal iron hinge straps'},
    military_jamb:{rows:makeJambMilitary(),pal:MIL_PAL,anchor:'feet',note:'8x24 olive steel frame post, pale stencil dashes'},
    military_leaf:{rows:makeLeafMilitary(),pal:MIL_PAL,anchor:'tile',note:'40x8 olive steel leaf with a pale stencil dash band'},
    service_jamb:{rows:makeJambService(),pal:'MAT.iron',anchor:'feet',note:'8x24 plain grey steel frame post'},
    service_leaf:{rows:makeLeafService(),pal:'MAT.iron',anchor:'tile',note:'40x8 plain grey steel leaf'}
  });
})();
