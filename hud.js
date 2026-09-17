(function(root){
  'use strict';
  // In-canvas HUD and menus, drawn every frame after the world (pixel-horde
  // style: bold Courier New on the screen context, translucent panels, and
  // 9-slice frames from the hud art family when it is registered).
  //
  // city_v2 Section 0: the live HUD is a thin top edge plus one bottom dock (four player strips and one attached
  // squad-supplies row). Its sizes are CSS pixels scaled by u = clamp(min(H/720, W/1024), 1, 1.6) x the UI-scale
  // option, so core text never drops under 12 px and the reserved bands stay a fixed share of the viewport. Menus
  // keep their older k = clamp(width/1180, .68, 1.6) layout.
  const COL={paper:'#e2e7d7',muted:'#8a9a94',dim:'#5f6f6a',mint:'#79e2cf',orange:'#ff8b3d',red:'#ff5a47',gold:'#ffd249',ink:'#080e12',line:'#35443e',panel:'rgba(8,14,18,.80)',panelSolid:'#0d171c'};
  // district cards read the world's canonical table, in the order the campaign chain visits them
  const CHAIN=['checkpoint','industry','ruins','hospital','quarantine','northline'];
  const districtCards=()=>root.DSWorld.DISTRICTS.filter(d=>d.card).sort((a,b)=>CHAIN.indexOf(a.id)-CHAIN.indexOf(b.id)).map(d=>[d.id,d.mapLabel,d.card.role,d.card.note,d.mapPalette?d.mapPalette.light:d.color]);
  const MANUAL=[['01 / THE RUN','Get everyone out through Checkpoint Nine. The gate needs emergency power, the override and a finished broadcast. Ashworks fuel restarts the chapel generator; St. Orison\'s records point to Patient Furnace; killing it frees the override and the payload Blackglass needs. Notices and the map show the way. Go in any order and come back often. Committing to the fight in the fenced yard seals the gates and locks its difficulty; the kill does not end the run.'],['02 / STAY QUIET','Walk quietly. Hold Shift / RT to run; stamina recovers after a short rest. If exhausted, release run. R / RB eats a squad ration so stamina recovers faster; rations never heal. Shots, healing, reloading and breaking wreckage make noise; amber rings show how far it carries. Infected search where they last heard you.'],['03 / THE SQUAD','H / B uses one of your own medkits: +50 HP, only when hurt. Carry up to 3; walking over a kit collects it, it does not heal. Stand near a fallen teammate for three seconds to revive them. Stay together under one camera. Level-ups wait in Pause: each survivor picks their own upgrade there. Tab / View opens the city map.'],['04 / WEAPONS AND WHEELS','E / A takes a weapon or boards a vehicle. F / X enables autofire (starts off). Carry four weapons solo, three each in co-op, plus an unlimited pistol; Q / Y cycles them. Magazines reload from the squad reserve. Driving: W / RT accelerates, S / LT brakes and then reverses, A/D or the stick steers. Holding both triggers brakes to a stop.']];
  const SHORT={pistol:'PISTOL',ar:'AR',shotgun:'SHOTGUN',smg:'SMG',rifle:'RIFLE',flame:'FLAMER',launcher:'LAUNCHER'};
  const ui={menu:null,focus:0,stack:[],pointer:{x:-1,y:-1},items:[],hover:null,upgradeFor:null,objective:null,location:null,arrive:0,panels:[]};
  let k=1,u=1,W=0,H=0,bindings={state:()=>null,restart:()=>{},resume:()=>{},toTitle:()=>{}};
  let last={top:0,bottom:0};
  const prefs={scale:'default',minimap:true};
  try{if(root.localStorage){prefs.scale=localStorage.getItem('dead-signal-ui-scale')==='large'?'large':'default';prefs.minimap=localStorage.getItem('dead-signal-minimap')!=='off';}}catch{}
  function savePrefs(){try{localStorage.setItem('dead-signal-ui-scale',prefs.scale);localStorage.setItem('dead-signal-minimap',prefs.minimap?'on':'off');}catch{}}

  function bind(b){Object.assign(bindings,b);}
  function state(){return bindings.state();}
  // The one gameplay safe rectangle: main.js derives the camera aspect from it and render.js centres the world in it.
  function layout(width,height){
    W=width;H=height;k=Math.max(.68,Math.min(1.6,width/1180));
    u=Math.max(1,Math.min(1.6,Math.min(height/720,width/1024)))*(prefs.scale==='large'?1.25:1);
    const top=Math.round(30*u),bottom=Math.round(80*u);
    last={k,u,top,bottom,band:bottom,safe:{x:0,y:top,w:width,h:Math.max(0,height-top-bottom)}};return last;
  }
  // ---- primitives ----
  function font(size,weight){return (weight||'bold')+' '+Math.max(7,Math.round(size*k))+'px "Courier New",Consolas,monospace';}
  function text(g,str,x,y,size,col,align,weight,shadow){
    g.font=font(size,weight);g.textAlign=align||'left';g.textBaseline='top';
    if(shadow!==false){g.fillStyle='#05090ccc';g.fillText(str,Math.round(x)+1,Math.round(y)+1);}
    g.fillStyle=col||COL.paper;g.fillText(str,Math.round(x),Math.round(y));
  }
  // live-HUD text in CSS pixels (size is in u units; 12 is the core minimum)
  function ufont(size,weight){return (weight||'bold')+' '+Math.round(size*u)+'px "Courier New",Consolas,monospace';}
  function utext(g,str,x,y,size,col,align,weight){
    g.font=ufont(size,weight);g.textAlign=align||'left';g.textBaseline='top';
    g.fillStyle='#05090ce6';g.fillText(str,Math.round(x)+1,Math.round(y)+1);g.fillStyle=col||COL.paper;g.fillText(str,Math.round(x),Math.round(y));
  }
  function umeasure(g,str,size,weight){g.font=ufont(size,weight);return g.measureText(str).width;}
  function fit(g,str,size,maxW,weight){if(umeasure(g,str,size,weight)<=maxW)return str;let t=str;while(t.length>1&&umeasure(g,t+'…',size,weight)>maxW)t=t.slice(0,-1);return t+'…';}
  function display(g,str,x,y,size,col,align){
    g.font='900 '+Math.round(size*k)+'px Impact,"Arial Black",sans-serif';g.textAlign=align||'left';g.textBaseline='top';
    g.fillStyle='#05090c';g.fillText(str,Math.round(x)+3,Math.round(y)+3);g.fillStyle=col||COL.paper;g.fillText(str,Math.round(x),Math.round(y));
  }
  function measure(g,str,size,weight){g.font=font(size,weight);return g.measureText(str).width;}
  function wrap(g,str,size,maxW,live){const words=str.split(' '),lines=[];let line='';g.font=live?ufont(size,'normal'):font(size,'normal');for(const w of words){const t=line?line+' '+w:w;if(g.measureText(t).width>maxW&&line){lines.push(line);line=w;}else line=t;}if(line)lines.push(line);return lines;}
  const hasArt=n=>!!(root.DSArt&&root.DSArt.spec(n));
  // a panel: hud/panel9 9-slice when the art exists (8x8 texel pieces at an integer zoom), else a fill with a 1px line
  function panel(g,x,y,w,h,style,zoom){
    x=Math.round(x);y=Math.round(y);w=Math.round(w);h=Math.round(h);
    const name='hud/panel9'+(style==='alert'?'Alert':style==='gold'?'Gold':'');
    if(hasArt(name)){
      const z=zoom||Math.max(1,Math.round(k*1.6)),sp=root.DSArt.sprite(name),pw=sp.w/3,ph=sp.h/3,c=sp.canvas;
      // honour style==='solid': dialog() is a modal over the running game and has to be opaque
      g.save();g.imageSmoothingEnabled=false;g.fillStyle=style==='solid'?COL.panelSolid:COL.panel;g.fillRect(x+z,y+z,w-2*z,h-2*z);
      const dz=pw*z;
      g.drawImage(c,pw,ph,pw,ph,x+dz,y+dz,w-2*dz,h-2*dz);
      g.drawImage(c,pw,0,pw,ph,x+dz,y,w-2*dz,dz);g.drawImage(c,pw,ph*2,pw,ph,x+dz,y+h-dz,w-2*dz,dz);
      g.drawImage(c,0,ph,pw,ph,x,y+dz,dz,h-2*dz);g.drawImage(c,pw*2,ph,pw,ph,x+w-dz,y+dz,dz,h-2*dz);
      g.drawImage(c,0,0,pw,ph,x,y,dz,dz);g.drawImage(c,pw*2,0,pw,ph,x+w-dz,y,dz,dz);g.drawImage(c,0,ph*2,pw,ph,x,y+h-dz,dz,dz);g.drawImage(c,pw*2,ph*2,pw,ph,x+w-dz,y+h-dz,dz,dz);
      g.restore();return;
    }
    g.fillStyle='#05090c';g.fillRect(x+3,y+3,w,h);
    g.fillStyle=style==='solid'?COL.panelSolid:COL.panel;g.fillRect(x,y,w,h);
    g.strokeStyle=style==='alert'?COL.red+'99':style==='gold'?COL.orange+'99':COL.line;g.lineWidth=1;g.strokeRect(x+.5,y+.5,w-1,h-1);
  }
  // a flat live-HUD plate: no 9-slice, so thin rows stay thin
  function plate(g,x,y,w,h,edge){x=Math.round(x);y=Math.round(y);w=Math.round(w);h=Math.round(h);g.fillStyle='rgba(7,12,15,.84)';g.fillRect(x,y,w,h);g.strokeStyle=edge||COL.line;g.lineWidth=1;g.strokeRect(x+.5,y+.5,w-1,h-1);}
  function bar(g,x,y,w,h,q,col,back){g.fillStyle=back||'#10170e';g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));g.fillStyle=col;g.fillRect(Math.round(x),Math.round(y),Math.round(w*Math.max(0,Math.min(1,q))),Math.round(h));g.strokeStyle=COL.line;g.lineWidth=1;g.strokeRect(Math.round(x)+.5,Math.round(y)+.5,Math.round(w)-1,Math.round(h)-1);}
  function clock(t){return Math.floor(t/60).toString().padStart(2,'0')+':'+Math.floor(t%60).toString().padStart(2,'0');}
  function item(id,x,y,w,h,run){ui.items.push({id,x,y,w,h,run});return ui.items.length-1;}
  // persistent live-HUD rectangles, counted toward the Section 0 area budget
  function rec(id,x,y,w,h){ui.panels.push({id,x:Math.round(x),y:Math.round(y),w:Math.round(w),h:Math.round(h)});}
  const L=(p,action)=>root.DSGame.label(p,action);

  // ---- the play HUD ----
  // the named place the squad is standing in: the smallest authored location rectangle around the group
  function placeName(s){
    const living=s.players.filter(p=>!p.dead),group=living.length?living:s.players;if(!group.length||!s.world)return null;
    const x=group.reduce((n,p)=>n+p.x,0)/group.length,y=group.reduce((n,p)=>n+p.y,0)/group.length;let best=null;
    for(const l of s.world.locations||[]){if(l.kind==='cache')continue;const r=l.rect;if(x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h&&(!best||r.w*r.h<best.rect.w*best.rect.h))best=l;}
    return best;
  }
  function drawTop(g,s){
    const zone=root.DSWorld.district(s.camera.x,s.camera.y),top=last.top,pad=6*u,now=(root.performance?performance.now():Date.now())/1000;
    // left cluster: district and named place; a new place glows briefly on arrival
    const place=placeName(s),pid=place?place.id:null;
    if(pid!==ui.location){ui.location=pid;if(pid)ui.arrive=now;}
    const fresh=place&&now-ui.arrive<2.5,name=zone.name.toUpperCase(),maxW=Math.min(W*.36,420*u);
    let label=place?fit(g,place.name,12,maxW-umeasure(g,name+' · ',12)-16*u):'';
    const lw=umeasure(g,name,12)+(label?umeasure(g,' · '+label,12):0)+16*u;
    plate(g,pad,4*u,lw,top-8*u);rec('top-left',pad,4*u,lw,top-8*u);
    utext(g,name,pad+8*u,8*u,12,zone.color);if(label)utext(g,' · '+label,pad+8*u+umeasure(g,name,12),8*u,12,fresh?COL.gold:COL.paper);
    // centre: the elapsed clock, also during the boss fight
    const cw=umeasure(g,'00:00',13)+18*u,cx=W/2-cw/2;plate(g,cx,4*u,cw,top-8*u);rec('clock',cx,4*u,cw,top-8*u);utext(g,clock(s.time),W/2,8*u,13,COL.paper,'center');
    // right: map and pause affordances
    const bh=top-8*u,px=W-pad-bh,py=4*u,hov=ui.hover==='pause';
    g.fillStyle=hov?COL.orange:'rgba(7,12,15,.84)';g.fillRect(px,py,bh,bh);g.strokeStyle=COL.line;g.strokeRect(px+.5,py+.5,bh-1,bh-1);
    g.fillStyle=hov?COL.ink:COL.paper;g.fillRect(px+bh*.32,py+bh*.25,bh*.13,bh*.5);g.fillRect(px+bh*.55,py+bh*.25,bh*.13,bh*.5);
    item('pause',px,py,bh,bh,()=>togglePause());rec('pause',px,py,bh,bh);
    const mw=umeasure(g,'MAP',12)+16*u,mx=px-mw-4*u,mh=ui.hover==='map-button';
    g.fillStyle=mh?'#1d2b30':'rgba(7,12,15,.84)';g.fillRect(mx,py,mw,bh);g.strokeStyle=COL.line;g.strokeRect(mx+.5,py+.5,mw-1,bh-1);
    utext(g,'MAP',mx+mw/2,py+(bh-12*u)/2,12,mh?COL.gold:COL.paper,'center');item('map-button',mx,py,mw,bh,()=>press('map'));rec('map-button',mx,py,mw,bh);
  }
  // Patient Furnace: a compact health/cast strip under the clock; its area is counted separately in report()
  function drawBoss(g,s){
    const b=s.boss;if(!b||!b.active)return 0;const w=Math.min(440*u,W*.42),h=34*u,x=W/2-w/2,y=last.top+2*u;
    plate(g,x,y,w,h,'#5a2a24');rec('boss',x,y,w,h);
    utext(g,'PATIENT FURNACE · PHASE '+b.phase,x+8*u,y+3*u,12,COL.paper);
    utext(g,fit(g,b.castName||'WATCH THE FURNACE',12,w*.45),x+w-8*u,y+3*u,12,COL.gold,'right');
    bar(g,x+8*u,y+18*u,w-16*u,7*u,b.hp/b.maxHp,COL.red,'#3a1218');bar(g,x+8*u,y+27*u,w-16*u,3*u,b.castProgress||0,COL.orange,'#10170e');
    return h+4*u;
  }
  // The objective is no longer a permanent card: a change is announced once, and the current one lives in Pause.
  function objectiveText(s,boss){
    const c=s.campaign||{},knows=id=>(c.known||[]).includes(id)||Object.values(c.evidence||{}).some(Boolean)&&id==='patient-furnace';
    if(boss)return ['CONTAIN PATIENT FURNACE','Read the tells. Keep your squad alive.'];
    if(c.escaped)return ['OUT OF THE CITY','The Linden Street group is with you.'];
    if(c.gateOpen)return ['GET EVERYONE SOUTH','The barrier is open. Nobody is left behind.'];
    if(c.transmitted&&c.override&&s.circuit?.emergency)return ['OPEN CHECKPOINT NINE','Power, override and the call are ready.'];
    if(c.transmitted)return ['SOMEONE ANSWERED','A civilian group waits at Checkpoint Nine.'];
    if(c.payload&&c.prepared)return ['SEND THE EVIDENCE','Blackglass is prepared. Hold the transmitter.'];
    if(c.payload)return ['A BAND AND A RECORD','The payload needs a working transmitter.'];
    if(c.bossDown)return ['THE FURNACE IS SILENT','The command post is no longer sealed.'];
    if(c.evidence?.furnaceClue||c.evidence?.patientRecords)return ['THE SUBJECT IN THE YARD','Records point to Central Quarantine.'];
    if(s.circuit?.emergency)return ['EMERGENCY CIRCUIT LIVE','Blackglass and the checkpoint have power.'];
    if(knows('chapel'))return ['NO POWER, NO WAY OUT','The chapel generator runs the emergency circuit.'];
    return ['GET THE CITY OUT','Scavenge. Read what the evacuation left behind.'];
  }
  function trackObjective(s){
    const [title]=objectiveText(s,s.boss&&s.boss.active);
    if(ui.objective&&ui.objective!==title&&root.DSGame&&s.mode==='play')root.DSGame.announce(s,'OBJECTIVE · '+title);
    ui.objective=title;
  }
  // one short-lived notice slot under the top edge, plus the last document read (readable evidence)
  function drawNotices(g,s,below){
    let y=last.top+below+6*u;
    if(s.bannerT>0&&s.banner){const w=Math.min(W-40*u,umeasure(g,s.banner,13)+28*u),x=W/2-w/2,h=24*u;
      g.save();g.globalAlpha=Math.min(1,s.bannerT*2);plate(g,x,y,w,h);utext(g,fit(g,s.banner,13,w-20*u),W/2,y+5*u,13,'#fff0dd','center');g.restore();y+=h+6*u;}
    if(s.document){const d=s.document,dw=Math.min(W*.34,440*u),lines=wrap(g,d.body,12,dw-24*u,true),dh=(28+lines.length*15)*u,dx=6*u,dy=last.top+6*u;
      g.save();g.globalAlpha=Math.min(1,(d.t??9)*1.5);plate(g,dx,dy,dw,dh);g.fillStyle=COL.gold;g.fillRect(dx,dy,3*u,dh);utext(g,d.title,dx+12*u,dy+6*u,12,COL.gold);
      lines.forEach((ln,i)=>utext(g,ln,dx+12*u,dy+(23+i*15)*u,12,COL.paper,'left','normal'));g.restore();}
  }
  function minimapRect(){const size=Math.floor(Math.min(W,H)*.18);return {x:W-6*u-size,y:last.top+6*u,w:size,h:size};}
  function drawMinimap(g,s){
    if(!prefs.minimap)return;const r=minimapRect();
    plate(g,r.x,r.y,r.w,r.h);rec('minimap',r.x,r.y,r.w,r.h);
    root.DSWorld.drawMap(g,s,r.x+2,r.y+2,r.w-4,r.h-4,root.DSWorld.mapView(s,true));
    g.fillStyle='rgba(7,12,15,.8)';const tw=umeasure(g,'⤢ '+L(s.players[0],'map'),11,'normal')+8*u;g.fillRect(r.x+r.w-tw-2,r.y+r.h-15*u-2,tw,15*u);
    utext(g,'⤢ '+L(s.players[0],'map'),r.x+r.w-6*u,r.y+r.h-14*u,11,COL.muted,'right','normal');
    item('map',r.x,r.y,r.w,r.h,()=>press('map'));
  }
  function promptText(s){
    const G=root.DSGame,living=s.players.filter(p=>!p.dead);let message='',sub='';
    const key=(p,a)=>'[ '+L(p,a)+' ] ',tag=p=>'P'+(p.id+1)+' ';
    // a survivor down outranks every stash, vehicle or door hint
    const down=s.players.find(p=>p.dead);
    if(down&&living.length){const helper=living.some(q=>Math.hypot(q.x-down.x,q.y-down.y)<48);message=tag(down)+'DOWN · '+(helper?'REVIVING '+Math.round(down.revive/3*100)+'%':'NEEDS A TEAMMATE');sub=helper?'Stay beside them':'Stand beside them for three seconds to revive';return {message,sub,alert:true};}
    // turret actions in progress (PLAYER_POWER Phase 6): deploying and loading show their progress before any new hint
    for(const p of living){const T=G.TURRET;
      if(p.deploying){message=tag(p)+'DEPLOYING TURRET · '+Math.floor(Math.min(1,p.deploying.t/T.deploy)*100)+'%';sub='Stand still · moving or taking a hit cancels';return {message,sub};}
      const r=p.resupply&&(s.turrets||[]).find(t=>t.id===p.resupply.id);if(r){message=tag(p)+'LOADING TURRET · '+r.ammo+'/'+T.cap;sub='BUL '+s.ammo.bullets+' · walk away to stop';return {message,sub};}}
    for(const p of living){if(p.vehicle!=null)continue;const it=G.nearestInteract(s,p);if(it){const def=G.WEAPONS[it.weapon],up=G.upgradeTarget(s,p,it);
      if(up>=0){const w=p.weaponInventory[up],nx=G.nextAttachment(w);message=tag(p)+key(p,'interact')+'UPGRADE '+def.name+' · '+nx.label;sub='Tier '+((w.attachments||[]).length+1)+'/3 · '+nx.description+(up===(p.weaponSlot??0)&&!p.backup?'':' · slot '+(up+1))+' · or leave it for a teammate';break;}
      message=tag(p)+key(p,'interact')+def.name+' '+('*'.repeat(it.quality||1))+((it.attachments||[]).length?' +'+it.attachments.length:'');sub=(p.weaponInventory.length<G.weaponCap(s)?'Equip slot '+(p.weaponInventory.length+1):'Replace '+G.WEAPONS[p.weapon||p.weaponInventory[p.weaponSlot??0].weapon].name)+' · '+def.ammo.toUpperCase();break;}}
    // refuelling first: pouring a jerrycan or fuelling the chapel generator (one press, stay beside it)
    if(!message)for(const p of living){const sup=s.supplies;
      if(p.refuel){const r=p.refuel;message=tag(p)+(r.kind==='generator'?'FUELLING THE GENERATOR · ':'POURING FUEL · ')+Math.floor(r.progress/r.time*100)+'%';sub='Stay beside it · moving away stops the pour, nothing is lost';break;}
      const t=G.refuelTarget(s,p);if(!t)continue;
      if(t.kind==='generator'){message=tag(p)+key(p,'interact')+'FUEL THE GENERATOR · '+G.FUEL.generatorCharge+' L';sub='Restores the emergency circuit · you carry '+sup.vehicleFuel+' L';}
      else{const v=t.vehicle,Lt=G.FUEL.distancePerLitre;message=tag(p)+key(p,'interact')+'POUR A JERRYCAN · '+Math.round(v.fuel/Lt)+'/'+Math.round(v.maxFuel/Lt)+' L';sub=G.pourable(s)>0?'Squad fuel '+sup.vehicleFuel+' L'+(sup.generatorFuelled?'':' · '+G.FUEL.reserve+' L kept for the chapel generator'):'No spare fuel · the last '+G.FUEL.reserve+' L are for the generator';}
      break;}
    const NAME={sedan:'CAR',fireTruck:'FIRE TRUCK',bulldozer:'BULLDOZER'};
    if(!message)for(const p of living){const riding=G.vehicleFor(s,p),v=riding||G.nearestVehicle(s,p);if(!v)continue;const nm=NAME[v.vehicleType]||'CAR';
      message=tag(p)+key(p,'interact')+(riding?'LEAVE THE '+nm:v.fuel<=0?'EMPTY TANK':v.driver!=null?'RIDE':'DRIVE THE '+nm);
      if(riding&&v.driver===p.id){const pads=G.deviceOf(p)!=='keyboard',dir=s.settings.drivingStyle==='directional';
        sub=(pads?L(p,'gas')+' gas · '+L(p,'brake')+' brake, then reverse · stick '+(dir?'points the way':'steers'):dir?'WASD points the way · S backs up':'W gas · S brake, then reverse · A/D steer')+(v.vehicleType==='bulldozer'?' · push the blade into rubble':'');}
      else sub=riding?'Passenger · fire out the windows · '+L(p,'heal')+' heals':v.fuel<=0?'Out of fuel · pour a jerrycan':'Fuel '+Math.round(v.fuel/v.maxFuel*100)+'% · loud · runs the infected down';break;}
    // The placard is 28x34 texels, so no lettering on it can be legible. The
    // sprite carries the silhouette and the survivor reads the form here.
    if(!message){const pl=(s.world.props||[]).find(o=>o.art==='props/signPlacard'&&living.some(p=>Math.hypot(p.x-o.x,p.y-o.y)<110));
      if(pl){message='SUBJECT [ REDACTED ]  ·  DISPOSITION FURNACE';sub='CENTRAL QUARANTINE · CONTAINMENT BLOCK C · NO ENTRY';}}
    if(!message&&!s.boss){const p=living.find(p=>Math.hypot(p.x,p.y)<170);if(p){message=tag(p)+key(p,'interact')+'BREACH CONTAINMENT';sub='Commit the squad · boss difficulty locks at outbreak '+s.threat;}}
    if(!message&&s.campaign){const c=s.campaign;
      for(const [action,label] of [['prepare','PREPARE THE STATION'],['transmit','TRANSMIT'],['gate','OPEN THE BARRIER']]){
        const done=action==='prepare'?c.prepared:action==='transmit'?c.transmitted:c.gateOpen,pt=G.holdPoint(s,action);if(done||!pt)continue;
        const p=living.find(p=>Math.hypot(p.x-pt.x,p.y-pt.y)<(action==='gate'?110:95));if(!p)continue;
        const why=G.campaignMissing(s,action),prog=c[action+'Progress']/G.HOLDS[action];
        message=c.holding===action?label+' · '+Math.floor(prog*100)+'%':why.length?label+' · NOT YET':tag(p)+key(p,'interact')+label;
        sub=c.holding===action?(action==='prepare'?'Stay in the control room':'Loud · hold here · leaving keeps the progress'):why.length?why.join(' · '):prog>0?'Resume · '+Math.floor(prog*100)+'% done':'One press starts · stay in reach';break;}}
    if(!message){const near=s.players.find(p=>p.nearDoor!=null),d=near?G.doorById(s,near.nearDoor):Object.keys(s.doorState||{}).map(id=>s.doorState[id].active&&!s.doorState[id].open?G.doorById(s,id):null).find(d=>d&&living.some(p=>Math.hypot(p.x-d.rect.x-d.rect.w/2,p.y-d.rect.y-d.rect.h/2)<90));
      if(d){const st=s.doorState[d.id],p=near||living[0];message=st.active?'FORCING THE DOOR · '+Math.floor(st.progress/d.access.time*100)+'%':tag(p)+key(p,'interact')+'FORCE THE DOOR';sub=st.active?'Loud work · stay beside it':'Secured door · forcing it carries far';}}
    if(!message)for(const p of living){if(p.vehicle!=null)continue;const t=G.nearestTurret(s,p);if(!t)continue;const T=G.TURRET,mine=t.ownerId===p.id||!s.players.some(q=>q.id===t.ownerId);
      message=tag(p)+(t.ammo<T.cap?key(p,'interact')+'LOAD TURRET · '+t.ammo+'/'+T.cap:'TURRET FULL · '+t.ammo+'/'+T.cap)+(mine?'  '+key(p,'deploy')+'PACK UP':'');
      sub=(t.ammo<T.cap?'Uses squad BUL · '+s.ammo.bullets+' left':'Ready')+' · wear '+Math.round(100-t.durability/T.durability*100)+'%'+(mine?'':' · owner packs it up');break;}
    if(!message&&(s.world.buildings||[]).some(h=>h.occupied&&s.loot.some(l=>l.interior&&l.x>h.x&&l.x<h.x+h.w&&l.y>h.y&&l.y<h.y+h.h))){message='STASH INSIDE';sub='Walk over supplies to take them';}
    return message?{message,sub}:null;
  }
  function drawPrompt(g,s){
    const p=promptText(s);if(!p)return;const w=Math.min(W-24*u,Math.max(umeasure(g,p.message,13),umeasure(g,p.sub,12,'normal'))+28*u),x=W/2-w/2,h=38*u,y=H-last.bottom-h-30*u;
    plate(g,x,y,w,h,p.alert?COL.red+'aa':COL.orange+'99');utext(g,fit(g,p.message,13,w-16*u),W/2,y+4*u,13,p.alert?COL.red:COL.gold,'center');utext(g,fit(g,p.sub,12,w-16*u,'normal'),W/2,y+21*u,12,COL.muted,'center','normal');
  }
  // the squad dock: one attached supplies row over one row of player strips
  function drawDock(g,s){
    const G=root.DSGame,y0=H-last.bottom,m=6*u;
    g.fillStyle='rgba(6,11,14,.9)';g.fillRect(0,y0,W,last.bottom);g.fillStyle=COL.line;g.fillRect(0,y0,W,1);rec('dock',0,y0,W,last.bottom);
    // SQUAD supplies row
    let x=m;const ry=y0+3*u,sup=s.supplies||{provisions:0,vehicleFuel:0};
    utext(g,'SQUAD',x,ry,12,COL.muted);x+=umeasure(g,'SQUAD',12)+10*u;
    const rows=[['▰',s.ammo.bullets,'BUL'],['▥',s.ammo.shells,'SHL'],['◩',s.ammo.fuel,'INCEND'],['◍',sup.provisions,'RATION'],['▣',sup.vehicleFuel,'L FUEL']];
    if((s.ammo.grenades||0)>0||s.players.some(p=>p.weaponInventory.some(w=>w.weapon==='launcher')))rows.splice(3,0,['●',s.ammo.grenades||0,'GREN']);
    const lvl='LV '+s.level,right=W-m-umeasure(g,lvl,12)-Math.min(120*u,W*.1)-8*u;
    for(const [glyph,value,lab] of rows){const t=glyph+' '+value+' ',lw=umeasure(g,lab,12,'normal');if(x+umeasure(g,t,12)+lw>right)break;
      utext(g,glyph,x,ry,12,COL.gold);x+=umeasure(g,glyph+' ',12);utext(g,String(value),x,ry,12,COL.paper);x+=umeasure(g,value+' ',12);utext(g,lab,x,ry,12,COL.muted,'left','normal');x+=lw+14*u;}
    const bw=Math.min(120*u,W*.1);utext(g,lvl,W-m-bw-8*u,ry,12,COL.mint,'right');bar(g,W-m-bw,ry+4*u,bw,5*u,s.xp/s.nextXp,COL.mint);
    g.fillStyle=COL.line+'aa';g.fillRect(m,y0+18*u,W-2*m,1);
    // player strips
    const n=Math.max(1,s.players.length),gap=4*u,sw=Math.min(380*u,(W-2*m-gap*(n-1))/n),sy=y0+21*u,sh=last.bottom-25*u;
    s.players.forEach((p,i)=>strip(g,s,p,m+i*(sw+gap),sy,sw,sh));
  }
  function strip(g,s,p,x,y,w,h){
    const G=root.DSGame,def=G.WEAPONS[p.backup||!p.weapon?'pistol':p.weapon],vehicle=G.vehicleFor(s,p),driver=vehicle?.driver===p.id,in_=6*u;
    g.fillStyle='rgba(12,20,24,.9)';g.fillRect(x,y,w,h);g.fillStyle=p.color;g.fillRect(x,y,3*u,h);g.strokeStyle=p.dead?COL.red+'aa':COL.line;g.strokeRect(Math.round(x)+.5,Math.round(y)+.5,Math.round(w)-1,Math.round(h)-1);
    const lx=x+in_+3*u,rx=x+w-in_;
    // row A: P#, HP and the heal affordance (downed: revive progress instead)
    let ry=y+3*u;const tagW=umeasure(g,'P4',12)+6*u;utext(g,'P'+(p.id+1),lx,ry,12,p.color);
    if(p.dead){
      const helper=s.players.some(q=>!q.dead&&Math.hypot(q.x-p.x,q.y-p.y)<48),t=helper?'REVIVING':'DOWN · NEED A TEAMMATE';
      utext(g,fit(g,t,12,rx-lx-tagW),lx+tagW,ry,12,COL.red);
    }else{
      const hurt=p.hp<p.maxHp,can=hurt&&p.medkits>0,chip='['+L(p,'heal')+'] HEAL ×'+p.medkits,cw=umeasure(g,chip,12)+8*u,hpT=String(Math.ceil(p.hp)),hw=umeasure(g,'100',12)+6*u;
      const cx=rx-cw;g.fillStyle=can?'#1f4a41':'#10191d';g.fillRect(cx,ry-1*u,cw,15*u);g.strokeStyle=can?COL.mint:COL.line;g.strokeRect(Math.round(cx)+.5,Math.round(ry-1*u)+.5,Math.round(cw)-1,Math.round(15*u)-1);
      utext(g,chip,cx+4*u,ry,12,can?COL.mint:p.medkits?COL.muted:COL.dim);
      const bx=lx+tagW,bwid=Math.max(20*u,cx-6*u-hw-bx);bar(g,bx,ry+3*u,bwid,8*u,p.hp/p.maxHp,p.hp/p.maxHp<.35?COL.red:p.color,'#180b08');
      utext(g,hpT,bx+bwid+hw,ry,12,p.hp/p.maxHp<.35?COL.red:COL.paper,'right');
    }
    // row B: weapon and magazine, fire state
    ry=y+19*u;
    const rounds=p.dead?'—':def.ammo?p.mag+'/'+(p.backup||!p.weapon?def.mag:G.magFor({weapon:p.weapon,attachments:p.attachments})):'∞',mw=umeasure(g,rounds,12);utext(g,rounds,rx,ry,12,COL.gold,'right');
    const fire=driver?'DRIVING':p.reload&&!p.backup?'RELOAD':p.auto?'● AUTO':'○ HOLD',fw=umeasure(g,fire,12);utext(g,fire,rx-mw-10*u,ry,12,driver?COL.paper:p.reload&&!p.backup?COL.orange:p.auto?COL.mint:COL.orange,'right');
    const mods=p.backup||!p.weapon?0:(p.attachments||[]).length,wname=SHORT[p.backup||!p.weapon?'pistol':p.weapon]+(p.backup||!p.weapon?'':' '+'*'.repeat(p.quality||1))+(mods?' +'+mods:'');
    utext(g,fit(g,wname,12,rx-mw-fw-20*u-lx),lx,ry,12,COL.paper);
    // row C: conditional details (vehicle, stamina, regroup, upgrade badge)
    ry=y+35*u;let cx=lx,right=rx;
    if(p.upgrades>0){const t='▲ '+p.upgrades+' UPGRADE'+(p.upgrades>1?'S':''),bw=umeasure(g,t,12)+8*u,bx=rx-bw,hov=ui.hover==='up:'+p.id;
      g.fillStyle=hov?'#5b3a10':'#3a260c';g.fillRect(bx,ry-1*u,bw,15*u);g.strokeStyle=COL.gold;g.strokeRect(Math.round(bx)+.5,Math.round(ry-1*u)+.5,Math.round(bw)-1,Math.round(15*u)-1);
      utext(g,t,bx+4*u,ry,12,COL.gold);item('up:'+p.id,bx,ry-1*u,bw,15*u,()=>openUpgrade(p.id));right=bx-8*u;}
    if(p.dead){bar(g,cx,ry+4*u,right-cx,5*u,p.revive/3,COL.red,'#2a0e0c');}
    else if(vehicle){const fq=vehicle.fuel/vehicle.maxFuel,iq=vehicle.integrity/vehicle.maxIntegrity,half=(right-cx-8*u)/2;
      utext(g,'FUEL',cx,ry,12,fq<.15?COL.red:COL.orange);const fwid=umeasure(g,'FUEL ',12);bar(g,cx+fwid,ry+4*u,half-fwid,5*u,fq,COL.orange);
      const hx=cx+half+8*u,smoking=iq<.35;utext(g,'HULL',hx,ry,12,smoking?COL.red:COL.muted);bar(g,hx+fwid,ry+4*u,half-fwid,5*u,iq,smoking?COL.red:COL.gold);}
    else if(p.tether){utext(g,'STAY WITH SQUAD',cx,ry,12,COL.red);}
    else if(p.running||p.stamina<p.maxStamina-.5){const t=p.sprintExhausted?'WINDED':p.fed>0?'FED':'STA';utext(g,t,cx,ry,12,p.sprintExhausted?COL.red:p.fed>0?'#b8d86b':COL.muted);const tw=umeasure(g,'WINDED ',12);bar(g,cx+tw,ry+5*u,right-cx-tw,3*u,p.stamina/p.maxStamina,COL.gold);}
    else if(p.turret){utext(g,fit(g,'TURRET CARRIED · '+p.turret.ammo+' RDS · '+L(p,'deploy')+' DEPLOY',12,right-cx),cx,ry,12,COL.muted);}
    // player-owned feedback floats just above that player's strip
    if(p.notice){const t=p.notice.text,nw=Math.min(W-12*u,umeasure(g,t,12)+14*u),nx=Math.max(6*u,Math.min(W-6*u-nw,x)),nyy=y-21*u-17*u;
      g.save();g.globalAlpha=Math.min(1,p.notice.t*3);plate(g,nx,nyy,nw,17*u,p.color);utext(g,fit(g,t,12,nw-12*u),nx+7*u,nyy+2*u,12,p.notice.color||COL.paper);g.restore();}
  }

  // ---- menus ----
  function dialog(g,w,h){const x=Math.round(W/2-w/2),y=Math.round(Math.max(20*k,H/2-h/2));g.fillStyle='rgba(5,10,14,.84)';g.fillRect(0,0,W,H);panel(g,x,y,w,h,'solid');return {x,y,w,h};}
  function button(g,id,label,x,y,w,h,focused,quiet,run){
    const hov=ui.hover===id||focused;
    if(quiet){g.fillStyle=hov?'#10191d':'transparent';if(hov)g.fillRect(x,y,w,h);g.strokeStyle=hov?'#71847a4d':'transparent';if(hov)g.strokeRect(x+.5,y+.5,w-1,h-1);text(g,label,x+w/2,y+h/2-6*k,9,hov?COL.paper:COL.muted,'center');}
    else{g.fillStyle='#4b170f';g.fillRect(x+4*k,y+4*k,w,h);g.fillStyle=hov?COL.gold:COL.orange;g.fillRect(x,y,w,h);g.strokeStyle='#ffd096';g.strokeRect(x+.5,y+.5,w-1,h-1);text(g,label,x+16*k,y+h/2-6*k,10,COL.ink,'left','bold',false);text(g,'↗',x+w-16*k,y+h/2-8*k,13,COL.ink,'right','bold',false);}
    item(id,x,y,w,h,run);
  }
  function upgradePlayer(s){return s&&s.players.find(p=>p.id===ui.upgradeFor)||null;}
  function overflowPlayer(s){const id=s&&s.overflowQueue&&s.overflowQueue[0];return id==null?null:s.players.find(p=>p.id===id)||null;}
  // one line for a carried weapon instance: name, quality stars, attachments earned, loaded rounds
  function weaponLine(w){const G=root.DSGame,def=G.WEAPONS[w.weapon];return def.name+' '+'*'.repeat(w.quality||1)+(w.attachments&&w.attachments.length?' · +'+w.attachments.length+' MOD':'')+' · '+(def.ammo?w.mag+'/'+(G.magFor?G.magFor(w):def.mag):'∞');}
  function menuItems(name,s){
    if(name==='pause'){
      const list=[{id:'resume',label:'BACK TO THE STREETS',run:()=>{close();bindings.resume();}}];
      for(const p of s?s.players:[])if(p.upgrades>0)list.push({id:'upgrade:'+p.id,label:'P'+(p.id+1)+' · CHOOSE '+(p.upgrades>1?p.upgrades+' UPGRADES':'AN UPGRADE'),quiet:true,run:()=>openUpgrade(p.id)});
      list.push({id:'options',label:'OPTIONS',quiet:true,run:()=>open('options')},{id:'fullmap',label:'CITY MAP · TAB / VIEW',quiet:true,run:()=>open('fullmap')},{id:'controls',label:'CONTROLS',quiet:true,run:()=>open('controls')},{id:'manual',label:'FIELD MANUAL',quiet:true,run:()=>open('manual')},{id:'restart',label:'NEW EXPEDITION',quiet:true,run:()=>{ui.menu=null;ui.stack=[];bindings.restart();}});
      return list;
    }
    if(name==='upgrade'){const p=upgradePlayer(s);if(!p)return [{id:'back',label:'BACK',run:()=>back()}];
      return [...p.offers.map((id,j)=>({id:'offer:'+j,label:root.DSGame.UPGRADES.find(x=>x.id===id).name,run:src=>chooseUpgrade(p,j,src)})),{id:'back',label:'BACK TO PAUSE',quiet:true,run:()=>back()}];}
    if(name==='overflow'){const p=overflowPlayer(s);if(!p)return [];
      if(ui.overflowPick!=null&&p.weaponInventory[ui.overflowPick])return [{id:'confirm-drop',label:'LEAVE '+root.DSGame.WEAPONS[p.weaponInventory[ui.overflowPick].weapon].name+' HERE',run:src=>overflowDrop(p,src)},{id:'change',label:'CHOOSE ANOTHER',quiet:true,run:src=>{if(!src||src===p.source){ui.overflowPick=null;ui.focus=0;}}}];
      return p.weaponInventory.map((w,j)=>({id:'drop:'+j,label:weaponLine(w),quiet:true,run:src=>{if(!src||src===p.source){ui.overflowPick=j;ui.focus=0;}}}));}
    if(name==='controls')return [{id:'back',label:'BACK TO PAUSE',quiet:true,run:()=>back()}];
    if(name==='options')return [
      {id:'driving-style',label:'DRIVING · '+(s.settings.drivingStyle==='directional'?'DIRECTIONAL':'CAR-RELATIVE'),
        description:s.settings.drivingStyle==='directional'?'WASD / arrows or the stick point a world direction; the vehicle turns toward it. Controllers still use RT gas and LT brake / reverse.':'W / Up accelerates; S / Down brakes, then reverses; A/D steers. Controllers: RT gas, LT brake then reverse, stick steers.',
        run:()=>bindings.setDrivingStyle(s.settings.drivingStyle==='directional'?'steering':'directional')},
      {id:'music',label:'MUSIC · '+(root.DSAudio.musicMuted?'OFF':'ON'),description:'Soundtrack only. Engine and combat sounds stay on.',run:()=>root.DSAudio.toggleMusic()},
      {id:'sound',label:'ALL SOUND · '+(root.DSAudio.muted?'OFF':'ON'),description:'Master sound switch for music and effects.',run:()=>root.DSAudio.toggleMute()},
      {id:'ui-scale',label:'HUD SIZE · '+(prefs.scale==='large'?'LARGE':'DEFAULT'),description:'Large text uses about a fifth more of the screen for the HUD.',run:()=>{prefs.scale=prefs.scale==='large'?'default':'large';savePrefs();if(W)layout(W,H);}},
      {id:'minimap',label:'LOCAL MAP · '+(prefs.minimap?'SHOWN':'HIDDEN'),description:'The corner map. The city map stays on Tab / View.',run:()=>{prefs.minimap=!prefs.minimap;savePrefs();}},
      {id:'back',label:'BACK TO PAUSE',quiet:true,run:()=>back()}
    ];
    if(name==='end')return [{id:'restart',label:'ANOTHER EXPEDITION',run:()=>{ui.menu=null;ui.stack=[];bindings.restart();}}];
    if(name==='manual')return [{id:'close',label:'UNDERSTOOD',run:()=>back()}];
    if(name==='fullmap')return [{id:'close',label:'CLOSE · TAB',quiet:true,run:()=>back()}];
    return [];
  }
  // only the owner (by source) or an explicit pointer/automation choice spends a survivor's upgrade
  function chooseUpgrade(p,j,src){
    const s=state();if(!s||src&&src!==p.source)return false;
    if(!root.DSGame.upgrade(s,p,j))return false;
    if(p.upgrades<=0)back();else ui.focus=Math.min(ui.focus,p.offers.length-1);return true;
  }
  function overflowDrop(p,src){const s=state();if(!s||src&&src!==p.source)return false;const ok=root.DSGame.resolveOverflow(s,p.id,ui.overflowPick);ui.overflowPick=null;ui.focus=0;
    if(!(s.overflowQueue&&s.overflowQueue.length)){ui.menu=null;ui.stack=[];}return ok;}
  function openUpgrade(id){const s=state();if(!s||s.mode!=='play')return;if(!ui.menu)open('pause');ui.upgradeFor=id;open('upgrade');}
  function drawMenu(g,s){
    const name=ui.menu,items=menuItems(name,s);
    if(name==='pause'||name==='options')k=Math.min(k,(H-32)/(name==='pause'?360+items.length*38:520));
    if(name==='pause'||name==='end'){
      const won=s.mode==='won',w=Math.min(460*k,W-40*k);
      const heading=name==='pause'?['Take a breath.']:won?['Out.','On foot.']:['The city','keeps its dead.'];
      const [otitle,osub]=objectiveText(s,s.boss&&s.boss.active);
      const body=name==='pause'?otitle+' · '+osub:won?'The squad restored the circuit, sent the evidence and walked the Linden Street group out through Checkpoint Nine. Nobody came for you; the city behind you is still infected.':'The outbreak overwhelmed your squad. Try a different route, conserve supplies, and return stronger.';
      const bodyLines=wrap(g,body,9,w-68*k),itemsH=items.reduce((n,it)=>n+(it.quiet?30:44)*k+8*k,0);
      const h=(30+22+heading.length*32+8)*k+bodyLines.length*15*k+(name==='pause'?22*k:0)+(name==='end'?50*k:0)+12*k+itemsH+16*k,d=dialog(g,w,h);let y=d.y+30*k;
      text(g,name==='pause'?'TRANSMISSION HELD':won?'CHECKPOINT NINE OPEN':'TRANSMISSION LOST',d.x+34*k,y,8,COL.orange);y+=22*k;
      for(const line of heading){display(g,line,d.x+34*k,y,30,COL.paper);y+=32*k;}y+=8*k;
      for(const line of bodyLines){text(g,line,d.x+34*k,y,9,name==='pause'?COL.paper:COL.muted,'left','normal');y+=15*k;}
      if(name==='pause'){const tier=s.boss&&s.boss.difficulty?s.boss.difficulty.tier:s.threat;text(g,'OUTBREAK '+tier+' · '+(s.boss?'DIFFICULTY LOCKED':'ESCALATES IN '+clock(90-s.time%90))+' · the outbreak clock is paused',d.x+34*k,y+4*k,8,COL.muted,'left','normal');y+=22*k;}
      if(name==='end'){y+=10*k;let sx=d.x+34*k;for(const [v,l] of [[clock(s.time),'SURVIVED'],[String(s.kills),'INFECTED KILLED'],[String(s.opened),'SUPPLIES FOUND']]){text(g,v,sx,y,12,COL.orange);text(g,l,sx,y+16*k,7,COL.muted,'left','normal');sx+=Math.max(measure(g,l,7,'normal'),measure(g,v,12))+24*k;}y+=40*k;}
      y+=12*k;items.forEach((it,i)=>{const bh=it.quiet?30*k:44*k;button(g,it.id,it.label,d.x+34*k,y,w-68*k,bh,ui.focus===i,it.quiet,it.run);if(it.id.startsWith('upgrade:')){const p=s.players.find(q=>'upgrade:'+q.id===it.id);g.fillStyle=p.color;g.fillRect(d.x+34*k,y+6*k,3*k,bh-12*k);}y+=bh+8*k;});
    }else if(name==='overflow'){
      const p=overflowPlayer(s);if(!p){ui.menu=null;return;}
      const w=Math.min(620*k,W-32*k),h=(170+items.length*40+60)*k,d=dialog(g,w,h),x=d.x+28*k,inner=w-56*k;
      text(g,'P'+(p.id+1)+' · A TEAMMATE HAS JOINED · THE SQUAD IS PAUSED',x,d.y+22*k,8,p.color);display(g,'Leave one weapon.',x,d.y+42*k,30,COL.paper);
      let ly=d.y+84*k;for(const line of wrap(g,'Solo survivors carry four weapons to cover more roles; in co-op each survivor carries three and the squad shares those roles. Choose one weapon to leave for your teammate. Your backup pistol stays with you.',8,inner)){text(g,line,x,ly,8,COL.muted,'left','normal');ly+=12*k;}
      text(g,'Only P'+(p.id+1)+' chooses: stick or arrows to move, '+L(p,'confirm')+' to pick, then confirm.',x,ly+4*k,8,COL.gold,'left','normal');
      let y=ly+24*k;items.forEach((it,i)=>{button(g,it.id,it.label,x,y,inner,34*k,ui.focus===i,it.quiet,it.run);y+=40*k;});
    }else if(name==='upgrade'){
      const p=upgradePlayer(s),w=Math.min(620*k,W-32*k),d=dialog(g,w,300*k),x=d.x+28*k,inner=w-56*k;
      if(!p){ui.menu='pause';return;}
      text(g,'P'+(p.id+1)+' · '+p.upgrades+' UPGRADE'+(p.upgrades===1?'':'S')+' WAITING · THE SQUAD IS PAUSED',x,d.y+22*k,8,p.color);display(g,'Choose one.',x,d.y+42*k,30,COL.paper);
      text(g,'Only P'+(p.id+1)+' can choose: '+L(p,'choose')+' or stick to move, '+L(p,'confirm')+' to take it, '+L(p,'back')+' to go back.',x,d.y+82*k,8,COL.muted,'left','normal');
      const cw=(inner-16*k)/3;
      items.slice(0,3).forEach((it,j)=>{const cx=x+j*(cw+8*k),cy=d.y+110*k,ch=110*k,sel=ui.focus===j||ui.hover===it.id;
        g.fillStyle=sel?'#4b170f':'#111c21';g.fillRect(cx,cy,cw,ch);g.strokeStyle=sel?COL.orange:COL.line;g.strokeRect(cx+.5,cy+.5,cw-1,ch-1);
        text(g,String(j+1),cx+12*k,cy+10*k,9,sel?COL.gold:COL.muted);for(const [li,line] of wrap(g,it.label,12,cw-24*k).entries())text(g,line,cx+12*k,cy+36*k+li*18*k,12,sel?COL.gold:COL.paper);
        item(it.id,cx,cy,cw,ch,()=>it.run());});
      button(g,'back',items[3].label,x,d.y+240*k,inner,34*k,ui.focus===3,true,items[3].run);
    }else if(name==='controls'){
      const w=Math.min(760*k,W-32*k),rowsN=12,d=dialog(g,w,(150+rowsN*20)*k),x=d.x+28*k;
      text(g,'PAUSED / CONTROLS',x,d.y+22*k,8,COL.orange);display(g,'Every survivor, their own buttons.',x,d.y+42*k,24,COL.paper);
      const B=root.DSGame.BINDINGS,cols=[['ACTION',null],['KEYBOARD','keyboard'],['XBOX / OTHER','xbox'],['PLAYSTATION','playstation']],cw=(w-56*k)/4;
      const rows=[['Walk','move'],['Run on foot','run'],['Vehicle gas','gas'],['Brake, then reverse','brake'],['Steer','steer'],['Interact / board / leave','interact'],['Use your medkit','heal'],['Eat a squad ration','eat'],['Autofire on / off','fire'],['Cycle weapons','cycle'],['City map','map'],['Pause · upgrades','pause']];
      let y=d.y+80*k;cols.forEach(([t],i)=>text(g,t,x+i*cw,y,8,COL.gold));y+=20*k;
      for(const [label,a] of rows){cols.forEach(([t,dev],i)=>text(g,dev?(dev==='keyboard'&&a==='steer'?'A/D':B[dev][a]):label,x+i*cw,y,8,dev?COL.paper:COL.muted,'left',dev?'bold':'normal'));y+=20*k;}
      button(g,'back',items[0].label,x,d.y+d.h-44*k,w-56*k,32*k,true,true,items[0].run);
    }else if(name==='options'){
      const w=Math.min(500*k,W-32*k),n=items.length-1,h=(130+n*66+60)*k,d=dialog(g,w,h),x=d.x+28*k,inner=w-56*k;
      text(g,'PAUSED / OPTIONS',x,d.y+22*k,8,COL.orange);display(g,'Make it yours.',x,d.y+42*k,30,COL.paper);
      text(g,'Preferences are saved on this device.',x,d.y+80*k,8,COL.muted,'left','normal');
      let y=d.y+108*k;
      items.slice(0,n).forEach((it,i)=>{
        button(g,it.id,it.label,x,y,inner,30*k,ui.focus===i,true,it.run);
        let ly=y+33*k;for(const line of wrap(g,it.description,8,inner-20*k)){text(g,line,x+10*k,ly,8,COL.muted,'left','normal');ly+=12*k;}
        y+=66*k;
      });
      button(g,'back',items[n].label,x,y+4*k,inner,34*k,ui.focus===n,true,items[n].run);
      text(g,'↑ / ↓ SELECT   ENTER / A CHANGE   ESC / B BACK',d.x+w/2,y+46*k,7,COL.dim,'center','normal');
    }else if(name==='manual'){
      const w=Math.min(820*k,W-30*k),cw=(w-60*k-30*k)/2;
      const rowH=r=>16*k+13*k*Math.max(wrap(g,MANUAL[r*2][1],8,cw-10*k).length,wrap(g,MANUAL[r*2+1][1],8,cw-10*k).length)+10*k;
      const h=Math.min(H-30*k,(22+20+40+10+8+10+(H>620?64:0)+40+30)*k+rowH(0)+rowH(1)),d=dialog(g,w,h);let y=d.y+22*k;const x=d.x+30*k;
      text(g,'SURVIVOR FIELD MANUAL / 001',x,y,8,COL.orange);y+=20*k;display(g,'Know the city. Make every round count.',x,y,26,COL.paper);y+=40*k;
      g.fillStyle=COL.line;g.fillRect(x,y,w-60*k,1);y+=10*k;
      for(let row=0;row<2;row++){
        MANUAL.slice(row*2,row*2+2).forEach(([t,body],col)=>{
          const cx=x+col*(cw+30*k);
          g.fillStyle=COL.orange;g.fillRect(cx,y,2*k,14*k);text(g,t,cx+10*k,y,8,COL.gold);
          let ly=y+16*k;for(const line of wrap(g,body,8,cw-10*k)){text(g,line,cx+10*k,ly,8,COL.muted,'left','normal');ly+=13*k;}
        });
        y+=rowH(row);
      }
      y+=8*k;g.fillStyle=COL.line;g.fillRect(x,y,w-60*k,1);y+=10*k;
      if(H>620){const cards=districtCards(),dw=(w-60*k-4*(cards.length-1)*k)/cards.length;cards.forEach(([id,name,role,note,col],i)=>{const dx=x+i*(dw+4*k);g.fillStyle='#091115';g.fillRect(dx,y,dw,52*k);g.strokeStyle=col;g.strokeRect(dx+.5,y+.5,dw-1,52*k-1);text(g,name,dx+8*k,y+7*k,7,col);text(g,role,dx+8*k,y+20*k,6,COL.paper,'left','normal');text(g,note,dx+8*k,y+33*k,6,COL.muted,'left','normal');});y+=64*k;}
      button(g,'close','UNDERSTOOD',x,Math.min(y,d.y+h-56*k),220*k,40*k,true,false,items[0].run);
    }else if(name==='fullmap'){
      const size=Math.min(H-120*k,W-240*k,560*k),w=size+210*k,h=size+110*k,d=dialog(g,w,h);
      text(g,'OPERATIONS MAP / SECTOR 09',d.x+20*k,d.y+16*k,9,COL.paper);button(g,'close','CLOSE · TAB',d.x+w-140*k,d.y+8*k,120*k,26*k,true,true,items[0].run);
      const mx=d.x+20*k,my=d.y+44*k;root.DSWorld.drawMap(g,s,mx,my,size,size);
      g.fillStyle=COL.red;g.beginPath();g.arc(mx+size/2,my+size/2,6,0,Math.PI*2);g.fill();{const tw=measure(g,'PATIENT FURNACE',8);g.fillStyle='#0a0f12d0';g.fillRect(mx+size/2-tw/2-3,my+size/2+10,tw+6,14*k);}text(g,'PATIENT FURNACE',mx+size/2,my+size/2+12,8,'#ffb3a8','center');
      const ly=my+size+10*k,cards=districtCards(),lw=size/cards.length;cards.forEach(([id,name,role,note,col],i)=>{const lx=mx+i*lw;g.fillStyle='#081014';g.fillRect(lx,ly,lw-3*k,20*k);g.fillStyle=col;g.fillRect(lx,ly,lw-3*k,2*k);text(g,name,lx+(lw-3*k)/2,ly+7*k,6,col,'center');});
      root.DSWorld.drawMapLegend(g,mx+size+16*k,my,160*k,k);
      const [ot]=objectiveText(s,s.boss&&s.boss.active),tier=s.boss&&s.boss.difficulty?s.boss.difficulty.tier:s.threat;
      text(g,(s.paused?'PAUSED':'LIVE')+' · '+ot+' · OUTBREAK '+tier+' · Icons: what a place supplies. Amber rings: noise.',mx,ly+30*k,7,COL.muted,'left','normal');
    }
  }

  // ---- state machine ----
  function open(name){if(ui.menu&&ui.menu!==name)ui.stack.push(ui.menu);ui.menu=name;ui.focus=0;ui.hover=null;const s=state();if(s&&s.mode==='play'&&(name==='pause'||name==='manual'||name==='options'||name==='upgrade'||name==='controls'))s.paused=true;}
  function close(){ui.menu=null;ui.stack=[];ui.focus=0;ui.upgradeFor=null;const s=state();if(s&&s.mode==='play'&&s.paused)bindings.resume();}
  function back(){const s=state();if(ui.stack.length){ui.menu=ui.stack.pop();ui.focus=0;if(ui.menu!=='upgrade')ui.upgradeFor=null;return;}if(ui.menu==='end')return;if(ui.menu==='manual'&&s&&s.mode==='title'){ui.menu=null;bindings.toTitle();return;}close();}
  function toggle(name){if(ui.menu===name)close();else if(!ui.menu)open(name);}
  const PAUSED_MENUS=['pause','manual','options','upgrade','controls'];
  function togglePause(){const s=state();if(!s||s.mode!=='play'||ui.menu==='overflow')return;if(PAUSED_MENUS.includes(ui.menu))close();else if(!ui.menu||ui.menu==='fullmap'){ui.menu=null;ui.stack=[];open('pause');}}
  // source: 'keyboard' / 'pad:N' for a device press, undefined for the pointer or automation
  function press(action,source){
    const s=state();
    if(action==='pause'){togglePause();return true;}
    if(ui.menu==='overflow'){const p=overflowPlayer(s),owner=!source||p&&p.source===source,its=menuItems('overflow',s);if(!owner||!its.length)return true;
      if(action==='up')ui.focus=(ui.focus+its.length-1)%its.length;else if(action==='down')ui.focus=(ui.focus+1)%its.length;
      else if(action==='confirm'){const it=its[ui.focus];if(it)it.run(source);}else if(action==='back'&&ui.overflowPick!=null){ui.overflowPick=null;ui.focus=0;}
      return true;}
    if(action==='map'){if(!s||s.mode!=='play')return false;if(ui.menu==='fullmap')back();else if(!ui.menu||ui.menu==='pause')open('fullmap');return true;}
    if(!ui.menu)return false;
    const items=menuItems(ui.menu,s);
    if(ui.menu==='upgrade'){
      const p=upgradePlayer(s),owner=!source||p&&p.source===source;
      if(action.startsWith('choose:')){if(owner&&p)chooseUpgrade(p,+action.slice(7),source);return true;}
      if(action==='back'){back();return true;}
      if(!owner)return true;
      if(action==='left')ui.focus=ui.focus>=3?2:(ui.focus+2)%3;
      else if(action==='right')ui.focus=ui.focus>=3?0:(ui.focus+1)%3;
      else if(action==='up')ui.focus=ui.focus>=3?0:3;
      else if(action==='down')ui.focus=ui.focus>=3?0:3;
      else if(action==='confirm'){const it=items[ui.focus];if(it)it.run(source);}
      return true;
    }
    if(action.startsWith('choose:'))return true;
    if(action==='up')ui.focus=(ui.focus+items.length-1)%Math.max(1,items.length);
    else if(action==='down')ui.focus=(ui.focus+1)%Math.max(1,items.length);
    else if(action==='confirm'){const it=items[ui.focus];if(it)it.run();}
    else if((action==='left'||action==='right')&&ui.menu==='options'&&ui.focus<items.length-1)items[ui.focus].run();
    else if(action==='back'){if(ui.menu==='fullmap'&&!s.paused)togglePause();else back();}
    return true;
  }
  function pointer(x,y){ui.pointer.x=x;ui.pointer.y=y;ui.hover=null;for(const it of ui.items)if(x>=it.x&&x<it.x+it.w&&y>=it.y&&y<it.y+it.h){ui.hover=it.id;const items=menuItems(ui.menu,state()),i=items.findIndex(m=>m.id===it.id);if(i>=0)ui.focus=i;}}
  function hit(x,y){pointer(x,y);for(const it of ui.items)if(x>=it.x&&x<it.x+it.w&&y>=it.y&&y<it.y+it.h){it.run();return it.id;}return null;}
  function draw(g,s,width,height){
    if(W!==width||H!==height||!last.u)layout(width,height);W=width;H=height;ui.items=[];ui.panels=[];
    g.save();g.textBaseline='top';
    if(s.mode!=='title'){trackObjective(s);drawTop(g,s);const below=drawBoss(g,s);drawMinimap(g,s);drawNotices(g,s,below);drawPrompt(g,s);drawDock(g,s);}
    if((s.mode==='won'||s.mode==='lost')&&ui.menu!=='end'){ui.menu='end';ui.stack=[];ui.focus=0;}
    if(s.mode==='play'&&s.overflowQueue&&s.overflowQueue.length&&ui.menu!=='overflow'){ui.menu='overflow';ui.stack=[];ui.focus=0;ui.overflowPick=null;}
    if(ui.menu){ui.items=[];drawMenu(g,s);}
    g.restore();
  }
  // Section 0 budget evidence: reserved bands, persistent panel area and the core text size, in CSS pixels
  function report(){
    const area=ui.panels.reduce((n,r)=>n+r.w*r.h,0),boss=ui.panels.filter(r=>r.id==='boss').reduce((n,r)=>n+r.w*r.h,0);
    return {viewport:{w:W,h:H},u,scale:prefs.scale,minimap:prefs.minimap,top:last.top,bottom:last.bottom,safe:last.safe,panels:ui.panels.slice(),
      budget:{topPct:+(last.top/H*100).toFixed(2),bottomPct:+(last.bottom/H*100).toFixed(2),verticalPct:+((last.top+last.bottom)/H*100).toFixed(2),areaPct:+(area/(W*H)*100).toFixed(2),bossAreaPct:+(boss/(W*H)*100).toFixed(2),coreTextPx:Math.round(12*u),minimapPct:+((prefs.minimap?minimapRect().w:0)/Math.min(W,H)*100).toFixed(1)}};
  }
  root.DSHud={layout,draw,press,pointer,hit,open,close,back,toggle,bind,report,openUpgrade,get menu(){return ui.menu;},get focus(){return ui.focus;},get upgradeFor(){return ui.upgradeFor;},items(){return ui.items.map(i=>({id:i.id,x:i.x,y:i.y,w:i.w,h:i.h}));},menuItems:()=>menuItems(ui.menu,state()).map(i=>i.id)};
})(typeof window!=='undefined'?window:globalThis);
