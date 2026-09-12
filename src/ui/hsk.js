import {meta,loadWords} from '../services/hsk-data.js';
import {languageLine} from './shell.js';
import {icon} from './art.js';
import {escapeHtml as esc} from '../core/language.js';
import {familiarity,reviewWord,cardCoins} from '../core/review.js';
import {addWord} from '../core/bank.js';
import {openGames} from './games.js';
import {definitions} from './definitions.js';

const statusNames={new:'初见',learning:'学习中',familiar:'熟悉',due:'待复习'};
const LIST_LIMIT=60;
const SESSION=10;
let words=null;

const shuffle=list=>list.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(([,v])=>v);
const levelWords=level=>words.filter(w=>w.level===level);

export async function openHsk(ctx){
  const body=ctx.ui.open('hsk','词语馆','HSK 词表 · VOCABULARY HALL');
  body.innerHTML='<p class="panel-intro">正在载入词表… / Loading the word list…</p>';
  try{words=await loadWords();}
  catch(error){body.innerHTML=`<p class="panel-intro">词表无法载入。 / Word list unavailable: ${esc(error.message)}</p>`;return;}
  ctx.hskLevel??=1;
  browse(ctx,body);
}

function browse(ctx,body,query=''){
  const level=ctx.hskLevel,all=levelWords(level);
  const needle=query.trim().toLowerCase();
  const matches=needle?all.filter(w=>w.zh.includes(needle)||w.pinyin.toLowerCase().includes(needle)||w.en.toLowerCase().includes(needle)):all;
  const shown=matches.slice(0,LIST_LIMIT);
  const saved=new Set(ctx.profile.saved.map(w=>w.zh));
  const listenable=meta.audioLevels.includes(level);

  body.innerHTML=`
  <div class="syllabus-note">
    <b>${esc(meta.syllabus.shortName)}</b>
    <p>${esc(meta.syllabus.fullName)} · ${meta.total} 词</p>
    <p class="microcopy">${meta.syllabus.validated?'已核对官方大纲。':'等级来自公开数据集，尚未逐词核对官方大纲。旧版 HSK 2.0 等级单独标注，不与 3.0 混用。'}<br>
    <a href="${esc(meta.syllabus.source)}" target="_blank" rel="noreferrer noopener">${esc(meta.syllabus.source)}</a></p>
  </div>
  <div class="level-tabs">${meta.levels.map(l=>`<button class="level-tab ${l.level===level?'active':''}" data-level="${l.level}"><b>${esc(l.zh)}</b><small>${l.count}</small></button>`).join('')}</div>
  <p class="microcopy level-caption">${esc(meta.levels.find(l=>l.level===level)?.en??'')}</p>
  <input id="hsk-search" class="hsk-search" type="search" placeholder="搜索汉字、拼音或英文…" aria-label="搜索词语" value="${esc(query)}">
  <div class="button-row hsk-modes">
    <button class="primary compact" id="hsk-review" data-mode="recognition">复习这一级 ${icon('arrow',15)}</button>
    ${listenable?'<button class="secondary" id="hsk-listen" data-mode="listening">听力练习</button>':'<span class="microcopy no-audio">这一级还没有录音</span>'}
    <button class="secondary" id="hsk-games">小游戏</button>
  </div>
  <p class="microcopy hall-rate">在这里学会一个新词 +${cardCoins('hall',true)} 学习币，复习一个 +${cardCoins('hall',false)}。<br>
    Each new word you learn here pays ${cardCoins('hall',true)} coins; a review pays ${cardCoins('hall',false)}.</p>
  <div class="hsk-list">${shown.map(w=>{
    const record=ctx.profile.words[w.id]?.recognition;
    return `<article class="hsk-row" data-word="${esc(w.id)}">
      <div class="hsk-word">${languageLine(w,ctx.profile.settings)}${w.legacyLevel?`<span class="legacy-tag">旧 HSK ${w.legacyLevel}</span>`:''}${definitions(w)}</div>
      <div class="hsk-actions">
        ${w.audio?`<button class="subtle" data-audio="${esc(w.audio)}" aria-label="重听${esc(w.zh)}">${icon('sound',14)}</button>`:''}
        <button class="lookup-save" data-save="${esc(w.id)}">${saved.has(w.zh)?'已收藏':'收藏'}</button>
        <span class="status-badge ${familiarity(record)}">${statusNames[familiarity(record)]}</span>
      </div>
    </article>`;}).join('')}</div>
  <p class="microcopy">${matches.length>LIST_LIMIT?`显示前 ${LIST_LIMIT} 个，共 ${matches.length} 个。缩小搜索范围可看到更多。`:`共 ${matches.length} 个词。`}<br>熟悉度按认读、听力、表达分别记录，不是考试成绩。</p>`;

  body.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>{ctx.hskLevel=Number(b.dataset.level);browse(ctx,body);});
  body.querySelectorAll('[data-audio]').forEach(b=>b.onclick=()=>ctx.voice.play(b.dataset.audio));
  body.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{
    const word=words.find(w=>w.id===b.dataset.save);
    if(!addWord(ctx.profile,word))return;
    ctx.save();b.textContent='已收藏';
  });
  const search=body.querySelector('#hsk-search');
  search.oninput=()=>{
    const value=search.value;
    browse(ctx,body,value);
    const next=body.querySelector('#hsk-search');
    next.focus();next.setSelectionRange(value.length,value.length);
  };
  body.querySelector('#hsk-games').onclick=()=>openGames(ctx);
  for(const id of ['#hsk-review','#hsk-listen']){
    const button=body.querySelector(id);
    if(button)button.onclick=()=>drill(ctx,body,button.dataset.mode);
  }
}

