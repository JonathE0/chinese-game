import * as pc from 'playcanvas';
import {waterOf} from './water.js';

/**
 * The fountain in the middle of 青禾广场: a carved stone basin with a two-tier centrepiece. Water
 * brims over each bowl in a falling sheet, four spouts on the rim arc jets into the pool, and the
 * pool ripples with splash rings where the jets land. The stone is static and batches with the
 * square; the water is off the batch and animated cheaply: the pool and bowls are the town's shared
 * water (src/world/water.js), the sheets and jets scroll textures, and a handful of meshes move,
 * rather than particles.
 */
export const FOUNTAIN={x:0,z:1.8};
/** Its hitbox: one solid drum round the basin, as tall as the centrepiece, so there is no jumping
 *  into the pool or onto the rim from the paving or a planter. */
export const FOUNTAIN_MARK={radius:2.12,y0:0,y1:2.7};
/** Where it reads as 喷泉 (the drum above carries no name, so a look across the square passes over
 *  the basin): the basin up to its rim, the column and lower bowl, and the upper bowl and bud. */
export const FOUNTAIN_LOOKS=[{radius:2.12,y0:0,y1:.66},{radius:1.0,y0:.66,y1:1.56},{radius:.6,y0:1.56,y1:2.7}];

/** How loud the fountain is from `distance` metres away: full beside it, silent from 16 m. */
export function fountainLevel(distance) {
  const t=Math.min(1,Math.max(0,(distance-2.5)/13.5));
  return (1-t)**2;
}

/**
 * A jet from a spout at radius `fromR`, height `fromY`, that rises by `rise` and lands at radius
 * `toR`, height `toY`: the part of an ellipse (centre `c` out from the middle, at the spout's
 * height, radii `hr` across and `vr` up) swept from the spout, over the top, down to the landing.
 */
export function jetArc(fromR,fromY,toR,toY,rise) {
  const beta=Math.asin(Math.max(-1,Math.min(1,(fromY-toY)/rise)));
  const hr=(fromR-toR)/(1+Math.cos(beta));
  return {c:fromR-hr,hr,vr:rise,sector:180+beta*180/Math.PI};
}

/** A canvas texture from a per-pixel function of (u, v) in 0..1 returning [r, g, b, a]. */
function pixels(app,size,fill) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d'),img=ctx.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)img.data.set(fill(x/size,y/size),(y*size+x)*4);
  ctx.putImageData(img,0,0);
  const texture=new pc.Texture(app.graphicsDevice,{width:size,height:size,mipmaps:true});
  texture.setSource(canvas);return texture;
}
const TAU=Math.PI*2;

