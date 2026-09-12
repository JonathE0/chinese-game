import {escapeHtml as esc} from '../core/language.js';
import {icon} from './art.js';
import {languageLine} from './shell.js';
import {CITY} from '../world/city.js';
import {FARE,metroOf,passValid,passDaysLeft,buyTickets,buyPass,boardingProblem,board,returnTrip} from '../core/metro.js';

/**
 * 青禾地铁站 — the fare hall, and the ride itself.
 *
 * The ride is a real scene rather than a loading screen: the doors close, the tunnel lights go
 * past, the announcement plays the way a real one does (next station, then arrival, then which
 * side to get off), and only then does the city appear. It is the one moment in the game that
 * takes the player somewhere instead of just changing what is on screen, so it is worth the
 * five seconds — and it is skippable for the tenth journey.
 */
const CLERK={zh:'去哪儿？买张票吧。',pinyin:'Qù nǎr? Mǎi zhāng piào ba.',en:'Where to? Buy a ticket.',
  note:'张 (zhāng) is the measure word for flat things — tickets, paper, tables. 一张票 is one ticket.'};

const ANNOUNCE=[
  {at:0,   zh:'车门关闭，请注意安全。',pinyin:'Chēmén guānbì, qǐng zhùyì ānquán.',en:'Doors closing — please mind the doors.'},
  {at:1600,zh:'下一站，云海市中心。',  pinyin:'Xià yí zhàn, Yúnhǎi shì zhōngxīn.',en:'Next station: Downtown Yunhai.'},
  {at:4200,zh:'云海市中心站到了。',    pinyin:'Yúnhǎi shì zhōngxīn zhàn dào le.',en:'We are arriving at Downtown Yunhai.'},
  {at:5600,zh:'请从左边下车。',        pinyin:'Qǐng cóng zuǒbian xià chē.',      en:'Please alight on the left.'},
];
const ANNOUNCE_BACK=[
  {at:0,   zh:'车门关闭，请注意安全。',pinyin:'Chēmén guānbì, qǐng zhùyì ānquán.',en:'Doors closing — please mind the doors.'},
  {at:1600,zh:'下一站，青禾广场。',    pinyin:'Xià yí zhàn, Qīnghé guǎngchǎng.', en:'Next station: Qinghe Square.'},
  {at:4200,zh:'青禾广场站到了。',      pinyin:'Qīnghé guǎngchǎng zhàn dào le.',  en:'We are arriving at Qinghe Square.'},
  {at:5600,zh:'请从右边下车。',        pinyin:'Qǐng cóng yòubian xià chē.',      en:'Please alight on the right.'},
];
const RIDE_MS=7000;

export function openMetro(ctx){
  const body=ctx.ui.open('metro',CITY.station.zh,'地铁 · METRO');
  render(ctx,body);
}

function render(ctx,body){
  const p=ctx.profile,day=p.dayIndex??0;
  const {rides}=metroOf(p),onPass=passValid(p,day),left=passDaysLeft(p,day);
  const problem=boardingProblem(p,day);
  const want=Math.max(1,Math.min(9,ctx.metroWant??1));

  body.innerHTML=`${languageLine(CLERK,p.settings,{className:'dialogue-line'})}
    <p class="panel-intro">${esc(CITY.station.pinyin)} · ${esc(CITY.station.en)}<br>
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

    <button class="primary wide" id="ride" ${problem?'disabled':''}>
      ${problem?'先买张票':'进站上车 · Board the train'} ${problem?'':icon('arrow')}</button>
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
    ride(ctx,{announcements:ANNOUNCE,arrive:()=>ctx.town.enterCity()});
  };
}

/** Leaving the city again. No fare hall, no ticket — you just get on. */
export function rideHome(ctx){
  returnTrip(ctx.profile);
  ctx.save();
  ride(ctx,{announcements:ANNOUNCE_BACK,arrive:()=>ctx.town.leaveCity(),back:true});
}

/**
 * The tunnel. A carriage window with lights streaming past it, the announcement board above the
 * doors, and a skip for anyone who has seen it before. The scene owns the screen while it runs:
 * the town is paused behind it and the HUD is hidden.
 */
function ride(ctx,{announcements,arrive,back=false}){
  const host=document.querySelector('#app');
  const scene=document.createElement('div');
  scene.id='metro-ride';scene.className=back?'homeward':'';
  scene.innerHTML=`
    <div class="carriage">
      <div class="carriage-roof"><span class="line-name">地铁 1 号线 · LINE 1</span></div>
      <div class="carriage-window"><div class="tunnel"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
      <div class="carriage-window"><div class="tunnel slow"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
      <div class="carriage-floor"></div>
    </div>
    <div class="announce" role="status"><div class="announce-zh"></div><div class="announce-en"></div></div>
    <button class="metro-skip">跳过 · Skip</button>`;
  host.appendChild(scene);
  document.body.classList.add('riding');
  ctx.town?.setPaused(true);

  const zh=scene.querySelector('.announce-zh'),en=scene.querySelector('.announce-en');
  const timers=announcements.map(line=>setTimeout(()=>{
    zh.textContent=line.zh;
    en.textContent=[ctx.profile.settings.pinyin?line.pinyin:'',ctx.profile.settings.english?line.en:''].filter(Boolean).join(' · ');
    scene.classList.add('speaking');
    setTimeout(()=>scene.classList.remove('speaking'),700);
  },line.at));

  let done=false;
  const finish=()=>{
    if(done)return;done=true;
    for(const timer of timers)clearTimeout(timer);
    clearTimeout(end);
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
  const onKey=e=>{if(e.code==='Escape'||e.code==='Space')finish();};
  addEventListener('keydown',onKey);
  scene.querySelector('.metro-skip').onclick=finish;
  const end=setTimeout(finish,RIDE_MS);
}
