// Dead Signal vfx: muzzle flashes, impacts, blood, fire, flame jets and the
// revive ring. One texel = one world unit (den 1). Anchor 'center' for every
// sprite except bloodDecal (anchor 'feet'). This family is seen for 2-5
// frames at 60fps and is the brightest thing on screen against a dark,
// multiply-lit street, so shading here pushes the top of MAT.ember (W/Y/O)
// with a thin dark end and skips AA/dithering entirely. Silhouettes are
// deliberately *not* round: fire and flames are built from tapering,
// notch-edged licks and muzzle flashes from a directional cone plus
// irregular forward/off-axis spikes, all painted with axis-aligned scans
// (rect/thickLine) so nothing is a shimmering single-pixel diagonal under
// render.js's nearest-neighbour `rotate`. No hash(), no den override.
(function(){
  'use strict';
  var A=(typeof window!=='undefined'?window:globalThis).DSArt;
  var MAT=A.MAT;

  // ---- grid helpers (art/loot.js style: build on a grid, emit rows) ----
  function mkGrid(w,h){var g=[],y,x,row;for(y=0;y<h;y++){row=[];for(x=0;x<w;x++)row.push('.');g.push(row);}return g;}
  function setclip(g,x,y,ch){x=Math.round(x);y=Math.round(y);if(y>=0&&y<g.length&&x>=0&&x<g[0].length)g[y][x]=ch;}
  function rect(g,x0,y0,x1,y1,ch){var x,y;x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);if(x1<x0){var t=x0;x0=x1;x1=t;}if(y1<y0){var t2=y0;y0=y1;y1=t2;}for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++)setclip(g,x,y,ch);}
  function toRows(g){return g.map(function(r){return r.join('');});}
  // filled ellipse, sampled at pixel centres so it stays symmetric on even
  // canvases; later calls paint over earlier ones (dark-to-bright layering).
  function fillEllipse(g,cx,cy,rx,ry,ch){
    var h=g.length,w=g[0].length,x,y,dx,dy;
    for(y=0;y<h;y++)for(x=0;x<w;x++){dx=(x+.5-cx)/rx;dy=(y+.5-cy)/ry;if(dx*dx+dy*dy<=1)setclip(g,x,y,ch);}
  }
  // hollow ellipse ring, `thick` pixels wide, filled by horizontal scanline
  // spans (not a per-pixel radial test) so thin rings stay solid instead of
  // breaking into scattered dots at shallow curvature.
  function ringRows(g,cx,cy,rx,ry,thick,ch){
    var h=g.length,innerRx=Math.max(0,rx-thick),innerRy=Math.max(0,ry-thick),y,dy,fOuter,outerHW,fInner,innerHW,x0,x1,ix0,ix1;
    for(y=0;y<h;y++){
      dy=y+.5-cy;if(Math.abs(dy)>ry+.5)continue;
      fOuter=1-(dy*dy)/(ry*ry);if(fOuter<0)continue;
      outerHW=rx*Math.sqrt(fOuter);x0=cx-outerHW;x1=cx+outerHW-1;
      fInner=innerRy>0?1-(dy*dy)/(innerRy*innerRy):-1;
      innerHW=(innerRy>0&&fInner>0)?innerRx*Math.sqrt(fInner):0;
      if(innerHW<=0){rect(g,x0,y,x1,y,ch);continue;}
      ix0=cx-innerHW;ix1=cx+innerHW-1;
      rect(g,x0,y,ix0-1,y,ch);rect(g,ix1+1,y,x1,y,ch);
    }
  }
  // colour ramp lookup: ramp is [{t,col},...] sorted ascending by t in [0,1]
  function rampAt(ramp,t){var i;for(i=ramp.length-1;i>=0;i--)if(t>=ramp[i].t)return ramp[i].col;return ramp[0].col;}
  // a thick line stamped from overlapping small squares (never a 1px
  // diagonal, so it doesn't shimmer once render.js rotates the sprite)
  function thickLine(g,x0,y0,x1,y1,th,ch){
    var dist=Math.max(Math.abs(x1-x0),Math.abs(y1-y0)),steps=Math.max(1,Math.round(dist*2)),i,t,x,y,h2=th/2;
    for(i=0;i<=steps;i++){t=i/steps;x=x0+(x1-x0)*t;y=y0+(y1-y0)*t;rect(g,x-h2,y-h2,x+h2,y+h2,ch);}
  }
  // a spray of short thick spikes from a centre: arms = [[angleDeg,len,thick,col],...]
  function burst(g,cx,cy,arms){
    arms.forEach(function(a){
      var rad=a[0]*Math.PI/180;
      thickLine(g,cx+Math.cos(rad)*1.1,cy+Math.sin(rad)*1.1,cx+Math.cos(rad)*a[1],cy+Math.sin(rad)*a[1],a[2],a[3]);
    });
  }

  // =====================================================================
  // muzzleS/M/L: 3 frames, pointing +x from the barrel-tip origin (the grid
  // centre = the anchor). A directional cone (narrow at the tip, widest a
  // little way out, tapering to a point) plus 1-4 irregular spikes — one
  // roughly forward, the rest off-axis — so the silhouette reads as a
  // gunshot, not a ball. Sizes differ by *shape*: S is a stubby cone with
  // one spike, M a longer cone with a forward spike, L a wide splayed star
  // (the shotgun). The 3 frames swap which spikes are lit for flicker.
  // =====================================================================
  // Y/O carry the mass (the cone body); L is reserved for the cone's outer
  // taper and the outer half of every spike; W is a tiny core only, never a
  // per-column fill colour, so it can't balloon into a pale splat.
  var HOT_RAMP=[{t:0,col:'Y'},{t:0.16,col:'O'},{t:0.66,col:'O'},{t:0.84,col:'L'},{t:1,col:'L'}];
  var DIM_RAMP=[{t:0,col:'O'},{t:0.30,col:'L'},{t:0.7,col:'M'},{t:1,col:'M'}];
  function paintCone(g,ox,oy,len,maxHalf,peakT,ramp){
    var dx,t,halfw,x,col;
    for(dx=0;dx<=len;dx++){
      t=dx/len;
      halfw=t<peakT?maxHalf*(t/peakT):maxHalf*((1-t)/(1-peakT));
      if(halfw<0.45)halfw=0.45;
      col=rampAt(ramp,t);x=ox+dx;
      rect(g,x,oy-halfw,x,oy+halfw,col);
    }
  }
  // a spike is two segments, not one flat colour: O near the cone, L at the
  // free end, so the outer edge of the burst reads cooler than its root.
  function paintSpike(g,ox,oy,angleDeg,len,th,innerCol,outerCol){
    var rad=angleDeg*Math.PI/180,innerLen=len*0.55;
    var sx=ox+Math.cos(rad)*1.1,sy=oy+Math.sin(rad)*1.1;
    var ix=ox+Math.cos(rad)*innerLen,iy=oy+Math.sin(rad)*innerLen;
    var ex=ox+Math.cos(rad)*len,ey=oy+Math.sin(rad)*len;
    thickLine(g,sx,sy,ix,iy,th,innerCol);
    thickLine(g,ix,iy,ex,ey,Math.max(1,th*0.82),outerCol);
  }
  function makeMuzzleFrame(kind,w,h,frame){
    var g=mkGrid(w,h),ox=w/2,oy=h/2;
    var mult=[1,0.88,0.62][frame],hot=frame<2,ramp=hot?HOT_RAMP:DIM_RAMP;
    var inner=hot?'O':'L',outer=hot?'L':'M',coneLen,maxHalf,peakT,spikes;
    if(kind==='S'){
      coneLen=w*0.55*mult;maxHalf=h*0.30*mult;peakT=0.30;
      spikes=frame===0?[[4,coneLen*1.55,1.7]]:
             frame===1?[[-8,coneLen*1.35,1.5]]:
                        [[12,coneLen*1.15,1.3]];
    }else if(kind==='M'){
      coneLen=w*0.62*mult;maxHalf=h*0.32*mult;peakT=0.26;
      spikes=frame===0?[[0,coneLen*1.75,1.9],[-36,coneLen*1.05,1.3]]:
             frame===1?[[10,coneLen*1.6,1.7],[32,coneLen*0.95,1.2]]:
                        [[-6,coneLen*1.3,1.4]];
    }else{ // shotgun: shorter, wider cone, few unequal spikes (not 5 equal fingers)
      coneLen=w*0.44*mult;maxHalf=h*0.42*mult;peakT=0.34;
      spikes=frame===0?[[-46,coneLen*1.35,1.5],[30,coneLen*0.82,1.15],[-12,coneLen*1.05,1.3]]:
             frame===1?[[16,coneLen*1.2,1.4],[-54,coneLen*0.78,1.1]]:
                        [[-22,coneLen*0.95,1.25],[42,coneLen*0.62,0.95],[-66,coneLen*1.1,1.3]];
    }
    paintCone(g,ox,oy,coneLen,maxHalf,peakT,ramp);
    spikes.forEach(function(s){paintSpike(g,ox,oy,s[0],s[1],s[2],inner,outer);});
    fillEllipse(g,ox,oy,Math.max(1.1,Math.min(1.8,h*0.09*mult)),Math.max(1.0,Math.min(1.6,h*0.08*mult)),hot?'W':'Y'); // a handful of core texels, not a body
    setclip(g,ox-w*0.07,oy,'D'); // dim root ember, grounds the flash to the barrel
    return toRows(g);
  }
  function makeMuzzle(kind,w,h){return[makeMuzzleFrame(kind,w,h,0),makeMuzzleFrame(kind,w,h,1),makeMuzzleFrame(kind,w,h,2)];}

  // =====================================================================
  // impactSpark 12x12, 3f: a true age sequence — burst, spray, fading motes.
  // Frame 0's burst uses unequal, off-axis arms (not a "+"). Frames 1-2
  // scatter isolated bright texels on purpose (deliberate single-pixel
  // sparks, not noise — rule 11's orphan check will flag them).
  // =====================================================================
  function makeImpactFrame(frame){
    var w=12,h=12,g=mkGrid(w,h),cx=w/2,cy=h/2;
    if(frame===0){
      fillEllipse(g,cx+0.4,cy-0.3,3.6,3,'M');
      fillEllipse(g,cx-0.3,cy+0.2,2.3,2.7,'O');
      fillEllipse(g,cx,cy,1.2,1.2,'W');
      burst(g,cx,cy,[[-96,5,1.5,'Y'],[18,3.4,1.3,'Y'],[104,4.2,1.4,'Y'],[-32,2.6,1.1,'O'],[152,3.2,1.2,'O']]);
    }else if(frame===1){
      fillEllipse(g,cx,cy,2,2,'O');fillEllipse(g,cx,cy,1,1,'Y');
      var a1=[0.3,1.1,2.0,2.9,3.8,4.7,5.6];
      a1.forEach(function(a,i){var r=4+(i%3),px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r;setclip(g,px,py,i%2?'O':'Y');});
    }else{
      var a2=[0.5,1.8,3.0,4.2,5.4];
      a2.forEach(function(a,i){var r=5+(i%2),px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r;setclip(g,px,py,i%2?'M':'O');});
      setclip(g,cx,cy,'D');
    }
    return toRows(g);
  }

  // =====================================================================
  // bloodHit 16x16, 3f: same burst/spray/fade sequence, MAT.blood ramp.
  // Frame 0 gets the same unequal off-axis arm fix as impactSpark.
  // =====================================================================
  function makeBloodHitFrame(frame){
    var w=16,h=16,g=mkGrid(w,h),cx=w/2,cy=h/2;
    if(frame===0){
      fillEllipse(g,cx-0.4,cy+0.3,4.4,3.6,'D');
      fillEllipse(g,cx+0.3,cy-0.2,2.9,3.3,'M');
      fillEllipse(g,cx,cy,1.4,1.4,'L');
      burst(g,cx,cy,[[-100,7,1.6,'M'],[24,4.6,1.4,'M'],[112,5.6,1.5,'M'],[-26,3.4,1.2,'D'],[160,4.2,1.3,'D']]);
    }else if(frame===1){
      fillEllipse(g,cx,cy,2.4,2.4,'M');fillEllipse(g,cx,cy,1.2,1.2,'L');
      var a1=[0.2,1.0,1.9,2.8,3.7,4.6,5.5];
      a1.forEach(function(a,i){var r=5+(i%3),px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r*0.8;setclip(g,px,py,i%2?'D':'M');});
    }else{
      var a2=[0.4,1.7,2.9,4.1,5.3];
      a2.forEach(function(a,i){var r=6+(i%2),px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r*0.75;setclip(g,px,py,i%2?'M':'D');});
      setclip(g,cx,cy,'D');
    }
    return toRows(g);
  }

  // =====================================================================
  // bloodDecal 20x12, anchor feet, 3 variants: flat, dark ground pool.
  // Mostly K with a thin D fringe and only 1-2 M texels at the wet centre
  // of the main lobe — up to 240 of these persist on screen at 0.85 alpha,
  // so anything brighter turns the street pink.
  // =====================================================================
  function bloodLobe(g,cx,cy,rx,ry,wet){
    fillEllipse(g,cx,cy,rx+0.4,ry+0.4,'D');
    fillEllipse(g,cx,cy,rx*0.84,ry*0.84,'K');
    if(wet)setclip(g,cx,cy,'M');
  }
  function bloodFleck(g,cx,cy,r){fillEllipse(g,cx,cy,r+0.3,r+0.3,'D');fillEllipse(g,cx,cy,r*0.6,r*0.6,'K');}
  function makeBloodDecal(variant){
    var w=20,h=12,g=mkGrid(w,h);
    if(variant===0){
      bloodLobe(g,9,7,7,3.4,true);bloodLobe(g,5,6,3,2.2,false);
      bloodFleck(g,16,5,1.3);bloodFleck(g,3,9,1);
    }else if(variant===1){
      bloodLobe(g,8,7,5,3,true);bloodLobe(g,13,8,4.4,2.6,false);
      bloodFleck(g,3,5,1.2);bloodFleck(g,17,5,1);bloodFleck(g,10,3,1);
    }else{
      bloodLobe(g,7,8,5.6,2.8,true);bloodLobe(g,13,6,4.6,2.4,false);bloodLobe(g,10,9,3,1.8,false);
      bloodFleck(g,3,4,1);bloodFleck(g,17,9,1.2);
    }
    return toRows(g);
  }

  // =====================================================================
  // fire 24x32, 5f, loops (frame4->frame0 closes): a cluster of three slim
  // tongues (a tall centre, a shorter left, a shorter right) with bases
  // fused near the ground and tops that diverge — the gaps *between*
  // tongues are what break the silhouette up, not just edge noise, so it
  // never reads as one dome. Each tongue is also carved with independent,
  // higher-frequency left/right bites so no single edge stays convex for
  // more than a few rows. Colour runs hot-to-cool from the base (Y/O, where
  // the fuel is) up through the body to the tips and bites (M/D only); an
  // inner L streak breaks up each tongue's O body so it isn't one flat hue.
  // The hottest W texels live *inside* the centre tongue's base silhouette
  // (inset from its own edges), never a separate bar. Every frame carries a
  // constant lateral offset (never dead-centre) plus extra sway toward the
  // tip, so the mass leans instead of sitting symmetric.
  // =====================================================================
  var FIRE_RAMP=[{t:0,col:'Y'},{t:0.10,col:'O'},{t:0.26,col:'O'},{t:0.46,col:'L'},{t:0.70,col:'M'},{t:0.88,col:'D'}];
  function lickWidth(t,w0,baseFrac,peakT,tipFrac){
    var frac=t<peakT?baseFrac+(1-baseFrac)*(t/peakT):1+(tipFrac-1)*((t-peakT)/(1-peakT));
    return w0*frac;
  }
  function paintLick(g,cx,baseY,h,w0,base,sway,seed,split,gap,ramp,opts){
    opts=opts||{};
    var row,t,yy,coreW,bL,bR,leftW,rightW,cxRow,col,ft,half,gapAmt,x0,x1,sx,wx0,wx1,mid;
    for(row=0;row<h;row++){
      t=row/(h-1);yy=baseY-row;
      coreW=lickWidth(t,w0,0.55,0.16,0.08);
      // independent, out-of-phase left/right bites at ~2 cycles over the
      // tongue's height, so each edge gets 2-3 real concave dents rather
      // than one smooth wave
      bL=Math.max(0,Math.sin(t*10.5+seed))*coreW*0.5;
      bR=Math.max(0,Math.sin(t*9.0+seed*1.8+1.7))*coreW*0.5;
      leftW=Math.max(0.55,coreW-bL);rightW=Math.max(0.55,coreW-bR);
      cxRow=cx+base+sway*t+Math.sin(t*4.4+seed*0.6)*0.7*t;
      col=rampAt(ramp,t);
      if(t>split){
        ft=(t-split)/(1-split);half=Math.min(leftW,rightW)*0.55;gapAmt=gap*ft;
        rect(g,cxRow-gapAmt-half,yy,cxRow-gapAmt,yy,col);
        rect(g,cxRow+gapAmt,yy,cxRow+gapAmt+half,yy,col);
      }else{
        x0=cxRow-leftW;x1=cxRow+rightW;
        rect(g,x0,yy,x1,yy,col);
        if(opts.streakSide&&t>0.10&&t<0.55){ // interior separation, breaks the flat O mass
          sx=opts.streakSide<0?x0+1:x1-1;
          setclip(g,sx,yy,'L');
        }
        if(opts.coreFlecks&&t<0.13){ // hottest kernel, inset inside the base silhouette
          wx0=Math.round(x0)+1;wx1=Math.round(x1)-1;
          if(wx1>=wx0){
            mid=Math.round((wx0+wx1)/2);setclip(g,mid,yy,'W');
            if(row%2===0&&wx1>wx0)setclip(g,mid+(rightW>leftW?1:-1),yy,'W');
          }
        }
      }
    }
  }
  function makeFireFrame(frame){
    var w=24,h=32,g=mkGrid(w,h),baseCx=w/2,baseY=h-3,bh=h-7;
    var p=[
      {lean:1.4,sway:1.3,split:0.54,seed:0.4,seed2:2.6,seed3:1.1},
      {lean:2.6,sway:2.0,split:0.70,seed:1.7,seed2:3.9,seed3:2.4},
      {lean:0.7,sway:0.9,split:0.42,seed:2.9,seed2:5.1,seed3:3.6},
      {lean:-2.4,sway:-1.7,split:0.66,seed:4.2,seed2:0.5,seed3:4.8},
      {lean:-1.2,sway:-1.0,split:0.80,seed:5.4,seed2:1.3,seed3:0.2}
    ][frame];
    // left short tongue, centre tall tongue, right short tongue — bases
    // overlap near the ground (fused/grounded) but the tops splay apart
    paintLick(g,baseCx-3.2,baseY-1,bh*0.62,2.9,p.lean-0.6,p.sway*0.65,p.seed2,Math.min(1,p.split+0.18),1.7,FIRE_RAMP,{streakSide:1});
    paintLick(g,baseCx,baseY,bh,4.6,p.lean,p.sway,p.seed,p.split,2.5,FIRE_RAMP,{streakSide:-1,coreFlecks:true});
    paintLick(g,baseCx+2.9,baseY-1,bh*0.52,2.6,p.lean+1.5,p.sway*0.85,p.seed3,Math.min(1,p.split+0.10),1.5,FIRE_RAMP,{});
    return toRows(g);
  }

  // =====================================================================
  // flameTongue 18x14, 5f: elongated along x (not a round blob) — full and
  // hottest toward -x (the nozzle end), tapering with a jittered, un-capped
  // edge toward +x. render.js stamps five of these along the aim at
  // increasing scale, so a front/back read here is what makes the chain
  // look like one continuous jet instead of a string of beads.
  // =====================================================================
  function paintTongue(g,cx,cy,w,h,lean,seed,col){
    var xStart=cx-w*0.62,xEnd=cx+w*0.42,x,t,heightFrac,jitter,halfh,cyRow;
    for(x=Math.floor(xStart);x<=Math.ceil(xEnd);x++){
      t=(x-xStart)/(xEnd-xStart);if(t<0)t=0;if(t>1)t=1;
      heightFrac=t<0.45?1-0.15*(t/0.45):Math.max(0,1-((t-0.45)/0.55));
      jitter=Math.sin(t*9+seed)*0.55*(t>0.3?1:0.3);
      halfh=(h*0.5)*heightFrac+jitter;
      if(halfh<0.35)continue;
      cyRow=cy+lean*t;
      rect(g,x,cyRow-halfh,x,cyRow+halfh,col);
    }
  }
  function makeFlameTongueFrame(frame){
    var w=18,h=14,g=mkGrid(w,h),cx=w*0.56,cy=h*0.5;
    var phase=frame*2*Math.PI/5,wob=Math.sin(phase)*0.8,seed=frame*1.6;
    paintTongue(g,cx,cy,18,10.5,wob*0.4,seed,'D');
    paintTongue(g,cx-0.8,cy,14.5,8.6,wob*0.5,seed+0.6,'M');
    paintTongue(g,cx-1.6,cy,10.5,6.6,wob*0.6,seed+1.2,'L');
    paintTongue(g,cx-2.4,cy,6.8,4.6,wob*0.7,seed+1.8,'O');
    paintTongue(g,cx-3.2,cy,3.8,2.8,wob*0.8,seed+2.4,'Y');
    return toRows(g);
  }

  // =====================================================================
  // reviveRing 48x24, 4f: flat cyan ellipse pulse, expands and thins over
  // the 4 frames while game.js fades its alpha by elapsed life.
  // =====================================================================
  function makeReviveFrame(frame){
    var w=48,h=24,g=mkGrid(w,h),cx=w/2,cy=h/2,t=frame/3;
    var rx=9+t*17,ry=4.5+t*8,thick=2.6-t*1.1;
    ringRows(g,cx,cy,rx+1.6,ry+1.6,Math.max(1,thick*0.6),'D');
    ringRows(g,cx,cy,rx,ry,Math.max(1.3,thick),'C');
    ringRows(g,cx,cy,rx*0.86,ry*0.86,Math.max(1,thick*0.5),'W');
    return toRows(g);
  }

  // =====================================================================
  // smokePuff 16x16, 4f (unused today): rising, dissipating puff, MAT.basalt.
  // =====================================================================
  function makeSmokePuffFrame(frame){
    var w=16,h=16,g=mkGrid(w,h),cx=w/2,cy=h/2-frame*1.1,grow=1+frame*0.32;
    fillEllipse(g,cx,cy,4.2*grow,4*grow,'M');
    fillEllipse(g,cx-1,cy-0.6,2.6*grow,2.4*grow,'L');
    if(frame<3)fillEllipse(g,cx+1,cy+0.4,1.4*grow,1.3*grow,'H');
    return toRows(g);
  }

  // =====================================================================
  // emberMote 6x6, 2f (unused today): a single drifting spark, MAT.ember.
  // Deliberately a lone bright texel per rule 11's exception.
  // =====================================================================
  function makeEmberMoteFrame(frame){
    var w=6,h=6,g=mkGrid(w,h),cx=w/2,cy=h/2;
    setclip(g,cx,cy+(frame?0.6:0),'O');
    setclip(g,cx,cy-1+(frame?0.3:0),frame?'Y':'W');
    return toRows(g);
  }

  // =====================================================================
  // explosion 28x28, 5f (unused today): fast expand then slow settle, a
  // scalloped ring of overlapping blobs (not a clean donut) then a fading
  // ember blob, MAT.ember.
  // =====================================================================
  function makeExplosionFrame(frame){
    var w=28,h=28,g=mkGrid(w,h),cx=w/2,cy=h/2;
    var r=[3,9,12,10,7][frame];
    if(frame<2){
      fillEllipse(g,cx,cy,r,r,'O');
      fillEllipse(g,cx,cy,r*0.6,r*0.6,'Y');
      fillEllipse(g,cx,cy,r*0.28,r*0.28,'W');
    }else{
      var col=frame===2?'Y':frame===3?'L':'M',n=9,i,a,pr,px,py,pw;
      for(i=0;i<n;i++){
        a=i*(Math.PI*2/n)+frame*0.5;
        pr=r*(0.86+0.22*Math.sin(i*2.3+frame));
        px=cx+Math.cos(a)*pr;py=cy+Math.sin(a)*pr;
        pw=r*0.28*(0.8+0.4*Math.sin(i*1.7+frame*1.3));
        fillEllipse(g,px,py,pw,pw,col);
      }
      fillEllipse(g,cx,cy,r*0.42,r*0.42,frame===2?'O':frame===3?'M':'D');
    }
    return toRows(g);
  }

  // =====================================================================
  // pickupSparkle 10x10, 4f (unused today): a small twinkle, MAT.loot.
  // =====================================================================
  function makePickupSparkleFrame(frame){
    var w=10,h=10,g=mkGrid(w,h),cx=w/2,cy=h/2,arm=2+((frame+1)%2);
    setclip(g,cx,cy,frame%2?'W':'Y');
    rect(g,cx,cy-arm,cx,cy-arm+1,'C');rect(g,cx,cy+arm-1,cx,cy+arm,'C');
    rect(g,cx-arm,cy,cx-arm+1,cy,'C');rect(g,cx+arm-1,cy,cx+arm,cy,'C');
    return toRows(g);
  }

  // =====================================================================
  // footDust 12x8, 3f (unused today): a small ground puff, MAT.concrete.
  // =====================================================================
  function makeFootDustFrame(frame){
    var w=12,h=8,g=mkGrid(w,h),cx=w/2,cy=h/2+1,grow=1+frame*0.4;
    fillEllipse(g,cx,cy,3.4*grow,1.8*grow,'M');
    if(frame<2)fillEllipse(g,cx,cy-0.4,1.8*grow,1*grow,'L');
    return toRows(g);
  }

  // =====================================================================
  // dust 32x24, 4f: a puff of grey clearing dust (bulldozer clearing a
  // debrisPile) expanding and fading — same rising/dissipating construction
  // as smokePuff, bigger and using MAT.concrete's grey instead of basalt.
  // =====================================================================
  function makeDustFrame(frame){
    var w=32,h=24,g=mkGrid(w,h),cx=w/2,cy=h/2+2-frame*0.6,grow=0.6+frame*0.5;
    fillEllipse(g,cx,cy,9*grow,5.5*grow,'D');
    fillEllipse(g,cx-2,cy-0.8,6*grow,3.6*grow,'M');
    if(frame<3)fillEllipse(g,cx+2,cy+0.5,3*grow,1.8*grow,'L');
    return toRows(g);
  }

  // =====================================================================
  // grenade 8x8: a round in flight, dark olive body, brass band, lit edge
  function makeGrenade(){return ['..KKKK..','.KLMMDK.','KLMMMMDK','KYYYYYYK','KMMMMMDK','KMMMMDDK','.KDDDDK.','..KKKK..'];}
  A.define('vfx',{
    muzzleS:{frames:{down:makeMuzzle('S',14,10)},pal:'MAT.ember',anchor:'center',fps:30,note:'14x10, 3 flicker frames, stubby directional cone + 1 spike'},
    muzzleM:{frames:{down:makeMuzzle('M',20,14)},pal:'MAT.ember',anchor:'center',fps:30,note:'20x14, 3 flicker frames, longer cone + forward spike'},
    muzzleL:{frames:{down:makeMuzzle('L',26,18)},pal:'MAT.ember',anchor:'center',fps:30,note:'26x18, 3 flicker frames, wide splayed star (shotgun)'},
    impactSpark:{frames:{down:[makeImpactFrame(0),makeImpactFrame(1),makeImpactFrame(2)]},pal:'MAT.ember',anchor:'center',note:'12x12, age sequence: irregular burst, spray, fading motes'},
    bloodHit:{frames:{down:[makeBloodHitFrame(0),makeBloodHitFrame(1),makeBloodHitFrame(2)]},pal:'MAT.blood',anchor:'center',note:'16x16, age sequence: irregular burst, spray, fading motes'},
    bloodDecal:{variants:[makeBloodDecal(0),makeBloodDecal(1),makeBloodDecal(2)],pal:'MAT.blood',anchor:'feet',note:'20x12 x3, flat dark ground pool, mostly K/D with a couple of M wet-centre texels'},
    fire:{frames:{down:[makeFireFrame(0),makeFireFrame(1),makeFireFrame(2),makeFireFrame(3),makeFireFrame(4)]},pal:'MAT.ember',anchor:'center',fps:12,note:'24x32, 5f looping burn: forked, notch-edged licks that lean and split per frame'},
    flameTongue:{frames:{down:[makeFlameTongueFrame(0),makeFlameTongueFrame(1),makeFlameTongueFrame(2),makeFlameTongueFrame(3),makeFlameTongueFrame(4)]},pal:'MAT.ember',anchor:'center',fps:24,note:'18x14, 5f, hot at -x (nozzle) tapering toward +x, tiles stamped along the aim'},
    reviveRing:{frames:{down:[makeReviveFrame(0),makeReviveFrame(1),makeReviveFrame(2),makeReviveFrame(3)]},pal:'MAT.loot',anchor:'center',note:'48x24, 4f, cyan ring expands and thins over 0.5s'},
    smokePuff:{frames:{down:[makeSmokePuffFrame(0),makeSmokePuffFrame(1),makeSmokePuffFrame(2),makeSmokePuffFrame(3)]},pal:'MAT.basalt',anchor:'center',note:'16x16, 4f, unused today: rising dissipating puff'},
    emberMote:{frames:{down:[makeEmberMoteFrame(0),makeEmberMoteFrame(1)]},pal:'MAT.ember',anchor:'center',note:'6x6, 2f, unused today: a lone drifting spark'},
    grenade:{rows:makeGrenade(),pal:{K:'#0b1216',D:'#2c3624',M:'#4f5d3a',L:'#7d8a5c',Y:'#b8963f'},anchor:'center',note:'8x8 grenade round in flight'},
    explosion:{frames:{down:[makeExplosionFrame(0),makeExplosionFrame(1),makeExplosionFrame(2),makeExplosionFrame(3),makeExplosionFrame(4)]},pal:'MAT.ember',anchor:'center',note:'28x28, 5f, unused today: fast expand then a scalloped, settling ember blob'},
    pickupSparkle:{frames:{down:[makePickupSparkleFrame(0),makePickupSparkleFrame(1),makePickupSparkleFrame(2),makePickupSparkleFrame(3)]},pal:'MAT.loot',anchor:'center',note:'10x10, 4f, unused today: small twinkle'},
    footDust:{frames:{down:[makeFootDustFrame(0),makeFootDustFrame(1),makeFootDustFrame(2)]},pal:'MAT.concrete',anchor:'center',note:'12x8, 3f, unused today: small ground puff'},
    dust:{frames:{down:[makeDustFrame(0),makeDustFrame(1),makeDustFrame(2),makeDustFrame(3)]},pal:'MAT.concrete',anchor:'center',note:'32x24, 4f, expanding fading grey clearing-dust puff (bulldozer)'}
  });
})();
