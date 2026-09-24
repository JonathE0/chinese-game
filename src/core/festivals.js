/**
 * Four festivals through the town's year.
 *
 * The last day of every 7-day week is a festival, cycling 春节 → 元宵节 → 端午节 → 中秋节 by week,
 * so a new player meets 春节 on day 6. Payouts (a 红包, a riddle's coin) are claimed through
 * claimPeriod with the festival's day as the period: answering again, reopening the panel or
 * reloading the save never pays twice, and next year's 春节 pays again.
 */
import data from '../content/festivals.json' with {type:'json'};
import {DAYS_PER_WEEK,calendarOf,claimPeriod} from './calendar.js';

export const FESTIVALS=data.festivals,RIDDLES=data.riddles;

export function festivalOn(day){
  if(!Number.isSafeInteger(day)||day<0||day%DAYS_PER_WEEK!==DAYS_PER_WEEK-1)return null;
  return FESTIVALS[Math.floor(day/DAYS_PER_WEEK)%FESTIVALS.length];
}
export const festivalOf=profile=>festivalOn(calendarOf(profile).day);

/** Pay `coins` for `kind` (hongbao-lin, riddle-3) once this festival. Returns what was paid. */
export function festivalPay(profile,kind,coins){
  const {day}=calendarOf(profile);
  if(!festivalOn(day)||!claimPeriod(profile,'fest-'+kind,day))return 0;
  profile.wallet=(profile.wallet??0)+coins;
  return coins;
}

/** Voice clip ids: greetings and replies exist once per townsperson, the rest in the teacher's voice. */
export const festivalClip=(key,person)=>person?`fest-${key}-${person}`:`fest-${key}`;

/** The answer and three other riddles' answers, shuffled. */
export function riddleChoices(riddle,rand=Math.random){
  const shuffle=list=>list.map(v=>[rand(),v]).sort((a,b)=>a[0]-b[0]).map(([,v])=>v);
  const others=shuffle(RIDDLES.filter(r=>r.answer!==riddle.answer).map(r=>r.answer)).slice(0,3);
  return shuffle([riddle.answer,...others]);
}
