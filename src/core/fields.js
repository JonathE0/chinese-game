import fields from '../content/fields.json' with {type:'json'};
import {grant} from './economy.js';
import {bump,syncDay} from './daily.js';

/**
 * 青禾田园's two errands (docs/superpowers/specs/2026-10-01-fields-design.md): fishing off 王爷爷's
 * pier and picking 刘奶奶's vegetables. The rules only; the scene is src/world/fields.js and the play
 * src/ui/fields.js. Lesson ids land in `completed` when each conversation is finished
 * (src/core/conversation.js); the flags here mark what happened in between.
 */
const F=fields.fishing,V=fields.vegetables;
/** 王爷爷 has given you his rod: his first conversation is finished. */
export const ROD_LESSON='fishing-wang';
/** The first fish is in the bag; 王爷爷 asks to see it. */
export const CAUGHT_FLAG='fish:caught';
/** The fishing mission is done: the first fish has been shown to him. */
export const FISH_FLAG='fish:first';
/** The vegetable mission is done: 刘奶奶 has her basket and has given you yours. */
export const VEG_FLAG='veg:first';

/** How long after a cast the float dips, in seconds, from `random` (0..1). */
export const biteAfter=(random=Math.random)=>F.wait[0]+(F.wait[1]-F.wait[0])*random();

/** Reeling in `t` seconds after the cast, with the bite at `bite`: 'early' before the float dips,
 *  'caught' within the window after it, 'late' once the window has passed (the fish got away). */
export function reelResult(t,bite){
  if(t<bite)return 'early';
  return t<=bite+F.window?'caught':'late';
}

/** Which fish is on the hook: the very first is always a carp (王爷爷 names it when he sees it),
 *  later ones any of the three. */
export function fishFor(profile,random=Math.random){
  if(!profile.completed.includes(CAUGHT_FLAG))return F.first;
  return F.fish[Math.min(F.fish.length-1,Math.floor(random()*F.fish.length))];
}
/** A fish into the bag, counted against the day's catch. */
export function landFish(profile,id){
  profile.inventory[id]=(profile.inventory[id]??0)+1;
  if(!profile.completed.includes(CAUGHT_FLAG))profile.completed.push(CAUGHT_FLAG);
  bump(profile,'fish');
}
/** How many more fish bite today (fields.json `perDay`, so the pier is not a bottomless purse). */
export const fishLeft=profile=>Math.max(0,F.perDay-(syncDay(profile,profile.dayIndex??0).counts.fish??0));

/** 刘奶奶's basket, {vegetable: count}: right only with exactly what she asked for. */
export function basketRight(basket){
  return [...new Set([...Object.keys(basket),...Object.keys(V.order)])].every(id=>(basket[id]??0)===(V.order[id]??0));
}
export function pickInto(basket,id){basket[id]=(basket[id]??0)+1;return basket;}
export function putBack(basket,id){if(basket[id]>0&&!--basket[id])delete basket[id];return basket;}

/** Her thanks, once: coins and the vegetables, as catalog ingredients for the home kitchen. */
export function harvest(profile){
  if(profile.completed.includes(VEG_FLAG))return {coins:0,items:{}};
  profile.completed.push(VEG_FLAG);
  const coins=grant(profile,VEG_FLAG,V.reward.coins);
  for(const [id,n] of Object.entries(V.reward.items))profile.inventory[id]=(profile.inventory[id]??0)+n;
  return {coins,items:{...V.reward.items}};
}
