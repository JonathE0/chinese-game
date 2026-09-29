import data from '../content/checkins.json' with {type:'json'};
import {grant} from './economy.js';

/** The 打卡 camera's check-in spots and album rules (content: src/content/checkins.json). */
export const CHECKINS=data;
export const PHOTO_CAP=60;

const inHours=(hour,[from,to])=>from<=to?hour>=from&&hour<to:hour>=from||hour<to;
/**
 * The check-in spot a photo counts for, or null. `shot` is {place ('town'|'city'|a room id), name
 * (the centred look's {id, zh, …}), owner (its look box's owner), distance (metres), hour}.
 */
export function spotFor(shot,spots=data.spots){
  const name=shot?.name;
  if(!name)return null;
  return spots.find(s=>(!s.place||s.place===shot.place)
    &&(s.looks?.some(k=>k===name.id||k===name.zh)||(!!s.owner&&s.owner===shot.owner))
    &&(s.within===undefined||shot.distance<=s.within)
    &&(!s.hours||inHours(shot.hour,s.hours)))??null;
}
/** Pays and stamps a spot the first time only; the claim `checkin:<id>` is the saved record. */
export const checkIn=(profile,spot)=>grant(profile,'checkin:'+spot.id,data.reward)>0;
export const checkedIn=(profile,id)=>profile.claims?.['checkin:'+id]===true;
/** A new album with `photo` added last and the oldest dropped past the cap. */
export function addPhoto(list,photo,cap=PHOTO_CAP){
  const next=[...list,photo];
  return {list:next,dropped:next.splice(0,Math.max(0,next.length-cap))};
}
