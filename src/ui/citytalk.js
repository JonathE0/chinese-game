import {escapeHtml as esc} from '../core/language.js';
import {icon} from './art.js';
import {languageLine} from './shell.js';
import {CITY} from '../world/city.js';
import {addWord} from '../core/bank.js';
import {metroOf} from '../core/metro.js';
import {openDialogue} from './dialogue.js';

/**
 * Passing conversation on a city street.
 *
 * Nobody here is a teacher and nobody is running a lesson. They say one thing, the way a
 * stranger does, and what they say changes with the day and with how often you have come — so
 * the fourth visit is not the first visit again. Each line carries a usage note, and the line
 * itself can be saved to the word bank, which is the only thing these people are for.
 */
export function openCityTalk(ctx,personId){
  const person=CITY.people.find(one=>one.id===personId);
  if(!person)return;
  const p=ctx.profile;
  // What they say moves with the day and with how many journeys you have made, so nothing new
  // has to be written into the save to keep a stranger from repeating themselves.
  const turn=(p.dayIndex??0)+metroOf(p).trips+personId.length;
  const line=person.lines[turn%person.lines.length];

  const body=ctx.ui.open('citytalk',person.zh,'路上 · IN THE STREET');
  // The student is the one person in the city who knows the way somewhere. Everyone else is
  // just passing through, with a line to keep and nothing to ask.
  const askDirections=person.id==='student'
    ?`<button class="secondary wide" id="ask-directions">${icon('map',15)} 问路 · Ask the way</button>`:'';
  body.innerHTML=`<div class="dialogue-top">
      <div class="portrait">${person.zh.slice(0,1)}</div>
      <div><b>${esc(person.zh)}</b><small>${esc(person.pinyin)} · ${esc(person.en)}</small></div>
    </div>
    ${languageLine(line,p.settings,{className:'dialogue-line'})}
    <p class="microcopy">城里的人来来去去，每次说的不一样。<br>
      People here are passing through. Come back and they will say something else.</p>
    <button class="primary wide" id="keep-line">${icon('leaf',15)} 记下这句话 · Keep this line</button>${askDirections}`;

  body.querySelector('#keep-line').onclick=()=>{
    addWord(p,{zh:line.zh,pinyin:line.pinyin,en:line.en});
    if(!p.completed.includes('city:line'))p.completed.push('city:line');
    ctx.music?.cue('collect');ctx.save();
    ctx.ui.notice('记下来了，在书桌上可以复习。 / Saved — review it at your desk.');
    body.querySelector('#keep-line').disabled=true;
  };
  if(person.id==='student')body.querySelector('#ask-directions').onclick=()=>openDialogue(ctx,'city-directions');
}
