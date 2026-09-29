import {dailyPractice,dailyPracticeWords,answerDailyWord} from '../core/daily-practice.js';
import copy from '../content/practice.json' with {type:'json'};
import {matchAnswer,escapeHtml as esc} from '../core/language.js';
import {reviewWord,confusableDeck} from '../core/review.js';
import {addMiss} from '../core/learning.js';
import {loadWords} from '../services/hsk-data.js';
import confusables from '../content/confusables.json' with {type:'json'};
import world from '../content/world.json' with {type:'json'};
import rooms from '../content/rooms.json' with {type:'json'};
import city from '../content/city.json' with {type:'json'};
import {languageLine,pinyinHtml} from './shell.js';
import {keyLabel} from '../core/keys.js';
import {itemArt,icon} from './art.js';

const shuffle=arr=>arr.map(value=>({value,sort:Math.random()})).sort((a,b)=>a.sort-b.sort).map(x=>x.value);
export function openPractice(ctx,mode='recognition'){
 const body=ctx.ui.open('practice',mode==='production'?'看图说词':'找一找','练习角 · 小美');
 const session=dailyPractice(ctx.profile);ctx.save();const vocab=dailyPracticeWords(session);
 const queue=[...vocab];let index=0,totalCoins=0,missed=false;
 body.innerHTML=`<p class="panel-intro">先认识这些词，再试着找出它们。</p><p class="microcopy">${copy.dailyIntro}</p><div class="learn-grid">${vocab.map(w=>`<div class="learn-card">${itemArt(w.visual)}${languageLine(w,ctx.profile.settings)}<button class="subtle word-audio" data-audio="${w.audio}" aria-label="重听${w.zh}">${icon('sound',15)}</button></div>`).join('')}</div><div class="gentle-note">${icon('leaf',17)} 不计时。答错也没关系。</div><button class="primary wide" id="begin-practice">开始练习 ${icon('arrow')}</button>`;
 body.querySelectorAll('[data-audio]').forEach(b=>b.onclick=()=>ctx.voice.play(b.dataset.audio));body.querySelector('#begin-practice').onclick=render;
 function render(){
  const word=queue[index];let answered=false;missed=false;ctx.hinted=false;
  const options=shuffle(vocab);const isProduction=mode==='production';
  body.innerHTML=`<div class="practice-heading"><span class="eyebrow">${isProduction?'说出你看到的':'找到对应的物品'}</span><span class="step-label">${index+1} / ${queue.length}</span></div><div class="step-track">${queue.map((_,i)=>`<i class="${i<=index?'active':''}"></i>`).join('')}</div>${isProduction?`<div class="production-art">${itemArt(word.visual)}</div>`:`<div id="practice-word" data-word="${word.id}">${languageLine(word,ctx.profile.settings,{className:'practice-word'})}</div>`}${isProduction?'<form id="word-form"><div class="answer-row"><input id="word-answer" aria-label="物品名称" placeholder="这是什么？" maxlength="60"><button type="button" id="word-mic" class="mic-button" aria-label="麦克风回答">'+icon('mic')+'</button><button class="primary compact" aria-label="提交回答">'+icon('arrow')+'</button></div><p id="word-speech-status" class="microcopy"></p></form>':`<div class="object-grid">${options.map(w=>`<button class="object-card" data-item="${w.id}" aria-label="${w.en} illustration">${itemArt(w.visual)}<span class="object-choice-dot"></span></button>`).join('')}</div>`}<div id="practice-feedback" aria-live="polite"></div><p class="microcopy practice-hint">${isProduction?'说出或输入名称。语音文字可先检查。':'用中文认识身边的小东西。'} ${isProduction?'':'今天再见，下次也记得。'}</p>`;
  function answer(correct,button){
   if(answered)return;
   const feedback=body.querySelector('#practice-feedback');
   if(!correct){missed=true;answerDailyWord(ctx.profile,session,word.id,mode,{correct:false,hinted:ctx.hinted});ctx.save();feedback.className='feedback gentle';feedback.textContent='再看看，慢慢来。';button?.classList.add('incorrect');return;}
   answered=true;ctx.speech.stop();const result=answerDailyWord(ctx.profile,session,word.id,mode,{correct:true,hinted:ctx.hinted||missed});totalCoins+=result.coins;ctx.save();button?.classList.add('correct');body.querySelectorAll('[data-item]').forEach(b=>b.disabled=true);
   feedback.className='feedback success';feedback.innerHTML=`<div><b>对了！${word.zh}</b><small>${result.coins?`+${result.coins} 学习币`:result.practiceOnly?'巩固练习 · 到期复习时再计入熟悉度':'继续保持'}</small></div><button class="primary" id="next-word">${index===queue.length-1?'完成练习':'下一个'} ${icon('arrow',16)}</button>`;
   body.querySelector('#next-word').onclick=()=>{index++;if(index<queue.length)render();else finish();};
  }
  if(isProduction){body.querySelector('#word-form').onsubmit=e=>{e.preventDefault();answer(matchAnswer(body.querySelector('#word-answer').value,{accepted:word.accepted}).ok);};body.querySelector('#word-mic').onclick=()=>ctx.speech.start({onTranscript:t=>body.querySelector('#word-answer').value=t,onStatus:t=>body.querySelector('#word-speech-status').textContent=t});}
  else body.querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>answer(b.dataset.item===word.id,b));
 }
 function finish(){
  if(!ctx.profile.completed.includes('practice:first'))ctx.profile.completed.push('practice:first');ctx.save();
  body.innerHTML=`<div class="completion"><div class="completion-seal">学</div><div class="eyebrow">ONE LITTLE STEP FORWARD</div><h3>练习完成！</h3><p>四个词，四个新的小发现。</p><div class="reward">${icon('coin')} +${totalCoins} 学习币</div><p class="microcopy">${copy.dailyCompletion}</p><div class="completion-actions"><button class="primary" id="finish-practice">回到小镇 ${icon('arrow')}</button><button class="secondary" id="try-production">试试说出名称</button></div></div>`;
  body.querySelector('#finish-practice').onclick=()=>ctx.ui.close();body.querySelector('#try-production').onclick=()=>openPractice(ctx,'production');
 }
}

