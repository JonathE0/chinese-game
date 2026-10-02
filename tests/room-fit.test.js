import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

/**
 * Every room fits inside the building it belongs to (wave 4 contract). A room is drawn far from the
 * town, but the doorway and window views put it inside its building's front, so a room bigger than
 * its building reads as a Tardis.
 *
 *   - Width (along the front) ≤ the exterior's width − 0.4 and depth ≤ its depth − 0.4. A town
 *     building's `porch` (the word hall's colonnade) is open air, not room.
 *   - Each floor's height (a `levels` list, or the ground floor under an `upper` floor and the upper
 *     floor above it) ≤ the exterior's storey height (height / `storeys`, or a tower's podium), and
 *     the whole room ≤ the exterior's height. A tower without a podium has ordinary storeys: in
 *     海景公寓's tower rental.json's `storey`, a one-floor room there taking the storeys up to the
 *     lift's next stop (the lobby is double height); elsewhere at most a tall shop floor.
 *   - An annex (a room another room lists in `annexes`) needs a volume of its own: a `wings` entry on
 *     its building (or city tower) with the room's id. An annex entered through the parent's east or
 *     west wall by its own front door is turned a quarter, so its width runs along the wing's depth.
 *   - Rooms flagged `"underground": true` (stations below the street) are exempt, but their building
 *     and street entrance must exist: for 云海's own station (a room that returns to the city) that is
 *     city.json's `metroStation` building and its exits.
 *
 * City buildings (`city:<name>`) are the city.json tower (or skyline tower) with that id, or else the tower
 * whose front holds the entrance room's door.
 */
const read=path=>JSON.parse(readFileSync(new URL(`../src/content/${path}`,import.meta.url),'utf8'));
const rooms=read('rooms.json'),world=read('world.json'),city=read('city.json'),rental=read('rental.json');
const MARGIN=.4,EPS=1e-6,TALL_STOREY=6.5;

// A floor's height in a tower without a podium (see above).
function towerStorey(id,room,b){
  const at=rental.stops.findIndex(s=>s.room===id);
  if(b.id!==rental.tower.id||at<0)return TALL_STOREY;
  const next=rental.stops[at+1],span=next&&floors(room).length===1?next.floor-rental.stops[at].floor:1;
  return rental.tower.storey*span;
}

// The room that lists `id` as an annex, with its annex entry.
const annexOf=id=>{
  for(const [pid,p] of Object.entries(rooms)){
    const a=(p.annexes??[]).find(a=>a.room===id);
    if(a)return {parent:pid,annex:a};
  }
  return null;
};

// The city tower named `building` (a skyline tower too, like 云海中心), or else the one whose footprint
// (plus a step out front) holds the door of a room of `building`.
function tower(building){
  const doors=(city.doors??[]).filter(d=>rooms[d.room]?.building===building);
  const byId=[...city.towers??[],...city.skyline?.towers??[]].find(t=>t.id===building.slice(5));
  return byId??(city.towers??[]).find(t=>doors.some(d=>{
    const r=(t.rot??0)*Math.PI/180,c=Math.cos(r),s=Math.sin(r),dx=d.x-t.x,dz=d.z-t.z;
    return Math.abs(dx*c-dz*s)<=t.w/2+1.5&&Math.abs(dx*s+dz*c)<=t.d/2+1.5;
  }));
}

// The exterior volume a room has to fit: {width, depth, height, storey} in the room's own frame.
function exterior(id,room){
  const isCity=room.building.startsWith('city:');
  const b=isCity?tower(room.building):world.buildings.find(b=>b.id===room.building);
  if(!b)return {error:`no exterior for building ${room.building}`};
  const of=annexOf(id);
  if(of){
    const wing=(b.wings??[]).find(w=>w.id===id);
    if(!wing)return {error:`annex of ${of.parent} has no wing "${id}" on ${room.building}`};
    const side=w=>w==='east'||w==='west';
    const turned=side(of.annex.wall)!==side(room.returnWall);
    const w=wing.width??wing.w,d=wing.depth??wing.d;
    return {width:turned?d:w,depth:turned?w:d,height:wing.height??wing.h,storey:wing.height??wing.h};
  }
  if(isCity)return {width:b.w,depth:b.d,height:b.h,storey:b.form?.podium?.h??towerStorey(id,room,b)};
  return {width:b.width,depth:b.depth-(b.porch??0),height:b.height,storey:b.height/(b.storeys??1)};
}

// Each floor's clear height, bottom up.
function floors(room){
  if(room.levels)return room.levels.map((y,i)=>(room.levels[i+1]??room.height)-y);
  if(room.upper)return [room.upper.y,room.height-room.upper.y];
  return [room.height];
}

for(const [id,room] of Object.entries(rooms)){
  if(!room.building)continue;
  test(`room ${id} fits inside ${room.building}`,()=>{
    if(room.underground){
      if(room.returnPlace==='city'){
        assert.ok(city.metroStation?.building,`${id}: 云海 has no station building`);
        assert.ok(city.metroStation.exits?.length,`${id}: 云海's station has no way up to the street`);
        return;
      }
      assert.ok(room.door,`${id} has no street entrance`);
      assert.ok(room.building.startsWith('city:')?tower(room.building):world.buildings.some(b=>b.id===room.building),
        `${id}'s entrance building ${room.building} does not exist`);
      return;
    }
    const ext=exterior(id,room);
    assert.ok(!ext.error,`${id}: ${ext.error}`);
    const [w,d]=room.size;
    assert.ok(w<=ext.width-MARGIN+EPS,`${id} is ${w} wide in a ${ext.width} wide exterior`);
    assert.ok(d<=ext.depth-MARGIN+EPS,`${id} is ${d} deep in a ${ext.depth} deep exterior`);
    for(const h of floors(room))assert.ok(h<=ext.storey+EPS,`${id} has a ${h} high floor under a ${ext.storey} storey`);
    assert.ok(room.height<=ext.height+EPS,`${id} is ${room.height} high in a ${ext.height} high exterior`);
  });
}
