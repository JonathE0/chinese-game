import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Registry} from '../src/world/registry.js';
import {sceneryMarks,shoreline,inAny} from '../src/core/garden.js';

// 河边文化街 moved west of the fountain, out of its old hiding place behind the word hall
// (docs/superpowers/plans/2026-09-24-west-quarter-and-scenery.md, Task W): every riverside thing
// shifted by x -40, z +42, and the gate became the one lane in the square's west edge, between
// 青禾银行 and 家居小铺.
const load=f=>JSON.parse(readFileSync(new URL(`../src/content/${f}.json`,import.meta.url),'utf8'));
const world=load('world'),rooms=load('rooms'),quests=load('quests');
const district=id=>world.districts.find(d=>d.id===id);
const building=id=>world.buildings.find(b=>b.id===id);
const inside=(d,x,z)=>x>=d.bounds.x[0]&&x<=d.bounds.x[1]&&z>=d.bounds.z[0]&&z<=d.bounds.z[1];
/** A building's footprint. Every building involved here stands square on, rotated 0 or 180. */
const footprint=b=>({x:[b.x-b.width/2,b.x+b.width/2],z:[b.z-b.depth/2,b.z+b.depth/2]});

test('the riverside lies west of the square, its gate on the shared edge x -22',()=>{
  const r=district('riverside');
  assert.deepEqual(r.bounds,{x:[-59,-22],z:[-13,11]});
  assert.equal(district('square').bounds.x[0],-22,'the square starts where the riverside ends');
  assert.deepEqual(r.gate,{x:-22,z:-1.5,axis:'x',half:12.5,requires:{level:2,words:30},span:1.4});
  // buildGates runs a wall from the gate out to `half` each way: it must cover the whole edge.
  assert.ok(r.gate.z-r.gate.half<=r.bounds.z[0],'wall reaches the south corner');
  assert.ok(r.gate.z+r.gate.half>=r.bounds.z[1],'wall reaches the north corner');
});

test('the gate opening is a clear lane between the bank and the homeware shop',()=>{
  const g=district('riverside').gate;
  const bank=footprint(building('bank-branch')),home=footprint(building('homeware'));
  assert.deepEqual([bank.z[1],home.z[0]],[-3.5,0.5],'the gap in the square\'s west side');
  // The opening is the door hitbox, g.z ± span, and it leaves paving either side of it.
  assert.ok(g.z-g.span-bank.z[1]>=.6,'clear of 青禾银行');
  assert.ok(home.z[0]-(g.z+g.span)>=.6,'clear of 家居小铺');
  assert.ok(g.x<=bank.x[0]&&g.x<=home.x[0],'the gate stands outside both shop fronts');
  // The wall runs the whole edge, so it must stand clear of every square building beside it.
  for(const b of world.buildings.filter(b=>b.district==='square')){
    const f=footprint(b);
    if(f.z[1]>g.z-g.half&&f.z[0]<g.z+g.half&&f.x[0]<g.x+2)assert.ok(f.x[0]-g.x>=1,b.id+' touches the gate wall');
  }
  // Nothing stands in the lane mouth, the strip between the two shops.
  const inLane=(x,z)=>x>-22&&x<home.x[1]&&z>bank.z[1]&&z<home.z[0];
  for(const one of [...world.props,...world.people])
    assert.ok(!inLane(one.x,one.z),JSON.stringify(one));
  for(const [x,z] of world.trees)assert.ok(!inLane(x,z),`tree at ${x},${z}`);
});

test('everything riverside moved by x -40, z +42, and nothing was left behind',()=>{
  const r=district('riverside');
  for(const b of world.buildings.filter(b=>b.district==='riverside')){
    const f=footprint(b);
    for(const x of f.x)for(const z of f.z)assert.ok(inside(r,x,z),b.id);
  }
  for(const list of [world.props,world.people,world.ground,world.npcs])
    for(const one of list.filter(o=>o.district==='riverside'))assert.ok(inside(r,one.x,one.z),JSON.stringify(one));
  // Trees carry no district, so the old quarter must be empty of them and the new one planted.
  assert.equal(world.trees.filter(([,z])=>z<-19).length,0,'no tree left in the old riverside');
  assert.equal(world.trees.filter(([x,z])=>inside(r,x,z)).length,7);
  // Named landmarks, so a prop left on its old spot cannot hide inside the bounds.
  assert.deepEqual([building('restaurant').x,building('restaurant').z],[-51,1]);
  assert.deepEqual([building('bank').x,building('bank').z],[-29,1]);
  assert.deepEqual([building('pharmacy').x,building('pharmacy').z],[-40,-7]);
  // The old pond gave way to the lotus canal (Task S), between the restaurant and the post office.
  const [c]=world.scenery.find(d=>d.kind==='waterEdge'&&d.district==='riverside').channel;
  assert.ok(c.x0>building('restaurant').x+4&&c.x1<building('bank').x-4,'canal between the two');
});

