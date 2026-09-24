import test from 'node:test';
import assert from 'node:assert/strict';
import garden from '../src/content/garden.json' with {type:'json'};
import world from '../src/content/world.json' with {type:'json'};
import objects from '../src/content/objects.json' with {type:'json'};
import {gardenMarks,shoreline,inAny,inShape,isDisc,bridgeRails,balustrade} from '../src/core/garden.js';
import {Registry} from '../src/world/registry.js';

const park=world.districts.find(d=>d.id==='garden');
const [X0,X1]=park.bounds.x,[Z0,Z1]=park.bounds.z;
const marks=gardenMarks(garden);
const extent=m=>m.radius?[m.x-m.radius,m.x+m.radius,m.z-m.radius,m.z+m.radius]:[m.x-m.hw,m.x+m.hw,m.z-m.hd,m.z+m.hd];
const water=[...garden.pond,...garden.stream];

function registry(){
  const r=new Registry();
  for(const m of marks)r.add({place:'town',...m,solid:m.solid!==false,name:m.name?{id:m.name}:null});
  return r;
}

test('every park mark names a known object and stays inside the park',()=>{
  for(const m of marks){
    if(m.name)assert.ok(objects.objects[m.name],'unknown object '+m.name);
    const [x0,x1,z0,z1]=extent(m);
    assert.ok(x0>=X0-1e-9&&x1<=X1+1e-9&&z0>=Z0-1e-9&&z1<=Z1+1e-9,`mark ${m.name} at ${m.x},${m.z} leaves the park`);
  }
});

test('the teahouse lot is kept clear of anything solid',()=>{
  const lot=garden.reservedLot;
  for(const m of marks.filter(m=>m.solid!==false)){
    const [x0,x1,z0,z1]=extent(m);
    assert.ok(x1<=lot.x0||x0>=lot.x1||z1<=lot.z0||z0>=lot.z1,`${m.name} at ${m.x},${m.z} is in the lot`);
  }
  const [dx,dz]=lot.door;
  assert.ok(garden.paths.some(p=>inShape(p,dx,dz)),'a path reaches the lot door');
});

test('water is too high to step into and reaches below ground',()=>{
  for(const m of marks.filter(m=>m.name==='pond'||m.name==='stream')){
    assert.ok(m.y0<0);assert.ok(m.y1>=.6);assert.notEqual(m.solid,false);
  }
});

test('bridges climb in steps of at most 0.3, stay above the water and have rails',()=>{
  for(const b of garden.bridges){
    const tops=b.steps.map(s=>s[2]),is=garden.island;
    const landing=([z0,z1])=>[z0,z1].some(z=>Math.hypot(b.x-is.x,z-is.z)<is.r)?is.top:0;
    for(const s of [b.steps[0],b.steps.at(-1)])assert.ok(Math.abs(s[2]-landing(s))<=.3+1e-9,b.id+' end step');
    for(let i=1;i<tops.length;i++)assert.ok(Math.abs(tops[i]-tops[i-1])<=.3+1e-9,`${b.id} step ${i}`);
    for(let i=1;i<b.steps.length;i++)assert.equal(b.steps[i][0],b.steps[i-1][1],`${b.id} steps are contiguous`);
    for(const [z0,z1,top] of b.steps){
      let wet=false;
      for(let z=z0;z<=z1;z+=.1)for(let x=b.x-b.width/2;x<=b.x+b.width/2;x+=.1)if(inAny(water,x,z))wet=true;
      if(wet)assert.ok(top>=garden.water.top,`${b.id} step at ${z0} dips below the water`);
    }
    const crest=Math.max(...tops);
    if(!b.flat)assert.ok(crest>=1&&crest<=1.2,`${b.id} crest ${crest}`);
    const rails=bridgeRails(b);assert.equal(rails.length,2);
  }
});

test('the shoreline lies on the edge of the pond, not inside it',()=>{
  const points=shoreline(garden.pond,1);
  assert.ok(points.length>30);
  for(const p of points)assert.ok(!inAny(garden.pond,p.x,p.z,.05),`${p.x},${p.z} is inside the water`);
});

test('lotus and koi float in open water, clear of the island and the bridges',()=>{
  const is=garden.island;
  for(const l of [...garden.lotus,...garden.koi]){
    assert.ok(inAny(garden.pond,l.x,l.z,.4),`${l.x},${l.z} is not in the pond`);
    assert.ok(Math.hypot(l.x-is.x,l.z-is.z)>is.r+.5,`${l.x},${l.z} is on the island`);
    assert.ok(Math.abs(l.x)>1.6,`${l.x},${l.z} is under a bridge`);
  }
});

