import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {Ripples,RIPPLES,RIPPLE_LIFE,waterOf} from '../src/world/water.js';
import {Toybox} from '../src/world/physics.js';
import {Registry} from '../src/world/registry.js';
import {buildBay,reflect,BAY} from '../src/world/bay.js';
import {createModels} from '../src/world/models.js';

// Flowing, reacting water and the bay's reflection (docs/superpowers/plans/2026-09-26-development-wave-2.md, H-water).

// A headless PlayCanvas app (null graphics device) is enough to make materials, cameras and layers.
function app(){
  const canvas={width:800,height:600,style:{},addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})};
  const a=new pc.AppBase(canvas),opts=new pc.AppOptions();
  opts.graphicsDevice=new pc.NullGraphicsDevice(canvas);
  opts.componentSystems=[pc.RenderComponentSystem,pc.CameraComponentSystem,pc.LightComponentSystem];opts.batchManager=pc.BatchManager;
  a.init(opts);
  return a;
}

test('the ripple pool never grows: a new ring takes a free slot, else the oldest',()=>{
  const pool=new Ripples(),length=pool.data.length;
  for(let i=0;i<RIPPLES;i++){pool.add(i,0);pool.step(.1);}
  assert.equal(pool.active,RIPPLES);
  const slot=pool.add(99,99);
  assert.equal(slot,0,'the oldest ring gives way');
  for(let i=0;i<50;i++)pool.add(i,i,.5);
  assert.equal(pool.data.length,length);
  assert.equal(pool.active,RIPPLES);
  pool.step(RIPPLE_LIFE+.01);
  assert.equal(pool.active,0,'every ring fades out');
  assert.equal(pool.add(1,2),0,'and its slot is free again');
});

test('the water under a point is the highest body there, and nothing where it stands dry',()=>{
  const water=waterOf(app());
  water.body('town',[{x:0,z:0,r:2}],.5);                       // a fountain's pool
  water.body('town',[{x:0,z:0,r:1}],1.5);                      // and its bowl
  water.body('town',[{x0:10,x1:20,z0:0,z1:4}],.1,(x,z)=>x>14&&x<16);   // a canal with a bridge
  assert.equal(water.levelAt('town',1.5,0),.5);
  assert.equal(water.levelAt('town',.2,.2),1.5,'the bowl above the pool');
  assert.equal(water.levelAt('town',12,2),.1);
  assert.equal(water.levelAt('town',15,2),null,'under the bridge it is dry');
  assert.equal(water.levelAt('city',12,2),null,'another place');
  assert.equal(water.levelAt('town',5,5),null);
});

test('standing on the bank, the water laps just past the edge; not from afar or from a bridge',()=>{
  const water=waterOf(app()),spot={x:0,z:0};
  water.body('town',[{x0:0,x1:10,z0:0,z1:4}],.1);
  assert.equal(water.edge('town',5,0,4.6,spot),true);
  assert.ok(Math.abs(spot.x-5)<1e-9&&spot.z<4&&spot.z>3.5,`${spot.x},${spot.z}`);
  assert.equal(water.edge('town',5,0,6,spot),false,'too far from the edge');
  assert.equal(water.edge('town',5,1,2,spot),false,'over the water');
  assert.equal(water.edge('town',5,8,4.6,spot),false,'high above it');
});

test('a thrown thing lands in the water: one splash, and it floats at the surface',()=>{
  const splashes=[],toys=new Toybox({registry:new Registry(),models:{shape:()=>new pc.Entity()}});
  toys.surfaceAt=(place,x,z)=>x>0?.1:null;
  toys.onSplash=body=>splashes.push(body);
  const body=toys.spawn({parent:new pc.Entity(),place:'town',x:-1,y:2,z:0});
  body.vx=2;
  for(let i=0;i<120;i++)toys.update(1/60,'town');
  assert.equal(splashes.length,1);
  assert.ok(Math.abs(body.y-(.1+body.radius*.3))<1e-6,`floats at ${body.y}`);
});

