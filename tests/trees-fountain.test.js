import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as pc from 'playcanvas';
import {FOUNTAIN,FOUNTAIN_MARK,FOUNTAIN_LOOKS,fountainLevel,jetArc} from '../src/world/fountain.js';
import {createModels} from '../src/world/models.js';
import {PINE_TIERS} from '../src/world/jiangnan-nature.js';
import {GRAVITY,JUMP} from '../src/core/movement.js';

// Trees in four kinds and the square's flowing fountain
// (docs/superpowers/plans/2026-09-25-development-wave.md, D6-trees-fountain).
const load=f=>JSON.parse(readFileSync(new URL(`../src/content/${f}.json`,import.meta.url),'utf8'));
const world=load('world'),objects=load('objects').objects,garden=load('garden');
const KINDS=['tree','willow','ginkgo','osmanthus'];

test('every street tree is one of the four kinds, each named in objects.json',()=>{
  for(const [x,z,kind='tree'] of world.trees){
    assert.ok(KINDS.includes(kind),`tree at ${x},${z} has kind ${kind}`);
    assert.ok(objects[kind],`objects.json names ${kind}`);
  }
  for(const kind of KINDS)assert.ok(world.trees.some(([,,k='tree'])=>k===kind),`at least one ${kind}`);
  for(const kind of ['willow','ginkgo','osmanthus'])assert.equal(objects[kind].hsk,null,`${kind} carries no unverified HSK level`);
});

test('willows stand near water: within 3 m of the park pond',()=>{
  const gap=(s,x,z)=>s.r!==undefined?Math.hypot(x-s.x,z-s.z)-s.r
    :Math.hypot(Math.max(s.x0-x,0,x-s.x1),Math.max(s.z0-z,0,z-s.z1));
  for(const [x,z] of world.trees.filter(([,,k])=>k==='willow'))
    assert.ok(Math.min(...garden.pond.map(s=>gap(s,x,z)))<=3,`willow at ${x},${z}`);
});

test('the fountain sound is full beside it and fades out with distance',()=>{
  assert.equal(fountainLevel(0),1);
  assert.equal(fountainLevel(2),1);
  assert.equal(fountainLevel(16),0);
  assert.equal(fountainLevel(40),0);
  for(let d=0;d<16;d+=.5)assert.ok(fountainLevel(d+.5)<=fountainLevel(d),`quieter at ${d+.5} than ${d}`);
  assert.deepEqual(FOUNTAIN,{x:0,z:1.8});
});

test('a jet arc leaves its spout and lands where it is aimed',()=>{
  const from=[1.66,.7],to=[1.15,.56],{c,hr,vr,sector}=jetArc(...from,...to,.55);
  const at=deg=>{const a=deg*Math.PI/180;return [c+hr*Math.cos(a),from[1]+vr*Math.sin(a)];};
  const close=([a,b],[x,y])=>assert.ok(Math.abs(a-x)<1e-9&&Math.abs(b-y)<1e-9,`${a},${b} vs ${x},${y}`);
  close(at(0),from);
  close(at(sector),to);
  assert.ok(Math.abs(at(90)[1]-(from[1]+.55))<1e-9,'it rises by the given height');
});

// A headless PlayCanvas app (null graphics device) is enough to build a tree and inspect its meshes.
function models(){
  const canvas={width:1,height:1,style:{},addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:1,height:1})};
  const app=new pc.AppBase(canvas),opts=new pc.AppOptions();
  opts.graphicsDevice=new pc.NullGraphicsDevice(canvas);opts.componentSystems=[pc.RenderComponentSystem];app.init(opts);
  return createModels(app);
}
const meshes=(m,kind)=>{const root=new pc.Entity();m.tree(root,0,0,1,kind);const out=[];root.forEach(e=>{if(e.render)out.push(e.render);});return out;};

test('a pine is a conifer: tiers of flat pads, no round leaf balls, and it is named 松树',()=>{
  // Drawn in the Jiangnan look (task W5-nature): its pads follow PINE_TIERS, merged into a canopy mesh.
  const m=models(),parts=meshes(m,'pine');
  assert.ok(PINE_TIERS.length>=3,'at least three tiers of pads');
  assert.ok(parts.some(r=>r.entity.name==='canopy'),'a canopy');
  assert.equal(parts.filter(r=>r.type==='sphere').length,0,'no leaf balls');
  assert.equal(m.tree(new pc.Entity(),0,0,1,'pine').lookName,'pine');
});

test('a willow keeps its shadow casters few: the hanging curtain casts none',()=>{
  const casters=meshes(models(),'willow').filter(r=>r.castShadows).length;
  assert.ok(casters<=6,`${casters} shadow casters`);
});

test('nobody can jump into or onto the fountain',()=>{
  const apex=JUMP**2/(2*GRAVITY),planter=.9;   // the tallest street furniture you could jump from
  assert.ok(FOUNTAIN_MARK.radius>=2.12,'the mark covers the whole basin');
  assert.equal(FOUNTAIN_MARK.y0,0);
  assert.ok(FOUNTAIN_MARK.y1>apex+planter,`top ${FOUNTAIN_MARK.y1} is out of reach of a ${apex.toFixed(2)} m jump from a planter`);
});

test('the fountain is named only where its stone is: the tall collision drum is not a look',()=>{
  assert.equal(FOUNTAIN_MARK.name,undefined,'the collision drum carries no name');
  const [basin,...stack]=FOUNTAIN_LOOKS;
  assert.deepEqual([basin.radius,basin.y0],[FOUNTAIN_MARK.radius,0]);
  assert.ok(basin.y1<1,'the basin look stops at the rim');
  for(const part of stack){
    assert.ok(part.radius<=1.05,'the column and bowls are much narrower than the basin');
    assert.ok(part.y1<=FOUNTAIN_MARK.y1,'and no taller than the drum');
  }
  for(let i=1;i<FOUNTAIN_LOOKS.length;i++)assert.equal(FOUNTAIN_LOOKS[i].y0,FOUNTAIN_LOOKS[i-1].y1,'stacked without gaps');
});
