import * as pc from 'playcanvas';
import {createModels} from './models.js';
import worldData from '../content/world.json' with {type:'json'};
import npcs from '../content/npcs.json' with {type:'json'};
import rooms from '../content/rooms.json' with {type:'json'};
import {buildRoom,ROOM_OFFSET,annexDoor,annexApproach,upperParts} from './interior.js';
import {Registry,raySpan} from './registry.js';
import {walkClear,rotatedHalf} from './navigation.js';
import {Visitors} from './visitors.js';
import {pavingMaterial} from './paving.js';
import {Daylight} from './daylight.js';
import {Views} from './views.js';
import {initIdle,animateIdle,restIdle} from './idle.js';
import objectNames from '../content/objects.json' with {type:'json'};
import signTexts from '../content/signs.json' with {type:'json'};
import {isTyping,queueLook,drainLook} from '../core/input.js';
import {Toybox,Container} from './physics.js';
import {NightMarket,NIGHT_PITCHES,DAY_PITCHES} from './stalls.js';
import {surfaceHeight,offersSurface,canStack,fitsOn,decorOn,placementProblem,hangsOnWall} from '../core/surfaces.js';
import sites from '../content/sites.json' with {type:'json'};
import {buildCity,buildStationEntrance,CITY,CITY_OFFSET} from './city.js';
import {onCityGround} from '../core/city.js';
import {buildGarden} from './garden.js';
import {buildFountain,FOUNTAIN,FOUNTAIN_MARK,FOUNTAIN_LOOKS} from './fountain.js';
import {buildWordHall} from './wordhall.js';
import friends from '../content/friends.json' with {type:'json'};
import {stepVelocity,inputWish,GRAVITY,JUMP} from '../core/movement.js';
import {KEY_ACTIONS,isKey,codeOf,normalCode} from '../core/keys.js';
import {buildBay} from './bay.js';
import {waterOf} from './water.js';
import {buildHill} from './hill.js';
import {buildHotpot} from './hotpot.js';
import {buildDrones} from './drones.js';
import {buildCrowd} from './crowd.js';

const NAMES=objectNames.objects;
const SEAT_DROP=.66;    // how far the body sinks so the hips land on the seat
const SLEEP_HOP=.6;     // seconds from standing by the bed to lying on it
const SIGNS=signTexts.signs;
// The sun's shadow filter: 5x5 PCF blends each shadow edge over a few texels, so the texel steps
// neither show as a sawtooth nor crawl as the sun turns (3x3 left both visible when walking).
const SUN_SHADOW=pc.SHADOW_PCF5_32F;
// Twice the old .1: depth precision grows with the near plane, and layered pieces a few
// millimetres apart stopped flickering at street distances. The tourist's .34 m radius keeps
// every solid thing further off than the near plane's corners (.26 m at 16:9).
const NEAR_CLIP=.2;
/**
 * Rooms stand up to 10 km from the origin and 云海 4 km off. The engine projects a vertex as
 * viewProjection * worldPosition in 32-bit floats, and numbers that large round each vertex by up to
 * a millimetre, differently every frame as the camera moves, so layered pieces (a painting on its
 * board, a sign on its wall) flickered through each other while walking. Taking the camera's own
 * position off first leaves small numbers, which project exactly. The camera position comes from
 * the view matrix itself, so custom views (a mirrored reflection camera) stay right.
 */
const CAMERA_RELATIVE='screenPos = matrix_projection * vec4(mat3(matrix_view) * (posW.xyz + matrix_view[3].xyz * mat3(matrix_view)), 1.0);';
function cameraRelative(device) {
  const chunks=pc.ShaderChunks.get(device,pc.SHADERLANGUAGE_GLSL),code=chunks.get('transformVS');
  // If a later engine words this line differently, the shader simply stays as the engine has it.
  chunks.set('transformVS','#ifndef VIEWMATRIX\n#define VIEWMATRIX\nuniform mat4 matrix_view;\n#endif\nuniform mat4 matrix_projection;\n'+
    code.replace('screenPos = matrix_viewProjection * posW;',CAMERA_RELATIVE));
}

/** What a tagged entity is called: an object key from objects.json, or a sign's exact text. */
function lookNameOf(entity) {
  if(entity.signText){
    const sign=SIGNS[entity.signText];
    return {id:'sign:'+(sign?.id??entity.signText),zh:entity.signText,pinyin:sign?.pinyin,en:sign?.en,sign:true};
  }
  return entity.lookName?{id:entity.lookName,...NAMES[entity.lookName]}:null;
}
/**
 * Where a ray runs through the actual meshes under an entity, each tested in its own frame: the
 * world box round a slanted roof slab is much bigger than the slab. [near, far] or null.
 */
const INVERSE=new pc.Mat4(),RAY_O=new pc.Vec3(),RAY_D=new pc.Vec3();
function meshSpan(entity,origin,dir,limit) {
  let near=Infinity,far=-Infinity;
  const visit=e=>{
    for(const mi of e.render?.meshInstances??[]){
      INVERSE.copy(mi.node.getWorldTransform()).invert();
      INVERSE.transformPoint(RAY_O.set(origin.x,origin.y,origin.z),RAY_O);
      INVERSE.transformVector(RAY_D.set(dir.x,dir.y,dir.z),RAY_D);
      const span=raySpan(RAY_O,RAY_D,mi.mesh.aabb.getMin(),mi.mesh.aabb.getMax(),limit);
      if(span){near=Math.min(near,span[0]);far=Math.max(far,span[1]);}
    }
    for(const child of e.children)visit(child);
  };
  visit(entity);
  return near<=far?[near,far]:null;
}
/** The world-space box round every mesh under an entity, as registry fields; null if it has none. */
function meshBounds(entity) {
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  const visit=e=>{
    for(const mi of e.render?.meshInstances??[]){
      const min=mi.aabb.getMin(),max=mi.aabb.getMax();
      lo[0]=Math.min(lo[0],min.x);lo[1]=Math.min(lo[1],min.y);lo[2]=Math.min(lo[2],min.z);
      hi[0]=Math.max(hi[0],max.x);hi[1]=Math.max(hi[1],max.y);hi[2]=Math.max(hi[2],max.z);
    }
    for(const child of e.children)visit(child);
  };
  visit(entity);
  if(lo[0]>hi[0])return null;
  return {x:(lo[0]+hi[0])/2,z:(lo[2]+hi[2])/2,hw:(hi[0]-lo[0])/2,hd:(hi[2]-lo[2])/2,y0:lo[1],y1:hi[1]};
}

