/**
 * Graphics quality (task Q-quality, docs/superpowers/plans/2026-09-27-development-wave-3.md).
 * The 画质 setting is 'auto' (自动, the default), 'high', 'medium' or 'low'. Everything heavy asks
 * `detail()` which version to build or run: 'high' | 'medium' | 'low'. On 自动 the level starts
 * from the GPU's name and steps down while frames stay slow; it never climbs back by itself, so it
 * cannot see-saw. What is built already stays as built; what runs every frame follows at once.
 */
export const QUALITY=['auto','high','medium','low'];
const LEVELS=['high','medium','low'];

/**
 * What each level costs the renderer (src/world/town.js applies it). Measured on Iris Xe at
 * 2880x1620: MSAA and the pixel ratio each take about 45% of the GPU's frame, shadows 0.5-3 ms,
 * PCF5 against PCF3 is within the noise there but is 9 taps a pixel against 4 on a weaker GPU.
 * `crowd`: the share of crowd.json's people in 云海; `animate`: metres within which they move their
 * limbs; `viewScale`: the door street view's texture is the canvas divided by this.
 */
export const RENDER={
  high:  {pixelRatio:1.8, msaa:true, shadow:'pcf5',shadowSize:2048,shadowDistance:75,reflections:true, crowd:1,  animate:40,viewScale:2},
  medium:{pixelRatio:1.25,msaa:true, shadow:'pcf3',shadowSize:2048,shadowDistance:60,reflections:true, crowd:.75,animate:30,viewScale:2},
  low:   {pixelRatio:1,   msaa:false,shadow:'pcf3',shadowSize:1024,shadowDistance:45,reflections:false,crowd:.5, animate:20,viewScale:4},
};

let choice='auto',start='high',level='high';
/** The level in force: 'high' | 'medium' | 'low'. */
export function detail(){return level;}

/** The level 自动 starts at for a GPU, from WebGL's renderer name (empty when the browser hides it). */
export function levelForGpu(renderer=''){
  if(/swiftshader|llvmpipe|softpipe|basic render|software/i.test(renderer))return 'low';
  if(/intel.*\bu?hd graphics|mali|adreno|powervr|videocore/i.test(renderer))return 'medium';
  return 'high';
}

/** The player's 画质; anything unknown is 自动. Returns the level now in force. */
export function setQuality(value){
  choice=QUALITY.includes(value)?value:'auto';
  level=choice==='auto'?start:choice;
  restart();
  return level;
}
/** Tell 自动 which GPU it is running on, once the graphics device exists. */
export function setGpu(renderer){
  start=levelForGpu(renderer);
  if(choice==='auto')level=start;
  restart();
}

// 自动's verdicts: after SETTLE ms of frames (shaders compiling, a resize), the median frame of
// the next WINDOW ms decides. Slower than SLOW (under 40 fps) steps down one level. A gap longer
// than STALL is a hidden tab or a one-off stall, not the steady frame rate, and is left out.
const SETTLE=2000,WINDOW=3000,SLOW=25,STALL=250;
const times=[];
let settling=SETTLE,seen=0;
function restart(){times.length=0;settling=SETTLE;seen=0;}

/** Every frame's length in ms, and whether the game is running: frames under a panel, the arrival
 *  card or a ride say nothing about play, so they start the verdict over. True when 自动 has just
 *  stepped down a level. */
export function frameTime(ms,playing=true){
  if(!playing){restart();return false;}
  if(choice!=='auto'||level==='low'||!(ms>0)||ms>STALL)return false;
  if(settling>0){settling-=ms;return false;}
  times.push(ms);seen+=ms;
  if(seen<WINDOW)return false;
  times.sort((a,b)=>a-b);
  const slow=times[times.length>>1]>SLOW;
  restart();
  if(!slow)return false;
  level=LEVELS[LEVELS.indexOf(level)+1];
  return true;
}
