import {normaliseBank} from './bank.js';
import {normalizeCooking} from './cooking.js';
import {normalizeMetro} from './metro.js';
import {normalizeTutorial} from './tutorial.js';
import {normalizeDailyPractice} from './daily-practice.js';
export const SAVE_KEY='little-mandarin-town.v1';
export function freshProfile() {
  return {version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:[],phrases:[],saved:[],home:[],discovered:[],read:[],clock:15,dayIndex:0,vendors:{},settings:{pinyin:true,english:true,dialogueVolume:0.9,ambientVolume:0.35,musicVolume:0.5,sensitivity:0.12,hud:{quests:true,names:true,controls:'en'}},playerName:'旅人'};
}
export function decodeProfile(raw) {
  const p=JSON.parse(raw);
  if (!p || p.version!==1 || !Number.isSafeInteger(p.wallet) || p.wallet<0 || p.wallet>1000000) throw Error('Invalid profile');
  const safeKey=k=>/^[a-zA-Z0-9:_-]{1,120}$/.test(k)&&!['__proto__','constructor','prototype'].includes(k);
  for (const key of ['inventory','claims','words']) {
    if (!p[key] || typeof p[key]!=='object' || Array.isArray(p[key]) || Object.keys(p[key]).length>10000) throw Error('Invalid '+key);
    for (const id of Object.keys(p[key])) if (!safeKey(id)) throw Error('Invalid identifier');
  }
  for (const count of Object.values(p.inventory)) if (!Number.isSafeInteger(count)||count<0||count>999) throw Error('Invalid inventory');
  for (const claim of Object.values(p.claims)) if (claim!==true) throw Error('Invalid claim');
  for (const skills of Object.values(p.words)) {
    if (!skills || typeof skills!=='object'||Array.isArray(skills)) throw Error('Invalid skills');
    for (const [skill,r] of Object.entries(skills)) {
      if (!['recognition','production','listening'].includes(skill) || !r || !Number.isInteger(r.stage)||r.stage<0||r.stage>6 || !Number.isFinite(r.due)||r.due<0||!Number.isFinite(r.last)||r.last<0||!Number.isSafeInteger(r.reviews)||r.reviews<0||(r.learned!==undefined&&r.learned!==true)) throw Error('Invalid review');
    }
  }
  if (!Array.isArray(p.discovered)) p.discovered=[];  // saves written before objects had names
  if (!Array.isArray(p.read)) p.read=[];              // ...and before the library existed
  for (const key of ['completed','phrases','discovered','read']) if (!Array.isArray(p[key])||p[key].length>10000||p[key].some(id=>typeof id!=='string'||!safeKey(id))) throw Error('Invalid '+key);
  if (!Array.isArray(p.saved)) p.saved=[];  // saves written before the pop-up dictionary existed
  if (p.saved.length>2000) throw Error('Invalid saved words');
  for (const w of p.saved) {
    if (!w || typeof w!=='object' || Array.isArray(w)) throw Error('Invalid saved word');
    if (typeof w.zh!=='string' || !w.zh.length || w.zh.length>8) throw Error('Invalid saved word');
    if (typeof w.pinyin!=='string' || w.pinyin.length>80) throw Error('Invalid saved word');
    if (typeof w.en!=='string' || w.en.length>6000) throw Error('Invalid saved word');
    if (w.definitionZh!==undefined&&(typeof w.definitionZh!=='string'||w.definitionZh.length>20000)) throw Error('Invalid Chinese definition');
    if (w.definitionSource!==undefined&&!['moe','xinhua','authored'].includes(w.definitionSource)) throw Error('Invalid definition source');
    if (w.definitionTitle!==undefined&&(typeof w.definitionTitle!=='string'||w.definitionTitle.length>100)) throw Error('Invalid definition title');
    if (w.readings!==undefined&&(!Array.isArray(w.readings)||w.readings.length>100||w.readings.some(r=>!r||typeof r.pinyin!=='string'||r.pinyin.length>80||typeof r.en!=='string'||r.en.length>6000))) throw Error('Invalid alternative readings');
    if (w.id!==undefined && !safeKey(w.id)) throw Error('Invalid saved word');
    if (w.audio!==undefined && !safeKey(w.audio)) throw Error('Invalid saved word');
  }
  if (!Array.isArray(p.home)) p.home=[];  // saves written before the home could be furnished
  if (p.home.length>200) throw Error('Invalid home');
  const finite=(v,limit)=>Number.isFinite(v)&&Math.abs(v)<=limit;
  for (const r of p.home) {
    if (!r || typeof r!=='object' || Array.isArray(r)) throw Error('Invalid furnishing');
    if (!safeKey(r.uid) || !safeKey(r.item) || !safeKey(r.kind)) throw Error('Invalid furnishing');
    if (typeof r.color!=='string' || !/^#[0-9a-fA-F]{3,8}$/.test(r.color)) throw Error('Invalid furnishing');
    if (!Array.isArray(r.footprint) || r.footprint.length!==2 || !r.footprint.every(v=>finite(v,12)&&v>0)) throw Error('Invalid furnishing');
    if (!finite(r.x,60) || !finite(r.z,60)) throw Error('Invalid furnishing');
    if (![0,90,180,270,-90].includes(r.rot)) throw Error('Invalid furnishing');
    if (r.slot!==undefined && !safeKey(r.slot)) throw Error('Invalid furnishing');
    if (r.on!==undefined && !safeKey(r.on)) throw Error('Invalid furnishing');
  }
  if (!Number.isSafeInteger(p.dayIndex)||p.dayIndex<0||p.dayIndex>100000) p.dayIndex=0;
  if (!p.vendors||typeof p.vendors!=='object'||Array.isArray(p.vendors)) p.vendors={};
  for (const [shop,record] of Object.entries(p.vendors)) {
    if (!safeKey(shop)||!record||typeof record!=='object'||Array.isArray(record)) throw Error('Invalid vendor');
    if (!Number.isFinite(record.rapport)||record.rapport<0||record.rapport>1000) throw Error('Invalid vendor');
  }
  if (!Number.isFinite(p.clock)||p.clock<0||p.clock>=24) p.clock=15;   // saves from before the day/night cycle
  if (typeof p.playerName!=='string'||p.playerName.length>32) throw Error('Invalid name');
  // Saves before clothing had slots stored a single item id, or null.
  if (p.equipped===null||p.equipped===undefined) p.equipped={};
  else if (typeof p.equipped==='string') p.equipped=safeKey(p.equipped)?{hat:p.equipped}:{};
  if (typeof p.equipped!=='object'||Array.isArray(p.equipped)) throw Error('Invalid equipment');
  for (const [slot,id] of Object.entries(p.equipped)) {
    if (!['hat','shirt','trousers','shoes'].includes(slot)||typeof id!=='string'||!safeKey(id)) throw Error('Invalid equipment');
  }
  // Saves written before hunger, the bank and daily errands existed simply have none of these.
  const number=(v,lo,hi)=>Number.isFinite(v)&&v>=lo&&v<=hi;
  if (p.stats!==undefined) {
    if (!p.stats||typeof p.stats!=='object'||Array.isArray(p.stats)) throw Error('Invalid stats');
    if (!number(p.stats.hunger,0,100)||!number(p.stats.energy,0,100)||!number(p.stats.hour,0,24)) throw Error('Invalid stats');
    p.stats={hunger:p.stats.hunger,energy:p.stats.energy,hour:p.stats.hour};
  } else p.stats=undefined;
  if (p.debt!==undefined&&p.debt!==null) {
    const d=p.debt;
    if (typeof d!=='object'||Array.isArray(d)||!safeKey(d.loan)) throw Error('Invalid debt');
    if (!number(d.owed,0,1000000)||!number(d.perDay,0,1000000)) throw Error('Invalid debt');
    if (!Number.isSafeInteger(d.nextDay)||d.nextDay<0||!Number.isSafeInteger(d.missed)||d.missed<0||d.missed>9999) throw Error('Invalid debt');
    p.debt={loan:d.loan,owed:d.owed,perDay:d.perDay,nextDay:d.nextDay,missed:d.missed};
  } else p.debt=undefined;
  if (p.savings!==undefined&&p.savings!==null) {
    if (typeof p.savings!=='object'||Array.isArray(p.savings)) throw Error('Invalid savings');
    if (!number(p.savings.balance,0,10000000)) throw Error('Invalid savings');
    p.savings={balance:p.savings.balance};
  } else p.savings=undefined;
  if (p.builds!==undefined) {
    if (!p.builds||typeof p.builds!=='object'||Array.isArray(p.builds)||Object.keys(p.builds).length>32) throw Error('Invalid builds');
    for (const [siteId,record] of Object.entries(p.builds)) {
      if (!safeKey(siteId)||!record||typeof record!=='object'||Array.isArray(record)) throw Error('Invalid builds');
      if (typeof record.done!=='boolean') throw Error('Invalid builds');
      if (!record.given||typeof record.given!=='object'||Array.isArray(record.given)) throw Error('Invalid builds');
      for (const [itemId,count] of Object.entries(record.given))
        if (!safeKey(itemId)||!Number.isSafeInteger(count)||count<0||count>9999) throw Error('Invalid builds');
    }
    p.builds=Object.fromEntries(Object.entries(p.builds).map(([id,record])=>[id,{given:record.given,done:record.done}]));
  } else p.builds=undefined;
  if (p.permitPlans!==undefined) {
    if (!Array.isArray(p.permitPlans)||p.permitPlans.length>16) throw Error('Invalid permits');
    for (const plan of p.permitPlans) {
      if (!plan||typeof plan!=='object'||!safeKey(plan.id)) throw Error('Invalid permits');
      if (!number(plan.owed,0,1000000)||!number(plan.perWeek,0,1000000)) throw Error('Invalid permits');
      if (!Number.isSafeInteger(plan.nextWeek)||plan.nextWeek<0) throw Error('Invalid permits');
    }
    p.permitPlans=p.permitPlans.map(plan=>({id:plan.id,owed:plan.owed,perWeek:plan.perWeek,nextWeek:plan.nextWeek}));
  } else p.permitPlans=undefined;
  if (p.daily!==undefined) {
    const d=p.daily;
    if (!d||typeof d!=='object'||Array.isArray(d)||!Number.isSafeInteger(d.day)||d.day<0) throw Error('Invalid daily');
    if (!d.counts||typeof d.counts!=='object'||Array.isArray(d.counts)||Object.keys(d.counts).length>64) throw Error('Invalid daily');
    for (const [key,value] of Object.entries(d.counts)) if (!safeKey(key)||!Number.isSafeInteger(value)||value<0||value>99999) throw Error('Invalid daily');
    if (!Array.isArray(d.claimed)||d.claimed.length>64||d.claimed.some(id=>!safeKey(id))) throw Error('Invalid daily');
    p.daily={day:d.day,counts:d.counts,claimed:d.claimed};
  } else p.daily=undefined;
  const s=p.settings;
  const cooking=normalizeCooking(p.cooking);
  const metro=normalizeMetro(p.metro);
  const tutorial=normalizeTutorial(p.tutorial);
  const dailyPractice=normalizeDailyPractice(p.dailyPractice);
  if (!s || typeof s.pinyin!=='boolean'||typeof s.english!=='boolean') throw Error('Invalid settings');
  if(s.musicVolume===undefined)s.musicVolume=0.5;  // saves written before music existed
  if(s.sensitivity===undefined)s.sensitivity=0.12; // ...and before the mouse could be tuned
  if(!Number.isFinite(s.sensitivity)||s.sensitivity<0.02||s.sensitivity>0.5) throw Error('Invalid sensitivity');
  for(const key of ['dialogueVolume','ambientVolume','musicVolume']) if(!Number.isFinite(s[key])||s[key]<0||s[key]>1) throw Error('Invalid volume');
  return {version:1,...(dailyPractice?{dailyPractice}:{}),...(cooking?{cooking}:{}),...(metro?{metro}:{}),...(tutorial?{tutorial}:{}),wallet:p.wallet,inventory:p.inventory,equipped:{...p.equipped},claims:p.claims,words:p.words,completed:p.completed,phrases:p.phrases,discovered:p.discovered,read:p.read,clock:p.clock,dayIndex:p.dayIndex,vendors:p.vendors,saved:normaliseBank(p.saved),...(p.stats?{stats:p.stats}:{}),...(p.debt?{debt:p.debt}:{}),...(p.daily?{daily:p.daily}:{}),...(p.savings?{savings:p.savings}:{}),...(p.permitPlans?.length?{permitPlans:p.permitPlans}:{}),...(p.builds?{builds:p.builds}:{}),home:p.home.map(r=>({uid:r.uid,item:r.item,kind:r.kind,color:r.color,footprint:[r.footprint[0],r.footprint[1]],x:r.x,z:r.z,rot:r.rot,...(r.slot?{slot:r.slot}:{}),...(r.on?{on:r.on}:{})})),settings:s,playerName:p.playerName};
}
export function loadProfile(storage) {
  try { const raw=storage.getItem(SAVE_KEY);return {profile:raw?decodeProfile(raw):freshProfile(),warning:null}; }
  catch { return {profile:freshProfile(),warning:'存档暂时无法读取。 / Saved progress could not be read. A fresh session is open; the original save is untouched until you make progress.'}; }
}
export function saveProfile(storage,p) { storage.setItem(SAVE_KEY,JSON.stringify(p)); }
