(function(root){
  'use strict';
  // Baked ground. The city is split into 256-unit chunks of 8x8 32-unit tiles;
  // each chunk is drawn once into an offscreen canvas from the `tiles` art
  // family (base variant by position hash, edge bitmasks between ground kinds,
  // lane paint on the avenue axes, crosswalks at crossings, a few decals from a
  // chunk-seeded RNG) and blitted with one drawImage per visible chunk. Only
  // things that never change are baked here; anything with hp, anything
  // animated and anything taller than a kerb draws per frame in render.js.
  var TILE=32,CHUNK=8,CHPX=TILE*CHUNK,LRU=64,BAKES_PER_FRAME=4;
  var cache=new Map(),bakes=0;
  var SURFACE={asphalt:'asphalt',concrete:'floorConcrete',gravel:'gravel',grass:'grass'};
  var LOT={checkpoint:'lotSouth',ruins:'lotRuins',hospital:'lotWard',northline:'lotNorth',industry:'lotAsh'};
  var FLAT={road:'#202d2d',curb:'#2a2a27',sidewalk:'#272522',quarantine:'#17191e'};

  function W(){return root.DSWorld;}
  function A(){return root.DSArt;}
  function ready(){return !!(A()&&A().spec('tiles/asphalt'));}
  function rng(seed){var n=(seed>>>0)||1;return function(){n=(n*1664525+1013904223)>>>0;return n/4294967296;};}
  // distance from a tile centre to the nearest avenue axis, per direction
  function axisDist(v){var best=1e9,ax=W().AXES,i;for(i=0;i<ax.length;i++){var d=Math.abs(v-ax[i]);if(d<best)best=d;}return best;}
  // the ground kind of the tile whose centre is (wx,wy)
  function groundKind(wx,wy,s){
    if(Math.abs(wx)<620&&Math.abs(wy)<620)return 'quarantine';
    var hs=s&&s.world&&s.world.buildings;
    if(hs)for(var i=0;i<hs.length;i++){var h=hs[i];if(wx>h.x&&wx<h.x+h.w&&wy>h.y&&wy<h.y+h.h){for(var j=0;j<h.rooms.length;j++){var q=h.rooms[j].rect;if(wx>=q.x&&wx<=q.x+q.w&&wy>=q.y&&wy<=q.y+q.h)return 'floor'+h.rooms[j].floor;}return 'floor'+(h.interior&&h.interior.floor||'Concrete');}}
    // open lots use their surface tile once the art exists (grass/gravel arrive with the lot art family)
    var ls=s&&s.world&&s.world.lots;
    if(ls)for(var li=0;li<ls.length;li++){var L=ls[li],q=L.rect;if(wx>q.x&&wx<q.x+q.w&&wy>q.y&&wy<q.y+q.h){var k=SURFACE[L.surface];if(k&&A().spec('tiles/'+k))return k;break;}}
    var d=Math.min(axisDist(wx),axisDist(wy));
    if(d<96)return 'road';
    if(d<128)return 'curb';
    if(d<160)return 'sidewalk';
    return LOT[W().district(wx,wy).id]||'lotSouth';
  }
  function isLot(k){return k.indexOf('lot')===0;}
  function tile(g,name,px,py,opt){var sp=A().sprite(name,opt);if(sp)g.drawImage(sp.canvas,px,py);}
  function bake(cx,cy,s){
    var c=document.createElement('canvas');c.width=c.height=CHPX;
    var g=c.getContext('2d'),r=rng((cx*50331653)^(cy*1000003)^17),hash=W().hash,tx,ty;
    g.imageSmoothingEnabled=false;
    var kinds=[],k;
    for(ty=-1;ty<=CHUNK;ty++)for(tx=-1;tx<=CHUNK;tx++)kinds[(ty+1)*(CHUNK+2)+tx+1]=groundKind(cx*CHPX+tx*TILE+16,cy*CHPX+ty*TILE+16,s);
    var kindAt=function(tx,ty){return kinds[(ty+1)*(CHUNK+2)+tx+1];};
    for(ty=0;ty<CHUNK;ty++)for(tx=0;tx<CHUNK;tx++){
      var wx=cx*CHPX+tx*TILE,wy=cy*CHPX+ty*TILE,px=tx*TILE,py=ty*TILE,h=hash(wx/TILE,wy/TILE),h2=hash(wy/TILE+7,wx/TILE+3);
      k=kindAt(tx,ty);
      var N=kindAt(tx,ty-1),E=kindAt(tx+1,ty),S=kindAt(tx,ty+1),Wd=kindAt(tx-1,ty);
      if(k==='road'){
        if(h2<.18)tile(g,'tiles/asphaltCrack',px,py,{variant:(h*2)|0});else tile(g,'tiles/asphalt',px,py,{variant:(h*3)|0});
        if(r()<.05)tile(g,'tiles/decalOil',px,py,{variant:(h*2)|0});
        else if(r()<.04)tile(g,'tiles/decalTyre',px,py,{variant:(h2*2)|0});
        else if(r()<.02)tile(g,'tiles/manhole',px,py);
        if((N==='curb'||S==='curb'||E==='curb'||Wd==='curb')&&r()<.05)tile(g,'tiles/drain',px,py);
      }else if(k==='curb'){
        var m=(N==='road'?1:0)|(E==='road'?2:0)|(S==='road'?4:0)|(Wd==='road'?8:0);
        tile(g,'tiles/curb',px,py,{mask:m});
      }else if(k==='sidewalk'){
        tile(g,'tiles/sidewalk',px,py,{variant:(h*3)|0});
        var me=(isLot(N)?1:0)|(isLot(E)?2:0)|(isLot(S)?4:0)|(isLot(Wd)?8:0);
        if(me)tile(g,'tiles/sidewalkEdge',px,py,{mask:me});
      }else if(k==='quarantine'){
        tile(g,'tiles/quarantinePlate',px,py,{variant:(h*3)|0});
        var mq=(N!=='quarantine'?1:0)|(E!=='quarantine'?2:0)|(S!=='quarantine'?4:0)|(Wd!=='quarantine'?8:0);
        if(mq)tile(g,'tiles/quarantineStripe',px,py,{mask:mq});
      }else if(k.indexOf('floor')===0){
        tile(g,'tiles/'+k,px,py,{variant:(h*2)|0});
      }else{
        tile(g,'tiles/'+k,px,py,{variant:(h*3)|0});
        if(k==='lotAsh'&&r()<.15)tile(g,'tiles/decalAsh',px,py,{variant:(h*2)|0});
        else if(r()<(k==='lotRuins'?.05:.02))tile(g,'tiles/decalBloodOld',px,py,{variant:(h2*2)|0});
      }
    }
    lanes(g,cx,cy);
    return c;
  }
  // lane paint sits exactly on the avenue axis (not tile aligned); crosswalks ring every crossing
  function lanes(g,cx,cy){
    var ax=W().AXES,x0=cx*CHPX,y0=cy*CHPX,i,j,z,a,b;
    var dash=A().sprite('tiles/laneDash'),dashV=A().sprite('tiles/laneDashV');
    for(i=0;i<ax.length;i++){
      a=ax[i];
      if(a>=x0-16&&a<x0+CHPX+16&&dashV)for(z=Math.floor(y0/40)*40;z<y0+CHPX;z+=40){if(!(Math.abs(a)<620&&Math.abs(z)<620)&&!nearCrossing(a,z))g.drawImage(dashV.canvas,a-16-x0,z-x0*0-y0);}
      if(a>=y0-16&&a<y0+CHPX+16&&dash)for(z=Math.floor(x0/40)*40;z<x0+CHPX;z+=40){if(!(Math.abs(z)<620&&Math.abs(a)<620)&&!nearCrossing(z,a))g.drawImage(dash.canvas,z-x0,a-16-y0);}
    }
    var cw=A().spec('tiles/crosswalk');if(!cw)return;
    for(i=0;i<ax.length;i++)for(j=0;j<ax.length;j++){
      a=ax[i];b=ax[j];if(Math.abs(a)<620&&Math.abs(b)<620)continue;
      // four crossings: across the vertical road (bars run N-S) north and south of the square, across the horizontal road east and west
      for(z=-3;z<3;z++){
        blitIf(g,'tiles/crosswalk',{variant:1},a+z*TILE,b-128,x0,y0);blitIf(g,'tiles/crosswalk',{variant:1},a+z*TILE,b+96,x0,y0);
        blitIf(g,'tiles/crosswalk',{variant:0},a-128,b+z*TILE,x0,y0);blitIf(g,'tiles/crosswalk',{variant:0},a+96,b+z*TILE,x0,y0);
      }
    }
  }
  function nearCrossing(x,y){return axisDist(x)<128&&axisDist(y)<128;}
  function blitIf(g,name,opt,wx,wy,x0,y0){if(wx+TILE<=x0||wx>=x0+CHPX||wy+TILE<=y0||wy>=y0+CHPX)return;tile(g,name,wx-x0,wy-y0,opt);}

  function chunkCanvas(cx,cy,s){
    var key=cx+','+cy,c=cache.get(key);
    if(c){cache.delete(key);cache.set(key,c);return c;}
    if(bakes>=BAKES_PER_FRAME)return null;
    bakes++;c=bake(cx,cy,s);cache.set(key,c);
    while(cache.size>LRU)cache.delete(cache.keys().next().value);
    return c;
  }
  function beginFrame(){bakes=0;}
  function clear(){cache.clear();}
  // the ground under the camera rect v ({x,y,w,h} centre + size)
  function drawGround(g,s,v){
    if(!ready()){W().drawGround(g,s,v);return;}
    var l=v.x-v.w/2,t=v.y-v.h/2,r=v.x+v.w/2,b=v.y+v.h/2,cx,cy;
    for(cy=Math.floor(t/CHPX);cy*CHPX<b;cy++)for(cx=Math.floor(l/CHPX);cx*CHPX<r;cx++){
      var c=chunkCanvas(cx,cy,s);
      if(c)g.drawImage(c,cx*CHPX,cy*CHPX);
      else{g.fillStyle=W().district(cx*CHPX+128,cy*CHPX+128).ground;g.fillRect(cx*CHPX,cy*CHPX,CHPX,CHPX);}
    }
  }
  root.DSChunks={TILE:TILE,CHUNK:CHUNK,CHPX:CHPX,chunkCanvas:chunkCanvas,groundKind:groundKind,beginFrame:beginFrame,clear:clear,drawGround:drawGround,ready:ready};
})(typeof window!=='undefined'?window:globalThis);
