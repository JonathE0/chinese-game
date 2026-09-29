import test from 'node:test';
import assert from 'node:assert/strict';
import {frontOfTower} from '../src/core/city.js';
import city from '../src/content/city.json' with {type:'json'};
import taxi from '../src/content/lessons/city-taxi.json' with {type:'json'};

/** Where the taxi goes: the avenue's towers the city-taxi lesson names. */
const destinations=new Set(JSON.stringify(taxi).match(/"value": ?"([^"]+)"/g).map(v=>v.split('"').at(-2)));

test('frontOfTower is at 星光百货\'s door, as the city lists it',()=>{
  const starlight=city.towers.find(t=>t.sign==='星光百货'),door=city.doors.find(d=>d.room==='mall');
  const front=frontOfTower(starlight);
  assert.ok(Math.hypot(front.x-door.x,front.z-door.z)<1.5,`${front.x},${front.z} is not at the door`);
});
test('frontOfTower sits just outside a tower\'s own hitbox, on whichever side it sits on',()=>{
  const bookstore=city.towers.find(t=>t.sign==='一号书店');
  assert.deepEqual(frontOfTower(bookstore),{x:-11,z:-16});
  // A tower on the east side of the avenue gets a spot pulled back toward the kerb, not further out.
  const hospital=city.towers.find(t=>t.sign==='中山医院');
  const spot=frontOfTower(hospital);
  assert.ok(spot.x<hospital.x);
  assert.equal(spot.z,hospital.z);
});
test('the taxi drop-off stands clear of the tower\'s hitbox and of every solid street prop',async()=>{
  const {dropOffAtTower}=await import('../src/core/city.js');
  const PLAYER_RADIUS=.34;
  const avenue=city.towers.filter(t=>destinations.has(t.sign));
  assert.equal(avenue.length,6);
  for(const tower of avenue){
    const spot=dropOffAtTower(tower);
    assert.equal(spot.z,tower.z);
    // The tower's box reaches d/2 + 0.3 from its centre; the player must not overlap it.
    assert.ok(Math.abs(spot.x-tower.x)-(tower.d/2+.3)>PLAYER_RADIUS,`${tower.sign} drop-off is inside the tower`);
    // Same side of the avenue as frontOfTower.
    assert.equal(Math.sign(spot.x-tower.x),Math.sign(frontOfTower(tower).x-tower.x));
    for(const prop of city.props.filter(p=>p.kind!=='citycrossing'))
      assert.ok(Math.hypot(prop.x-spot.x,prop.z-spot.z)>1.5,`${tower.sign} drop-off is on top of a ${prop.kind}`);
  }
  // 一号书店 (x -17.5, d 12): a metre clear of the facade, not half a metre.
  assert.deepEqual(dropOffAtTower(city.towers.find(t=>t.sign==='一号书店')),{x:-10.5,z:-16});
});

test('云海 ground: downtown, the promenade and the hill side are walkable; the bay and past the edges are not',async()=>{
  const {onCityGround}=await import('../src/core/city.js');
  const walk=city.place.walk,edge=.42;
  // The avenue, the plaza on the promenade, both ends of the promenade, and the ground up to the hill.
  for(const [x,z] of [[0,0],[0,24.5],[0,-41],[-38,-41],[68,-40],[-34,8],[-60,-40]])
    assert.equal(onCityGround(walk,x,z,edge),true,`(${x},${z}) should be walkable`);
  // Past the railing into the bay, behind the promenade's east end, off the east and south edges.
  for(const [x,z] of [[0,-48.5],[40,-20],[28.5,0],[0,34.5],[71,-40],[-121,0]])
    assert.equal(onCityGround(walk,x,z,edge),false,`(${x},${z}) should be off the ground`);
  // Where two stretches of ground meet there is no seam: the avenue runs straight on into the plaza,
  // and the promenade's west end runs on to the foot of the hill.
  for(let z=-30;z>=-47;z-=.1)assert.equal(onCityGround(walk,0,z,edge),true,`seam at z ${z.toFixed(1)}`);
  for(let x=-30;x>=-45;x-=.1)assert.equal(onCityGround(walk,x,-41,edge),true,`seam at x ${x.toFixed(1)}`);
});

test('the promenade path curves inside the promenade and runs through the middle of its plaza',async()=>{
  const {promenadeZ}=await import('../src/core/city.js');
  const p=city.promenade,half=p.path.width/2;
  assert.equal(promenadeZ(p,p.plaza.x),p.plaza.z);
  let low=Infinity,high=-Infinity;
  for(let x=p.x[0];x<=p.x[1];x+=.5){const z=promenadeZ(p,x);low=Math.min(low,z);high=Math.max(high,z);}
  assert.ok(high-low>3,'the path should visibly curve');
  // At least two metres of paving on either side of it all the way along, for the benches, lamps and trees.
  assert.ok(low-half>=p.z[0]+2&&high+half<=p.z[1]-2,`path spans ${low-half}..${high+half}`);
});

