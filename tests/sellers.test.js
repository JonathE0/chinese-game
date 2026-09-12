import test from 'node:test';
import assert from 'node:assert/strict';
import {sellersOf,whereToBuy} from '../src/core/sellers.js';
import city from '../src/content/city.json' with {type:'json'};

test('sellersOf finds the supermarket, at its door, for a grocery item',()=>{
  const sellers=sellersOf('egg');
  assert.equal(sellers.length,1);
  assert.deepEqual(sellers[0],{shop:'supermarket',zh:'青禾超市',en:'Qinghe supermarket',district:'market',x:28,z:-5.9});
});

test('sellersOf finds both the town shop and the city department store for a build material',()=>{
  const sellers=sellersOf('timber');
  assert.equal(sellers.length,2);
  const town=sellers.find(s=>s.shop==='homeware');
  assert.deepEqual(town,{shop:'homeware',zh:'家居小铺',en:'Home goods',district:'square',x:-17.5,z:0.2});
  const dept=sellers.find(s=>s.shop==='hardware');
  assert.equal(dept.city,true);
  assert.equal(dept.zh,'星光五金百货');
  // The city seller points at the town's own metro stair, not anywhere in the city.
  assert.equal(dept.x,city.station.x);
  assert.equal(dept.z,city.station.z-3);
  assert.equal(dept.district,'square');
});

test('sellersOf finds an NPC stall',()=>{
  const sellers=sellersOf('postcard');
  assert.equal(sellers.length,1);
  assert.equal(sellers[0].shop,'chen');
  assert.equal(sellers[0].zh,'陈叔叔 · 小商店');
  assert.equal(sellers[0].en,'Uncle Chen');
  assert.equal(sellers[0].district,'square');
});

test('sellersOf returns nothing for an id that is not sold anywhere',()=>{
  assert.deepEqual(sellersOf('not-a-real-item'),[]);
});

test('whereToBuy groups several needs by seller, and collects what nobody sells',()=>{
  const {sellers,unsold}=whereToBuy([
    {id:'egg',short:2},
    {id:'noodles',short:1},
    {id:'home-noodle-bowl',short:1},
  ]);
  assert.equal(sellers.length,1);
  assert.equal(sellers[0].seller.shop,'supermarket');
  assert.equal(sellers[0].items.length,2);
  assert.deepEqual(sellers[0].items.map(i=>i.id).sort(),['egg','noodles']);
  assert.equal(sellers[0].items[0].short,2);
  assert.equal(unsold.length,1);
  assert.equal(unsold[0].id,'home-noodle-bowl');
  assert.equal(unsold[0].zh,'家常鸡蛋汤面');
  assert.equal(unsold[0].short,1);
});

test('whereToBuy lists town sellers before city sellers',()=>{
  const {sellers}=whereToBuy([{id:'timber',short:3}]);
  assert.equal(sellers.length,2);
  assert.equal(sellers[0].seller.city,undefined);
  assert.equal(sellers[1].seller.city,true);
});
