(function(){
 'use strict';
 const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d'),HUD=DSHud;
 let s=DSGame.create(seed()),keys=new Set(),edges=new Set(),padPrevious=new Map(),padAxis=new Map(),last=0,uiClock=0;
 let pendingPads=new Set(),currentDistrict='',width=innerWidth,height=innerHeight,latched={},padAxisX=new Map();
 let drivingStyle='steering';
 try{if(localStorage.getItem('dead-signal-driving-style')==='directional')drivingStyle='directional';}catch{}
 s.settings.drivingStyle=drivingStyle;
 function setDrivingStyle(value){
   drivingStyle=value==='directional'?'directional':'steering';s.settings.drivingStyle=drivingStyle;
   try{localStorage.setItem('dead-signal-driving-style',drivingStyle);}catch{}
   latched={};
 }
 function seed(){const q=new URLSearchParams(location.search).get('seed');return q!==null?Number(q)||1:Math.floor(Math.random()*2147483646)+1;}
 function resize(){width=innerWidth;height=innerHeight;const d=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*d);canvas.height=Math.round(height*d);ctx.setTransform(d,0,0,d,0,0);s.camera.h=s.camera.w/(width/height);}
 addEventListener('resize',resize);resize();
 addEventListener('keydown',e=>{DSAudio.unlock();if(['Tab','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(!keys.has(e.code))edges.add(e.code);keys.add(e.code);});
 addEventListener('keyup',e=>keys.delete(e.code));
 addEventListener('blur',()=>{keys.clear();edges.clear();if(s.mode==='play'&&!s.paused)HUD.open('pause');});
 addEventListener('pointerdown',()=>DSAudio.unlock());
 canvas.addEventListener('mousemove',e=>HUD.pointer(e.clientX,e.clientY));
 canvas.addEventListener('click',e=>{if(s.mode!=='title'||HUD.menu){HUD.hit(e.clientX,e.clientY);sync();}});
 function show(id,yes){$(id).classList.toggle('hidden',!yes);}
 function start(starter='keyboard',sources=[]){
   if(s.mode==='play')return;
   const connected=new Set(Array.from(navigator.getGamepads?.()||[]).filter(Boolean).map(p=>p.index));
   pendingPads=new Set([...pendingPads].filter(idx=>connected.has(idx)));
   const wanted=new Set([starter,...sources,...[...pendingPads].map(idx=>'pad:'+idx)]);
   s=DSGame.create(seed());s.settings.drivingStyle=drivingStyle;for(const source of wanted)if(source==='keyboard'||connected.has(+source.split(':')[1]))DSGame.addPlayer(s,source);
   if(!s.players.length)DSGame.addPlayer(s,'keyboard');
   s.mode='play';tagDevices();currentDistrict=DSWorld.district(s.camera.x,s.camera.y).id;{const p=s.players[0];DSGame.announce(s,'STAY QUIET · '+DSGame.label(p,'run')+' runs · '+DSGame.label(p,'fire')+' enables fire');}keys.clear();edges.clear();DSAudio.unlock();
   latched={};HUD.close();if(window.DSChunks)DSChunks.clear();sync();
 }
 function restart(){const sources=s.players.map(p=>p.source);s.mode='title';start(sources[0]||'keyboard',sources.slice(1));}
 HUD.bind({state:()=>s,restart,resume:()=>{s.paused=false;},toTitle:()=>{},setDrivingStyle});
 $('start').onclick=()=>start();
 $('controls-button').onclick=()=>{HUD.open('manual');sync();};
 function keyboardInput(){return{x:(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),y:(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0),interact:edges.has('KeyE')||edges.has('Space'),heal:edges.has('KeyH'),eat:edges.has('KeyR'),run:keys.has('ShiftLeft')||keys.has('ShiftRight'),toggle:edges.has('KeyF'),switch:edges.has('KeyQ')};}
 // PlayStation pads report Sony's vendor id or name; every other standard pad uses the Xbox labels
 function padDevice(pad){return /054c|playstation|dualshock|dualsense|sony/i.test(pad&&pad.id||'')?'playstation':'xbox';}
 function tagDevices(){let pads=[];try{pads=Array.from(navigator.getGamepads?.()||[]);}catch{}for(const p of s.players){if(p.source==='keyboard'){p.device='keyboard';continue;}const pad=pads.find(q=>q&&'pad:'+q.index===p.source);if(pad)p.device=padDevice(pad);}}
 // analog trigger value; digital 0/1 triggers report pressed with value 0 on some browsers
 const trigger=b=>!b?0:b.value>0?b.value:b.pressed?1:0;
 function inputs(){
   const result={},menu=HUD.menu;
   let pads=[];try{pads=navigator.getGamepads?Array.from(navigator.getGamepads()):[];}catch{}
   const connected=new Set(pads.filter(Boolean).map(p=>p.index));
   for(const idx of padPrevious.keys())if(!connected.has(idx)){padPrevious.delete(idx);pendingPads.delete(idx);if(s.mode==='play'&&s.players.some(p=>p.source==='pad:'+idx)){DSGame.announce(s,'CONTROLLER DISCONNECTED · reconnect and resume');if(!s.paused)HUD.open('pause');}}
   // keyboard: menus first, then the survivor
   if(menu){
     if(edges.has('ArrowUp')||edges.has('KeyW'))HUD.press('up');if(edges.has('ArrowDown')||edges.has('KeyS'))HUD.press('down');
     if(edges.has('ArrowLeft')||edges.has('KeyA'))HUD.press('left');if(edges.has('ArrowRight')||edges.has('KeyD'))HUD.press('right');
     if(edges.has('Enter')||edges.has('Space')||edges.has('KeyE'))HUD.press('confirm');
     if(edges.has('Escape'))HUD.press('back');if(edges.has('Tab'))HUD.press('map');
     for(let i=0;i<3;i++)if(edges.has('Digit'+(i+1)))HUD.press('choose:'+i,'keyboard');
   }else{
     const k=keyboardInput(),kp=s.players.find(p=>p.source==='keyboard');if(kp)result[kp.id]=k;
     if(edges.has('Escape'))HUD.press('pause');if(edges.has('Tab'))HUD.press('map');
     if(s.mode==='title'&&edges.has('Enter'))start();
     else if(s.mode==='play'&&!kp&&edges.has('Enter')){DSGame.addPlayer(s,'keyboard');tagDevices();}
   }
   for(const pad of pads){if(!pad)continue;const buttons=pad.buttons.map(b=>!!b.pressed),prev=padPrevious.get(pad.index)||[],edge=i=>buttons[i]&&!prev[i];
     const ay=pad.axes[1]||0,armed=padAxis.get(pad.index)!==false,dir=ay<-.5?'up':ay>.5?'down':null;
     let started=false;
     if(HUD.menu){
       const src='pad:'+pad.index;
       if(edge(12)||(dir==='up'&&armed))HUD.press('up',src);if(edge(13)||(dir==='down'&&armed))HUD.press('down',src);
       const ax=pad.axes[0]||0,horizontal=padAxisX.get(pad.index)!==false;
       if(edge(14)||edge(4)||ax<-.5&&horizontal)HUD.press('left',src);if(edge(15)||edge(5)||ax>.5&&horizontal)HUD.press('right',src);
       if(edge(0))HUD.press('confirm',src);if(edge(1))HUD.press('back',src);
       if(edge(9)&&s.mode==='play')HUD.press('pause');if(edge(8))HUD.press('map');
     }else{
       if(edge(0)&&s.mode==='title'){pendingPads.add(pad.index);$('lobby').textContent=pendingPads.size+' CONTROLLER'+(pendingPads.size===1?'':'S')+' READY · PRESS START TO DEPLOY';}
       if(s.mode==='title'&&edge(9)){pendingPads.add(pad.index);start('pad:'+pad.index);started=true;}
       let p=s.players.find(q=>q.source==='pad:'+pad.index);
       if(s.mode==='play'&&!p&&edge(0)){const id=DSGame.addPlayer(s,'pad:'+pad.index);p=s.players.find(q=>q.id===id);if(p){p.device=padDevice(pad);DSGame.announce(s,p.name+' JOINED THE SQUAD');}}
       if(p){p.device=padDevice(pad);
         // city_v2 Section 0: B heals, RB eats, RT runs on foot / gas when driving, LT brakes then reverses
         const axis=v=>Math.abs(v||0)<.18?0:v;result[p.id]={x:axis(pad.axes[0])+(buttons[15]?1:0)-(buttons[14]?1:0),y:axis(pad.axes[1])+(buttons[13]?1:0)-(buttons[12]?1:0),interact:edge(0),heal:edge(1),eat:edge(5),run:false,rt:trigger(pad.buttons[7]),lt:trigger(pad.buttons[6]),pedals:true,toggle:edge(2),switch:edge(3)};
         if(edge(9)&&s.mode==='play'&&!started)HUD.press('pause');if(edge(8)&&s.mode==='play')HUD.press('map');
       }
     }
     padAxis.set(pad.index,dir===null);
     padAxisX.set(pad.index,Math.abs(pad.axes[0]||0)<.5);
     padPrevious.set(pad.index,buttons);
   }
   edges.clear();return result;
 }
 function drawTitleMap(){const c=$('title-map'),g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);DSWorld.drawMap(g,s,0,0,c.width,c.height);g.fillStyle='#f17764';g.beginPath();g.arc(c.width/2,c.height/2,7,0,Math.PI*2);g.fill();g.font='bold 11px Consolas,monospace';g.textAlign='center';g.fillText('PATIENT FURNACE',c.width/2,c.height/2+25);}
 function sync(){
   show('title',s.mode==='title'&&HUD.menu!=='manual');
   if(s.mode==='title'){drawTitleMap();return;}
   const zone=DSWorld.district(s.camera.x,s.camera.y);if(currentDistrict&&zone.id!==currentDistrict&&s.mode==='play')DSGame.announce(s,'ENTERING '+zone.name.toUpperCase()+' · '+zone.role);currentDistrict=zone.id;
 }
 let accumulator=0;
 function frame(now){const dt=Math.min(.1,(now-last)/1000||0);last=now;const menuAtStart=HUD.menu,input=inputs(),viewport=s.mode==='title'?{top:0,bottom:0}:HUD.layout(width,height),aspect=width/Math.max(160,height-viewport.top-viewport.bottom);
   // any menu (or a pause without one) re-arms held triggers, so closing it never accelerates or sprints
   if(HUD.menu||menuAtStart||s.paused){latched={};DSGame.rearmTriggers(s);}
   for(const [id,i] of Object.entries(HUD.menu?{}:input)){const old=latched[id]||{};latched[id]={...i,interact:!!(old.interact||i.interact),heal:!!(old.heal||i.heal),eat:!!(old.eat||i.eat),toggle:!!(old.toggle||i.toggle),switch:!!(old.switch||i.switch)};}
   if(s.mode==='play'&&!s.paused&&!menuAtStart){accumulator+=dt;while(accumulator>=1/60){DSGame.step(s,1/60,latched,aspect);for(const i of Object.values(latched)){i.interact=false;i.heal=false;i.eat=false;i.toggle=false;i.switch=false;}accumulator-=1/60;}}else{accumulator=0;latched={};}
   DSAudio.update(s);
   DSRender.scene(ctx,s,width,height,viewport);HUD.draw(ctx,s,width,height);
   uiClock+=dt;if(uiClock>.1||HUD.menu){sync();uiClock=0;}requestAnimationFrame(frame);
 }
 // Read-only status hook plus the menu surface for automation; simulation APIs live in game.js.
 window.DeadSignal={get state(){return s;},get menu(){return HUD.menu;},start,restart,
   ui:{open:n=>{HUD.open(n);sync();},close:()=>{HUD.close();sync();},press:a=>{const r=HUD.press(a);sync();return r;},click:(x,y)=>HUD.hit(x,y),get focus(){return HUD.focus;},get items(){return HUD.menuItems();},rects:()=>HUD.items()}};
 sync();requestAnimationFrame(frame);
})();
