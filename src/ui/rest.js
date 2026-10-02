import {rentalAccess} from '../core/rental.js';
import rooms from '../content/rooms.json' with {type:'json'};
import {escapeHtml as esc} from '../core/language.js';
import {icon} from './art.js';
import {languageLine,pinyinWith} from './shell.js';
import {readStats,sleep,energyNote} from '../core/stats.js';
import {clockText} from '../world/daylight.js';
import {fadeThrough} from './fade.js';

/**
 * Your own bed. Sleeping is the one place you get to set the clock yourself — the day/night
 * cycle is short, but waiting twelve minutes to see the lanterns lit is still waiting.
 */
const TIMES=[
  {id:'morning',hour:7.5, zh:'早上',pinyin:'zǎoshang',en:'Morning',   note:'天刚亮，街上很安静。',noteEn:'Just after first light; the streets are quiet.'},
  {id:'midday', hour:12.5,zh:'中午',pinyin:'zhōngwǔ', en:'Midday',    note:'太阳很高，店都开着。',noteEn:'Sun high, everything open.'},
  {id:'evening',hour:18.5,zh:'傍晚',pinyin:'bàngwǎn', en:'Evening',   note:'灯笼刚亮起来的时候。',noteEn:'The hour the lanterns come on.'},
  {id:'night',  hour:22.5,zh:'晚上',pinyin:'wǎnshang',en:'Night',     note:'城里安静下来了。',    noteEn:'The town has gone quiet.'},
];

export function openSleep(ctx){
 if(!rentalAccess(ctx.profile,ctx.town.place))return ctx.ui.notice('Your lease has expired. Renew at the rental desk to rest here.');
  const body=ctx.ui.open('sleep','睡一觉','床 · REST');
  const s=readStats(ctx.profile);
  const now=ctx.town.daylight.hour;
  const line={zh:'睡到什么时候？',pinyin:'Shuì dào shénme shíhou?',en:'Sleep until when?',
    note:'睡到 X means to sleep until X — 到 marks the point you sleep up to.'};
  body.innerHTML=`${languageLine(line,ctx.profile.settings,{className:'dialogue-line'})}
    <p class="panel-intro">现在是 ${esc(clockText(now))}。睡一觉，精神会回满。<br>
      It is ${esc(clockText(now))} now. A sleep restores your rest completely.</p>
    ${languageLine(energyNote(s.energy),ctx.profile.settings,{className:'stat-note'})}
    <div class="sleep-grid">${TIMES.map(time=>`
      <button class="sleep-card" data-sleep="${esc(time.id)}">
        <span class="sleep-hour">${esc(clockText(time.hour))}</span>
        <b>${esc(time.zh)}</b><small>${pinyinWith(time.pinyin,time.zh,time.en)}</small>
        <span class="sleep-note">${esc(time.note)}<br><i>${esc(time.noteEn)}</i></span>
      </button>`).join('')}</div>
    <p class="microcopy">睡觉会稍微消耗一点肚子里的存货。 ${icon('clock',13)} 十二分钟是游戏里的一整天。<br>
      Sleeping costs a little hunger. A full in-game day passes every twelve real minutes.</p>`;

  body.querySelectorAll('[data-sleep]').forEach(button=>button.onclick=()=>{
    const time=TIMES.find(t=>t.id===button.dataset.sleep);
    const town=ctx.town,bed=town.bedHere();
    ctx.ui.close();
    // Into bed with a hop (or, with reduced motion, simply a fade), the screen goes dark, the clock
    // jumps, and the tourist is up again beside the bed. Nothing takes input until it is over.
    town.setPaused(true);
    const settle=bed&&!matchMedia('(prefers-reduced-motion: reduce)').matches?town.lieDown(bed):0;
    fadeThrough(()=>{
      let hours=time.hour-town.daylight.hour;
      if(hours<=0)hours+=24;                            // sleeping round to the same time tomorrow
      if(hours>=(24-town.daylight.hour)&&town.daylight.hour+hours>=24)ctx.profile.dayIndex=(ctx.profile.dayIndex??0)+1;
      town.daylight.setHour(time.hour);
      ctx.profile.clock=time.hour;
      sleep(ctx.profile,hours);
      ctx.profile.stats.hour=time.hour;                 // do not charge hunger twice for the same hours
      ctx.save();
      if(bed)town.getUp(bed);
    },{duration:1000,hold:settle,onDone:()=>{
      town.setPaused(false);
      ctx.ui.notice(`睡到${time.zh}了。 / You slept until ${time.en.toLowerCase()}.`);
    }});
  });
}

/** The notice on the door of a shop that has not opened yet. */
export function openClosed(ctx,roomId){
  const room=rooms[roomId];
  if(!room)return;
  const body=ctx.ui.open('closed',room.zh,'暂停营业 · NOT OPEN YET');
  const line={zh:'今天不营业。',pinyin:'Jīntiān bù yíngyè.',en:'Not open today.',
    note:'营业 (yíngyè) is what a shop does when it is trading; 暂停营业 is the sign in the window.'};
  body.innerHTML=`${languageLine(line,ctx.profile.settings,{className:'dialogue-line'})}
    <div class="gate-note"><b>${esc(room.opens?.zh??'再过一阵子来看看')}</b>
      <p class="microcopy">${esc(room.opens?.en??'Come back a little later in your journey.')}</p></div>
    <p class="microcopy">${esc(room.zh)} · ${pinyinWith(room.pinyin,room.zh,room.en)}</p>`;
}