/** A tower's footprint on the ground, city-local: quarter turns swap its width and depth. */
function footprint(t){
  const turned=Math.abs(Math.round(Math.sin((t.rot??0)*Math.PI/180)))===1;
  return {x:t.x,z:t.z,hw:(turned?t.d:t.w)/2,hd:(turned?t.w:t.d)/2};
}
test('every city door (the doors table) stands on open pavement just outside the front of its building',async()=>{
  const {onCityGround}=await import('../src/core/city.js');
  const rooms={'city-bank':'进银行','city-bookshop':'进书店','city-hospital':'进医院','city-noodles':'进面馆',
    'city-cinema':'进电影院','city-store':'进便利店','city-cafe':'进咖啡馆',mall:'进商场'};
  assert.deepEqual(Object.fromEntries(city.doors.map(d=>[d.room,d.label])),rooms);
  const PLAYER=.34;
  for(const door of city.doors){
    assert.ok(onCityGround(city.place.walk,door.x,door.z,PLAYER),`${door.room} is off the ground`);
    const gaps=city.towers.map(footprint).map(b=>Math.hypot(Math.max(0,Math.abs(door.x-b.x)-b.hw),Math.max(0,Math.abs(door.z-b.z)-b.hd)));
    // Clear of every tower's hitbox (0.3 m past its walls) by a body's width, so someone can stand on
    // it, and within a stride of one front.
    assert.ok(Math.min(...gaps)>.3+PLAYER,`${door.room} is inside a tower`);
    assert.ok(Math.min(...gaps)<1.5,`${door.room} is not at a building`);
    for(const prop of city.props.filter(p=>!['citycrossing','citylamp'].includes(p.kind)))
      assert.ok(Math.hypot(prop.x-door.x,prop.z-door.z)>2,`${door.room} is on top of a ${prop.kind}`);
  }
  // The noodle lesson moved indoors: no counter left out on the pavement.
  assert.equal(city.noodles,undefined);
});
test('the rooms of the city light up in the evening and go dark through the night',async()=>{
  const {litShare}=await import('../src/world/leds.js');
  for(let h=0;h<24;h+=.25){const v=litShare(h);assert.ok(v>0&&v<1,`${h}: ${v}`);}
  assert.ok(litShare(20)>litShare(17.5)&&litShare(20)>litShare(23.5),'most rooms lit at eight in the evening');
  assert.ok(litShare(23.5)>litShare(3),'fewer as the night goes on');
  assert.ok(Math.abs(litShare(23.999)-litShare(0))<.01,'midnight joins up');
});

test('the tiers of a tower stand on each other, and a sky garden takes the ground its neighbours share',async()=>{
  const {towerTiers}=await import('../src/core/city.js');
  const within=(a,b)=>Math.abs(a.cx-b.cx)+a.w/2<=b.w/2+1e-9&&Math.abs(a.cz-b.cz)+a.d/2<=b.d/2+1e-9;
  const footing=(a,b)=>Math.min(a.cx+a.w/2,b.cx+b.w/2)-Math.max(a.cx-a.w/2,b.cx-b.w/2)>1&&Math.min(a.cz+a.d/2,b.cz+b.d/2)-Math.max(a.cz-a.d/2,b.cz-b.d/2)>1;
  // Staggered either side of a garden: the garden is exactly the overlap.
  const [low,garden,high]=towerTiers({w:10,d:6,form:{podium:{h:5},tiers:[{to:10,dx:-1},{to:13,skin:'garden'},{to:20,dx:1.5}]}});
  assert.deepEqual([garden.cx,garden.w,garden.y0,garden.y1],[.25,7.5,10,13]);
  assert.ok(within(garden,low)&&within(garden,high));
  for(const t of city.towers.filter(one=>one.form)){
    const tiers=towerTiers(t);
    tiers.forEach((v,i)=>{
      const below=i?tiers[i-1]:{cx:0,cz:0,w:t.w,d:t.d,y1:t.form.podium.h},above=tiers.slice(i+1).find(one=>one.skin!=='garden');
      assert.equal(v.y0,below.y1,`${t.sign??t.x}: tier ${i} starts where the one below ends`);
      assert.ok(footing(v,below),`${t.sign??t.x}: tier ${i} has a metre of footing on the one below`);
      if(v.skin==='garden')assert.ok(within(v,below)&&(!above||within(v,above)),`${t.sign}: garden ${i} is not under its neighbours`);
    });
  }
});
test('every near-side tower is built from a form, or drawn by a city part of its own',()=>{
  for(const t of city.towers)assert.ok(t.form||t.drawnBy,`tower at ${t.x},${t.z}`);
});
