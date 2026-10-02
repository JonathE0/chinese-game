import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {Converter} from 'opencc-js';
import {matchAnswer,parseOffer,normalize,setFold} from '../src/core/language.js';
import {freshProfile,decodeProfile} from '../src/core/profile.js';

// 简体字 / 繁體字 (docs/superpowers/plans/2026-09-30-development-wave-4.md, W4-script): with traditional
// on, what the player types is folded back to the simplified every answer is written in.
const toTrad=Converter({from:'cn',to:'tw'}),toSimp=Converter({from:'tw',to:'cn'});

test('typed traditional folds to simplified only while the fold is on', () => {
  const node={accepted:['你好谢谢']};
  setFold(null);
  assert.equal(matchAnswer('你好謝謝',node).ok,false);
  setFold(toSimp);
  try {
    assert.equal(matchAnswer('你好謝謝！',node).ok,true);
    assert.equal(matchAnswer('你好谢谢',node).ok,true,'simplified still matches');
    assert.equal(normalize('Ｈｉ，謝謝'),'hi谢谢');
    assert.equal(parseOffer('兩塊可以嗎？'),2);
    assert.equal(matchAnswer('我叫安娜',{intent:'name'}).value,'安娜');
    assert.equal(matchAnswer('我叫誰',{intent:'name'}).ok,false,'a traditional question word is still no name');
  } finally { setFold(null); }
});

test('every authored answer is still accepted when typed in traditional characters', () => {
  const nodes=[];
  const collect=v=>{if(Array.isArray(v))v.forEach(collect);else if(v&&typeof v==='object'){if(Array.isArray(v.accepted)&&v.intent!=='name')nodes.push(v);Object.values(v).forEach(collect);}};
  const walk=dir=>{for(const f of readdirSync(dir)){const p=join(dir,f);if(statSync(p).isDirectory())walk(p);else if(f.endsWith('.json')&&f!=='hsk-chinese.json')collect(JSON.parse(readFileSync(p,'utf8')));}};
  walk('src/content');
  assert.ok(nodes.length>20,'found the authored answers');
  setFold(toSimp);
  try {
    const missed=nodes.flatMap(node=>node.accepted.filter(a=>typeof a==='string'&&matchAnswer(a,node).ok&&!matchAnswer(toTrad(a),node).ok));
    assert.deepEqual(missed,[]);
  } finally { setFold(null); }
});

test('the 汉字 setting is kept in the save, and anything else there is dropped back to simplified', () => {
  const p=freshProfile();
  assert.equal(p.settings.script,undefined,'absent means simplified');
  for(const script of ['simplified','traditional']){
    p.settings.script=script;
    assert.equal(decodeProfile(JSON.stringify(p)).settings.script,script);
  }
  for(const bad of ['klingon',1,null]){
    p.settings.script=bad;
    assert.equal('script' in decodeProfile(JSON.stringify(p)).settings,false);
  }
});

test('haggling, politeness and spoken orders fold typed traditional too', async () => {
  const {negotiate}=await import('../src/core/economy.js');
  const {wasPolite}=await import('../src/core/vendor.js');
  const {matchSpoken}=await import('../src/core/order.js');
  const catalog=(await import('../src/content/catalog.json',{with:{type:'json'}})).default;
  const wonton=catalog.find(i=>i.id==='wonton'),item={price:24,minPrice:18,negotiable:true};
  setFold(toSimp);
  try {
    assert.ok(negotiate(item,24,0,'少一點吧').round>0,'少一點 asks for a discount');
    assert.equal(wasPolite('麻煩您，可以嗎'),true);
    assert.equal(wasPolite('請'),true);
    assert.deepEqual(matchSpoken('我要兩碗餛飩。',wonton),{ok:true,quantity:2});
  } finally { setFold(null); }
});
