import test from 'node:test';
import assert from 'node:assert/strict';
import {HUNTS,huntTargets,activeHunts,inAnyHunt,claimHunt} from '../src/core/collection.js';

const water=HUNTS.find(h=>h.id==='water');
const names=[{id:'pond',zh:'池塘'},{id:'stream',zh:'小河'},{id:'tree',zh:'树'},{id:'sink',zh:'水池'}];

test('a hunt targets the objects whose name contains any of its characters',()=>{
  assert.deepEqual(huntTargets(water,names),['pond','stream','sink']);
  assert.ok(inAnyHunt({id:'tree',zh:'树'}) && !inAnyHunt({id:'stool',zh:'凳子'}));
});

test('people are never hunt targets, even when their name has the component',()=>{
  assert.equal(inAnyHunt({id:'waiter',zh:'服务员'}),false);
  assert.deepEqual(huntTargets(HUNTS.find(h=>h.id==='mouth'),[{id:'waiter',zh:'服务员'}]),[]);
});

test('a hunt with fewer than three targets is dropped',()=>{
  assert.deepEqual(activeHunts(names).map(h=>h.id),['water']);
  assert.deepEqual(activeHunts(names.slice(0,2)),[]);
});

test('a finished hunt pays huntCoins once and an unfinished one pays nothing',()=>{
  const profile={wallet:0,claims:{},discovered:['pond','stream']};
  const targets=huntTargets(water,names);
  assert.equal(claimHunt(profile,water,targets),0);
  profile.discovered.push('sink');
  assert.equal(claimHunt(profile,water,targets),5);
  assert.equal(claimHunt(profile,water,targets),0);
  assert.equal(profile.wallet,5);
  assert.equal(claimHunt(profile,water,[]),0);
});
