import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// The grand word hall stands at the north of the square (docs/superpowers/plans/2026-09-21-saves-art-hall-house.md,
// Task 5a). The riverside quarter it once hid has moved west: see tests/west-quarter.test.js.
const load=f=>JSON.parse(readFileSync(new URL(`../src/content/${f}.json`,import.meta.url),'utf8'));
const world=load('world'),rooms=load('rooms');
const district=id=>world.districts.find(d=>d.id===id);
// The complex: x -14..14, z -30..-10.
const inComplex=(x,z)=>x>-14&&x<14&&z>-30&&z<-10;

test('the square reaches z -31, with room for the whole hall complex',()=>{
  assert.deepEqual(district('square').bounds.z,[-31,19]);
});

test('the word hall is bespoke, its door on the front of the main hall, and the north is clear',()=>{
  const hall=world.buildings.find(b=>b.id==='practice-house');
  assert.equal(hall.bespoke,'wordhall');
  assert.equal(hall.paifang,'学海无涯');assert.equal(hall.sign,'词语馆');
  assert.ok(inComplex(hall.x-hall.width/2+.1,hall.z)&&inComplex(hall.x+hall.width/2-.1,hall.z));
  assert.equal(rooms.hall.door.x,0);
  assert.ok(rooms.hall.door.z<-16&&rooms.hall.door.z>hall.z-hall.depth/2,'door on the front of the hall');
  for(const id of ['reading','studyroom','listening','courtyard'])assert.deepEqual(rooms[id].door,rooms.hall.door,id);
  for(const [x,z] of world.trees)assert.ok(!inComplex(x,z),`tree at ${x},${z}`);
  for(const list of [world.props,world.people,world.ground,world.npcs])
    for(const one of list)assert.ok(!inComplex(one.x,one.z),JSON.stringify(one));
});