export function buildFountain(m,app,parent,active=()=>true) {
  const {cylinder,ball,box,shape}=m;
  const root=new pc.Entity('fountain');root.lookName='fountain';
  root.setLocalPosition(FOUNTAIN.x,0,FOUNTAIN.z);parent.addChild(root);
  const stone='#cfc6ad',stoneDark='#b3aa90',coping='#ddd5bd';
  // The basin: a low plinth, a round wall with carved panels, and a ring of coping stones.
  cylinder(root,[0,.06,0],[4.24,.12,4.24],stoneDark);
  cylinder(root,[0,.3,0],[4.0,.48,4.0],stone);
  for(let i=0;i<8;i++){
    const a=(i+.5)/8*TAU,deg=-a*180/Math.PI;
    box(root,[Math.cos(a)*2,.3,Math.sin(a)*2],[.08,.26,.7],stoneDark,[0,deg,0]);
    box(root,[Math.cos(i/8*TAU)*2.01,.3,Math.sin(i/8*TAU)*2.01],[.1,.4,.12],coping,[0,-i/8*360,0]);
  }
  for(let i=0;i<16;i++){
    const a=i/16*TAU;
    box(root,[Math.cos(a)*1.93,.6,Math.sin(a)*1.93],[.3,.12,.8],coping,[0,-a*180/Math.PI,0]);
  }
  // The centrepiece: a column, a wide lower bowl, a slimmer column, a small upper bowl, a lotus bud.
  cylinder(root,[0,.7,0],[.9,.3,.9],stoneDark);
  cylinder(root,[0,1.15,0],[.42,.9,.42],stone);
  shape(root,'cone',[0,1.2,0],[1.9,.5,1.9],stone,[180,0,0]);
  cylinder(root,[0,1.48,0],[2.0,.12,2.0],coping);
  cylinder(root,[0,1.85,0],[.24,.6,.24],stone);
  shape(root,'cone',[0,2.1,0],[1.1,.3,1.1],stone,[180,0,0]);
  cylinder(root,[0,2.27,0],[1.2,.08,1.2],coping);
  shape(root,'cone',[0,2.42,0],[.42,.18,.42],coping,[180,0,0]);ball(root,[0,2.58,0],[.2,.3,.2],coping);
  // Four carved spouts on the rim, between the axes, each facing the middle.
  const SPOUT={r:1.62,y:.8},LAND={r:1.15,y:.56};
  for(let i=0;i<4;i++){
    const a=(i+.5)/4*TAU,deg=-a*180/Math.PI,at=r=>[Math.cos(a)*r,0,Math.sin(a)*r];
    const [bx,,bz]=at(1.9),[sx,,sz]=at(1.7);
    box(root,[bx,.72,bz],[.3,.14,.3],stoneDark,[0,deg,0]);shape(root,'sphere',[Math.cos(a)*1.84,.84,Math.sin(a)*1.84],[.3,.24,.26],stone,[0,deg,0]);
    cylinder(root,[sx,SPOUT.y,sz],[.11,.2,.11],stoneDark,[0,deg,90]);
  }

  // The water. None of it batches: its materials animate, and some of it moves.
  const water=new pc.Entity('fountain-water');water.noBatch=true;root.addChild(water);
  const piece=(type,pos,scale,material,rot=[0,0,0])=>{
    const e=shape(water,type,pos,scale,'#79aaa8',rot);
    e.render.meshInstances[0].material=material;e.render.castShadows=false;return e;
  };
  // The pool and the bowls: the shared water, stirring, where a thrown thing floats (the highest
  // water under it: a bowl over the pool) and rings spread as you walk round the rim.
  const shared=waterOf(app),pool=shared.surface({flow:[.05,.035],tile:1.4,ripple:.2});
  for(const [r,level] of [[1.86,.565],[.93,1.565],[.54,2.335]])
    shared.body('town',[{x:FOUNTAIN.x,z:FOUNTAIN.z,r}],level);
  const streak=pixels(app,64,(u,v)=>{
    const col=.5+.5*Math.sin(TAU*3*u+1.3*Math.sin(TAU*7*u)),band=.75+.25*Math.sin(TAU*2*v+TAU*u);
    return [228,242,240,Math.round(255*(.08+.42*col**2)*band)];
  });
  const flow=new pc.StandardMaterial();
  flow.diffuseMap=streak;flow.opacityMap=streak;flow.opacityMapChannel='a';
  flow.emissive=new pc.Color(.35,.42,.42);flow.diffuseMapTiling=flow.opacityMapTiling=new pc.Vec2(6,2);
  flow.blendType=pc.BLEND_NORMAL;flow.depthWrite=false;flow.cull=pc.CULLFACE_NONE;flow.update();
  const ringTexture=pixels(app,64,(u,v)=>{
    const d=Math.hypot(u-.5,v-.5)*2;
    return [240,250,248,Math.round(230*Math.exp(-(((d-.78)/.09)**2)))];
  });
  const ringMaterial=()=>{
    const r=new pc.StandardMaterial();
    r.diffuse=new pc.Color(1,1,1);r.emissive=new pc.Color(.45,.5,.5);r.opacityMap=ringTexture;r.opacityMapChannel='a';
    r.blendType=pc.BLEND_NORMAL;r.depthWrite=false;r.update();return r;
  };
  // Pool and bowls brim over: each surface sits just above its stone lip.
  piece('cylinder',[0,.55,0],[3.72,.03,3.72],pool);
  piece('cylinder',[0,1.555,0],[1.86,.02,1.86],pool);
  piece('cylinder',[0,2.325,0],[1.08,.02,1.08],pool);
  const bubble=piece('sphere',[0,2.36,0],[.4,.18,.4],pool);
  // Falling sheets: open-looking cylinders whose caps are hidden inside the stone and the water.
  piece('cylinder',[0,1.03,0],[2.05,1.0,2.05],flow);
  piece('cylinder',[0,1.9225,0],[1.24,.765,1.24],flow);
  const foam=piece('plane',[0,.572,0],[2.7,1,2.7],ringMaterial());
  // The jets: part-ellipse tubes from each spout, streaming along their length.
  const arc=jetArc(SPOUT.r,SPOUT.y,LAND.r,LAND.y,.42);
  const jetMesh=pc.Mesh.fromGeometry(app.graphicsDevice,
    new pc.TorusGeometry({tubeRadius:.085,ringRadius:1,sectorAngle:arc.sector,segments:24,sides:6}));
  const rings=[];
  for(let i=0;i<4;i++){
    const a=(i+.5)/4*TAU,pivot=new pc.Entity('jet');
    pivot.setLocalEulerAngles(0,-a*180/Math.PI,0);water.addChild(pivot);
    const jet=new pc.Entity('jet-arc');jet.setLocalPosition(arc.c,SPOUT.y,0);
    jet.setLocalEulerAngles(-90,0,0);jet.setLocalScale(arc.hr,1,arc.vr);pivot.addChild(jet);
    jet.addComponent('render',{castShadows:false});jet.render.meshInstances=[new pc.MeshInstance(jetMesh,flow)];jet.render.castShadows=false;
    const material=ringMaterial();
    rings.push({material,phase:i*.37,
      entity:piece('plane',[Math.cos(a)*LAND.r,.575+i*.001,Math.sin(a)*LAND.r],[.3,1,.3],material)});
  }
  let t=0;
  app.on('update',dt=>{
    if(!active())return;   // only while you are out in the town
    t+=Math.min(dt,.05);
    flow.diffuseMapOffset.set(0,t*.9);flow.opacityMapOffset.set(0,t*.9);flow.update();
    for(const ring of rings){
      const p=(t/1.1+ring.phase)%1,s=.14+p*.5;
      ring.entity.setLocalScale(s,1,s);ring.material.opacity=.85*(1-p);ring.material.update();
    }
    const swell=1+.03*Math.sin(t*3);foam.setLocalScale(2.7*swell,1,2.7*swell);
    bubble.setLocalScale(.4,.18+.05*Math.sin(t*5),.4);
  });
  return root;
}

let water=null;
/**
 * A soft running-water bed on the ambience's effects bus, so the ambient volume and the dialogue
 * ducking apply to it as they do to every other sound effect. `level` is 0..1 (fountainLevel).
 */
export function fountainSound(ambience,level) {
  const ctx=ambience?.ctx;
  if(!ctx||!ambience.effects||ctx.state!=='running')return;
  if(water?.ctx!==ctx){
    const length=ctx.sampleRate*2,buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=Math.random()*2-1;
    const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
    const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=2400;
    const high=ctx.createBiquadFilter();high.type='highpass';high.frequency.value=380;
    const gain=ctx.createGain();gain.gain.value=0;
    source.connect(high);high.connect(low);low.connect(gain);gain.connect(ambience.effects);source.start();
    water={ctx,gain,level:0};
  }
  if(Math.abs(level-water.level)<.01)return;
  water.level=level;water.gain.gain.setTargetAtTime(level*.22,ctx.currentTime,.3);
}
