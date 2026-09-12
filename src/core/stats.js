import catalog from '../content/catalog.json' with {type:'json'};
import {SLOTS} from './inventory.js';

/**
 * How the tourist is doing, and what that changes.
 *
 * Two numbers are tracked: how hungry you are and how rested you are. Both drain with the
 * in-game clock, so a full day of walking around costs you something, and both are restored by
 * things you can already do — eating what you bought, sleeping in your own bed. They feed one
 * visible thing (how fast you walk) and one quiet thing (the impression you make, which nudges
 * every vendor's mood). Neither can stop you playing: the floor on walking speed is a limp, not
 * a halt, and nothing is ever taken away from you for being hungry.
 */
const HUNGER_PER_HOUR=2.1;      // leave time for exploration and reading between meals
const ENERGY_PER_HOUR=3.4;
const clamp=(v,lo=0,hi=100)=>Math.max(lo,Math.min(hi,v));
const clamp01=v=>Math.max(0,Math.min(1,v));
const byId=id=>catalog.find(item=>item.id===id);

export function readStats(profile){
  const s=profile.stats;
  return {
    hunger:Number.isFinite(s?.hunger)?clamp(s.hunger):80,
    energy:Number.isFinite(s?.energy)?clamp(s.energy):85,
    hour:Number.isFinite(s?.hour)?s.hour:(profile.clock??15),
  };
}
export function writeStats(profile,next){
  profile.stats={hunger:clamp(next.hunger),energy:clamp(next.energy),hour:next.hour};
  return profile.stats;
}

/**
 * Advance hunger and rest to the current clock.
 *
 * Only time that actually passed while playing is charged. A frame gap is a couple of in-game
 * minutes at most, so anything larger is the clock being *set* rather than ticked — sleeping,
 * reloading a save, a tab coming back — and those resync the marker without taking anything.
 * Getting that wrong once meant every reload arrived starving.
 */
const MAX_TICK=2;                           // in-game hours, about a minute of real play
export function tickStats(profile,hour,running=0){
  const s=readStats(profile);
  let elapsed=hour-s.hour;
  if(elapsed<-12)elapsed+=24;               // the clock crossed midnight between two frames
  if(elapsed<=0||elapsed>MAX_TICK)return writeStats(profile,{...s,hour});
  return writeStats(profile,{
    hunger:s.hunger-elapsed*HUNGER_PER_HOUR,
    energy:s.energy-elapsed*ENERGY_PER_HOUR-running*.9,
    hour,
  });
}

export function eat(profile,item){
  const value=item?.nutrition;
  if(!value)return null;
  const s=readStats(profile);
  return writeStats(profile,{...s,hunger:s.hunger+value,energy:s.energy+Math.round(value*.3)});
}
export function sleep(profile,hours){
  const s=readStats(profile);
  return writeStats(profile,{...s,energy:100,hunger:s.hunger-Math.max(0,hours)*HUNGER_PER_HOUR*.4});
}

export const isEdible=id=>!!byId(id)?.nutrition;

/** The multiplier on walking speed. Hungry and tired both slow you; good shoes help. */
export function speedFactor(profile){
  const {hunger,energy}=readStats(profile);
  const hungry=hunger<35?(hunger<10?.62:.62+(hunger-10)/25*.38):1;
  const tired=energy<35?(energy<10?.72:.72+(energy-10)/25*.28):1;
  let shoes=0;
  const worn=profile.equipped?.shoes&&byId(profile.equipped.shoes);
  if(worn?.wear?.slot==='shoes')shoes=worn.wear.speed??0;
  return Math.max(.55,Math.min(1.35,hungry*tired*(1+shoes)));
}

/** What you look like to the people you are about to haggle with. 0.5 is unremarkable. */
export function impression(profile,{overdue=false}={}){
  let style=0;
  for(const [slot,id] of Object.entries(profile.equipped??{})){
    const item=byId(id);
    if(item?.wear?.slot===slot)style+=Math.min(.14,item.price/220);
  }
  const dressed=SLOTS.every(slot=>profile.equipped?.[slot])?.07:0;
  const {hunger,energy}=readStats(profile);
  const worn=(hunger<25?-.07:0)+(energy<25?-.07:0);
  return clamp01(.5+style+dressed+worn+(overdue?-.14:0));
}

const BANDS=[
  {min:0,  key:'low', zh:'很累',   en:'worn out'},
  {min:30, key:'mid', zh:'还好',   en:'all right'},
  {min:65, key:'good',zh:'状态不错',en:'in good shape'},
];
export const band=value=>[...BANDS].reverse().find(b=>value>=b.min)??BANDS[0];
export function hungerNote(value){
  if(value<15)return {zh:'饿得走不动了。',pinyin:'È de zǒu bu dòng le.',en:'Too hungry to move quickly.'};
  if(value<35)return {zh:'有点饿了。',pinyin:'Yǒudiǎn è le.',en:'Getting hungry.'};
  if(value<70)return {zh:'不饿。',pinyin:'Bú è.',en:'Not hungry.'};
  return {zh:'吃得很饱。',pinyin:'Chī de hěn bǎo.',en:'Well fed.'};
}
export function energyNote(value){
  if(value<15)return {zh:'累坏了，该睡觉了。',pinyin:'Lèi huài le, gāi shuìjiào le.',en:'Exhausted — time for bed.'};
  if(value<35)return {zh:'有点累。',pinyin:'Yǒudiǎn lèi.',en:'A bit tired.'};
  if(value<70)return {zh:'精神还行。',pinyin:'Jīngshen hái xíng.',en:'Doing fine.'};
  return {zh:'精神很好。',pinyin:'Jīngshen hěn hǎo.',en:'Well rested.'};
}
