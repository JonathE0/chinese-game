import social from '../content/lessons/npc-smalltalk.json' with {type:'json'};
import assistants from '../content/assistants.json' with {type:'json'};
import npcs from '../content/npcs.json' with {type:'json'};
import {chooseSmalltalk} from '../core/social.js';
import {evaluateNode,choicesFor} from '../core/conversation.js';
import {escapeHtml as esc} from '../core/language.js';
import {languageLine,pinyinText} from './shell.js';
import {icon,itemArt} from './art.js';
import catalog from '../content/catalog.json' with {type:'json'};
import {friends,isFriend,levelOf,friendOf,friendLine,visit,heard,chatted,giveGift,giftables,pinned} from '../core/friends.js';
import {CITY} from '../world/city.js';
import {festivalGreeting} from './festivals.js';
import {openPostcard} from './postcard.js';

const people={...Object.fromEntries(npcs.map(n=>[n.id,n])),...Object.fromEntries(CITY.people.map(n=>[n.id,n])),...social.people};

/** A voluntary interaction always begins with hello. Street neighbors occasionally continue
 * into optional stretch practice built from words the player has already learned. */
export function openNpcGreeting(ctx,personId,onContinue=()=>{}){
 // On a festival day the festival greeting comes first, once per person.
 if(festivalGreeting(ctx,personId,()=>openNpcGreeting(ctx,personId,onContinue)))return;
 const lookup=personId==='mei-first'?'mei':personId;
 const person=people[lookup]??social.people['friend-a'];
 const key=social.extraLines[personId]?personId:'default',greeting=social.extraLines[key];
 const runtime=ctx.social??=(ctx.social={});
 const topic=personId.startsWith('friend-')
   ?chooseSmalltalk(ctx.profile,social.topics,runtime,performance.now()/1000)
   :null;
 // 林阿姨, 小美 and 陈叔叔 are friends: their level shows under their name, and whatever has
 // happened since the last visit (a postcard answered, a level's lines, a present) plays first.
 const friend=isFriend(lookup)?lookup:null,met=friend?visit(ctx.profile,friend):{said:[]},beats=[...met.said];
 if(friend)ctx.save();
 const body=ctx.ui.open('dialogue',person.zh,[pinyinText(person.pinyin,person.zh),person.en].filter(Boolean).join(' · '));
 const standing=()=>{
  if(!friend)return esc(social.ui.street);
  const level=levelOf(friendOf(ctx.profile,friend).points);
  return `<span class="friend-level" title="${esc([pinyinText(level.pinyin,level.zh),level.en].filter(Boolean).join(' · '))}">${esc(level.zh)}</span>`;
 };
 const header=()=>`<div class="dialogue-top"><div class="portrait" style="background:${esc(person.color??'#90a982')};color:#fff5da">${esc(person.zh.slice(0,1))}</div><div><b>${esc(person.zh)}</b><small>${standing()}</small></div></div>`;
 const audio=line=>`<div class="audio-row"><button class="subtle" id="social-replay">${icon('sound',16)} 重听</button><button class="subtle" id="social-slow">慢速</button><small class="audio-source">${ctx.voice.sourceLabel(line.audio)}</small></div>`;
 const bindAudio=line=>{
  body.querySelector('#social-replay').onclick=()=>ctx.voice.play(line.audio);
  body.querySelector('#social-slow').onclick=()=>ctx.voice.play(line.audio,{slow:true});
  if(ctx.voice.available(line.audio))ctx.voice.play(line.audio);
 };
 const proceed=()=>{if(friend){chatted(ctx.profile,friend);ctx.save();}ctx.ui.armClose(onContinue);ctx.ui.close();};
 const next=()=>beats.length?beat(beats.shift()):topic?showQuestion():proceed();
 // A catch-up line takes effect only as it is shown: walk off first and it is still there next time.
 function beat(key){
  const item=heard(ctx.profile,friend,key),pin=friends.people[friend].pin;
  if(item){const got=catalog.find(i=>i.id===item);ctx.ui.notice(`+1 ${got.zh} · ${got.en}`);}
  if(pin&&pinned(ctx.profile,friend))ctx.town?.pinPostcard(pin);
  ctx.save();say(key,next);
 }
 function say(key,then){
  const line=friendLine(friend,key);
  body.innerHTML=`${header()}${languageLine(line,ctx.profile.settings,{className:'dialogue-line'})}${audio(line)}<button class="primary wide" id="social-done">${esc(social.ui.continue)} ${icon('arrow',16)}</button>`;
  bindAudio(line);body.querySelector('#social-done').onclick=then;
 }
 function showGifts(){
  // Asking with no item answers only when a gift was already given today.
  const again=giveGift(ctx.profile,friend,null);
  if(again)return say(again.line,next);
  body.innerHTML=`${header()}<div class="eyebrow">${esc(friends.ui.gift.zh)}</div><div class="shop-grid">${giftables(ctx.profile).map(i=>`<button class="shop-card" data-gift="${esc(i.id)}">${itemArt(i.visual)}<b>${esc(i.zh)}</b><small>× ${ctx.profile.inventory[i.id]}</small></button>`).join('')}</div><button class="secondary wide" id="social-back">返回</button>`;
  body.querySelectorAll('[data-gift]').forEach(b=>b.onclick=()=>{
   const given=giveGift(ctx.profile,friend,b.dataset.gift);
   if(!given)return;
   ctx.save();say(given.line,next);
  });
  body.querySelector('#social-back').onclick=showGreeting;
 }
 const skip=`<button class="secondary" id="social-skip">${esc(social.ui.skip)} <small>${esc(social.ui.skipEn)}</small></button>`;
 function showGreeting(){
  const gift=friend&&giftables(ctx.profile).length?`<button class="secondary" id="social-gift">${esc(friends.ui.gift.zh)} <small>${esc(friends.ui.gift.en)}</small></button>`:'';
  body.innerHTML=`${header()}${languageLine(greeting,ctx.profile.settings,{className:'dialogue-line'})}${audio(greeting)}<div class="button-row"><button class="primary" id="social-continue">${esc(social.ui.continue)} ${icon('arrow',16)}</button>${gift}${topic?skip:''}</div>`;
  bindAudio(greeting);body.querySelector('#social-continue').onclick=next;
  body.querySelector('#social-gift')?.addEventListener('click',showGifts);
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

/** A shop assistant says hello, offers help, and says a line about the shop; then you browse the
 * goods, write a postcard (where the shop sends them) or say goodbye. `browse` opens the shop's own
 * panel, so a shop with nothing on sale gets no browse button; `sells`: it is a till, so the assistant
 * says where to pay (a bank or library panel is not). `led`: the buy guide brought you here for
 * something this shop sells, so the assistant asks what you are looking for. */
export function openAssistant(ctx,member,roomId,{browse,sells,led}={}){
 const {lines,ui}=assistants,settings=ctx.profile.settings;
 const body=ctx.ui.open('dialogue',member.zh,[pinyinText(member.pinyin,member.zh),member.en].filter(Boolean).join(' · '));
 const header=`<div class="dialogue-top"><div class="portrait" style="background:${esc(member.color??'#90a982')};color:#fff5da">${esc(member.zh.slice(0,1))}</div><div><b>${esc(member.zh)}</b></div></div>`;
 const button=(id,label,cls)=>`<button class="${cls}" id="${id}">${esc(label.zh)} <small>${esc(label.en)}</small></button>`;
 // Closing a panel stops the voice, so a parting line is spoken (and shown) once the panel is gone.
 const leave=(key,then)=>{
  ctx.ui.armClose(()=>{
   then?.();
   if(!key)return;
   const line=lines[key];
   ctx.ui.notice(settings.english===false?line.zh:`${line.zh} / ${line.en}`);
   if(ctx.voice.available('assistant-'+key))ctx.voice.play('assistant-'+key);
  });
  ctx.ui.close();
 };
 // A page shows one or more lines and plays them one after the other.
 function say(keys,buttons){
  const clips=keys.map(key=>'assistant-'+key);
  body.innerHTML=`${header}${keys.map(key=>languageLine(lines[key],settings,{className:'dialogue-line'})).join('')}<div class="audio-row"><button class="subtle" id="assistant-replay">${icon('sound',16)} 重听</button><button class="subtle" id="assistant-slow">慢速</button><small class="audio-source">${ctx.voice.sourceLabel(clips[0])}</small></div><div class="button-row">${buttons}</div>`;
  body.querySelector('#assistant-replay').onclick=()=>playInTurn(ctx,clips);
  body.querySelector('#assistant-slow').onclick=()=>playInTurn(ctx,clips,{slow:true});
  playInTurn(ctx,clips);
  body.querySelector('.button-row button')?.focus();   // keyboard players keep their place
 }
 // Hello and an offer of help first, then the shop's own line with the buttons.
 // An assistant may have lines of their own (`line`: keys in assistants.json) in place of the shop's;
 // one with nothing to sell says just those (the mall's information desk).
 const own=[].concat(member.line??'shop-'+roomId).filter(key=>lines[key]);
 const pages=member.line&&!browse?[own]:[['greet',led?'find':'browse'],...(own.length?[own]:[])];
 const writes=(assistants.postcard??[]).includes(roomId);
 function step(i){
  if(i<pages.length-1){
   say(pages[i],`<button class="primary" id="assistant-next">${esc(social.ui.continue)} ${icon('arrow',16)}</button>`);
   body.querySelector('#assistant-next').onclick=()=>step(i+1);
   return;
  }
  say(pages[i],(browse?button('assistant-browse',ui.browse,'primary'):'')+(writes?button('assistant-postcard',friends.ui.write,'primary'):'')+button('assistant-bye',ui.bye,'secondary'));
  body.querySelector('#assistant-browse')?.addEventListener('click',()=>leave(sells?'pay':null,browse));
  body.querySelector('#assistant-postcard')?.addEventListener('click',()=>leave(null,()=>openPostcard(ctx)));
  body.querySelector('#assistant-bye').onclick=()=>leave('bye');
 }
 step(0);
}

/** Play clips one after another. Another clip starting, the panel closing, or a clip that fails to
 * load or play ends the run. */
async function playInTurn(ctx,clips,options){
 for(const clip of clips){
  if(!ctx.voice.available(clip))continue;
  // Take this clip's audio before awaiting, or a newer page's clip could be mistaken for it.
  const started=ctx.voice.play(clip,options),audio=ctx.voice.foreground;
  await started;
  if(!audio)return;
  // Still playing: wait for its end ('pause' fires then too), a stop, or a load or decode error.
  if(!audio.paused)await new Promise(done=>{for(const event of ['pause','error'])audio.addEventListener(event,done,{once:true});});
  if(ctx.voice.foreground!==audio)return;
 }
}
