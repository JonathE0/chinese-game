import {escapeHtml as esc} from '../core/language.js';
import {icon} from './art.js';
import {pinyinHtml} from './shell.js';
import {say} from './order.js';
import {openBank} from './bank.js';
import {fadeThrough} from './fade.js';
import {gateTone} from '../services/audio.js';
import metro from '../content/metro.json' with {type:'json'};
import unlock from '../content/unlock.json' with {type:'json'};
import {rideOpen} from '../core/unlock.js';
import {cardBalance,topUpCard,enterJourney,cancelJourney,boardJourney,completeJourney,passValid,passDaysLeft,quoteFare,announcementReward} from '../core/metro.js';

/**
 * 交通卡 — the card machines and the gate reader in a station (openMetro; main.js shows the station
 * attendant instead while the metro is still shut, src/ui/unlock.js), what the stations say and beep
 * (installTransit, for src/world/metro-station.js), boarding, the ride and arriving.
 *
 * Rules live in core/metro.js: coins go from the wallet onto the card, tapping in holds the fare,
 * stepping aboard puts the journey under way and arriving takes the fare, once. There is no free
 * ride either way: short of coins, the word bank is one button away, at either end of the line.
 */
const otherEnd=station=>{const route=metro.network.routes.find(r=>r.from===station||r.to===station);return route&&(route.from===station?route.to:route.from);};
/** A save that fails is never what stops a journey half-way: it is reported and the journey goes on. */
function persist(ctx){try{ctx.save();}catch(error){console.error(error);}}
const CANCELLED='Entry cancelled: nothing was charged.',S=metro.signs,TAP_IN=S.tap.zh+S.entry.zh,A=metro.announcements;
const volume=ctx=>ctx.profile.settings?.dialogueVolume??1;
const wait=ms=>new Promise(done=>setTimeout(done,ms));
/** Standing at the gate's reader (not at a card machine) in this station. */
function atGate(ctx,control){
 const p=ctx.town.player.entity.getPosition(),{gz,gy}=control.layout;
 return Math.abs(p.x-control.room.offsetX)<2.6&&Math.abs(p.z-(gz+1.25))<2.2&&Math.abs(ctx.town.playerY-gy)<1;
}