test('the island balustrade meets both bridges\' rails',()=>{
  const posts=balustrade(garden.island);
  for(const b of garden.bridges.filter(b=>!b.flat))for(const r of bridgeRails(b)){
    const end=Math.abs(r.z0-garden.island.z)<Math.abs(r.z1-garden.island.z)?r.z0:r.z1;
    const near=Math.min(...posts.map(p=>Math.hypot(p.x-r.x,p.z-end)));
    assert.ok(near<.6,`${b.id} rail at x ${r.x} ends ${near.toFixed(2)} from the balustrade`);
  }
});

test('on foot you reach the north bank, the mill and the lot door from the gate, but not the water',()=>{
  const r=registry(),step=.25,W=Math.round((X1-X0)/step)+1,H=Math.round((Z1-Z0)/step)+1;
  const edge=.42,free=(x,z)=>x>X0+edge&&x<X1-edge&&z>Z0-1&&z<Z1-edge&&!r.blocks('town',x,z,0);
  const seen=new Uint8Array(W*H),at=(i,j)=>j*W+i,cell=(x,z)=>[Math.round((x-X0)/step),Math.round((z-Z0)/step)];
  let frontier=[cell(0,19.5)];seen[at(...frontier[0])]=1;
  while(frontier.length){
    const next=[];
    for(const [i,j] of frontier)for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const a=i+di,b=j+dj;
      if(a<0||b<0||a>=W||b>=H||seen[at(a,b)]||!free(X0+a*step,Z0+b*step))continue;
      seen[at(a,b)]=1;next.push([a,b]);
    }
    frontier=next;
  }
  const reach=(x,z)=>!!seen[at(...cell(x,z))];
  assert.ok(reach(-6,25.2),'north bank');
  assert.ok(reach(-13.8,36.4),'beside the mill');
  assert.ok(reach(12.5,43),'the teahouse lot door');
  assert.ok(reach(0,42.6),'the foot of the south bridge');
  assert.equal(free(-5,30),false,'the pond');
  assert.equal(free(-16.4,43),false,'the stream');
  assert.equal(free(0,34),false,'the island from the water line');
});

test('walking the north bridge climbs over the crest and lands on the island',()=>{
  const r=registry();let z=25,y=0,peak=0;
  while(z<32){
    const nz=z+.05;
    if(r.blocks('town',0,nz,y))break;
    z=nz;
    y=r.moveVertical('town',0,z,y,y-.08).y;
    peak=Math.max(peak,y);
  }
  assert.ok(z>=32,`stopped at z ${z.toFixed(2)}`);
  assert.ok(peak>=1&&peak<=1.2,'crest '+peak);
  assert.ok(y>=.55&&y<=.85,'on the island at '+y);
});

// The same numbers src/world/town.js jumps with.
const JUMP=6.4,GRAVITY=19;
const island=garden.island;
// You stand on the water when a water box is what holds you up anywhere under your footprint (the
// registry's player radius), not only under your centre: a pond corner counts. Everything that is
// not water (bridges, the island, 荷风水榭's floor, the ground) is somewhere to land.
const dry=(()=>{const r=new Registry();for(const m of marks.filter(m=>m.name!=='pond'&&m.name!=='stream'))r.add({place:'town',...m,solid:m.solid!==false});return r;})();
const onWater=(x,z,y)=>y>.05&&dry.groundAt('town',x,z,y+.01)<y-.01;
/** Run and hop in one direction for two seconds, as the player would holding W and Space. */
function hop(r,x,z,dx,dz,y=0){
  let vy=JUMP,grounded=false;const dt=1/60,speed=7;
  for(let i=0;i<120;i++){
    if(grounded){vy=JUMP;grounded=false;}
    if(!r.blocks('town',x+dx*speed*dt,z,y))x+=dx*speed*dt;
    if(!r.blocks('town',x,z+dz*speed*dt,y))z+=dz*speed*dt;
    vy-=GRAVITY*dt;
    const v=r.moveVertical('town',x,z,y,y+vy*dt);y=v.y;grounded=v.grounded;
    if(v.grounded||v.ceiling)vy=0;
    if(grounded&&onWater(x,z,y))return `${x.toFixed(2)},${z.toFixed(2)} y ${y.toFixed(2)}`;
  }
  return null;
}

