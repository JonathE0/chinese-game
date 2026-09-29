import test from 'node:test';
import assert from 'node:assert/strict';
import {frontOfTower,arrivedAtTower} from '../src/core/city.js';
import city from '../src/content/city.json' with {type:'json'};

test('frontOfTower reproduces the formula city.json\'s own department entry uses for 星光百货',()=>{
  const starlight=city.towers.find(t=>t.sign==='星光百货');
  assert.deepEqual(frontOfTower(starlight),{x:city.department.x,z:city.department.z});
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
test('arrivedAtTower is true within the radius and false just outside it',()=>{
  const bookstore=city.towers.find(t=>t.sign==='一号书店');
  const spot=frontOfTower(bookstore);
  assert.equal(arrivedAtTower(spot.x,spot.z,bookstore),true);
  assert.equal(arrivedAtTower(spot.x+3.9,spot.z,bookstore),true);
  assert.equal(arrivedAtTower(spot.x+4.1,spot.z,bookstore),false);
});

test('the taxi drop-off stands clear of the tower\'s hitbox and of every solid street prop',async()=>{
  const {dropOffAtTower}=await import('../src/core/city.js');
  const PLAYER_RADIUS=.34;
  for(const tower of city.towers.filter(t=>t.sign)){
    const spot=dropOffAtTower(tower);
    assert.equal(spot.z,tower.z);
    // The tower's box reaches d/2 + 0.3 from its centre; the player must not overlap it.
    assert.ok(Math.abs(spot.x-tower.x)-(tower.d/2+.3)>PLAYER_RADIUS,`${tower.sign} drop-off is inside the tower`);
    // Same side of the avenue as frontOfTower, and still within the arrival radius of it.
    assert.equal(Math.sign(spot.x-tower.x),Math.sign(frontOfTower(tower).x-tower.x));
    assert.equal(arrivedAtTower(spot.x,spot.z,tower),true);
    for(const prop of city.props.filter(p=>p.kind!=='citycrossing'))
      assert.ok(Math.hypot(prop.x-spot.x,prop.z-spot.z)>1.5,`${tower.sign} drop-off is on top of a ${prop.kind}`);
  }
  // 一号书店 (x -17.5, d 12): a metre clear of the facade, not half a metre.
  assert.deepEqual(dropOffAtTower(city.towers.find(t=>t.sign==='一号书店')),{x:-10.5,z:-16});
});

test('only walking into the arrival radius counts: a warp into it never does',async()=>{
  const {arrivalStep}=await import('../src/core/city.js');
  // First sample, already inside (loaded or dropped there): no arrival.
  let s=arrivalStep(null,true,0);
  assert.equal(s.arrived,false);
  s=arrivalStep(s,true,0);
  assert.equal(s.arrived,false);                     // standing still inside is not arriving either

  // Walking out and back in, with no warp in between, counts.
  s=arrivalStep(s,false,0);assert.equal(s.arrived,false);
  s=arrivalStep(s,true,0);assert.equal(s.arrived,true);

  // A warp (taxi drop-off) from outside straight into the radius does not.
  s=arrivalStep(s,false,0);
  s=arrivalStep(s,true,1);assert.equal(s.arrived,false);
  s=arrivalStep(s,true,1);assert.equal(s.arrived,false);
  // ...until the player has left on foot and come back.
  s=arrivalStep(s,false,1);
  s=arrivalStep(s,true,1);assert.equal(s.arrived,true);

  // A warp that lands outside counts as having left: walking in afterwards arrives.
  s=arrivalStep(s,false,2);assert.equal(s.arrived,false);
  s=arrivalStep(s,true,2);assert.equal(s.arrived,true);
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
