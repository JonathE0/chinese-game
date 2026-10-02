import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import MODELS from '../src/content/models.json' with {type:'json'};
import {SURFACES} from '../src/world/look.js';
import {modelMaterial} from '../src/world/assets.js';

// The Blender models (task W5-blender, src/world/assets.js, scripts/blender): every file models.json
// lists is there and keeps the conventions the loader relies on.
const gltf=file=>{const b=readFileSync(new URL('../public/models/'+file,import.meta.url));assert.equal(b.toString('ascii',0,4),'glTF');return JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));};

test('every model is built, uses only known materials and stands at real scale on its origin', () => {
  for(const [name,{file,places}] of Object.entries(MODELS.models)){
    assert.ok(existsSync(new URL('../public/models/'+file,import.meta.url)),`${file}: run npm run models`);
    assert.ok(Array.isArray(places),name);
    const g=gltf(file);
    for(const m of g.materials)assert.ok(MODELS.materials[m.name],`${name}: material "${m.name}" not in models.json`);
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for(const mesh of g.meshes)for(const p of mesh.primitives){
      for(const a of ['POSITION','NORMAL','TEXCOORD_0','COLOR_0'])assert.ok(a in p.attributes,`${name}: no ${a}`);
      const pos=g.accessors[p.attributes.POSITION];
      for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],pos.min[i]);hi[i]=Math.max(hi[i],pos.max[i]);}
    }
    assert.ok(Math.abs(lo[1])<.002,`${name}: its base is at y=0 (${lo[1]})`);
    for(const i of [0,2])assert.ok(Math.abs(lo[i]+hi[i])<.06,`${name}: centred on its origin`);
    const size=Math.max(...hi.map((h,i)=>h-lo[i]));
    assert.ok(size>.05&&size<4,`${name}: metres, not centimetres (${size})`);
  }
});

test('glTF materials become the game\'s: painted surfaces tiled in metres, glaze, glow, plain if unknown', () => {
  for(const [name,how] of Object.entries(MODELS.materials))if(how.surface)assert.ok(SURFACES[how.surface],`${name}: no surface ${how.surface}`);
  const wood=modelMaterial('wood',{surface:'wood'});
  assert.ok(wood.diffuseVertexColor&&!wood.vertexColorGamma,'linear vertex colours');
  assert.equal(wood.diffuseMapTiling.x,1/SURFACES.wood.metres);
  assert.equal(modelMaterial('ceramic',{gloss:.62}).gloss,.62);
  assert.ok(modelMaterial('silk',{surface:'cloth',glow:'#c8402f'}).emissiveVertexColor);
  const warn=console.warn;let warned='';console.warn=m=>{warned=m;};
  try{assert.equal(modelMaterial('Material.001').diffuseMap,null);}finally{console.warn=warn;}
  assert.match(warned,/Material\.001/);
});