test('jumping never lands you on the water: from the banks, the bridge crests or the island',()=>{
  const r=registry(),wet=[];
  for(const p of shoreline(water,2.5))for(const side of [-1,1]){
    const nx=Math.cos(p.angle)*side,nz=Math.sin(p.angle)*side,sx=p.x+nx*1.1,sz=p.z+nz*1.1;
    if(inAny(water,sx,sz)||r.blocks('town',sx,sz,0))continue;
    for(const turn of [-.5,0,.5]){
      const a=Math.atan2(-nz,-nx)+turn,landed=hop(r,sx,sz,Math.cos(a),Math.sin(a));
      if(landed)wet.push('bank '+landed);
    }
  }
  // At each open corner of a rectangle of water, where the shoreline's own posts run out.
  for(const s of water.filter(s=>!isDisc(s)))for(const [x,z,ox,oz] of [[s.x0,s.z0,-1,-1],[s.x1,s.z0,1,-1],[s.x0,s.z1,-1,1],[s.x1,s.z1,1,1]]){
    const sx=x+ox*.8,sz=z+oz*.8;
    if(inAny(water,x,z,.05)||inAny(water,sx,sz)||r.blocks('town',sx,sz,0))continue;
    for(let k=0;k<16;k++){
      const a=k/16*Math.PI*2,landed=hop(r,sx,sz,Math.cos(a),Math.sin(a));
      if(landed)wet.push('corner '+landed);
    }
  }
  for(const b of garden.bridges){
    const crest=b.steps.reduce((a,s)=>s[2]>a[2]?s:a);
    for(const dx of [-1,1]){const landed=hop(r,b.x,(crest[0]+crest[1])/2,dx,0,crest[2]);if(landed)wet.push(b.id+' '+landed);}
  }
  for(let i=0;i<12;i++){
    const a=i/12*Math.PI*2,landed=hop(r,island.x+Math.cos(a)*3.1,island.z+Math.sin(a)*3.1,Math.cos(a),Math.sin(a),island.top);
    if(landed)wet.push('island '+landed);
  }
  assert.deepEqual(wet,[]);
});

test('荷风水榭: a step up from the covered walkway onto its floor over the pond, and no hop off it lands in the water',()=>{
  const r=registry(),ws=garden.waterside,z=(ws.z0+ws.z1)/2;
  let x=garden.walkway.x0,y=0;
  while(x>ws.x0+.6){
    const nx=x-.05;
    if(r.blocks('town',nx,z,y))break;
    x=nx;y=r.moveVertical('town',x,z,y,y-.08).y;
  }
  assert.ok(x<=ws.x0+.6,`stopped at x ${x.toFixed(2)}`);
  assert.ok(Math.abs(y-ws.floorTop)<1e-6,'on the floor at '+y);
  const wet=[];
  for(const [dx,dz] of [[-1,0],[0,-1],[0,1],[-.7,-.7],[-.7,.7]]){
    const landed=hop(r,ws.x0+1,z,dx,dz,ws.floorTop);if(landed)wet.push(landed);
  }
  assert.deepEqual(wet,[]);
});

/** Spots by each open corner of a rectangle of water where you could stand at the water's top
 *  because the water box lies under part of your footprint (the registry's square player radius)
 *  while your centre is on dry land: the gap a hop could land in when a corner has no post. */
function perches(r,dry,shapes,top){
  const out=[],step=.02;
  for(const s of shapes.filter(s=>!isDisc(s)))for(const [cx,cz] of [[s.x0,s.z0],[s.x1,s.z0],[s.x0,s.z1],[s.x1,s.z1]])
    for(let x=cx-.7;x<=cx+.7;x+=step)for(let z=cz-.7;z<=cz+.7;z+=step){
      if(inAny(shapes,x,z))continue;
      if(r.groundAt('town',x,z,top+.01)<top-.01||dry.groundAt('town',x,z,top+.01)>=top-.01)continue;
      if(!r.blocks('town',x,z,top))out.push(`${x.toFixed(2)},${z.toFixed(2)}`);
    }
  return [...new Set(out)];
}

test('no gap in the shore fence lets you stand on the edge of the water, corners included',()=>{
  assert.deepEqual(perches(registry(),dry,water,garden.water.top),[]);
});
