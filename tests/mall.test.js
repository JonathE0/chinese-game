import test from 'node:test';
import assert from 'node:assert/strict';
import rooms from '../src/content/rooms.json' with {type:'json'};
import catalog from '../src/content/catalog.json' with {type:'json'};
import assistants from '../src/content/assistants.json' with {type:'json'};
import signs from '../src/content/signs.json' with {type:'json'};
import mall from '../src/content/mall.json' with {type:'json'};
import city from '../src/content/city.json' with {type:'json'};
import {Registry} from '../src/world/registry.js';
import {mallLayout,stepTop,ride} from '../src/world/mall.js';
import {sellersOf} from '../src/core/sellers.js';
import {JUMP,GRAVITY} from '../src/core/movement.js';

// 星光百货 (docs/superpowers/plans/2026-09-27-development-wave-3.md, Y-mall): four floors round an
// atrium, joined by escalators you can walk, all out of the collision boxes every room uses.
const room=rooms.mall,layout=mallLayout();
function registry(){
  const r=new Registry(),[w,d]=room.size;
  r.add({place:'mall',x:0,z:0,hw:w/2,hd:d/2,y0:-.1,y1:.02,solid:false});
  for(const part of layout.parts)r.add({place:'mall',...part,solid:true});
  return r;
}
/** Walk in a straight line along x, a frame at a time, the way Town.update moves the player. */
function walk(r,x,z,y,toX){
  const dir=Math.sign(toX-x),dt=1/60;
  let vy=0,grounded=false;
  for(let frame=0;frame<3000&&((toX-x)*dir>0||!grounded);frame++){
    const next=x+dir*Math.min(4.5*dt,Math.abs(toX-x));
    if(!r.blocks('mall',next,z,y))x=next;
    vy-=GRAVITY*dt;
    const v=r.moveVertical('mall',x,z,y,y+vy*dt);
    y=v.y;grounded=v.grounded;if(v.grounded||v.ceiling)vy=0;
  }
  return {x,y};
}
const levels=room.levels,[vx0,,vx1]=mall.void;

test('every escalator is a flight you can walk: up from each floor to the next, and down again',()=>{
  const r=registry();
  assert.equal(layout.flights.length,6);
  for(const f of layout.flights){
    const top=levels[f.level+1],bottom=levels[f.level];
    assert.equal(f.steps*f.tread,vx1-vx0,'a flight spans the atrium');
    assert.ok(f.rise<=.2+1e-9&&Math.abs(f.steps*f.rise-(top-bottom))<1e-9,'its rises add up to one storey');
    const up=walk(r,f.x0-f.rises*.8,f.z,bottom,f.x1+f.rises*1.2);
    assert.ok(Math.abs(up.x-(f.x1+f.rises*1.2))<1e-6,`flight ${f.id} stopped at x ${up.x.toFixed(2)}, height ${up.y.toFixed(2)}`);
    assert.equal(up.y,top,`flight ${f.id} climbs to ${top}`);
    const down=walk(r,up.x,f.z,up.y,f.x0-f.rises*.8);
    assert.equal(down.y,bottom,`flight ${f.id} walks back down to ${bottom}`);
  }
});

test('each floor is reached by one flight going up and one going down, in turn',()=>{
  for(let i=0;i<levels.length-1;i++){
    const here=layout.flights.filter(f=>f.level===i);
    assert.deepEqual(here.map(f=>f.moves).sort(),[-1,1],`floor ${i+1}`);
    // Scissor stairs: you step off one flight and turn round onto the next.
    const next=layout.flights.filter(f=>f.level===i+1);
    for(const a of here)for(const b of next)assert.equal(a.x1,b.x0,'the next flight starts where this one ends');
  }
});

test('the atrium balustrades and the escalator sides keep you out of the void, and cannot be jumped onto',()=>{
  const r=registry(),apex=JUMP*JUMP/(2*GRAVITY);
  for(const y of levels.slice(1)){
    const gap=(x,z)=>layout.flights.some(f=>Math.abs(z-f.z)<f.hw&&((f.y1===y&&f.x1===x)||(f.y0===y&&f.x0===x)));
    for(const z of [-8,-4,4,8]){
      for(const [edge,out] of [[vx1,1],[vx0,-1]]){
        if(gap(edge,z))continue;
        assert.equal(r.blocks('mall',edge+out*.2,z,y),true,`into the atrium at x ${edge}, z ${z}, floor ${y}`);
        assert.equal(r.blocks('mall',edge+out*.2,z,y+apex),true,`jumping over the balustrade at x ${edge}, floor ${y}`);
        assert.equal(r.blocks('mall',edge+out*.6,z,y),false,`along the gallery at x ${edge}, z ${z}, floor ${y}`);
      }
    }
    for(const x of [-4,4])for(const [edge,out] of [[mall.void[1],-1],[mall.void[3],1]])
      assert.equal(r.blocks('mall',x,edge+out*.2,y),true,`into the atrium at z ${edge}, floor ${y}`);
  }
  // Half way up a flight, its sides are walls.
  for(const f of layout.flights){
    const mid=(f.x0+f.x1)/2,y=(f.y0+f.y1)/2-f.rise;
    for(const side of [-1,1])assert.equal(r.blocks('mall',mid,f.z+side*(f.hw+.15),y),true,`off the side of flight ${f.id}`);
  }
});

