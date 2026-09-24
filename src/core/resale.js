import catalog from '../content/catalog.json' with {type:'json'};
import {rapportOf} from './vendor.js';
import {impression} from './stats.js';

/**
 * 老周's second-hand shop on the square.
 *
 * He buys back at a fraction of the list price, and the fraction is rerolled once per in-game
 * day per item, so you cannot reopen the panel to fish for a better number. On a good day, for
 * something you talked Uncle Chen down on, his offer can come out above what you actually paid
 * — which is the whole reason to haggle hard in the first place. Getting to know him, and
 * turning up looking like someone worth dealing with, both lift the offer a little.
 */
const FLOOR=.42,SPREAD=.4;

function noise(dayIndex,itemId){
  let hash=2166136261^((dayIndex>>>0)*40503>>>0);
  for(const ch of String(itemId)){hash^=ch.codePointAt(0);hash=Math.imul(hash,16777619)>>>0;}
  return (hash>>>8)/16777216;
}

export function offerFor(profile,item,dayIndex=profile.dayIndex??0){
  if(!item)return 0;
  const luck=noise(dayIndex,item.id);
  const known=Math.min(.1,rapportOf(profile,'resale')*.006);
  const look=(impression(profile)-.5)*.12;
  return Math.max(1,Math.round(item.price*(FLOOR+luck*SPREAD+known+look)));
}

/** Everything in the bag that 老周 will take, with today's price against each. */
export function sellable(profile,dayIndex=profile.dayIndex??0){
  const placed=new Set((profile.home??[]).map(record=>record.item));
  return catalog
    // Some things are earned rather than bought (the HSK certificates) and are marked not for sale.
    .filter(item=>(profile.inventory[item.id]??0)>0&&item.sellable!==false)
    .map(item=>{
      const owned=profile.inventory[item.id];
      // Furniture standing in your room is not in the bag to sell.
      const inRoom=(profile.home??[]).filter(record=>record.item===item.id).length;
      return {item,spare:owned-inRoom,offer:offerFor(profile,item,dayIndex),placed:placed.has(item.id)};
    })
    .filter(row=>row.spare>0);
}

export function sell(profile,item,price){
  if(!item||!Number.isSafeInteger(price)||price<=0)return {ok:false,reason:'invalid'};
  const owned=profile.inventory[item.id]??0;
  const inRoom=(profile.home??[]).filter(record=>record.item===item.id).length;
  if(owned-inRoom<1)return {ok:false,reason:'none'};
  if(price>item.price)return {ok:false,reason:'invalid'};
  profile.inventory[item.id]=owned-1;
  if(profile.inventory[item.id]<=0)delete profile.inventory[item.id];
  // Something you were wearing comes off as it leaves the bag.
  for(const [slot,id] of Object.entries(profile.equipped??{}))
    if(id===item.id&&!(profile.inventory[item.id]>0))delete profile.equipped[slot];
  profile.wallet+=price;
  return {ok:true,price};
}
