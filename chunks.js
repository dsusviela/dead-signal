(function(root){
  'use strict';
  // Baked ground. The city is split into 256-unit chunks of 8x8 32-unit tiles;
  // each chunk is drawn once into an offscreen canvas from the `tiles` art
  // family and blitted with one drawImage per visible chunk. Only things that
  // never change are baked here; anything with hp, anything animated and
  // anything taller than a kerb draws per frame in render.js.
  //
  // Bake passes (all positions world-derived, so every pass continues across
  // chunk borders):
  //  1. base tiles. Outdoor surfaces (district fillers, grass, gravel, yard
  //     concrete) carry `macro:n` in their spec: the variant is the world tile
  //     position modulo n, so the texture is one continuous periodic sheet, and
  //     a transparent `<kind>Wear` layer with a different period sits on top.
  //     Roads, curbs, sidewalks, the quarantine plaza and floors keep their
  //     original hash-picked tiles and masks.
  //  2. filler FEATURE (64) and SPOT (32) decals (cracks, repairs, stains, ruts)
  //     at off-grid offsets, rolled for the tiles around the chunk too so a
  //     decal that straddles a chunk edge is drawn by both chunks.
  //  3. authored lot surfaces clipped to the exact lot rectangle (not the tile
  //     grid), with rim pieces (worn grass edge, spilled pebbles, slab arris,
  //     parking kerb) along each side and rounded corner pieces; lawns get gravel
  //     path strips along their 'paths' zones and soil aprons under planting beds.
  //  4. grit against sidewalks and the plaza; contact shadow, drip line and
  //     fallen grit at building feet (tiles/footing).
  // bakeChunk(cx,cy,s,kindFn,{bare:true}) hides loose dressing for base-surface reviews.
  //  5. lane paint and crosswalks.
  var TILE=32,CHUNK=8,CHPX=TILE*CHUNK,LRU=64,BAKES_PER_FRAME=4,M=2;
  var cache=new Map(),bakes=0;
  var SURFACE={asphalt:'yardAsphalt',concrete:'yardConcrete',gravel:'gravel',grass:'grass'};
  var LOT={checkpoint:'lotSouth',ruins:'lotRuins',hospital:'lotWard',northline:'lotNorth',industry:'lotAsh',quarantine:'lotQuarantine'};
  // rim family per lot surface: tiles/<rim>Edge side pieces and tiles/<rim>Corner corners
  var RIM={grass:'grass',gravel:'gravel',yardConcrete:'yard',yardAsphalt:'kerb'};
  // per-tile decal chances: SPOT 32x32 at a jittered offset, FEATURE 64x64 centred on the tile
  var SPOT_RATE={lotSouth:.08,lotRuins:.1,lotWard:.06,lotNorth:.06,lotAsh:.09,lotQuarantine:.05,grass:.05,gravel:.06,yardConcrete:.07,yardAsphalt:.07};
  var FEAT_RATE={lotSouth:.07,lotRuins:.08,lotWard:.06,lotNorth:.06,lotAsh:.08,lotQuarantine:.06,grass:.06,gravel:.07,yardConcrete:.08,yardAsphalt:.07},GRIME_ALPHA=.5,FOOT_ALPHA=.6;
  var FLAT={road:'#202d2d',curb:'#2a2a27',sidewalk:'#272522',quarantine:'#17191e'};

  function W(){return root.DSWorld;}
  function A(){return root.DSArt;}
  function ready(){return !!(A()&&A().spec('tiles/asphalt'));}
  function rng(seed){var n=(seed>>>0)||1;return function(){n=(n*1664525+1013904223)>>>0;return n/4294967296;};}
  function md(v,n){return((v%n)+n)%n;}
  // distance from a tile centre to the nearest avenue axis, per direction
  function axisDist(v){var best=1e9,ax=W().AXES,i;for(i=0;i<ax.length;i++){var d=Math.abs(v-ax[i]);if(d<best)best=d;}return best;}
  function surfaceKind(L){var k=SURFACE[L.surface];return k&&A().spec('tiles/'+k)?k:null;}
  // the ground kind of the tile whose centre is (wx,wy)
  function groundKind(wx,wy,s){
    if(Math.abs(wx)<620&&Math.abs(wy)<620)return 'quarantine';
    var hs=s&&s.world&&s.world.buildings;
    if(hs)for(var i=0;i<hs.length;i++){var h=hs[i];if(wx>h.x&&wx<h.x+h.w&&wy>h.y&&wy<h.y+h.h){for(var j=0;j<h.rooms.length;j++){var q=h.rooms[j].rect;if(wx>=q.x&&wx<=q.x+q.w&&wy>=q.y&&wy<=q.y+q.h)return 'floor'+h.rooms[j].floor;}return 'floor'+(h.interior&&h.interior.floor||'Concrete');}}
    // open lots use their surface tile once the art exists
    var ls=s&&s.world&&s.world.lots;
    if(ls)for(var li=0;li<ls.length;li++){var L=ls[li],q=L.rect;if(wx>q.x&&wx<q.x+q.w&&wy>q.y&&wy<q.y+q.h){var k=surfaceKind(L);if(k)return k;break;}}
    var d=Math.min(axisDist(wx),axisDist(wy));
    if(d<96)return 'road';
    if(d<128)return 'curb';
    if(d<160)return 'sidewalk';
    return fillerAt(wx,wy);
  }
  function fillerAt(wx,wy){return LOT[W().district(wx,wy).id]||'lotSouth';}
  function isLot(k){return k.indexOf('lot')===0;}
  function isSurface(k){return k==='grass'||k==='gravel'||k==='yardConcrete'||k==='yardAsphalt';}
  function tile(g,name,px,py,opt){var sp=A().sprite(name,opt);if(sp)g.drawImage(sp.canvas,px,py);}
  // macro variant for a world tile (spec.macro), else null
  // Each macro row is shifted along x by a per-row amount, so the 128/160-unit broad fields never line up into columns
  // (a whole-tile shift keeps the texture continuous along the row; slab grids shift by whole slabs to keep their joints)
  var GRIDSTEP={lotNorth:2,lotQuarantine:2,yardConcrete:2,lotNorthWear:2,lotQuarantineWear:2,yardConcreteWear:2};
  function macroVariant(name,TX,TY){var sp=A().spec(name);if(!sp||!sp.macro)return null;var n=sp.macro,row=Math.floor(TY/n),st=GRIDSTEP[name.slice(6)]||1,shift=st*Math.floor(W().hash(row*31+n,n*17)*n/st);return md(TX+shift,n)+n*md(TY,n);}
  // a surface tile and its wear layer at world tile (TX,TY), optionally clipped to the chunk-local rect c
  function surface(g,k,TX,TY,px,py,h,c){
    var name='tiles/'+k,v=macroVariant(name,TX,TY);
    blit(g,name,{variant:v==null?(h*3)|0:v},px,py,c);
    var wv=macroVariant(name+'Wear',TX,TY);if(wv!=null)blit(g,name+'Wear',{variant:wv},px,py,c);
  }
  // decals of surface k rolled for chunk-local tile (tx,ty): a FEATURE when the 3x3 tiles around share the
  // surface, else maybe a SPOT jittered only towards same-surface neighbours; clip c (chunk-local) optional.
  // Rolls use DSWorld.mix on world tile coordinates (hash() collapses on grid-aligned input).
  function decals(g,k,tx,ty,cx,cy,kindAt,c){
    var mix=W().mix,SX=cx*CHUNK+tx,SY=cy*CHUNK+ty,fs=A().spec('tiles/'+k+'Feature'),ss=A().spec('tiles/'+k+'Spot'),i,j,same=true,snap,ox,oy;
    for(j=-1;j<=1;j++)for(i=-1;i<=1;i++)if(kindAt(tx+i,ty+j)!==k)same=false;
    if(fs&&same&&mix(SX*5+71,SY*11+13)<(FEAT_RATE[k]||0)){
      snap=fs.snap||1;ox=Math.round((mix(SX+41,SY+43)-.5)*16/snap)*snap;oy=Math.round((mix(SX+47,SY+53)-.5)*16/snap)*snap;
      blit(g,'tiles/'+k+'Feature',{variant:(mix(SX+59,SY+61)*fs.variants.length)|0},tx*TILE-16+ox,ty*TILE-16+oy,c||{x0:-1e9,y0:-1e9,x1:1e9,y1:1e9});
      return;
    }
    if(!ss||mix(SX*7+3,SY*13+5)>=(SPOT_RATE[k]||0))return;
    snap=ss.snap||1;
    ox=Math.round((mix(SX+11,SY+19)-.5)*20/snap)*snap;oy=Math.round((mix(SX+23,SY+29)-.5)*20/snap)*snap;
    // off-grid only towards neighbours of the same surface, so spots never spill onto a sidewalk
    if(ox<0&&kindAt(tx-1,ty)!==k||ox>0&&kindAt(tx+1,ty)!==k)ox=0;
    if(oy<0&&kindAt(tx,ty-1)!==k||oy>0&&kindAt(tx,ty+1)!==k)oy=0;
    blit(g,'tiles/'+k+'Spot',{variant:(mix(SX+101,SY+37)*ss.variants.length)|0},tx*TILE+ox,ty*TILE+oy,c||{x0:-1e9,y0:-1e9,x1:1e9,y1:1e9});
  }
  // draw a tile-anchored sprite at (px,py), clipped to c={x0,y0,x1,y1} (chunk-local) when given
  function blit(g,name,opt,px,py,c){
    var sp=A().sprite(name,opt);if(!sp)return;
    if(!c){g.drawImage(sp.canvas,px,py);return;}
    var x0=Math.max(px,c.x0),y0=Math.max(py,c.y0),x1=Math.min(px+sp.w,c.x1),y1=Math.min(py+sp.h,c.y1);
    if(x1<=x0||y1<=y0)return;
    g.drawImage(sp.canvas,x0-px,y0-py,x1-x0,y1-y0,x0,y0,x1-x0,y1-y0);
  }
  function bake(cx,cy,s,kindFn,opt){
    kindFn=kindFn||groundKind;var bare=!!(opt&&opt.bare);
    var c=document.createElement('canvas');c.width=c.height=CHPX;
    var g=c.getContext('2d'),r=rng((cx*50331653)^(cy*1000003)^17),hash=W().hash,mix=W().mix,tx,ty,k,SPAN=CHUNK+2*M;
    g.imageSmoothingEnabled=false;
    var kinds=[];
    for(ty=-M;ty<CHUNK+M;ty++)for(tx=-M;tx<CHUNK+M;tx++)kinds[(ty+M)*SPAN+tx+M]=kindFn(cx*CHPX+tx*TILE+16,cy*CHPX+ty*TILE+16,s);
    var kindAt=function(tx,ty){return kinds[(ty+M)*SPAN+tx+M];};
    var outdoor=function(q){return isLot(q)||isSurface(q);};
    // 1. base tiles
    for(ty=0;ty<CHUNK;ty++)for(tx=0;tx<CHUNK;tx++){
      var wx=cx*CHPX+tx*TILE,wy=cy*CHPX+ty*TILE,px=tx*TILE,py=ty*TILE,TX=cx*CHUNK+tx,TY=cy*CHUNK+ty,h=hash(wx/TILE,wy/TILE),h2=hash(wy/TILE+7,wx/TILE+3);
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
        if(me){
          // the crumble fringe shows the neighbouring filler, continuing its texture
          var under=isLot(N)?N:isLot(E)?E:isLot(S)?S:Wd;
          if(A().spec('tiles/sidewalkEdgeCut')&&macroVariant('tiles/'+under,TX,TY)!=null){surface(g,under,TX,TY,px,py,h);tile(g,'tiles/sidewalkEdgeCut',px,py,{mask:me});}
          else tile(g,'tiles/sidewalkEdge',px,py,{mask:me});
        }
      }else if(k==='quarantine'){
        tile(g,'tiles/quarantinePlate',px,py,{variant:(h*3)|0});
        var mq=(N!=='quarantine'?1:0)|(E!=='quarantine'?2:0)|(S!=='quarantine'?4:0)|(Wd!=='quarantine'?8:0);
        if(mq)tile(g,'tiles/quarantineStripe',px,py,{mask:mq});
      }else if(k.indexOf('floor')===0){
        tile(g,'tiles/'+k,px,py,{variant:(h*2)|0});
      }else{
        // lot surfaces start as the district filler; pass 3 paints the exact lot rectangle over it
        // (the filler of a neighbouring tile when there is one, so the texture under a lot edge matches its surroundings)
        var base=k;
        if(isSurface(k)){base=isLot(N)?N:isLot(E)?E:isLot(S)?S:isLot(Wd)?Wd:fillerAt(wx+16,wy+16);}
        surface(g,base,TX,TY,px,py,h);
        // loose dressing (ash drifts, old blood); opt.bare hides it for base-surface reviews without changing the roll sequence
        if(base==='lotAsh'&&r()<.15){if(!bare)tile(g,'tiles/decalAsh',px,py,{variant:(h*2)|0});}
        else if(isLot(base)&&r()<(base==='lotRuins'?.05:.02)){if(!bare)tile(g,'tiles/decalBloodOld',px,py,{variant:(h2*2)|0});}
      }
    }
    // 2. filler spots, including those of the margin tiles that reach into this chunk
    for(ty=-1;ty<=CHUNK;ty++)for(tx=-1;tx<=CHUNK;tx++){k=kindAt(tx,ty);if(isLot(k))decals(g,k,tx,ty,cx,cy,kindAt);}
    // 3. lot surfaces on the exact rectangle, their rim and corners, park paths and bed aprons
    lots(g,cx,cy,s,kindAt,outdoor);
    // 4. grit against sidewalks and the plaza; contact shadow, drip line and fallen grit at building feet
    var ga=g.globalAlpha;
    for(ty=0;ty<CHUNK;ty++)for(tx=0;tx<CHUNK;tx++){
      k=kindAt(tx,ty);if(!outdoor(k))continue;
      var nb=[kindAt(tx,ty-1),kindAt(tx+1,ty),kindAt(tx,ty+1),kindAt(tx-1,ty)],mg=0,mf=0,b;
      for(b=0;b<4;b++){if(nb[b].indexOf('floor')===0)mf|=1<<b;else if(isLot(k)&&(nb[b]==='sidewalk'||nb[b]==='quarantine'))mg|=1<<b;}
      if(mg&&A().spec('tiles/grime')){g.globalAlpha=ga*GRIME_ALPHA;tile(g,'tiles/grime',tx*TILE,ty*TILE,{mask:mg});}
      if(mf&&A().spec('tiles/footing')){g.globalAlpha=ga*FOOT_ALPHA;tile(g,'tiles/footing',tx*TILE,ty*TILE,{mask:mf});}
    }
    g.globalAlpha=ga;
    lanes(g,cx,cy);
    return c;
  }
  // a tile-anchored piece at chunk-local (dx,dy) clipped to rect c and to the outdoor tiles under it,
  // so rims and paths never paint onto sidewalks, roads or floors
  function outdoorBlit(g,name,opt,dx,dy,c,kindAt,outdoor){
    var sp=A().sprite(name,opt);if(!sp)return;
    var x0=Math.max(c.x0,dx,0),y0=Math.max(c.y0,dy,0),x1=Math.min(c.x1,dx+sp.w,CHPX),y1=Math.min(c.y1,dy+sp.h,CHPX),tx,ty;
    if(x1<=x0||y1<=y0)return;
    for(ty=Math.floor(y0/TILE);ty*TILE<y1;ty++)for(tx=Math.floor(x0/TILE);tx*TILE<x1;tx++){
      if(!outdoor(kindAt(tx,ty)))continue;
      blit(g,name,opt,dx,dy,{x0:Math.max(x0,tx*TILE),y0:Math.max(y0,ty*TILE),x1:Math.min(x1,(tx+1)*TILE),y1:Math.min(y1,(ty+1)*TILE)});
    }
  }
  // authored lots: surface clipped to the lot rectangle over outdoor tiles only, then the rim, then paths and bed aprons
  function lots(g,cx,cy,s,kindAt,outdoor){
    var ls=s&&s.world&&s.world.lots;if(!ls)return;
    var x0=cx*CHPX,y0=cy*CHPX,hash=W().hash,i,tx,ty;
    for(i=0;i<ls.length;i++){
      var L=ls[i],q=L.rect,k=surfaceKind(L);if(!k)continue;
      var rimName=RIM[k]&&A().spec('tiles/'+RIM[k]+'Edge')?'tiles/'+RIM[k]+'Edge':null,OUT=rimName?A().spec(rimName).out||0:0;
      if(q.x-OUT>=x0+CHPX||q.x+q.w+OUT<=x0||q.y-OUT>=y0+CHPX||q.y+q.h+OUT<=y0)continue;
      var lx=q.x-x0,ly=q.y-y0,rect={x0:lx,y0:ly,x1:lx+q.w,y1:ly+q.h};
      for(ty=0;ty<CHUNK;ty++)for(tx=0;tx<CHUNK;tx++){
        if(!outdoor(kindAt(tx,ty)))continue;
        var px=tx*TILE,py=ty*TILE;if(px>=rect.x1||px+TILE<=rect.x0||py>=rect.y1||py+TILE<=rect.y0)continue;
        surface(g,k,cx*CHUNK+tx,cy*CHUNK+ty,px,py,hash((x0+px)/TILE,(y0+py)/TILE),rect);
      }
      for(ty=-1;ty<=CHUNK;ty++)for(tx=-1;tx<=CHUNK;tx++)if(kindAt(tx,ty)===k)decals(g,k,tx,ty,cx,cy,kindAt,rect);
      if(rimName)rim(g,L,rimName,OUT,lx,ly,kindAt,outdoor);
      parkWays(g,L,s,lx,ly,kindAt,outdoor);
    }
  }
  // Rim along the exact lot rectangle. A 32-unit corner piece sits on each corner (the lot corner OUT texels into it);
  // each side then runs from corner piece to corner piece: bumped rims lay forward pieces from the first corner and
  // backward pieces from the far corner in whole 64-unit runs (the width profile is zero at every 64), with plain
  // pieces clipped into the remainder between them.
  function rim(g,L,name,OUT,lx,ly,kindAt,outdoor){
    var q=L.rect,sp=A().spec(name),bumped=!!sp.bumped,corner=A().spec(name.replace(/Edge$/,'Corner'))?name.replace(/Edge$/,'Corner'):null;
    var CS=TILE-OUT,band={x0:lx-OUT,y0:ly-OUT,x1:lx+q.w+OUT,y1:ly+q.h+OUT},side,o,j;
    if(corner){
      var hx=Math.min(CS,q.w/2),hy=Math.min(CS,q.h/2);
      outdoorBlit(g,corner,{variant:0},lx-OUT,ly-OUT,{x0:band.x0,y0:band.y0,x1:lx+hx,y1:ly+hy},kindAt,outdoor);
      outdoorBlit(g,corner,{variant:1},lx+q.w-CS,ly-OUT,{x0:lx+q.w-hx,y0:band.y0,x1:band.x1,y1:ly+hy},kindAt,outdoor);
      outdoorBlit(g,corner,{variant:2},lx+q.w-CS,ly+q.h-CS,{x0:lx+q.w-hx,y0:ly+q.h-hy,x1:band.x1,y1:band.y1},kindAt,outdoor);
      outdoorBlit(g,corner,{variant:3},lx-OUT,ly+q.h-CS,{x0:band.x0,y0:ly+q.h-hy,x1:lx+hx,y1:band.y1},kindAt,outdoor);
    }
    for(side=0;side<4;side++){
      var horiz=side===0||side===2,len=horiz?q.w:q.h,span=len-2*CS;if(span<=0)continue;
      // chunk-local origin of along offset 0 for this side, and the across position of its pieces
      var put=function(a,variant,c0,c1){
        var dx=horiz?lx+a:(side===1?lx+q.w-CS:lx-OUT),dy=horiz?(side===2?ly+q.h-CS:ly-OUT):ly+a;
        var c=horiz?{x0:lx+c0,y0:band.y0,x1:lx+c1,y1:band.y1}:{x0:band.x0,y0:ly+c0,x1:band.x1,y1:ly+c1};
        outdoorBlit(g,name,{variant:variant},dx,dy,c,kindAt,outdoor);
      };
      if(!bumped){for(o=CS;o<len-CS;o+=TILE)put(o,side,CS,len-CS);continue;}
      var ph=(sp.variants.length/4-1)/2,run=Math.floor(span/2/64)*64,base=side*(2*ph+1);
      for(j=0;j<run;j+=TILE){put(CS+j,base+md(j/TILE,ph),CS,CS+run);put(len-CS-TILE-j,base+ph+md(j/TILE,ph),len-CS-run,len-CS);}
      for(o=CS+run;o<len-CS-run;o+=TILE)put(o,base+2*ph,CS+run,len-CS-run);
    }
  }
  // park paths: gravel strips (lots/pathStrip_h/_v) baked along each 'paths' prop zone from the lot edge to the
  // junction decal placed at the lot centre, so the per-frame pathCross/pathGravel never floats on the lawn;
  // soil aprons under planting beds. Skipped for a lot whose layout already places its own strips.
  var pathOwn=typeof WeakMap!=='undefined'?new WeakMap():null;
  function ownStrips(L,s){
    if(pathOwn&&pathOwn.has(L))return pathOwn.get(L);
    var ps=s.world.props||[],own=false,i;
    for(i=0;i<ps.length;i++)if(ps[i].lotId===L.id&&/^lots\/pathStrip/.test(ps[i].art)){own=true;break;}
    if(pathOwn)pathOwn.set(L,own);return own;
  }
  function parkWays(g,L,s,lx,ly,kindAt,outdoor){
    var zs=L.propZones;if(!zs||!zs.length)return;
    var q=L.rect,rect={x0:lx,y0:ly,x1:lx+q.w,y1:ly+q.h},i,z,o;
    var paths=zs.filter(function(z){return z.kind==='paths';}),beds=zs.filter(function(z){return z.kind==='planting';});
    if(beds.length&&A().spec('tiles/bedApron'))for(i=0;i<beds.length;i++){z=beds[i].rect;outdoorBlit(g,'tiles/bedApron',{},lx+Math.round(z.x+z.w/2)-q.x-32,ly+Math.round(z.y+z.h/2)-q.y-24,rect,kindAt,outdoor);}
    // lawns only: on a gravel lot a warm strip reads as lane paint
    if(!paths.length||L.surface!=='grass'||!A().spec('lots/pathStrip_h')||!s.world.props||ownStrips(L,s))return;
    var crossed=paths.length>1,hub=crossed?32:24;
    for(i=0;i<paths.length;i++){
      z=paths[i].rect;var vert=z.h>z.w,c=Math.round(vert?z.x+z.w/2:z.y+z.h/2),mid=Math.round(vert?q.y+q.h/2:q.x+q.w/2);
      var name=vert?'lots/pathStrip_v':'lots/pathStrip_h',start=vert?q.y:q.x,end=vert?q.y+q.h:q.x+q.w;
      // strips step outwards from the junction edge so they continue its arms exactly
      for(o=mid+hub;o<end;o+=TILE)stripAt(o);
      for(o=mid-hub-TILE;o+TILE>start;o-=TILE)stripAt(o);
    }
    function stripAt(o){
      var wx=vert?c-10:o,wy=vert?o:c-10;
      outdoorBlit(g,name,{variant:0},wx-q.x+lx,wy-q.y+ly,rect,kindAt,outdoor);
    }
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
  // tools: bake a chunk uncached, optionally with a substitute ground-kind function (wide material patches, join tests)
  function bakeChunk(cx,cy,s,kindFn,opt){return bake(cx,cy,s,kindFn,opt);}
  root.DSChunks={TILE:TILE,CHUNK:CHUNK,CHPX:CHPX,chunkCanvas:chunkCanvas,groundKind:groundKind,beginFrame:beginFrame,clear:clear,drawGround:drawGround,ready:ready,bakeChunk:bakeChunk};
})(typeof window!=='undefined'?window:globalThis);
