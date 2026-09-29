import test from 'node:test';
import assert from 'node:assert/strict';
import hill from '../src/content/hill.json' with {type:'json'};
import {Registry} from '../src/world/registry.js';
import {hillLayout,hillMarks} from '../src/world/hill.js';
import {JUMP,GRAVITY} from '../src/core/movement.js';

// The 山城 hill is walked with W alone: every flight climbs by rises the registry steps up, and the
// parapets keep the tourist on the way. The walk below moves a frame at a time the way Town.update
// does (x, then z, then gravity), with nothing but the hill's own hitboxes in the city.
import hotpot from '../src/content/hotpot.json' with {type:'json'};
const layout=hillLayout();
function registry(){
  const r=new Registry(),d=hotpot.layout.deck;
  for(const m of hillMarks(layout))r.add({place:'city',...m,solid:true});
  // The terrace floor is the hotpot deck's solid block (src/world/hotpot.js).
  r.add({place:'city',x:(d.x0+d.x1)/2,z:(d.z0+d.z1)/2,hw:(d.x1-d.x0)/2,hd:(d.z1-d.z0)/2,y0:0,y1:d.y});
  return r;
}
function walk(r,from,points){
  let [x,z]=from,y=from[2]??0,vy=0;
  const dt=1/60;
  for(const [tx,tz] of points){
    let frames=0;
    while(Math.hypot(tx-x,tz-z)>.05){
      if(++frames>4000)return {x,z,y,stuck:[tx,tz]};
      const d=Math.hypot(tx-x,tz-z),step=Math.min(4.5*dt,d),nx=x+(tx-x)/d*step,nz=z+(tz-z)/d*step;
      if(!r.blocks('city',nx,z,y))x=nx;
      if(!r.blocks('city',x,nz,y))z=nz;
      vy-=GRAVITY*dt;
      const v=r.moveVertical('city',x,z,y,y+vy*dt);
      y=v.y;if(v.grounded||v.ceiling)vy=0;
    }
  }
  for(let i=0;i<60;i++){vy-=GRAVITY*dt;const v=r.moveVertical('city',x,z,y,y+vy*dt);y=v.y;if(v.grounded)vy=0;}
  return {x,z,y,stuck:null};
}
const nodes=id=>hill.routes.find(r=>r.id===id).nodes.map(([x,z])=>[x,z]);
const UP=[[-36,-40],...nodes('promenade'),...nodes('terrace').slice(1),...nodes('summit').slice(1),[-98,-26]];

test('every flight rises by walkable steps, with treads from 0.4 to 1 m, and lands flush on its landings',()=>{
  assert.ok(layout.steps.length>100);
  for(const s of layout.steps)assert.ok(s.tread>=.4-1e-9&&s.tread<=1+1e-9,`tread ${s.tread} at ${s.x},${s.z}`);
  for(const route of hill.routes)for(let i=1;i<route.nodes.length;i++){
    const dy=Math.abs(route.nodes[i][2]-route.nodes[i-1][2]);
    assert.ok(Math.abs(Math.round(dy/hill.rise)*hill.rise-dy)<1e-9,`${route.id} ${i}: ${dy} m is not whole rises`);
  }
  assert.ok(hill.rise<=.21,'no higher than the house stairs');
});

test('from the promenade to the summit viewpoint and back down with W alone',()=>{
  const r=registry();
  const up=walk(r,[-36,-40,0],UP);
  assert.equal(up.stuck,null,`stuck on the way up at ${up.x.toFixed(2)},${up.z.toFixed(2)} height ${up.y.toFixed(2)}`);
  assert.equal(up.y,hill.platform.y);
  const down=walk(r,[up.x,up.z,up.y],[...UP].reverse());
  assert.equal(down.stuck,null,`stuck on the way down at ${down.x.toFixed(2)},${down.z.toFixed(2)} height ${down.y.toFixed(2)}`);
  assert.equal(down.y,0);
});

test('from downtown\'s west side up to the hotpot terrace, onto it, and back',()=>{
  const r=registry(),t=hill.terrace;
  const way=[[-30,8],...nodes('downtown'),...nodes('terrace').slice(1),[-72,-38]];
  const up=walk(r,[-30,8,0],way);
  assert.equal(up.stuck,null,`stuck at ${up.x.toFixed(2)},${up.z.toFixed(2)} height ${up.y.toFixed(2)}`);
  assert.equal(up.y,t.y,'standing on the terrace floor');
  const down=walk(r,[up.x,up.z,up.y],[...way].reverse());
  assert.equal(down.stuck,null);assert.equal(down.y,0);
});

