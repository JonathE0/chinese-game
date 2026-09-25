import './style.css';
import {Town} from './world/town.js';
import {Shell,pinyinText,pinyinWith} from './ui/shell.js';
import {VoicePlayer} from './services/audio.js';
import {Ambience} from './services/music.js';
import {Dictionary} from './services/dictionary.js';
import {installLookup} from './ui/lookup.js';
import {SpeechInput} from './services/speech.js';
import {loadProfile,saveProfile} from './core/profile.js';
import {escapeHtml as esc} from './core/language.js';
import {outfit} from './core/inventory.js';
import {clockText} from './world/daylight.js';
import {collectLook,knowsLook} from './core/bank.js';
import {noteSource} from './core/learning.js';
import {openBank as openWordBank} from './ui/bank.js';
import {openMenu} from './ui/menu.js';
import {openDialogue,showLine} from './ui/dialogue.js';
import {openPractice} from './ui/practice.js';
import {openShop} from './ui/shop.js';
import {openJournal,openInventory,openSettings,openAmbient,offerFolderRestore,cloudSoon,cloudSync,mountArrivalCloud} from './ui/panels.js';
import {cloudConfigured} from './services/cloud.js';
import {syncSave,keepUnreadable} from './services/filesync.js';
import {openHsk} from './ui/hsk.js';
import {openDecorate,installPlacement,applyStarterHome} from './ui/decorate.js';
import ambient from './content/ambient.json' with {type:'json'};
import objectNames from './content/objects.json' with {type:'json'};
import rooms from './content/rooms.json' with {type:'json'};
import npcs from './content/npcs.json' with {type:'json'};
import {loadWords} from './services/hsk-data.js';
import {districtStates,gateMessage} from './core/progress.js';
import {openStatus} from './ui/status.js';
import {openBank,openResale} from './ui/money.js';
import {openGuide} from './ui/guide.js';
import {openSleep,openClosed} from './ui/rest.js';
import {openLibrary} from './ui/library.js';
import {openKitchen} from './ui/kitchen.js';
import {openMetro,rideHome} from './ui/metro.js';
import {openCityTalk} from './ui/citytalk.js';
import {openTaxi} from './ui/taxi.js';
import {openNoodles} from './ui/noodles.js';
import {CITY,CITY_OFFSET} from './world/city.js';
import {arrivedAtTower,arrivalStep} from './core/city.js';
import {tickCooking,recipeById} from './core/cooking.js';
import {openSite} from './ui/build.js';
import {builtSites,collectIncome} from './core/construction.js';
import {tickStats,speedFactor} from './core/stats.js';
import {settleDays,debtOf,savingsOf,interestOn,INTEREST_HOUR,settleWeeks} from './core/finance.js';
import {calendarOf,claimPeriod} from './core/calendar.js';
import {syncDay,bump} from './core/daily.js';
import {inAnyHunt} from './core/collection.js';
import {isTyping,shortcutAllowed} from './core/input.js';
import {shouldAutoStart} from './core/tutorial.js';
import {Tutorial} from './ui/tutorial.js';
import {installTouch} from './ui/touch.js';
import {AmbientConversations} from './core/social.js';
import {openNpcGreeting} from './ui/social.js';
import {festivalFrame} from './world/festivals.js';
import {openFestival} from './ui/festivals.js';
import {openPostcard} from './ui/postcard.js';
import {friends,pinned,noteVisit} from './core/friends.js';

