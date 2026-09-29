import * as pc from 'playcanvas';
import {inShape} from '../core/garden.js';

/**
 * All the water — the park's pond and stream, the riverside canal, the square's fountain and
 * 云海's bay — is one shader (docs/superpowers/plans/2026-09-26-development-wave-2.md, H-water).
 * A body of water gets its own material only for what is its own: which way and how fast it flows,
 * its colours and how it deepens. What moves is shared and set once a frame: the sun, the sky and
 * the ripple rings as global uniforms, and each material's scroll as a few floats in an array it
 * already holds, so animating all of it is a handful of uniform writes and no material updates.
 *
 * The surface is a small tileable ripple texture, made once, scrolled along the flow in two layers
 * at different scales. It is lit by the sun (the sharp glint on each ripple is the sparkle),
 * coloured from shallow to deep by depth and by how steeply you look into it, and turns to the sky
 * at a glancing angle (Fresnel); on the bay the sky is the planar reflection (src/world/bay.js).
 * Rings spread where something touches the water: a pool of eight, drawn by the same shader, so a
 * splash costs no draw call.
 */
export const RIPPLES=8;          // ring slots, shared by every body of water (the shader loops over them)
export const RIPPLE_LIFE=2.6;    // seconds a ring spreads before it has faded out
const RING_SPEED=1.1;            // metres a second the front ring travels
const EDGE=1.1;                  // standing this close to the water, rings lap at its edge
const TEXELS=128;                // the ripple texture's size, in pixels a side

const VS=`attribute vec3 vertex_position;
uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
varying vec3 vWorld;
void main(void){
  vec4 world=matrix_model*vec4(vertex_position,1.0);
  vWorld=world.xyz;
  gl_Position=matrix_viewProjection*world;
}`;
// Engine chunks finish the colour exactly as the lit materials do: fog, then tone mapping, then gamma.
const FS=`#include "gammaPS"
#include "tonemappingPS"
#include "fogPS"
#define RIPPLES ${RIPPLES}
varying vec3 vWorld;
uniform vec3 view_position;
uniform vec3 light_globalAmbient;
uniform sampler2D waterMap;           // rg: slopes, b: height
uniform vec3 waterSunDir;             // towards the sun
uniform vec3 waterSunColor;           // linear, times its intensity
uniform vec3 waterSky;                // linear
uniform vec4 waterRipples[RIPPLES];   // x, z, age in seconds, strength (0: a free slot)
uniform vec4 waterScroll;             // the two layers' offsets, in tiles
uniform vec4 waterShape;              // tile size in metres, ripple strength, depth base, depth per metre
uniform vec2 waterDeepDir;            // the way the water deepens
uniform vec3 waterShallow;
uniform vec3 waterDeep;
#ifdef REFLECT
  uniform sampler2D reflectionMap;
  uniform vec4 viewport_size;
  uniform float reflectionStrength;
#endif
void main(void){
  vec3 toEye=view_position-vWorld;
  float dist=length(toEye);
  vec3 V=toEye/dist;
  float tile=waterShape.x;
#ifdef FALL
  // A sheet pouring down a rock face: streaks stretched down the fall, running downwards.
  vec2 p=vec2((vWorld.x+vWorld.z)*2.0,vWorld.y*.7)/tile;
  float streak=smoothstep(.35,.85,texture2D(waterMap,p+waterScroll.xy).b);
  vec3 color=mix(waterShallow,vec3(.9,.95,.94),streak*.7)*(light_globalAmbient+waterSunColor*.8);
#else
  vec2 p=vWorld.xz/tile;
  vec2 slope=(texture2D(waterMap,p+waterScroll.xy).rg*2.0-1.0)
    +(texture2D(waterMap,p*2.7+waterScroll.zw).rg*2.0-1.0)*.55;
  slope*=waterShape.y;
  float foam=0.0;
  for(int i=0;i<RIPPLES;i++){
    vec4 ring=waterRipples[i];
    if(ring.w<=0.0)continue;
    vec2 d=vWorld.xz-ring.xy;
    float from=length(d)+.0001;
    float x=from-ring.z*${RING_SPEED.toFixed(2)};   // how far behind the front ring this point is
    if(x<-.6||x>1.4)continue;
    float fade=ring.w*(1.0-ring.z/${RIPPLE_LIFE.toFixed(2)})*exp(-x*x*3.0)*min(1.0,from*2.0);
    slope+=d/from*cos(x*14.0)*fade*.8;
    foam+=max(0.0,sin(x*14.0))*fade*.22;
  }
  vec3 N=normalize(vec3(-slope.x,1.0,-slope.y));
  float facing=max(dot(N,V),0.0);
  float fresnel=.02+.98*pow(1.0-facing,5.0);
  float depth=clamp(waterShape.z+dot(vWorld.xz,waterDeepDir)*waterShape.w,0.0,1.0);
  vec3 body=mix(waterShallow,waterDeep,clamp(depth+(1.0-facing)*.35,0.0,1.0));
  vec3 lit=body*(light_globalAmbient+waterSunColor*max(dot(N,waterSunDir),0.0));
  vec3 sky=waterSky;
  #ifdef REFLECT
    // The mirror image at this pixel, nudged by the ripples (less so far away).
    vec2 uv=gl_FragCoord.xy*viewport_size.zw+slope*(.5/(4.0+dist));
    sky=mix(sky,gammaCorrectInput(texture2D(reflectionMap,uv).rgb),reflectionStrength);
  #endif
  float glint=max(dot(reflect(-V,N),waterSunDir),0.0);
  vec3 color=mix(lit,sky,fresnel)+waterSunColor*(pow(glint,700.0)*2.0+pow(glint,60.0)*.06)
    +foam*(light_globalAmbient+waterSunColor*.5);
#endif
  gl_FragColor=vec4(gammaCorrectOutput(toneMap(addFog(color))),1.0);
}`;
const SHADER={uniqueName:'water',vertexGLSL:VS,fragmentGLSL:FS,attributes:{vertex_position:pc.SEMANTIC_POSITION}};

