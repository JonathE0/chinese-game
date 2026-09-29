import * as pc from 'playcanvas';

// A day passes in twenty-four real minutes. Keyframes are picked so the town reads as warm and
// legible at every hour: the palette shifts, but text and faces never fall into the dark.
export const MINUTES_PER_DAY=24;

const KEYS=[
  {h:0,  sky:'#1d2a3c', sun:'#4a5c86', intensity:.22, ambient:'#2b3446', lamps:1,  label:'深夜', en:'Night'},
  {h:5,  sky:'#3f4b63', sun:'#8f7f9c', intensity:.35, ambient:'#414c60', lamps:1,  label:'黎明前', en:'Before dawn'},
  {h:6.5,sky:'#c98f78', sun:'#e8a06f', intensity:.75, ambient:'#6b6a67', lamps:.5, label:'清晨', en:'Dawn'},
  {h:9,  sky:'#a9c6cb', sun:'#fff0d2', intensity:1.05,ambient:'#8f948b', lamps:0,  label:'上午', en:'Morning'},
  {h:13, sky:'#bcd6d4', sun:'#fff8e6', intensity:1.15,ambient:'#99a094', lamps:0,  label:'中午', en:'Midday'},
  {h:16.5,sky:'#c6d3c2',sun:'#ffe6bb', intensity:1.0, ambient:'#95998c', lamps:0,  label:'下午', en:'Afternoon'},
  {h:18.5,sky:'#dba077',sun:'#f0a35f', intensity:.68, ambient:'#7d7568', lamps:.6, label:'傍晚', en:'Evening'},
  {h:20,  sky:'#6a6a86', sun:'#8a7594', intensity:.38, ambient:'#4d5163', lamps:1,  label:'入夜', en:'Dusk'},
  {h:22,  sky:'#26334a', sun:'#4f5f88', intensity:.25, ambient:'#313a4d', lamps:1,  label:'夜晚', en:'Night'},
  {h:24,  sky:'#1d2a3c', sun:'#4a5c86', intensity:.22, ambient:'#2b3446', lamps:1,  label:'深夜', en:'Night'},
];

const mix=(a,b,t)=>a+(b-a)*t;
function mixColor(from,to,t){
  const a=new pc.Color().fromString(from),b=new pc.Color().fromString(to);
  return new pc.Color(mix(a.r,b.r,t),mix(a.g,b.g,t),mix(a.b,b.b,t));
}

/** Interpolate the palette at a given hour. */
export function skyAt(hour){
  const h=((hour%24)+24)%24;
  let i=0;
  while(i<KEYS.length-2&&KEYS[i+1].h<=h)i++;
  const from=KEYS[i],to=KEYS[i+1];
  const t=to.h===from.h?0:(h-from.h)/(to.h-from.h);
  return {
    hour:h,
    sky:mixColor(from.sky,to.sky,t),
    sun:mixColor(from.sun,to.sun,t),
    ambient:mixColor(from.ambient,to.ambient,t),
    intensity:mix(from.intensity,to.intensity,t),
    lamps:mix(from.lamps,to.lamps,t),
    label:t<.5?from.label:to.label,
    en:t<.5?from.en:to.en,
  };
}

