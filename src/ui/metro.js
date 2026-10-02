import {escapeHtml as esc} from '../core/language.js';
import {pinyinHtml} from './shell.js';
import {say} from './order.js';
import metro from '../content/metro.json' with {type:'json'};
import {cardBalance,topUpCard,enterJourney,cancelJourney,completeJourney,passValid,announcementReward} from '../core/metro.js';

export function openMetro(ctx){
 const p=ctx.profile,station=ctx.town.rooms.get(ctx.town.place)?.data.transit;
 if(!station)return;
 const body=ctx.ui.open('metro','交通卡 · Transit card','LINE 1 · QINGHE ↔ YUNHAI');
 const render=()=>{
  const pending=p.metro?.journey;
  body.innerHTML=`<p>Load coins onto your card, tap in, then walk through the open train doors. Trains come regularly.</p><div class="fare-state">Card balance / 余额: <b>${cardBalance(p)}</b> · Wallet: ${p.wallet}</div><p>Fare: <b>${passValid(p)?'0 · existing pass':'5 coins each way'}</b>. Only Qinghe–Yunhai is operating.</p><h3>充值 · Top up</h3><div class="button-row">${[10,20,50].map(n=>' <button class="secondary" id="transit-topup-'+n+'" data-topup="'+n+'">+'+n+'</button>').join('')}</div><p class="microcopy">Not enough coins? Study words to earn more, then return to top up. There is no free return trip.</p><label><input id="transit-fade" type="checkbox" ${p.metro?.fade?'checked':''}> Always fade after boarding</label><button id="transit-enter" class="primary wide">${pending?'Cancel entry / refund reservation':'Tap card · 刷卡进站'}</button><button id="transit-exit" class="secondary wide">Exit gates · 出站</button><p>After tapping in: walk towards the blue platform doors. Wait for the train to stop and open its doors, then step inside.</p>`;
  body.querySelectorAll('[data-topup]').forEach(b=>b.onclick=()=>{if(ctx.profile!==p)return;const result=topUpCard(p,Number(b.dataset.topup));if(!result.ok)return ctx.ui.notice('Not enough coins. Study to earn more.');ctx.save();render();});
  body.querySelector('#transit-fade').onchange=e=>{p.metro={...p.metro,fade:e.target.checked};ctx.save();};
  body.querySelector('#transit-enter').onclick=()=>{
   if(p.metro?.journey){cancelJourney(p);ctx.save();ctx.ui.close();return;}
   const result=enterJourney(p,station,station==='qinghe'?'yunhai':'qinghe');
   if(!result.ok)return ctx.ui.notice('Please top up your transit card first.');
   ctx.save();ctx.ui.close();ctx.ui.notice('Card accepted. Walk into the train when the doors open.');
  };
  body.querySelector('#transit-exit').onclick=()=>{cancelJourney(p);ctx.save();ctx.ui.close();const r=ctx.town.rooms.get(ctx.town.place);ctx.town.warp(r.offsetX,4,180);};
 };render();
}
export function rideHome(ctx){ctx.town.enterRoom('yunhai-central');ctx.syncPlace?.();}
function arrive(ctx,p,j){
 if(ctx.profile!==p)return;
 const result=completeJourney(p,j.id);if(!result.ok)return;
 if(!p.completed.includes('metro:first'))p.completed.push('metro:first');
 ctx.save();const id=j.destination==='yunhai'?'yunhai-central':'metro-platform';
 ctx.town.enterRoom(id);const room=ctx.town.rooms.get(id);ctx.town.transit.get(id).arrive();ctx.town.warp(room.offsetX,-7,180);ctx.syncPlace?.();
}
export function installTransit(ctx){
 ctx.town.transitJourney=()=>ctx.profile.metro?.journey;
 ctx.town.onTransitBoard=()=>{
  const p=ctx.profile,j=p.metro?.journey;if(!j||j.phase!=='reserved')return;
  j.phase='riding';ctx.save();
  ride(ctx,{to:j.destination==='yunhai'?'city':'town',arrive:()=>arrive(ctx,p,j),fareProfile:p});
 };
 const j=ctx.profile.metro?.journey;
 if(j?.phase==='riding')arrive(ctx,ctx.profile,j);
 else if(j){cancelJourney(ctx.profile);ctx.save();}
}
/**
 * The tunnel. A carriage window with lights streaming past it, the announcement board above the
 * doors, and a skip for anyone who has seen it before. The scene owns the screen while it runs:
 * the town is paused behind it and the HUD is hidden.
 *
 * Each announcement is heard before it is shown (Chinese first); without a clip it waits a beat
 * instead. On arrival the board asks where the train was going: the right stop pays once per ride,
 * a wrong one plays the next-stop line again, and 跳过 skips the lot.
 */
