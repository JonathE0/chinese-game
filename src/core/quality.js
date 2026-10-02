/**
 * Graphics quality (task Q-quality, docs/superpowers/plans/2026-09-27-development-wave-3.md).
 * The 画质 setting is 'auto' (自动, the default), 'high', 'medium' or 'low'. Everything heavy asks
 * `detail()` which version to build or run: 'high' | 'medium' | 'low'. On 自动 (task W6-perf) the
 * game starts on 中 (低 on a software renderer) and walks LADDER one rung at a time: down while frames
 * run long, up while the GPU timer shows room to spare. What is built already stays as built; what
 * runs every frame follows at once.
 */
export const QUALITY=['auto','high','medium','low'];

/**
 * What each level costs the renderer (src/world/town.js applies it). On Iris Xe at 1440x760 CSS
 * pixels, two device pixels each (task W6-perf), 高's GPU time went down by about a third from a pixel
 * ratio of 1.8 to 1.25 and by about half without its ambient occlusion and the depth pass that needs;
 * MSAA took 1-2 ms on 中, shadows 1-2 ms and 70 draw calls, the shadow map's size and reach nothing
 * measurable. PCF5 is 9 taps a pixel against PCF3's 4. `pixelRatio`: the most canvas pixels per CSS
 * pixel (高 at 1.8 took 19-34 ms of CPU and GPU work a frame outdoors on that laptop, about 30 fps;
 * at 1.5 it takes 13-18). `crowd`: the share of
 * crowd.json's people in 云海; `animate`: metres within which they move their limbs; `viewScale`: the
 * door street view draws at the screen's resolution divided by this, `towerScale` the same for a
 * window high up in 云海中心 (src/world/views.js), `mirrorScale` for a mirror (src/world/mirror.js; 0
 * leaves mirrors as plain glass). The Jiangnan look (src/world/look.js): `post` the post pass (tone
 * mapping, bloom, grading, grain, mist, hemisphere light), `ssao` ambient occlusion in it, `textures`
 * the painted surfaces; 低 keeps the plain look.
 */
export const RENDER={
  high:  {pixelRatio:1.5, msaa:true, shadow:'pcf5',shadowSize:2048,shadowDistance:75,reflections:true, crowd:1,  animate:40,viewScale:2,towerScale:1,  mirrorScale:1,post:true, ssao:true, textures:true},
  medium:{pixelRatio:1.25,msaa:true, shadow:'pcf3',shadowSize:2048,shadowDistance:60,reflections:true, crowd:.75,animate:30,viewScale:2,towerScale:1.5,mirrorScale:2,post:true, ssao:false,textures:true},
  low:   {pixelRatio:1,   msaa:false,shadow:'pcf3',shadowSize:1024,shadowDistance:45,reflections:false,crowd:.5, animate:20,viewScale:4,towerScale:2,  mirrorScale:0,post:false,ssao:false,textures:false},
};

/**
 * 自动's ladder, cheapest first: a level and the most canvas pixels per CSS pixel it draws at (never
 * more than the screen has, nor than the level chosen outright would). On Iris Xe at 1440x760 CSS
 * pixels, two device pixels each, in the park (task W6-perf): 高 at 1.8 took about 14 ms of GPU time a
 * frame and 9 at 1.25, 中 at 1.25 about 6-8, 低 at 1 about 3; the CPU's 4-7 ms come on top of that.
 */
export const LADDER=[['low',.75],['low',1],['medium',.85],['medium',1],['medium',1.25],['high',1.25],['high',1.5]];
const START=LADDER.findIndex(([l,r])=>l==='medium'&&r===RENDER.medium.pixelRatio),SOFT=LADDER.findIndex(([l,r])=>l==='low'&&r===1);