/** A city root with its bay, as Town#ensureCity builds it; `early` runs first, as buildCity does. */
function bayCity(early=()=>{}){
  const a=app(),models=createModels(a);
  const camera=new pc.Entity('camera');camera.addComponent('camera',{farClip:500,toneMapping:pc.TONEMAP_ACES});a.root.addChild(camera);
  const sun=new pc.Entity('sun');sun.addComponent('light',{type:'directional'});a.root.addChild(sun);
  const town={app:a,camera,sun,m:models,reflections:true};
  const root=new pc.Entity('city');root.setLocalPosition(-4000,0,0);a.root.addChild(root);
  const made=early(root,models);
  const part=buildBay(town,root);
  return {a,models,camera,sun,town,part,mirror:part.mirror,made};
}

test('reflect(): still things join the reflection batch group, moving things its layer',()=>{
  // The skyline is reflected while the city is built, before its statics are batched ...
  const {a,models,camera,sun,town,part,mirror,made:skyline}=bayCity((root,models)=>reflect(models.box(root,[0,20,-200],[10,40,10],'#445566')));
  const group=a.batcher.addGroup('city-scenery',false);
  skyline.render.batchGroupId=group.id;   // as Town#batchStatics does
  part.update();
  assert.equal(skyline.render.batchGroupId,mirror.group.id);
  assert.deepEqual(mirror.group.layers,[pc.LAYERID_WORLD,mirror.layer.id],'drawn in the world and in the mirror');
  // ... and the drones, which move, after.
  const drones=models.box(skyline.parent,[0,50,-100],[1,1,1],'#ffffff');drones.noBatch=true;reflect(drones);
  assert.equal(drones.render.batchGroupId,-1);
  assert.ok(drones.render.layers.includes(mirror.layer.id)&&drones.render.layers.includes(pc.LAYERID_WORLD));
  // Lit by the sun as the world is, and tone-mapped once only, by the water that shows it.
  assert.ok(sun.light.layers.includes(mirror.layer.id),'the sun lights what the mirror draws');
  assert.equal(mirror.camera.camera.toneMapping,pc.TONEMAP_LINEAR);
  // The mirror only draws while the bay is in view, from above the water, and while it is wanted,
  // through the same haze as the player's view.
  camera.setPosition(-4000,2,-40);camera.setEulerAngles(0,0,0);   // looking north, over the bay
  camera.camera.camera.updateFrustum();
  const haze=Object.assign(new pc.FogParams(),{type:pc.FOG_LINEAR,start:140,end:500});camera.camera.fog=haze;
  part.update();
  assert.equal(mirror.camera.camera.enabled,true);
  assert.equal(mirror.camera.camera.fog,haze);
  town.reflections=false;part.update();
  assert.equal(mirror.camera.camera.enabled,false,'水面倒影 off');
});

test("the mirror's near plane is the water: NDC z is -1 on it, and just under it is clipped",()=>{
  const {camera,mirror}=bayCity();
  camera.setPosition(-3970,1.62,-46.5);camera.setEulerAngles(-6,0,0);   // on the promenade, looking out
  const projection=new pc.Mat4(),view=new pc.Mat4();
  mirror.project(projection);mirror.camera.camera.calculateTransform(view);view.invert();
  const vp=new pc.Mat4().mul2(projection,view),ndc=(x,y,z)=>{const v=new pc.Vec4(x,y,z,1);vp.transformVec4(v,v);return v.z/v.w;};
  assert.ok(Math.abs(ndc(-3970,BAY.level,-70)+1)<1e-4,'on the water');
  assert.ok(ndc(-3970,BAY.level-.1,-70)<-1,'0.1 m under it');
  const tower=ndc(-3980,40,-200);
  assert.ok(tower>-1&&tower<1,`a tower across the bay is drawn: ${tower}`);
});
