// Dead Signal hud: screen-space chrome, drawn every frame with no lighting
// pass, so it must read at 100% on its own. One texel = one world unit
// (den 1). Six sprites only — everything else in ART.md's old hud plan
// table (barFrame, divider, keycap, badgeTier, cardFrame, ...) has zero
// call sites in hud.js/render.js/game.js today; drawing it now would be
// thrown away when the queued HUD declutter rebuilds the panel layout.
//
// panel9 / panel9Alert / panel9Gold: a 3x3, 8x8-texel-cell 9-slice frame
// (hud.js:38-49 reads sp.w/3, sp.h/3 and blits nine cells — 24x24 total,
// evenly divisible by 3 or the slices tear). The centre cell is always
// fully transparent: hud.js fills the panel interior with a flat colour
// first, then stretches the centre cell over it, so any texture there
// would double up. Edge cells carry only a border row/column that runs
// uniformly along their stretch axis (top/bottom: horizontal K+bevel
// rows; left/right: vertical K+bevel columns) so `drawImage` stretching
// elongates a deliberate rule instead of smearing a detail. Corners are
// never stretched, so they alone carry a 1px rivet accent. All three
// styles share identical geometry (letters K/L/D/R in the same texels);
// only the hex each letter maps to changes, so a panel never changes
// shape when it changes state (alert/gold).
//
// icon_bullets / icon_shells / icon_fuel: 12x12 silhouettes for the
// SUPPLIES strip (hud.js:130 builds 'icon_'+key for bullets/shells/fuel;
// note the underscore — ART.md's iconBullet/iconShell/iconFuel names
// would never resolve). At 12px, rule 10 skips AA and rule 17 caps the
// colour budget low, so each icon is silhouette-first: a bullet standing
// on its point, a stubby shell with a flared brass rim, a boxy jerry can
// with a spout and a handle notch. MAT.iron (bullets) and MAT.loot
// (shells, fuel) keep these on the game's existing ammo/fuel hues.
(function(){
  'use strict';
  var A=(typeof window!=='undefined'?window:globalThis).DSArt;

  // ---- grid helpers (tools/art/pix.mjs style: build on a grid, emit rows) ----
  function mkGrid(w,h){var g=[],y,x,row;for(y=0;y<h;y++){row=[];for(x=0;x<w;x++)row.push('.');g.push(row);}return g;}
  function setclip(g,x,y,ch){if(y>=0&&y<g.length&&x>=0&&x<g[0].length)g[y][x]=ch;}
  function rect(g,x0,y0,x1,y1,ch){var x,y;for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)setclip(g,x,y,ch);}
  function toRows(g){return g.map(function(r){return r.join('');});}

  // =====================================================================
  // panel9 family: nine 8x8 cells assembled into one 24x24 sheet. Shared
  // geometry (letters K outline, L light bevel, D shadow bevel, R corner
  // rivet); the three exported sprites differ only in the palette map.
  // =====================================================================
  var TL=['KKKKKKKK','KLLLLLLL','KL......','KL.R....','KL......','KL......','KL......','KL......'];
  var TR=['KKKKKKKK','LLLLLLDK','......DK','....R.DK','......DK','......DK','......DK','......DK'];
  var BL=['KL......','KL......','KL......','KL......','KL.R....','KL......','KDDDDDDD','KKKKKKKK'];
  var BR=['......DK','......DK','......DK','......DK','....R.DK','......DK','DDDDDDDK','KKKKKKKK'];
  var ET=['KKKKKKKK','LLLLLLLL','........','........','........','........','........','........'];
  var EB=['........','........','........','........','........','........','DDDDDDDD','KKKKKKKK'];
  var EL=['KL......','KL......','KL......','KL......','KL......','KL......','KL......','KL......'];
  var ER=['......DK','......DK','......DK','......DK','......DK','......DK','......DK','......DK'];
  var CC=['........','........','........','........','........','........','........','........'];
  function band(left,mid,right){var out=[],i;for(i=0;i<8;i++)out.push(left[i]+mid[i]+right[i]);return out;}
  var PANEL_ROWS=band(TL,ET,TR).concat(band(EL,CC,ER)).concat(band(BL,EB,BR));

  var PAL_NEUTRAL={K:'#05090c',L:'#3d5049',D:'#1c2622',R:'#5f766a'};
  var PAL_ALERT={K:'#05090c',L:'#6b332c',D:'#2a100f',R:'#c4544a'};
  var PAL_GOLD={K:'#05090c',L:'#5c4a26',D:'#2c2210',R:'#d9a83f'};

  // =====================================================================
  // icon_bullets 12x12: rifle round standing on its point. MAT.iron.
  // Copper ogive over a two-tone taper, a cannelure groove, a brass case.
  // =====================================================================
  function makeIconBullets(){
    var g=mkGrid(12,12);
    var K='K',O='O',W='W',R='R',Y='Y';
    setclip(g,5,0,K);setclip(g,6,0,K);
    setclip(g,4,1,K);setclip(g,5,1,O);setclip(g,6,1,O);setclip(g,7,1,K);
    setclip(g,3,2,K);rect(g,4,2,7,2,O);setclip(g,8,2,K);
    setclip(g,3,3,K);setclip(g,4,3,O);setclip(g,5,3,W);setclip(g,6,3,O);setclip(g,7,3,R);setclip(g,8,3,K);
    rect(g,3,4,8,4,K);
    setclip(g,3,5,K);rect(g,4,5,6,5,Y);setclip(g,7,5,R);setclip(g,8,5,K);
    setclip(g,3,6,K);setclip(g,4,6,W);setclip(g,5,6,Y);setclip(g,6,6,Y);setclip(g,7,6,R);setclip(g,8,6,K);
    setclip(g,3,7,K);rect(g,4,7,6,7,Y);setclip(g,7,7,R);setclip(g,8,7,K);
    setclip(g,3,8,K);rect(g,4,8,6,8,Y);setclip(g,7,8,R);setclip(g,8,8,K);
    setclip(g,3,9,K);rect(g,4,9,6,9,Y);setclip(g,7,9,R);setclip(g,8,9,K);
    setclip(g,3,10,K);rect(g,4,10,7,10,R);setclip(g,8,10,K);
    rect(g,3,11,8,11,K);
    return toRows(g);
  }

  // =====================================================================
  // icon_shells 12x12: stubby shotgun shell, red hull, flared brass rim.
  // MAT.loot.
  // =====================================================================
  function makeIconShells(){
    var g=mkGrid(12,12);
    var K='K',E='E',W='W',B='B',Y='Y',X='X';
    rect(g,4,0,7,0,K);
    setclip(g,3,1,K);rect(g,4,1,7,1,E);setclip(g,8,1,K);
    setclip(g,2,2,K);rect(g,3,2,8,2,E);setclip(g,5,2,W);setclip(g,9,2,K);
    setclip(g,2,3,K);rect(g,3,3,8,3,E);setclip(g,8,3,B);setclip(g,9,3,K);
    setclip(g,2,4,K);rect(g,3,4,8,4,E);setclip(g,9,4,K);
    setclip(g,2,5,K);rect(g,3,5,8,5,E);setclip(g,8,5,B);setclip(g,9,5,K);
    setclip(g,2,6,K);rect(g,3,6,8,6,E);setclip(g,9,6,K);
    rect(g,2,7,9,7,K);
    setclip(g,2,8,K);rect(g,3,8,8,8,Y);setclip(g,9,8,K);
    setclip(g,2,9,K);rect(g,3,9,8,9,Y);setclip(g,8,9,X);setclip(g,9,9,K);
    setclip(g,1,10,K);rect(g,2,10,9,10,Y);setclip(g,10,10,K);
    rect(g,1,11,10,11,K);
    return toRows(g);
  }

  // =====================================================================
  // icon_fuel 12x12: boxy jerry can, spout, handle notch, one seam.
  // MAT.loot.
  // =====================================================================
  function makeIconFuel(){
    var g=mkGrid(12,12);
    var K='K',D='D',O='O',SH='o',W='W';
    setclip(g,5,0,K);setclip(g,6,0,K);
    setclip(g,4,1,K);setclip(g,5,1,D);setclip(g,6,1,D);setclip(g,7,1,K);
    var x,y,lit;
    for(y=2;y<=11;y++)for(x=1;x<=10;x++){
      if(x===1||x===10||y===2||y===11)setclip(g,x,y,K);
      else{lit=(x-1)+(y-2)<9;setclip(g,x,y,lit?O:SH);}
    }
    setclip(g,1,2,'.');setclip(g,10,2,'.');setclip(g,1,11,'.');setclip(g,10,11,'.');
    setclip(g,9,3,'.');setclip(g,9,4,'.');
    rect(g,2,7,9,7,SH);
    setclip(g,3,4,W);
    return toRows(g);
  }

  // =====================================================================
  A.define('hud',{
    panel9:{rows:PANEL_ROWS,pal:PAL_NEUTRAL,anchor:'tile',note:'24x24, 3x3 8px cells, 9-slice; centre transparent, neutral steel bevel'},
    panel9Alert:{rows:PANEL_ROWS,pal:PAL_ALERT,anchor:'tile',note:'24x24, same geometry as panel9, red-edged bevel for danger/low health'},
    panel9Gold:{rows:PANEL_ROWS,pal:PAL_GOLD,anchor:'tile',note:'24x24, same geometry as panel9, amber bevel for objective/reward'},
    icon_bullets:{rows:makeIconBullets(),pal:'MAT.iron',anchor:'tile',note:'12x12, rifle round on its point, copper tip over a brass case'},
    icon_shells:{rows:makeIconShells(),pal:'MAT.loot',anchor:'tile',note:'12x12, stubby shotgun shell, red hull, flared brass rim'},
    icon_fuel:{rows:makeIconFuel(),pal:'MAT.loot',anchor:'tile',note:'12x12, boxy jerry can, spout, handle notch'}
  });
})();