const districtAt=(x,z)=>world.districts.find(d=>x>=d.bounds.x[0]&&x<=d.bounds.x[1]&&z>=d.bounds.z[0]&&z<=d.bounds.z[1]);
/** Where a recorded source is, for 在「X」见过 and its map pin: a town spot names its district, a
 *  room pins its door in town, and the city (or a shop in it) pins the metro stair, as the buy
 *  guide does. Null when the place no longer exists. */
export function sourceSpot(source){
  const metro=()=>{const x=city.station.x,z=city.station.z-3;return {key:'metro-platform',district:districtAt(x,z)?.id,x,z};};
  if(source.place==='town'){const d=districtAt(source.x,source.z);return d&&{key:'seen',district:d.id,x:source.x,z:source.z,zh:d.zh};}
  if(source.place==='city')return {...metro(),zh:city.place.zh};
  const room=rooms[source.place];
  if(!room)return null;
  if(String(room.building).startsWith('city:'))return {...metro(),zh:room.zh};
  const building=world.buildings.find(b=>b.id===room.building);
  return building&&room.door&&{key:source.place,district:building.district,x:room.door.x,z:room.door.z,zh:room.zh};
}
/** 在「X」见过 with a 去找找 button, for any review card; empty when the word has no source. */
export function seenAt(ctx,zh){
  const source=ctx.profile.learning?.sources?.[zh],spot=source&&sourceSpot(source);
  if(!spot)return '';
  const {ui}=confusables;
  return `<p class="microcopy seen-at">${esc(ui.seenAt.replace('X',spot.zh))} <button class="secondary compact" data-seen="${esc(zh)}" title="${esc(ui.findEn)}">${esc(ui.find)}</button></p>`;
}
/** 去找找 closes the review and leads the way there on the minimap, like the buy guide's 带路. */
export function wireSeenAt(ctx,root){
  root.querySelectorAll('[data-seen]').forEach(b=>b.onclick=()=>{
    const spot=sourceSpot(ctx.profile.learning.sources[b.dataset.seen]);
    ctx.ui.close();
    ctx.ui.showWay({key:spot.key,district:spot.district,x:spot.x,z:spot.z,label:spot.zh});
  });
}

/** 易混词: look-alike and sound-alike groups the player has met, most-missed first. HSK members
 *  go through the normal review (and pay as usual); the rest only count misses. */
