import {escapeHtml as esc} from '../core/language.js';
import {keyLabel} from '../core/keys.js';
import {pinyinHtml} from './shell.js';
import {icon} from './art.js';
import {grant} from '../core/economy.js';
import {reviewWord,pickReviewWords} from '../core/review.js';
import {loadWords} from '../services/hsk-data.js';

const shuffle=list=>list.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(([,v])=>v);
const ROUNDS=8;
const PAIRS=6;
const MAX_REWARD=8;

/**
 * Two short games, playable any time. The full reward is paid once per game per in-game day —
 * replays still count as review practice but do not print money.
 */
export async function openGames(ctx){
  const body=ctx.ui.open('games','小游戏','练一练 · QUICK GAMES');
  body.innerHTML='<p class="panel-intro">正在准备…</p>';
  const pool=await wordPool(ctx);
  if(pool.length<PAIRS*2){
    body.innerHTML=`<p class="panel-intro">再收集几个词就能玩了。走在城里按 <kbd>${keyLabel('collect')}</kbd> 记住东西的名字，或者在词语馆复习。<br>Collect a few more words first — press ${keyLabel('collect')} around town, or review in the word hall.</p>`;
    return;
  }
  hub(ctx,body,pool);
}

/** Prefer the player's own collected words; top up from the HSK level they are on. */
async function wordPool(ctx){
  const bank=(ctx.profile.saved??[]).filter(w=>w.zh&&w.en);
  let extra=[];
  try{
    const words=await loadWords();
    const level=ctx.hskLevel??1;
    extra=words.filter(w=>w.level===level&&w.audio&&w.en).slice(0,120);
  }catch{}
  const seen=new Set();
  return [...bank,...extra].filter(w=>{
    if(seen.has(w.zh))return false;
    seen.add(w.zh);return true;
  });
}

const paidToday=(ctx,game)=>`game:${game}:${ctx.profile.dayIndex??0}`;

function hub(ctx,body,pool){
  const listenable=pool.filter(w=>w.audio);
  body.innerHTML=`
    <p class="panel-intro">用你收集的词玩一玩。每天第一次通关有学习币。<br>Play with the words you have collected. The first clear of each game each day pays coins.</p>
    <div class="game-grid">
      <button class="game-card" data-game="match">
        <span class="game-icon">${icon('book',26)}</span>
        <b>配对</b><small>Match the pairs</small>
        <span class="game-note">${ctx.profile.claims[paidToday(ctx,'match')]?'今天已领取':`最多 ${MAX_REWARD} 学习币`}</span>
      </button>
      <button class="game-card" data-game="listen" ${listenable.length<4?'disabled':''}>
        <span class="game-icon">${icon('sound',26)}</span>
        <b>听音辨词</b><small>Listen and choose</small>
        <span class="game-note">${listenable.length<4?'需要更多有录音的词':ctx.profile.claims[paidToday(ctx,'listen')]?'今天已领取':`最多 ${MAX_REWARD} 学习币`}</span>
      </button>
    </div>
    <p class="microcopy">游戏里的答对也会计入词语的复习进度。</p>`;
  body.querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>{
    if(b.dataset.game==='match')matchGame(ctx,body,pool);
    else listenGame(ctx,body,listenable);
  });
}

function payout(ctx,game,right,total){
  const share=total?right/total:0;
  const coins=Math.round(MAX_REWARD*Math.max(0,(share-.4)/.6));   // 40% correct earns nothing
  return coins>0?grant(ctx.profile,paidToday(ctx,game),coins):0;
}

