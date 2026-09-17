(function (root) {
  'use strict';
  // City semantics (CITY.md data contract). world.js owns districts and geometry; this file owns
  // what a place *is*: building archetypes, open-lot kinds, loot profiles and the named places
  // every run must contain. Nothing here reads the run seed.

  // Loot profiles describe the category of supply a place offers; exact finds are rolled per run.
  var LOOT_PROFILES={
    medical:{label:'MEDICAL',color:'#79e2cf',glyph:'cross'},
    munitions:{label:'MUNITIONS',color:'#edc37c',glyph:'rounds'},
    weapons:{label:'WEAPONS',color:'#ff8c5a',glyph:'crate'},
    provisions:{label:'PROVISIONS',color:'#b8d86b',glyph:'tin'},
    incendiary:{label:'INCENDIARY',color:'#ff7b35',glyph:'flame'},
    vehicleFuel:{label:'VEHICLE FUEL',color:'#ffd249',glyph:'jerrycan'},
    refuge:{label:'REFUGE',color:'#b5a2ff',glyph:'bedroll'},
    utility:{label:'UTILITY',color:'#a8b9b8',glyph:'toolbox'},
    evidence:{label:'EVIDENCE',color:'#d8dbc8',glyph:'paper'},
    mixed:{label:'MIXED',color:'#8a9a94',glyph:'dot'}
  };
  // Enterable structures. `styles` are visual shells; two styles may share one archetype's loot.
  // size: [minW,minH,maxW,maxH]; shell: oneRoom|multiRoom; door/sign: art families (Phase 8).
  var ARCHETYPES={
    home:{label:'Home',size:[200,170,320,260],shell:'oneRoom',template:'home',door:'residential',sign:null,profiles:['mixed'],icon:'mixed',placement:'fabric',styles:['row','shack','terrace']},
    shop:{label:'Shop',size:[200,170,320,260],shell:'oneRoom',template:'shop',door:'residential',sign:'shop',profiles:['utility','mixed'],icon:'utility',placement:'fabric',styles:['shop']},
    supermarket:{label:'Supermarket',size:[560,380,640,460],shell:'multiRoom',template:'supermarket',door:'glassDouble',sign:'market',profiles:['provisions'],icon:'provisions',placement:'anchor',styles:['market']},
    pharmacy:{label:'Pharmacy',size:[260,200,320,260],shell:'multiRoom',template:'pharmacy',door:'glassDouble',sign:'pharmacy',profiles:['medical'],icon:'medical',placement:'required',styles:['clinic']},
    clinic:{label:'Clinic',size:[200,170,320,260],shell:'oneRoom',template:'clinic',door:'hospitalPublic',sign:'clinic',profiles:['medical'],icon:'medical',placement:'fabric',styles:['clinic']},
    hospital:{label:'Hospital',size:[700,460,860,560],shell:'multiRoom',template:'hospital',door:'hospitalPublic',sign:'hospital',profiles:['medical','evidence'],icon:'medical',placement:'anchor',styles:['hospital']},
    police:{label:'Police station',size:[380,300,460,360],shell:'multiRoom',template:'police',door:'policeBars',sign:'police',profiles:['munitions','weapons'],icon:'munitions',placement:'required',styles:['civic']},
    fireStation:{label:'Fire station',size:[440,320,520,380],shell:'multiRoom',template:'fireStation',door:'fireRoller',sign:'fire',profiles:['medical','vehicleFuel'],icon:'vehicleFuel',placement:'required',styles:['civic']},
    radioStation:{label:'Broadcast station',size:[380,260,460,320],shell:'multiRoom',template:'radioStation',door:'military',sign:'radio',profiles:['evidence','utility'],icon:'evidence',placement:'anchor',styles:['civic']},
    machineShop:{label:'Machine shop',size:[480,340,560,400],shell:'multiRoom',template:'machineShop',door:'warehouseLoading',sign:'machineShop',profiles:['incendiary','vehicleFuel'],icon:'vehicleFuel',placement:'anchor',styles:['industrial']},
    warehouse:{label:'Warehouse',size:[420,300,520,380],shell:'multiRoom',template:'warehouse',door:'warehouseLoading',sign:'warehouse',profiles:['utility'],icon:'utility',placement:'required',styles:['industrial']},
    chapel:{label:'Chapel',size:[300,380,340,440],shell:'multiRoom',template:'chapel',door:'chapel',sign:'chapel',profiles:['refuge'],icon:'refuge',placement:'anchor',styles:['chapel']},
    morgue:{label:'Morgue',size:[220,200,320,240],shell:'multiRoom',template:'morgue',door:'hospitalService',sign:'morgue',profiles:['evidence'],icon:'evidence',placement:'required',styles:['clinic']},
    depot:{label:'Municipal depot',size:[360,260,440,320],shell:'multiRoom',template:'depot',door:'warehouseLoading',sign:'depot',profiles:['utility','vehicleFuel'],icon:'utility',placement:'required',styles:['industrial']},
    holding:{label:'Holding block',size:[260,200,300,240],shell:'multiRoom',template:'holding',door:'military',sign:'holding',profiles:['evidence','medical'],icon:'evidence',placement:'required',styles:['military']},
    armoury:{label:'Armoury',size:[200,180,240,220],shell:'multiRoom',template:'armoury',door:'military',sign:'armoury',profiles:['munitions','weapons'],icon:'munitions',placement:'required',styles:['military']},
    // city_v2 Section 3 ordinary fabric: Ashworks' workshops, sheds and dispatch offices replace its home/shop default;
    // Central Quarantine's support blocks are requisitioned offices and staging depots over the old civilian frontage
    workshop:{label:'Workshop',size:[200,170,320,260],shell:'oneRoom',template:'workshop',door:'service',sign:null,profiles:['utility','incendiary'],icon:'utility',placement:'fabric',styles:['industrial']},
    storageShed:{label:'Storage shed',size:[200,170,320,260],shell:'oneRoom',template:'storageShed',door:'service',sign:null,profiles:['utility','vehicleFuel'],icon:'utility',placement:'fabric',styles:['shack']},
    dispatchOffice:{label:'Dispatch office',size:[200,170,320,260],shell:'oneRoom',template:'dispatchOffice',door:'residential',sign:null,profiles:['utility','mixed'],icon:'utility',placement:'fabric',styles:['civic']},
    requisitionOffice:{label:'Requisitioned office',size:[200,170,320,260],shell:'oneRoom',template:'requisitionOffice',door:'military',sign:null,profiles:['evidence','mixed'],icon:'evidence',placement:'fabric',styles:['military']},
    stagingDepot:{label:'Staging depot',size:[200,170,320,260],shell:'oneRoom',template:'stagingDepot',door:'service',sign:null,profiles:['utility','mixed'],icon:'utility',placement:'fabric',styles:['industrial']},
    commandPost:{label:'Command post',size:[200,180,260,240],shell:'multiRoom',template:'commandPost',door:'military',sign:'command',profiles:['evidence'],icon:'evidence',placement:'required',styles:['military']}
  };
  // Roofless places. perimeter: fence|hedge|wall|kerb; surface drives footsteps (Phase 12A).
  var LOT_KINDS={
    park:{label:'Park',perimeter:'hedge',surface:'grass',profiles:['evidence'],icon:'evidence'},
    parkingLot:{label:'Parking lot',perimeter:'kerb',surface:'asphalt',profiles:['vehicleFuel'],icon:'vehicleFuel'},
    graveyard:{label:'Graveyard',perimeter:'wall',surface:'grass',profiles:['evidence'],icon:'evidence'}, // city_v2: lawn between the graves, a baked gravel path down its lane
    serviceYard:{label:'Service yard',perimeter:'fence',surface:'concrete',profiles:['utility'],icon:'utility'},
    demolitionLot:{label:'Demolition lot',perimeter:'hoarding',surface:'gravel',profiles:['utility'],icon:'utility'},
    machineryYard:{label:'Machinery yard',perimeter:'fence',surface:'gravel',profiles:['vehicleFuel','utility'],icon:'vehicleFuel'},
    compoundYard:{label:'Works compound',perimeter:'fence',surface:'gravel',profiles:[],icon:null},
    courtyard:{label:'Courtyard',perimeter:'kerb',surface:'concrete',profiles:[],icon:null},
    burnYard:{label:'Disposal yard',perimeter:'fence',surface:'concrete',profiles:[],icon:null}
  };
  // Every required place from DISTRICTS[].required. kind: landmark (story compound), building, lot.
  // `archetype`/`lot` name the primary structure; `compound` names the parent location, if any.
  // discovery: known = on the map from the start (signed civic places); visit = appears once visited.
  var PLACES={
    'checkpoint-nine':{name:'Checkpoint Nine',kind:'landmark',story:true,profiles:[],discovery:'known'},
    'crossroads-supermarket':{name:'Crossroads Market',kind:'building',archetype:'supermarket',discovery:'known'},
    'police-station':{name:'South Blocks Police',kind:'building',archetype:'police',discovery:'known'},
    'market-parking':{name:'Market Parking',kind:'lot',lot:'parkingLot',compound:'crossroads-supermarket',discovery:'known'},
    'residential-park':{name:'Linden Park',kind:'lot',lot:'park',discovery:'known'},
    'collapsed-quarter':{name:'The Collapsed Quarter',kind:'landmark',story:true,profiles:['utility'],discovery:'known'},
    'graveyard':{name:'St. Aubin Graveyard',kind:'lot',lot:'graveyard',discovery:'known'},
    'chapel':{name:'St. Aubin Chapel',kind:'building',archetype:'chapel',discovery:'known'},
    'st-orison':{name:'St. Orison Hospital',kind:'landmark',story:true,archetype:'hospital',discovery:'known'},
    'pharmacy':{name:'Orison Pharmacy',kind:'building',archetype:'pharmacy',discovery:'known'},
    'clinic':{name:'Ward Clinic',kind:'building',archetype:'clinic',discovery:'known'},
    'morgue':{name:'St. Orison Morgue',kind:'building',archetype:'morgue',compound:'st-orison',discovery:'known'},
    'ambulance-yard':{name:'Ambulance Yard',kind:'lot',lot:'serviceYard',compound:'st-orison',profiles:['medical'],discovery:'known'},
    'blackglass-radio':{name:'Blackglass Radio',kind:'landmark',story:true,archetype:'radioStation',discovery:'known'},
    'fire-station':{name:'Northline Fire Station',kind:'building',archetype:'fireStation',discovery:'known'},
    'municipal-depot':{name:'Municipal Depot',kind:'building',archetype:'depot',discovery:'known'},
    'utility-yard':{name:'Utility Yard',kind:'lot',lot:'serviceYard',discovery:'known'},
    'northline-park':{name:'Transmitter Park',kind:'lot',lot:'park',discovery:'known'},
    'furnace-plant':{name:'Furnace Plant',kind:'landmark',story:true,profiles:['incendiary'],discovery:'known'},
    'machine-shop':{name:'Ashworks Machine Shop',kind:'building',archetype:'machineShop',discovery:'known'},
    'warehouse':{name:'Ashworks Warehouse',kind:'building',archetype:'warehouse',discovery:'known'},
    'loading-yard':{name:'Loading Yard',kind:'lot',lot:'serviceYard',compound:'machine-shop',discovery:'known'},
    'fuel-store':{name:'Fuel Store',kind:'lot',lot:'serviceYard',compound:'machine-shop',profiles:['vehicleFuel'],discovery:'known'},
    'machinery-yard':{name:'Machinery Yard',kind:'lot',lot:'machineryYard',compound:'machine-shop',discovery:'known'},
    'patient-furnace':{name:'Patient Furnace',kind:'landmark',story:true,profiles:[],discovery:'known'},
    'command-post':{name:'Command Post',kind:'building',archetype:'commandPost',compound:'patient-furnace',discovery:'known'},
    'processing-tents':{name:'Processing Tents',kind:'lot',lot:'serviceYard',compound:'patient-furnace',profiles:['medical','evidence'],discovery:'known'},
    'holding-building':{name:'Holding Block',kind:'building',archetype:'holding',compound:'patient-furnace',discovery:'known'},
    'armoury':{name:'Quarantine Armoury',kind:'building',archetype:'armoury',compound:'patient-furnace',discovery:'known'},
    'vehicle-yard':{name:'Vehicle Yard',kind:'lot',lot:'serviceYard',compound:'patient-furnace',profiles:['vehicleFuel'],discovery:'known'},
    'inner-arena':{name:'Disposal Yard',kind:'lot',lot:'burnYard',compound:'patient-furnace',discovery:'known'}
  };
  // ---- Fixed city plan (Phase 2) ----
  // Rects are [x, y, w, h]. Doors: [side, at (0..1 along the wall), width, kind]; lot entrances:
  // [side, at, width]. Every entry is reserved before ordinary fabric fills the remaining frontage.
  // Doors facing a street leave an approach corridor to the kerb; `access` reserves extra lanes.
  // Blocks are the road grid's cells: usable edges sit 170 from each avenue axis (road + pavement).
  var PLAN=[
    // South Blocks: market on the crossroads north of the checkpoint, police beside the evac route
    {id:'checkpoint-nine',rect:[-260,2540,520,380],access:[[170,2970,130,360],[-300,2970,130,360]], // corner lanes past the barrier stay open for the final approach
     vehicleSlots:[{id:'evac-car',vehicleType:'sedan',rect:[100,2560,48,96],heading:'v'}]},
    {id:'crossroads-supermarket',rect:[-1230,1570,1060,730],
      buildings:[{archetype:'supermarket',rect:[-800,1600,600,420],doors:[['n',.72,150,'public'],['s',.5,110,'service']]}],
      lots:[{id:'loading',kind:'serviceYard',rect:[-800,2060,630,220],entrances:[['e',.5,160],['w',.5,90]],open:['n']}],
      debris:[{id:'market-alley',rect:[-880,2125,70,90],note:'alley from the parking lot to the loading yard'}]},
    {id:'market-parking',rect:[-1210,1590,390,450],lots:[{kind:'parkingLot',rect:[-1200,1600,360,420],entrances:[['n',.5,220],['s',.5,120]]}],
      vehicleSlots:[{id:'market-bay-0',vehicleType:'sedan',rect:[-1170,1700,48,96],heading:'v'},{id:'market-bay-1',vehicleType:'sedan',rect:[-1050,1700,48,96],heading:'v'},{id:'market-bay-2',vehicleType:'sedan',rect:[-930,1860,48,96],heading:'v'}]},
    {id:'police-station',rect:[180,2170,720,360],
      buildings:[{archetype:'police',rect:[200,2180,440,340],doors:[['w',.5,100,'public'],['e',.5,90,'barred']]}],
      lots:[{id:'yard',kind:'serviceYard',rect:[680,2200,200,300],entrances:[['s',.5,100],['w',.5,90]]}]},
    // city_v2 V2-3 South Blocks pilot (block-3-4, see PILOT_BLOCKS): the police block's formerly anonymous core becomes
    // the station's staff parking, reached by the north alley, beside the terrace's rear court off the east lane
    {id:'police-staff-parking',rect:[440,1840,320,300],optional:true,name:'Police Staff Parking',
      lots:[{kind:'parkingLot',rect:[440,1840,320,300],entrances:[['n',.89,70],['s',.5,120]]}],
      vehicleSlots:[{id:'staff-bay-0',vehicleType:'sedan',rect:[470,1880,48,96],heading:'v'},{id:'staff-bay-1',vehicleType:'sedan',rect:[560,1880,48,96],heading:'v'}]},
    {id:'linden-rear-court',rect:[790,1810,210,370],optional:true,name:'Rear Court',
      lots:[{kind:'serviceYard',rect:[790,1810,210,370],entrances:[['e',.726,60],['w',.1,70]],bare:true}]},
    // city_v2 V2-3 Ashworks pilot (block-5-4): workshops face the x=2800 avenue, a truck lane runs between them into a
    // fenced loading court, and the north lane gives a second way in past the dispatch office
    {id:'ashworks-loading-court',rect:[3230,1830,290,550],optional:true,name:'Loading Court',
      lots:[{kind:'serviceYard',rect:[3230,1830,290,550],entrances:[['w',.717,90],['n',.82,110],['s',.3,90]],bare:true}]},
    {id:'residential-park',rect:[-2300,1920,400,400],lots:[{kind:'park',rect:[-2290,1930,380,380],entrances:[['n',.5,90],['s',.5,90],['w',.5,90],['e',.5,90]]}]},
    // Old Quarter: the graveyard and its chapel beside the x=-1400 avenue, demolition around the collapse
    {id:'collapsed-quarter',rect:[-3380,-400,1160,800]},
    {id:'graveyard',rect:[-2610,-1170,600,860],lots:[{kind:'graveyard',rect:[-2600,-1160,580,840],entrances:[['e',.3,90],['s',.5,110],['n',.5,90]]}],access:[[-2360,-320,110,150],[-2360,-1230,110,70]]},
    {id:'chapel',rect:[-1930,-1120,340,460],buildings:[{archetype:'chapel',rect:[-1920,-1100,320,420],doors:[['e',.5,110,'public'],['w',.65,90,'side']]}],
      debris:[{id:'chapel-lane',rect:[-1920,-640,120,60],note:'terrace collapse across the lane south of the chapel'}]},
    {id:'demolition-west',rect:[-2610,430,560,440],lots:[{kind:'demolitionLot',rect:[-2600,440,540,420],entrances:[['n',.5,120],['e',.5,120]]}],optional:true,name:'Demolition Lot'},
    {id:'demolition-north',rect:[-3530,-2450,540,520],lots:[{kind:'demolitionLot',rect:[-3520,-2440,520,500],entrances:[['e',.5,120]]}],optional:true,name:'Demolition Lot'},
    // Civic Ward: the St. Orison campus, its ambulance yard and morgue on the service lane
    {id:'st-orison',rect:[1570,-1230,1060,1060],
      buildings:[{archetype:'hospital',rect:[1600,-1080,700,540],doors:[['s',.5,130,'public'],['e',.5,80,'service']]}],
      debris:[{id:'orison-lane',rect:[2310,-1225,80,70],note:'collapsed canopy at the north end of the service lane'}]},
    {id:'ambulance-yard',rect:[2400,-1210,230,470],lots:[{kind:'serviceYard',rect:[2400,-1200,220,450],entrances:[['e',.5,160],['w',.7,90]]}],
      vehicleSlots:[{id:'ambulance',vehicleType:'ambulance',rect:[2440,-1080,72,36],heading:'h',prop:true}]},
    {id:'morgue',rect:[2400,-700,230,240],buildings:[{archetype:'morgue',rect:[2400,-690,220,220],doors:[['w',.5,90,'service']]}]},
    {id:'pharmacy',rect:[1590,190,330,250],buildings:[{archetype:'pharmacy',rect:[1600,200,300,220],doors:[['n',.5,110,'public'],['s',.5,90,'service']]}]},
    {id:'clinic',rect:[1960,190,300,250],buildings:[{archetype:'clinic',rect:[1970,200,280,220],doors:[['n',.5,100,'public']]}]},
    // Northline: fire station first, then the depot and utility yard, the park, and Blackglass at the end
    {id:'fire-station',rect:[-800,-2180,600,610],
      buildings:[{archetype:'fireStation',rect:[-780,-2150,480,330],doors:[['s',.27,120,'vehicleBay'],['s',.66,120,'vehicleBay'],['e',.3,90,'public']]}],
      lots:[{id:'apron',kind:'serviceYard',rect:[-780,-1810,480,240],entrances:[['s',.5,440]],open:['n'],bare:true}],
      vehicleSlots:[{id:'fire-truck',vehicleType:'fireTruck',rect:[-680,-1795,60,150],heading:'s',driveway:[-700,-1630,100,245]}]},
    {id:'northline-park',rect:[-1210,-2610,380,500],lots:[{kind:'park',rect:[-1200,-2600,360,480],entrances:[['w',.5,90],['s',.5,90],['n',.5,90]]}]},
    {id:'municipal-depot',rect:[190,-2170,440,340],buildings:[{archetype:'depot',rect:[200,-2160,400,300],doors:[['w',.5,90,'public'],['s',.5,120,'vehicleBay']]}]},
    {id:'utility-yard',rect:[700,-2600,510,700],lots:[{kind:'serviceYard',rect:[720,-2580,480,660],entrances:[['s',.5,140],['w',.3,90]]}]},
    {id:'blackglass-radio',rect:[-680,-3560,1360,600],
      buildings:[{archetype:'radioStation',rect:[220,-3440,420,290],doors:[['w',.5,100,'public'],['n',.45,90,'service']]}],
      lots:[{id:'mast-yard',kind:'serviceYard',rect:[-640,-3480,440,440],entrances:[['e',.5,100],['s',.5,100]]}]},
    // Ashworks: one service landscape around the machine shop, warehouse south, Furnace Plant in the corner
    {id:'machine-shop',rect:[1570,1570,1060,1060],
      buildings:[{archetype:'machineShop',rect:[1600,1600,500,380],doors:[['n',.3,100,'public'],['s',.6,130,'vehicleBay'],['e',.6,90,'service']]}],
      debris:[{id:'ashworks-lane',rect:[2110,1990,80,80],note:'spoil across the lane between the shop and the machinery yard'}]},
    {id:'fuel-store',rect:[2170,1590,440,260],lots:[{kind:'serviceYard',rect:[2180,1600,420,240],entrances:[['w',.5,90],['n',.5,120]]}]},
    {id:'machinery-yard',rect:[2190,1880,430,740],lots:[{kind:'machineryYard',rect:[2200,1890,410,720],entrances:[['e',.4,170],['s',.5,170],['w',.2,120]]}],
      vehicleSlots:[{id:'dozer-pad-0',vehicleType:'bulldozer',rect:[2250,1950,90,120],heading:'e'},{id:'dozer-pad-1',vehicleType:'bulldozer',rect:[2460,1950,90,120],heading:'e'},
        {id:'dozer-pad-2',vehicleType:'bulldozer',rect:[2250,2400,90,120],heading:'s'},{id:'dozer-pad-3',vehicleType:'bulldozer',rect:[2460,2400,90,120],heading:'s'}]},
    {id:'loading-yard',rect:[1590,2020,540,600],lots:[{kind:'serviceYard',rect:[1600,2030,520,580],entrances:[['w',.5,160],['s',.5,160],['n',.58,130]]}]},
    {id:'warehouse',rect:[1590,2990,580,400],buildings:[{archetype:'warehouse',rect:[1640,3010,480,340],doors:[['n',.5,130,'vehicleBay'],['w',.5,90,'public']]}]},
    // city_v2: the plant is a fenced works compound with a north truck gate and a west personnel gate, not an open corner
    {id:'furnace-plant',rect:[2970,2970,570,570],lots:[{id:'works',kind:'compoundYard',rect:[2990,2990,530,530],entrances:[['n',.5,140],['w',.25,90]]}]},
    // Central Quarantine: four processing corners around the disposal yard
    {id:'patient-furnace',rect:[-620,-620,1240,1240]},
    {id:'command-post',rect:[380,-615,235,215],buildings:[{archetype:'commandPost',rect:[390,-610,220,200],doors:[['s',.5,90,'public']]}]},
    {id:'processing-tents',rect:[175,-615,200,215],lots:[{kind:'serviceYard',rect:[180,-610,190,200],entrances:[['s',.5,120],['w',.5,90]]}]},
    {id:'holding-building',rect:[-615,-615,270,215],buildings:[{archetype:'holding',rect:[-610,-610,260,200],doors:[['s',.25,90,'public'],['e',.5,90,'service']]}]},
    {id:'armoury',rect:[-615,405,215,210],buildings:[{archetype:'armoury',rect:[-610,410,200,190],doors:[['n',.5,90,'public']]}]},
    {id:'vehicle-yard',rect:[175,405,440,210],lots:[{kind:'serviceYard',rect:[180,410,430,200],entrances:[['w',.5,120],['n',.5,160]]}]},
    {id:'inner-arena',rect:[-380,-380,760,760],lots:[{kind:'burnYard',rect:[-370,-370,740,740],entrances:[['n',.5,100],['s',.5,100],['e',.5,100],['w',.5,100]]}]}
  ];
  // ---- Authored blocks (city_v2 V2-3 pilots) ----
  // A pilot block replaces random frontage with authored parcels: [side, x, y, w, h, archetype|'sealed', rearDoorSide?].
  // Attached frontage with deliberate gaps (alley mouths, lanes) instead of repeated 50-99 unit voids; its core is
  // authored through PLAN lots, so the block adds no random background masses.
  var PILOT_BLOCKS={
    'block-3-4':{alleys:[[690,1570,70,270,'north alley'],[1020,2030,210,70,'east lane'],[380,2100,60,70,'police side passage']],parcels:[
      ['n',170,1570,250,210,'shop'],['n',420,1570,270,210,'home','s'],['n',760,1570,230,210,'shop','s'],['n',990,1570,240,210,'home'],
      ['e',1020,1790,210,240,'home','w'],['e',1020,2100,210,240,'shop'],['e',1020,2340,210,290,'home'],
      ['w',170,1790,210,310,'home','e']]},
    'block-5-4':{alleys:[[3420,1570,120,260,'north truck lane'],[2970,2150,260,100,'loading lane']],parcels:[
      ['n',2970,1570,230,220,'dispatchOffice','s'],['n',3200,1570,220,220,'storageShed'],
      ['w',2970,1860,230,290,'workshop','s'],['w',2970,2250,230,270,'workshop','n'],
      ['s',3200,2410,220,220,'storageShed','n']]}
  };
  // ---- Economy (Phase 6) ----
  // A run's world loot is a budget: each resource rolls a pickup count inside `count`, then every pickup
  // goes to one free socket chosen by weight. Weight = profile affinity x socket class x socket use x
  // district bias; a profile with no affinity for a resource can never hold it (pharmacies never get
  // shells, graveyards never get weapons). Generous civic places are paid for by thin ordinary homes
  // and street caches because they draw from the same fixed counts.
  var ECONOMY={
    // PLAYER_POWER Phase 8: launchers, armor and grenade rounds join the budget; turrets come only from guarantees
    order:['turret','weaponQ2','launcher','weapon','medkit','armor','provision','vehicleFuel','incendiary','grenades','shells','bullets','xp'],
    resources:{
      weaponQ2:{count:[5,8]},weapon:{count:[20,26]},medkit:{count:[9,13]},provision:{count:[13,18]},
      vehicleFuel:{count:[10,14],amount:[20,20]},incendiary:{count:[20,27],amount:[30,45]},
      shells:{count:[40,50],amount:[8,12]},bullets:{count:[56,70],amount:[34,48]},xp:{count:[42,54],amount:[13,21]},
      launcher:{count:[3,4]},armor:{count:[6,9],amount:[25,25]},grenades:{count:[8,12],amount:[2,4]},turret:{count:[0,0]}
    },
    profiles:{
      medical:{medkit:6,xp:.8,armor:1.2},munitions:{bullets:5,shells:4.5,grenades:2.5,armor:2,turret:1},weapons:{weaponQ2:7,weapon:4,bullets:1,launcher:5,grenades:1.5,turret:1},provisions:{provision:6,medkit:.6},
      incendiary:{incendiary:6,weapon:.4},vehicleFuel:{vehicleFuel:6,xp:.4},refuge:{provision:3,medkit:2,bullets:.7,xp:1,armor:1},
      utility:{bullets:1.4,shells:1,vehicleFuel:.8,xp:1.2,grenades:.6},evidence:{xp:5},
      mixed:{bullets:2,shells:1.5,medkit:.5,incendiary:.6,weapon:1,weaponQ2:.08,xp:1.2,provision:.25,launcher:.12,grenades:.8,armor:.15}
    },
    classes:{civic:3,landmark:2.4,lot:1.3,street:1.1,fabric:.55},
    uses:{stock:{provision:3,vehicleFuel:1.5},vending:{provision:2},pocket:{provision:.35,xp:1.5},refuge:{provision:1.5,medkit:1.5}},
    districts:{industry:{vehicleFuel:3.5,incendiary:2.2},checkpoint:{provision:.4,bullets:1.5,shells:.85},ruins:{xp:1.3},hospital:{medkit:1.3},quarantine:{weaponQ2:1.5,bullets:1.3,grenades:1.6,launcher:1.3}},
    // city_v2: South Blocks lost its four central blocks to Quarantine, so its bullet weight rose from .85 to 1.5 to keep
    // its per-seed share after Ashworks gained workshops and the frontage composition pass (min 14.8% over seeds 1-50); global counts are unchanged.
    // placed before the weighted spread: Ashworks always holds enough fuel for the chapel generator, and
    // South Blocks always offers a first medkit
    guarantees:[{resource:'vehicleFuel',district:'industry',count:2},{resource:'medkit',district:'checkpoint',count:1},{resource:'provision',location:'crossroads-supermarket',count:2},
      {resource:'turret',location:'police-station',count:1},{resource:'turret',location:'armoury',count:1}],
    perSite:3,
    // the AR joins the salvage pool so its attachments are reachable from duplicates like every other gun (Phase 8)
    weapons:['ar','smg','shotgun','rifle','flame'],
    // Fuel units: 1 L of vehicle fuel drives a sedan 70 distance units (the old tank scale), so a
    // sedan holds 56 L and parked sedans spawn with 8-56 L. The squad carries up to 60 L in shared
    // jerrycans (20 L each); a pickup that would overflow leaves the rest in the can on the ground.
    // Refuelling pours one can per action (Phase 10); the chapel generator needs 30 L once, and until
    // it runs the last 30 L carried are reserved and cannot be poured into vehicles.
    fuel:{distancePerLitre:70,jerrycan:20,carryCap:60,generatorCharge:30,reserve:30},
    provisions:{carryCap:6,fedSeconds:90,staminaRegen:1.5,sprintDrain:.8},
    // explicit per-seed envelopes for world loot, checked over seeds 1-50 (CITY.md Phase 6 table)
    envelopes:{
      pickups:[205,310],bullets:[2000,3250],shells:[340,600],incendiaryFuel:[640,1200],medkits:[9,13],xp:[600,1100],
      weaponQ1:[18,28],weaponQ2:[5,10],provisions:[13,18],vehicleFuel:[200,280],launchers:[3,4],armorPoints:[150,225],grenadeRounds:[16,48],turrets:[2,2],
      southBlocksShare:{bullets:[.12,.55],medkits:[.05,.6],provisions:[.1,.7]},ashworksFuelMin:40,supermarketProvisions:[2,7]
    }
  };
  // What a location offers by default: its place entry, else its archetype or lot kind.
  function profilesFor(place){
    if(place.profiles)return place.profiles;
    if(place.archetype)return ARCHETYPES[place.archetype].profiles;
    if(place.lot)return LOT_KINDS[place.lot].profiles;
    return [];
  }
  // A style maps to its semantic archetype for ordinary one-room fabric.
  var STYLE_ARCHETYPE={row:'home',shack:'home',terrace:'home',shop:'shop',clinic:'clinic'};
  root.DSCity={LOOT_PROFILES:LOOT_PROFILES,ARCHETYPES:ARCHETYPES,LOT_KINDS:LOT_KINDS,PLACES:PLACES,STYLE_ARCHETYPE:STYLE_ARCHETYPE,PLAN:PLAN,PILOT_BLOCKS:PILOT_BLOCKS,ECONOMY:ECONOMY,profilesFor:profilesFor};
})(typeof window!=='undefined'?window:globalThis);
