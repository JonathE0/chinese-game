import {normaliseBank} from './bank.js';
import {normalizeCooking} from './cooking.js';
import {normalizeMetro} from './metro.js';
import {normalizeTutorial} from './tutorial.js';
import {normalizeDailyPractice} from './daily-practice.js';
import {normalizeLearning} from './learning.js';
import {sanitiseKeys} from './keys.js';
import {QUALITY} from './quality.js';
import rooms from '../content/rooms.json' with {type:'json'};
export const SAVE_KEY='little-mandarin-town.v1';
/**
 * Format upgrades, in order: UPGRADES[i] turns a version i+1 save into version i+2. The next change
 * to the save format adds one step here; loading runs whatever steps a save still needs, and saving
 * always writes SAVE_VERSION.
 */
const UPGRADES=[upstairs,bedSpot,nightstandSpot,tidySlots,bedToWall];
export const SAVE_VERSION=UPGRADES.length+1;
/** `notes` collects what an upgrade had to tell the player (loadProfile turns it into `notice`). */
export function upgradeSave(p,steps=UPGRADES,notes=[]) {
  while (p.version<=steps.length) p={...steps[p.version-1](p,notes),version:p.version+1};
  return p;
}
/**
 * Version 2: the bedroom became the upper floor of the home. Its furniture moves upstairs (a piece
 * in a slot to the matching `up-` slot, the rest shifted as the room was: its back wall onto the
 * house's back wall, clear of the stairwell). On the ground floor, a piece standing where the
 * staircase now is moves to its slot's new spot, or back into storage. Storage is simply the
 * inventory count, so a record dropped here loses nothing the player owns.
 */
function upstairs(p,notes) {
  if (!Array.isArray(p.home)) return p;
  const home=rooms.home,up=home.upper,[w,d]=home.size,[wx0,wz0,wx1,wz1]=up.well;
  const half=(r,rot=r.rot)=>{const [fw,fd]=Array.isArray(r.footprint)?r.footprint:[0,0];return ((rot??0)/90)%2?[fd/2,fw/2]:[fw/2,fd/2];};
  const inWell=(x,z,[hw,hd])=>x+hw>wx0&&x-hw<wx1&&z+hd>wz0&&z-hd<wz1;
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  // Where a piece standing on its own goes, or null for back into storage.
  const place=r=>{
    if (r.room==='bedroom') {
      const slot=r.slot&&home.slots['up-'+r.slot],size=half(r,slot?slot.rot??0:r.rot);   // turned the way its slot is
      let x=slot?slot.x:clamp(r.x+1,-w/2+size[0]+.3,w/2-size[0]-.3);
      const z=slot?slot.z:clamp(r.z-2,-d/2+size[1]+.3,d/2-size[1]-.5);
      if (inWell(x,z,size)) x=wx1+size[0]+.3;
      if (x+size[0]>w/2) return null;
      const moved={...r,room:'home',x,z,y:up.y,...(slot?{rot:slot.rot??0}:{})};
      delete moved.slot;
      if (slot) moved.slot='up-'+r.slot;
      return moved;
    }
    if ((r.room??'home')!=='home'||r.y||!inWell(r.x,r.z,half(r))) return r;
    const slot=r.slot&&home.slots[r.slot];
    return slot&&!inWell(slot.x,slot.z,half(r,slot.rot))?{...r,x:slot.x,z:slot.z,rot:slot.rot??0}:null;
  };
  // A piece standing on another goes wherever that one went, keeping its spot on it.
  const byUid=new Map(p.home.filter(plain).map(r=>[r.uid,r])),moves=new Map();
  // A piece that moved may not land on one already standing on that floor (the footprint test
  // Town.freeSpot uses; rugs lie under everything): pieces left where they were keep their spot,
  // then pieces moved into slots, then the rest, and a piece with nowhere to stand goes to the bag.
  const standing=[],rank=(r,to)=>to===r?0:to?.slot?1:2;
  const clash=(a,b)=>(a.y??0)===(b.y??0)&&Math.abs(a.x-b.x)<half(a)[0]+half(b)[0]&&Math.abs(a.z-b.z)<half(a)[1]+half(b)[1];
  const top=p.home.filter(r=>plain(r)&&!(r.on&&byUid.has(r.on))).map(r=>({r,to:place(r)}));
  for (const {r,to} of top.sort((a,b)=>rank(a.r,a.to)-rank(b.r,b.to))) {
    const fits=!to||to.kind==='rug'||to===r||!standing.some(other=>clash(other,to));
    moves.set(r.uid,fits?to:null);
    if (fits&&to&&to.kind!=='rug') standing.push(to);
  }
  const resolve=r=>{
    if (moves.has(r.uid)) return moves.get(r.uid);
    moves.set(r.uid,null);   // a loop of pieces on each other resolves to storage
    const base=r.on&&byUid.get(r.on),to=base?resolve(base):undefined;
    moves.set(r.uid,!base?place(r):to&&{...r,x:to.x+(r.x-base.x),z:to.z+(r.z-base.z),...(to.room?{room:to.room}:{}),...(to.y?{y:to.y}:{})});
    return moves.get(r.uid);
  };
  const kept=[];
  for (const r of p.home) {
    if (!plain(r)) { kept.push(r); continue; }   // left for decodeProfile to repair
    const next=resolve(r);
    const note=!next?'returned':r.room==='bedroom'?'moved':null;
    if (next) kept.push(next);
    if (note&&!notes.includes(note)) notes.push(note);
  }
  return {...p,home:kept};
}
/**
 * Slots that moved. A piece still standing exactly in a slot's old spot (`from`: slot id to its old
 * x, z and turn) goes to the slot's new one, unless something else already stands there; whatever
 * stands on it keeps its place on the top, turned with it. One moved by hand stays put.
 */
