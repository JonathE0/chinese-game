import test from 'node:test';
import assert from 'node:assert/strict';
import rooms from '../src/content/rooms.json' with {type:'json'};
import {Registry} from '../src/world/registry.js';
import {upperParts} from '../src/world/interior.js';
import {JUMP,GRAVITY} from '../src/core/movement.js';

// The home's staircase is walked, not pressed: plain walking and gravity carry the tourist up the
// flight onto the upper floor, and back down again, with the rules the whole world uses.
function room(id='home') {
  const registry=new Registry(),data=rooms[id];
  for(const part of upperParts(data))registry.add({place:id,...part});
  return {registry,data,id};
}
const home=()=>room('home');
/** Walk in a straight line along z, a frame at a time, the way Town.update moves the player. */
function walk(registry,x,z,y,toZ,place='home') {
  const dir=Math.sign(toZ-z),dt=1/60;
  let vy=0,grounded=false;
  for(let frame=0;frame<2000&&((toZ-z)*dir>0||!grounded);frame++){
    const next=z+dir*Math.min(4.5*dt,Math.abs(toZ-z));
    if(!registry.blocks(place,x,next,y))z=next;
    vy-=24*dt;
    const vertical=registry.moveVertical(place,x,z,y,y+vy*dt);
    y=vertical.y;grounded=vertical.grounded;if(vertical.grounded||vertical.ceiling)vy=0;
  }
  return {z,y};
}

test('walking into the foot of the stairs climbs the whole flight onto the upper floor, and back down',()=>{
  const {registry,data}=home(),{x,z}=data.upper.stairs,top=data.upper.well[1];
  const up=walk(registry,x,z+.1,0,top-1);
  assert.ok(up.z<=top-1+1e-9,`stopped at z ${up.z.toFixed(2)}, height ${up.y.toFixed(2)}`);
  assert.equal(up.y,data.upper.y);
  const down=walk(registry,x,up.z,up.y,z+.5);
  assert.ok(down.z>=z+.5-1e-9,`stopped at z ${down.z.toFixed(2)}, height ${down.y.toFixed(2)}`);
  assert.equal(down.y,0);
});

test('the railing keeps you on the stairs, and upstairs out of the stairwell',()=>{
  const {registry,data}=home(),s=data.upper.stairs,[,wz0,wx1]=data.upper.well;
  const midZ=s.z-7.5*s.tread,midY=data.upper.y*8/s.steps;
  assert.equal(registry.blocks('home',s.x+s.width/2+.1,midZ,midY),true,'off the open side of the flight');
  assert.equal(registry.blocks('home',wx1-.1,wz0+1,data.upper.y),true,'into the stairwell from upstairs');
  assert.equal(registry.blocks('home',wx1+.5,wz0+1,data.upper.y),false,'along the landing beside it');
});

test('on the metro platform you arrive upstairs, walk down the flight to the platform, and back up',()=>{
  const {registry,data,id}=room('metro-platform'),{x,z}=data.upper.stairs,top=data.upper.well[1];
  assert.equal(data.upper.entrance,true,'the way in and out is on the landing');
  const down=walk(registry,x,top-.6,data.upper.y,z+.4,id);
  assert.ok(down.z>=z+.4-1e-9,`stopped at z ${down.z.toFixed(2)}, height ${down.y.toFixed(2)}`);
  assert.equal(down.y,0);
  const up=walk(registry,x,down.z,0,top-.6,id);
  assert.equal(up.y,data.upper.y);
});

test('no railing can be jumped onto: from the landing, the highest place to jump from, its top is out of reach',()=>{
  const {registry,data}=home(),u=data.upper,s=u.stairs,[,wz0,wx1,wz1]=u.well;
  const apex=JUMP*JUMP/(2*GRAVITY),edge=s.x+s.width/2;
  // At the top of a jump from the landing, both rails are still walls, not ledges.
  assert.equal(registry.blocks('home',edge,wz0+.5,u.y+apex),true,'the flight rail from the landing');
  assert.equal(registry.blocks('home',wx1,(wz0+wz1)/2,u.y+apex),true,'the stairwell rail from upstairs');
});
