import * as pc from 'playcanvas';
import SHOW from '../content/drones.json' with {type:'json'};
import signTexts from '../content/signs.json' with {type:'json'};
import objectNames from '../content/objects.json' with {type:'json'};
import {MINUTES_PER_DAY} from './daylight.js';
import {reflect} from './bay.js';
import {zh,scripted} from '../services/script.js';

/**
 * The drone show over the bay (task L-drones, docs/superpowers/plans/2026-09-26-development-wave-2.md).
 * A few hundred lights take off from a barge at each hour in drones.json, draw words and shapes
 * over 云海湾 and land again. Every drone is an instance of one small sphere: the main colour and
 * the accent colour are one instanced draw call each, and a colour change is a material uniform.
 * The show runs off the game clock (`town.daylight.setHour(20)` starts it), or now with `startShow()`.
 */
const SECONDS_PER_HOUR=MINUTES_PER_DAY*60/24;
const SPREAD=.25;      // how far behind the first drone the last one sets off in a move, as a share of it
// A light weight: the drones then trace each stroke in a line instead of filling a fat one.
const FONT='300 112px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';

/** The show as steps of real seconds, `from` one formation `to` the next; -1 is the barge. */
export function timeline(show=SHOW){
  const last=show.formations.length-1,steps=[{from:-1,to:-1,s:show.launch},{from:-1,to:0,s:show.rise}];
  show.formations.forEach((_,i)=>{steps.push({from:i,to:i,s:show.hold});if(i<last)steps.push({from:i,to:i+1,s:show.move});});
  steps.push({from:last,to:-1,s:show.land});
  return steps;
}
export const showLength=steps=>steps.reduce((sum,step)=>sum+step.s,0);
const sinceStart=(hour,start)=>((hour-start+24)%24)*SECONDS_PER_HOUR;
/** Which of `show.times` is on at this clock hour (the latest to have started), or -1. */
export function showIndex(hour,show=SHOW,length=showLength(timeline(show))){
  let best=-1;
  for(let i=0;i<show.times.length;i++){
    const t=sinceStart(hour,show.times[i].at);
    if(t<length&&(best<0||t<sinceStart(hour,show.times[best].at)))best=i;
  }
  return best;
}
/** Real seconds into the show that is on at this clock hour, or null when none is. */
export function showTime(hour,show=SHOW,length=showLength(timeline(show))){
  const i=showIndex(hour,show,length);
  return i<0?null:sinceStart(hour,show.times[i].at);
}
/** Admin and tests: start show `index` of drones.json's `times` now, whatever the clock says.
 *  It takes off the next frame the tourist is in 云海. False (and nothing starts) for no such show. */
let requested=-1;
export function startShow(index=0){
  if(!Number.isInteger(index)||!SHOW.times[index])return false;
  requested=index;return true;
}
/** Where `t` falls in the steps: writes {from, to, u} (u runs 0..1 through the step) into `out`. */
export function stepAt(steps,t,out){
  for(const step of steps){
    if(t<step.s){out.from=step.from;out.to=step.to;out.u=t/step.s;return out;}
    t-=step.s;
  }
  const end=steps[steps.length-1];
  out.from=end.from;out.to=end.to;out.u=1;return out;
}
/**
 * `n` points spread evenly over the opaque pixels of an RGBA image: the image is cut into square
 * cells, as large as still leaves at least `n` cells with ink in them, and each cell gives the
 * centre of its ink. Returns [x0, y0, x1, y1, ...] in pixels, sorted left to right, so that two
 * formations pair their drones up without them crossing the whole sky.
 */
