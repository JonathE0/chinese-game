import vocab from '../content/vocabulary.json' with {type:'json'};
import balance from '../content/balance.json' with {type:'json'};
import {reviewWord,familiarity} from '../core/review.js';
import {grant} from '../core/economy.js';
import {matchAnswer} from '../core/language.js';
import {languageLine} from './shell.js';
import {itemArt,icon} from './art.js';

const shuffle=arr=>arr.map(value=>({value,sort:Math.random()})).sort((a,b)=>a.sort-b.sort).map(x=>x.value);
export function openPractice(ctx,mode='recognition'){
 const body=ctx.ui.open('practice',mode==='production'?'看图说词':'找一找','练习角 · 小美');
 const queue=[...vocab].sort((a,b)=>{const rank=w=>{const r=ctx.profile.words[w.id]?.[mode];return !r?1:r.due<=Date.now()?0:2;};return rank(a)-rank(b);});let index=0,totalCoins=0,missed=false;
 body.innerHTML=`<p class="panel-intro">先认识这些词，再试着找出它们。</p><div class="learn-grid">${vocab.map(w=>`<div class="learn-card">${itemArt(w.visual)}${languageLine(w,ctx.profile.settings)}<button class="subtle word-audio" data-audio="${w.audio}" aria-label="重听${w.zh}">${icon('sound',15)}</button></div>`).join('')}</div><div class="gentle-note">${icon('leaf',17)} 不计时。答错也没关系。</div><button class="primary wide" id="begin-practice">开始练习 ${icon('arrow')}</button>`;
 body.querySelectorAll('[data-audio]').forEach(b=>b.onclick=()=>ctx.voice.play(b.dataset.audio));body.querySelector('#begin-practice').onclick=render;
 function render(){
  const word=queue[index];let answered=false;missed=false;ctx.hinted=false;
  const options=shuffle(vocab);const isProduction=mode==='production';
  body.innerHTML=`<div class="practice-heading"><span class="eyebrow">${isProduction?'说出你看到的':'找到对应的物品'}</span><span class="step-label">${index+1} / ${queue.length}</span></div><div class="step-track">${queue.map((_,i)=>`<i class="${i<=index?'active':''}"></i>`).join('')}</div>${isProduction?`<div class="production-art">${itemArt(word.visual)}</div>`:`<div id="practice-word" data-word="${word.id}">${languageLine(word,ctx.profile.settings,{className:'practice-word'})}</div>`}${isProduction?'<form id="word-form"><div class="answer-row"><input id="word-answer" aria-label="物品名称" placeholder="这是什么？" maxlength="60"><button type="button" id="word-mic" class="mic-button" aria-label="麦克风回答">'+icon('mic')+'</button><button class="primary compact" aria-label="提交回答">'+icon('arrow')+'</button></div><p id="word-speech-status" class="microcopy"></p></form>':`<div class="object-grid">${options.map(w=>`<button class="object-card" data-item="${w.id}" aria-label="${w.en} illustration">${itemArt(w.visual)}<span class="object-choice-dot"></span></button>`).join('')}</div>`}<div id="practice-feedback" aria-live="polite"></div><p class="microcopy practice-hint">${isProduction?'说出或输入名称。语音文字可先检查。':'用中文认识身边的小东西。'} ${isProduction?'':'今天再见，下次也记得。'}</p>`;
  function answer(correct,button){
   if(answered)return;
   const feedback=body.querySelector('#practice-feedback');
   if(!correct){missed=true;reviewWord(ctx.profile,word.id,mode,{correct:false,hinted:ctx.hinted});ctx.save();feedback.className='feedback gentle';feedback.textContent='再看看，慢慢来。';button?.classList.add('incorrect');return;}
   answered=true;ctx.speech.stop();const result=reviewWord(ctx.profile,word.id,mode,{correct:true,hinted:ctx.hinted||missed});totalCoins+=result.coins;ctx.save();button?.classList.add('correct');body.querySelectorAll('[data-item]').forEach(b=>b.disabled=true);
   feedback.className='feedback success';feedback.innerHTML=`<div><b>对了！${word.zh}</b><small>${result.coins?`+${result.coins} 学习币`:result.practiceOnly?'巩固练习 · 到期复习时再计入熟悉度':'继续保持'}</small></div><button class="primary" id="next-word">${index===queue.length-1?'完成练习':'下一个'} ${icon('arrow',16)}</button>`;
   body.querySelector('#next-word').onclick=()=>{index++;if(index<queue.length)render();else finish();};
  }
  if(isProduction){body.querySelector('#word-form').onsubmit=e=>{e.preventDefault();answer(matchAnswer(body.querySelector('#word-answer').value,{accepted:word.accepted}).ok);};body.querySelector('#word-mic').onclick=()=>ctx.speech.start({onTranscript:t=>body.querySelector('#word-answer').value=t,onStatus:t=>body.querySelector('#word-speech-status').textContent=t});}
  else body.querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>answer(b.dataset.item===word.id,b));
 }
 function finish(){
  const bonus=grant(ctx.profile,'practice:first',balance.practiceCompletionCoins);totalCoins+=bonus;if(!ctx.profile.completed.includes('practice:first'))ctx.profile.completed.push('practice:first');ctx.save();
  body.innerHTML=`<div class="completion"><div class="completion-seal">学</div><div class="eyebrow">ONE LITTLE STEP FORWARD</div><h3>练习完成！</h3><p>四个词，四个新的小发现。</p><div class="reward">${icon('coin')} +${totalCoins} 学习币</div><p class="microcopy">到期的词会再次出现。重复练习不会重复领取奖励。</p><div class="completion-actions"><button class="primary" id="finish-practice">回到小镇 ${icon('arrow')}</button><button class="secondary" id="try-production">试试说出名称</button></div></div>`;
  body.querySelector('#finish-practice').onclick=()=>ctx.ui.close();body.querySelector('#try-production').onclick=()=>openPractice(ctx,'production');
 }
}