/** Due words first, then unseen ones, matching how the town practice corner chooses. */
function pickSession(ctx,level,mode){
  const now=Date.now(),pool=levelWords(level).filter(w=>mode!=='listening'||w.audio);
  const due=pool.filter(w=>{const r=ctx.profile.words[w.id]?.[mode];return r&&r.due<=now;});
  const fresh=shuffle(pool.filter(w=>!ctx.profile.words[w.id]?.[mode]));
  return [...due,...fresh].slice(0,SESSION);
}

function drill(ctx,body,mode){
  const level=ctx.hskLevel,queue=pickSession(ctx,level,mode);
  if(!queue.length){
    body.innerHTML='<p class="panel-intro">这一级暂时没有可练习的词。</p><button class="primary wide" id="back">回到词表</button>';
    body.querySelector('#back').onclick=()=>browse(ctx,body);
    return;
  }
  const pool=levelWords(level);
  let index=0,earned=0,right=0;

  const step=()=>{
    if(index>=queue.length)return finish();
    const word=queue[index];
    let hinted=false;
    const distractors=shuffle(pool.filter(w=>w.id!==word.id&&w.en!==word.en)).slice(0,3);
    const options=shuffle([word,...distractors]);
    const listening=mode==='listening';
    body.innerHTML=`
      <div class="drill-head"><span class="step-label">${index+1} / ${queue.length}</span><span class="drill-mode">${listening?'听力 · LISTENING':'认读 · RECOGNITION'}</span></div>
      <div class="step-track">${queue.map((_,i)=>`<i class="${i<=index?'active':''}"></i>`).join('')}</div>
      ${listening
        ? `<div class="drill-prompt drill-audio" data-word="${esc(word.id)}"><button class="primary compact" id="drill-play">${icon('sound',18)} 播放</button><p class="microcopy">听一听，选出对应的词。</p></div>`
        : `<div class="drill-prompt" data-word="${esc(word.id)}"><div class="drill-zh" id="hsk-prompt">${esc(word.zh)}</div>${word.audio?`<button class="subtle drill-play" id="drill-play" aria-label="听「${esc(word.zh)}」的读音">${icon('sound',16)} 读音</button>`:'<p class="microcopy">这一级还没有录音。</p>'}<button class="help-toggle" id="drill-help" aria-label="显示帮助">?</button><div class="help-content" id="drill-hint" hidden><div class="pinyin">${esc(word.pinyin)}</div></div></div>`}
      <div class="drill-options">${options.map(o=>`<button class="choice drill-choice" data-pick="${esc(o.id)}">${esc(listening?o.zh:o.en)}</button>`).join('')}</div>
      <div id="drill-feedback" aria-live="polite"></div>`;

    // Hearing the word is never the answer in a reading drill, so play it up front.
    const play=()=>word.audio&&ctx.voice.play(word.audio);
    body.querySelector('#drill-play')?.addEventListener('click',play);
    play();
    if(!listening)body.querySelector('#drill-help').onclick=()=>{
      const hint=body.querySelector('#drill-hint');
      hint.hidden=!hint.hidden;
      if(!hint.hidden)hinted=true;
    };

    body.querySelectorAll('[data-pick]').forEach(button=>button.onclick=()=>{
      body.querySelectorAll('[data-pick]').forEach(b=>{b.disabled=true;if(b.dataset.pick===word.id)b.classList.add('correct');});
      const correct=button.dataset.pick===word.id;
      if(!correct)button.classList.add('wrong');
      const {coins,practiceOnly,fresh}=reviewWord(ctx.profile,word.id,mode,{correct,hinted,venue:'hall'});
      earned+=coins;
      if(correct)right++;
      ctx.save();
      body.querySelector('#drill-feedback').innerHTML=`<div class="feedback ${correct?'success':'gentle'}">
        <div>${correct?'对了！':'再看一眼。'} <b>${esc(word.zh)}</b> · ${esc(word.pinyin)} · ${esc(word.en)}${definitions(word,{open:true})}
        <small>${practiceOnly?'还没到复习时间，这次不计入进度。':coins?`+${coins} 学习币${fresh&&!hinted?' · 新词':''}`:'已记录，未获得学习币。'}</small></div>
        <div class="feedback-actions">${word.audio?`<button class="subtle" id="drill-replay" aria-label="再听一次">${icon('sound',15)}</button>`:''}<button class="primary" id="drill-next">${index===queue.length-1?'完成':'下一个'}</button></div></div>`;
      body.querySelector('#drill-replay')?.addEventListener('click',play);
      if(!listening&&word.audio)play();
      body.querySelector('#drill-next').onclick=()=>{index++;step();};
    });
  };

  const finish=()=>{
    body.innerHTML=`<div class="completion"><div class="completion-seal">词</div>
      <h3>练习完成！</h3>
      <p>答对 ${right} / ${queue.length}${earned?` · 获得 ${earned} 学习币`:''}</p>
      <p class="microcopy">到期的词会自动排进下一次复习。</p>
      <div class="completion-actions"><button class="primary" id="again">再来一组</button><button class="secondary" id="back">回到词表</button></div></div>`;
    body.querySelector('#again').onclick=()=>drill(ctx,body,mode);
    body.querySelector('#back').onclick=()=>browse(ctx,body);
  };
  step();
}
