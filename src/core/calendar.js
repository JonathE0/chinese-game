/**
 * One calendar for the whole town.
 *
 * Several systems want to happen "once a day" or "between these hours", and until now each one
 * counted time its own way. That is how you end up paying a loan twice because the tab was
 * hidden, or a night stall that is open at 01:00 but shut at 01:00 tomorrow. Everything that
 * cares about the clock reads it from here: what day it is, what hour it is, whether a schedule
 * is open right now, and whether a once-per-period payout has already been made.
 *
 * A period claim is stored on the profile as a key like `interest:14`, so it survives a reload
 * and cannot be collected twice however many frames the game runs.
 */
export const DAYS_PER_WEEK=7;

export function calendarOf(profile){
  const day=Number.isSafeInteger(profile.dayIndex)&&profile.dayIndex>=0?profile.dayIndex:0;
  const hour=Number.isFinite(profile.clock)&&profile.clock>=0&&profile.clock<24?profile.clock:15;
  return {day,hour,week:Math.floor(day/DAYS_PER_WEEK),dayOfWeek:day%DAYS_PER_WEEK};
}

/**
 * Is a schedule open at this hour? `from` and `to` are hours; a `to` earlier than `from` wraps
 * past midnight, which is exactly what a night stall wants (18:00 to 02:00).
 */
export function openAt({from,to},hour){
  if(!Number.isFinite(from)||!Number.isFinite(to))return true;
  const h=((hour%24)+24)%24;
  return from<=to?h>=from&&h<to:h>=from||h<to;
}

/** Which calendar day a schedule's session belongs to — the small hours belong to the night before. */
export function sessionDay({from,to},{day,hour}){
  if(from<=to||hour>=from)return day;
  return day-1;                                   // 01:00 is still last night's market
}

const clamp=v=>Math.max(0,Math.min(999999,Math.floor(v)));

/** True the first time this period is claimed, false ever after. Safe to call every frame. */
export function claimPeriod(profile,kind,period){
  const key=`${kind}:${clamp(period)}`;
  profile.claims??={};
  if(profile.claims[key])return false;
  profile.claims[key]=true;
  return true;
}
export const periodClaimed=(profile,kind,period)=>!!profile.claims?.[`${kind}:${clamp(period)}`];

/**
 * How many whole periods have elapsed since `since`, capped so a save left alone for a month
 * cannot pay out a month of interest in one frame.
 */
export function periodsSince(since,now,limit=14){
  if(!Number.isSafeInteger(since)||since>now)return 0;
  return Math.min(limit,now-since);
}

const HOURS=['深夜','清晨','上午','中午','下午','傍晚','夜晚'];
export function partOfDay(hour){
  const h=((hour%24)+24)%24;
  if(h<5)return HOURS[0];
  if(h<8)return HOURS[1];
  if(h<11)return HOURS[2];
  if(h<14)return HOURS[3];
  if(h<17)return HOURS[4];
  if(h<20)return HOURS[5];
  return HOURS[6];
}
