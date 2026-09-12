/**
 * The bank on the square.
 *
 * You can borrow once, against nothing, and you pay it back in equal daily instalments. The
 * instalment is taken automatically as each in-game day turns over. Missing one is not fatal
 * and nothing is ever repossessed: what it costs you is a late fee on the balance and a worse
 * impression around town, which shows up as sourer vendors until you have cleared it.
 */
export const LOANS=[
  {id:'small', zh:'小额',  pinyin:'xiǎo é',   en:'Small',  amount:60,  days:4, rate:.12},
  {id:'medium',zh:'中额',  pinyin:'zhōng é',  en:'Medium', amount:150, days:6, rate:.18},
  {id:'large', zh:'大额',  pinyin:'dà é',     en:'Large',  amount:320, days:8, rate:.25},
];
export const LATE_FEE=.1;

export const loanById=id=>LOANS.find(l=>l.id===id)??null;
export function debtOf(profile){
  const d=profile.debt;
  if(!d||!Number.isFinite(d.owed)||d.owed<=0)return null;
  return {owed:Math.round(d.owed),perDay:Math.round(d.perDay),nextDay:d.nextDay,missed:d.missed??0,loan:d.loan};
}
export const isOverdue=profile=>(debtOf(profile)?.missed??0)>0;

export function totalDue(loan){return Math.round(loan.amount*(1+loan.rate));}

/** Borrow. One loan at a time — clear the first before the bank will write another. */
export function takeLoan(profile,loan,dayIndex){
  if(debtOf(profile))return {ok:false,reason:'outstanding'};
  if(!loan)return {ok:false,reason:'unknown'};
  const owed=totalDue(loan);
  profile.debt={loan:loan.id,owed,perDay:Math.ceil(owed/loan.days),nextDay:(dayIndex??0)+1,missed:0};
  profile.wallet+=loan.amount;
  return {ok:true,owed,received:loan.amount};
}

/** Pay something off by hand. Returns what actually left the wallet. */
export function repay(profile,amount){
  const debt=debtOf(profile);
  if(!debt)return {ok:false,reason:'none'};
  const paid=Math.min(Math.max(0,Math.floor(amount)),debt.owed,profile.wallet);
  if(paid<=0)return {ok:false,reason:'funds'};
  profile.wallet-=paid;
  profile.debt.owed=debt.owed-paid;
  if(profile.debt.owed<=0){delete profile.debt;return {ok:true,paid,cleared:true};}
  if(paid>=debt.perDay)profile.debt.missed=Math.max(0,(profile.debt.missed??0)-1);
  return {ok:true,paid,cleared:false};
}

/**
 * Called once for each in-game day that has passed. Takes every instalment that has fallen due,
 * so a player who left the game running overnight owes the same as one who did not.
 */
export function settleDays(profile,dayIndex){
  const events=[];
  for(let guard=0;guard<64;guard++){
    const debt=debtOf(profile);
    if(!debt||dayIndex<debt.nextDay)break;
    const due=Math.min(debt.perDay,debt.owed);
    if(profile.wallet>=due){
      profile.wallet-=due;
      profile.debt.owed=debt.owed-due;
      events.push({paid:due,owed:Math.max(0,profile.debt.owed)});
      if(profile.debt.owed<=0){delete profile.debt;events.push({cleared:true});break;}
    }else{
      const fee=Math.ceil(debt.owed*LATE_FEE);
      profile.debt.owed=debt.owed+fee;
      profile.debt.missed=(debt.missed??0)+1;
      events.push({missed:true,fee,owed:profile.debt.owed});
    }
    profile.debt.nextDay=debt.nextDay+1;
  }
  return events;
}

/**
 * Savings.
 *
 * Simple interest, never compound, paid into the wallet each in-game morning and capped hard.
 * The numbers were picked against what a player actually earns: three errands and a review
 * session is roughly 75 coins a day, so a maxed-out account paying 25 is a real supplement and
 * nowhere near a replacement. Because the payout lands in the wallet rather than the balance,
 * compounding only happens if you walk to the bank and re-deposit — and the cap bounds that too:
 * 1,000 banked and religiously re-deposited is 1,712 after thirty days, not a runaway curve.
 */
export const INTEREST_RATE=.02;
export const INTEREST_CAP=25;
export const INTEREST_FLOOR=20;      // below this a payout would round to nothing
export const INTEREST_HOUR=7;        // paid with the morning