export function openMetro(ctx){
 const p=ctx.profile,control=ctx.town.transit.get(ctx.town.place),station=control?.station,to=otherEnd(station);
 if(!to)return;
 const here=metro.stations[station],there=metro.stations[to],gate=atGate(ctx,control);
 const body=ctx.ui.open('metro',`${S.card.zh} · ${S.card.en}`,`${metro.line.name} · ${here.towards} · ${here.towardsEn}`);
 let topped=0;
 const render=()=>{
  if(ctx.profile!==p)return ctx.ui.close();
  const balance=cardBalance(p),pass=passValid(p),fare=pass?0:quoteFare(station,to).cost,days=passDaysLeft(p);
  const j=p.metro?.journey,tapped=j?.phase==='reserved'&&j.origin===station,short=!tapped&&balance<fare;
  body.innerHTML=`<p class="panel-intro">${S['top-up'].zh} · Top up the card with coins from your wallet, then ${TAP_IN} · tap in at the gates. Walk onto the train once its doors open: the fare comes off the card when you arrive.</p>
   <div class="fare-state${pass?' held':''}">${icon('coin',16)} ${S.balance.zh} · Card <b id="transit-balance">${balance}</b> · Wallet ${p.wallet}${pass?` · Your pass rides free for ${days} more day${days===1?'':'s'}.`:''}</div>
   <div class="fare-card"><div class="fare-head"><b>${esc(here.towards)}</b><small>${esc(there.name)} · ${esc(there.en)}</small><span class="fare-price">${icon('coin',14)} ${fare}</span></div></div>
   <h3 class="section-title">${esc(S['top-up'].zh)} <small>TOP UP</small></h3>
   <div class="button-row">${metro.topUps.map(n=>`<button class="secondary" id="transit-topup-${n}" data-topup="${n}" ${p.wallet<n?'disabled':''}>+${n}</button>`).join('')}</div>
   ${short?`<p class="microcopy"><b>${esc(S.short.zh)}</b> · This trip needs ${fare} coins on the card. Top up from your wallet; if it is short too, study words to earn coins. There is no free ride.</p><button class="secondary wide" id="transit-study">Study words to earn coins</button>`:''}
   <label class="microcopy"><input id="transit-fade" type="checkbox" ${p.metro?.fade?'checked':''}> Always fade after boarding</label>
   ${tapped?`<div class="fare-state held">Tapped in. Walk through the gates and onto the train when its doors open.</div><button id="transit-cancel" class="secondary wide">Cancel · nothing is charged</button>`
    // Before the unlock the machines still top up the card, but nobody taps in at Qinghe yet.
    :rideOpen(p,station)?`<button id="transit-enter" class="primary wide" ${short?'disabled':''}>${TAP_IN} · Tap in</button>`
    :`<p class="microcopy" id="transit-locked"><b>${esc(unlock.questLocked.zh)}</b> · ${esc(unlock.questLocked.en)}</p>`}`;
  body.querySelectorAll('[data-topup]').forEach(b=>b.onclick=()=>{
   if(ctx.profile!==p)return ctx.ui.close();
   // One press, one top-up: a quick second click lands while the first is still going through.
   const now=performance.now();if(now-topped<600)return;topped=now;
   body.querySelectorAll('[data-topup]').forEach(other=>other.disabled=true);
   if(!topUpCard(p,Number(b.dataset.topup)).ok){render();return ctx.ui.notice('Not enough coins in your wallet. Study words to earn more.');}
   ctx.music?.cue('place');persist(ctx);ctx.ui.update?.();render();
  });
  body.querySelector('#transit-study')?.addEventListener('click',()=>openBank(ctx));
  body.querySelector('#transit-fade').onchange=e=>{if(ctx.profile!==p)return;p.metro={...p.metro,fade:e.target.checked};persist(ctx);};
  body.querySelector('#transit-enter')?.addEventListener('click',()=>{
   if(ctx.profile!==p)return ctx.ui.close();
   const result=enterJourney(p,station,to);
   if(!result.ok)return ctx.ui.notice(result.reason==='balance'?`Top up first: this trip needs ${result.cost} coins on the card.`:'Your card is already in use for another trip.');
   gateTone('ok',volume(ctx));control.display('ok',cardBalance(p));
   persist(ctx);ctx.ui.close();ctx.ui.notice(`${S.tap.zh} ✓ Walk through the gates and onto the train when its doors open.`);
  });
  body.querySelector('#transit-cancel')?.addEventListener('click',()=>{if(ctx.profile===p&&cancelJourney(p).ok)persist(ctx);ctx.ui.close();ctx.ui.notice(CANCELLED);});
  return short;
 };
 // At the reader with too little on the card: its screen says so, with a low buzz and the announcement.
 if(render()&&gate){gateTone('error',volume(ctx));control.display('short');ctx.transitAnnouncer?.moment(station,'short');}
}

/** Leaving a station by its street door without travelling lets go of the fare held there. */
export function leaveStation(ctx){
 const station=ctx.town.rooms.get(ctx.town.place)?.data.transit;
 if(station&&ctx.profile.metro?.journey?.origin===station&&cancelJourney(ctx.profile).ok)persist(ctx);
}

export function installTransit(ctx){
 let seen=null;
 const announcer=ctx.transitAnnouncer=stationVoice(ctx);
 ctx.town.transitJourney=()=>ctx.profile.metro?.journey;
 ctx.town.onTransitBoard=station=>board(ctx,station);
 ctx.town.onTransitLeave=station=>{if(ctx.profile.metro?.journey?.origin===station&&cancelJourney(ctx.profile).ok){persist(ctx);ctx.ui.notice(CANCELLED);}};
 // Out through the gates after a ride: the reader beeps as you pass (the fare was taken on arrival).
 ctx.town.onTransitGate=(station,kind)=>gateTone(kind==='out'?'ok':kind,volume(ctx));
 ctx.town.onTransitAnnounce=(station,moment)=>announcer.moment(station,moment);
 // Whoever is playing now (after a reload, an import, a restored backup or a switch of account)
 // finds the journey their save was on finished at the far platform, or let go if it had not begun.
 ctx.town.transitCheck=()=>{if(ctx.profile!==seen){seen=ctx.profile;recover(ctx);}};
 ctx.town.transitCheck();
}

