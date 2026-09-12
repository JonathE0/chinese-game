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

export class Daylight {
  constructor(app,sun,camera){
    this.app=app;this.sun=sun;this.camera=camera;
    this.hour=15;this.paused=false;this.lamps=[];this.onPhase=null;this.phase=null;
  }
  /** Register a material that should glow after dark (lanterns, street lights, room lamps). */
  addLamp(material,peak=1){this.lamps.push({material,peak,last:-1});return material;}
  advance(dt){if(!this.paused)this.hour=(this.hour+dt*(24/(MINUTES_PER_DAY*60)))%24;this.apply();}
  setHour(hour){this.hour=((hour%24)+24)%24;this.apply();}
  apply(){
    const state=skyAt(this.hour);
    this.state=state;
    this.app.scene.ambientLight=state.ambient;
    this.camera.camera.clearColor=state.sky;
    this.sun.light.color=state.sun;
    this.sun.light.intensity=state.intensity;
    // The sun swings east to west and dips below the horizon at night.
    const dayProgress=(this.hour-6)/12;
    this.sun.setEulerAngles(Math.max(8,Math.sin(Math.PI*Math.min(1,Math.max(0,dayProgress)))*62+8),-140+dayProgress*160,0);
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