test('the restaurant door and its mission moved with the building',()=>{
  const restaurant=building('restaurant');
  assert.deepEqual(rooms.restaurant.door,{x:-51,z:4.1});
  assert.equal(rooms.restaurant.door.x,restaurant.x);
  assert.equal(rooms.restaurant.door.z,restaurant.z+restaurant.depth/2+.1,'door on the front');
  const mission=quests.quests.find(q=>q.where?.district==='riverside');
  assert.deepEqual([mission.where.x,mission.where.z],[-51,4.1]);
});

// The quarter as a walled Suzhou garden (Task S): a lotus canal down the middle between the
// restaurant and the post office, two arched stone bridges, covered walkways along both banks and
// across the pharmacy front, and white lattice walls round the three outer sides.
const scenery=(world.scenery??[]).filter(d=>d.district==='riverside');
const canal=scenery.find(d=>d.kind==='waterEdge');
const sceneryBoxes=scenery.flatMap(d=>sceneryMarks(d,world.buildings));
const overlap=(m,x0,x1,z0,z1)=>{const hw=m.radius??m.hw,hd=m.radius??m.hd;return m.x+hw>x0&&m.x-hw<x1&&m.z+hd>z0&&m.z-hd<z1;};
/** The town's own collision for the quarter: buildings as registerBuilding marks them, trees, and the scenery. */
function quarter(dry=false){
  const r=new Registry(),R=district('riverside');
  for(const b of world.buildings.filter(b=>b.district==='riverside'))
    r.add({place:'town',x:b.x,z:b.z,hw:b.width/2+.35,hd:b.depth/2+.35,y0:0,y1:b.height+1.4});
  for(const [x,z] of world.trees.filter(([x,z])=>inside(R,x,z))){
    r.add({place:'town',x,z,radius:.98,y0:0,y1:.35});r.add({place:'town',x,z,radius:.22,y0:.35,y1:2.4});
  }
  for(const m of sceneryBoxes.filter(m=>!dry||m.name!=='water'))r.add({place:'town',...m,solid:m.solid!==false});
  return r;
}

test('the canal is water you cannot step into, crossed by two arched bridges you walk over',()=>{
  const r=quarter(),[c]=canal.channel;
  assert.ok(r.blocks('town',(c.x0+c.x1)/2,4,0),'the water stops you');
  for(const b of canal.bridges){
    let x=-44.5,y=0,peak=0;
    while(x<-35.6){
      const nx=x+.05;
      if(r.blocks('town',nx,b.z,y))break;
      x=nx;y=r.moveVertical('town',x,b.z,y,y-.08).y;peak=Math.max(peak,y);
    }
    assert.ok(x>=-35.6,`${b.id} stopped at x ${x.toFixed(2)}`);
    assert.ok(peak>=1&&peak<=1.2,`${b.id} crest ${peak}`);
    for(let i=1;i<b.steps.length;i++)assert.ok(Math.abs(b.steps[i][2]-b.steps[i-1][2])<=.3+1e-9,`${b.id} step ${i}`);
    for(const [x0,x1,top] of b.steps)if(x1>c.x0&&x0<c.x1)assert.ok(top>=canal.water.top,`${b.id} dips into the water at ${x0}`);
  }
});

// The same numbers src/world/town.js jumps with (and tests/garden.test.js hops with).
const JUMP=6.4,GRAVITY=19;
function hop(r,x,z,dx,dz,wet,y=0){
  let vy=JUMP,grounded=false;const dt=1/60,speed=7;
  for(let i=0;i<120;i++){
    if(grounded){vy=JUMP;grounded=false;}
    if(!r.blocks('town',x+dx*speed*dt,z,y))x+=dx*speed*dt;
    if(!r.blocks('town',x,z+dz*speed*dt,y))z+=dz*speed*dt;
    vy-=GRAVITY*dt;
    const v=r.moveVertical('town',x,z,y,y+vy*dt);y=v.y;grounded=v.grounded;
    if(v.grounded||v.ceiling)vy=0;
    if(grounded&&wet(x,z,y))return `${x.toFixed(2)},${z.toFixed(2)} y ${y.toFixed(2)}`;
  }
  return null;
}

