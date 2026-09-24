import {escapeHtml as esc} from '../core/language.js';
import {languageLine,pinyinHtml} from './shell.js';
import {icon} from './art.js';
import {familiarity,reviewWord,cardCoins,pickReviewWords} from '../core/review.js';
import {dueWords} from '../core/bank.js';
import {openGames} from './games.js';
import {definitions} from './definitions.js';
import {openConfusables,seenAt,wireSeenAt} from './practice.js';
import confusables from '../content/confusables.json' with {type:'json'};

const statusNames={new:'初见',learning:'学习中',familiar:'熟悉',due:'待复习'};
const SESSION=8;
const shuffle=list=>list.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(([,v])=>v);

/** Everything you have picked up around town, ready to review: from the top bar anywhere, or at
 *  the study desk at home (`venue:'desk'`), which pays better for the trip home. */
export function openBank(ctx,{venue=null}={}){
  const body=ctx.ui.open('wordbank','生词本',venue==='desk'?'在家复习 · STUDY DESK':'随身复习 · YOUR WORD BANK');
  list(ctx,body,venue);
}

/** What a right answer pays here, and where it pays more. */
function rateNote(venue){
  const here=cardCoins(venue,false),desk=cardCoins('desk',false),hall=cardCoins('hall',true);
  return venue==='desk'
    ?`在书桌前复习，每答对一张 +${here} 学习币。<br>At your desk, every right answer pays ${here} coins.`
    :`随身复习每答对一张 +${here}。回家在书桌前 +${desk}，去词语馆学新词每个 +${hall}。<br>
      On the go a card pays ${here} — ${desk} at your desk at home, ${hall} for each new word at the word hall.`;
}

function list(ctx,body,venue=null){
  const words=ctx.profile.saved??[];
  const due=dueWords(ctx.profile);
  const fresh=words.filter(w=>!ctx.profile.words[w.id]?.recognition);
  body.innerHTML=`
    <div class="bank-summary">
      <div><b>${words.length}</b><span>收集</span></div>
      <div><b>${due.length}</b><span>待复习</span></div>
      <div><b>${words.filter(w=>familiarity(ctx.profile.words[w.id]?.recognition)==='familiar').length}</b><span>熟悉</span></div>
    </div>
    ${words.length<4
      ? `<p class="panel-intro">再收集几个词就可以复习了。走在城里看着东西按 <kbd>F</kbd>，或者在任何中文上划选。<br>Collect a few more words first — press F while looking at things, or highlight any Chinese.</p>`
      : `<button class="primary wide" id="bank-review">复习 ${Math.min(SESSION,due.length+fresh.length)} 个词 ${icon('arrow',15)}</button>
         <p class="microcopy">优先复习到期的词，再加上还没练过的。</p>`}
    <p class="microcopy bank-rate">${rateNote(venue)}</p>
    <button class="secondary wide" id="bank-games">小游戏 · 用这些词玩一玩</button>
    <button class="secondary wide" id="bank-confusables">${confusables.ui.title} · ${confusables.ui.titleEn}</button>
    <div class="bank-list">${words.length?words.map((w,i)=>{
      const record=ctx.profile.words[w.id]?.recognition;
      return `<article class="bank-row">
        <div class="bank-word">${languageLine(w,ctx.profile.settings)}${definitions(w)}</div>
        <div class="bank-actions">
          ${w.audio?`<button class="subtle" data-audio="${esc(w.audio)}" aria-label="重听${esc(w.zh)}">${icon('sound',14)}</button>`:''}
          <span class="status-badge ${familiarity(record)}">${statusNames[familiarity(record)]}</span>
          <button class="lookup-save" data-forget="${i}">移除</button>
        </div>
      </article>`;}).join(''):'<p class="microcopy">生词本还是空的。</p>'}</div>`;

  body.querySelectorAll('[data-audio]').forEach(b=>b.onclick=()=>ctx.voice.play(b.dataset.audio));
  body.querySelectorAll('[data-forget]').forEach(b=>b.onclick=()=>{
    ctx.profile.saved.splice(Number(b.dataset.forget),1);ctx.save();list(ctx,body,venue);
  });
  body.querySelector('#bank-review')?.addEventListener('click',()=>drill(ctx,body,venue));
  body.querySelector('#bank-games').onclick=()=>openGames(ctx);
  body.querySelector('#bank-confusables').onclick=()=>openConfusables(ctx);
}

