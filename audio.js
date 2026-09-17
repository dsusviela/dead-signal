(function(root){
  'use strict';
  // Original procedural score and effects. Two prebuilt buffers (noise, and a reverb impulse cut from the same
  // source), bounded voices, short lookahead: no downloads, timers, or audio work in the simulation.
  let ctx=null,master=null,music=null,effects=null,noiseBuffer=null,muted=false,musicMuted=false,reverb=null;
  let nextBeat=0,beat=0,lastState=null,lastMode='',lastBoss=false,lastWave=1,running=false,heat=0,surge='',stinger=0;
  let tracks=null,bossBeat=0,nextBossBeat=0,lastPhase=1,tier=0;
  // one independent clock per song, so a piece that is fading out keeps its own place
  const clock=[{beat:0,next:0},{beat:0,next:0},{beat:0,next:0},{beat:0,next:0}];
  const voices=new Set(),cooldowns=new Map(),engines=new Map(),loops=new Map();
  // Engine voices per vehicle type (CITY.md Phase 12A): a diesel truck is a lower square-wave motor with a darker
  // filter; the bulldozer is lower still and adds track clatter while it moves. Pitch follows speed / top speed.
  const ENGINE={sedan:{wave:'sawtooth',base:38,range:62,cut:140,open:480,level:.035,top:300},
    fireTruck:{wave:'square',base:27,range:36,cut:110,open:300,level:.045,top:230},
    bulldozer:{wave:'square',base:22,range:24,cut:90,open:220,level:.05,top:95,clatter:true}};
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
        // A decaying-noise impulse turns the music bus into a room. The score is sparse by design, and the tail is
        // what makes that sparseness read as a place instead of a test tone. Wet runs parallel to the dry bus.
        const ir=ctx.createBuffer(2,Math.floor(ctx.sampleRate*2.4),ctx.sampleRate);
        for(let c=0;c<2;c++){
          const tail=ir.getChannelData(c);
          for(let i=0;i<tail.length;i++){seed=(seed*1664525+1013904223)>>>0;tail[i]=(seed/2147483648-1)*Math.pow(1-i/tail.length,2.6);}
        }
        reverb=ctx.createConvolver();reverb.buffer=ir;
        const wet=ctx.createGain();wet.gain.value=.3;music.connect(reverb);reverb.connect(wet);wet.connect(master);
        // Five songs on the music bus, one gain each: explore / prowl / fight / swarm / furnace. Only one
        // is up at a time; a threat change crossfades between two of them. They are separate pieces,
        // not layers of one arrangement, so a swap changes the music rather than its density.
        tracks=[];
        for(let i=0;i<5;i++){const g=ctx.createGain();g.gain.value=i===0?1:0;g.connect(music);tracks.push(g);}
      }
      if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    }catch{}
  }
  function voice(source,nodes,at,duration){
    if(voices.size>=48){source.disconnect();nodes.forEach(n=>n.disconnect());return;}
    voices.add(source);
    source.onended=()=>{voices.delete(source);source.disconnect();nodes.forEach(n=>n.disconnect());};
    source.start(at);source.stop(at+duration+.025);
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
    }else if(type==='level'||type==='won'){
      [196,293.66,392,587.33].forEach((f,i)=>tone(f,.5,.11,'triangle',t+i*.14));
    }else if(type==='boss'||type==='lost'){
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
  // Two detuned saws under a lowpass that opens and closes across the note: the body the all-sine score never had.
  // The pair shares one filter and gain, so only the second oscillator is handed the cleanup job.
  function pad(freq,duration,level,cutoff,at,detune,bus){
    const filter=ctx.createBiquadFilter(),gain=ctx.createGain(),osc=[];
    filter.type='lowpass';filter.Q.value=5;
    filter.frequency.setValueAtTime(Math.max(90,cutoff*.5),at);
    filter.frequency.linearRampToValueAtTime(Math.max(120,cutoff),at+duration*.5);
    filter.frequency.linearRampToValueAtTime(Math.max(90,cutoff*.45),at+duration);
    envelope(gain,at,duration,level,duration*.35);filter.connect(gain);gain.connect(bus||music);
    for(const d of [-detune,detune]){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=freq;o.detune.value=d;o.connect(filter);osc.push(o);}
    voice(osc[0],[],at,duration);voice(osc[1],[filter,gain],at,duration);
  }
  // How many infected are actually coming for the squad right now: a raw headcount inside a screen's
  // reach of anyone still standing, counted rather than summed by distance. What the music needs to know
  // is how many things are closing, not how far away they are. Read opportunistically -- the score must
  // never be the thing that throws out of a frame.
  function headcount(s){
    const living=(s.players||[]).filter(p=>!p.dead);if(!living.length)return 0;
    let n=0;
    for(const e of s.enemies||[]){
      if(e.dead)continue;
      for(const p of living){const dx=e.x-p.x,dy=e.y-p.y;if(dx*dx+dy*dy<330*330){n++;break;}}
    }
    return n;
  }
  // Calibrated against six minutes of real play with four survivors: the headcount inside 330u runs
  // p25 36 / median 46 / p75 55 / p95 82, and climbs across a run (median 12 in the first minute,
  // 57 by the sixth). The first version of this divided by 9 and by 14, which pinned both the combat
  // layer and `heat` at full for 93% of the game -- the music was adaptive on paper and a flat wall in
  // the room. 70 puts the median just past half scale, a heavy fight near the top, a quiet street at nothing.
  const CROWD_FULL=70;
  function pressure(s){return Math.min(1,headcount(s)/CROWD_FULL);}
  // That headcount also decides how HARD the change is. A slow drift between layers is the city
  // breathing; nine infected rounding a corner has to land NOW, or the music is scoring the moment that
  // has already gone. So the crossfade time constant comes from the size of the jump -- a big swing
  // snaps over in a breath, a small one takes its time.
  // tau may be forced, for the one transition whose pacing is dramatic rather than reactive: the furnace.
  function fade(param,target,now,tau){
    const span=Math.abs(target-param.value);
    param.setTargetAtTime(target,now,tau??(span>.5?.07:span>.25?.3:1.3));
  }
  // Three sixteen-step figures over the same D minor with a flattened second, built from one palette: the octave,
  // the flat second (x2.119), the minor third (x2.378), the fifth (x2.996/3) and two octaves. Which one is playing
  // turns over with the wave and the phrase, so the line a player has had in their ear for a minute gives way to
  // another instead of looping unchanged to the end of the run.
  const FIGURES=[
    [2,0,3,0,2.996,0,2.378,0,2,0,0,4,2.119,0,0,0],
    [2,0,0,2.378,0,0,2.996,0,0,3,0,0,2.119,0,2,0],
    [0,0,2.119,0,2.996,0,0,2.378,0,0,3,0,2,0,0,4]
  ];
  // ---- The score is five separate pieces, not one arrangement with layers ----
  // A threat tier picks which song is playing; the others are silent. Crossfades replace one
  // piece with another the way a game score does, rather than adding and removing instruments
  // from a single bed. Each song has its own tempo, its own centre and its own instrumentation,
  // so what changes when the street turns is the MUSIC, not the density.
  //
  // Tiers are calibrated to six minutes of measured play (headcount inside 330u of a survivor:
  // p25 36, median 46, p75 55, p95 82, climbing from a median of 12 in the first minute to 57
  // by the sixth). So a run walks up through PROWL -> FIGHT -> SWARM on its own, and shaking
  // the horde off on a backtrack drops it to EXPLORE, which is the whole point of the chain.
  const TIERS=[
    {id:'explore',up:10,step:.34},   // 0-9    the empty city
    {id:'prowl',  up:30,step:.27},   // 10-29  something is out there
    {id:'fight',  up:55,step:.21},   // 30-54  contact
    {id:'swarm',  up:1e9,step:.165}  // 55+    overrun
  ];
  const HYST=6;   // must clear a threshold by this much to climb, and drop this far below to fall back
  function tierFor(n,cur){
    let t=0;
    while(t<TIERS.length-1&&n>=TIERS[t].up)t++;
    // hysteresis: hold the current song unless the count has moved decisively out of its band
    if(t>cur&&n<TIERS[t-1].up+HYST)t=cur;
    if(t<cur&&n>=TIERS[t].up-HYST)t=cur;
    return t;
  }
  // A song swap is a musical event, so it takes musical time -- but the further the threat
  // jumped, the less time the music is allowed to take about it.
  function swapTau(jump){return jump>=3?.35:jump===2?.8:1.6;}

  function score(s){
    if(!tracks)return;
    const boss=!!s.boss?.active,now=ctx.currentTime,crowd=headcount(s);
    const want=boss?4:tierFor(crowd,tier<4?tier:0);
    if(want!==tier){
      // the furnace always takes the room fast; everything else fades by how far it jumped
      const tau=want===4?.12:tier===4?1.2:swapTau(Math.abs(want-tier));
      for(let i=0;i<5;i++)tracks[i].gain.setTargetAtTime(i===want?1:0,now,tau);
      tier=want;
    }
    heat+=(Math.min(1,(s.threat-1)*.1+pressure(s)*.72+(boss?.5:0))-heat)*.05;
    // every song that is still audible keeps playing, so a crossfade is two pieces overlapping
    for(let i=0;i<5;i++)if(i===tier||tracks[i].gain.value>.01)SONG[i](s,tracks[i],TIERS[i]?TIERS[i].step:0);
  }

  // ---- 0. EXPLORE -- the empty city -------------------------------------------------
  // Sparse, slow, four roots turning over. Nothing drives; the room and the reverb tail do the
  // work. This is the only song with real silence in it.
  function songExplore(s,B,step){
    const c=clock[0],roots=[73.416,65.406,58.270,77.782],ebb=s.surge==='EBB';
    if(s.surge!==surge){if(s.surge==='CREST')stinger=1;surge=s.surge;}
    if(c.next<ctx.currentTime-.25)c.next=ctx.currentTime+.025;
    while(c.next<ctx.currentTime+.12){
      const t=c.next,R=roots[Math.floor(c.beat/16)%4],n=c.beat%16,bar=Math.floor(c.beat/16);
      const fig=FIGURES[(Math.max(1,s.wave||1)-1+Math.floor(c.beat/128))%FIGURES.length];
      const swing=n%2?step*.055:0;
      if(n===0){
        tone(R/2,step*15,.16,'sine',t,B,R/2,.18);tone(R*1.005,step*13,.035,'triangle',t,B,R,.2);
        pad(R,step*15.5,.05,300,t,7,B);
      }
      if(stinger&&n%4===0){
        tone(R*2.828,step*3.4,.07,'triangle',t,B,R*2.669,.02);
        tone(R*1.414,step*4.2,.045,'sawtooth',t,B,R*1.335,.04);
        noise(.55,.045,260,t,B,'bandpass');stinger=0;
      }
      if(fig[n])tone(R*fig[n],.7,.038,'sine',t+swing,B,R*fig[n],.015,n%4===0?0:n%8<4?-.55:.55);
      if(n===14)noise(.22,.025,700,t,B,'bandpass');
      if(n===6&&bar%4===3&&!ebb)noise(1.5,.028,420,t,B,'bandpass');
      c.beat++;c.next+=step;
    }
  }

  // ---- 1. PROWL -- something is out there --------------------------------------------
  // Faster, but still no downbeat: a heartbeat on 0 and 6 that refuses to settle into a pulse,
  // and a flat second leaning on the root. Tension without drive -- the song for being hunted
  // rather than fighting.
  function songProwl(s,B,step){
    const c=clock[1];
    if(c.next<ctx.currentTime-.25)c.next=ctx.currentTime+.025;
    while(c.next<ctx.currentTime+.12){
      const t=c.next,n=c.beat%16,bar=Math.floor(c.beat/16);
      const R=bar%4<2?73.416:77.782;                      // D, then its flat second: never resolves
      if(n===0){tone(R/2,step*15,.13,'sine',t,B,R/2,.2);pad(R,step*15,.042,240,t,9,B);}
      // the heartbeat: two thumps, unevenly spaced, so it never becomes a beat you can march to
      if(n===0||n===6){tone(R*1.16,.2,.115,'sine',t,B,R*.45);tone(R*.82,.13,.055,'sine',t+.1,B,R*.44);}
      if(n===9)noise(.06,.016,3400,t,B,'highpass');
      if(n===3||n===11)tone(R*2.378,.34,.03,'triangle',t,B,R*2.378,.03,n===3?-.5:.5);
      if(bar%8===7&&n===12)tone(R*1.414,step*5,.028,'sawtooth',t,B,R*1.414,step*1.6);
      if(n===14&&bar%2===1)noise(.3,.02,520,t,B,'bandpass');
      c.beat++;c.next+=step;
    }
  }

  // ---- 2. FIGHT -- contact ------------------------------------------------------------
  // Four on the floor, a walking eighth-note bass and hats. The first song with a groove, and
  // the only one you could nod to. That is deliberate: this is the tier where you are winning.
  const BASS=[0,0,3,0,2,0,3,4,0,0,3,0,4,0,3,2];
  function songFight(s,B,step){
    const c=clock[2],SCALE=[1,1.122,1.189,1.335,1.498,1.587,1.782];
    if(c.next<ctx.currentTime-.25)c.next=ctx.currentTime+.025;
    while(c.next<ctx.currentTime+.12){
      const t=c.next,n=c.beat%16,bar=Math.floor(c.beat/16),R=73.416;
      if(n===0){pad(R,step*15,.05,300+heat*900,t,8,B);pad(R*1.5,step*7,.03,260+heat*700,t,11,B);}
      if(n%4===0){tone(R*1.16,.19,.145,'sine',t,B,R*.45);noise(.05,.05,180,t,B,'lowpass');}
      if(n%4===2)tone(R*1.16,.12,.07,'sine',t,B,R*.45);
      if(n%2===0){const d=BASS[n];if(d)tone(R*SCALE[d],.14,.062,'triangle',t,B,R*SCALE[d],.008,n%4?.3:-.3);}
      if(n%2===1)noise(.035,.022,3600,t,B,'highpass');
      // the motif: four notes, answered an octave up on the second half of the bar
      const M=[0,4,3,2][Math.floor(n/4)];
      if(n%4===0)tone(R*2*SCALE[M],.5,.05,'sine',t,B,R*2*SCALE[M],.02,n<8?-.4:.4);
      if(n===14&&bar%2===1)tone(R*4*SCALE[2],.24,.02,'triangle',t,B,R*4*SCALE[2],.01,.6);
      c.beat++;c.next+=step;
    }
  }

  // ---- 3. SWARM -- overrun -------------------------------------------------------------
  // The machine, and the thing in the room with it.
  // The machine is the bottom two thirds: eight on the floor, a line interlocked on the odd sixteenths,
  // and a dry tick between every one of those, so something lands every thirty-second. That rate is the
  // point -- perceived tempo is onset rate, not grid, and a straight sixteenth line at this step is only
  // 6/s, which FEELS slower than FIGHT even though the grid is faster. Nothing here is held.
  // But a machine at a steady level is action, not horror: it is exciting because it is safe. So nothing
  // about this one is allowed to be quite right. It is a fraction out of tune with itself and differently
  // so every bar; the second in the chord goes steadily sharper as the phrase falls, souring the grind;
  // the whole thing leans and backs off across the phrase instead of sitting flat; and once a phrase it
  // simply loses half a bar of its own tick and a kick slips a thirty-second late, which is the sound of
  // a mechanism skipping. Everything still descends, in both the bar and the phrase.
  // Above the machine live three things that are not part of it, and they never land in the same place
  // twice -- their positions rotate on a twelve-bar cycle against a six-bar phrase and a fifteen-second
  // surge, so the ear cannot learn where to brace. A whine far above 4.6kHz that fades in over a second
  // and slides flat; a short shriek that exists mostly to strike the 2.4s tail and leave it ringing; and,
  // on CREST -- which is the spawn burst, so it should make a SOUND and not merely more density -- a
  // rising formant snarl over a downward swoop, the one gesture in the score that is meant to read as
  // a throat rather than an oscillator.
  // The 1.5-4kHz band is left alone throughout: the guns own it outright, and score up there is hash on
  // hash. The dread sits above it instead, and it is two or three events a bar at most -- the failure
  // mode being avoided is a continuous tick up top, not the register itself.
  const SWARM_GROUND=[
    [1,.9439,.8909,.8409,.7937,.7492],  // chromatic: a fourth down across six bars
    [1,.8909,.7937,.7492,.7071,.6674]   // wider, and it ends further down than it has any business being
  ];
  // eight sixteenths that zigzag and lose height at every turn: M6-5-M6-4-5-M2-4-root. No third anywhere.
  const SWARM_LINE=[3.364,2.996,3.364,2.67,2.996,2.245,2.67,2];
  // which sixteenths get a tick between them and the next: twelve of sixteen, the four holes landing just
  // before each quarter so the stream lifts into the beat instead of running flat through it
  const SWARM_TICK=[1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0];
  // where the things that are NOT the machine happen: a twelve-bar rotation against a six-bar phrase
  const SWARM_WHEN=[6,13,3,10,1,14,8,5,11,2,15,7];
  function songSwarm(s,B,step){
    const c=clock[3],half=step*.5;
    if(c.next<ctx.currentTime-.25)c.next=ctx.currentTime+.025;
    while(c.next<ctx.currentTime+.12){
      const t=c.next,n=c.beat%16,bar=Math.floor(c.beat/16),R=73.416;
      const k=bar%6,G=SWARM_GROUND[(Math.floor(bar/6)+(s.wave||1))%2],F=R*G[k];
      const crest=s.surge==='CREST',ebb=s.surge==='EBB';
      // it leans harder the further the ground has fallen and resets when the phrase turns: ~7dB of
      // swing, so the piece looms and recedes instead of sitting flat. Costs nothing to schedule.
      const lift=(ebb?.74:crest?1.12:1)*(.84+k*.07);
      // eight on the floor, tuned to the bar's root: a short struck sub, not a sustained one. The wobble
      // is a fraction of a percent, different every bar -- never in tune with itself two bars running.
      if(n%2===0){
        const hard=n===0||n===8,wob=1+(((bar*37)%7)-3)*.004;
        const slip=(k===4&&n===10)?half:0;   // once a phrase the mechanism skips a thirty-second
        tone(F*1.15*wob,hard?.13:.085,(hard?(n?.10:.115):.062)*lift,'sine',t+slip,B,F*.42,.004,n%4?.18:-.18);
      }
      // the line: the other half of the sixteenths, interlocked so the bar never opens up
      if(n%2===1&&(!ebb||n%4===3)){
        const f=F*SWARM_LINE[(n-1)>>1]*(crest?2:1);
        tone(f,.075,.03*lift,'triangle',t,B,f*.99,.004,n%4===1?-.4:.4);
      }
      // BETWEEN the sixteenths: the hat, moved down to 700Hz, out of the band the guns own. This is the
      // voice that doubles the felt tempo. Half of one bar a phrase it is simply not there.
      if(SWARM_TICK[n]&&!(ebb&&n%2===1)&&!(k===4&&n>=8))noise(.03,(n%4===0?.024:.017)*lift,700,t+half,B,'bandpass');
      // the swarm chord, struck: root and natural second inside one critical band, 300ms of grind. The
      // second walks sharp and the pair walks apart as the phrase falls, so the grind sours as it goes.
      if(n===0){
        pad(F*2,.3,.055*lift,420+heat*620,t,10+k*4,B);
        tone(F*2*(1.1225+k*.005),.28,.042*lift,'sawtooth',t,B,F*2*1.1225*.99,.004,.3);
        noise(k===0?.22:.09,(k===0?.06:.05)*lift,k===0?240:150,t,B,'lowpass');   // k===0: the ground reloads
      }
      if(n===8){
        tone(F*2,.24,.048*lift,'sawtooth',t,B,F*2*.995,.004,-.3);
        tone(F*2*(1.1225+k*.005),.22,.036*lift,'sawtooth',t,B,F*2*1.1225*.99,.004,.3);
      }
      // ---- and the things that are not the machine ----
      // the whine: fades in over a second, slides a semitone flat, never the same pitch or place twice
      if(bar%3===1&&n===SWARM_WHEN[bar%12]){
        const w=4600+((bar*197)%14)*175;
        tone(w,step*22,.014,'triangle',t,B,w*.93,step*7,bar%2?.68:-.68);
      }
      // the shriek: 45ms, well clear of the guns, there to strike the tail and leave the room ringing
      if(bar%2===0&&n===SWARM_WHEN[(bar+5)%12])noise(.045,.04,5600+((bar*83)%9)*240,t,B,'highpass');
      // CREST is the spawn burst: a rising formant over a falling swoop. A throat, not an oscillator.
      if(crest&&n===SWARM_WHEN[(bar+2)%12]){
        tone(F*3,.3,.05*lift,'sawtooth',t,B,F*.9,.012,.15);
        noise(.07,.05,850,t,B,'bandpass');
        noise(.07,.045,1050,t+half,B,'bandpass');
        noise(.11,.04,1250,t+step,B,'bandpass');
      }
      if(k===5&&n===12)noise(.22,.045*lift,620,t,B,'bandpass');   // the turn
      c.beat++;c.next+=step;
    }
  }
  // ---- The Patient Furnace ----
  // Deliberately not the city score played faster. The city modulates through four roots in a sixteen-step
  // four; the furnace sits on one pedal that never moves, in a lurching twelve-step three, and its palette
  // is built from the two intervals the city score never uses -- the minor second and the tritone. Nothing
  // in it resolves, because the thing in the middle of the city is not going anywhere.
  const FURNACE=43.654,HAMMER=[0,6],HAMMER_OPEN=[0,3,6,9];
  function furnace(s){
    const b=s.boss||{},phase=Math.max(1,Math.min(3,b.phase||1)),waking=!!(b.ai&&b.ai.mode==='intro');
    const step=.34-(phase-1)*.022,B=tracks[4],R=FURNACE;
    // each phase change lands as one detuned shove rather than a tempo nudge
    if(phase!==lastPhase){
      lastPhase=phase;
      noise(1.2,.17,230,ctx.currentTime,B,'lowpass');
      tone(R*.5,1.7,.15,'sawtooth',ctx.currentTime,B,R*.46,.02);
    }
    if(nextBossBeat<ctx.currentTime-.25)nextBossBeat=ctx.currentTime+.025;
    while(nextBossBeat<ctx.currentTime+.12){
      const t=nextBossBeat,n=bossBeat%12,bar=Math.floor(bossBeat/12);
      // the bellows: one long filtered breath per bar, and two saws nine cents apart under it. The beating
      // between that pair is the throb, and it is the only thing in the piece that never stops.
      if(n===0){
        noise(step*11,.055+phase*.012,170,t,B,'bandpass');
        pad(R,step*11.5,.075+phase*.01,160+phase*130,t,9,B);
        pad(R*2,step*11.5,.02+phase*.006,220+phase*180,t,5,B);
      }
      // while it is still waking, the piece only breathes -- the hammer has not started
      if(waking){bossBeat++;nextBossBeat+=step;continue;}
      // iron on iron: twice a bar at first, four times once the forge is open
      if((phase>1?HAMMER_OPEN:HAMMER).indexOf(n)>=0){
        noise(.09,.10+phase*.015,1500,t,B,'bandpass');
        tone(R*2,.16,.11,'square',t,B,R*.92,.004);
        noise(.5,.03,320,t+.02,B,'lowpass');
      }
      // the tritone, held long enough to sit on the chest instead of passing as a stab
      if(phase>1&&(n===4||n===10))tone(R*1.4142,step*2.6,.045,'sawtooth',t,B,R*1.4142,step*.9,n===4?-.45:.45);
      // a minor second leaning on the pedal, never resolving off it
      if(phase>1&&n===8)tone(R*1.0595,step*3.2,.03,'triangle',t,B,R*1.0595,step*1.1);
      // cracked cauldron: below a third of its health the sixteenths rattle loose
      if(phase>2&&n%2===1)noise(.05,.022,2600+((bossBeat*37)%900),t,B,'highpass');
      // the whine far above, sliding down a minor second across four bars and starting over
      if(phase>1&&n===2){
        const slide=Math.pow(1.0595,-(bar%4)/3);
        tone(R*8*slide,step*3.4,.016+phase*.004,'triangle',t,B,R*8*slide/1.0595,step*1.2,bar%2?.6:-.6);
      }
      bossBeat++;nextBossBeat+=step;
    }
  }
  // song 4 is the furnace, which keeps its own scheduler and ignores the step it is handed
  const SONG=[songExplore,songProwl,songFight,songSwarm,(s)=>furnace(s)];
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
  function stopVoices(){engines.clear();loops.clear();for(const source of voices){try{source.stop();}catch{}}nextBeat=0;}
  function update(s){
    const events=s.audioEvents.splice(0);
    if(s!==lastState){stopVoices();beat=0;heat=0;surge='';stinger=0;bossBeat=0;nextBossBeat=0;lastPhase=1;tier=0;for(const k of clock){k.beat=0;k.next=0;}lastState=s;lastMode=s.mode;lastBoss=false;lastWave=1;cooldowns.clear();}
    const active=s.mode==='play'&&!s.paused&&!document.hidden;
    if(!ctx||ctx.state!=='running')return;
    if(active!==running){running=active;master.gain.setTargetAtTime(muted||!active?0:.65,ctx.currentTime,.035);if(!active)stopVoices();}
    if(!muted&&active){
      updateEngines(s);updateLoops(s);
      if(!musicMuted)score(s);
      for(const event of events)cue(event.type,event.detail);
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
  root.DSAudio={unlock,update,toggleMute,toggleMusic,get muted(){return muted;},get musicMuted(){return musicMuted;},get status(){return {state:ctx?.state||'locked',voices:voices.size,engines:engines.size,loops:[...loops.keys()],muted,musicMuted};}};
})(typeof window!=='undefined'?window:globalThis);