test('jumping at the canal from its banks or off a bridge crest never lands you on the water',()=>{
  // Standing on the water: the canal's water box holds you up somewhere under your footprint (the
  // player's radius), not only under your centre. Everything else is somewhere to land.
  const r=quarter(),dry=quarter(true),wet=(x,z,y)=>y>.05&&dry.groundAt('town',x,z,y+.01)<y-.01,landed=[];
  for(const p of shoreline(canal.channel,1.5))for(const side of [-1,1]){
    const nx=Math.cos(p.angle)*side,nz=Math.sin(p.angle)*side,sx=p.x+nx*1.1,sz=p.z+nz*1.1;
    if(inAny(canal.channel,sx,sz)||r.blocks('town',sx,sz,0))continue;
    for(const turn of [-.5,0,.5]){const a=Math.atan2(-nz,-nx)+turn,l=hop(r,sx,sz,Math.cos(a),Math.sin(a),wet);if(l)landed.push('bank '+l);}
  }
  // Each corner of the canal, and the two spots under the walkways where a corner hop used to work.
  const [c]=canal.channel,starts=[[-42.3,-2.3],[-36,-3.5]];
  for(const [x,z,ox,oz] of [[c.x0,c.z0,-1,-1],[c.x1,c.z0,1,-1],[c.x0,c.z1,-1,1],[c.x1,c.z1,1,1]])starts.push([x+ox*.8,z+oz*.8]);
  for(const [sx,sz] of starts){
    if(r.blocks('town',sx,sz,0))continue;
    for(let k=0;k<16;k++){const a=k/16*Math.PI*2,l=hop(r,sx,sz,Math.cos(a),Math.sin(a),wet);if(l)landed.push(`from ${sx},${sz}: ${l}`);}
  }
  for(const b of canal.bridges)for(const dz of [-1,1]){const l=hop(r,-40,b.z,0,dz,wet,1.2);if(l)landed.push(b.id+' '+l);}
  assert.deepEqual(landed,[]);
});

test('the scenery keeps the lane, the gate and every door clear, and stands in no building',()=>{
  const g=district('riverside').gate,lane=[g.x-2.6,g.x+.3,g.z-g.span,g.z+g.span];
  const solid=[...sceneryBoxes,...world.scenery.filter(d=>d.kind==='veranda').flatMap(d=>sceneryMarks(d,world.buildings))].filter(m=>m.solid!==false&&m.y0<1.8);
  for(const m of solid)assert.ok(!overlap(m,...lane),`${m.name} at ${m.x},${m.z} is in the lane`);
  for(const b of world.buildings){
    const face=(b.rotation??0)===180?-1:1,front=b.z+face*b.depth/2,far=front+face*1.6;
    const door=[b.x-.9,b.x+.9,Math.min(front,far),Math.max(front,far)];
    const body=[b.x-b.width/2-.35,b.x+b.width/2+.35,b.z-b.depth/2-.35,b.z+b.depth/2+.35];
    for(const m of solid){
      assert.ok(!overlap(m,...door),`${m.name} at ${m.x},${m.z} blocks the door of ${b.id}`);
      if(m.group!==b.id)assert.ok(!overlap(m,...body),`${m.name} at ${m.x},${m.z} stands in ${b.id}`);
    }
  }
});

test('from the gate you reach every door in the quarter on foot, over the canal or round it',()=>{
  const r=quarter(),R=district('riverside'),[X0,X1]=R.bounds.x,[Z0,Z1]=R.bounds.z,step=.25;
  const W=Math.round((X1-X0)/step)+1,H=Math.round((Z1-Z0)/step)+1,seen=new Uint8Array(W*H);
  const cell=(x,z)=>[Math.round((x-X0)/step),Math.round((z-Z0)/step)],at=(i,j)=>j*W+i;
  const free=(x,z)=>x>X0+.42&&x<X1&&z>Z0+.42&&z<Z1-.42&&!r.blocks('town',x,z,0);
  let frontier=[cell(-22.5,R.gate.z)];seen[at(...frontier[0])]=1;
  while(frontier.length){
    const next=[];
    for(const [i,j] of frontier)for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const a=i+di,b=j+dj;
      if(a<0||b<0||a>=W||b>=H||seen[at(a,b)]||!free(X0+a*step,Z0+b*step))continue;
      seen[at(a,b)]=1;next.push([a,b]);
    }
    frontier=next;
  }
  for(const b of world.buildings.filter(b=>b.district==='riverside'))
    assert.ok(seen[at(...cell(b.x,b.z+b.depth/2+1))],`the door of ${b.id}`);
});

test('no corner of the canal leaves a gap to stand on the water\'s edge',()=>{
  // As in tests/garden.test.js: the water box under part of your (square) footprint, your centre on
  // dry land, and no fence post in the way.
  const r=quarter(),dry=quarter(true),[c]=canal.channel,top=canal.water.top,perch=[];
  for(const [cx,cz] of [[c.x0,c.z0],[c.x1,c.z0],[c.x0,c.z1],[c.x1,c.z1]])
    for(let x=cx-.7;x<=cx+.7;x+=.02)for(let z=cz-.7;z<=cz+.7;z+=.02){
      if(inAny(canal.channel,x,z))continue;
      if(r.groundAt('town',x,z,top+.01)<top-.01||dry.groundAt('town',x,z,top+.01)>=top-.01)continue;
      if(!r.blocks('town',x,z,top))perch.push(`${x.toFixed(2)},${z.toFixed(2)}`);
    }
  assert.deepEqual(perch,[]);
});
