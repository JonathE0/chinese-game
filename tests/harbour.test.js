import test from 'node:test';
import assert from 'node:assert/strict';
import {HARBOUR,DAY,ferryAt,boardingProblem,payFare,fareAt,stillHolds,wheelRide,wheelTurn,loopAt,curve} from '../src/core/harbour.js';
import {onCityGround,addedGround} from '../src/core/city.js';
import city from '../src/content/city.json' with {type:'json'};
import drones from '../src/content/drones.json' with {type:'json'};

const {ferry,wheel,tour,sail}=HARBOUR;
const cycle=2*(ferry.wait+ferry.crossing);

test('the ferry waits at each pier, crosses in about 30 s, and runs the same every day',()=>{
  const s=ferryAt(0);
  assert.equal(s.at,'near');assert.equal(s.leaves,ferry.wait);assert.equal(s.u,0);
  assert.equal(ferryAt(ferry.wait-.5).at,'near');
  const mid=ferryAt(ferry.wait+ferry.crossing/2);
  assert.equal(mid.at,null);assert.ok(Math.abs(mid.u-.5)<1e-9);assert.ok(mid.speed>0);
  const far=ferryAt(ferry.wait+ferry.crossing+1);
  assert.equal(far.at,'far');assert.equal(far.u,1);assert.equal(far.leaves,ferry.wait-1);
  const back=ferryAt(2*ferry.wait+ferry.crossing*1.5);
  assert.equal(back.at,null);assert.ok(Math.abs(back.u-.5)<1e-9);assert.ok(back.speed<0);
  assert.ok(ferry.crossing>=25&&ferry.crossing<=35,'a crossing of about 30 s');
  // Out and back never step backwards, and one cycle later everything repeats.
  let last=-1;
  for(let t=ferry.wait;t<=ferry.wait+ferry.crossing;t+=.25){const u=ferryAt(t).u;assert.ok(u>=last-1e-12);last=u;}
  for(const t of [3,20,50,77])assert.deepEqual(ferryAt(t+cycle),ferryAt(t));
  // Every period divides a day, so nothing jumps at midnight.
  for(const period of [cycle,tour.period,sail.period,wheel.turn])assert.equal(DAY%period,0,`${period} s`);
});

test('boarding: only at the pier the ferry is docked at, not in its last seconds, and not twice',()=>{
  const docked=ferryAt(3),leaving=ferryAt(ferry.wait-ferry.closing/2),away=ferryAt(ferry.wait+5);
  assert.equal(boardingProblem(docked,'near',false),null);
  assert.equal(boardingProblem(docked,'far',false),'away');
  assert.equal(boardingProblem(away,'near',false),'away');
  assert.equal(boardingProblem(leaving,'near',false),'leaving');
  assert.equal(boardingProblem(docked,'near',true),'aboard');
  assert.equal(boardingProblem(ferryAt(ferry.wait+ferry.crossing+2),'far',false),null);
});

test('a fare is taken once per ride, and never from a wallet that cannot cover it',()=>{
  const profile={wallet:10},ride={paid:false};
  assert.deepEqual(payFare(profile,ride,ferry.fare),{ok:true,cost:3});
  assert.deepEqual(payFare(profile,ride,ferry.fare),{ok:true,cost:0});   // the same ride again
  assert.equal(profile.wallet,7);
  assert.deepEqual(payFare(profile,{paid:false},wheel.fare),{ok:false,reason:'money'});
  assert.equal(profile.wallet,7);
  assert.deepEqual(payFare(profile,{paid:false},ferry.fare),{ok:true,cost:3});   // a new ride pays again
  assert.equal(profile.wallet,4);
  assert.equal(ferry.fare,3);assert.equal(wheel.fare,8);
  // Nobody is stranded across the bay: without the fare, the way back from the far landing is free.
  assert.equal(fareAt({wallet:2},'far'),0);
  assert.equal(fareAt({wallet:2},'near'),3);
  assert.equal(fareAt({wallet:3},'far'),3);
});

