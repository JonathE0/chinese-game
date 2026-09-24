import test from 'node:test';
import assert from 'node:assert/strict';
import {board,returnTrip,buyTickets,announcementReward,normalizeMetro} from '../src/core/metro.js';

const traveller=()=>({wallet:20,dayIndex:0});

test('catching the announcement pays one coin once per ride, and again on the next ride',()=>{
  const p=traveller();
  buyTickets(p,1);board(p);
  const before=p.wallet;
  assert.equal(announcementReward(p),1);
  assert.equal(announcementReward(p),0,'a second right answer on the same ride pays nothing');
  assert.equal(p.wallet,before+1);
  returnTrip(p);
  assert.equal(announcementReward(p),1,'the ride home is a new ride');
  assert.equal(p.wallet,before+2);
});

test('a save remembers which ride was already paid for',()=>{
  const p=traveller();
  buyTickets(p,1);board(p);announcementReward(p);
  const loaded={...traveller(),metro:normalizeMetro(JSON.parse(JSON.stringify(p.metro)))};
  assert.equal(announcementReward(loaded),0);
  assert.throws(()=>normalizeMetro({rides:0,trips:1,heard:-1}));
});
