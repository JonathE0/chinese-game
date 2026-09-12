import balance from '../content/balance.json' with {type:'json'};
import {grant} from './economy.js';
import {bump} from './daily.js';
export function familiarity(record,now=Date.now()) {
  if(!record) return 'new';
  if(record.due<=now) return 'due';
  return record.stage>=3?'familiar':'learning';
}
export function reviewWord(p,id,skill,{correct,hinted,now=Date.now()}) {
  const skills=p.words[id]??={}; const old=skills[skill];
  if(old && old.due>now) return {coins:0,practiceOnly:true};
  const stage=correct?(hinted?(old?.stage??0):Math.min(6,(old?.stage??0)+1)):Math.max(0,(old?.stage??0)-1);
  const minutes=!correct?balance.retryMinutes:hinted?balance.hintMinutes:balance.reviewIntervalsMinutes[stage-1];
  skills[skill]={stage,due:now+minutes*60000,last:now,reviews:(old?.reviews??0)+1};
  const coins=correct?grant(p,`review:${id}:${skill}:${old?.due??0}`,hinted?balance.supportedCoins:balance.reviewCoins):0;
  bump(p,'reviews');            // every card answered counts toward today's errand
  return {coins,practiceOnly:false};
}
export function dueCount(p,now=Date.now()) { return Object.values(p.words).filter(skills=>Object.values(skills).some(r=>r.due<=now)).length; }