function slotsMoved(from) {
  return p=>{
    if (!Array.isArray(p.home)) return p;
    const half=r=>{const [fw,fd]=Array.isArray(r.footprint)?r.footprint:[0,0];return ((r.rot??0)/90)%2?[fd/2,fw/2]:[fw/2,fd/2];};
    const moves=new Map();
    for (const [id,old] of Object.entries(from)) {
      const slot=rooms.home.slots[id],floor=r=>plain(r)&&(r.room??'home')==='home'&&(r.y??0)===(slot.y??0);
      for (const r of p.home) {
        if (!floor(r)||r.on||!slot.accepts.includes(r.kind)||r.x!==old.x||r.z!==old.z||(r.rot??0)!==old.rot) continue;
        const to={...r,x:slot.x,z:slot.z,rot:slot.rot??0};
        const clash=other=>other!==r&&other.on!==r.uid&&floor(other)&&other.kind!=='rug'&&!other.on
          &&Math.abs(other.x-to.x)<half(other)[0]+half(to)[0]&&Math.abs(other.z-to.z)<half(other)[1]+half(to)[1];
        if (!p.home.some(clash)) moves.set(r.uid,{from:r,to});
      }
    }
    // A piece on the top turns about its base's middle by as much as the base turned.
    const turn=(dx,dz,deg)=>{const a=deg*Math.PI/180,round=v=>Math.round(v*1000)/1000;return [round(dx*Math.cos(a)+dz*Math.sin(a)),round(dz*Math.cos(a)-dx*Math.sin(a))];};
    return {...p,home:p.home.map(r=>{
      if (moves.has(r.uid)) return moves.get(r.uid).to;
      const base=plain(r)&&r.on&&moves.get(r.on);
      if (!base) return r;
      const deg=base.to.rot-(base.from.rot??0),[dx,dz]=turn(r.x-base.from.x,r.z-base.from.z,deg);
      // It turns with its base too, kept to the turns a save allows (0, 90, 180, 270).
      return {...r,x:base.to.x+dx,z:base.to.z+dz,...(deg%360?{rot:(((r.rot??0)+deg)%360+360)%360}:{})};
    })};
  };
}
/** Version 3: the upstairs bed slot moved from the back wall to the middle of the east wall, facing the landing. */
function bedSpot(p) { return slotsMoved({'up-bed':{x:2.8,z:-3.6,rot:0}})(p); }
/** Version 4: the upstairs nightstand slot moved from the back wall to beside the head of the bed. */
function nightstandSpot(p) { return slotsMoved({'up-nightstand':{x:1.3,z:-4.05,rot:0}})(p); }
/**
 * Version 5: the living room's wardrobe turned round to face the room, the plant moved out of the
 * kitchen doorway, the chair left behind by the old desk went to the low table, and the upstairs
 * wardrobe went back against the west wall.
 */