function drill(ctx,body,venue=null){
  const words=ctx.profile.saved;
  const queue=pickReviewWords(ctx.profile,words,'recognition',{limit:SESSION});
  if(queue.length<1)return list(ctx,body,venue);
  let index=0,earned=0,right=0;

  const step=()=>{
    if(index>=queue.length)return finish();
    const word=queue[index];
    let hinted=false;
    const others=shuffle(words.filter(w=>w.id!==word.id&&w.en&&w.en!==word.en)).slice(0,3);
    const options=shuffle([word,...others]);
    body.innerHTML=`
      <div class="drill-head"><span class="step-label">${index+1} / ${queue.length}</span><span class="drill-mode">${venue==='desk'?'书桌 · STUDY DESK':'生词本 · YOUR WORDS'}</span></div>
      <div class="step-track">${queue.map((_,i)=>`<i class="${i<=index?'active':''}"></i>`).join('')}</div>
      <div class="drill-prompt" data-word="${esc(word.id)}">
        <div class="drill-zh">${esc(word.zh)}</div>
        ${word.audio?`<button class="subtle drill-play" id="drill-play" aria-label="听读音">${icon('sound',16)} 读音</button>`:''}
        <button class="help-toggle" id="drill-help" aria-label="显示帮助">?</button>
        <div class="help-content" id="drill-hint" hidden><div class="pinyin">${pinyinHtml(word.pinyin,word.zh,{always:true})}</div></div>
      </div>
      <div class="drill-options">${options.map(o=>`<button class="choice drill-choice" data-pick="${esc(o.id)}">${esc(o.en||o.zh)}</button>`).join('')}</div>
      <div id="drill-feedback" aria-live="polite"></div>`;

    const play=()=>word.audio&&ctx.voice.play(word.audio);
    body.querySelector('#drill-play')?.addEventListener('click',play);
    play();
    body.querySelector('#drill-help').onclick=()=>{
      const hint=body.querySelector('#drill-hint');
      hint.hidden=!hint.hidden;
      if(!hint.hidden)hinted=true;
    };
    body.querySelectorAll('[data-pick]').forEach(button=>button.onclick=()=>{
      body.querySelectorAll('[data-pick]').forEach(b=>{b.disabled=true;if(b.dataset.pick===word.id)b.classList.add('correct');});
      const correct=button.dataset.pick===word.id;
      if(!correct)button.classList.add('wrong');
      const {coins,practiceOnly}=reviewWord(ctx.profile,word.id,'recognition',{correct,hinted,venue});
      earned+=coins;if(correct)right++;
      ctx.save();
      body.querySelector('#drill-feedback').innerHTML=`<div class="feedback ${correct?'success':'gentle'}">
        <div>${correct?'对了！':'再看一眼。'} <b>${esc(word.zh)}</b> · ${pinyinHtml(word.pinyin,word.zh,{always:true})} · ${esc(word.en)}
        <small>${practiceOnly?'还没到复习时间，这次不计入进度。':coins?`+${coins} 学习币`:'已记录，未获得学习币。'}</small>${seenAt(ctx,word.zh)}</div>
        <button class="primary" id="drill-next">${index===queue.length-1?'完成':'下一个'}</button></div>`;
      wireSeenAt(ctx,body);
      body.querySelector('#drill-next').onclick=()=>{index++;step();};
    });
  };

  const finish=()=>{
    body.innerHTML=`<div class="completion"><div class="completion-seal">本</div>
      <h3>复习完成！</h3>
      <p>答对 ${right} / ${queue.length}${earned?` · 获得 ${earned} 学习币`:''}</p>
      <p class="microcopy">到期的词会自动排进下一次复习。</p>
      <div class="completion-actions"><button class="primary" id="again">再来一组</button><button class="secondary" id="back">回到生词本</button></div></div>`;
    body.querySelector('#again').onclick=()=>drill(ctx,body,venue);
    body.querySelector('#back').onclick=()=>list(ctx,body,venue);
  };
  step();
}
