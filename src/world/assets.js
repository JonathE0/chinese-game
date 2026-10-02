import * as pc from 'playcanvas';
import MODELS from '../content/models.json' with {type:'json'};
import {SURFACES,paint} from './look.js';
import {assetUrl} from '../services/asset-url.js';

/**
 * Models made in Blender (task W5-blender): the .glb files in public/models, built headless by
 * `npm run models` from the recipes in scripts/blender/recipes and listed in src/content/models.json.
 *
 * Each file is one object in metres, its origin at the centre of its base, with one primitive per
 * material; its colour (with ambient occlusion baked in) is in its vertex colours and its UVs are in
 * metres. Here each glTF material name becomes the game's own material for it (models.json
 * `materials`): a vertex-colour material wearing one of look.js's painted surfaces, tiled at that
 * surface's scale, glossy or glowing as the entry says, and shared by every model, so copies batch.
 *
 * Nothing loads at start: a place asks for its models (`forPlace`) as it is built or entered, and each
 * file loads once however many places want it. A model that is missing or fails to load is warned
 * about and left out; it never stops the place from being built.
 */
export class Assets {
  constructor(app){this.app=app;this.loading=new Map();this.materials=new Map();}

  /** Model `name`'s loaded container, fetched once. A failed load is forgotten, so a later call tries again. */
  load(name){
    if(!this.loading.has(name)){
      const entry=MODELS.models[name],registry=this.app.assets,url=entry&&assetUrl('models/'+entry.file);
      const loaded=entry?new Promise((resolve,reject)=>registry.loadFromUrl(url,'container',(err,asset)=>{
        if(!err&&asset?.resource)return resolve(asset.resource);
        // Forget the failed asset as well, or the registry hands it back empty on the next try.
        const failed=asset??registry.getByUrl(url);if(failed)registry.remove(failed);
        reject(new Error(err?String(err):'nothing loaded'));
      })):Promise.reject(new Error('not in models.json'));
      loaded.catch(()=>this.loading.delete(name));
      this.loading.set(name,loaded);
    }
    return this.loading.get(name);
  }
  /** The container, or null with a warning if it can't be had. */
  ready(name){return this.load(name).catch(err=>{console.warn(`Model "${name}" left out: ${err.message}`);return null;});}
  /** Load every model a place uses (models.json `places`); resolves once all have loaded or failed. */
  forPlace(place){return Promise.all(Object.keys(MODELS.models).filter(name=>MODELS.models[name].places.includes(place)).map(name=>this.ready(name)));}

  /**
   * A copy of model `name` under `parent`, at `at`, turned `rot` (degrees), `scale` times its size;
   * null if it can't load. `batch`: a batch group id, so static copies merge with the place's batch.
   */
  async spawn(name,parent,{at=[0,0,0],rot=[0,0,0],scale=1,batch=null,shadows=true}={}){
    const container=await this.ready(name);if(!container)return null;
    const e=this.dress(container.instantiateRenderEntity({castShadows:shadows,receiveShadows:true}));
    e.name=name;e.setLocalPosition(...at);e.setLocalEulerAngles(...rot);e.setLocalScale(scale,scale,scale);
    if(batch!==null)for(const r of e.findComponents('render'))r.batchGroupId=batch;
    parent.addChild(e);
    return e;
  }
  /**
   * Many copies of model `name` drawn by the GPU in one call per material (hardware instancing):
   * `placements` [{at, rot, scale}] are relative to `parent`, which must not move afterwards. Null if
   * the model can't load. The copies are not culled one by one, so keep a set to one place.
   */
  async instances(name,parent,placements,{shadows=true}={}){
    const container=await this.ready(name);if(!container)return null;
    const root=this.dress(container.instantiateRenderEntity({castShadows:shadows,receiveShadows:true}));
    root.name=name+'-instances';
    const device=this.app.graphicsDevice,base=parent.getWorldTransform(),place=new pc.Mat4(),one=new pc.Mat4(),q=new pc.Quat(),v=new pc.Vec3(),s=new pc.Vec3();
    for(const r of root.findComponents('render'))for(const mi of r.meshInstances){
      const node=mi.node.getWorldTransform(),data=new Float32Array(placements.length*16);   // the part within the model
      placements.forEach(({at=[0,0,0],rot=[0,0,0],scale=1},i)=>{
        place.setTRS(v.set(...at),q.setFromEulerAngles(...rot),s.set(scale,scale,scale));
        one.mul2(base,place).mul(node);data.set(one.data,i*16);
      });
      mi.setInstancing(new pc.VertexBuffer(device,pc.VertexFormat.getDefaultInstancingFormat(device),placements.length,{data}));
    }
    parent.addChild(root);
    return root;
  }

  /** Swap a fresh copy's glTF materials for the game's. */
  dress(entity){
    for(const r of entity.findComponents('render'))for(const mi of r.meshInstances)mi.material=this.material(mi.material.name);
    return entity;
  }
  /** The game's material for a glTF material name (models.json `materials`); an unknown name is drawn plain. */
  material(name){
    if(!this.materials.has(name))this.materials.set(name,modelMaterial(name,MODELS.materials[name]));
    return this.materials.get(name);
  }
}

/** A vertex-colour material as models.json describes it: `surface` (a look.js SURFACES key), `gloss`, `glow`. */
export function modelMaterial(name,how){
  if(!how)console.warn(`Model material "${name}" is not in models.json; drawn plain`);
  const m=new pc.StandardMaterial();m.name='model-'+name;
  // Blender writes linear vertex colours, so no gamma step (the code-built kits store sRGB).
  Object.assign(m,{diffuseVertexColor:true,vertexColorGamma:false,useMetalness:true,metalness:0,gloss:how?.gloss??.1});
  // A glowing one is tinted and lit in its own colour, as the code-built lamps are (jiangnan.js lampMaterial).
  if(how?.glow)Object.assign(m,{diffuse:new pc.Color().fromString(how.glow),emissive:new pc.Color().fromString(how.glow),emissiveVertexColor:true,emissiveIntensity:.55});
  if(!how?.surface){m.update();return m;}
  const k=1/SURFACES[how.surface].metres;m.diffuseMapTiling=new pc.Vec2(k,k);
  return paint(m,how.surface);
}
