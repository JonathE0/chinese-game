import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {personLook,buildPerson,HAIR} from '../src/world/people.js';
import data from '../src/content/people.json' with {type:'json'};
import npcs from '../src/content/npcs.json' with {type:'json'};
import garden from '../src/content/garden.json' with {type:'json'};

// The people of src/content/people.json, built by src/world/people.js with a stand-in for models.js
// that keeps each mesh's block list instead of drawing it.
const kit={
  blocks:(parent,name,list,surface)=>{const e=new pc.Entity(name);e.render={};e.list=list;e.surface=surface;parent.addChild(e);return e;},
  reblock:(e,list)=>{e.list=list;},
  box:parent=>{const e=new pc.Entity('box');parent.addChild(e);return e;},
};
const build=(archetype,variant=0,extra={})=>{
  const look=personLook(0,{archetype,props:true,...extra});
  look.colours={...look.colours,...data.archetypes[archetype].colours[variant]};
  return buildPerson(kit,new pc.Entity('root'),[0,0,0],false,look);
};
const meshes=p=>{const out=[];p.entity.forEach(e=>{if(e.list)out.push(e);});return out;};
const HEX=/^#[0-9a-f]{6}$/i;

test('every archetype is complete: a build, hair and clothes the builder knows, every colour it wears defined and valid',()=>{
  for(const [id,a] of Object.entries(data.archetypes)){
    assert.ok(data.builds[a.build],`${id} build`);
    assert.ok(HAIR[a.hair],`${id} hair`);
    assert.ok(a.colours.length>=1,`${id} colours`);
    for(const [v,colours] of a.colours.entries()){
      for(const [slot,hex] of Object.entries(colours))assert.match(hex,HEX,`${id} variant ${v} ${slot}`);
      const p=build(id,v),parts=meshes(p);
      assert.equal(parts.length,10,`${id}: ten merged meshes (a thigh and a shin each side)`);
      for(const part of parts)for(const [at,size,[hex]] of part.list){
        assert.ok(HEX.test(hex)&&hex!=='#ff00ff',`${id} variant ${v} ${part.name} wears a colour it has`);
        assert.ok([...at,...(size.p??size)].every(Number.isFinite),`${id} ${part.name}: a block placed and sized`);
      }
    }
  }
  for(const hex of [...data.skins,...Object.values(data.colours)])assert.match(hex,HEX);
});

test('the builds are measured off the sheets: grown-ups about 1.7 to 1.95 m, children shorter with bigger heads for their size',()=>{
  const height=id=>data.builds[data.archetypes[id].build].chin+build(id).top;
  for(const id of Object.keys(data.archetypes)){
    const h=height(id),kid=['girl','boy','v-girl','v-boy'].includes(id);
    assert.ok(h<=1.95,`${id} stays under the 1.95 m look box (${h.toFixed(3)})`);
    assert.ok(kid?h>1.2&&h<1.55:h>1.7,`${id} height ${h.toFixed(3)}`);
  }
  const share=id=>{const b=data.builds[data.archetypes[id].build];return data.head[1]*(b.head??1)/height(id);};
  for(const kid of ['girl','boy'])for(const grown of ['young-man','young-woman','grandpa'])assert.ok(share(kid)>share(grown)*1.15,`${kid}'s head is bigger for their size than ${grown}'s`);
  assert.ok(Math.abs(build('tourist').seatDrop-.66)<.02);        // the player sits about as deep as before
  assert.ok(build('girl').seatDrop<build('young-man').seatDrop);   // a child's hips are lower
});

test('a seed is always the same person; seed 0 is the first of everything; the village mix has no children and no props',()=>{
  assert.deepEqual(personLook(7),personLook(7));
  assert.deepEqual(personLook('lin'),personLook('lin'));
  const first=personLook(0);
  assert.equal(first.archetype,Object.keys(data.mixes.village.weights)[0]);
  assert.equal(first.skin,data.skins[0]);
  const sample=(mix,n=300)=>Array.from({length:n},(_,i)=>personLook(i+1,{mix}));
  const village=sample('village'),street=sample('village-street'),city=sample('city-crowd');
  assert.deepEqual(new Set(village.map(l=>l.archetype)),new Set(Object.keys(data.mixes.village.weights)));
  assert.ok(village.every(l=>!l.props.length),'shop and stall keepers have their hands free');
  assert.ok(street.some(l=>l.archetype==='v-girl')&&street.some(l=>l.archetype==='v-boy'),'children in the street');
  assert.ok(street.some(l=>l.props.length),'townsfolk carry their things');
  assert.ok(city.every(l=>!l.archetype.startsWith('v-')),'Yunhai has city people');
  assert.ok(city.some(l=>l.archetype==='girl'),'children in the city crowd');
  assert.ok(new Set(village.map(l=>l.colours.top)).size>=6,'colour variants');
  for(const mix of Object.values(data.mixes))for(const [id,w] of Object.entries(mix.weights))assert.ok(data.archetypes[id]&&w>0,id);
});

