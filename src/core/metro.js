import city from '../content/city.json' with {type:'json'};
import metro from '../content/metro.json' with {type:'json'};

/**
 * The metro line between 青禾 and 云海市中心.
 *
 * Going out costs something; coming home never does. Being stranded in a city you cannot afford
 * to leave would be a cruel thing to do to someone who is here to practise a language, so the
 * return leg is always free and the only decision the fare box asks you to make is single
 * tickets against a week's pass.
 *
 * The pass is priced so it is worth buying if — and only if — you actually intend to live in
 * the city for a while: seven days of travel for the price of a bit under seven single
 * journeys. Buying it on a whim on day one and never going back is a small loss, which is the
 * right shape for a lesson about 通票.
 */
export const FARE=city.fare;

export function metroOf(profile){
  const m=profile.metro;
  return {rides:Math.max(0,Math.trunc(m?.rides??0)),passUntil:Number.isSafeInteger(m?.passUntil)?m.passUntil:null,
    trips:Math.max(0,Math.trunc(m?.trips??0)),heard:Number.isSafeInteger(m?.heard)?m.heard:null};
}
function write(profile,next){
  profile.metro={...profile.metro,rides:next.rides,...(next.passUntil===null?{}:{passUntil:next.passUntil}),trips:next.trips,
    ...(next.heard===null?{}:{heard:next.heard})};
  return profile.metro;
}

/** A pass covers today if today is before the day it runs out. */
export function passValid(profile,dayIndex=profile.dayIndex??0){
  const {passUntil}=metroOf(profile);
  return passUntil!==null&&dayIndex<passUntil;
}
export function passDaysLeft(profile,dayIndex=profile.dayIndex??0){
  const {passUntil}=metroOf(profile);
  return passUntil===null?0:Math.max(0,passUntil-dayIndex);
}

export function buyTickets(profile,count=1){
  const want=Math.max(1,Math.min(9,Math.trunc(count)));
  const cost=FARE.single*want;
  if(profile.wallet<cost)return {ok:false,reason:'money',cost};
  const state=metroOf(profile);
  profile.wallet-=cost;
  write(profile,{...state,rides:state.rides+want});
  return {ok:true,bought:want,cost};
}

export function buyPass(profile,dayIndex=profile.dayIndex??0){
  if(passValid(profile,dayIndex))return {ok:false,reason:'held'};
  if(profile.wallet<FARE.pass)return {ok:false,reason:'money',cost:FARE.pass};
  const state=metroOf(profile);
  profile.wallet-=FARE.pass;
  write(profile,{...state,passUntil:dayIndex+FARE.passDays});
  return {ok:true,cost:FARE.pass,until:dayIndex+FARE.passDays};
}

/** Why you cannot board right now, or null if you can. */
export function boardingProblem(profile,dayIndex=profile.dayIndex??0){
  if(passValid(profile,dayIndex))return null;
  return metroOf(profile).rides>0?null:'ticket';
}

/**
 * Take one journey out to the city. A pass is punched rather than spent; otherwise one single
 * ticket is used up. Returns how the fare was paid so the panel can say so.
 */
export function board(profile,dayIndex=profile.dayIndex??0){
  if(boardingProblem(profile,dayIndex))return {ok:false,reason:'ticket'};
  const state=metroOf(profile);
  if(passValid(profile,dayIndex)){
    write(profile,{...state,trips:state.trips+1});
    return {ok:true,how:'pass'};
  }
  write(profile,{...state,rides:state.rides-1,trips:state.trips+1});
  return {ok:true,how:'ticket',left:state.rides-1};
}

/** The journey home. Free, always, and it still counts as a trip you have made. */
export function returnTrip(profile){
  const state=metroOf(profile);
  write(profile,{...state,trips:state.trips+1});
  return {ok:true,how:'free'};
}

/**
 * Picking the stop the announcement named pays a coin, once per ride. `heard` is the number of
 * the trip already paid for, so the next journey (out or home) can pay again.
 */