export class Town {
  constructor(canvas,{onInteract,onNear,onFrame,onLook,onCollect}) {
    this.data=structuredClone(worldData);this.onInteract=onInteract;this.onNear=onNear;this.onFrame=onFrame;this.onLook=onLook;this.onCollect=onCollect;this.keys=new Set();this.paused=true;this.target=null;this.clock=0;
    this.app=new pc.Application(canvas,{graphicsDeviceOptions:{antialias:true,alpha:false,powerPreference:'high-performance'}});
    this.app.graphicsDevice.maxPixelRatio=Math.min(devicePixelRatio,1.8);
    cameraRelative(this.app.graphicsDevice);
    this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.app.scene.ambientLight=new pc.Color(.59,.62,.58);
    this.app.scene.toneMapping=pc.TONEMAP_ACES;
    const sun=new pc.Entity('sun');sun.addComponent('light',{type:'directional',color:new pc.Color(1,.96,.88),intensity:1.05,castShadows:true,shadowDistance:75,shadowResolution:2048,shadowBias:.25,normalOffsetBias:.08,shadowType:SUN_SHADOW});sun.setEulerAngles(48,-25,0);this.app.root.addChild(sun);this.sun=sun;
    this.camera=new pc.Entity('camera');this.camera.addComponent('camera',{clearColor:new pc.Color(.77,.84,.79),fov:43,nearClip:NEAR_CLIP,farClip:200});this.app.root.addChild(this.camera);
    this.m=createModels(this.app);this.root=new pc.Entity('town');this.app.root.addChild(this.root);this.actors=new Map();this.buildings=new Map();
    this.registry=new Registry();this.playerY=0;this.velocityY=0;this.velocity={x:0,z:0};this.grounded=true;this.looking=null;
    this.build();this.registerTown();
    this.batchStatics('town-scenery',this.root,new Set([...this.hoardings.values(),
      ...[...this.gates.values()].map(gate=>gate.door).filter(Boolean),...this.closedSigns.values(),
      ...this.data.buildings.filter(b=>b.site).map(b=>this.buildings.get(b.id)).filter(Boolean)]));
    this.player=this.m.person(this.root,'#e9bb78',[...this.data.spawn.slice(0,1),0,this.data.spawn[1]],false);
    this.player.pack=this.m.box(this.player.upper,[0,1.05,-.25],[.38,.45,.2],'#91a69a');
    // The tourist is seen from behind their own eyes; third person stays available so worn items are visible.
    // world.json spawn is [x, z, yaw, pitch]: where you arrive, and what you are looking at.
    this.eyeHeight=1.62;this.view='first';this.yaw=this.data.spawn[2]??0;this.pitch=this.data.spawn[3]??-4;this.sensitivity=.12;
    this.drag={id:null,x:0,y:0};this.stick={id:null,ox:0,oy:0,dx:0,dz:0};
    this.lookPending={x:0,y:0};this.speedScale=1;this.seated=null;this.roomOpen=new Map();
    initIdle(this.player,.37);
    this.place='town';this.rooms=new Map();this.buildRooms();this.registerRooms();
    // People in the word hall (src/world/visitors.js), walking whether or not you are there.
    this.visitors=new Visitors({registry:this.registry,rooms:this.rooms,models:this.m,seatDrop:SEAT_DROP,
      player:()=>{const p=this.player.entity.getPosition();return {place:this.place,x:p.x,z:p.z,seat:this.seated?.index};}});
    // Loose objects hang off their own node at the origin, so a body's coordinates are the same
    // numbers the collision registry uses whichever place it is rolling around in.
    this.toyRoot=new pc.Entity('loose');this.app.root.addChild(this.toyRoot);
    this.toys=new Toybox({registry:this.registry,models:this.m});
    this.toys.outOfBounds=(place,x,z)=>!this.withinPlace(place,x,z,.15);
    // All the water (src/world/water.js): a thrown thing floats on it, and rings spread where it lands.
    this.water=waterOf(this.app);
    this.toys.surfaceAt=(place,x,z)=>this.water.levelAt(place,x,z);
    this.toys.onSplash=body=>this.water.ripple(body.x,body.z,1.3);
    this.buildContainers();
    this.market=new NightMarket({models:this.m,parent:this.root,pitches:NIGHT_PITCHES,registry:this.registry,
      player:()=>this.place==='town'?this.player.entity.getPosition():null});
    // A second, daytime stall system: same mechanics, its own schedule and pitches, and never
    // mixed into `this.market` so the night market's own behaviour and tests stay untouched.
    this.dayMarket=new NightMarket({models:this.m,parent:this.root,pitches:DAY_PITCHES,schedule:{from:6,to:18},registry:this.registry,
      player:()=>this.place==='town'?this.player.entity.getPosition():null});
    this.daylight=new Daylight(this.app,sun,this.camera);
    for(const material of this.lampMaterials)this.daylight.addLamp(material);
    this.market.onLit=material=>this.daylight.addLamp(material);
    this.dayMarket.onLit=material=>this.daylight.addLamp(material);
    // Not `openInstantly` here: the clock is still at its default (15:00), not the saved hour —
    // main.js calls it once that is set, so a save from the night does not open the day stalls
    // and then walk them straight back out again in view.
    this.daylight.apply();
    this.views=new Views(this);   // the street, seen from inside a shop through its door and windows
    this.applyView();this.placeCamera(this.player.entity.getPosition());
    this.bind(canvas);this.app.on('update',dt=>this.update(dt));
    // PlayCanvas fires postUpdate on app.systems, not on the app, so an app-level listener for it
    // never runs. `prerender` is the engine's real late hook: after every update, and before the
    // hierarchy is synced and drawn — so the camera we place here is the camera this frame uses.
    this.app.on('prerender',()=>this.lateUpdate());this.app.start();
    addEventListener('resize',()=>this.app.resizeCanvas());
  }
  build() {
    const {box,cylinder,ball,tree,building,lantern,label,person,streetProp}=this.m;const p=this.root;
    this.lampMaterials=[];
    this.station=buildStationEntrance(this.m,p,this.lampMaterials);
    const lamp=(...args)=>{const made=lantern(...args);this.lampMaterials.push(made.material);return made;};
    box(p,[0,-.35,-6],[150,.6,150],'#a9b78c');
    // Each district gets its own paving, so the city reads as separate places joined by streets.
    for(const d of this.data.districts){
      const [x0,x1]=d.bounds.x,[z0,z1]=d.bounds.z,cx=(x0+x1)/2,cz=(z0+z1)/2,w=x1-x0,h=z1-z0;
      // A park is lawn, not paving; its own paths are laid on top of it.
      if(d.surface==='grass'){box(p,[cx,-.04,cz],[w-.01,.12,h-.01],'#93ab7c');continue;}
      const pavement=box(p,[cx,-.04+.01*this.data.districts.indexOf(d),cz],[w-1,.12,h-1],'#d9cfb5');
      pavement.render.meshInstances[0].material=pavingMaterial(this.app,w-1,h-1);
    }
    // Ground dressing goes down before the buildings so paths run under their steps.
    this.groundMarks=[];
    for(const def of this.data.ground??[]){
      const made=this.m.groundPatch(p,def);
      this.groundMarks.push(...made.marks);
    }
    for(const b of this.data.buildings){
      // The word hall is its own model (src/world/wordhall.js), not one of the shared styles.
      // So is the metro entrance (src/world/city.js), built above with the rest of the metro.
      if(b.bespoke==='metro-entrance'){this.buildings.set(b.id,this.station.root);continue;}
      if(b.bespoke==='wordhall'){
        this.wordhall=buildWordHall(this.m,p,b,this.lampMaterials);
        this.buildings.set(b.id,this.wordhall.root);continue;
      }
      const made=building(p,b);
      this.buildings.set(b.id,made);
      // Lit windows and lanterns on a building dim with the daylight like any other lamp.
      this.lampMaterials.push(...made.lamps);
      // A shop that has not been built yet is simply not in the world; the hoarding is.
      if(b.site)made.enabled=false;
    }
    // 莲池公园, south through the moon gate: water, bridges, the pavilion and its planting.
    this.garden=buildGarden(this.m,p,this.lampMaterials);
    // Classical garden scenery (world.json `scenery`): the west quarter's canal, walkways and
    // lattice walls, and verandas on the square's older shops. Static, so it batches with the rest.
    this.sceneryMarks=(this.data.scenery??[]).flatMap(def=>(def.kind==='veranda'
      ?this.m.veranda(p,def,this.data.buildings.find(b=>b.id===def.building)):this.m[def.kind](p,def,this.lampMaterials)).marks);
    this.hoardings=new Map();
    for(const site of sites.sites)this.hoardings.set(site.id,this.buildHoarding(site));
    for(const [x,z,kind]of this.data.trees)tree(p,x,z,1.15,kind);
    this.props=this.data.props.map(def=>{
      const made=streetProp(p,def.kind,def.tint);
      if(made.material)this.lampMaterials.push(made.material);
      made.entity.setLocalPosition(def.x,0,def.z);
      made.entity.setLocalEulerAngles(0,def.rot??0,0);
      return {...def,...made};
    });
    // A fountain and a lantern line keep the original square as the heart of the city.
    buildFountain(this.m,this.app,p,()=>this.place==='town');
    for(const x of [-12,12]) {box(p,[x,2.25,0],[.18,4.5,.18],'#866b52');box(p,[x,4.4,0],[1.3,.13,.13],'#866b52');lamp(p,x-.47,4.05,0);lamp(p,x+.47,4.05,0);}
    for(let x=-11;x<=11;x+=2.2)lamp(p,x,5.9-Math.sin((x+11)/22*Math.PI)*.8,-5);
    box(p,[0,6.12,-5],[24,.025,.025],'#8b7b62').lookName='lantern-string';
    // 林阿姨's tea stall and 陈叔叔's souvenir counter stand beside their shops, clear of the doors,
    // each keeper behind the counter.
    const at=id=>{const n=this.data.npcs.find(n=>n.id===id);return [n.x,n.z+1.3];},tea=at('lin'),gifts=at('chen');
    this.stalls=[tea,gifts];
    // Each is a panelled timber counter under a striped cloth canopy on four posts, all standing
    // inside the counter's own hitbox; the canopy reaches back over the keeper.
    for(const [[x,z],stripe] of [[tea,'#6f8f6a'],[gifts,'#b8453a']]){
      box(p,[x,.06,z],[3.1,.12,1.05],'#6d5a45');
      box(p,[x,.75,z],[3.0,1.26,.95],'#a97d55').lookName='counter';
      for(const k of [-1,0,1]){
        box(p,[x+k*1,.74,z+.49],[.84,.86,.03],'#8e6952').lookName='counter';
        box(p,[x+k*1,.74,z+.505],[.7,.72,.02],'#b98d62').lookName='counter';
      }
      box(p,[x,1.44,z],[3.5,.13,1.3],'#e6cf9e').lookName='counter';
      for(const [px,pz,top] of [[-1.6,.55,2.35],[1.6,.55,2.35],[-1.6,-.5,2.56],[1.6,-.5,2.56]])
        cylinder(p,[x+px,top/2,z+pz],[.09,top,.09],'#6d5a45').lookName='counter';
      const canopy=new pc.Entity('canopy');canopy.setLocalPosition(x,2.55,z-.45);canopy.setLocalEulerAngles(10,0,0);p.addChild(canopy);
      for(let i=0;i<7;i++)box(canopy,[-1.8+(i+.5)*3.6/7,0,0],[3.6/7+(i%2?.01:0),i%2?.07:.06,2.7+(i%2?.01:0)],i%2?'#f1e8d4':stripe).lookName='awning';
      box(canopy,[0,-.14,1.36],[3.6,.26,.03],stripe).lookName='awning';                 // the valance
      lamp(p,x+1.35,1.75,z+.62);
    }
    for(let i=0;i<3;i++)cylinder(p,[tea[0]-.8+i*.7,1.65,tea[1]],[.3,.28,.3],'#ede4ce').lookName='goods';
    for(let i=0;i<3;i++)box(p,[gifts[0]-.8+i*.65,1.68,gifts[1]],[.42,.38,.38],['#d9ae68','#91a494','#c98568'][i]).lookName='goods';
    for(const def of this.data.npcs) {const info=npcs.find(n=>n.id===def.id);this.actors.set(def.id,person(p,info.color,[def.x,0,def.z]));}
    // Townsfolk who are just going about their day. They are scenery, and a word to learn.
    this.people=(this.data.people??[]).map(def=>{
      const made=person(p,def.color,[def.x,0,def.z]);
      made.entity.setLocalEulerAngles(0,def.rot??0,0);
      return {...def,...made};
    });
    // One pair of neighbours at each chat spot, turned towards each other.
    this.friends=this.data.ambient.flatMap(([ax,az])=>{const pair=[person(p,'#d1a075',[ax,0,az]),person(p,'#a2ad8d',[ax-1.3,0,az+.5])];pair[0].entity.setEulerAngles(0,-60,0);pair[1].entity.setEulerAngles(0,110,0);return pair;});
    // A gateway on the way to your front door: the board hangs well above head height.
    label(p,'欢迎来到青禾',[0,3.3,17],4,.7);box(p,[0,3.72,17],[4.75,.14,.22],'#8b795b');
    for(const x of [-2.2,2.2])box(p,[x,1.9,17],[.17,3.8,.17],'#8b795b');
    this.buildGates();
    this.buildClosedSigns();
    // The northern hills close off the square's back edge (z -31), right behind the word hall,
    // now that the riverside quarter has moved west and taken its gate wall with it. A cone sits half
    // underground, so they are wide enough to meet at their feet and come right up to the edge.
    for(let i=0;i<9;i++)this.m.shape(p,'cone',[-60+i*16,-.5,-38],[36,10+(i%3)*4,28],i%2?'#91a88d':'#9bb196').name='hill';
    // The southern hills stand beyond the park's back wall (z 51).
    for(let i=0;i<7;i++)this.m.shape(p,'cone',[-70+i*22,-.5,72],[18,9+(i%3)*4,16],i%2?'#9bb196':'#91a88d').name='hill';
  }
  /**
   * The city is built the first time somebody rides out to it, and then kept. Building it costs
   * a few hundred meshes, which is not something to spend on every player who never buys a
   * ticket — but rebuilding it on every journey would put a stutter in the middle of the ride.
   */
  ensureCity() {
    if(this.rooms.has('city'))return this.rooms.get('city');
    const built=buildCity(this.m,this.app.root);
    built.root.enabled=false;
    for(const material of built.lamps)this.daylight.addLamp(material);
    const room={id:'city',data:CITY.place,root:built.root,fittings:[],staff:[],
      index:-1,offsetX:CITY_OFFSET,props:new Map(),people:built.people};
    this.rooms.set('city',room);
    this.registry.clear('city');
    this.mark('city',CITY_OFFSET,0,CITY.place.size[0]/2,CITY.place.size[1]/2,-.2,.02,'path',false);
    // A mark may be open ground with a name (the road, a crossing) and a bench says which way you sit.
    for(const mark of built.marks)
      this.mark('city',CITY_OFFSET+mark.x,mark.z,mark.hw,mark.hd,mark.y0,mark.y1,mark.name,mark.solid).face=mark.face;
    for(const person of built.people)
      this.mark('city',CITY_OFFSET+person.x,person.z,.52,.48,0,1.95,'person');
    // The parts of 云海 kept in their own files. Each adds its entities under the city root and its
    // own marks, and may hand back {update(dt,paused), targets()}; anything that moves sets noBatch.
    room.parts=[buildBay,buildHill,buildHotpot,buildDrones,buildCrowd].map(build=>build(this,built.root)).filter(Boolean);
    room.parts.push({update:built.update});   // the city's own LED façades (src/world/leds.js)
    this.registerLooks('city',built.root,{skip:new Set(built.people.map(one=>one.entity))});
    this.batchStatics('city-scenery',built.root);
    
    return room;
  }
  /** Step out of the train and into 云海. */
  enterCity() {this.ensureCity();return this.enterRoom('city');}
  /** The train home pulls in at the platform under the square, not out on the street. */
  leaveCity() {return this.place==='city'?this.enterRoom(CITY.place.returnPlace):false;}
  /**
   * 云海 is seen from much further off than a street or a room: while you are there the camera
   * sees out to city.json's `farClip`, through a haze the colour of the sky so its far edge never
   * shows. Anywhere else the camera is exactly as it was before.
   */
  fitCamera() {
    const cam=this.camera.camera,here=this.place==='city';
    if(here===(this.farAway!==undefined))return;
    if(!here){cam.farClip=this.farAway;this.farAway=undefined;cam.fog=null;return;}
    this.farAway=cam.farClip;cam.farClip=CITY.place.farClip;
    this.haze??=Object.assign(new pc.FogParams(),{type:pc.FOG_LINEAR,start:CITY.place.haze[0],end:CITY.place.haze[1]});
    this.haze.color=cam.clearColor;   // the very Color the daylight keeps updating, so the two never drift apart
    cam.fog=this.haze;
  }

