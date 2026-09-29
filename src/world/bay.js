import * as pc from 'playcanvas';
import {waterOf} from './water.js';
import {detail,RENDER} from '../core/quality.js';

/**
 * 云海湾: the bay in front of the promenade (task H-water, docs/superpowers/plans/2026-09-26-development-wave-2.md).
 * Its water is the shared water shader (src/world/water.js), drifting slowly out to sea and
 * deepening away from the promenade wall, and it mirrors whatever `reflect()` was called on: the
 * skyline, the LED façades, the big buildings and the drones.
 *
 * The mirror is a planar reflection. A second camera draws only the reflection layer, from the
 * player's camera reflected in the water (its transform is the player's, mirrored in the plane, so
 * every face turns inside out and is drawn flipped), with its near plane tilted onto the water — an
 * oblique projection, as the street view in src/world/views.js does — so nothing under the surface
 * is mirrored. It draws at half the canvas size (a quarter on very large canvases), only while the
 * bay is on screen and the 水面倒影 setting is on, lit by the sun but without its shadows, through
 * the city's haze; the bay samples it at its own screen position, nudged by the ripples. The camera
 * hangs under the city's root, so it is off whenever the city is.
 */

/** City-local metres (the master layout), reaching under the far shore at z −175 so no gap shows. */
export const BAY={x0:-160,x1:170,z0:-175,z1:-48,level:-.6};

const pending=new Set();   // reflected before the city's statics were batched
let mirror=null;

/** Mark an entity (and everything under it) to show in the bay's reflection: the skyline, LED
 *  façades, drones and big buildings. Still things stay batched (in the reflection's own batch
 *  group, drawn in the world and in the mirror); anything that moves joins the reflection layer. */
export function reflect(entity){
  if(mirror?.ready)mirror.add(entity);else pending.add(entity);
  return entity;
}

/**
 * Called once when 云海 is built, before its look boxes are registered and its statics batched.
 * Returns the part the city updates every frame.
 */
export function buildBay(town,root){
  const water=waterOf(town.app),{x0,x1,z0,z1,level}=BAY,offset=root.getLocalPosition().x;
  // Deepest from about 40 m out from the wall.
  const material=water.surface({flow:[.1,-.06],tile:7,ripple:.2,shallow:'#3f7c83',deep:'#10303c',
    depth:[0,-1,z1/40,1/40],reflect:true});
  const sea=town.m.shape(root,'plane',[(x0+x1)/2,level,(z0+z1)/2],[x1-x0,1,z1-z0],'#1f4a55');
  sea.render.meshInstances[0].material=material;sea.render.castShadows=false;sea.render.receiveShadows=false;
  sea.lookName='water';
  water.body('city',[{x0:offset+x0,x1:offset+x1,z0,z1}],level);
  mirror=new Mirror(town,root,material);
  return {mirror,update(){mirror.update();}};
}

class Mirror {
  constructor(town,root,material){
    const app=town.app,eye=town.camera,main=eye.camera,{x0,x1,z0,z1,level}=BAY,x=root.getLocalPosition().x;
    this.town=town;this.material=material;this.ready=false;this.strength=0;this.frames=0;
    this.layer=new pc.Layer({name:'bay-reflection'});app.scene.layers.push(this.layer);
    this.group=app.batcher.addGroup('bay-reflection',false,undefined,undefined,[pc.LAYERID_WORLD,this.layer.id]);
    this.box=new pc.BoundingBox(new pc.Vec3(x+(x0+x1)/2,level,(z0+z1)/2),new pc.Vec3((x1-x0)/2,.5,(z1-z0)/2));
    const flip=new pc.Mat4();flip.data[5]=-1;flip.data[13]=2*level;   // y → 2·level − y
    // Tone mapping is left to the water that shows the image (src/world/water.js), so it happens once.
    this.camera=new pc.Entity('bay-reflection');
    this.camera.addComponent('camera',{layers:[this.layer.id],priority:-2,enabled:false,clearColor:main.clearColor,
      toneMapping:pc.TONEMAP_LINEAR,gammaCorrection:main.gammaCorrection});
    const own=this.camera.camera;
    own.camera.flipFaces=true;
    own.calculateTransform=m=>m.mul2(flip,eye.getWorldTransform());
    own.calculateProjection=m=>this.project(m);
    root.addChild(this.camera);
    // The sun lights the mirrored skyline as it lights the real one: a light only reaches its own layers.
    const sun=town.sun.light;
    if(!sun.layers.includes(this.layer.id))sun.layers=[...sun.layers,this.layer.id];
    // ponytail: as in views.js — no public per-camera shadow switch in PlayCanvas 2.22, so this
    // camera is dropped from the engine's list of cameras needing a sun shadow map, and the sun's
    // shadows are faded out while it draws. Without that list it simply keeps its shadows.
    const culler=app.renderer?.culler,shadowless=culler?.cameraDirShadowLights instanceof Map;
    if(shadowless)app.scene.on('precull',camera=>{if(camera===own)culler.cameraDirShadowLights.delete(own.camera);});
    app.scene.on('prerender',camera=>{
      if(camera!==own)return;
      // Where the mirrored eye stands, for the lighting's view direction.
      const e=eye.getPosition();this.camera.setPosition(e.x,2*level-e.y,e.z);
      this.frames++;
      if(shadowless){this.shadow=sun.shadowIntensity;sun.shadowIntensity=0;}
    });
    if(shadowless)app.scene.on('postrender',camera=>{if(camera===own)sun.shadowIntensity=this.shadow;});
    this.target(app.graphicsDevice);
  }