/**
 * The ripple texture's texels: a height field summed from waves whose wave vectors are whole
 * numbers of cycles across the tile, so it repeats without a seam. r and g hold its slopes along x
 * and z, b its height. Seeded, so every visit looks the same.
 */
export function rippleTexels(size=TEXELS){
  let seed=20260926;
  const random=()=>(seed=seed*16807%2147483647)/2147483647,waves=[];
  while(waves.length<20){
    const angle=random()*Math.PI*2,k=1+Math.round(random()*random()*7);
    const kx=Math.round(Math.cos(angle)*k),kz=Math.round(Math.sin(angle)*k);
    if(kx||kz)waves.push([kx,kz,Math.hypot(kx,kz)**-1.5,random()*Math.PI*2]);
  }
  const n=size*size,sx=new Float32Array(n),sz=new Float32Array(n),h=new Float32Array(n);
  let steep=0,low=Infinity,high=-Infinity;
  for(let z=0;z<size;z++)for(let x=0;x<size;x++){
    let a=0,b=0,c=0;
    for(const [kx,kz,amp,phase] of waves){
      const q=2*Math.PI*(kx*x+kz*z)/size+phase,cos=Math.cos(q)*amp;
      a+=cos*kx;b+=cos*kz;c+=Math.sin(q)*amp;
    }
    const i=z*size+x;sx[i]=a;sz[i]=b;h[i]=c;
    steep=Math.max(steep,Math.abs(a),Math.abs(b));low=Math.min(low,c);high=Math.max(high,c);
  }
  const out=new Uint8Array(n*4);
  for(let i=0;i<n;i++){
    out[i*4]=Math.round(127.5+127.5*sx[i]/steep);out[i*4+1]=Math.round(127.5+127.5*sz[i]/steep);
    out[i*4+2]=Math.round(255*(h[i]-low)/(high-low));out[i*4+3]=255;
  }
  return out;
}

/** A fixed pool of ripple rings, laid out as the shader reads them: x, z, age, strength. A new
 *  ring takes a free slot, or the oldest; the pool never grows. */
