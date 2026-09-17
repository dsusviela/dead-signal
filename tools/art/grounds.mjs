// The two review grounds every preview and sheet draws on: a road chunk and a
// district lot chunk from the real chunk bake once chunks.js exists, else two
// flat district colours so the tools work before P2 lands.
import {PixCanvas} from '../pixcanvas.mjs';

export const CHPX=256;
export function grounds(g){
  const out=[];
  if(g.has('DSRender')&&g.ev('typeof DSRender.chunkCanvas==="function"')){
    // chunk (0,10) straddles the south avenue at x=0; chunk (2,9) is a South Blocks lot
    const s=g.ev('DSGame&&DSGame.create?DSGame.create(1):null');
    try{
      out.push(['asphalt',g.ev('DSRender.chunkCanvas')(0,10,s)]);
      out.push(['lot',g.ev('DSRender.chunkCanvas')(2,9,s)]);
      return out;
    }catch(e){/* fall through to flat grounds */}
  }
  for(const [label,col] of [['asphalt','#202d2d'],['lot','#182421']]){
    const c=new PixCanvas(CHPX,CHPX),ctx=c.getContext('2d');ctx.fillStyle=col;ctx.fillRect(0,0,CHPX,CHPX);
    ctx.fillStyle='#ffffff10';for(let i=0;i<40;i++)ctx.fillRect((i*97)%CHPX,(i*61)%CHPX,3,1);
    out.push([label,c]);
  }
  return out;
}