/**
 * The stations' announcements (metro.json `announcements.platform`), at the dialogue volume. One
 * line at a time: each waits for whatever is being said to end, and one that waited too long is past
 * its moment and dropped. Most lines are not repeated within `every` seconds; `always` ones are.
 */
function stationVoice(ctx){
 const heard=new Map();let chain=Promise.resolve();
 const base=key=>key.replace(/-(city|town)$/,'');
 const settle=(audio,started,limit)=>new Promise(done=>{
  const timer=setTimeout(done,limit);
  const end=()=>{clearTimeout(timer);done();};
  for(const event of ['ended','pause','error'])audio.addEventListener(event,end,{once:true});
  started?.then(()=>{if(audio.paused)end();});
 });
 // Only in that station, with nothing but its own card panel up, and not past its moment: a line
 // still queued once you have left or opened a panel or a chat is dropped, not said over it.
 const due=(station,at)=>Date.now()-at<8000&&ctx.town.transit.get(ctx.town.place)?.station===station&&(!ctx.ui.panelId||ctx.ui.panelId==='metro');
 const play=async(key,station,at)=>{
  const id='metro-'+key;
  if(!ctx.voice?.available(id)||!due(station,at))return;
  const other=ctx.voice.foreground;
  if(other&&!other.paused&&!other.ended)await settle(other,null,8000);
  if(!due(station,at))return;
  const started=ctx.voice.play(id),audio=ctx.voice.foreground;
  if(audio)await settle(audio,started,9000);
 };
 return {
  moment(station,moment){
   const dir=metro.stations[otherEnd(station)]?.announce;
   for(const k of A.platform[moment]??[]){
    const key=k==='bound'?`bound-${dir}`:k,now=Date.now();
    if(!A.always.includes(base(key))&&now-(heard.get(key)??-Infinity)<A.every*1000)continue;
    heard.set(key,now);
    chain=chain.then(()=>play(key,station,now));
   }
  },
  /** Resolves once the station has finished speaking. */
  idle:()=>chain,
 };
}

function recover(ctx){
 const p=ctx.profile,j=p.metro?.journey;
 if(j?.phase==='riding')return arrive(ctx,p,j);
 if(j&&ctx.town.rooms.get(ctx.town.place)?.data.transit!==j.origin&&cancelJourney(p).ok)persist(ctx);
}
/** The doors have closed with the traveller aboard (the station asks): the journey is under way. */
function board(ctx,station){
 const p=ctx.profile,j=p.metro?.journey;
 if(j?.origin!==station||!boardJourney(p,j.id).ok)return false;
 persist(ctx);
 ride(ctx,{station,to:metro.stations[j.destination].announce,profile:p,arrive:spot=>arrive(ctx,p,j,spot)});
 return true;
}
/** Off at the far platform, standing where you stood in the carriage (`spot`), the fare taken once. */
function arrive(ctx,p,j,spot){
 if(ctx.profile!==p)return;   // another save took over during the ride; recover() has seen to its journey
 const done=completeJourney(p,j.id);
 if(!done.ok)return;
 if(!p.completed.includes('metro:first'))p.completed.push('metro:first');
 persist(ctx);
 const room=[...ctx.town.rooms.values()].find(r=>r.data.transit===done.destination);
 ctx.town.enterRoom(room.id);ctx.town.transit.get(room.id).arrive(spot);ctx.syncPlace?.();ctx.ui.update?.();
}

/**
 * The ride. You stay in the carriage (the station's own ride carriage, src/world/metro-station.js):
 * the doors have closed, the train pulls out past the platform and the tunnel streams by, and a strip
 * along the bottom of the screen shows each announcement as it is heard (Chinese, then pinyin and
 * English as the settings say), with Replay and Skip. Getting ready to get off, the train brakes to a
 * stand at the far platform; the announcement board asks where the train was going (the right stop
 * pays once per ride, a wrong one plays the next-stop line again), the doors open and you are there.
 * 跳过 skips the lot, question and coin included; with `fade` saved the ride simply fades through.
 * Skipping changes nothing about the fare or where you arrive.
 */
