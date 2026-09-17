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
  function makeSidewalkEdgeMasks(cut){
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
        if(dirt){h=hash2(x,y,3);g[y][x]=cut?'.':h<0.3?'I':'J';}
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
  // 9. outdoor surfaces: district fillers, grass, gravel, yard concrete and asphalt
  // =====================================================================
  // Four layers per surface, all baked by chunks.js:
  //  - MACRO base (128x128 periodic, cut into 4x4 = 16 tile variants, picked by
  //    world tile position mod 4): the uniform material (grain, pebbles, blade
  //    tufts, joints) with tone carried by grain density.
  //  - WEAR (160x160, 5x5 = 25 variants, mod 5): transparent broad value fields
  //    (damp, oil-dark, bleached, dry straw) one ramp step off the body, 40-150
  //    units across with dithered soft edges. Base and wear coincide every 640 units.
  //  - SPOT (32x32) and FEATURE (64x64) decals: every distinctive mark (repairs,
  //    cracks, stains, ruts, bare soil) is a decal the bake places by world hash at
  //    off-grid offsets, so nothing memorable sits on a period.
  // Structural lines (slab joints, flag courses) are offset from the 32-unit tile
  // grid so no joint sits on a tile seam; their darkness varies per segment.
  var MP=128,WP=160,RAMP='KDEMLH';
  function ih(x,y,s){var n=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul((s|0)+1,-1640531535);n=Math.imul(n^(n>>>13),1274126177);n^=n>>>16;n=Math.imul(n^(n>>>15),-2048144789);n^=n>>>13;return(n>>>0)/4294967296;}
  function md(v,P){return((v%P)+P)%P;}
  function tex(P,fill){var g=[],y,x,r;for(y=0;y<P;y++){r=[];for(x=0;x<P;x++)r.push(fill);g.push(r);}return{P:P,g:g};}
  function tset(t,x,y,ch){t.g[md(y,t.P)][md(x,t.P)]=ch;}
  function tget(t,x,y){return t.g[md(y,t.P)][md(x,t.P)];}
  function up(ch,n){var i=RAMP.indexOf(ch);return i<0?ch:RAMP[Math.max(0,Math.min(5,i+n))];}
  // periodic value noise (period P, lattice cx by cy), octave sum, then rank-normalised to 0..1
  function vnoise(P,cx,cy,seed){
    var nx=Math.max(1,Math.round(P/cx)),ny=Math.max(1,Math.round(P/cy));cx=P/nx;cy=P/ny;
    return function(x,y){
      var fx=md(x,P)/cx,fy=md(y,P)/cy,ix=Math.floor(fx),iy=Math.floor(fy),u=fx-ix,v=fy-iy,a,b,c,d;
      u=u*u*(3-2*u);v=v*v*(3-2*v);
      a=ih(ix%nx,iy%ny,seed);b=ih((ix+1)%nx,iy%ny,seed);c=ih(ix%nx,(iy+1)%ny,seed);d=ih((ix+1)%nx,(iy+1)%ny,seed);
      return(a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v;
    };
  }
  function field(P,seed,oct){
    var fs=oct.map(function(o,i){return vnoise(P,o[0],o[2]||o[0],seed*7+i*131);}),vals=[],idx=[],rank=[],x,y,i,s;
    for(y=0;y<P;y++)for(x=0;x<P;x++){s=0;for(i=0;i<fs.length;i++)s+=fs[i](x,y)*oct[i][1];vals.push(s);idx.push(idx.length);}
    idx.sort(function(a,b){return vals[a]-vals[b];});
    for(i=0;i<idx.length;i++)rank[idx[i]]=i/(idx.length-1);
    return function(x,y){return rank[md(y,P)*P+md(x,P)];};
  }
  // 2-texel grain clusters (rule 11), accepted with probability ramping lo..hi along field f
  function sprinkle(t,rng,density,ch,on,f,lo,hi){
    var P=t.P,n=Math.round(P*P*density),i,x,y,p,c;
    for(i=0;i<n;i++){
      x=Math.floor(rng()*P);y=Math.floor(rng()*P);
      if(f){p=(f(x,y)-lo)/(hi-lo);if(rng()>p)continue;}
      if(on&&on.indexOf(tget(t,x,y))<0)continue;
      c=typeof ch==='function'?ch(tget(t,x,y)):ch;
      tset(t,x,y,c);if(rng()<.55)tset(t,x+1,y,c);else tset(t,x,y+1,c);
    }
  }
  function slices(t){
    var n=t.P/32,out=[],tx,ty,y,rows;
    for(ty=0;ty<n;ty++)for(tx=0;tx<n;tx++){rows=[];for(y=0;y<32;y++)rows.push(t.g[ty*32+y].slice(tx*32,tx*32+32).join(''));out.push(rows);}
    return out;
  }
  // a small stone: contact shadow offset down-right, body, one lit texel top-left (rule 28)
  function stone(t,x,y,w,h,body,lit,shadow){
    var i,j,corner;
    for(j=0;j<h;j++)for(i=0;i<w;i++){corner=w>2&&h>2&&(i===0||i===w-1)&&(j===0||j===h-1);if(!corner&&shadow&&(i===w-1||j===h-1))tset(t,x+i+1,y+j+1,shadow);}
    for(j=0;j<h;j++)for(i=0;i<w;i++){corner=w>2&&h>2&&(i===0||i===w-1)&&(j===0||j===h-1);if(!corner)tset(t,x+i,y+j,body);}
    if(lit&&w*h>=3)tset(t,x+(w>2&&h>2?1:0),y,lit);
  }
  function stoneSoft(t,x,y,w,h,lift){var b=tget(t,x,y);if(RAMP.indexOf(b)<0)b='E';stone(t,x,y,w,h,up(b,lift),null,up(b,-1));}
  function stoneOn(t,x,y,w,h,lift){var b=tget(t,x,y);if(RAMP.indexOf(b)<0)b='E';stone(t,x,y,w,h,up(b,lift),up(b,lift+1),up(b,-2));}
  // thin 8-connected crack wandering along a direction; ch may be a function(x,y)
  function crack(t,rng,x,y,len,dx,dy,ch,wob){
    var i;for(i=0;i<len;i++){tset(t,x,y,typeof ch==='function'?ch(x,y):ch);x+=dx;y+=dy;if(rng()<wob){if(dx&&!dy)y+=rng()<.5?1:-1;else if(dy&&!dx)x+=rng()<.5?1:-1;else if(rng()<.5)x-=dx;else y-=dy;}}
    return [x,y];
  }
  // irregular blob; edge>0 dithers a tapered rim that wide (rule 42: static tiles only)
  function blob(t,cx,cy,rx,ry,ch,seed,rough,edge,where){
    var x,y,dx,dy,rr,a,lim,p;
    for(y=-ry-4;y<=ry+4;y++)for(x=-rx-4;x<=rx+4;x++){
      dx=x/rx;dy=y/ry;rr=Math.sqrt(dx*dx+dy*dy);a=Math.atan2(dy,dx);
      lim=1+rough*(Math.sin(a*3+seed)*.5+Math.sin(a*5+seed*2.3)*.3+(edge?0:(ih(x,y,seed)-.5)*.4));
      if(edge){p=(lim-rr)/edge;if(p<=0)continue;if(p<1&&ih(cx+x,cy+y,seed+9)>p)continue;}else if(rr>lim)continue;
      if(where&&!where(cx+x,cy+y,tget(t,cx+x,cy+y)))continue;
      tset(t,cx+x,cy+y,typeof ch==='function'?ch(tget(t,cx+x,cy+y),cx+x,cy+y):ch);
    }
  }
  // crazing (alligator cracks): cell borders of jittered points inside a ragged disc
  function crazing(t,cx,cy,r,cell,ch,seed){
    var pts=[],i,j,x,y,k,d,d1,d2;
    for(j=-r-cell;j<=r+cell;j+=cell)for(i=-r-cell;i<=r+cell;i+=cell)pts.push([i+ih(i,j,seed)*cell*.8,j+ih(j,i,seed+1)*cell*.8]);
    for(y=-r;y<=r;y++)for(x=-r;x<=r;x++){
      if(x*x+y*y>r*r*(.55+.45*ih(x,y,seed+2)))continue;
      d1=1e9;d2=1e9;for(k=0;k<pts.length;k++){d=Math.sqrt((x-pts[k][0])*(x-pts[k][0])+(y-pts[k][1])*(y-pts[k][1]));if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}
      if(d2-d1<.9)tset(t,cx+x,cy+y,typeof ch==='function'?ch(cx+x,cy+y):ch);
    }
  }
  // a pair of soft wheel ruts: each a 5-texel depression, dithered rim, solid core, the odd deeper texel in the middle
  function ruts(t,x,y,len,gap,vertical,seed,rim,core,deep){
    var k,o,side;
    for(k=0;k<len;k++){
      var off=Math.round(Math.sin(k/19+seed)*1.5),fade=Math.min(1,Math.min(k,len-1-k)/18);
      for(side=0;side<2;side++)for(o=0;o<5;o++){
        var c=off+side*(gap+5)+o,px=vertical?x+c:x+k,py=vertical?y+k:y+c,h=ih(px,py,seed),p=(o===0||o===4?.2:.6)*fade;
        if(h>=p)continue;
        tset(t,px,py,o===0||o===4?rim:(o===2&&deep&&h<.18*fade?deep:core));
      }
    }
  }
  // a wandering crack with branches: most texels one step dark, about a quarter darkest, so it reads as a line not ink
  function crackNet(t,seed,dark,darkest){
    var r=mulberry32(seed),dirs=[[1,0],[1,1],[0,1],[1,-1]],d=dirs[Math.floor(r()*4)],len=34+Math.floor(r()*20),x,y,e,i,nb;
    var ch=function(px,py){return ih(px,py,seed)<.26?darkest:dark;};
    x=32-Math.round(d[0]*len/2);y=32-Math.round(d[1]*len/2);
    var pts=[];for(i=0;i<3;i++){e=crack(t,r,x,y,Math.round(len/3),d[0],d[1],ch,.3+r()*.2);pts.push([x,y]);x=e[0];y=e[1];}
    nb=Math.floor(r()*3);
    for(i=0;i<nb;i++){var p=pts[1+Math.floor(r()*2)],bd=dirs[Math.floor(r()*4)];if(bd===d)bd=[d[1],-d[0]||1];crack(t,r,p[0],p[1],8+Math.floor(r()*12),bd[0],bd[1]*(r()<.5?1:-1)||1,ch,.35);}
  }
  function rowsOf(t){return t.g.map(function(r){return r.join('');});}
  // identity, mirror x, mirror y, quarter turn: four reads of every decal so repeats are not recognised
  function turned(list){
    var out=[];
    list.forEach(function(rows){
      var n=rows.length;
      out.push(rows);
      out.push(rows.map(function(r){return r.split('').reverse().join('');}));
      out.push(rows.slice().reverse());
      out.push(rows.map(function(r,y){var s='',x;for(x=0;x<n;x++)s+=rows[x][n-1-y];return s;}));
    });
    return out;
  }
  function R6(h,extra){var p={K:h[0],D:h[1],E:h[2],M:h[3],L:h[4],H:h[5]};return extra?Object.assign(p,extra):p;}
  // hue-shifted ramps: npm run art:ramp -- --hue H --steps 6 --l 0.15,0.43 --chroma C --shift 10
  var SOIL={S:'#342f26',U:'#24211b'};                                          // --hue 60 --chroma 0.022
  var P_SOUTH=R6(['#090c0c','#141819','#202627','#2d3435','#3d4242','#4d5051'],{T:'#0e1112',S:SOIL.S,G:'#202816'}); // hue 210 c .009
  var P_RUINS=R6(['#0c0b0a','#191715','#27241f','#35312c','#433f3a','#524f4a'],{B:'#33241f',Z:'#4a3d36',R:'#3f2f29',S:SOIL.S}); // hue 70 c .008, brick hue 40 muted
  var P_WARD=R6(['#080c0c','#121918','#1d2725','#2b3532','#3b4340','#4d514f'],{S:SOIL.S,U:SOIL.U,G:'#202816'});      // hue 180 c .014
  var P_NORTH=R6(['#090b0e','#13181d','#1f252c','#2c333a','#3b4247','#4c5053'],{F:'#56606a'});              // hue 245 c .016; F frost
  var P_ASH=R6(['#09080a','#131113','#1d1a1b','#292526','#363233','#4a4848'],{A:'#5c5b58',R:'#221c1a'});   // near-black cinder, one step under rubble soil; A pale ash reads against it
  var P_QUAR=R6(['#0a0c0d','#161a1c','#22272a','#2f3437','#3d4245','#4c5154'],{T:'#0f1315',W:'#56574f'});   // neutral cool precast grey (was warm brown); W lime powder
  var P_GRASS=R6(['#0e130b','#1a2215','#262f1e','#313a27','#3f4832','#50573f'],{S:SOIL.S,U:SOIL.U,Y:'#3d3a28'}); // hue 125 c .03, one step up; Y straw
  var P_GRAVEL=R6(['#100f0d','#211f1b','#322f29','#423e37','#534e45','#666056'],{S:SOIL.S,G:'#202816'});   // hue 90 c .007: warm stone grey, never slate blue (reads as asphalt at night)
  var P_YARD=R6(['#0b0c0c','#181a1b','#252829','#323536','#404344','#4f5253'],{R:'#3a2620'});               // neutral concrete grey, one step under the sidewalk
  var P_YASPH=R6(['#0c1013','#1b2427','#273237','#313d42','#3b474b','#48575b'],{T:'#131a1d'});               // MAT.asphalt K/D/M with steps between

  // base material with density-carried tone: body letter, darker grain where f is low, lighter where high
  function grainBase(seed,body,dark,light,amount){
    var t=tex(MP,body),rng=mulberry32(seed),f=field(MP,seed,[[64,1],[32,.7],[16,.35]]),g=field(MP,seed+1,[[8,1],[4,.6]]);
    amount=amount||1;
    sprinkle(t,rng,.05*amount,dark,[body],function(x,y){return 1-f(x,y)*.7-g(x,y)*.3;},.25,1);
    sprinkle(t,rng,.022*amount,light,[body],function(x,y){return f(x,y)*.7+g(x,y)*.3;},.35,1);
    return {t:t,rng:rng};
  }
  // wear: broad value fields, dithered in 1-3 texel clumps. dark fills the lowest dLo of the field up to dMax
  // coverage, light the top (1-lHi) up to lMax; `skip(x,y)` keeps joints untouched
  function toneFields(seed,dark,light,o){
    o=o||{};
    var P=o.P||WP,t=tex(P,'.'),f=field(P,seed+P,[[P/2,1],[P/4,.55],[P/8,.25]]),g=field(P,seed+5,[[10,1],[5,.6]]),x,y,v,n,p;
    var dLo=o.dLo||.27,lHi=o.lHi||.8,dMax=(o.dMax==null?.7:o.dMax)*FIELD_SPLIT,lMax=(o.lMax==null?.25:o.lMax)*FIELD_SPLIT;
    for(y=0;y<P;y++)for(x=0;x<P;x++){
      if(o.skip&&o.skip(x,y))continue;
      v=f(x,y);n=ih(x,y,seed+3)*.75+g(x,y)*.25;
      if(dark&&v<dLo){p=Math.min(1,(dLo-v)/.16)*dMax;if(n<p)t.g[y][x]=dark;}
      else if(light&&v>lHi){p=Math.min(1,(v-lHi)/.14)*lMax;if(n<p)t.g[y][x]=light;}
    }
    return t;
  }
  // the base (period 128) and the wear layer (period 160) each carry half of the field strength with differently
  // shaped fields, so a recognisable dark or pale patch only forms where both agree and repeats every 640 units
  var FIELD_SPLIT=.55;
  function fielded(base,f){var x,y;for(y=0;y<base.P;y++)for(x=0;x<base.P;x++)if(f.g[y][x]!=='.')base.g[y][x]=f.g[y][x];return base;}
  // 64-unit slab joints offset (jx,jy): joint darkness varies per 6-texel segment (dark, mid, the odd filled gap),
  // the arris beside a joint breaks away in short chips, and a few slab corners are spalled
  function slabs(t,jx,jy,seed,o){
    var x,y,a,c,s,line,sn,chip;o=o||{};
    for(y=0;y<MP;y++)for(x=0;x<MP;x++){
      a=md(x-jx,64);c=md(y-jy,64);
      if(a===0||c===0){
        s=a===0?y:x;line=a===0?Math.floor((x-jx)/64)*2:Math.floor((y-jy)/64)*2+1;
        sn=ih(Math.floor(md(s,MP)/6),md(line,4),seed);
        t.g[y][x]=sn<(o.gapP||.1)?(o.gap||'E'):sn<(o.darkP||.55)?(ih(x,y,seed+1)<(o.kP==null?.2:o.kP)?'K':'D'):(o.mid||'E');
        continue;
      }
      if(o.overfill&&(a===1||c===1)){s=a===1?y:x;line=a===1?Math.floor((x-jx)/64):Math.floor((y-jy)/64)+7;if(ih(Math.floor(md(s,MP)/9),md(line,8),seed+2)<o.overfill&&ih(x,y,seed+3)<.75){t.g[y][x]='D';continue;}}
      if(a===1||c===1||a===63||c===63){
        s=(a===1||a===63)?y:x;line=(a===1||a===63)?a+Math.floor((x-jx+1)/64)*64:c+Math.floor((y-jy+1)/64)*64;
        chip=ih(Math.floor(md(s,MP)/4),md(line,MP),seed+4);
        if(chip<.14&&ih(x,y,seed+5)<.8)t.g[y][x]=chip<.05?'D':'E';
        else if(o.arris&&(a===1||c===1)&&chip>.5&&ih(x,y,seed+6)<o.arris)t.g[y][x]=o.arrisCh||'L';
      }
    }
    // spalled corners
    for(var i=0;i<2;i++)for(var j=0;j<2;j++){
      if(ih(i,j,seed+7)>(o.spall||.5))continue;
      var cx=jx+i*64,cy=jy+j*64,sx=ih(i,j,seed+8)<.5?1:-1,sy=ih(j,i,seed+9)<.5?1:-1;
      blob(t,cx+sx*2,cy+sy*2,2,2,function(ch){return ch==='D'||ch==='K'?ch:'E';},seed+i*3+j,.3,.6);
      tset(t,cx+sx,cy+sy,'D');
    }
  }

  // ---- South Blocks: faded rear-yard asphalt ----
  function surfSouth(){var b=grainBase(1701,'M','E','L');sprinkle(b.t,b.rng,.006,'D',['E']);return b.t;}
  function wearSouth(P){return toneFields(1711,'E','L',{P:P,dMax:.78,lMax:.3,dLo:.3});}
  function spotsSouth(){
    var a=tex(32,'.'),b=tex(32,'.'),c=tex(32,'.'),d=tex(32,'.'),x,y;
    // cut-and-fill repair: one step darker, a broken saw-cut line one step darker again, one chipped corner
    for(y=10;y<22;y++)for(x=8;x<25;x++){var ed=y===10||y===21||x===8||x===24;if(x>20&&y<13&&x-20>y-10)continue;a.g[y][x]=ed?(ih(x,y,30)<.7?'D':'E'):(ih(x,y,31)<.1?'D':ih(x,y,32)<.05?'M':'E');}
    // shallow worn depression: flat, soft edges, no rim
    blob(b,16,16,8,5,'E',3,.35,.9);blob(b,16,16,5,3,'D',5,.3,.7);
    // weeds up through a short crack
    crack(c,mulberry32(9),6,16,20,1,0,function(px,py){return ih(px,py,9)<.3?'T':'D';},.35);
    [[12,15],[12,14],[21,15],[21,16]].forEach(function(p){c.g[p[1]][p[0]]='G';});
    // dried oil drip under a parked car
    blob(d,16,16,6,4,'E',11,.4,.7);blob(d,17,16,3,2,'D',12,.3,.5);
    return [rowsOf(a),rowsOf(b),rowsOf(c),rowsOf(d)];
  }
  function featSouth(){
    var out=[],i;
    for(i=0;i<3;i++){var t=tex(64,'.');crackNet(t,1731+i*17,'D','T');out.push(rowsOf(t));}
    var b=tex(64,'.'),c=tex(64,'.'),d=tex(64,'.');
    // alligator cracking over a darker failing patch
    blob(b,32,32,17,11,'E',4,.35,.8);crazing(b,32,32,11,6,function(x,y){return ih(x,y,19)<.25?'T':'D';},17);
    // oil-soaked stall where a car stood for years
    blob(c,32,32,16,9,'E',6,.3,.8);blob(c,32,33,9,5,'D',7,.3,.7);
    // ravelled patch: surface worn through to loose aggregate
    blob(d,32,32,14,8,'E',8,.4,.8);blob(d,32,32,9,4,'D',9,.35,.6,function(x,y){return ih(x,y,23)<.5;});
    out.push(rowsOf(b),rowsOf(c),rowsOf(d));
    return out;
  }

  // ---- Old Quarter: compacted rubble soil, stones and brick fragments ----
  function surfRuins(){
    var b=grainBase(1801,'E','D','M',1.2),t=b.t,rng=b.rng,i,x,y;
    for(i=0;i<320;i++)stoneOn(t,Math.floor(rng()*MP),Math.floor(rng()*MP),rng()<.55?2:3,rng()<.6?1:2,1);
    for(i=0;i<40;i++){x=Math.floor(rng()*MP);y=Math.floor(rng()*MP);if(rng()<.5)stone(t,x,y,2,1,'Z','Z','B');else stone(t,x,y,1,2,'R','R','B');}
    return t;
  }
  function wearRuins(P){return toneFields(1811,'D','M',{P:P,dMax:.55,lMax:.3});}
  function spotsRuins(){
    var a=tex(32,'.'),b=tex(32,'.'),c=tex(32,'.'),rng=mulberry32(77),i,x,y,q;
    blob(a,16,20,8,3,'B',4,.3,.5);
    for(i=0;i<10;i++){x=9+Math.floor(rng()*12);y=10+Math.floor(rng()*10);if(rng()<.6)stone(a,x,y,3,2,'Z','Z','K');else stone(a,x,y,2,2,'R','Z','K');}
    stone(b,11,12,9,6,'M','L','K');for(q=12;q<19;q++)b.g[12][q]='L';b.g[16][13]='E';b.g[15][17]='E';
    blob(c,16,16,8,5,'D',8,.3,.8);blob(c,16,16,5,3,'K',9,.25,.8,function(x,y){return ih(x,y,10)<.45;});
    return [rowsOf(a),rowsOf(b),rowsOf(c)];
  }
  function featRuins(){
    var a=tex(64,'.'),b=tex(64,'.'),c=tex(64,'.'),d=tex(64,'.'),r=mulberry32(1821),i;
    ruts(a,2,24,60,5,false,3,'D','D','K');
    ruts(b,24,2,60,5,true,5,'D','D','K');
    for(i=0;i<34;i++){var ang=r()*6.28,rad=Math.sqrt(r())*20;stone(c,32+Math.round(Math.cos(ang)*rad*1.3),32+Math.round(Math.sin(ang)*rad*.8),r()<.5?2:3,r()<.5?1:2,r()<.4?'Z':'M',r()<.4?null:'L','K');}
    blob(d,32,32,18,10,'D',11,.35,.8);blob(d,32,32,12,5,'K',12,.3,.8,function(x,y){return ih(x,y,13)<.45;});
    return [rowsOf(a),rowsOf(b),rowsOf(c),rowsOf(d)];
  }

  // ---- Civic Ward: 32x32 precast concrete flagstones ----
  // square flags on a grid offset (5,3) from the tiles, period 32 so decals snap to 32 (spec.snap). Joints sit one
  // ramp step below the flags and fade out in places; per-flag tone comes from sparse grain; a few flags are cut in two.
  var PAV_X=5,PAV_Y=3;
  function paverSplit(i,j){return ih(md(i,4),md(j,4),1907)<.18;}
  function paverJoint(x,y){var ax=x-PAV_X,ay=y-PAV_Y;if(md(ay,32)===31||md(ax,32)===31)return true;return paverSplit(Math.floor(ax/32),Math.floor(ay/32))&&md(ax,32)===15;}
  function paverKey(x,y){var ax=x-PAV_X,ay=y-PAV_Y,i=Math.floor(ax/32),j=Math.floor(ay/32);return [paverSplit(i,j)?i*2+(md(ax,32)<16?0:1):i*2,j];}
  function notJoint(x,y){return !paverJoint(x,y);}
  function surfWard(){
    var t=tex(MP,'M'),x,y,k,h;
    for(y=0;y<MP;y++)for(x=0;x<MP;x++){
      if(paverJoint(x,y)){var js=ih(Math.floor(md(x,MP)/5),Math.floor(md(y,MP)/5),1903);t.g[y][x]=js<.15?'D':'E';continue;} // joints never stop mid-flag; filled stretches are only a step lighter
      k=paverKey(x,y);h=ih(md(k[0],8),md(k[1],4),1902);
      if(h<.3&&ih(x,y,1904)<.2)t.g[y][x]='E';
      else if(h>.85&&ih(x,y,1905)<.1)t.g[y][x]='L';
      else if(ih(x,y,1906)<.025)t.g[y][x]='E';
    }
    return t;
  }
  function wearWard(P){return toneFields(1911,'E','L',{P:P,dMax:.5,lMax:.12,skip:paverJoint});}
  function spotsWard(){
    var a=tex(32,'.'),b=tex(32,'.'),c=tex(32,'.'),d=tex(32,'.'),x,y,k0=paverKey(16,12),k1=paverKey(16,20),q;var sunk=function(px,py){return paverJoint(px,py)?'D':(ih(px,py,6)<.55?'E':'.');};
    // sunken flag: one unit a step darker, its joints open
    for(y=0;y<32;y++)for(x=0;x<32;x++){q=paverKey(x,y);if(q[0]===k0[0]&&q[1]===k0[1]){var ch=sunk(x,y);if(ch!=='.'&&(ch==='D'||ih(x,y,31)<.45))a.g[y][x]=ch;}}
    // grey mortar repair smeared thin over two flags: flat powder, no rim
    blob(b,16,16,9,5,'L',13,.2,.9,function(px,py){return ih(px,py,14)<.55;});
    // cracked flag
    crack(c,mulberry32(19),5,14,20,1,0,'D',.25);
    // sunken pair
    for(y=0;y<32;y++)for(x=0;x<32;x++){q=paverKey(x,y);if(q[1]===k1[1]&&Math.abs(q[0]-k1[0])<=1&&(paverJoint(x,y)||ih(x,y,7)<.3))d.g[y][x]=paverJoint(x,y)?'D':'E';}
    return [rowsOf(a),rowsOf(b),rowsOf(c),rowsOf(d)];
  }
  function featWard(){
    var a=tex(64,'.'),b=tex(64,'.'),c=tex(64,'.'),d=tex(64,'.'),r=mulberry32(1921);
    // settled area: flags a step darker, joints opened
    blob(a,32,32,20,13,function(ch,x,y){return paverJoint(x,y)?'D':'E';},14,.3,.8);
    // moss and dirt taking the joints
    blob(b,32,32,22,14,function(ch,x,y){return ih(x,y,15)<.45?'G':'D';},16,.35,.7,function(x,y){return paverJoint(x,y);});
    // cracked units
    crack(c,r,12,26,30,1,0,'D',.2);crack(c,r,44,10,22,0,1,'D',.3);
    // grit and salt left from winter gritting, pale specks on the tops
    blob(d,32,32,20,12,'L',17,.35,.9,function(x,y){return notJoint(x,y)&&ih(x,y,18)<.22;});
    return [rowsOf(a),rowsOf(b),rowsOf(c),rowsOf(d)];
  }

  // ---- Northline: 64-unit poured concrete slabs, saw-cut joints, frost in joints ----
  var NS_X=20,NS_Y=44;
  function northJoint(x,y){return md(x-NS_X,64)===0||md(y-NS_Y,64)===0;}
  function surfNorth(){
    var b=grainBase(2001,'M','E','M',.8),t=b.t,x,y,f=field(MP,42,[[32,1],[16,.6],[8,.3]]),dj;
    slabs(t,NS_X,NS_Y,2002,{mid:'E',gap:'M',gapP:.1,darkP:.5,kP:.12});
    for(y=0;y<MP;y++)for(x=0;x<MP;x++){
      if(northJoint(x,y))continue;
      dj=Math.min(md(y-NS_Y,64),md(x-NS_X,64));
      if(dj<=2&&f(x,y)>.65&&ih(x,y,44)<(.45-dj*.18))t.g[y][x]=dj===1?'F':'L';
    }
    return t;
  }
  function wearNorth(P){return toneFields(2011,'E','F',{P:P,dMax:.55,lMax:.12,skip:northJoint});}
  function spotsNorth(){
    var a=tex(32,'.'),b=tex(32,'.'),c=tex(32,'.');
    blob(a,16,16,9,3,'L',21,.4,.8,function(x,y){return ih(x,y,20)<.6;});blob(a,15,16,6,2,'F',22,.4,.6,function(x,y){return ih(x,y,19)<.5;});
    blob(b,16,16,6,5,'E',23,.45,.6);blob(b,16,17,4,3,'D',24,.4,.5);
    blob(c,16,17,7,3,'E',25,.35,.6);[[11,16],[14,15],[18,17],[21,16],[16,18]].forEach(function(p){stone(c,p[0],p[1],2,1,'L',null,'D');});
    return [rowsOf(a),rowsOf(b),rowsOf(c)];
  }
  function featNorth(){
    var out=[],i;
    for(i=0;i<2;i++){var t=tex(64,'.');crackNet(t,2031+i*23,'D','K');out.push(rowsOf(t));}
    var b=tex(64,'.'),c=tex(64,'.');
    blob(b,32,32,22,9,'F',26,.4,.8,function(x,y){return ih(x,y,27)<.45;});blob(b,30,33,12,4,'L',28,.3,.7,function(x,y){return ih(x,y,29)<.6;});
    blob(c,32,32,16,11,'E',29,.35,.7);
    out.push(rowsOf(b),rowsOf(c));
    return out;
  }

  // ---- Ashworks: cinder and slag yard ----
  function surfAsh(){
    var b=grainBase(2101,'E','D','M',1.6),t=b.t,rng=b.rng,i;
    sprinkle(t,rng,.02,'K',['D']);
    for(i=0;i<150;i++)stoneOn(t,Math.floor(rng()*MP),Math.floor(rng()*MP),2,2,1);
    return t;
  }
  function wearAsh(P){
    var t=toneFields(2111,'D',null,{P:P,dMax:.6}),a=toneFields(2112,null,'A',{P:P,lHi:.84,lMax:.3}),x,y;
    for(y=0;y<t.P;y++)for(x=0;x<t.P;x++)if(a.g[y][x]!=='.')t.g[y][x]=a.g[y][x];
    return t;
  }
  function spotsAsh(){
    var a=tex(32,'.'),b=tex(32,'.'),c=tex(32,'.'),x,y,rng=mulberry32(88),i;
    // steel trench plate bedded in the cinder: one step lighter, worn, no lit rim, D shadow side and bolts
    for(y=10;y<22;y++)for(x=7;x<25;x++)a.g[y][x]=(y===21||x===24)?'D':(y===10||x===7)?'E':(ih(x,y,87)<.14?'E':'M');
    a.g[12][9]='D';a.g[12][22]='D';a.g[19][9]='D';a.g[19][22]='D';
    blob(b,16,17,8,5,'D',31,.35,.6);for(i=0;i<12;i++)stone(b,9+Math.floor(rng()*13),12+Math.floor(rng()*8),2,rng()<.5?1:2,'M',null,'K');
    // burn scar: charcoal-brown halo, black centre
    blob(c,16,16,7,4,'R',33,.45,.7);blob(c,17,16,4,2,'K',34,.3,.5);
    return [rowsOf(a),rowsOf(b),rowsOf(c)];
  }
  function featAsh(){
    var a=tex(64,'.'),b=tex(64,'.'),c=tex(64,'.'),d=tex(64,'.'),r=mulberry32(2121),i;
    ruts(a,2,22,60,7,false,6,'D','D','K');
    blob(b,32,32,26,6,'A',35,.35,.9,function(x,y){return ih(x,y,36)<.45;});blob(b,30,32,14,3,'M',37,.3,.7,function(x,y){return ih(x,y,38)<.5;});
    blob(c,32,32,15,10,'R',39,.4,.8);blob(c,33,32,8,5,'K',40,.3,.6);
    for(i=0;i<26;i++){var ang=r()*6.28,rad=Math.sqrt(r())*18;stone(d,32+Math.round(Math.cos(ang)*rad*1.3),32+Math.round(Math.sin(ang)*rad*.8),2,r()<.5?1:2,r()<.6?'M':'L',null,'K');}
    return [rowsOf(a),rowsOf(b),rowsOf(c),rowsOf(d)];
  }

  // ---- Central Quarantine: requisitioned precast concrete apron ----
  // 64-unit panels, 1-texel tar joints with gaps and sealant overfill, spalled corners;
  // two lifting anchors per panel, shifted per panel and missing on some
  var QS_X=40,QS_Y=12;
  function quarJoint(x,y){return md(x-QS_X,64)===0||md(y-QS_Y,64)===0;}
  function surfQuar(){
    var b=grainBase(2201,'M','E','L',.8),t=b.t,i,j;
    slabs(t,QS_X,QS_Y,2202,{mid:'E',gap:'M',gapP:.16,darkP:.42,kP:0,overfill:.2,spall:.7});
    for(i=0;i<2;i++)for(j=0;j<2;j++)[[18,20],[44,44]].forEach(function(p,n){
      var h=ih(i*2+n,j,2203);if(h<.2)return;
      var ax=QS_X+i*64+p[0]+Math.round((ih(i,j+n,2204)-.5)*10),ay=QS_Y+j*64+p[1]+Math.round((ih(j,i+n,2205)-.5)*10);
      tset(t,ax,ay,'D');tset(t,ax+1,ay,'D');tset(t,ax,ay+1,'E');tset(t,ax+1,ay+1,'E');
    });
    return t;
  }
  function wearQuar(P){return toneFields(2211,'E','L',{P:P,dMax:.6,lMax:.15,skip:quarJoint});}
  function spotsQuar(){
    var a=tex(32,'.'),b=tex(32,'.'),c=tex(32,'.'),x,y,d;
    // lime powder spill: flat, thin, even dithered edge
    blob(a,16,16,8,5,'L',41,.15,.9,function(px,py){return ih(px,py,40)<.6;});blob(a,15,16,4,2,'W',42,.15,.8,function(px,py){return ih(px,py,39)<.45;});
    // tie-down ring set in the slab
    for(y=0;y<32;y++)for(x=0;x<32;x++){d=Math.sqrt((x-15.5)*(x-15.5)+(y-15.5)*(y-15.5));if(d<=3.6&&d>2.2)b.g[y][x]=(y<15?'E':'L');else if(d<=1.2)b.g[y][x]='D';}
    // pallet footprint: a paler clean rectangle where a load stood, broken outline
    for(y=10;y<22;y++)for(x=7;x<25;x++)if(ih(x,y,43)<.7)c.g[y][x]=(y===10||y===21||x===7||x===24)?'E':(ih(x,y,44)<.1?'L':'.');
    return [rowsOf(a),rowsOf(b),rowsOf(c)];
  }
  function featQuar(){
    var a=tex(64,'.'),b=tex(64,'.'),c=tex(64,'.'),d=tex(64,'.');
    ruts(a,2,18,60,14,false,44,'E','E',null);
    ruts(b,18,2,60,14,true,45,'E','E',null);
    blob(c,32,32,18,10,'L',46,.2,.9,function(x,y){return ih(x,y,45)<.5;});blob(c,31,32,9,5,'W',47,.2,.8,function(x,y){return ih(x,y,48)<.4;});
    blob(d,32,32,17,11,'E',48,.4,.9);blob(d,33,31,9,5,'D',49,.35,.9,function(x,y){return ih(x,y,50)<.55;});
    return [rowsOf(a),rowsOf(b),rowsOf(c),rowsOf(d)];
  }

  // ---- grass: maintained late-winter lawn ----
  // blade tufts (2-3 texels, upright or leaning) whose density follows a broad field, so lighter and darker patches
  // are made of blades; dark D gaps between clumps where the turf is thin
  var TUFTS=[[[0,0],[0,-1]],[[0,0],[1,-1]],[[0,0],[-1,-1]],[[0,0],[0,-1],[1,-2]],[[0,0],[-1,-1],[1,-1]],[[0,0],[0,-1],[-1,-2]]];
  function tuft(t,rng,x,y,ch,tip){var s=TUFTS[Math.floor(rng()*TUFTS.length)],i;for(i=0;i<s.length;i++)tset(t,x+s[i][0],y+s[i][1],i===s.length-1&&tip?tip:ch);return s;}
  function surfGrass(){
    var t=tex(MP,'E'),rng=mulberry32(2301),f=field(MP,71,[[64,1],[32,.7],[16,.35]]),g=field(MP,75,[[12,1],[6,.5]]),i,x,y,v;
    for(i=0;i<Math.round(MP*MP*.1);i++){
      x=Math.floor(rng()*MP);y=Math.floor(rng()*MP);v=f(x,y)*.7+g(x,y)*.3;
      if(v<.42){if(rng()<(.42-v)*2.2){tset(t,x,y,'D');if(rng()<.5)tset(t,x+1,y,'D');}continue;}
      if(rng()>.2+v*.7)continue;
      var s=tuft(t,rng,x,y,'M',v>.62&&rng()<(v-.62)*1.8?'L':null);
      if(rng()<.35)tset(t,x+1,y+1,'D');
    }
    return t;
  }
  function wearGrass(){
    var t=tex(WP,'.'),rng=mulberry32(2311),f=field(WP,72,[[80,1],[40,.55],[20,.25]]),i,x,y,v;
    for(i=0;i<Math.round(WP*WP*.07);i++){
      x=Math.floor(rng()*WP);y=Math.floor(rng()*WP);v=f(x,y);
      // dry, straw-tipped zones in the high field; damp, dark thin turf in the low field
      if(v>.66&&rng()<(v-.66)*2.2)tuft(t,rng,x,y,rng()<.5?'Y':'M',rng()<.5?'Y':null);
      else if(v<.28&&rng()<(.28-v)*2.6){tset(t,x,y,'D');if(rng()<.6)tset(t,x,y-1,'D');}
    }
    return t;
  }
  // bare soil with a solid core and a ragged edge that blades overhang
  function soilPatch(t,cx,cy,rx,ry,seed){
    blob(t,cx,cy,rx+2,ry+1,function(){return ih(cx,cy,seed)<.5?'Y':'S';},seed+1,.4,1.1,function(x,y){return ih(x,y,seed+2)<.5;});
    blob(t,cx,cy,rx,ry,'S',seed,.45,0);
    blob(t,cx+1,cy,Math.max(1,rx-3),Math.max(1,ry-2),function(ch,x,y){return ih(x,y,seed+3)<.25?'U':'S';},seed+4,.4,0);
    var r=mulberry32(seed),i,a;
    for(i=0;i<7;i++){a=r()*6.28;var x=Math.round(cx+Math.cos(a)*rx*.95),y=Math.round(cy+Math.sin(a)*ry*.95)+1;tuft(t,r,x,y,'M',r()<.3?'L':null);}
  }
  function spotsGrass(){
    var a=tex(32,'.'),b=tex(32,'.'),c=tex(32,'.');
    soilPatch(a,16,16,9,6,51);
    soilPatch(b,16,17,6,4,54);
    // leaf litter caught in the turf
    var r=mulberry32(55),i;for(i=0;i<9;i++){var x=9+Math.floor(r()*14),y=10+Math.floor(r()*12);c.g[y][x]='Y';if(r()<.5)c.g[y][x+1]='S';}
    return [rowsOf(a),rowsOf(b),rowsOf(c)];
  }
  function featGrass(){
    var a=tex(64,'.'),b=tex(64,'.'),c=tex(64,'.'),d=tex(64,'.'),r=mulberry32(2321),k,o;
    // trampled patch: straw-worn turf around a bare core
    blob(a,32,32,20,10,'Y',60,.35,1,function(x,y){return ih(x,y,61)<.45;});soilPatch(a,33,32,9,4,62);
    // desire line: a narrow trodden soil strip cutting across the lawn
    for(k=4;k<60;k++){var cy=30+Math.round(Math.sin(k/11)*3),fade=Math.min(1,Math.min(k-4,59-k)/6);for(o=-3;o<=3;o++){var h=ih(k,cy+o,63),ao=Math.abs(o);if(ao<=1&&h<.9*fade)tset(b,k,cy+o,h<.15?'U':'S');else if(ao<=3&&h<(ao===2?.5:.2)*fade)tset(b,k,cy+o,'Y');}}
    // damp hollow
    blob(c,32,32,16,10,'D',65,.35,.8);
    // leaves blown into a drift
    for(k=0;k<26;k++){var ang=r()*6.28,rad=Math.sqrt(r())*18,lx=32+Math.round(Math.cos(ang)*rad*1.2),ly=32+Math.round(Math.sin(ang)*rad*.8);tset(d,lx,ly,'Y');if(r()<.5)tset(d,lx+1,ly,'S');}
    return [rowsOf(a),rowsOf(b),rowsOf(c),rowsOf(d)];
  }

  // ---- gravel: dense low-contrast pebbles over compacted fines ----
  function surfGravel(){
    var b=grainBase(2401,'E','D','M',.6),t=b.t,rng=b.rng,i,r;
    for(i=0;i<Math.round(MP*MP/14);i++){r=rng();(rng()<.3?stoneOn:stoneSoft)(t,Math.floor(rng()*MP),Math.floor(rng()*MP),r<.5?2:r<.8?1:3,r<.5?1:2,1);}
    return t;
  }
  function wearGravel(P){return toneFields(2411,'D','M',{P:P,dMax:.5,lMax:.3});}
  function spotsGravel(){
    var a=tex(32,'.'),b=tex(32,'.'),c=tex(32,'.'),rng=mulberry32(99),i;
    for(i=0;i<9;i++)stone(a,10+Math.floor(rng()*12),11+Math.floor(rng()*9),3,2,'M','L','K');
    blob(b,16,17,4,2,'S',61,.3,0);[[14,15],[14,14],[15,13],[17,15],[18,14],[18,13],[16,16]].forEach(function(p){b.g[p[1]][p[0]]='G';});
    blob(c,16,16,8,4,'E',62,.35,.7);blob(c,16,16,5,2,'D',63,.3,.6);
    return [rowsOf(a),rowsOf(b),rowsOf(c)];
  }
  function featGravel(){
    var a=tex(64,'.'),b=tex(64,'.'),c=tex(64,'.'),d=tex(64,'.');
    ruts(a,2,22,60,7,false,71,'D','D',null);
    ruts(b,22,2,60,7,true,72,'D','D',null);
    blob(c,32,32,16,9,'S',73,.4,.8,function(x,y){return ih(x,y,74)<.6;});[[26,30],[27,29],[38,33],[39,32],[33,27]].forEach(function(p){c.g[p[1]][p[0]]='G';c.g[p[1]-1][p[0]]='G';});
    blob(d,32,32,17,9,'E',75,.35,.8);blob(d,32,32,11,5,'D',76,.3,.6);
    return [rowsOf(a),rowsOf(b),rowsOf(c),rowsOf(d)];
  }

  // ---- service-yard concrete: 64-unit slabs, saw joints ----
  var YS_X=28,YS_Y=52;
  function yardJoint(x,y){return md(x-YS_X,64)===0||md(y-YS_Y,64)===0;}
  function surfYard(){
    var b=grainBase(2501,'M','E','L'),t=b.t;
    slabs(t,YS_X,YS_Y,2502,{mid:'E',gap:'M',gapP:.12,darkP:.5,kP:.12,arris:.35,arrisCh:'L'});
    return t;
  }
  function wearYard(P){return toneFields(2511,'E','L',{P:P,dMax:.6,lMax:.2,skip:yardJoint});}
  function spotsYard(){
    var a=tex(32,'.'),b=tex(32,'.'),c=tex(32,'.'),x,y;
    blob(a,16,16,8,5,'E',71,.4,.7);blob(a,16,16,5,3,'D',72,.35,.5);
    // newer infill patch: paler fresh concrete behind a sealed edge line
    for(y=9;y<23;y++)for(x=8;x<24;x++){var edge=y===9||y===22||x===8||x===23;if(edge)b.g[y][x]=ih(x,y,76)<.75?'E':'.';else b.g[y][x]=ih(x,y,73)<.4?'L':'M';}
    blob(c,16,16,6,3,'R',74,.45,.6);blob(c,15,16,3,1,'E',75,.3,0);
    return [rowsOf(a),rowsOf(b),rowsOf(c)];
  }
  function featYard(){
    var out=[],b=tex(64,'.'),c=tex(64,'.'),d=tex(64,'.'),e=tex(64,'.'),k;
    blob(b,32,32,18,11,'E',81,.35,.7);blob(b,31,33,10,6,'D',82,.3,.6);
    crackNet(c,2531,'D','K');
    // pallet-jack drip line: a faint chain of small dark oil spots
    for(k=0;k<7;k++)blob(d,10+k*7,30+Math.round(Math.sin(k)*3),2,1,'E',85+k,.3,.6);
    // tyre scuff: a straight soft smear where a loader turned on the spot
    for(k=8;k<56;k++)for(var o=0;o<4;o++)if(ih(k,o,88)<(o===0||o===3?.3:.7)*Math.min(1,Math.min(k-8,55-k)/6))tset(e,k,26+o+Math.round(k/20),'E');
    out.push(rowsOf(b),rowsOf(c),rowsOf(d),rowsOf(e));
    return out;
  }

  // ---- yard asphalt: parking and service-lot blacktop (road value, lotSouth-style aggregate) ----
  function surfYardAsphalt(){var b=grainBase(2601,'E','D','M',.9);sprinkle(b.t,b.rng,.004,'L',['M']);sprinkle(b.t,b.rng,.004,'T',['D']);return b.t;}
  function wearYardAsphalt(P){return toneFields(2611,'D','M',{P:P,dMax:.6,lMax:.3});}
  function spotsYardAsphalt(){
    var a=tex(32,'.'),b=tex(32,'.'),c=tex(32,'.'),d=tex(32,'.'),x,y;
    // cut-and-fill repair: a step darker with a broken edge line
    for(y=9;y<23;y++)for(x=7;x<25;x++){var ed=y===9||y===22||x===7||x===24;a.g[y][x]=ed?(ih(x,y,90)<.65?'T':'D'):(ih(x,y,91)<.08?'E':'D');}
    // oil stain under a parked car
    blob(b,16,16,7,4,'D',92,.4,.8);blob(b,16,16,3,2,'T',93,.3,.5);
    // short crack
    crack(c,mulberry32(94),6,14,20,1,0,function(px,py){return ih(px,py,95)<.3?'T':'D';},.35);
    // shallow worn depression holding grit
    blob(d,16,16,8,5,'D',96,.35,.9);[[12,15],[18,17],[15,18]].forEach(function(p){d.g[p[1]][p[0]]='M';});
    return [rowsOf(a),rowsOf(b),rowsOf(c),rowsOf(d)];
  }
  function featYardAsphalt(){
    var out=[],i;
    for(i=0;i<3;i++){var t=tex(64,'.');crackNet(t,2631+i*29,'D','T');out.push(rowsOf(t));}
    var b=tex(64,'.'),c=tex(64,'.');
    blob(b,32,32,16,10,'D',97,.35,.8);crazing(b,32,32,10,6,function(x,y){return ih(x,y,98)<.3?'K':'T';},99);
    blob(c,32,32,15,8,'D',100,.3,.8);blob(c,32,33,8,4,'T',101,.3,.6);
    out.push(rowsOf(b),rowsOf(c));
    return out;
  }

  // ---- joins ----
  // periodic 1D wobble along an edge (period 32) so bands tile end to end
  function wob(a,s){var p=Math.PI*2/32;return .5+.3*Math.sin(a*p+s)+.2*Math.sin(a*p*3+s*1.7);}
  function edgeMask(fn){
    var out=[],m,g,x,y;
    for(m=0;m<16;m++){
      g=mkGrid('.');
      for(y=0;y<32;y++)for(x=0;x<32;x++)[1,2,4,8].forEach(function(bit){
        if(!(m&bit)||g[y][x]!=='.')return;
        var ch=fn(edgeDist(x,y,bit),edgeAlong(x,y,bit),x,y,bit);if(ch)g[y][x]=ch;
      });
      out.push(toRows(g));
    }
    return out;
  }
  // filler side of a boundary with sidewalks and plazas: grit drifted against the edge (drawn at partial alpha)
  var GRIME={K:'#050707',D:'#0f1313',M:'#2a2b27'};
  var grimeMasks=edgeMask(function(d,a,x,y){var depth=2+4*wob(a,1.3),p;if(d>=depth)return null;p=.9*(1-d/depth);return ih(x,y,d+77)<p?(d<1.5||ih(x,y,78)<.3?'K':'D'):null;});
  // building foot: contact shadow against the wall, a damp drip line and grit and flakes of render fallen from it
  var footMasks=edgeMask(function(d,a,x,y){
    var h=ih(x,y,79),depth=3+3*wob(a,2.9);
    if(d===0)return h<.85?'K':'D';
    if(d===1)return h<.6?'K':'D';
    if(d<depth)return h<.55*(1-d/depth)+.1?'D':(h>.94?'M':null);
    if(d<depth+3)return h>.965?'M':null;
    return null;
  });

  // lot rim bands, drawn by chunks.js along the exact lot rectangle; RIM_OUT texels of each piece sit outside the lot.
  // Straight rims (yard, kerb): variants [N,E,S,W]. Bumped rims (grass, gravel): 9 variants per side, side*9+i:
  // i 0-3 forward pieces at along offset 32i from the corner piece, i 4-7 the same measured back from the far
  // corner, i 8 a plain piece for the middle. The bump profile is zero at every 64, so forward, middle and backward
  // runs meet at the same width. Corner pieces (<rim>Corner [NW,NE,SE,SW]) round the corner with radius Rc.
  var RIM_OUT=6,RIM_AMPS=[3,-1.4],RIM_PH=4;
  function rimBump(A){var s=md(A,RIM_PH*32),q=Math.sin(Math.PI*md(s,64)/64);return RIM_AMPS[Math.floor(s/64)]*q*q;}
  function rimAcross(side,x,y){return side===0?y:side===1?31-x:side===2?31-y:x;}
  function rimAlong(side,x,y){return side===0||side===2?x:y;}
  function rimPieces(fn,seed,bumped){
    var out=[],side,i,x,y,g,p,A,k,e,ch;
    for(side=0;side<4;side++)for(i=0;i<(bumped?2*RIM_PH+1:1);i++){
      g=mkGrid('.');
      for(y=0;y<32;y++)for(x=0;x<32;x++){
        p=rimAlong(side,x,y);k=rimAcross(side,x,y)-RIM_OUT;
        if(!bumped){A=p;e=0;}
        else if(i<RIM_PH){A=i*32+p;e=rimBump(A)+.8*Math.sin(Math.PI*2*A/32);}
        else if(i<2*RIM_PH){A=(i-RIM_PH)*32+31-p;e=rimBump(A)+.8*Math.sin(Math.PI*2*A/32);}
        else{A=p;e=.8*Math.sin(Math.PI*2*p/32);}
        ch=fn(k,e,ih(x,y,seed+side*31+i*7),ih(Math.floor(md(A,RIM_PH*32)/4),side,seed+1),p,k>=0);
        if(ch)g[y][x]=ch;
      }
      out.push(toRows(g));
    }
    return out;
  }
  function rimCorners(fn,seed,Rc){
    var out=[],c,x,y,g,u,v,d,k;
    for(c=0;c<4;c++){
      g=mkGrid('.');
      for(y=0;y<32;y++)for(x=0;x<32;x++){
        u=(c===1||c===2?31-x:x)-RIM_OUT;v=(c>=2?31-y:y)-RIM_OUT;
        if(u>=Rc&&v>=Rc)d=Math.min(u,v);else if(v>=Rc)d=u;else if(u>=Rc)d=v;else d=Rc-Math.sqrt((Rc-u)*(Rc-u)+(Rc-v)*(Rc-v));
        k=Math.floor(d+.5);
        var ch=fn(k,0,ih(x,y,seed+c*13),ih(Math.floor((u+v+64)/4),c,seed+2),md(u+v,32),u>=0&&v>=0,d);
        if(ch)g[y][x]=ch;
      }
      out.push(toRows(g));
    }
    return out;
  }
  // grass: worn soil and straw 0-6 texels wide along the lawn edge, blades overhanging it in clumps, a few blades out
  function grassRim(k,e,h,hA,p,inR){
    var w=3.4+e;
    if(k<0){if(!inR)return k>=-2&&h<(k===-1?.2:.07)?(h<.08?'M':'E'):null;return h<.3?'S':h<.42?'Y':null;}
    if(k<w-1){if(hA<.24&&k>=w*.45&&h<.6)return h<.3?'M':'E';return h<.6?'S':h<.74?'U':h<.88?'Y':'E';}
    if(k<w+1.2)return h<.3?'Y':h<.52?'S':null;
    return null;
  }
  // gravel: the bed edge is a broken dark line; pebbles scattered 1-6 units out onto whatever surrounds it
  function gravelRim(k,e,h,hA,p,inR){
    var depth=3.2+e*.9;
    if(k<0){if(inR)return h<.4?'M':null;var q=-k;if(q>Math.max(1,depth))return null;return h<.34*(1-q/(depth+1.5))?(h<.2?'L':'M'):(q===1&&h>.93?'D':null);}
    if(k===0)return h<.22?'D':h<.5?'M':h<.6?'L':null;
    if(k===1)return h<.14?'D':null;
    return null;
  }
  // yard concrete: a broken contact line outside, a lit arris inside that breaks away in chips
  function yardRim(k,e,h,hA,p,inR){
    if(k===-1)return inR?'D':h<.55?'K':h<.8?'D':null;
    if(k<-1)return inR?'D':null;
    if(k===0)return hA<.18?(h<.6?'E':null):(h<.85?'L':'M');
    if(k===1)return h<.12?'L':null;
    return null;
  }
  var KERB=Object.assign({},MAT.concrete,{J:MAT.asphalt.K});
  // parking lot: a concrete kerb, asphalt-shadow drop outside, lit top
  function kerbRim(k,e,h,hA,p,inR){
    if(k<0)return inR||k===-1?'J':null;
    if(k===0)return h<.1?'M':'L';
    if(k===1)return h<.06?'D':'M';
    if(k===2)return 'D';
    return null;
  }
  // soil apron around a planting bed (64x48, bed 48x32 centred): trodden soil against the edging, feathering into the lawn
  function makeBedApron(){
    var g=mkGrid('.'),x,y,dx,dy,d,h,w;g=[];for(y=0;y<48;y++){g.push([]);for(x=0;x<64;x++)g[y].push('.');}
    for(y=0;y<48;y++)for(x=0;x<64;x++){
      dx=Math.max(0,Math.abs(x-31.5)-23.5);dy=Math.max(0,Math.abs(y-23.5)-15.5);d=Math.sqrt(dx*dx+dy*dy);
      if(d<=0)continue;h=ih(x,y,301);w=2.5+2*wob(x+y,4.1);
      if(d<w)g[y][x]=h<.55?'S':h<.72?'U':h<.86?'Y':'E';
      else if(d<w+2.5)g[y][x]=h<.3?'S':h<.5?'Y':'.';
      else if(d<w+4&&h<.1)g[y][x]='M';
    }
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
    lotSouth:{variants:slices(fielded(surfSouth(),wearSouth(MP))),macro:4,pal:P_SOUTH,anchor:'tile',note:'32x32 x16, pick variant (tx mod 4)+4*(ty mod 4); South Blocks rear-yard asphalt: faded, aggregate grain'},
    lotSouthWear:{variants:slices(wearSouth(WP)),macro:5,pal:P_SOUTH,anchor:'tile',note:'transparent broad value fields over lotSouth (damp dark, bleached), x25, pick (tx mod 5)+5*(ty mod 5)'},
    lotSouthSpot:{variants:turned(spotsSouth()),pal:P_SOUTH,anchor:'tile',note:'transparent off-grid spot decal: cut repair, worn depression, weed crack, oil drip'},
    lotSouthFeature:{variants:turned(featSouth()),pal:P_SOUTH,anchor:'tile',note:'64x64 off-grid feature decal: three crack networks, crazing, oil stall, ravelled patch'},
    lotRuins:{variants:slices(fielded(surfRuins(),wearRuins(MP))),macro:4,pal:P_RUINS,anchor:'tile',note:'32x32 x16; Old Quarter compacted rubble soil with stones and brick fragments, neutral brown-grey'},
    lotRuinsWear:{variants:slices(wearRuins(WP)),macro:5,pal:P_RUINS,anchor:'tile',note:'transparent broad value fields over lotRuins, x25'},
    lotRuinsSpot:{variants:turned(spotsRuins()),pal:P_RUINS,anchor:'tile',note:'transparent off-grid spot decal: brick spill, concrete lump, puddle'},
    lotRuinsFeature:{variants:turned(featRuins()),pal:P_RUINS,anchor:'tile',note:'64x64 off-grid feature decal: soft ruts, stone scatter, puddle'},
    lotWard:{variants:slices(fielded(surfWard(),wearWard(MP))),macro:4,pal:P_WARD,anchor:'tile',note:'32x32 x16; Civic Ward 32x32 precast flagstones, grid offset (5,3), joints one step below the flags, some flags cut in two'},
    lotWardWear:{variants:slices(wearWard(WP)),macro:5,pal:P_WARD,anchor:'tile',note:'transparent broad value fields over lotWard flags (joints untouched), x25'},
    lotWardSpot:{variants:spotsWard(),snap:32,pal:P_WARD,anchor:'tile',note:'off-grid spot decal snapped to 32: sunken flag, mortar smear, cracked flag, sunken pair'},
    lotWardFeature:{variants:featWard(),snap:32,pal:P_WARD,anchor:'tile',note:'64x64 feature decal snapped to 32: settled area, moss joints, cracked units, grit'},
    lotNorth:{variants:slices(fielded(surfNorth(),wearNorth(MP))),macro:4,pal:P_NORTH,anchor:'tile',note:'32x32 x16; Northline 64-unit poured slabs, saw-cut joints offset (20,44) varying per segment, chipped arrises, frost in joints'},
    lotNorthWear:{variants:slices(wearNorth(WP)),macro:5,pal:P_NORTH,anchor:'tile',note:'transparent broad value fields over lotNorth (damp, frost), x25'},
    lotNorthSpot:{variants:turned(spotsNorth()),pal:P_NORTH,anchor:'tile',note:'transparent off-grid spot decal: frost drift, spalled hollow, grit heap'},
    lotNorthFeature:{variants:turned(featNorth()),pal:P_NORTH,anchor:'tile',note:'64x64 off-grid feature decal: two crack networks, frost sheet, damp patch'},
    lotAsh:{variants:slices(fielded(surfAsh(),wearAsh(MP))),macro:4,pal:P_ASH,anchor:'tile',note:'32x32 x16; Ashworks cinder and slag yard, clinker lumps'},
    lotAshWear:{variants:slices(wearAsh(WP)),macro:5,pal:P_ASH,anchor:'tile',note:'transparent broad fields over lotAsh: black cinder and pale ash, x25'},
    lotAshSpot:{variants:turned(spotsAsh()),pal:P_ASH,anchor:'tile',note:'transparent off-grid spot decal: bedded steel plate at cinder value, slag heap, charcoal burn scar'},
    lotAshFeature:{variants:turned(featAsh()),pal:P_ASH,anchor:'tile',note:'64x64 off-grid feature decal: soft truck ruts, ash drift, burn scar, clinker scatter'},
    lotQuarantine:{variants:slices(fielded(surfQuar(),wearQuar(MP))),macro:4,pal:P_QUAR,anchor:'tile',note:'32x32 x16; Central Quarantine requisitioned precast apron, 64-unit panels, broken tar joints offset (40,12) with overfill and spalls, lifting anchors shifted or missing per panel'},
    lotQuarantineWear:{variants:slices(wearQuar(WP)),macro:5,pal:P_QUAR,anchor:'tile',note:'transparent broad value fields over lotQuarantine, x25'},
    lotQuarantineSpot:{variants:turned(spotsQuar()),pal:P_QUAR,anchor:'tile',note:'transparent off-grid spot decal: lime powder, tie-down ring, pallet footprint'},
    lotQuarantineFeature:{variants:turned(featQuar()),pal:P_QUAR,anchor:'tile',note:'64x64 off-grid feature decal: soft truck ruts both ways, lime spill, oil stain'},
    grass:{variants:slices(surfGrass()),macro:4,pal:P_GRASS,anchor:'tile',note:'32x32 x16, pick variant (tx mod 4)+4*(ty mod 4); maintained late-winter lawn: 2-3 texel blade tufts whose density makes broad lighter and darker patches'},
    grassWear:{variants:slices(wearGrass()),macro:5,pal:P_GRASS,anchor:'tile',note:'transparent broad fields over grass: straw-tipped dry zones, damp thin turf, x25'},
    grassSpot:{variants:turned(spotsGrass()),pal:P_GRASS,anchor:'tile',note:'transparent off-grid spot decal: bare soil (solid core, ragged edge, overhanging blades) x2, leaf litter'},
    grassFeature:{variants:turned(featGrass()),pal:P_GRASS,anchor:'tile',note:'64x64 off-grid feature decal: trampled bare patch, desire line, damp hollow, leaf drift'},
    gravel:{variants:slices(fielded(surfGravel(),wearGravel(MP))),macro:4,pal:P_GRAVEL,anchor:'tile',note:'32x32 x16; dense low-contrast pebble gravel over compacted fines'},
    gravelWear:{variants:slices(wearGravel(WP)),macro:5,pal:P_GRAVEL,anchor:'tile',note:'transparent broad value fields over gravel, x25'},
    gravelSpot:{variants:turned(spotsGravel()),pal:P_GRAVEL,anchor:'tile',note:'transparent off-grid spot decal: large stones, weed tuft, puddle'},
    gravelFeature:{variants:turned(featGravel()),pal:P_GRAVEL,anchor:'tile',note:'64x64 off-grid feature decal: soft ruts both ways, soil patch, puddle'},
    yardConcrete:{variants:slices(fielded(surfYard(),wearYard(MP))),macro:4,pal:P_YARD,anchor:'tile',note:'32x32 x16; service-yard concrete, 64-unit slabs, saw joints offset (28,52) varying per segment, lit arris breaking into chips'},
    yardConcreteWear:{variants:slices(wearYard(WP)),macro:5,pal:P_YARD,anchor:'tile',note:'transparent broad value fields over yardConcrete (oil-dark, bleached), x25'},
    yardConcreteSpot:{variants:turned(spotsYard()),pal:P_YARD,anchor:'tile',note:'transparent off-grid spot decal: oil stain, pale fresh infill patch with sealed edge, rust stain'},
    yardConcreteFeature:{variants:turned(featYard()),pal:P_YARD,anchor:'tile',note:'64x64 off-grid feature decal: oil stall, crack network, drip line, tyre scuff'},
    yardAsphalt:{variants:slices(fielded(surfYardAsphalt(),wearYardAsphalt(MP))),macro:4,pal:P_YASPH,anchor:'tile',note:'32x32 x16; parking and service-lot blacktop at road value with aggregate grain (lot surface asphalt; the road tile stays for carriageways)'},
    yardAsphaltWear:{variants:slices(wearYardAsphalt(WP)),macro:5,pal:P_YASPH,anchor:'tile',note:'transparent broad value fields over yardAsphalt, x25'},
    yardAsphaltSpot:{variants:turned(spotsYardAsphalt()),pal:P_YASPH,anchor:'tile',note:'transparent off-grid spot decal: cut repair, oil stain, short crack, worn depression'},
    yardAsphaltFeature:{variants:turned(featYardAsphalt()),pal:P_YASPH,anchor:'tile',note:'64x64 off-grid feature decal: three crack networks, crazing, oil stall'},
    grime:{mask:grimeMasks,pal:GRIME,anchor:'tile',note:'transparent; set bit = a sidewalk or plaza on that side; grit band 2-6 texels, drawn at alpha .5 over any filler'},
    footing:{mask:footMasks,pal:GRIME,anchor:'tile',note:'transparent; set bit = a building on that side; contact shadow, drip line and fallen grit 3-9 texels, drawn at alpha .6 over outdoor ground'},
    grassEdge:{variants:rimPieces(grassRim,81,true),out:RIM_OUT,bumped:true,pal:P_GRASS,anchor:'tile',note:'transparent lot rim piece x36 (side*9+i, see chunks.js rim()); worn soil and straw 1-6 texels, blades overhang, width follows a 128-unit profile'},
    grassCorner:{variants:rimCorners(grassRim,85,14),out:RIM_OUT,pal:P_GRASS,anchor:'tile',note:'rim corner [NW,NE,SE,SW], lot corner at (6,6) of the piece, rounded r=14'},
    gravelEdge:{variants:rimPieces(gravelRim,82,true),out:RIM_OUT,bumped:true,pal:P_GRAVEL,anchor:'tile',note:'transparent lot rim piece x36: broken bed line, pebbles scattered up to 6 units out'},
    gravelCorner:{variants:rimCorners(gravelRim,86,3),out:RIM_OUT,pal:P_GRAVEL,anchor:'tile',note:'rim corner [NW,NE,SE,SW], rounded r=3'},
    yardEdge:{variants:rimPieces(yardRim,83,false),out:RIM_OUT,pal:P_YARD,anchor:'tile',note:'transparent lot rim [N,E,S,W]: broken contact line out, chipped lit arris in'},
    yardCorner:{variants:rimCorners(yardRim,87,0),out:RIM_OUT,pal:P_YARD,anchor:'tile',note:'rim corner [NW,NE,SE,SW], square'},
    kerbEdge:{variants:rimPieces(kerbRim,84,false),out:RIM_OUT,pal:KERB,anchor:'tile',note:'transparent lot rim [N,E,S,W]: parking-lot kerb, asphalt-shadow drop out, lit concrete top in'},
    kerbCorner:{variants:rimCorners(kerbRim,88,4),out:RIM_OUT,pal:KERB,anchor:'tile',note:'rim corner [NW,NE,SE,SW], kerb rounded r=4'},
    bedApron:{rows:makeBedApron(),pal:P_GRASS,anchor:'tile',note:'64x48 transparent soil apron around a 48x32 planting bed centred in it; baked under lots/plantingBed'},
    sidewalkEdgeCut:{mask:makeSidewalkEdgeMasks(true),pal:EDGE,anchor:'tile',note:'sidewalkEdge with the dirt fringe transparent, drawn over the neighbouring filler so the lot texture runs into the crumble'},
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