export const savingsOf=profile=>Math.max(0,Math.floor(profile.savings?.balance??0));

export function deposit(profile,amount){
  const moving=Math.min(Math.floor(amount),profile.wallet);
  if(!Number.isFinite(moving)||moving<=0)return {ok:false,reason:'amount'};
  profile.wallet-=moving;
  profile.savings={balance:savingsOf(profile)+moving};
  return {ok:true,moved:moving,balance:savingsOf(profile)};
}
export function withdraw(profile,amount){
  const moving=Math.min(Math.floor(amount),savingsOf(profile));
  if(!Number.isFinite(moving)||moving<=0)return {ok:false,reason:'amount'};
  profile.savings={balance:savingsOf(profile)-moving};
  profile.wallet+=moving;
  return {ok:true,moved:moving,balance:savingsOf(profile)};
}

/** What today's payout would be, at the current balance. */
export const interestOn=balance=>balance<INTEREST_FLOOR?0:Math.min(INTEREST_CAP,Math.floor(balance*INTEREST_RATE));
/** How much you would have to bank to reach the ceiling. */
export const balanceForCap=()=>Math.ceil(INTEREST_CAP/INTEREST_RATE);

/**
 * Building permits.
 *
 * A large construction project needs one, and the bank is the only place to get it. Pay the lot
 * up front, or spread it over four in-game weeks for a surcharge — the instalment comes out of
 * the account automatically, the same way a loan repayment does.
 */
export const PERMITS=[
  {id:'shop',    zh:'商铺执照', pinyin:'shāngpù zhízhào', en:'Shop permit',
   note:'盖一间店铺需要的执照。', noteEn:'Required before you can raise a shop on a build site.',
   price:240, weeks:4, surcharge:.2},
  {id:'expand',  zh:'扩建许可', pinyin:'kuòjiàn xǔkě',    en:'Expansion permit',
   note:'加盖楼层或扩大店面。',   noteEn:'For adding a floor, or widening a frontage.',
   price:480, weeks:4, surcharge:.2},
];
export const permitById=id=>PERMITS.find(permit=>permit.id===id)??null;
export const permitTotal=(permit,plan)=>plan==='weekly'
  ? Math.ceil(permit.price*(1+permit.surcharge))
  : permit.price;

export const holdsPermit=(profile,id)=>!!profile.completed?.includes('permit:'+id);
export const permitPlan=(profile,id)=>(profile.permitPlans??[]).find(plan=>plan.id===id)??null;

/** Buy one. A lump sum grants it immediately; instalments grant it now and bill you weekly. */
export function buyPermit(profile,permit,plan,week){
  if(!permit)return {ok:false,reason:'unknown'};
  if(holdsPermit(profile,permit.id))return {ok:false,reason:'held'};
  if(permitPlan(profile,permit.id))return {ok:false,reason:'paying'};
  const total=permitTotal(permit,plan);
  if(plan==='lump'){
    if(profile.wallet<total)return {ok:false,reason:'funds'};
    profile.wallet-=total;
  }else{
    const perWeek=Math.ceil(total/permit.weeks);
    if(profile.wallet<perWeek)return {ok:false,reason:'funds'};
    profile.wallet-=perWeek;
    profile.permitPlans=[...(profile.permitPlans??[]),
      {id:permit.id,owed:total-perWeek,perWeek,nextWeek:(week??0)+1}];
  }
  profile.completed=[...(profile.completed??[]),'permit:'+permit.id];
  return {ok:true,total,plan};
}

/** Take any instalments that have fallen due. Wallet first, then savings. */
export function settleWeeks(profile,week){
  const events=[];
  for(const plan of [...(profile.permitPlans??[])]){
    for(let guard=0;guard<16;guard++){
      if(plan.owed<=0||week<plan.nextWeek)break;
      const due=Math.min(plan.perWeek,plan.owed);
      const fromWallet=Math.min(due,profile.wallet);
      const fromSavings=Math.min(due-fromWallet,savingsOf(profile));
      if(fromWallet+fromSavings<due){events.push({permit:plan.id,missed:true,due});break;}
      profile.wallet-=fromWallet;
      if(fromSavings)profile.savings={balance:savingsOf(profile)-fromSavings};
      plan.owed-=due;plan.nextWeek+=1;
      events.push({permit:plan.id,paid:due,owed:plan.owed});
    }
  }
  profile.permitPlans=(profile.permitPlans??[]).filter(plan=>plan.owed>0);
  return events;
}
