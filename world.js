(function (root) {
  'use strict';
  var MIN=-3600, MAX=3600, ROAD=170, AXES=[-2800,-1400,0,1400,2800];
  function rng(seed){var n=(Number(seed)||1)>>>0;return function(){n=(n*1664525+1013904223)>>>0;return n/4294967296;};}
  function ob(x,y,w,h,type,hp){var o={x:x,y:y,w:w,h:h,type:type};if(hp!=null){o.hp=hp;o.maxHp=hp;}return o;}
  function it(id,x,y,type,e){var q={id:id,x:x,y:y,type:type,amount:1,quality:1,label:type};for(var k in(e||{}))q[k]=e[k];return q;}
  // The one district table. Every consumer (classification, themes, ground markings,
  // map tint and labels, HUD cards, announcements) reads from here.
  // Territory is authored per block in BLOCK_OWNERS below (city_v2 Section 1); `mapPalette` is the
  // cartographic colour set, separate from the world `color`, ambient light and loot colours.
  // Theme: `ambient` multiplies the whole scene (lights.js), `lamp` is the streetlamp colour,
  // `alive` the share of lamps still working, `strobe` the share of those that flicker hard,
  // `burnt` the share of wrecks that burn, `clutter` the lot props and `sidewalk` the kerb
  // props (art ids under props/). Sizes for solid props live in PROP_BOX below.
  var INF=Infinity;
  var DISTRICTS=[
    {id:'checkpoint',name:'South Blocks',priority:5,mapPalette:{fill:'#549487',road:'#25403c',light:'#76a99f',dark:'#376059',label:'#e0ece9'},role:'SEALED CHECKPOINT · WALKERS',color:'#6bc6b9',ground:'#182421',road:'#202d2d',atmosphere:'#587a72',enemy:'walker',
      landmark:'Checkpoint Nine',anchor:'Crossroads supermarket',required:['checkpoint-nine','crossroads-supermarket','police-station','market-parking','residential-park'],fabric:{home:.55,shop:.35,clinic:.1},
      marking:{x:0,y:2800,label:'EVAC / CHECKPOINT 09'},card:{role:'SEALED CHECKPOINT',note:'Start and exit · walkers'},
      theme:{ambient:'#1c2226',lamp:'#d39b45',alive:.6,strobe:.15,specks:'#587a72',burnt:.25,
        clutter:['tireStack','palletStack','coneTraffic','newsBox','trashBags','signEvac','dumpster'],sidewalk:['hydrant','binSmall','newsBox','phoneBooth','mailbox']}},
    {id:'ruins',name:'Old Quarter',priority:2,mapPalette:{fill:'#7d68a2',road:'#342f46',light:'#9786b5',dark:'#51456a',label:'#e8e4ee'},role:'COLLAPSED STREETS · GHOSTS',color:'#8e7eaf',ground:'#191925',road:'#22212e',atmosphere:'#786b91',enemy:'ghost',
      landmark:'The Collapsed Quarter',anchor:'Graveyard and chapel',required:['collapsed-quarter','graveyard','chapel'],fabric:{home:.85,shop:.15},
      marking:{x:-2800,y:0,label:'OLD QUARTER'},card:{role:'REFUGE CHAPEL',note:'Restore power · ghosts'},
      theme:{ambient:'#171528',lamp:'#9c8ccf',alive:.2,strobe:.3,specks:'#786b91',burnt:.3,
        clutter:['rubbleChunk','rubbleChunk','brokenPipe','tireStack','trashBags','barrelRust'],sidewalk:['hydrant','rubbleChunk','trashBags']}},
    {id:'hospital',name:'Civic Ward',priority:3,mapPalette:{fill:'#5b8bb6',road:'#283c4e',light:'#7ca2c5',dark:'#3b5b76',label:'#e1eaf2'},role:'MEDICAL DISTRICT · RUNNERS',color:'#79e2cf',ground:'#172322',road:'#1d2d2d',atmosphere:'#65b8aa',enemy:'runner',
      landmark:'St. Orison Hospital',anchor:'Hospital campus',required:['st-orison','pharmacy','clinic','morgue','ambulance-yard'],fabric:{home:.45,clinic:.3,shop:.25},
      marking:{x:2800,y:0,label:'CIVIC WARD'},card:{role:'ST. ORISON',note:'Trial records · runners'},
      theme:{ambient:'#162326',lamp:'#bfe8e0',alive:.7,strobe:.45,specks:'#65b8aa',burnt:.2,
        clutter:['gurney','ivStand','wheelchair','binMedical','trashBags','dumpster'],sidewalk:['hydrant','binMedical','benchWait','ivStand']}},
    {id:'northline',name:'Northline',priority:4,mapPalette:{fill:'#b39a4c',road:'#494226',light:'#c2ae70',dark:'#726434',label:'#f1eddf'},role:'RADIO CORRIDOR · GHOSTS',color:'#ffd249',ground:'#171e25',road:'#202b32',atmosphere:'#728ca0',enemy:'ghost',
      landmark:'Blackglass Radio',anchor:'Broadcast station and tower',required:['blackglass-radio','fire-station','municipal-depot','utility-yard','northline-park'],fabric:{home:.55,shop:.45},
      marking:{x:0,y:-2800,label:'NORTHLINE / RADIO'},card:{role:'BLACKGLASS RADIO',note:'Transmit and hold · ghosts'},
      theme:{ambient:'#161e2a',lamp:'#cfe0ff',alive:.5,strobe:.25,specks:'#728ca0',burnt:.2,
        clutter:['barrelRust','crateStack','antennaMast','trashBags','coneTraffic','palletStack'],sidewalk:['hydrant','binSmall','mailbox','newsBox']}},
    {id:'industry',name:'Ashworks',priority:1,mapPalette:{fill:'#9a5d3a',road:'#3f2b1f',light:'#ae7d61',dark:'#633e29',label:'#ede2dc'},role:'FOUNDRY DISTRICT · BRUTES',color:'#ff7b35',ground:'#1b211f',road:'#272522',atmosphere:'#b95a32',enemy:'brute',
      landmark:'Furnace Plant',anchor:'Machine-shop compound',required:['furnace-plant','machine-shop','warehouse','loading-yard','fuel-store','machinery-yard'],fabric:{workshop:.35,storageShed:.25,dispatchOffice:.25,home:.15},
      marking:{x:2800,y:2800,label:'ASHWORKS'},card:{role:'MACHINE FUEL',note:'Fuel and bulldozer · brutes'},
      theme:{ambient:'#241a12',lamp:'#ffb040',alive:.5,strobe:.2,specks:'#b95a32',burnt:.4,
        clutter:['slagPile','barrelRust','palletStack','brokenPipe','cinderVent','tireStack','crateStack'],sidewalk:['barrelRust','hydrant','coneTraffic']}},
    {id:'quarantine',name:'Central Quarantine',priority:0,mapPalette:{fill:'#8a4650',road:'#392227',light:'#a16b73',dark:'#593037',label:'#eadee0'},role:'FINAL CONTAINMENT · PATIENT FURNACE',color:'#ff543b',ground:'#17191e',road:'#20191c',atmosphere:'#ff6a2a',enemy:'runner',
      landmark:'Patient Furnace',anchor:'Command/incinerator compound',required:['patient-furnace','command-post','processing-tents','holding-building','armoury','vehicle-yard','inner-arena'],fabric:{requisitionOffice:.35,stagingDepot:.25,clinic:.2,shop:.1,home:.1},
      marking:null,card:{role:'PATIENT FURNACE',note:'Override, payload · runners'},
      // city_v2: the theme now also covers the four support blocks, so it dresses streets (processing supplies, cones)
      // and its ambient is only a step warmer than South Blocks; the disposal yard keeps its own red furnace light
      theme:{ambient:'#201a1e',lamp:'#ff8a4a',alive:.35,strobe:.1,specks:'#c0583a',burnt:.35,clutter:['crateStack','palletStack','coneTraffic','binMedical','trashBags','dumpster'],sidewalk:['coneTraffic','binSmall','hydrant','binMedical']}}
  ];
  var DISTRICT_BY_ID={},THEME={};
  DISTRICTS.forEach(function(d){DISTRICT_BY_ID[d.id]=d;THEME[d.id]=d.theme;d.mapLabel=d.name.toUpperCase();});
  // collision box [w,h,hp] for props that block; anything else is walk-through decoration
  var PROP_BOX={phoneBooth:[20,14,80],dumpster:[40,26,90],newsBox:[14,10,60],rubbleChunk:[44,22,90],barrelRust:[20,14,60],tireStack:[26,14,60],palletStack:[36,16,60],gurney:[36,14,60],crateStack:[32,18,80]};
  var PROP_VARIANTS={dumpster:2,trashBags:2,barrelRust:2,rubbleChunk:3};
  // city_v2 Section 1: one authored owner for each block of the 6x6 road grid, north row first. A territory runs
  // to the road centre lines and the world edge, so every point (half-roads, crossings, edges) has exactly one owner.
  // Classification, the map, ordinary fabric, spawns, themes and HUD names all derive from this table.
  var GRID=[-3600,-2800,-1400,0,1400,2800,3600];
  var BLOCK_OWNERS=[
    ['ruins','ruins','northline','northline','hospital','hospital'],
    ['ruins','ruins','northline','northline','hospital','hospital'],
    ['ruins','ruins','quarantine','quarantine','hospital','hospital'],
    ['ruins','ruins','quarantine','quarantine','hospital','hospital'],
    ['checkpoint','checkpoint','checkpoint','checkpoint','industry','industry'],
    ['checkpoint','checkpoint','checkpoint','checkpoint','industry','industry']
  ];
  // half-open cells [edge, next edge): a shared road centre line belongs to the east / south cell; the outer
  // world edge belongs to the last cell and anything beyond the bounds clamps to the nearest cell
  function gridIndex(v){for(var i=5;i>0;i--)if(v>=GRID[i])return i;return 0;}
  function blockOwner(col,row){return DISTRICT_BY_ID[BLOCK_OWNERS[row][col]];}
  function district(x,y){return blockOwner(gridIndex(x),gridIndex(y));}
  function axisDist(v){var best=1e9,i;for(i=0;i<AXES.length;i++){var d=Math.abs(v-AXES[i]);if(d<best)best=d;}return best;}
  function removeObstacle(w,o){w.obstacles=w.obstacles.filter(function(q){return q!==o;});}
  function visibleProps(w,v){var a=[],p=w.props||[];for(var i=0;i<p.length;i++){var q=p[i];if(q.x+100>v.x-v.w/2&&q.x-100<v.x+v.w/2&&q.y+40>v.y-v.h/2&&q.y-160<v.y+v.h/2)a.push(q);}return a;}
  // ---- reservations: authored places, door approaches and driveways that later fill passes leave open ----
  function overlaps(a,x,y,ww,hh,margin){return x-margin<a.x+a.w&&x+ww+margin>a.x&&y-margin<a.y+a.h&&y+hh+margin>a.y;}
  function reserve(w,x,y,ww,hh,kind,id){var q={x:x,y:y,w:ww,h:hh,kind:kind,id:id};w.reserved.push(q);return q;}
  function reservedAt(w,x,y,ww,hh,margin){for(var i=0;i<w.reserved.length;i++)if(overlaps(w.reserved[i],x,y,ww,hh,margin||0))return w.reserved[i];return null;}
  // authored placements (a car in its own parking bay) skip the reservation test, never the obstacle test
  function rectClear(w,x,y,ww,hh,margin,authored){
    var i;margin=margin||0;
    if(!authored&&reservedAt(w,x,y,ww,hh,0))return false;
    for(i=0;i<w.obstacles.length;i++)if(overlaps(w.obstacles[i],x,y,ww,hh,margin))return false;
    return true;
  }
  function prop(w,art,x,y,extra){var p={art:art,x:x,y:y};if(extra)for(var k in extra)p[k]=extra[k];w.props.push(p);return p;}
  function solid(w,art,x,y,ww,hh,type,hp,extra){var o=ob(x,y,ww,hh,type,hp);o.art=art;if(extra)for(var k in extra)o[k]=extra[k];w.obstacles.push(o);return o;}
  // Semantic places (CITY.md data contract). A location is what the map names; buildings, lots and
  // sites hang off it by id: 'block-1-4-p2', 'block-1-4-p2/shell', 'block-1-4-p2/stash#0'.
  function C(){return root.DSCity;}
  function location(w,id,kind,x,y,ww,hh,extra){
    var d=district(x+ww/2,y+hh/2),e=extra||{},place=C().PLACES[id]||{},profiles=e.lootProfiles||C().profilesFor(place.kind?place:{archetype:e.archetypeId,lot:e.lotKind}),icon=profiles[0]||null;
    var l={id:id,kind:kind,districtId:e.districtId||d.id,name:e.name||place.name||id,rect:{x:x,y:y,w:ww,h:hh},buildingIds:[],lotIds:[],siteIds:[],lootProfiles:profiles.slice(),
      mapIcon:icon,mapColor:icon?C().LOOT_PROFILES[icon].color:null,required:!!place.kind,discoveryRule:e.discoveryRule||place.discovery||'visit',compoundId:place.compound||null,story:!!place.story,archetypeId:e.archetypeId||place.archetype||null};
    w.locations.push(l);return l;
  }
  // what is underfoot at a point: a room's floor, a lot's surface, or the street (footstep sounds, Phase 12A)
  function surfaceAt(w,x,y){
    for(var i=0;i<(w.buildings||[]).length;i++){var b=w.buildings[i];if(x<b.x||x>b.x+b.w||y<b.y||y>b.y+b.h)continue;
      for(var j=0;j<b.rooms.length;j++){var q=b.rooms[j].rect;if(x>=q.x&&x<=q.x+q.w&&y>=q.y&&y<=q.y+q.h)return String(b.rooms[j].floor).toLowerCase();}return String(b.interior.floor).toLowerCase();}
    for(i=0;i<(w.lots||[]).length;i++){var L=w.lots[i],r=L.rect;if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)return L.surface;}
    return 'asphalt';
  }
  function locationById(w,id){for(var i=0;i<w.locations.length;i++)if(w.locations[i].id===id)return w.locations[i];return null;}
  function lotById(w,id){for(var i=0;i<w.lots.length;i++)if(w.lots[i].id===id)return w.lots[i];return null;}
  // ---- enterable buildings ----
  var WALL_T=14,IWALL=10;
  function floorFor(style){return style==='clinic'||style==='hospital'||style==='military'||style==='market'?'Tile':style==='shack'||style==='industrial'?'Concrete':'Wood';}
  function furnish(w,h,art,fx,fy,fw,fh,extra){var o=solid(w,art,Math.round(fx),Math.round(fy),fw,fh,'furniture',null,{buildingId:h.id,locationId:h.locationId});if(extra)for(var k in extra)o[k]=extra[k];h.furniture.push(o);return o;}
  function allDoors(h){return h.exteriorDoors.concat(h.interiorDoors);}
  function nearDoor(h,tx,ty,pad){var d=allDoors(h);for(var i=0;i<d.length;i++){var r=d[i].rect;if(tx>r.x-pad&&tx<r.x+r.w+pad&&ty>r.y-pad&&ty<r.y+r.h+pad)return true;}return false;}
  function roomAt(h,x,y){for(var i=0;i<h.rooms.length;i++){var r=h.rooms[i].rect;if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)return h.rooms[i];}return null;}
  // An interior wall on one axis, split by its doors ([at, width, kind, access]). Secured doors are
  // explicit obstacles (type 'door') until forced; every other interior door is an opening.
  function iwall(w,h,vertical,c,a,b,doors){
    var cuts=[];
    doors.forEach(function(d){
      var DW=d[1]||80,d0=Math.round(a+(b-a-DW)*d[0]),id=h.id+'/idoor-'+h.interiorDoors.length,kind=d[2]||'open';
      var r=vertical?{x:c,y:d0,w:IWALL,h:DW}:{x:d0,y:c,w:DW,h:IWALL},door={id:id,kind:kind,rect:r,rooms:[]};
      if(kind==='secured'){door.access=d[3]||{rule:'force',time:2,noise:450};var o=ob(r.x,r.y,r.w,r.h,'door');o.doorId=id;o.buildingId=h.id;o.locationId=h.locationId;o.protected=true;o.art='buildings/doorSecured_'+(vertical?'v':'h');w.obstacles.push(o);}
      h.interiorDoors.push(door);cuts.push([d0,d0+DW]);
    });
    var cur=a;
    function seg(p,q){if(q<=p)return;var o=vertical?ob(c,p,IWALL,q-p,'wall'):ob(p,c,q-p,IWALL,'wall');o.buildingId=h.id;o.locationId=h.locationId;o.protected=true;o.interior=true;w.obstacles.push(o);}
    cuts.sort(function(p,q){return p[0]-q[0];}).forEach(function(g){seg(cur,g[0]);cur=Math.max(cur,g[1]);});seg(cur,b);
  }
  // Template kit: positions are fractions of the interior (inside the perimeter walls); walls are
  // centred on their line, rooms stop at the wall faces. Sockets are candidates, validated later.
  function kit(w,h){
    var T=h.wallT,ix=h.x+T,iy=h.y+T,iw=h.w-2*T,ih=h.h-2*T,cand=[],H=IWALL/2;
    function X(f){return Math.round(ix+iw*f);}function Y(f){return Math.round(iy+ih*f);}
    return {ix:ix,iy:iy,iw:iw,ih:ih,X:X,Y:Y,candidates:cand,
      room:function(id,name,fx0,fy0,fx1,fy1,zone,floor){
        var x0=fx0<=0?ix:X(fx0)+H,y0=fy0<=0?iy:Y(fy0)+H,x1=fx1>=1?ix+iw:X(fx1)-H,y1=fy1>=1?iy+ih:Y(fy1)-H;
        var r={id:h.id+'/'+id,name:name,zone:zone||'main',floor:floor||h.interior.floor,rect:{x:x0,y:y0,w:x1-x0,h:y1-y0}};h.rooms.push(r);return r;},
      wallV:function(fx,fy0,fy1,doors){iwall(w,h,true,X(fx)-H,fy0<=0?iy:Y(fy0)-H,fy1>=1?iy+ih:Y(fy1)+H,doors||[]);},
      wallH:function(fy,fx0,fx1,doors){iwall(w,h,false,Y(fy)-H,fx0<=0?ix:X(fx0)-H,fx1>=1?ix+iw:X(fx1)+H,doors||[]);},
      // furniture by its top-left in interior fractions, or pinned to a room edge with `at`
      put:function(art,fx,fy,fw,fh,extra){return furnish(w,h,art,X(fx),Y(fy),fw,fh,extra);},
      // two rooms that share an opening with no wall (a corridor run, a chancel open to the nave)
      link:function(a,b){
        var A=a.rect,B=b.rect,r;
        if(Math.abs(A.x+A.w-B.x)<=IWALL+1||Math.abs(B.x+B.w-A.x)<=IWALL+1){var x0=Math.min(A.x+A.w,B.x+B.w),x1=Math.max(A.x,B.x),y0=Math.max(A.y,B.y),y1=Math.min(A.y+A.h,B.y+B.h);r={x:Math.min(x0,x1),y:y0,w:Math.abs(x1-x0)||1,h:y1-y0};}
        else{var yy0=Math.min(A.y+A.h,B.y+B.h),yy1=Math.max(A.y,B.y),xx0=Math.max(A.x,B.x),xx1=Math.min(A.x+A.w,B.x+B.w);r={x:xx0,y:Math.min(yy0,yy1),w:xx1-xx0,h:Math.abs(yy1-yy0)||1};}
        h.interiorDoors.push({id:h.id+'/idoor-'+h.interiorDoors.length,kind:'opening',rect:r,rooms:[a.id,b.id]});},
      sock:function(room,fx,fy,use){cand.push({room:room,use:use||'stash',x:Math.round(room.rect.x+room.rect.w*fx),y:Math.round(room.rect.y+room.rect.h*fy)});},
      // a campaign/evidence/interaction point (not loot): always kept, validated by the city tests
      anchor:function(room,fx,fy,kind){h.anchors.push({id:h.id+'@'+kind,kind:kind,x:Math.round(room.rect.x+room.rect.w*fx),y:Math.round(room.rect.y+room.rect.h*fy),roomId:room.id});},
      // a ceiling fixture: a real light pool (w.lights via its prop) and a light anchor; strobe = failing tube
      light:function(room,fx,fy,r,col,state,circuit){var x=Math.round(room.rect.x+room.rect.w*fx),y=Math.round(room.rect.y+room.rect.h*fy),st=state===true?'strobe':state||'on',e={flat:true,buildingId:h.id,locationId:h.locationId,roomId:room.id,lit:st!=='dead',strobe:st==='strobe'};
        if(circuit)e.circuit=circuit;if(st!=='dead')e.light={r:r,col:col,a:'cc',dy:0};
        prop(w,'buildings/ceilingLight',x,y,e);h.lightAnchors.push({x:x,y:y,r:r,roomId:room.id,state:st,strobe:st==='strobe',circuit:circuit||null});},
      // flat interior decoration (paper, bedrolls, ash): never blocks
      decal:function(art,room,fx,fy,extra){var e={flat:true,buildingId:h.id,locationId:h.locationId,roomId:room.id};for(var k in extra||{})e[k]=extra[k];prop(w,art,Math.round(room.rect.x+room.rect.w*fx),Math.round(room.rect.y+room.rect.h*fy),e);},
    };
  }
  // deterministic furniture variant for a building: 0..n-1
  function variant(h,n,salt){return mix(h.x+(salt||0)*17,h.y)*n|0;}
  // Room layouts per archetype template. Each names its rooms, walls, secured doors, furniture and
  // socket candidates. Buildings keep the sizes and door positions authored in DSCity.PLAN.
  var TEMPLATES={
    // the one-room fabric shell: shelf on the wall facing the door, then style furniture
    oneRoom:function(w,h,K){
      var T=h.wallT,opp={s:'n',n:'s',e:'w',w:'e'}[h.exteriorDoors[0].side],ix=K.ix,iy=K.iy,iw=K.iw,ih=K.ih,st=h.style,room=K.room('room-0','Room',0,0,1,1);
      function furn(art,fx,fy,fw,fh){furnish(w,h,art,fx,fy,fw,fh);}
      if(opp==='n')furn('buildings/furn_shelf',ix+8,iy,60,16);else if(opp==='s')furn('buildings/furn_shelf',ix+8,iy+ih-16,60,16);else if(opp==='w')furn('buildings/furn_shelf',ix,iy+8,16,60);else furn('buildings/furn_shelf',ix+iw-16,iy+8,16,60);
      if(st==='row'||st==='terrace'){furn('buildings/furn_bed',ix+iw-64,iy+(opp==='n'?24:8),60,36);furn('buildings/furn_table',ix+20,iy+ih-48,48,32);}
      else if(st==='shop'){furn('buildings/furn_counter',ix+iw/2-40,iy+ih/2-11,80,22);furn('buildings/furn_crates',ix+iw-40,iy+ih-36,32,28);}
      else if(st==='clinic'){furn('buildings/furn_bed',ix+iw-64,iy+(opp==='n'?24:8),60,36);furn('buildings/furn_bed',ix+8,iy+ih-44,60,36);}
      else{furn('buildings/furn_crates',ix+iw-40,iy+8,32,28);furn('buildings/furn_table',opp==='e'?ix+iw-58:ix+10,iy+ih/2-16,48,32);} // the shack table never stands in a west doorway
      [[.5,.5],[.25,.35],[.75,.65],[.3,.7],[.7,.3]].forEach(function(p){K.sock(room,p[0],p[1]);});
      return 3;
    },
    // public floor with short stripped aisles and checkouts; office, locked back room and loading cage behind
    supermarket:function(w,h,K){
      var sales=K.room('sales','Sales floor',0,0,1,.64,'front'),office=K.room('office','Office',0,.64,.26,1,'back'),back=K.room('backroom','Back room',.26,.64,.74,1,'back'),cage=K.room('cage','Loading cage',.74,.64,1,1,'back');
      K.wallH(.64,0,1,[[.12,80],[.5,90,'secured',{rule:'force',time:2,noise:450}]]);
      K.wallV(.26,.64,1,[[.5,70]]);K.wallV(.74,.64,1,[[.5,70,'secured',{rule:'force',time:2.4,noise:500}]]);
      [.08,.24,.40,.56,.72].forEach(function(f,i){K.put('buildings/furn_shelfAisle',f,.3,18,100,{stripped:true,variant:i%2});});
      [.06,.22,.38].forEach(function(f){K.put('buildings/furn_checkout',f,.09,60,22);});
      K.put('buildings/furn_vending',.9,.02,26,18,{damaged:true});
      K.put('buildings/furn_desk',.03,.72,48,26);K.put('buildings/furn_records',.19,.93,30,18);
      K.put('buildings/furn_crates',.3,.9,32,28);K.put('buildings/furn_shelf',.5,.9,60,16);K.put('buildings/furn_crates',.66,.72,32,28);
      K.put('buildings/furn_palletStack',.83,.9,36,16);
      K.sock(back,.25,.5,'stock');K.sock(back,.55,.45,'stock');K.sock(cage,.5,.45,'stock');K.sock(sales,.93,.2,'vending');
      K.sock(sales,.16,.66,'pocket');K.sock(sales,.64,.66,'pocket');K.sock(sales,.93,.72,'pocket');K.sock(office,.6,.35,'office');
      K.decal('props/trashBags',sales,.3,.9,{variant:1});K.decal('buildings/furn_paperwork',office,.4,.2);
      K.light(sales,.3,.5,110,'#d39b45',true);K.light(back,.5,.5,80,'#d39b45',false);
      return 8;
    },
    // corridor spine: ward and treatment north, restricted trial wing east; offices, reception and records south
    hospital:function(w,h,K){
      var ward=K.room('ward','Ward',0,0,.35,.42,'west'),ta=K.room('treatment-a','Treatment room',.35,0,.485,.42,'centre'),tb=K.room('treatment-b','Treatment room',.485,0,.62,.42,'centre'),trial=K.room('trial','Restricted trial wing',.62,0,1,.42,'east');
      var cw=K.room('corridor-w','Corridor',0,.42,.35,.58,'west'),cc=K.room('corridor-c','Corridor',.35,.42,.65,.58,'centre'),ce=K.room('corridor-e','Service corridor',.65,.42,1,.58,'east');
      var offices=K.room('offices','Offices',0,.58,.35,1,'west'),lobby=K.room('reception','Reception',.35,.58,.65,1,'centre'),records=K.room('records','Records',.65,.58,1,1,'east');
      K.wallV(.35,0,.42);K.wallV(.485,0,.42);K.wallV(.62,0,.42);
      K.wallH(.42,0,1,[[.17,80],[.42,70],[.55,70],[.82,90,'secured',{rule:'force',time:2.6,noise:480}]]);
      K.wallV(.35,.58,1);K.wallV(.65,.58,1);
      K.wallH(.58,0,1,[[.17,80],[.5,120],[.84,80]]);K.link(cw,cc);K.link(cc,ce);
      [.02,.13,.24].forEach(function(f){K.put('buildings/furn_bed',f,.03,60,36);});
      K.put('buildings/furn_bed',.37,.04,60,36);K.put('buildings/furn_screen',.365,.14,8,40);K.put('buildings/furn_bed',.5,.04,60,36);K.put('buildings/furn_screen',.6,.2,8,40);
      K.put('buildings/furn_bed',.66,.04,60,36);K.put('buildings/furn_bed',.78,.04,60,36);K.put('buildings/furn_console',.92,.2,40,20);K.put('buildings/furn_records',.9,.03,30,18);
      K.put('buildings/furn_desk',.04,.7,48,26);K.put('buildings/furn_desk',.2,.7,48,26);K.put('buildings/furn_records',.03,.92,30,18);
      K.put('buildings/furn_counter',.44,.66,80,22);K.put('buildings/furn_benchWait',.38,.93,40,12);K.put('buildings/furn_benchWait',.55,.93,40,12);
      K.put('buildings/furn_records',.7,.62,30,18);K.put('buildings/furn_records',.8,.62,30,18);K.put('buildings/furn_records',.9,.62,30,18);
      K.light(cw,.5,.5,90,'#bfe8e0','strobe');K.light(cc,.25,.5,90,'#bfe8e0');K.light(cc,.75,.5,90,'#bfe8e0','strobe');K.light(ce,.5,.5,90,'#bfe8e0','dead');K.light(lobby,.5,.35,100,'#bfe8e0');
      K.anchor(records,.2,.75,'patientRecords');K.anchor(trial,.5,.8,'trialEvidence');K.anchor(offices,.8,.45,'furnaceClue');
      K.decal('buildings/furn_paperwork',records,.6,.8);K.decal('buildings/furn_paperwork',trial,.85,.8);
      K.sock(ward,.5,.8);K.sock(ta,.5,.75);K.sock(tb,.4,.75);K.sock(trial,.3,.75);K.sock(trial,.7,.7);
      K.sock(offices,.6,.4);K.sock(lobby,.2,.35);K.sock(records,.5,.6);K.sock(ce,.5,.5);K.sock(cw,.3,.5);
      return 10;
    },
    // public desk, a hall, offices, the evidence cage and cells, with a barred rear service corridor
    police:function(w,h,K){
      var lobby=K.room('lobby','Public desk',0,0,.32,1,'front'),hall=K.room('hall','Hall',.32,0,.52,1,'front');
      var offices=K.room('offices','Offices',.52,0,.82,.38,'back'),evidence=K.room('evidence','Evidence cage',.52,.38,.82,.62,'back'),cells=K.room('cells','Cells',.52,.62,.82,1,'back'),service=K.room('service','Service corridor',.82,0,1,1,'back');
      K.wallV(.32,0,1,[[.5,90]]);
      K.wallV(.52,0,1,[[.12,70],[.5,70,'secured',{rule:'force',time:2.4,noise:500}],[.88,70]]);
      K.wallV(.82,0,1,[[.12,70],[.88,70]]);
      K.wallH(.38,.52,.82);K.wallH(.62,.52,.82);
      K.put('buildings/furn_counter',.08,.2,80,22);K.put('buildings/furn_benchWait',.05,.85,40,12);
      K.put('buildings/furn_desk',.58,.05,48,26);K.put('buildings/furn_records',.74,.05,30,18);
      K.put('buildings/furn_shelf',.56,.41,60,16);
      K.put('buildings/furn_cellBars',.67,.74,8,70);
      K.sock(lobby,.5,.6);K.sock(offices,.35,.7);K.sock(evidence,.5,.6);K.sock(evidence,.8,.5);K.sock(cells,.25,.8);K.sock(cells,.8,.8);K.sock(service,.5,.5);
      return 6;
    },
    // two apparatus bays onto the apron; duty room and medical cabinet behind the side door
    fireStation:function(w,h,K){
      var bay=K.room('bay','Apparatus bay',0,0,.78,1,'bay','Concrete'),duty=K.room('duty','Duty room',.78,0,1,.55,'quarters'),med=K.room('medical','Medical store',.78,.55,1,1,'quarters');
      K.wallV(.78,0,1,[[.25,80],[.82,80]]);K.wallH(.55,.78,1,[[.5,70]]);
      [.03,.2,.37].forEach(function(f){K.put('buildings/furn_gearRack',f,.02,60,16);});K.put('buildings/furn_hoseReel',.6,.03,24,24);
      K.put('buildings/furn_table',.82,.08,48,32);K.put('buildings/furn_cabinetMed',.8,.92,40,16);
      K.sock(bay,.12,.55);K.sock(bay,.5,.45);K.sock(duty,.5,.7);K.sock(med,.5,.45);K.sock(med,.35,.75);
      return 5;
    },
    // lobby, offices and studio, then the transmitter and control rooms at the back
    radioStation:function(w,h,K){
      var lobby=K.room('lobby','Lobby',0,0,.28,1,'front'),offices=K.room('offices','Offices',.28,0,.62,.5,'mid'),studio=K.room('studio','Studio',.28,.5,.62,1,'mid');
      var tx=K.room('transmitter','Transmitter room',.62,0,1,.5,'back'),control=K.room('control','Control room',.62,.5,1,1,'back');
      K.wallV(.28,0,1,[[.25,80],[.75,80]]);K.wallH(.5,.28,.62,[[.5,70]]);K.wallV(.62,0,1,[[.25,80],[.75,80]]);K.wallH(.5,.62,1,[[.5,70]]);
      K.put('buildings/furn_counter',.02,.08,80,22);K.put('buildings/furn_desk',.33,.06,48,26);K.put('buildings/furn_records',.5,.05,30,18);
      K.put('buildings/furn_console',.4,.88,40,20);K.put('buildings/furn_transmitter',.9,.05,24,60);K.put('buildings/furn_console',.7,.9,40,20);K.put('buildings/furn_console',.84,.9,40,20);
      K.anchor(control,.5,.6,'radioPrepare');K.anchor(tx,.45,.5,'radioTransmit');K.light(control,.5,.3,80,'#cfe0ff','on','emergency');K.light(tx,.5,.25,70,'#cfe0ff','on','emergency');
      K.sock(lobby,.5,.75);K.sock(offices,.3,.7);K.sock(studio,.7,.35);K.sock(control,.2,.35);K.sock(tx,.2,.8);
      return 5;
    },
    // dispatch office by the street door, the machinery floor, maintenance room and fuel storage
    machineShop:function(w,h,K){
      var dispatch=K.room('dispatch','Dispatch office',0,0,.5,.34,'office'),floorN=K.room('floor-north','Machinery floor',.5,0,.72,.34,'floor','Concrete'),floor=K.room('floor','Machinery floor',0,.34,.78,1,'floor','Concrete');
      var maint=K.room('maintenance','Maintenance room',.72,0,1,.36,'back','Concrete'),fuel=K.room('fuel','Fuel storage',.78,.36,1,1,'back','Concrete');
      K.wallH(.34,0,.5,[[.5,80]]);K.wallV(.5,0,.34);K.link(floorN,floor);K.wallV(.72,0,.36,[[.5,70]]);K.wallH(.36,.72,1);K.wallV(.78,.36,1,[[.3,80]]);
      K.put('buildings/furn_desk',.04,.06,48,26);K.put('buildings/furn_records',.36,.05,30,18);
      K.put('buildings/furn_workbench',.05,.42,60,22);K.put('buildings/furn_lathe',.3,.45,40,24);K.put('buildings/furn_workbench',.05,.9,60,22);K.put('buildings/furn_workbench',.62,.9,60,22);
      K.put('buildings/furn_shelf',.8,.03,60,16);K.put('buildings/furn_crates',.92,.2,32,28);
      K.put('buildings/furn_drumRack',.84,.72,40,20);K.put('buildings/furn_drumRack',.84,.9,40,20);
      K.decal('lots/shutdownChecklist',dispatch,.7,.3);K.decal('tiles/decalAsh',floor,.45,.6);K.decal('tiles/decalOil',floor,.7,.75);K.decal('buildings/furn_toolsLeft',floor,.2,.5);
      K.light(floor,.35,.5,120,'#ffb040',true);
      K.sock(floor,.2,.6);K.sock(floor,.6,.55);K.sock(floor,.4,.85);K.sock(dispatch,.35,.65);K.sock(maint,.4,.7);K.sock(fuel,.5,.2);K.sock(fuel,.5,.55);
      return 7;
    },
    // racking either side of the loading lane, a small office in the corner
    warehouse:function(w,h,K){
      var floor=K.room('floor','Warehouse floor',0,0,1,.68,'floor','Concrete'),floorS=K.room('floor-south','Warehouse floor',.32,.68,1,1,'floor','Concrete'),office=K.room('office','Office',0,.68,.32,1,'office');
      K.wallH(.68,0,.32);K.wallV(.32,.68,1,[[.5,70]]);K.link(floor,floorS);
      [.12,.32,.52].forEach(function(f){K.put('buildings/furn_rack',.03,f,110,18);K.put('buildings/furn_rack',.72,f,110,18);});
      K.put('buildings/furn_rack',.45,.84,110,18);K.put('buildings/furn_desk',.05,.78,48,26);
      K.sock(floor,.15,.35);K.sock(floor,.85,.6);K.sock(floorS,.25,.5);K.sock(floorS,.85,.5);K.sock(office,.6,.6);
      return 5;
    },
    // the nave with pews and a refuge corner; generator room and supply store behind the chancel
    chapel:function(w,h,K){
      var gen=K.room('generator','Generator room',0,0,.36,.3,'north','Concrete'),chancel=K.room('chancel','Chancel',.36,0,.64,.3,'nave'),store=K.room('store','Supply store',.64,0,1,.3,'north'),nave=K.room('nave','Nave',0,.3,1,1,'nave');
      K.wallV(.36,0,.3);K.wallV(.64,0,.3);K.wallH(.3,0,.36,[[.5,70]]);K.wallH(.3,.64,1,[[.5,70]]);K.link(chancel,nave);
      [.44,.58,.72].forEach(function(f){K.put('buildings/furn_pew',.12,f,80,14);K.put('buildings/furn_pew',.55,f,80,14);});
      K.put('buildings/furn_table',.42,.06,48,32);K.put('landmarks/generator',.1,.08,40,28,{generator:true});
      K.put('buildings/furn_shelf',.67,.02,60,16);K.put('buildings/furn_crates',.87,.04,32,28);
      [.2,.4,.6,.8].forEach(function(f,i){K.decal('buildings/furn_bedroll',nave,f,.92,{variant:i%2});});
      K.decal('buildings/furn_paperwork',chancel,.5,.75);K.decal('lots/refugeNotice',nave,.5,.25);K.light(nave,.5,.45,110,'#ffcf8a','on','emergency');K.light(gen,.4,.35,60,'#ffd249','on','emergency');
      K.anchor(gen,.75,.8,'chapelGenerator');K.anchor(nave,.5,.78,'refugeLedger');
      K.sock(nave,.12,.8,'refuge');K.sock(nave,.88,.8,'refuge');K.sock(store,.5,.55,'refuge');K.sock(gen,.3,.75,'refuge');
      return 5;
    },
    morgue:function(w,h,K){
      var prep=K.room('prep','Preparation room',0,0,.5,1,'main','Tile'),cold=K.room('cold','Cold room',.5,0,1,1,'cold','Tile');
      K.wallV(.5,0,1,[[.5,70]]);
      K.put('buildings/furn_table',.08,.08,48,32);K.put('buildings/furn_records',.08,.9,30,18);K.put('buildings/furn_drawers',.88,.08,16,80);
      K.sock(prep,.5,.7);K.sock(cold,.4,.2);K.sock(cold,.4,.85);
      return 3;
    },
    depot:function(w,h,K){
      var office=K.room('office','Depot office',0,0,.3,.36,'office'),store=K.room('parts','Parts store',0,.66,.3,1,'office'),floor=K.room('floor','Garage floor',.3,0,1,1,'floor','Concrete'),lane=K.room('lane','Garage floor',0,.36,.3,.66,'floor','Concrete');
      K.wallH(.36,0,.3,[[.5,70]]);K.wallV(.3,0,.36);K.wallH(.66,0,.3,[[.5,70]]);K.wallV(.3,.66,1);K.link(lane,floor);
      K.put('buildings/furn_desk',.03,.06,48,26);K.put('buildings/furn_shelf',.03,.9,60,16);K.put('buildings/furn_workbench',.4,.04,60,22);K.put('buildings/furn_rack',.6,.2,110,18);K.put('props/tireStack',.85,.75,26,14);
      K.sock(floor,.3,.35);K.sock(floor,.7,.7);K.sock(office,.6,.7);K.sock(store,.5,.45);
      return 4;
    },
    holding:function(w,h,K){
      var proc=K.room('processing','Processing',0,0,.5,1,'front'),hold=K.room('holding','Holding cells',.5,0,1,1,'cells');
      K.wallV(.5,0,1,[[.25,70]]);
      K.put('buildings/furn_desk',.06,.08,48,26);K.put('buildings/furn_records',.3,.85,30,18);K.put('buildings/furn_cellBars',.75,.5,8,70);
      K.decal('buildings/furn_paperwork',proc,.7,.5);K.anchor(proc,.3,.5,'intakeManifest');
      K.sock(proc,.6,.7);K.sock(hold,.3,.85);K.sock(hold,.8,.25);
      return 3;
    },
    armoury:function(w,h,K){
      var counter=K.room('counter','Issue counter',0,0,1,.45,'front'),cage=K.room('cage','Armoury cage',0,.45,1,1,'cage','Concrete');
      K.wallH(.45,0,1,[[.5,70,'secured',{rule:'force',time:2.8,noise:560}]]);
      K.put('buildings/furn_counter',.52,0,80,22);K.put('buildings/furn_weaponRack',.08,.88,60,16);K.put('buildings/furn_weaponRack',.58,.88,60,16);
      K.sock(counter,.8,.5);K.sock(cage,.2,.45);K.sock(cage,.8,.45);
      return 3;
    },
    commandPost:function(w,h,K){
      var brief=K.room('briefing','Briefing room',0,.45,1,1,'front'),comms=K.room('comms','Comms and records',0,0,1,.45,'back');
      K.wallH(.45,0,1,[[.3,70]]);
      K.put('buildings/furn_table',.55,.6,48,32);K.put('buildings/furn_console',.6,.08,40,20);K.put('buildings/furn_records',.05,.08,30,18);
      K.anchor(comms,.75,.65,'commandPayload');K.anchor(brief,.35,.55,'checkpointOverride');K.decal('lots/dispositionBoard',brief,.85,.2);
      K.sock(brief,.15,.5);K.sock(comms,.25,.6);
      return 2;
    },
    pharmacy:function(w,h,K){
      var shop=K.room('shop','Pharmacy counter',0,0,1,.6,'front'),disp=K.room('dispensary','Dispensary',0,.6,1,1,'back');
      K.wallH(.6,0,1,[[.5,70]]);
      K.put('buildings/furn_counter',.08,.5,80,22);K.put('buildings/furn_cabinetMed',.05,.9,40,16);K.put('buildings/furn_cabinetMed',.8,.9,40,16);
      K.sock(shop,.15,.35);K.sock(shop,.85,.35);K.sock(disp,.3,.4);K.sock(disp,.7,.4);
      return 4;
    }
  };
  // One enterable structure: perimeter walls split by every exterior door, rooms, roof zones, sockets.
  // spec: {id, archetypeId, style, rect:[x,y,w,h], doors:[[side, at, width, kind]]}
  function shell(w,loc,spec){
    var T=WALL_T,x=spec.rect[0],y=spec.rect[1],ww=spec.rect[2],hh=spec.rect[3],bid=spec.id,arch=C().ARCHETYPES[spec.archetypeId];
    var h={id:bid,locationId:loc.id,archetypeId:spec.archetypeId,style:spec.style,x:x,y:y,w:ww,h:hh,rect:{x:x,y:y,w:ww,h:hh},wallT:T,interior:{floor:floorFor(spec.style)},
      exteriorDoors:[],interiorDoors:[],rooms:[],lootSockets:[],roofZones:[],furniture:[],anchors:[],lightAnchors:[],roofAlpha:1,occupied:false};
    loc.buildingIds.push(bid);
    var gaps={n:[],s:[],e:[],w:[]},A=110;
    spec.doors.forEach(function(d,i){
      var side=d[0],horizontal=side==='n'||side==='s',along=horizontal?ww:hh,DW=d[2]||88,off=Math.max(T+6,Math.min(along-DW-T-6,Math.round((along-DW)*d[1]))),d0=(horizontal?x:y)+off;
      var r=horizontal?{x:d0,y:side==='n'?y:y+hh-T,w:DW,h:T}:{x:side==='w'?x:x+ww-T,y:d0,w:T,h:DW};
      h.exteriorDoors.push({id:bid+'/door-'+i,side:side,kind:d[3]||'public',rect:r,rooms:[]});gaps[side].push([d0,d0+DW]);
      // the approach outside every door stays clear of later fill
      reserve(w,horizontal?d0-10:(side==='w'?x-A:x+ww),horizontal?(side==='n'?y-A:y+hh):d0-10,horizontal?DW+20:A,horizontal?A:DW+20,'approach',bid+'/door-'+i);
    });
    function run(side,a,b,make){var cur=a;gaps[side].slice().sort(function(p,q){return p[0]-q[0];}).forEach(function(g){if(g[0]>cur)make(cur,g[0]);cur=Math.max(cur,g[1]);});if(b>cur)make(cur,b);}
    function wall(sx,sy,sw,sh){if(sw>0&&sh>0){var o=ob(sx,sy,sw,sh,'wall');o.buildingId=bid;o.locationId=loc.id;o.protected=true;w.obstacles.push(o);}}
    run('n',x,x+ww,function(a,b){wall(a,y,b-a,T);});run('s',x,x+ww,function(a,b){wall(a,y+hh-T,b-a,T);});
    run('w',y+T,y+hh-T,function(a,b){wall(x,a,T,b-a);});run('e',y+T,y+hh-T,function(a,b){wall(x+ww-T,a,T,b-a);});
    reserve(w,x,y,ww,hh,'building',bid);
    var K=kit(w,h),template=arch.shell==='oneRoom'?TEMPLATES.oneRoom:TEMPLATES[arch.template],max=template(w,h,K);
    // which rooms each door joins: a probe on either side of the opening
    allDoors(h).forEach(function(d){if(d.kind==='opening')return;var r=d.rect,cx=r.x+r.w/2,cy=r.y+r.h/2,v=r.h>r.w;
      [[-18,0],[18,0]].forEach(function(o){var q=roomAt(h,cx+(v?o[0]:0),cy+(v?0:o[0]));if(q&&d.rooms.indexOf(q.id)<0)d.rooms.push(q.id);});});
    // roof zones: the rooms of each zone, grown over the perimeter and half of every interior wall
    var zones={};h.rooms.forEach(function(r){
      var q=r.rect,x0=q.x<=h.x+T?h.x:q.x-IWALL/2,y0=q.y<=h.y+T?h.y:q.y-IWALL/2,x1=q.x+q.w>=h.x+ww-T?h.x+ww:q.x+q.w+IWALL/2,y1=q.y+q.h>=h.y+hh-T?h.y+hh:q.y+q.h+IWALL/2;
      var z=zones[r.zone]||(zones[r.zone]={id:bid+'/roof-'+r.zone,rooms:[],rects:[]});z.rooms.push(r.id);z.rects.push({x:x0,y:y0,w:x1-x0,h:y1-y0});r.roofZoneId=z.id;});
    for(var k in zones){var z=zones[k],bx0=Infinity,by0=Infinity,bx1=-Infinity,by1=-Infinity;z.rects.forEach(function(q){bx0=Math.min(bx0,q.x);by0=Math.min(by0,q.y);bx1=Math.max(bx1,q.x+q.w);by1=Math.max(by1,q.y+q.h);});
      z.rect={x:bx0,y:by0,w:bx1-bx0,h:by1-by0};z.alpha=1;z.occupied=false;h.roofZones.push(z);}
    // sockets are separate from furniture: clear of solids and of every doorway, inside their room
    K.candidates.forEach(function(c){
      if(h.lootSockets.length>=max)return;var r=c.room.rect;
      if(c.x<r.x+16||c.y<r.y+16||c.x>r.x+r.w-16||c.y>r.y+r.h-16||blocked(w,c.x,c.y,14)||nearDoor(h,c.x,c.y,30))return;
      h.lootSockets.push({id:bid+'#'+h.lootSockets.length,x:c.x,y:c.y,roomId:c.room.id,use:c.use});
    });
    w.buildings.push(h);return h;
  }
  // Door art family for an exterior door: vehicle bays roll up, barred and service doors are utilitarian,
  // public entrances follow the archetype (market glass, hospital, chapel, military steel, homes).
  var PUBLIC_DOOR={home:'residential',shop:'residential',supermarket:'glassDouble',pharmacy:'glassDouble',clinic:'hospital',hospital:'hospital',morgue:'hospital',police:'policeBars',
    fireStation:'service',radioStation:'military',machineShop:'service',warehouse:'service',depot:'service',chapel:'chapel',holding:'military',armoury:'military',commandPost:'military',workshop:'service',storageShed:'service',dispatchOffice:'residential',requisitionOffice:'military',stagingDepot:'service'};
  function doorFamily(b,d){
    if(d.kind==='vehicleBay')return b.archetypeId==='fireStation'?'fireRoller':'loadingBay';
    if(d.kind==='barred')return 'policeBars';
    if(d.kind==='side')return b.archetypeId==='chapel'?'chapel':'service';
    if(d.kind==='service')return b.archetypeId==='holding'||b.archetypeId==='commandPost'?'military':'service';
    return PUBLIC_DOOR[b.archetypeId]||'residential';
  }
  // The disposal-yard gates are the inner arena's lot entrances. Geometry starts with every gate closed; game.js owns
  // their run state (open on approach, sealed for the fight, open after it). The processing queue and the Patient
  // Furnace placard stand outside the south gate.
  function arenaGates(w){
    w.arenaGates=[];var L=null;for(var i=0;i<w.lots.length;i++)if(w.lots[i].locationId==='inner-arena')L=w.lots[i];if(!L)return;
    L.entrances.forEach(function(e){var r=e.rect,g={id:'arena-gate-'+e.side,side:e.side,rect:{x:r.x,y:r.y,w:r.w,h:r.h},entranceId:e.id};w.arenaGates.push(g);
      w.obstacles.push({x:r.x,y:r.y,w:r.w,h:r.h,type:'gate',gateId:g.id,protected:true,locationId:'inner-arena'});});
    var south=w.arenaGates.filter(function(g){return g.side==='s';})[0];if(!south)return;var sx=south.rect.x+south.rect.w/2,sy=south.rect.y+south.rect.h;
    prop(w,'props/signPlacard',sx+80,sy+40,{locationId:'inner-arena',gatePlacard:true});
    for(var q=0;q<4;q++){prop(w,'lots/parkingLine_v',sx-40,sy+60+q*36,{flat:true,locationId:'patient-furnace',queue:true,rot:1});prop(w,'lots/parkingLine_v',sx+40,sy+60+q*36,{flat:true,locationId:'patient-furnace',queue:true,rot:1});}
    prop(w,'lots/dispositionBoard',sx-110,sy+50,{flat:true,locationId:'patient-furnace',queue:true});
  }
  // Signs: every signed archetype hangs a pictogram plaque beside its first public door, on the street side.
  function signs(w){
    w.buildings.forEach(function(b){
      if(b.archetypeId==='chapel'||b.archetypeId==='radioStation'){var pd=b.exteriorDoors[0].rect,v=pd.h>pd.w;prop(w,'props/circuitBox',Math.round(v?pd.x+(pd.x>b.x?pd.w+12:-12):pd.x+pd.w+16),Math.round(v?pd.y+pd.h+20:pd.y+(pd.y>b.y?pd.h+20:-2)),{circuitBox:true,buildingId:b.id,locationId:b.locationId});}
      var sign=C().ARCHETYPES[b.archetypeId].sign,d=b.exteriorDoors.filter(function(q){return q.kind==='public';})[0]||b.exteriorDoors[0];if(!sign||!d)return;
      var r=d.rect,x=d.side==='n'||d.side==='s'?r.x-24:(d.side==='w'?r.x-10:r.x+r.w+10),y=d.side==='n'?r.y-2:d.side==='s'?r.y+r.h+22:r.y-8;
      prop(w,'signs/'+sign,Math.round(x),Math.round(y),{sign:sign,buildingId:b.id,locationId:b.locationId,side:d.side});
    });
  }
  // ---- open lots: roofless places with a perimeter, gates, prop zones, light anchors and sockets ----
  // perimeter treatment by lot kind; chain-link lets sight and shots through, hedges/stone/hoarding do not
  var PERIMETER={hedge:{fence:'hedge',t:12,seeThrough:false},wall:{fence:'stone',t:10,seeThrough:false},fence:{fence:'chain',t:6,seeThrough:true},hoarding:{fence:'hoarding',t:8,seeThrough:false}};
  // spec: {id, kind, rect:[x,y,w,h], entrances:[[side, at, width]], open:[sides without perimeter], bare}
  function lot(w,loc,spec){
    var x=spec.rect[0],y=spec.rect[1],ww=spec.rect[2],hh=spec.rect[3],id=loc.id+'/'+(spec.id||'lot'),A=90,kind=C().LOT_KINDS[spec.kind];
    var L={id:id,locationId:loc.id,kind:spec.kind,rect:{x:x,y:y,w:ww,h:hh},surface:spec.surface||kind.surface,perimeter:kind.perimeter,open:(spec.open||[]).slice(),bare:!!spec.bare,
      entrances:[],propZones:[],lightAnchors:[],lootSockets:[],vehicleSlots:[]};
    var gaps={n:[],s:[],e:[],w:[]};
    (spec.entrances||[]).forEach(function(e,i){
      var side=e[0],horizontal=side==='n'||side==='s',along=horizontal?ww:hh,EW=Math.min(e[2],along-20),d0=(horizontal?x:y)+Math.round((along-EW)*e[1]);
      L.entrances.push({id:id+'/gate-'+i,side:side,rect:horizontal?{x:d0,y:side==='n'?y-8:y+hh-8,w:EW,h:16}:{x:side==='w'?x-8:x+ww-8,y:d0,w:16,h:EW}});gaps[side].push([d0,d0+EW]);
      reserve(w,horizontal?d0:(side==='w'?x-A:x+ww),horizontal?(side==='n'?y-A:y+hh):d0,horizontal?EW:A,horizontal?A:EW,'approach',id+'/gate-'+i);
    });
    var P=PERIMETER[kind.perimeter];
    if(P)['n','s','w','e'].forEach(function(side){
      if(L.open.indexOf(side)>=0)return;
      var horizontal=side==='n'||side==='s',a=horizontal?x:y,b=horizontal?x+ww:y+hh,cur=a,h2=P.t/2;
      function seg(p,q){if(q-p<4)return;var o=horizontal?ob(p,(side==='n'?y:y+hh)-h2,q-p,P.t,'fence'):ob((side==='w'?x:x+ww)-h2,p,P.t,q-p,'fence');
        o.fence=P.fence;o.seeThrough=P.seeThrough;o.protected=true;o.lotId=id;o.locationId=loc.id;o.art='lots/'+P.fence+(horizontal?'_h':'_v');w.obstacles.push(o);}
      gaps[side].slice().sort(function(p,q){return p[0]-q[0];}).forEach(function(g){seg(cur,g[0]);cur=Math.max(cur,g[1]);});seg(cur,b);
    });
    reserve(w,x,y,ww,hh,'lot',id);loc.lotIds.push(id);w.lots.push(L);return L;
  }
  // Dressing runs once every slot is known. Solids keep clear of gate lanes, vehicle slots (with
  // clearance) and each other; paint, paths, graves' grass and beds are flat decoration.
  function lotSockets(w){
    w.lots.forEach(function(L){var R=L.rect;
      (L._cand||[]).forEach(function(c){var sx=c[0],sy=c[1],i;if(L.lootSockets.length>=c[2])return;
        if(sx<R.x+30||sy<R.y+30||sx>R.x+R.w-30||sy>R.y+R.h-30||blocked(w,sx,sy,16))return;
        for(i=0;i<L._lanes.length;i++)if(overlaps(L._lanes[i],sx-1,sy-1,2,2,0))return;for(i=0;i<L._slots.length;i++)if(overlaps(L._slots[i].rect,sx-1,sy-1,2,2,30))return;
        L.lootSockets.push({id:L.id+'#'+L.lootSockets.length,x:sx,y:sy});});
      delete L._cand;delete L._lanes;delete L._slots;});
  }
  function dressLots(w){
    w.lots.forEach(function(L){
      var R=L.rect,slots=w.vehicleSlots.filter(function(v){return v.lotId===L.id;}),n=0,lanes=L.entrances.map(function(e){
        var r=e.rect,D=Math.min(130,Math.round((e.side==='n'||e.side==='s'?R.h:R.w)*.4));return e.side==='n'?{x:r.x,y:R.y,w:r.w,h:D}:e.side==='s'?{x:r.x,y:R.y+R.h-D,w:r.w,h:D}:e.side==='w'?{x:R.x,y:r.y,w:D,h:r.h}:{x:R.x+R.w-D,y:r.y,w:D,h:r.h};});
      function zone(kind,x,y,ww,hh){var z={id:L.id+'/zone-'+L.propZones.length,kind:kind,rect:{x:Math.round(x),y:Math.round(y),w:Math.round(ww),h:Math.round(hh)}};L.propZones.push(z);return z;}
      function free(x,y,ww,hh,pad){
        if(x<R.x+16||y<R.y+16||x+ww>R.x+R.w-16||y+hh>R.y+R.h-16)return false;
        for(var i=0;i<lanes.length;i++)if(overlaps(lanes[i],x,y,ww,hh,10))return false;
        for(i=0;i<slots.length;i++)if(overlaps(slots[i].rect,x,y,ww,hh,slots[i].vehicleType==='sedan'?24:48))return false;
        return rectClear(w,x,y,ww,hh,pad==null?14:pad,true);
      }
      function block(art,x,y,ww,hh,extra){x=Math.round(x);y=Math.round(y);if(!free(x,y,ww,hh))return null;var e={lotId:L.id,locationId:L.locationId,debris:'decorative'};for(var k in extra||{})e[k]=extra[k];n++;return solid(w,art,x,y,ww,hh,'rubble',null,e);}
      function flat(art,x,y,extra){var e={flat:true,lotId:L.id,locationId:L.locationId};for(var k in extra||{})e[k]=extra[k];return prop(w,art,Math.round(x),Math.round(y),e);}
      function lamp(art,x,y,r,col){var t=district(x,y).theme,lit=mix(x+11,y)<Math.max(t.alive,.35),e={lotId:L.id,locationId:L.locationId,lit:lit};if(lit)e.light={r:r,col:col||t.lamp,a:'ff',dy:60};L.lightAnchors.push({x:Math.round(x),y:Math.round(y),r:r,lit:lit});return prop(w,art,Math.round(x),Math.round(y),e);}
      // socket candidates are validated after every set piece stands (see lotSockets)
      function sockets(points,max){L._cand=(L._cand||[]).concat(points.map(function(p){return [Math.round(p[0]),Math.round(p[1]),max];}));L._lanes=lanes;L._slots=slots;}
      var cx=R.x+R.w/2,cy=R.y+R.h/2,k=L.kind,id=L.locationId;
      // place-specific yards first: one connected Ashworks service landscape, the fuel tanks, the quarantine ring
      if(id==='loading-yard'){
        zone('conveyor',R.x+20,R.y+R.h*.3,R.w-40,60);zone('spoil',R.x+20,R.y+R.h*.62,R.w*.5,R.h*.3);
        block('lots/conveyor',R.x+R.w*.08,R.y+R.h*.32,90,20,{cover:true});block('lots/conveyor',R.x+R.w*.6,R.y+R.h*.32,90,20,{cover:true});
        block('lots/spoilHeap',R.x+R.w*.12,R.y+R.h*.72,60,30,{cover:true});block('lots/spoilHeap',R.x+R.w*.62,R.y+R.h*.7,60,30,{cover:true});
        block('lots/craneBase',R.x+R.w*.42,R.y+R.h*.55,40,40,{cover:true});block('lots/gantryLeg',R.x+R.w*.2,R.y+R.h*.5,20,20);block('lots/gantryLeg',R.x+R.w*.78,R.y+R.h*.5,20,20);
        block('lots/pipeBank',R.x+R.w*.05,R.y+R.h*.88,90,20,{cover:true});flat('tiles/decalAsh',cx,cy+30);flat('lots/shutdownChecklist',R.x+R.w*.5,R.y+40);
        lamp('barricade/floodlight',R.x+R.w-40,R.y+40,150,'#ffb040');
        sockets([[R.x+R.w*.3,R.y+R.h*.45],[R.x+R.w*.75,R.y+R.h*.6],[R.x+R.w*.45,R.y+R.h*.75]],3);return;
      }
      if(id==='fuel-store'){
        zone('tanks',R.x+20,R.y+20,R.w-40,R.h-40);
        block('lots/fuelTank',R.x+R.w*.12,R.y+R.h*.2,50,50,{cover:true});block('lots/fuelTank',R.x+R.w*.36,R.y+R.h*.2,50,50,{cover:true});block('props/barrelRust',R.x+R.w*.75,R.y+R.h*.6,20,14,{variant:1});
        flat('lots/hazardPaint',cx,cy);lamp('barricade/floodlight',R.x+R.w-40,R.y+R.h-40,120,'#ffb040');
        sockets([[R.x+R.w*.62,R.y+R.h*.35],[R.x+R.w*.3,R.y+R.h*.72]],2);return;
      }
      if(id==='processing-tents'){
        zone('triage',R.x+10,R.y+10,R.w-20,R.h-20);
        block('barricade/tentMil',R.x+R.w*.45,R.y+R.h*.11,64,40,{rot:0});block('props/gurney',R.x+R.w*.1,R.y+R.h*.12,36,14,{cover:true});
        flat('props/manifest',R.x+R.w*.3,R.y+R.h*.55);flat('lots/dispositionBoard',R.x+R.w*.75,R.y+R.h*.45);
        sockets([[R.x+R.w*.3,R.y+R.h*.4],[R.x+R.w*.8,R.y+R.h*.7]],1);return;
      }
      // the disposal yard: four pieces of hard cover on the diagonals, painted hazard lanes to the gates, open centre
      if(id==='inner-arena'){
        zone('cover',R.x+80,R.y+80,R.w-160,R.h-160);zone('lanes',cx-30,R.y,60,R.h);zone('lanes',R.x,cy-30,R.w,60);
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q,i){block('lots/craneBase',cx+q[0]*200-20,cy+q[1]*200-20,40,40,{cover:true,arenaCover:true,variant:i%2});});
        [[0,-250],[0,250],[-250,0],[250,0]].forEach(function(q,i){flat('lots/hazardPaint',cx+q[0],cy+q[1],{rot:i>1?1:0});});
        return;
      }
      if(id==='vehicle-yard'){
        zone('vehicles',R.x+10,R.y+10,R.w-20,R.h-20);
        block('barricade/humvee',R.x+R.w*.62,R.y+R.h*.55,84,48,{rot:0});block('barricade/crateMil',R.x+R.w*.88,R.y+R.h*.2,24,24);block('barricade/crateMil',R.x+R.w*.8,R.y+R.h*.2,24,24);
        flat('tiles/decalOil',R.x+R.w*.6,R.y+R.h*.7);
        sockets([[R.x+R.w*.3,R.y+R.h*.55],[R.x+R.w*.62,R.y+R.h*.75]],2);return;
      }
      // V2-3 pilot yards: a working loading court (dock apron, pallets, skip, drums, one flood) and the terrace rear court (bins, washing-line posts)
      if(id==='ashworks-loading-court'){
        zone('dock',R.x+20,R.y+20,R.w-40,120);zone('storage',R.x+20,R.y+R.h-160,R.w-40,140);
        block('industrial/palletCluster',R.x+R.w-70,R.y+R.h-60,38,16,{cover:true});block('industrial/ashSkip',R.x+30,R.y+R.h-70,38,16,{cover:true});block('industrial/drumCluster',R.x+R.w-60,R.y+140,30,14,{cover:true});
        flat('industrial/loadingDock_h',R.x+30,R.y+20);flat('industrial/ashSpill',R.x+60,R.y+R.h-40);flat('lots/hazardPaint',R.x+60,R.y+150);
        block('barricade/floodlight',R.x+R.w-50,R.y+R.h*.45,20,14,{light:{r:170,col:'#ffb040',a:'ff',dy:60},lit:true});L.lightAnchors.push({x:R.x+R.w-40,y:R.y+R.h*.45,r:170,lit:true});
        sockets([[R.x+R.w*.5,R.y+R.h*.35],[R.x+R.w*.35,R.y+R.h*.75]],2);return;
      }
      if(id==='linden-rear-court'){
        zone('court',R.x,R.y,R.w,R.h);
        block('props/dumpster',R.x+20,R.y+40,40,26,{variant:1});flat('streetlife/binBags',R.x+80,R.y+56,{variant:2});flat('streetlife/tippedBin',R.x+R.w-50,R.y+R.h-60);flat('lots/refugeNotice',R.x+R.w-40,R.y+30);
        lamp('lots/lightPole',R.x+R.w-30,R.y+R.h/2,110);
        sockets([[R.x+R.w*.5,R.y+R.h*.5]],1);return;
      }
      if(L.bare){zone('apron',R.x,R.y,R.w,R.h);sockets([[R.x+40,R.y+R.h-50],[R.x+R.w-40,R.y+R.h-50]],1);return;}
      if(k==='park'&&id==='northline-park'){
        // Transmitter Park, the municipal one: an ordered avenue of trees and beds lined along both paths, benches facing the walk
        zone('paths',cx-24,R.y,48,R.h);zone('paths',R.x,cy-24,R.w,48);
        for(var ty=R.y+60;ty<R.y+R.h-40;ty+=110){if(Math.abs(ty-cy)<70)continue;block('lots/tree',cx-72,ty-12,18,12,{cover:true});block('lots/tree',cx+54,ty-12,18,12,{cover:true});}
        [[R.x+R.w*.2,cy-66],[R.x+R.w*.8,cy-66],[R.x+R.w*.2,cy+66],[R.x+R.w*.8,cy+66]].forEach(function(p,i){zone('planting',p[0]-30,p[1]-22,60,44);flat('lots/plantingBed',p[0],p[1],{variant:i%2});});
        flat('lots/pathCross',cx,cy);block('lots/benchPark_v',cx-44,cy-150,16,10,{cover:true});flat('lots/wornPatch',cx-32,cy-160,{rot:1});block('lots/benchPark_v',cx+28,cy+120,16,10,{cover:true,flip:true});flat('lots/wornPatch',cx+18,cy+110,{rot:1});
        lamp('props/streetLamp',cx+34,cy+34,120);lamp('props/streetLamp',cx-34,R.y+60,100);flat('lots/noticeBoard',cx+40,cy-40);
        sockets([[cx-60,cy-60],[cx+70,cy+60],[cx+60,cy-80]],2);
      }else if(k==='park'){
        // Linden Park, the neighbourhood one: informal tree clusters off the paths, benches where people actually sit, worn grass
        zone('paths',cx-24,R.y,48,R.h);zone('paths',R.x,cy-24,R.w,48);
        [[R.x+R.w*.2,R.y+R.h*.22],[R.x+R.w*.3,R.y+R.h*.3],[R.x+R.w*.78,R.y+R.h*.7],[R.x+R.w*.7,R.y+R.h*.82],[R.x+R.w*.82,R.y+R.h*.2]].forEach(function(p){block('lots/tree',p[0]-9,p[1]-12,18,12,{cover:true});});
        [[R.x+R.w*.25,R.y+R.h*.75],[R.x+R.w*.72,R.y+R.h*.3]].forEach(function(p,i){zone('planting',p[0]-50,p[1]-50,100,100);flat('lots/plantingBed',p[0],p[1],{variant:i%2});});
        flat('lots/pathCross',cx,cy);block('props/bench',cx+40,cy-70,40,12,{cover:true});flat('lots/wornPatch',cx+60,cy-58);block('props/bench',cx-80,cy+40,40,12,{cover:true});flat('lots/wornPatch',cx-60,cy+52,{variant:1});
        block('lots/benchPark_v',cx+30,cy+110,16,10,{cover:true,flip:true});flat('lots/wornPatch',cx+20,cy+100,{rot:1});
        lamp('props/streetLamp',cx+34,cy+34,120);flat('lots/noticeBoard',cx-40,cy-40);
        sockets([[cx-60,cy-60],[cx+70,cy+60],[cx+60,cy-80]],2);
      }else if(k==='parkingLot'){
        zone('bays',R.x+20,R.y+80,R.w-40,R.h-160);
        for(var bx=R.x+36;bx<R.x+R.w-40;bx+=60){flat('lots/parkingLine_v',bx,R.y+150);flat('lots/parkingLine_v',bx,R.y+R.h-110);}
        lamp('lots/lightPole',R.x+R.w-40,cy,150);lamp('lots/lightPole',R.x+40,cy,150);flat('lots/trolley',R.x+R.w*.6,R.y+R.h*.55);
        sockets([[R.x+R.w*.5,cy],[R.x+R.w*.25,R.y+R.h-60],[R.x+R.w*.75,R.y+60]],2);
      }else if(k==='graveyard'){
        zone('paths',cx-30,R.y,60,R.h);
        for(var gy=R.y+70;gy<R.y+R.h-60;gy+=70)for(var gx=R.x+50;gx<R.x+R.w-40;gx+=60){if(Math.abs(gx+8-cx)<60)continue;
          var jx=Math.round((mix(gx+3,gy)-.5)*14),jy=Math.round((mix(gx,gy+5)-.5)*10),roll=mix(gx,gy);if(roll>.93)continue;
          if(roll<.66)block('lots/grave',gx+jx,gy+jy,16,8,{cover:true,variant:mix(gy,gx)*3|0});else flat('lots/graveFlat',gx+8+jx,gy+4+jy,{variant:mix(gx,gy+1)*2|0});}
        zone('graves',R.x+30,R.y+50,R.w-60,R.h-100);flat('lots/pathGravel',cx,cy);flat('lots/refugeNotice',cx+40,R.y+60);
        sockets([[cx,R.y+R.h*.3],[cx,R.y+R.h*.7],[cx+10,R.y+R.h*.5],[R.x+R.w-50,cy]],3);
      }else if(k==='demolitionLot'){
        zone('rubble',R.x+30,R.y+30,R.w-60,R.h-60);
        block('lots/spoilHeap',R.x+R.w*.2,R.y+R.h*.25,60,30,{cover:true});block('props/rubbleChunk',R.x+R.w*.62,R.y+R.h*.3,44,22,{variant:1});block('props/rubbleChunk',R.x+R.w*.35,R.y+R.h*.7,44,22,{variant:2});
        flat('lots/hoardingSign',R.x+R.w*.5,R.y+26);lamp('barricade/floodlight',R.x+R.w-50,R.y+50,120,'#ffd249');
        sockets([[R.x+R.w*.5,cy],[R.x+R.w*.8,R.y+R.h*.7]],2);
      }else if(k==='machineryYard'){
        slots.forEach(function(v){flat('lots/padMarking',v.rect.x+v.rect.w/2,v.rect.y+v.rect.h/2,{padId:v.id});});
        zone('pads',R.x+20,R.y+20,R.w-40,R.h-40);
        block('lots/pipeBank',R.x+R.w*.3,R.y+R.h*.47,90,20,{cover:true});block('lots/craneBase',R.x+R.w-80,R.y+R.h*.47,40,40,{cover:true});block('lots/conveyor',R.x+30,R.y+R.h*.47,90,20,{cover:true});
        lamp('barricade/floodlight',R.x+30,R.y+30,140,'#ffd249');
        sockets([[R.x+R.w*.5,R.y+R.h*.35],[R.x+R.w*.5,R.y+R.h*.62],[R.x+R.w*.2,R.y+R.h*.62]],3);
      }else if(k==='serviceYard'){
        zone('storage',R.x+20,R.y+20,R.w-40,R.h-40);
        block('lots/utilityBox',R.x+30,R.y+30,24,16,{cover:true});block('props/palletStack',R.x+R.w-70,R.y+R.h-40,36,16,{cover:true});block('props/crateStack',R.x+R.w*.45,R.y+34,32,18,{cover:true});
        if(R.w*R.h>60000)lamp('barricade/floodlight',R.x+R.w-40,R.y+40,130,'#ffd249');
        sockets([[cx,cy],[R.x+R.w*.3,R.y+R.h*.7],[R.x+R.w*.7,R.y+R.h*.3]],2);
      }
    });
  }
  // ---- the fixed city plan: required places first, then ordinary fabric around them ----
  function buildPlan(w){
    C().PLAN.forEach(function(p){
      var place=C().PLACES[p.id]||{},R=p.rect,b0=p.buildings&&p.buildings[0],l0=p.lots&&p.lots[0];
      var loc=location(w,p.id,place.kind||(b0?'building':'lot'),R[0],R[1],R[2],R[3],{name:p.name,archetypeId:b0&&b0.archetype,lotKind:l0&&l0.kind,discoveryRule:p.optional?'visit':null});
      reserve(w,R[0],R[1],R[2],R[3],'location',p.id);
      (p.buildings||[]).forEach(function(b){shell(w,loc,{id:p.id+'/'+(b.id||'main'),archetypeId:b.archetype,style:C().ARCHETYPES[b.archetype].styles[0],rect:b.rect,doors:b.doors});});
      (p.lots||[]).forEach(function(l){lot(w,loc,l);});
      (p.access||[]).forEach(function(a,i){reserve(w,a[0],a[1],a[2],a[3],'approach',p.id+'/access-'+i);});
      (p.vehicleSlots||[]).forEach(function(v){
        var r=v.rect,slot={id:v.id,locationId:p.id,lotId:loc.lotIds[0]||null,buildingId:null,vehicleType:v.vehicleType,rect:{x:r[0],y:r[1],w:r[2],h:r[3]},heading:v.heading,clearance:v.vehicleType==='sedan'?60:90};
        if(v.prop)slot.prop=true;
        w.vehicleSlots.push(slot);if(slot.lotId)lotById(w,slot.lotId).vehicleSlots.push(slot.id);
        if(v.driveway)reserve(w,v.driveway[0],v.driveway[1],v.driveway[2],v.driveway[3],'driveway',v.id);
      });
      // bulldozer-only piles: no hp, so bullets and ramming cannot open them (Phase 10 clears them)
      (p.debris||[]).forEach(function(d){
        var r=d.rect,id=p.id+'/'+d.id,o=ob(r[0],r[1],r[2],r[3],'debris');o.art='props/rubbleChunk';o.debris='optional-clear';o.debrisId=id;o.locationId=p.id;w.obstacles.push(o);
        w.debris.push({id:id,locationId:p.id,tag:'optional-clear',rect:{x:r[0],y:r[1],w:r[2],h:r[3]},note:d.note});
      });
    });
  }
  var EDGES=GRID,KERB=170,EDGE_PAD=60;
  // The road grid as blocks: usable rects between pavements, with the sides that face a road.
  function buildBlocks(w){
    for(var yi=0;yi<6;yi++)for(var xi=0;xi<6;xi++){
      var x0=EDGES[xi]+(xi?KERB:EDGE_PAD),x1=EDGES[xi+1]-(xi<5?KERB:EDGE_PAD),y0=EDGES[yi]+(yi?KERB:EDGE_PAD),y1=EDGES[yi+1]-(yi<5?KERB:EDGE_PAD);
      var b={id:'block-'+xi+'-'+yi,col:xi,row:yi,rect:{x:x0,y:y0,w:x1-x0,h:y1-y0},districtId:blockOwner(xi,yi).id,frontage:[]};
      if(yi>0)b.frontage.push('n');if(xi<5)b.frontage.push('e');if(yi<5)b.frontage.push('s');if(xi>0)b.frontage.push('w');
      w.blocks.push(b);
    }
  }
  // share of frontage parcels left sealed (background density), and the home style, per district
  var SEALED={checkpoint:.35,ruins:.45,hospital:.35,northline:.45,industry:.55,quarantine:.5};
  var HOME_STYLE={checkpoint:'row',hospital:'row',northline:'row',ruins:'terrace',industry:'shack',quarantine:'row'};
  function blend(own,other,t){var out={},k;for(k in own)out[k]=(out[k]||0)+own[k]*(1-t);for(k in other)out[k]=(out[k]||0)+other[k]*t;return out;}
  function pick(weights,v){var total=0,k,acc=0,last=null;for(k in weights)total+=weights[k];for(k in weights){last=k;acc+=weights[k]/total;if(v<acc)return k;}return last;}
  // Frontage parcels along every road-facing edge, then one background mass in the block core.
  // A parcel facing a block of another district takes 30% of that district's weights: the gradient
  // happens across the street, not at the classifier line.
  // a sealed frontage parcel reopened as an ordinary enterable building (keeps its footprint and street door)
  function openParcel(w,p){
    w.obstacles=w.obstacles.filter(function(o){return o.parcelId!==p.id;});w.reserved=w.reserved.filter(function(r){return r.id!==p.id;});
    var b=null;for(var i=0;i<w.blocks.length;i++)if(w.blocks[i].id===p.blockId)b=w.blocks[i];
    var d=DISTRICT_BY_ID[b.districtId],arch=pick(p.weights,.2),style=arch==='home'?HOME_STYLE[d.id]:C().ARCHETYPES[arch].styles[0],r=p.rect;
    var loc=location(w,p.id,'building',r.x,r.y,r.w,r.h,{archetypeId:arch,name:C().ARCHETYPES[arch].label});
    p.use='enterable';p.buildingId=p.id+'/shell';shell(w,loc,{id:p.buildingId,archetypeId:arch,style:style,rect:[r.x,r.y,r.w,r.h],doors:[[p.side,.5,88,'public']]});
  }
  // Each block draws from its own generator and numbers its own parcels, so re-authoring one block no longer
  // shifts the fill or the parcel ids of every block after it. Central Quarantine's four support blocks are
  // filled like any other district around the reserved command/disposal compound (it never grows the arena).
  // per district: parcel run length, the one opening per side (alley / forecourt width), whether a big core keeps a
  // sealed rear wing, and the courtyard's name and surface (city_v2 Section 2 density targets)
  var COMPOSE={
    checkpoint:{parcel:[230,300],gap:[70,90],fill:.74,opening:'alley',wing:true,court:'Rear court',pocket:'Shop forecourt',surface:'concrete'},
    ruins:{parcel:[220,290],gap:[60,80],fill:.8,opening:'passage',wing:true,court:'Broken court',pocket:'Demolition gap',surface:'gravel'},
    hospital:{parcel:[240,310],gap:[120,160],fill:.56,opening:'forecourt lane',wing:false,court:'Ward garden',pocket:'Ward forecourt',surface:'grass'},
    northline:{parcel:[240,310],gap:[110,150],fill:.56,opening:'service lane',wing:true,court:'Service court',pocket:'Depot apron',surface:'concrete'},
    industry:{parcel:[260,320],gap:[110,140],fill:.66,opening:'truck lane',wing:true,court:'Works yard',pocket:'Yard apron',surface:'gravel'},
    quarantine:{parcel:[240,300],gap:[90,120],fill:.62,opening:'staging lane',wing:true,court:'Staging yard',pocket:'Queue apron',surface:'concrete'}
  };
  // courtyards carry no loot sockets: district clutter against the walls; Civic Ward's ward gardens get trees and a bench
  function dressCourts(w,courts){
    courts.forEach(function(L){var R=L.rect,d=district(R.x+R.w/2,R.y+R.h/2),t=d.theme,k=0,tag={lotId:L.id,locationId:L.locationId,debris:'decorative'};
      L.propZones.push({id:L.id+'/zone-0',kind:'court',rect:{x:R.x,y:R.y,w:R.w,h:R.h}});
      if(d.id==='hospital'){[[.3,.3],[.7,.65]].forEach(function(f){var tx=Math.round(R.x+R.w*f[0]),ty=Math.round(R.y+R.h*f[1]);if(rectClear(w,tx-9,ty-12,18,12,30,true))solid(w,'lots/tree',tx-9,ty-12,18,12,'rubble',null,{lotId:L.id,locationId:L.locationId,debris:'decorative',cover:true});});
        if(rectClear(w,Math.round(R.x+R.w/2-20),Math.round(R.y+R.h/2),40,12,20,true))solid(w,'props/bench',Math.round(R.x+R.w/2-20),Math.round(R.y+R.h/2),40,12,'rubble',null,tag);return;}
      // the court is itself a reservation, so placements test obstacles only (authored rectClear)
      for(var i=0;i<10&&k<3;i++){var fx=Math.round(R.x+40+mix(R.x+i*37,R.y)*(R.w-80)),fy=Math.round(R.y+40+mix(R.y,R.x+i*53)*(R.h-80)),name=t.clutter.length?t.clutter[mix(fx,fy)*t.clutter.length|0]:null,box=name&&PROP_BOX[name];
        if(!name)break;if(box){var bx=Math.round(fx-box[0]/2),by=Math.round(fy-box[1]);if(rectClear(w,bx,by,box[0],box[1],24,true)){solid(w,'props/'+name,bx,by,box[0],box[1],'rubble',box[2],{variant:PROP_VARIANTS[name]?mix(fx+1,fy)*PROP_VARIANTS[name]|0:0,lotId:L.id,locationId:L.locationId,debris:'decorative'});k++;}}
        else if(rectClear(w,fx-12,fy-12,24,12,12,true)){prop(w,'props/'+name,fx,fy,{flat:true,lotId:L.id,locationId:L.locationId,variant:PROP_VARIANTS[name]?mix(fx+1,fy)*PROP_VARIANTS[name]|0:0});}}
      if(!w.obstacles.some(function(o){return o.lotId===L.id;})&&rectClear(w,Math.round(R.x+R.w/2-16),Math.round(R.y+R.h/2-9),32,18,20,true))solid(w,'props/crateStack',Math.round(R.x+R.w/2-16),Math.round(R.y+R.h/2-9),32,18,'rubble',80,tag);
    });
  }
  // the inverse of openParcel: an ordinary interior becomes a sealed street facade (keeps its footprint)
  function sealParcel(w,p){
    var bid=p.buildingId,r=p.rect;
    w.obstacles=w.obstacles.filter(function(o){return o.buildingId!==bid;});w.buildings=w.buildings.filter(function(h){return h.id!==bid;});
    w.locations=w.locations.filter(function(l){return l.id!==p.id;});w.reserved=w.reserved.filter(function(q){return !(q.id===bid||(q.id&&q.id.indexOf(bid+'/')===0));});
    p.use='sealed';p.buildingId=null;var o=ob(r.x,r.y,r.w,r.h,'building');o.sealed=true;o.facade=p.side;o.parcelId=p.id;o.blockId=p.blockId;o.protected=true;w.obstacles.push(o);reserve(w,r.x,r.y,r.w,r.h,'sealed',p.id);
  }
  function buildFabric(w){
    var FD=260,courts=[];
    w.blocks.forEach(function(b){
      var g=rng(74393+b.col*7919+b.row*104729),n=0;
      var R=b.rect,d=DISTRICT_BY_ID[b.districtId],pilot=C().PILOT_BLOCKS&&C().PILOT_BLOCKS[b.id];
      if(pilot){
        b.authored=true;
        pilot.alleys.forEach(function(a,i){reserve(w,a[0],a[1],a[2],a[3],'approach',b.id+'/alley-'+i);});
        pilot.parcels.forEach(function(q){
          var side=q[0],px=q[1],py=q[2],pwd=q[3],pht=q[4],use=q[5],parcel={id:b.id+'-p'+(n++),blockId:b.id,side:side,rect:{x:px,y:py,w:pwd,h:pht},use:null,weights:d.fabric,sealedChance:0,authored:true};
          w.parcels.push(parcel);
          if(use==='sealed'){parcel.use='sealed';var so=ob(px,py,pwd,pht,'building');so.sealed=true;so.facade=side;so.parcelId=parcel.id;so.blockId=b.id;so.protected=true;w.obstacles.push(so);reserve(w,px,py,pwd,pht,'sealed',parcel.id);return;}
          var style=use==='home'?HOME_STYLE[d.id]:C().ARCHETYPES[use].styles[0],loc=location(w,parcel.id,'building',px,py,pwd,pht,{archetypeId:use,name:C().ARCHETYPES[use].label});
          var doors=[[side,.5,88,'public']];if(q[6])doors.push([q[6],.5,70,'service']);
          parcel.use='enterable';parcel.buildingId=parcel.id+'/shell';shell(w,loc,{id:parcel.buildingId,archetypeId:use,style:style,rect:[px,py,pwd,pht],doors:doors});
        });
        return;
      }
      // city_v2 Section 2 composition: attached frontage with one purposeful opening per side (an alley, or a campus
      // forecourt in Civic Ward / Northline) instead of repeated 50-99 unit gaps, and a named courtyard as the block core
      var K=COMPOSE[d.id];
      var clearOf=function(x,y,ww,hh){for(var i=0;i<w.reserved.length;i++){var q=w.reserved[i],own=q.id&&(q.id.indexOf(b.id+'-p')===0||q.id.indexOf(b.id+'/')===0);if(overlaps(q,x,y,ww,hh,own?0:30))return false;}return true;};
      b.frontage.forEach(function(side){
        var c=b.col+(side==='e'?1:side==='w'?-1:0),rr=b.row+(side==='s'?1:side==='n'?-1:0),nb=w.blocks[rr*6+c];
        var nd=nb&&nb.districtId!==b.districtId?DISTRICT_BY_ID[nb.districtId]:null;
        var weights=nd?blend(d.fabric,nd.fabric,.3):d.fabric,sealed=nd?SEALED[d.id]*.7+SEALED[nd.id]*.3:SEALED[d.id];
        // A row plans its whole run as segments: parcels, one reserved access opening (alley / forecourt lane), and small
        // named pockets (forecourts, aprons, demolition gaps) that hold the district's intended openness (K.fill of the
        // non-access frontage is building). Street rows reach both corners; side rows start where the street rows end.
        var horizontal=side==='n'||side==='s',len=horizontal?R.w:R.h,has0=b.frontage.indexOf(horizontal?'w':'n')>=0,has1=b.frontage.indexOf(horizontal?'e':'s')>=0;
        var start=horizontal?0:(has0?FD:0),stop=horizontal?len:len-(has1?FD:0),avail=stop-start,avg=(K.parcel[0]+K.parcel[1])/2;
        var gapW=avail>=K.parcel[1]+K.gap[1]+180?K.gap[0]+(g()*(K.gap[1]-K.gap[0])|0):0,rest=avail-gapW,parcelLen=rest*K.fill,pocketLen=rest-parcelLen;
        var pockets=pocketLen>=110?Math.max(1,Math.round(pocketLen/230)):0;if(!pockets)parcelLen=rest;
        var count=parcelLen<150?0:Math.max(1,Math.round(parcelLen/avg));if(count&&parcelLen/count<160)count=Math.max(1,Math.floor(parcelLen/160));
        var segs=[],openAfter=Math.floor(count*(.3+g()*.4));
        for(var si=0;si<count;si++){segs.push({t:'p',len:parcelLen/count});
          for(var pk=0;pk<pockets;pk++)if(si===Math.round((pk+1)*count/(pockets+1))-1&&si<count-1)segs.push({t:'k',len:pocketLen/pockets});
          if(gapW&&si===Math.min(count-2,openAfter))segs.push({t:'a',len:gapW});}
        var used=segs.reduce(function(s,q){return s+q.len;},0);if(!count){segs=[{t:'k',len:avail}];used=avail;}
        if(used<avail-1)segs.push({t:'k',len:avail-used});
        var pos=start;
        for(var gi=0;gi<segs.length;gi++){
          var sg=segs[gi],pw=gi===segs.length-1?Math.round(stop-pos):Math.round(sg.len),depth=horizontal?230+(g()*30|0):190+(g()*70|0),u=g(),v=g();
          var px=horizontal?R.x+pos:(side==='w'?R.x:R.x+R.w-depth),py=horizontal?(side==='n'?R.y:R.y+R.h-depth):R.y+pos,pwd=horizontal?pw:depth,pht=horizontal?depth:pw;
          if(sg.t!=='p'){
            var sd=220,ox=horizontal?R.x+pos:(side==='w'?R.x:R.x+R.w-sd),oy=horizontal?(side==='n'?R.y:R.y+R.h-sd):R.y+pos,ow=horizontal?pw:sd,oh=horizontal?sd:pw;
            if(sg.t==='a'){if(!reservedAt(w,ox,oy,ow,oh+40*(horizontal?1:0),0))reserve(w,ox,oy,ow,horizontal?FD+20:oh,'approach',b.id+'/'+K.opening+'-'+side);}
            else if(pw>=90&&!reservedAt(w,ox,oy,ow,oh,10)){var kloc=location(w,b.id+'/pocket-'+side+gi,'lot',ox,oy,ow,oh,{name:K.pocket,lotKind:'courtyard',discoveryRule:'visit'});
              courts.push(lot(w,kloc,{id:'pocket',kind:'courtyard',rect:[ox,oy,ow,oh],entrances:[],surface:K.surface}));}
            pos+=pw;continue;
          }
          pos+=pw;
          if(pw<150)continue;
          var take=clearOf(px,py,pwd,pht);
          if(!take)continue;
          var parcel={id:b.id+'-p'+(n++),blockId:b.id,side:side,rect:{x:px,y:py,w:pwd,h:pht},use:null,weights:weights,sealedChance:Math.round(sealed*100)/100};
          w.parcels.push(parcel);
          if(u<sealed){
            parcel.use='sealed';var o=ob(px,py,pwd,pht,'building');o.sealed=true;o.facade=side;o.parcelId=parcel.id;o.blockId=b.id;o.protected=true;w.obstacles.push(o);reserve(w,px,py,pwd,pht,'sealed',parcel.id);
            // Old Quarter terraces: fresh collapse, a spill of rubble along the street face (flat, never across the pavement)
            if(d.id==='ruins'&&u<sealed*.7){o.collapsed=true;parcel.collapsed=true;for(var sp=0;sp<2;sp++){var t2=.3+sp*.4,fx=horizontal?px+pwd*t2:(side==='w'?px+12:px+pwd-12),fy=horizontal?(side==='n'?py+12:py+pht-12):py+pht*t2;prop(w,'lots/rubbleSpill',Math.round(fx),Math.round(fy),{flat:true,variant:sp,parcelId:parcel.id});}}
          }else{
            var arch=pick(weights,v),style=arch==='home'?HOME_STYLE[d.id]:C().ARCHETYPES[arch].styles[0],loc=location(w,parcel.id,'building',px,py,pwd,pht,{archetypeId:arch,name:C().ARCHETYPES[arch].label});
            parcel.use='enterable';parcel.buildingId=parcel.id+'/shell';shell(w,loc,{id:parcel.buildingId,archetypeId:arch,style:style,rect:[px,py,pwd,pht],doors:[[side,.5,88,'public']]});
          }
        }
      });
      var has=function(s){return b.frontage.indexOf(s)>=0;};
      var x0=R.x+(has('w')?FD+30:30),x1=R.x+R.w-(has('e')?FD+30:30),y0=R.y+(has('n')?FD+30:30),y1=R.y+R.h-(has('s')?FD+30:30);
      // the core: a big core keeps one sealed rear wing on part of its longer axis, the rest is the block's courtyard
      var cwid=x1-x0,chgt=y1-y0,court={x:x0,y:y0,w:cwid,h:chgt};
      if(K.wing&&Math.max(cwid,chgt)>=520){
        var along=cwid>=chgt,half=Math.round((along?cwid:chgt)*(.38+g()*.12)),first=g()<.5;
        var wing=along?{x:first?x0:x1-half,y:y0+20,w:half,h:Math.min(300,chgt-40)}:{x:x0+20,y:first?y0:y1-half,w:Math.min(360,cwid-40),h:half};
        if(wing.w>=140&&wing.h>=120&&!reservedAt(w,wing.x,wing.y,wing.w,wing.h,40)){var core=ob(wing.x,wing.y,wing.w,wing.h,'building');core.sealed=true;core.facade=null;core.blockId=b.id;core.protected=true;w.obstacles.push(core);reserve(w,wing.x,wing.y,wing.w,wing.h,'sealed',b.id+'/core-wing');
          court=along?{x:first?x0+half+60:x0,y:y0,w:cwid-half-60,h:chgt}:{x:x0,y:first?y0+half+60:y0,w:cwid,h:chgt-half-60};}
      }
      if(court.w>=180&&court.h>=180&&!reservedAt(w,court.x,court.y,court.w,court.h,10)){
        var cloc=location(w,b.id+'/court','lot',court.x,court.y,court.w,court.h,{name:K.court,lotKind:'courtyard',discoveryRule:'visit'});
        courts.push(lot(w,cloc,{id:'court',kind:'courtyard',rect:[court.x,court.y,court.w,court.h],entrances:[],surface:K.surface}));
      }
    });
    dressCourts(w,courts);
    // every district keeps at least three ordinary interiors: reopen its first sealed frontage if needed
    DISTRICTS.forEach(function(d){
      var mine=w.parcels.filter(function(p){return DISTRICT_BY_ID[w.blocks[+p.blockId.split('-')[2]*6+ +p.blockId.split('-')[1]].districtId]===d;});
      var open=mine.filter(function(p){return p.use==='enterable';}).length;
      mine.filter(function(p){return p.use==='sealed';}).forEach(function(p){if(open<3){openParcel(w,p);open++;}});
      // ...and at least two sealed background masses: a compound-heavy district (Northline) seals its surplus ordinary parcels
      var masses=w.obstacles.filter(function(o){return o.type==='building'&&district(o.x+o.w/2,o.y+o.h/2)===d;}).length;
      mine.filter(function(p){return p.use==='enterable'&&!p.authored;}).reverse().forEach(function(p){if(masses<2&&open>3){sealParcel(w,p);masses++;open--;}});
    });
  }
  // A failed excursion's barricade across an avenue: jersey row with a breach, sandbag nests, a humvee, floodlight, tent, bodies.
  function barricade(w,id,x,y,vertical){
    var P=vertical?function(u,v){return [x+u,y+v];}:function(u,v){return [x+v,y+u];};
    var sp={id:id,kind:'barricade',x:x,y:y,vertical:vertical},gr=P(-96,-30);
    sp.gapRect=vertical?{x:gr[0],y:gr[1],w:96,h:60}:{x:gr[0],y:gr[1],w:60,h:96};
    for(var u=-160;u<160;u+=48){if(u>=-104&&u<0)continue;var q=P(u,-12);solid(w,'barricade/jersey',q[0],q[1],vertical?48:24,vertical?24:48,'barrier',240,{setpiece:id,rot:vertical?0:1});}
    var n1=P(-170,-60),n2=P(120,-64);solid(w,'barricade/sandbagNest',n1[0],n1[1],vertical?56:30,vertical?30:56,'barrier',400,{setpiece:id,rot:vertical?0:1});solid(w,'barricade/sandbagNest',n2[0],n2[1],vertical?56:30,vertical?30:56,'barrier',400,{setpiece:id,rot:vertical?0:1});
    var hv=P(40,-120);solid(w,'barricade/humvee',hv[0],hv[1],vertical?84:48,vertical?48:84,'car',null,{setpiece:id,rot:vertical?0:1});
    // containment placard beside the gap: how the survivors learn the name.
    // stood in the roadway short of the gap, so the squad walks up to it head on
    var pc=P(-48,70);prop(w,'props/signPlacard',pc[0],pc[1],{setpiece:id});
    var fl=P(-140,-110);prop(w,'barricade/floodlight',fl[0],fl[1],{light:{r:140,col:'#ffd249',a:'ff'},setpiece:id});
    var cr=P(150,-100);solid(w,'barricade/crateMil',cr[0],cr[1],24,24,'barrier',120,{setpiece:id});
    var tn=P(-210,-150);solid(w,'barricade/tentMil',tn[0],tn[1],vertical?64:40,vertical?40:64,'barrier',null,{setpiece:id,rot:vertical?0:1});
    var rw=P(-160,26);prop(w,'barricade/razorWire',rw[0],rw[1],{flat:true,setpiece:id,rot:vertical?0:1});
    var rw2=P(0,26);prop(w,'barricade/razorWire',rw2[0],rw2[1],{flat:true,setpiece:id,rot:vertical?0:1});
    var sg=P(10,40);prop(w,'barricade/signQuarantine',sg[0],sg[1],{setpiece:id});
    for(var b=0;b<3;b++){var bb=P(-120+b*70,60+(b%2)*18);prop(w,'barricade/bodyBag',bb[0],bb[1],{flat:true,setpiece:id,rot:(b+(vertical?0:1))%2});}
    for(var d=0;d<4;d++){var bd=P(-100+d*60,-40+(d%2)*90);prop(w,'barricade/bloodSplat',bd[0],bd[1],{flat:true,variant:d%3,setpiece:id});}
    w.setpieces.push(sp);return sp;
  }
  // ---- abandoned vehicles: collision boxes match the wrecks sprites (long side first) ----
  var WRECK={car:[96,48],van:[110,52],bus:[180,60]};
  function vehicle(w,kind,x,y,vertical,extra,authored){
    var d=WRECK[kind],ww=vertical?d[1]:d[0],hh=vertical?d[0]:d[1];x=Math.round(x);y=Math.round(y);
    if(!rectClear(w,x,y,ww,hh,14,authored))return null;
    var o=solid(w,null,x,y,ww,hh,'car',kind==='bus'?320:kind==='van'?240:200,extra);o.kind=kind;
    // car variant 1 is a police cruiser: only along the evacuation road, at Checkpoint Nine and around South Blocks Police
    var police=Math.abs(x)<260&&y>1300||Math.hypot(x-540,y-2350)<700||Math.hypot(x,y-2750)<500;o.variant=kind==='car'?(police&&mix(y,x)<.6?1:0):mix(y,x)*2|0;return o;
  }
  // Wrecks along every avenue: slots sit midway between the street caches (which
  // fall on multiples of 400), so a cache is never boxed in. Each slot rolls
  // nothing / one kerb car / both kerbs / a van / a car slewed across the road
  // that still leaves 74 units open. Pile-ups with a burning car at most
  // crossings, four buses on the long straights.
  function avenueWrecks(w){
    var i,j,a,b,z,s,r,zz;
    [[0,-2200],[1400,600],[-1400,-1800],[2800,2200]].forEach(function(p,k){vehicle(w,'bus',p[0]+(k%2?-85:25),p[1]-90,true);});
    for(i=0;i<AXES.length;i++){a=AXES[i];
      for(z=-3000;z<=3000;z+=400){
        for(j=0;j<2;j++){ // j=0: the vertical avenue x=a, j=1: the horizontal avenue y=a
          zz=z+Math.round((mix(a+j*13,z)-.5)*120);
          if(Math.abs(a)<620&&Math.abs(zz)<620)continue;
          // the barricade gaps, Blackglass's avenue end and the whole southbound evac road stay clear of wrecks
          if(a===0&&(Math.abs(Math.abs(zz)-700)<260||(j===0&&zz>1250&&zz<3000)||Math.abs(zz-2650)<320||Math.abs(zz+2800)<320))continue;
          r=j?mix(zz,a):mix(a,zz);s=mix(a+5+j,zz)<.5?-1:1;
          if(r<.45)continue;
          if(r<.88){
            if(j)vehicle(w,'car',zz-48,a+s*55-24,false);else vehicle(w,'car',a+s*55-24,zz-48,true);
            if(r>=.75){if(j)vehicle(w,'car',zz-48,a-s*55-24,false);else vehicle(w,'car',a-s*55-24,zz-48,true);}
          }else if(r<.96){if(j)vehicle(w,'van',zz-55,a+s*55-26,false);else vehicle(w,'van',a+s*55-26,zz-55,true);}
          else{if(j)vehicle(w,'car',zz-24,s<0?a-85:a-11,true);else vehicle(w,'car',s<0?a-85:a-11,zz-24,false);}
          if(mix(a+j*7,zz+1)<.3){var px=j?zz+90:a+s*55,py=j?a+s*55:zz+90;if(!blocked(w,px,py,8))prop(w,'props/'+(mix(zz,a+j)<.5?'coneTraffic':'trashBags'),px,py,{flat:true,variant:mix(px,py)*2|0});}
        }
      }
    }
    for(i=0;i<AXES.length;i++)for(j=0;j<AXES.length;j++){a=AXES[i];b=AXES[j];
      if(Math.abs(a)<620&&Math.abs(b)<620||mix(a,b)<=.45)continue;
      vehicle(w,'car',a-84,b+130,true);vehicle(w,'car',a+140,b-84,false);
      var f=vehicle(w,'car',a-20,b-200,false);if(f)f.forceBurn=true;
    }
  }
  // Fixed geometry only; fuel and damage belong to game.js's live vehicles.
  function parkedCars(w,authored){
    var n=0;
    function park(x,y,vertical){
      var o=vehicle(w,'car',x,y,vertical,{driveable:true,carId:'drive-'+n,slotId:'kerb-'+n});
      if(o){o.art='wrecks/car_'+(vertical?'v':'h');w.vehicleSlots.push({id:'kerb-'+n,locationId:null,lotId:null,buildingId:null,vehicleType:'sedan',rect:{x:o.x,y:o.y,w:o.w,h:o.h},heading:vertical?'v':'h',clearance:60});n++;}return o;
    }
    // authored sedan slots (the evac car beside the spawn, parking bays) always hold a driveable car
    if(authored)w.vehicleSlots.slice().forEach(function(slot){
      if(slot.vehicleType!=='sedan')return;var r=slot.rect,vertical=slot.heading==='v';
      var o=vehicle(w,'car',r.x,r.y,vertical,{driveable:true,carId:'drive-'+slot.id,slotId:slot.id,locationId:slot.locationId},true);
      if(o)o.art='wrecks/car_'+(vertical?'v':'h');
    });
    if(authored)return;
    for(var a of AXES)for(var z=-2800;z<=2800;z+=400)for(var j=0;j<2;j++){
      if(Math.abs(a)<620&&Math.abs(z)<620)continue;
      if(a===0&&(Math.abs(Math.abs(z)-700)<260||(j===0&&z>1250&&z<3000)||Math.abs(z-2650)<320||Math.abs(z+2800)<320))continue;
      if(mix(a+91+j*13,z)>=.24)continue;
      var side=mix(a+5+j,z)<.5?-1:1;
      if(j)park(z-48,a+side*55-24,false);else park(a+side*55-24,z-48,true);
    }
  }
  // ---- street furniture ----
  // an overhead lamp: the pole stands at (x,y), the arm reaches `arm` units toward the road (flip mirrors the sprite), the head is 66 up
  function lamp(w,x,y,arm){
    var t=district(x,y).theme,h0=mix(x,y),lit=h0<t.alive,strobe=lit&&mix(x+7,y)<t.strobe;
    var p=prop(w,'props/streetLamp',x,y,{lit:lit,strobe:strobe,variant:lit?0:(mix(x+3,y)<.5?1:2),flip:arm<0});
    if(lit)p.light={r:150,col:t.lamp,a:'ff',dy:66,dx:arm};
    return p;
  }
  // a kerb or lot prop from a theme list; blocking ones get a box in w.obstacles
  function themedProp(w,list,x,y,margin){
    if(!list.length)return null;
    var name=list[mix(x,y)*list.length|0],box=PROP_BOX[name],v=PROP_VARIANTS[name]?mix(x+1,y)*PROP_VARIANTS[name]|0:0,extra={variant:v};
    if(name==='slagPile'||name==='cinderVent')extra.light={r:name==='slagPile'?44:26,col:'#ff7b35',a:name==='slagPile'?'20':'14'};
    if(name==='trashBags'||name==='coneTraffic')extra.flat=true;
    if(box){var bx=Math.round(x-box[0]/2),by=Math.round(y-box[1]);if(!rectClear(w,bx,by,box[0],box[1],margin))return null;return solid(w,'props/'+name,bx,by,box[0],box[1],'rubble',box[2],extra);}
    if(!rectClear(w,x-12,y-12,24,12,margin))return null;return prop(w,'props/'+name,x,y,extra);
  }
  // ---- city_v2 Section 2: street life with a source (streetlife / industrial / civic families) ----
  // Placed after loot sockets: flat decals never block, and the few solids stand only in socket-free courts or clear of
  // every socket. Litter gathers where people left it: alley and lane mouths, rear doors, shopfronts, collapses and curbs.
  function streetLife(w){
    var sockets=[];w.lots.forEach(function(L){L.lootSockets.forEach(function(k){sockets.push(k);});});w.buildings.forEach(function(h){h.lootSockets.forEach(function(k){sockets.push(k);});});
    var nearSocket=function(x,y,r){for(var i=0;i<sockets.length;i++)if(Math.abs(sockets[i].x-x)<r&&Math.abs(sockets[i].y-y)<r)return true;return false;};
    var flat=function(art,x,y,extra){var e={flat:true,streetLife:true};for(var k in extra||{})e[k]=extra[k];return prop(w,art,Math.round(x),Math.round(y),e);};
    var solidAt=function(art,x,y,ww,hh,extra){x=Math.round(x);y=Math.round(y);if(nearSocket(x+ww/2,y+hh/2,40)||!rectClear(w,x,y,ww,hh,16,true))return null;var e={debris:'decorative',cover:true};for(var k in extra||{})e[k]=extra[k];return solid(w,art,x,y,ww,hh,'rubble',null,e);};
    var v3=function(x,y){return mix(x,y)*3|0;};
    // alley, passage and lane mouths: bags and boxes against one wall at the street end, paper caught along the edge
    w.reserved.forEach(function(q){if(q.kind!=='approach'||!q.id||!/\/(alley|passage|truck lane|staging lane|service lane|forecourt lane)/.test(q.id))return;
      var d=district(q.x+q.w/2,q.y+q.h/2),hz=q.w<q.h; // a gap in a horizontal row runs north-south
      var sx=hz?q.x+8:q.x+q.w/2,sy=hz?(q.y<b0(q)?q.y+20:q.y+q.h-20):q.y+8;
      if(d.id==='industry'){flat('industrial/ashSpill',q.x+q.w/2,q.y+q.h/2,{variant:v3(q.x,q.y)%2});return;}
      flat(mix(q.x,q.y)<.5?'streetlife/binBags':'streetlife/flatBoxes',hz?q.x+18:q.x+q.w/2,hz?q.y+q.h/2:q.y+18,{variant:v3(q.x,q.y)});
      flat(hz?'streetlife/paperEdge_v':'streetlife/paperEdge_h',hz?q.x+q.w-8:q.x+q.w/2,hz?q.y+q.h*.7:q.y+q.h-8,{variant:v3(q.y,q.x)});});
    function b0(q){return q.y+q.h/2;}
    // building faces: grime along the street wall base, glass under some shopfronts, spill under fresh collapses
    w.obstacles.forEach(function(o){if(o.type!=='building'||!o.facade)return;var d=district(o.x+o.w/2,o.y+o.h/2);
      if(o.facade==='s')for(var x=o.x+16;x<o.x+o.w-16;x+=64)flat('streetlife/wallDirt_h',x,o.y+o.h+3,{variant:v3(x,o.y)});
      if(o.collapsed&&o.facade==='s')flat('streetlife/brickSpill',o.x+o.w/2,o.y+o.h+14,{variant:v3(o.x,o.y)});});
    w.buildings.forEach(function(h){var A=C().ARCHETYPES[h.archetypeId];if(!A||A.placement!=='fabric')return;var pub=h.exteriorDoors.filter(function(d){return d.kind==='public';})[0];if(!pub)return;
      if(pub.side==='s'){for(var x=h.x+16;x<h.x+h.w-16;x+=64)if(Math.abs(x-(pub.rect.x+pub.rect.w/2))>70)flat('streetlife/wallDirt_h',x,h.y+h.h+3,{variant:v3(x,h.y)});
        if(h.archetypeId==='shop'&&mix(h.x,h.y+3)<.4)flat('streetlife/glassShards',pub.rect.x+pub.rect.w+40,h.y+h.h+8,{variant:v3(h.x,h.y)});}
      h.exteriorDoors.forEach(function(d){if(d.kind!=='service')return;var out={n:[0,-26],s:[0,26],e:[26,0],w:[-26,0]}[d.side];
        flat(h.archetypeId==='shop'?'streetlife/flatBoxes':'streetlife/binBags',d.rect.x+d.rect.w/2+out[0]+(d.side==='n'||d.side==='s'?34:0),d.rect.y+d.rect.h/2+out[1]+(d.side==='e'||d.side==='w'?34:0),{variant:v3(d.rect.x,d.rect.y)});});});
    // curbs: one drain every 400 along each avenue, alternating kerbs, a damp stain beside every other one (between the street caches), never in a crossing
    AXES.forEach(function(a){for(var z=-3000;z<=3000;z+=400){if(Math.abs(a)<700&&Math.abs(z)<700)continue;var zz=z+200;if(axisDist(zz)<200)continue;
      var sd=(z/400|0)%2?1:-1,damp=((z/400|0)+(a/1400|0))%2===0;flat('streetlife/drain_v',a+sd*78,zz,{variant:v3(a,zz)});if(damp)flat('streetlife/gutterDamp_v',a+sd*78,zz+26,{variant:v3(zz,a)});
      flat('streetlife/drain_h',zz,a-sd*78,{variant:v3(zz,a+1)});if(!damp)flat('streetlife/gutterDamp_h',zz+26,a-sd*78,{variant:v3(a+1,zz)});}});
    // courts by district: Ashworks works yards hold pallets, drums and ash skips; Quarantine staging yards tents and notices
    w.lots.forEach(function(L){if(L.kind!=='courtyard')return;var R=L.rect,d=district(R.x+R.w/2,R.y+R.h/2),tag={lotId:L.id,locationId:L.locationId};
      if(d.id==='industry'){solidAt('industrial/palletCluster',R.x+24,R.y+R.h-40,38,16,tag);solidAt(mix(R.x,R.y)<.5?'industrial/drumCluster':'industrial/ashSkip',R.x+R.w-60,R.y+30,mix(R.x,R.y)<.5?30:38,14,tag);flat('industrial/ashSpill',R.x+R.w/2,R.y+R.h/2,{lotId:L.id,variant:v3(R.x,R.y)%2});}
      else if(d.id==='quarantine'){if(R.w>=160&&R.h>=120)solidAt('civic/tentGroup',R.x+R.w/2-56,R.y+R.h/2-10,112,24,tag);solidAt('civic/requisitionBoard',R.x+20,R.y+R.h-10,22,4,tag);}
      else if(d.id!=='hospital'){flat(mix(R.x,R.y+7)<.5?'streetlife/tippedBin':'streetlife/timberScrap',R.x+R.w*.3,R.y+R.h*.35,{lotId:L.id,variant:v3(R.y,R.x)});}});
    // the Utility Yard: transformers on plinths, a cable drum and the pole line that feeds them
    var U=w.lots.filter(function(L){return L.locationId==='utility-yard';})[0];
    if(U){var R=U.rect,tag={lotId:U.id,locationId:U.locationId};solidAt('civic/transformer',R.x+60,R.y+90,40,20,tag);solidAt('civic/transformer',R.x+140,R.y+90,40,20,tag);
      solidAt('civic/cableDrum',R.x+R.w-80,R.y+R.h-90,22,8,tag);solidAt('civic/cablePole',R.x+R.w-40,R.y+60,12,8,tag);solidAt('civic/cablePole',R.x+R.w-40,R.y+R.h/2,12,8,tag);}
  }
  // ---- city_v2 Section 3: district set pieces on the authored compounds (civic and industrial families) ----
  // overhead:true props never collide and draw above actors (render.js), with a flat shadow on the ground below
  function districtPieces(w){
    var sockets=[];w.lots.forEach(function(L){L.lootSockets.forEach(function(k){sockets.push(k);});});w.buildings.forEach(function(h){h.lootSockets.forEach(function(k){sockets.push(k);});});
    var clearOfSockets=function(x,y,ww,hh){return !sockets.some(function(k){return k.x>x-24&&k.x<x+ww+24&&k.y>y-24&&k.y<y+hh+24;});};
    var over=function(art,x,y,extra){var e={overhead:true};for(var k in extra||{})e[k]=extra[k];return prop(w,art,Math.round(x),Math.round(y),e);};
    var flat=function(art,x,y,extra){var e={flat:true};for(var k in extra||{})e[k]=extra[k];return prop(w,art,Math.round(x),Math.round(y),e);};
    // Civic Ward: a covered glass link from the hospital's east wing to the morgue, and the ambulance bay under the ambulance
    for(var gx=2300;gx<2400;gx+=32)over('civic/glassLink_h',gx,-652,{locationId:'st-orison',variant:gx===2332?1:0});
    flat('civic/ambulanceBay',2476,-1062,{locationId:'ambulance-yard',rot:1});
    // Northline: painted apron in front of the fire station's apparatus bays; Blackglass's street front with its dish and mast stub
    for(var fx=-780;fx<-300;fx+=32)flat('civic/fireApron_h',fx,-1810,{locationId:'fire-station',variant:(fx/32|0)%2&1});
    prop(w,'civic/broadcastFront',430,-3150,{overhead:true,feet:true,locationId:'blackglass-radio'});
    // Central Quarantine: a covered processing walkway over the north street between the holding block and the tents
    for(var px=-350;px<180;px+=32)over('civic/processingLink_h',px,-576,{locationId:'patient-furnace',variant:(px/32|0)%3===0?1:0});
    // Ashworks: a gantry crane spanning the loading yard (two solid A-frame piers, beam and parked trolley overhead) and the
    // pipe run from the machine shop to the fuel store
    [[1652,2320],[2068,2320]].forEach(function(p){var x=p[0]-12,y=p[1]-20;if(clearOfSockets(x,y,24,40)&&rectClear(w,x,y,24,40,10,true))solid(w,'industrial/gantryPier_h',x,y,24,40,'rubble',null,{debris:'decorative',cover:true,locationId:'loading-yard',anchorCenter:true});});
    for(var bx=1664;bx<2056;bx+=32)over('industrial/gantryBeam_h',bx,2313,{locationId:'loading-yard',variant:(bx/32|0)%4===0?1:0});
    over('industrial/gantryTrolley_h',1930,2320,{locationId:'loading-yard',center:true});
    // Old Quarter: the chapel and its graveyard share a gravel path from the graveyard's east gate to the chapel side door,
    // worn where the refuge queue waited, with the refuge's notices on the chapel's public door
    var chapel=w.buildings.filter(function(b){return b.archetypeId==='chapel';})[0],grave=w.lots.filter(function(l){return l.kind==='graveyard';})[0];
    if(chapel&&grave){var side=chapel.exteriorDoors.filter(function(d){return d.kind==='side';})[0],gate=grave.entrances.filter(function(e){return e.side==='e';})[0];
      if(side&&gate){var py=Math.round((side.rect.y+side.rect.h/2+gate.rect.y+gate.rect.h/2)/2);for(var qx=gate.rect.x+gate.rect.w;qx<side.rect.x;qx+=32)flat('lots/pathStrip_h',qx+16,py,{locationId:'chapel',variant:(qx/32|0)%2});
        flat('lots/wornPatch',side.rect.x-30,py+14,{locationId:'chapel'});}
      var pub=chapel.exteriorDoors.filter(function(d){return d.kind==='public';})[0];if(pub){flat('lots/refugeNotice',pub.rect.x+40,pub.rect.y-20,{locationId:'chapel'});flat('lots/wornPatch',pub.rect.x+46,pub.rect.y+pub.rect.h/2,{locationId:'chapel',rot:1,variant:1});}}
    // Central Quarantine registration: queue rails from the south street to the processing tents, a tent group on the north
    // support street and the fence line on the east approach; the civilians' holding pen stays open to walk through
    for(var qy=-395;qy<-240;qy+=32){flat('civic/queueRail_v',230,qy,{locationId:'processing-tents',overheadless:true});flat('civic/queueRail_v',300,qy,{locationId:'processing-tents'});}
    var tg=w.lots.filter(function(L){return L.kind==='courtyard'&&district(L.rect.x+L.rect.w/2,L.rect.y+L.rect.h/2).id==='quarantine'&&L.rect.y<0;})[0];
    if(tg)flat('civic/tentGroup',tg.rect.x+tg.rect.w/2,tg.rect.y+tg.rect.h/2+36,{locationId:tg.locationId});
    // Ashworks production: a conveyor from the loading yard hopper to the ash skip, its run solid cover at waist height
    [[1700,2140],[1732,2140],[1764,2140],[1796,2140]].forEach(function(p,i){if(rectClear(w,p[0],p[1],i===3?16:32,16,0,true)&&clearOfSockets(p[0],p[1],32,16))solid(w,i===3?'industrial/conveyorHead_h':'industrial/conveyor_h',p[0],p[1],i===3?16:32,16,'rubble',null,{debris:'decorative',cover:true,locationId:'loading-yard',tileArt:true});});
    if(clearOfSockets(1640,2124,32,32))solid(w,'industrial/hopper',1668,2124,32,32,'rubble',null,{debris:'decorative',cover:true,locationId:'loading-yard'});
    over('industrial/pipeJoint',2100,1694,{locationId:'machine-shop',mask:2});for(var ix=2112;ix<2172;ix+=32)over('industrial/pipe_h',ix,1694,{locationId:'machine-shop',variant:ix===2144?1:0});over('industrial/pipeJoint',2172,1694,{locationId:'fuel-store',mask:8});
  }
  // Story landmark points: where the map pins each story and the HUD reads it (the radio point is the
  // transmitter console inside Blackglass; its pallet waits at the mast base).
  var LANDMARKS=[{id:'checkpoint',name:'Checkpoint Nine',x:0,y:2800,color:'#4c9aa0',locationId:'checkpoint-nine'},
    {id:'radio',name:'Blackglass Radio',x:430,y:-3300,color:'#d49a42',locationId:'blackglass-radio',pallet:{x:-480,y:-3150}},
    {id:'hospital',name:'St. Orison Hospital',x:1950,y:-470,color:'#72b8a7',locationId:'st-orison'},
    {id:'ruins',name:'The Collapsed Quarter',x:-2800,y:0,color:'#77888c',locationId:'collapsed-quarter'},
    {id:'industry',name:'Furnace Plant',x:3250,y:3020,color:'#c75e3d',locationId:'furnace-plant'}];
  var RADIO_MAST={x:-420,y:-3240};
  function dress(w,g){
    // the failed excursion: barricades at the four quarantine crossings
    barricade(w,'barricade-n',0,-700,true);barricade(w,'barricade-s',0,700,true);barricade(w,'barricade-w',-700,0,false);barricade(w,'barricade-e',700,0,false);
    // south checkpoint: gate over the avenue, a watchtower, a military truck and crates beside the spawn
    w.setpieces.push({id:'checkpoint',kind:'checkpoint',x:0,y:2650,locationId:'checkpoint-nine'});
    var CK={setpiece:'checkpoint',locationId:'checkpoint-nine'},RD={setpiece:'radio',locationId:'blackglass-radio'};
    function tag(base,extra){var o={};for(var k in base)o[k]=base[k];for(k in extra||{})o[k]=extra[k];return o;}
    // city_v2 V2-1: no decorative boom here; the only gate at Checkpoint Nine is the functional evacuation barrier at y=3000
    prop(w,'landmarks/watchtower',-190,2730,tag(CK,{light:{r:110,col:'#ffd249',a:'cc',dy:83}})); // dy: the cabin window band centre sits 83 texels above the feet (52x104 tower)
    solid(w,'barricade/truckMil',150,2720,120,52,'car',null,tag(CK));solid(w,'barricade/crateMil',-160,2790,24,24,'barrier',120,tag(CK));solid(w,'barricade/sandbagWall',-200,2860,48,20,'barrier',400,tag(CK));solid(w,'barricade/sandbagWall',160,2860,48,20,'barrier',400,tag(CK));
    // the radio tower: mast base and shack are solid; the shack sits east so the transmitter stays reachable
    // the south evacuation barrier: a locked gate across the avenue and sandbagged pavements, opened by the override
    w.setpieces.push({id:'evac-gate',kind:'evacGate',x:0,y:3000,locationId:'checkpoint-nine',open:false});
    solid(w,null,-85,2990,170,20,'gate',null,{gateId:'evac-gate',protected:true,locationId:'checkpoint-nine'});
    solid(w,'barricade/sandbagWall',-170,2990,85,20,'barrier',400,{protected:true,locationId:'checkpoint-nine'});solid(w,'barricade/sandbagWall',85,2990,85,20,'barrier',400,{protected:true,locationId:'checkpoint-nine'});
    prop(w,'quarantine/evacBarrier',0,3000,{locationId:'checkpoint-nine',evacGate:true});prop(w,'props/circuitBox',110,2975,{locationId:'checkpoint-nine',circuitBox:true});
    // South Blocks notices: evacuation paperwork that points at the rest of the chain without a waypoint
    prop(w,'lots/refugeNotice',-150,2620,{flat:true,locationId:'checkpoint-nine',notice:{title:'EVACUATION SUSPENDED · DAY 6',body:'The south barrier needs emergency power and a command override. Emergency power runs from the St. Aubin Chapel generator (Old Quarter). Fuel: Ashworks.',reveals:['chapel','machine-shop']}});
    prop(w,'lots/refugeNotice',-560,1560,{flat:true,locationId:'crossroads-supermarket',notice:{title:'CIVIC NOTICE',body:'St. Orison (Civic Ward) takes casualties. Blackglass Radio (Northline) relays civilian traffic. Central Quarantine is closed to the public.',reveals:['st-orison','blackglass-radio','patient-furnace']}});
    // Blackglass mast yard: mast base and generator are solid; the pallet space south of the base stays open
    var M=RADIO_MAST;w.setpieces.push({id:'radio',kind:'radio',x:M.x,y:M.y,locationId:'blackglass-radio'});
    solid(w,'landmarks/mastBase',M.x-24,M.y-40,48,40,'rubble',null,tag(RD,{protected:true}));solid(w,'landmarks/generator',M.x-130,M.y+40,40,28,'rubble',null,tag(RD,{protected:true,light:{r:30,col:'#ffd249',a:'18'}}));
    solid(w,'barricade/sandbagWall',M.x-70,M.y-120,48,20,'barrier',400,tag(RD));solid(w,'barricade/sandbagWall',M.x+20,M.y-120,48,20,'barrier',400,tag(RD));
    prop(w,'landmarks/dish',M.x+140,M.y-10,tag(RD));
    // the abandoned traffic (after the set pieces so rectClear keeps their gaps open)
    parkedCars(w,true);avenueWrecks(w);parkedCars(w,false);
    // the fire department's apparatus stands in its apron slot every run, driveable; its fuel is rolled per run in game.js
    w.vehicleSlots.forEach(function(v){if(v.vehicleType!=='fireTruck')return;var r=v.rect;
      solid(w,'vehicles/fireTruck_'+(r.w>r.h?'h':'v'),r.x,r.y,r.w,r.h,'car',360,{maxHp:360,kind:'fireTruck',vehicleType:'fireTruck',service:true,driveable:true,carId:'fire-truck',slotId:v.id,locationId:v.locationId});});
    // Central Quarantine processing ring: floodlit corners, signage, razor wire on the ring edge (the avenues stay
    // open) and the paperwork trail from the holding block to the disposal yard
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(c){prop(w,'barricade/floodlight',c[0]*585,c[1]*585,{light:{r:170,col:'#ff6a3a',a:'ff'},locationId:'patient-furnace',quarantineRing:true});prop(w,'barricade/signQuarantine',c[0]*540,c[1]*630,{locationId:'patient-furnace'});});
    for(var zq=-580;zq<=580;zq+=64){if(Math.abs(zq)<140)continue;[[zq,-626,0],[zq,626,0],[-626,zq,1],[626,zq,1]].forEach(function(p){prop(w,'barricade/razorWire',p[0],p[1],{flat:true,rot:p[2],locationId:'patient-furnace'});});}
    [[-480,-380],[-430,-330],[-380,-280],[-330,-230]].forEach(function(p,i){prop(w,'props/manifest',p[0],p[1],{flat:true,variant:i%2,locationId:'patient-furnace',trail:'intake-to-disposal'});});
    // street furniture along every avenue: lamps on the kerb, hydrants and themed kerb props on the far pavement
    var a,z,i,j,b;
    for(i=0;i<AXES.length;i++){a=AXES[i];
      for(z=-3200;z<=3200;z+=420){var side=((z/420)|0)%2?1:-1;if(Math.abs(a)<620&&Math.abs(z)<620)continue;
        lamp(w,a+side*112,z,-side*16);lamp(w,z,a-side*112,mix(z,a)<.5?16:-16);
        if(!blocked(w,a-side*140,z+210,12))prop(w,'props/hydrant',a-side*140,z+210);if(!blocked(w,z+210,a+side*140,12))prop(w,'props/hydrant',z+210,a+side*140);
        themedProp(w,district(a,z).theme.sidewalk,a-side*146,z+100,6);themedProp(w,district(z,a).theme.sidewalk,z+100,a+side*146,6);}
    }
    for(i=0;i<AXES.length;i++)for(j=0;j<AXES.length;j++){a=AXES[i];b=AXES[j];if(Math.abs(a)<620&&Math.abs(b)<620)continue;
      prop(w,'props/trafficLight',a-118,b-118,{blink:mix(a,b+1)<.2});prop(w,'props/trafficLight',a+118,b+118,{blink:mix(a+1,b)<.2});
      if(!blocked(w,a+154,b+206,24))solid(w,'props/bench',a+134,b+200,40,12,'rubble',null);
      if(!blocked(w,a-144,b-230,12))prop(w,'props/binSmall',a-144,b-230);
      if(mix(a,b)>.5&&!blocked(w,a+125,b+722,40))solid(w,'props/busStop',a+112,b+680,44,64,'rubble',null,{rot:1});
    }
    // district clutter on the lots (never on the roads or pavements)
    for(i=0;i<420;i++){var px=Math.round(-3300+mix(i,3)*6600),py=Math.round(-3300+mix(7,i)*6600);if(Math.abs(px)<700&&Math.abs(py)<700||axisDist(px)<175&&axisDist(py)<175||axisDist(px)<175||axisDist(py)<175)continue;
      themedProp(w,district(px,py).theme.clutter,px,py,10);
    }
    // district landmarks as props (the legacy drawings stay until the landmarks family is registered)
    prop(w,'civic/entranceCanopy',1950,-540,{overhead:true,feet:true,landmark:'hospital',locationId:'st-orison',light:{r:70,col:'#79e2cf',a:'20',dy:40}}); // city_v2: the public canopy on St. Orison's facade line
    // the Furnace Plant: a sealed furnace house with its stacks, open yard in front
    solid(w,null,3080,3110,360,300,'building',null,{sealed:true,facade:'n',protected:true,locationId:'furnace-plant'});
    prop(w,'landmarks/foundryStack',3180,3160,{landmark:'industry',locationId:'furnace-plant',variant:0,light:{r:50,col:'#ff7b35',a:'26',dy:130}});prop(w,'landmarks/foundryStack',3330,3170,{landmark:'industry',locationId:'furnace-plant',variant:1,light:{r:50,col:'#ff7b35',a:'26',dy:130}});
    prop(w,'landmarks/ruinsCollapse',-2800,-30,{landmark:'ruins',locationId:'collapsed-quarter'});
    // the ambulance yard: a parked ambulance in its bay and an iv stand on the hospital forecourt
    w.vehicleSlots.forEach(function(v){if(v.vehicleType==='ambulance')solid(w,'props/ambulance',v.rect.x,v.rect.y,v.rect.w,v.rect.h,'car',260,{locationId:v.locationId,slotId:v.id});});
    prop(w,'props/ivStand',2060,-470,{locationId:'st-orison'});
    // set-piece barricades and checkpoint hardware are protected; their crates stay breakable. Street wrecks are decoration.
    w.obstacles.forEach(function(o){if(o.setpiece&&o.art!=='barricade/crateMil')o.protected=true;else if(o.type==='car'&&o.kind&&!o.driveable&&!o.debris&&!o.service)o.debris='decorative';});
    // some wrecks still burn (share per district theme, pile-ups always), never two within 300 units
    var burning=[];
    w.obstacles.forEach(function(o){if(o.type!=='car'||!o.kind||o.driveable||o.service)return;
      var ash=district(o.x,o.y).id==='industry',scorched=!!o.forceBurn||mix(o.x,o.y)<district(o.x,o.y).theme.burnt;
      o.burning=ash&&scorched;o.cold=!ash&&scorched;
      if(o.burning&&!o.forceBurn)for(var k=0;k<burning.length;k++){var q=burning[k];if(Math.abs(q.x-o.x)<300&&Math.abs(q.y-o.y)<300){o.burning=false;break;}}
      if(o.burning)burning.push(o);
      o.art='wrecks/'+o.kind+(o.burning||o.cold?'Burnt':'')+'_'+(o.w>=o.h?'h':'v');});
    // district practicals (CITY.md Phase 9). Light-only props are flat and drawn only as light.
    function glowAt(x,y,r,col,a,extra){var e={flat:true,lightOnly:true,light:{r:r,col:col,a:a,dy:0}};for(var k in extra||{})e[k]=extra[k];return prop(w,null,Math.round(x),Math.round(y),e);}
    // Ashworks: the furnace house still glows, warning beacons turn over the yards
    glowAt(3260,3100,190,'#ff7b35','44',{locationId:'furnace-plant',flicker:true});glowAt(3160,3260,120,'#ff6a2a','30',{locationId:'furnace-plant',flicker:true});
    [[2150,1590],[2190,2620],[1590,2030],[2630,2170]].forEach(function(p){glowAt(p[0],p[1],70,'#ffb040','66',{warning:true,strobe:true,locationId:'machine-shop'});});
    // Old Quarter: cold moonlight over the graveyard; the chapel's door spill runs on the emergency circuit
    w.lots.forEach(function(L){if(L.kind!=='graveyard')return;var R=L.rect;[[.3,.3],[.7,.55],[.35,.8]].forEach(function(f){glowAt(R.x+R.w*f[0],R.y+R.h*f[1],170,'#9fb0d8','1c',{moonlight:true,locationId:L.locationId});});});
    w.buildings.forEach(function(b){if(b.archetypeId!=='chapel')return;var d=b.exteriorDoors[0].rect;glowAt(d.x+d.w+30,d.y+d.h/2,120,'#ffcf8a','55',{circuit:'emergency',locationId:b.locationId});});
    // Checkpoint Nine: gate floods wired to the emergency circuit (the watchtower lamp runs on its own battery)
    glowAt(-120,2600,180,'#ffe9bd','88',{circuit:'emergency',locationId:'checkpoint-nine'});glowAt(120,2600,180,'#ffe9bd','88',{circuit:'emergency',locationId:'checkpoint-nine'});
    // Central Quarantine: harsh pools along the ring edges, nothing inside the clinical corners
    [[-300,-585],[300,-585],[-300,585],[300,585],[-585,-300],[-585,300],[585,-300],[585,300]].forEach(function(p){glowAt(p[0],p[1],150,'#ffe0c0','bb',{quarantineRing:true,locationId:'patient-furnace'});});
    // every signed civic entrance keeps a small battery exit marker, so it reads even when its street lamp is dead
    w.buildings.forEach(function(b){var l=locationById(w,b.locationId);if(!l||!l.required)return;b.exteriorDoors.forEach(function(d){if(d.kind!=='public')return;var r=d.rect;
      glowAt(r.x+r.w/2,r.y+r.h/2,34,'#dfe8e8','66',{entranceMarker:true,buildingId:b.id,locationId:b.locationId});});});
    // the static light pools the simulation can see by (game.js litAt): lit lamps and other lit props, burning wrecks; o keeps a breakable's hp in view
    w.lights=[];
    function lit(q,src){if(src.locationId)q.locationId=src.locationId;if(src.circuit)q.circuit=src.circuit;if(src.buildingId)q.buildingId=src.buildingId;w.lights.push(q);}
    w.props.forEach(function(p){if(p.light&&(p.art!=='props/streetLamp'||p.lit))lit({x:p.x+(p.light.dx||0),y:p.y-(p.light.dy==null?24:p.light.dy),r:p.light.r},p);});
    w.obstacles.forEach(function(o){if(o.driveable)return;if(o.light)lit({x:o.x+o.w/2,y:o.y+o.h-(o.light.dy==null?24:o.light.dy),r:o.light.r,o:o},o);if(o.burning)w.lights.push({x:o.x+o.w/2,y:o.y+o.h/2,r:120,o:o});});
  }
  function create(seed){
    var r=rng(seed),g=rng(74291),w={bounds:{minX:MIN,minY:MIN,maxX:MAX,maxY:MAX},obstacles:[],landmarks:[],sites:[],roads:[],seed:seed,
      blocks:[],parcels:[],reserved:[],locations:[],buildings:[],lots:[],vehicleSlots:[],debris:[],props:[],setpieces:[]};
    AXES.forEach(function(a){w.roads.push({x:a-ROAD/2,y:MIN,w:ROAD,h:7200});w.roads.push({x:MIN,y:a-ROAD/2,w:7200,h:ROAD});});
    // Fixed geometry: blocks, then the required places, then ordinary frontage around them.
    buildBlocks(w);buildPlan(w);dressLots(w);buildFabric(w);
    // Old Quarter wreck field: alternating breakables leave a winding 80px+ route while the x=-2800 avenue stays open.
    // (cars use the 96x48 wrecks footprint; the avenue traffic is placed in dress())
    [[-3330,-310,105,68,'car',200],[-3180,-205,92,74,'rubble',120],[-3025,-315,86,62,'barrier',140],[-3330,-92,110,62,'rubble',120],[-3160,48,92,70,'car',200],[-3015,150,100,64,'rubble',120],[-3330,210,105,68,'barrier',140],[-3170,310,100,62,'car',200],[-2270,-310,105,68,'barrier',140],[-2420,-205,92,74,'car',200],[-2575,-315,86,62,'rubble',120],[-2270,-92,110,62,'rubble',120],[-2440,48,92,70,'barrier',140],[-2585,150,100,64,'car',200],[-2270,210,105,68,'car',200],[-2430,310,100,62,'rubble',120]].forEach(function(v){var o=ob(v[0],v[1],v[4]==='car'?96:v[2],v[4]==='car'?48:v[3],v[4],v[5]);o.debris='decorative';if(v[4]==='car'){o.kind='car';o.variant=mix(v[1],v[0])*2|0;}w.obstacles.push(o);});
    w.obstacles=w.obstacles.filter(function(o){var nx=Math.max(o.x,Math.min(-2800,o.x+o.w)),ny=Math.max(o.y,Math.min(0,o.y+o.h));return (nx+2800)*(nx+2800)+ny*ny>6400;});
    for(var i=0;i<52;i++){var side=i%4,along=-3200+g()*6400,off=112+g()*28,x=side<2?along:(side===2?-off:off),y=side<2?(side===0?-off:off):along;var rw=70+g()*58,rh=42+g()*42,hp=100+(g()*41|0);
      // the pieces lie on the pavement outboard of the kerb, never across the carriageway
      if(side===0)y-=rh;if(side===2)x-=rw;if(Math.abs(x)<480&&Math.abs(y)<480||reservedAt(w,x,y,rw,rh,0))continue;var rb=ob(x,y,rw,rh,'rubble',hp);rb.debris='decorative';w.obstacles.push(rb);}
    dress(w,g);signs(w);lotSockets(w);arenaGates(w);streetLife(w);districtPieces(w);
    w.landmarks=LANDMARKS.map(function(k){var c={};for(var key in k)c[key]=k[key];if(k.pallet)c.pallet={x:k.pallet.x,y:k.pallet.y};return c;});
    // the radio story point is Blackglass's transmitter console (the preparation console is a separate room)
    w.buildings.forEach(function(b){b.anchors.forEach(function(a){if(a.kind==='radioTransmit')w.landmarks.forEach(function(k){if(k.id==='radio'){k.x=a.x;k.y=a.y;}});});});
    // ---- run loot: fixed sites and sockets, filled from the economy budget with the run RNG ----
    var E=C().ECONOMY,pool=[],perSite={};
    function own(site,loc){site.locationId=loc.id;site.buildingId=site.buildingId||null;site.lotId=site.lotId||null;loc.siteIds.push(site.id);}
    function offer(site,sock,cls,profiles,interior){pool.push({site:site,sock:sock,cls:cls,profiles:profiles,interior:interior,district:district(sock.x,sock.y).id,used:false});}
    // street and landmark caches: five fixed spots around a point
    var CACHE=[['a',-28,-20],['s',20,-20],['w',0,0],['fuel',12,30],['x',35,-28]];
    function cache(id,x,y,profile,locId,cls){
      var loc=locId?locationById(w,locId):location(w,id,'cache',x-96,y-96,192,192,{name:'Street cache',lootProfiles:[profile],discoveryRule:'visit'});
      var site={id:loc.id+'/'+id,x:x,y:y,district:district(x,y).id,radius:72,lootProfile:profile,sockets:CACHE.map(function(k){return {id:loc.id+'/'+id+'#'+k[0],x:x+k[1],y:y+k[2]};}),loot:[]};
      w.sites.push(site);own(site,loc);site.sockets.forEach(function(k){offer(site,k,cls||'street',[profile],false);});return site;
    }
    var spawn=cache('spawn-cache',76,2705,'mixed','checkpoint-nine','landmark');
    spawn.loot.push(it(spawn.sockets[2].id,76,2705,'weapon',{weapon:'ar',quality:1,label:'field rifle',socketId:spawn.sockets[2].id}));
    pool.forEach(function(p){p.used=true;});
    cache('clinic-cache',1780,-400,'medical','st-orison','landmark');cache('garage-cache',2390,1720,'vehicleFuel','fuel-store','landmark');cache('quarter-cache',-2800,350,'utility','collapsed-quarter','landmark');
    cache('radio-cache',-300,-3120,'evidence','blackglass-radio','landmark');cache('foundry-cache',3080,3040,'incendiary','furnace-plant','landmark');
    // every building's stash: required civic places draw generously, ordinary homes thinly; roofs hide them
    w.buildings.forEach(function(h){var loc=locationById(w,h.locationId),cx=h.x+h.w/2,cy=h.y+h.h/2;
      var site={id:loc.id+'/stash',x:cx,y:cy,district:district(cx,cy).id,radius:60,buildingId:h.id,lootProfile:loc.lootProfiles[0]||'mixed',sockets:h.lootSockets,loot:[]};
      w.sites.push(site);own(site,loc);h.lootSockets.forEach(function(k){offer(site,k,loc.required?'civic':'fabric',loc.lootProfiles.length?loc.lootProfiles:['mixed'],true);});});
    // open lots keep a small cache in plain sight
    w.lots.forEach(function(L){if(!L.lootSockets.length)return;var loc=locationById(w,L.locationId),c=L.rect,profiles=loc.lootProfiles.length?loc.lootProfiles:C().LOT_KINDS[L.kind].profiles;
      var site={id:L.id+'/cache',x:c.x+c.w/2,y:c.y+c.h/2,district:district(c.x+c.w/2,c.y+c.h/2).id,radius:80,lotId:L.id,lootProfile:profiles[0]||'mixed',sockets:L.lootSockets,loot:[]};
      w.sites.push(site);own(site,loc);L.lootSockets.forEach(function(k){offer(site,k,'lot',profiles.length?profiles:['mixed'],false);});});
    // frequent, visible caches along the long cardinal routes
    var si=0;[-2800,-1400,0,1400,2800].forEach(function(ax){for(var yy=-2400;yy<=2400;yy+=400){if(Math.abs(ax)<20&&Math.abs(yy)<700)continue;var px=ax+((si%3)-1)*34,py=yy;if(!blocked(w,px,py,45))cache('street-v'+(si++),px,py,'mixed');}});
    [-2800,-1400,0,1400,2800].forEach(function(ay){for(var xx=-2400;xx<=2400;xx+=400){if(Math.abs(ay)<20&&Math.abs(xx)<700)continue;var px=xx,py=ay+((si%3)-1)*34;if(!blocked(w,px,py,45))cache('street-h'+(si++),px,py,'mixed');}});
    function affinity(p,res){
      if(p.used||(perSite[p.site.id]||0)>=E.perSite)return 0;
      var a=0;for(var i=0;i<p.profiles.length;i++)a=Math.max(a,(E.profiles[p.profiles[i]]||{})[res]||0);if(!a)return 0;
      var use=p.sock.use&&E.uses[p.sock.use],d=E.districts[p.district];
      return a*E.classes[p.cls]*(use&&use[res]||1)*(d&&d[res]||1);
    }
    function between(range){return range[0]+Math.floor(r()*(range[1]-range[0]+1));}
    function make(p,res){
      var R=E.resources[res],x=p.sock.x,y=p.sock.y,id=p.sock.id,e={socketId:id},item;if(p.interior)e.interior=true;
      if(res==='weapon'||res==='weaponQ2'){var list=E.weapons.filter(function(k){return k!=='flame'||affinity(p,'incendiary')>0||p.profiles.indexOf('mixed')>=0;});
        e.weapon=list[Math.floor(r()*list.length)];e.quality=res==='weaponQ2'?2:1;e.label=res==='weaponQ2'?'military weapon':'salvaged weapon';item=it(id,x,y,'weapon',e);}
      else if(res==='medkit'){e.label='medkit';item=it(id,x,y,'medkit',e);}
      else if(res==='provision'){e.label='ration pack';item=it(id,x,y,'provision',e);}
      else if(res==='vehicleFuel'){e.amount=between(R.amount);e.label='jerrycan';item=it(id,x,y,'vehicleFuel',e);}
      else if(res==='xp'){e.amount=between(R.amount);e.label=p.profiles.indexOf('evidence')>=0?'field notes':'signal cache';item=it(id,x,y,'xp',e);}
      else{e.ammo=res==='incendiary'?'fuel':res;e.amount=between(R.amount);e.label=res==='incendiary'?'incendiary fuel':res==='shells'?'shells':'magazine';item=it(id,x,y,'ammo',e);}
      item.siteId=p.site.id;item.locationId=p.site.locationId;p.used=true;perSite[p.site.id]=(perSite[p.site.id]||0)+1;p.site.loot.push(item);
    }
    function place(res,only){
      var total=0,i,ws=new Array(pool.length);
      for(i=0;i<pool.length;i++){ws[i]=only&&!only(pool[i])?0:affinity(pool[i],res);total+=ws[i];}
      if(total<=0)return false;var t=r()*total;
      for(i=0;i<pool.length;i++){if(!ws[i])continue;t-=ws[i];if(t<=0){make(pool[i],res);return true;}}
      return false;
    }
    var placed={};
    E.guarantees.forEach(function(g){for(var k=0;k<g.count;k++)if(place(g.resource,function(p){return (!g.district||p.district===g.district)&&(!g.location||p.site.locationId===g.location);}))placed[g.resource]=(placed[g.resource]||0)+1;});
    E.order.forEach(function(res){var n=between(E.resources[res].count)-(placed[res]||0);for(var k=0;k<n;k++)place(res);});
    w.sites.forEach(function(s){s.loot.forEach(function(i){i.siteId=s.id;i.locationId=s.locationId;});});
    return w;
  }
  // Geometry is static except for removed wreckage. Keep the index outside
  // game state and rebuild when the obstacle list changes.
  var obstacleIndexes=new WeakMap(),CELL=256;
  function obstacleIndex(w){
    var index=obstacleIndexes.get(w);
    if(index&&index.source===w.obstacles&&index.length===w.obstacles.length)return index;
    var cells=new Map();
    w.obstacles.forEach(function(o,i){for(var y=Math.floor(o.y/CELL);y<=Math.floor((o.y+o.h)/CELL);y++)for(var x=Math.floor(o.x/CELL);x<=Math.floor((o.x+o.w)/CELL);x++){var key=x+','+y,bucket=cells.get(key);if(!bucket)cells.set(key,bucket=[]);bucket.push(i);}});
    index={source:w.obstacles,length:w.obstacles.length,cells:cells};obstacleIndexes.set(w,index);return index;
  }
  function queryObstacles(w,left,top,right,bottom){
    var cells=obstacleIndex(w).cells,ids=new Set();
    for(var y=Math.floor(top/CELL);y<=Math.floor(bottom/CELL);y++)for(var x=Math.floor(left/CELL);x<=Math.floor(right/CELL);x++){var bucket=cells.get(x+','+y);if(bucket)for(var i of bucket)ids.add(i);}
    return Array.from(ids).sort(function(a,b){return a-b;}).map(function(i){return w.obstacles[i];});
  }
  function blocked(w,x,y,rad){
    rad=rad||0;if(x-rad<MIN||x+rad>MAX||y-rad<MIN||y+rad>MAX)return{type:'bounds',x:MIN,y:MIN,w:7200,h:7200};
    var cells=obstacleIndex(w).cells,first=Infinity;
    for(var gy=Math.floor((y-rad)/CELL);gy<=Math.floor((y+rad)/CELL);gy++)for(var gx=Math.floor((x-rad)/CELL);gx<=Math.floor((x+rad)/CELL);gx++){
      var bucket=cells.get(gx+','+gy);if(!bucket)continue;
      for(var i of bucket){if(i>=first)continue;var o=w.obstacles[i];if(x+rad>o.x&&x-rad<o.x+o.w&&y+rad>o.y&&y-rad<o.y+o.h)first=i;}
    }
    return first===Infinity?null:w.obstacles[first];
  }
  function move(w,e,dx,dy){var r=e.r==null?10:e.r;if(!blocked(w,e.x+dx,e.y,r))e.x+=dx;if(!blocked(w,e.x,e.y+dy,r))e.y+=dy;return e;}
  function visible(w,v){var a=[],o=w.obstacles;for(var i=0;i<o.length;i++)if(o[i].x+o[i].w>v.x-v.w/2&&o[i].x<v.x+v.w/2&&o[i].y+o[i].h>v.y-v.h/2&&o[i].y<v.y+v.h/2)a.push(o[i]);return a;}
  // a well mixed position hash for placement rolls (hash() below loses low bits on grid-aligned inputs and is kept for the baked look)
  function mix(x,y){var n=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263))|0;n=Math.imul(n^(n>>>13),1274126177);n=n^(n>>>16);return (n>>>0)/4294967296;}
  function hash(x,y){var n=((x|0)*374761393+(y|0)*668265263)>>>0;n=(n^(n>>13))*1274126177;return((n^(n>>16))>>>0)/4294967295;}
  function onRoad(x,y){for(var i=0;i<AXES.length;i++)if(Math.abs(x-AXES[i])<ROAD/2||Math.abs(y-AXES[i])<ROAD/2)return true;return false;}
  function tile(ctx,x,y,d,road){
    var h=hash(x/64,y/64),base=road?d.road:d.ground;ctx.fillStyle=base;ctx.fillRect(x,y,64,64);
    ctx.globalAlpha=road?.25:.18;ctx.fillStyle=h>.5?'#ffffff':'#000000';ctx.fillRect(x+(h*43|0),y+((h*91)%53|0),h>.7?10:5,2);ctx.globalAlpha=1;
    if(road){ctx.fillStyle='#53606422';if(h>.66)ctx.fillRect(x+8,y+48,19,2);if(h<.22)ctx.fillRect(x+42,y+13,3,3);return;}
    if(d.id==='ruins'){ctx.fillStyle='#786b9126';ctx.fillRect(x+8,y+10,2,24);ctx.fillRect(x+10,y+32,14,2);if(h>.55){ctx.fillRect(x+42,y+17,12,3);ctx.fillRect(x+49,y+12,3,12);}}
    else if(d.id==='hospital'){ctx.strokeStyle='#79e2cf18';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,63,63);if(h>.72){ctx.fillStyle='#79e2cf24';ctx.fillRect(x+48,y+8,4,16);ctx.fillRect(x+42,y+14,16,4);}}
    else if(d.id==='industry'){ctx.fillStyle='#ff7b3520';if(h>.42){ctx.fillRect(x+8,y+48,38,4);for(var i=0;i<4;i++)ctx.fillRect(x+11+i*9,y+44,3,12);}ctx.fillStyle='#0b101438';ctx.fillRect(x+53,y+9,5,5);}
    else if(d.id==='northline'){ctx.fillStyle='#71899d20';ctx.fillRect(x+6,y+19,42,2);ctx.fillRect(x+44,y+17,2,8);if(h>.7){ctx.fillStyle='#ffd2491c';ctx.fillRect(x+16,y+42,2,10);}}
    else {ctx.fillStyle='#6bc6b916';if(h>.55){ctx.fillRect(x+8,y+49,28,3);ctx.fillRect(x+33,y+45,3,7);}}
  }
  function roof(ctx,o){
    var d=district(o.x+o.w/2,o.y+o.h/2),h=hash(o.x,o.y),edge=d.id==='ruins'?'#28263a':'#0a1014';
    ctx.fillStyle='#05090c88';ctx.fillRect(o.x+10,o.y+12,o.w,o.h);ctx.fillStyle=edge;ctx.fillRect(o.x,o.y,o.w,o.h);
    ctx.fillStyle=d.id==='industry'?'#30322d':d.id==='hospital'?'#243636':d.id==='ruins'?'#302d40':'#263539';ctx.fillRect(o.x+7,o.y+7,o.w-14,o.h-14);
    ctx.fillStyle='#111a1e';ctx.fillRect(o.x+18,o.y+23,o.w-36,o.h-39);ctx.fillStyle=d.color+'24';ctx.fillRect(o.x+12,o.y+12,o.w-24,5);
    for(var x=o.x+24;x<o.x+o.w-20;x+=45){ctx.fillStyle=h>.5?'#415055':'#343f45';ctx.fillRect(x,o.y+14,18,9);ctx.fillStyle=h>.72?d.color+'88':'#11191d';ctx.fillRect(x+3,o.y+16,12,4);}
    if(o.w>240&&o.h>170){ctx.fillStyle='#0b1115';ctx.fillRect(o.x+o.w*.58,o.y+o.h*.55,46,34);ctx.fillStyle='#68737a';ctx.fillRect(o.x+o.w*.58+5,o.y+o.h*.55+5,36,4);}
    if(d.id==='hospital'&&o.w>260){ctx.fillStyle='#79e2cf55';ctx.fillRect(o.x+o.w-55,o.y+31,8,30);ctx.fillRect(o.x+o.w-66,o.y+42,30,8);}
    if(d.id==='ruins'){ctx.fillStyle=d.ground;ctx.fillRect(o.x+o.w-38,o.y,38,22);ctx.fillRect(o.x,o.y+o.h-28,24,28);}
  }
  function wreck(ctx,o){
    var h=hash(o.x,o.y),d=district(o.x,o.y);ctx.fillStyle='#060a0d99';ctx.fillRect(o.x+7,o.y+8,o.w,o.h);
    if(o.type==='car'){ctx.fillStyle='#0a1014';ctx.fillRect(o.x,o.y,o.w,o.h);ctx.fillStyle=h>.5?'#713f39':'#4c5652';ctx.fillRect(o.x+5,o.y+5,o.w-10,o.h-10);ctx.fillStyle='#142126';ctx.fillRect(o.x+o.w*.27,o.y+9,o.w*.46,o.h-18);ctx.fillStyle='#8fa0a033';ctx.fillRect(o.x+o.w*.32,o.y+11,o.w*.16,o.h-22);ctx.fillStyle=d.color;ctx.fillRect(o.x+5,o.y+6,7,6);ctx.fillRect(o.x+o.w-12,o.y+o.h-12,7,6);ctx.fillStyle='#0a1014';ctx.fillRect(o.x+12,o.y-3,18,5);ctx.fillRect(o.x+o.w-30,o.y+o.h-2,18,5);}
    else if(o.type==='barrier'){ctx.fillStyle='#273237';ctx.fillRect(o.x,o.y,o.w,o.h);for(var x=o.x+5;x<o.x+o.w-7;x+=18){ctx.fillStyle=((x/18)|0)%2?'#ff7b35':'#d8dbc8';ctx.fillRect(x,o.y+7,10,o.h-14);}ctx.fillStyle='#0a1014';ctx.fillRect(o.x+8,o.y+o.h-6,o.w-16,5);}
    else {ctx.fillStyle='#273237';for(var i=0;i<7;i++){var px=o.x+hash(o.x+i,o.y)*Math.max(4,o.w-14),py=o.y+hash(o.y+i,o.x)*Math.max(4,o.h-12),sz=5+(hash(i,o.x)*12|0);ctx.fillRect(px,py,sz,sz);ctx.fillStyle=i%3===0?d.color+'66':'#465259';}}
  }
  function landmark(ctx,k,s){
    var A=root.DSArt,t=s.time||0;A.glow(ctx,k.x,k.y,82,k.color,'24');A.shadow(ctx,k.x,k.y+24,42,.6);
    if(k.id==='radio'){
      ctx.strokeStyle='#71818a';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(k.x-32,k.y+32);ctx.lineTo(k.x,k.y-116);ctx.lineTo(k.x+32,k.y+32);ctx.moveTo(k.x-20,k.y-18);ctx.lineTo(k.x+20,k.y-18);ctx.moveTo(k.x-12,k.y-58);ctx.lineTo(k.x+12,k.y-58);ctx.stroke();ctx.fillStyle='#ffd249';ctx.fillRect(k.x-4,k.y-122,8,8);ctx.strokeStyle='#ffd24988';ctx.lineWidth=2;for(var r=18;r<55;r+=16){ctx.beginPath();ctx.arc(k.x,k.y-118,r,-2.6,-.55);ctx.stroke();}ctx.fillStyle='#26343b';ctx.fillRect(k.x-38,k.y+12,76,38);ctx.fillStyle='#ffd249';ctx.fillRect(k.x-28,k.y+21,7,14);
    }else if(k.id==='hospital'){
      ctx.fillStyle='#0a1014';ctx.fillRect(k.x-52,k.y-42,104,84);ctx.fillStyle='#28413f';ctx.fillRect(k.x-46,k.y-36,92,72);ctx.fillStyle='#79e2cf';ctx.fillRect(k.x-7,k.y-27,14,54);ctx.fillRect(k.x-27,k.y-7,54,14);ctx.fillStyle='#d8dbc8';ctx.fillRect(k.x-4,k.y-24,8,48);ctx.fillRect(k.x-24,k.y-4,48,8);
    }else if(k.id==='checkpoint'){
      ctx.fillStyle='#667477';ctx.fillRect(k.x-58,k.y-29,13,58);ctx.fillRect(k.x+45,k.y-29,13,58);ctx.fillStyle='#0a1014';ctx.fillRect(k.x-51,k.y-47,102,15);ctx.fillStyle='#6bc6b9';ctx.fillRect(k.x-46,k.y-43,92,5);ctx.fillStyle='#ff7b35';for(var i=0;i<5;i++)ctx.fillRect(k.x-43+i*19,k.y-38,10,4);
    }else if(k.id==='industry'){
      ctx.fillStyle='#0a1014';ctx.fillRect(k.x-51,k.y-35,102,70);ctx.fillStyle='#343a34';ctx.fillRect(k.x-45,k.y-29,90,58);ctx.fillStyle='#4b170f';ctx.fillRect(k.x-29,k.y-94,19,66);ctx.fillRect(k.x+12,k.y-116,23,88);ctx.fillStyle='#ff7b35';ctx.fillRect(k.x-31,k.y-97,23,7);ctx.fillRect(k.x+10,k.y-119,27,7);ctx.globalAlpha=.25;ctx.fillStyle='#88918d';ctx.fillRect(k.x+15+Math.sin(t)*3,k.y-143,18,18);ctx.globalAlpha=1;
    }else{
      ctx.fillStyle='#0a1014';ctx.fillRect(k.x-54,k.y-39,108,78);ctx.fillStyle='#312e40';ctx.fillRect(k.x-47,k.y-32,94,64);ctx.fillStyle='#171722';ctx.fillRect(k.x-27,k.y-19,54,44);ctx.fillStyle='#786b91';ctx.fillRect(k.x-49,k.y-35,23,7);ctx.fillRect(k.x+16,k.y+24,31,7);
    }
  }
  function districtMarkings(ctx,v){
    ctx.font='bold 24px Consolas,monospace';ctx.textAlign='center';for(var i=0;i<DISTRICTS.length;i++){var d=DISTRICTS[i],m=d.marking;if(!m||Math.abs(m.x-v.x)>v.w/2+240||Math.abs(m.y-v.y)>v.h/2+80)continue;ctx.fillStyle='#071014aa';ctx.fillText(m.label,m.x+2,m.y+42);ctx.fillStyle=d.color+'88';ctx.fillText(m.label,m.x,m.y+40);}
  }
  // Territory cells: the 36 grid cells to road centre lines, each with its authored owner and block id.
  var districtCellCache=null;
  function districtCells(){
    if(districtCellCache)return districtCellCache;
    var cells=[];
    for(var row=0;row<6;row++)for(var col=0;col<6;col++)cells.push({x:GRID[col],y:GRID[row],w:GRID[col+1]-GRID[col],h:GRID[row+1]-GRID[row],col:col,row:row,blockId:'block-'+col+'-'+row,district:blockOwner(col,row)});
    return districtCellCache=cells;
  }
  // a district's map label point: the centre of its territory (Quarantine's sits north of the disposal yard)
  function territoryLabel(d){
    if(d.id==='quarantine')return {x:0,y:-1000};
    var cs=districtCells().filter(function(q){return q.district===d;}),a=0,x=0,y=0;
    cs.forEach(function(q){var s=q.w*q.h;a+=s;x+=(q.x+q.w/2)*s;y+=(q.y+q.h/2)*s;});return {x:x/a,y:y/a};
  }
  // legacy flat ground, used until the tiles art family is registered (chunks.js takes over then)
  function drawGround(ctx,s,v){
    v=v||{x:0,y:0,w:740,h:420};var l=v.x-v.w/2,t=v.y-v.h/2,r=v.x+v.w/2,b=v.y+v.h/2,step=64;
    ctx.save();ctx.imageSmoothingEnabled=false;for(var x=Math.floor(l/step)*step;x<r;x+=step)for(var y=Math.floor(t/step)*step;y<b;y+=step){var d=district(x+32,y+32);tile(ctx,x,y,d,onRoad(x+32,y+32));}
    ctx.fillStyle='#0a101488';for(var ai=0;ai<AXES.length;ai++){var a=AXES[ai];if(a>l&&a<r){ctx.fillRect(a-ROAD/2,t,5,v.h);ctx.fillRect(a+ROAD/2-5,t,5,v.h);}if(a>t&&a<b){ctx.fillRect(l,a-ROAD/2,v.w,5);ctx.fillRect(l,a+ROAD/2-5,v.w,5);}}
    ctx.fillStyle='#9a743d88';for(ai=0;ai<AXES.length;ai++){a=AXES[ai];for(var z=Math.floor(t/58)*58;z<b;z+=58)if(a>l&&a<r)ctx.fillRect(a-2,z,4,29);for(z=Math.floor(l/58)*58;z<r;z+=58)if(a>t&&a<b)ctx.fillRect(z,a-2,29,4);}
    ctx.restore();
  }
  // everything standing on the ground: roofs, wrecks, lamps, district names, landmarks
  function drawObjects(ctx,s,v){
    v=v||{x:0,y:0,w:740,h:420};var l=v.x-v.w/2,t=v.y-v.h/2,r=v.x+v.w/2,b=v.y+v.h/2,ai,a,z;
    ctx.save();ctx.imageSmoothingEnabled=false;
    var obs=visible(s.world,v);for(var i=0;i<obs.length;i++){var o=obs[i];if(o.type==='building')roof(ctx,o);else wreck(ctx,o);}
    for(ai=0;ai<AXES.length;ai++){a=AXES[ai];for(z=-3200;z<=3200;z+=420){if(a>l-30&&a<r+30&&z>t-30&&z<b+30){var ld=district(a,z);root.DSArt.glow(ctx,a,z-9,40,ld.color,'18');ctx.fillStyle='#69777a';ctx.fillRect(a-3,z-4,6,8);ctx.fillStyle=ld.color;ctx.fillRect(a-3,z-11,6,5);}if(z>l-30&&z<r+30&&a>t-30&&a<b+30){ld=district(z,a);root.DSArt.glow(ctx,z,a-9,40,ld.color,'18');ctx.fillStyle='#69777a';ctx.fillRect(z-3,a-4,6,8);ctx.fillStyle=ld.color;ctx.fillRect(z-3,a-11,6,5);}}}
    districtMarkings(ctx,v);(s.world.landmarks||[]).forEach(function(k){if(k.x>l-150&&k.x<r+150&&k.y>t-170&&k.y<b+150)landmark(ctx,k,s);});ctx.restore();
  }
  function mapView(s,local=false){
    if(!local)return {x:0,y:0,span:7200};
    const living=s.players.filter(p=>!p.dead),group=living.length?living:s.players;
    return {x:group.length?group.reduce((n,p)=>n+p.x,0)/group.length:s.camera.x,y:group.length?group.reduce((n,p)=>n+p.y,0)/group.length:s.camera.y,span:1400};
  }
  // ---- requisition map (CITY.md Phase 7) ----
  // Supply glyphs: a distinct shape per loot profile so the key never depends on colour alone.
  function mapGlyph(ctx,glyph,cx,cy,r,col,state){
    const dim=state==='cleared'||state==='empty',c=dim?'#5b6468':col,f=state==='unvisited'?'#081014':c;
    ctx.fillStyle='#081014';ctx.fillRect(cx-r-2,cy-r-2,2*r+4,2*r+4);
    ctx.strokeStyle=c;ctx.fillStyle=f;ctx.lineWidth=1;
    const box=(a,b,ww,hh)=>{ctx.fillRect(cx+a,cy+b,ww,hh);ctx.strokeRect(cx+a+.5,cy+b+.5,ww-1,hh-1);};
    if(glyph==='cross'){box(-r*.3,-r,r*.6,2*r);box(-r,-r*.3,2*r,r*.6);}
    else if(glyph==='rounds'){for(let i=-1;i<=1;i++)box(i*r*.62-r*.22,-r*.8,r*.44,r*1.6);}
    else if(glyph==='crate'){box(-r,-r*.7,2*r,r*1.4);ctx.beginPath();ctx.moveTo(cx-r,cy-r*.7);ctx.lineTo(cx+r,cy+r*.7);ctx.stroke();}
    else if(glyph==='tin'){ctx.beginPath();ctx.ellipse?ctx.ellipse(cx,cy,r*.8,r,0,0,Math.PI*2):ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();ctx.stroke();}
    else if(glyph==='flame'){ctx.beginPath();ctx.moveTo(cx,cy-r);ctx.lineTo(cx+r*.8,cy+r);ctx.lineTo(cx-r*.8,cy+r);ctx.closePath();ctx.fill();ctx.stroke();}
    else if(glyph==='jerrycan'){box(-r*.8,-r*.6,r*1.6,r*1.6);box(-r*.3,-r,r*.6,r*.5);}
    else if(glyph==='bedroll'){box(-r,-r*.4,2*r,r*.8);}
    else if(glyph==='toolbox'){box(-r,-r*.2,2*r,r*1.2);box(-r*.4,-r*.8,r*.8,r*.6);}
    else if(glyph==='paper'){box(-r*.7,-r,r*1.4,2*r);}
    else{ctx.beginPath();ctx.arc(cx,cy,r*.6,0,Math.PI*2);ctx.fill();ctx.stroke();}
    if(state==='cleared'){ctx.strokeStyle='#d8dbc8';ctx.beginPath();ctx.moveTo(cx-r-1,cy+r+1);ctx.lineTo(cx+r+1,cy-r-1);ctx.stroke();}
  }
  // What the map shows for a location this run: hidden until discovered; then unvisited, visited,
  // cleared (every authored supply taken) or empty (visited, never held supplies).
  function mapState(s,l){
    const st=s.locationState&&s.locationState[l.id];if(!st)return l.discoveryRule==='known'?'unvisited':null;
    if(!st.discovered)return null;if(st.cleared)return 'cleared';if(!st.visited)return 'unvisited';
    return st.hadSupplies===false?'empty':'visited';
  }
  // The fire department's apparatus: the fixed slot is always drawn as an outline; the truck icon sits
  // wherever the live truck is, marked when its tank is dry or it is wrecked. No replacement is shown.
  function fireTruckMarks(s){
    const slot=(s.world.vehicleSlots||[]).find(v=>v.vehicleType==='fireTruck');if(!slot)return null;
    const live=(s.vehicles||[]).find(v=>v.vehicleType==='fireTruck'),parked=(s.world.obstacles||[]).find(o=>o.vehicleType==='fireTruck');
    let truck=null;
    if(live&&!live.removed)truck={x:live.x,y:live.y,empty:live.fuel<=0,wrecked:!!live.dead};
    else if(!live&&parked)truck={x:parked.x+parked.w/2,y:parked.y+parked.h/2,empty:false,wrecked:parked.hp!==undefined&&parked.hp<=0};
    const inSlot=truck&&Math.abs(truck.x-(slot.rect.x+slot.rect.w/2))<40&&Math.abs(truck.y-(slot.rect.y+slot.rect.h/2))<60;
    return {slot,truck,moved:!!truck&&!inSlot};
  }
  // The city map (city_v2 Section 1), in a fixed layer order: 1 opaque territory to road centre lines, 2 roads in
  // each district's darker road value with curbs and dashed territory boundaries, 3 footprints in owner hues and
  // lot patterns, 4 compounds, gate states and the hatched disposal yard, 5 district and place labels, 6 supply
  // glyphs on neutral badges, 7 vehicles, annotations, infected, noise and players. Nothing here reads the lighting.
  function drawMapRevamp(ctx,s,x,y,w,h,view=mapView(s)){
    const sx=w/view.span,sy=h/view.span,left=view.x-view.span/2,top=view.y-view.span/2,local=view.span<7200;
    const px=v=>x+(v-left)*sx,py=v=>y+(v-top)*sy,inside=(mx,my,pad=0)=>mx>x-pad&&mx<x+w+pad&&my>y-pad&&my<y+h+pad;
    // whole-pixel rects, so adjacent territory cells tile with no seams or overlaps
    const rect=(rx,ry,rw,rh)=>{const x0=Math.round(px(rx)),y0=Math.round(py(ry)),x1=Math.round(px(rx+rw)),y1=Math.round(py(ry+rh));return [x0,y0,Math.max(1,x1-x0),Math.max(1,y1-y0)];};
    const fill=(r,col)=>{ctx.fillStyle=col;ctx.fillRect(r[0],r[1],r[2],r[3]);};
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.fillStyle='#10171c';ctx.fillRect(x,y,w,h);
    const cells=districtCells(),palAt=(mx,my)=>district(mx,my).mapPalette;
    // 1. territory
    for(const q of cells)fill(rect(q.x,q.y,q.w,q.h),q.district.mapPalette.fill);
    // 2. roads: each half-road in its own district's road value, curb lines, then boundaries along the centre line
    for(const q of cells)for(const r of s.world.roads||[]){const ix0=Math.max(q.x,r.x),iy0=Math.max(q.y,r.y),ix1=Math.min(q.x+q.w,r.x+r.w),iy1=Math.min(q.y+q.h,r.y+r.h);if(ix1>ix0&&iy1>iy0)fill(rect(ix0,iy0,ix1-ix0,iy1-iy0),q.district.mapPalette.road);}
    if(sx*ROAD>=5){ctx.fillStyle='#0a0f1299';for(const a of AXES){const e0=px(a-ROAD/2),e1=px(a+ROAD/2),f0=py(a-ROAD/2),f1=py(a+ROAD/2);ctx.fillRect(Math.round(e0),y,1,h);ctx.fillRect(Math.round(e1)-1,y,1,h);ctx.fillRect(x,Math.round(f0),w,1);ctx.fillRect(x,Math.round(f1)-1,w,1);}
      for(const q of cells)for(const a of AXES)for(const b of AXES){const ix0=Math.max(q.x,a-ROAD/2),iy0=Math.max(q.y,b-ROAD/2),ix1=Math.min(q.x+q.w,a+ROAD/2),iy1=Math.min(q.y+q.h,b+ROAD/2);if(ix1>ix0&&iy1>iy0)fill(rect(ix0,iy0,ix1-ix0,iy1-iy0),q.district.mapPalette.road);}}
    ctx.save();ctx.setLineDash&&ctx.setLineDash(local?[6,4]:[4,3]);ctx.strokeStyle='#f1ead8b0';ctx.lineWidth=1;
    for(const q of cells){const right=cells.find(o=>o.col===q.col+1&&o.row===q.row),below=cells.find(o=>o.col===q.col&&o.row===q.row+1);
      if(right&&right.district!==q.district){const lx=Math.round(px(q.x+q.w))+.5;ctx.beginPath();ctx.moveTo(lx,py(q.y));ctx.lineTo(lx,py(q.y+q.h));ctx.stroke();}
      if(below&&below.district!==q.district){const ly=Math.round(py(q.y+q.h))+.5;ctx.beginPath();ctx.moveTo(px(q.x),ly);ctx.lineTo(px(q.x+q.w),ly);ctx.stroke();}}
    ctx.restore();
    // 3. lots keep the territory colour and show their use as a restrained pattern in the owner's dark value
    const step=local?7:Math.max(4,Math.round(w/110));
    for(const l of s.world.lots||[]){const R=rect(l.rect.x,l.rect.y,l.rect.w,l.rect.h),pal=palAt(l.rect.x+l.rect.w/2,l.rect.y+l.rect.h/2);if(l.kind==='burnYard')continue;
      fill(R,pal.fill);
      ctx.save();ctx.beginPath();ctx.rect(R[0],R[1],R[2],R[3]);ctx.clip();ctx.fillStyle=pal.dark;ctx.strokeStyle=pal.dark;ctx.lineWidth=1;
      if(l.kind==='park'){for(let yy=R[1]+2;yy<R[1]+R[3];yy+=step)for(let xx=R[0]+2+((yy/step|0)%2)*step/2;xx<R[0]+R[2];xx+=step)ctx.fillRect(xx,yy,2,2);}
      else if(l.kind==='parkingLot'){for(let xx=R[0]+step;xx<R[0]+R[2];xx+=step)ctx.fillRect(xx,R[1]+2,1,Math.max(2,R[3]*.35));}
      else if(l.kind==='graveyard'){for(let yy=R[1]+step/2;yy<R[1]+R[3];yy+=step)for(let xx=R[0]+step/2;xx<R[0]+R[2];xx+=step){ctx.fillRect(xx,yy-1,1,3);ctx.fillRect(xx-1,yy,3,1);}}
      else{const gap=step*(l.kind==='machineryYard'?1:1.6);for(let d=-R[3];d<R[2];d+=gap){ctx.beginPath();ctx.moveTo(R[0]+d,R[1]+R[3]);ctx.lineTo(R[0]+d+R[3],R[1]);ctx.stroke();}}
      ctx.restore();ctx.strokeStyle=pal.dark;ctx.strokeRect(R[0]+.5,R[1]+.5,R[2]-1,R[3]-1);}
    for(const o of s.world.obstacles||[])if(o.type==='building')fill(rect(o.x,o.y,o.w,o.h),palAt(o.x+o.w/2,o.y+o.h/2).dark);
    for(const b of s.world.buildings||[]){const R=rect(b.x,b.y,b.w,b.h),pal=palAt(b.x+b.w/2,b.y+b.h/2);fill(R,pal.dark);if(R[2]>2&&R[3]>2)fill([R[0]+1,R[1]+1,R[2]-2,R[3]-2],pal.light);}
    for(const o of s.world.obstacles||[])if(o.debris==='optional-clear'){const R=rect(o.x,o.y,o.w,o.h);fill([R[0],R[1],Math.max(2,R[2]),Math.max(2,R[3])],'#2a1d14');}
    // 4. compounds, entrances, gate states and the disposal yard as a hazard overlay inside the quarantine colour
    const locs=s.world.locations||[],byId=new Map(locs.map(l=>[l.id,l]));
    for(const b of s.world.buildings||[]){const l=byId.get(b.locationId);if(!l||!local||!mapState(s,l))continue;
      for(const d of b.exteriorDoors){const R=rect(d.rect.x,d.rect.y,d.rect.w,d.rect.h);fill([R[0],R[1],Math.max(2,R[2]),Math.max(2,R[3])],'#f1ead8');}}
    if(local)for(const l of s.world.lots||[])for(const e of l.entrances){const R=rect(e.rect.x,e.rect.y,e.rect.w,e.rect.h);fill([R[0],R[1],Math.max(2,R[2]),Math.max(2,R[3])],'#dfe6e3');}
    ctx.save();ctx.setLineDash&&ctx.setLineDash([3,3]);
    for(const l of locs)if(l.story&&l.id!=='patient-furnace'){const R=rect(l.rect.x,l.rect.y,l.rect.w,l.rect.h);ctx.strokeStyle='#0a0f12cc';ctx.strokeRect(R[0]+.5,R[1]+.5,R[2],R[3]);}
    ctx.restore();
    {const A=rect(-370,-370,740,740);ctx.save();ctx.beginPath();ctx.rect(A[0],A[1],A[2],A[3]);ctx.clip();ctx.fillStyle='#3a1618';ctx.fillRect(A[0],A[1],A[2],A[3]);
      ctx.strokeStyle='#ff5a47';ctx.globalAlpha=.45;const hs=local?8:4;for(let d=-A[3];d<A[2];d+=hs){ctx.beginPath();ctx.moveTo(A[0]+d,A[1]+A[3]);ctx.lineTo(A[0]+d+A[3],A[1]);ctx.stroke();}ctx.restore();
      ctx.strokeStyle='#ff5a47';ctx.lineWidth=local?2:1;ctx.strokeRect(A[0]+.5,A[1]+.5,A[2]-1,A[3]-1);ctx.lineWidth=1;
      for(const g of s.world.arenaGates||[]){const open=!!(s.gates&&s.gates[g.id]&&s.gates[g.id].open),R=rect(g.rect.x,g.rect.y,g.rect.w,g.rect.h);fill([R[0]-1,R[1]-1,Math.max(3,R[2]+2),Math.max(3,R[3]+2)],open?'#79e2cf':'#ffd249');}}
    // 5. labels: district names over their territory and landmark names, each on a dark backing
    const tag=(label,lx,ly,col,size,align)=>{ctx.font='bold '+size+'px Consolas,monospace';ctx.textBaseline='middle';const tw=ctx.measureText?ctx.measureText(label).width:label.length*size*.6;
      let tx=align==='center'?lx-tw/2:lx;tx=Math.max(x+3,Math.min(x+w-tw-3,tx));ctx.fillStyle='#0a0f12c8';ctx.fillRect(Math.round(tx-3),Math.round(ly-size*.7),Math.round(tw+6),Math.round(size*1.4));ctx.textAlign='left';ctx.fillStyle=col;ctx.fillText(label,Math.round(tx),Math.round(ly));return {x:tx,w:tw};};
    if(!local&&h>=160){const size=Math.max(8,Math.min(15,Math.round(w/44)));for(const d of DISTRICTS){const p=territoryLabel(d);tag(d.mapLabel,px(p.x),py(p.y),d.mapPalette.label,size,'center');}}
    // 6. supply icons: one per discovered location with a profile, on a neutral dark badge (mapGlyph)
    const r=local?5:Math.max(4,Math.round(w/150)),P=root.DSCity.LOOT_PROFILES;
    for(const l of locs){
      if(l.story||!l.mapIcon)continue;const state=mapState(s,l);if(!state)continue;
      const cx=px(l.rect.x+l.rect.w/2),cy=py(l.rect.y+l.rect.h/2);if(!inside(cx,cy,r))continue;
      const prof=P[l.mapIcon]||{glyph:'dot',color:'#8a9a94'};mapGlyph(ctx,prof.glyph,cx,cy,l.required?r:Math.max(2,r-2),prof.color,state);
      if(l.required&&l.lootProfiles.length>1){const p2=P[l.lootProfiles[1]];if(p2)mapGlyph(ctx,p2.glyph,cx+r*1.9,cy+r*.9,Math.max(2,r-2),p2.color,state);}
    }
    // 7. the fire truck's slot and the truck, other live vehicles, campaign annotations, landmarks, infected, noise, players
    const ft=fireTruckMarks(s);
    if(ft){const q=ft.slot.rect;ctx.strokeStyle='#081014';ctx.strokeRect(px(q.x)-.5,py(q.y)-.5,Math.max(3,q.w*sx)+2,Math.max(3,q.h*sy)+2);ctx.strokeStyle='#ff8291';ctx.strokeRect(px(q.x)+.5,py(q.y)+.5,Math.max(3,q.w*sx),Math.max(3,q.h*sy));
      if(ft.truck){const tx=px(ft.truck.x),ty=py(ft.truck.y);ctx.fillStyle='#081014';ctx.fillRect(tx-4,ty-3,9,7);ctx.fillStyle=ft.truck.wrecked?'#5b6468':'#ff543b';ctx.fillRect(tx-3,ty-2,7,5);
        if(ft.truck.empty){ctx.fillStyle='#ffd249';ctx.fillRect(tx+4,ty-4,2,2);}if(ft.truck.wrecked){ctx.strokeStyle='#d8dbc8';ctx.beginPath();ctx.moveTo(tx-4,ty+3);ctx.lineTo(tx+5,ty-4);ctx.stroke();}}}
    for(const v of s.vehicles||[]){if(v.vehicleType==='fireTruck'||v.removed||v.driver==null)continue;const vx=px(v.x),vy=py(v.y);if(!inside(vx,vy))continue;ctx.fillStyle='#081014';ctx.fillRect(vx-4,vy-4,8,8);ctx.fillStyle=v.vehicleType==='bulldozer'?'#ffd249':'#f1ead8';ctx.fillRect(vx-2.5,vy-2.5,5,5);}
    // campaign annotations: a place the squad has learned it still needs gets a dashed ring (no route drawn)
    const camp=s.campaign;if(camp){const pending={chapel:!s.circuit?.emergency,'machine-shop':!s.circuit?.emergency,'fuel-store':!s.circuit?.emergency,'st-orison':!Object.values(camp.evidence||{}).some(Boolean),'patient-furnace':!camp.bossDown,'inner-arena':!camp.bossDown,'command-post':!(camp.payload&&camp.override),'holding-building':!camp.bossDown,'blackglass-radio':!camp.transmitted,'checkpoint-nine':!camp.escaped};
      ctx.save();ctx.setLineDash&&ctx.setLineDash([2,3]);for(const id of camp.known||[]){if(!pending[id])continue;const l=byId.get(id);if(!l)continue;const cx=px(l.rect.x+l.rect.w/2),cy=py(l.rect.y+l.rect.h/2);if(!inside(cx,cy,12))continue;
        ctx.strokeStyle='#081014';ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,local?12:9,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#ffd249';ctx.lineWidth=1;ctx.stroke();}ctx.restore();}
    for(const l of s.world.landmarks||[]){
      const mx=px(l.x),my=py(l.y);if(!inside(mx,my))continue;
      ctx.fillStyle='#081014';ctx.beginPath();ctx.moveTo(mx,my-8);ctx.lineTo(mx+8,my);ctx.lineTo(mx,my+8);ctx.lineTo(mx-8,my);ctx.closePath();ctx.fill();
      ctx.fillStyle=l.color;ctx.beginPath();ctx.moveTo(mx,my-5);ctx.lineTo(mx+5,my);ctx.lineTo(mx,my+5);ctx.lineTo(mx-5,my);ctx.closePath();ctx.fill();
      if(!local&&h>=250){const label=l.name.toUpperCase(),size=9;ctx.font='bold '+size+'px Consolas,monospace';const tw=ctx.measureText?ctx.measureText(label).width:72;tag(label,mx+10+tw>x+w-3?mx-10-tw:mx+10,my,'#f1ead8',size,'left');}
    }
    // The outer ring is the actual hearing radius; the inner ripple shows the event fading.
    for(const n of s.noise||[]){
      ctx.save();ctx.globalAlpha=Math.max(0,n.life/n.maxLife);ctx.fillStyle='#ffb86618';ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(px(n.x),py(n.y),n.r*sx,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#081014';ctx.lineWidth=3;ctx.stroke();ctx.strokeStyle='#ffb866';ctx.lineWidth=1;ctx.stroke();
      ctx.beginPath();ctx.arc(px(n.x),py(n.y),n.r*sx*(1-n.life/n.maxLife),0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    // only infected that are alert or currently in someone's light show up; the dark hides the rest (e.lit is set by lights.js)
    if(local)for(const e of s.enemies||[]){if(e.dead||!(e.alert||(e.lit||0)>.25))continue;ctx.fillStyle='#081014';ctx.fillRect(px(e.x)-2.5,py(e.y)-2.5,5,5);ctx.fillStyle=e.alert?'#ff3b2f':'#e6ecea';ctx.fillRect(px(e.x)-1.5,py(e.y)-1.5,3,3);}
    for(const p of s.players||[]){ctx.fillStyle='#081014';ctx.fillRect(px(p.x)-4,py(p.y)-4,8,8);ctx.fillStyle=p.dead?'#ff5a47':p.color||'#fff';ctx.fillRect(px(p.x)-2.5,py(p.y)-2.5,5,5);}
    ctx.restore();
  }
  // the requisition key beside the full map: every supply glyph, the four states, landmarks and the truck
  function drawMapLegend(ctx,x,y,w,scale){
    // every row centres its icon and label on the same line; the baseline is set here because callers leave it at 'top'
    const k=scale||1,P=root.DSCity.LOOT_PROFILES,ix=x+6*k,lx=x+18*k;let yy=y;
    ctx.save();ctx.textAlign='left';ctx.textBaseline='middle';
    const head=(t,size,gap)=>{ctx.font='bold '+Math.round(size*k)+'px Consolas,monospace';ctx.fillStyle='#d8dbc8';ctx.fillText(t,x,yy+5*k);yy+=gap*k;};
    const label=(t,cy)=>{ctx.font=Math.round(8*k)+'px Consolas,monospace';ctx.fillStyle='#a8b9b8';ctx.fillText(t,lx,cy);};
    head('DISTRICTS',9,18);
    for(const d of DISTRICTS){const cy=yy+5*k;ctx.fillStyle='#081014';ctx.fillRect(ix-6*k,cy-5*k,12*k,10*k);ctx.fillStyle=d.mapPalette.fill;ctx.fillRect(ix-5*k,cy-4*k,10*k,8*k);ctx.font='bold '+Math.round(8*k)+'px Consolas,monospace';ctx.fillStyle='#e2e7d7';ctx.fillText(d.mapLabel,lx,cy);yy+=14*k;}
    yy+=6*k;head('REQUISITION KEY',9,18);
    for(const id of Object.keys(P)){const cy=yy+5*k;mapGlyph(ctx,P[id].glyph,ix,cy,4*k,P[id].color,'visited');label(P[id].label,cy);yy+=15*k;}
    yy+=6*k;head('STATE',8,14);
    for(const [st,t] of [['unvisited','KNOWN · NOT VISITED'],['visited','VISITED · SUPPLIES LEFT'],['cleared','CLEARED'],['empty','VISITED · NOTHING FOUND']]){const cy=yy+5*k;mapGlyph(ctx,'crate',ix,cy,4*k,'#edc37c',st);label(t,cy);yy+=15*k;}
    yy+=6*k;let cy=yy+5*k;ctx.fillStyle='#ffd249';ctx.beginPath();ctx.moveTo(ix,cy-5*k);ctx.lineTo(ix+5*k,cy);ctx.lineTo(ix,cy+5*k);ctx.lineTo(ix-5*k,cy);ctx.closePath();ctx.fill();label('STORY LANDMARK',cy);yy+=15*k;
    cy=yy+5*k;ctx.strokeStyle='#ff8291';ctx.lineWidth=1;ctx.strokeRect(ix-4*k,cy-4*k,8*k,8*k);ctx.fillStyle='#ff543b';ctx.fillRect(ix-2*k,cy-2*k,4*k,4*k);label('FIRE TRUCK · BAY',cy);yy+=15*k;
    ctx.restore();
    return yy-y;
  }
  root.DSWorld={create:create,surfaceAt:surfaceAt,locationById:locationById,doorFamily:doorFamily,mapState:mapState,mapGlyph:mapGlyph,drawMapLegend:drawMapLegend,fireTruckMarks:fireTruckMarks,district:district,blocked:blocked,queryObstacles:queryObstacles,move:move,removeObstacle:removeObstacle,drawGround:drawGround,drawObjects:drawObjects,drawMap:drawMapRevamp,mapView:mapView,visible:visible,visibleProps:visibleProps,legacy:{roof:roof,wreck:wreck,landmark:landmark,districtMarkings:districtMarkings},hash:hash,mix:mix,THEME:THEME,DISTRICTS:DISTRICTS,districtById:function(id){return DISTRICT_BY_ID[id]||null;},districtCells:districtCells,blockOwner:blockOwner,gridIndex:gridIndex,GRID:GRID,BLOCK_OWNERS:BLOCK_OWNERS,territoryLabel:territoryLabel,AXES:AXES,ROAD:ROAD,MIN:MIN,MAX:MAX};
})(typeof window!=='undefined'?window:globalThis);
