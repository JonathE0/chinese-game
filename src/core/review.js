import balance from '../content/balance.json' with {type:'json'};
import {grant} from './economy.js';
import {bump} from './daily.js';
export function familiarity(record,now=Date.now()) {
  if(!record) return 'new';
  if(record.due<=now) return 'due';
  return record.stage>=3?'familiar':'learning';
}
/** Coins for one unaided right answer. Studying somewhere on purpose pays better than the pocket
 *  word bank: the word hall for words you have never got right before, the desk at home for any. */
export function cardCoins(venue,fresh) {
  return balance.venueCoins[venue]?.[fresh?'new':'review']??balance.reviewCoins;
}
export function reviewWord(p,id,skill,{correct,hinted,now=Date.now(),venue=null}) {
  const skills=p.words[id]??={}; const old=skills[skill];
  if(old && old.due>now) return {coins:0,practiceOnly:true};
  // New until answered right without help once. The mark stays, so forgetting a word and
  // relearning it does not make it pay the new-word bonus a second time.
  const known=!!old?.learned||(old?.stage??0)>0,fresh=!known;
  const stage=correct?(hinted?(old?.stage??0):Math.min(6,(old?.stage??0)+1)):Math.max(0,(old?.stage??0)-1);
  const minutes=!correct?balance.retryMinutes:hinted?balance.hintMinutes:balance.reviewIntervalsMinutes[stage-1];
  const learned=known||(correct&&!hinted);
  skills[skill]={stage,due:now+minutes*60000,last:now,reviews:(old?.reviews??0)+1,...(learned?{learned:true}:{})};
  const coins=correct?grant(p,`review:${id}:${skill}:${old?.due??0}`,hinted?balance.supportedCoins:cardCoins(venue,fresh)):0;
  bump(p,'reviews');            // every card answered counts toward today's errand
  return {coins,practiceOnly:false,fresh};
}
export function dueCount(p,now=Date.now()) { return Object.values(p.words).filter(skills=>Object.values(skills).some(r=>r.due<=now)).length; }
