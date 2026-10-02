import * as pc from 'playcanvas';
import objectNames from '../content/objects.json' with {type:'json'};
import {festivalOn} from '../core/festivals.js';
import {sunDirection,moonDirection} from './daylight.js';
import {reflect} from './bay.js';

/**
 * 太阳, 月亮 and 星星 (task S-sky, docs/superpowers/plans/2026-09-27-development-wave-3.md).
 *
 * Three meshes on one node that follows the camera, each held just inside the far clip so the whole
 * world draws in front of them: the sun (one glowing quad, tinted with the sunlight), the moon (one
 * quad whose canvas is redrawn once a day for its phase) and the stars (one mesh of small quads,
 * faded in with the evening). Three draw calls at most, twice while the bay mirrors them. They are
 * unlit, unfogged, additive and never write depth. Outdoors only: in the town and in 云海.
 *
 * The sun is drawn where the light came from when it last turned (Daylight#sunUp), so it always
 * agrees with the shadows, holding its angle with the light far from town. Each has a far look
 * box with a `reach`, so looking at it names it.
 */
const NAMES=objectNames.objects;
const NEAR_FAR=.95;                       // how far out, as a share of the camera's far clip
const SUN_SIZE=.09,SUN_DISC=.022;         // half the quad, and the disc's radius (radians, roughly)
const MOON_SIZE=.05,MOON_DISC=.025,MOON_FESTIVAL=1.6;
const SET=-Math.sin(1.5*Math.PI/180);     // a disc wholly under the horizon
const DEG=180/Math.PI,STARS=420,DUSK=Math.sin(8*Math.PI/180),NOW=new pc.Vec3();

/** How far the stars are out at an hour, 0 to 1: from sunset until the sun is 8° under, and back at dawn. */
export const starsAt=hour=>Math.min(1,Math.max(0,-sunDirection(hour,NOW).y/DUSK));

/** The moon's phase on a day, 0 new to .5 full: a fourteen-day cycle, two to the 28-day festival
 *  year, anchored so every 中秋节 falls on the full moon. */
export const MOON_DAYS=14;
const FIRST_ZHONGQIU=[...Array(64).keys()].find(day=>festivalOn(day)?.id==='zhongqiu');
export function moonPhase(day){
  return ((((day-FIRST_ZHONGQIU)%MOON_DAYS+MOON_DAYS)%MOON_DAYS)/MOON_DAYS+.5)%1;
}

export class Sky {
  constructor(town){
    this.town=town;this.day=null;this.lit=0;this.scale=1;this.tint=-1;this.shine=-1;this.place=null;
    const device=town.app.graphicsDevice,glow=texture(device,drawGlow());
    this.root=new pc.Entity('sky');town.app.root.addChild(this.root);
    this.sun=quad(this.root,'sun',material(glow,2.2),device);
    this.moonMap=texture(device,drawMoon(.5));
    this.moon=quad(this.root,'moon',material(this.moonMap,1.3),device);
    this.stars=starField(this.root,material(glow,1.6),device);
    reflect(this.root);
    const reg=town.registry,look=(id,entity)=>reg.addLook({place:null,x:0,z:0,hw:0,hd:0,y0:0,y1:0,
      name:{id,...NAMES[id]},owner:'sky',entity});
    this.looks=[look('sun',this.sun),look('yueliang',this.moon),look('star',this.stars)];
    this.setDay(0);
  }

  /** The calendar's day (src/world/festivals.js passes it every frame): the moon's phase and size. */
  setDay(day){
    if(day===this.day)return;
    this.day=day;
    const phase=moonPhase(day);
    this.lit=(1-Math.cos(2*Math.PI*phase))/2;
    this.town.daylight.moonLit=this.lit;   // moonlight is as strong as the moon is full
    this.scale=festivalOn(day)?.id==='zhongqiu'?MOON_FESTIVAL:1;
    this.moonMap.setSource(drawMoon(phase));   // a new canvas, so the engine sees a change
  }