export class Ripples {
  constructor(){this.data=new Float32Array(RIPPLES*4);}
  add(x,z,strength=1){
    const d=this.data;let slot=0,oldest=-1;
    for(let i=0;i<RIPPLES;i++){
      if(d[i*4+3]<=0){slot=i;break;}
      if(d[i*4+2]>oldest){oldest=d[i*4+2];slot=i;}
    }
    d[slot*4]=x;d[slot*4+1]=z;d[slot*4+2]=0;d[slot*4+3]=strength;
    return slot;
  }
  step(dt){
    const d=this.data;
    for(let i=0;i<RIPPLES;i++){
      if(d[i*4+3]<=0)continue;
      d[i*4+2]+=dt;
      if(d[i*4+2]>=RIPPLE_LIFE)d[i*4+3]=0;
    }
  }
  get active(){let n=0;for(let i=0;i<RIPPLES;i++)if(this.data[i*4+3]>0)n++;return n;}
}

const WATERS=new WeakMap();
/** The one water system of an app, made the first time anything asks for it. */
export function waterOf(app){
  let water=WATERS.get(app);
  if(!water)WATERS.set(app,water=new Water(app));
  return water;
}

const linear=hex=>{const c=new pc.Color().fromString(hex).linear();return new Float32Array([c.r,c.g,c.b]);};
const wrap=v=>v-Math.floor(v);

export class Water {
  constructor(app){
    this.app=app;this.time=0;this.paused=false;this.place=null;
    this.ripples=new Ripples();this.bodies=[];this.surfaces=[];this.lap=0;
    const g=app.graphicsDevice;
    this.texture=new pc.Texture(g,{name:'water-ripples',width:TEXELS,height:TEXELS,format:pc.PIXELFORMAT_RGBA8,
      mipmaps:true,minFilter:pc.FILTER_LINEAR_MIPMAP_LINEAR,magFilter:pc.FILTER_LINEAR,
      addressU:pc.ADDRESS_REPEAT,addressV:pc.ADDRESS_REPEAT,anisotropy:8});
    this.texture.lock().set(rippleTexels());this.texture.unlock();
    const scope=g.scope;
    this.uniforms={sunDir:scope.resolve('waterSunDir'),sunColor:scope.resolve('waterSunColor'),
      sky:scope.resolve('waterSky'),ripples:scope.resolve('waterRipples[0]')};
    this.sunDir=new Float32Array(3);this.sunColor=new Float32Array(3);this.sky=new Float32Array(3);
    this.color=new pc.Color();
  }

  /**
   * A material for one body of water; make it once, when the body is built. `flow` is [x, z] in
   * metres a second; `tile` the ripple texture's size in metres; `ripple` how choppy it is;
   * `depth` [x, z, base, per metre] says how deep (0..1) it is at a point: base + (x, z)·(point) ×
   * per metre. `fall` is a sheet pouring down; `reflect` samples the bay's mirror (src/world/bay.js).
   */
  surface({flow=[0,0],tile=3,ripple=.18,shallow='#7fb6ad',deep='#2e6368',depth=[0,0,.35,0],fall=false,reflect=false}={}){
    const material=new pc.ShaderMaterial(SHADER),scroll=new Float32Array(4);
    if(fall)material.setDefine('FALL',true);
    if(reflect){material.setDefine('REFLECT',true);material.setParameter('reflectionStrength',0);}
    material.setParameter('waterMap',this.texture);
    material.setParameter('waterScroll',scroll);   // rewritten in place every frame (update)
    material.setParameter('waterShape',new Float32Array([tile,ripple,depth[2],depth[3]]));
    material.setParameter('waterDeepDir',new Float32Array([depth[0],depth[1]]));
    material.setParameter('waterShallow',linear(shallow));
    material.setParameter('waterDeep',linear(deep));
    material.update();
    this.surfaces.push({flow,tile,fall,scroll});
    return material;
  }

