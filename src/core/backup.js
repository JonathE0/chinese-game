import {learnedAtLevel} from './progress.js';

/** Rolling browser backups and the daily HSK progress log. Pure; storage lives in services/filesync.js. */
export const BACKUP_LIMIT=14;
export const LOG_HEADER='date,hsk1,hsk2,hsk3,hsk4,hsk5,hsk6,objects,coins';

/** The player's local calendar day, YYYY-MM-DD. */
export function realDay(now=Date.now()){
  const d=new Date(now),two=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${two(d.getMonth()+1)}-${two(d.getDate())}`;
}
/** At most one snapshot per real day, the last BACKUP_LIMIT kept. Returns `list` itself when nothing changes. */
export function rotateBackups(list,profile,now=Date.now()){
  const day=realDay(now);
  if(list.some(b=>b.day===day))return list;
  return [...list,{day,at:now,coins:profile.wallet,raw:JSON.stringify(profile)}].slice(-BACKUP_LIMIT);
}
/** Adds a save kept for safety (whichever copy lost a cloud choice) to the backup list. Its day
 *  carries `label` (云端 or 本机), so it never stands in for that day's own snapshot. */
export function addCopy(list,raw,label,now=Date.now()){
  let coins=0;try{coins=Number(JSON.parse(raw).wallet)||0;}catch{}
  return [...list,{day:`${realDay(now)}（${label}）`,at:now,coins,raw}].slice(-BACKUP_LIMIT);
}

/** Words known per HSK level, counted exactly as the district gates count them. */
export function logRow(profile,words,now=Date.now()){
  return {date:realDay(now),hsk:[1,2,3,4,5,6].map(level=>learnedAtLevel(profile,words,level)),objects:profile.discovered.length,coins:profile.wallet};
}
export const csvLine=row=>[row.date,...row.hsk,row.objects,row.coins].join(',');
/** One row per real day: the first one written that day stays. */
export const addLogRow=(log,row)=>log.some(r=>r.date===row.date)?log:[...log,row];
const count=v=>Number.isSafeInteger(v)&&v>=0;
/** The browser copy of the log, dropping anything malformed. */
export function parseLog(raw){
  let rows;
  try{rows=JSON.parse(raw);}catch{return [];}
  if(!Array.isArray(rows))return [];
  return rows.filter(r=>r&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Array.isArray(r.hsk)&&r.hsk.length===6&&r.hsk.every(count)&&count(r.objects)&&count(r.coins))
    .map(r=>({date:r.date,hsk:[...r.hsk],objects:r.objects,coins:r.coins}));
}

const knownWords=p=>Object.values(p.words).filter(skills=>Object.values(skills).some(r=>r.learned||r.stage>0)).length;
/** True when `a` holds more progress than `b`: more known words, then more named objects. Coins are
 *  left out on purpose: spending lowers them, so the richer save can be the staler one. */
export function moreProgress(a,b){
  const x=[knownWords(a),a.discovered.length],y=[knownWords(b),b.discovered.length];
  const i=x.findIndex((v,k)=>v!==y[k]);
  return i>=0&&x[i]>y[i];
}
