import test from 'node:test';
import assert from 'node:assert/strict';
import {TAXI_FARE,taxiFareProblem,payTaxiFare} from '../src/core/taxi.js';

test('taxiFareProblem says money is short below the fare, and nothing above it',()=>{
  assert.equal(taxiFareProblem({wallet:0}),'money');
  assert.equal(taxiFareProblem({wallet:TAXI_FARE-1}),'money');
  assert.equal(taxiFareProblem({wallet:TAXI_FARE}),null);
  assert.equal(taxiFareProblem({wallet:TAXI_FARE+50}),null);
});

test('too little money: no debit, and the reason is reported',()=>{
  const p={wallet:TAXI_FARE-1};
  const result=payTaxiFare(p);
  assert.equal(result.ok,false);
  assert.equal(result.reason,'money');
  assert.equal(p.wallet,TAXI_FARE-1);
});

test('enough money: exactly one debit of the fare',()=>{
  const p={wallet:12};
  const result=payTaxiFare(p);
  assert.equal(result.ok,true);
  assert.equal(result.cost,TAXI_FARE);
  assert.equal(p.wallet,12-TAXI_FARE);
});

test('a second ride charges again — each trip is its own fare, not a one-time toggle',()=>{
  const p={wallet:TAXI_FARE*2};
  assert.equal(payTaxiFare(p).ok,true);
  assert.equal(p.wallet,TAXI_FARE);
  assert.equal(payTaxiFare(p).ok,true);
  assert.equal(p.wallet,0);
  // Now the wallet is exactly empty, one fare short of a third ride.
  assert.equal(taxiFareProblem(p),'money');
  const third=payTaxiFare(p);
  assert.equal(third.ok,false);
  assert.equal(p.wallet,0);
});