export async function openConfusables(ctx){
  const {ui,prompts}=confusables;
  const body=ctx.ui.open('practice',ui.title,ui.titleEn.toUpperCase());
  const hsk=new Map((await loadWords().catch(()=>[])).map(w=>[w.zh,w]));
  const deck=confusableDeck(ctx.profile,confusables.groups,zh=>hsk.get(zh)?.id).slice(0,8);
  if(!deck.length){body.innerHTML=`<p class="panel-intro">再收集几个词就可以复习了。走在城里看着东西按 <kbd>${keyLabel('collect')}</kbd>，或者在任何中文上划选。<br>Collect a few more words first — press ${keyLabel('collect')} while looking at things, or highlight any Chinese.</p>`;return;}
  let index=0,right=0,earned=0;
  const clipOf=m=>m.audio??hsk.get(m.zh)?.audio;
  const step=()=>{
    if(index>=deck.length)return finish();
    const group=deck[index],prompt=prompts[group.kind],look=group.kind==='look';
    // Exact homophones (在/再) can't be told apart by ear: show the meaning too and check recognition.
    const meaning=look||group.members.every(m=>m.pinyin===group.members[0].pinyin);
    const target=group.members[Math.floor(Math.random()*group.members.length)];
    const play=()=>look?ctx.voice.play(prompt.audio):clipOf(target)&&ctx.voice.play(clipOf(target));
    body.innerHTML=`<div class="drill-head"><span class="step-label">${index+1} / ${deck.length}</span><span class="drill-mode">${esc(ui.title)}</span></div>
      <div class="step-track">${deck.map((_,i)=>`<i class="${i<=index?'active':''}"></i>`).join('')}</div>
      <div class="drill-prompt">${languageLine(prompt,ctx.profile.settings)}
        ${meaning?`<div class="drill-zh">${esc(target.en)}</div>`:''}
        <button class="subtle drill-play" id="conf-play" aria-label="重听">${icon('sound',16)}</button></div>
      <div class="drill-options">${shuffle(group.members).map(m=>`<button class="choice drill-choice" data-pick="${esc(m.zh)}">${esc(m.zh)}</button>`).join('')}</div>
      <div id="drill-feedback" aria-live="polite"></div>`;
    body.querySelector('#conf-play').onclick=play;play();
    body.querySelectorAll('[data-pick]').forEach(button=>button.onclick=()=>{
      body.querySelectorAll('[data-pick]').forEach(b=>{b.disabled=true;if(b.dataset.pick===target.zh)b.classList.add('correct');});
      const correct=button.dataset.pick===target.zh,word=hsk.get(target.zh);
      if(!correct)button.classList.add('wrong');
      const result=word?reviewWord(ctx.profile,word.id,meaning?'recognition':'listening',{correct,hinted:false,zh:target.zh}):null;
      if(!word&&!correct)addMiss(ctx.profile,target.zh);
      earned+=result?.coins??0;if(correct)right++;
      ctx.save();
      if(clipOf(target))ctx.voice.play(clipOf(target));
      body.querySelector('#drill-feedback').innerHTML=`<div class="feedback ${correct?'success':'gentle'}">
        <div>${correct?'对了！':'再看一眼。'} <b>${esc(target.zh)}</b> · ${pinyinHtml(target.pinyin,target.zh,{always:true})} · ${esc(target.en)}
        ${result?.coins?`<small>+${result.coins} 学习币</small>`:result?.practiceOnly?'<small>还没到复习时间，这次不计入进度。</small>':''}
        ${seenAt(ctx,target.zh)}</div>
        <button class="primary" id="drill-next">${index===deck.length-1?'完成':'下一个'}</button></div>`;
      wireSeenAt(ctx,body);
      body.querySelector('#drill-next').onclick=()=>{index++;step();};
    });
  };
  const finish=()=>{
    body.innerHTML=`<div class="completion"><div class="completion-seal">学</div><h3>复习完成！</h3>
      <p>答对 ${right} / ${deck.length}${earned?` · 获得 ${earned} 学习币`:''}</p>
      <div class="completion-actions"><button class="primary" id="again">再来一组</button><button class="secondary" id="finish-practice">回到小镇 ${icon('arrow')}</button></div></div>`;
    body.querySelector('#again').onclick=()=>openConfusables(ctx);
    body.querySelector('#finish-practice').onclick=()=>ctx.ui.close();
  };
  step();
}
