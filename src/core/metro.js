import city from '../content/city.json' with {type:'json'};

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
    trips:Math.max(0,Math.trunc(m?.trips??0))};
}
function write(profile,next){
  profile.metro={rides:next.rides,...(next.passUntil===null?{}:{passUntil:next.passUntil}),trips:next.trips};
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

/** What a save is allowed to say about your travel. */
export function normalizeMetro(m){
  if(m===undefined||m===null)return undefined;
  if(typeof m!=='object'||Array.isArray(m))throw Error('Invalid metro');
  const whole=(v,hi)=>Number.isSafeInteger(v)&&v>=0&&v<=hi;
  if(!whole(m.rides??0,999)||!whole(m.trips??0,100000))throw Error('Invalid metro');
  if(m.passUntil!==undefined&&!whole(m.passUntil,1000000))throw Error('Invalid metro');
  return {rides:m.rides??0,...(m.passUntil===undefined?{}:{passUntil:m.passUntil}),trips:m.trips??0};
}