  /** Boards, scaffold poles and a notice: what stands on a lot before the shop does. */
  buildHoarding(site) {
    const {box,cylinder,label}=this.m;
    const root=new pc.Entity('site-'+site.id);
    root.setLocalPosition(site.x,0,site.z);root.setLocalEulerAngles(0,site.rotation??0,0);
    this.root.addChild(root);
    for(const side of [-1,1]){
      box(root,[side*3.6,1.1,0],[.3,2.2,5.4],'#b08a60');
      for(let i=0;i<4;i++)box(root,[side*3.6,.5+i*.55,0],[.36,.1,5.6],'#8d6b4d');
    }
    box(root,[0,1.1,-2.6],[7.4,2.2,.3],'#b08a60');
    for(const x of [-2.4,0,2.4])cylinder(root,[x,1.3,-2.5],[.14,2.6,.14],'#8f9694');
    box(root,[0,2.35,-2.6],[7.6,.18,.5],'#8d6b4d');
    // A stack of what the job still needs, and the notice board on the front.
    for(let i=0;i<3;i++)box(root,[-2.2+i*.1,.28+i*.34,1.4],[1.4,.32,.9],i%2?'#a9784c':'#b0654f');
    box(root,[2.2,.4,1.2],[1.2,.8,1.0],'#8fa9b8');
    box(root,[0,1.5,2.55],[2.6,1.3,.14],'#7f6d55');
    label(root,'工地',[0,1.5,2.64],2.2,.9,'#f2e2c6','#a4564a');
    return root;
  }
  /** Once it is built the hoarding comes down and the shop is there. */
  revealSite(siteId) {
    const site=sites.sites.find(entry=>entry.id===siteId);
    if(!site)return false;
    const hoarding=this.hoardings?.get(siteId);
    if(hoarding)hoarding.enabled=false;
    this.siteBuilt??=new Set();
    // Its hitboxes arrive with it, once; the hoarding's wall goes with the hoarding.
    if(!this.siteBuilt.has(siteId))for(const building of this.data.buildings)
      if(building.site===siteId&&!building.bespoke)this.registerBuilding(building);
    const wall=this.siteWalls?.get(siteId);
    if(wall){this.registry.boxes.splice(this.registry.boxes.indexOf(wall),1);this.siteWalls.delete(siteId);}
    for(const building of this.data.buildings)
      if(building.site===siteId)this.buildings.get(building.id).enabled=true;
    this.siteBuilt.add(siteId);
    for(const [id,sign] of this.closedSigns??[])
      if(sign.siteGate===siteId)sign.enabled=!this.roomOpen.get(id);
    return true;
  }
  /** A paifang arch marks each district edge. The low wall stays; only the door opens. */
  buildGates() {
    const {box,cylinder,ball,label}=this.m,p=this.root;
    this.gates=new Map();
    for(const d of this.data.districts){
      if(!d.gate)continue;
      const g=d.gate,span=g.span??5,rot=g.axis==='x'?90:0;
      const root=new pc.Entity('gate-'+d.id);root.setLocalPosition(g.x,0,g.z);root.setLocalEulerAngles(0,rot,0);p.addChild(root);
      // A moon gate is always open: it has no door, so it never joins the list of gates to earn.
      if(g.style==='moon'){this.buildMoonGate(d,root);continue;}
      // A boundary wall, low enough to see over and too high to jump.
      const wallBoxes=[];
      for(const side of [-1,1]){
        const from=span-.2,to=g.half;
        if(to<=from+.4)continue;
        const mid=(from+to)/2,length=to-from;
        // A clipped hedge in a stone-kerbed bed, broken by stone piers: tall enough that the
        // boundary you can see is the boundary you cannot jump.
        const leaf=['#5b7a4c','#6c8a58','#7e9a66'];   // the osmanthus trees' greens
        // Stone piers break the run every 4 m or so; the last one caps the far end, standing a
        // little proud of the kerb so no two faces share a plane. Each is one thing to look at; the
        // hedge itself is named by its hitbox.
        const piers=Math.max(1,Math.round(length/4)),pierAt=[];
        for(let k=1;k<=piers;k++)pierAt.push(from+k*length/piers-(k===piers?.22:0));
        for(const at of pierAt){
          const pier=new pc.Entity('pier');pier.lookName='wall';root.addChild(pier);
          box(pier,[side*at,1.3,0],[.5,2.6,.68],'#c7bb9e');
          box(pier,[side*at,2.66,0],[.64,.12,.72],'#a39d8f');
          ball(pier,[side*at,2.84,0],[.3,.26,.3],'#a39d8f');
        }
        box(root,[side*mid,.22,0],[length,.44,.6],'#b6a486');
        box(root,[side*mid,.46,0],[length+.04,.06,.64],'#a39d8f');
        box(root,[side*mid,1.42,0],[length-.1,1.9,.54],leaf[1]);
        box(root,[side*mid,2.4,0],[length-.2,.08,.44],leaf[2]);                   // the clipped top
        // Leafy clumps swelling out of both faces and along the top, so the block reads as clipped
        // leaves and not a painted box; none where a pier stands, or it would poke through.
        const clear=x=>pierAt.every(at=>Math.abs(x-at)>.57);
        for(let x=from+.3,i=0;x<to-.3;x+=.5,i++){
          if(clear(x))ball(root,[side*x,2.36,0],[.62,.22,.5],leaf[i%2?2:1]);
          for(const face of [-1,1])for(const row of [0,1]){
            const k=i+row*2+(face>0?1:0),cx=x+(row?.25:0);
            if(clear(cx))ball(root,[side*cx,.95+row*.8+(k%3)*.12,face*.27],[.64,.54,.16],leaf[k%3]);
          }
        }
        const world=g.axis==='x'
          ? {x:g.x,z:g.z+side*mid,hw:.28,hd:length/2}
          : {x:g.x+side*mid,z:g.z,hw:length/2,hd:.28};
        wallBoxes.push(this.mark('town',world.x,world.z,world.hw,world.hd,0,2.5,'hedge',true));
      }
      // The paifang: lacquered posts on stone drums, a name board between two beams, a row of
      // brackets and a tiled roof with upturned eaves.
      for(const side of [-1,1]){
        cylinder(root,[side*span,2.4,0],[.5,4.8,.5],'#9a4f42').lookName='paifang';
        cylinder(root,[side*span,.3,0],[.72,.6,.72],'#b6a486').lookName='paifang';
        cylinder(root,[side*span,.64,0],[.6,.08,.6],'#a39d8f').lookName='paifang';
      }
      const beam=span*2+.9;
      box(root,[0,3.3,0],[beam,.32,.44],'#6d5a45').lookName='paifang';
      box(root,[0,3.9,0],[4.1,.92,.05],'#6d5a45');   // a frame round the name, read as the name
      box(root,[0,4.5,0],[beam+.3,.36,.5],'#5d7360').lookName='paifang';
      for(const y of [4.4,4.6])box(root,[0,y,.255],[beam+.26,.035,.02],'#d4ac4a').lookName='paifang';
      for(let x=-beam/2+.25;x<beam/2-.2;x+=.5)box(root,[x,4.8,0],[.2,.24,.6],'#6d5a45').lookName='paifang';
      this.m.tiledRoof(root,0,0,beam-.4,.5,4.92,'#5d7360',3);
      label(root,d.zh,[0,3.9,0],3.9,.78);   // one board, read from either side
      // A district with nothing to earn has no door and no door hitbox: open from the first frame,
      // even if the word list never loads.
      if(!g.requires)continue;
      // The door itself: two leaves that vanish once the district is earned.
      const door=new pc.Entity('gate-door');root.addChild(door);
      for(const side of [-1,1]){
        box(door,[side*span/2,1.35,0],[span-.25,2.7,.24],'#a3855f');
        for(let i=0;i<3;i++)box(door,[side*span/2+(i-1)*span*.3,1.35,.16],[.15,2.5,.1],'#8a6c49');
        ball(door,[side*.42,1.5,.2],[.24,.24,.16],'#d8c07e');
      }
      const doorBox=g.axis==='x'
        ? this.mark('town',g.x,g.z,.4,span,0,2.8,'door',true)
        : this.mark('town',g.x,g.z,span,.4,0,2.8,'door',true);
      this.gates.set(d.id,{district:d,root,door,box:doorBox,wallBoxes});
    }
  }
  /**
   * A moon gate: a white plaster wall with grey tile coping along the district edge, rising round
   * a circular opening with the district's plaque above it. Built in the gate's own frame
   * (x along the boundary); the hitboxes are the wall, the two sides of the arch and the lintel.
   */
  buildMoonGate(d,root) {
    const {box,label}=this.m,g=d.gate,span=g.span??2;
    const R=span+.1,cy=1.5,sect=span+1,top=cy+R+.8,H=3,T=.4;
    const plaster='#efe9dc',coping='#6d7471',ridge='#565c5a',trim='#b9b2a2',group='gate-'+d.id;
    // The opening at ground level: where the circle meets the path.
    const gap=Math.sqrt(R*R-cy*cy);
    const mark=(x0,x1,y0,y1,name)=>{
      const mid=(x0+x1)/2,half=(x1-x0)/2;
      const made=g.axis==='x'?this.mark('town',g.x,g.z-mid,T/2,half,y0,y1,name):this.mark('town',g.x+mid,g.z,half,T/2,y0,y1,name);
      made.group=group;return made;
    };
    for(const side of [-1,1]){
      const length=g.half-sect,mid=side*(sect+length/2);
      if(length<=.2)continue;
      box(root,[mid,H/2,0],[length,H,T],plaster);
      box(root,[mid,H+.08,0],[length+.1,.16,T+.35],coping).lookName='wall';
      box(root,[mid,H+.22,0],[length,.12,.16],ridge).lookName='wall';
      if(side<0)mark(-g.half,-sect,0,H,'wall');else mark(sect,g.half,0,H,'wall');
    }
    // The arch: horizontal slices of plaster either side of the circle, a solid band above it.
    const slice=.2,crown=cy+R;
    for(let y=0;y<crown-1e-6;y+=slice){
      const dy=y+slice/2-cy,inner=Math.abs(dy)<R?Math.sqrt(R*R-dy*dy):0,width=sect-inner;
      if(width>.01)for(const side of [-1,1])box(root,[side*(inner+width/2),y+slice/2,0],[width,slice,T],plaster);
    }
    box(root,[0,(crown+top)/2,0],[sect*2,top-crown,T],plaster).lookName='moongate';
    box(root,[0,top+.09,0],[sect*2+.3,.18,T+.45],coping).lookName='moongate';
    box(root,[0,top+.26,0],[sect*2+.1,.14,.2],ridge).lookName='moongate';
    for(const side of [-1,1])box(root,[side*(sect+.2),top+.2,0],[.5,.12,T+.3],coping,[0,0,side*18]).lookName='moongate';
    // A stone band round the opening, on both faces.
    for(let i=0;i<20;i++){
      const a=i/20*Math.PI*2,y=cy+Math.sin(a)*(R+.068);
      if(y<.06)continue;
      box(root,[Math.cos(a)*(R+.068),y,0],[2*Math.PI*(R+.07)/20+.04,.14,T+.08],trim,[0,0,a*180/Math.PI+90]);
    }
    for(const face of [-1,1])label(root,d.zh,[0,crown+.4,face*(T/2+.05)],2.3,.5);
    for(const side of [-1,1])side<0?mark(-sect,-gap,0,top,'moongate'):mark(gap,sect,0,top,'moongate');
    mark(-gap,gap,cy+Math.sqrt(R*R-gap*gap),top,'moongate');
  }
  /** Opening a gate removes its barrier and its hitbox. */
  setUnlocked(id,open) {
    const gate=this.gates?.get(id);if(!gate)return false;
    gate.door.enabled=!open;gate.box.solid=!open;
    // An open gate is a gap in the wall: nothing there to call a door.
    gate.box.name=open?null:{id:'door',...NAMES.door};
    return true;
  }
  inAnyDistrict(x,z) {
    for(const d of this.data.districts){
      const [x0,x1]=d.bounds.x,[z0,z1]=d.bounds.z;
      if(x>=x0&&x<=x1&&z>=z0&&z<=z1)return true;
    }
    return false;
  }
  districtAt(x,z) {
    for(const d of this.data.districts){
      const [x0,x1]=d.bounds.x,[z0,z1]=d.bounds.z;
      if(x>=x0&&x<=x1&&z>=z0&&z<=z1)return d;
    }
    return this.data.districts[0];
  }
  /** Register a box so it can be bumped into, stood on, and read. */
  mark(place,x,z,hw,hd,y0,y1,nameId,solid=true) {
    return this.registry.add({place,x,z,hw,hd,y0,y1,solid,name:nameId?{id:nameId,...NAMES[nameId]}:null});
  }
  /** The same, for something round: a basin, a trunk, a bin. The hitbox follows the stone. */
  markDisc(place,x,z,radius,y0,y1,nameId,solid=true) {
    return this.registry.add({place,x,z,radius,y0,y1,solid,name:nameId?{id:nameId,...NAMES[nameId]}:null});
  }
  /**
   * Every entity under `root` a builder tagged (`lookName`, or `signText` from `label`) becomes a
   * look-only box round its meshes. A tagged child gets its own, smaller box, which wins the look.
   * `skip` holds entities (and everything under them) that are registered some other way.
   */
  registerLooks(place,root,{owner=null,skip=null}={}) {
    // A part of a building or a gate carries the same `group` as that structure's marks.
    const groups=new Map([...this.buildings??[]].map(([id,entity])=>[entity,id]));
    const walk=(e,group)=>{
      if(skip?.has(e))return;
      group=groups.get(e)??(/^gate-(?!door)/.test(e.name)?e.name:group);
      const name=lookNameOf(e);
      const box=name?this.addLookBox(place,e,name,owner):null;
      if(box&&group)box.group=group;
      for(const child of e.children)walk(child,group);
    };
    walk(root,null);
  }
  addLookBox(place,entity,name,owner=null) {
    const bounds=meshBounds(entity);
    const refine=(origin,dir,limit)=>meshSpan(entity,origin,dir,limit);
    const box=bounds?this.registry.addLook({place,...bounds,name,owner,entity,refine}):null;
    if(box&&entity.lookReach)box.reach=entity.lookReach;   // big and far off: 云海's LED characters
    return box;
  }
  /** Things that move re-register their look boxes every frame, the way stall hitboxes do. */
  syncMovingLooks() {
    const place=this.place;
    this.registry.clearLooks(place,'moving');
    if(place==='town'){
      for(const market of [this.market,this.dayMarket])for(const pitch of market.pitches)
        if(pitch.cart)this.registerLooks(place,pitch.cart,{owner:'moving'});
      return;
    }
    for(const member of this.rooms.get(place)?.staff??[])
      this.addLookBox(place,member.entity,lookNameOf(member.entity)??{id:'waiter',...NAMES.waiter},'moving');
    for(const one of this.visitors.here(place))this.addLookBox(place,one.entity,lookNameOf(one.entity),'moving');
  }
  /** Plaques that hang on the door of a shop that has not opened yet. */
  buildClosedSigns() {
    const {box,label}=this.m;
    this.closedSigns=new Map();
    for(const [id,data] of Object.entries(rooms)){
      if(!data.opens)continue;
      const building=this.data.buildings.find(b=>b.id===data.building);
      const face=(building?.rotation??0)===180?-1:1;
      const sign=new pc.Entity('closed-'+id);
      // A model can say where on its front the sign hangs (the bank's door is set back behind columns).
      const at=this.buildings.get(data.building)?.closedSignAt;
      sign.setLocalPosition(data.door.x,at?.y??0,at?building.z+face*at.z:data.door.z+face*.12);
      sign.setLocalEulerAngles(0,face<0?180:0,0);
      this.root.addChild(sign);
      for(const x of [-.5,.5])box(sign,[x,2.62,0],[.035,.42,.035],'#7d6349').signText='暂停营业';
      box(sign,[0,2.28,0],[1.5,.62,.07],'#8d6b4d');
      label(sign,'暂停营业',[0,2.28,.05],1.32,.48,'#f0e2c6','#a4564a');
      // A shop that has not been built yet has no door to hang a sign on: the hoarding says it.
      sign.siteGate=building?.site??null;
      if(sign.siteGate)sign.enabled=false;
      this.closedSigns.set(id,sign);
    }
  }
  /**
   * Static scenery goes into one PlayCanvas batch group: every mesh that shares a material is
   * merged into a single draw call, which is what makes the outdoor town affordable on a laptop.
   * A batched mesh leaves its entity's layer, so anything that is switched on and off, moves, or
   * is built later has to stay out: people (`noBatch` from `person`), display stock (`noBatch`
   * from `pickable`), stall carts and loose objects (built after this runs), gate doors, closed
   * signs, hoardings and the shops that are still building sites.
   */
  batchStatics(name,root,skip=new Set()) {
    const group=this.app.batcher.addGroup(name,false);
    const walk=entity=>{
      if(skip.has(entity)||entity.noBatch)return;
      if(entity.render)entity.render.batchGroupId=group.id;
      for(const child of entity.children)walk(child);
    };
    walk(root);
    // The batches themselves are built by the batcher's own first `updateAll`, before the first
    // frame is drawn. Calling `generate` here as well would build them twice over.
  }
  registerBuilding(b) {
    // A rotated building has its door and sign on the other face.
    const face=(b.rotation??0)===180?-1:1,front=b.z+face*(b.depth/2+.3);
    // A building and its wings are one structure: `group` lets their hitboxes touch.
    this.mark('town',b.x,b.z,b.width/2+.35,b.depth/2+.35,0,b.height+1.4,b.object??'wall').group=b.id;
    for(const wing of b.wings??[])
      this.mark('town',b.x+face*wing.x,b.z+face*wing.z,wing.width/2+.35,wing.depth/2+.35,0,wing.height+.8,
        wing.object??b.object??'wall').group=b.id;
    // The door point out on the pavement, unless the model marks its own door (the bank's is set back).
    const parts=this.buildings.get(b.id)?.marks??[];
    if(!parts.some(m=>m.name==='door'))this.mark('town',b.x,front,.7,.16,0,2.2,'door',false);
    // The parts a building's model names for itself: a balcony, a chimney, the pots by the door.
    // A model that hangs its own name board somewhere else marks that board itself.
    if(!parts.some(m=>m.name==='sign'))this.mark('town',b.x,front+face*.02,1.8,.1,b.height-.9,b.height-.2,'sign',false);
    for(const m of parts)
      (m.radius?this.markDisc('town',m.x,m.z,m.radius,m.y0,m.y1,m.name,m.solid)
        :this.mark('town',m.x,m.z,m.hw,m.hd,m.y0,m.y1,m.name,m.solid)).group=b.id;
  }
  registerTown() {
    const d=this.data;
    for(const dist of d.districts){
      const [x0,x1]=dist.bounds.x,[z0,z1]=dist.bounds.z;
      this.mark('town',(x0+x1)/2,(z0+z1)/2,(x1-x0)/2,(z1-z0)/2,-.1,.05,'floor',false);
    }
    // A shop that has not been built yet is not there to bump into: `revealSite` registers it.
    for(const b of d.buildings)if(!b.bespoke&&!b.site)this.registerBuilding(b);
    for(const [x,z,kind='tree'] of d.trees){
      const pit=kind==='willow'?0:.35;   // a willow stands straight in the bank, with no stone pit to step on
      if(pit)this.markDisc('town',x,z,.98,0,pit,kind);
      this.markDisc('town',x,z,.22,pit,2.4,kind);
      // A willow's curtain is soft: you walk through the strands, and only its crown is in the way.
      this.markDisc('town',x,z,1.5,kind==='willow'?2.8:1.55,4.3,kind);
    }
    // Street furniture is named from the same table the world data uses.
    const propName={bench:'bench',bin:'bin',streetlight:'streetlight',bicycle:'bicycle',planter:'planter',
      crate:'box',fruitstand:'fruit',cafetable:'table',chair:'chair',parasol:'umbrella',bollard:'stone',
      awning:'awning',sign:'sign'};
    const round=new Set(['bin','bollard','cafetable','parasol','streetlight']);
    for(const prop of this.props){
      // Its meshes read as the prop too: a bench's back, a streetlight's arm.
      if(propName[prop.kind])prop.entity.lookName??=propName[prop.kind];
      const [hw,hd]=prop.half,[worldHW,worldHD]=rotatedHalf(prop.half,prop.rot??0);
      if(round.has(prop.kind))this.markDisc('town',prop.x,prop.z,hw,0,prop.top,propName[prop.kind]??null,!prop.soft);
      else this.mark('town',prop.x,prop.z,worldHW,worldHD,0,prop.top,propName[prop.kind]??null,!prop.soft);
    }
    // The fountain is round, so its hitbox is too: a square one stuck out well past the stone.
    this.siteWalls=new Map(sites.sites.map(site=>[site.id,this.mark('town',site.x,site.z,3.8,2.9,0,2.4,'wall')]));
    for(const mark of this.station?.marks??[])
      this.mark('town',mark.x,mark.z,mark.hw,mark.hd,mark.y0,mark.y1,mark.name);
    this.markDisc('town',FOUNTAIN.x,FOUNTAIN.z,FOUNTAIN_MARK.radius,FOUNTAIN_MARK.y0,FOUNTAIN_MARK.y1,null);
    for(const part of FOUNTAIN_LOOKS)this.markDisc('town',FOUNTAIN.x,FOUNTAIN.z,part.radius,part.y0,part.y1,'fountain',false);
    // Only the posts are in the way; the board is high enough to walk under.
    for(const x of [-2.2,2.2])this.mark('town',x,17,.14,.14,0,3.8,'sign');
    this.mark('town',0,17,2,.12,2.95,3.8,'sign');
    for(const [x,z] of this.stalls)this.mark('town',x,z,1.75,.7,0,1.5,'counter');
    for(const x of [-12,12]){
      this.markDisc('town',x,0,.3,0,4.6,'streetlight');
      for(const off of [-.47,.47])this.mark('town',x+off,0,.25,.25,3.7,4.4,'lantern',false);
    }
    for(let x=-11;x<=11;x+=2.2)this.mark('town',x,-5,.3,.3,5.4-Math.sin((x+11)/22*Math.PI)*.8,6.2-Math.sin((x+11)/22*Math.PI)*.8,'lantern',false);
    for(const m of this.groundMarks??[])this.mark('town',m.x,m.z,m.hw,m.hd,m.y0,m.y1,m.name,m.solid);
    // Park marks may carry a `group`: the parts of one structure (a bridge, the pavilion) touch.
    // So do the word hall's: the terrace, its halls, lions and paifang are one complex.
    for(const m of [...this.garden?.marks??[],...this.wordhall?.marks??[],...this.sceneryMarks??[]]){
      const box=m.radius?this.markDisc('town',m.x,m.z,m.radius,m.y0,m.y1,m.name,m.solid!==false)
        :this.mark('town',m.x,m.z,m.hw,m.hd,m.y0,m.y1,m.name,m.solid!==false);
      if(m.group)box.group=m.group;
    }
    for(const one of this.people)this.mark('town',one.x,one.z,.52,.48,0,1.95,'person');
    for(const npc of d.npcs)this.mark('town',npc.x,npc.z,.52,.48,0,1.95,'person');
    // Everything the builders tagged. People already have boxes; the two neighbours chatting
    // at each chat spot stand still, so one box each is enough.
    const people=[...this.actors.values(),...this.people,...this.friends].map(one=>one.entity);
    this.registerLooks('town',this.root,{skip:new Set(people)});
    for(const friend of this.friends)this.addLookBox('town',friend.entity,{id:'person',...NAMES.person});
  }
  registerRooms() {
    for(const room of this.rooms.values()){
      const {data,offsetX}=room,[w,d]=data.size,h=data.height;
      this.registry.clear(room.id);
      this.mark(room.id,offsetX,0,w/2,d/2,-.1,.02,'floor',false);
      this.mark(room.id,offsetX-w/2-.15,0,.2,d/2,0,h,'wall');
      this.mark(room.id,offsetX+w/2+.15,0,.2,d/2,0,h,'wall');
      this.mark(room.id,offsetX,-d/2-.15,w/2+.2,.2,0,h,'wall');
      // A courtyard open to the sky has no lid and no beams to bump into or name.
      // The lid and beams stay solid but unnamed: their own look boxes say 天花板 and 房梁.
      if(!data.open)this.mark(room.id,offsetX,0,w/2+.2,d/2+.2,h,h+.2,null);
      const top=data.doorHeight??h-1.1;
      this.mark(room.id,offsetX,d/2+.15,.85,.2,top,h,'wall');
      if(!data.open)for(let i=0;i<4;i++)this.mark(room.id,offsetX,-d/2+1.4+i*((d-2.8)/3),w/2,.11,h-.14,h+.02,null);
      for(const side of [-1,1])this.mark(room.id,offsetX+side*(.85+(w-1.7)/4),d/2+.15,(w-1.7)/4,.2,0,h,'wall');
      // Entered upstairs (the metro platform), the doorway is up there, over solid wall.
      const sill=data.upper?.entrance?data.upper.y:0;
      if(sill)this.mark(room.id,offsetX,d/2+.15,.85,.2,0,sill,'wall');
      this.mark(room.id,offsetX,d/2+.15,.85,.2,sill,sill+.6,'door',false);
      // The doorway itself is shut to walking: the room floats far from the town, so stepping through
      // it led into nothing. You leave with E; the door mark above only names it.
      if(!data.returnWall)this.mark(room.id,offsetX,d/2+.15,.85,.2,sill,top,null);
      // A room whose way back is on another wall has its front doorway walled up, and that way marked.
      if(data.returnWall){
        this.mark(room.id,offsetX,d/2+.15,.85,.2,0,top,'wall');
        const near=annexApproach(data.returnWall,data.exit[0],data.exit[1],w,d,.13),[hw,hd]=near.nz?[.6,.5]:[.1,.63];
        this.mark(room.id,offsetX+near.x,near.z,hw,hd,0,2.2,'door',false);
      }
      for(const annex of data.annexes??[]){
        const near=annexApproach(annex.wall,annex.x,annex.z,w,d,.13),[hw,hd]=near.nz?[.63,.1]:[.1,.63];
        this.mark(room.id,offsetX+near.x,near.z,hw,hd,0,2.2,'door',false);
      }
      // An upper floor, its stairs and railings are solid but unnamed: their meshes carry the names.
      for(const part of upperParts(data))this.mark(room.id,offsetX+part.x,part.z,part.hw,part.hd,part.y0,part.y1,null);
      if(data.window)for(const x of data.window)this.mark(room.id,offsetX+x,-d/2+.06,.78,.1,1.1,2.6,'window',false);
      // A glass door onto the balcony is looked at, not walked through.
      for(const pane of data.frontWindows??[])this.mark(room.id,offsetX+pane.x,d/2-.08,pane.door?.64:.6,.1,(pane.y??0)+(pane.door?0:1.1),(pane.y??0)+(pane.door?2.2:2.4),pane.name,!!pane.door);
      for(const fitting of room.fittings??[])
        this.registry.add({place:room.id,x:offsetX+fitting.x,z:fitting.z,hw:fitting.hw,hd:fitting.hd,
          radius:fitting.radius??null,y0:(fitting.y??0)+(fitting.y0??0),y1:(fitting.y??0)+fitting.top,solid:true,
          name:fitting.name?{id:fitting.name,...NAMES[fitting.name]}:null});
      if(data.desk)this.mark(room.id,offsetX+data.desk.x,data.desk.z,.45,.95,0,1.2,'desk');
      if(data.lectern){
        // The word hall's 书案 (`look`) is a writing desk between two standing lanterns, not a counter between shelves.
        const look=!!data.lectern.look;
        this.mark(room.id,offsetX+data.lectern.x,data.lectern.z,1.15,.5,0,1.3,look?'writing-desk':'counter');
        for(const dx of [-2.1,2.1])this.mark(room.id,offsetX+data.lectern.x+dx,data.lectern.z-.35,look?.3:.2,look?.3:.78,0,look?2.3:2.2,look?'lantern':'shelf');
      }
      // Waiters walk, so they are boxed every frame instead (`syncMovingLooks`).
      for(const fitting of room.fittings??[])if(fitting.name&&fitting.entity)fitting.entity.lookName??=fitting.name;
      this.registry.clearLooks(room.id);
      this.registerLooks(room.id,room.root,{skip:new Set(room.staff.map(member=>member.entity))});
    }
  }
  buildRooms() {
    Object.entries(rooms).forEach(([id,data],index)=>{
      const built=buildRoom(this.m,this.app.root,data,index,id);
      built.root.enabled=false;
      for(const fitting of built.fittings)if(fitting.material)this.lampMaterials.push(fitting.material);
      this.lampMaterials.push(...built.lamps);
      const staff=(data.staff??[]).map(def=>{
        const made=this.m.person(built.root,def.color,[def.path[0][0],0,def.path[0][1]]);
        if(def.look)made.entity.lookName=def.look;   // a clerk or pharmacist, not a waiter
        return initIdle({...def,...made,leg:0,target:1,wait:Math.random()*2,x:def.path[0][0],z:def.path[0][1]});
      });
      this.rooms.set(id,{id,data,root:built.root,ceilings:built.ceilings,sun:built.sun,fittings:built.fittings,openings:built.openings,staff,index,offsetX:ROOM_OFFSET*(index+1),props:new Map()});
    });
  }
  /** Everything the tourist can press E on, in whichever place they are standing. */
  targets() {
    if(this.place==='town') {
      const list=[...this.actors].map(([id,actor])=>{const p=actor.entity.getPosition();return {id,x:p.x,z:p.z,radius:3.2,label:npcs.find(n=>n.id===id)?.zh??id};});
      // The two neighbors who provide background chatter can also be greeted, but only when the
      // player chooses to walk over and interact with them.
      for(const [ax,az] of this.data.ambient){
        list.push({id:'friend-a',x:ax,z:az,radius:2.8,label:'和邻居打招呼'});
        list.push({id:'friend-b',x:ax-1.3,z:az+.5,radius:2.8,label:'和邻居打招呼'});
      }
      for(const room of this.rooms.values()){
        // A back room is reached from inside; the city is reached by train. Neither has a door
        // on the square, and asking for one is how you get an exception every frame.
        if(room.data.interiorOnly||room.data.outdoor)continue;
        const shut=room.data.opens&&!this.roomOpen.get(room.id);
        list.push({id:(shut?'closed:':'door:')+room.id,x:room.data.door.x,z:room.data.door.z,radius:2.4,
          label:shut?'看看告示 · 暂停营业':room.data.enterLabel,wide:true});
      }
      for(const [id,gate] of this.gates)if(gate.box.solid)
        list.push({id:'gate:'+id,x:gate.district.gate.x,z:gate.district.gate.z,radius:3.6,label:'看看告示',wide:true});
      for(const site of sites.sites){
        if(this.siteBuilt?.has(site.id))continue;
        list.push({id:'site:'+site.id,x:site.x,z:site.z+(site.rotation===180?-3.4:3.4),
          radius:3.0,label:'看看工地',wide:true});
      }
      for(const pitch of[...this.market.open,...this.dayMarket.open])
        list.push({id:'shop:'+pitch.shop,x:pitch.spot[0],z:pitch.spot[1],radius:2.6,label:'看看'+pitch.zh,wide:true});
      // Any 邮筒 takes a postcard.
      for(const built of this.buildings.values())for(const m of built.marks??[])
        if(m.name==='postbox')list.push({id:'postbox',x:m.x,z:m.z,radius:2.2,label:friends.ui.write.zh,wide:true});
      // A festival's stall, noticeboard and riddle lanterns (src/world/festivals.js).
      list.push(...this.festival?.targets()??[]);
      this.addLooseTargets(list);
      return list;
    }
    const room=this.rooms.get(this.place),[w,d]=room.data.size;
    // Sitting down narrows the world to the table you are at: stand up, or use what is on it.
    if(this.seated){
      const seat=room.fittings[this.seated.index];
      const list=[{id:'stand',x:room.offsetX+seat.x,z:seat.z,radius:2.4,label:'站起来',wide:true}];
      for(const [index,fitting] of (room.fittings??[]).entries())
        if(fitting.action&&Math.hypot(fitting.x-seat.x,fitting.z-seat.z)<2.4)
          list.push({id:fitting.action,x:room.offsetX+fitting.x,z:fitting.z,radius:2.4,label:fitting.label??'看看',wide:true,seatIndex:index});
      return list;
    }
    if(room.data.outdoor)return this.cityTargets(room);
    // A back room leads back into the house it belongs to, not out onto the street.
    const out=room.data.returnPlace?'door:'+room.data.returnPlace:'leave';
    const list=[{id:out,x:room.offsetX+room.data.exit[0],z:room.data.exit[1],radius:2.2,
      label:room.data.returnLabel??'出去',wide:true,y:room.data.upper?.entrance?room.data.upper.y:0}];
    for(const annex of room.data.annexes??[]){
      const near=annexApproach(annex.wall,annex.x,annex.z,w,d,.2);
      list.push({id:'door:'+annex.room,x:room.offsetX+near.x,z:near.z,
        radius:1.7,label:annex.label??'进去',wide:true});
    }
    if(room.data.lectern){
      const counter=room.data.lectern;
      list.push({
        id:counter.shop?'shop:'+counter.shop:counter.panel?'panel:'+counter.panel:'lectern',
        x:room.offsetX+counter.x,z:counter.z+1.6,radius:2.6,label:counter.label,wide:true});
    }
    for(const [index,fitting] of (room.fittings??[]).entries()){
      // A counter served from in front (`approach`, metres out from its face) is reached from there, as
      // the old lectern was, so a waiter walking by does not win the E key from the customer at it.
      const out=fitting.approach??0,turn=(fitting.rot??0)*Math.PI/180;
      if(fitting.action)list.push({id:fitting.action,x:room.offsetX+fitting.x+Math.sin(turn)*out,z:fitting.z+Math.cos(turn)*out,y:fitting.y,radius:out?2.6:1.9,label:fitting.label??'看看',wide:true});
      if(fitting.seat!==undefined)list.push({id:'sit:'+index,x:room.offsetX+fitting.x,z:fitting.z,radius:1.7,label:'坐下',wide:true});
    }
    // Staff who talk (`talk: false` are only there to be seen). Someone you are looking at (the
    // same look box the word hall's visitors use) wins over the counter they stand behind.
    for(const member of room.staff??[])if(member.talk!==false)
      list.push({id:'staff:'+member.id,x:room.offsetX+member.x,z:member.z,radius:2.6,label:'和'+member.zh+'说话',wide:false,
        aimed:this.lookingBox?.entity===member.entity});
    list.push(...this.visitors.targets(this.place,this.lookingBox?.entity));
    if(room.data.desk)list.push({id:'studydesk',x:room.offsetX+room.data.desk.x+1.1,z:room.data.desk.z,radius:2.2,label:room.data.desk.label,wide:true});
    // A bed you own is somewhere to sleep, and sleeping is how you choose the time of day.
    for(const prop of room.props.values())if(prop.kind==='bed')
      list.push({id:'sleep',x:room.offsetX+prop.x,z:prop.z,y:prop.y??0,radius:2.2,label:'睡觉 · 选时间',wide:true});
    if(room.data.decoratable){
      const [x,z]=room.data.decorateAt??[0,-d/2+1.6],up=room.data.upper;
      list.push({id:'decorate',x:room.offsetX+x,z,radius:2.4,label:'布置房间',wide:true});
      if(up?.decorateAt)list.push({id:'decorate',x:room.offsetX+up.decorateAt[0],z:up.decorateAt[1],y:up.y,radius:2.4,label:'布置房间',wide:true});
    }
    this.addLooseTargets(list);
    // Two floors share one floor plan: offer only what is on the floor the tourist is standing on.
    const floor=this.floorY();
    return room.data.upper?list.filter(t=>(t.y??0)===floor):list;
  }
  /** Which floor the tourist is on in a room with an upper floor: its height upstairs, else 0. */
  floorY() {const up=this.rooms.get(this.place)?.data.upper;return up&&this.playerY>up.y-.5?up.y:0;}
  /** Out in 云海: the way home, the people on the street, the shop window, the taxis and the noodle counter. */
  cityTargets(room) {
    const list=[{id:'metro:home',x:room.offsetX+room.data.exit[0],z:room.data.exit[1],
      radius:3.0,label:room.data.returnLabel,wide:true}];
    if(CITY.department)list.push({id:'door:'+CITY.department.room,x:room.offsetX+CITY.department.x,z:CITY.department.z,radius:2.6,label:CITY.department.label,wide:true});
    for(const person of room.people??[])
      list.push({id:'city:'+person.id,x:room.offsetX+person.x,z:person.z,radius:3.0,
        label:'和'+person.zh+'说话',wide:false});
    // The kiosk's window is 1.6 m out on whichever side it faces.
    for(const prop of CITY.props)if(prop.kind==='citykiosk'){
      const turn=(prop.rot??0)*Math.PI/180;
      list.push({id:'shop:kiosk',x:room.offsetX+prop.x+1.6*Math.sin(turn),z:prop.z+1.6*Math.cos(turn),radius:2.6,label:'看看便利店',wide:true});
    }
    CITY.props.forEach((prop,i)=>{if(prop.kind==='taxi')
      list.push({id:'taxi:'+i,x:room.offsetX+prop.x,z:prop.z,radius:2.8,label:'打车 · TAXI',wide:true});});
    if(CITY.noodles)list.push({id:'noodles',x:room.offsetX+CITY.noodles.x,z:CITY.noodles.z,radius:2.6,label:CITY.noodles.label,wide:true});
    for(const part of room.parts??[])list.push(...part.targets?.()??[]);
    this.addLooseTargets(list);
    return list;
  }
  /** Containers you can take from, and whatever someone already dropped on the floor. */
  addLooseTargets(list) {
    if(this.toys.held)return;
    for(const [index,container] of this.containers.entries()){
      if(container.place!==this.place||!container.ready())continue;
      list.push({id:'take:'+index,x:container.x,z:container.z,radius:2.0,label:'拿一个'+container.zh,wide:true});
    }
    const pos=this.player.entity.getPosition();
    const loose=this.toys.nearest(this.place,pos.x,pos.z,this.playerY+1);
    if(loose)list.push({id:'grab',x:loose.x,z:loose.z,radius:1.6,label:'捡起来',wide:true});
  }
  /** 陈叔叔 pins your postcard to his shop front, left of the door, once it has arrived. */
  pinPostcard(buildingId) {
    const b=this.data.buildings.find(b=>b.id===buildingId);
    if(!b||this.postcardPin)return;
    const face=(b.rotation??0)===180?-1:1,x=b.x-face*2.2,z=b.z+face*(b.depth/2+.12);
    this.postcardPin=this.m.box(this.root,[x,1.6,z],[.42,.3,.02],'#eee1bf');
    this.mark('town',x,z,.21,.04,1.45,1.75,'postcard',false);
  }
  /** Whether a shop has opened yet. Locked rooms keep their door shut and hang a sign. */
  setRoomOpen(id,open) {
    this.roomOpen.set(id,!!open);
    const sign=this.closedSigns?.get(id);
    if(sign)sign.enabled=!open&&(!sign.siteGate||!!this.siteBuilt?.has(sign.siteGate));
    return open;
  }
  // --- sitting ----------------------------------------------------------
  sit(index) {
    if(this.place==='town'||this.seated)return false;
    const room=this.rooms.get(this.place),seat=room.fittings?.[index];
    if(!seat||seat.seat===undefined)return false;
    const from=this.player.entity.getPosition().clone();
    const bodyYaw=(seat.rot??0)+180;
    this.seated={index,from:{x:from.x,z:from.z,y:this.playerY},bodyYaw};
    this.playerY=seat.seat-SEAT_DROP;this.velocityY=0;this.velocity={x:0,z:0};this.grounded=true;
    this.player.entity.setPosition(room.offsetX+seat.x,this.playerY,seat.z);
    this.yaw=bodyYaw;this.pitch=-8;
    restIdle(this.player);
    this.player.legs.forEach(leg=>leg.setLocalEulerAngles(78,0,0));
    this.player.arms.forEach((arm,i)=>arm.setLocalEulerAngles(14,0,i?-5:5));
    this.clearNearest();this.placeCamera(this.player.entity.getPosition());
    return true;
  }
  stand() {
    if(!this.seated)return false;
    const {from}=this.seated;this.seated=null;
    // Back onto the floor you sat down from: the hotpot terrace is 14 m up the hill.
    const y=from.y??0,spot=this.canMove(from.x,from.z,y)?from:(this.nearestFreeSpot(from.x,from.z)??from);
    this.playerY=y;this.velocityY=0;this.grounded=true;
    this.player.entity.setPosition(spot.x,y,spot.z);
    this.player.legs.forEach(leg=>leg.setLocalEulerAngles(0,0,0));
    this.player.arms.forEach(arm=>arm.setLocalEulerAngles(0,0,0));
    this.clearNearest();this.placeCamera(this.player.entity.getPosition());
    return true;
  }
  // --- sleeping ---------------------------------------------------------
  /** The bed nearest the tourist, on the floor they stand on, if this room has one. */
  bedHere() {
    const room=this.rooms.get(this.place),floor=this.floorY(),p=this.player.entity.getPosition();
    let best=null,far=Infinity;
    for(const prop of room?.props.values()??[]){
      const d=Math.hypot(room.offsetX+prop.x-p.x,prop.z-p.z);
      if(prop.kind==='bed'&&(prop.y??0)===floor&&d<far){best=prop;far=d;}
    }
    return best;
  }
  /** A point in a bed's own frame (x towards its foot, z out of its front, y up from its floor), in the world. */
  onBed(bed,x,y,z) {
    const r=(bed.rot??0)*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
    return new pc.Vec3(this.rooms.get(this.place).offsetX+bed.x+x*c+z*s,(bed.y??0)+y,bed.z-x*s+z*c);
  }
  /**
   * Hop onto the bed and lie back looking up at the canopy: a short arc from where the tourist
   * stands onto the mattress, head on the pillows. The caller pauses the town first, so nothing else
   * moves them; getUp() ends it. Returns the milliseconds until they are settled.
   */
  lieDown(bed) {
    const body=this.player.entity,from=body.getPosition().clone(),eye=new pc.Vec3(from.x,from.y+this.eyeHeight,from.z);
    // Lying on your back: the body's up runs to the head end (-x), its face to the sky.
    const flat=new pc.Quat().setFromEulerAngles(0,(bed.rot??0)+90,0).mul(new pc.Quat().setFromEulerAngles(-90,0,0));
    this.sleeping={t:0,view:this.view,from,to:this.onBed(bed,.85,.81,0),turn:body.getRotation().clone(),flat,
      eyeFrom:eye,eyeTo:this.onBed(bed,-.79,1.04,0),eye:eye.clone(),
      yaw:this.yaw,pitch:this.pitch,yawTo:(bed.rot??0)-90};
    this.view='first';this.applyView();   // lying down is seen from your own eyes
    restIdle(this.player);this.clearNearest();
    return (SLEEP_HOP+.3)*1000;
  }
  stepSleep(dt) {
    const z=this.sleeping;z.t=Math.min(1,z.t+dt/SLEEP_HOP);
    const k=z.t*z.t*(3-2*z.t),lift=4*z.t*(1-z.t)*.5,body=this.player.entity;   // eased, over a half-metre arc
    const at=(a,b)=>new pc.Vec3().lerp(a,b,k).add(new pc.Vec3(0,lift,0));
    body.setPosition(at(z.from,z.to));
    body.setRotation(new pc.Quat().slerp(z.turn,z.flat,k));
    z.eye.copy(at(z.eyeFrom,z.eyeTo));
    this.yaw=z.yaw+((((z.yawTo-z.yaw)%360)+540)%360-180)*k;   // the short way round
    this.pitch=z.pitch+(70-z.pitch)*k;
  }
  /** Stand up at the front of the bed, facing into the room. */
  getUp(bed) {
    const was=this.sleeping;this.sleeping=null;
    if(was){this.view=was.view;this.applyView();}
    const floor=bed.y??0,spot=this.onBed(bed,0,0,1.25);
    this.playerY=floor;
    const free=this.canMove(spot.x,spot.z,floor)?spot:(this.nearestFreeSpot(spot.x,spot.z)??spot);
    this.warp(free.x,free.z,(bed.rot??0)+180,floor);
  }
  // --- furnishing -------------------------------------------------------
  /** Rebuild a room's furniture from saved records. Returns the records it could place. */
  furnish(id,records) {
    const room=this.rooms.get(id);if(!room)return [];
    for(const uid of [...room.props.keys()])this.removeProp(id,uid);
    const kept=[];
    for(const record of records??[]){if(this.addProp(id,record))kept.push(record);}
    return kept;
  }
  addProp(id,record) {
    const room=this.rooms.get(id);if(!room)return null;
    const entity=this.m.furniture(room.root,record.kind,record.color);
    // Anything that is a lamp actually lights the room, at roughly the height of its shade.
    const lampHeight={lamp:1.2,ceilinglamp:2.0,desklamp:.75}[record.kind];
    if(lampHeight!==undefined){
      const light=new pc.Entity('lamp-light');
      const reach=record.kind==='desklamp'?4:record.kind==='ceilinglamp'?9:7;
      light.addComponent('light',{type:'omni',color:new pc.Color(1,.9,.72),intensity:0,range:reach,castShadows:false});
      light.setLocalPosition(0,lampHeight,0);entity.addChild(light);
      entity.lampLight=light;entity.lampReach=record.kind==='desklamp'?1.4:record.kind==='ceilinglamp'?2.8:2.4;
      if(entity.lampMaterial)this.daylight?.addLamp(entity.lampMaterial);
    }
    // Anything standing on a table sits at the table top, and takes no hitbox of its own —
    // you already cannot walk through the thing holding it up.
    const base=record.on?room.props.get(record.on):null;
    const lift=base?surfaceHeight(base.kind)??0:0,floor=record.y??0;
    entity.setLocalPosition(record.x,floor+lift,record.z);
    entity.setLocalEulerAngles(0,record.rot??0,0);
    const [fw,fd]=record.footprint,turned=((record.rot??0)/90)%2!==0;
    const hw=(turned?fd:fw)/2,hd=(turned?fw:fd)/2;
    const height={rug:.03,table:.47,bed:.62,shelf:1.7,lamp:1.3,plant:1.1,'tea-table':.5,'folding-screen':1.7,birdcage:1.5}[record.kind]??.8;
    // A certificate hangs on the wall, so like a vase on a table it has no footing to bump into.
    const box=base||hangsOnWall(record.kind)?null
      :this.mark(id,room.offsetX+record.x,record.z,hw*.86,hd*.86,floor,floor+height,record.kind,record.kind!=='rug');
    // Named by its own meshes too, so a vase on a table reads 花瓶 and not 桌子.
    entity.lookName??=record.kind;
    this.registerLooks(id,entity,{owner:record.uid});
    const prop={...record,entity,box,lift};
    room.props.set(record.uid,prop);
    return prop;
  }
  removeProp(id,uid) {
    const room=this.rooms.get(id),prop=room?.props.get(uid);
    if(!prop)return false;
    // An assembly comes apart together: whatever was standing on this goes too.
    for(const child of [...room.props.values()])if(child.on===uid)this.removeProp(id,child.uid);
    prop.entity.destroy();
    if(prop.box)this.registry.boxes.splice(this.registry.boxes.indexOf(prop.box),1);
    this.registry.clearLooks(id,uid);
    room.props.delete(uid);
    return true;
  }
  /** The piece of furniture underneath a point, if there is one. */
  propUnder(room,x,z,skipUid=null,floor=0) {
    for(const prop of room.props.values()){
      if(prop.uid===skipUid||prop.on||prop.kind==='rug'||(prop.y??0)!==floor)continue;
      const [pw,pd]=prop.footprint,turned=((prop.rot??0)/90)%2!==0;
      if(Math.abs(x-prop.x)<=(turned?pd:pw)/2&&Math.abs(z-prop.z)<=(turned?pw:pd)/2)return prop;
    }
    return null;
  }
  beginPlacement(item) {
    // Only a room the save can hold furniture for: anywhere else it would vanish on reload.
    if(!this.rooms.get(this.place)?.data.decoratable)return false;
    this.cancelPlacement();
    const room=this.rooms.get(this.place);
    this.ghost={item,rot:0,valid:false,x:0,z:0,
      entity:this.m.furniture(room.root,item.kind,item.color),
      pad:this.m.box(room.root,[0,.006,0],[item.footprint[0],.012,item.footprint[1]],'#7fa06f')};
    this.updatePlacement();
    return true;
  }
  cancelPlacement() {
    if(!this.ghost)return;
    this.ghost.entity.destroy();this.ghost.pad.destroy();this.ghost=null;
  }
  rotatePlacement() {if(this.ghost){this.ghost.rot=(this.ghost.rot+90)%360;this.updatePlacement();}}
  /** Where the ghost sits: a short reach ahead of the tourist, snapped to a quarter-metre grid. */
  updatePlacement() {
    if(!this.ghost||this.place==='town')return;
    const room=this.rooms.get(this.place),[w,d]=room.data.size;
    const pos=this.player.entity.getPosition(),{fx,fz}=this.facing();
    const snap=v=>Math.round(v*4)/4;
    const [fw,fd]=this.ghost.item.footprint,turned=(this.ghost.rot/90)%2!==0;
    const halfW=(turned?fd:fw)/2,halfD=(turned?fw:fd)/2;
    const x=Math.max(-w/2+halfW+.3,Math.min(w/2-halfW-.3,snap(pos.x-room.offsetX+fx*2)));
    const z=Math.max(-d/2+halfD+.3,Math.min(d/2-halfD-.5,snap(pos.z+fz*2)));
    const floor=this.floorY();
    this.ghost.x=x;this.ghost.z=z;this.ghost.floor=floor;
    // Hovering over a piece of furniture means one of two things: this small thing is going to
    // stand on it, or it is going nowhere. Open floor behaves exactly as it always did.
    const under=canStack(this.ghost.item.kind)?this.propUnder(room,x,z,null,floor):null;
    const base=under&&offersSurface(under.kind)?under:null;
    const lift=base?surfaceHeight(base.kind):0;
    this.ghost.on=base?.uid??null;
    this.ghost.problem=placementProblem(this.ghost.item.kind,under);
    this.ghost.entity.setLocalPosition(x,floor+lift,z);
    this.ghost.entity.setLocalEulerAngles(0,this.ghost.rot,0);
    this.ghost.pad.setLocalPosition(x,floor+lift+.006,z);
    this.ghost.pad.setLocalScale(halfW*2,.012,halfD*2);
    this.ghost.valid=base
      ? !this.ghost.problem&&fitsOn(base,{...this.ghost.item,x,z},decorOn([...room.props.values()],base.uid))
      : !under&&this.freeSpot(room,x,z,halfW,halfD,floor);
    this.ghost.pad.render.meshInstances[0].material=this.m.material(this.ghost.valid?'#7fa06f':'#c07f6f');
  }
  freeSpot(room,x,z,halfW,halfD,floor=0) {
    const here=this.player.entity.getPosition();
    // Nothing goes in the stairwell: on the stairs below, or over the hole above.
    const well=room.data.upper?.well;
    if(well&&x+halfW>well[0]-.1&&x-halfW<well[2]+.1&&z+halfD>well[1]-.1&&z-halfD<well[3]+.1)return false;
    // Doors, the exit and the fittings are all on the ground floor.
    if(this.ghost?.item.kind!=='rug'&&!floor){
      for(const f of room.fittings??[])if(Math.abs(x-f.x)<halfW+f.hw+.08&&Math.abs(z-f.z)<halfD+f.hd+.08)return false;
      if(room.data.desk&&Math.abs(x-room.data.desk.x)<halfW+.45&&Math.abs(z-room.data.desk.z)<halfD+.95)return false;
      if(Math.abs(x-room.data.exit[0])<halfW+.8&&Math.abs(z-room.data.exit[1])<halfD+1.1)return false;
      for(const annex of room.data.annexes??[]){
        const [rw,rd]=room.data.size,at=annexDoor(annex.wall,annex.x,annex.z,rw,rd),[mx,mz]=at.nz?[.85,1]:[1,.85];
        if(Math.abs(x-at.x)<halfW+mx&&Math.abs(z-at.z)<halfD+mz)return false;
      }
    }
    if(this.ghost?.item.kind!=='rug'&&Math.abs(x-(here.x-room.offsetX))<halfW+.45&&Math.abs(z-here.z)<halfD+.45)return false;
    if(room.data.lectern&&Math.abs(x-room.data.lectern.x)<halfW+1.4&&Math.abs(z-room.data.lectern.z)<halfD+.9)return false;
    for(const prop of room.props.values()){
      if(prop.kind==='rug'||this.ghost?.item.kind==='rug'||(prop.y??0)!==floor)continue;   // rugs layer under everything
      const [pw,pd]=prop.footprint,turned=((prop.rot??0)/90)%2!==0;
      if(Math.abs(x-prop.x)<halfW+(turned?pd:pw)/2&&Math.abs(z-prop.z)<halfD+(turned?pw:pd)/2)return false;
    }
    return true;
  }
  /** Placing on an occupied spot is a miss, not a cancel: keep the ghost so the player can move. */
  tryPlace() {
    if(!this.ghost)return;
    if(!this.ghost.valid){this.onPlace?.({status:'blocked',item:this.ghost.item,problem:this.ghost.problem});return;}
    const {item,rot,x,z,on,floor}=this.ghost;
    this.cancelPlacement();
    const record={uid:`${item.id}-${Date.now().toString(36)}`,item:item.id,kind:item.kind,color:item.color,footprint:item.footprint,x,z,rot,room:this.place,...(floor?{y:floor}:{}),...(on?{on}:{})};
    this.addProp(this.place,record);
    this.onPlace?.({status:'placed',item,record});
  }
  enterRoom(id) {
    const room=this.rooms.get(id);if(!room||this.place===id)return false;
    this.warps=(this.warps??0)+1;   // stepping through a door is a jump too, not a walk
    const leaving=this.rooms.get(this.place)?.data;
    this.tidyLoose();
    if(this.seated)this.stand();
    if(this.place==='town'){this.exitPoint=this.player.entity.getPosition().clone();this.exitYaw=this.yaw;}
    this.resetInput();
    if(this.place!=='town')this.rooms.get(this.place).root.enabled=false;
    // The town stays switched on: rooms stand 400 m and more away, past the camera's 200 m far clip,
    // so it is never drawn from inside. Switching it off made the batcher pull every static mesh out
    // of its batches and rebuild them all on the way back out, a visible freeze at each door.
    room.root.enabled=true;this.place=id;this.fitCamera();
    // Coming back out of a back room, you step out of its doorway rather than teleporting to
    // the middle of the room you started in.
    // A room entered upstairs (the metro platform) puts you on its landing.
    const spot=(leaving?.returnPlace===id&&leaving.returnSpawn)||room.data.spawn,y=room.data.upper?.entrance?room.data.upper.y:0;
    this.player.entity.setPosition(room.offsetX+spot[0],y,spot[1]);
    this.playerY=y;this.velocityY=0;this.grounded=true;
    this.yaw=spot[2]??0;this.pitch=-4;this.target=null;this.clearNearest();
    if(!this.thirdPersonAllowed()&&this.view==='third'){this.view='first';this.applyView();}
    this.placeCamera(this.player.entity.getPosition());
    return true;
  }
  clearNearest() {this.nearest=null;this.onNear(null);}
  /** Anything left on the floor here is cleared away and its container restocked. */
  tidyLoose() {
    if(this.toys.held)this.toys.drop();
    this.toys.clear(this.place);
    for(const container of this.containers)if(container.place===this.place)container.reset();
  }
  /** Put the tourist somewhere specific. Used by the layout tools and by the browser tests,
   *  so they do not have to steer through a city whose streets keep changing. */
  warp(x,z,yaw=this.yaw,y=0) {
    this.warps=(this.warps??0)+1;   // anything that asks "did they walk here?" watches this count
    this.resetInput();
    this.seated=null;
    this.player.legs.forEach(leg=>leg.setLocalEulerAngles(0,0,0));
    this.player.entity.setPosition(x,y,z);
    this.playerY=y;this.velocityY=0;this.grounded=true;this.yaw=yaw;this.pitch=-4;   // a jump to a new spot looks level, whatever the spawn view was
    this.clearNearest();
    this.placeCamera(this.player.entity.getPosition());
    return true;
  }
  leaveRoom() {
    if(this.place==='town')return false;
    this.tidyLoose();
    this.resetInput();
    if(this.seated)this.stand();
    const left=this.rooms.get(this.place);
    left.root.enabled=false;this.place='town';this.fitCamera();
    // Step out away from the front wall: a building turned round faces north, not south.
    const building=this.data.buildings.find(b=>b.id===left.data?.building);
    const face=(building?.rotation??0)===180?-1:1;
    // Back at the height you went in at: the word hall's door is up on its terrace.
    const y=this.exitPoint?.y??0;
    // One step further out than where you went in, unless that step is into something.
    if(this.exitPoint){const {x,z}=this.exitPoint,out=z+face*.6;this.player.entity.setPosition(x,y,this.canMove(x,out,y)?out:z);}
    this.playerY=y;this.velocityY=0;this.grounded=true;
    this.yaw=this.exitYaw!==undefined?this.exitYaw+180:180;this.pitch=-4;this.clearNearest();
    this.placeCamera(this.player.entity.getPosition());
    return true;
  }
  bind(canvas) {
    this.canvas=canvas;
    addEventListener('keydown',e=>{
      if(this.paused||isTyping(e.target)||e.isComposing)return;
      // Keys go through the player's bindings (core/keys.js); the arrows always walk too.
      // Any bound key, so a rebound Space or Enter never also clicks a focused HUD button.
      if(e.code.startsWith('Arrow')||KEY_ACTIONS.some(a=>isKey(e,a.id)))e.preventDefault();
      this.keys.add(normalCode(e.code));
      // Sitting down takes over the jump key, so you can always get up again.
      if(isKey(e,'jump')&&this.seated){this.stand();return;}
      if(isKey(e,'drop')&&this.toys.held){this.toys.drop();return;}
      if(isKey(e,'interact')&&this.nearest)this.onInteract(this.nearest.id);
      if(isKey(e,'view'))this.setView(this.view==='first'?'third':'first');
      if(isKey(e,'collect')&&this.looking)this.onCollect?.(this.looking);
      // Edge-triggered so a quick tap between frames still counts.
      if(isKey(e,'jump')&&this.grounded&&!this.ghost&&!this.seated){this.velocityY=JUMP;this.grounded=false;}
      if(this.ghost){
        if(isKey(e,'rotate'))this.rotatePlacement();
        if(isKey(e,'cancel')){const item=this.ghost.item;this.cancelPlacement();this.onPlace?.({status:'cancelled',item});}
      }
    });
    addEventListener('keyup',e=>this.keys.delete(normalCode(e.code)));
    addEventListener('blur',()=>{this.resetInput();this.freshLock=true;});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.resetInput();this.freshLock=true;}});
    document.addEventListener('focusin',e=>{if(isTyping(e.target))this.resetInput();});
    // Mouse look uses pointer lock; touch look is a drag, with a left-side thumbstick for walking.
    //
    // Two different things make a raw movementX feel like a jump. The browser hands you one
    // enormous delta as pointer lock engages, or after the window has been away — that one is an
    // artefact and is thrown out. Separately, when a frame runs long the browser coalesces
    // several real moves into a single event; that is genuine input, so it is kept but spent
    // over the next few frames instead of teleporting the view.
    addEventListener('mousemove',e=>{
      if(!this.locked()||this.paused||document.hidden)return;
      const dx=e.movementX||0,dy=e.movementY||0;
      const now=performance.now(),gap=now-(this.lastMove??now);
      this.lastMove=now;
      if(this.freshLock||gap>420){
        this.freshLock=false;
        if(Math.abs(dx)>360||Math.abs(dy)>360)return;
      }
      queueLook(this.lookPending,dx,dy);
    });
    document.addEventListener('pointerlockchange',()=>{
      this.freshLock=this.locked();
      this.resetInput();
      this.onLockChange?.(this.locked());
    });
    // Losing the pointer silently is what makes the view feel stuck: the cursor runs into the
    // edge of the screen and the world simply stops turning. Say so, and take it back.
    document.addEventListener('pointerlockerror',()=>{this.onLockChange?.(false);});
    canvas.addEventListener('pointerdown',e=>{
      if(this.paused)return;
      if(e.pointerType==='mouse'){
        if(this.ghost&&this.locked()){this.tryPlace();return;}
        if(this.toys.held&&this.locked()){this.throwHeld();return;}
        this.requestLook();return;
      }
      // A touch on the thumbstick walks, even while placing; anywhere else it puts the piece down.
      const stickZone=e.clientX<innerWidth*.42&&e.clientY>innerHeight*.45;
      if(this.ghost&&!stickZone){this.tryPlace();return;}
      if(this.toys.held){this.throwHeld();return;}
      if(stickZone){this.stick.id=e.pointerId;this.stick.ox=e.clientX;this.stick.oy=e.clientY;}
      else{this.drag.id=e.pointerId;this.drag.x=e.clientX;this.drag.y=e.clientY;}
      try{canvas.setPointerCapture?.(e.pointerId);}catch{}   // ignore ids the browser will not capture
    });
    canvas.addEventListener('pointermove',e=>{
      if(this.paused)return;
      if(e.pointerId===this.drag.id){this.lookBy((e.clientX-this.drag.x)*1.5,(e.clientY-this.drag.y)*1.5);this.drag.x=e.clientX;this.drag.y=e.clientY;}
      else if(e.pointerId===this.stick.id){
        const dx=e.clientX-this.stick.ox,dy=e.clientY-this.stick.oy,limit=58,len=Math.hypot(dx,dy)||1,scale=Math.min(len,limit)/limit/len;
        this.stick.dx=dx*scale;this.stick.dz=dy*scale;
      }
    });
    const release=e=>{
      if(e.pointerId===this.drag.id)this.drag.id=null;
      if(e.pointerId===this.stick.id){this.stick.id=null;this.stick.dx=this.stick.dz=0;}
    };
    canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
  }
  locked() {return document.pointerLockElement===this.canvas;}
  requestLook() {
    if(this.paused||this.locked())return;
    // Browsers throttle a lock request made straight after an exit, so a refusal is not fatal.
    try{const p=this.canvas?.requestPointerLock?.();if(p&&p.catch)p.catch(()=>{});}catch{}
  }
  releaseLook() {if(this.locked())document.exitPointerLock?.();}
  lookBy(dx,dy) {
    if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
    this.yaw=(this.yaw-dx*this.sensitivity)%360;
    this.pitch=Math.max(-85,Math.min(85,this.pitch-dy*this.sensitivity));
  }
  /** Spend the accumulated mouse movement, so one coalesced burst reads as a turn, not a cut. */
  drainLook(dt) {
    const delta=drainLook(this.lookPending,dt);
    this.lookBy(delta.x,delta.y);
  }
  resetInput(){
    this.keys.clear();this.drag.id=null;this.stick.id=null;this.stick.dx=this.stick.dz=0;
    this.lookPending.x=this.lookPending.y=0;this.lastMove=null;
    this.velocity={x:0,z:0};   // warps, doors, pauses and a hidden tab all stop the slide
  }
  applyView() {
    const first=this.view==='first';
    // From your own eyes you see your legs, not your chest: a torso at this scale fills the
    // bottom of the screen the moment you look down.
    this.player.head.enabled=!first;
    this.player.upper.enabled=!first;
    if(this.player.pack)this.player.pack.enabled=!first;
    for(const leg of this.player.legs)leg.setLocalScale(first?.84:1,1,first?.84:1);
    this.camera.camera.fov=first?70:46;
  }
  /** Third person needs room to swing the camera; a shop floor has none, so it stays off. */
  thirdPersonAllowed() {
    const data=this.rooms.get(this.place)?.data;
    return this.place==='town'||!!data?.decoratable||!!data?.outdoor;
  }
  setView(mode) {
    const want=mode==='third'?'third':'first';
    if(want==='third'&&!this.thirdPersonAllowed()){
      this.onNotice?.('这里地方太小，第三人称视角不可用。 / Not enough room in here for third person.');
      return this.view;
    }
    this.view=want;this.applyView();return this.view;
  }
  facing() {const r=this.yaw*Math.PI/180;return {fx:-Math.sin(r),fz:-Math.cos(r),rx:Math.cos(r),rz:-Math.sin(r)};}
  placeCamera(pos) {
    this.camera.setEulerAngles(this.pitch,this.yaw,0);
    if(this.sleeping){this.camera.setPosition(this.sleeping.eye);return;}
    if(this.view==='first'){this.camera.setPosition(pos.x,pos.y+this.eyeHeight,pos.z);return;}
    const yr=this.yaw*Math.PI/180,pr=this.pitch*Math.PI/180,cos=Math.cos(pr);
    const dx=-Math.sin(yr)*cos,dy=Math.sin(pr),dz=-Math.cos(yr)*cos;
    // Pull the camera in until it stops sitting inside a building, sign or wall.
    let distance=1.2;
    for(let d=5.8;d>1.2;d-=.4){if(this.canMove(pos.x-dx*d,pos.z-dz*d)){distance=d;break;}}
    this.camera.setPosition(pos.x-dx*distance,Math.max(.7,pos.y+1.55-dy*distance),pos.z-dz*distance);
  }
  setPaused(value) {
    if(value)this.cancelPlacement();
    this.paused=value;this.resetInput();
    clearTimeout(this.relockTimer);
    // Opening a panel while in mouse-look should give the mouse back when the panel closes —
    // otherwise you are left looking at a world that will not turn until you click it again.
    // If the cursor was already free, it stays free, so the buttons stay clickable.
    // A pause straight after another ends (a panel closing into the hop into bed) keeps that promise.
    if(value){this.relock||=this.locked();this.releaseLook();}
    else if(this.relock)this.relockTimer=setTimeout(()=>{this.relock=false;this.requestLook();},200);
  }
  /** Closest spot within a few metres that is not inside anything. */
  nearestFreeSpot(x,z) {
    for(let radius=.5;radius<=5;radius+=.5){
      for(let i=0;i<16;i++){
        const angle=i/16*Math.PI*2;
        const px=x+Math.cos(angle)*radius,pz=z+Math.sin(angle)*radius;
        if(this.canMove(px,pz))return {x:px,z:pz};
      }
    }
    return null;
  }
  /** Inside the paving of a district, or the four walls of a room. Geometry only, no hitboxes. */
  withinPlace(place,x,z,edge=.42) {
    if(place==='town')return this.inAnyDistrict(x,z);
    const room=this.rooms.get(place);
    if(!room)return false;
    const [w,d]=room.data.size,lx=x-room.offsetX;
    // 云海 is several stretches of ground (city.json `walk`), not one rectangle.
    if(room.data.walk)return onCityGround(room.data.walk,lx,z,edge);
    if(Math.abs(lx)>w/2-edge)return false;
    // A district has an edge all the way round; a room has a doorway in one wall of it.
    if(room.data.outdoor)return Math.abs(z)<=d/2-edge;
    if(z<-d/2+edge)return false;
    // The doorway gap is the one place the front wall opens up.
    return !(z>d/2-edge&&!(Math.abs(lx)<.7&&z<d/2+.9));
  }
  canMove(x,z,feetY=this.playerY) {
    if(!this.withinPlace(this.place,x,z))return false;
    const room=this.rooms.get(this.place);
    if(feetY<1.9&&(room?.staff??[]).some(s=>Math.hypot(x-room.offsetX-s.x,z-s.z)<.86))return false;
    if(feetY<1.9&&this.visitors.blocks(this.place,x,z,this.player.entity.getPosition()))return false;
    if(feetY<1.9&&this.crowd?.blocks(this.place,x,z,this.player.entity.getPosition()))return false;
    return !this.registry.blocks(this.place,x,z,feetY);
  }
  // --- things you can pick up -------------------------------------------
  /** Every basket, rack and case that has stock a player could lift out of it. */
  buildContainers() {
    this.containers=[];
    const add=(place,fitting,x,z,zh)=>{
      if(!fitting.stock?.length)return;
      this.containers.push(new Container({place,slots:fitting.stock,x,z,zh}));
    };
    for(const prop of this.props)add('town',prop,prop.x,prop.z,NAMES[prop.kind==='fruitstand'?'fruit':'box']?.zh??'东西');
    for(const room of this.rooms.values())
      for(const fitting of room.fittings??[])
        add(room.id,fitting,room.offsetX+fitting.x,fitting.z,NAMES[fitting.name??'box']?.zh??'东西');
  }
  /** Lift one piece of stock out of a container. It is a toy, never inventory. */
  takeFrom(index) {
    const container=this.containers[index];
    const slot=container&&container.take(container.ready(),this.clock);
    if(!slot)return null;
    const spot=slot.entity.getPosition();
    const body=this.toys.spawn({parent:this.toyRoot,place:container.place,shape:slot.shape,
      size:slot.size,color:slot.color,x:spot.x,y:spot.y,z:spot.z,name:slot.kind});
    this.toys.take(body);
    return body;
  }
  grabLoose() {
    const pos=this.player.entity.getPosition();
    return this.toys.take(this.toys.nearest(this.place,pos.x,pos.z,this.playerY+1));
  }
  throwHeld() {
    if(!this.toys.held)return null;
    const forward=this.camera.forward;
    const body=this.toys.hurl({fx:-forward.x,fy:-forward.y,fz:-forward.z},9.5);
    this.onThrow?.(body);
    return body;
  }
  update(dt) {
    if(document.hidden){this.resetInput();return;}
    dt=Math.min(dt,.05);this.clock+=dt;this.drainLook(dt);
    const pos=this.player.entity.getPosition();
    const {fx,fz,rx,rz}=this.facing();let moving=false;
    if(this.sleeping)this.stepSleep(dt);
    if(!this.paused&&!this.seated) {
      // Walking is relative to where the tourist is looking, not to the world axes.
      const held=(action,arrow)=>this.keys.has(codeOf(action))||this.keys.has(arrow)?1:0;
      const advance=held('forward','ArrowUp')-held('back','ArrowDown')-this.stick.dz;
      const strafe=held('right','ArrowRight')-held('left','ArrowLeft')+this.stick.dx;
      const {forward,side}=inputWish(advance,strafe);
      let dx=fx*forward+rx*side,dz=fz*forward+rz*side;
      const len=Math.hypot(dx,dz);
      let x=pos.x,z=pos.z;
      const trapped=this.registry.blocks(this.place,x,z,this.playerY);
      if(trapped){
        // Already inside something: step towards open ground rather than freezing.
        const out=this.nearestFreeSpot(x,z);
        if(out){
          const ox=out.x-x,oz=out.z-z,distance=Math.hypot(ox,oz)||1,step=Math.min(distance,4*dt);
          x+=ox/distance*step;z+=oz/distance*step;moving=true;
        }
        this.velocity={x:0,z:0};
      } else {
        // Momentum: a short run-up and a short slide, a wall takes the speed that hits it.
        const cap=(this.keys.has('ShiftLeft')?7:4.5)*this.speedScale,walk=len>.02;
        const v=stepVelocity(this.velocity,walk?{x:dx/len,z:dz/len}:{x:0,z:0},walk?cap*Math.min(1,len):0,this.grounded,dt,cap);
        if(this.canMove(x+v.x*dt,z))x+=v.x*dt;else v.x=0;
        if(this.canMove(x,z+v.z*dt))z+=v.z*dt;else v.z=0;
        this.velocity=v;moving=Math.hypot(v.x,v.z)>.2;
      }
      // Gravity, with a step up onto kerbs and benches and a jump to reach the rest.
      this.velocityY-=GRAVITY*dt;
      const vertical=this.registry.moveVertical(this.place,x,z,this.playerY,this.playerY+this.velocityY*dt);
      this.playerY=vertical.y;this.grounded=vertical.grounded;
      if(vertical.grounded||vertical.ceiling)this.velocityY=0;
      this.player.entity.setPosition(x,this.playerY,z);
    }
    if(!this.sleeping)this.player.entity.setEulerAngles(0,(this.seated?this.seated.bodyYaw:this.yaw)+180,0);
    if(moving){
      restIdle(this.player);
      this.player.legs.forEach((leg,i)=>leg.setLocalEulerAngles(Math.sin(this.clock*12+i*Math.PI)*23,0,0));
      this.player.arms.forEach((arm,i)=>arm.setLocalEulerAngles(Math.sin(this.clock*12+i*Math.PI)*-18,0,0));
    } else if(!this.seated&&!this.sleeping) animateIdle(this.player,dt);
    this.daylight.advance(dt);
    this.lightRoom();
    this.updatePlacement();
    if(this.place==='town'){
      for(const [,actor]of this.actors){const p=actor.entity.getPosition();actor.entity.setLocalPosition(p.x,Math.sin(this.clock*1.3+p.x)*.025,p.z);animateIdle(actor,dt);}
      for(const one of this.people){one.entity.setLocalPosition(one.x,Math.sin(this.clock*1.1+one.x)*.022,one.z);animateIdle(one,dt);}
    } else {
      for(const one of this.rooms.get(this.place)?.people??[]){
        one.entity.setLocalPosition(one.x,Math.sin(this.clock*1.1+one.x)*.022,one.z);animateIdle(one,dt);
      }
    }
    this.walkStaff(dt);
    if(!this.paused)this.visitors.update(dt);   // hold still while a panel is open: you may be talking to one
    if(this.place==='city')for(const part of this.rooms.get('city').parts)part.update?.(dt,this.paused);
    for(const container of this.containers)if(container.place===this.place)container.tick(this.clock);
    this.market.update(dt,{hour:this.daylight.hour,place:this.place,offCamera:(x,z)=>this.offCamera(x,z)});
    // The one pushing the cart is its stall keeper, not just anybody.
    const role=id=>id==='person'?'vendor':id;
    this.market.syncHitboxes(this.registry,id=>({id:role(id),...NAMES[role(id)]}));
    for(const material of this.market.claimLamps())this.market.onLit?.(material);
    this.dayMarket.update(dt,{hour:this.daylight.hour,place:this.place,offCamera:(x,z)=>this.offCamera(x,z)});
    this.dayMarket.syncHitboxes(this.registry,id=>({id:role(id),...NAMES[role(id)]}));
    for(const material of this.dayMarket.claimLamps())this.dayMarket.onLit?.(material);
    this.toys.update(dt,this.place);
    this.water.update(dt,this);   // every pond, stream, fountain and the bay: one update a frame
    if(this.toys.held){
      const forward=this.camera.forward,eye=this.camera.getPosition();
      this.toys.carry(eye,{fx:-forward.x,fy:-forward.y,fz:-forward.z});
    }
    // Prefer whatever the tourist is actually looking at; anything at arm's length still counts.
    const here=this.player.entity.getPosition();let nearest=null,best=Infinity;
    for(const t of this.targets()) {
      const d=Math.hypot(here.x-t.x,here.z-t.z);
      if(d>t.radius||(d>=best&&!t.aimed))continue;
      const aim=d<1e-3?1:((t.x-here.x)/d)*fx+((t.z-here.z)/d)*fz;
      if(d>1.3&&aim<(t.wide?.1:.35))continue;
      nearest=t;best=t.aimed?-1:d;   // a person looked at in range beats anything merely nearer
    }
    if(nearest?.id!==this.nearest?.id){this.nearest=nearest;this.onNear(nearest);}
  }
  /** Runs after movement and before the frame is drawn. */
  lateUpdate(){
    if(document.hidden)return;
    this.placeCamera(this.player.entity.getPosition());
    const eye=this.camera.getPosition(),forward=this.camera.forward;
    this.syncMovingLooks();
    const seen=this.paused?null:this.registry.look(this.place,eye,forward);
    const name=seen?.box.name??null;
    // Two cups on two tables share a name but not a box: a new box is a new thing to point at.
    if(seen?.box!==this.lookingBox){this.lookingBox=seen?.box;this.looking=name;this.onLook?.(name);}
    this.views.update();
    this.onFrame?.(this);
  }
  /** Waiters pace a fixed loop, so the room feels staffed without needing pathfinding. */
  walkStaff(dt) {
    if(this.place==='town')return;
    const room=this.rooms.get(this.place);
    for(const member of room.staff??[]){
      if(member.wait>0){
        member.wait-=dt;
        animateIdle(member,dt);
        continue;
      }
      const [tx,tz]=member.path[member.target];
      const dx=tx-member.x,dz=tz-member.z,distance=Math.hypot(dx,dz);
      if(distance<.12){member.target=(member.target+1)%member.path.length;member.wait=1.4+Math.random()*2.6;restIdle(member);continue;}
      const step=Math.min(distance,member.speed*dt);
      const from={x:room.offsetX+member.x,z:member.z};
      const to={x:from.x+dx/distance*step,z:from.z+dz/distance*step};
      const others=(room.staff??[]).filter(s=>s!==member).map(s=>({x:room.offsetX+s.x,z:s.z}));
      const player=this.player.entity.getPosition();others.push({x:player.x,z:player.z,radius:.34});
      if(!walkClear(this.registry,this.place,from,to,others)){
        member.blocked=(member.blocked??0)+dt;
        if(member.blocked>2){member.target=(member.target+1)%member.path.length;member.blocked=0;}
        restIdle(member);animateIdle(member,dt);continue;
      }
      member.blocked=0;member.x=to.x-room.offsetX;member.z=to.z;
      member.leg+=dt*7;
      member.entity.setLocalPosition(member.x,0,member.z);
      // The model's face looks down its own +z, so the heading is atan2 with no half turn added.
      member.entity.setLocalEulerAngles(0,Math.atan2(dx,dz)*180/Math.PI,0);
      member.legs.forEach((leg,i)=>leg.setLocalEulerAngles(Math.sin(member.leg+i*Math.PI)*21,0,0));
      member.arms.forEach((arm,i)=>arm.setLocalEulerAngles(Math.sin(member.leg+i*Math.PI)*-16,0,0));
      animateIdle(member,dt,true);
    }
  }
  /** Indoors the daylight comes through the windows; after dark you need your own lamps. */
  lightRoom() {
    if(this.place==='town')return;
    const room=this.rooms.get(this.place),day=1-(this.daylight.state?.lamps??0);
    // A shop that is open keeps its lights on; only your own home waits for a lamp you bought.
    for(const lamp of room.ceilings??[])lamp.light.intensity=room.data.decoratable?.18+day*.85:1.03;
    if(room.sun)room.sun.light.intensity=.9*day;
    for(const prop of room.props.values()){
      if(prop.entity.lampLight)prop.entity.lampLight.light.intensity=(1-day)*(prop.entity.lampReach??2.4);
    }
  }
  /** True when a spot is behind the camera or off the edges of the screen — safe to build there. */
  offCamera(x,z,margin=140) {
    const point=this.screen(x,1.4,z);
    return point.z<=0||point.x<-margin||point.x>innerWidth+margin||point.y<-margin||point.y>innerHeight+margin;
  }
  screen(x,y,z) {return this.camera.camera.worldToScreen(new pc.Vec3(x,y,z));}
  /** Apply worn clothing: a hat appears, a shirt or trousers recolour the model. */
  equip(worn) {
    const outfit=typeof worn==='string'?{hat:worn}:(worn??{});
    this.player.hat.enabled=!!outfit.hat;
    if(outfit.hatColor)for(const part of this.player.hatBrim)part.render.meshInstances[0].material=this.m.material(outfit.hatColor);
    const shirt=outfit.shirtColor??'#e9bb78',trousers=outfit.trousersColor??'#435653';
    this.player.torso.render.meshInstances[0].material=this.m.material(shirt);
    this.player.collar.render.meshInstances[0].material=this.m.material(shirt);
    for(const arm of this.player.arms)arm.limb.render.meshInstances[0].material=this.m.material(shirt);
    for(const leg of this.player.legs)leg.limb.render.meshInstances[0].material=this.m.material(trousers);
    const shoes=outfit.shoesColor??'#eee0c2';
    for(const leg of this.player.legs)leg.shoe.render.meshInstances[0].material=this.m.material(shoes);
  }
  moveLayout(kind,id,x,z) {
    const list=kind==='npc'?this.data.npcs:this.data.buildings;const def=list.find(x=>x.id===id);if(!def||def.x===x&&def.z===z)return;
    def.x=x;def.z=z;const entity=kind==='npc'?this.actors.get(id).entity:this.buildings.get(id);
    // A building is part of the static batch, which would keep drawing it where it was.
    for(const render of entity.findComponents('render'))render.batchGroupId=-1;
    entity.setPosition(x,0,z);
  }
}