  /** Where the water lies in `place` (world coordinates): rects {x0,x1,z0,z1} and discs {x,z,r}
   *  at height `level`; `dry(x, z)` marks what stands in it (an island, a bridge). */
  body(place,shapes,level,dry=null){this.bodies.push({place,shapes,level,dry});}

  /** The water's surface at (x, z), or null where there is none: the highest, so a fountain's
   *  bowls stand above its pool. */
  levelAt(place,x,z){
    let level=null;
    for(const b of this.bodies){
      if(b.place!==place||(level!==null&&b.level<=level)||b.dry?.(x,z))continue;
      for(const s of b.shapes)if(inShape(s,x,z)){level=b.level;break;}
    }
    return level;
  }

  /** Rings spread from (x, z). */
  ripple(x,z,strength=1){return this.ripples.add(x,z,strength);}

  /** The nearest water within reach of someone standing at (x, y, z) on the bank, a little way
   *  out from the edge, into `out`; false when there is none (or they stand over the water). */
  edge(place,x,y,z,out){
    let best=EDGE,found=false;
    for(const b of this.bodies){
      if(b.place!==place||Math.abs(y-b.level)>2.5)continue;
      for(const s of b.shapes){
        let px,pz,d;
        if(s.r!==undefined){
          const dx=x-s.x,dz=z-s.z,from=Math.hypot(dx,dz)||1;
          d=from-s.r;px=s.x+dx/from*s.r;pz=s.z+dz/from*s.r;
        } else {
          px=Math.min(s.x1,Math.max(s.x0,x));pz=Math.min(s.z1,Math.max(s.z0,z));d=Math.hypot(x-px,z-pz);
        }
        if(d<=0)return false;   // over the water: on a bridge or the island
        if(d>=best||b.dry?.(px,pz))continue;
        // A step past the edge, straight out from where they stand.
        const k=.35/Math.max(d,.01);
        best=d;found=true;out.x=px+(px-x)*k;out.z=pz+(pz-z)*k;
      }
    }
    return found;
  }

  /** Once a frame, from the town: scroll every surface, light it, age the rings, and let the water
   *  lap at the bank where the tourist stands. */
  update(dt,town){
    if(!this.paused)this.time+=dt;
    const t=this.time;
    for(const s of this.surfaces){
      const fx=s.flow[0],fz=s.flow[1],o=s.scroll;
      if(s.fall){o[0]=0;o[1]=wrap(Math.hypot(fx,fz)*t/(s.tile/.7));continue;}
      // The second, finer layer drifts slower and a little across the flow, so the water never
      // reads as one sheet sliding by.
      o[0]=wrap(-fx*t/s.tile);o[1]=wrap(-fz*t/s.tile);
      o[2]=wrap((-fx*.6+fz*.25-.02)*t*2.7/s.tile);o[3]=wrap((-fz*.6-fx*.25+.015)*t*2.7/s.tile);
    }
    const sun=town.sun,up=sun.up,light=sun.light;
    this.sunDir[0]=up.x;this.sunDir[1]=up.y;this.sunDir[2]=up.z;
    this.color.linear(light.color);
    this.sunColor[0]=this.color.r*light.intensity;this.sunColor[1]=this.color.g*light.intensity;this.sunColor[2]=this.color.b*light.intensity;
    this.color.linear(town.camera.camera.clearColor);
    this.sky[0]=this.color.r;this.sky[1]=this.color.g;this.sky[2]=this.color.b;
    if(!this.paused)this.ripples.step(dt);
    const u=this.uniforms;
    u.sunDir.setValue(this.sunDir);u.sunColor.setValue(this.sunColor);u.sky.setValue(this.sky);u.ripples.setValue(this.ripples.data);
    this.place=town.place;
    // Walking along the bank the water laps at your feet every half second; standing, now and then.
    if((this.lap-=dt)>0)return;
    const p=town.player.entity.getPosition(),moving=Math.hypot(town.velocity.x,town.velocity.z)>.3;
    this.lap=moving?.45:1.8;
    if(this.edge(town.place,p.x,p.y,p.z,SPOT))this.ripple(SPOT.x,SPOT.z,moving?.7:.4);
  }
}
const SPOT={x:0,z:0};
