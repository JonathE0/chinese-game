import * as pc from 'playcanvas';
import {detail,chosen} from '../core/quality.js';

/**
 * The admin performance overlay (task W6-perf; only with ?admin on the dev server, main.js): frames
 * per second and frame time, the CPU's and the GPU's share of a frame, draw calls, triangles, the 画质
 * level and the pixel ratio, so a play-tester can tell us what their own machine does. It reads the
 * town's own timers (town.js: the CPU from a frame's update to its end, the GPU from the engine's timer
 * query, "—" where the browser has none) and redraws twice a second.
 */
const NAMES={high:'高',medium:'中',low:'低'};
export function installPerf(town){
  const app=town.app,g=app.graphicsDevice,box=document.createElement('pre');
  box.id='perf-overlay';box.setAttribute('aria-hidden','true');document.body.append(box);
  // The release engine counts no triangles (only its profiler build does), so the overlay counts what
  // is drawn; admin only, so players pay nothing for it.
  let tris=0,drawn=0,last=0,cpu=0,gpu=0,n=0;
  const draw=g.draw,frames=[];
  g.draw=function(primitive,indexBuffer,instances,...rest){
    if(primitive?.type===pc.PRIMITIVE_TRIANGLES)tris+=primitive.count/3*(instances>1?instances:1);
    return draw.call(this,primitive,indexBuffer,instances,...rest);
  };
  app.on('frameupdate',ms=>{frames.push(ms);drawn=tris;tris=0;});
  app.on('frameend',()=>{
    cpu+=town.cpuTime??0;gpu+=g.gpuProfiler?._frameTime??0;n++;
    const now=performance.now();
    if(now-last<500||!frames.length)return;
    const sorted=frames.sort((a,b)=>a-b),mid=sorted[sorted.length>>1],p90=sorted[Math.floor(sorted.length*.9)];
    const ms=x=>x>0?x.toFixed(1):'—';
    box.textContent=`${(1000/mid).toFixed(0)} fps · ${ms(mid)} ms (p90 ${ms(p90)})\n`+
      `CPU ${ms(cpu/n)} · GPU ${ms(gpu/n)} ms\n`+
      `${app.stats.drawCalls.total} draw calls · ${(drawn/1e6).toFixed(2)}M tris\n`+
      `${NAMES[detail()]}${chosen()==='auto'?' (自动)':''} · ratio ${g.maxPixelRatio}/${devicePixelRatio} · ${g.width}×${g.height}`;
    last=now;frames.length=0;cpu=gpu=n=0;
  });
}