const loaded=loadProfile(localStorage);
// holdSync keeps the folder copy untouched until the start-up check below has compared it.
// readOnly: the save comes from a newer build, so nothing may be written over it this session.
// holdSave: a damaged save's original did not fit beside it, so it goes to IndexedDB before any save.
const ctx={profile:loaded.profile,hinted:false,town:null,holdSync:true,readOnly:!!loaded.readOnly,holdSave:!!loaded.unkept};
// Admin mode, for play-testing (`?admin`, and only on the Vite dev server): every district gate stands open
// and the wallet is topped up to 1000. The save folder is never read or written in this mode, so none
// of it can leak into a real save.
const ADMIN=import.meta.env.DEV&&new URLSearchParams(location.search).has('admin');
// The cloud save exists only when configured, and never in dev mode (like the folder).
if(cloudConfigured&&!ADMIN)ctx.cloud={};
if(ADMIN){ctx.profile.wallet=Math.max(ctx.profile.wallet??0,1000);document.body.classList.add('admin');}
if(loaded.unkept)keepUnreadable(loaded.unkept).then(()=>{loaded.warning=loaded.keptWarning;},()=>{}).finally(()=>{ctx.holdSave=false;});
ctx.voice=new VoicePlayer(ctx.profile.settings,t=>ctx.ui.notice(t));ctx.music=new Ambience(ctx.profile.settings);ctx.speech=new SpeechInput();ctx.dictionary=new Dictionary();ctx.ui=new Shell(ctx);ctx.lookup=installLookup(ctx);ctx.tutorial=new Tutorial(ctx);
// Backups, the progress log and the folder copy follow a save within 5 s, at most one write per 5 s
// (a timer that keeps being reset could starve under steady saving). Also runs when the browser
// save itself fails, since the folder copy then matters most.
let syncTimer=null;
const syncSoon=()=>{cloudSoon(ctx);syncTimer??=setTimeout(()=>{syncTimer=null;if(!ctx.holdSync&&!ctx.readOnly)syncSave(ctx.profile,ctx.hskWords);},5000);};
// Where each word was first met: any word that joined the bank since this profile was loaded
// (F on an object or sign, saving from dialogue or a lookup) is pinned to where the player stands.
// Words already in a loaded or imported save have no known spot, so they stay without one.
let metBaseline={of:null,zh:null};
function noteNewSources(){
 const p=ctx.profile;
 if(metBaseline.of!==p){metBaseline={of:p,zh:new Set((p.saved??[]).map(w=>w.zh))};return;}
 const pos=ctx.town?.player?.entity?.getPosition?.();
 if(!pos)return;
 const spot={place:ctx.town.place??'town',x:Math.round(pos.x*10)/10,z:Math.round(pos.z*10)/10};
 for(const w of p.saved??[])if(!metBaseline.zh.has(w.zh)){metBaseline.zh.add(w.zh);noteSource(p,w.zh,spot);}
}
noteNewSources();
ctx.save=()=>{noteNewSources();if(!ctx.readOnly&&!ctx.holdSave)try{saveProfile(localStorage,ctx.profile);}catch{ctx.ui.notice('无法保存到浏览器。请在设置中导出存档。 / Could not save; export a backup in Settings.');}syncSoon();ctx.ui.update();};
// Ask the browser once (Firefox prompts every time) not to clear this site's storage under pressure.
try{if(!localStorage.getItem('little-mandarin-town.persist-asked')&&navigator.storage?.persist){localStorage.setItem('little-mandarin-town.persist-asked','1');navigator.storage.persist().catch(()=>{});}}catch{}
let started=false,ambientShownUntil=0,ambientSpot=0;
// One conversation per chat spot in world.json, made when the loop first reaches it.
const ambientConversations=ctx.ambientConversations=[];
function interact(id){
 if(!started||ctx.ui.panelId||!id)return;
 // Sitting and standing happen in the world, not in a panel.
 if(id.startsWith('take:')){
  const body=ctx.town.takeFrom(Number(id.slice(5)));
  if(body){ctx.music?.cue('place');ctx.ui.notice('拿起来了。点击扔出去，G 放下。 / Picked it up — click to throw, G to put it down.');}
  return;
 }
 if(id==='grab')return void ctx.town.grabLoose();
 if(id.startsWith('sit:')){
  if(ctx.town.sit(Number(id.slice(4)))){bump(ctx.profile,'sits');ctx.save();ctx.ui.notice('坐下了。按 空格 站起来。 / Seated — press Space to stand.');}
  return;
 }
 if(id==='stand')return void ctx.town.stand();
 // Led here — to a stall keeper or the metro stair? Then you have arrived.
 if(ctx.ui.route?.key===id)ctx.ui.clearRoute();
 // Saying hello to someone is a tutorial step; the id is who, without any city:/staff: prefix.
 const person=['lin','mei','chen','friend-a','friend-b'].includes(id)?id:/^(city|staff):/.test(id)?id.replace(/^(city|staff):/,''):null;
 if(person)ctx.tutorial.event('talk',{id:person});
 if(id==='lin'){bump(ctx.profile,'talks');return openNpcGreeting(ctx,'lin',()=>openDialogue(ctx,npcs.find(n=>n.id==='lin').lesson));}
 if(id==='mei'){bump(ctx.profile,'talks');return openNpcGreeting(ctx,ctx.profile.completed.includes('practice:first')?'mei':'mei-first',()=>openPractice(ctx));}
 if(id==='chen'){bump(ctx.profile,'talks');return openNpcGreeting(ctx,'chen',()=>openShop(ctx,'chen'));}
 if(id==='friend-a'||id==='friend-b'){bump(ctx.profile,'talks');return openNpcGreeting(ctx,id);}
 if(id.startsWith('gate:'))return showGate(id.slice(5));
 if(id.startsWith('closed:'))return openClosed(ctx,id.slice(7));
 if(id.startsWith('door:'))return enterPlace(id.slice(5));
 if(id==='leave')return enterPlace('town');
 if(id==='lectern')return openHsk(ctx);
 if(id==='listen')return openHsk(ctx,{mode:'listening'});
 if(id.startsWith('shop:'))return openShop(ctx,id.slice(5));
 if(id.startsWith('fest:'))return openFestival(ctx,id.slice(5));
 if(id==='panel:bank')return openBank(ctx);
 if(id==='panel:resale')return openResale(ctx);
 if(id==='panel:library')return openLibrary(ctx);
 if(id.startsWith('shelf:'))return openLibrary(ctx,id.slice(6));
 if(id.startsWith('site:'))return openSite(ctx,id.slice(5));
 if(id==='guide')return openGuide(ctx);
 if(id==='postbox')return openPostcard(ctx);
 if(id==='sleep')return openSleep(ctx);
 if(id==='cook')return openKitchen(ctx);
 if(id==='metro')return openMetro(ctx);
 if(id==='metro:home')return rideHome(ctx);
 if(id.startsWith('city:')){const who=id.slice(5);bump(ctx.profile,'talks');return openNpcGreeting(ctx,who,()=>openCityTalk(ctx,who));}
 if(id.startsWith('taxi:'))return openTaxi(ctx);
 if(id==='noodles')return openNoodles(ctx);
 if(id==='decorate')return openDecorate(ctx);
 if(id==='studydesk')return openWordBank(ctx,{venue:'desk'});
 if(id==='menu')return openMenu(ctx,'tablet');
 if(id.startsWith('staff:')){bump(ctx.profile,'talks');return openNpcGreeting(ctx,'staff',()=>openMenu(ctx,'waiter'));}
}
// Looking at something and pressing F is the main way to pick up everyday words.
function collect(name){
 if(!name)return;
 const {clip,isNew}=collectLook(ctx.profile,name);
 if(ctx.voice.available(clip))ctx.voice.play(clip);
 if(isNew){
  ctx.music.cue('collect');
  ctx.save();
  // A sign's phrase goes to 生词本 only: it is not one more named object.
  if(name.sign)ctx.ui.notice(`记住了 ${name.zh} ${[pinyinText(name.pinyin,name.zh),name.en].filter(Boolean).join(' · ')}`);
  else{
   bump(ctx.profile,'discovered');
   if(inAnyHunt(name))bump(ctx.profile,'hunt-found');
   ctx.ui.notice(`记住了 ${name.zh} ${[pinyinText(name.pinyin,name.zh),name.en].filter(Boolean).join(' · ')}　（第 ${ctx.profile.discovered.length} 个）`);
   ctx.tutorial.event('collect',{id:name.id});
  }
 }
 ctx.ui.nameplate(name,{known:true,reveal:true});
}
// Districts open on evidence of learning, so the gate has to say exactly what is still missing.
let hskWords=null;
function refreshGates(){
 if(!ctx.town?.gates)return;
 const states=districtStates(ctx.profile,ctx.town.data.districts,hskWords).map(s=>ADMIN?{...s,unlocked:true}:s);
 ctx.gateStates=states;
 for(const state of states)ctx.town.setUnlocked(state.id,state.unlocked);
}
function refreshShops(){
 if(!ctx.town)return;
 for(const [id,room] of Object.entries(rooms)){
  if(!room.opens)continue;
  const flag=room.opens.flag;
  ctx.town.setRoomOpen(id,!flag||ctx.profile.completed.includes(flag));
 }
}
function showGate(id){
 const state=ctx.gateStates?.find(s=>s.id===id);
 if(!state)return ctx.ui.notice('正在载入词表… / Still loading the word list.');
 const d=state.district;
 const body=ctx.ui.open('gate',d.zh,'区域告示 · DISTRICT NOTICE');
 const percent=Math.min(100,Math.round(state.have/state.need*100));
 body.innerHTML=`<p class="panel-intro">${pinyinWith(d.pinyin,d.zh,d.en)}</p>
  <div class="gate-note"><b>${esc(gateMessage(state))}</b>
  <div class="gate-bar"><i style="width:${percent}%"></i></div>
  <p class="microcopy">在词语馆复习 HSK ${state.level} 的词，或在城里用 <kbd>F</kbd> 记住看到的东西。两种都算。<br>
  Review HSK ${state.level} words in the word hall, or look at things around town and press F. Both count.</p></div>`;
 ctx.ui.update();
}
function enterPlace(id){
 if(id==='town')ctx.town.leaveRoom();
 else{
  if(!ctx.town.enterRoom(id))return;
  // The word hall is one of the places a postcard can say you went to.
  if(noteVisit(ctx.profile,id))ctx.save();
  // Being led to this door? Then you have arrived.
  if(ctx.ui.route?.key===id)ctx.ui.clearRoute();
  // One count per shop per day, so walking in and out is not a way to farm the errand.
  const daily=syncDay(ctx.profile,ctx.profile.dayIndex??0);
  if(!daily.counts['seen-'+id]){daily.counts['seen-'+id]=1;bump(ctx.profile,'visits');ctx.save();}
 }
 syncPlace();
 if(id!=='town')ctx.tutorial.event('enter',{id});
}
/** Whatever just moved us, say where we are now. */
function syncPlace(){
 const place=ctx.town.place;
 // Coming back into the open has to re-announce the district, which is otherwise only redrawn
 // when you walk across a boundary.
 if(place==='town')ctx.district=null;
 ctx.ui.setPlace(place,place==='town'?null:(rooms[place]??ctx.town.rooms.get(place)?.data));
}
ctx.syncPlace=syncPlace;
/** Once 问路 has been answered, walking up to 一号书店's door finds it — once. Only walking in
 *  counts: a taxi (or any other warp) that sets you down there does not. */
