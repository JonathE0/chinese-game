import test from 'node:test';
import assert from 'node:assert/strict';
import world from '../src/content/world.json' with {type:'json'};
import rooms from '../src/content/rooms.json' with {type:'json'};
import sites from '../src/content/sites.json' with {type:'json'};
import quests from '../src/content/quests.json' with {type:'json'};
import tutorial from '../src/content/tutorial.json' with {type:'json'};

const building=id=>world.buildings.find(b=>b.id===id);
/** A door sits 0.3 past the front wall, where town.js marks it, on the north face when the building is turned round. */
const doorOf=b=>{const face=(b.rotation??0)===180?-1:1;return {x:b.x,z:+(b.z+face*(b.depth/2+.3)).toFixed(2)};};
/** Wing coordinates are the building's own, so a turned building mirrors them. */
const wingWorld=(b,wing)=>{const face=(b.rotation??0)===180?-1:1;return {x:b.x+face*wing.x,z:b.z+face*wing.z};};
const near=(a,b,tol)=>Math.hypot(a.x-b.x,a.z-b.z)<=tol;

test('the home stands on the south side of the square, facing north to the fountain',()=>{
  const home=building('home');
  assert.equal(home.rotation,180);
  assert.ok(home.z>11&&home.z<17,'south half of the square');
  assert.ok(home.height>=5.8,'two storeys');
  assert.equal(home.storeys,2);
  assert.equal(home.sign,'我的家');
  assert.deepEqual(rooms.home.door,doorOf(home));
  assert.deepEqual(rooms.kitchen.door,doorOf(home));
});

test('the kitchen wing is on the west side and the study on the east, both one storey',()=>{
  const home=building('home'),wings=Object.fromEntries((home.wings??[]).map(w=>[w.object,w]));
  assert.ok(wings.kitchen&&wings.study,'kitchen and study wings');
  assert.ok(wingWorld(home,wings.kitchen).x<home.x-home.width/2,'kitchen west of the house');
  assert.ok(wingWorld(home,wings.study).x>home.x+home.width/2,'study east of the house');
  for(const wing of [wings.kitchen,wings.study])assert.ok(wing.height<home.height/1.5);
  assert.equal(wings.kitchen.sign,'厨房');
});

test('the spawn is on open ground north-west of the house, looking at it, clear of the fountain',()=>{
  const [x,z,yaw]=world.spawn,home=building('home');
  assert.ok(Math.hypot(x-0,z-1.8)>2.12+.6,'clear of the fountain rim');
  assert.ok(x<home.x&&z<home.z,'north-west of the house');
  // yaw = atan2(-dx, -dz): the house must lie within 30 degrees of straight ahead.
  const toHouse=Math.atan2(-(home.x-x),-(home.z-z))*180/Math.PI;
  const off=((yaw-toHouse+540)%360)-180;
  assert.ok(Math.abs(off)<30,`looking ${off.toFixed(1)} degrees off the house`);
});

test('the tea house lot moved into the park, and everything that points at it moved too',()=>{
  const site=sites.sites.find(s=>s.id==='teahouse'),tea=building('teahouse');
  assert.deepEqual([site.x,site.z,site.rotation],[12.5,46.5,180]);
  assert.deepEqual([tea.x,tea.z,tea.rotation,tea.district,tea.style],[12.5,46.5,180,'garden','tiled']);
  assert.deepEqual(rooms.teahouse.door,doorOf(tea));
  const mission=quests.quests.find(m=>m.id==='teahouse-build');
  assert.equal(mission.where.district,'garden');
  assert.ok(near(mission.where,{x:12.5,z:43.1},1));
});

test('the home step and the furnish mission point at the new front door',()=>{
  const door=doorOf(building('home')),step=tutorial.steps.find(s=>s.id==='home');
  const furnish=quests.quests.find(m=>m.id==='furnish');
  for(const where of [step.where,furnish.where]){
    assert.ok(near(where,door,2),`${JSON.stringify(where)} is near the door`);
    assert.ok(where.z<door.z,'in front of it, on the square side');
  }
});

test('inside, the house matches the outside: a study through the west wall and a real upstairs',()=>{
  const doors=Object.fromEntries(rooms.home.annexes.map(a=>[a.room,a]));
  assert.equal(doors.kitchen.wall,'east');
  assert.equal(doors.study.wall,'west');
  assert.equal(doors.study.label,'进书房 · 看书');
  // The bedroom is no longer a room behind a door: the house has two floors and a staircase.
  assert.equal(doors.bedroom,undefined);
  assert.equal(rooms.bedroom,undefined);
  // The desk moved to the study; the living room's slots stay put so old saves keep their places.
  assert.equal(rooms.home.desk,undefined);
  assert.equal(rooms.home.slots.bed.x,2.9);
  const {study,home}=rooms,up=home.upper;
  assert.deepEqual([study.zh,study.pinyin,study.en,study.returnPlace,study.returnLabel],['书房','shūfáng','Study','home','回客厅']);
  assert.ok(study.desk,'the study desk');
  assert.deepEqual(study.fittings.map(f=>f.action).filter(Boolean).sort(),['shelf:beginner','shelf:everyday','shelf:stories']);
  assert.ok(study.frontWindows.some(w=>w.name==='window'));
  assert.equal(study.returnWall,'east');
  // Upstairs: the balcony door lines up with the balcony outside, and the bedroom's slots came up.
  assert.ok(home.height>=up.y+2.4,'headroom upstairs');
  assert.ok(home.frontWindows.some(w=>w.name==='balcony'&&w.door&&w.x===0&&w.y===up.y));
  const upstairs=Object.entries(home.slots).filter(([,slot])=>slot.y===up.y).map(([id])=>id).sort();
  assert.deepEqual(upstairs,['up-bed','up-lamp','up-nightstand','up-plant','up-rug','up-wardrobe','wall-up']);
  // Certificates hang on the walls: two downstairs, one upstairs.
  const walls=Object.values(home.slots).filter(slot=>slot.accepts.includes('certificate'));
  assert.deepEqual(walls.map(slot=>slot.y??0).sort(),[0,0,up.y]);
  // The flight climbs to exactly the upper floor, in steps anyone can walk up, inside the stairwell.
  const s=up.stairs,[wx0,wz0,wx1,wz1]=up.well;
  assert.equal(s.steps,14);
  assert.ok(up.y/s.steps<.42,'each rise is a walkable step');
  assert.ok(s.x-s.width/2>=wx0&&s.x+s.width/2<=wx1&&s.z<=wz1&&s.z-s.steps*s.tread>=wz0-.05,'the flight is under the stairwell');
  // Nothing in a slot stands on a corner pillar, in the stairwell or in the study doorway.
  const [w,d]=home.size;
  for(const [id,slot] of Object.entries(home.slots)){
    if(slot.accepts.includes('certificate'))continue;
    for(const px of [-w/2+.35,w/2-.35])for(const pz of [-d/2+.35,d/2-.35])
      assert.ok(Math.hypot(slot.x-px,slot.z-pz)>.6,`${id} slot on a pillar`);
    assert.ok(!(slot.x<wx1+.3&&slot.z>wz0-.3),`${id} slot in the stairwell`);
  }
  assert.ok(doors.study.z<wz0-.7,'the study door is clear of the stairs');
  assert.deepEqual(home.decorateAt,[-1.6,-2.4]);
  // The way back lands beside the door it came through.
  assert.ok(Math.abs(study.returnSpawn[1]-doors.study.z)<.5&&study.returnSpawn[0]<-3);
});
