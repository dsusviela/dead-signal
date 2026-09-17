// Perceived tempo is onset RATE, not the sixteenth grid. Measures, per song:
// onsets/sec, onsets/sec counting only short "percussive" voices (what you actually feel as a beat),
// and the median gap between them.
import fs from 'node:fs';
import vm from 'node:vm';

const file = process.argv[2];
let now = 0, gains = [], tracks = null;
const sched = [];
function mkParam(){return{value:0,setValueAtTime(v){this.value=v;return this;},exponentialRampToValueAtTime(){return this;},linearRampToValueAtTime(){return this;},setTargetAtTime(v){this.value=v;return this;}};}
function mkNode(type){const n={__type:type,__to:null};n.gain=mkParam();n.frequency=mkParam();n.detune=mkParam();
  n.Q={value:0};n.pan={value:0};n.threshold={value:0};n.ratio={value:0};
  n.connect=(d)=>{n.__to=d;return d;};n.disconnect=()=>{};n.start=()=>{};n.stop=()=>{if(n.onended){const f=n.onended;n.onended=null;f();}};return n;}
function trackOf(node){let h=0,cur=node;while(cur&&h++<14){const i=tracks?tracks.indexOf(cur):-1;if(i>=0)return i;cur=cur.__to;}return -1;}
function rec(node){
  node.start=(at)=>{node.__rec={track:trackOf(node.__to),freq:node.frequency.value,at:at??now,dur:0};sched.push(node.__rec);};
  node.stop=(t)=>{if(node.__rec)node.__rec.dur=Math.max(0,(t??now)-node.__rec.at);if(node.onended){const f=node.onended;node.onended=null;f();}};
  return node;
}
class FakeCtx{
  constructor(){this.state='running';this.sampleRate=48000;this.destination=mkNode('dest');}
  get currentTime(){return now;}
  createGain(){const g=mkNode('gain');gains.push(g);return g;}
  createOscillator(){return rec(mkNode('osc'));}
  createBufferSource(){return rec(mkNode('buf'));}
  createBiquadFilter(){return mkNode('filter');}
  createStereoPanner(){return mkNode('pan');}
  createConvolver(){return mkNode('conv');}
  createDynamicsCompressor(){return mkNode('comp');}
  createBuffer(c,l){return{getChannelData:()=>new Float32Array(l)};}
  resume(){return Promise.resolve();}
}
const sandbox={AudioContext:FakeCtx,document:{hidden:false},localStorage:{getItem:()=>null,setItem:()=>{}},console,Math,Number,Set,Map,Float32Array,Promise,String};
sandbox.window=sandbox;vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
const A=sandbox.DSAudio;A.unlock();
for(let i=gains.length-5;i>=0;i--){const g=gains.slice(i,i+5);if(g[0].gain.value===1&&g.slice(1).every(x=>x.gain.value===0)){tracks=g;break;}}

const st={mode:'play',paused:false,time:0,wave:1,threat:1,surge:'SWELL',players:[{id:0,x:0,y:0,dead:false}],enemies:[],audioEvents:[],boss:null};
const setCrowd=n=>{st.enemies=Array.from({length:n},(_,i)=>{const r=30+(i%24)*11;return{x:Math.cos(i*2.4)*r,y:Math.sin(i*2.4)*r,dead:false};});};
const run=secs=>{const f=Math.round(secs*60);for(let i=0;i<f;i++){now+=1/60;st.time+=1/60;A.update(st);}};

const NAMES=['explore','prowl','fight','swarm'];
const STEP=[.34,.27,.21,.165];
const SECS=24;
console.log('song      grid bpm   onsets/s   PERCUSSIVE onsets/s   median gap   sustained% of time');
console.log('--------  ---------  ---------  --------------------  -----------  ------------------');
for(const [crowd,idx] of [[0,0],[20,1],[45,2],[80,3]]){
  setCrowd(crowd);run(10);
  sched.length=0;run(SECS);
  const mine=sched.filter(x=>x.track===idx).sort((a,b)=>a.at-b.at);
  // a "percussive" onset: something short enough to be felt as a hit rather than a held tone
  const hits=mine.filter(x=>x.dur>0&&x.dur<=.30);
  const held=mine.filter(x=>x.dur>1.0);
  const gaps=[];for(let i=1;i<hits.length;i++){const d=hits[i].at-hits[i-1].at;if(d>.001)gaps.push(d);}
  gaps.sort((a,b)=>a-b);
  const bpm=60/(STEP[idx]*4);                       // quarter = 4 sixteenths
  const heldTime=held.reduce((a,b)=>a+Math.min(b.dur,SECS),0);
  console.log(
    NAMES[idx].padEnd(9)+
    String(Math.round(bpm)).padStart(8)+
    (mine.length/SECS).toFixed(1).padStart(11)+
    (hits.length/SECS).toFixed(1).padStart(22)+
    (gaps.length?gaps[Math.floor(gaps.length/2)].toFixed(3)+'s':'   -').padStart(13)+
    (100*heldTime/SECS).toFixed(0).padStart(17)+'%'
  );
}