let bookstoreStep=null;
function checkCityArrival(pos){
 if(!started||ctx.town.place!=='city'){bookstoreStep=null;return;}
 if(ctx.ui.panelId)return;
 const tower=CITY.towers.find(t=>t.sign==='一号书店');
 if(!tower)return;
 bookstoreStep=arrivalStep(bookstoreStep,arrivedAtTower(pos.x-CITY_OFFSET,pos.z,tower),ctx.town.warps);
 if(!bookstoreStep.arrived)return;
 if(!ctx.profile.completed.includes('city-directions')||ctx.profile.completed.includes('city:found-bookstore'))return;
 ctx.profile.completed.push('city:found-bookstore');
 ctx.save();
 showLine(ctx,'city-directions','found');
}
/**
 * The bank's morning round: interest on what is saved, then any building instalment that has
 * fallen due this week. Both go through claimPeriod, so a long session or a reload cannot pay
 * either of them twice.
 */
function bankMorning(hour){
 const {day,week}=calendarOf(ctx.profile);
 if(hour>=INTEREST_HOUR){
  const paid=interestOn(savingsOf(ctx.profile));
  if(paid>0&&claimPeriod(ctx.profile,'interest',day)){
   ctx.profile.wallet+=paid;
   ctx.ui.notice(`存款利息 +${paid} 学习币。 / The bank paid ${paid} in interest.`);
  }
 }
 const takings=collectIncome(ctx.profile,day);
 if(takings)ctx.ui.notice(`店里的营业收入 +${takings} 学习币。 / Your shop took ${takings} overnight.`);
 for(const event of settleWeeks(ctx.profile,week)){
  if(event.missed)ctx.ui.notice('这周的执照分期没能扣款。 / This week\u2019s permit instalment could not be taken.');
  else if(event.owed<=0)ctx.ui.notice('执照分期付清了。 / That permit is paid off.');
  else ctx.ui.notice(`执照分期扣了 ${event.paid} 学习币。 / A permit instalment of ${event.paid} was taken.`);
 }
}
/** What the bank quietly did overnight, said out loud. */
function reportSettlement(events){
 const missed=events.filter(e=>e.missed),paid=events.filter(e=>e.paid);
 if(events.some(e=>e.cleared))ctx.ui.notice('贷款还清了。 / Your loan is paid off.');
 else if(missed.length)ctx.ui.notice(`没能按时还款，欠款加了罚金。现在还欠 ${debtOf(ctx.profile)?.owed??0}。 / Missed a repayment; a late fee was added.`);
 else if(paid.length)ctx.ui.notice(`银行扣了 ${paid.reduce((sum,e)=>sum+e.paid,0)} 学习币的还款。 / The bank took today's repayment.`);
}
try{
 ctx.town=new Town(document.querySelector('#world'),{onInteract:interact,onNear:target=>ctx.ui.nearby(target),
  onLook:name=>ctx.ui.nameplate(name,{known:!!name&&knowsLook(ctx.profile,name)}),
  onCollect:name=>collect(name),onFrame:town=>{
  const pos=town.player.entity.getPosition(),outside=town.place==='town';
  ctx.music.setPlace(town.place);
  const dot=document.querySelector('#map-player');
  dot.dataset.y=pos.y.toFixed(3);   // height is read indoors too: up the stairs at home
  if(outside){
   dot.setAttribute('cx',pos.x);dot.setAttribute('cy',pos.z);
   document.querySelector('#map-facing').setAttribute('transform',`translate(${pos.x} ${pos.z}) rotate(${-town.yaw})`);
  }
  // A first-person camera can have people behind it, where worldToScreen would mirror the label onto the screen.
  for(const [id,a]of town.actors){
   const p=a.entity.getPosition(),s=town.screen(p.x,2.5,p.z);const label=document.querySelector('#label-'+id);
   const onScreen=outside&&s.z>0&&s.x>-160&&s.x<innerWidth+160&&s.y>-80&&s.y<innerHeight+80;
   label.hidden=!onScreen;
   if(onScreen)label.style.transform=`translate(${s.x}px,${s.y}px) translate(-50%,-100%)`;
   label.classList.toggle('near',town.nearest?.id===id);
  }
  if(outside){
   const district=town.districtAt(pos.x,pos.z);
   if(district.id!==ctx.district){ctx.district=district.id;ctx.ui.setPlace('town',district);ctx.ui.drawMap(town.data,district);if(noteVisit(ctx.profile,district.id))ctx.save();}
   ctx.ui.drawRoute(town.data,district,pos);
  }
  checkCityArrival(pos);
  document.querySelector('#seated').hidden=!town.seated;
  const carrying=document.querySelector('#carrying'),held=town.toys.held;
  carrying.hidden=!held;
  if(held)carrying.querySelector('b').textContent=held.name?(objectNames.objects[held.name]?.zh??'东西'):'东西';
  // Only the chat spot nearest the player can talk; the others keep their own silence.
  const spots=town.data.ambient,away=([x,z])=>Math.hypot(pos.x-x,pos.z-z);
  const spot=spots.reduce((best,xz,i)=>away(xz)<away(spots[best])?i:best,0);
  if(spot!==ambientSpot){ambientSpot=spot;ambientShownUntil=0;}
  const bubble=document.querySelector('#ambient-bubble'),[ax,az]=spots[spot];const s=town.screen(ax,2.5,az),now=performance.now()/1000;
  const eligible=started&&outside&&!ctx.ui.panelId&&Math.hypot(pos.x-ax,pos.z-az)<13&&s.z>0&&s.x>-120&&s.x<innerWidth+120;
  let ambientLine=null;
  spots.forEach((_,i)=>{const line=(ambientConversations[i]??=new AmbientConversations(ambient)).update(now,eligible&&i===spot);if(i===spot)ambientLine=line;});
  if(ambientLine){bubble.querySelector('span').textContent=ambientLine.zh;ambientShownUntil=now+6;ctx.voice.play(ambientLine.audio,{ambient:true});}
  const visible=eligible&&now<ambientShownUntil;
  bubble.hidden=!visible;
  if(visible){
   // Keep the chatter clear of the mission card: behind it, you could neither read it nor tap it.
   const card=ctx.ui.hudBox();
   const clash=card&&s.x-118<card.right&&s.x+118>card.left&&s.y>card.top-4&&s.y-46<card.bottom;
   bubble.style.left=(clash?Math.min(innerWidth-126,card.right+126):s.x)+'px';bubble.style.top=s.y+'px';}
  const placing=document.querySelector('#placing');
  placing.hidden=!town.ghost;
  if(town.ghost){
   placing.querySelector('b').textContent=town.ghost.item.zh;
   placing.classList.toggle('blocked',!town.ghost.valid);
   placing.querySelector('.placing-state').textContent=town.ghost.valid
    ?(town.ghost.on?'放在上面 · on the surface':'放得下')
    :(town.ghost.problem?town.ghost.problem.zh:'这里放不下，换个位置');
  }
  // The clock ticks in the HUD, and is written back to the save now and then.
  const hour=town.daylight.hour;
  const stamp=clockText(hour);
  if(stamp!==ctx.stamp){ctx.stamp=stamp;ctx.ui.setClock(town.daylight.state,stamp);}
  if(Math.abs(hour-(ctx.profile.clock??15))>.25){
   // Crossing midnight starts a new day, which rerolls every vendor's mood, refreshes the
   // errands, and takes whatever the bank is owed for the day just finished.
   if(hour<(ctx.profile.clock??15)){
    ctx.profile.dayIndex=(ctx.profile.dayIndex??0)+1;
    syncDay(ctx.profile,ctx.profile.dayIndex);
    reportSettlement(settleDays(ctx.profile,ctx.profile.dayIndex));
    ctx.persisted=null;
   }
   bankMorning(hour);
   ctx.profile.clock=hour;
   tickStats(ctx.profile,hour);
   // Hunger and the clock only need writing to storage about once an in-game hour; saving
   // every few seconds would redraw the whole HUD under the player's hands.
   if(Math.abs(hour-(ctx.persisted??-99))>1){ctx.persisted=hour;ctx.save();}
  } else tickStats(ctx.profile,hour);
  if(ctx.profile.cooking){
   const dt=town.clock-(ctx.cookClock??town.clock);
   if(dt>0&&tickCooking(ctx.profile,dt)){
    ctx.music?.cue('reward');ctx.save();
    ctx.ui.notice(`${recipeById(ctx.profile.cooking.recipe).zh}做好了，回厨房盛出来。 / Dinner is ready — dish it up in the kitchen.`);
   }
  }
  ctx.cookClock=town.clock;
  town.speedScale=speedFactor(ctx.profile);
  const crosshair=document.querySelector('#crosshair'),hint=document.querySelector('#look-hint');
  const playing=started&&!ctx.ui.panelId;crosshair.hidden=!playing;hint.hidden=!(playing&&!town.locked()&&matchMedia('(pointer:fine)').matches);
  ctx.tutorial.frame(town,started);
  festivalFrame(ctx,town);
 }});
 ctx.town.equip(outfit(ctx.profile));
 ctx.town.onNotice=message=>ctx.ui.notice(message);
 ctx.town.sensitivity=ctx.profile.settings.sensitivity??0.12;
 // Losing pointer lock without noticing is what makes the view feel stuck; say so plainly.
 ctx.town.onLockChange=locked=>{document.body.classList.toggle('unlocked',!locked);};
 document.body.classList.add('unlocked');
 installTouch(ctx.town);
 installPlacement(ctx);
 ctx.town.daylight.setHour(ctx.profile.clock??15);
 // Place the day stalls at the real saved hour, before the first frame — not the constructor's
 // default 15:00, or a save from the night would open them and walk them straight back out again.
 ctx.town.dayMarket.openInstantly(ctx.town.daylight.hour);
 // Every decoratable room gets its own furniture back; a record with no room is the living room's.
 ctx.profile.home=[...ctx.town.rooms.values()].filter(room=>room.data.decoratable)
  .flatMap(room=>ctx.town.furnish(room.id,ctx.profile.home.filter(record=>(record.room??'home')===room.id)));
 applyStarterHome(ctx);
}catch(error){console.error(error);document.querySelector('#start-button').disabled=true;document.querySelector('.arrival-en').textContent='The 3D scene could not start. Please enable hardware acceleration and use a WebGL2-capable browser.';}
ctx.ui.update();ctx.voice.load();
if(ctx.town)ctx.ui.drawMap(ctx.town.data,ctx.town.data.districts[0]);
loadWords().then(list=>{
 hskWords=list;ctx.hskWords=list;
 const byChinese=new Map(list.map(w=>[w.zh,w]));
 // Refresh old HSK bookmarks while preserving their ids and spaced-review history.
 for(const saved of ctx.profile.saved){
  const w=byChinese.get(saved.zh);if(!w)continue;
  for(const key of ['pinyin','en','definitionZh','definitionSource','definitionTitle','readings']){
   if(w[key]!==undefined)saved[key]=w[key];else delete saved[key];
  }
 }
 refreshGates();
}).catch(()=>ctx.ui.notice('HSK 词表暂时无法载入，区域暂不开放。 / Word list unavailable; districts stay closed.'));
const saveProfileAndGates=ctx.save;ctx.save=()=>{saveProfileAndGates();refreshGates();refreshShops();};
refreshShops();
// Anything already built is standing when the town loads.
if(ctx.town)for(const site of builtSites(ctx.profile))ctx.town.revealSite(site.id);
// A postcard 陈叔叔 has received stays pinned up on his shop.
if(ctx.town)for(const [npc,person] of Object.entries(friends.people))if(person.pin&&pinned(ctx.profile,npc))ctx.town.pinPostcard(person.pin);
document.querySelector('#start-button').onclick=()=>{started=true;document.querySelector('#arrival').hidden=true;document.body.classList.add('playing');ctx.town.setPaused(false);ctx.music.start();if(loaded.warning||loaded.notice)ctx.ui.notice([loaded.warning,loaded.notice].filter(Boolean).join(' '));
 // A brand-new traveller is walked through the basics; a save already mid-way picks up where it was.
 ctx.tutorial.started=true;
 if(shouldAutoStart(ctx.profile))ctx.tutorial.start();else ctx.tutorial.sync();
 // A connected folder with more progress than this browser's save is offered before anything overwrites it.
 // The cloud is checked after that, against whichever save the player kept.
 if(!ADMIN)offerFolderRestore(ctx).then(offered=>{if(!offered){ctx.holdSync=false;cloudSync(ctx);}},()=>{ctx.holdSync=false;cloudSync(ctx);});
};
// With the cloud on, the arrival screen offers signing in or playing as a guest.
if(ctx.cloud&&!ctx.readOnly)mountArrivalCloud(ctx);
document.querySelector('#status-button').onclick=()=>{if(started)openStatus(ctx);};
document.querySelector('#review-button').onclick=()=>{if(started)openWordBank(ctx);};
document.querySelector('#journal-button').onclick=()=>{if(started)openJournal(ctx);};document.querySelector('#inventory-button').onclick=()=>{if(started)openInventory(ctx);};document.querySelector('#settings-button').onclick=()=>{if(started)openSettings(ctx);};
document.querySelector('#interact-button').onclick=()=>interact(ctx.town.nearest?.id);document.querySelector('#ambient-bubble').onclick=()=>openAmbient(ctx);
// Debug handle: lets the layout tools and the browser tests drive the game directly.
window.__qinghe=ctx;
// H hides the name that follows the crosshair, for anyone who would rather just look at the town.
addEventListener('keydown',e=>{
 if(e.code!=='KeyH'||!started||ctx.ui.panelId||isTyping(e.target)||e.repeat||e.isComposing)return;
 ctx.ui.toggleNames();
});
const shortcuts={Digit1:['journal',openJournal],Digit2:['inventory',openInventory],Digit3:['wordbank',openWordBank],Digit4:['status',openStatus],Digit5:['settings',openSettings]};
addEventListener('keydown',e=>{
 const choice=shortcuts[e.code.replace('Numpad','Digit')];
 if(!choice||!shortcutAllowed(e,{started,panelId:ctx.ui.panelId,placing:!!ctx.town.ghost,
   reviewing:!!document.querySelector('#panel .drill-prompt')})||isTyping(document.activeElement))return;
 e.preventDefault();
 if(ctx.ui.panelId===choice[0])ctx.ui.close();else choice[1](ctx);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){ctx.speech.stop();ctx.voice.stop();ctx.music.suspend();}else if(started){ctx.music.resume();ctx.music.duck(!!ctx.ui.panelId);}});