  /** Every frame, after the camera is placed and before the look is worked out. */
  update(){
    const t=this.town,d=t.daylight,state=d.state,reg=t.registry;
    // Up 云海中心 the windows look out on the city (src/world/views.js): the sky is hung round that
    // view's camera instead, thousands of metres from the room, so only the window shows it.
    const view=t.views?.tower&&t.views.camera.camera.enabled?t.views.camera:null;
    const outdoors=t.place==='town'||!!t.rooms.get(t.place)?.data.outdoor||!!view;
    if(this.root.enabled!==outdoors)this.root.enabled=outdoors;
    if(!outdoors||!state)return;
    const eye=(view??t.camera).getPosition(),far=(view??t.camera).camera.farClip*NEAR_FAR;
    this.root.setPosition(eye);
    // The look boxes follow you from place to place (only a whole place's looks are ever cleared
    // without an owner, and only as the rooms are first registered).
    if(this.place!==t.place){this.place=t.place;for(const box of this.looks){box.place=t.place;if(!reg.looks.includes(box))reg.looks.push(box);}}
    // The sun: where the light comes from, while the clock says it is up.
    const sunUp=sunDirection(d.hour,NOW).y>SET&&d.sunUp.y>SET;
    this.put(this.sun,this.looks[0],sunUp,d.sunUp,eye,far,SUN_SIZE,SUN_DISC);
    const tint=state.sun.r+state.sun.g*3+state.sun.b*9;
    if(sunUp&&Math.abs(tint-this.tint)>.01){this.tint=tint;const m=this.sun.render.meshInstances[0].material;m.emissive.copy(state.sun);m.update();}
    // The moon: on its own arc, at night, unless it is new.
    const moonUp=this.lit>.04&&moonDirection(d.hour,NOW).y>SET;
    this.put(this.moon,this.looks[1],moonUp,NOW,eye,far,MOON_SIZE*this.scale,MOON_DISC*this.scale);
    // The stars come out once the sun is down, and are all out by the time it is 8° under.
    const shine=starsAt(d.hour);
    if(this.stars.enabled!==shine>0)this.stars.enabled=shine>0;
    if(Math.abs(shine-this.shine)>.02){this.shine=shine;const m=this.stars.render.meshInstances[0].material;m.opacity=shine;m.update();}
    if(shine>0){
      this.stars.setLocalScale(far,far,far);
      // The upper sky, from about 20° up: the sun and moon, smaller, win the look inside it.
      const box=this.looks[2];
      box.x=eye.x;box.z=eye.z;box.hw=box.hd=far;box.y0=eye.y+far*.34;box.y1=eye.y+far;box.reach=far*2.5;
    }
  }

  put(entity,box,shown,dir,eye,far,half,disc){
    if(entity.enabled!==shown)entity.enabled=shown;
    if(!shown)return;
    const x=dir.x*far,y=dir.y*far,z=dir.z*far,r=disc*far;
    // Facing the eye at the node's origin: its −z points back along `dir`.
    entity.setLocalPosition(x,y,z);entity.setLocalScale(half*far,half*far,half*far);
    entity.setLocalEulerAngles(-Math.asin(dir.y)*DEG,Math.atan2(dir.x,dir.z)*DEG,0);
    box.x=eye.x+x;box.z=eye.z+z;box.hw=box.hd=r;box.y0=eye.y+y-r;box.y1=eye.y+y+r;box.reach=far*1.2;
  }
}

