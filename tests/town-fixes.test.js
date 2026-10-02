import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Registry} from '../src/world/registry.js';
import {rotatedHalf} from '../src/world/navigation.js';
import {sceneryMarks} from '../src/core/garden.js';

// The town fixes of the 2026-09-25 development wave (Task D5-town-fixes): a clear west lane, the
// tea stall off the tea-house door, the guesthouse door opening onto a proper walk to the square, and
// city lamps on the kerb instead of in the middle of the pavement.
const load=f=>JSON.parse(readFileSync(new URL(`../src/content/${f}.json`,import.meta.url),'utf8'));
const world=load('world'),rooms=load('rooms'),city=load('city'),quests=load('quests'),tutorial=load('tutorial');
const building=id=>world.buildings.find(b=>b.id===id);
const standing=()=>[...world.props,...world.people,...world.npcs,
  ...world.trees.map(([x,z])=>({x,z,kind:'tree'})),...world.ambient.map(([x,z])=>({x,z,kind:'chat'}))];

test('the walk from the fountain west to the riverside gate is a straight, clear lane',()=>{
  const gate=world.districts.find(d=>d.id==='riverside').gate;
  // The lane's paving between 青禾银行 and 家居小铺, carried east as far as the fountain side.
  const inLane=({x,z})=>x>gate.x&&x<-7&&z>gate.z-1.1&&z<gate.z+1.1;
  for(const one of standing())assert.ok(!inLane(one),`${one.kind??one.id} at ${one.x},${one.z}`);
});

test('the tea-house door opens onto clear paving: 林阿姨 and her stall stand beside it',()=>{
  const b=building('tea-house'),front=b.z+b.depth/2;
  const atDoor=({x,z})=>Math.abs(x-b.x)<2.4&&z>front&&z<front+3.2;
  for(const one of standing())assert.ok(!atDoor(one),`${one.kind??one.id} at ${one.x},${one.z}`);
  const lin=world.npcs.find(n=>n.id==='lin');
  assert.ok(lin.x>b.x+b.width/2,'林阿姨 keeps her stall by the tea-house\'s east wall');
});

test('小小商店 opens onto clear paving too: 陈叔叔 and his counter stand beside it',()=>{
  const b=building('souvenir-house'),front=b.z+b.depth/2;
  const atDoor=({x,z})=>Math.abs(x-b.x)<2.4&&z>front&&z<front+3.2;
  for(const one of standing())assert.ok(!atDoor(one),`${one.kind??one.id} at ${one.x},${one.z}`);
  const chen=world.npcs.find(n=>n.id==='chen');
  assert.ok(chen.x<b.x-b.width/2,'陈叔叔 keeps his counter by the shop\'s west wall');
});

test('every map marker for 林阿姨 and 陈叔叔 points at where they stand',()=>{
  const at={林阿姨:world.npcs.find(n=>n.id==='lin'),陈叔叔:world.npcs.find(n=>n.id==='chen')};
  const markers=[...(quests.quests??quests),...(tutorial.steps??tutorial)].map(q=>q.where).filter(Boolean);
  let seen=0;
  for(const w of markers)for(const [name,npc] of Object.entries(at))if(w.zh.includes(name)){
    seen++;assert.deepEqual([w.x,w.z],[npc.x,npc.z],w.zh);
  }
  assert.ok(seen>=3,'the greet, souvenir and tutorial talk markers');
});

/** The square's own collision, as registerTown marks it: buildings, verandas, trees, street props,
 *  people and the two stall counters in front of 林阿姨 and 陈叔叔. */
function square(){
  const r=new Registry(),models=readFileSync(new URL('../src/world/models.js',import.meta.url),'utf8');
  const halves={};
  for(const m of models.matchAll(/if\(kind==='([a-z]+)'\)[\s\S]*?return \{entity:e,half:\[([-\d.]+),([-\d.]+)\],top:([\d.]+)/g))halves[m[1]]=[+m[2],+m[3],+m[4]];
  for(const b of world.buildings.filter(b=>!b.bespoke&&!b.site))
    r.add({place:'town',x:b.x,z:b.z,hw:b.width/2+.35,hd:b.depth/2+.35,y0:0,y1:b.height+1.4});
  for(const m of world.scenery.filter(d=>d.kind==='veranda').flatMap(d=>sceneryMarks(d,world.buildings)))r.add({place:'town',...m});
  for(const [x,z] of world.trees){r.add({place:'town',x,z,radius:.22,y0:.35,y1:2.4});r.add({place:'town',x,z,radius:1.5,y0:1.55,y1:4.3});}
  for(const p of world.props){
    const [hw,hd,top]=halves[p.kind]??[.4,.4,.8],[w,d]=rotatedHalf([hw,hd],p.rot??0);
    r.add({place:'town',x:p.x,z:p.z,hw:w,hd:d,y0:0,y1:top});
  }
  for(const p of [...world.people,...world.npcs])r.add({place:'town',x:p.x,z:p.z,hw:.52,hd:.48,y0:0,y1:1.95});
  for(const id of ['lin','chen']){const n=world.npcs.find(n=>n.id===id);r.add({place:'town',x:n.x,z:n.z+1.3,hw:1.75,hd:.7,y0:0,y1:1.5});}
  return r;
}
/** Metres walked on the shortest four-way 0.25 m grid path between two points, or Infinity. */
function walk(r,[x0,z0],[x1,z1]){
  const st=.25,X=-24,Z=-32,W=200,H=210,dist=new Int32Array(W*H).fill(-1),c=(x,z)=>[Math.round((x-X)/st),Math.round((z-Z)/st)];
  const [si,sj]=c(x0,z0),[ti,tj]=c(x1,z1);let fr=[[si,sj]];dist[sj*W+si]=0;
  while(fr.length){const nx=[];for(const [i,j] of fr)for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const I=i+a,J=j+b;if(I<0||J<0||I>=W||J>=H||dist[J*W+I]>=0||r.blocks('town',X+I*st,Z+J*st,0))continue;
    dist[J*W+I]=dist[j*W+i]+1;nx.push([I,J]);}fr=nx;}
  return dist[tj*W+ti]<0?Infinity:dist[tj*W+ti]*st;
}

