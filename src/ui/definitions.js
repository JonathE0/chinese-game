import {escapeHtml as esc} from '../core/language.js';
import {pinyinHtml} from './shell.js';
/** A definition belongs to this word; alternatives remain available without crowding the list. */
export function definitions(word,{open=false}={}){
 if(!word.definitionZh)return '';
 const source=word.definitionSource==='moe'
   ? '<a href="https://github.com/g0v/moedict-data" target="_blank" rel="noreferrer">教育部重編國語辭典 · 原文（繁體） · CC BY-ND 3.0 TW</a>'
   : word.definitionSource==='xinhua'?'<a href="https://github.com/pwxcoo/chinese-xinhua" target="_blank" rel="noreferrer">chinese-xinhua · MIT</a>':'青禾编写 · Qinghe explanation';
 return `<details class="word-definitions" ${open?'open':''}><summary>中文与英文释义 · Definitions</summary>
 <p lang="zh" class="definition-zh">${esc(word.definitionZh)}</p>
 <p lang="en" class="definition-en">${esc(word.en)}</p>
 ${word.readings?.length?`<details><summary>其他读音与词义 · Other readings and meanings</summary>${word.readings.map(r=>`<p><b>${pinyinHtml(r.pinyin,word.zh,{always:true})}</b> · ${esc(r.en)}</p>`).join('')}</details>`:''}
 <small class="definition-source">${source}</small></details>`;
}
