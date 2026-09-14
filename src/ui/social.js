import social from '../content/lessons/npc-smalltalk.json' with {type:'json'};
import npcs from '../content/npcs.json' with {type:'json'};
import {chooseSmalltalk} from '../core/social.js';
import {evaluateNode,choicesFor} from '../core/conversation.js';
import {escapeHtml as esc} from '../core/language.js';
import {languageLine} from './shell.js';
import {icon} from './art.js';
import {CITY} from '../world/city.js';

const people={...Object.fromEntries(npcs.map(n=>[n.id,n])),...Object.fromEntries(CITY.people.map(n=>[n.id,n])),...social.people};

/** A voluntary interaction always begins with hello. Street neighbors occasionally continue
 * into optional stretch practice built from words the player has already learned. */
export function openNpcGreeting(ctx,personId,onContinue=()=>{}){
 const lookup=personId==='mei-first'?'mei':personId;
 const person=people[lookup]??social.people['friend-a'];
 const key=social.extraLines[personId]?personId:'default',greeting=social.extraLines[key];
 const runtime=ctx.social??=(ctx.social={});
 const topic=personId.startsWith('friend-')
   ?chooseSmalltalk(ctx.profile,social.topics,runtime,performance.now()/1000)
   :null;
 const body=ctx.ui.open('dialogue',person.zh,`${person.pinyin??''} · ${person.en??''}`);
 const header=()=>`<div class="dialogue-top"><div class="portrait" style="background:${esc(person.color??'#90a982')};color:#fff5da">${esc(person.zh.slice(0,1))}</div><div><b>${esc(person.zh)}</b><small>${esc(social.ui.street)}</small></div></div>`;
 const audio=line=>`<div class="audio-row"><button class="subtle" id="social-replay">${icon('sound',16)} 重听</button><button class="subtle" id="social-slow">慢速</button><small class="audio-source">${ctx.voice.sourceLabel(line.audio)}</small></div>`;
 const bindAudio=line=>{
  body.querySelector('#social-replay').onclick=()=>ctx.voice.play(line.audio);
  body.querySelector('#social-slow').onclick=()=>ctx.voice.play(line.audio,{slow:true});
  if(ctx.voice.available(line.audio))ctx.voice.play(line.audio);
 };
 const proceed=()=>{ctx.ui.armClose(onContinue);ctx.ui.close();};
 const skip=`<button class="secondary" id="social-skip">${esc(social.ui.skip)} <small>${esc(social.ui.skipEn)}</small></button>`;
 function showGreeting(){
  body.innerHTML=`${header()}${languageLine(greeting,ctx.profile.settings,{className:'dialogue-line'})}${audio(greeting)}<div class="button-row"><button class="primary" id="social-continue">${esc(social.ui.continue)} ${icon('arrow',16)}</button>${topic?skip:''}</div>`;
  bindAudio(greeting);body.querySelector('#social-continue').onclick=()=>topic?showQuestion():proceed();
  body.querySelector('#social-skip')?.addEventListener('click',proceed);
 }
 function showQuestion(){
  const line=social.extraLines[topic.prompt];ctx.hinted=false;
  body.innerHTML=`${header()}<div class="eyebrow">${esc(social.ui.practice)}</div>${languageLine(line,ctx.profile.settings,{className:'dialogue-line'})}${audio(line)}
   <form id="social-answer"><label for="social-input">你说</label><div class="answer-row"><input id="social-input" maxlength="100" autocomplete="off" placeholder="输入中文…"><button type="button" id="social-mic" class="mic-button" aria-label="麦克风回答">${icon('mic')}</button><button class="primary compact" aria-label="提交回答">${icon('arrow')}</button></div></form>
   <p id="social-speech" class="microcopy" aria-live="polite">${ctx.speech.supported?'可以说，也可以打字。':'可以打字或选择一个回答。'}</p>
   <details class="answer-options"><summary>需要一个例子？</summary><div>${choicesFor(line).map(c=>`<button type="button" class="choice" data-answer="${esc(c)}">${esc(c)}</button>`).join('')}</div></details><div id="social-feedback" aria-live="polite"></div>${skip}`;
  bindAudio(line);body.querySelector('#social-skip').onclick=proceed;
  body.querySelector('#social-mic').onclick=()=>ctx.speech.start({onTranscript:t=>body.querySelector('#social-input').value=t,onStatus:t=>body.querySelector('#social-speech').textContent=t});
  body.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{body.querySelector('#social-input').value=b.dataset.answer;submit();});
  body.querySelector('#social-answer').onsubmit=e=>{e.preventDefault();submit();};
  function submit(){
   const result=evaluateNode(line,body.querySelector('#social-input').value),feedback=body.querySelector('#social-feedback');
   if(!result.ok){feedback.className='feedback gentle';feedback.textContent='我还没听懂。换个说法，或看看例子？';return;}
   ctx.speech.stop();showReply();
  }
 }
 function showReply(){
  const line=social.extraLines[topic.reply];
  body.innerHTML=`${header()}${languageLine(line,ctx.profile.settings,{className:'dialogue-line'})}${audio(line)}<button class="primary wide" id="social-done">${esc(social.ui.continue)} ${icon('arrow',16)}</button>`;
  bindAudio(line);body.querySelector('#social-done').onclick=proceed;
 }
 showGreeting();
}
