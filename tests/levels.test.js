import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,decodeProfile} from '../src/core/profile.js';
import {placementNext,finishPlacement,canPlace,finishMock} from '../src/core/levels.js';
import {learnedAtLevel} from '../src/core/progress.js';
import balance from '../src/content/balance.json' with {type:'json'};

// Task L-levels in docs/superpowers/plans/2026-09-24-learning-features.md.
test('placement climbs while levels pass and stops at the first failed level',()=>{
  assert.deepEqual(placementNext(1,6),{next:2});
  assert.deepEqual(placementNext(2,5),{result:1});
  assert.deepEqual(placementNext(1,0),{result:0});
  assert.deepEqual(placementNext(6,8),{result:6});
});

test('placement schedules known words later than a new card, pays nothing, and counts for gates',()=>{
  const p=freshProfile(),now=1e12,wallet=p.wallet;
  p.dayIndex=4;
  p.words.b={recognition:{stage:5,due:now+9e9,last:now-1,reviews:7,learned:true}};
  finishPlacement(p,1,['a','b'],now);
  assert.equal(p.wallet,wallet);
  const a=p.words.a.recognition;
  assert.ok(a.due>now+balance.reviewIntervalsMinutes[0]*60000,'known word rests longer than a fresh right answer');
  assert.equal(a.learned,true);
  assert.equal(p.words.b.recognition.stage,5,'a stronger record is left alone');
  assert.equal(learnedAtLevel(p,[{id:'a',level:1},{id:'b',level:1}],1),2);
  assert.deepEqual(p.learning.levels.placement,{level:1,day:4});
  assert.equal(canPlace(p),false);
  p.dayIndex=5;
  assert.equal(canPlace(p),true);
  assert.deepEqual(decodeProfile(JSON.stringify(p)).learning.levels.placement,{level:1,day:4});
});

test('a mock exam passes at 16 and gives its certificate only the first time',()=>{
  const p=freshProfile();
  assert.deepEqual(finishMock(p,1,15),{passed:false,certificate:null});
  assert.equal(p.inventory['hsk-cert-1'],undefined);
  assert.deepEqual(finishMock(p,1,16),{passed:true,certificate:'hsk-cert-1'});
  assert.deepEqual(finishMock(p,1,20),{passed:true,certificate:null});
  assert.equal(p.inventory['hsk-cert-1'],1);
  assert.deepEqual(decodeProfile(JSON.stringify(p)).learning.levels.passed,{'1':0});
});
