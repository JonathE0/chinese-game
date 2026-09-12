import test from 'node:test';
import assert from 'node:assert/strict';
import { matchAnswer, normalize, parseOffer } from '../src/core/language.js';
import { reviewWord, familiarity } from '../src/core/review.js';
import { grant, negotiate, purchase } from '../src/core/economy.js';
import { freshProfile, decodeProfile } from '../src/core/profile.js';

test('normalization preserves meaning but removes punctuation and spaces', () => {
  assert.equal(normalize(' 你 好！ '), '你好');
  assert.equal(normalize('我不叫安娜。'), '我不叫安娜');
});
test('introductions accept variable names without accepting negation or unrelated sentences', () => {
  const node = { intent: 'name' };
  for (const text of ['我叫安娜。', '我的名字是小明', '你可以叫我李华', '安娜', 'Alex']) assert.equal(matchAnswer(text,node).ok,true,text);
  for (const text of ['我不叫安娜', '我不知道', '我喜欢喝茶', '', '<script>']) assert.equal(matchAnswer(text,node).ok,false,text);
});
test('curated alternatives accept colloquial replies and reject contradictory text', () => {
  const node = { intent:'variants', accepted:['你好','您好','嗨','你好啊'] };
  assert.equal(matchAnswer('嗨！',node).ok,true);
  assert.equal(matchAnswer('不好',node).ok,false);
});
test('offers parse Chinese and Arabic amounts but ask clarification for ambiguous amounts', () => {
  assert.equal(parseOffer('二十五可以吗？'),25);
  assert.equal(parseOffer('我只有18，够吗？'),18);
  assert.equal(parseOffer('十五还是二十？'),null);
  assert.equal(parseOffer('-5'),null);
  assert.equal(parseOffer('2.5'),null);
});
test('due reviews advance separately by skill and repeated practice cannot mint coins', () => {
  const p = freshProfile();
  reviewWord(p,'water','recognition',{correct:true,hinted:false,now:1000});
  assert.equal(p.wallet,3);
  assert.equal(p.words.water.recognition.due,601000);
  reviewWord(p,'water','recognition',{correct:true,hinted:false,now:2000});
  assert.equal(p.wallet,3);
  assert.equal(p.words.water.recognition.stage,1);
  reviewWord(p,'water','recognition',{correct:true,hinted:false,now:601000});
  assert.equal(p.words.water.recognition.due,87001000);
  assert.equal(p.wallet,6);
  assert.equal(p.words.water.production,undefined);
});
test('hints and errors return sooner without erasing prior learning', () => {
  const p = freshProfile();
  reviewWord(p,'tea','recognition',{correct:true,hinted:true,now:1000});
  assert.equal(p.words.tea.recognition.stage,0);
  assert.equal(p.wallet,1);
  reviewWord(p,'tea','recognition',{correct:false,hinted:false,now:601000});
  assert.equal(p.words.tea.recognition.due,721000);
  assert.equal(p.wallet,1);
  assert.equal(familiarity(p.words.tea.recognition,721000),'due');
});
test('grant is replay-safe and purchase is atomic for insufficient funds', () => {
  const p = freshProfile(); const item = {id:'hat',price:24,minPrice:18,negotiable:true};
  grant(p,'lesson:intro',20); grant(p,'lesson:intro',20);
  assert.equal(p.wallet,20);
  assert.equal(purchase(p,item,24).ok,false);
  assert.deepEqual(p.inventory,{});
  assert.equal(p.wallet,20);
  assert.equal(purchase(p,item,18).ok,true);
  assert.equal(p.wallet,2);
  assert.equal(p.inventory.hat,1);
  assert.equal(purchase(p,item,-1).ok,false);
});
test('negotiation holds floor and asks clarification without consuming rounds', () => {
  const item = {price:24,minPrice:18,negotiable:true};
  assert.equal(negotiate(item,24,0,'十八可以吗').quote,18);
  assert.equal(negotiate(item,24,0,'十可以吗').quote,21);
  assert.equal(negotiate(item,18,2,'便宜一点').quote,18);
  assert.equal(negotiate(item,24,0,'十五还是二十').round,0);
  assert.equal(negotiate({...item,negotiable:false},24,0,'十八').quote,24);
});
test('profiles restore valid progress and reject corrupted or dangerous shapes', () => {
  const p = freshProfile(); grant(p,'a',20);
  assert.equal(decodeProfile(JSON.stringify(p)).wallet,20);
  for (const raw of ['bad', '{"version":1,"wallet":-9}', '{"version":1,"wallet":1e99}', '{"__proto__":{"polluted":true}}']) assert.throws(()=>decodeProfile(raw));
  assert.equal({}.polluted,undefined);
});
