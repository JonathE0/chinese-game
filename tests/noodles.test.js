import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile} from '../src/core/profile.js';

test('each dish and size prices its own bowl, and a large bowl is better value than a small one',async()=>{
  const {noodleItem}=await import('../src/core/noodles.js');
  assert.equal(noodleItem('beef','small').price,16);
  assert.equal(noodleItem('beef','large').price,19);
  assert.equal(noodleItem('egg','small').price,12);
  assert.equal(noodleItem('egg','large').price,15);
  const valueOf=item=>item.nutrition/item.price;
  assert.ok(valueOf(noodleItem('beef','large'))>valueOf(noodleItem('beef','small')));
  assert.ok(valueOf(noodleItem('egg','large'))>valueOf(noodleItem('egg','small')));
});

test('an order that cannot be afforded changes nothing',async()=>{
  const {orderNoodles}=await import('../src/core/noodles.js');
  const p=freshProfile();p.wallet=5;
  const before=JSON.stringify(p);
  assert.equal(orderNoodles(p,'beef','large','here').ok,false);
  assert.equal(JSON.stringify(p),before);
});

test('eating here pays once, never keeps the bowl, and restores hunger',async()=>{
  const {orderNoodles}=await import('../src/core/noodles.js');
  const p=freshProfile();p.wallet=30;p.stats={hunger:20,energy:80,hour:12};
  const result=orderNoodles(p,'beef','small','here');
  assert.equal(result.ok,true);
  assert.equal(p.wallet,14);
  assert.equal(p.inventory['city-beef-noodles-small']??0,0);
  assert.ok(p.stats.hunger>20);
  assert.equal(p.daily.counts.meals,1);
  assert.equal(p.daily.counts['bought-food'],1);
});

test('takeaway pays once and puts exactly one bowl in the bag, unopened',async()=>{
  const {orderNoodles}=await import('../src/core/noodles.js');
  const p=freshProfile();p.wallet=30;p.stats={hunger:20,energy:80,hour:12};
  const result=orderNoodles(p,'egg','large','takeaway');
  assert.equal(result.ok,true);
  assert.equal(p.wallet,15);
  assert.equal(p.inventory['city-egg-noodles-large'],1);
  assert.equal(p.stats.hunger,20);              // nothing eaten yet
  assert.equal(p.daily.counts.meals??0,0);
  assert.equal(p.daily.counts['bought-food'],1);
});

test('the cook teaches the home recipe once, free of charge',async()=>{
  const {learnNoodleRecipe,RECIPE_FLAG}=await import('../src/core/noodles.js');
  const p=freshProfile();
  assert.equal(learnNoodleRecipe(p),true);
  assert.equal(p.completed.filter(f=>f===RECIPE_FLAG).length,1);
  assert.equal(learnNoodleRecipe(p),false);
  assert.equal(p.completed.filter(f=>f===RECIPE_FLAG).length,1);
});

test('a paid bowl counts as the player\'s first purchase, like any shop sale',async()=>{
  const {orderNoodles}=await import('../src/core/noodles.js');
  const p=freshProfile();p.wallet=30;
  orderNoodles(p,'egg','small','takeaway');
  orderNoodles(p,'egg','small','takeaway');
  assert.equal(p.completed.filter(f=>f==='purchase:first').length,1);
  const broke=freshProfile();broke.wallet=1;
  orderNoodles(broke,'egg','small','here');
  assert.ok(!broke.completed.includes('purchase:first'));
});

test('first visit with enough money: the recipe is taught, then the bowl is confirmed and paid',async()=>{
  const {startNoodleOrder,settleNoodleOrder,RECIPE_FLAG}=await import('../src/core/noodles.js');
  const p=freshProfile();p.wallet=30;p.stats={hunger:20,energy:80,hour:12};
  const order={dish:'egg',size:'large',spice:'none',where:'here'};
  const plan=startNoodleOrder(p,order);
  assert.equal(plan.taught,true);
  assert.equal(plan.step,'confirm');
  assert.equal(plan.item.id,'city-egg-noodles-large');
  assert.ok(p.completed.includes(RECIPE_FLAG));
  assert.equal(p.wallet,30);                          // nothing charged until the confirmation
  const settled=settleNoodleOrder(p,order,'confirm');
  assert.equal(settled.ok,true);
  assert.equal(settled.line,'served-here');
  assert.equal(p.wallet,15);
});

test('first visit without enough money: the recipe is still taught, nothing is charged, and the cook says so',async()=>{
  const {startNoodleOrder,RECIPE_FLAG}=await import('../src/core/noodles.js');
  const p=freshProfile();p.wallet=5;
  const plan=startNoodleOrder(p,{dish:'beef',size:'large',spice:'hot',where:'takeaway'});
  assert.equal(plan.taught,true);
  assert.equal(plan.step,'cant-afford');
  assert.ok(p.completed.includes(RECIPE_FLAG));
  assert.equal(p.wallet,5);
  assert.deepEqual(p.inventory,{});
});

test('cancelling the confirmation changes nothing, and says so',async()=>{
  const {startNoodleOrder,settleNoodleOrder}=await import('../src/core/noodles.js');
  const p=freshProfile();p.wallet=30;
  const order={dish:'beef',size:'small',spice:'mild',where:'takeaway'};
  startNoodleOrder(p,order);
  const before=JSON.stringify(p);
  const settled=settleNoodleOrder(p,order,'cancel');
  assert.equal(settled.ok,false);
  assert.equal(settled.line,'cancelled');
  assert.equal(JSON.stringify(p),before);
});

test('a second visit does not teach the recipe again',async()=>{
  const {startNoodleOrder,RECIPE_FLAG}=await import('../src/core/noodles.js');
  const p=freshProfile();p.wallet=60;
  const order={dish:'egg',size:'small',spice:'none',where:'here'};
  assert.equal(startNoodleOrder(p,order).taught,true);
  const again=startNoodleOrder(p,order);
  assert.equal(again.taught,false);
  assert.equal(again.step,'confirm');
  assert.equal(p.completed.filter(f=>f===RECIPE_FLAG).length,1);
});
