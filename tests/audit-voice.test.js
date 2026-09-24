import test from 'node:test';
import assert from 'node:assert/strict';
import {syllables,classify} from '../scripts/audit-voice.js';

test('pinyin splits into syllables without an n/ng final stealing the next initial', () => {
  assert.deepEqual(syllables('Xīnán dìtiězhàn'), ['xī','nán','dì','tiě','zhàn']);
  assert.deepEqual(syllables('Huānyíng guānglín!'), ['huān','yíng','guāng','lín']);
});

test('clips are flagged for less common readings, single characters and 一/不', () => {
  assert.equal(classify('地铁','dìtiě').cls, 'reading');
  assert.equal(classify('慢慢地走','mànmàn de zǒu'), null);
  assert.equal(classify('进关系','jìn guānxì'), null);
  assert.equal(classify('树','shù').cls, 'single');
  assert.equal(classify('一起','yìqǐ').cls, 'tone');
  assert.equal(classify('你好','nǐ hǎo'), null);
  assert.equal(classify('地毯。踩上去软软的。','dìtǎn','地毯').reasons.length, 1);  // 的 is outside the spelled name
});
