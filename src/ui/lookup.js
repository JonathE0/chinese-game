import {escapeHtml as esc} from '../core/language.js';
import {pinyinHtml} from './shell.js';
import {TranslationService,MAX_TRANSLATION_LENGTH} from '../services/translation.js';
import {icon} from './art.js';
import {addWord,hasWord} from '../core/bank.js';
import './lookup.css';

const hasHan=text=>/[㐀-䶿一-鿿]/.test(text);
const sentenceLike=text=>[...text].filter(hasHan).length>4||/[。！？!?，,；;]/.test(text);

/** Highlight Chinese in the interface to see an authored meaning and dictionary details. */
export function installLookup(ctx,translations=new TranslationService()){
  const popup=document.createElement('div');
  popup.id='lookup';popup.hidden=true;popup.setAttribute('role','dialog');popup.setAttribute('aria-label','词语查询');
  document.body.appendChild(popup);

  let request=0,considerTimer=null;
  const close=()=>{
    request++;
    if(considerTimer!==null){clearTimeout(considerTimer);considerTimer=null;}
    popup.hidden=true;
  };

  const place=rect=>{
    popup.hidden=false;
    const width=Math.min(380,innerWidth-24);
    popup.style.width=width+'px';
    const left=Math.max(12,Math.min(rect.left+rect.width/2-width/2,innerWidth-width-12));
    const above=rect.top>popup.offsetHeight+18;
    popup.style.left=left+'px';
    popup.style.top=(above?rect.top-popup.offsetHeight-10:rect.bottom+10)+'px';
  };

  const header=text=>`<div class="lookup-head"><b class="lookup-source">${esc(text)}</b><button class="lookup-close" aria-label="关闭">${icon('close',14)}</button></div>`;
  const wireClose=()=>{popup.querySelector('.lookup-close').onclick=close;};
  const wordRows=words=>{
    const saved=new Set(ctx.profile.saved.map(word=>word.zh));
    return words.map((word,index)=>`<div class="lookup-word">
      <div class="lookup-zh">${esc(word.zh)}</div>
      <div class="lookup-body"><div class="lookup-pinyin">${word.pinyin?pinyinHtml(word.pinyin,word.zh,{always:true}):'—'}</div><div class="lookup-en">${esc(word.en||'不在词典中 / not in dictionary')}</div></div>
      ${word.unknown?'':`<button class="lookup-save" data-save="${index}" aria-label="收藏${esc(word.zh)}">${saved.has(word.zh)?'已收藏':'收藏'}</button>`}
    </div>`).join('');
  };
  const wireSaves=words=>popup.querySelectorAll('[data-save]').forEach(button=>{
    button.onclick=()=>{
      const word=words[Number(button.dataset.save)];
      if(hasWord(ctx.profile,word.zh))return;
      if(!addWord(ctx.profile,word))return ctx.ui.notice('生词本已满。 / Your word list is full.');
      ctx.save();button.textContent='已收藏';
    };
  });

  const loadWords=async(text,token,container,rect)=>{
    try{
      if(!ctx.dictionary.ready)await ctx.dictionary.load();
      if(token!==request)return;
      const words=ctx.dictionary.segment(text);
      container.innerHTML=wordRows(words)+`<p class="lookup-credit">CC-CEDICT · CC BY-SA 4.0</p>`;
      wireSaves(words);place(rect);
    }catch(error){
      if(token!==request)return;
      container.innerHTML=`<p class="lookup-loading">词典无法载入。 / Dictionary unavailable: ${esc(error?.message??ctx.dictionary.error??'')}</p>`;
      place(rect);
    }
  };

  const render=async(text,rect)=>{
    const token=++request;
    popup.innerHTML=header(text)+`<p class="lookup-status">正在查询… / Looking up…</p>`;
    wireClose();place(rect);
    let translated;
    try{translated=await translations.translate(text);}catch(error){translated={status:'error',source:text,error};}
    if(token!==request)return;
    if(translated.status==='too-long'){
      popup.innerHTML=header(text)+`<p class="lookup-status">所选内容太长。请选择最多 ${MAX_TRANSLATION_LENGTH} 个字符。 / Selection is too long; choose up to ${MAX_TRANSLATION_LENGTH} characters.</p>`;
      wireClose();place(rect);return;
    }
    const asSentence=sentenceLike(text);
    if(!asSentence&&translated.status!=='translated'){
      popup.innerHTML=header(text)+`<div class="lookup-words"><p class="lookup-loading">正在载入词典… / Loading dictionary…</p></div>`;
      wireClose();place(rect);
      return loadWords(text,token,popup.querySelector('.lookup-words'),rect);
    }
    const meaning=translated.status==='translated'
      ?`<section class="lookup-translation"><div class="lookup-meaning">${esc(translated.meaning)}</div>${translated.pinyin?`<div class="lookup-sentence-pinyin">${pinyinHtml(translated.pinyin,'',{always:true})}</div>`:''}</section>`
      :`<p class="lookup-status">暂无整句翻译。 / Translation unavailable for this selection.</p>`;
    popup.innerHTML=header(text)+meaning+`<details class="lookup-details"><summary>词语详情 / Vocabulary details</summary><div class="lookup-words"><p class="lookup-loading">正在载入词典… / Loading dictionary…</p></div></details>`;
    wireClose();place(rect);
    // The word-by-word breakdown is the footnote, not the answer: it is only segmented, and the
    // dictionary only fetched, once someone actually opens it.
    const details=popup.querySelector('.lookup-details');
    details.addEventListener('toggle',()=>{
      if(!details.open||details.dataset.loaded)return;
      details.dataset.loaded='1';
      loadWords(text,token,popup.querySelector('.lookup-words'),rect);
    });
  };

  const consider=()=>{
    considerTimer=null;
    const selection=getSelection();
    const text=selection?.toString().trim()??'';
    if(!text||!hasHan(text))return close();
    if(popup.contains(selection.anchorNode))return;
    const rect=selection.getRangeAt(0).getBoundingClientRect();
    if(!rect.width&&!rect.height)return close();
    render(text,rect);
  };
  const scheduleConsider=()=>{
    if(considerTimer!==null)clearTimeout(considerTimer);
    considerTimer=setTimeout(consider,0);
  };
  document.addEventListener('mouseup',event=>{if(!popup.contains(event.target))scheduleConsider();});
  document.addEventListener('touchend',event=>{if(!popup.contains(event.target))scheduleConsider();});
  document.addEventListener('keydown',event=>{
    if(event.code!=='Escape')return;
    if(popup.hidden&&considerTimer===null)return;      // nothing of ours to dismiss
    // A pending look-up is invisible. Cancel it, but let the key carry on to whatever the player
    // can actually see — otherwise the first Escape after clicking anything in a panel is eaten
    // by a popup that never appeared, and the panel stays open.
    if(!popup.hidden)event.stopPropagation();
    close();
  },true);
  document.addEventListener('pointerdown',event=>{if(!popup.hidden&&!popup.contains(event.target))close();});
  addEventListener('resize',close);
  return {close};
}
