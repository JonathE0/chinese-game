import balance from '../content/balance.json' with {type:'json'};
import {pay} from './economy.js';
import {bump} from './daily.js';
import {wordId} from './bank.js';
import {addMiss} from './learning.js';
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
export function reviewWord(p,id,skill,{correct,hinted,now=Date.now(),venue=null,reward=true,zh}) {
  // Every wrong answer counts toward the confusables deck, even a retry that changes nothing else.
  if(!correct)addMiss(p,zh??p.saved?.find(w=>w.id===id)?.zh);
  const skills=p.words[id]??={}; const old=skills[skill];
  // A lapse during optional early practice still matters, but repeated guesses in the
  // same two-minute retry window must not repeatedly reduce the stage.
  if(old && old.due>now && (correct || now-old.last<balance.retryMinutes*60000)) return {coins:0,practiceOnly:true};
  // New until answered right without help once. The mark stays, so forgetting a word and
  // relearning it does not make it pay the new-word bonus a second time.
  const known=!!old?.learned||(old?.stage??0)>0,fresh=!known;
  const stage=correct?(hinted?(old?.stage??0):Math.min(6,(old?.stage??0)+1)):Math.max(0,(old?.stage??0)-1);
  const minutes=!correct?balance.retryMinutes:hinted?balance.hintMinutes:balance.reviewIntervalsMinutes[stage-1];
  const learned=known||(correct&&!hinted);
  skills[skill]={stage,due:now+minutes*60000,last:now,reviews:(old?.reviews??0)+1,...(learned?{learned:true}:{})};
  // No claim needed: only a due card pays (see above), and answering moves its due time on.
  const coins=correct&&reward?pay(p,hinted?balance.supportedCoins:cardCoins(venue,fresh)):0;
  bump(p,'reviews');            // every card answered counts toward today's errand
  return {coins,practiceOnly:false,fresh};
}
export function dueCount(p,now=Date.now()) { return Object.values(p.words).filter(skills=>Object.values(skills).some(r=>r.due<=now)).length; }

export function wordRecord(p,word,skill='recognition') {
  const records=[p.words[word.id]?.[skill],word.zh?p.words[wordId(word.zh)]?.[skill]:null].filter(Boolean);
  return records.sort((a,b)=>b.last-a.last)[0];
}
/** Familiar words rest until due; weak overdue words take priority, ties vary fairly. */
export function pickReviewWords(p,pool,skill='recognition',{now=Date.now(),limit=10,random=Math.random,includeResting=false}={}) {
  return pool.map(word=>({word,record:wordRecord(p,word,skill),tie:random()}))
    .filter(({record})=>includeResting||!record||record.due<=now)
    .sort((a,b)=>{
      const rank=r=>!r?1:r.due<=now?0:2;
      return rank(a.record)-rank(b.record)||
        (a.record&&b.record ? a.record.stage-b.record.stage : 0)||a.tie-b.tie;
    }).slice(0,limit).map(({word})=>word);
}

/** Confusable groups with at least one member the player has met (in the bank, seen somewhere,
 *  missed, or reviewed as an HSK word via `idOf(zh)`), most-missed first. */
export function confusableDeck(p,groups,idOf=()=>null){
  const misses=p.learning?.misses??{},saved=new Set((p.saved??[]).map(w=>w.zh));
  const met=zh=>saved.has(zh)||!!p.learning?.sources?.[zh]||!!misses[zh]||!!p.words[idOf(zh)];
  const missed=g=>g.members.reduce((n,m)=>n+(misses[m.zh]??0),0);
  return groups.filter(g=>g.members.some(m=>met(m.zh))).sort((a,b)=>missed(b)-missed(a));
}