test('a moving step is never more than a step below the flight you stand on, so riding one never traps you',()=>{
  for(const f of layout.flights)for(let s=.01;s<f.steps*f.tread;s+=.037)for(const phase of [0,.25,.5,.75,.99]){
    const seen=stepTop(f,s,phase),solid=f.y0+Math.floor(s/f.tread)*f.rise;
    assert.ok(seen>=f.y0-1e-9&&seen<=f.y1+1e-9,'on the flight');
    assert.ok(Math.abs(seen-solid)<=f.rise+1e-9,`flight ${f.id} at ${s.toFixed(2)}, phase ${phase}: ${seen} against ${solid}`);
  }
});

test('the lift shaft is closed on every floor, and its door faces a landing on each',()=>{
  const r=registry(),l=mall.lift;
  for(const y of levels){
    assert.equal(r.blocks('mall',l.x,l.z,y),false,'inside the car there is room to stand');
    // Walking out of the car in any direction meets a wall.
    for(const [dx,dz] of [[0,-l.hd+.2],[0,l.hd-.2],[l.hw-.2,0],[-l.hw+.2,0]])
      assert.equal(r.blocks('mall',l.x+dx,l.z+dz,y),true,`the shaft wall at ${dx},${dz} on floor ${y}`);
    assert.equal(r.blocks('mall',l.x,l.z-l.hd-.9,y),false,`the landing in front of the lift on floor ${y}`);
    assert.equal(r.groundAt('mall',l.x,l.z-l.hd-.9,y+.3),y,`the landing is a floor at ${y}`);
  }
});

test('every counter and assistant stands on a floor of the mall, clear of its architecture, and sells what the plan lists',()=>{
  const r=registry();
  for(const f of room.fittings){
    assert.ok(levels.includes(f.y??0),`${f.kind} at ${f.x},${f.z} floats at ${f.y}`);
    const [x,z]=[f.x,f.z];
    assert.equal(r.groundAt('mall',x,z,(f.y??0)+.3,.05),f.y??0,`${f.kind} at ${x},${z} has a floor under it`);
    assert.equal(r.blocks('mall',x,z,(f.y??0)+.01,.2),false,`${f.kind} at ${x},${z} stands in a wall, a railing or the lift`);
  }
  for(const s of room.staff){
    assert.ok(levels.includes(s.y??0),`${s.id} stands on a floor`);
    for(const [x,z] of s.path)assert.equal(r.blocks('mall',x,z,s.y??0,.3),false,`${s.id} walks through the building at ${x},${z}`);
  }
  const sells=shop=>catalog.filter(i=>[].concat(i.shop).includes(shop)).map(i=>i.zh);
  assert.deepEqual(sells('mall-tea'),['奶茶','珍珠奶茶','水果茶']);
  assert.deepEqual(sells('mall-phones'),['手机壳','耳机','充电器']);
  assert.deepEqual(sells('mall-toys'),['玩具熊','拼图','风筝']);
  assert.deepEqual(sells('mall-sports'),['T恤','运动鞋']);
  assert.deepEqual(sells('mall-food'),['炒饭','拉面','汉堡','披萨','寿司','冰淇淋']);
  const priced=Object.fromEntries(catalog.filter(i=>i.id.startsWith('mall-')).map(i=>[i.zh,[i.measure,i.price]]));
  assert.deepEqual(priced,{'奶茶':['杯',10],'珍珠奶茶':['杯',12],'水果茶':['杯',12],'手机壳':['个',20],'耳机':['副',60],'充电器':['个',25],
    '玩具熊':['只',30],'拼图':['盒',18],'风筝':['个',15],'T恤':['件',40],'运动鞋':['双',80],'炒饭':['份',15],'拉面':['碗',16],
    '汉堡':['个',18],'披萨':['块',12],'寿司':['份',25],'冰淇淋':['个',8]});
  for(const shop of ['mall-tea','mall-phones','mall-toys','mall-sports','mall-food']){
    assert.ok(room.fittings.some(f=>f.action==='shop:'+shop),`a counter for ${shop}`);
    const helper=room.staff.find(s=>s.shop===shop);
    assert.ok(helper?.look,`an assistant at ${shop}`);
    for(const key of [].concat(helper.line??'shop-'+shop))assert.ok(assistants.lines[key]?.zh,`${shop}'s line ${key}`);
  }
  // The food court asks what you would like to eat; the information desk says where the food court is.
  const says=shop=>[].concat(room.staff.find(s=>s.shop===shop).line??'shop-'+shop).map(k=>assistants.lines[k]?.zh);
  assert.deepEqual(says('mall-food'),['想吃点儿什么？']);
  assert.deepEqual(says('mall-info'),['您好，需要帮忙吗？','美食广场在四楼。']);
  assert.equal(mall.shops.find(s=>s.id==='mall-food').greeting,'shop-mall-eat');
});

