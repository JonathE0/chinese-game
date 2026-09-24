import {escapeHtml as esc} from '../core/language.js';
import {icon} from './art.js';
import {languageLine,pinyinWith,pinyinHtml} from './shell.js';
import {CITY} from '../world/city.js';
import {say} from './order.js';
import metro from '../content/metro.json' with {type:'json'};
import {FARE,metroOf,passValid,passDaysLeft,buyTickets,buyPass,boardingProblem,board,returnTrip,announcementReward} from '../core/metro.js';

/**
 * 青禾地铁站 — the fare hall, and the ride itself.
 *
 * The ride is a real scene rather than a loading screen: the doors close, the tunnel lights go
 * past, the announcements play the way real ones do (metro.json), and on arrival one listening
 * question asks where the train was going. Only then does the city appear. It is the one moment in the game that
 * takes the player somewhere instead of just changing what is on screen, so it is worth the
 * five seconds — and it is skippable for the tenth journey.
 */
const CLERK={zh:'去哪儿？买张票吧。',pinyin:'Qù nǎr? Mǎi zhāng piào ba.',en:'Where to? Buy a ticket.',
  note:'张 (zhāng) is the measure word for flat things — tickets, paper, tables. 一张票 is one ticket.'};


export function openMetro(ctx){
  const body=ctx.ui.open('metro',CITY.station.zh,'地铁 · METRO');
  render(ctx,body);
}

function render(ctx,body){
  const p=ctx.profile,day=p.dayIndex??0;
  const {rides}=metroOf(p),onPass=passValid(p,day),left=passDaysLeft(p,day);
  const problem=boardingProblem(p,day);
  const want=Math.max(1,Math.min(9,ctx.metroWant??1));
  // The ticket machine is up on the landing; the train is boarded down on the platform.
  const upstairs=ctx.town.floorY()>0;

  body.innerHTML=`${languageLine(CLERK,p.settings,{className:'dialogue-line'})}
    <p class="panel-intro">${pinyinWith(CITY.station.pinyin,CITY.station.zh,CITY.station.en)}<br>
      一号线开往${esc(CITY.place.zh)}。回程免费。<br>
      Line 1 runs to ${esc(CITY.place.en)}. Coming back is free.</p>

    <div class="fare-state ${onPass?'held':''}">
      ${onPass?`${icon('check',16)} 通票还有 ${left} 天。 / Your pass has ${left} day${left===1?'':'s'} left.`
        :`${icon('map',16)} 手上有 ${rides} 张单程票。 / You are carrying ${rides} single ticket${rides===1?'':'s'}.`}
    </div>

    <h3 class="section-title">买票 <small>BUY A TICKET</small></h3>
    <div class="fare-card">
      <div class="fare-head"><b>单程票</b><small>dānchéngpiào · single ticket</small>
        <span class="fare-price">${icon('coin',14)} ${FARE.single}</span></div>
      <div class="qty-row">
        <button class="qty-step" data-want="-1" aria-label="少一张">−</button>
        <b class="qty-count">${want}</b>
        <button class="qty-step" data-want="1" aria-label="多一张">+</button>
        <button class="primary" id="buy-tickets">买 ${want} 张 · ${FARE.single*want}</button>
      </div>
    </div>
    <div class="fare-card ${onPass?'dim':''}">
      <div class="fare-head"><b>一周通票</b><small>tōngpiào · seven-day pass</small>
        <span class="fare-price">${icon('coin',14)} ${FARE.pass}</span></div>
      <p class="microcopy">七天内随便坐。坐满七趟就回本了。<br>
        Unlimited journeys for ${FARE.passDays} days — worth it from the seventh ride.</p>
      <button class="secondary wide" id="buy-pass" ${onPass?'disabled':''}>
        ${onPass?'已经有通票了':'买通票'}</button>
    </div>

    <button class="primary wide" id="ride" ${problem?'disabled':''} ${upstairs?'hidden':''}>
      ${problem?'先买张票':'上车 · Board the train'} ${problem?'':icon('arrow')}</button>
    <p class="microcopy">${esc(CITY.place.zh)}是另一座城市，路牌和店名都不一样。回青禾不用买票。<br>
      ${esc(CITY.place.en)} is a different city — different signs, different shops, different people
      to talk to. The journey home is always free.</p>`;

  body.querySelectorAll('[data-want]').forEach(button=>button.onclick=()=>{
    ctx.metroWant=Math.max(1,Math.min(9,want+Number(button.dataset.want)));
    render(ctx,body);
  });
  body.querySelector('#buy-tickets').onclick=()=>{
    const got=buyTickets(p,want);
    if(!got.ok)return ctx.ui.notice('钱不够。 / Not enough coins.');
    ctx.music?.cue('place');ctx.save();
    ctx.ui.notice(`买了 ${got.bought} 张票，花了 ${got.cost}。 / ${got.bought} ticket${got.bought===1?'':'s'}, ${got.cost} coins.`);
    render(ctx,body);
  };
  body.querySelector('#buy-pass').onclick=()=>{
    const got=buyPass(p,p.dayIndex??0);
    if(!got.ok)return ctx.ui.notice('钱不够。 / Not enough coins.');
    ctx.music?.cue('reward');ctx.save();
    ctx.ui.notice(`通票买好了，七天内随便坐。 / A week's pass — ride as much as you like.`);
    render(ctx,body);
  };
  body.querySelector('#ride').onclick=()=>{
    const fare=board(p,p.dayIndex??0);
    if(!fare.ok)return;
    if(!p.completed.includes('metro:first'))p.completed.push('metro:first');
    ctx.save();
    ctx.ui.close();
    ride(ctx,{to:'city',arrive:()=>ctx.town.enterCity()});
  };
}

/** Leaving the city again. No fare hall, no ticket — you just get on. */
export function rideHome(ctx){
  returnTrip(ctx.profile);
  ctx.save();
  ride(ctx,{to:'town',arrive:()=>ctx.town.leaveCity()});
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
function ride(ctx,{to,arrive}){
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
      if(button.dataset.stop!==metro.answers[to]){
        button.disabled=true;
        say(ctx,scene,['metro-'+next]);
        return;
      }
      const coins=announcementReward(ctx.profile);
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
  run();
}