function ride(ctx,{to,arrive,fareProfile}){
  const host=document.querySelector('#app');
  const scene=document.createElement('div');
  scene.id='metro-ride';scene.className=to==='town'?'homeward':'';
  scene.innerHTML=`
    <div class="carriage">
      <div class="carriage-roof"><span class="line-name">地铁 1 号线 · LINE 1</span></div>
      <div class="carriage-window"><div class="tunnel"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
      <div class="carriage-window"><div class="tunnel slow"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
      <div class="carriage-floor"></div>
    </div>
    <div class="announce" role="status"><div class="announce-zh"></div><div class="announce-en"></div></div>
    <div class="announce-quiz"></div>
    <button class="metro-skip">跳过 · Skip</button>`;
  host.appendChild(scene);
  document.body.classList.add('riding');
  ctx.town?.setPaused(true);

  const zh=scene.querySelector('.announce-zh'),en=scene.querySelector('.announce-en'),quiz=scene.querySelector('.announce-quiz');
  const wait=ms=>new Promise(done=>setTimeout(done,ms));
  const next='next-'+to;
  let done=false;
  // Play a line's clip to its end (or wait a beat if it has none), then put its words up.
  const announce=async key=>{
    const started=Date.now();
    scene.classList.add('speaking');
    await say(ctx,scene,['metro-'+key]);
    await wait(Math.max(0,900-(Date.now()-started)));
    scene.classList.remove('speaking');
    if(done)return;
    const line=metro.lines[key],s=ctx.profile.settings;
    zh.textContent=line.zh;
    en.innerHTML=[pinyinHtml(line.pinyin,line.zh),s.english?esc(line.en):''].filter(Boolean).join(' · ');
  };
  const run=async()=>{
    for(const key of ['doors','hold',next,'arriving','arrived']){
      await announce(key);
      if(done)return;
      await wait(400);
      if(done)return;
    }
    await announce('question');
    if(done)return;
    quiz.innerHTML=metro.choices.map(stop=>`<button class="choice" data-stop="${esc(stop)}">${esc(stop)}</button>`).join('');
    quiz.querySelectorAll('[data-stop]').forEach(button=>button.onclick=()=>{
      if(done)return;
      if(button.dataset.stop!==metro.answers[to]){
        button.disabled=true;
        say(ctx,scene,['metro-'+next]);
        return;
      }
      if(ctx.profile!==fareProfile)return finish();
      const coins=1;ctx.profile.wallet+=coins;
      if(coins){ctx.save();ctx.music?.cue('reward');ctx.ui.notice(`+${coins} 学习币。`);}
      finish();
    });
  };

  const finish=()=>{
    if(done)return;done=true;
    ctx.voice?.stop();
    removeEventListener('keydown',onKey);
    scene.classList.add('arriving');
    setTimeout(()=>{
      scene.remove();
      document.body.classList.remove('riding');
      arrive();
      ctx.syncPlace?.();
      ctx.town?.setPaused(false);
      ctx.ui.update?.();
    },420);
  };
  // Space skips the announcements, but not once the choices are up (it would press a button).
  const onKey=e=>{if(e.code==='Escape'||(e.code==='Space'&&!quiz.childElementCount))finish();};
  addEventListener('keydown',onKey);
  scene.querySelector('.metro-skip').onclick=finish;
  if(fareProfile?.metro?.fade)finish();else run();
}