  /** Put an entity's meshes in the reflection: batched ones move to the reflection's batch group,
   *  the rest join its layer as well as their own. Never the bay itself: it cannot draw into the
   *  mirror it reads. */
  add(entity){
    entity.forEach(e=>{
      const r=e.render;if(!r||r.meshInstances[0]?.material===this.material)return;
      if(r.batchGroupId>=0)r.batchGroupId=this.group.id;
      else if(!r.layers.includes(this.layer.id))r.layers=[...r.layers,this.layer.id];
    });
  }

  /** Every frame in the city: draw the mirror only while the bay is on screen and wanted. */
  update(){
    // The city's statics are batched by now: whatever was reflected while it was being built can join.
    if(!this.ready){this.ready=true;for(const entity of pending)this.add(entity);pending.clear();}
    const t=this.town,eye=t.camera,main=eye.camera,own=this.camera.camera;
    // 水面倒影 as the player set it, else as the graphics level has it (src/core/quality.js).
    const on=(t.reflections??RENDER[detail()].reflections)&&eye.getPosition().y>BAY.level+.05&&main.frustum.containsAabb(this.box)>0;
    if(own.enabled!==on)own.enabled=on;
    if(this.strength!==+on){this.strength=+on;this.material.setParameter('reflectionStrength',this.strength);}
    if(!on)return;
    own.clearColor=main.clearColor;   // day and night follow the city's sky
    // ponytail: the city's haze too. The tilted near plane squeezes the depth the haze is worked
    // out from, so the mirror image is a little clearer than the view; the water then hazes it by
    // its own distance. Upgrade: haze from view-space depth in the lit shader, if it ever matters.
    if(own.fog!==main.fog)own.fog=main.fog;
    this.target(t.app.graphicsDevice);
  }

  /** The player's projection with its near plane on the water (Lengyel's oblique near plane), in the
   *  mirrored camera's space. The engine hands in the same matrix more than once a frame. */
  project(m){
    const cam=this.town.camera.camera,d=m.data,w=this.town.camera.getWorldTransform().data;
    m.setPerspective(cam.fov,cam.aspectRatio,cam.nearClip,cam.farClip);
    // The water plane seen through the mirror: minus the heights of the player's right, up and back
    // axes, and the water's height over the eye; positive (kept) above the water.
    const c0=-w[1],c1=-w[5],c2=-w[9],c3=BAY.level-w[13];
    if(c3>-.05)return;   // an eye at the surface would crush the depth range
    const qx=(Math.sign(c0)+d[8])/d[0],qy=(Math.sign(c1)+d[9])/d[5],qw=(1+d[10])/d[14];
    const k=2/(c0*qx+c1*qy-c2+c3*qw);
    d[2]=c0*k;d[6]=c1*k;d[10]=c2*k+1;d[14]=c3*k;
  }

  /** Half the canvas (a quarter past 2200 pixels wide), remade when the canvas changes size. */
  target(g){
    const k=g.width>2200?4:2,w=Math.max(1,Math.floor(g.width/k)),h=Math.max(1,Math.floor(g.height/k)),old=this.rt;
    if(old?.width===w&&old.height===h)return;
    const texture=new pc.Texture(g,{name:'bay-reflection',width:w,height:h,format:pc.PIXELFORMAT_RGBA8,mipmaps:false,
      minFilter:pc.FILTER_LINEAR,magFilter:pc.FILTER_LINEAR,addressU:pc.ADDRESS_CLAMP_TO_EDGE,addressV:pc.ADDRESS_CLAMP_TO_EDGE});
    this.rt=new pc.RenderTarget({colorBuffer:texture,depth:true});
    this.camera.camera.renderTarget=this.rt;
    this.material.setParameter('reflectionMap',texture);
    if(old){old.destroyTextureBuffers();old.destroy();}
  }
}
