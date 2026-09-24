/**
 * Writes docs/VOICE_REVIEW.md: the AI voice clips most worth a human listen, ranked by simple rules.
 * 1. The text holds a character with several readings and the authored pinyin contains one of its
 *    less common readings (a TTS voice tends to pick the common one).
 * 2. Single-character clips, which give the voice no context to pick a reading or tone.
 * 3. Texts with 一 or 不, whose tones change with the next syllable.
 * Each clip is listed once, in the first class it falls into. Rules are syllable-level only: no
 * character-to-syllable alignment, so expect some false positives. `npm run audit:voice` runs it.
 */
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

// Most common reading first (from the learning-features plan, Task Q-voice).
const READINGS=Object.fromEntries(`行 xíng/háng · 长 cháng/zhǎng · 了 le/liǎo · 得 de/dé/děi · 还 hái/huán · 为 wèi/wéi · 都 dōu/dū · 重 zhòng/chóng · 地 de/dì · 的 de/dí/dì · 着 zhe/zháo/zhuó · 好 hǎo/hào · 看 kàn/kān · 中 zhōng/zhòng · 只 zhǐ/zhī · 乐 lè/yuè · 觉 jué/jiào · 教 jiāo/jiào · 数 shù/shǔ · 发 fā/fà · 分 fēn/fèn · 便 biàn/pián · 当 dāng/dàng · 相 xiāng/xiàng · 少 shǎo/shào · 种 zhǒng/zhòng · 转 zhuǎn/zhuàn · 调 tiáo/diào · 传 chuán/zhuàn · 空 kōng/kòng · 差 chà/chā/chāi · 和 hé/huo/hè/huó/huò · 假 jiǎ/jià · 间 jiān/jiàn · 结 jié/jiē · 角 jiǎo/jué · 难 nán/nàn · 量 liàng/liáng · 没 méi/mò · 薄 báo/bó · 朝 cháo/zhāo · 处 chù/chǔ · 倒 dǎo/dào · 干 gān/gàn · 更 gèng/gēng · 给 gěi/jǐ · 将 jiāng/jiàng · 卡 kǎ/qiǎ · 省 shěng/xǐng · 应 yīng/yìng · 系 xì/jì · 要 yào/yāo · 背 bèi/bēi · 场 chǎng/cháng · 把 bǎ/bà · 冲 chōng/chòng · 弹 tán/dàn · 露 lù/lòu · 模 mó/mú · 盛 shèng/chéng · 藏 cáng/zàng · 降 jiàng/xiáng · 称 chēng/chèn · 参 cān/shēn · 片 piàn/piān · 兴 xìng/xīng · 与 yǔ/yù`
  .split(' · ').map(s=>{const [ch,r]=s.split(' ');return [ch,r.split('/')];}));

const V='aeiouüvāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
// A final n/ng/r only closes a syllable when no vowel follows, so "xīnán" splits as xī nán.
const SYL=new RegExp(`(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?[${V}]+(?:ng(?![${V}])|n(?![${V}])|r(?![${V}]))?`,'gu');
export const syllables=p=>(p??'').normalize('NFC').toLowerCase().match(SYL)??[];

const CLASSES=['reading','single','tone'];
const TONE={'一':['yí','yì','yi'],'不':['bú','bu']};  // changed-tone spellings

/** Returns {cls, reasons, score} for the first class a clip falls into, or null. */
export function classify(text,pinyin,spelled=text){  // spelled: the part of text the pinyin covers
  const hanzi=[...text].filter(c=>/\p{Script=Han}/u.test(c));
  const syl=new Set(syllables(pinyin));
  const found={reading:[],single:[],tone:[]},score={reading:0,single:0,tone:0};
  for(const ch of new Set(spelled)){
    const r=READINGS[ch];
    if(!r)continue;
    for(const rare of r.slice(1))if(syl.has(rare)){
      found.reading.push(`${ch} read ${rare} (usually ${r[0]})`);
      score.reading+=syl.has(r[0])?1:2;  // common reading absent: the rare one is surely meant
    }
  }
  if(hanzi.length===1){
    const r=READINGS[hanzi[0]];
    found.single.push(r?`single character with several readings (${r.join('/')})`:'single character, no context');
    score.single+=r?2:1;
  }
  for(const [ch,forms] of Object.entries(TONE))if(hanzi.includes(ch)){
    const written=forms.filter(f=>syl.has(f));
    found.tone.push(written.length?`${ch} written ${written.join('/')} (tone change)`:`${ch} (tone depends on the next syllable)`);
    score.tone+=written.length?2:1;
  }
  const cls=CLASSES.find(c=>found[c].length);
  return cls?{cls,reasons:CLASSES.flatMap(c=>found[c]),score:score[cls]}:null;
}

