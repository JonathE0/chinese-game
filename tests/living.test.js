import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,decodeProfile} from '../src/core/profile.js';
import {readStats,tickStats,eat,sleep,speedFactor,impression} from '../src/core/stats.js';
import {LOANS,takeLoan,repay,settleDays,debtOf,isOverdue,totalDue} from '../src/core/finance.js';
import {todaysTasks,bump,claimTask,syncDay} from '../src/core/daily.js';
import {offerFor,sellable,sell} from '../src/core/resale.js';
import {Registry} from '../src/world/registry.js';

const at=(x,y,z)=>({x,y,z});

test('only time actually played costs you hunger; setting the clock does not', () => {
  const p = freshProfile();
  p.stats = {hunger:80,energy:85,hour:9};
  tickStats(p,10);                                   // one hour of walking around
  assert.ok(readStats(p).hunger < 78 && readStats(p).hunger > 77);
  // A reload, a sleep or a tab coming back moves the clock by more than a frame: resync only.
  const before = readStats(p).hunger;
  tickStats(p,20);
  assert.equal(readStats(p).hunger, before);
  assert.equal(readStats(p).hour, 20);
  // Crossing midnight between two frames is a tiny step forward, not a day backwards.
  p.stats = {hunger:80,energy:85,hour:23.99};
  tickStats(p,0.01);
  assert.ok(readStats(p).hunger > 79.8);
});

test('eating and sleeping restore what walking around costs, within bounds', () => {
  const p = freshProfile();
  p.stats = {hunger:20,energy:12,hour:12};
  eat(p,{nutrition:42});
  assert.equal(readStats(p).hunger,62);
  sleep(p,8);
  assert.equal(readStats(p).energy,100);
  assert.ok(readStats(p).hunger < 62);               // a night still costs something
  eat(p,{nutrition:500});
  assert.equal(readStats(p).hunger,100);             // never above full
  assert.equal(eat(p,{}),null);                      // a hat is not food
});

test('hunger and tiredness slow you down, shoes speed you up, and nothing stops you dead', () => {
  const p = freshProfile();
  assert.equal(speedFactor(p),1);
  p.stats = {hunger:5,energy:5,hour:12};
  const starving = speedFactor(p);
  assert.ok(starving >= .55 && starving < .7);       // a limp, not a halt
  p.stats = {hunger:90,energy:90,hour:12};
  p.equipped = {shoes:'sport-shoes'};
  assert.ok(speedFactor(p) > 1.1);
  p.equipped = {shoes:'travel-hat'};                 // a hat in the shoe slot changes nothing
  assert.equal(speedFactor(p),1);
});

test('impression rises with a full outfit and falls when you are owing or worn out', () => {
  const p = freshProfile();
  const plain = impression(p);
  p.equipped = {hat:'travel-hat',shirt:'linen-shirt',trousers:'cotton-trousers',shoes:'sport-shoes'};
  const dressed = impression(p);
  assert.ok(dressed > plain);
  assert.ok(impression(p,{overdue:true}) < dressed);
  p.stats = {hunger:10,energy:10,hour:12};
  assert.ok(impression(p) < dressed);
  assert.ok(impression(p) >= 0 && impression(p) <= 1);
});

test('a loan is repaid daily, a missed day adds a fee, and only one runs at a time', () => {
  const p = freshProfile(); p.wallet = 0;
  const loan = LOANS[0];
  assert.equal(takeLoan(p,loan,0).ok,true);
  assert.equal(p.wallet,loan.amount);
  assert.equal(debtOf(p).owed,totalDue(loan));
  assert.equal(takeLoan(p,LOANS[1],0).ok,false);      // no second loan on top

  settleDays(p,1);                                    // affordable: taken from the wallet
  assert.equal(debtOf(p).owed,totalDue(loan)-debtOf(p).perDay);
  assert.equal(isOverdue(p),false);

  p.wallet = 0;
  const owedBefore = debtOf(p).owed;
  settleDays(p,2);
  assert.ok(debtOf(p).owed > owedBefore);             // a late fee, not a repossession
  assert.equal(isOverdue(p),true);

  p.wallet = 999;
  assert.equal(repay(p,debtOf(p).owed).cleared,true);
  assert.equal(debtOf(p),null);
  assert.equal(repay(p,10).ok,false);
});

