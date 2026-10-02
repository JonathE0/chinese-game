import tutorial from '../content/tutorial.json' with {type:'json'};
import {cardCoins} from './review.js';
import {fillKeys} from './keys.js';

/**
 * The first-run tips, as rules. Nothing is a slideshow: each tip in tutorial.json shows once, when
 * its `when` holds, at least TIP_GAP seconds after the last one. The save holds
 * `profile.tutorial = {seen:[tip ids]}`, and nothing at all for a save that never met the tips.
 */
export const STEPS=tutorial.steps;
export const TUTORIAL_UI=tutorial.ui;
export const TIP_GAP=tutorial.timing.gap;
export const TIP_SECONDS=tutorial.timing.show;
const IDS=STEPS.map(s=>s.id);

/** Only a brand-new traveller gets the tips; nobody already playing is interrupted.
 *  The starter home adds `home:starter` on every first load, so that one flag does not count. */
export function shouldAutoStart(p) {
  if(p.tutorial!==undefined)return false;
  if((p.completed??[]).some(flag=>flag!=='home:starter'))return false;
  if(p.discovered?.length)return false;
  return !Object.keys(p.words??{}).length;
}
export function startTutorial(p) {p.tutorial={seen:[]};return p.tutorial;}
export function skipTutorial(p) {p.tutorial={seen:[...IDS]};return p.tutorial;}
export const isSeen=(p,id)=>!!p.tutorial?.seen.includes(id);
export function markSeen(p,id) {if(p.tutorial&&!isSeen(p,id))p.tutorial.seen.push(id);}

const within=(at,pos)=>!!pos&&Math.hypot(pos.x-at.x,pos.z-at.z)<=at.r;
const nearby=(list,id)=>!!id&&list.some(want=>want===id||(want.endsWith(':')&&id.startsWith(want)));
/** One `when` entry against what the game knows now. */
function holds(w,{time,fired,nearId,pos,place},p) {
  if(w.event!==undefined)return fired.has(w.event);
  if(w.time!==undefined)return time>=w.time;
  if(w.after!==undefined)return isSeen(p,w.after);
  if(place!=='town')return false;   // 'near' and 'at' describe the square, not a shop floor
  if(w.nearId)return nearby(w.nearId,nearId);
  return !!w.at&&within(w.at,pos);
}
/** The tip to show right now, or null. `time` is seconds of play, `lastAt` when the last tip
 *  appeared, `fired` the named events so far, `nearId` the nearest thing to press E on and `pos`
 *  where the player stands. The first tip in tutorial.json order that is due wins. */
export function nextTip(p,state) {
  if(!p.tutorial)return null;
  for(const s of STEPS){
    if(isSeen(p,s.id)||state.time-state.lastAt<(s.gap??TIP_GAP))continue;
    if(s.when.some(w=>holds(w,state,p)))return s;
  }
  return null;
}
/** Something the player did. Any tip it finishes is marked seen, shown yet or not: someone who
 *  pressed V on their own has no need of the tip about V. `progress` (kept by the caller, not
 *  saved) counts towards each tip's `done.amount`. Returns the ids finished. */
export function tipEvent(p,progress,{type,id,amount=1}={}) {
  const finished=[];
  if(!p.tutorial)return finished;
  for(const s of STEPS){
    const d=s.done;
    if(!d||d.event!==type||(d.id!==undefined&&d.id!==id)||isSeen(p,s.id))continue;
    progress[s.id]=(progress[s.id]??0)+amount;
    if(progress[s.id]>=(d.amount??1)){markSeen(p,s.id);finished.push(s.id);}
  }
  return finished;
}
/** Coin rates in the text come from balance.json, so a tip never quotes a stale price. */
export function fillText(text) {
  return fillKeys(text)
    .replaceAll('{anywhere}',cardCoins(null,false))
    .replaceAll('{desk}',cardCoins('desk',false))
    .replaceAll('{hallNew}',cardCoins('hall',true));
}
/** A saved tutorial that makes sense, or undefined. A bad one is not worth refusing a save over.
 *  The first version saved `{step, progress}` or `{done:true}`; those become the tips it had shown. */
export function normalizeTutorial(t) {
  if(!t||typeof t!=='object'||Array.isArray(t))return undefined;
  if(Array.isArray(t.seen))return {seen:[...new Set(t.seen.filter(id=>IDS.includes(id)))]};
  if(t.done===true)return {seen:[...IDS]};
  if(Number.isInteger(t.step)&&t.step>=0&&t.step<STEPS.length&&Number.isFinite(t.progress)&&t.progress>=0)
    return {seen:IDS.slice(0,t.step)};
  return undefined;
}
