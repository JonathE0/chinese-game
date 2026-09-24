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
test('the word hall pays five for a new word and the usual three for a review', () => {
  const p = freshProfile();
  const first = reviewWord(p,'water','recognition',{correct:true,hinted:false,now:1000,venue:'hall'});
  assert.equal(first.coins,5);
  assert.equal(first.fresh,true);
  const again = reviewWord(p,'water','recognition',{correct:true,hinted:false,now:601000,venue:'hall'});
  assert.equal(again.coins,3);
  assert.equal(again.fresh,false);
  assert.equal(p.wallet,8);
});
test('a new word missed or hinted at first keeps its bonus until it is answered right unaided', () => {
  const p = freshProfile();
  reviewWord(p,'tea','recognition',{correct:false,hinted:false,now:1000,venue:'hall'});
  assert.equal(p.wallet,0);
  assert.equal(reviewWord(p,'tea','recognition',{correct:true,hinted:true,now:121000,venue:'hall'}).coins,1);
  assert.equal(reviewWord(p,'tea','recognition',{correct:true,hinted:false,now:721000,venue:'hall'}).coins,5);
});
test('forgetting a learned word never makes it new again', () => {
  const p = freshProfile();
  reviewWord(p,'rice','recognition',{correct:true,hinted:false,now:1000,venue:'hall'});
  reviewWord(p,'rice','recognition',{correct:false,hinted:false,now:601000,venue:'hall'});
  assert.equal(p.words.rice.recognition.stage,0);
  assert.equal(reviewWord(p,'rice','recognition',{correct:true,hinted:false,now:721000,venue:'hall'}).coins,3);
  // Learning survives a save and reload.
  const loaded = decodeProfile(JSON.stringify(p));
  assert.equal(loaded.words.rice.recognition.learned,true);
});
test('the study desk at home pays four for every card, new or due', () => {
  const p = freshProfile();
  assert.equal(reviewWord(p,'bread','recognition',{correct:true,hinted:false,now:1000,venue:'desk'}).coins,4);
  assert.equal(reviewWord(p,'bread','recognition',{correct:true,hinted:false,now:601000,venue:'desk'}).coins,4);
  assert.equal(reviewWord(p,'milk','recognition',{correct:true,hinted:true,now:1000,venue:'desk'}).coins,1);
  // Anywhere else keeps the ordinary rate.
  assert.equal(reviewWord(p,'egg','recognition',{correct:true,hinted:false,now:1000}).coins,3);
});
test('a word record with a malformed learned mark is dropped on load', () => {
  const p = freshProfile();
  p.words.water = {recognition:{stage:1,due:1,last:1,reviews:1,learned:'yes'}};
  const repairs = [];
  assert.deepEqual(decodeProfile(JSON.stringify(p),repairs).words,{});
  assert.deepEqual(repairs,['words']);
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
test('profiles restore valid progress, repair corrupted values and reject what is not a save', () => {
  const p = freshProfile(); grant(p,'a',20);
  assert.equal(decodeProfile(JSON.stringify(p)).wallet,20);
  for (const raw of ['bad', '[]', '{"wallet":5}', '{"__proto__":{"polluted":true}}']) assert.throws(()=>decodeProfile(raw));
  for (const [raw,wallet] of [['{"version":1,"wallet":-9}',0],['{"version":1,"wallet":1e99}',1000000]]) {
    const repairs = [];
    assert.equal(decodeProfile(raw,repairs).wallet,wallet);
    assert.ok(repairs.includes('wallet'));
  }
  assert.equal({}.polluted,undefined);
});
