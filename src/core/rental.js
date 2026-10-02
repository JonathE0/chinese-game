import data from '../content/rental.json' with {type:'json'};

/**
 * Renting a flat in 海景公寓 (src/content/rental.json): whole coins for whole in-game days, paid in
 * advance, one lease at a time. The save keeps only {id, until, revision}: which flat, the day the
 * lease runs out (it has lapsed from the start of that day), and a count that every payment raises,
 * so a quote made before a payment can never be paid a second time. No rent is taken while the game
 * is closed: in-game days only pass in play.
 */
const UNITS=new Map(data.units.map(u=>[u.id,u])),AMENITIES=new Map(data.amenities.map(a=>[a.id,a]));
const FLOORS=new Map(data.stops.map(s=>[s.room,s.floor]));
export const unitOf=id=>UNITS.get(id)??null;
export const amenityOf=id=>AMENITIES.get(id)??null;
/** The floor a room of the tower is on (the lift's stops), or null. */
export const floorOf=id=>FLOORS.get(id)??null;

export function normalizeRental(v){
  if(!v||!UNITS.has(v.id)||!Number.isSafeInteger(v.until)||v.until<0||!Number.isSafeInteger(v.revision)||v.revision<1)return undefined;
  return {id:v.id,until:v.until,revision:v.revision};
}
/** Where the lease stands today: `tier` is what it opens (0 once lapsed). */
export function leaseStatus(p){
  const r=normalizeRental(p.rental),days=Math.max(0,(r?.until??0)-(p.dayIndex??0)),unit=r?UNITS.get(r.id):null;
  return {active:days>0,days,until:r?.until??0,held:!!r,soon:days>0&&days<=data.warningDays,unit,tier:days>0?unit.tier:0};
}
/**
 * What paying for `unitId` would do today. `rent` a flat when no lease is running, `renew` the one
 * you hold (from its end if it is still running, from today if it has lapsed), or `move` from the
 * flat you are renting now: its unused days come back pro rata (whole coins, rounded down), so `pay`
 * is below zero when moving somewhere cheaper. A lease is never paid further ahead than one term:
 * renewal opens once less than a whole term is left, which is also what stops a double click from
 * paying twice when its second half lands on the freshly drawn Renew button.
 */
export function quoteLease(p,unitId){
  const unit=UNITS.get(unitId),s=leaseStatus(p),revision=p.rental?.revision??0,day=p.dayIndex??0;
  if(!unit)return {ok:false,reason:'unit',revision};
  const renew=s.held&&p.rental.id===unitId,from=s.active&&!renew?s.unit:null;
  const refund=from?Math.floor(from.price*s.days/data.days):0;
  const quote={ok:true,action:renew?'renew':from?'move':'rent',unit,cost:unit.price,refund,pay:unit.price-refund,
    days:data.days,until:(renew?Math.max(day,s.until):day)+data.days,from:from?.id??null,revision};
  return renew&&s.days>=data.days?{...quote,ok:false,reason:'paid'}:quote;
}
/** Pays for the quote made at `revision`; nothing changes unless it is still the lease's revision. */
export function rentApartment(p,unitId,revision){
  if(revision!==(p.rental?.revision??0))return {ok:false,reason:'changed'};
  const q=quoteLease(p,unitId);
  if(!q.ok)return {ok:false,reason:q.reason};
  if(!Number.isFinite(p.wallet)||p.wallet<q.pay)return {ok:false,reason:'money'};
  if(!Number.isSafeInteger(q.until))return {ok:false,reason:'day'};
  p.wallet-=q.pay;p.rental={id:unitId,until:q.until,revision:revision+1};
  return {ok:true,action:q.action,until:q.until,cost:q.cost,refund:q.refund,paid:q.pay,from:q.from};
}
/** A flat opens to its own running lease, an amenity to any running lease of its tier or better;
 *  everywhere else (the lobby, the lift, the Qinghe home) is open to all. */
export function rentalAccess(p,place){
  if(UNITS.has(place)){const s=leaseStatus(p);return s.active&&p.rental.id===place;}
  const amenity=AMENITIES.get(place);
  return !amenity||leaseStatus(p).tier>=amenity.tier;
}
