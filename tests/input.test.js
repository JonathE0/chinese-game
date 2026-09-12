import {test} from 'node:test';
import assert from 'node:assert/strict';

test('look smoothing gives the same turn at different frame rates and rejects nonfinite deltas',async()=>{
  const {queueLook,drainLook}=await import('../src/core/input.js');
  const simulate=hz=>{
    const pending={x:0,y:0};queueLook(pending,300,-100);
    let x=0,y=0;
    for(let i=0;i<hz/10;i++){const d=drainLook(pending,1/hz);x+=d.x;y+=d.y;}
    return {x,y};
  };
  const a=simulate(30),b=simulate(120);
  assert.ok(Math.abs(a.x-b.x)<.01);
  assert.ok(Math.abs(a.y-b.y)<.01);
  const p={x:0,y:0};queueLook(p,NaN,Infinity);
  assert.deepEqual(p,{x:0,y:0});
  for(let i=0;i<100;i++)queueLook(p,500,500);
  assert.ok(p.x<=600&&p.y<=600,'event bursts cannot create seconds of queued motion');
});
