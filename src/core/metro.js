import city from '../content/city.json' with {type:'json'};
import metro from '../content/metro.json' with {type:'json'};

/**
 * The metro between 青禾 and 云海 on a rechargeable transit card (交通卡).
 *
 * Coins only ever move from the wallet onto the card (topUpCard). Tapping in at a gate reserves the
 * fare for the route (enterJourney); walking back out of the station cancels it (cancelJourney);
 * stepping aboard puts the journey under way (boardJourney); arriving charges it, once
 * (completeJourney). There is no free ride in either direction: with too little on the card, study
 * earns the coins. Every step is saved, so a reload finds a journey reserved (cancelled, nothing
 * charged) or riding (completed at the far platform, charged once).
 *
 * Saves from before the card held single tickets (`rides`, bought at the old single fare) and perhaps
 * a week's pass (`passUntil`, a day index). upgradeMetro turns the tickets into card credit at what
 * they cost; a pass keeps riding free until it runs out, and no new one is sold.
 */
const LEGACY_TICKET=city.fare.single,CARD_MAX=100000000,TOP_UP_MAX=100000;
const MAX_FARE=Math.max(...metro.network.fareBands.map(band=>band.cost));

export function metroOf(profile){
  const m=profile.metro;
  return {trips:m?.trips??0,passUntil:m?.passUntil??null,heard:m?.heard??null,balance:m?.balance??0};
}
/** A pass covers today if today is before the day it runs out. */
export function passValid(profile,dayIndex=profile.dayIndex??0){
  const until=profile.metro?.passUntil;
  return Number.isSafeInteger(until)&&dayIndex<until;
}
export function passDaysLeft(profile,dayIndex=profile.dayIndex??0){
  const until=profile.metro?.passUntil;
  return Number.isSafeInteger(until)?Math.max(0,until-dayIndex):0;
}
export function cardBalance(profile){return profile.metro?.balance??0;}
function card(profile){profile.metro={trips:0,balance:0,sequence:0,...profile.metro};return profile.metro;}

export function fareForDistance(distance){
  if(!Number.isFinite(distance)||distance<=0)return null;
  return metro.network.fareBands.find(band=>distance<=band.max)?.cost??null;
}
/** The fare between two stations, in either direction; only routes in metro.json operate. */
export function quoteFare(origin,destination){
  const route=metro.network.routes.find(r=>(r.from===origin&&r.to===destination)||(r.to===origin&&r.from===destination));
  return route?{ok:true,cost:fareForDistance(route.distance),distance:route.distance}:{ok:false,reason:'route'};
}
export function topUpCard(profile,amount){
  if(!Number.isSafeInteger(amount)||amount<=0||amount>TOP_UP_MAX||!Number.isFinite(profile.wallet)||profile.wallet<amount
    ||cardBalance(profile)+amount>CARD_MAX)return {ok:false,reason:'money'};
  const m=card(profile);
  profile.wallet-=amount;m.balance+=amount;
  return {ok:true,balance:m.balance};
}
/** Tap in: the fare (nothing on an unexpired pass) is held on the card, not yet taken. */
export function enterJourney(profile,origin,destination){
  const quote=quoteFare(origin,destination);
  if(!quote.ok)return quote;
  const m=card(profile);
  if(m.journey)return {ok:false,reason:'pending'};
  const cost=passValid(profile)?0:quote.cost;
  if(m.balance<cost)return {ok:false,reason:'balance',cost};
  m.journey={id:++m.sequence,origin,destination,cost,phase:'reserved'};
  return {ok:true,id:m.journey.id,cost};
}
/** Leaving without travelling: the hold is simply dropped. A journey under way cannot be undone. */
export function cancelJourney(profile){
  if(profile.metro?.journey?.phase!=='reserved')return {ok:false};
  delete profile.metro.journey;
  return {ok:true};
}
export function boardJourney(profile,id){
  const j=profile.metro?.journey;
  if(j?.id!==id||j.phase!=='reserved')return {ok:false};
  j.phase='riding';
  return {ok:true};
}
/**
 * Arriving takes the fare, once. A journey under way always arrives: should the card somehow hold
 * less than the fare (only a hand-edited save can do that), it takes what is there rather than
 * leaving the traveller on a train that never gets in.
 */
export function completeJourney(profile,id){
  const m=profile.metro,j=m?.journey;
  if(j?.id!==id||j.phase!=='riding')return {ok:false};
  const cost=Math.min(j.cost,m.balance??0);
  m.balance=(m.balance??0)-cost;m.trips=(m.trips??0)+1;delete m.journey;
  return {ok:true,destination:j.destination,cost};
}

/**
 * Picking the stop the announcement named pays a coin, once per ride, and only on a ride.
 * `heard` is the number of the ride it paid for (the ride under way is trips + 1), so the next
 * journey, out or home, can pay again.
 */
export function announcementReward(profile){
  const m=profile.metro;
  if(m?.journey?.phase!=='riding')return 0;
  const ride=(m.trips??0)+1;
  if(m.heard===ride)return 0;
  m.heard=ride;
  profile.wallet+=metro.reward;
  return metro.reward;
}

/** The save-format step to the card (profile.js UPGRADES): unused tickets become credit at what they cost. */
export function upgradeMetro(m){
  if(!m||typeof m!=='object'||Array.isArray(m))return m;   // left for normalizeMetro to judge
  const {rides,...rest}=m,tickets=Number.isSafeInteger(rides)&&rides>0?rides:0;
  if(!tickets)return rest;
  return {...rest,balance:(Number.isFinite(rest.balance)?rest.balance:0)+tickets*LEGACY_TICKET};
}
/**
 * What a save may say about travel. A record that is not an object at all throws (decodeProfile
 * drops it); otherwise each bad field goes on its own and `repaired` is told, so a damaged journey
 * never costs the card its money or the counts their history. A damaged balance is rounded into
 * range rather than dropped.
 */
export function normalizeMetro(m,repaired=()=>{}){
  if(m===undefined||m===null)return undefined;
  if(typeof m!=='object'||Array.isArray(m))throw Error('Invalid metro');
  const whole=(v,hi)=>Number.isSafeInteger(v)&&v>=0&&v<=hi,out={};
  if(m.balance!==undefined){
    out.balance=Number.isFinite(m.balance)?Math.min(CARD_MAX,Math.max(0,Math.floor(m.balance))):0;
    if(out.balance!==m.balance)repaired();
  }
  for(const [key,hi] of [['trips',100000],['passUntil',1000000],['heard',100000],['sequence',CARD_MAX]]){
    if(m[key]===undefined)continue;
    if(whole(m[key],hi))out[key]=m[key];else repaired();
  }
  if(m.fade!==undefined){if(typeof m.fade==='boolean')out.fade=m.fade;else repaired();}
  const j=m.journey;
  if(j!==undefined&&j!==null){
    if(j&&typeof j==='object'&&whole(j.id,CARD_MAX)&&j.id>0&&quoteFare(j.origin,j.destination).ok&&whole(j.cost,MAX_FARE)&&['reserved','riding'].includes(j.phase))
      out.journey={id:j.id,origin:j.origin,destination:j.destination,cost:j.cost,phase:j.phase};
    else repaired();
  }
  return out;
}
