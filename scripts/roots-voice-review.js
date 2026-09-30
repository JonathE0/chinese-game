import fs from 'node:fs';
import {classify} from './audit-voice.js';
import {escapeHtml as esc} from '../src/core/language.js';
const data=JSON.parse(fs.readFileSync('src/content/roots.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('public/audio/manifest.json','utf8'));
const lines=[...data.skills.flatMap(s=>s.variants),...data.bankLesson.nodes,...['greeting','memory'].map(key=>({...data.caretaker[key],audio:'roots-caretaker-'+key}))];
const cards=lines.map((line,index)=>{
 const clip=manifest.clips[line.audio];if(!clip||clip.text!==line.zh||!fs.existsSync('public'+clip.src))throw Error('Missing or outdated voice: '+line.audio);
 const risk=classify(line.zh,line.pinyin)?.reasons??[];
 return '<article><h2>'+String(index+1).padStart(2,'0')+' · '+esc(line.en)+'</h2><p lang="zh-CN" class="mandarin">'+esc(line.zh)+'</p><p class="pinyin">'+esc(line.pinyin)+'</p><audio controls preload="metadata" aria-label="Listen: '+esc(line.en)+'" src="'+esc(clip.src)+'"></audio>'+(risk.length?'<p class="note">Listen carefully: '+esc(risk.join('; '))+'</p>':'')+'<p class="status">'+(clip.review==='reviewed'?'Previously marked reviewed':'Awaiting human listening review')+'</p></article>';
});
fs.writeFileSync('docs/roots-voice-review.html','<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Roots chapter — voice listening review</title><style>body{max-width:850px;margin:40px auto;padding:0 24px;background:#f7f4eb;color:#253f35;font:16px/1.6 system-ui}h1{line-height:1.2}article{background:white;padding:24px;border:1px solid #d5dccc;border-radius:12px;margin:20px 0}h2{font-size:18px}.mandarin{font-size:23px}.pinyin,.status{color:#637469}.note{background:#f2f4e9;padding:10px}audio{width:100%}.status{font-size:13px}</style><h1>Roots chapter: listen to the voices</h1><p>'+lines.length+' Mandarin clips, with English meanings and pinyin. Check pronunciation, pacing, warmth and any robotic sounds. Playing a clip does not mark it as reviewed.</p><p>The automatic notes flag places worth listening to; they do not mean the pronunciation is wrong. This review page is for the local development server.</p>'+cards.join('')+'</html>');
console.log('Created docs/roots-voice-review.html: '+lines.length+' clips match current dialogue and exist on disk.');
