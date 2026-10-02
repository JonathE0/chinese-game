import quests from '../content/quests.json' with {type:'json'};
import roots from '../content/roots.json' with {type:'json'};
import unlock from '../content/unlock.json' with {type:'json'};
import {mastered} from './mastery.js';

/**
 * The metro to Yunhai opens once the small town is finished: every town mission in unlock.json,
 * plus the Roots steps a guest can finish offline in Qinghe (meeting Uncle Zhou, the Qinghe photos,
 * the practice). Then Auntie Lin hands over Grandpa's card (CARD_FLAG) and the station attendant's
 * chat activates it (CHECK_FLAG). Saves that already travelled keep their metro.
 */
export const CARD_FLAG='metro:card',CHECK_FLAG='metro:check';

/** Whether one mission in quests.json is done. `gates` are the district states (src/core/progress.js). */
export function questDone(p,quest,gates){
  const done=quest?.done??{};
  if(done.flag)return p.completed.includes(done.flag);
  if(done.metric==='discovered')return (p.discovered?.length??0)>=done.count;
  if(done.metric==='home')return (p.home?.length??0)>=done.count;
  if(done.metric==='ordered')return Object.keys(p.claims??{}).some(k=>k.startsWith('order:'));
  // Before the word list loads there are no gate states; having walked in shows the gate was open.
  if(done.metric==='district')return !!gates?.find(s=>s.id===done.district)?.unlocked||!!p.learning?.visited?.includes(done.district);
  return false;
}

/** Every step the town asks for, in order, each {id, done}. */
export function townSteps(p,gates){
  const r=p.roots??{};
  return [
    // A listed mission that quests.json does not have yet is not asked for.
    ...unlock.townQuests.map(id=>quests.quests.find(q=>q.id===id)).filter(Boolean).map(q=>({id:q.id,done:questDone(p,q,gates)})),
    {id:'roots:met',done:r.met===true},
    ...roots.memories.filter(m=>m.place==='town').map(m=>({id:'roots:'+m.id,done:!!r.photos?.includes(m.id)})),
    {id:'roots:practice',done:roots.skills.every(s=>mastered(r.mastery??{},s.id,roots.skills))},
  ];
}
export const townQuestsLeft=(p,gates)=>townSteps(p,gates).filter(s=>!s.done).map(s=>s.id);

const travelled=p=>(p.metro?.trips??0)>0||p.completed.some(f=>f==='metro:first'||/^city[:-]/.test(f));
// Admin mode (main.js `?admin`, dev server only) marks the page; nothing in the save says so.
const adminPage=()=>globalThis.document?.body?.classList?.contains('admin')===true;

/** The gates let you through: the card is active, the save already travelled, or admin mode. */
export const metroOpen=(p,admin=adminPage())=>admin||p.completed.includes(CHECK_FLAG)||travelled(p);

/**
 * What a station target opens (main.js): the card machines (metro:machine) always the card panel,
 * so a player can top up before the unlock; the gates ('metro') the card panel where a journey may
 * start, else the attendant ('locked'). Only journeys from unlock.station wait: the far end always
 * lets you ride home, so a save that has not unlocked (an import, a sign-in) is never stranded there.
 */
export const rideOpen=(p,station,admin=adminPage())=>station!==unlock.station||metroOpen(p,admin);
export const metroPanel=(action,p,station,admin=adminPage())=>action==='metro:machine'||rideOpen(p,station,admin)?'card':'locked';

/** Auntie Lin is waiting with the card: the town is done and she has not given it yet. */
export const cardDue=(p,gates)=>!metroOpen(p,false)&&!p.completed.includes(CARD_FLAG)&&townQuestsLeft(p,gates).length===0;

/** Lin's scene: the card into the bag and Grandpa's Yunhai photo into the album, once. */
export function giveCard(p){
  if(p.completed.includes(CARD_FLAG))return false;
  p.completed.push(CARD_FLAG);
  p.inventory[unlock.card]=(p.inventory[unlock.card]??0)+1;
  p.roots??={};
  p.roots.discovered=[...new Set([...(p.roots.discovered??[]),unlock.photo])];
  return true;
}

/** The attendant's chat passed: the card is active and the gates open. No coins change hands. */
export function passCheck(p){
  if(!p.completed.includes(CARD_FLAG)||p.completed.includes(CHECK_FLAG))return false;
  p.completed.push(CHECK_FLAG);
  return true;
}