export const clockText=hour=>{
  const h=Math.floor(((hour%24)+24)%24),m=Math.floor((hour-Math.floor(hour))*60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
};

/**
 * The sun only turns with the hour while the camera is within this many metres of the origin, which
 * takes in the whole town. The engine snaps sun-shadow texels to a grid through the world origin,
 * so any turn shifts a place's shadow edges by its distance from the origin times the angle: in
 * the rooms (400 m to 10 km out) and 云海 (4 km) that was a texel or more every frame, and every
 * shadow edge there flickered. There the sun turns in steps instead, once every SUN_STEP_HOURS of
 * game time (half a real minute), so shadows still follow the clock; setting the clock turns it at once.
 */
export const SUN_TURNS_WITHIN=200;
export const SUN_STEP_HOURS=.5;

/**
 * The sky's two lamps, as a unit Vec3 pointing at each (x east, y up, z south), below the horizon
 * when y < 0. A summer sun: up in the east-north-east at 6:00, 62° high in the south at 12:30,
 * down in the west-north-west at 19:00, so in 云海 it sets over the bay. The moon takes the night,
 * up in the east as the sun sets and down in the west as it rises, passing 45° high in the north
 * at half past midnight: over the bay, where the promenade looks.
 */
const SUNRISE=6,SUNSET=19,DEG=Math.PI/180;
/** Up for `hours` from `rise`, sweeping `sweep` degrees round from `from`; then the mirrored arc under
 *  the horizon for the rest of the day, all the way round, so it moves smoothly at every hour. */
function arc(hour,rise,hours,top,from,sweep,out){
  const h=(((hour-rise)%24)+24)%24,up=h<hours,s=up?h/hours:(h-hours)/(24-hours);
  const height=(up?top:-top)*DEG*Math.sin(Math.PI*s),round=(up?from+sweep*s:from+sweep+(Math.sign(sweep)*360-sweep)*s)*DEG;
  return out.set(Math.cos(height)*Math.sin(round),Math.sin(height),Math.cos(height)*Math.cos(round));
}
export const sunDirection=(hour,out=new pc.Vec3())=>arc(hour,SUNRISE,SUNSET-SUNRISE,62,120,-240,out);
export const moonDirection=(hour,out=new pc.Vec3())=>arc(hour,SUNSET,24-SUNSET+SUNRISE,45,90,180,out);
/** Sunlight or moonlight never grazes lower than this. It fades as its source sinks under FADE_BELOW,
 *  down to FLOOR of the palette's intensity where sun and moon hand over, never out altogether. */
const LOWEST=Math.sin(3*DEG),FADE_BELOW=Math.sin(10*DEG),FLOOR=.15,MOON=new pc.Vec3(),LIVE=new pc.Vec3();

export class Daylight {
  constructor(app,sun,camera){
    this.app=app;this.sun=sun;this.camera=camera;
    this.hour=15;this.paused=false;this.lamps=[];this.onPhase=null;this.phase=null;
    // Where the sun stood when the light last turned: src/world/sky.js draws it there.
    this.sunUp=new pc.Vec3(0,1,0);
    // How much of the moon is lit (src/world/sky.js sets it each day): a new moon gives almost no light.
    this.moonLit=1;
  }
  /** Register a material that should glow after dark (lanterns, street lights, room lamps). */
  addLamp(material,peak=1){this.lamps.push({material,peak,last:-1});return material;}
  advance(dt){
    if(!this.paused)this.hour=(this.hour+dt*(24/(MINUTES_PER_DAY*60)))%24;
    this.apply(this.camera.getPosition().length()<SUN_TURNS_WITHIN||Math.floor(this.hour/SUN_STEP_HOURS)!==this.sunStep);
  }
  setHour(hour){this.hour=((hour%24)+24)%24;this.apply();}
  /** `turn`: also move the sun to this hour's angle (see SUN_TURNS_WITHIN). */
  apply(turn=true){
    const state=skyAt(this.hour);
    this.state=state;
    this.app.scene.ambientLight=state.ambient;
    this.camera.camera.clearColor=state.sky;
    this.sun.light.color=state.sun;
    // By day the light comes from the sun, by night from the moon. A directional light shines down
    // its entity's −y, so its pitch is measured from straight down: 90° less the source's height.
    if(turn){
      const from=sunDirection(this.hour,this.sunUp).y>0?this.sunUp:moonDirection(this.hour,MOON);
      this.sun.setEulerAngles(90-Math.asin(Math.max(LOWEST,from.y))/DEG,Math.atan2(from.x,from.z)/DEG,0);
      this.sunStep=Math.floor(this.hour/SUN_STEP_HOURS);
    }
    // Its strength follows the live sun or moon every frame, even while its direction holds (far from
    // town): it dims as its source nears the horizon, so the swap at sunrise and sunset hardly shows.
    const sunUp=sunDirection(this.hour,LIVE).y>0,height=sunUp?LIVE.y:moonDirection(this.hour,LIVE).y;
    const fade=Math.min(1,Math.max(0,height/FADE_BELOW)),rise=fade*fade*(3-2*fade),moonlight=sunUp?1:.1+.9*this.moonLit;
    this.sun.light.intensity=state.intensity*(FLOOR*(1-rise)+rise*moonlight);
    // emissiveIntensity is a shader uniform: it needs an update() to take effect, so only
    // push a change when the value has actually moved.
    for(const lamp of this.lamps){
      const value=state.lamps*lamp.peak;
      if(Math.abs(value-lamp.last)<.02)continue;
      lamp.last=value;lamp.material.emissiveIntensity=value*1.6;lamp.material.update();
    }
    if(state.label!==this.phase){this.phase=state.label;this.onPhase?.(state);}
    return state;
  }
  get isNight(){return this.state?this.state.lamps>.5:false;}
}