let choice='auto',start=START,rung=START,level='medium',screen=1;
const left=new Set();   // levels 自动 has dropped out of: it does not climb back into them
/** The level in force: 'high' | 'medium' | 'low'. */
export function detail(){return level;}
/** The setting in force: 'auto' or the level chosen. */
export function chosen(){return choice;}
/** Canvas pixels per CSS pixel on a screen with `dpr` of its own: the chosen level's cap, or 自动's rung. */
export function pixelRatio(dpr=1){
  screen=dpr;
  return Math.min(dpr,choice==='auto'?LADDER[rung][1]:RENDER[level].pixelRatio);
}

/** The level 自动 starts at for a GPU, from WebGL's renderer name: 低 if it draws in software, else 中. */
export function levelForGpu(renderer=''){
  return /swiftshader|llvmpipe|softpipe|basic render|software/i.test(renderer)?'low':'medium';
}

/** The player's 画质; anything unknown is 自动. Returns the level now in force. */
export function setQuality(value){
  choice=QUALITY.includes(value)?value:'auto';
  if(choice==='auto'){rung=start;left.clear();}
  level=choice==='auto'?LADDER[rung][0]:choice;
  restart();
  return level;
}
/** Tell 自动 which GPU it is running on, once the graphics device exists. */
export function setGpu(renderer){
  start=levelForGpu(renderer)==='low'?SOFT:START;
  if(choice==='auto'){rung=start;level=LADDER[rung][0];left.clear();}
  restart();
}

// 自动's verdicts: after SETTLE ms of frames (shaders compiling, a resize), each WINDOW ms decides.
// More than a fifth of them slower than SLOW (a stutter, under 50 fps) drops a rung at once. It climbs
// one more slowly, after CALM windows in a row with almost none slow and the CPU's ms plus the GPU's
// (scaled to the next rung's pixels, and by HIGH into 高 for its ambient occlusion, depth pass and
// softer shadows) inside BUDGET: Chrome draws a WebGL frame after its script has run, so the two add
// up. No GPU time (a browser without the timer query) means no climbing. A gap longer than STALL is a
// hidden tab or a one-off stall, and is left out.
const SETTLE=2000,WINDOW=2000,SLOW=20,STALL=250,BUDGET=12,HIGH=1.8,CALM=3;
const times=[],gpus=[],cpus=[];
let settling=SETTLE,seen=0,calm=0;
function restart(settle=SETTLE){times.length=gpus.length=cpus.length=0;settling=settle;seen=0;if(settle)calm=0;}
const median=a=>a.sort((x,y)=>x-y)[a.length>>1];
const ratioAt=i=>Math.min(screen,LADDER[i][1]);
/** One rung up (+1) or down (-1), past rungs that look the same on this screen; `fits` vets a climb. */
function move(dir,fits){
  let next=rung+dir;
  while(LADDER[next]&&LADDER[next][0]===level&&ratioAt(next)===ratioAt(rung))next+=dir;
  if(!LADDER[next]||dir>0&&(left.has(LADDER[next][0])||!fits(next)))return false;
  if(LADDER[next][0]!==level&&dir<0)left.add(level);
  rung=next;level=LADDER[rung][0];
  restart();
  return true;
}

/** Every frame's length in ms; whether the game is running (frames under a panel, the arrival card or
 *  a ride say nothing about play, and start the verdict over); and the GPU's and the CPU's ms of it (0:
 *  not measured). True when 自动 has just moved, for the town to apply. */
export function frameTime(ms,playing=true,gpu=0,cpu=0){
  if(!playing){restart();return false;}
  if(choice!=='auto'||!(ms>0)||ms>STALL)return false;
  if(settling>0){settling-=ms;return false;}
  times.push(ms);gpus.push(gpu);cpus.push(cpu);seen+=ms;
  if(seen<WINDOW)return false;
  const slow=times.filter(t=>t>SLOW).length/times.length,g=median(gpus),c=median(cpus);
  restart(0);
  if(slow>.2)return move(-1);
  if(slow>.05||!(g>0)){calm=0;return false;}
  if(++calm<CALM)return false;
  return move(1,next=>c+g*(ratioAt(next)/ratioAt(rung))**2*(LADDER[next][0]==='high'&&level!=='high'?HIGH:1)<=BUDGET);
}
