import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Every shop has a counter that fits its trade and a shop assistant behind it who talks
// (docs/superpowers/plans/2026-09-25-development-wave.md, D1-shops).
const load=f=>JSON.parse(readFileSync(new URL(`../src/content/${f}.json`,import.meta.url),'utf8'));
const rooms=load('rooms'),assistants=load('assistants'),voices=load('voices');
const COUNTERS={bakery:'bakerycounter',cafe:'espressobar',bank:'bankcounter',pharmacy:'checkout',supermarket:'checkoutlane',
  library:'lendingdesk',lights:'lightcounter',homeware:'wrapdesk',teahouse:'teabar',hardware:'tradecounter',
  'post-office':'postcounter','clothes-shop':'checkout',lifestyle:'checkout'};

test('each shop has its own counter instead of the generic lectern',()=>{
  for(const [id,kind] of Object.entries(COUNTERS)){
    assert.equal(rooms[id].lectern,undefined,`${id} still has the generic counter`);
    assert.ok(rooms[id].fittings.some(f=>f.kind===kind),`${id} has no ${kind}`);
  }
});

test('a shop with goods opens them from its counter',()=>{
  for(const [id,want] of [['supermarket','shop:supermarket'],['bank','panel:bank'],['library','panel:library'],['hardware','shop:hardware']]){
    const counter=rooms[id].fittings.find(f=>f.kind===COUNTERS[id]);
    assert.equal(counter.action,want,`${id} counter`);
    assert.ok(counter.label,`${id} counter needs a label`);
  }
});

test('every shop has a talking assistant, with a line of its own',()=>{
  for(const id of Object.keys(COUNTERS)){
    const helpers=(rooms[id].staff??[]).filter(s=>s.look);
    assert.equal(helpers.length,1,`${id} should have one shop assistant`);
    assert.notEqual(helpers[0].talk,false,`${id}'s assistant should talk`);
    assert.ok(assistants.lines['shop-'+id]?.zh,`${id} has no assistant line`);
  }
  for(const id of ['restaurant','resale'])assert.ok(!(rooms[id].staff??[]).some(s=>s.look==='clerk'),`${id} gets no clerk`);
});

test('assistant lines are complete and cast to an existing voice',()=>{
  assert.ok(voices.cast[assistants.speaker],'unknown speaker');
  for(const key of ['greet','browse','find','pay','bye'])assert.ok(assistants.lines[key],`missing ${key}`);
  for(const [key,line] of Object.entries(assistants.lines))
    for(const field of ['zh','pinyin','en'])assert.ok(line[field]?.trim(),`${key} missing ${field}`);
  for(const key of ['browse','bye'])assert.ok(assistants.ui[key]?.zh&&assistants.ui[key]?.en,`ui ${key}`);
  assert.deepEqual(assistants.postcard,['post-office'],'only the post office offers postcard writing');
});

test('the restaurant and the second-hand shop have counters of their own too, and no shop keeps the generic lectern',()=>{
  for(const [id,kind,action] of [['restaurant','servicecounter','shop:restaurant'],['resale','resalecounter','panel:resale']]){
    assert.equal(rooms[id].lectern,undefined,`${id} still has the generic counter`);
    const counter=rooms[id].fittings.find(f=>f.kind===kind);
    assert.equal(counter?.action,action,`${id} counter`);
  }
  assert.deepEqual(Object.keys(rooms).filter(id=>rooms[id].lectern),['hall']);
});
