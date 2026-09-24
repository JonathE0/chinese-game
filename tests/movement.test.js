import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stepVelocity,inputWish,JUMP,GRAVITY} from '../src/core/movement.js';

const dt=1/60,WALK=4.5,RUN=7,speed=v=>Math.hypot(v.x,v.z);
const run=(v,seconds,wish,wishSpeed,grounded=true,cap=RUN)=>{
  for(let t=0;t<seconds-1e-9;t+=dt)v=stepVelocity(v,wish,wishSpeed,grounded,dt,cap);
  return v;
};

test('walking from standing reaches 95% of walk speed within about 0.25 s',()=>{
  const v=run({x:0,z:0},.25,{x:1,z:0},WALK);
  assert.ok(speed(v)>=.95*WALK,`speed ${speed(v)}`);
  assert.ok(speed(run(v,2,{x:1,z:0},WALK))<=WALK+1e-9,'never overshoots the walk speed');
});

test('releasing the keys slides to a stop within 0.3 to 0.5 s',()=>{
  const walking={x:WALK,z:0};
  assert.ok(speed(run(walking,.3,{x:0,z:0},0))>0,'still sliding at 0.3 s');
  assert.equal(speed(run(walking,.5,{x:0,z:0},0)),0);
});

test('turning 90 degrees carries some momentum instead of snapping',()=>{
  const v=run({x:WALK,z:0},.1,{x:0,z:1},WALK);
  assert.ok(v.x>.5&&v.z>.5,JSON.stringify(v));
});

test('no bunny hopping: ten strafe-jumps never beat the takeoff speed or the cap',()=>{
  let v=run({x:0,z:0},1,{x:1,z:0},RUN),yaw=0;
  const takeoff=speed(v);
  for(let jump=0;jump<10;jump++){
    const side=jump%2?1:-1;
    let vy=JUMP,y=0;
    do{
      // Strafe while turning the view the same way, the classic air-strafe gain in Source.
      yaw+=side*3*dt;
      const f={x:Math.cos(yaw),z:Math.sin(yaw)},r={x:-f.z,z:f.x};
      const wx=f.x+side*r.x,wz=f.z+side*r.z,len=Math.hypot(wx,wz);
      v=stepVelocity(v,{x:wx/len,z:wz/len},RUN,false,dt,RUN);
      assert.ok(speed(v)<=takeoff+1e-9&&speed(v)<=RUN+1e-9,`air speed ${speed(v)} on jump ${jump}`);
      vy-=GRAVITY*dt;y+=vy*dt;
    }while(y>0);
    // Land and jump again on the very next frame, as a bhopper would.
    v=stepVelocity(v,{x:Math.cos(yaw),z:Math.sin(yaw)},RUN,true,dt,RUN);
    assert.ok(speed(v)<=takeoff+1e-9,`landing speed ${speed(v)}`);
  }
});

test('in the air the player can still slow down, and releasing Shift caps at walk speed',()=>{
  const back=run({x:RUN,z:0},.5,{x:-1,z:0},RUN,false);
  assert.ok(back.x<RUN&&back.x>0,JSON.stringify(back));
  assert.ok(speed(stepVelocity({x:RUN,z:0},{x:0,z:0},0,false,dt,WALK))<=WALK+1e-9);
  assert.equal(speed(stepVelocity({x:3,z:0},{x:0,z:0},0,false,dt,RUN)),3,'no air friction');
});

test('a standing jump still drifts a little, so W + Space climbs onto a ledge',()=>{
  const v=run({x:0,z:0},.5,{x:1,z:0},RUN,false);
  assert.ok(speed(v)>0&&speed(v)<=.12*RUN+1e-9,`air speed ${speed(v)}`);
});
test('strafing while running steers instead of stalling forward speed; strafing alone is full speed',()=>{
  const share=({forward,side})=>forward/Math.hypot(forward,side);
  assert.ok(share(inputWish(1,1))>=.85,'W+D keeps most of the run forward');
  assert.ok(share(inputWish(1,-1))>=.85,'W+A too');
  assert.deepEqual(inputWish(0,1),{forward:0,side:1});   // D alone: full sideways
  assert.deepEqual(inputWish(1,0),{forward:1,side:0});
});