test('星光五金百货 opens off the first floor, and leads back into the mall',()=>{
  const hardware=rooms.hardware,door=room.annexes.find(a=>a.room==='hardware');
  assert.ok(door,'a door to the hardware store');
  assert.equal(hardware.returnPlace,'mall');
  assert.equal(room.returnPlace,'city');
  assert.equal(room.enterLabel,'进商场');
  const r=registry(),[x,z]=hardware.returnSpawn;
  assert.equal(r.blocks('mall',x,z,0),false,'you come back out onto the floor');
  // Each way back puts you a step in front of the door you came out of, facing away from it:
  // town.facing() walks along (-sin yaw, -cos yaw).
  const away=([sx,sz,yaw],door)=>{const a=yaw*Math.PI/180;return -Math.sin(a)*(sx-door.x)-Math.cos(a)*(sz-door.z)>0&&Math.hypot(sx-door.x,sz-door.z)<2.5;};
  assert.ok(away(hardware.returnSpawn,{x:-room.size[0]/2,z:door.z}),'out of 星光五金百货, facing into the mall');
  assert.ok(away(room.returnSpawn,city.doors.find(d=>d.room==='mall')),'out of 星光百货, facing the avenue');
});

test('every sign the mall draws reads from signs.json',()=>{
  for(const text of [...mall.units.map(u=>u.sign),...Object.values(mall.signs).flat(),...mall.shops.map(s=>s.title)])
    assert.ok(signs.signs[text],`sign ${text}`);
});

test('riding every flight off to one side carries you off at the far landing, never pinned at its newels',()=>{
  const r=registry(),dt=1/60;
  for(const f of layout.flights)for(const dz of [-.25,.25]){
    const up=f.moves>0,run=f.steps*f.tread;
    let x=f.x0+f.rises*(up?.3:run-.3),y=up?f.y0:f.y1,vy=0,t=0,left=false;
    const z=f.z+dz,free=(nx,feet)=>!r.blocks('mall',nx,z,feet);
    for(let frame=0;frame<60*30&&!left;frame++){
      t+=dt;
      for(const g of layout.flights)g.phase=((t*g.speed/g.tread*g.moves)%1+1)%1;
      // Gravity first, as Town.update does, then the escalator's own step.
      vy-=GRAVITY*dt;
      const v=r.moveVertical('mall',x,z,y,y+vy*dt);y=v.y;if(v.grounded||v.ceiling)vy=0;
      const next=ride(layout.flights,x,z,y,dt,free);
      if(next){x=next.x;y=next.y;vy=0;}else left=true;
    }
    const s=(x-f.x0)*f.rises;
    assert.ok(up?s>run:s<0,`flight ${f.id} at dz ${dz}: stuck ${s.toFixed(2)} m along, at height ${y.toFixed(2)}`);
    // A step or two on across the landing, nothing is in the way.
    const way=f.rises*f.moves,floor=up?f.y1:f.y0;
    for(let i=1;i<=50;i++)assert.equal(r.blocks('mall',x+way*i*.02,z,floor),false,`flight ${f.id} at dz ${dz}: blocked ${(i*.02).toFixed(2)} m past its end`);
  }
});

test('the buy guide finds what 星光百货 sells there, by metro',()=>{
  for(const id of ['mall-naicha','mall-erji','mall-txu','mall-wanjuxiong','mall-lamian']){
    const [seller]=sellersOf(id);
    assert.equal(seller?.zh,'星光百货',id);
    assert.equal(seller.city,true,id);
  }
});

test('the 星光百货 entry in city.json is the block the mall draws: its four floors inside it, its door a body clear of its front',()=>{
  const t=city.towers.find(one=>one.sign==='星光百货'),door=city.doors.find(d=>d.room==='mall');
  assert.equal(t.drawnBy,'mall');
  // Its front is the entry's local +z turned by `rot` (on 美食街, facing north); the door stands out in front of it.
  const r=(t.rot??0)*Math.PI/180,ahead=(door.x-t.x)*Math.sin(r)+(door.z-t.z)*Math.cos(r),along=(door.x-t.x)*Math.cos(r)-(door.z-t.z)*Math.sin(r);
  assert.ok(ahead-t.d/2>.3+.34&&ahead-t.d/2<1.5,`the door is ${(ahead-t.d/2).toFixed(2)} m out from the front`);
  assert.ok(Math.abs(along)<t.w/2-2,'the door is on the front, not round the corner');
  // The room-fit rule: the floors inside fit the block, and the glass front stands taller than them.
  assert.ok(room.size[0]<=t.w-.4&&room.size[1]<=t.d-.4&&room.height<=t.h,'36 x 36 floors in a 37 x 37 block');
  assert.ok(mall.exterior.height>room.height);
  // The hardware store behind its door on the ground floor has a wing of its own beside the block.
  const wing=t.wings.find(w=>w.id==='hardware');
  assert.ok(wing&&rooms.hardware.size[0]<=wing.d-.4&&rooms.hardware.size[1]<=wing.w-.4&&rooms.hardware.height<=wing.h);
});
