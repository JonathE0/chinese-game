/**
 * 打车: the flat fare for a taxi ride across 云海市中心. Kept separate from `core/metro.js`, whose
 * fare comes from `city.json` and is a ticket system for a fixed route — a taxi is a plain five
 * coins, paid on arrival, whichever tower the driver was asked for.
 */
export const TAXI_FARE=5;

/** Why a ride cannot be taken right now, or null if the wallet can cover the fare. */
export function taxiFareProblem(profile,fare=TAXI_FARE){
  return profile.wallet>=fare?null:'money';
}

/**
 * Take the fare. Meant to be called once the ride has actually happened, so the wallet is
 * rechecked here rather than trusted from an earlier `taxiFareProblem` call: too little money
 * leaves it untouched and reports so; enough money is debited exactly once.
 */
export function payTaxiFare(profile,fare=TAXI_FARE){
  if(taxiFareProblem(profile,fare))return {ok:false,reason:'money'};
  profile.wallet-=fare;
  return {ok:true,cost:fare};
}
