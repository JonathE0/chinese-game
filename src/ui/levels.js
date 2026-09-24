// Placement test and HSK mock exams, opened from the word hall panel (src/ui/hsk.js).
import cfg from '../content/levels.json' with {type:'json'};
import catalog from '../content/catalog.json' with {type:'json'};
import {meta,loadedWords} from '../services/hsk-data.js';
import {languageLine,pinyinHtml} from './shell.js';
import {icon,itemArt} from './art.js';
import {escapeHtml as esc} from '../core/language.js';
import {placementNext,finishPlacement,canPlace,finishMock} from '../core/levels.js';

const L=cfg.labels;
const shuffle=list=>list.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(([,v])=>v);
const levelWords=level=>loadedWords().filter(w=>w.level===level);
// Homophones (他/她, 是/事/试) would make two options sound right, so they never share a question.
const sound=w=>w.pinyin.toLowerCase().replace(/s+/g,'');
const say=(ctx,line)=>ctx.voice.available(line.audio)&&ctx.voice.play(line.audio);

/** One question: the meaning of a written word, or which word a clip says. Calls done(right). */
function ask(ctx,body,{word,listening,dontKnow,head},done){
  const others=levelWords(word.level).filter(w=>w.id!==word.id&&w.en!==word.en&&w.zh!==word.zh&&sound(w)!==sound(word));
  const options=shuffle([word,...shuffle(others).slice(0,3)]);
  body.innerHTML=`
    <div class="drill-head"><span class="step-label">${esc(head)}</span></div>
    ${languageLine(cfg.lines[listening?'listen':'ask'],ctx.profile.settings)}
    <div class="drill-prompt${listening?' drill-audio':''}" data-word="${esc(word.id)}">${listening
      ?`<button class="primary compact" id="level-play">${icon('sound',18)} 播放</button>`
      :`<div class="drill-zh">${esc(word.zh)}</div>`}</div>
    <div class="drill-options">${options.map(o=>`<button class="choice drill-choice" data-pick="${esc(o.id)}">${esc(listening?o.zh:o.en)}</button>`).join('')}
      ${dontKnow?`<button class="choice" data-pick="">${esc(L.dontKnow.zh)}</button>`:''}</div>`;
  if(listening){
    const play=()=>ctx.voice.play(word.audio);
    body.querySelector('#level-play').onclick=play;
    play();
  }
  body.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>done(b.dataset.pick===word.id));
}

const missedList=words=>words.length?`<div class="hsk-list">${words.map(w=>
  `<article class="hsk-row"><div class="hsk-word"><b>${esc(w.zh)}</b> · ${pinyinHtml(w.pinyin,w.zh,{always:true})} · ${esc(w.en)}</div></article>`).join('')}</div>`:'';

/** Adaptive from HSK 1: each level passed leads to the next; the first level failed ends it. */
export function openPlacement(ctx,body,back){
  if(!canPlace(ctx.profile))return back();
  const known=[];
  const round=level=>{
    const queue=shuffle(levelWords(level)).slice(0,cfg.placement.questions);
    let index=0,right=0;
    const next=()=>{
      if(index>=queue.length){
        const step=placementNext(level,right);
        return step.next?round(step.next):result(step.result);
      }
      const word=queue[index];
      ask(ctx,body,{word,listening:false,dontKnow:true,head:`${L.placement.zh} · HSK ${level} · ${index+1} / ${queue.length}`},ok=>{
        if(ok){right++;known.push(word.id);}
        index++;next();
      });
    };
    next();
  };
  const result=level=>{
    finishPlacement(ctx.profile,level,known);
    ctx.save();
    body.innerHTML=`<div class="completion"><div class="completion-seal">词</div>
      <h3 id="level-result">${esc(L.yourLevel.zh)}：${level?`HSK ${level} 级`:esc(L.starting.zh)}</h3>
      <div class="completion-actions"><button class="secondary" id="back">回到词表</button></div></div>`;
    body.querySelector('#back').onclick=back;
  };
  round(1);
}

/** Twenty questions from one level: half on meaning, half on listening where the level has clips. */
export function openMock(ctx,body,level,back){
  const {meaning,listening}=cfg.mock;
  const hasAudio=meta.audioLevels.includes(level);
  // ponytail: levels without recordings (HSK 4-6) ask meaning only, until they get clips.
  const queue=shuffle(levelWords(level)).slice(0,meaning+listening)
    .map((word,i)=>({word,listening:hasAudio&&!!word.audio&&i>=meaning}));
  const missed=[];
  let index=0,score=0;
  const next=()=>{
    if(index>=queue.length)return result();
    const q=queue[index];
    ask(ctx,body,{...q,head:`${L.mock.zh} · HSK ${level} · ${index+1} / ${queue.length}`},ok=>{
      if(ok)score++;else missed.push(q.word);
      index++;next();
    });
  };
  const result=()=>{
    const {passed,certificate}=finishMock(ctx.profile,level,score);
    ctx.save();
    const line=cfg.lines[passed?'pass':'fail'],item=certificate&&catalog.find(c=>c.id===certificate);
    say(ctx,line);
    body.innerHTML=`<div class="completion"><div class="completion-seal">词</div>
      ${languageLine(line,ctx.profile.settings)}
      <p id="level-score">${esc(L.score.zh)}：${score} / ${queue.length}</p>
      ${item?`<div class="slot-current level-certificate">${itemArt(item.visual)}<div>${esc(L.certificate.zh)}${languageLine(item,ctx.profile.settings)}</div></div>`:''}
      ${missedList(missed)}
      <div class="completion-actions"><button class="secondary" id="back">回到词表</button></div></div>`;
    body.querySelector('#back').onclick=back;
  };
  next();
}
