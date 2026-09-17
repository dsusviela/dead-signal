(function(root){
  'use strict';
  // Original procedural score and effects. Everything is synthesized on the fly from one noise buffer, three impulse
  // responses and a handful of periodic waves; bounded voices, short lookahead: no downloads, timers, or audio work
  // in the simulation.
  let ctx=null,master=null,music=null,effects=null,noiseBuffer=null,muted=false,musicMuted=false;
  let lastState=null,lastMode='',lastBoss=false,lastWave=1,lastDead=0,running=false;
  // the score's mix graph (buildScore) and its one long-lived drone
  let layers=null,droneBus=null,downBus=null,duck=null,echo=null,drone=null,lastDuck=0,hushUntil=0;
  const voices=new Set(),cooldowns=new Map(),engines=new Map(),loops=new Map();
  // Engine voices per vehicle type (CITY.md Phase 12A): a diesel truck is a lower square-wave motor with a darker
  // filter; the bulldozer is lower still and adds track clatter while it moves. Pitch follows speed / top speed.
  const ENGINE={sedan:{wave:'sawtooth',base:38,range:62,cut:140,open:480,level:.035,top:300},
    fireTruck:{wave:'square',base:27,range:36,cut:110,open:300,level:.045,top:230},
    bulldozer:{wave:'square',base:22,range:24,cut:90,open:220,level:.05,top:140,clatter:true}};
  try{muted=localStorage.getItem('dead-signal-muted')==='true';}catch{}
  try{musicMuted=localStorage.getItem('dead-signal-music-muted')==='true';}catch{}
  function unlock(){
    try{
      if(!ctx){
        const Audio=root.AudioContext||root.webkitAudioContext;if(!Audio)return;
        ctx=new Audio();master=ctx.createGain();music=ctx.createGain();effects=ctx.createGain();
        const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-14;limiter.ratio.value=8;
        music.gain.value=musicMuted?0:.48;effects.gain.value=.7;master.gain.value=muted?0:.65;
        music.connect(master);effects.connect(master);master.connect(limiter);limiter.connect(ctx.destination);
        noiseBuffer=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
        const data=noiseBuffer.getChannelData(0);let seed=73;
        for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1;}
        buildScore();
      }
      if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    }catch{}
  }
  function voice(source,nodes,at,duration){
    if(voices.size>=48){source.disconnect();nodes.forEach(n=>n.disconnect());return false;}
    voices.add(source);
    source.onended=()=>{voices.delete(source);source.disconnect();nodes.forEach(n=>n.disconnect());};
    source.start(at);source.stop(at+duration+.025);
    return true;
  }
  function envelope(gain,at,duration,level,attack){
    gain.gain.setValueAtTime(.0001,at);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001,level),at+Math.min(attack,duration*.3));
    gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  }
  function tone(freq,duration,level,type='sine',at=ctx.currentTime,bus=effects,end=freq,attack=.006,pan=0){
    const source=ctx.createOscillator(),gain=ctx.createGain();source.type=type;
    source.frequency.setValueAtTime(freq,at);source.frequency.exponentialRampToValueAtTime(Math.max(20,end),at+duration);
    envelope(gain,at,duration,level,attack);source.connect(gain);
    if(pan&&ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=pan;gain.connect(p);p.connect(bus);voice(source,[gain,p],at,duration);return;}
    gain.connect(bus);voice(source,[gain],at,duration);
  }
  function noise(duration,level,frequency,at=ctx.currentTime,bus=effects,kind='lowpass'){
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=noiseBuffer;source.loop=true;filter.type=kind;filter.frequency.value=frequency;filter.Q.value=.7;
    envelope(gain,at,duration,level,.004);source.connect(filter);filter.connect(gain);gain.connect(bus);voice(source,[filter,gain],at,duration);
  }
  function cue(type,detail){
    if(!ctx||ctx.state!=='running'||muted)return;
    const t=ctx.currentTime,key=type==='shot'?type+detail:type;
    const gap=type==='shot'?.045:type==='pickup'?.09:type==='strain'?.25:type==='step'?.1:.12;
    if(t-(cooldowns.get(key)??-10)<gap)return;cooldowns.set(key,t);
    if(type==='shot'){
      const gun=detail||'pistol';
      if(gun==='flame'){noise(.15,.19,650);tone(65,.13,.07,'sawtooth',t,effects,35);return;}
      if(gun==='turret'){noise(.035,.07,2400,t,effects,'bandpass');tone(150,.04,.04,'square',t,effects,90);return;}
      if(gun==='launcher'){tone(92,.16,.14,'triangle',t,effects,48);noise(.08,.12,900,t);return;}
      const profile={pistol:[.10,.24,1700,150],ar:[.07,.20,2200,130],smg:[.055,.15,2700,190],shotgun:[.29,.39,1200,90],rifle:[.22,.32,3000,110]}[gun]||[.1,.2,1800,150];
      noise(profile[0],profile[1],profile[2]);tone(profile[3],.10,.19,'triangle',t,effects,35);
      if(gun==='shotgun')noise(.09,.08,3200,t+.22,effects,'highpass');
    }else if(type==='engine'){
      if(!engines.size){const rev=Math.max(0,Math.min(1,Number(detail)||0));tone(38+rev*48,.32,.06,'sawtooth',t,effects,40+rev*48);noise(.28,.045,180+rev*420);}
    }else if(type==='crash'){
      noise(.38,.3,1100);noise(.16,.1,2800,t,effects,'highpass');tone(95,.3,.2,'triangle',t,effects,28);
    }else if(type==='reload'){
      noise(.045,.09,2400,t,effects,'highpass');noise(.06,.12,1800,t+.19,effects,'highpass');
    }else if(type==='hurt'){
      noise(.14,.24,550);tone(105,.23,.22,'sine',t,effects,38);
    }else if(type==='pickup'&&detail==='vehicleFuel'){
      // a jerrycan: hollow metal slosh, lower than an ammo pickup
      noise(.16,.05,420,t,effects,'lowpass');tone(196,.12,.08,'triangle',t+.02);
    }else if(type==='pickup'&&detail==='provision'){
      tone(440,.06,.07,'square');tone(660,.08,.05,'triangle',t+.05);
    }else if(type==='eat'){
      noise(.12,.035,1800,t,effects,'bandpass');tone(330,.1,.05,'sine',t+.08);
    }else if(type==='pickup'&&detail!=='payload'&&detail!=='override'&&detail!=='evidence'){
      tone(520,.07,.09,'triangle');tone(780,.10,.07,'sine',t+.06);
    }else if(type==='heal'||type==='revive'){
      noise(.22,.045,2000,t,effects,'bandpass');
      [261.63,329.63,392,523.25].forEach((f,i)=>tone(f,.3,.09,'sine',t+i*.085));
    }else if(type==='level'){
      levelChime(t);
    }else if(type==='won'){
      [196,293.66,392,587.33].forEach((f,i)=>tone(f,.5,.11,'triangle',t+i*.14));
    }else if(type==='lost'){
      wipe(t);
    }else if(type==='boss'){
      tone(73.42,1.4,.25,'sawtooth',t,effects,36.71,.05);tone(77.78,1.5,.13,'sine');noise(.8,.17,380);
    // ---- city actions (Phase 12A) ----
    }else if(type==='board'){
      // engine start: a short crank for a car, a long diesel turnover for the truck and the dozer
      const heavy=detail==='fireTruck'||detail==='bulldozer';
      for(let i=0;i<(heavy?4:2);i++)noise(.07,.06,heavy?260:420,t+i*(heavy?.11:.08));tone(heavy?30:42,heavy?.7:.35,.07,'square',t+(heavy?.4:.16),effects,heavy?36:52);
    }else if(type==='dismount'||type==='stall'){
      tone(detail==='fireTruck'||detail==='bulldozer'?34:46,.4,.05,'square',t,effects,20);
      // the truck's brakes and air release: a soft hiss above the gun band
      if(detail==='fireTruck')noise(.45,.035,5600,t+.12,effects,'highpass');
    }else if(type==='breakdown'){
      noise(.5,.2,700);tone(58,.6,.16,'sawtooth',t,effects,24);noise(.6,.04,5200,t+.2,effects,'highpass');
    }else if(type==='strain'){
      noise(.28,.09,220,t,effects,'lowpass');tone(48,.3,.07,'sawtooth',t,effects,44);
    }else if(type==='cleared'){
      tone(52,.5,.22,'sine',t,effects,30);noise(.6,.16,380);noise(.35,.05,5000,t+.15,effects,'highpass');
    }else if(type==='pour'){
      [190,165,150,138].forEach((f,i)=>tone(f,.07,.05,'sine',t+i*.11));
    }else if(type==='refuelled'){
      noise(.02,.06,5200,t,effects,'highpass');tone(520,.05,.06,'triangle',t+.03);
    }else if(type==='explosion'){
      noise(.55,.34,420,t);tone(58,.5,.22,'sine',t,effects,28);noise(.18,.16,2600,t+.02,effects,'highpass');
    }else if(type==='armor'){
      if(detail==='break'){noise(.25,.14,3200,t,effects,'highpass');tone(440,.12,.07,'square',t,effects,180);}else if(detail==='pickup'){tone(392,.06,.06,'triangle',t);tone(587,.08,.06,'triangle',t+.06);noise(.06,.05,2600,t+.02,effects,'bandpass');}else{noise(.05,.09,2200,t,effects,'bandpass');tone(620,.05,.04,'square',t,effects,480);}
    }else if(type==='turret'){
      if(detail==='break'){noise(.4,.2,900,t);tone(80,.35,.1,'sawtooth',t,effects,30);}else{[detail==='deploy'?220:330,detail==='deploy'?330:220].forEach((f,i)=>tone(f,.06,.06,'square',t+i*.09));noise(.05,.05,3000,t+.02,effects,'highpass');}
    }else if(type==='attachment'){
      tone(660,.06,.06,'triangle',t);tone(990,.09,.05,'triangle',t+.07);noise(.03,.04,4200,t,effects,'highpass');
    }else if(type==='reject'){
      tone(110,.12,.07,'square');tone(98,.14,.06,'square',t+.14);
    }else if(type==='pourStop'){
      tone(150,.08,.03,'sine');
    }else if(type==='door'){
      noise(.32,.2,620);tone(72,.35,.14,'triangle',t,effects,40);noise(.08,.05,5000,t+.05,effects,'highpass');
    }else if(type==='gate'){
      // a motor-driven gate or boom: rising whine, then the latch
      tone(58,.7,.08,'sawtooth',t,effects,detail==='close'?46:88);noise(.06,.12,800,t+.72);tone(120,.08,.08,'square',t+.72);
    }else if(type==='hold'){
      tone(880,.06,.05,'sine');tone(1320,.08,.04,'sine',t+.08);
    }else if(type==='generator'){
      for(let i=0;i<3;i++)noise(.09,.08,300,t+i*.16);tone(36,1.2,.1,'square',t+.45,effects,50);
    }else if(type==='paper'){
      noise(.14,.05,6000,t,effects,'highpass');noise(.1,.04,5200,t+.12,effects,'highpass');
    }else if(type==='pickup'&&(detail==='payload'||detail==='override'||detail==='evidence')){
      noise(.12,.04,6000,t,effects,'highpass');tone(988,.08,.06,'sine',t+.04);tone(1318,.1,.05,'sine',t+.13);
    }else if(type==='radioReady'){
      tone(988,.1,.06,'sine');tone(1318,.14,.06,'sine',t+.12);noise(.3,.03,5200,t,effects,'highpass');
    }else if(type==='transmitted'){
      [440,659.25,880].forEach((f,i)=>tone(f,.6,.07,'sine',t+i*.1));
    }else if(type==='bossDown'){
      tone(55,1.6,.2,'sine',t,effects,41);tone(82.4,1.4,.08,'triangle',t+.2);noise(1,.08,300);
    }else if(type==='escape'){
      [196,246.94,293.66,392,493.88].forEach((f,i)=>tone(f,.9,.1,'triangle',t+i*.18));
    }else if(type==='step'){
      // footsteps by floor: tile ticks, wood knocks, concrete scuffs, gravel crunches, grass and asphalt stay soft
      const m=detail||'asphalt';
      if(m==='tile'){tone(1100,.02,.018,'triangle');noise(.02,.012,5400,t,effects,'highpass');}
      else if(m==='wood')tone(170,.045,.03,'triangle',t,effects,120);
      else if(m==='concrete')noise(.04,.03,320,t,effects,'lowpass');
      else if(m==='gravel')noise(.07,.035,900,t,effects,'bandpass');
      else if(m==='grass')noise(.05,.018,420,t,effects,'lowpass');
      else noise(.03,.02,260,t,effects,'lowpass');
    }else if(type==='wave'){
      tone(220,.2,.07,'sine');tone(207.65,.4,.06,'sine',t+.22);
    }
  }
  // =====================================================================================================
  // THE SCORE (AUDIO.md is the source of truth for every threshold and number here)
  // One conductor and one arrangement in layers, on two axes. The QUARTER of the city the camera is in picks the
  // harmony and the instruments; how much danger the squad is in picks the STATE: which layers play and how fast.
  // Hard rules: ~16 live music voices at most (gunfire shares the 48), nothing pitched or filtered into the
  // 1.5-4 kHz band the guns own, and no noise beds -- every noise below is a hit or a gesture under two seconds.
  // =====================================================================================================
  const hz=m=>440*Math.pow(2,(m-69)/12);
  const LAYERS=['bed','texture','motif','pulse','combat','overrun','boss','sting'];
  // sends per layer into [hall, room, echo]: the slow layers live in the long dark hall, the frantic ones stay close
  const SENDS={bed:[.5,0,0],texture:[.7,0,.35],motif:[.55,0,.45],pulse:[.3,.15,0],combat:[.1,.35,0],overrun:[.1,.35,0],boss:[.4,.25,0],sting:[.6,.1,0]};
  // harmonic spectra for createPeriodicWave: one oscillator carries a whole instrument body instead of a bare saw
  const WAVES={cello:[0,1,.7,.5,.38,.3,.22,.17,.12,.09,.07,.05],reed:[0,1,.05,.55,.04,.35,.03,.22,.02,.14,0,.08],
    brass:[0,1,.9,.75,.62,.5,.4,.32,.25,.2,.15,.12,.1],glass:[0,1,0,.2,0,.12,0,0,.06]};
  const VOWEL={oo:[320,800],oh:[480,880],ah:[720,1150]};
  const waves={};
  function wave(name){return waves[name]||(waves[name]=ctx.createPeriodicWave(new Float32Array(WAVES[name].length),Float32Array.from(WAVES[name])));}
  function osc(kind,f){const o=ctx.createOscillator();if(WAVES[kind])o.setPeriodicWave(wave(kind));else o.type=kind;o.frequency.value=f;return o;}
  // a stereo impulse whose tail darkens as it decays, so the room swallows the top end first
  function impulse(seconds,shape,dark,seed){
    const ir=ctx.createBuffer(2,Math.floor(ctx.sampleRate*seconds),ctx.sampleRate);
    for(let c=0;c<2;c++){
      const d=ir.getChannelData(c);let y=0;
      for(let i=0;i<d.length;i++){seed=(seed*1664525+1013904223)>>>0;y+=(seed/2147483648-1-y)*Math.max(.05,1-dark*i/d.length);d[i]=y*Math.pow(1-i/d.length,shape);}
    }
    return ir;
  }
  // layer gains -> dry sum -> soft tape saturation -> duck (dips under gunfire) -> music. Hall, room and a filtered
  // echo run in parallel and return into the duck, so the guns cut through the tails as well.
  function buildScore(){
    const dry=ctx.createGain(),shaper=ctx.createWaveShaper(),curve=new Float32Array(1024);
    for(let i=0;i<curve.length;i++){const x=i/511.5-1;curve[i]=Math.tanh(1.6*x)/Math.tanh(1.6);}
    shaper.curve=curve;shaper.oversample='2x';
    duck=ctx.createGain();dry.connect(shaper);shaper.connect(duck);duck.connect(music);
    const hall=ctx.createConvolver(),hallIn=ctx.createGain(),hallTone=ctx.createBiquadFilter(),hallOut=ctx.createGain();
    hall.buffer=impulse(4.2,2.2,.9,73);hallTone.type='lowpass';hallTone.frequency.value=2400;hallOut.gain.value=.55;
    hallIn.connect(hall);hall.connect(hallTone);hallTone.connect(hallOut);hallOut.connect(duck);
    const room=ctx.createConvolver(),roomIn=ctx.createGain(),roomOut=ctx.createGain();
    room.buffer=impulse(.9,3,.5,91);roomOut.gain.value=.5;roomIn.connect(room);room.connect(roomOut);roomOut.connect(duck);
    const echoIn=ctx.createGain(),fb=ctx.createGain(),fbTone=ctx.createBiquadFilter(),echoOut=ctx.createGain();
    echo=ctx.createDelay(2);echo.delayTime.value=.75;fb.gain.value=.38;fbTone.type='lowpass';fbTone.frequency.value=1100;echoOut.gain.value=.5;
    echoIn.connect(echo);echo.connect(fbTone);fbTone.connect(fb);fb.connect(echo);fbTone.connect(echoOut);echoOut.connect(duck);echoOut.connect(hallIn);
    layers={};
    for(const name of LAYERS){
      const g=ctx.createGain();g.gain.value=name==='sting'?1:MIX[0][name];g.connect(dry);
      SENDS[name].forEach((lvl,i)=>{if(!lvl)return;const send=ctx.createGain();send.gain.value=lvl;g.connect(send);send.connect([hallIn,roomIn,echoIn][i]);});
      layers[name]=g;
    }
    droneBus=ctx.createGain();droneBus.gain.value=MIX[0].drone;droneBus.connect(dry);
    // a survivor going down bypasses the saturation and the duck: the rest of the score is hushed under it
    downBus=ctx.createGain();downBus.gain.value=1;downBus.connect(music);const downSend=ctx.createGain();downSend.gain.value=.5;downBus.connect(downSend);downSend.connect(hallIn);
    const droneSend=ctx.createGain();droneSend.gain.value=.35;droneBus.connect(droneSend);droneSend.connect(hallIn);
  }

  // ---- the instrument kit ----
  function out(gain,bus,pan,nodes){
    if(pan&&ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=pan;gain.connect(p);p.connect(bus);nodes.push(p);}
    else gain.connect(bus);
  }
  // attack, hold, release: the sustained envelope the one-shot `envelope` cannot give a bowed note
  function swellEnv(gain,t,dur,lvl,attack,release){
    const a=Math.min(attack,dur*.6),r=Math.min(release,dur-a);
    gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(lvl,t+a);
    gain.gain.setValueAtTime(lvl,t+dur-r);gain.gain.linearRampToValueAtTime(0,t+dur);
  }
  // a bowed string (or reed, brass, glass): periodic-wave body, a lowpass that opens and closes across the bow,
  // an optional pitch glide, and a vibrato that only arrives once the note has settled
  function bowed(f,t,dur,lvl,bus,o={}){
    const s=osc(o.wave||'cello',f),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),nodes=[filter,gain],cut=Math.min(1400,o.cut||f*4);
    filter.type='lowpass';filter.Q.value=o.q||.9;
    filter.frequency.setValueAtTime(cut*.45,t);filter.frequency.linearRampToValueAtTime(cut,t+dur*.5);filter.frequency.linearRampToValueAtTime(cut*.5,t+dur);
    if(o.glide&&o.glide!==1){s.frequency.setValueAtTime(f,t);s.frequency.exponentialRampToValueAtTime(f*o.glide,t+dur);}
    if(o.detune)s.detune.value=o.detune;
    swellEnv(gain,t,dur,lvl,o.attack??Math.min(.8,dur*.3),o.release??Math.min(1.2,dur*.35));
    s.connect(filter);filter.connect(gain);out(gain,bus,o.pan,nodes);
    if(!voice(s,nodes,t,dur))return;
    if(o.vib&&dur>.8&&voices.size<44){
      const lfo=ctx.createOscillator(),depth=ctx.createGain();lfo.frequency.value=o.vib;
      depth.gain.setValueAtTime(0,t);depth.gain.linearRampToValueAtTime(f*.007,t+Math.min(dur*.5,.9));
      lfo.connect(depth);depth.connect(s.frequency);voice(lfo,[depth],t,dur);
    }
  }
  // spiccato: a short bite with a filter that snaps shut. The engine of every frantic passage.
  function pluck(f,t,lvl,bus,o={}){
    const dur=o.dur||.16,s=osc(o.wave||'cello',f),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),nodes=[filter,gain];
    filter.type='lowpass';filter.Q.value=o.q||2;
    filter.frequency.setValueAtTime(Math.min(1400,f*(o.bright||6)),t);filter.frequency.exponentialRampToValueAtTime(Math.max(60,f*1.2),t+dur);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(lvl,t+.004);gain.gain.exponentialRampToValueAtTime(.0001,t+dur);
    s.connect(filter);filter.connect(gain);out(gain,bus,o.pan,nodes);voice(s,nodes,t,dur);
  }
  // two-operator FM: ratio 1 is a dull detuned piano, 2 a hollow electric piano, 1.41 glass and bowed metal, 2.76 a
  // music box. The modulator only lives while its index is still audible, which halves the voice cost of a phrase.
  function fm(f,t,lvl,bus,o={}){
    const dur=o.dur||2.2,c=ctx.createOscillator(),m=ctx.createOscillator(),mg=ctx.createGain(),gain=ctx.createGain(),filter=ctx.createBiquadFilter(),nodes=[mg,filter,gain];
    c.frequency.value=f;m.frequency.value=f*(o.ratio||1);if(o.detune)c.detune.value=o.detune;
    const index=f*(o.index??1.2),life=Math.max(.08,dur*(o.bright??.35));
    mg.gain.setValueAtTime(index,t);mg.gain.exponentialRampToValueAtTime(Math.max(.01,index*.04),t+life);
    m.connect(mg);mg.connect(c.frequency);
    filter.type='lowpass';filter.frequency.value=o.cut||1400;filter.Q.value=.5;
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(lvl,t+(o.attack||.005));gain.gain.exponentialRampToValueAtTime(.0001,t+dur);
    c.connect(filter);filter.connect(gain);out(gain,bus,o.pan,nodes);
    if(voice(c,nodes,t,dur))voice(m,[],t,life);
  }
  // a ghost choir: one saw through two vowel formants, all of them under the gun band
  function choir(f,t,dur,lvl,bus,o={}){
    const s=ctx.createOscillator(),F=VOWEL[o.vowel||'oo'],a=ctx.createBiquadFilter(),b=ctx.createBiquadFilter(),gain=ctx.createGain(),nodes=[a,b,gain];
    s.type='sawtooth';s.frequency.setValueAtTime(f,t);if(o.glide&&o.glide!==1)s.frequency.exponentialRampToValueAtTime(f*o.glide,t+dur);
    a.type='bandpass';b.type='bandpass';a.frequency.value=F[0];b.frequency.value=F[1];a.Q.value=6;b.Q.value=8;
    s.connect(a);s.connect(b);a.connect(gain);b.connect(gain);swellEnv(gain,t,dur,lvl,dur*.4,dur*.45);out(gain,bus,o.pan,nodes);voice(s,nodes,t,dur);
  }
  // a struck skin: sine body with a fast pitch drop; `skin` adds a short dark thud of noise on top
  function drum(f,t,lvl,bus,o={}){
    const dur=o.dur||.4,s=ctx.createOscillator(),gain=ctx.createGain(),nodes=[gain];s.type='sine';
    s.frequency.setValueAtTime(f*(o.drop||2.2),t);s.frequency.exponentialRampToValueAtTime(f,t+.03);s.frequency.exponentialRampToValueAtTime(f*.7,t+dur);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(lvl,t+.003);gain.gain.exponentialRampToValueAtTime(.0001,t+dur);
    s.connect(gain);out(gain,bus,o.pan,nodes);
    if(voice(s,nodes,t,dur)&&o.skin)noise(.06,lvl*o.skin,500,t,bus,'lowpass');
  }
  function anvil(f,t,lvl,bus){fm(f,t,lvl,bus,{ratio:2.76,index:1.1,dur:.9,bright:.2});noise(.02,lvl*.6,6800,t,bus,'highpass');}
  function tick(t,lvl,bus){noise(.018,lvl,7200,t,bus,'highpass');}
  function heart(f,t,lvl,bus){drum(f,t,lvl,bus,{dur:.2,drop:1.6});drum(f*.9,t+.15,lvl*.62,bus,{dur:.18,drop:1.5});}
  // a rising gesture into a downbeat: dark noise whose filter opens as it grows. A breath in, never a bed.
  function swell(t,dur,lvl,bus){
    const s=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),d=Math.min(1.9,dur);
    s.buffer=noiseBuffer;s.loop=true;filter.type='lowpass';filter.Q.value=3;
    filter.frequency.setValueAtTime(180,t);filter.frequency.exponentialRampToValueAtTime(1300,t+d);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(lvl,t+d*.95);gain.gain.linearRampToValueAtTime(0,t+d);
    s.connect(filter);filter.connect(gain);gain.connect(bus);voice(s,[filter,gain],t,d);
  }
  // The drone is the one voice that never retriggers: two cello bodies on the chord's root and fifth under a slowly
  // breathing filter. A chord change or a new quarter GLIDES it there, which is most of what makes this a place.
  function droneTo(f1,f2,cut,lvl,t,tau){
    if(!drone){
      if(voices.size>42)return;
      const a=osc('cello',f1),b=osc('cello',f2),lfo=ctx.createOscillator(),depth=ctx.createGain(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
      a.detune.value=-5;b.detune.value=6;lfo.frequency.value=.07;depth.gain.value=70;
      filter.type='lowpass';filter.frequency.value=cut;filter.Q.value=1.4;gain.gain.value=0;
      a.connect(filter);b.connect(filter);lfo.connect(depth);depth.connect(filter.frequency);filter.connect(gain);gain.connect(droneBus);
      drone={a,b,filter,gain,sources:[a,b,lfo]};let left=3;
      for(const src of drone.sources){voices.add(src);src.onended=()=>{voices.delete(src);src.disconnect();if(--left===0){depth.disconnect();filter.disconnect();gain.disconnect();}};src.start();}
    }
    drone.a.frequency.setTargetAtTime(f1,t,tau);drone.b.frequency.setTargetAtTime(f2,t,tau);
    drone.filter.frequency.setTargetAtTime(cut,t,tau);drone.gain.gain.setTargetAtTime(lvl,t,Math.max(tau,.3));
  }
  function droneStop(){
    if(!drone)return;const t=ctx.currentTime;drone.gain.gain.setTargetAtTime(0,t,.2);
    for(const src of drone.sources){try{src.stop(t+1);}catch{}}
    drone=null;
  }

  // ---- the six quarters ----
  // R is the bass root (MIDI). Chords are [bass offset, voicing offsets], two bars each. Motifs are [step, offset]
  // over a 32-step phrase. Every offset is semitones above R, and every register here was chosen to stay under
  // 1.5 kHz including FM modulators; `test-score.mjs` checks that for every quarter and state.
  const QUARTERS={
    // South Blocks: where the squad starts and where the gate is. Cold and grieving -- nobody came.
    checkpoint:{R:38,tempo:1,
      chords:[[0,[12,15,19]],[-4,[12,15,20]],[5,[12,17,20]],[7,[14,19,22]]],
      drone:{cut:230,lvl:.1},pad:{wave:'cello',cut:700,lvl:.035},
      motif:{kind:'fm',ratio:1,index:1.2,dur:2.2,lvl:.085,drift:0,
        A:[[0,31],[6,27],[8,26],[16,24],[26,22],[28,24]],B:[[0,27],[4,26],[8,22],[14,19],[16,20],[24,19]]},
      texture:{kind:'bowed',wave:'cello',notes:[19,26],bars:3,bar:1,step:8,lvl:.045,cut:900},
      pulse:{kind:'heart'},
      combat:{drum:'taiko',ost:[0,12,0,7,0,12,0,3,0,12,0,7,0,15,12,10],stab:[12,15]}},
    // Old Quarter: collapsed streets and ghosts. A whole-tone music box that sinks further out of tune every phrase.
    ruins:{R:40,tempo:.9,
      chords:[[0,[12,13,19]],[-4,[12,15,20]],[-2,[14,18,22]],[1,[13,17,20]]],
      drone:{cut:200,lvl:.09},pad:{wave:'reed',cut:520,lvl:.03},
      motif:{kind:'fm',ratio:2.76,index:.55,dur:1.8,lvl:.07,drift:3,
        A:[[0,28],[2,30],[4,32],[8,30],[10,28],[12,24],[20,26],[22,28],[24,26],[28,22]],B:[[0,24],[2,26],[4,28],[8,26],[12,22],[16,20],[24,18],[28,20]]},
      texture:{kind:'choir',vowel:'oo',notes:[24,25],bars:3,bar:2,step:4,lvl:.16,glide:.944},
      pulse:{kind:'knock'},
      combat:{drum:'tom',ost:[0,1,0,12,0,6,0,1,0,12,0,6,0,1,13,12],stab:[13,19]}},
    // Civic Ward: the hospital. Glass bells, a string cluster a semitone wide, and a monitor that is still beeping.
    hospital:{R:35,tempo:1,
      chords:[[0,[12,15,18]],[1,[13,17,20]],[-2,[10,13,17]],[-4,[12,15,20]]],
      drone:{cut:260,lvl:.085},pad:{wave:'glass',cut:900,lvl:.03},
      motif:{kind:'fm',ratio:1.41,index:.8,dur:2.8,lvl:.055,drift:0,
        A:[[0,43],[4,42],[16,43],[20,39]],B:[[0,41],[8,40],[16,36],[24,37]]},
      texture:{kind:'bowed',wave:'glass',notes:[36,37],bars:3,bar:3,step:0,lvl:.022,cut:1400},
      pulse:{kind:'monitor',tick:true},
      combat:{drum:'taiko',ost:[0,1,0,1,12,0,6,0,0,1,0,1,13,12,6,1],stab:[12,18]}},
    // Northline: the radio corridor. Open fifths, a far-off electric piano, and a low SOS in the pulse.
    northline:{R:33,tempo:1.05,
      chords:[[0,[12,19,24]],[-4,[20,27,32]],[-2,[22,29,34]],[7,[19,26,31]]],
      drone:{cut:280,lvl:.1},pad:{wave:'reed',cut:800,lvl:.03},
      motif:{kind:'fm',ratio:2,index:.7,dur:2,lvl:.07,drift:0,
        A:[[0,36],[3,36],[6,43],[16,39],[19,38],[22,36]],B:[[0,34],[3,34],[6,36],[16,31],[24,31]]},
      texture:{kind:'bowed',wave:'reed',notes:[24,31],bars:3,bar:0,step:12,lvl:.028,cut:1000},
      pulse:{kind:'morse'},
      combat:{drum:'taiko',ost:[0,7,12,7,0,7,12,19,0,7,12,7,0,7,14,12],stab:[12,19]}},
    // Ashworks: the foundry. Phrygian-dominant grind, bowed metal and an anvil that keeps an uneven shift.
    industry:{R:41,tempo:.92,
      chords:[[0,[12,13,16]],[-4,[12,15,20]],[6,[12,18,21]],[1,[13,17,20]]],
      drone:{cut:210,lvl:.11},pad:{wave:'brass',cut:450,lvl:.03},
      motif:{kind:'fm',ratio:1.41,index:2,dur:3,lvl:.06,drift:0,A:[[0,24],[12,30],[20,25]],B:[[0,31],[16,30],[24,24]]},
      texture:{kind:'metal',notes:[19,25],bars:2,bar:2,step:0,lvl:.04},
      pulse:{kind:'anvil'},
      combat:{drum:'anvil',ost:[0,0,1,0,6,0,1,0,0,0,1,0,6,7,6,1],stab:[12,18]}},
    // Central Quarantine: final containment. Octatonic, low brass that swells and never lands, an 'ah' choir.
    quarantine:{R:37,tempo:.96,
      chords:[[0,[12,15,18]],[1,[13,16,19]],[6,[18,22,25]],[3,[15,18,21]]],
      drone:{cut:190,lvl:.12},pad:{wave:'brass',cut:500,lvl:.035},
      motif:{kind:'bowed',wave:'brass',cut:700,bars:1.1,lvl:.05,A:[[0,12],[16,13]],B:[[0,18],[16,15]]},
      texture:{kind:'choir',vowel:'ah',notes:[12,13],bars:3,bar:1,step:0,lvl:.18,glide:.97},
      pulse:{kind:'heart',tick:true},
      combat:{drum:'taiko',ost:[0,1,3,1,0,6,4,3,0,1,3,1,0,7,6,4],stab:[12,13,18]}}
  };

  // ---- the director: what state is the squad in ----
  // calm: nothing knows they are here. suspense: something is looking. fight: something has found them, or they are
  // shooting at a crowd. overrun: the horde has arrived. boss: the furnace owns the room.
  const STATES=['calm','suspense','fight','overrun','boss'];
  const STEP=[.25,.18,.107,.094];            // sixteenth length: 60, 83, 140, 160 bpm
  const DWELL=[0,10,6,4];                    // seconds a state must be unjustified before it steps down ONE level
  const MIX=[
    {bed:1, texture:1, motif:1, pulse:0,combat:0,overrun:0,boss:0,drone:1},
    {bed:.7,texture:.8,motif:.45,pulse:1,combat:0,overrun:0,boss:0,drone:1},
    {bed:0, texture:0, motif:0, pulse:0,combat:1,overrun:0,boss:0,drone:.75},
    {bed:0, texture:0, motif:0, pulse:0,combat:1,overrun:1,boss:0,drone:.75},
    {bed:0, texture:0, motif:0, pulse:0,combat:0,overrun:0,boss:1,drone:1}
  ];
  const cond={};
  function resetScore(){
    Object.assign(cond,{state:0,level:0,below:0,step:STEP[0],next:0,n:0,bar:0,q:null,pending:null,cand:null,candAt:0,
      combatAt:-99,contactAt:-99,lastT:0,dead:0,surge:'',boss:{n:0,next:0,phase:1}});
    if(!layers)return;const t=ctx.currentTime;
    for(const k of LAYERS)if(k!=='sting')layers[k].gain.setTargetAtTime(MIX[0][k],t,.05);
    droneBus.gain.setTargetAtTime(MIX[0].drone,t,.05);
  }
  resetScore();
  // Who is near the squad and what they are doing: a headcount inside a screen's reach of anyone still standing
  // (the 330u radius the old score was calibrated on), split by the infected's own AI state.
  function sense(s){
    const all=s.players||[],living=all.filter(p=>!p.dead),c={n:0,alert:0,chase:0,dead:all.length-living.length};
    if(!living.length)return c;
    for(const e of s.enemies||[]){
      if(e.dead)continue;
      for(const p of living){
        const dx=e.x-p.x,dy=e.y-p.y;if(dx*dx+dy*dy>=330*330)continue;
        c.n++;if(e.state==='chase')c.chase++;else if(e.alert||e.state==='investigate'||e.state==='search')c.alert++;
        break;
      }
    }
    return c;
  }
  // `hold` lowers every threshold, so a state is easier to keep than to enter and a boundary cannot flap
  function levelFor(c,now,hold,crest){
    const h=hold?6:0,combat=now-cond.combatAt<4;
    if(!(c.alert||c.chase||combat||c.n>=10-h))return 0;
    if(!(c.chase>=(hold?1:3)||combat||c.n>=30-h))return 1;
    if(c.chase>=45-h||c.n>=60-h||crest&&c.n>=30&&c.chase>=10)return 3;
    return 2;
  }
  function quarterAt(s){
    const W=root.DSWorld,cam=s.camera||{x:0,y:0};let id='checkpoint';
    try{if(W&&W.district)id=W.district(cam.x,cam.y).id;}catch{}
    return QUARTERS[id]?id:'checkpoint';
  }
  const chord=(Q,bar)=>Q.chords[Math.floor(bar/2)%Q.chords.length];
  function retune(Q,bar,t,tau){
    const b=Q.R+chord(Q,bar)[0];
    droneTo(hz(b),hz(b+7),Q.drone.cut*(cond.state>=2?1.7:1),Q.drone.lvl,t,tau);
  }
  // A state change: layers fade at a speed that depends on direction (danger arrives fast, leaves slowly), the
  // tempo moves, and crossing into or out of a fight is scored with its own gesture.
  function enter(st,t,Q){
    const from=cond.state,M=MIX[st],P=MIX[from];
    for(const k of LAYERS){
      if(k==='sting')continue;
      const tau=M[k]>P[k]?(st>=2?.03:.9):st===4?.1:from>=2&&st<2?1.2:.5;
      layers[k].gain.setTargetAtTime(M[k],t,tau);
    }
    droneBus.gain.setTargetAtTime(M.drone,t,.6);
    cond.state=st;
    if(st===4)return;
    cond.step=STEP[st]*Q.tempo;echo.delayTime.setTargetAtTime(Math.min(1.9,cond.step*6),t,.4);
    if(from<2&&st>=2&&t-cond.contactAt>8){cond.contactAt=t;stingContact(Q,t);}
    else if(from>=2&&from<4&&st<2)stingRelease(Q,t);
    retune(Q,cond.bar,t,st>=2?.15:.8);
  }

  // ---- the layers ----
  const ACCENT=[1,0,0,1,0,0,1,0,0,0,1,0,1,0,0,0];
  const KICK=[1,0,0,1,0,0,1,0,0,0,1,0,0,0,1,0];
  const OFFBEAT=[1,0,1,0,1,0,1,1,1,0,1,0,1,1,1,0];
  const SOS=[[0,1],[1,1],[2,1],[4,1.6],[6,1.6],[8,1.6],[11,1],[12,1],[13,1]];
  function writeBed(Q,t,n,bar,st){
    if(n!==0||bar%2)return;
    retune(Q,bar,t,st>=2?.12:.9);
    if(st>1)return;
    const span=cond.step*32;
    chord(Q,bar)[1].slice(-2).forEach((v,i)=>bowed(hz(Q.R+v),t,span+.4,Q.pad.lvl,layers.bed,
      {wave:Q.pad.wave,cut:Q.pad.cut,detune:i?7:-7,pan:i?.4:-.4,attack:Math.min(2.5,span*.35),release:Math.min(2.5,span*.3)}));
  }
  function writeTexture(Q,t,n,bar,st,force){
    const X=Q.texture;
    if(!force&&!(bar%4===X.bar&&n===X.step)){
      if(st===1&&bar%8===7&&n===8)swell(t,cond.step*8,.05,layers.texture);   // suspense breathes in before a phrase
      return;
    }
    const dur=cond.step*16*X.bars;
    X.notes.forEach((v,i)=>{
      const f=hz(Q.R+v),pan=i%2?.55:-.55;
      if(X.kind==='choir')choir(f,t+i*.4,dur,X.lvl,layers.texture,{vowel:X.vowel,glide:X.glide,pan});
      else if(X.kind==='metal')fm(f,t+i*.6,X.lvl,layers.texture,{ratio:2.76,index:.5,dur,attack:dur*.3,bright:1,pan});
      else bowed(f,t+i*.5,dur,X.lvl,layers.texture,{wave:X.wave,cut:X.cut,glide:X.glide,vib:i?0:4.6,pan});
    });
  }
  function writeMotif(Q,t,n,bar,st){
    const phrase=Math.floor(bar/2),p=(bar%2)*16+n,M=Q.motif;
    if(phrase%4===3)return;                       // every fourth phrase is silence
    (phrase%2?M.B:M.A).forEach(([at,v],i)=>{
      if(at!==p||st===1&&i>1)return;             // under suspense only the first two notes survive
      const f=hz(Q.R+v),pan=(i%3-1)*.45;
      if(M.kind==='fm')fm(f,t,M.lvl,layers.motif,{ratio:M.ratio,index:M.index,dur:M.dur,detune:-(phrase%12)*(M.drift||0)+(i%2?4:-4),pan});
      else bowed(f,t,cond.step*16*M.bars,M.lvl,layers.motif,{wave:M.wave,cut:M.cut,vib:4.2,pan});
    });
  }
  function writePulse(Q,t,n,bar){
    const P=Q.pulse,b=Q.R+chord(Q,bar)[0],bus=layers.pulse;
    // a low pizzicato pedal on the off-beats keeps time without ever landing on the beat
    if(n%4===2)pluck(hz(b+12+(n===14&&bar%2?7:0)),t,.05,bus,{dur:.3,bright:2.5,pan:n===6?-.3:.3});
    if(P.tick&&n%4===0)tick(t,.01,bus);
    if(P.kind==='heart'){if(n%8===0)heart(55,t,.2,bus);}
    else if(P.kind==='monitor'){if(n%8===0){heart(55,t,.12,bus);tone(hz(Q.R+48),.09,.028,'sine',t,bus,hz(Q.R+48),.004,.5);}}
    else if(P.kind==='morse'){
      if(bar%2===0)for(const [at,len] of SOS)if(at===n)pluck(hz(Q.R+24),t,.055,bus,{wave:'reed',dur:cond.step*len*.8,bright:4});
      if(bar%2===1&&n===0)heart(55,t,.12,bus);
    }
    else if(P.kind==='anvil'){
      if(n===0||n===6||n===12)anvil(hz(Q.R+24),t,n?.035:.05,bus);
      if(n===0&&bar%2===0)drum(40,t,.2,bus,{dur:1.1,drop:1.4});
    }
    else if(P.kind==='knock'){
      if(n===0||n===3||n===11)drum(n===3?210:160,t,.07,bus,{dur:.07,drop:1.2});
      if(n===8)heart(55,t,.14,bus);
    }
  }
  function hit(kind,Q,t,lvl,bus){
    if(kind==='tom')drum(hz(Q.R+12)*.9,t,lvl,bus,{dur:.22,drop:1.7});
    else if(kind==='anvil'){drum(hz(Q.R),t,lvl,bus,{dur:.35,drop:2.4});}
    else drum(hz(Q.R)*.8,t,lvl,bus,{dur:.5,drop:2.4,skin:.35});
  }
  // frantic: a spiccato ostinato on every sixteenth, accents grouped 3-3-4-2-4 so it never settles, low octave
  // doublings, syncopated drums, fills every fourth bar, brass stabs, and a rising string over the last bar of four
  function writeCombat(Q,t,n,bar,st){
    const C=Q.combat,b=Q.R+chord(Q,bar)[0],bus=layers.combat,acc=ACCENT[n],over=st===3;
    pluck(hz(b+12+C.ost[n]),t,acc?.075:.045,bus,{dur:acc?.16:.1,bright:acc?7:4,pan:n%2?.25:-.25});
    if(acc&&!(over&&n%6))pluck(hz(b+C.ost[n]),t,.06,bus,{dur:.2,bright:3});   // overrun keeps its budget for the off-grid line
    if(bar%4===3&&n>=12)drum(hz(Q.R+12)*(1+(n-12)*.12),t,.16,bus,{dur:.18,drop:1.8,pan:(n-13.5)*.3});
    else if(KICK[n])hit(C.drum,Q,t,n===0?.26:.18,bus);
    if(n===4||n===12){noise(.08,.06,1100,t,bus,'bandpass');drum(190,t,.06,bus,{dur:.09,drop:1.4});}
    if(n%2===1&&!over)tick(t,.011,bus);
    if(C.drum==='anvil'&&n===0)anvil(hz(Q.R+24),t,.05,bus);
    if(n===0&&bar%2===0)C.stab.forEach((v,i)=>bowed(hz(b+v),t,.45,.05,bus,{wave:'brass',cut:1200,attack:.01,release:.3,pan:(i-1)*.4}));
    if(bar%4===3&&n===0)bowed(hz(b+12),t,cond.step*16,.03,bus,{wave:'cello',glide:2,attack:cond.step*13,release:.1,cut:1300});
  }
  // overrun adds a second ostinato in the gaps between the sixteenths, brass cluster blasts and a sub on every bar
  function writeOverrun(Q,t,n,bar){
    const C=Q.combat,b=Q.R+chord(Q,bar)[0],bus=layers.overrun;
    if(OFFBEAT[n])pluck(hz(b+24+C.ost[(n+8)%16]),t+cond.step/2,.032,bus,{dur:.07,bright:3,pan:n%2?.5:-.5});
    if(n===0||n===8&&bar%2===1)[12,13].forEach((v,i)=>bowed(hz(b+v),t,.35,.045,bus,{wave:'brass',cut:900,attack:.005,release:.25,pan:(i-1)*.5}));
    if(n===0)drum(38,t,.22,bus,{dur:1,drop:1.5});
  }

  // ---- stingers: moments, not states ----
  function stingContact(Q,t){
    const L=layers.sting;
    drum(hz(Q.R)*.6,t,.32,L,{dur:1.3,drop:2.2,skin:.5});
    [12,13].forEach((v,i)=>bowed(hz(Q.R+v),t,1.6,.07,L,{wave:'brass',cut:1100,attack:.01,release:1.2,glide:.7,pan:i?.4:-.4}));
    noise(.05,.05,6400,t,L,'highpass');
  }
  function stingRelease(Q,t){
    bowed(hz(Q.R+12),t,4,.05,layers.sting,{wave:'cello',cut:500,glide:.94,attack:.3,release:3});
    drum(hz(Q.R)*.6,t,.12,layers.sting,{dur:1.4,drop:1.3});
  }
  // hush the score under a moment that has to be heard; gunfire cannot lift it early
  function hush(t,depth,hold){if(!duck||musicMuted)return;hushUntil=t+hold;duck.gain.setTargetAtTime(depth,t,.04);duck.gain.setTargetAtTime(1,t+hold,.7);}
  // Level up: a notification, not an alarm. The score steps back, a ring opens far above the guns and a low
  // inharmonic bell tolls twice, the same pitch everywhere so it is learned as one sound. With the music off it still
  // plays, on the effects bus and without the hush.
  function levelChime(t){
    const B=downBus&&!musicMuted?downBus:effects;hush(t,.18,2.2);
    tone(5400,2.8,.03,'sine',t,B,5150,.02,-.2);tone(6100,2.2,.014,'sine',t+.05,B,5900,.03,.25);
    fm(98,t+.02,.2,B,{ratio:1.41,index:2.2,dur:3.4,bright:.5});fm(98,t+1.3,.14,B,{ratio:1.41,index:1.8,dur:3,bright:.5,detune:-30});
    drum(36,t,.3,B,{dur:1.8,drop:2});
  }
  // a wet tearing gush: noise through a narrow bandpass that closes fast, starting under the gun band
  function squelch(t,dur,lvl,bus,from,to,q){
    const s=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    s.buffer=noiseBuffer;s.loop=true;filter.type='bandpass';filter.Q.value=q||5;
    filter.frequency.setValueAtTime(from,t);filter.frequency.exponentialRampToValueAtTime(to,t+dur);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(lvl,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+dur);
    s.connect(filter);filter.connect(gain);gain.connect(bus);voice(s,[filter,gain],t,dur);
  }
  // A survivor going down: a kill landing, told in about a second and a half. A detuned saw pair slashes down with
  // blade air above it; the cut itself is wet -- two bandpass gushes closing downward and a throat-like gloop; the
  // body hits the ground with a thud and a splatter; and the drama arrives after it: a dying breath on an 'ah' choir
  // falling a fifth over a low minor-second saw cluster and a sub boom. Fixed pitches everywhere; its own bus past
  // the duck with the score hushed, or the effects bus when the music is off.
  function stingDown(t){
    const B=downBus&&!musicMuted?downBus:effects;hush(t,.2,1.5);
    [880,932.3].forEach((f,i)=>bowed(f,t,.34,.075,B,{wave:'sawtooth',cut:1400,glide:.07,attack:.004,release:.24,pan:i?.3:-.3}));
    noise(.22,.035,5400,t,B,'highpass');
    squelch(t+.08,.24,.42,B,1300,260,5);squelch(t+.17,.32,.34,B,900,170,6);tone(330,.2,.12,'sine',t+.12,B,72,.004);
    drum(50,t+.34,.42,B,{dur:.55,drop:3.2,skin:1});noise(.14,.12,280,t+.34,B,'lowpass');
    squelch(t+.35,.1,.26,B,720,200,4);squelch(t+.42,.13,.2,B,520,150,4);squelch(t+.55,.08,.14,B,1100,380,5);
    drum(62,t+.53,.14,B,{dur:.2,drop:2});
    choir(220,t+.3,1.2,.3,B,{vowel:'ah',glide:.667});
    [73.42,77.78,110].forEach((f,i)=>bowed(f,t+.34,1.6,.06,B,{wave:'sawtooth',cut:700,attack:.02,release:1.2,glide:.8,pan:(i-1)*.45}));
    drum(30,t+.34,.3,B,{dur:1.4,drop:2.5});
  }
  // Full wipe: a dramatic synth hit that echoes into the dark. A detuned saw chord (D minor with the flat second the
  // score leans on) struck over a sub boom, then repeated six times, each echo quieter, darker and further across
  // the stereo field, under a long low saw that sinks. The score has already stopped, so it has the room alone.
  function wipe(t){
    drum(30,t,.42,effects,{dur:2.4,drop:3,skin:.8});noise(.5,.1,240,t,effects,'lowpass');
    bowed(36.71,t,3.8,.1,effects,{wave:'sawtooth',cut:220,glide:.84,attack:.01,release:3});
    for(let k=0;k<7;k++){
      const at=t+k*.36,lvl=.075*Math.pow(.6,k),cut=1400*Math.pow(.66,k),pan=k?(k%2?.6:-.6):0;
      [73.42,110,174.61,77.78].forEach((f,i)=>bowed(f,at,k?.3:.42,lvl*(i===3?.6:1),effects,{wave:'sawtooth',cut,attack:.004,release:.24,detune:i%2?9:-9,pan}));
    }
  }
  function stingCrest(Q,t){swell(t,.9,.07,layers.sting);anvil(hz(Q.R+24),t+.9,.07,layers.sting);}

  // ---- the conductor ----
  function score(s,events){
    if(!layers)return;
    const now=ctx.currentTime,c=sense(s),dt=Math.min(.25,Math.max(0,now-cond.lastT)),crest=s.surge==='CREST';cond.lastT=now;
    for(const e of events)if(e.type==='hurt'||e.type==='explosion'||e.type==='shot'&&c.n>0)cond.combatAt=now;
    // intensity: climb at once, fall one level at a time and only after the danger has been gone for a while
    const up=levelFor(c,now,false,crest),hold=levelFor(c,now,true,crest);
    if(up>cond.level){cond.level=up;cond.below=0;}
    else if(hold<cond.level){cond.below+=dt;if(cond.below>=DWELL[cond.level]){cond.level--;cond.below=0;}}
    else cond.below=0;
    // quarter: the camera has to stay in a new one for three seconds; the switch itself waits for a bar line
    const here=quarterAt(s);
    if(!cond.q)cond.q=here;
    else if(here===cond.q||here===cond.pending)cond.cand=null;
    else if(here!==cond.cand){cond.cand=here;cond.candAt=now;}
    else if(now-cond.candAt>=3){cond.pending=here;cond.cand=null;}
    let Q=QUARTERS[cond.q];
    if(s.boss?.active){if(cond.state!==4)enter(4,now,Q);furnace(s);return;}
    if(cond.state===4){enter(Math.min(cond.level,3),now+.05,Q);cond.n=0;cond.next=now+.05;}
    if(s.surge!==cond.surge){if(crest&&cond.state>=2)stingCrest(Q,now+.03);cond.surge=s.surge;}
    if(cond.next<now-.25)cond.next=now+.03;
    while(cond.next<now+.12){
      const t=cond.next;
      // danger lands on the next beat and restarts the bar there; relief waits for the bar line
      if(cond.level>cond.state&&cond.n%4===0){if(cond.n)cond.bar++;cond.n=0;enter(cond.level,t,Q);}
      else if(cond.level<cond.state&&cond.n===0)enter(cond.level,t,Q);
      if(cond.n===0&&cond.pending){
        cond.q=cond.pending;cond.pending=null;Q=QUARTERS[cond.q];
        cond.step=STEP[cond.state]*Q.tempo;retune(Q,cond.bar,t,1.5);
        if(cond.state<2)writeTexture(Q,t,0,cond.bar,cond.state,true);   // arriving somewhere new is heard at once
      }
      const n=cond.n,bar=cond.bar,st=cond.state;
      writeBed(Q,t,n,bar,st);
      if(st<2){writeTexture(Q,t,n,bar,st);writeMotif(Q,t,n,bar,st);}
      if(st===1)writePulse(Q,t,n,bar);
      if(st>=2)writeCombat(Q,t,n,bar,st);
      if(st===3)writeOverrun(Q,t,n,bar);
      if(++cond.n===16){cond.n=0;cond.bar++;}
      cond.next+=cond.step;
    }
  }

  // ---- The Patient Furnace ----
  // Its own piece, not the city score played faster. One F pedal that never moves, a lurching twelve-step three,
  // a choir and a brass bellows breathing once a bar, iron on iron. Its palette is the minor second and the tritone;
  // nothing in it resolves, because the thing in the middle of the city is not going anywhere.
  const FURNACE=43.654,HAMMER=[0,6],HAMMER_OPEN=[0,3,6,9];
  function furnace(s){
    const b=s.boss||{},phase=Math.max(1,Math.min(3,b.phase||1)),waking=!!(b.ai&&b.ai.mode==='intro');
    const R=FURNACE,B=layers.boss,K=cond.boss,step=.34-(phase-1)*.022,now=ctx.currentTime;
    // each phase change lands as one detuned shove
    if(phase!==K.phase){
      K.phase=phase;drum(R,now+.02,.3,layers.sting,{dur:1.8,drop:2.5,skin:.5});
      [4,4*1.0595].forEach((m,i)=>bowed(R*m,now+.02,1.9,.06,layers.sting,{wave:'brass',cut:900,attack:.01,release:1.5,glide:.8,pan:i?.4:-.4}));
    }
    if(K.next<now-.25)K.next=now+.03;
    while(K.next<now+.12){
      const t=K.next,n=K.n%12,bar=Math.floor(K.n/12);
      if(n===0){
        droneTo(R,R*2,150+phase*90,.12,t,.5);
        choir(R*2,t,step*11,.22+phase*.03,B,{vowel:'oh'});
        bowed(R*4,t,step*11.5,.03+phase*.008,B,{wave:'brass',cut:260+phase*160,vib:3.2});
      }
      // while it is still waking the piece only breathes
      if(!waking){
        if((phase>1?HAMMER_OPEN:HAMMER).indexOf(n)>=0){anvil(R*8,t,.05+phase*.01,B);drum(R*1.2,t,.22,B,{dur:.5,drop:2.6,skin:.3});}
        if(phase>1&&(n===4||n===10))bowed(R*4*1.4142,t,step*2.6,.045,B,{wave:'cello',cut:900,vib:5,pan:n===4?-.45:.45});
        if(phase>1&&n===8)bowed(R*2*1.0595,t,step*3.2,.04,B,{wave:'cello',cut:600});
        if(phase>1&&n%2===1)pluck(R*4*(n%4===1?1:1.0595),t,.04,B,{dur:.14,bright:4,pan:n%4===1?-.3:.3});
        if(phase>2&&n%2===1)noise(.03,.018,5200+((K.n*37)%900),t,B,'highpass');   // the cauldron rattles loose
        if(phase>2&&(n===0||n===6))[4,4*1.0595,4*1.4142].forEach((m,i)=>bowed(R*m,t,.4,.035,B,{wave:'brass',cut:1000,attack:.005,release:.3,pan:(i-1)*.4}));
        if(phase>1&&n===2){const slide=Math.pow(1.0595,-(bar%4)/3);bowed(R*16*slide,t,step*3.4,.018+phase*.004,B,{wave:'glass',cut:1400,glide:1/1.0595,pan:bar%2?.6:-.6});}
      }
      K.n++;K.next+=step;
    }
  }
  function stopEngine(id,engine){
    engines.delete(id);const t=ctx.currentTime;
    engine.gain.gain.setTargetAtTime(0,t,.02);
    for(const source of engine.sources){try{source.stop(t+.08);}catch{}}
  }
  function updateEngines(s){
    const active=(s.vehicles||[]).filter(v=>v.driver!=null&&!v.dead&&v.fuel>0);
    for(const [id,engine] of engines)if(!active.some(v=>v.id===id))stopEngine(id,engine);
    for(const v of active){
      let engine=engines.get(v.id);
      if(!engine){
        if(voices.size>46)continue;
        const motor=ctx.createOscillator(),rumble=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
        motor.type=(ENGINE[v.vehicleType]||ENGINE.sedan).wave;rumble.buffer=noiseBuffer;rumble.loop=true;filter.type='lowpass';filter.Q.value=.7;gain.gain.value=0;
        motor.connect(filter);rumble.connect(filter);filter.connect(gain);gain.connect(effects);
        engine={motor,filter,gain,sources:[motor,rumble]};engines.set(v.id,engine);
        let remaining=2;
        for(const source of engine.sources){voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();if(--remaining===0){filter.disconnect();gain.disconnect();}};source.start();}
      }
      const E=ENGINE[v.vehicleType]||ENGINE.sedan,rev=Math.max(0,Math.min(1,Math.abs(v.speed)/E.top)),distance=Math.hypot(v.x-(s.camera?.x||0),v.y-(s.camera?.y||0)),t=ctx.currentTime,near=Math.max(0,1-distance/1600);
      engine.motor.frequency.setTargetAtTime(E.base+rev*E.range,t,.08);
      engine.filter.frequency.setTargetAtTime(E.cut+rev*E.open,t,.08);
      engine.gain.gain.setTargetAtTime((E.level+rev*E.level)*near/Math.sqrt(active.length),t,.06);
      // tracks: a dull clank train whose rate follows speed, skipped when the voice budget is tight
      if(E.clatter&&rev>.05&&near>0&&t>=(engine.nextClank||0)&&voices.size<44){engine.nextClank=t+.34-rev*.22;noise(.035,.05*near,520,t,effects,'lowpass');tone(62,.05,.04*near,'square',t,effects,48);}
    }
  }
  // ---- persistent city loops: the chapel generator and Ashworks fire ----
  // At most one of each; every loop is a looping noise source (plus a hum oscillator where it has one) under a
  // filter and gain. Gains follow real state and distance from the camera; stopVoices releases all of them.
  function makeLoop(id,cut,kind,hum){
    if(voices.size>44)return null;
    const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),sources=[src];src.buffer=noiseBuffer;src.loop=true;
    filter.type=kind;filter.frequency.value=cut;filter.Q.value=.7;gain.gain.value=0;src.connect(filter);filter.connect(gain);gain.connect(effects);
    let osc=null,humGain=null;if(hum){osc=ctx.createOscillator();humGain=ctx.createGain();osc.type='sine';osc.frequency.value=hum;humGain.gain.value=0;osc.connect(humGain);humGain.connect(effects);sources.push(osc);}
    const loop={id,src,osc,filter,gain,humGain,sources};loops.set(id,loop);let remaining=sources.length;
    for(const source of sources){voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();if(--remaining===0){filter.disconnect();gain.disconnect();humGain&&humGain.disconnect();}};source.start();}
    return loop;
  }
  function stopLoop(id){const loop=loops.get(id);if(!loop)return;loops.delete(id);const t=ctx.currentTime;loop.gain.gain.setTargetAtTime(0,t,.05);loop.humGain&&loop.humGain.gain.setTargetAtTime(0,t,.05);for(const x of loop.sources){try{x.stop(t+.25);}catch{}}}
  function setLoop(id,want,cut,kind,hum,level,humLevel){
    if(!want){stopLoop(id);return;}
    const loop=loops.get(id)||makeLoop(id,cut,kind,hum);if(!loop)return;const t=ctx.currentTime;
    loop.filter.type=kind;loop.filter.frequency.setTargetAtTime(cut,t,.6);loop.gain.gain.setTargetAtTime(level,t,1.2);
    if(loop.osc){loop.osc.frequency.setTargetAtTime(hum||loop.osc.frequency.value,t,.6);loop.humGain.gain.setTargetAtTime(humLevel||0,t,1.2);}
  }
  function anchorPoint(s,kind){for(const b of s.world?.buildings||[])for(const a of b.anchors||[])if(a.kind===kind)return a;return null;}
  function updateLoops(s){
    const cam=s.camera||{x:0,y:0},world=s.world;if(!world){for(const id of [...loops.keys()])stopLoop(id);return;}
    // the restored generator hums near the chapel only while the circuit is live
    const gen=anchorPoint(s,'chapelGenerator'),gd=gen?Math.hypot(gen.x-cam.x,gen.y-cam.y):1e9;
    setLoop('generator',!!(s.circuit&&s.circuit.emergency)&&gd<900,240,'lowpass',48,.03*Math.max(0,1-gd/900),.02*Math.max(0,1-gd/900));
    // real fire only: the nearest still-burning wreck (Ashworks) crackles; cold wrecks never do
    let fd=1e9;for(const o of world.obstacles||[])if(o.burning&&!(o.hp<=0)){const d=Math.hypot(o.x+o.w/2-cam.x,o.y+o.h/2-cam.y);if(d<fd)fd=d;}
    setLoop('fire',fd<700,1400,'bandpass',0,.03*Math.max(0,1-fd/700));
  }
  // ---- city_v2 Section 5: source-bound incidental sounds ----
  // Never a continuous bed (the district ambience and static were removed at the user's request, AUDIO.md): each
  // district has one sparse, short one-shot tied to a real object near the camera, and only in the condition that
  // object is in (a transformer buzzes only on a live circuit, hot metal pings only by a still-burning wreck). Long
  // random gaps keep moments of quiet; nothing here makes simulation noise, and a busy mix (40+ voices) skips them.
  const INCIDENTAL=[
    {id:'streetMetal',district:'checkpoint',gap:[11,22],reach:520,match:o=>/^props.(dumpster|binSmall|newsBox|phoneBooth)$/.test(o.art||'')},
    {id:'terraceWind',district:'ruins',gap:[13,26],reach:620,match:o=>o.collapsed},
    {id:'ventilation',district:'hospital',gap:[12,24],reach:560,match:o=>o.archetypeId==='hospital'||o.archetypeId==='clinic'},
    {id:'transformer',district:'northline',gap:[10,20],reach:520,match:o=>o.locationId==='utility-yard',when:s=>!!(s.circuit&&s.circuit.emergency)},
    {id:'mastWind',district:'northline',gap:[14,28],reach:700,match:o=>o.kind==='radio'},
    {id:'hotMetal',district:'industry',gap:[8,16],reach:560,match:o=>o.burning&&!(o.hp<=0)},
    {id:'fenceRattle',district:'quarantine',gap:[12,24],reach:520,match:o=>o.type==='fence'||o.type==='gate'}
  ];
  const incidentalNext=new Map(),incidentalSources=new WeakMap();let incidentalPlayed=0,incidentalPrimed=false;
  function incidentalPool(world){
    let pool=incidentalSources.get(world);if(pool)return pool;pool={};
    const all=[...(world.obstacles||[]),...(world.props||[]),...(world.buildings||[]),...(world.setpieces||[])],W=root.DSWorld;
    for(const k of INCIDENTAL)pool[k.id]=all.filter(o=>k.match(o)).map(o=>({o,x:o.x+(o.w||0)/2,y:o.y+(o.h||0)/2})).filter(q=>!W||W.district(q.x,q.y).id===k.district);
    incidentalSources.set(world,pool);return pool;
  }
  function playIncidental(id,pan,near){
    const t=ctx.currentTime+.02,l=.6+.4*near;
    if(id==='streetMetal'){tone(1240,.06,.012*l,'triangle',t,effects,980,.002,pan);noise(.05,.01*l,3200,t,effects,'bandpass');tone(620,.14,.008*l,'triangle',t+.09,effects,590,.002,pan);}
    else if(id==='terraceWind'){noise(1.6,.012*l,520,t,effects,'bandpass');noise(1.1,.006*l,900,t+.5,effects,'bandpass');}
    else if(id==='ventilation'){tone(174,.5,.01*l,'triangle',t,effects,163,.08,pan);tone(174,.35,.008*l,'triangle',t+.62,effects,120,.05,pan);}
    else if(id==='transformer'){tone(100,1.1,.012*l,'square',t,effects,100,.2,pan);tone(200,1.1,.004*l,'sine',t,effects,200,.2,pan);}
    else if(id==='mastWind'){tone(880,1.4,.004*l,'sine',t,effects,960,.5,pan);noise(1.4,.008*l,1400,t,effects,'bandpass');}
    else if(id==='hotMetal'){tone(2100,.09,.008*l,'sine',t,effects,2050,.002,pan);tone(1650,.12,.006*l,'sine',t+.37,effects,1600,.002,pan);}
    else if(id==='fenceRattle'){for(let i=0;i<4;i++)noise(.035,.009*l*(1-i*.18),2600,t+i*.06,effects,'bandpass');}
    incidentalPlayed++;
  }
  function updateIncidentals(s){
    const world=s.world;if(!world||s.boss?.active)return;const cam=s.camera||{x:0,y:0},now=ctx.currentTime,pool=incidentalPool(world);
    if(incidentalPrimed){incidentalPrimed=false;for(const k of INCIDENTAL)incidentalNext.set(k.id,0);}
    for(const k of INCIDENTAL){
      if(!incidentalNext.has(k.id)){incidentalNext.set(k.id,now+k.gap[0]*Math.random());continue;}
      if(now<incidentalNext.get(k.id))continue;
      incidentalNext.set(k.id,now+k.gap[0]+(k.gap[1]-k.gap[0])*Math.random());
      if(voices.size>40||k.when&&!k.when(s))continue;
      let best=null,bd=k.reach;for(const q of pool[k.id]){if(q.o.hp!=null&&q.o.hp<=0&&!q.o.collapsed)continue;const d=Math.hypot(q.x-cam.x,q.y-cam.y);if(d<bd){bd=d;best=q;}}
      if(!best||k.id==='hotMetal'&&!(best.o.burning&&!(best.o.hp<=0)))continue;
      playIncidental(k.id,Math.max(-.8,Math.min(.8,(best.x-cam.x)/500)),1-bd/k.reach);
    }
  }
  // test hook: schedule every incidental kind for the next update
  function primeIncidentals(){incidentalPrimed=true;}
  function stopVoices(){engines.clear();loops.clear();incidentalNext.clear();drone=null;for(const source of voices){try{source.stop();}catch{}}cond.next=0;cond.boss.next=0;}
  // gunfire and blasts push the whole score down for a moment so the shots cut through it and its tails
  function duckFor(type){
    if(!duck||type!=='shot'&&type!=='explosion')return;
    const t=ctx.currentTime;if(t<hushUntil||t-lastDuck<.06)return;lastDuck=t;
    duck.gain.setTargetAtTime(type==='explosion'?.55:.75,t,.015);duck.gain.setTargetAtTime(1,t+.09,.3);
  }
  function update(s){
    const events=s.audioEvents.splice(0);
    if(s!==lastState){stopVoices();resetScore();lastState=s;lastMode=s.mode;lastBoss=false;lastWave=1;lastDead=0;cooldowns.clear();}
    const active=s.mode==='play'&&!s.paused&&!document.hidden;
    if(!ctx||ctx.state!=='running')return;
    if(active!==running){running=active;master.gain.setTargetAtTime(muted||!active?0:.65,ctx.currentTime,.035);if(!active)stopVoices();}
    if(!muted&&active){
      updateEngines(s);updateLoops(s);updateIncidentals(s);
      // a survivor going down is gameplay information: it sounds with the music on or off
      const dead=(s.players||[]).filter(p=>p.dead).length;if(dead>lastDead)stingDown(ctx.currentTime+.03);lastDead=dead;
      if(!musicMuted)score(s,events);else droneStop();
      for(const event of events){duckFor(event.type);cue(event.type,event.detail);}
      if(s.boss?.active&&!lastBoss)cue('boss');
      if(s.wave>lastWave)cue('wave');
    }
    if(!muted&&s.mode!==lastMode&&(s.mode==='won'||s.mode==='lost')&&!document.hidden){master.gain.setTargetAtTime(.65,ctx.currentTime,.035);cue(s.mode);}
    lastBoss=!!s.boss?.active;lastWave=s.wave;lastMode=s.mode;
  }
  function toggleMute(){
    muted=!muted;try{localStorage.setItem('dead-signal-muted',String(muted));}catch{}
    if(ctx){master.gain.setTargetAtTime(muted||!running?0:.65,ctx.currentTime,.025);if(muted)stopVoices();}
    return muted;
  }
  function toggleMusic(){
    musicMuted=!musicMuted;try{localStorage.setItem('dead-signal-music-muted',String(musicMuted));}catch{}
    if(ctx)music.gain.setTargetAtTime(musicMuted?0:.48,ctx.currentTime,.025);
    return musicMuted;
  }
  root.DSAudio={unlock,update,toggleMute,toggleMusic,primeIncidentals,INCIDENTAL:INCIDENTAL.map(k=>k.id),QUARTERS:Object.keys(QUARTERS),STATES,
    get muted(){return muted;},get musicMuted(){return musicMuted;},
    // test and bench hook: the layer gains (plus the drone bus) every score voice routes through
    get musicBus(){return layers&&Object.assign({drone:droneBus,down:downBus},layers);},
    get status(){return {state:ctx?.state||'locked',voices:voices.size,engines:engines.size,loops:[...loops.keys()],incidentals:incidentalPlayed,muted,musicMuted,musicState:STATES[cond.state],quarter:cond.q};}};
})(typeof window!=='undefined'?window:globalThis);
