import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sanitizeDictionaryEntry} from '../src/content/dictionary-policy.js';
import {normaliseBank,wordId,addWord} from '../src/core/bank.js';
import {freshProfile,decodeProfile} from '../src/core/profile.js';
const words=JSON.parse(readFileSync('public/hsk/words.json','utf8')).words;
test('only 黄 receives a meaning restriction; other senses remain intact',()=>{
 assert.deepEqual(sanitizeDictionaryEntry({zh:'黄',pinyin:'huáng / Huáng',en:'yellow; pornographic'}),{zh:'黄',pinyin:'huáng',en:'yellow'});
 const entry={zh:'例',pinyin:'lì',en:'example; erotic; a third meaning'};
 assert.deepEqual(sanitizeDictionaryEntry(entry),entry);
 assert.deepEqual(normaliseBank([{zh:'黄',en:'yellow; pornographic'}]),[{id:wordId('黄'),zh:'黄',pinyin:'huáng',en:'yellow'}]);
});
test('every HSK card has its own Chinese and English definitions and provenance',()=>{
 assert.equal(words.length,5363);assert.equal(new Set(words.map(w=>w.id)).size,words.length);
 for(const w of words){
  assert.match(w.definitionZh,/[\u3400-\u9fff]/,w.zh);assert.notEqual(w.definitionZh,w.zh,w.zh);
  assert.ok(w.en.trim().length>0,w.zh);assert.ok(w.pinyin,w.zh);
  assert.ok(['moe','xinhua','authored'].includes(w.definitionSource),w.zh);
  assert.deepEqual(sanitizeDictionaryEntry(w),w);
 }
 const yellow=words.find(w=>w.zh==='黄');assert.equal(yellow.en,'yellow');assert.equal(yellow.readings,undefined);
});
test('common readings are primary and additional meanings are not truncated',()=>{
 for(const [zh,pinyin,meaning] of [['说','shuō','to speak'],['个','gè','classifier'],['和','hé','and'],['要','yào','to want'],['看','kàn','to see']]){
  const w=words.find(w=>w.zh===zh);assert.equal(w.pinyin,pinyin,zh);assert.ok(w.en.includes(meaning),zh+': '+w.en);
 }
 const w=words.find(w=>w.zh==='说');assert.ok(w.en.includes('to scold'));assert.ok(w.readings.some(r=>r.pinyin==='shuì'));
});
test('saving an HSK word retains both definitions and alternative readings',()=>{
 const p={saved:[]};const w=words.find(w=>w.zh==='说');addWord(p,w);
 const [saved]=normaliseBank(JSON.parse(JSON.stringify(p.saved)));
 assert.equal(saved.definitionZh,w.definitionZh);assert.deepEqual(saved.readings,w.readings);
});
test('every full HSK definition fits a valid saved profile',()=>{
 for(const word of words){
  const p=freshProfile();addWord(p,word);
  assert.equal(decodeProfile(JSON.stringify(p)).saved[0].en,word.en,word.zh);
 }
});

test('a card with several readings is defined by the reading it shows, not by its neighbours',()=>{
  const cards=Object.fromEntries(JSON.parse(readFileSync(new URL('../public/hsk/words.json',import.meta.url),'utf8')).words.map(w=>[w.zh,w]));
  // 长 is cháng, "long". Its old definition opened with the senses of zhǎng: elder, leader, to grow.
  assert.equal(cards['长'].pinyin,'cháng');
  assert.match(cards['长'].definitionZh,/長度|距離/);
  assert.doesNotMatch(cards['长'].definitionZh,/年紀大|領袖|生長/);
  // 湿 is shī; the MOE entry for that reading only says "same as 溼", so the definition comes from 溼.
  assert.equal(cards['湿'].definitionTitle,'溼');
  assert.match(cards['湿'].definitionZh,/水分/);
});
