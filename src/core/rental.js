import data from '../content/rental.json' with {type:'json'};
export function normalizeRental(v){if(!v||v.id!==data.id||!Number.isSafeInteger(v.until)||v.until<0||!Number.isSafeInteger(v.revision)||v.revision<1)return undefined;return {id:v.id,until:v.until,revision:v.revision};}
export function leaseStatus(p){const r=normalizeRental(p.rental),days=Math.max(0,(r?.until??0)-(p.dayIndex??0));return {active:days>0,days,until:r?.until??0,held:!!r,soon:days>0&&days<=data.warningDays};}
export function quoteLease(p){return {cost:data.price,days:data.days,revision:p.rental?.revision??0};}
export function rentApartment(p,revision){if(revision!==(p.rental?.revision??0))return {ok:false,reason:'changed'};if(!Number.isFinite(p.wallet)||p.wallet<data.price)return {ok:false,reason:'money'};const day=p.dayIndex??0,until=Math.max(day,normalizeRental(p.rental)?.until??day)+data.days;if(!Number.isSafeInteger(until))return {ok:false,reason:'day'};p.wallet-=data.price;p.rental={id:data.id,until,revision:revision+1};return {ok:true,until,cost:data.price};}
export const renewLease=rentApartment;
export function rentalAccess(p,place){return place!==data.id||leaseStatus(p).active;}