export function samplePoints(data,w,h,n){
  const ink=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>127)ink.push(x,y);
  if(!ink.length)return new Float32Array(n*2);
  const cells=size=>{
    const map=new Map();
    for(let i=0;i<ink.length;i+=2){
      const key=Math.floor(ink[i]/size)+Math.floor(ink[i+1]/size)*65536;
      const cell=map.get(key);
      if(cell){cell[0]+=ink[i];cell[1]+=ink[i+1];cell[2]++;}else map.set(key,[ink[i],ink[i+1],1]);
    }
    return [...map.values()];
  };
  let lo=1,hi=Math.max(w,h);
  for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(cells(mid).length>=n)lo=mid;else hi=mid;}
  const found=cells(lo),out=[];
  // More cells than drones: take an even spread of them. Fewer (a tiny mask): drones double up.
  for(let i=0;i<n;i++){const [sx,sy,count]=found[Math.floor(i*found.length/n)%found.length];out.push([sx/count,sy/count]);}
  out.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  return Float32Array.from(out.flat());
}
/** Which of `n` sorted points go to the accent colour: an even spread of `accent` of them. */
export function accentPicks(n,accent){
  const picks=new Set();
  for(let k=0;k<accent;k++)picks.add(Math.floor(k*n/accent));
  return picks;
}

/** A formation drawn on a canvas and sampled: [main pixels, accent pixels, width, height]. */
function rasterise(formation,count,accent){
  const canvas=document.createElement('canvas'),g=canvas.getContext('2d',{willReadFrequently:true});
  if(formation.text){
    // `wrap`: at most that many characters to a line, so a long phrase stands in two big lines.
    const text=zh(formation.text),lines=[],wrap=formation.wrap??text.length;   // 繁體字 when that is on
    for(let i=0;i<text.length;i+=wrap)lines.push(text.slice(i,i+wrap));
    g.font=FONT;
    const w=Math.ceil(Math.max(...lines.map(line=>g.measureText(line).width)))+16,h=128*lines.length;
    canvas.width=w;canvas.height=h;
    g.font=FONT;g.textAlign='center';g.textBaseline='middle';lines.forEach((line,i)=>g.fillText(line,w/2,i*128+66));
    const all=samplePoints(g.getImageData(0,0,w,h).data,w,h,count),picks=accentPicks(count,accent),main=[],extra=[];
    for(let i=0;i<count;i++)(picks.has(i)?extra:main).push(all[i*2],all[i*2+1]);
    return [main,extra,w,h];
  }
  const w=400,h=240,sample=(strokes,n)=>{
    g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,w,h);
    g.setTransform(2,0,0,2,0,0);g.lineWidth=4.5;g.lineCap='round';g.lineJoin='round';g.strokeStyle='#fff';
    for(const stroke of strokes){
      const points=stroke.line??stroke.curve;
      g.beginPath();g.moveTo(...points[0]);
      if(stroke.line)for(const p of points.slice(1))g.lineTo(...p);
      else{
        // Through the midpoints, with each given point as a control: a smooth curve.
        for(let i=1;i<points.length-1;i++)
          g.quadraticCurveTo(...points[i],(points[i][0]+points[i+1][0])/2,(points[i][1]+points[i+1][1])/2);
        g.lineTo(...points[points.length-1]);
      }
      g.stroke();
    }
    return [...samplePoints(g.getImageData(0,0,w,h).data,w,h,n)];
  };
  canvas.width=w;canvas.height=h;
  return [sample(formation.main,count-accent),sample(formation.accent,accent),w,h];
}

/** What looking at a standing formation names: its sign, or the object it draws. */
function nameOf(formation){
  if(formation.text){
    const sign=signTexts.signs[formation.text];
    return {id:'sign:'+(sign?.id??formation.text),zh:formation.text,pinyin:sign?.pinyin,en:sign?.en,sign:true};
  }
  return {id:formation.look,...objectNames.objects[formation.look]};
}

