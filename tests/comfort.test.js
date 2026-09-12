import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Registry} from '../src/world/registry.js';

test('vertical body sweep stops under a lintel and lands on a thin surface without tunneling',()=>{
  const registry=new Registry();
  registry.add({x:0,z:0,hw:2,hd:2,y0:2.4,y1:2.6});
  assert.equal(typeof registry.moveVertical,'function');
  assert.deepEqual(registry.moveVertical('town',0,0,0,2),{y:.7,ceiling:true,grounded:false});
  assert.deepEqual(registry.moveVertical('town',0,0,3,1),{y:2.6,ceiling:false,grounded:true});
  assert.deepEqual(registry.moveVertical('town',5,0,.2,-.2),{y:0,ceiling:false,grounded:true});
});

test('a step under a low beam is blocked instead of lifting the head through it',()=>{
  const registry=new Registry();
  registry.add({x:0,z:0,hw:2,hd:2,y0:2.4,y1:2.6});
  registry.add({x:0,z:0,hw:.5,hd:.5,y0:0,y1:1});
  assert.equal(registry.blocks('town',0,0,.7),true);
  assert.ok(registry.moveVertical('town',0,0,.7,.69).y<=.7);
});
