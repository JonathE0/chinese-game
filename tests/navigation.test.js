import test from 'node:test';
import assert from 'node:assert/strict';
import {Registry} from '../src/world/registry.js';
import {walkClear,rotatedHalf} from '../src/world/navigation.js';
test('small rotations expand both footprint axes instead of swapping them',()=>{
 const [w,d]=rotatedHalf([1,.2],10);assert.ok(w>1&&w<1.03);assert.ok(d>.36&&d<.38);
});
test('walking staff cannot tunnel through a counter or cross another person',()=>{
 const r=new Registry();r.add({place:'shop',x:0,z:0,hw:.5,hd:1,y1:1});
 assert.equal(walkClear(r,'shop',{x:-2,z:0},{x:2,z:0}),false);
 assert.equal(walkClear(r,'shop',{x:-2,z:2},{x:2,z:2}),true);
 assert.equal(walkClear(r,'shop',{x:-2,z:2},{x:2,z:2},[{x:0,z:2}]),false);
 assert.equal(walkClear(r,'other',{x:-2,z:0},{x:2,z:0}),true);
});