// Wave 2 (Task X-exterior) turned 青禾银行 round: it used to face north into the corner behind the
// tea-house, reached down a side alley. Now its columned front faces south onto the west lane, the
// street from the fountain to 河边文化街.
test('青禾银行\'s door opens onto the west lane, a straight walk from the square with nothing in the way',()=>{
  const b=building('bank-branch'),door=rooms.bank.door,front=b.z+b.depth/2;
  assert.equal(b.rotation??0,0,'the front faces south, onto the lane');
  assert.deepEqual([door.x,door.z],[b.x,front+.1],'the door point is at the middle of the front');
  const where=quests.quests.find(q=>q.id==='teahouse-permit').where;
  assert.ok(Math.abs(where.x-b.x)<=b.width/2&&Math.abs(where.z-b.z)<=b.depth/2,'the permit marker points at the bank');
  // Clear paving in front of the steps, between the two lions.
  const approach=({x,z})=>Math.abs(x-b.x)<1.1&&z>front&&z<front+2.4;
  for(const one of standing())assert.ok(!approach(one),`${one.kind??one.id} at ${one.x},${one.z}`);
  // From the lane's mouth by the square you stand a step out from the door in about the straight
  // line (7.7 m on the grid); the old way round the tea-house was 14 m.
  const d=walk(square(),[-11,-2],[door.x,door.z+.7]);
  assert.ok(d<=9,`${d} m`);
});

test('the guesthouse door opens north onto the open lane that runs east into the square',()=>{
  const b=building('guesthouse'),door=rooms.guesthouse.door,front=b.z-b.depth/2;
  assert.equal(b.rotation,180,'the front faces north, away from the garden wall');
  assert.ok(door.z<front-.5&&door.z>front-1.6&&Math.abs(door.x-b.x)<.01,JSON.stringify(door));
  // Out to 3.5 m from the front, and all the way east from the door to the square, is clear paving.
  const homeware=building('homeware');
  assert.ok(front-(homeware.z+homeware.depth/2)>=4.5,'a proper walk, not a squeeze, in front of the door');
  const approach=({x,z})=>z<front&&z>front-3.5&&x>b.x-1.4&&x<-14;
  for(const one of standing())assert.ok(!approach(one),`${one.kind??one.id} at ${one.x},${one.z}`);
});

test('云海\'s lamps stand clear of every walking line: pavements, the boulevard\'s walks, the square, 美食街, the park\'s paths and the lit path',async()=>{
  const {promenadeZ}=await import('../src/core/city.js');
  // A pole's hitbox reaches 0.3 m round it (a promenade lamp's 0.2 m). The pavements run from the
  // line of lamps and planters (x ±8.35) to the colonnades at ±11.2; the boulevard's walks run either
  // side of its pools, inside its trees; the park's paths are laid into its lawn (city.json `pattern`).
  const p=city.promenade;
  const lines=[[-11.2,-8.35,-34,23],[8.35,11.2,-34,23],[-3.9,-1.6,-30,23],[1.6,3.9,-30,23],[-2,2,23,38],[-96,-26,43,45],[-96,-26,49,51],
    ...city.pattern.filter(one=>Array.isArray(one)&&one[2]>=62).map(([x0,x1,z0,z1])=>[x0,x1,z0,z1])];
  const inside=(one,r,[ax,bx,az,bz])=>one.x+r>ax&&one.x-r<bx&&one.z+r>az&&one.z-r<bz;
  for(const one of city.props.filter(one=>['citylamp','promenadelamp'].includes(one.kind))){
    const r=one.kind==='promenadelamp'?.2:.3;
    for(const line of lines)assert.ok(!inside(one,r,line),`${one.kind} at ${one.x},${one.z} stands in [${line}]`);
    if(one.kind==='promenadelamp'&&one.z<p.z[1])
      assert.ok(Math.abs(one.z-promenadeZ(p,one.x))>p.path.width/2+r,`${one.kind} at ${one.x},${one.z} stands on the lit path`);
  }
});
