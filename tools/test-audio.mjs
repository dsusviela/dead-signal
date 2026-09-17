import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PATH).href);
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  async function render(events=[],options={}){
    await page.goto('about:blank');
    await page.evaluate(()=>{
      window.AudioContext=function(){
        const ctx=new OfflineAudioContext(1,44100,22050);
        Object.defineProperty(ctx,'state',{get:()=> 'running'});
        window.testAudioContext=ctx;return ctx;
      };
    });
    await page.addScriptTag({path:new URL('../audio.js',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')});
    return page.evaluate(async({events,options})=>{
      if(options.musicMuted)DSAudio.toggleMusic();DSAudio.unlock();if(options.muted)DSAudio.toggleMute();if(options.prime)DSAudio.primeIncidentals();
      const s={mode:'play',paused:!!options.paused,audioEvents:events,wave:1,threat:1,boss:options.boss?{active:true}:null,
        vehicles:options.vehicles||(options.car?[{id:'car',driver:0,fuel:100,dead:false,speed:options.speed||0,x:0,y:0}]:[]),
        camera:{x:0,y:0},world:options.world||null,circuit:options.circuit||null,campaign:options.campaign||null,players:options.players||[]};
      DSAudio.update(s);
      const engines=DSAudio.status.engines;
      if(options.stop==='park'){s.vehicles[0].driver=null;DSAudio.update(s);}
      if(options.stop==='pause'){s.paused=true;DSAudio.update(s);}
      if(options.stop==='mute')DSAudio.toggleMute();
      if(options.stop==='reset')DSAudio.update({...s,vehicles:[],audioEvents:[],world:null,campaign:null}); // a new run: nothing carries over
      const loopsBefore=options.loopsBefore;const loops=DSAudio.status.loops;
      if(options.stop==='cold'){s.world.obstacles.forEach(o=>{o.burning=false;o.cold=true;});DSAudio.update(s);}
      const remainingLoops=DSAudio.status.loops,remainingEngines=DSAudio.status.engines,voices=DSAudio.status.voices,buffer=await testAudioContext.startRendering(),data=buffer.getChannelData(0);
      let energy=0,peak=0,signature=0;
      for(let i=0;i<data.length;i++){energy+=data[i]*data[i];peak=Math.max(peak,Math.abs(data[i]));signature+=data[i]*(i%97);}
      return {rms:Math.sqrt(energy/data.length),peak,signature,voices,engines,remainingEngines,loops,remainingLoops,incidentals:DSAudio.status.incidentals};
    },{events,options});
  }
  const baseline=await render();assert.ok(baseline.rms>.001,'music generates audible samples');assert.ok(baseline.peak<1);
  const signatures=new Set();
  for(const detail of ['pistol','ar','smg','shotgun','rifle','flame','launcher','turret']){
    const out=await render([{type:'shot',detail}]);
    assert.ok(out.rms>0&&out.peak<1,detail+' is audible without clipping');signatures.add(out.signature.toFixed(4));
  }
  assert.equal(signatures.size,8,'each weapon and the turret has a distinct waveform');
  // PLAYER_POWER Phase 9: power cues are audible, distinct and stay inside the voice cap when stacked
  for(const [type,detail] of [['explosion'],['attachment'],['armor','hit'],['armor','break'],['armor','pickup'],['turret','deploy'],['turret','retrieve'],['turret','break']]){
    const out=await render([{type,detail}]);assert.ok(Math.abs(out.signature-baseline.signature)>.01,type+' '+(detail||'')+' changes the waveform');assert.ok(out.peak<1);
  }
  const crowd=[];for(let i=0;i<4;i++)crowd.push({type:'explosion'},{type:'shot',detail:'launcher'},{type:'armor',detail:'hit'},{type:'shot',detail:'shotgun'});for(let i=0;i<24;i++)crowd.push({type:'shot',detail:'turret'});
  const stacked=await render(crowd);assert.ok(stacked.peak<1,'four-player power combat does not clip ('+stacked.peak.toFixed(3)+')');assert.ok(stacked.voices<=48,'voices '+stacked.voices);
  for(const type of ['heal','hurt','pickup','reload','level','revive','engine','crash']){
    const out=await render([{type}]);assert.ok(Math.abs(out.signature-baseline.signature)>.01,type+' changes the waveform');assert.ok(out.peak<1);
  }
  const boss=await render([],{boss:true});assert.notEqual(boss.signature,baseline.signature);
  assert.equal((await render([{type:'shot',detail:'shotgun'}],{muted:true})).rms,0,'mute silences music and effects');
  assert.equal((await render([],{paused:true})).rms,0,'pause does not schedule music');
  assert.equal((await render([],{musicMuted:true})).rms,0,'music can be silenced independently');
  assert.ok((await render([{type:'shot',detail:'shotgun'}],{musicMuted:true})).rms>0,'combat effects remain audible without music');
  const engineOnly=await render([],{musicMuted:true,car:true,speed:-135});
  assert.ok(engineOnly.rms>0);assert.equal(engineOnly.engines,1,'music preference leaves the reversing engine alive');
  const idle=await render([],{car:true}),fast=await render([],{car:true,speed:300});
  assert.equal(idle.engines,1);assert.equal(fast.engines,1);assert.notEqual(idle.signature,fast.signature);
  assert.ok(fast.peak<1&&fast.voices<=48);
  for(const stop of ['park','pause','mute','reset']){
    const out=await render([],{car:true,stop});assert.equal(out.engines,1);assert.equal(out.remainingEngines,0,stop+' releases engine voice');
  }
  // ---- CITY.md Phase 12A: city cues, typed engines, persistent loops ----
  for(const [type,detail] of [['board','fireTruck'],['board','sedan'],['dismount','fireTruck'],['stall','bulldozer'],['breakdown','bulldozer'],['strain','bulldozer'],['cleared'],['pour'],['refuelled'],['reject'],['door','forced'],['gate','open'],['gate','close'],['hold'],['generator','start'],['paper'],['pickup','payload'],['pickup','vehicleFuel'],['pickup','provision'],['eat'],['radioReady'],['transmitted'],['bossDown'],['escape'],['step','tile'],['step','wood'],['step','concrete'],['step','gravel'],['step','grass']]){
    const out=await render([{type,detail}],{musicMuted:true});assert.ok(out.rms>0&&out.peak<1,type+'/'+(detail||'')+' is audible without clipping');
  }
  const stepSig=new Set();for(const m of ['tile','wood','concrete','gravel','grass','asphalt'])stepSig.add((await render([{type:'step',detail:m}],{musicMuted:true})).signature.toFixed(5));
  assert.equal(stepSig.size,6,'each floor sounds different');
  const eng=async type=>render([],{musicMuted:true,vehicles:[{id:type,vehicleType:type,driver:0,fuel:100,dead:false,speed:80,x:0,y:0}]});
  const sedan=await eng('sedan'),truck=await eng('fireTruck'),dozer=await eng('bulldozer');
  assert.ok(new Set([sedan.signature,truck.signature,dozer.signature].map(v=>v.toFixed(4))).size===3,'truck, dozer and sedan engines differ');
  const world={buildings:[{anchors:[{kind:'chapelGenerator',x:30,y:0},{kind:'radioTransmit',x:0,y:30}]}],obstacles:[{burning:true,x:40,y:40,w:96,h:48}]};
  const players=[{x:0,y:20,dead:false}],campaign={holding:'transmit',transmitted:false};
  const city=await render([],{musicMuted:true,world,circuit:{emergency:true},campaign,players});
  assert.deepEqual([...city.loops].sort(),['fire','generator'],'only localized fire and generator loops remain during transmission');
  const dark=await render([],{musicMuted:true,world:{buildings:world.buildings,obstacles:[{cold:true,x:40,y:40,w:96,h:48}]},circuit:{emergency:false},players});
  assert.deepEqual([...dark.loops],[],'no ambient static, generator hum without power, or fire loop on a cold wreck');
  assert.deepEqual([...(await render([],{musicMuted:true,world,circuit:{emergency:true},campaign,players,stop:'cold'})).remainingLoops].includes('fire'),false,'a fire that goes out stops its loop');
  for(const stop of ['pause','mute','reset']){const out=await render([],{world,circuit:{emergency:true},campaign,players,stop});assert.equal(out.remainingLoops.length,0,stop+' releases every loop');}
  // the loudest case: three engines, every loop, boss music and a volley share the 48-voice cap
  const volley=['ar','smg','shotgun','rifle','pistol','flame','ar','smg'].map(detail=>({type:'shot',detail}));
  const heavy=await render([...volley,{type:'strain',detail:'bulldozer'},{type:'generator'}],{boss:true,world,circuit:{emergency:true},campaign,players,vehicles:['sedan','fireTruck','bulldozer'].map((t,i)=>({id:t,vehicleType:t,driver:i,fuel:100,dead:false,speed:200,x:i*10,y:0}))});
  assert.ok(heavy.voices<=48&&heavy.peak<1,'peak voices '+heavy.voices);assert.equal(heavy.engines,3);
  assert.ok((await render([{type:'step',detail:'wood'}],{musicMuted:true,world,circuit:{emergency:true},players})).rms>0,'music off keeps effects and loops');
  assert.equal((await render([{type:'step',detail:'wood'}],{muted:true,world,circuit:{emergency:true},players})).rms,0,'all sound off silences everything');
  // ---- city_v2 Section 5: sparse, source-bound incidental one-shots, never a bed ----
  const sources={obstacles:[{collapsed:true,type:'building',x:40,y:0,w:100,h:80},{burning:true,hp:100,x:-60,y:40,w:96,h:48},{type:'fence',x:0,y:-60,w:120,h:8}],
    props:[{art:'props/dumpster',x:20,y:30},{locationId:'utility-yard',x:-30,y:0}],buildings:[{archetypeId:'hospital',x:10,y:10,w:80,h:60,anchors:[]}],setpieces:[{kind:'radio',x:0,y:90}]};
  const lit=await render([],{musicMuted:true,prime:true,world:sources,circuit:{emergency:true},players});
  assert.equal(lit.incidentals,7,'every district incidental plays once beside its real source ('+lit.incidentals+')');assert.ok(lit.rms>0&&lit.peak<1&&lit.voices<=48);
  const unpowered=await render([],{musicMuted:true,prime:true,world:sources,circuit:{emergency:false},players});
  assert.equal(unpowered.incidentals,6,'the transformer is silent without a live circuit');
  assert.equal((await render([],{musicMuted:true,prime:true,world:{obstacles:[],props:[],buildings:[],setpieces:[]},players})).incidentals,0,'no source, no sound');
  assert.deepEqual([...lit.loops].filter(id=>!['fire','generator'].includes(id)),[],'incidentals never start a persistent loop');
  assert.equal((await render([],{musicMuted:true,prime:true,world:sources,circuit:{emergency:true},players,boss:true})).incidentals,0,'the boss fight keeps the incidentals quiet');
  assert.deepEqual(errors,[]);
  console.log('PASS audio: exploration/boss music, weapons, city cues, typed engines, persistent loops, lifecycle, independent music mute, master mute, pause and the voice cap');
}finally{await browser.close();}