test('a ticket holds while its ferry is still at the pier: ashore and back aboard is the same ride',()=>{
  const profile={wallet:10},ride={paid:false};
  payFare(profile,ride,ferry.fare);
  let kept={ride,pier:'near'};
  // Still docked a few seconds on: the same ride, and boarding again costs nothing.
  kept=stillHolds(kept,ferryAt(8));
  assert.equal(kept?.ride,ride);
  assert.deepEqual(payFare(profile,kept.ride,ferry.fare),{ok:true,cost:0});
  assert.equal(profile.wallet,7);
  // Not at the other pier, and not once it has sailed, even when it is back at this pier later.
  assert.equal(stillHolds({ride,pier:'far'},ferryAt(8)),null);
  kept=stillHolds(kept,ferryAt(ferry.wait+1));
  assert.equal(kept,null);
  assert.equal(stillHolds(kept,ferryAt(cycle+3)),null);
});

test('the wheel: you get into the cabin at the bottom and go round once, about 90 s',()=>{
  for(let t=0;t<wheel.turn*2;t+=.7){
    const {cabin,seconds}=wheelRide(t);
    assert.ok(Number.isInteger(cabin)&&cabin>=0&&cabin<wheel.cabins);
    // That cabin is at the bottom now (within half a cabin), and is back there after `seconds`.
    const past=k=>{const p=(wheelTurn(k)+cabin/wheel.cabins)%1;return Math.min(p,1-p);};
    assert.ok(past(t)<=.5/wheel.cabins+1e-9,`cabin ${cabin} at ${t}`);
    assert.ok(past(t+seconds)<1e-9,`back at the bottom after ${seconds}`);
    assert.ok(Math.abs(seconds-wheel.turn)<=wheel.turn/wheel.cabins/2+1e-9);
  }
  assert.ok(wheel.turn>=80&&wheel.turn<=100);
});

// A boat's outline at a point of its route, `half` [beam, length] / 2, every half metre round it.
function outline(p,halfBeam,halfLength){
  const out=[],rx=-p.dz,rz=p.dx;   // right of the way it runs
  for(let a=-halfLength;a<=halfLength;a+=.5)for(const s of [-1,1])out.push([p.x+p.dx*a+rx*s*halfBeam,p.z+p.dz*a+rz*s*halfBeam]);
  for(let b=-halfBeam;b<=halfBeam;b+=.5)for(const s of [-1,1])out.push([p.x+p.dx*s*halfLength+rx*b,p.z+p.dz*s*halfLength+rz*b]);
  return out;
}
const side=Math.ceil(Math.sqrt(drones.count)),reach=(side-1)/2*drones.pad.spacing;
const pad=[drones.pad.centre[0]-reach,drones.pad.centre[0]+reach,drones.pad.centre[2]-reach,drones.pad.centre[2]+reach];
const inRect=([x,z],[x0,x1,z0,z1],m=0)=>x>x0-m&&x<x1+m&&z>z0-m&&z<z1+m;
/** How far a point is from a rectangle (0 inside it). */
const gap=([x,z],[x0,x1,z0,z1])=>Math.hypot(Math.max(x0-x,0,x-x1),Math.max(z0-z,0,z-z1));
const BAY=[-160,170,-170,-48];