function tidySlots(p) { return slotsMoved({wardrobe:{x:4.2,z:.9,rot:90},plant:{x:4.1,z:3.1,rot:0},chair:{x:-2.5,z:-1.2,rot:-90},
  'up-wardrobe':{x:-2,z:-2.9,rot:90}})(p); }
/**
 * Version 6: the living-room bed went back against the wall. (The desk lamp's floor spot went at the
 * same time; that needs no step, since decodeProfile keeps a piece whose slot is gone as a loose one.)
 */
function bedToWall(p) { return slotsMoved({bed:{x:2.9,z:-2.6,rot:0}})(p); }
export function freshProfile() {
  return {version:SAVE_VERSION,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:[],phrases:[],saved:[],home:[],discovered:[],read:[],clock:15,dayIndex:0,vendors:{},settings:{pinyin:'known',toneColors:false,english:true,dialogueVolume:0.9,ambientVolume:0.35,musicVolume:0.5,sensitivity:0.12,hud:{quests:true,names:true,controls:'en'}},playerName:'旅人'};
}
/**
 * A claim that can no longer decide a payout. Reviews pay only when the card is due, so the
 * `review:` claim older saves wrote for every paid answer is spent. Interest, shop takings and the
 * word games are only ever claimed for today, and the day never goes back.
 */
const DAILY_CLAIM=/^(?:interest|income:.+|game:.+|order-bonus:.+):(\d+)$/;
function spentClaim(key,day) {
  if (key.startsWith('review:')) return true;
  const daily=DAILY_CLAIM.exec(key);
  return !!daily && Number(daily[1])<day;
}
const safeKey=k=>typeof k==='string'&&/^[a-zA-Z0-9:_-]{1,120}$/.test(k)&&!['__proto__','constructor','prototype'].includes(k);
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const number=(v,lo,hi)=>Number.isFinite(v)&&v>=lo&&v<=hi;
const whole=(v,lo,hi)=>Number.isSafeInteger(v)&&v>=lo&&v<=hi;
const finite=(v,limit)=>Number.isFinite(v)&&Math.abs(v)<=limit;
const validReview=(skill,r)=>['recognition','production','listening'].includes(skill)&&plain(r)&&whole(r.stage,0,6)&&number(r.due,0,Infinity)&&number(r.last,0,Infinity)&&whole(r.reviews,0,Number.MAX_SAFE_INTEGER)&&(r.learned===undefined||r.learned===true);
const validSaved=w=>plain(w)&&typeof w.zh==='string'&&w.zh.length>0&&w.zh.length<=8&&typeof w.pinyin==='string'&&w.pinyin.length<=80&&typeof w.en==='string'&&w.en.length<=6000
  &&(w.definitionZh===undefined||(typeof w.definitionZh==='string'&&w.definitionZh.length<=20000))
  &&(w.definitionSource===undefined||['moe','xinhua','authored'].includes(w.definitionSource))
  &&(w.definitionTitle===undefined||(typeof w.definitionTitle==='string'&&w.definitionTitle.length<=100))
  &&(w.readings===undefined||(Array.isArray(w.readings)&&w.readings.length<=100&&w.readings.every(r=>r&&typeof r.pinyin==='string'&&r.pinyin.length<=80&&typeof r.en==='string'&&r.en.length<=6000)))
  &&(w.id===undefined||safeKey(w.id))&&(w.audio===undefined||safeKey(w.audio));
const validFurnishing=r=>plain(r)&&safeKey(r.uid)&&safeKey(r.item)&&safeKey(r.kind)&&typeof r.color==='string'&&/^#[0-9a-fA-F]{3,8}$/.test(r.color)
  &&Array.isArray(r.footprint)&&r.footprint.length===2&&r.footprint.every(v=>finite(v,12)&&v>0)&&finite(r.x,60)&&finite(r.z,60)
  &&[0,90,180,270,-90].includes(r.rot)&&(r.slot===undefined||safeKey(r.slot))&&(r.on===undefined||safeKey(r.on))
  &&(r.y===undefined||number(r.y,0,20))   // the floor it stands on: none is the ground floor
  // No room means the living room, as every save before the study and bedroom were real rooms.
  &&(r.room===undefined||(Object.hasOwn(rooms,r.room)&&rooms[r.room].decoratable===true));
