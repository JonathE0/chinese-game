import data from '../content/festivals.json' with {type:'json'};
import npcs from '../content/npcs.json' with {type:'json'};
import social from '../content/lessons/npc-smalltalk.json' with {type:'json'};
import {FESTIVALS,RIDDLES,festivalOf,festivalPay,festivalClip,riddleChoices} from '../core/festivals.js';
import {syncDay,bump} from '../core/daily.js';
import {escapeHtml as esc} from '../core/language.js';
import {languageLine,pinyinWith} from './shell.js';
import {icon} from './art.js';

const ui=data.ui;
const audioRow=`<div class="audio-row"><button class="subtle" data-replay>${icon('sound',16)} 重听</button><button class="subtle" data-slow>慢速</button></div>`;
function speak(ctx,body,clip){
  body.querySelector('[data-replay]').onclick=()=>ctx.voice.play(clip);
  body.querySelector('[data-slow]').onclick=()=>ctx.voice.play(clip,{slow:true});
  if(ctx.voice.available(clip))ctx.voice.play(clip);
}
const line=(ctx,entry)=>languageLine(entry,ctx.profile.settings,{className:'dialogue-line'});
const choices=(list,attr)=>`<div class="order-row">${list.map(v=>`<button class="choice drill-choice" data-${attr}="${esc(v.key)}">${esc(v.zh)}</button>`).join('')}</div>`;
// A wrong pick greys out and stays wrong; the right one moves the conversation on.
function pick(body,attr,right,onRight){
  body.querySelectorAll(`[data-${attr}]`).forEach(b=>b.onclick=()=>{
    if(b.dataset[attr]!==right){b.disabled=true;b.classList.add('wrong');return;}
    onRight();
  });
}

/**
 * On a festival day 林阿姨, 小美 and 陈叔叔 greet you first, once each: you answer with the right
 * greeting of the four. Returns false when there is nothing to say, so the usual chat opens.
 */
export function festivalGreeting(ctx,caller,then){
  // Before her first lesson 小美 is opened as 'mei-first'; she is the same person for the festival.
  const personId=caller==='mei-first'?'mei':caller,festival=festivalOf(ctx.profile);
  if(!festival||!data.people.includes(personId))return false;
  const daily=syncDay(ctx.profile,ctx.profile.dayIndex??0),mark='fest-hi-'+personId;
  if(daily.counts[mark])return false;
  const person=npcs.find(n=>n.id===personId);
  const body=ctx.ui.open('dialogue',person.zh,`${ui.festival.zh} · ${festival.zh}`);
  const header=`<div class="dialogue-top"><div class="portrait" style="background:${esc(person.color??'#90a982')};color:#fff5da">${esc(person.zh.slice(0,1))}</div><div><b>${esc(person.zh)}</b><small>${esc(festival.zh)}</small></div></div>`;
  const hi='hi-'+festival.id;
  body.innerHTML=`${header}${line(ctx,data.lines[hi])}${audioRow}
    ${choices(FESTIVALS.map(f=>({key:'hi-'+f.id,zh:data.lines['hi-'+f.id].zh})),'hi')}`;
  speak(ctx,body,festivalClip(hi,personId));
  pick(body,'hi',hi,()=>{
    daily.counts[mark]=1;bump(ctx.profile,'greeted');
    const chunjie=festival.id==='chunjie',reply=chunjie?'reply-chunjie':'reply';
    const coins=chunjie?festivalPay(ctx.profile,'hongbao-'+personId,data.hongbao):0;
    ctx.save();
    if(coins){ctx.music?.cue('reward');ctx.ui.notice(`红包 +${coins} 学习币 · red envelope`);}
    body.innerHTML=`${header}${line(ctx,data.lines[reply])}${audioRow}
      ${coins?`<div class="reward">${icon('coin',16)} 红包 +${coins}</div>`:''}
      <button class="primary wide" id="festival-done">${esc(social.ui.continue)} ${icon('arrow',16)}</button>`;
    speak(ctx,body,festivalClip(reply,personId));
    body.querySelector('#festival-done').onclick=()=>{ctx.ui.armClose(then);ctx.ui.close();};
  });
  return true;
}

/** The noticeboard by the fountain (`about`) and the lantern riddles (`riddle:<n>`). */
export function openFestival(ctx,what){
  const festival=festivalOf(ctx.profile);
  if(!festival)return;
  if(what==='about'){
    const body=ctx.ui.open('dialogue',festival.zh,`${ui.festival.zh} · ${festival.en}`),key='about-'+festival.id;
    body.innerHTML=`${line(ctx,data.lines[key])}${audioRow}<button class="primary wide" id="festival-done">${esc(social.ui.continue)} ${icon('arrow',16)}</button>`;
    speak(ctx,body,festivalClip(key));
    body.querySelector('#festival-done').onclick=()=>ctx.ui.close();
    return;
  }
  const riddle=RIDDLES.find(r=>'riddle:'+r.n===what);
  if(!riddle||festival.id!=='yuanxiao')return;
  const body=ctx.ui.open('dialogue',ui.riddle.zh,ui.riddle.en);
  body.innerHTML=`${line(ctx,riddle)}${audioRow}
    <div class="eyebrow">${esc(ui.guess.zh)} <small>${pinyinWith(ui.guess.pinyin,ui.guess.zh,ui.guess.en)}</small></div>
    ${choices(riddleChoices(riddle).map(c=>({key:c,zh:c})),'guess')}<div id="festival-feedback" aria-live="polite"></div>`;
  speak(ctx,body,festivalClip('riddle-'+riddle.n));
  pick(body,'guess',riddle.answer,()=>{
    body.querySelectorAll('[data-guess]').forEach(b=>{b.disabled=true;if(b.dataset.guess===riddle.answer)b.classList.add('correct');});
    const coins=festivalPay(ctx.profile,'riddle-'+riddle.n,data.riddleCoins);
    if(coins){bump(ctx.profile,'riddles');ctx.music?.cue('reward');}
    ctx.save();
    body.querySelector('#festival-feedback').innerHTML=`<div class="feedback success"><div><b>${esc(riddle.parts)}</b>${coins?`<small>+${coins} 学习币</small>`:''}</div>
      <button class="primary" id="festival-done">${esc(social.ui.continue)}</button></div>`;
    body.querySelector('#festival-done').onclick=()=>ctx.ui.close();
  });
}