/** Audio id → authored pinyin, mirroring collect_lines() in scripts/generate-voice.py. */
function authoredPinyin(){
  const url=p=>new URL(`../${p}`,import.meta.url);
  const read=p=>JSON.parse(readFileSync(url(p),'utf8'));
  const map=new Map(),add=(id,pinyin,zh)=>{if(id&&pinyin&&!map.has(id))map.set(id,{pinyin,zh});};
  for(const f of readdirSync(url('src/content/lessons')).filter(f=>f.endsWith('.json'))){
    const l=read(`src/content/lessons/${f}`);
    for(const n of [...l.nodes,...Object.values(l.extraLines??{})])add(n.audio,n.pinyin);
  }
  for(const f of ['ambient','vocabulary','catalog'])for(const x of read(`src/content/${f}.json`))add(x.audio,x.pinyin,x.zh);
  for(const [k,l] of Object.entries(read('src/content/market.json').lines))add('market-'+k,l.pinyin);  // totals carry no pinyin
  for(const [k,o] of Object.entries(read('src/content/objects.json').objects))add('obj-'+k,o.pinyin);
  for(const s of Object.values(read('src/content/signs.json').signs))add('sign-'+s.id,s.pinyin);
  for(const l of Object.values(read('src/content/levels.json').lines))add(l.audio,l.pinyin);
  const conf=read('src/content/confusables.json');
  for(const p of Object.values(conf.prompts))add(p.audio,p.pinyin);
  for(const m of conf.groups.flatMap(g=>g.members))add(m.audio,m.pinyin);
  for(const w of read('public/hsk/words.json').words)add(w.audio,w.pinyin);
  return map;
}

/** Clip id → the same-sound character the generator speaks instead (STAND_INS in generate-voice.py). */
function standIns(){
  const py=readFileSync(new URL('generate-voice.py',import.meta.url),'utf8');
  const block=py.match(/^STAND_INS = \{([^}]*)\}/m)?.[1]??'';
  return new Map([...block.matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map(m=>[m[1],m[2]]));
}

export function audit(){
  const {clips}=JSON.parse(readFileSync(new URL('../public/audio/manifest.json',import.meta.url),'utf8'));
  const pinyin=authoredPinyin(),stand=standIns(),rows=[],handled=[];
  for(const [id,c] of Object.entries(clips)){
    if(c.source==='recorded'||c.review==='reviewed'||!c.text)continue;
    const a=pinyin.get(id);
    if(stand.has(id)){handled.push({id,text:c.text,pinyin:a?.pinyin??'—',spoken:stand.get(id)});continue;}
    const hit=classify(c.text,a?.pinyin,a?.zh);
    if(hit)rows.push({id,text:c.text,pinyin:a?.pinyin??"—",...hit});
  }
  rows.sort((a,b)=>CLASSES.indexOf(a.cls)-CLASSES.indexOf(b.cls)||b.score-a.score||a.text.length-b.text.length||a.id.localeCompare(b.id));
  return {rows,handled};
}

function render({rows,handled}){
  const cell=s=>String(s).replaceAll('|','\\|').replaceAll('\n',' ');
  const heads={
    reading:['Less common readings','The text holds a character with several readings and the authored pinyin uses a less common one. Listen for the voice falling back to the common reading. Rows whose pinyin lacks the common reading altogether come first.'],
    single:['Single characters','One character gives the voice no context. Characters with several readings come first.'],
    tone:['一 and 不 (tone changes)','一 and 不 change tone before other syllables. Rows whose pinyin writes a changed tone come first.'],
  };
  const out=['# Voice clips worth a human listen','',
    'Generated by `npm run audit:voice` (`scripts/audit-voice.js`) from `public/audio/manifest.json` and the authored pinyin in content; do not edit by hand. Clips marked `reviewed` or `recorded` are left out. The rules are simple syllable matches, so some rows are false alarms. Each clip appears once, in its highest-risk class, with every reason that applies.','',
    '| Class | Clips |','| --- | --- |',
    ...CLASSES.map(c=>`| ${heads[c][0]} | ${rows.filter(r=>r.cls===c).length} |`),''];
  for(const c of CLASSES){
    out.push(`## ${heads[c][0]}`,'',heads[c][1],'','| # | Id | Text | Authored pinyin | Reason |','| --- | --- | --- | --- | --- |');
    rows.filter(r=>r.cls===c).forEach((r,i)=>out.push(`| ${i+1} | \`${r.id}\` | ${cell(r.text)} | ${cell(r.pinyin)} | ${cell(r.reasons.join('; '))} |`));
    out.push('');
  }
  out.push('## Handled by a stand-in character','',
    'A lone character with a less common reading comes out in its usual reading, so `STAND_INS` in `scripts/generate-voice.py` has the voice speak a character with the same syllable and tone instead. These still deserve one listen, but are not ranked as risks.','',
    '| Id | Text | Authored pinyin | Spoken as |','| --- | --- | --- | --- |',
    ...handled.map(h=>`| \`${h.id}\` | ${cell(h.text)} | ${cell(h.pinyin)} | ${cell(h.spoken)} |`),'');
  out.push('## Regenerating one clip','',
    'Rebuild a single clip, for example after changing its speaker\'s voice settings in `src/content/voices.json`:','',
    '```sh','.venv/Scripts/python.exe scripts/generate-voice.py --only <id>','```','',
    'The generator writes `public/audio/manifest.json` itself; never edit it by hand. If the voice keeps misreading a line, replace the clip with a human recording as described under "Getting to reviewed audio" in `docs/VOICE_PRODUCTION.md`, and mark clips that pass as `reviewed` so they drop off this list.','');
  return out.join('\n');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const result=audit(),{rows}=result;
  writeFileSync(new URL('../docs/VOICE_REVIEW.md',import.meta.url),render(result));
  const n=c=>rows.filter(r=>r.cls===c).length;
  console.log(`docs/VOICE_REVIEW.md: ${n('reading')} reading, ${n('single')} single, ${n('tone')} tone, ${result.handled.length} stand-ins, ${rows.filter(r=>r.pinyin==='—').length} flagged without pinyin`);
}
