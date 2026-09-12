import test from 'node:test';
import assert from 'node:assert/strict';
import {languageLine} from '../src/ui/shell.js';
test('language help escapes user text and only includes configured support',()=>{
  const line={zh:'<b>你好</b>',pinyin:'nǐ hǎo',en:'hello'};
  const rendered=languageLine(line,{pinyin:false,english:true});
  assert.ok(rendered.includes('&lt;b&gt;你好&lt;/b&gt;'));
  assert.ok(!rendered.includes('nǐ hǎo'));
  assert.ok(rendered.includes('hello'));
  assert.ok(rendered.includes('class="help-content" hidden'));
});
test('a line\'s note does not hide its hint: both show as separate help lines',()=>{
  const line={zh:'你好',pinyin:'nǐ hǎo',en:'hello',note:'A usage note.',hint:'A hint.'};
  const rendered=languageLine(line,{pinyin:true,english:true});
  assert.ok(rendered.includes('<div class="usage">A usage note.</div>'));
  assert.ok(rendered.includes('<div class="usage">A hint.</div>'));
  assert.ok(!languageLine(line,{pinyin:true,english:false}).includes('A hint.'));
});