test('the ferry docks square to both piers and keeps clear of the drone barge and the bay\'s edges',()=>{
  const route=curve(ferry.route),p={};
  const [nx,nz]=ferry.route[0],[fx,fz]=ferry.route.at(-1),{near,far}=HARBOUR.piers;
  route.at(0,p);assert.ok(Math.abs(p.dx)<1e-9&&p.dz<0,'leaves the near pier heading straight out');
  route.at(route.length,p);assert.ok(Math.abs(p.dx)<1e-9&&p.dz<0,'comes in to the far pier straight');
  // Docked, its ends stand 0.4 m off the pier heads, in line with the gangway.
  assert.ok(Math.abs(nz+ferry.length/2-(near.head[2]-.4))<1e-9&&nx===near.gate[0]);
  assert.ok(Math.abs(fz-ferry.length/2-(far.head[3]+.4))<1e-9&&fx===far.gate[0]);
  assert.ok(route.length>80&&route.length<110,`a route of ${route.length.toFixed(1)} m`);
  for(let d=0;d<=route.length;d+=.5){
    route.at(d,p);
    for(const q of outline(p,ferry.beam/2,ferry.length/2)){
      assert.ok(gap(q,pad)>=1.5,`the ferry at ${d} m passes over the drone barge at ${q}`);
      assert.ok(inRect(q,BAY,-.5)||d<1||d>route.length-1,`the ferry at ${d} m leaves the bay`);
    }
  }
});

test('the tour boat and the sailboat loop back to their moorings, clear of the ferry, the barge and the shore',()=>{
  const ferryRoute=curve(ferry.route),f={},p={},ferryPath=[];
  for(let d=0;d<=ferryRoute.length;d+=1){ferryRoute.at(d,f);ferryPath.push([f.x,f.z]);}
  for(const boat of [tour,sail]){
    const route=curve(boat.route,true),state={};
    assert.equal(loopAt(boat.offset+boat.period-1,boat,route.length,state).d,0,'moored between trips');
    loopAt(boat.offset+10,boat,route.length,state);assert.ok(state.d>0&&state.speed>0,'under way');
    const trip=route.length/boat.speed+6;
    assert.ok(trip<boat.period,'back before the next trip');
    assert.ok(Math.abs(loopAt(boat.offset+trip-.01,boat,route.length,state).d-route.length)<.01,'the loop closes');
    for(let d=0;d<route.length;d+=.5){
      route.at(d,p);
      for(const q of outline(p,boat.beam/2,boat.length/2)){
        assert.ok(inRect(q,BAY,-3),`${boat.route[0]} at ${d} m is too near the shore`);
        assert.ok(gap(q,pad)>=3,`${boat.route[0]} at ${d} m crosses the drone barge`);
      }
      const nearest=Math.min(...ferryPath.map(([x,z])=>Math.hypot(x-p.x,z-p.z)));
      assert.ok(nearest>boat.length/2+ferry.length/2+4,`${boat.route[0]} at ${d} m comes within ${nearest.toFixed(1)} m of the ferry's route`);
    }
  }
});

test('the harbour adds its piers and far landing to 云海\'s ground, joined to the promenade',()=>{
  const walk=city.place.walk,edge=.42;
  assert.equal(onCityGround(walk,22,-58,edge),false,'no pier before the harbour is built');
  addedGround.push(...HARBOUR.walk);
  try{
    // Down the near pier from the promenade to its head, with no seam on the way.
    for(let z=-44;z>=-59.5;z-=.1)assert.equal(onCityGround(walk,22,z,edge),true,`near pier at z ${z.toFixed(1)}`);
    // Off the far pier onto the landing, and along the landing.
    for(let z=-157;z>=-188;z-=.1)assert.equal(onCityGround(walk,50,z,edge),true,`far pier at z ${z.toFixed(1)}`);
    for(let x=-39;x<=89;x+=.5)assert.equal(onCityGround(walk,x,-180,edge),true,`landing at x ${x}`);
    // Not the water between them, nor over the pier's sides.
    for(const [x,z] of [[22,-61],[22,-100],[19.5,-50],[50,-155],[47,-165],[0,-169.5]])
      assert.equal(onCityGround(walk,x,z,edge),false,`(${x},${z}) should be off the ground`);
    // Ground that moves is a function: the ferry's deck while you ride it.
    const deck=(x,z)=>Math.abs(x-22)<=3&&Math.abs(z+68.4)<=8;
    addedGround.push(deck);
    assert.equal(onCityGround(walk,22,-68,edge),true);
    addedGround.pop();
    assert.equal(onCityGround(walk,22,-68,edge),false);
  }finally{addedGround.length=0;}
});
