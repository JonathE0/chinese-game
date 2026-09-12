import test from 'node:test';
import assert from 'node:assert/strict';
import {TranslationService} from '../src/services/translation.js';

test('translates a complete curated sentence naturally',async()=>{
  const result=await new TranslationService().translate('我要一杯咖啡');
  assert.deepEqual(result,{
    status:'translated',
    source:'我要一杯咖啡',
    pinyin:'Wǒ yào yì bēi kāfēi.',
    meaning:'I would like a cup of coffee.'
  });
});

test('uses the complete punctuation-preserving authored phrase',async()=>{
  const result=await new TranslationService().translate('是啊，一起走走吧。');
  assert.equal(result.status,'translated');
  assert.equal(result.source,'是啊，一起走走吧。');
  assert.equal(result.meaning,"It is! Let's take a little walk together.");
});

test('returns an explicit unavailable result for an unknown sentence',async()=>{
  const result=await new TranslationService().translate('紫色火车正在月亮上唱歌。');
  assert.deepEqual(result,{status:'unavailable',source:'紫色火车正在月亮上唱歌。'});
});

test('explains the 500-character selection limit',async()=>{
  const source='我'.repeat(501);
  const result=await new TranslationService().translate(source);
  assert.deepEqual(result,{status:'too-long',source,maxLength:500});
});

test('library lines use their authored meaning without a second translation copy',async()=>{
  const result=await new TranslationService().translate('我起床，喝一杯水。');
  assert.equal(result.status,'translated');
  assert.equal(result.meaning,'I get up and drink a glass of water.');
});

test('a contiguous passage retains authored sentence meanings across line breaks',async()=>{
  const source='天亮了。\n我起床，喝一杯水。';
  const result=await new TranslationService().translate(source);
  assert.equal(result.source,source);
  assert.equal(result.meaning,'It has grown light. I get up and drink a glass of water.');
});

test('every lesson is indexed, not just introductions — a dialogue node and an extra line alike',async()=>{
  const service=new TranslationService();
  const node=await service.translate('你好！有什么事吗？');
  assert.equal(node.status,'translated');
  assert.equal(node.meaning,'Hi! Can I help you?');
  const extra=await service.translate('找到了！这就是一号书店。');
  assert.equal(extra.status,'translated');
  assert.equal(extra.meaning,'Found it! This is No. 1 Bookstore.');
});