function material(map,glow){
  const m=new pc.StandardMaterial();
  m.useLighting=false;m.useFog=false;m.useSkybox=false;m.diffuse=new pc.Color(0,0,0);
  m.emissiveMap=map;m.emissive=new pc.Color(1,1,1);m.emissiveIntensity=glow;
  m.opacityMap=map;m.opacityMapChannel='a';
  m.blendType=pc.BLEND_ADDITIVEALPHA;m.depthWrite=false;m.cull=pc.CULLFACE_NONE;
  m.update();
  return m;
}
function texture(device,canvas){
  const tex=new pc.Texture(device,{width:canvas.width,height:canvas.height,mipmaps:true,
    addressU:pc.ADDRESS_CLAMP_TO_EDGE,addressV:pc.ADDRESS_CLAMP_TO_EDGE});
  tex.setSource(canvas);
  return tex;
}
function mesh(device,positions,uvs,indices){
  const m=new pc.Mesh(device);
  m.setPositions(positions);m.setUvs(0,uvs);m.setIndices(indices);m.update();
  return m;
}
function show(parent,name,m,mat){
  const e=new pc.Entity(name);
  e.addComponent('render',{meshInstances:[new pc.MeshInstance(m,mat)],castShadows:false,receiveShadows:false});
  parent.addChild(e);
  return e;
}
/** A unit quad in its own xy plane. Turned to face the eye, its +x is on the viewer's left, so u
 *  runs the other way and the picture reads the right way round. */
function quad(parent,name,mat,device){
  return show(parent,name,mesh(device,[-1,-1,0,1,-1,0,1,1,0,-1,1,0],[1,0,0,0,0,1,1,1],[0,1,2,0,2,3]),mat);
}
/** Stars on the upper sky of a unit sphere (the node is scaled out to the far distance), from a
 *  fixed seed so the sky is the same every night. */
function starField(parent,mat,device){
  let seed=20260927;
  const rand=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;
  const positions=[],uvs=[],indices=[],a=new pc.Vec3(),b=new pc.Vec3(),dir=new pc.Vec3(),side=new pc.Vec3();
  for(let i=0;i<STARS;i++){
    const y=.09+rand()*.91,round=rand()*Math.PI*2,flat=Math.sqrt(1-y*y),size=.004+rand()**3*.006;
    dir.set(flat*Math.cos(round),y,flat*Math.sin(round));
    a.cross(dir,side.set(0,1,0)).normalize().mulScalar(size);b.cross(a,dir);
    for(const [s,t] of [[-1,-1],[1,-1],[1,1],[-1,1]])
      positions.push(dir.x+a.x*s+b.x*t,dir.y+a.y*s+b.y*t,dir.z+a.z*s+b.z*t);
    uvs.push(0,0,1,0,1,1,0,1);
    const k=i*4;indices.push(k,k+1,k+2,k,k+2,k+3);
  }
  const e=show(parent,'stars',mesh(device,positions,uvs,indices),mat);
  e.enabled=false;
  return e;
}

/** White light: a hard disc with a soft glow round it. The sun, and every star. */
function drawGlow(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const c=canvas.getContext('2d'),g=c.createRadialGradient(64,64,0,64,64,64);
  for(const [at,alpha] of [[0,1],[.22,1],[.26,.5],[.45,.16],[1,0]])g.addColorStop(at,`rgba(255,250,240,${alpha})`);
  c.fillStyle=g;c.fillRect(0,0,128,128);
  return canvas;
}
/** The moon at a phase (0 new, .5 full): lit from the right while it waxes, from the left as it wanes. */
function drawMoon(phase){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const c=canvas.getContext('2d'),r=32,k=Math.cos(2*Math.PI*phase),lit=(1-k)/2;
  c.translate(64,64);
  const g=c.createRadialGradient(0,0,r*.9,0,0,64);
  g.addColorStop(0,`rgba(255,246,220,${.35*lit})`);g.addColorStop(1,'rgba(255,246,220,0)');
  c.fillStyle=g;c.fillRect(-64,-64,128,128);
  if(phase>.5)c.scale(-1,1);
  c.beginPath();c.arc(0,0,r,-Math.PI/2,Math.PI/2);
  c.ellipse(0,0,r*Math.abs(k),r,0,Math.PI/2,-Math.PI/2,k>0);
  c.fillStyle='#fff6dc';c.fill();
  return canvas;
}
