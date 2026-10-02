import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile} from '../src/core/profile.js';
import {biteAfter,reelResult,fishFor,landFish,fishLeft,basketRight,pickInto,putBack,harvest,CAUGHT_FLAG,VEG_FLAG} from '../src/core/fields.js';
import fields from '../src/content/fields.json' with {type:'json'};
import catalog from '../src/content/catalog.json' with {type:'json'};
import objects from '../src/content/objects.json' with {type:'json'};

const F=fields.fishing,V=fields.vegetables;

test('the float dips after a wait inside the configured range',()=>{
  assert.equal(biteAfter(()=>0),F.wait[0]);
  assert.equal(biteAfter(()=>1),F.wait[1]);
  const mid=biteAfter(()=>.5);
  assert.ok(mid>F.wait[0]&&mid<F.wait[1]);
});

test('reeling in before the dip is too early, inside the window catches, after it is too late',()=>{
  const bite=3;
  assert.equal(reelResult(0,bite),'early');
  assert.equal(reelResult(bite-.01,bite),'early');
  assert.equal(reelResult(bite,bite),'caught');
  assert.equal(reelResult(bite+F.window,bite),'caught');
  assert.equal(reelResult(bite+F.window+.01,bite),'late');
  assert.ok(F.window>=.6,'the window is long enough for a trackpad tap or a touch');
});

test('the first catch is always a carp, later ones any of the three fish',()=>{
  const p=freshProfile();
  assert.equal(fishFor(p,()=>.99),'carp');
  landFish(p,'carp');
  assert.ok(p.completed.includes(CAUGHT_FLAG));
  assert.equal(p.inventory.carp,1);
  const seen=new Set([0,.4,.99].map(r=>fishFor(p,()=>r)));
  assert.deepEqual([...seen].sort(),[...F.fish].sort());
  for(const id of F.fish){
    const item=catalog.find(i=>i.id===id);
    assert.ok(item,`${id} is a catalog item`);
    assert.equal(item.category,'food');
    assert.ok(item.sellable!==false&&item.buyer,'a fish can be sold where food is bought');
    assert.deepEqual([].concat(item.shop),[],'nobody sells fish: you catch them');
  }
});

test('the fish stop biting after the day\'s catch, and bite again the next day',()=>{
  const p=freshProfile();p.dayIndex=3;
  for(let i=0;i<F.perDay;i++){assert.ok(fishLeft(p)>0);landFish(p,'carp');}
  assert.equal(fishLeft(p),0);
  p.dayIndex=4;
  assert.equal(fishLeft(p),F.perDay);
});

test('the basket is right only with exactly what Grandma Liu asked for',()=>{
  assert.deepEqual(V.order,{tomato:3,cucumber:2});
  const basket={};
  assert.equal(basketRight(basket),false,'an empty basket');
  for(let i=0;i<3;i++)pickInto(basket,'tomato');
  pickInto(basket,'cucumber');
  assert.equal(basketRight(basket),false,'a cucumber short');
  pickInto(basket,'cucumber');
  assert.equal(basketRight(basket),true);
  pickInto(basket,'carrot');
  assert.equal(basketRight(basket),false,'an extra carrot');
  putBack(basket,'carrot');
  assert.deepEqual(basket,{tomato:3,cucumber:2},'putting the extra back leaves no empty entry');
  assert.equal(basketRight(basket),true);
  putBack(basket,'aubergine');
  assert.deepEqual(basket,{tomato:3,cucumber:2},'putting back what is not there changes nothing');
  for(const id of Object.keys(V.order))assert.ok(objects.objects[id],`${id} has a look name`);
});

test('her thanks pays coins and the vegetables as cooking ingredients, once',()=>{
  const p=freshProfile(),wallet=p.wallet;
  const first=harvest(p);
  assert.equal(first.coins,V.reward.coins);
  assert.equal(p.wallet,wallet+V.reward.coins);
  for(const [id,n] of Object.entries(V.reward.items)){
    assert.ok(catalog.find(i=>i.id===id),`${id} is a catalog item`);
    assert.equal(p.inventory[id],n);
  }
  assert.ok(V.reward.items.tomato,'the catalog\'s own tomato');
  assert.ok(p.completed.includes(VEG_FLAG));
  const again=harvest(p);
  assert.deepEqual(again,{coins:0,items:{}});
  assert.equal(p.wallet,wallet+V.reward.coins);
});

test('the minimap leads to the countryside through the park, and back the same way',async()=>{
  const {Shell}=await import('../src/ui/shell.js');
  const world=(await import('../src/content/world.json',{with:{type:'json'}})).default;
  const at=id=>world.districts.find(d=>d.id===id);
  const leg=(from,to)=>Shell.prototype.routeLeg.call({route:{district:to,x:1,z:2}},world,at(from));
  const fields=at('fields').gate,park=at('garden').gate,market=at('market').gate;
  assert.deepEqual(leg('garden','fields'),{x:fields.x,z:fields.z,via:'青禾田园'});
  assert.deepEqual(leg('square','fields'),{x:park.x,z:park.z,via:'莲池公园'});
  assert.deepEqual(leg('fields','square'),{x:fields.x,z:fields.z,via:'莲池公园'});
  assert.deepEqual(leg('fields','market'),{x:fields.x,z:fields.z,via:'莲池公园'});
  assert.deepEqual(leg('garden','square'),{x:park.x,z:park.z,via:'青禾广场'});
  assert.deepEqual(leg('fields','fields'),{x:1,z:2});
  // The rest of the town is as it was: out through your own gate to the square, in through the next.
  assert.deepEqual(leg('square','market'),{x:market.x,z:market.z,via:'商业街'});
  assert.deepEqual(leg('market','riverside'),{x:market.x,z:market.z,via:'青禾广场'});
});