test('days missed while the game was closed are all settled, and never more than the balance', () => {
  const p = freshProfile(); p.wallet = 0;
  takeLoan(p,LOANS[1],0);
  p.wallet = 10000;
  settleDays(p,99);
  assert.equal(debtOf(p),null);
  assert.ok(p.wallet > 10000-totalDue(LOANS[1])-1 && p.wallet <= 10000);
});

test('three errands a day, stable within the day, and each pays exactly once', () => {
  const p = freshProfile();
  const today = todaysTasks(p,4);
  assert.equal(today.length,3);
  assert.deepEqual(today.map(t=>t.id),todaysTasks(p,4).map(t=>t.id));
  assert.notDeepEqual(today.map(t=>t.id),todaysTasks(p,5).map(t=>t.id));

  p.dayIndex = 4; syncDay(p,4);
  const task = today[0];
  for(let i=0;i<task.goal;i++) bump(p,task.metric);
  assert.equal(todaysTasks(p,4).find(t=>t.id===task.id).done,true);
  const paid = claimTask(p,task.id);
  assert.equal(paid.ok,true);
  assert.equal(p.wallet,task.reward);
  assert.equal(claimTask(p,task.id).ok,false);
  // A new day wipes the counters and the claims.
  assert.equal(todaysTasks(p,5).every(t=>!t.claimed&&t.have===0),true);
});

test('the second-hand shop pays a stable price per day, and never for furniture in use', () => {
  const p = freshProfile();
  const hat = {id:'travel-hat',price:24};
  assert.equal(offerFor(p,hat,3),offerFor(p,hat,3));
  const week = new Set([0,1,2,3,4,5,6].map(day=>offerFor(p,hat,day)));
  assert.ok(week.size > 1);                            // it really is rerolled
  for(const offer of week) assert.ok(offer > 0 && offer <= hat.price);

  p.inventory = {'wooden-bed':1,'low-table':2};
  p.home = [{uid:'a',item:'wooden-bed',kind:'bed',color:'#fff',footprint:[2,1],x:0,z:0,rot:0}];
  const rows = sellable(p,2);
  assert.deepEqual(rows.map(r=>r.item.id),['low-table']);   // the bed is standing in the room
  assert.equal(rows[0].spare,2);

  const offer = rows[0].offer;
  assert.equal(sell(p,rows[0].item,offer).ok,true);
  assert.equal(p.inventory['low-table'],1);
  assert.equal(p.wallet,offer);
  assert.equal(sell(p,rows[0].item,9999).ok,false);         // never above the list price
});

test('a round hitbox follows the stone instead of a square that sticks out past it', () => {
  const registry = new Registry();
  registry.add({place:'town',x:0,z:0,radius:2,y0:0,y1:1,name:{id:'fountain'}});
  // The diagonal corner of the equivalent square is outside the basin, so you can stand there.
  assert.equal(registry.blocks('town',1.9,0,0),true);
  assert.equal(registry.blocks('town',1.7,1.7,0),false);
  // A ray down the x axis enters the circle at its edge, not at the corner of a box.
  const seen = registry.look('town',at(-6,.5,0),at(1,0,0));
  assert.equal(seen.box.name.id,'fountain');
  assert.ok(Math.abs(seen.distance-4) < 1e-6);
  assert.equal(registry.look('town',at(-6,.5,2.5),at(1,0,0)),null);   // passes by the side
  assert.equal(registry.look('town',at(-6,3,0),at(1,0,0)),null);      // passes over the top
});

test('saves survive hunger, debts and errands, and reject impossible ones', () => {
  const p = freshProfile();
  p.stats = {hunger:42.5,energy:60,hour:11.25};
  takeLoan(p,LOANS[0],2);
  bump(p,'reviews',3);
  const back = decodeProfile(JSON.stringify(p));
  assert.deepEqual(back.stats,p.stats);
  assert.equal(back.debt.owed,p.debt.owed);
  assert.equal(back.daily.counts.reviews,3);
  for(const broken of [{...p,stats:{hunger:-4,energy:10,hour:1}},
                       {...p,debt:{loan:'small',owed:-1,perDay:5,nextDay:1,missed:0}},
                       {...p,daily:{day:-1,counts:{},claimed:[]}}])
    assert.throws(()=>decodeProfile(JSON.stringify(broken)));
});