export function buildDrones(town,root){
  const count=SHOW.count,accent=SHOW.accent,mainCount=count-accent;
  const origin=root.getPosition().clone();
  const [cx,cy,cz]=SHOW.centre,[bw,bh]=SHOW.size;
  // Every formation, and the barge, as city-local positions: main drones first, then accent.
  const place=(formation,out=new Float32Array(count*3))=>{
    const [main,extra,w,h]=rasterise(formation,count,accent),scale=Math.min(bw/w,bh/h);
    [...main,...extra].forEach((v,i)=>{
      const k=(i>>1)*3;
      if(i%2===0)out[k]=cx+(v-w/2)*scale;else{out[k+1]=cy+(h/2-v)*scale;out[k+2]=cz;}
    });
    return out;
  };
  const shapes=SHOW.formations.map(formation=>place(formation));
  // 繁體字 on or off: the words are sampled again, in place (the city is built once and kept).
  scripted(()=>SHOW.formations.forEach((formation,i)=>{if(formation.text)place(formation,shapes[i]);}));
  const side=Math.ceil(Math.sqrt(count)),grid=[];
  for(let i=0;i<count;i++)grid.push([SHOW.pad.centre[0]+(i%side-(side-1)/2)*SHOW.pad.spacing,SHOW.pad.centre[2]+(Math.floor(i/side)-(side-1)/2)*SHOW.pad.spacing]);
  grid.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const padPicks=accentPicks(count,accent),pad=new Float32Array(count*3);
  [...grid.filter((_,i)=>!padPicks.has(i)),...grid.filter((_,i)=>padPicks.has(i))].forEach(([x,z],i)=>{
    pad[i*3]=x;pad[i*3+1]=SHOW.pad.centre[1];pad[i*3+2]=z;
  });
  // A little disorder, fixed per drone: when it sets off in a move, and the rhythm of its twinkle.
  const delay=new Float32Array(count),phase=new Float32Array(count);
  for(let i=0;i<count;i++){
    const r=Math.sin(i*12.9898)*43758.5453;delay[i]=(r-Math.floor(r))*SPREAD;
    const q=Math.sin(i*78.233)*12345.678;phase[i]=(q-Math.floor(q))*Math.PI*2;
  }

  const device=town.app.graphicsDevice,format=pc.VertexFormat.getDefaultInstancingFormat(device);
  const mesh=pc.Mesh.fromGeometry(device,new pc.SphereGeometry({radius:SHOW.radius,latitudeBands:4,longitudeBands:6}));
  // Colours as the linear values the shader's emissive uniform takes: a change of colour is three floats.
  const colors=SHOW.formations.map(f=>f.colors.map(c=>{const linear=new pc.Color().fromString(c).linear();return [linear.r,linear.g,linear.b];}));
  const entity=new pc.Entity('drones');
  entity.noBatch=true;
  const groups=[[0,mainCount],[mainCount,count]].map(([first,end],colour)=>{
    const material=new pc.StandardMaterial();
    material.diffuse=new pc.Color(0,0,0);material.emissive=new pc.Color(1,1,1);material.emissiveIntensity=1.4;
    material.useLighting=false;material.useFog=false;material.useSkybox=false;material.update();
    const matrices=new Float32Array((end-first)*16);
    for(let i=0;i<end-first;i++)matrices[i*16+15]=1;
    const buffer=new pc.VertexBuffer(device,format,end-first,{usage:pc.BUFFER_DYNAMIC,data:matrices.buffer});
    const instance=new pc.MeshInstance(mesh,material);
    instance.setInstancing(buffer);   // no culling: the mesh's own box sits at the origin
    return {first,end,colour,material,matrices,buffer,instance,emissive:new Float32Array(colors[0][colour])};
  });
  entity.addComponent('render',{castShadows:false,receiveShadows:false});
  entity.render.meshInstances=groups.map(group=>group.instance);entity.render.castShadows=false;
  entity.enabled=false;
  root.addChild(entity);
  reflect(entity);

  const steps=timeline(),length=showLength(steps),landing=length-SHOW.land;
  const names=SHOW.formations.map(nameOf),droneName={id:'drone',...objectNames.objects.drone};
  const step={from:-1,to:-1,u:0};
  let last=null,look=null,lookName=null,clock=0,manual=null,which=-1;   // manual: {index, t} from startShow
  const setLook=name=>{
    if(name===lookName)return;
    town.registry.clearLooks('city','drones');
    lookName=name;
    look=name?town.registry.addLook({place:'city',x:0,z:0,hw:1,hd:1,y0:0,y1:1,name,owner:'drones',entity}):null;
    if(look)look.reach=180;   // the show is far out over the water, well past arm's length
  };

  return {
    update(dt){
      if(requested>=0){manual={index:requested,t:0};requested=-1;last=null;}
      if(manual&&(manual.t+=dt)>=length)manual=null;
      let t;
      if(manual){t=manual.t;which=manual.index;}
      else{which=showIndex(town.daylight.hour,SHOW,length);t=which<0?null:showTime(town.daylight.hour,SHOW,length);}
      if(t===null){
        if(last!==null){last=null;entity.enabled=false;setLook(null);}
        return;
      }
      // The loudspeakers are out in the street: a tower's window (src/world/rental.js) shows the show, silently.
      const heard=town.place==='city';
      if(heard&&(last===null||last>t)&&t<SHOW.launch)town.onAnnounce?.(SHOW.lines.start);
      if(heard&&last!==null&&last<landing&&t>=landing)town.onAnnounce?.(SHOW.lines[SHOW.times[which].end]);
      last=t;entity.enabled=true;clock+=dt;
      stepAt(steps,t,step);
      const from=step.from<0?pad:shapes[step.from],to=step.to<0?pad:shapes[step.to];
      const moving=step.from!==step.to,u=step.u,mix=moving?u*u*(3-2*u):1;
      // The barge has no colours of its own: it keeps those of the formation next to it.
      const was=colors[Math.max(step.from<0?step.to:step.from,0)],next=colors[Math.max(step.to<0?step.from:step.to,0)];
      // Lights come on at the barge, and go out once the drones are down again.
      const glow=Math.min(1,t/1.2,(length-t)/1.2);
      let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity;
      for(const {first,end,colour,material,matrices,buffer,emissive} of groups){
        const a=was[colour],b=next[colour];
        for(let k=0;k<3;k++)emissive[k]=a[k]+(b[k]-a[k])*mix;
        // Set every frame: the material's own uniforms, written on its first draw, would cover it.
        material.setParameter('material_emissive',emissive);
        for(let i=first;i<end;i++){
          let k=1;
          if(moving){k=Math.min(1,Math.max(0,(u-delay[i])/(1-SPREAD)));k=k*k*(3-2*k);}
          const p=i*3;
          const x=from[p]+(to[p]-from[p])*k,z=from[p+2]+(to[p+2]-from[p+2])*k;
          const y=from[p+1]+(to[p+1]-from[p+1])*k+Math.sin(clock*1.7+phase[i])*.12;
          const s=glow*(1+Math.sin(clock*5.3+phase[i]*7)*.2);   // a small twinkle
          const m=(i-first)*16;
          matrices[m]=matrices[m+5]=matrices[m+10]=s;
          matrices[m+12]=x;matrices[m+13]=y;matrices[m+14]=z;   // city-local: the shader applies the entity's own transform too
          if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;if(z<z0)z0=z;if(z>z1)z1=z;
        }
        buffer.unlock();
      }
      // Looking at the lights: the phrase or thing while a formation stands, 无人机 otherwise.
      setLook(!moving&&step.from>=0?names[step.from]:droneName);
      look.x=origin.x+(x0+x1)/2;look.z=origin.z+(z0+z1)/2;look.hw=(x1-x0)/2+1;look.hd=(z1-z0)/2+1.5;
      look.y0=origin.y+y0-1;look.y1=origin.y+y1+1;
    },
  };
}
