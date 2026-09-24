import test from 'node:test';
import assert from 'node:assert/strict';
import {festivalOn,festivalPay,riddleChoices,RIDDLES} from '../src/core/festivals.js';
import {todaysTasks,bump,claimTask} from '../src/core/daily.js';

const profile=day=>({wallet:0,dayIndex:day,claims:{}});

test('the last day of each week is a festival, cycling 春节, 元宵节, 端午节, 中秋节 by week',()=>{
  assert.deepEqual([6,13,20,27,34].map(d=>festivalOn(d)?.zh),['春节','元宵节','端午节','中秋节','春节']);
  for(const day of [0,1,5,7,12,14])assert.equal(festivalOn(day),null);
});

test('a festival payout is made once per festival, and never on an ordinary day',()=>{
  const p=profile(6);
  assert.equal(festivalPay(p,'hongbao-lin',8),8);
  assert.equal(festivalPay(p,'hongbao-lin',8),0);
  assert.equal(festivalPay(p,'hongbao-mei',8),8);
  assert.equal(p.wallet,16);
  p.dayIndex=34;                                   // the next 春节 pays again
  assert.equal(festivalPay(p,'hongbao-lin',8),8);
  p.dayIndex=35;
  assert.equal(festivalPay(p,'hongbao-chen',8),0);
  assert.equal(p.wallet,24);
});

test('a riddle offers its answer and three other answers',()=>{
  const riddle=RIDDLES[0],choices=riddleChoices(riddle);
  assert.equal(choices.length,4);
  assert.ok(choices.includes(riddle.answer));
  assert.equal(new Set(choices).size,4);
  assert.ok(choices.every(c=>RIDDLES.some(r=>r.answer===c)));
});

test('a festival day adds its errand to the day, and it pays when done',()=>{
  assert.equal(todaysTasks(profile(5),5).length,3);
  const p=profile(6),today=todaysTasks(p,6);
  assert.equal(today.length,4);
  const errand=today.find(t=>t.id==='bainian');
  assert.equal(errand.metric,'greeted');
  for(let i=0;i<3;i++)bump(p,'greeted');
  assert.deepEqual(claimTask(p,'bainian'),{ok:true,reward:12});
  assert.equal(todaysTasks(profile(20),20).some(t=>t.id==='zongzi'&&t.metric==='ate-zongzi'),true);
});