test('the parapets keep you on the way and cannot be jumped onto',()=>{
  const r=registry(),apex=JUMP*JUMP/(2*GRAVITY);
  // Mid-flight on the long run up the terrace route (x -54), both sides are walls.
  const s=layout.steps.find(one=>one.route==='terrace'&&one.axis==='z'&&one.z<-26);
  assert.equal(r.blocks('city',s.x-1.9,s.z,s.y),true,'off the west side');
  assert.equal(r.blocks('city',s.x+1.9,s.z,s.y),true,'off the east side');
  for(const rail of layout.rails)
    assert.ok(rail.y1-Math.max(rail.from[2],rail.to[2])>apex+.42+.5,'a rail is a wall at the top of a jump');
  // The summit railing on the bay side.
  assert.equal(r.blocks('city',-98,-29.9,hill.platform.y+apex),true);
});

test('the terrace is flat at its floor height, clear of the stairway, and banked behind',()=>{
  const t=hill.terrace;
  const inT=c=>c.x>t.x0&&c.x<t.x1&&c.z>t.z0&&c.z<t.z1;
  const floor=layout.columns.filter(inT);
  assert.ok(floor.length>0);
  for(const c of floor)assert.equal(c.h,t.y);
  const area=floor.reduce((n,c)=>n+4*c.hw*c.hd,0);
  assert.equal(area,(t.x1-t.x0)*(t.z1-t.z0),'the whole terrace is floor');
  for(const k of layout.corridor){const [x,z]=k.split(',').map(Number);assert.ok(!inT({x,z}),`stairway cell ${k} on the terrace`);}
  // The way arrives at the terrace's east edge, level with it.
  assert.ok(layout.landings.some(l=>l.x===t.x1+2&&l.y===t.y));
  for(const c of layout.columns)if(!inT(c)&&c.x-c.hw<t.x1&&c.x+c.hw>t.x0-4&&c.z>t.z0&&c.z<t.z1+4)
    assert.ok(c.h>=t.bank,`bank at ${c.x},${c.z} is ${c.h}`);
});

test('no terrace column stands on the way',()=>{
  for(const c of layout.columns)for(const k of layout.corridor){
    const [x,z]=k.split(',').map(Number);
    assert.ok(!(Math.abs(c.x-x)<c.hw+2-1e-9&&Math.abs(c.z-z)<c.hd+2-1e-9),`column at ${c.x},${c.z} over ${k}`);
  }
});

test('no hill face lies in the plane of the hotpot deck\'s sides, facing the same way (no z-fighting)',async()=>{
  const d=hotpot.layout.deck,lo=d.y-.4,hi=d.y+.05;   // the deck slab's height band, with a margin
  const faces=[];
  for(const c of layout.columns){
    assert.ok(Number.isFinite(c.top),'every column has a drawn top');
    faces.push({x0:c.x-c.hw,x1:c.x+c.hw,z0:c.z-c.hd,z1:c.z+c.hd,top:c.kind==='mountain'?c.h+.01:c.top});
  }
  for(const l of layout.landings)faces.push({x0:l.x-2,x1:l.x+2,z0:l.z-2,z1:l.z+2,top:l.y});
  const eq=(a,b)=>Math.abs(a-b)<1e-6,span=(a0,a1,b0,b1)=>a0<b1-1e-6&&b0<a1-1e-6;
  for(const f of faces){
    if(f.top<=lo)continue;
    const bad=eq(f.x0,d.x0)&&span(f.z0,f.z1,d.z0,d.z1)||eq(f.x1,d.x1)&&span(f.z0,f.z1,d.z0,d.z1)||
      eq(f.z0,d.z0)&&span(f.x0,f.x1,d.x0,d.x1)||eq(f.z1,d.z1)&&span(f.x0,f.x1,d.x0,d.x1);
    assert.ok(!bad||f.top<=lo,`face of ${JSON.stringify(f)} fights the deck between ${lo} and ${hi}`);
  }
});

test('a sea wall closes the strip along the water under the hill\'s north face',()=>{
  const r=registry(),s=hill.seawall,apex=JUMP*JUMP/(2*GRAVITY);
  for(let x=s.x0+1;x<s.x1;x+=4)assert.equal(r.blocks('city',x,(s.z0+s.z1)/2,0),true,`open at x ${x}`);
  // From the promenade it is a wall, not a ledge to jump onto.
  assert.equal(r.blocks('city',s.x1+.2,(s.z0+s.z1)/2,apex),true);
});