/**
 * Reads a save, repairing rather than refusing it: a bad field or entry is normalised or dropped
 * on its own and the rest kept, and what was repaired is pushed onto `repairs`. Throws only for
 * text that is not a save at all (unparseable, or without a known version).
 */
export function decodeProfile(raw,repairs=[],notes=[]) {
  let p=JSON.parse(raw);
  if (!plain(p)||!whole(p.version,1,SAVE_VERSION)) throw Error('Invalid profile');
  p=upgradeSave(p,UPGRADES,notes);
  const fix=what=>{if(!repairs.includes(what))repairs.push(what);};
  // An object map keyed by safe ids: entries failing `ok` are dropped, and at most `limit` kept.
  const map=(key,ok,limit)=>{
    const v=p[key];
    if (!plain(v)) { if (v!==undefined) fix(key); return {}; }
    const all=Object.entries(v),good=all.filter(([id,x])=>safeKey(id)&&ok(x,id));
    if (good.length<all.length) fix(key);
    if (good.length>limit) { fix(key); good.length=limit; }
    return Object.fromEntries(good);
  };
  const list=(key,ok,limit)=>{
    const v=p[key];
    if (!Array.isArray(v)) { if (v!==undefined) fix(key); return []; }
    const good=v.filter(ok);
    if (good.length<v.length) fix(key);
    if (good.length>limit) { fix(key); good.length=limit; }
    return good;
  };
  // A whole optional record: kept if valid, dropped (and noted) if not.
  const optional=(key,ok,shape)=>{
    const v=p[key];
    if (v===undefined||v===null) return undefined;
    if (ok(v)) return shape(v);
    fix(key); return undefined;
  };
  const normal=(key,fn)=>{try{return fn(p[key]);}catch{fix(key);return undefined;}};

  if (!whole(p.wallet,0,1000000)) { fix('wallet'); p.wallet=Number.isFinite(p.wallet)?Math.min(1000000,Math.max(0,Math.floor(p.wallet))):0; }
  if (!whole(p.dayIndex,0,100000)) p.dayIndex=0;
  // Spent claims go before the size limit, or a save that has simply been played long enough loses real ones.
  if (plain(p.claims)) p.claims=Object.fromEntries(Object.entries(p.claims).filter(([key])=>!spentClaim(key,p.dayIndex)));
  const inventory=map('inventory',count=>whole(count,0,999),10000);
  const claims=map('claims',claim=>claim===true,10000);
  // Room for every HSK word plus a full word bank, so no real learning record is ever cut.
  const words=map('words',skills=>plain(skills)&&Object.keys(skills).length>0,20000);
  for (const [id,skills] of Object.entries(words)) {
    const good=Object.entries(skills).filter(([skill,r])=>validReview(skill,r));
    if (good.length<Object.keys(skills).length) fix('words');
    if (good.length) words[id]=Object.fromEntries(good); else delete words[id];
  }
  const [completed,phrases,discovered,read]=['completed','phrases','discovered','read'].map(key=>list(key,safeKey,10000));
  const saved=list('saved',validSaved,2000);
  const home=list('home',validFurnishing,200);
  const vendors=map('vendors',record=>plain(record)&&number(record.rapport,0,1000),10000);
  // An open bill at the hotpot terrace (src/core/hotpot.js): item id → count, a few dozen lines at most.
  const hotpot=map('hotpot',count=>whole(count,1,999),64);
  if (!Number.isFinite(p.clock)||p.clock<0||p.clock>=24) p.clock=15;   // saves from before the day/night cycle
  if (typeof p.playerName!=='string'||p.playerName.length>32) { fix('playerName'); p.playerName=freshProfile().playerName; }
  // Saves before clothing had slots stored a single item id, or null.
  if (p.equipped===null) p.equipped={};
  else if (typeof p.equipped==='string') p.equipped=safeKey(p.equipped)?{hat:p.equipped}:{};
  const equipped=map('equipped',(id,slot)=>['hat','shirt','trousers','shoes'].includes(slot)&&safeKey(id),4);
  // Saves written before hunger, the bank and daily errands existed simply have none of these.
  const stats=optional('stats',s=>plain(s)&&number(s.hunger,0,100)&&number(s.energy,0,100)&&number(s.hour,0,24),s=>({hunger:s.hunger,energy:s.energy,hour:s.hour}));
  const debt=optional('debt',d=>plain(d)&&safeKey(d.loan)&&number(d.owed,0,1000000)&&number(d.perDay,0,1000000)&&whole(d.nextDay,0,Number.MAX_SAFE_INTEGER)&&whole(d.missed,0,9999),
    d=>({loan:d.loan,owed:d.owed,perDay:d.perDay,nextDay:d.nextDay,missed:d.missed}));
  const savings=optional('savings',s=>plain(s)&&number(s.balance,0,10000000),s=>({balance:s.balance}));
  const builds=p.builds===undefined?undefined:map('builds',r=>plain(r)&&typeof r.done==='boolean'&&plain(r.given),32);
  // A bad count drops only itself: the site stays built (and keeps paying).
  for (const record of Object.values(builds??{})) {
    const all=Object.entries(record.given),good=all.filter(([id,n])=>safeKey(id)&&whole(n,0,9999));
    if (good.length<all.length) { fix('builds'); record.given=Object.fromEntries(good); }
  }
  const permitPlans=list('permitPlans',plan=>plain(plan)&&safeKey(plan.id)&&number(plan.owed,0,1000000)&&number(plan.perWeek,0,1000000)&&whole(plan.nextWeek,0,Number.MAX_SAFE_INTEGER),16)
    .map(plan=>({id:plan.id,owed:plan.owed,perWeek:plan.perWeek,nextWeek:plan.nextWeek}));
  const daily=optional('daily',d=>plain(d)&&whole(d.day,0,Number.MAX_SAFE_INTEGER)&&plain(d.counts)&&Object.keys(d.counts).length<=64
      &&Object.entries(d.counts).every(([key,value])=>safeKey(key)&&whole(value,0,99999))&&Array.isArray(d.claimed)&&d.claimed.length<=64&&d.claimed.every(safeKey),
    d=>({day:d.day,counts:d.counts,claimed:d.claimed}));
  const cooking=normal('cooking',normalizeCooking);
  const metro=normal('metro',normalizeMetro);
  const tutorial=normal('tutorial',normalizeTutorial);
  const dailyPractice=normal('dailyPractice',normalizeDailyPractice);
  const learning=normal('learning',normalizeLearning);
  const defaults=freshProfile().settings;
  let s=p.settings;
  if (!plain(s)) { fix('settings'); s={...defaults}; }
  const unit=v=>number(v,0,1),bool=v=>typeof v==='boolean';
  const mode=v=>bool(v)||['always','known','never'].includes(v);  // true/false are the pre-mode always/never
  for (const [key,ok] of [['pinyin',mode],['toneColors',bool],['english',bool],['dialogueVolume',unit],['ambientVolume',unit],['musicVolume',unit],['sensitivity',v=>number(v,0.02,0.5)]]) {
    if (ok(s[key])) continue;
    // Music, mouse sensitivity and tone colours arrived after the first saves; their absence is not damage.
    if (s[key]!==undefined||!['musicVolume','sensitivity','toneColors'].includes(key)) fix('settings');
    s[key]=defaults[key];
  }
  // Key bindings came later still: absent is fine, and only sound changes from the default are kept.
  if (s.keys!==undefined) { const keys=sanitiseKeys(s.keys); if (!plain(s.keys)||Object.keys(s.keys).length!==Object.keys(keys).length||Object.entries(keys).some(([action,code])=>s.keys[action]!==code)) fix('settings'); if (Object.keys(keys).length) s.keys=keys; else delete s.keys; }
  // 画质 (src/core/quality.js) too: absent is 自动, and anything unknown goes back to it.
  if (s.quality!==undefined&&!QUALITY.includes(s.quality)) { fix('settings'); delete s.quality; }
  return {version:SAVE_VERSION,...(dailyPractice?{dailyPractice}:{}),...(cooking?{cooking}:{}),...(metro?{metro}:{}),...(tutorial?{tutorial}:{}),...(learning?{learning}:{}),wallet:p.wallet,inventory,equipped,claims,words,completed,phrases,discovered,read,clock:p.clock,dayIndex:p.dayIndex,vendors,saved:normaliseBank(saved),...(stats?{stats}:{}),...(debt?{debt}:{}),...(daily?{daily}:{}),...(savings?{savings}:{}),...(permitPlans.length?{permitPlans}:{}),...(Object.keys(hotpot).length?{hotpot}:{}),...(builds?{builds:Object.fromEntries(Object.entries(builds).map(([id,record])=>[id,{given:record.given,done:record.done}]))}:{}),home:home.map(r=>({uid:r.uid,item:r.item,kind:r.kind,color:r.color,footprint:[r.footprint[0],r.footprint[1]],x:r.x,z:r.z,rot:r.rot,...(r.room?{room:r.room}:{}),...(r.y?{y:r.y}:{}),...(r.slot&&Object.hasOwn(rooms[r.room??'home']?.slots??{},r.slot)?{slot:r.slot}:{}),...(r.on?{on:r.on}:{})})),settings:s,playerName:p.playerName};
}
const REPAIRED="存档有一部分读不了，已经修好了，原来的存档另存了一份。 / Part of your save couldn't be read. It has been repaired, and a copy of the original was kept.";
const UNREADABLE='存档暂时无法读取。 / Saved progress could not be read. A fresh session is open, and a copy of the original was kept.';
const NO_COPY='存档有一部分或者全部读不了，而且没有空间另存一份原来的存档。 / Part or all of your saved progress could not be read, and there was no room to keep a copy of the original.';
// What the two-storey upgrade tells the player (notices only, no voice clips).
const HOME_NOTES={
  moved:'卧室的家具搬到二楼了。 / Your bedroom furniture has moved upstairs.',
  returned:"有的家具放不下，放回背包里了。 / Some furniture didn't fit and went back into your bag.",
};
export const NEWER='你的存档来自更新的游戏版本。这个页面不会保存任何进度，请刷新页面来更新。 / Your save comes from a newer version of the game. Nothing will be saved in this tab: reload the page to get the update.';
/** True for a save written by a newer build than this one, which must never be written over. */
export function isNewerSave(raw) {
  try { const p=JSON.parse(raw); return plain(p)&&Number.isSafeInteger(p.version)&&p.version>SAVE_VERSION; } catch { return false; }
}
const COPY_PREFIX=SAVE_KEY+'.unreadable-';
/** Keeps the original text beside the save, pruning older copies to one so they cannot eat the save's quota. */
function keepCopy(storage,raw,now) {
  try {
    const copies=[];
    for (let i=0;i<storage.length;i++) { const key=storage.key(i); if (key?.startsWith(COPY_PREFIX)) copies.push(key); }
    copies.sort((x,y)=>Number(x.slice(COPY_PREFIX.length))-Number(y.slice(COPY_PREFIX.length)));
    for (const key of copies.slice(0,-1)) storage.removeItem(key);
    storage.setItem(COPY_PREFIX+now,raw);
    return true;
  } catch { return false; }
}
/**
 * Never discards a save: a damaged one is repaired, and whenever anything had to change the
 * original text is kept first (`unreadable-<timestamp>`, newest two). If there is no room for
 * that copy, `unkept` carries the text so the caller can keep it elsewhere before saving, and
 * `keptWarning` is the message to show once it has. A save from a newer build opens read-only.
 */
export function loadProfile(storage,now=Date.now()) {
  let raw=null;
  try { raw=storage.getItem(SAVE_KEY); } catch {}
  if (!raw) return {profile:freshProfile(),repairs:[],warning:null};
  if (isNewerSave(raw)) return {profile:freshProfile(),repairs:[],warning:NEWER,readOnly:true};
  const repairs=[],notes=[];
  let profile,warning;
  try { profile=decodeProfile(raw,repairs,notes); warning=repairs.length?REPAIRED:null; }
  catch { profile=freshProfile(); repairs.push('unreadable'); warning=UNREADABLE; }
  const notice=notes.length?notes.map(note=>HOME_NOTES[note]).join(' '):null;
  if (!warning||keepCopy(storage,raw,now)) return {profile,repairs,warning,notice};
  return {profile,repairs,warning:NO_COPY,unkept:raw,keptWarning:warning,notice};
}
export function saveProfile(storage,p) { storage.setItem(SAVE_KEY,JSON.stringify(p)); }