// ------------------------------------------------------------ matching pairs
function matchGame(ctx,body,pool){
  const picks=pickReviewWords(ctx.profile,pool,'recognition',{limit:PAIRS,includeResting:true});
  const cards=shuffle([
    ...picks.map(w=>({key:w.zh,face:w.zh,side:'zh',word:w})),
    ...picks.map(w=>({key:w.zh,face:w.en.split(';')[0],side:'en',word:w})),
  ]);
  let open=[],matched=new Set(),moves=0,busy=false;

  const draw=()=>{
    body.innerHTML=`
      <div class="drill-head"><span class="step-label">${matched.size} / ${PAIRS} 对</span><span class="drill-mode">配对 · MATCH</span></div>
      <p class="microcopy">翻开两张，把汉字和意思配成一对。</p>
      <div class="match-grid">${cards.map((card,i)=>{
        const done=matched.has(card.key),face=open.includes(i)||done;
        return `<button class="match-card ${face?'face':''} ${done?'done':''} side-${card.side}" data-card="${i}" ${done?'disabled':''}>
          ${face?esc(card.face):'<span class="match-back">禾</span>'}</button>`;
      }).join('')}</div>
      <p class="microcopy">翻牌次数：${moves}</p>`;
    body.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>flip(Number(b.dataset.card)));
  };

  const flip=index=>{
    if(busy||open.includes(index)||matched.has(cards[index].key))return;
    open.push(index);
    if(open.length<2)return draw();
    moves++;busy=true;draw();
    const [a,b]=open.map(i=>cards[i]);
    const hit=a.key===b.key;
    if(hit){
      matched.add(a.key);
      reviewWord(ctx.profile,a.word.id??('bank-'+a.key),'recognition',{correct:true,hinted:false});
      if(a.word.audio)ctx.voice.play(a.word.audio);
    }
    setTimeout(()=>{
      open=[];busy=false;
      if(matched.size===PAIRS)return finish();
      draw();
    },hit?520:900);
  };

  const finish=()=>{
    ctx.save();
    const perfect=PAIRS*2,score=Math.max(0,1-(moves-PAIRS)/perfect);
    const coins=payout(ctx,'match',Math.round(score*PAIRS),PAIRS);
    ctx.save();
    body.innerHTML=`<div class="completion"><div class="completion-seal">对</div>
      <h3>全部配对完成！</h3>
      <p>用了 ${moves} 次翻牌${coins?` · 获得 ${coins} 学习币`:''}</p>
      <p class="microcopy">${coins?'':'今天的奖励已经领过了，但复习进度照样算。'}</p>
      <div class="completion-actions"><button class="primary" id="again">再玩一次</button><button class="secondary" id="back">回到游戏</button></div></div>`;
    body.querySelector('#again').onclick=()=>matchGame(ctx,body,pool);
    body.querySelector('#back').onclick=()=>hub(ctx,body,pool);
  };
  draw();
}

// ----------------------------------------------------------- listen and find
function listenGame(ctx,body,pool){
  const queue=pickReviewWords(ctx.profile,pool,'listening',{limit:ROUNDS,includeResting:true});
  let index=0,right=0;

  const step=()=>{
    if(index>=queue.length)return finish();
    const word=queue[index];
    const options=shuffle([word,...shuffle(pool.filter(w=>w.zh!==word.zh)).slice(0,5)]);
    body.innerHTML=`
      <div class="drill-head"><span class="step-label">${index+1} / ${queue.length}</span><span class="drill-mode">听音辨词 · LISTEN</span></div>
      <div class="step-track">${queue.map((_,i)=>`<i class="${i<=index?'active':''}"></i>`).join('')}</div>
      <div class="drill-prompt drill-audio"><button class="primary compact" id="play">${icon('sound',18)} 再听一次</button>
        <p class="microcopy">听一听，选出你听到的词。</p></div>
      <div class="object-grid game-options">${options.map(o=>`<button class="choice game-option" data-pick="${esc(o.zh)}">${esc(o.zh)}</button>`).join('')}</div>
      <div id="game-feedback" aria-live="polite"></div>`;
    const play=()=>ctx.voice.play(word.audio);
    body.querySelector('#play').onclick=play;play();
    body.querySelectorAll('[data-pick]').forEach(button=>button.onclick=()=>{
      body.querySelectorAll('[data-pick]').forEach(b=>{b.disabled=true;if(b.dataset.pick===word.zh)b.classList.add('correct');});
      const correct=button.dataset.pick===word.zh;
      if(!correct)button.classList.add('wrong');
      if(correct)right++;
      reviewWord(ctx.profile,word.id??('bank-'+word.zh),'listening',{correct,hinted:false,zh:word.zh});
      ctx.save();
      body.querySelector('#game-feedback').innerHTML=`<div class="feedback ${correct?'success':'gentle'}">
        <div>${correct?'对了！':'是这个：'} <b>${esc(word.zh)}</b> · ${pinyinHtml(word.pinyin,word.zh,{always:true})} · ${esc(word.en)}</div>
        <button class="primary" id="next">${index===queue.length-1?'完成':'下一个'}</button></div>`;
      body.querySelector('#next').onclick=()=>{index++;step();};
    });
  };

  const finish=()=>{
    const coins=payout(ctx,'listen',right,queue.length);
    ctx.save();
    body.innerHTML=`<div class="completion"><div class="completion-seal">听</div>
      <h3>听力练习完成！</h3>
      <p>答对 ${right} / ${queue.length}${coins?` · 获得 ${coins} 学习币`:''}</p>
      <p class="microcopy">${coins?'':'今天的奖励已经领过了，但听力进度照样算。'}</p>
      <div class="completion-actions"><button class="primary" id="again">再玩一次</button><button class="secondary" id="back">回到游戏</button></div></div>`;
    body.querySelector('#again').onclick=()=>listenGame(ctx,body,pool);
    body.querySelector('#back').onclick=()=>hub(ctx,body,pool);
  };
  step();
}