export function announcementReward(profile){
  const state=metroOf(profile);
  if(state.heard===state.trips)return 0;
  write(profile,{...state,heard:state.trips});
  profile.wallet+=metro.reward;
  return metro.reward;
}

/** What a save is allowed to say about your travel. */
export function normalizeMetro(m){
  if(m===undefined||m===null)return undefined;
  if(typeof m!=='object'||Array.isArray(m))throw Error('Invalid metro');
  const whole=(v,hi)=>Number.isSafeInteger(v)&&v>=0&&v<=hi;
  if(!whole(m.rides??0,999)||!whole(m.trips??0,100000))throw Error('Invalid metro');
  if(m.passUntil!==undefined&&!whole(m.passUntil,1000000))throw Error('Invalid metro');
  if(m.heard!==undefined&&!whole(m.heard,100000))throw Error('Invalid metro');
  const card=validateCard(m);
  return {...card,rides:m.rides??0,...(m.passUntil===undefined?{}:{passUntil:m.passUntil}),trips:m.trips??0,
    ...(m.heard===undefined?{}:{heard:m.heard})};
}

// Transit-card state is additive; legacy tickets retain their six-coin purchase value.
function validateCard(m){
 const out={};
 for(const key of ['balance','sequence'])if(m[key]!==undefined){if(!Number.isSafeInteger(m[key])||m[key]<0||m[key]>100000000)throw Error('Invalid transit card');out[key]=m[key];}
 if(m.fade!==undefined){if(typeof m.fade!=='boolean')throw Error('Invalid ride preference');out.fade=m.fade;}
 if(m.journey!=null){const j=m.journey;if(!j||typeof j!=='object'||!Number.isSafeInteger(j.id)||j.id<1||!quoteFare(j.origin,j.destination).ok||!Number.isSafeInteger(j.cost)||j.cost<0||j.cost>8||!['reserved','riding'].includes(j.phase))throw Error('Invalid journey');out.journey={id:j.id,origin:j.origin,destination:j.destination,cost:j.cost,phase:j.phase};}
 return out;
}
export function cardBalance(p){return p.metro?.balance??(p.metro?.rides??0)*FARE.single;}
function card(p){const old=normalizeMetro(p.metro)??{rides:0,trips:0};p.metro={...old,balance:cardBalance(p),rides:0,sequence:old.sequence??0};return p.metro;}
export function fareForDistance(distance){if(!Number.isFinite(distance)||distance<=0)return null;return metro.network.fareBands.find(b=>distance<=b.max)?.cost??null;}
export function quoteFare(origin,destination){const route=metro.network.routes.find(r=>(r.from===origin&&r.to===destination)||(r.to===origin&&r.from===destination));return route?{ok:true,cost:fareForDistance(route.distance),distance:route.distance}:{ok:false,reason:'route'};}
export function topUpCard(p,amount){if(!Number.isSafeInteger(amount)||amount<=0||amount>100000||!Number.isFinite(p.wallet)||p.wallet<amount||cardBalance(p)+amount>100000000)return {ok:false,reason:'money'};const m=card(p);p.wallet-=amount;m.balance+=amount;return {ok:true,balance:m.balance};}
export function enterJourney(p,origin,destination){const quote=quoteFare(origin,destination);if(!quote.ok)return quote;const m=card(p);if(m.journey)return {ok:false,reason:'pending'};const cost=passValid(p)?0:quote.cost;if(m.balance<cost)return {ok:false,reason:'balance',cost};const id=++m.sequence;m.journey={id,origin,destination,cost,phase:'reserved'};return {ok:true,id,cost};}
export function cancelJourney(p){const m=card(p);if(!m.journey||m.journey.phase==='riding')return {ok:false};delete m.journey;return {ok:true};}
export function completeJourney(p,id){const m=card(p),j=m.journey;if(!j||j.id!==id||m.balance<j.cost)return {ok:false};m.balance-=j.cost;m.trips++;delete m.journey;return {ok:true,destination:j.destination,cost:j.cost};}
