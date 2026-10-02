/**
 * Vendors have a mood and a memory.
 *
 * Mood is rerolled once per in-game day and is fixed for that day, so it cannot be re-rolled by
 * closing and reopening the shop. Rapport is the long game: every deal you close, and every
 * polite phrase you use, nudges every future day upward. A vendor in a bad mood holds a higher
 * floor, gives you fewer rounds, and may put the price *up* if you keep pushing.
 */
const MOODS=[
  {min:0,   key:'sour',    zh:'心情不好', en:'in a bad mood',   face:'😠', rounds:2, give:1, raise:.45},
  {min:.3,  key:'flat',    zh:'不太热情', en:'a bit flat',      face:'😐', rounds:3, give:2, raise:.15},
  {min:.55, key:'warm',    zh:'心情不错', en:'in a good mood',  face:'🙂', rounds:4, give:3, raise:0},
  {min:.8,  key:'sunny',   zh:'今天很开心', en:'having a great day', face:'😄', rounds:5, give:4, raise:0},
];
import {impression} from './stats.js';
import {isOverdue} from './finance.js';
import {folded} from './language.js';

const POLITE=/请|谢谢|您|麻烦|好吗|可以吗|拜托/;
const clamp01=v=>Math.max(0,Math.min(1,v));

/** Deterministic per (day, shop) noise, so a day's mood is stable but unpredictable. */
function noise(dayIndex,shopId){
  let hash=2166136261^(dayIndex>>>0);
  for(const ch of String(shopId)){hash^=ch.codePointAt(0);hash=Math.imul(hash,16777619)>>>0;}
  return ((hash>>>8)%1000)/1000;
}

export const rapportOf=(profile,shopId)=>profile.vendors?.[shopId]?.rapport??0;

export function vendorState(profile,shopId){
  const rapport=rapportOf(profile,shopId);
  // How you turn up matters too: well dressed and well fed reads as a customer worth a discount,
  // and an unpaid debt around a town this size is not a secret.
  const look=(impression(profile,{overdue:isOverdue(profile)})-.5)*.3;
  const value=clamp01(.18+noise(profile.dayIndex??0,shopId)*.62+Math.min(.28,rapport*.02)+look);
  const band=[...MOODS].reverse().find(m=>value>=m.min)??MOODS[0];
  return {shopId,mood:value,rapport,...band};
}

/** The lowest the vendor will go today. A sour vendor keeps most of their margin. */
export function floorFor(item,vendor){
  if(!vendor)return item.minPrice;
  const range=item.price-item.minPrice;
  return Math.round(item.minPrice+range*(1-vendor.mood)*.75);
}

/** Politeness and closed deals both build rapport, slowly and with a ceiling. */
export function buildRapport(profile,shopId,amount){
  profile.vendors??={};
  const record=profile.vendors[shopId]??={rapport:0};
  record.rapport=Math.min(40,Math.max(0,(record.rapport??0)+amount));
  return record.rapport;
}

export const wasPolite=text=>POLITE.test(folded(text??''));

export function moodNote(vendor){
  if(vendor.key==='sour')return {zh:'他今天心情不太好，别太用力砍价。',pinyin:'Tā jīntiān xīnqíng bú tài hǎo.',en:'They are in a poor mood today — push too hard and the price may go up.'};
  if(vendor.key==='flat')return {zh:'今天他不太热情，讲价要客气一点。',pinyin:'Jīntiān tā bú tài rèqíng.',en:'Not very warm today. Be polite if you want a discount.'};
  if(vendor.key==='warm')return {zh:'他今天心情不错，可以商量商量。',pinyin:'Tā jīntiān xīnqíng búcuò.',en:'Good mood today — worth a try.'};
  return {zh:'他今天特别开心，价格好说！',pinyin:'Tā jīntiān tèbié kāixīn!',en:'Great mood today — the price is very negotiable!'};
}
