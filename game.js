(function (root) {
  'use strict';
  const W = () => root.DSWorld;
  const MEDKIT_HEAL=50, MEDKIT_CAP=3, WEAPON_CAP=3;
  // PLAYER_POWER Phase 1: a lone survivor carries four weapons; from the second joined survivor on, three each.
  // Player entries are never removed mid-run, so downs and disconnects never widen capacity again.
  function weaponCap(s){return s&&s.players&&s.players.length<=1?4:3;}
  const MASS={walker:3.2,runner:2.4,band:2,carrier:5,brute:14};
  // seat offsets along/across the car: both rows sit under the roof and glass, not on the hood (city_v2 car review)
  const SEATS=[[-18,-11],[-18,11],[6,-11],[6,11]];
  // Vehicle definitions (CITY.md Phase 10). Footprint len x wid; probes are circles along the length; fuel is
  // distance units (70 per litre, see DSCity.ECONOMY.fuel); burn scales distance, idleBurn is per second running.
  // seats are [along, across] from the centre; impact scales damage taken, ram damage dealt; pivot = tracks.
  const VEHICLES={
    sedan:{len:96,wid:48,probe:22,probes:[-34,0,34],accel:190,brake:340,drag:26,topSpeed:300,reverse:.45,turn:2.6,turnFalloff:1.6,half:34,
      minFuel:560,maxFuel:3920,emptyChance:.25,burn:1,idleBurn:0,seats:SEATS,integrity:100,wreckHp:200,roadkill:14,impact:1,ram:1,noise:[240,320],clears:false,pivot:false,wreckedLabel:'CAR WRECKED'},
    fireTruck:{len:150,wid:60,probe:28,probes:[-58,-20,20,58],accel:120,brake:260,drag:30,topSpeed:230,reverse:.35,turn:1.8,turnFalloff:1,
      minFuel:1050,maxFuel:6300,emptyChance:0,burn:1.5,idleBurn:0,seats:[[38,-14],[38,14],[8,-14],[8,14]],integrity:180,wreckHp:360,roadkill:22,impact:.6,ram:1.3,noise:[300,360],clears:false,pivot:false,wreckedLabel:'FIRE TRUCK WRECKED'},
    bulldozer:{len:110,wid:80,probe:38,probes:[-32,0,32],accel:160,brake:340,drag:110,topSpeed:140,reverse:.7,turn:2.2,turnFalloff:.6,
      minFuel:5600,maxFuel:8400,emptyChance:0,burn:1.5,idleBurn:0,seats:[[-10,-16],[-10,16]],integrity:330,wreckHp:620,roadkill:26,impact:.4,ram:1.6,noise:[420,260],clears:true,clearTime:2.5,crushRate:300,pivot:true,wreckedLabel:'BULLDOZER BROKEN'}
  };
  const CAR=VEHICLES.sedan,FUEL=root.DSCity.ECONOMY.fuel; // city.js loads before the simulation everywhere
  const NOISE={pour:110,generatorRun:260,gate:380,walk:90,run:180,heal:140,reload:90,equip:75,revive:160,break:600,radio:500,engine:520,crash:600,pry:220,door:450,strain:480,clear:720,generator:520};
  const UPGRADES=[{id:'damage',label:'DMG +13%',name:'DAMAGE +13%'},{id:'rate',label:'RATE +10%',name:'FIRE RATE +10%'},{id:'speed',label:'SPD +6',name:'SPEED +6'},{id:'health',label:'HP +15',name:'VITALITY +15'},{id:'stamina',label:'STA +25',name:'STAMINA +25'}];
  const COLORS = ['#79e2cf', '#ffb866', '#b5a2ff', '#ff8291'];
  const WEAPONS = {
    pistol: {name:'BACKUP PISTOL', ammo:null, damage:15, interval:.58, range:245, mag:Infinity, reload:0, noise:220},
    ar: {name:'ASSAULT RIFLE', ammo:'bullets', damage:16, interval:.18, range:325, mag:30, reload:1.8, noise:400},
    shotgun: {name:'PUMP SHOTGUN', ammo:'shells', damage:17, pellets:6, spread:.46, interval:.95, range:190, mag:6, reload:2.2, noise:520, cleave:3, retain:.6},
    smg: {name:'SUBMACHINE GUN', ammo:'bullets', damage:10, interval:.105, range:220, mag:36, reload:1.6, noise:350},
    rifle: {name:'MARKSMAN RIFLE', ammo:'bullets', damage:65, interval:.8, range:425, mag:10, reload:2, noise:460},
    flame: {name:'FLAMETHROWER', ammo:'fuel', damage:8, interval:.12, range:135, spread:.7, mag:60, reload:2.4, noise:250},
    // PLAYER_POWER Phase 4: a carried slot, scarce shared grenades, a travelling round that bursts once
    launcher: {name:'GRENADE LAUNCHER', ammo:'grenades', damage:100, edge:35, radius:80, speed:420, interval:.9, range:330, mag:1, reload:2.5, noise:520, projectile:true}
  };
  // PLAYER_POWER Phase 3/5: fixed three-tier progressions per weapon, earned in order from duplicate drops. `mod` adds
  // (pellets, cleave, mag), multiplies (*Mul) or sets flags (linger) on the weapon's stats; see weaponStats().
  const ATTACHMENTS={
    shotgun:[{id:'sg_choke',label:'CHOKE',description:'+1 pellet',mod:{pellets:1}},{id:'sg_slug',label:'SLUG LOAD',description:'pellets cleave one more target',mod:{cleave:1}},{id:'sg_tube',label:'EXTENDED TUBE',description:'magazine +2',mod:{mag:2}}],
    ar:[{id:'ar_pierce',label:'AP ROUNDS',description:'bullets pass one infected at 60%',mod:{cleave:1,retain:.6}},{id:'ar_extmag',label:'EXTENDED MAG',description:'magazine +10',mod:{mag:10}},{id:'ar_speed',label:'SPEED LOADER',description:'reload −30%',mod:{reloadMul:.7}}],
    smg:[{id:'smg_suppressor',label:'SUPPRESSOR',description:'firing noise −40%',mod:{noiseMul:.6}},{id:'smg_drum',label:'DRUM MAG',description:'magazine +18',mod:{mag:18}},{id:'smg_grip',label:'QUICK GRIP',description:'equip delay −60%',mod:{equipMul:.4}}],
    rifle:[{id:'rf_pierce',label:'PENETRATOR',description:'shots pass two infected at 80%',mod:{cleave:2,retain:.8}},{id:'rf_match',label:'MATCH AMMO',description:'damage +25%',mod:{damageMul:1.25}},{id:'rf_bolt',label:'SMOOTH BOLT',description:'fire interval −25%',mod:{intervalMul:.75}}],
    flame:[{id:'fl_linger',label:'NAPALM MIX',description:'leaves burning ground',mod:{linger:true}},{id:'fl_nozzle',label:'WIDE NOZZLE',description:'cone +35%',mod:{spreadMul:1.35}},{id:'fl_tank',label:'BIG TANK',description:'tank +30',mod:{mag:30}}],
    launcher:[{id:'gl_twin',label:'TWIN CHAMBER',description:'two grenades per load',mod:{mag:1}},{id:'gl_blast',label:'HEAVY CHARGE',description:'blast radius +25%',mod:{radiusMul:1.25}},{id:'gl_reload',label:'BREAK ACTION',description:'reload −30%',mod:{reloadMul:.7}}]
  };
  const statCache=new Map();
  function weaponStats(key,attachments){
    const ids=attachments&&attachments.length?attachments:null,ck=key+'|'+(ids?ids.join(','):'');if(statCache.has(ck))return statCache.get(ck);
    const d={...WEAPONS[key]};
    for(const a of ATTACHMENTS[key]||[])if(ids&&ids.includes(a.id)){const m=a.mod;
      if(m.pellets)d.pellets=(d.pellets||1)+m.pellets;if(m.cleave)d.cleave=(d.cleave||1)+m.cleave;if(m.retain)d.retain=m.retain;if(m.mag)d.mag+=m.mag;
      if(m.reloadMul)d.reload*=m.reloadMul;if(m.intervalMul)d.interval*=m.intervalMul;if(m.noiseMul)d.noise*=m.noiseMul;if(m.damageMul)d.damage*=m.damageMul;
      if(m.spreadMul)d.spread*=m.spreadMul;if(m.radiusMul)d.radius*=m.radiusMul;if(m.equipMul)d.equipMul=m.equipMul;if(m.linger)d.linger=true;}
    statCache.set(ck,d);return d;
  }
  function magFor(w){return weaponStats(w.weapon,w.attachments).mag;}
  function nextAttachment(w){const list=ATTACHMENTS[w.weapon]||[],have=w.attachments||[];return list.find(a=>!have.includes(a.id))||null;}
  // the carried instance a weapon drop would upgrade, or -1: the selected slot first, then the first matching slot
  function upgradeTarget(s,p,item){
    if(!item||item.type!=='weapon'||p.dead)return -1;saveWeapon(p);
    const ok=i=>{const w=p.weaponInventory[i];return w&&w.weapon===item.weapon&&nextAttachment(w);};
    if(!p.backup&&ok(p.weaponSlot??0))return p.weaponSlot??0;
    for(let i=0;i<p.weaponInventory.length;i++)if(ok(i))return i;return -1;
  }
  const ENEMIES = {
    walker:{r:10,hp:36,speed:36,damage:9,xp:2}, runner:{r:8,hp:25,speed:70,damage:7,xp:2},
    ghost:{r:10,hp:33,speed:47,damage:10,xp:3}, brute:{r:17,hp:170,speed:27,damage:18,xp:7},
    band:{r:8,hp:24,speed:130,damage:8,xp:2}, carrier:{r:12,hp:75,speed:28,damage:0,xp:5}
  };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  // Infected navigation grid: 40-unit cells so a house door (>= 80 wide) always holds a cell centre.
  // 180x180 cells exceed the Int16 range, so the BFS queue below is Int32.
  const NAV_CELL=40, NAV_SIZE=180, NAV_MIN=-3600;
  function create(seed) {
    const world=W().create(seed);
    const s={seed,rng:seed||1,time:0,wave:1,threat:1,mode:'title',paused:false,players:[],enemies:[],loot:[],shots:[],fx:[],
      ammo:{bullets:90,shells:16,fuel:65,grenades:0},circuit:{emergency:false},supplies:{provisions:0,vehicleFuel:0,generatorFuelled:false},world,boss:null,radio:{active:false,done:false,progress:0},
      camera:{x:0,y:2800,w:740,h:420},settings:{drivingStyle:'steering'},kills:0,level:1,xp:0,nextXp:24,banner:'',bannerT:0,
      audioEvents:[],spawnAcc:0,band:null,bandWave:0,noise:[],noiseId:0,nextId:1,opened:0,entered:false,bossHold:0,lastDistrict:'',elapsed:0};
    for(const site of world.sites) for(const item of (site.loot||[site])) s.loot.push({...item,site:site.id});
    s.locationState={};s.siteState={};
    // hadSupplies separates a cleared cache from a place that never held anything (the map shows both)
    for(const l of world.locations||[])s.locationState[l.id]={discovered:l.discoveryRule==='known',visited:false,cleared:false,hadSupplies:l.siteIds.some(id=>world.sites.some(q=>q.id===id&&q.loot.length))};
    for(const site of world.sites)s.siteState[site.id]={remainingItemIds:(site.loot||[]).map(i=>i.id),collectedItemIds:[]};
    // secured interior doors stay closed until forced; ordinary doors are plain openings
    // arena gates start closed; convergence scales the street spawn rate (1 until Patient Furnace dies)
    s.gates={};for(const g of world.arenaGates||[])s.gates[g.id]={open:false};s.convergence=1;s.campaign={bossDown:false,payloadUnlocked:false};
    s.doorState={};for(const b of world.buildings||[])for(const d of b.interiorDoors)if(d.kind==='secured')s.doorState[d.id]={open:false,progress:0,active:false,nextNoise:0};
    // Parked cars alone have an obstacle; occupied cars are actors, never static geometry.
    // Vehicle fuel is distance remaining. s.ammo.fuel belongs ONLY to flamethrowers.
    const HEADING={n:-Math.PI/2,s:Math.PI/2,e:0,w:Math.PI};
    const liveVehicle=(o,type)=>{const d=VEHICLES[type],slot=(world.vehicleSlots||[]).find(q=>q.id===o.slotId);
      const fuel=d.emptyChance&&random(s)<d.emptyChance?0:d.minFuel+random(s)*(d.maxFuel-d.minFuel);
      return {id:o.carId,carId:o.carId,slotId:o.slotId,vehicleType:type,obstacle:o,x:o.x+o.w/2,y:o.y+o.h/2,
        angle:type!=='sedan'&&slot&&HEADING[slot.heading]!=null?HEADING[slot.heading]:o.h>o.w?-Math.PI/2:0,speed:0,fuel,maxFuel:d.maxFuel,
        integrity:d.integrity,maxIntegrity:d.integrity,driver:null,riders:[],parked:true,dead:false,engineCd:0,crashCd:0,hitIds:new Set()};};
    // Parked vehicles alone have an obstacle; occupied ones are actors, never static geometry. The fire truck is
    // authored in its bay every run; its fuel is the run's.
    s.vehicles=world.obstacles.filter(o=>o.driveable).map(o=>liveVehicle(o,o.vehicleType||'sedan'));
    // One bulldozer per run on one of the four fixed pads: run state placed on top of the fixed geometry.
    s.debrisState={};
    const pads=(world.vehicleSlots||[]).filter(q=>q.vehicleType==='bulldozer');
    if(pads.length){const pad=pads[Math.floor(random(s)*pads.length)],d=VEHICLES.bulldozer,r=pad.rect,w0=d.wid,h0=d.len;
      const o={x:Math.round(r.x+(r.w-w0)/2),y:Math.round(r.y+(r.h-h0)/2),w:w0,h:h0,type:'car',kind:'bulldozer',vehicleType:'bulldozer',hp:d.wreckHp,maxHp:d.wreckHp,
        art:'vehicles/bulldozer_v',driveable:true,carId:'bulldozer',slotId:pad.id,service:true,locationId:pad.locationId};
      world.obstacles.push(o);s.activePad=pad.id;s.vehicles.push(liveVehicle(o,'bulldozer'));}
    campaignInit(s);
    return s;
  }
  function random(s) {let x=s.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return (x>>>0)/4294967296;}
  function addPlayer(s,source='keyboard') {
    if(s.players.length>=4||s.players.some(p=>p.source===source)) return null;
    const anchor=s.players.find(p=>!p.dead)||{x:0,y:2800}, id=s.players.length;
    const p={id,source,name:'SURVIVOR '+(id+1),x:anchor.x+(id?22:0),y:anchor.y+(id?22:0),r:10,hp:100,maxHp:100,armor:0,dead:false,color:COLORS[id],angle:-Math.PI/2,auto:false,backup:true,weapon:null,quality:1,mag:0,reload:0,shotCd:0,damage:1,speed:105,invuln:2,revive:0,upgrades:Math.max(0,s.level-1),choice:0,kills:0,medkits:1,stamina:100,maxStamina:100,staminaDelay:0,upgradeBag:[],offers:[],offerHistory:[],weaponInventory:[],weaponSlot:0};
    if(W().blocked(s.world,p.x,p.y,10)){p.x=anchor.x;p.y=anchor.y;}
    p.vehicle=null;p.exitCd=0;p.refuel=null;
    rollUpgrades(s,p);s.players.push(p);
    // a join that lowers capacity queues every survivor above it for an explicit, paused drop choice
    const cap=weaponCap(s);for(const q of s.players)if(q.weaponInventory.length>cap&&!(s.overflowQueue||[]).includes(q.id))(s.overflowQueue||(s.overflowQueue=[])).push(q.id);
    return id;
  }
  // Leave one carried weapon beside its survivor as a complete weaponState (type, quality, loaded rounds, attachments).
  function dropWeapon(s,p,slot){
    saveWeapon(p);const w=p.weaponInventory[slot];if(!w)return false;
    const wasSelected=!p.backup&&(p.weaponSlot??0)===slot;
    p.weaponInventory.splice(slot,1);
    s.loot.push({id:s.nextId++,x:p.x+22,y:p.y+18,type:'weapon',weapon:w.weapon,quality:w.quality||1,mag:w.mag,attachments:(w.attachments||[]).slice(),amount:1,label:WEAPONS[w.weapon].name,lock:1});
    if(!p.weaponInventory.length){p.weapon=null;p.backup=true;p.weaponSlot=0;p.mag=0;p.attachments=[];}
    else if(wasSelected){p.backup=false;p.weaponSlot=0;const n=p.weaponInventory[0];Object.assign(p,n);p.attachments=(n.attachments||[]).slice();p.reload=0;}
    else if(!p.backup&&(p.weaponSlot??0)>slot)p.weaponSlot--;
    emit(s,'pickup','drop');effect(s,p.x,p.y-26,'LEFT '+WEAPONS[w.weapon].name,'#edc37c');
    return true;
  }
  // resolve the head of the overflow queue: that survivor drops the chosen slot; the run resumes when nobody is over
  function resolveOverflow(s,playerId,slot){
    const q=s.overflowQueue||[];if(q[0]!==playerId)return false;const p=s.players.find(x=>x.id===playerId);if(!p||!dropWeapon(s,p,slot))return false;
    if(p.weaponInventory.length<=weaponCap(s))q.shift();return true;
  }
  function emit(s,type,detail){if(s.audioEvents.length<64)s.audioEvents.push({type,detail});}
  // World-space sound, independent of audio/mute. Future doors and windows use this too.
  function makeNoise(s,source,kind,radius=NOISE[kind]){
    if(s.mode!=='play'||s.paused||!Number.isFinite(radius)||radius<=0)return null;
    const n={id:++s.noiseId,x:source.x,y:source.y,r:radius,kind,playerId:source.id,life:1.4,maxLife:1.4,audible:.12};
    s.noise.push(n);if(s.noise.length>96)s.noise.shift();return n;
  }
  function effect(s,x,y,text,color='#fff') {s.fx.push({x,y,text,color,life:1.2,maxLife:1.2});if(s.fx.length>100)s.fx.shift();}
  function announce(s,t){s.banner=t;s.bannerT=4;}
  // One action-label source (city_v2 Section 0) for prompts, hints, the manual and player strips. Controllers use
  // standard-mapping positions; unknown pads fall back to the Xbox names.
  const BINDINGS={
    keyboard:{move:'WASD',run:'SHIFT',gas:'W',brake:'S',steer:'A/D',interact:'E',heal:'H',eat:'R',fire:'F',cycle:'Q',deploy:'T',map:'TAB',pause:'ESC',confirm:'ENTER',back:'ESC',choose:'1-3'},
    xbox:{move:'L-STICK',run:'RT',gas:'RT',brake:'LT',steer:'L-STICK',interact:'A',heal:'B',eat:'RB',fire:'X',cycle:'Y',deploy:'LB',map:'VIEW',pause:'MENU',confirm:'A',back:'B',choose:'LB/RB'},
    playstation:{move:'L-STICK',run:'R2',gas:'R2',brake:'L2',steer:'L-STICK',interact:'✕',heal:'○',eat:'R1',fire:'□',cycle:'△',deploy:'L1',map:'CREATE',pause:'OPTIONS',confirm:'✕',back:'○',choose:'L1/R1'}
  };
  function deviceOf(p){return p&&p.device&&BINDINGS[p.device]?p.device:p&&p.source==='keyboard'?'keyboard':'xbox';}
  function label(p,action){return BINDINGS[deviceOf(p)][action]||'?';}
  // A short player-owned notice on that player's strip; the same key repeats at most every 1.2 s.
  function notify(s,p,text,color='#e2e7d7',key=text){
    const now=s.elapsed||0;if(p.noticeKey===key&&now-(p.noticeAt??-9)<1.2)return false;
    p.notice={text,color,t:2.6};p.noticeKey=key;p.noticeAt=now;return true;
  }
  // Controller triggers are context actions (run on foot, gas/brake in a driver's seat). After boarding, leaving,
  // being downed or any menu they must return to neutral before the new context reads them.
  const TRIGGER_DEAD_ZONE=.12;
  function conditionInput(p,input){
    // a frame without trigger readings (menu closing, keyboard) neither arms nor releases anything
    if(input.rt==null&&input.lt==null)return {...input,rt:0,lt:0};
    const context=p.dead?'down':p.vehicle!=null?'seat':'foot',clip=v=>Math.max(0,Math.min(1,+v||0));
    const rt=clip(input.rt),lt=clip(input.lt),held=rt>TRIGGER_DEAD_ZONE||lt>TRIGGER_DEAD_ZONE;
    if(p.triggerContext!==context){p.triggerContext=context;p.triggerHold=held;}
    if(p.triggerHold&&!held)p.triggerHold=false;
    const scale=v=>p.triggerHold||v<=TRIGGER_DEAD_ZONE?0:(v-TRIGGER_DEAD_ZONE)/(1-TRIGGER_DEAD_ZONE);
    const out={...input,rt:scale(rt),lt:scale(lt)};
    if(input.pedals&&context==='foot'&&out.rt>.3)out.run=true;
    return out;
  }
  function rearmTriggers(s){for(const p of s.players)p.triggerContext=null;}
  // Every survivor damage source (infected, the boss, crashes) comes through here. Armor (PLAYER_POWER Phase 7)
  // soaks first, a breaking hit's remainder reaches health, nothing bypasses it; knockback and the hit invulnerability
  // apply the same whether armor or health took the hit.
  const ARMOR={max:50,pickup:25};
  function hurt(s,p,amount,kx=0,ky=0){
    if(p.dead||p.invuln>0)return;
    const soak=Math.min(p.armor||0,amount),rest=amount-soak;
    if(soak>0){p.armor-=soak;p.armorHit=.35;if(p.armor<=0){p.armor=0;p.armorBroken=1.2;emit(s,'armor','break');effect(s,p.x,p.y-34,'ARMOR BROKEN','#8fb3c9');}else emit(s,'armor','hit');}
    if(rest>0)emit(s,'hurt');p.hp=Math.max(0,p.hp-rest);p.invuln=.65;p.flash=rest>0?.2:0;amount=rest;
    if(soak>0)effect(s,p.x+(rest>0?-10:0),p.y-22,'−'+Math.ceil(soak),'#8fb3c9');if(p.deploying){p.deploying=null;notify(s,p,'Deploy interrupted','#ff8c80','turret-cancel');}
    // Split impulses so the same solid geometry used for walking also stops knockback.
    for(let i=0;i<8;i++)W().move(s.world,p,kx/8,ky/8);
    if(amount>0)effect(s,p.x+(soak>0?10:0),p.y-22,'−'+Math.ceil(amount),'#ff8c80');
    if(amount>0&&p.hp>0&&p.medkits>0&&!p.healHinted){p.healHinted=true;notify(s,p,'P'+(p.id+1)+' · '+label(p,'heal')+': heal '+MEDKIT_HEAL+' HP','#79e2cf','hint-heal');}
    if(p.hp<=0){p.dead=true;if(p.vehicle!=null)exitVehicle(s,p);p.revive=0;announce(s,p.name+' DOWN · stand nearby to revive');}
  }
  function spawn(s,type,x,y,extra={}) {
    const def=ENEMIES[type]||ENEMIES.walker;
    const e={id:s.nextId++,type,x,y,...def,hp:def.hp,maxHp:def.hp,hitCd:0,alert:false,state:'roam',wanderAngle:random(s)*Math.PI*2,wanderT:0,heardNoise:0,...extra};
    s.enemies.push(e);return e;
  }
  // ---- the disposal-yard gates (CITY.md Phase 11) ----
  // Closed gates are solid. A survivor walking up to a gate from outside opens that gate only; an open gate keeps a
  // central bollard, so survivors and infected pass on foot but no vehicle fits. Committing seals all four; the
  // furnace's death reopens them.
  const ARENA={half:370,play:360,trigger:130};
  function gateById(s,id){return (s.world.arenaGates||[]).find(g=>g.id===id);}
  function setGate(s,g,open,quiet){
    const st=s.gates[g.id];if(!st||st.open===open)return false;st.open=open;
    s.world.obstacles=s.world.obstacles.filter(o=>o.gateId!==g.id);
    const r=g.rect,h=r.w>=r.h;
    // open: the centre bollard plus the two 6-unit posts the gate sprites draw at the ends (two 34-unit passages)
    if(open){s.world.obstacles.push({x:h?r.x+r.w/2-10:r.x,y:h?r.y:r.y+r.h/2-10,w:h?20:r.w,h:h?r.h:20,type:'gate',gateId:g.id,bollard:true,protected:true});
      for(const end of [0,1])s.world.obstacles.push(h?{x:end?r.x+r.w-6:r.x,y:r.y,w:6,h:r.h,type:'gate',gateId:g.id,post:true,protected:true}:{x:r.x,y:end?r.y+r.h-6:r.y,w:r.w,h:6,type:'gate',gateId:g.id,post:true,protected:true});}
    else s.world.obstacles.push({x:r.x,y:r.y,w:r.w,h:r.h,type:'gate',gateId:g.id,protected:true});
    s.navVersion=(s.navVersion||0)+1;
    if(!quiet){const c={x:r.x+r.w/2,y:r.y+r.h/2};makeNoise(s,c,'gate');emit(s,'gate',open?'open':'close');}
    return true;
  }
  function gatesTick(s,living){
    if(s.boss?.active)return;
    for(const g of s.world.arenaGates||[]){if(s.gates[g.id].open)continue;const c={x:g.rect.x+g.rect.w/2,y:g.rect.y+g.rect.h/2};
      if(living.some(p=>dist(p,c)<ARENA.trigger&&(Math.abs(p.x)>ARENA.half||Math.abs(p.y)>ARENA.half))){setGate(s,g,true);announce(s,'CONTAINMENT GATE OPEN · commit at the furnace');}}
  }
  function sealArena(s){for(const g of s.world.arenaGates||[])setGate(s,g,false);}
  // idempotent post-boss transition: the run continues with lower convergence and the command payload unlocked
  function bossDefeated(s){
    s.campaign=s.campaign||{};if(s.campaign.bossDown)return false;
    s.campaign.bossDown=true;s.campaign.payloadUnlocked=true;s.convergence=Math.min(s.convergence??1,CONVERGENCE_AFTER_BOSS);
    for(const g of s.world.arenaGates||[])setGate(s,g,true);
    for(const e of s.enemies)if(e.bossOwned)e.dead=true;
    s.spawnAcc=Math.min(s.spawnAcc,0);emit(s,'bossDown');announce(s,'GATES OPEN · THE COMMAND PAYLOAD IS UNLOCKED');return true;
  }
  const CONVERGENCE_AFTER_BOSS=.65;
  function api(s){return {sealArena:()=>sealArena(s),bossDefeated:()=>bossDefeated(s),hurt:(p,n,x,y)=>hurt(s,p,n,x,y),spawn:(t,x,y,e)=>spawn(s,t,x,y,e),effect:(x,y,t,c)=>effect(s,x,y,t,c),announce:t=>announce(s,t),random:()=>random(s),move:(e,x,y)=>W().move(s.world,e,x,y),ejectVehicles:()=>ejectVehicles(s)};}
  function lineObstacle(s,ax,ay,bx,by){
    // Segment/AABB slabs: shots stop at the first solid thing, including wreckage.
    let nearest=null,hitT=1;
    const minx=Math.min(ax,bx),maxx=Math.max(ax,bx),miny=Math.min(ay,by),maxy=Math.max(ay,by);
    for(const o of W().queryObstacles(s.world,minx,miny,maxx,maxy)){
      if(o.hp!==undefined&&o.hp<=0||o.seeThrough)continue;
      if(o.x>maxx||o.x+o.w<minx||o.y>maxy||o.y+o.h<miny)continue;
      let lo=0,hi=1;
      for(const [start,delta,min,max] of [[ax,bx-ax,o.x,o.x+o.w],[ay,by-ay,o.y,o.y+o.h]]){
        if(Math.abs(delta)<.00001){if(start<min||start>max){lo=2;break;}}
        else {let a=(min-start)/delta,b=(max-start)/delta;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);}
      }
      if(lo<=hi&&lo>=0&&lo<hitT){hitT=lo;nearest=o;}
    }
    return nearest?{obstacle:nearest,t:hitT}:null;
  }
  function xp(s,n){s.xp+=n;while(s.xp>=s.nextXp){s.xp-=s.nextXp;s.level++;s.nextXp=Math.round(s.nextXp*1.22+4);s.players.forEach(p=>{p.upgrades++;if(!p.dead)s.fx.push({kind:'levelUp',follow:p.id,x:p.x,y:p.y,life:1.6,maxLife:1.6,text:'',color:'#ffd249'});});emit(s,'level');announce(s,'LEVEL '+s.level+' · UPGRADES WAIT IN PAUSE');}}
  function hitEnemy(s,e,n,source){
    if(e.dead)return;if(source&&!e.bossOwned)investigate(e,source);e.hp-=n;e.flash=.08;
    if(random(s)<.5)s.fx.push({x:e.x+(random(s)-.5)*10,y:e.y-14,sprite:'vfx/bloodHit',frames:3,life:.25,maxLife:.25,text:'',color:'#fff'});
    if(e.hp<=0){e.dead=true;s.kills++;if(e.type!=='ghost'){s.decals=s.decals||[];s.decals.push({x:e.x,y:e.y+4,variant:e.id%3});if(s.decals.length>240)s.decals.shift();}if(e.xp) s.loot.push({id:s.nextId++,x:e.x,y:e.y,type:'xp',amount:e.xp,label:'experience'});}
  }
  function reload(s,p,def){if(p.reload||!def.ammo||p.mag>=def.mag||(s.ammo[def.ammo]||0)<=0)return;emit(s,'reload');makeNoise(s,p,'reload');p.reload=def.reload;p.reloadWeapon=p.weapon;}
  // What a survivor can see at night (lights.js draws the same rule): a cone the way they walk, a near circle,
  // anything under a working lamp, floodlight, burning wreck or the boss glow, and infected that glow themselves.
  const SIGHT={half:.61,range:340,near:90};
  // Light the simulation sees by (CITY.md Phase 9 / LIGHTING.md): a static pool counts only if its circuit is live
  // and no wall, building, closed door or solid fence stands between the fixture and the point; a driven vehicle's
  // headlights light a cone ahead of it. Visibility never depends on the sound or render settings.
  const OCCLUDERS={wall:1,building:1,door:1,fence:1};
  function occluded(s,ax,ay,bx,by){
    const minx=Math.min(ax,bx),maxx=Math.max(ax,bx),miny=Math.min(ay,by),maxy=Math.max(ay,by);
    for(const o of W().queryObstacles(s.world,minx,miny,maxx,maxy)){
      if(!OCCLUDERS[o.type]||o.seeThrough||o.hp!==undefined&&o.hp<=0||o.x>maxx||o.x+o.w<minx||o.y>maxy||o.y+o.h<miny)continue;
      if(ax>o.x&&ax<o.x+o.w&&ay>o.y&&ay<o.y+o.h)continue;
      let lo=0,hi=1,hit=true;
      for(const [start,delta,min,max] of [[ax,bx-ax,o.x,o.x+o.w],[ay,by-ay,o.y,o.y+o.h]]){
        if(Math.abs(delta)<1e-5){if(start<min||start>max){hit=false;break;}}
        else{let a=(min-start)/delta,b=(max-start)/delta;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);}
      }
      if(hit&&lo<=hi&&lo<.999)return true;
    }
    return false;
  }
  const HEADLIGHTS={sedan:{ahead:112,side:18,r:170},fireTruck:{ahead:150,side:24,r:210},bulldozer:{ahead:110,side:30,r:150}};
  function litAt(s,x,y){
    for(const l of s.world.lights||[]){if(l.o&&l.o.hp<=0||l.circuit&&!s.circuit?.[l.circuit])continue;const dx=x-l.x,dy=y-l.y;if(dx*dx+dy*dy<l.r*l.r*.81&&!occluded(s,l.x,l.y,x,y))return true;}
    for(const v of s.vehicles||[]){if(v.dead||v.driver==null||v.fuel<=0)continue;const h=HEADLIGHTS[v.vehicleType]||HEADLIGHTS.sedan,c=Math.cos(v.angle),n=Math.sin(v.angle),fx=v.x+c*h.ahead,fy=v.y+n*h.ahead,along=(x-v.x)*c+(y-v.y)*n;
      if(along>0&&Math.hypot(x-fx,y-fy)<h.r*.9&&!occluded(s,v.x,v.y,x,y))return true;}
    if(s.boss&&s.boss.active&&dist(s.boss,{x,y})<260)return true;
    return x*x+y*y<320*320*.81;
  }
  function canSee(s,p,e){
    if(e.type==='ghost'||e.type==='carrier')return true;
    const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy),r=e.r||10;
    if(d<SIGHT.near+r)return true;
    if(d<SIGHT.range+r){const a=p.moveAngle==null?p.angle||0:p.moveAngle;let diff=Math.atan2(dy,dx)-a;diff=Math.atan2(Math.sin(diff),Math.cos(diff));if(Math.abs(diff)<SIGHT.half+.1)return true;}
    return litAt(s,e.x,e.y);
  }
  // the nearest thing worth a shot within the weapon's range: a seen infected in line of sight, the boss, or the wreck being pushed
  function acquire(s,p,def){
    let target=null,best=def.range;
    for(const e of s.enemies){if(e.dead)continue;const d=dist(p,e)-e.r;if(d<best&&canSee(s,p,e)&&!lineObstacle(s,p.x,p.y,e.x,e.y)){best=d;target=e;}}
    const boss=s.boss;
    // Nearer adds win naturally; the boss's generous hitbox must not steal their shots.
    if(boss&&boss.active&&boss.hp>0){const d=dist(p,boss);if(d<best&&d<def.range+boss.r){target=boss;best=d;}}
    if(p.wallTarget&&p.wallTarget.hp>0&&!p.wallTarget.protected){target={x:p.wallTarget.x+p.wallTarget.w/2,y:p.wallTarget.y+p.wallTarget.h/2,wall:p.wallTarget};}
    return target;
  }
  // survivors always aim at the nearest target (the weapon tracks it whether or not they are firing); otherwise they face the way they walk
  function aim(s,p){
    const key=p.backup||!p.weapon?'pistol':p.weapon,def=key==='pistol'?WEAPONS.pistol:weaponStats(key,p.attachments);
    p.target=acquire(s,p,def);
    if(p.target)p.angle=Math.atan2(p.target.y-p.y,p.target.x-p.x);
  }
  // Combat fields describe the last selected carried gun, even while using the pistol.
  function saveWeapon(p){
    if(p.weapon){const slot=p.weaponSlot??0;p.weaponSlot=slot;Object.assign(p.weaponInventory[slot]||(p.weaponInventory[slot]={}),{weapon:p.weapon,quality:p.quality,mag:p.mag,attachments:(p.attachments||[]).slice()});}
  }
  function selectWeapon(s,p,slot){
    saveWeapon(p);
    p.backup=slot<0;
    if(!p.backup){p.weaponSlot=slot;const w=p.weaponInventory[slot];Object.assign(p,w);p.attachments=(w.attachments||[]).slice();}
    // Switching cancels an unfinished reload; it never refills a magazine.
    p.reload=0;p.reloadWeapon=null;p.shotCd=Math.max(p.shotCd,.25*(p.backup?1:weaponStats(p.weapon,p.attachments).equipMul||1));makeNoise(s,p,'equip');
  }
  function fire(s,p,dt){fireWeapon(s,p,dt);saveWeapon(p);}
  function fireWeapon(s,p,dt){
    // a carried weapon that is empty with nothing in the squad reserve falls back to the unlimited pistol shot by shot,
    // so autofire never goes silent; the selection stays and the gun reloads as soon as its ammunition returns
    const own=p.backup||!p.weapon?null:weaponStats(p.weapon,p.attachments),dry=!!(own&&own.ammo&&p.mag<=0&&!p.reload&&!(s.ammo[own.ammo]>0));
    if(dry&&p.auto&&p.target&&p.dryNotice!==p.weapon){p.dryNotice=p.weapon;notify(s,p,'No '+({bullets:'BUL',shells:'SHL',fuel:'INCEND',grenades:'GREN'}[own.ammo]||own.ammo)+' · firing the pistol · '+label(p,'cycle')+' cycles','#edc37c','dry');}
    if(!dry&&p.dryNotice===p.weapon)p.dryNotice=null;
    const key=p.backup||!p.weapon||dry?'pistol':p.weapon, def=key==='pistol'?WEAPONS.pistol:own;
    p.shotCd=Math.max(0,p.shotCd-dt);
    if(p.reload>0){p.reload=Math.max(0,p.reload-dt);if(!p.reload&&p.reloadWeapon===p.weapon){const own=weaponStats(p.weapon,p.attachments),n=Math.max(0,Math.min(own.mag-p.mag,s.ammo[own.ammo]||0));p.mag+=n;s.ammo[own.ammo]-=n;} }
    if(!p.auto||p.shotCd>0||(!p.backup&&p.reload>0))return;
    const target=p.target,boss=s.boss;
    if(!target)return;
    if(def.ammo&&p.mag<=0){reload(s,p,def);return;}
    if(def.ammo)p.mag--;
    emit(s,'shot',key);p.shotCd=def.interval/(p.fireRate||1);p.angle=Math.atan2(target.y-p.y,target.x-p.x);p.muzzle=.07;
    // tracers and flames leave the muzzle (the gun is drawn at shoulder height, p.y-14, pointing along p.angle); hits are still judged from the body
    const reach=(key==='flame'||key==='rifle'||key==='ar')?28:22,mx=p.x+Math.cos(p.angle)*reach,my=p.y-14+Math.sin(p.angle)*reach;
    makeNoise(s,p,'shot',def.noise);
    const power=p.damage*(key==='pistol'?1:1+.25*(p.quality-1));
    if(def.projectile){launchGrenade(s,p,target,def,power,mx,my);}
    else if(target.wall){target.wall.hp-=def.damage*power*(def.pellets||1);if(target.wall.hp<=0){makeNoise(s,target,'break');effect(s,target.x,target.y,'PATH CLEARED','#a8b9b8');W().removeObstacle(s.world,target.wall);s.navVersion=(s.navVersion||0)+1;} }
    else if(key==='flame'){
      const half=.48*(def.spread/WEAPONS.flame.spread);
      for(const e of [...s.enemies,...(boss&&boss.active?[boss]:[])]){if(e.dead)continue;let a=Math.atan2(e.y-p.y,e.x-p.x)-p.angle;a=Math.atan2(Math.sin(a),Math.cos(a));if(dist(p,e)<def.range+(e.r||0)&&Math.abs(a)<half&&!lineObstacle(s,p.x,p.y,e.x,e.y)){if(e===boss)root.DSBoss.hit(s,def.damage*power,api(s));else hitEnemy(s,e,def.damage*power,p);}}
      if(def.linger&&(s.time-(p.lastLinger||-9))>.3){p.lastLinger=s.time;const t=target.x!=null?target:null,dd=t?Math.min(def.range*.85,dist(p,t)):def.range*.6,fx=p.x+Math.cos(p.angle)*dd,fy=p.y+Math.sin(p.angle)*dd;
        if(!lineObstacle(s,p.x,p.y,fx,fy)){(s.fires||(s.fires=[])).push({x:fx,y:fy,t:2.5,owner:p.id});if(s.fires.length>8)s.fires.shift();}}
    }else{
      const count=def.pellets||1;
      for(let i=0;i<count;i++){
        const a=p.angle+(count>1?(i-(count-1)/2)*def.spread/(count-1):0),dx=Math.cos(a),dy=Math.sin(a);
        let reach=def.range;
        const wall=lineObstacle(s,p.x,p.y,p.x+dx*reach,p.y+dy*reach);if(wall)reach*=wall.t;
        const end=rayHits(s,p,dx,dy,reach,def,power,key);
        s.shots.push({x:mx,y:my,tx:p.x+dx*end,ty:p.y+dy*end,life:.1,maxLife:.1,type:key,color:p.color,cleave:(def.cleave||0)>1});
      }
    }
    if(key==='flame'||target.wall)s.shots.push({x:mx,y:my,tx:target.x,ty:target.y,angle:p.angle,life:.13,maxLife:.13,type:key,color:p.color});
    if(def.ammo&&p.mag===0)reload(s,p,def);
  }
  // One pellet or bullet along a ray already shortened by walls (PLAYER_POWER Phase 2). Every enemy the ray crosses is
  // ordered by entry distance; point-blank infected overlapping the muzzle count (entry clamps to 0). A weapon with
  // cleave > 1 keeps damaging in order, retaining def.retain of its damage after each target; brutes and the boss stop it.
  // The shotgun falls off from 100% at 40% of range to 50% at full range. Returns where the trace ends.
  function rayHits(s,p,dx,dy,reach,def,power,key){
    const boss=s.boss,hits=[],limit=def.cleave||1;
    for(const e of [...s.enemies,...(boss&&boss.active?[boss]:[])]){if(e.dead)continue;const r=e.r||10,ex=e.x-p.x,ey=e.y-p.y,along=ex*dx+ey*dy,side=Math.abs(ex*dy-ey*dx);
      if(along>-r&&along<reach+r&&side<r+2){const near=Math.max(0,along-Math.sqrt(Math.max(0,r*r-side*side)));if(near<reach)hits.push({e,near});}}
    hits.sort((u,v)=>u.near-v.near);
    let mult=1,endAt=reach;
    for(let k=0;k<hits.length&&k<limit;k++){
      const {e,near}=hits[k],fall=key==='shotgun'?(near<=def.range*.4?1:1-.5*Math.min(1,(near-def.range*.4)/(def.range*.6))):1,dmg=def.damage*power*mult*fall;
      if(e===boss)root.DSBoss.hit(s,dmg,api(s));else hitEnemy(s,e,dmg,p);
      endAt=near;mult*=def.retain||.6;
      if(e===boss||e.type==='brute')break;
      if(k===limit-1)break;endAt=reach;
    }
    return hits.length?endAt:reach;
  }
  // ---- grenades and burning ground (PLAYER_POWER Phase 4/5) ----
  const GRENADE_CAP=12;
  function launchGrenade(s,p,target,def,power,mx,my){
    const list=s.grenades||(s.grenades=[]);if(list.length>=GRENADE_CAP)list.shift();
    const tx=target.x,ty=target.y,d=Math.hypot(tx-p.x,ty-p.y)||1,reachD=Math.min(d,def.range);
    list.push({id:s.nextId++,owner:p.id,x:p.x,y:p.y,sx:mx,sy:my,tx:p.x+(tx-p.x)/d*reachD,ty:p.y+(ty-p.y)/d*reachD,speed:def.speed,radius:def.radius,damage:def.damage*power,edge:def.edge*power,done:false});
  }
  function explode(s,g){
    if(g.done)return;g.done=true;const boss=s.boss,R=g.radius;
    for(const e of s.enemies){if(e.dead||e.bossOwned&&e.type==='boss')continue;const d=Math.max(0,dist(g,e)-(e.r||10));if(d>R||lineObstacle(s,g.x,g.y,e.x,e.y))continue;
      const dmg=g.damage+(g.edge-g.damage)*(d/R);hitEnemy(s,e,dmg,{x:g.x,y:g.y});
      const stun=e.type==='brute'?.2:.5;e.stunT=Math.max(e.stunT||0,stun);if(e.type!=='brute'){const k=36/(Math.hypot(e.x-g.x,e.y-g.y)||1);W().move(s.world,e,(e.x-g.x)*k,(e.y-g.y)*k);}}
    if(boss&&boss.active&&boss.hp>0){const d=Math.max(0,dist(g,boss)-boss.r);if(d<=R&&!lineObstacle(s,g.x,g.y,boss.x,boss.y))root.DSBoss.hit(s,g.damage+(g.edge-g.damage)*(d/R),api(s));}
    for(const o of W().queryObstacles(s.world,g.x-R,g.y-R,g.x+R,g.y+R))if(o.hp>0&&!o.protected&&!o.driveable&&o.debris!=='optional-clear'&&o.type!=='car'){const cx=o.x+o.w/2,cy=o.y+o.h/2;if(Math.hypot(cx-g.x,cy-g.y)<R){o.hp-=g.damage;if(o.hp<=0){W().removeObstacle(s.world,o);s.navVersion=(s.navVersion||0)+1;effect(s,cx,cy,'PATH CLEARED','#a8b9b8');}}}
    s.fx.push({x:g.x,y:g.y,sprite:'vfx/explosion',frames:5,life:.45,maxLife:.45,text:'',color:'#ff8b3d',scale:R/40});
    makeNoise(s,g,'break',WEAPONS.launcher.noise+140);emit(s,'explosion');
  }
  function projectilesTick(s,dt){
    if(s.grenades&&s.grenades.length){
      for(const g of s.grenades){if(g.done)continue;const dx=g.tx-g.x,dy=g.ty-g.y,d=Math.hypot(dx,dy),step=g.speed*dt;
        const nx=d<=step?g.tx:g.x+dx/d*step,ny=d<=step?g.ty:g.y+dy/d*step,hit=lineObstacle(s,g.x,g.y,nx,ny);
        if(hit){g.x+=(nx-g.x)*Math.max(0,hit.t-.02);g.y+=(ny-g.y)*Math.max(0,hit.t-.02);explode(s,g);continue;}
        g.x=nx;g.y=ny;if(d<=step)explode(s,g);}
      s.grenades=s.grenades.filter(g=>!g.done);
    }
    if(s.fires&&s.fires.length){for(const f of s.fires){f.t-=dt;f.acc=(f.acc||0)+dt;if(f.acc<.25)continue;f.acc-=.25;for(const e of s.enemies)if(!e.dead&&dist(f,e)<22+(e.r||10))hitEnemy(s,e,7*.25,null);}s.fires=s.fires.filter(f=>f.t>0);}
  }
  // ---- carryable turrets (PLAYER_POWER Phase 6) ----
  const TURRET={cap:120,start:60,range:260,interval:.22,damage:12,noise:300,durability:150,deploy:.8,reach:40,refill:.03,search:.15};
  function ownTurret(s,p){return (s.turrets||[]).find(t=>t.ownerId===p.id)||null;}
  // assumption: a turret whose owner left the session is orphaned and any survivor may pack it up
  function packable(s,p){return (s.turrets||[]).find(t=>Math.hypot(t.x-p.x,t.y-p.y)<TURRET.reach&&(t.ownerId===p.id||!s.players.some(q=>q.id===t.ownerId)))||null;}
  function turretPlaceOk(s,x,y){
    if(W().blocked(s.world,x,y,12))return false;
    for(const t of s.turrets||[])if(Math.hypot(t.x-x,t.y-y)<30)return false;
    for(const b of s.world.buildings||[])for(const d of b.exteriorDoors.concat(b.interiorDoors))if(x>d.rect.x-18&&x<d.rect.x+d.rect.w+18&&y>d.rect.y-18&&y<d.rect.y+d.rect.h+18)return false;
    for(const v of s.vehicles||[])if(!v.dead&&Math.hypot(v.x-x,v.y-y)<44)return false;
    if(s.campaign)for(const action of ['prepare','transmit','gate']){const pt=holdPoint(s,action);if(pt&&Math.hypot(pt.x-x,pt.y-y)<REACH[action]+20)return false;}
    for(const g of s.world.arenaGates||[])if(x>g.rect.x-24&&x<g.rect.x+g.rect.w+24&&y>g.rect.y-24&&y<g.rect.y+g.rect.h+24)return false;
    return true;
  }
  // deploy (T / LB / L1): with a turret carried, stand still for 0.8 s; next to your own deployed turret, pick it back up
  function turretInput(s,p,input,dt){
    if(p.dead||p.vehicle!=null){p.deploying=null;return;}
    if(s.paused){p.deploying=null;return;}
    const own=ownTurret(s,p)||(!p.turret?packable(s,p):null);
    if(input.deploy){
      if(!p.turret&&own&&Math.hypot(own.x-p.x,own.y-p.y)<TURRET.reach){p.resupply=null;s.turrets=s.turrets.filter(t=>t!==own);p.turret={id:own.id,ammo:own.ammo,durability:own.durability};emit(s,'turret','retrieve');notify(s,p,'Turret packed · '+own.ammo+' rounds','#a8b9b8','turret-retrieve');}
      else if(p.turret&&!p.deploying){p.deploying={t:0};}
      else if(!p.turret)notify(s,p,own?'Walk to your turret to pack it':'No turret carried','#8a9a94','turret-none');
    }
    if(p.deploying){
      if(Math.hypot(input.x||0,input.y||0)>.05){p.deploying=null;notify(s,p,'Deploy cancelled · stand still','#8a9a94','turret-cancel');return;}
      p.deploying.t+=dt;if(p.deploying.t<TURRET.deploy)return;p.deploying=null;
      const a=p.moveAngle??p.angle??0,x=p.x+Math.cos(a)*26,y=p.y+Math.sin(a)*26;
      if(!turretPlaceOk(s,x,y)){notify(s,p,'No room to deploy here','#8a9a94','turret-room');emit(s,'reject','turret');return;}
      (s.turrets||(s.turrets=[])).push({id:p.turret.id,ownerId:p.id,x:Math.round(x),y:Math.round(y),angle:a,ammo:p.turret.ammo,durability:p.turret.durability,cd:0,searchCd:0,target:null,hitCd:0});
      p.turret=null;emit(s,'turret','deploy');makeNoise(s,p,'equip');notify(s,p,'Turret deployed · '+label(p,'deploy')+' beside it packs it up','#a8b9b8','turret-deploy');
    }
  }
  function turretsTick(s,dt){
    for(const t of s.turrets||[]){
      t.cd=Math.max(0,t.cd-dt);t.searchCd-=dt;
      const ok=e=>e&&!e.dead&&Math.hypot(e.x-t.x,e.y-t.y)<TURRET.range+(e.r||10)&&!lineObstacle(s,t.x,t.y,e.x,e.y);
      if(!ok(t.target)&&t.searchCd<=0){t.searchCd=TURRET.search;t.target=null;let best=TURRET.range+40;for(const e of s.enemies){if(e.dead||e.bossOwned)continue;const d=Math.hypot(e.x-t.x,e.y-t.y);if(d<best&&ok(e)){best=d;t.target=e;}}}
      if(!ok(t.target)){t.target=null;continue;}
      t.angle=Math.atan2(t.target.y-t.y,t.target.x-t.x);
      if(t.cd>0||t.ammo<=0)continue;t.cd=TURRET.interval;t.ammo--;
      hitEnemy(s,t.target,TURRET.damage,t);makeNoise(s,t,'shot',TURRET.noise);emit(s,'shot','turret');
      s.shots.push({x:t.x+Math.cos(t.angle)*18,y:t.y-8+Math.sin(t.angle)*18,tx:t.target.x,ty:t.target.y,life:.08,maxLife:.08,type:'turret',color:'#ffd249'});
    }
    if(s.turrets&&s.turrets.length){const broken=s.turrets.filter(t=>t.durability<=0);for(const t of broken){effect(s,t.x,t.y-20,'TURRET DESTROYED','#ff8c80');emit(s,'turret','break');s.fx.push({x:t.x,y:t.y,sprite:'vfx/explosion',frames:5,life:.35,maxLife:.35,text:'',color:'#ff8b3d',scale:.8});}
      if(broken.length)s.turrets=s.turrets.filter(t=>t.durability>0);}
  }
  // hold-style resupply started by one interact press: one bullet every 0.03 s from the shared reserve while in reach
  function turretResupply(s,p,dt){
    const r=p.resupply;if(!r)return;const t=(s.turrets||[]).find(q=>q.id===r.id);
    if(!t||p.dead||Math.hypot(t.x-p.x,t.y-p.y)>TURRET.reach+10||t.ammo>=TURRET.cap||s.ammo.bullets<=0){if(t&&t.ammo>=TURRET.cap)notify(s,p,'Turret full · '+t.ammo+' rounds','#a8b9b8','turret-full');p.resupply=null;return;}
    r.acc=(r.acc||0)+dt;while(r.acc>=TURRET.refill&&t.ammo<TURRET.cap&&s.ammo.bullets>0){r.acc-=TURRET.refill;t.ammo++;s.ammo.bullets--;}
  }
  function nearestTurret(s,p){let best=null,d0=TURRET.reach;for(const t of s.turrets||[]){const d=Math.hypot(t.x-p.x,t.y-p.y);if(d<d0){d0=d;best=t;}}return best;}
  // H / B: only ever a personal medkit. A refused press explains itself and consumes nothing.
  function useMedkit(s,p,feedback=false){
    if(s.mode!=='play'||s.paused||p.dead)return false;
    if(p.hp>=p.maxHp||p.medkits<=0){if(feedback&&notify(s,p,p.medkits<=0?'No medkits':'Health full','#8a9a94','heal-refused'))emit(s,'reject','medkit');return false;}
    const healed=Math.min(MEDKIT_HEAL,p.maxHp-p.hp);p.hp+=healed;p.medkits--;
    effect(s,p.x,p.y-28,'+'+Math.ceil(healed)+' HP','#79e2cf');emit(s,'heal');makeNoise(s,p,'heal');
    notify(s,p,'+'+Math.ceil(healed)+' HP · '+p.medkits+' medkit'+(p.medkits===1?'':'s')+' left','#79e2cf','heal');return true;
  }
  // Squad supplies (CITY.md Phase 6). Rations and jerrycans are shared stock like ammunition; a can
  // that would overflow the carry cap leaves the rest on the ground instead of deleting it.
  const PROVISIONS=root.DSCity.ECONOMY.provisions;
  // R / RB: explicitly eat one shared ration. Rations are stamina, never healing.
  function eat(s,p,feedback=false){
    const st=s.supplies;if(s.mode!=='play'||s.paused||p.dead||!st)return false;
    if(st.provisions<=0||p.fed>PROVISIONS.fedSeconds*.5){if(feedback&&notify(s,p,st.provisions<=0?'No squad rations':'Already fed · stamina boosted','#8a9a94','eat-refused'))emit(s,'reject','ration');return false;}
    st.provisions--;p.fed=PROVISIONS.fedSeconds;effect(s,p.x,p.y-28,'FED · STAMINA RECOVERS','#b8d86b');emit(s,'eat');
    notify(s,p,'Fed · stamina recovers faster · '+st.provisions+' ration'+(st.provisions===1?'':'s')+' left','#b8d86b','eat');return true;
  }
  function collect(s,p,item){
    if(item.taken||p.dead)return false;
    if(item.type==='evidence')collectEvidence(s,item);
    if(item.type==='payload'){s.campaign.payload=true;reveal(s,['blackglass-radio']);showDocument(s,{title:'TRANSMITTER PAYLOAD',body:'Evidence archive and the recovered broadcast band. Blackglass Radio can send it once the station is prepared.'});}
    if(item.type==='override'){s.campaign.override=true;reveal(s,['checkpoint-nine']);showDocument(s,{title:'CHECKPOINT NINE OVERRIDE',body:'Manual release for the south evacuation barrier. It needs emergency power and the distress call on record.'});}
    if(item.type==='provision'){const st=s.supplies;if(st.provisions>=PROVISIONS.carryCap)return false;st.provisions++;effect(s,item.x,item.y,'+1 RATION','#b8d86b');}
    if(item.type==='vehicleFuel'){
      const st=s.supplies,cap=FUEL.carryCap,take=Math.min(item.amount,cap-st.vehicleFuel);if(take<=0)return false;
      st.vehicleFuel+=take;effect(s,item.x,item.y,'+'+take+' L FUEL','#ffd249');
      if(take<item.amount){item.amount-=take;emit(s,'pickup','vehicleFuel');return true;}
    }
    if(item.type==='ammo'){s.ammo[item.ammo]+=item.amount;effect(s,item.x,item.y,'+'+item.amount+' '+item.ammo,'#edc37c');}
    else if(item.type==='medkit'){if(p.medkits>=MEDKIT_CAP)return false;p.medkits++;effect(s,item.x,item.y,'+1 MEDKIT','#79e2cf');
      if(!p.kitHinted){p.kitHinted=true;notify(s,p,'Medkit ×'+p.medkits+' · '+label(p,'heal')+' heals '+MEDKIT_HEAL+' HP when hurt','#79e2cf','hint-kit');}}
    else if(item.type==='provision'&&!s.rationHinted){s.rationHinted=true;notify(s,p,'Squad ration · '+label(p,'eat')+' eats one for stamina','#b8d86b','hint-ration');}
    else if(item.type==='xp')xp(s,item.amount);
    else if(item.type==='armor'){const room=ARMOR.max-(p.armor||0),take=Math.min(room,item.amount??ARMOR.pickup);
      if(take<=0){if(!(p.armorRefusedT>s.time)){p.armorRefusedT=s.time+2;notify(s,p,'Armor full · '+ARMOR.max+'/'+ARMOR.max,'#8a9a94','armor-full');}return false;}
      p.armor=(p.armor||0)+take;p.armorPickup=.6;effect(s,item.x,item.y,'+'+take+' ARMOR','#8fb3c9');emit(s,'armor','pickup');
      if(!p.armorHinted){p.armorHinted=true;notify(s,p,'Armor soaks damage before health · it never regenerates','#8fb3c9','hint-armor');}
      if(take<(item.amount??ARMOR.pickup)){item.amount=(item.amount??ARMOR.pickup)-take;return true;}}
    else if(item.type==='turret'){if(p.turret||ownTurret(s,p)){notify(s,p,'One turret per survivor · leave it for a teammate','#8a9a94','turret-one');return false;}
      p.turret={id:item.turretId??s.nextId++,ammo:item.ammo??TURRET.start,durability:item.durability??TURRET.durability};effect(s,item.x,item.y,'TURRET','#a8b9b8');
      if(!p.turretHinted){p.turretHinted=true;notify(s,p,'Turret · '+label(p,'deploy')+' deploys it · '+label(p,'interact')+' beside it reloads from BUL','#a8b9b8','hint-turret');}}
    else if(item.type==='heal'){if(s.players.every(q=>q.dead||q.hp>=q.maxHp))return false;s.players.forEach(q=>{if(!q.dead)q.hp=Math.min(q.maxHp,q.hp+item.amount);});makeNoise(s,p,'heal');effect(s,item.x,item.y,'SQUAD +'+item.amount+' HP','#79e2cf');}
    else if(item.type==='weapon'&&upgradeTarget(s,p,item)>=0){
      // duplicate: the carried instance gains its next attachment and the better quality; the drop's loaded rounds join the reserve
      const slot=upgradeTarget(s,p,item),w=p.weaponInventory[slot],next=nextAttachment(w),def=WEAPONS[item.weapon];
      w.attachments=(w.attachments||[]).concat(next.id);w.quality=Math.max(w.quality||1,item.quality||1);
      if(def.ammo&&item.mag)s.ammo[def.ammo]=(s.ammo[def.ammo]||0)+item.mag;
      if(!p.backup&&(p.weaponSlot??0)===slot){p.attachments=w.attachments.slice();p.quality=w.quality;}
      effect(s,p.x,p.y-26,def.name+' · '+next.label,'#ffd249');notify(s,p,'Upgraded '+def.name+' · '+next.label+' ('+next.description+')','#ffd249','upgrade-'+next.id);emit(s,'attachment',item.weapon);
    }
    else if(item.type==='weapon'){
      saveWeapon(p);
      const slot=p.weaponInventory.length<weaponCap(s)?p.weaponInventory.length:(p.weaponSlot??0),previous=p.weaponInventory[slot];
      const def=WEAPONS[item.weapon];
      // Dropped guns carry their loaded rounds; fresh loot loads from the squad reserve.
      const mag=item.mag??Math.min(def.mag,s.ammo[def.ammo]);
      if(item.mag==null)s.ammo[def.ammo]-=mag;
      if(previous)s.loot.push({id:s.nextId++,x:p.x+25,y:p.y+20,type:'weapon',...previous,amount:1,label:WEAPONS[previous.weapon].name,lock:1});
      p.weaponSlot=slot;p.weapon=item.weapon;p.quality=item.quality||1;p.mag=mag;p.attachments=(item.attachments||[]).slice();
      saveWeapon(p);selectWeapon(s,p,slot);
      effect(s,p.x,p.y-25,def.name,'#edc37c');
    }
    if(item.type!=='xp'){s.opened++;emit(s,'pickup',item.type);}item.taken=true;siteCollected(s,item);return true;
  }
  // Authored-site bookkeeping: only world-generated items (with a siteId) count toward clearing.
  // A location is cleared once every site that started with supplies is exhausted; it never reopens.
  function siteCollected(s,item){
    const st=item.siteId&&s.siteState?.[item.siteId];if(!st)return;
    const i=st.remainingItemIds.indexOf(item.id);if(i<0)return;
    st.remainingItemIds.splice(i,1);st.collectedItemIds.push(item.id);
    const loc=W().locationById(s.world,item.locationId),ls=loc&&s.locationState[loc.id];if(!ls||ls.cleared)return;
    ls.visited=ls.discovered=true;
    if(loc.siteIds.every(id=>!s.siteState[id]||!s.siteState[id].remainingItemIds.length))ls.cleared=true;
  }
  // Sampling without replacement: only the chosen upgrade leaves the personal bag.
  // Refill below three candidates, or if every possible offer repeats a pair three times.
  function rollUpgrades(s,p){
    const eligible=id=>id!=='speed'||p.speed<145;
    p.upgradeBag=p.upgradeBag.filter(eligible);
    const refill=()=>{p.upgradeBag=UPGRADES.map(u=>u.id).filter(eligible);};
    const candidates=()=>{
      const bag=p.upgradeBag,out=[],history=p.offerHistory;
      for(let a=0;a<bag.length-2;a++)for(let b=a+1;b<bag.length-1;b++)for(let c=b+1;c<bag.length;c++){
        const offer=[bag[a],bag[b],bag[c]];
        if(history.length===2&&offer.filter(id=>history[0].includes(id)&&history[1].includes(id)).length>=2)continue;
        out.push(offer);
      }
      return out;
    };
    if(p.upgradeBag.length<3)refill();
    let choices=candidates();if(!choices.length){refill();choices=candidates();}
    // Avoid identical consecutive offers whenever another valid triple is available.
    const previous=p.offerHistory.at(-1),fresh=choices.filter(o=>!previous||!o.every(id=>previous.includes(id)));
    if(fresh.length)choices=fresh;
    p.offers=choices[Math.floor(random(s)*choices.length)].slice();
    for(let i=2;i>0;i--){const j=Math.floor(random(s)*(i+1));[p.offers[i],p.offers[j]]=[p.offers[j],p.offers[i]];}
    p.offerHistory.push(p.offers.slice());if(p.offerHistory.length>2)p.offerHistory.shift();p.choice=0;
  }
  function upgrade(s,p,n){
    if(p.upgrades<=0||!Number.isInteger(n)||n<0||n>=p.offers.length)return false;
    const id=p.offers[n];p.upgrades--;p.upgradeBag.splice(p.upgradeBag.indexOf(id),1);
    if(id==='damage')p.damage*=1.13;
    if(id==='rate')p.fireRate=(p.fireRate||1)+.1;
    if(id==='speed')p.speed=Math.min(145,p.speed+6);
    if(id==='health'){p.maxHp+=15;p.hp=Math.min(p.maxHp,p.hp+25);}
    if(id==='stamina'){p.maxStamina+=25;p.stamina=Math.min(p.maxStamina,p.stamina+25);}
    effect(s,p.x,p.y-22,UPGRADES.find(u=>u.id===id).name,p.color);rollUpgrades(s,p);return true;
  }
  function nearestInteract(s,p){let best=null,range=54;for(const it of s.loot){if(it.type!=='weapon'||it.taken||it.lock>0)continue;const d=dist(p,it);if(d<range){range=d;best=it;}}return best;}
  function vehicleFor(s,p){return p.vehicle==null?null:s.vehicles.find(v=>v.id===p.vehicle)||null;}
  const vdef=v=>VEHICLES[v.vehicleType]||VEHICLES.sedan;
  function carLocal(v,x,y){const c=Math.cos(v.angle),n=Math.sin(v.angle);return {x:v.x+x*c-y*n,y:v.y+x*n+y*c};}
  function carDistance(v,p){
    const d=vdef(v),dx=p.x-v.x,dy=p.y-v.y,c=Math.cos(v.angle),n=Math.sin(v.angle);
    return Math.hypot(Math.max(0,Math.abs(dx*c+dy*n)-d.len/2),Math.max(0,Math.abs(-dx*n+dy*c)-d.wid/2));
  }
  function carBlocked(s,v,x=v.x,y=v.y,angle=v.angle){
    const d=vdef(v);for(const k of d.probes){const o=W().blocked(s.world,x+Math.cos(angle)*k,y+Math.sin(angle)*k,d.probe);if(o)return o;}return null;
  }
  function nearestVehicle(s,p){
    if(p.dead||p.vehicle!=null||p.exitCd>0||s.boss?.active)return null;
    let best=null,range=60;
    for(const v of s.vehicles){
      if(v.dead||v.integrity<=0||v.obstacle?.hp<=0||Math.abs(v.speed)>=60||(v.driver==null?0:1)+v.riders.length>=vdef(v).seats.length)continue;
      const d=carDistance(v,p);if(d>=range)continue; // distance first: the wall ray is only for cars within reach
      // A wall between a survivor and the door must not become a teleport shortcut.
      const wall=lineObstacle(s,p.x,p.y,v.x,v.y);
      if(!wall||wall.obstacle===v.obstacle){range=d;best=v;}
    }return best;
  }
  function seatPlayers(s,v){
    const seats=vdef(v).seats;
    for(const [i,id] of [v.driver,...v.riders].entries()){
      const p=s.players.find(p=>p.id===id);if(!p)continue;
      Object.assign(p,carLocal(v,...seats[i]));p.moving=p.running=false;p.wallTarget=null;
      if(id===v.driver){p.angle=p.moveAngle=v.angle;p.target=null;p.muzzle=0;}
    }
  }
  // a parked hull's hit points and a live vehicle's integrity are the same damage on two scales
  const hullToIntegrity=(v,hp)=>hp*vdef(v).integrity/vdef(v).wreckHp;
  function enterVehicle(s,v,p){
    if(!v||nearestVehicle(s,p)!==v)return false;
    if(v.fuel<=0){announce(s,'OUT OF FUEL · pour a jerrycan first');return false;}
    if(v.obstacle){
      v.integrity=Math.min(v.integrity,hullToIntegrity(v,v.obstacle.hp));
      W().removeObstacle(s.world,v.obstacle);s.navVersion=(s.navVersion||0)+1;v.obstacle=null;
    }
    v.parked=false;if(v.driver==null)v.driver=p.id;else v.riders.push(p.id);
    p.vehicle=v.id;p.nearItem=p.nearVehicle=p.nearRefuel=null;p.tether=false;seatPlayers(s,v);emit(s,'board',v.vehicleType);return true;
  }
  function parkVehicle(s,v){
    if(v.driver!=null||v.riders.length)return false;
    v.speed=0;if(v.obstacle)return true;
    const d=vdef(v),vertical=Math.abs(Math.sin(v.angle))>Math.abs(Math.cos(v.angle)),w=vertical?d.wid:d.len,h=vertical?d.len:d.wid,step=Math.round(d.wid/4);
    for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]]){
      const x=v.x+dx*step-w/2,y=v.y+dy*step-h/2;
      if(x<W().MIN||y<W().MIN||x+w>W().MAX||y+h>W().MAX)continue;
      if(W().queryObstacles(s.world,x,y,x+w,y+h).some(o=>x<o.x+o.w&&x+w>o.x&&y<o.y+o.h&&y+h>o.y))continue;
      if(s.players.some(p=>p.x+p.r>x&&p.x-p.r<x+w&&p.y+p.r>y&&p.y-p.r<y+h))continue;
      const sedan=v.vehicleType==='sedan',o={x,y,w,h,type:'car',kind:sedan?'car':v.vehicleType,vehicleType:v.vehicleType,hp:v.dead?d.wreckHp*.6:Math.max(1,v.integrity*d.wreckHp/d.integrity),maxHp:d.wreckHp,
        art:sedan?'wrecks/car_'+(vertical?'v':'h'):'vehicles/'+v.vehicleType+'_'+(vertical?'v':'h'),driveable:!v.dead,carId:v.carId,service:!sedan};
      s.world.obstacles.push(o);s.navVersion=(s.navVersion||0)+1;v.obstacle=o;v.parked=true;
      v.x=x+w/2;v.y=y+h/2;v.angle=vertical?(Math.sin(v.angle)>0?Math.PI/2:-Math.PI/2):(Math.cos(v.angle)>0?0:Math.PI);return true;
    }
    // No safe axis-aligned footprint fits: keep an unoccupied, non-solid actor.
    // parked always means obstacle !== null; it can still be entered unless dead.
    v.parked=false;return false;
  }
  function exitVehicle(s,p,park=true){
    const v=vehicleFor(s,p);if(!v)return false;
    const d=vdef(v),L=d.len/2,H=d.wid/2;
    const offsets=[[0,-(H+16)],[0,H+16],[-(L+10),0],[L+10,0],[0,-(H+32)],[0,H+32],[-(L+22),-(H+16)],[-(L+22),H+16],[L+22,-(H+16)],[L+22,H+16]];
    for(const k of [-.5,.5])offsets.push([k*L,-(H+18)],[k*L,H+18]);
    for(let i=0;i<12;i++)offsets.push([Math.cos(i*Math.PI/6)*(L+20),Math.sin(i*Math.PI/6)*(H+40)]);
    const vertical=Math.abs(Math.sin(v.angle))>Math.abs(Math.cos(v.angle)),hw=vertical?H:L,hh=vertical?L:H;
    const clear=q=>!W().blocked(s.world,q.x,q.y,p.r)&&!s.players.some(r=>r!==p&&r.vehicle!==v.id&&dist(q,r)<p.r+r.r);
    let dest=offsets.map(o=>carLocal(v,...o)).find(q=>clear(q)&&(Math.abs(q.x-v.x)>=hw+p.r||Math.abs(q.y-v.y)>=hh+p.r));
    if(!dest)dest=offsets.map(o=>carLocal(v,...o)).find(clear);
    // The centre is clear under the probes even if every door is boxed in.
    dest=dest||{x:v.x,y:v.y};Object.assign(p,dest);p.vehicle=null;p.exitCd=.5;p.nearVehicle=null;
    v.riders=v.riders.filter(id=>id!==p.id);if(v.driver===p.id)v.driver=v.riders.shift()??null;
    emit(s,'dismount',v.vehicleType);
    if(v.driver==null&&park)parkVehicle(s,v);else seatPlayers(s,v);return true;
  }
  function breakdown(s,v){
    if(v.dead)return;v.dead=true;v.integrity=0;v.speed=0;
    for(const id of [v.driver,...v.riders]){const p=s.players.find(p=>p.id===id);if(p)exitVehicle(s,p,false);}
    if(v.obstacle){v.obstacle.driveable=false;v.obstacle.hp=Math.max(1,v.obstacle.hp);}
    else parkVehicle(s,v);
    emit(s,'breakdown',v.vehicleType);announce(s,vdef(v).wreckedLabel);
  }
  function ejectVehicles(s){
    const released=[];
    for(const v of s.vehicles){
      if(v.driver==null&&!v.riders.length)continue;
      for(const id of [v.driver,...v.riders]){const p=s.players.find(p=>p.id===id);if(p)exitVehicle(s,p,false);}
      v.speed=0;released.push(v);
    }
    // Boss entry relocates the squad. Only restore solids after those positions
    // are known, so a parked chassis cannot cover an arena spawn point.
    return ()=>{
      const pending=new Set(released);
      // The interaction itself may have already parked a solo driver's car.
      for(const v of s.vehicles){const o=v.obstacle;
        if(!o||!s.players.some(p=>p.x+p.r>o.x&&p.x-p.r<o.x+o.w&&p.y+p.r>o.y&&p.y-p.r<o.y+o.h))continue;
        W().removeObstacle(s.world,o);s.navVersion=(s.navVersion||0)+1;v.obstacle=null;v.parked=false;pending.add(v);
      }
      for(const v of pending)parkVehicle(s,v);
    };
  }
  function roadkill(s,v){
    // Below the occupant-protection speed the horde can tear the vehicle apart.
    const speed=Math.abs(v.speed),d=vdef(v);if(speed<=40)return;
    const c=Math.cos(v.angle),n=Math.sin(v.angle),L=d.len/2,H=d.wid/2;
    for(const e of s.enemies){
      if(e.dead||e.type==='ghost'||v.hitIds.has(e.id)||Math.abs(e.x-v.x)>L+22+e.r||Math.abs(e.y-v.y)>L+22+e.r)continue;
      const dx=e.x-v.x,dy=e.y-v.y;
      if(Math.abs(dx*c+dy*n)>L+e.r||Math.abs(-dx*n+dy*c)>H+e.r)continue;
      v.hitIds.add(e.id);hitEnemy(s,e,d.roadkill+.42*speed,v);
      v.integrity=Math.max(0,v.integrity-(MASS[e.type]||3.2)*(.25+speed/300)*d.impact);
      const push=(40+speed*.16)*Math.sign(v.speed);
      for(let i=0;i<4;i++)W().move(s.world,e,c*push/4,n*push/4);
      if(v.integrity<=0){breakdown(s,v);break;}
    }
  }
  // Ramming only breaks ordinary breakables: protected gates, fences, walls and set-piece barricades are immune,
  // and authored debris only yields to a bulldozer's blade (clearDebris).
  function ramObstacle(s,o,speed){
    if(!(o.hp>0)||o.protected||o.type==='wall'||o.type==='building'||o.debris==='optional-clear')return;
    o.hp-=speed*.35;
    if(o.hp<=0){W().removeObstacle(s.world,o);s.navVersion=(s.navVersion||0)+1;makeNoise(s,{x:o.x+o.w/2,y:o.y+o.h/2},'break');}
  }
  // The blade can crush a parked vehicle or ordinary street obstruction from a standstill. Structural walls,
  // buildings and protected story geometry remain solid even if they happen to carry hit points.
  function crushObstacle(s,v,o,dt){
    if(!(o.hp>0)||o.protected||o.type==='wall'||o.type==='building'||o.debris==='optional-clear')return false;
    o.hp-=vdef(v).crushRate*dt;
    if(o.hp<=0){
      W().removeObstacle(s.world,o);s.navVersion=(s.navVersion||0)+1;
      const c={x:o.x+o.w/2,y:o.y+o.h/2};makeNoise(s,c,'break');emit(s,'crash',v.vehicleType);
      effect(s,c.x,c.y-20,o.type==='car'?'VEHICLE CRUSHED':'PATH CLEARED','#a8b9b8');
    }
    return true;
  }
  // A bulldozer pushing into an authored pile: resistance while it strains, dust and noise, then the pile is gone.
  function clearDebris(s,v,o,dt){
    const st=s.debrisState[o.debrisId]||(s.debrisState[o.debrisId]={progress:0,cleared:false});if(st.cleared)return;
    st.progress+=dt;const c={x:o.x+o.w/2,y:o.y+o.h/2};
    if(s.time>=(st.nextFx||0)){st.nextFx=s.time+.3;s.fx.push({x:c.x+(random(s)-.5)*o.w,y:c.y+(random(s)-.5)*o.h,sprite:'vfx/dust',frames:4,life:.6,maxLife:.6,text:'',color:'#fff'});makeNoise(s,c,'strain');emit(s,'strain',v.vehicleType);}
    if(st.progress<vdef(v).clearTime)return;
    st.cleared=true;W().removeObstacle(s.world,o);s.navVersion=(s.navVersion||0)+1;
    s.world.props.push({art:'props/debrisCleared',x:Math.round(c.x),y:Math.round(c.y),flat:true,variant:(o.x|0)%2,debrisId:o.debrisId});
    makeNoise(s,c,'clear');emit(s,'cleared',o.debrisId);effect(s,c.x,c.y-20,'ROUTE CLEARED','#a8b9b8');
  }
  function vehicleTick(s,v,input,dt){
    const d=vdef(v);
    if(v.obstacle){
      if(!v.dead){v.integrity=Math.min(v.integrity,Math.max(0,hullToIntegrity(v,v.obstacle.hp)));if(v.integrity<=0){v.dead=true;v.obstacle.driveable=false;}}
      if(!s.world.obstacles.includes(v.obstacle)){v.obstacle=null;v.parked=false;v.dead=true;v.removed=true;}return;
    }
    if(v.dead||v.driver==null)return;
    v.crashCd=Math.max(0,v.crashCd-dt);v.hitIds.clear();
    if(v.integrity<=0){breakdown(s,v);return;}
    v.engineCd-=dt;
    if(v.fuel>0&&v.engineCd<=0){const ratio=Math.abs(v.speed)/d.topSpeed;makeNoise(s,v,'engine',d.noise[0]+d.noise[1]*ratio);emit(s,'engine',ratio);v.engineCd+=.34;}
    // heavy machines burn fuel just running
    if(d.idleBurn&&v.fuel>0)v.fuel=Math.max(0,v.fuel-d.idleBurn*dt);
    const top=d.topSpeed*(.42+.58*v.integrity/v.maxIntegrity),dx=clamp(input.x||0,-1,1),dy=clamp(input.y||0,-1,1);
    let throttle=0,braking=false,brakeForce=1;
    const steering=s.settings?.drivingStyle!=='directional',speed=Math.abs(v.speed);
    if(input.pedals){
      // Controller: RT gas, LT brake then reverse, both brake to rest; the stick only steers (city_v2 Section 0).
      const rt=input.rt||0,lt=input.lt||0;
      if(rt>0&&lt>0){braking=true;brakeForce=Math.max(rt,lt);}
      else if(rt>0){if(v.speed<-1){braking=true;brakeForce=rt;}else throttle=rt;}
      else if(lt>0){if(v.speed>1){braking=true;brakeForce=lt;}else throttle=-lt;}
      const back=v.speed<-1||v.speed<=1&&throttle<0;
      if(steering){
        const turn=(d.turn-d.turnFalloff*Math.min(1,speed/top))*(d.pivot?1:Math.min(1,speed/75));
        const angle=v.angle+dx*turn*(d.pivot&&speed<5?1:Math.sign(v.speed))*dt;
        if(!carBlocked(s,v,v.x,v.y,angle))v.angle=angle;
      }else if(Math.hypot(dx,dy)>.05){
        // directional: the hood turns toward the stick, or the tail when backing up
        const want=Math.atan2(back?-dy:dy,back?-dx:dx),diff=Math.atan2(Math.sin(want-v.angle),Math.cos(want-v.angle));
        const turn=(d.turn-d.turnFalloff*Math.min(1,speed/top))*dt,angle=v.angle+clamp(diff,-turn,turn);
        if(!carBlocked(s,v,v.x,v.y,angle))v.angle=angle;
      }
    }else if(steering){
      throttle=Math.abs(dy)>.05?-dy:0;braking=throttle*v.speed<0;
      // Steering follows the wheels: no pivot in place, and the turn reverses when backing up.
      // Tracked machines (pivot) can turn on the spot.
      const turn=(d.turn-d.turnFalloff*Math.min(1,speed/top))*(d.pivot?1:Math.min(1,speed/75));
      const angle=v.angle+dx*turn*(d.pivot&&speed<5?1:Math.sign(v.speed))*dt;
      if(!carBlocked(s,v,v.x,v.y,angle))v.angle=angle;
    }else if(Math.hypot(dx,dy)>.05){
      const want=Math.atan2(dy,dx),diff=Math.atan2(Math.sin(want-v.angle),Math.cos(want-v.angle));
      const turn=(d.turn-d.turnFalloff*Math.min(1,speed/top))*dt,angle=v.angle+clamp(diff,-turn,turn);
      if(!carBlocked(s,v,v.x,v.y,angle))v.angle=angle;
      throttle=Math.abs(diff)<1.2?Math.min(1,Math.hypot(dx,dy)):0;braking=Math.abs(diff)>2.2;
    }
    const others=s.players.filter(p=>!p.dead&&p.vehicle!==v.id);v.tether=false;
    if(others.length){const c={x:others.reduce((a,p)=>a+p.x,0)/others.length,y:others.reduce((a,p)=>a+p.y,0)/others.length};
      if(dist(v,c)>900&&((v.x-c.x)*Math.cos(v.angle)+(v.y-c.y)*Math.sin(v.angle))*Math.sign(throttle)>0){throttle*=.15;v.tether=true;}}
    if(v.fuel<=0)throttle=0;
    // Switching away from steering while reversing brakes to rest, never snaps
    // the velocity or silently enables reverse in directional mode.
    braking=braking||!input.pedals&&!steering&&v.speed<0;
    if(braking||!throttle)v.speed=Math.sign(v.speed)*Math.max(0,speed-(braking?d.brake*(.35+.65*brakeForce):d.drag)*dt);
    else v.speed+=d.accel*throttle*dt;
    v.speed=clamp(v.speed,-top*d.reverse,top);
    const n=Math.max(1,Math.ceil(Math.abs(v.speed)*dt/6));
    for(let i=0;i<n&&!v.dead;i++){
      const oldX=v.x,oldY=v.y,speed=Math.abs(v.speed),step=v.speed*dt/n,mx=Math.cos(v.angle)*step,my=Math.sin(v.angle)*step;
      let bx=Math.abs(mx)>1e-8?carBlocked(s,v,v.x+mx,v.y):null;
      if(!bx)v.x+=mx;
      let by=Math.abs(my)>1e-8?carBlocked(s,v,v.x,v.y+my):null;
      if(!by)v.y+=my;
      const travelled=Math.hypot(v.x-oldX,v.y-oldY);v.fuel=Math.max(0,v.fuel-travelled*d.burn);
      const hit=bx||by;
      // a blade pressed against authored debris works it loose instead of crashing
      if(hit&&d.clears&&hit.debris==='optional-clear'&&throttle*Math.sign(v.speed||throttle)>0){clearDebris(s,v,hit,dt/n);v.speed*=.5;continue;}
      // Ordinary vehicles and breakables yield under steady blade pressure, including when the dozer is wedged.
      if(hit&&d.crushRate&&throttle*Math.sign(v.speed||throttle)>0&&crushObstacle(s,v,hit,dt/n)){v.speed*=.5;continue;}
      // A cardinal impact has only one attempted axis, so detect lost motion too.
      if(hit&&travelled<Math.abs(step)*.25){
        if(speed>120&&v.crashCd<=0){
          v.integrity=Math.max(0,v.integrity-speed/9*d.impact);
          for(const id of [v.driver,...v.riders]){const p=s.players.find(p=>p.id===id);if(p)hurt(s,p,speed>200?8:3);}
          ramObstacle(s,hit,speed*d.ram);makeNoise(s,v,'crash');emit(s,'crash',v.vehicleType);v.crashCd=.35;
        }
        v.speed*=.22;
      }
      if(v.integrity<=0){breakdown(s,v);break;}
      if(travelled>0)roadkill(s,v);
    }
    if(!v.dead&&v.fuel<=0&&Math.abs(v.speed)<4){
      for(const id of [v.driver,...v.riders]){const p=s.players.find(p=>p.id===id);if(p)exitVehicle(s,p,false);}
      parkVehicle(s,v);emit(s,'stall',v.vehicleType);announce(s,'OUT OF FUEL');
    }
    seatPlayers(s,v);
  }
  // ---- refuelling (CITY.md Phase 6 rules): one press starts pouring one jerrycan (20 L) into a stopped vehicle's
  // tank or the chapel generator; fuel moves only when the pour completes, so walking away loses nothing. Until the
  // generator runs, the last 30 L the squad carries are reserved for it.
  const litres=v=>v/FUEL.distancePerLitre;
  function pourable(s){const st=s.supplies;return Math.max(0,st.vehicleFuel-(st.generatorFuelled?0:FUEL.reserve));}
  function refuelTarget(s,p){
    if(p.dead||p.vehicle!=null||s.boss?.active)return null;
    const st=s.supplies,gen=generatorAnchor(s);
    if(gen&&!st.generatorFuelled&&dist(p,gen)<70&&!lineObstacle(s,p.x,p.y,gen.x,gen.y))return {kind:'generator',anchor:gen};
    for(const v of s.vehicles){
      if(v.dead||v.driver!=null||Math.abs(v.speed)>5||carDistance(v,p)>=50||v.fuel>=v.maxFuel-1)continue;
      // a tank below 40% takes the press as a pour when the squad has fuel to spare; otherwise the press boards
      if(v.fuel<=0||v.fuel<v.maxFuel*.4&&pourable(s)>0)return {kind:'vehicle',vehicle:v};
    }
    return null;
  }
  function generatorAnchor(s){for(const b of s.world.buildings||[])for(const a of b.anchors||[])if(a.kind==='chapelGenerator')return a;return null;}
  function startRefuel(s,p,t){
    const st=s.supplies;
    if(t.kind==='generator'){if(st.vehicleFuel<FUEL.generatorCharge){announce(s,'THE GENERATOR NEEDS '+FUEL.generatorCharge+' L · you carry '+st.vehicleFuel);learn(s,['power']);emit(s,'reject','generator');return false;}}
    else{if(pourable(s)<=0){announce(s,st.vehicleFuel>0?'LAST '+FUEL.reserve+' L RESERVED FOR THE CHAPEL GENERATOR':'NO VEHICLE FUEL · find a jerrycan');emit(s,'reject','vehicle');return false;}}
    makeNoise(s,p,'pour');p.refuel={kind:t.kind,vehicleId:t.vehicle?.id??null,progress:0,time:t.kind==='generator'?3:1.5};emit(s,'pour',t.kind);return true;
  }
  function refuelTick(s,p,dt){
    const r=p.refuel;if(!r)return;const st=s.supplies;
    const v=r.vehicleId!=null?s.vehicles.find(q=>q.id===r.vehicleId):null,gen=r.kind==='generator'?generatorAnchor(s):null;
    const near=r.kind==='generator'?gen&&dist(p,gen)<90:v&&!v.dead&&v.driver==null&&carDistance(v,p)<70;
    if(p.dead||p.vehicle!=null||!near||p.moving){p.refuel=null;emit(s,'pourStop');return;}
    r.progress+=dt;if(r.progress<r.time)return;
    p.refuel=null;
    if(r.kind==='generator'){if(st.vehicleFuel<FUEL.generatorCharge||st.generatorFuelled)return;
      st.vehicleFuel-=FUEL.generatorCharge;st.generatorFuelled=true;s.circuit.emergency=true;
      makeNoise(s,gen,'generator');emit(s,'generator','start');effect(s,gen.x,gen.y-24,'GENERATOR RUNNING · EMERGENCY CIRCUIT LIVE','#ffd249');announce(s,'EMERGENCY CIRCUIT RESTORED');return;}
    const space=Math.floor(litres(v.maxFuel-v.fuel)),pour=Math.min(FUEL.jerrycan,pourable(s),space);
    if(pour<=0){announce(s,space<=0?'TANK FULL':'LAST '+FUEL.reserve+' L RESERVED FOR THE CHAPEL GENERATOR');emit(s,'reject','vehicle');return;}
    st.vehicleFuel-=pour;v.fuel=Math.min(v.maxFuel,v.fuel+pour*FUEL.distancePerLitre);
    effect(s,v.x,v.y-30,'+'+pour+' L · TANK '+Math.round(litres(v.fuel))+'/'+Math.round(litres(v.maxFuel))+' L','#ffd249');emit(s,'refuelled',v.vehicleType);
  }
  function cycleWeapon(s,p){
    saveWeapon(p);if(!p.weaponInventory.length)return;
    const next=p.backup?0:(p.weaponSlot??0)+1;
    selectWeapon(s,p,next<p.weaponInventory.length?next:-1);
  }
  function playerTick(s,p,input,dt){
    p.invuln=Math.max(0,p.invuln-dt);p.flash=Math.max(0,(p.flash||0)-dt);if(p.armorHit)p.armorHit=Math.max(0,p.armorHit-dt);if(p.armorBroken)p.armorBroken=Math.max(0,p.armorBroken-dt);if(p.armorPickup)p.armorPickup=Math.max(0,p.armorPickup-dt);p.muzzle=Math.max(0,(p.muzzle||0)-dt);
    p.exitCd=Math.max(0,p.exitCd-dt);
    if(p.notice&&(p.notice.t-=dt)<=0)p.notice=null;
    // upgrades are chosen only in the owner's paused panel (hud.js), so no live press can spend one
    if(input.toggle)p.auto=!p.auto;if(input.switch&&!p.dead)cycleWeapon(s,p);
    if(p.dead){const helper=s.players.find(q=>!q.dead&&dist(p,q)<48);p.revive=helper?p.revive+dt:Math.max(0,p.revive-dt*.5);if(p.revive>=3){p.dead=false;p.hp=p.maxHp*.45;p.invuln=3;p.revive=0;emit(s,'revive');makeNoise(s,p,'revive');effect(s,p.x,p.y,'REVIVED',p.color);s.fx.push({x:p.x,y:p.y,sprite:'vfx/reviveRing',frames:4,life:.5,maxLife:.5,text:'',color:p.color});}return;}
    if(input.heal)useMedkit(s,p,true);
    if(input.eat)eat(s,p,true);
    turretInput(s,p,input,dt);turretResupply(s,p,dt);
    p.fed=Math.max(0,(p.fed||0)-dt);
    if(p.vehicle!=null){
      if(input.interact)exitVehicle(s,p);
      else{const v=vehicleFor(s,p);seatPlayers(s,v);p.tether=v.tether;p.staminaDelay=0;p.stamina=Math.min(p.maxStamina,p.stamina+22*dt);
        if(v.driver!==p.id){aim(s,p);fire(s,p,dt);}return;}
      // One press exits only, even if a weapon or another car is beside the door.
      input={...input,interact:false};
    }
    let dx=input.x||0,dy=input.y||0,len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len;}
    if(!input.run)p.sprintExhausted=false;
    const sprint=!!input.run&&!p.sprintExhausted&&p.stamina>0;
    const speed=p.speed*(sprint?1+.6*Math.min(1,p.stamina/(28*dt||1)):1);
    const alive=s.players.filter(q=>!q.dead),others=alive.filter(q=>q!==p);
    if(others.length){const c={x:others.reduce((v,q)=>v+q.x,0)/others.length,y:others.reduce((v,q)=>v+q.y,0)/others.length};if(dist(p,c)>420&&(p.x-c.x)*dx+(p.y-c.y)*dy>0){dx*=.05;dy*=.05;p.tether=true;}else p.tether=false;}
    // during the fight the sealed fence bounds the squad; this clamp is the same square, so the two always agree
    if(s.boss&&s.boss.active){const lim=ARENA.play-p.r,nx=p.x+dx*speed*dt,ny=p.y+dy*speed*dt;if(Math.abs(nx)>lim&&nx*dx>0)dx=0;if(Math.abs(ny)>lim&&ny*dy>0)dy=0;}
    p.wallTarget=null;if(len>.05){const obstacle=W().blocked(s.world,p.x+dx*18,p.y+dy*18,p.r);if(obstacle&&obstacle.hp>0&&!obstacle.protected&&obstacle.debris!=='optional-clear')p.wallTarget=obstacle;p.angle=p.moveAngle=Math.atan2(dy,dx);}
    const oldX=p.x,oldY=p.y;W().move(s.world,p,dx*speed*dt,dy*speed*dt);p.moving=Math.hypot(p.x-oldX,p.y-oldY)>.01;
    p.running=sprint&&p.moving;
    const fed=p.fed>0?PROVISIONS:null;
    if(p.running){p.stamina=Math.max(0,p.stamina-28*dt*(fed?fed.sprintDrain:1));p.staminaDelay=1.25;if(p.stamina===0)p.sprintExhausted=true;}
    else{p.staminaDelay=Math.max(0,p.staminaDelay-dt);if(!p.staminaDelay)p.stamina=Math.min(p.maxStamina,p.stamina+22*dt*(fed?fed.staminaRegen:1));}
    // footsteps: running carries far and starts at once; walking carries only a few steps and the first pace is silent
    p.stepNoise=Math.max(0,(p.stepNoise||0)-dt);
    // the audible footstep follows the floor underfoot; hearing radii stay the walk/run values
    if(p.moving&&p.stepNoise<=0){if(p.running){makeNoise(s,p,'run');p.stepNoise=.45;emit(s,'step',W().surfaceAt(s.world,p.x,p.y));}else{if(p.walked){makeNoise(s,p,'walk');emit(s,'step',W().surfaceAt(s.world,p.x,p.y));}p.stepNoise=.6;}}
    p.walked=p.moving;refuelTick(s,p,dt);
    p.nearItem=nearestInteract(s,p)?.id??null;
    p.nearVehicle=nearestVehicle(s,p)?.id??null;
    const refuel=p.nearItem===null&&!p.refuel?refuelTarget(s,p):null;p.nearRefuel=refuel?refuel.kind+':'+(refuel.vehicle?.id??'generator'):null;
    p.nearDoor=p.nearItem===null&&p.nearVehicle===null&&!refuel?nearestDoor(s,p)?.id??null:null;
    if(input.interact){if(p.nearItem!==null){const item=s.loot.find(q=>q.id===p.nearItem);if(item)collect(s,p,item);}
      else if(refuel){startRefuel(s,p,refuel);}
      else if(p.nearVehicle!==null&&enterVehicle(s,s.vehicles.find(v=>v.id===p.nearVehicle),p))return;
      else if(p.nearDoor!==null)startDoor(s,p,doorById(s,p.nearDoor));
      else{const t=nearestTurret(s,p);if(t){if(t.ammo>=TURRET.cap)notify(s,p,'Turret full','#8a9a94','turret-full');else if(s.ammo.bullets<=0)notify(s,p,'No bullets to load','#8a9a94','turret-empty');else p.resupply={id:t.id,acc:0};}}}
    // XP is pulled from 300u — past every primary's muzzle but the rifle — so
    // kills made into a crowd still pay. A short pull silently voids most of a
    // horde's XP and was why co-op never levelled.
    for(const item of s.loot){if(item.taken||item.type==='weapon')continue;const d=dist(p,item);if(item.type==='xp'&&d<300){const speed=340*dt/Math.max(d,1);item.x+=(p.x-item.x)*Math.min(1,speed);item.y+=(p.y-item.y)*Math.min(1,speed);}if(d<(item.type==='xp'?18:25))collect(s,p,item);}
    aim(s,p);fire(s,p,dt);
  }
  // A local navigation grid guides infected around buildings; it is not serialized game state.
  let nav=null;
  function buildNav(s,target){
    const size=NAV_SIZE,cell=NAV_CELL,min=NAV_MIN;
    if(!nav||nav.world!==s.world||nav.version!==(s.navVersion||0)){
      const pass=new Uint8Array(size*size);for(let y=0;y<size;y++)for(let x=0;x<size;x++)pass[y*size+x]=W().blocked(s.world,min+(x+.5)*cell,min+(y+.5)*cell,12)?0:1;
      // doorways and barricade gaps are always walkable, whatever the sampling says
      const stamp=r=>{if(!r)return;for(let y=clamp(Math.floor((r.y+4-min)/cell),0,size-1);y<=clamp(Math.floor((r.y+r.h-4-min)/cell),0,size-1);y++)for(let x=clamp(Math.floor((r.x+4-min)/cell),0,size-1);x<=clamp(Math.floor((r.x+r.w-4-min)/cell),0,size-1);x++)pass[y*size+x]=1;};
      for(const l of s.world.lots||[])for(const e of l.entrances)stamp(e.rect);
      for(const h of s.world.buildings||[]){for(const d of h.exteriorDoors)stamp(d.rect);for(const d of h.interiorDoors)if(d.kind!=='secured'||s.doorState?.[d.id]?.open)stamp(d.rect);}
      for(const p of s.world.setpieces||[])stamp(p.gapRect);
      nav={world:s.world,version:s.navVersion||0,pass,queue:new Int32Array(size*size),paths:new Map()};
    }
    const tx=clamp(Math.floor((target.x-min)/cell),0,size-1),ty=clamp(Math.floor((target.y-min)/cell),0,size-1),id=ty*size+tx;
    if(nav.paths.has(id))return nav.paths.get(id);
    const cost=new Int32Array(size*size);cost.fill(-1);const {queue,pass}=nav;let head=0,tail=1;queue[0]=id;cost[id]=0;
    while(head<tail){
      const k=queue[head++],x=k%size,next=cost[k]+1;
      if(x>0&&pass[k-1]&&cost[k-1]<0){cost[k-1]=next;queue[tail++]=k-1;}
      if(x<size-1&&pass[k+1]&&cost[k+1]<0){cost[k+1]=next;queue[tail++]=k+1;}
      if(k>=size&&pass[k-size]&&cost[k-size]<0){cost[k-size]=next;queue[tail++]=k-size;}
      if(k<size*(size-1)&&pass[k+size]&&cost[k+size]<0){cost[k+size]=next;queue[tail++]=k+size;}
    }
    if(nav.paths.size>=16)nav.paths.delete(nav.paths.keys().next().value);
    nav.paths.set(id,cost);return cost;
  }
  function investigate(e,target){
    e.alert=true;e.state='investigate';e.target={x:target.x,y:target.y};e.alertT=20;e.searchT=0;
  }
  // How far an infected finds a survivor by itself, by what it is already doing: unaware it has to be close enough
  // to touch, hunting a sound it notices further out, and mid-chase it holds on well past both so a survivor has to
  // actually break away. Only a wall hides you (a ghost not even that).
  const SENSE={roam:72,alert:120,chase:190};
  function senses(s,e,living){
    // The migration streams past on its own errand: a band infected has to be provoked by a sound or a collision
    // before it looks at anybody. Once it is alerted it hunts like the rest.
    if(e.type==='band'&&!e.alert)return null;
    const reach=e.state==='chase'?SENSE.chase:e.alert?SENSE.alert:SENSE.roam;
    let found=null,best=reach;
    for(const q of living){
      const d=dist(e,q);if(d>=best)continue;
      if(e.type!=='ghost'&&lineObstacle(s,e.x,e.y,q.x,q.y))continue;
      found=q;best=d;
    }
    return found;
  }
  function wander(s,e,dt){
    e.wanderT-=dt;
    if(e.wanderT<=0){e.wanderAngle+=(random(s)-.5)*Math.PI;e.wanderT=1.5+random(s)*3;e.idle=random(s)<.18;}
    if(e.idle)return;
    const speed=e.speed*.38,dx=Math.cos(e.wanderAngle)*speed*dt,dy=Math.sin(e.wanderAngle)*speed*dt;
    // Idle infected stay outdoors; investigating infected may follow sounds inside.
    if(e.state==='roam'&&(s.world.buildings||[]).some(h=>e.x+dx>h.x&&e.x+dx<h.x+h.w&&e.y+dy>h.y&&e.y+dy<h.y+h.h)){e.wanderAngle+=Math.PI;e.wanderT=.5;return;}
    const x=e.x,y=e.y;W().move(s.world,e,dx,dy);e.angle=e.wanderAngle;
    if(Math.hypot(e.x-x,e.y-y)<speed*dt*.25){e.wanderAngle+=Math.PI/2+random(s);e.wanderT=.5;}
  }
  function enemyTick(s,e,dt){
    if(e.dead||e.bossOwned)return;e.hitCd=Math.max(0,e.hitCd-dt);e.flash=Math.max(0,(e.flash||0)-dt);
    if(e.stunT>0){e.stunT-=dt;return;} // blast stagger: no movement and no attacks
    const living=s.players.filter(p=>!p.dead);if(!living.length)return;
    // Hear each event once. The destination is a snapshot, not a player reference.
    for(const n of s.noise)if(n.id>e.heardNoise&&n.audible>0&&dist(e,n)<=n.r){e.heardNoise=n.id;investigate(e,n);}
    // Senses beat memory: a survivor in range is chased at their live position, and the moment they slip out of
    // range that position is all the infected keeps -- it walks to the spot, then searches around it.
    const seen=senses(s,e,living);
    if(seen){e.alert=true;e.state='chase';e.target={x:seen.x,y:seen.y};e.alertT=Math.max(e.alertT||0,8);}
    else if(e.state==='chase'){e.state='investigate';e.alertT=Math.max(e.alertT||0,7);}
    if(e.alert&&e.target){
      e.alertT-=dt;
      if(e.state==='investigate'||e.state==='chase'){
        let dx=e.target.x-e.x,dy=e.target.y-e.y,d=Math.hypot(dx,dy);
        if(e.state!=='chase'&&(d<22||e.alertT<=0)){e.state='search';e.searchT=6;e.wanderT=0;}
        else{
          if(e.type!=='ghost'&&lineObstacle(s,e.x,e.y,e.target.x,e.target.y)){
            const cost=buildNav(s,e.target),gx=clamp(Math.floor((e.x-NAV_MIN)/NAV_CELL),0,NAV_SIZE-1),gy=clamp(Math.floor((e.y-NAV_MIN)/NAV_CELL),0,NAV_SIZE-1);
            let best=cost[gy*NAV_SIZE+gx]>=0?cost[gy*NAV_SIZE+gx]:Infinity,bx=gx,by=gy;
            for(const [nx,ny] of [[gx-1,gy],[gx+1,gy],[gx,gy-1],[gx,gy+1]]){if(nx<0||ny<0||nx>=NAV_SIZE||ny>=NAV_SIZE)continue;const c=cost[ny*NAV_SIZE+nx];if(c>=0&&c<best){best=c;bx=nx;by=ny;}}
            dx=NAV_MIN+(bx+.5)*NAV_CELL-e.x;dy=NAV_MIN+(by+.5)*NAV_CELL-e.y;
          }
          const length=Math.hypot(dx,dy)||1,sp=e.speed*(1+Math.min(PRESSURE.speedMax,(s.pressure||0)/PRESSURE.speedPer)),step=Math.min(sp*dt,length);
          if(e.type==='ghost'){e.x+=dx/length*step;e.y+=dy/length*step;}else W().move(s.world,e,dx/length*step,dy/length*step);
          e.angle=Math.atan2(dy,dx);
        }
      }else if(e.state==='search'){
        e.searchT-=dt;wander(s,e,dt);
        if(e.searchT<=0){e.alert=false;e.state='roam';e.target=null;e.wanderT=0;}
      }
    }else if(e.type==='band'){
      // the migration streams down the avenue; a wreck in the lane makes it slide sideways around, not stall
      const bx=e.x,by=e.y,vx=e.vx||0,vy=e.vy||0,step=Math.hypot(vx,vy)*dt;W().move(s.world,e,vx*dt,vy*dt);
      if(Math.hypot(e.x-bx,e.y-by)<step*.5){const sx=vy?1:0,sy=vx?1:0,dir=e.id%2?1:-1;W().move(s.world,e,sx*step*1.5*dir,sy*step*1.5*dir);if(Math.hypot(e.x-bx,e.y-by)<step*.5)W().move(s.world,e,-sx*step*1.5*dir,-sy*step*1.5*dir);}
      e.angle=Math.atan2(vy,vx);
    }else wander(s,e,dt);
    for(const q of living){
      const v=vehicleFor(s,q),contact=v?carDistance(v,e)<e.r+2:dist(e,q)<e.r+q.r+2;
      if(!contact||v&&(Math.abs(v.speed)>40||e.type==='ghost'))continue;
      investigate(e,q);
      if(e.hitCd<=0){
        if(v){v.integrity=Math.max(0,v.integrity-e.damage);if(v.integrity<=0)breakdown(s,v);}
        else hurt(s,q,e.damage);
        e.hitCd=.8;
      }
    }
    for(const t of s.turrets||[])if(e.type!=='ghost'&&e.hitCd<=0&&Math.hypot(e.x-t.x,e.y-t.y)<(e.r||10)+12){t.durability-=e.damage;e.hitCd=.8;investigate(e,t);}
    // Culling and band expiry never happen in view: the camera widens while driving and on wide screens, so a flat
    // radius round the squad used to take infected off the screen in front of the player. Off camera, they go as before.
    const nearest=Math.min(...living.map(p=>dist(e,p))),c=s.camera;
    const onCamera=Math.abs(e.x-c.x)<c.w/2+180&&Math.abs(e.y-c.y)<c.h/2+180;
    if(!onCamera&&(nearest>1400&&!s.boss||e.type==='band'&&s.time>(e.expires||Infinity)))e.dead=true;
  }
  // Outbreak pressure (PLAYER_POWER Phase 0 / 10). The threat follows what the squad has become and how far the run has
  // got, never the clock: shared level - 1, plus (averaged over living survivors) half a point per attachment carried,
  // armor/50 and half a point for a carried or deployed turret, plus 1.5 per campaign step done. Waves, surges and
  // migrations keep their time rhythm; only their size and the infected mix read pressure.
  function squadPower(s){
    const living=s.players.filter(p=>!p.dead);if(!living.length)return 0;let sum=0;
    for(const p of living){const att=(p.weaponInventory||[]).reduce((n,w)=>n+(w.attachments||[]).length,0);sum+=att*.5+(p.armor||0)/50+(p.turret||(s.turrets||[]).some(t=>t.ownerId===p.id)?.5:0);}
    return Math.max(0,(s.level||1)-1)+sum/living.length;
  }
  function campaignSteps(s){const c=s.campaign||{};return (s.circuit&&s.circuit.emergency?1:0)+(Object.keys(c.evidence||{}).length?1:0)+(c.bossDown?1:0)+(c.payload?1:0)+(c.prepared?1:0)+(c.transmitted?1:0);}
  function pressure(s){return squadPower(s)+1.5*campaignSteps(s);}
  // Phase 10 tuning (tools/power-sim.mjs holds over seeds 1,7,21,42,3,11,33,50): cap per 12 -> 18, rate per .35 -> .25, speed per 40 -> 60
  const PRESSURE={tierStep:3,maxTier:9,capPer:18,capMax:2.5,rateBase:.9,ratePer:.25,runners:1,brutes:2,speedPer:60,speedMax:.35};
  // live crowd cap and spawns per second for the current pressure, party size and surge phase
  function spawnBudget(s,n){const P=s.pressure||0;
    return {cap:Math.round((75+n*20)*Math.min(PRESSURE.capMax,1+P/PRESSURE.capPer)*(.5+.5*(s.convergence??1))*(s.finalPush?1.3:1)),
      rate:(PRESSURE.rateBase+PRESSURE.ratePer*P)*(.65+.35*n)*(s.surge==='CREST'?2.6:s.surge==='EBB'?.35:1)*(s.convergence??1)*(s.finalPush?2:1),
      speed:1+Math.min(PRESSURE.speedMax,P/PRESSURE.speedPer),tier:Math.min(PRESSURE.maxTier,1+Math.floor(P/PRESSURE.tierStep))};}
  function waveTick(s,dt){
    s.wave=1+Math.floor(s.time/45);s.pressure=pressure(s);
    {const t=Math.min(PRESSURE.maxTier,1+Math.floor(s.pressure/PRESSURE.tierStep));if(s.threat&&t>s.threat)announce(s,'OUTBREAK ESCALATES · TIER '+t);s.threat=Math.max(s.threat||1,t);}
    const P=s.pressure;
    const phase=s.time%15;s.surge=phase<8?'SWELL':phase<11?'CREST':'EBB';s.waveProgress=(s.time%45)/45;
    const living=s.players.filter(p=>!p.dead);if(!living.length)return;
    const {cap,rate}=spawnBudget(s,living.length);
    s.spawnAcc+=dt*rate;
    while(s.spawnAcc>=1){s.spawnAcc--;if(s.enemies.length>=cap)break;
      const p=living[Math.floor(random(s)*living.length)],angle=random(s)*Math.PI*2,rad=Math.max(s.camera.w*.65,440);let x=p.x+Math.cos(angle)*rad,y=p.y+Math.sin(angle)*rad;
      for(let k=0;k<15&&W().blocked(s.world,x,y,17);k++){x=p.x+(random(s)-.5)*rad*2;y=p.y+(random(s)-.5)*rad*2;}
      if((s.world.buildings||[]).some(h=>x>h.x&&x<h.x+h.w&&y>h.y&&y<h.y+h.h)||W().blocked(s.world,x,y,17)||Math.hypot(x-p.x,y-p.y)<250)continue;
      const district=W().district(p.x,p.y),roll=random(s);spawn(s,roll<.12&&P>=PRESSURE.brutes?'brute':roll<.42?district.enemy:roll<.62&&P>=PRESSURE.runners?'runner':'walker',x,y);
    }
    if(s.wave%3===2&&s.bandWave!==s.wave&&s.time%45>8){const p=living[0],vertical=Math.abs(p.x-Math.round(p.x/1400)*1400)<Math.abs(p.y-Math.round(p.y/1400)*1400);s.band={vertical,coord:Math.round((vertical?p.x:p.y)/1400)*1400,at:s.time,spawn:0};s.bandWave=s.wave;} // no announcement: the migration is discovered on the street
    if(s.band){const b=s.band,age=s.time-b.at;if(age>3&&age<17){b.spawn+=dt*5;while(b.spawn>=1){b.spawn--;const p=living[0],off=(random(s)-.5)*95,along=(b.vertical?p.y:p.x)-500;spawn(s,'band',b.vertical?b.coord+off:along,b.vertical?along:b.coord+off,{vx:b.vertical?0:140,vy:b.vertical?140:0,expires:s.time+9});}}if(age>20)s.band=null;}
  }
  function separateEnemies(s,dt){
    const cells=new Map(),cell=40;
    for(const e of s.enemies){if(e.dead||e.bossOwned||e.type==='ghost'||e.type==='band')continue;const gx=Math.floor(e.x/cell),gy=Math.floor(e.y/cell);
      for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++)for(const other of cells.get(x+','+y)||[]){const dx=e.x-other.x,dy=e.y-other.y,d=Math.hypot(dx,dy),minimum=(e.r+other.r)*.78;if(d>=minimum)continue;const a=d>.01?Math.atan2(dy,dx):(e.id*.73),push=Math.min(2,(minimum-d)*dt*3);W().move(s.world,e,Math.cos(a)*push,Math.sin(a)*push);W().move(s.world,other,-Math.cos(a)*push,-Math.sin(a)*push);}
      const key=gx+','+gy;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(e);
    }
  }
  // Roofs fade while a living survivor is inside a building; dt-driven so pause holds them.
  // Roofs fade per zone, so walking into one wing of a large building does not reveal the others.
  // Standing in any room or lot also marks its location visited (and therefore discovered).
  const inRect=(p,r)=>p.x>r.x&&p.x<r.x+r.w&&p.y>r.y&&p.y<r.y+r.h;
  function visit(s,id){const st=s.locationState?.[id];if(st&&!st.visited){st.visited=st.discovered=true;emit(s,'visit',id);}}
  function interiors(s,dt){
    const living=s.players.filter(p=>!p.dead);
    for(const h of s.world.buildings||[]){
      let any=false,top=0;
      for(const z of h.roofZones){
        const inside=living.some(p=>z.rects.some(r=>inRect(p,r)));
        z.occupied=inside;z.alpha+=((inside?.06:1)-z.alpha)*Math.min(1,dt*7);any=any||inside;top=Math.max(top,z.alpha);
      }
      h.occupied=any;h.roofAlpha=top;if(any)visit(s,h.locationId);
    }
    for(const l of s.world.lots||[])if(living.some(p=>inRect(p,l.rect)))visit(s,l.locationId);
    // street caches have no roof or fence: reaching the spot is the visit
    if(s.time>=(s.nextCacheVisit||0)){s.nextCacheVisit=s.time+.25;for(const l of s.world.locations||[])if(l.kind==='cache'&&!s.locationState[l.id]?.visited&&living.some(p=>Math.abs(p.x-l.rect.x-l.rect.w/2)<110&&Math.abs(p.y-l.rect.y-l.rect.h/2)<110))visit(s,l.id);}
  }
  // ---- secured doors: one press starts forcing; progress holds while a survivor stays beside it ----
  const DOOR_REACH=70;
  function doorById(s,id){for(const b of s.world.buildings||[])for(const d of b.interiorDoors)if(d.id===id)return d;return null;}
  function doorCentre(d){return {x:d.rect.x+d.rect.w/2,y:d.rect.y+d.rect.h/2};}
  function nearestDoor(s,p){
    if(p.dead||p.vehicle!=null)return null;let best=null,range=DOOR_REACH;
    for(const id in s.doorState){const st=s.doorState[id],d=doorById(s,id);if(st.open||!d)continue;const c=doorCentre(d),r=dist(p,c);
      if(r>=range)continue;const wall=lineObstacle(s,p.x,p.y,c.x,c.y);if(wall&&wall.obstacle.doorId!==id)continue;range=r;best=d;}
    return best;
  }
  function startDoor(s,p,d){const st=s.doorState[d.id];if(!st||st.open||st.active)return false;st.active=true;announce(s,'FORCING THE DOOR · stay beside it');return true;}
  function openDoor(s,d){
    const st=s.doorState[d.id];if(!st||st.open)return false;st.open=true;st.active=false;st.progress=d.access.time;
    const o=s.world.obstacles.find(o=>o.doorId===d.id);if(o){W().removeObstacle(s.world,o);s.navVersion=(s.navVersion||0)+1;}
    const c=doorCentre(d);makeNoise(s,c,'door',d.access.noise);emit(s,'door','forced');effect(s,c.x,c.y-20,'DOOR FORCED','#edc37c');return true;
  }
  function doorsTick(s,dt){
    const living=s.players.filter(p=>!p.dead);
    for(const id in s.doorState){const st=s.doorState[id],d=doorById(s,id);if(!st.active||st.open||!d)continue;const c=doorCentre(d);
      if(!living.some(p=>dist(p,c)<DOOR_REACH+20))continue;
      st.progress+=dt;if(s.time>=st.nextNoise){makeNoise(s,c,'pry');st.nextNoise=s.time+.8;}
      if(st.progress>=d.access.time)openDoor(s,d);}
  }
  // ---- the campaign (CITY.md Phase 12) ----
  // Facts, not an act counter: each is set once by a physical action and never unset. The squad may visit any
  // district in any order; only interactions whose physical prerequisites are missing refuse (with the reason).
  const EVIDENCE={
    patientRecords:{learns:['subject'],title:'ST. ORISON · PATIENT RECORDS',body:'Transfer 9-114: the subject moved to Central Quarantine, Block C. Disposition: pending incineration review.',reveals:['patient-furnace','holding-building']},
    trialEvidence:{learns:['subject'],title:'RESTRICTED TRIAL · EAST WING',body:'Thermal suppression failed. Core temperature above 900 C. The subject draws the infected toward it. Containment moved it to the disposal yard.',reveals:['inner-arena']},
    furnaceClue:{learns:['subject','payload','override'],title:'MEMO · COMMAND LIAISON',body:'The command post holds the transmitter payload and the Checkpoint Nine override. Both stay sealed while the subject in the yard is active.',reveals:['command-post','checkpoint-nine']},
    refugeLedger:{learns:['power','prepare'],title:'ST. AUBIN REFUGE LEDGER',body:'Generator dry. It needs 30 L of vehicle fuel (Ashworks machine shop). It feeds the emergency circuit to Blackglass Radio and the checkpoint gate.',reveals:['machine-shop','fuel-store','blackglass-radio']},
    intakeManifest:{learns:['override'],title:'HOLDING · INTAKE MANIFEST',body:'Day 3: 212 names. Day 7: all remaining transferred to disposal. Override logged with the command post.',reveals:['command-post']}
  };
  const HOLDS={prepare:12,transmit:40,gate:8},REPLY={learns:['gate','escape'],title:'REPLY · SOUTH CORDON',body:'Blackglass, this is the cordon. We have your records. Nobody was supposed to be alive in there. Open Checkpoint Nine from your side and walk out slowly. We will not fire.'};
  // outside the city: the mouth beyond the evacuation gate, the one stretch past the cordon fence (world.js EDGE)
  const EXIT={x:0,y:3580,w:170,h:48};
  function campaignInit(s){
    const w=s.world;s.campaign=Object.assign(s.campaign||{},{evidence:{},known:[],learned:{},read:[],generator:false,prepared:false,prepareProgress:0,payload:false,override:false,
      transmitted:false,transmitProgress:0,gateOpen:false,gateProgress:0,escaped:false,palletDropped:false,payloadSpawned:false,holding:null});
    for(const b of w.buildings||[])for(const a of b.anchors||[])if(EVIDENCE[a.kind])s.loot.push({id:'evidence-'+a.kind,x:a.x,y:a.y,type:'evidence',evidence:a.kind,amount:1,label:'records',interior:true});
    s.document=null;
  }
  function anchorOf(s,kind){for(const b of s.world.buildings||[])for(const a of b.anchors||[])if(a.kind===kind)return a;return null;}
  function reveal(s,ids){for(const id of ids||[]){const st=s.locationState?.[id];if(st)st.discovered=true;if(!s.campaign.known.includes(id))s.campaign.known.push(id);}}
  function showDocument(s,doc){s.document={title:doc.title,body:doc.body,t:9};emit(s,'paper');const c=s.campaign;if(c){c.read=c.read||[];if(!c.read.some(r=>r.title===doc.title))c.read.push({title:doc.title,body:doc.body});learn(s,doc.learns);}}
  function collectEvidence(s,item){const c=s.campaign;if(c.evidence[item.evidence])return;c.evidence[item.evidence]=true;const e=EVIDENCE[item.evidence];reveal(s,e.reveals);showDocument(s,e);effect(s,item.x,item.y-20,'RECORDS TAKEN','#d8dbc8');}
  // what still blocks an interaction, in words; empty when it can start
  function missing(s,action){
    const c=s.campaign,out=[];
    if(action==='prepare'&&!s.circuit.emergency)out.push('no power: restore the St. Aubin generator');
    if(action==='transmit'){if(!c.prepared)out.push('the station is not prepared');if(!c.payload)out.push('no transmitter payload (command post)');}
    if(action==='gate'){if(!s.circuit.emergency)out.push('no emergency power');if(!c.override)out.push('no Checkpoint override');if(!c.transmitted)out.push('the distress call is not sent');}
    return out;
  }
  // The journal (pause menu): a to-do list of only what the squad has LEARNED it needs, never a route. A task appears
  // when a record or notice names it, when a place makes it obvious, when a refusal spells out a prerequisite, or when
  // the physical fact is already true; each shows what is known about it and whether it is done.
  const TASKS=['power','prepare','subject','payload','transmit','override','gate','escape'];
  const LEARNS={prepare:['power'],transmit:['prepare','payload'],gate:['power','override','transmit']};
  function learn(s,keys){const c=s.campaign;if(!c)return;c.learned=c.learned||{};for(const k of keys||[])c.learned[k]=true;}
  function journal(s){
    const c=s.campaign||{},L=c.learned||{},ev=c.evidence||{},sup=s.supplies||{},visited=id=>!!s.locationState?.[id]?.visited,power=!!s.circuit?.emergency;
    const wait=action=>missing(s,action).length?'Not yet. Everything below has to be done first:':null;
    // what a held action needs, each explained and ticked: shown under the task in the journal
    const NEEDS={
      transmit:[{done:!!c.prepared,text:'A ready station: with the power on, stay in the Blackglass control room (Northline) while it warms up.'},
        {done:!!c.payload,text:'The transmitter payload: the command post in Central Quarantine, sealed until Patient Furnace is dead.'}],
      gate:[{done:power,text:'Emergency power: carry '+FUEL.generatorCharge+' L of fuel from Ashworks to the St. Aubin Chapel generator (Old Quarter) and pour it in.'},
        {done:!!c.override,text:'The Checkpoint override: the command post in Central Quarantine, sealed until Patient Furnace is dead.'},
        {done:!!c.transmitted,text:'The distress call: ready Blackglass Radio, bring it the payload, then hold the transmitter room while it sends.'}]
    };
    const tasks={
      power:{title:'Restore emergency power',done:power,known:L.power||power||ev.refugeLedger,
        note:power?'The chapel generator is running the emergency circuit.':ev.refugeLedger?'The St. Aubin Chapel generator (Old Quarter) takes '+FUEL.generatorCharge+' L of vehicle fuel. You carry '+(sup.vehicleFuel||0)+' L; Ashworks has fuel.':'Emergency power runs from the St. Aubin Chapel generator (Old Quarter). Fuel: Ashworks.'},
      prepare:{title:'Ready Blackglass Radio',done:!!c.prepared,known:L.prepare||c.prepared||ev.refugeLedger||visited('blackglass-radio'),
        note:c.prepared?'The station is ready to transmit.':!power?'Blackglass (Northline) is dark. It needs the emergency circuit.':'Power reaches Blackglass. Someone has to stay in the control room while it warms up.'},
      subject:{title:'Deal with the subject in the disposal yard',done:!!c.bossDown,known:L.subject||c.bossDown||ev.patientRecords||ev.trialEvidence||ev.furnaceClue,
        note:c.bossDown?'The furnace is silent.':(ev.trialEvidence?'It runs above 900 C and draws the infected to it. ':'')+'Central Quarantine. Entering the yard seals its gates behind the squad.'},
      payload:{title:'Recover the transmitter payload',done:!!c.payload,known:L.payload||c.payload||c.bossDown||ev.furnaceClue,
        note:c.payload?'The squad carries it.':c.payloadUnlocked?'The command post in Central Quarantine is open.':'Held in the command post (Central Quarantine), sealed while the subject is active.'},
      transmit:{title:'Send the distress call',done:!!c.transmitted,known:L.transmit||c.transmitted||c.payload||visited('blackglass-radio')&&c.prepared,
        note:c.transmitted?'Someone answered.':wait('transmit')||'Blackglass is ready. The transmitter room has to be held while it sends, and it is loud.'},
      override:{title:'Recover the checkpoint override',done:!!c.override,known:L.override||c.override||ev.intakeManifest||ev.furnaceClue||c.bossDown,
        note:c.override?'The squad carries it.':c.payloadUnlocked?'The command post in Central Quarantine is open.':ev.furnaceClue?'Held in the command post (Central Quarantine), sealed while the subject is active.':'The command post logged it. Central Quarantine.'},
      gate:{title:'Open the barrier at Checkpoint Nine',done:!!c.gateOpen,known:L.gate||c.gateOpen||c.transmitted||visited('checkpoint-nine'),
        note:c.gateOpen?'The barrier is open.':wait('gate')||'Everything is ready. The barrier has to be held while it opens.'},
      escape:{title:'Walk out through Checkpoint Nine',done:!!c.escaped,known:L.escape||c.transmitted||c.gateOpen,
        note:c.escaped?'Out of the city.':c.gateOpen?'The barrier is open. Every survivor walks through it; revive anyone down first.':'The cordon waits on the other side of the south barrier.'}
    };
    const list=TASKS.map(id=>({id,...tasks[id],known:!!tasks[id].known,needs:!tasks[id].done&&NEEDS[id]&&missing(s,id).length?NEEDS[id]:[]})).filter(q=>q.known);
    return {goal:'Get everyone out of the city through Checkpoint Nine.',tasks:list,unknown:TASKS.length-list.length,records:(c.read||[]).slice()};
  }
  // The live objective card (top left): the whole run as a plain ordered chain, and the first step not yet done.
  // Text only, never a waypoint; the journal keeps the detail and the records.
  function objective(s){
    const c=s.campaign||{},sup=s.supplies||{},power=!!s.circuit?.emergency,fuel=sup.vehicleFuel||0,taken=(c.payload?1:0)+(c.override?1:0);
    const steps=[
      {id:'fuel',title:'Get fuel',done:power||fuel>=FUEL.generatorCharge,hint:'The generator takes '+FUEL.generatorCharge+' L of vehicle fuel. Jerrycans at the Ashworks machine shop. Carrying '+fuel+' L.'},
      {id:'generator',title:'Go to the chapel generator',done:power||!!s.locationState?.chapel?.visited,hint:'St. Aubin Chapel, Old Quarter.'},
      {id:'power',title:'Turn on the generator',done:power,hint:'Pour the fuel in beside the chapel generator. It powers Blackglass and the checkpoint.'},
      {id:'furnace',title:'Kill Patient Furnace',done:!!c.bossDown,hint:'The disposal yard, Central Quarantine. The gates seal once the squad commits.'},
      {id:'records',title:'Take the payload and override',done:taken===2,hint:'The command post, Central Quarantine. '+taken+' of 2 taken.'},
      {id:'prepare',title:'Ready Blackglass Radio',done:!!c.prepared,hint:'Northline. Stay in the control room while the station warms up.'},
      {id:'broadcast',title:'Broadcast the distress call',done:!!c.transmitted,hint:'Hold the Blackglass transmitter room while it sends. It is loud.'},
      {id:'gate',title:'Open Checkpoint Nine',done:!!c.gateOpen,hint:'Hold the south barrier while it opens.'},
      {id:'escape',title:'Escape',done:!!c.escaped,hint:'Walk the whole squad south through the open barrier. Revive anyone down first.'}
    ];
    const i=steps.findIndex(q=>!q.done),boss=!!(s.boss&&s.boss.active);
    const current=boss?{id:'furnace',title:'Kill Patient Furnace',hint:'Read the tells. Keep the squad alive.'}:i<0?{id:'out',title:'Out of the city',hint:'The cordon has you.'}:steps[i];
    return {steps,index:i<0?steps.length:i,current};
  }
  function holdPoint(s,action){
    if(action==='prepare')return anchorOf(s,'radioPrepare');if(action==='transmit')return anchorOf(s,'radioTransmit');
    const g=(s.world.setpieces||[]).find(p=>p.kind==='evacGate');return g?{x:g.x,y:g.y-40}:null;
  }
  const REACH={prepare:80,transmit:95,gate:110};
  function campaignTick(s,inputs,dt,living){
    const c=s.campaign;if(!c)return;
    s.document&&(s.document.t-=dt)<=0&&(s.document=null);
    // payload and override appear in the command post once the furnace is down, exactly once
    if(c.bossDown!==true&&s.campaign.bossDown)c.bossDown=true;
    if(s.campaign.payloadUnlocked&&!c.payloadSpawned){c.payloadSpawned=true;
      for(const [kind,type,label] of [['commandPayload','payload','transmitter payload'],['checkpointOverride','override','checkpoint override']]){const a=anchorOf(s,kind);if(a)s.loot.push({id:type,x:a.x,y:a.y,type,amount:1,label,interior:true});}}
    // notices: reading one reveals the places it names
    for(const p of s.world.props||[])if(p.notice&&!p.read&&living.some(q=>dist(q,p)<80)){p.read=true;reveal(s,p.notice.reveals);showDocument(s,p.notice);}
    // held interactions: one press starts, progress holds while a living survivor stays in reach and persists if they leave
    for(const action of ['prepare','transmit','gate']){
      const done=action==='prepare'?c.prepared:action==='transmit'?c.transmitted:c.gateOpen,pt=holdPoint(s,action);if(done||!pt)continue;
      const key=action+'Progress',present=living.filter(p=>dist(p,pt)<REACH[action]);
      const pressed=present.some(p=>inputs[p.id]?.interact&&p.nearItem===null&&p.nearVehicle===null&&!p.nearRefuel&&p.nearDoor===null);
      if(pressed&&c.holding!==action){const why=missing(s,action);if(why.length){announce(s,why.join(' · ').toUpperCase());emit(s,'reject',action);learn(s,[action,...LEARNS[action]]);}else{c.holding=action;emit(s,'hold',action);announce(s,action==='prepare'?'PREPARING THE STATION · stay in the control room':action==='transmit'?'TRANSMITTING · hold the transmitter room':'OPENING THE EVACUATION GATE · hold the barrier');}}
      if(c.holding!==action||!present.length)continue;
      c[key]+=dt;
      if(action!=='prepare'){s.spawnAcc+=dt*(action==='transmit'?1.4:2);if(s.time>=(c.nextNoise||0)){makeNoise(s,pt,action==='transmit'?'radio':'gate');c.nextNoise=s.time+1;}}
      if(c[key]<HOLDS[action])continue;
      c.holding=null;
      if(action==='prepare'){c.prepared=true;announce(s,'STATION READY · the transmitter needs the command payload');emit(s,'radioReady');dropPallet(s);}
      else if(action==='transmit'){c.transmitted=true;s.radio.done=true;announce(s,'DISTRESS CALL SENT · someone answered');emit(s,'transmitted');showDocument(s,REPLY);reveal(s,['checkpoint-nine']);}
      else{c.gateOpen=true;openEvacGate(s);}
    }
    // after the gate opens the city surges south, and the run ends only when every survivor, standing, is through it
    if(c.gateOpen&&!c.escaped&&s.players.every(p=>!p.dead&&inExit(p))){c.escaped=true;s.mode='won';emit(s,'escape');announce(s,'THROUGH CHECKPOINT NINE · the squad is out');}
  }
  const inExit=q=>Math.abs(q.x-EXIT.x)<EXIT.w/2&&Math.abs(q.y-EXIT.y)<EXIT.h/2;
  function dropPallet(s){
    const c=s.campaign,radio=s.world.landmarks.find(l=>l.id==='radio');if(c.palletDropped||!radio)return;c.palletDropped=true;
    const pallet=radio.pallet||{x:radio.x+70,y:radio.y+95};
    for(const [i,ammo] of ['bullets','shells','fuel'].entries())s.loot.push({id:s.nextId++,x:pallet.x+i*24,y:pallet.y,type:'ammo',ammo,amount:[240,45,130][i],label:'pallet '+ammo,rewardId:'radio-pallet'});
    s.loot.push({id:s.nextId++,x:pallet.x,y:pallet.y+35,type:'medkit',amount:1,label:'pallet medkit',rewardId:'radio-pallet'});
    xp(s,65);effect(s,pallet.x,pallet.y-30,'ABANDONED QUARANTINE PALLET','#edc37c');
    s.world.props.push({art:'loot/pallet',x:pallet.x+24,y:pallet.y-18,palletDrop:true});
  }
  function openEvacGate(s){
    s.world.obstacles=s.world.obstacles.filter(o=>o.gateId!=='evac-gate');s.navVersion=(s.navVersion||0)+1;
    const g=(s.world.setpieces||[]).find(p=>p.kind==='evacGate');if(g)g.open=true;
    s.finalPush=true;makeNoise(s,{x:0,y:W().EDGE},'gate',700);emit(s,'gate','evac');announce(s,'THE GATE IS OPEN · GET EVERYONE SOUTH');
  }
  function objectives(s,inputs,dt){
    const living=s.players.filter(p=>!p.dead);
    campaignTick(s,inputs,dt,living);
    // a running generator is a steady sound source: infected within 260 hear it every 4 s (the refuge draws them)
    if(s.circuit?.emergency&&s.time>=(s.nextGeneratorNoise||0)){const gen=generatorAnchor(s);if(gen){makeNoise(s,gen,'generatorRun');s.nextGeneratorNoise=s.time+4;}}
    gatesTick(s,living);
    if(!s.boss){const near=living.filter(p=>Math.hypot(p.x,p.y)<160);if(near.length&&near.some(p=>inputs[p.id]?.interact)){if(living.every(p=>Math.abs(p.x)<ARENA.play-p.r&&Math.abs(p.y)<ARENA.play-p.r)){root.DSBoss.start(s,api(s));s.band=null;s.enemies=[];s.entered=true;}else announce(s,'REGROUP · all living survivors must enter the plaza');}}
  }
  function camera(s,dt,aspect=16/9){
    // arena camera: frame living survivors, the furnace, its live hazards and carriers, padded, never wider than
    // the yard plus its gates needs at this aspect ratio
    const c=s.camera;if(s.boss&&s.boss.active){
      const b=s.boss,pts=[...s.players.filter(p=>!p.dead),b,...(b.fx||[]).filter(f=>f.x!=null),...s.enemies.filter(e=>e.bossOwned&&!e.dead)];
      let x0=Math.min(...pts.map(q=>q.x)),x1=Math.max(...pts.map(q=>q.x)),y0=Math.min(...pts.map(q=>q.y)),y1=Math.max(...pts.map(q=>q.y));
      const pad=150,w=clamp(Math.max(x1-x0+pad*2,(y1-y0+pad*2)*aspect,640),640,Math.max((ARENA.half*2+120),(ARENA.half*2+120)*aspect));
      const tx=clamp((x0+x1)/2,-ARENA.half,ARENA.half),ty=clamp((y0+y1)/2,-ARENA.half,ARENA.half);
      c.x+=(tx-c.x)*Math.min(1,dt*4);c.y+=(ty-c.y)*Math.min(1,dt*4);c.w+=(w-c.w)*Math.min(1,dt*3);c.h=c.w/aspect;return;}
    const living=s.players.filter(p=>!p.dead),list=living.length?living:s.players;if(!list.length)return;
    const driving=s.vehicles.filter(v=>v.driver!=null),active=driving.length>0;
    const xs=list.map(p=>p.x),ys=list.map(p=>p.y),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys),width=clamp(Math.max(maxx-minx+320,(maxy-miny+230)*aspect,740),740,active?Math.max(2150,1040*aspect):Math.max(1450,720*aspect));
    const lookX=driving.reduce((n,v)=>n+Math.cos(v.angle)*clamp(v.speed*.5,-140,140),0)/Math.max(1,driving.length),lookY=driving.reduce((n,v)=>n+Math.sin(v.angle)*clamp(v.speed*.5,-140,140),0)/Math.max(1,driving.length),rate=active?7:4;
    c.x+=((minx+maxx)/2+lookX-c.x)*Math.min(1,dt*rate);c.y+=((miny+maxy)/2+lookY-c.y)*Math.min(1,dt*rate);c.w+=(width-c.w)*Math.min(1,dt*3);c.h=c.w/aspect;
  }
  function step(s,dt,inputs={},aspect=16/9){
    if(s.mode!=='play'||s.paused||s.overflowQueue&&s.overflowQueue.length)return;dt=Math.min(.05,Math.max(0,dt));s.time+=dt;s.elapsed+=dt;s.bannerT=Math.max(0,s.bannerT-dt);
    s.noise=s.noise.filter(n=>{n.audible-=dt;return (n.life-=dt)>0;});s.fx=s.fx.filter(f=>(f.life-=dt)>0);s.shots=s.shots.filter(f=>(f.life-=dt)>0);
    for(const l of s.loot)if(l.lock)l.lock-=dt;
    const ins={};for(const p of s.players)ins[p.id]=conditionInput(p,inputs[p.id]||{});inputs=ins;
    projectilesTick(s,dt);turretsTick(s,dt);
    for(const v of s.vehicles)vehicleTick(s,v,inputs[v.driver]||{},dt);
    for(const p of s.players)playerTick(s,p,inputs[p.id]||{},dt);
    interiors(s,dt);doorsTick(s,dt);
    if(s.mode==='won'){camera(s,dt,aspect);return;}
    if(s.boss&&s.boss.active)root.DSBoss.update(s,dt,api(s));else {waveTick(s,dt);objectives(s,inputs,dt);}
    for(const e of s.enemies)enemyTick(s,e,dt);
    separateEnemies(s,dt);
    s.enemies=s.enemies.filter(e=>!e.dead&&e.hp>0);s.loot=s.loot.filter(l=>!l.taken);
    // Merge old distant XP into larger pickups to bound long-run rendering and memory.
    if(s.loot.length>700){const gems=s.loot.filter(l=>l.type==='xp'&&!l.siteId);for(let i=1;i<gems.length;i+=2){gems[i-1].amount+=gems[i].amount;gems[i].taken=true;}s.loot=s.loot.filter(l=>!l.taken);}
    if(s.players.length&&s.players.every(p=>p.dead)){s.mode='lost';s.paused=false;}
    camera(s,dt,aspect);
  }
  root.DSGame={spawnBudget,pressure,squadPower,campaignSteps,PRESSURE,waveTick,ARMOR,TURRET,turretsTick,nearestTurret,turretPlaceOk,selectWeapon,ATTACHMENTS,weaponStats,magFor,nextAttachment,upgradeTarget,explode,projectilesTick,GRENADE_CAP,rayHits,weaponCap,dropWeapon,resolveOverflow,BINDINGS,deviceOf,label,notify,rearmTriggers,conditionInput,TRIGGER_DEAD_ZONE,create,EVIDENCE,HOLDS,EXIT,campaignMissing:missing,journal,objective,learn,holdPoint,campaignAnchor:anchorOf,ARENA,setGate,sealArena,bossDefeated,gateById,VEHICLES,FUEL,refuelTarget,startRefuel,refuelTick,pourable,clearDebris,vehicleDef:vdef,generatorAnchor,occluded,HEADLIGHTS,eat,nearestDoor,startDoor,openDoor,doorById,addPlayer,step,camera,random,api,spawn,hitEnemy,hurt,upgrade,collect,lineObstacle,canSee,litAt,SIGHT,nearestInteract,useMedkit,MEDKIT_HEAL,MEDKIT_CAP,WEAPON_CAP,NOISE,makeNoise,UPGRADES,WEAPONS,COLORS,announce,CAR,carBlocked,vehicleTick,vehicleFor,nearestVehicle,enterVehicle,exitVehicle,parkVehicle};
})(typeof window!=='undefined'?window:globalThis);
