import test from 'node:test';
import assert from 'node:assert/strict';
import {pinyinMode,lineKnown,showPinyin,toneOf,syllables,pinyinMarkup} from '../src/core/pinyin.js';
import {wordId} from '../src/core/bank.js';
import {decodeProfile,freshProfile} from '../src/core/profile.js';
import {languageLine} from '../src/ui/shell.js';

const learnedWords=(...zh)=>({words:Object.fromEntries(zh.map(w=>[wordId(w),{recognition:{stage:1,due:0,last:0,reviews:1,learned:true}}])),settings:{pinyin:'known'}});

test('old true/false pinyin settings still decode as always/never; new saves hide known words',()=>{
  assert.equal(pinyinMode({pinyin:true}),'always');
  assert.equal(pinyinMode({pinyin:false}),'never');
  assert.equal(pinyinMode({pinyin:'known'}),'known');
  assert.equal(pinyinMode({pinyin:'nonsense'}),'known');
  assert.equal(pinyinMode(freshProfile().settings),'known');
  assert.equal(freshProfile().settings.toneColors,false);
});

test('the save sanitiser keeps old booleans and the new modes, and repairs anything else',()=>{
  for(const pinyin of [true,false,'always','known','never']){
    const p=freshProfile();p.settings.pinyin=pinyin;p.settings.toneColors=true;
    const repairs=[],s=decodeProfile(JSON.stringify(p),repairs).settings;
    assert.deepEqual(repairs,[]);
    assert.equal(s.pinyin,pinyin);assert.equal(s.toneColors,true);
  }
  const p=freshProfile();p.settings.pinyin='sometimes';delete p.settings.toneColors;
  const s=decodeProfile(JSON.stringify(p)).settings;
  assert.equal(s.pinyin,'known');assert.equal(s.toneColors,false);
});

test('a line hides its pinyin only when every Han character belongs to a learned word',()=>{
  const p=learnedWords('你好','谢谢');
  assert.equal(lineKnown(p,'你好！'),true);
  assert.equal(lineKnown(p,'你好，谢谢。'),true);
  assert.equal(lineKnown(p,'你好，老师。'),false,'one unknown word keeps the pinyin');
  assert.equal(lineKnown(p,'OK'),false,'no Chinese, nothing to know');
  assert.equal(lineKnown(p,'好'),false,'a character inside a longer word is not a word you know');
  assert.equal(lineKnown(learnedWords(),'你好'),false);
  // An HSK word is reviewed under its list id, not the text hash.
  const hsk={words:{'hsk-1':{listening:{learned:true}}}};
  assert.equal(lineKnown(hsk,'的',zh=>zh==='的'?'hsk-1':null),true);
  // A word reviewed but not yet answered right unaided does not count.
  assert.equal(lineKnown({words:{[wordId('你好')]:{recognition:{stage:0}}}},'你好'),false);
});

test('showPinyin follows the mode, and study tools can force it',()=>{
  const p=learnedWords('你好');
  assert.equal(showPinyin('nǐ hǎo',{zh:'你好',settings:{pinyin:'known'},profile:p}),false);
  assert.equal(showPinyin('nǐ hǎo',{zh:'你好',settings:{pinyin:true},profile:p}),true);
  assert.equal(showPinyin('nǐ hǎo',{zh:'你们',settings:{pinyin:'known'},profile:p}),true);
  assert.equal(showPinyin('nǐ hǎo',{zh:'你们',settings:{pinyin:false},profile:p}),false);
  assert.equal(showPinyin('nǐ hǎo',{zh:'你好',settings:{pinyin:false},profile:p,always:true}),true);
  assert.equal(showPinyin('',{zh:'你好',settings:{pinyin:true}}),false);
});

test('tone classes come from the marks, and unmarked syllables are neutral',()=>{
  assert.deepEqual([toneOf('mā'),toneOf('má'),toneOf('mǎ'),toneOf('mà'),toneOf('ma'),toneOf('lǜ')],[1,2,3,4,0,4]);
  assert.deepEqual(syllables('Xièxie, lǎoshī!'),[['Xiè',4],['xie',0],[', ',null],['lǎo',3],['shī',1],['!',null]]);
  assert.deepEqual(syllables('yīnián').map(s=>s[0]),['yī','nián']);
  assert.deepEqual(syllables('Qù nǎr?').map(s=>s[0]),['Qù',' ','nǎr','?']);
  assert.equal(pinyinMarkup('nǐ hǎo',{toneColors:false}),'nǐ hǎo');
  assert.equal(pinyinMarkup('bāozi',{toneColors:true}),'<span class="tone-1">bāo</span><span class="tone-0">zi</span>');
  assert.equal(pinyinMarkup('<b>',{toneColors:true}),'&lt;b&gt;');
});

test('languageLine hides known-word pinyin but still offers help',()=>{
  const line={zh:'你好',pinyin:'nǐ hǎo',en:'hello'};
  assert.ok(languageLine(line,{pinyin:'always',english:false}).includes('nǐ hǎo'));
  assert.ok(!languageLine(line,{pinyin:'never',english:true}).includes('nǐ hǎo'));
  assert.ok(languageLine(line,{pinyin:'never',english:false}).includes('请在设置里选择帮助语言'));
  assert.ok(languageLine(line,{pinyin:'always',english:false,toneColors:true}).includes('<span class="tone-3">nǐ</span>'));
});
