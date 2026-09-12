import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,decodeProfile} from '../src/core/profile.js';

test('cooking reserves groceries once, survives a save, and yields a full-hunger meal once',async()=>{
  const c=await import('../src/core/cooking.js');
  let p=freshProfile();p.inventory={noodles:1,egg:1,vegetable:1};
  assert.equal(c.startCooking(p,'noodle-bowl').ok,true);
  assert.deepEqual(p.inventory,{vegetable:1});
  assert.equal(c.startCooking(p,'noodle-bowl').ok,false);
  c.tickCooking(p,10);p=decodeProfile(JSON.stringify(p));
  assert.equal(p.cooking.remaining,15);
  assert.equal(c.collectMeal(p).ok,false);
  c.tickCooking(p,15);assert.equal(c.collectMeal(p).ok,true);
  assert.equal(p.inventory['home-noodle-bowl'],1);
  assert.equal(c.collectMeal(p).ok,false);
});

test('missing groceries change nothing and cooking beats prepared food value without resale profit',async()=>{
  const c=await import('../src/core/cooking.js');
  const p=freshProfile();p.inventory={egg:1};const before=JSON.stringify(p);
  assert.equal(c.startCooking(p,'noodle-bowl').ok,false);assert.equal(JSON.stringify(p),before);
  for(const recipe of c.RECIPES){
    assert.ok(c.recipeCost(recipe)<c.preparedMealCost());
    assert.ok(c.recipeCost(recipe)>0);
  }
});

test('the stove is not a mint: no day, rapport or outfit makes a cooked meal resell for a profit',async()=>{
  const c=await import('../src/core/cooking.js');
  const {offerFor}=await import('../src/core/resale.js');
  const catalog=(await import('../src/content/catalog.json',{with:{type:'json'}})).default;
  // The best possible seller: known to the second-hand dealer, dressed head to foot, well fed.
  const rich=freshProfile();
  rich.vendors={resale:{rapport:1000}};
  rich.stats={hunger:100,energy:100,hour:12};
  for(const item of catalog)if(item.wear&&!rich.equipped[item.wear.slot])rich.equipped[item.wear.slot]=item.id;
  for(const recipe of c.RECIPES){
    const dish=catalog.find(item=>item.id===recipe.output);
    let best=0;
    for(let day=0;day<400;day++)best=Math.max(best,offerFor(rich,dish,day));
    assert.ok(best<=c.recipeCost(recipe),recipe.id+' resells for '+best+' against a cost of '+c.recipeCost(recipe));
  }
});

test('serving a meal is what counts towards the day, and the errand list can ask for one',async()=>{
  const c=await import('../src/core/cooking.js');
  const {todaysTasks}=await import('../src/core/daily.js');
  const p=freshProfile();
  p.inventory={'rice-grain':1,tomato:1,tofu:1};
  assert.equal(c.startCooking(p,'tomato-rice').ok,true);
  assert.equal(p.daily?.counts?.cooked??0,0);          // on the stove is not the same as cooked
  c.tickCooking(p,999);
  assert.equal(c.collectMeal(p).ok,true);
  assert.equal(p.daily.counts.cooked,1);
  // The metric is dead weight unless some day's errands actually ask for it.
  const asked=new Set();
  for(let day=0;day<80;day++)for(const task of todaysTasks(freshProfile(),day))asked.add(task.metric);
  assert.ok(asked.has('cooked'));
});

test('a recipe with learnedBy is locked until its flag is granted, and collecting it marks cooked: once',async()=>{
  const c=await import('../src/core/cooking.js');
  const recipe=c.recipeById('tomato-egg-noodles');
  const p=freshProfile();p.inventory={noodles:1,egg:1,tomato:1};
  assert.equal(c.cookingProblem(p,recipe),'locked');
  assert.equal(c.startCooking(p,'tomato-egg-noodles').ok,false);

  p.completed.push('recipe:tomato-egg-noodles');
  assert.equal(c.cookingProblem(p,recipe),null);
  assert.equal(c.startCooking(p,'tomato-egg-noodles').ok,true);
  c.tickCooking(p,999);
  assert.equal(c.collectMeal(p).ok,true);
  assert.equal(p.completed.filter(f=>f==='cooked:tomato-egg-noodles').length,1);

  // Cooking and collecting it a second time does not duplicate the mission flag.
  p.inventory={noodles:1,egg:1,tomato:1};
  assert.equal(c.startCooking(p,'tomato-egg-noodles').ok,true);
  c.tickCooking(p,999);
  assert.equal(c.collectMeal(p).ok,true);
  assert.equal(p.completed.filter(f=>f==='cooked:tomato-egg-noodles').length,1);

  // The existing, always-open recipes are unaffected by the gate.
  assert.equal(c.cookingProblem(freshProfile(),c.recipeById('noodle-bowl')),'ingredients');
});

test('a locked recipe stays locked while another pot is on the stove',async()=>{
  const c=await import('../src/core/cooking.js');
  const p=freshProfile();p.inventory={noodles:1,egg:1,tomato:1};
  p.cooking={recipe:'noodle-bowl',remaining:5};
  assert.equal(c.cookingProblem(p,c.recipeById('tomato-egg-noodles')),'locked');
  // An open recipe still reports the busy pot, as before.
  assert.equal(c.cookingProblem(p,c.recipeById('noodle-bowl')),'busy');
});

