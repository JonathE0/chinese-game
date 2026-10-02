import test from 'node:test';
import assert from 'node:assert/strict';
import {topUpCard,enterJourney,boardJourney,completeJourney,announcementReward,normalizeMetro} from '../src/core/metro.js';

const traveller=()=>{const p={wallet:30,dayIndex:0};topUpCard(p,20);return p;};
const ride=p=>{const {id}=enterJourney(p,'qinghe','yunhai');boardJourney(p,id);return id;};

test('catching the announcement pays one coin once per ride, only on a ride, and again on the next ride',()=>{
  const p=traveller();
  assert.equal(announcementReward(p),0,'nothing to hear before boarding');
  const first=ride(p),before=p.wallet;
  assert.equal(announcementReward(p),1);
  assert.equal(announcementReward(p),0,'a second right answer on the same ride pays nothing');
  completeJourney(p,first);
  assert.equal(announcementReward(p),0,'nor after arriving');
  ride(p);
  assert.equal(announcementReward(p),1,'the ride home is a new ride');
  assert.equal(p.wallet,before+2);
});

test('a save remembers which ride was already paid for, and an old save\'s last ride does not block the next',()=>{
  const p=traveller();
  ride(p);announcementReward(p);
  const back={...p,metro:normalizeMetro(JSON.parse(JSON.stringify(p.metro)))};
  assert.equal(announcementReward(back),0);
  // Before the card, `heard` was the number of the trip just taken.
  const old={wallet:0,dayIndex:0,metro:{balance:10,trips:3,heard:3}};
  ride(old);
  assert.equal(announcementReward(old),1);
});

test('a bad card or journey field is dropped on its own; the rest of the travel record stays',()=>{
  const repairs=[];
  const out=normalizeMetro({balance:'lots',sequence:-1,fade:'yes',journey:{id:'x'},trips:4,passUntil:9,heard:2},()=>repairs.push('metro'));
  assert.deepEqual(out,{balance:0,trips:4,passUntil:9,heard:2});
  assert.ok(repairs.length>0);
  const noted=[];
  assert.equal(normalizeMetro({balance:12.7,trips:1},()=>noted.push(1)).balance,12,'a fractional balance rounds down');
  assert.ok(noted.length>0,'and says so');
  assert.throws(()=>normalizeMetro('x'),'not a record at all');
  const clean=[];
  normalizeMetro({balance:5,trips:1,sequence:2,fade:true,journey:{id:2,origin:'yunhai',destination:'qinghe',cost:5,phase:'reserved'}},()=>clean.push(1));
  assert.deepEqual(clean,[]);
});