function ride(ctx,{station,to,profile,arrive}){
 const control=[...ctx.town.transit.values()].find(c=>c.station===station);
 const strip=document.createElement('div');
 strip.id='metro-ride';
 strip.innerHTML=`
  <div class="announce" role="status" aria-live="polite"><div class="announce-zh"></div><div class="announce-en"></div></div>
  <div class="announce-quiz"></div>
  <div class="ride-buttons"><button class="metro-skip metro-replay" aria-label="Replay the announcement" hidden>${esc(S.replay.zh)} · Replay</button><button class="metro-skip">跳过 · Skip</button></div>`;
 document.querySelector('#app').appendChild(strip);
 document.body.classList.add('riding');
 ctx.town?.setPaused(true);
 const zh=strip.querySelector('.announce-zh'),en=strip.querySelector('.announce-en'),quiz=strip.querySelector('.announce-quiz');
 const replay=strip.querySelector('.metro-replay');
 let done=false,current=null,replaying=null,carriage=null;

 // Each line goes up as its clip starts, and stays until the next. A Replay restarts the line on
 // the board, and the ride waits for it to be heard out before it moves on.
 const show=key=>{
  const line=metro.lines[key],s=ctx.profile.settings;
  zh.textContent=line.zh;
  en.innerHTML=[pinyinHtml(line.pinyin,line.zh),s.english?esc(line.en):''].filter(Boolean).join(' · ');
  current=key;replay.hidden=false;
 };
 const announce=async key=>{
  while(replaying&&!done){const r=replaying;replaying=null;await r;}
  if(done)return;
  show(key);
  const started=Date.now();strip.classList.add('speaking');
  let heard=await say(ctx,strip,['metro-'+key]);
  while(!heard&&replaying&&!done){const r=replaying;replaying=null;heard=await r;}
  strip.classList.remove('speaking');
  await wait(Math.max(0,900-(Date.now()-started)));   // without a clip, a beat to read it
 };
 replay.onclick=()=>{if(current&&!done)replaying=say(ctx,strip,['metro-'+current]);};

 const run=async()=>{
  await ctx.transitAnnouncer?.idle();   // the platform's last words first
  const tips=A.tips,tip=tips[(profile.metro?.trips??0)%tips.length];
  let stopped=Promise.resolve();
  for(const k of A.ride){
   if(done)return;
   const key=['bound','next','arrive'].includes(k)?`${k}-${to}`:k==='tip'?tip:k;
   if(k==='get-ready')stopped=carriage?.approach()??stopped;   // it brakes for the platform as the line starts
   if(k==='arrive'){await stopped;if(done)return;}
   await announce(key);if(done)return;
   await wait(300);
  }
  await announce('question');if(done)return;
  quiz.innerHTML=metro.choices.map(stop=>`<button class="choice" data-stop="${esc(stop)}">${esc(stop)}</button>`).join('');
  quiz.querySelectorAll('[data-stop]').forEach(button=>button.onclick=async()=>{
   if(done)return;
   if(button.dataset.stop!==metro.answers[to]){button.disabled=true;say(ctx,strip,['metro-next-'+to]);return;}
   const coins=ctx.profile===profile?announcementReward(profile):0;
   if(coins){persist(ctx);ctx.music?.cue('reward');ctx.ui.notice(`+${coins} 学习币。`);}
   quiz.innerHTML='';
   await carriage?.open();
   finish();
  });
 };

 const finish=()=>{
  if(done)return;done=true;
  ctx.voice?.stop();
  removeEventListener('keydown',onKey);
  strip.classList.add('arriving');
  fadeThrough(()=>{
   const spot=carriage?control.rideSpot():null;
   control.endRide();
   strip.remove();
   document.body.classList.remove('riding');
   arrive(spot);
   ctx.syncPlace?.();
   ctx.town?.setPaused(false);
   ctx.ui.update?.();
  },{duration:300});
 };
 // Space skips the announcements, but not once the choices are up (it would press a button).
 const onKey=e=>{if(e.code==='Escape'||(e.code==='Space'&&!quiz.childElementCount))finish();};
 addEventListener('keydown',onKey);
 strip.querySelector('.metro-skip:not(.metro-replay)').onclick=finish;
 if(profile.metro?.fade)return finish();
 // Into the ride's carriage behind a blink, so the swap from the one at the platform does not show.
 fadeThrough(()=>{if(!done){carriage=control.startRide();run();}},{duration:220});
}
