import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {itemArt} from '../src/ui/art.js';

const catalog=JSON.parse(readFileSync(new URL('../src/content/catalog.json',import.meta.url)));
const pairs=[['lamb-skewer','noodles'],['tofu','egg'],['tomato','fruit'],['timber','pen'],['brick','postcard'],['cloth-bolt','linen-shirt'],['egg-tart','cake'],['strawberry-donut','cake'],['red-bean-bun','bread'],['pineapple-bun','bread'],['candied-hawthorn','fruit'],['round-stool','wooden-chair'],['bamboo-mat','floor-rug'],['ceiling-lamp','desk-lamp'],['paper-lamp','desk-lamp'],['straw-sandals','sport-shoes'],['cloth-shoes','sport-shoes'],['tea-set','pot-tea'],['rice-grain','steamed-rice'],['tofu-pudding','steamed-rice'],['city-sandwich','bread'],['city-tea-can','pot-tea'],['city-map','postcard']];
test('distinct products no longer reuse a misleading picture',()=>{
 for(const [a,b] of pairs){
  const left=catalog.find(i=>i.id===a),right=catalog.find(i=>i.id===b);
  assert.notEqual(itemArt(left.visual),itemArt(right.visual),`${a} still looks like ${b}`);
  assert.notEqual(itemArt(left.visual),itemArt('unknown'),`${a} has no drawing`);
 }
});
test('unknown pictures use a neutral placeholder, never a postcard',()=>{
 assert.notEqual(itemArt('unknown'),itemArt('postcard'));
});
