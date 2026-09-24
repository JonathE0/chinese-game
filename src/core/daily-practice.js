import initial from '../content/vocabulary.json' with {type:'json'};
import catalog from '../content/catalog.json' with {type:'json'};
import balance from '../content/balance.json' with {type:'json'};
import {wordId} from './bank.js';
import {pickReviewWords,reviewWord} from './review.js';
import {grant} from './economy.js';

// Reuse authored names, illustrations and recordings rather than inventing a second vocabulary.
const seen=new Set(initial.map(w=>w.zh));
export const practicePool=[...initial,...catalog.filter(w=>{
  if(seen.has(w.zh)||!w.visual||!w.audio||w.zh.length>4||w.id.startsWith('home-'))return false;
  seen.add(w.zh);return true;
}).map(w=>({...w,id:wordId(w.zh),accepted:[w.zh]}))];
const byId=new Map(practicePool.map(w=>[w.id,w]));
export const localPracticeDate=(now=Date.now())=>{
  const d=new Date(now);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const seeded=seed=>{let n=2166136261;for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619);return()=>{n=(Math.imul(n,1664525)+1013904223)|0;return (n>>>0)/4294967296;};};
export function normalizeDailyPractice(value) {
  if(value===undefined)return undefined;
  if(!value||typeof value!=='object'||Array.isArray(value)||!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||
    !Array.isArray(value.ids)||value.ids.length!==4||new Set(value.ids).size!==4||value.ids.some(id=>!byId.has(id)))throw Error('Invalid daily practice');
  return {date:value.date,ids:[...value.ids]};
}
export function dailyPractice(p,now=Date.now()) {
  const date=localPracticeDate(now),old=p.dailyPractice;
  // Reopening, switching skill, or a clock moving backward cannot reshuffle today's set.
  if(old&&old.date>=date)return old;
  if(!p.completed.includes('practice:first'))return p.dailyPractice={date,ids:initial.map(w=>w.id)};
  const previous=new Set(old?.ids??initial.map(w=>w.id));
  const choices=pickReviewWords(p,practicePool.filter(w=>!previous.has(w.id)),'recognition',{
    now,limit:practicePool.length,random:seeded(date),includeResting:true
  });
  const selected=[],visuals=new Set();
  for(const word of choices){if(visuals.has(word.visual))continue;selected.push(word.id);visuals.add(word.visual);if(selected.length===4)break;}
  return p.dailyPractice={date,ids:selected};
}
export const dailyPracticeWords=session=>session.ids.map(id=>byId.get(id));
export function answerDailyWord(p,session,id,skill,{correct,hinted=false,now=Date.now()}) {
  if(!p.dailyPractice||p.dailyPractice.date!==session.date||!p.dailyPractice.ids.includes(id))return {coins:0,practiceOnly:true};
  const result=reviewWord(p,id,skill,{correct,hinted,now,reward:false,zh:byId.get(id)?.zh});
  const coins=correct?grant(p,`practice:daily:${session.date}:${id}`,balance.dailyPracticeWordCoins):0;
  return {...result,coins};
}