test('named townsfolk keep their look: 林阿姨 a bun, 小美 a bob, 陈叔叔 a side part, 周叔叔 short grey hair and glasses',()=>{
  const want={lin:['auntie','bun'],mei:['v-young-woman','bob'],chen:['v-young-man','side'],zhou:['v-grandpa','short']};
  for(const [id,[archetype,style]] of Object.entries(want)){
    const npc=npcs.find(n=>n.id===id),look=personLook(id,{...npc.look,top:npc.color});
    assert.equal(look.archetype,archetype,id);assert.equal(look.style,style,id);
    assert.equal(look.hair,npc.look.hair,id);assert.equal(look.colours.top,npc.color,id);
    assert.equal(look.skin,personLook(id).skin,`${id} keeps the skin of their seed`);
  }
  assert.equal(personLook('zhou',npcs.find(n=>n.id==='zhou').look).hat,null,'周叔叔 shows his hair');
  assert.ok(data.archetypes['v-grandpa'].extras.includes('glasses'));
});

test('the park has a child flying the kite, and its people are archetypes that exist',()=>{
  const L=garden.life;
  assert.ok(['v-girl','v-boy'].includes(L.kite.look.archetype));
  for(const look of [...L.taichi.looks,...L.xiangqi.looks,L.calligraphy.look,L.kite.look])assert.ok(data.archetypes[look.archetype],look.archetype);
  assert.equal(L.taichi.looks.length,L.taichi.people.length);
});

test('dress repaints the clothes and puts back the archetype colour of anything left out',()=>{
  const p=build('tourist'),torso=meshes(p).find(m=>m.name==='torso');
  const tops=()=>new Set(torso.list.map(([,,[hex]])=>hex));
  p.dress({top:'#4f7fa6'});assert.ok(tops().has('#4f7fa6'));
  p.dress({});assert.ok(!tops().has('#4f7fa6'));assert.ok(tops().has(data.archetypes.tourist.colours[0].top));
});

test('sitting: grown-ups have hips on the seat and feet on the floor, children swing their feet, and standing undoes it',()=>{
  const q=new pc.Quat(),v=new pc.Vec3();
  // The lowest point of a mesh's blocks in the world, turns and all.
  const lowest=part=>{const m=part.getWorldTransform();let lo=Infinity;
    for(const [at,size,,turn=0] of part.list){if(size.p)continue;q.setFromEulerAngles(...(typeof turn==='number'?[0,0,turn]:turn));
      for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]){
        q.transformVector(v.set(sx*size[0]/2,sy*size[1]/2,sz*size[2]/2),v);v.x+=at[0];v.y+=at[1];v.z+=at[2];m.transformPoint(v,v);lo=Math.min(lo,v.y);}}
    return lo;};
  for(const id of Object.keys(data.archetypes)){
    const kid=['girl','boy','v-girl','v-boy'].includes(id);
    for(const height of [.45,.47,.5]){
      const p=build(id);p.entity.setLocalPosition(0,height-p.seatDrop,0);p.sit(height);
      for(const leg of p.legs){
        const hips=lowest(leg.limb),feet=lowest(leg.shoe);
        assert.ok(hips>height-.035&&hips<height+.01,`${id} on ${height}: thighs on the seat (${hips.toFixed(3)})`);
        assert.ok(kid?feet>.15:Math.abs(feet)<.035,`${id} on ${height}: feet ${kid?'swinging':'on the floor'} (${feet.toFixed(3)})`);
        assert.ok(leg.knee.getPosition().z>leg.getPosition().z+.15,`${id}: knees out in front`);
      }
      p.stand();
      for(const leg of p.legs)assert.deepEqual([leg.getLocalEulerAngles().x,leg.knee.getLocalEulerAngles().x,leg.shin.getLocalPosition().y].map(n=>Math.round(n*1000)),[0,0,0]);
    }
  }
});
