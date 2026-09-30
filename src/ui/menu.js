import catalog from '../content/catalog.json' with {type:'json'};
import {normalize,escapeHtml as esc} from '../core/language.js';
import {languageLine,pinyinHtml} from './shell.js';
import {icon,itemArt} from './art.js';
import {purchase} from '../core/economy.js';
import {grant} from '../core/economy.js';
import {addWord} from '../core/bank.js';

const dishes=catalog.filter(item=>item.category==='dish');
const byId=id=>dishes.find(d=>d.id===id);
const ORDER_BONUS=3;

/** The phrasings a waiter would accept for "I'll have the dumplings". */
const patterns=zh=>['我要'+zh,'我想要'+zh,'我要一份'+zh,'来一份'+zh,'来一个'+zh,'来一碗'+zh,'我要一个'+zh,'我要一碗'+zh,'给我'+zh,'我点'+zh,zh];
const accepts=(text,zh)=>patterns(zh).flatMap(form=>[form,form+'谢谢',form+'谢谢您','请'+form]).some(form=>normalize(form)===normalize(text));

const GREETING={
  tablet:{zh:'请在这里点菜。',pinyin:'Qǐng zài zhèlǐ diǎn cài.',en:'Please order here.',
    note:'点菜 is the verb for ordering food. 点 on its own means to pick or select.'},
  waiter:{zh:'您好！请问要点什么？',pinyin:'Nín hǎo! Qǐngwèn yào diǎn shénme?',en:'Hello! What would you like to order?',
    note:'请问 softens a question, the way "may I ask" does in English.'},
};

export function openMenu(ctx,from='tablet'){
  const body=ctx.ui.open('menu','菜单',from==='waiter'?'家常餐厅 · 服务员':'家常餐厅 · 桌上点菜');
  list(ctx,body,from);
}

function list(ctx,body,from){
  body.innerHTML=`
    ${languageLine(GREETING[from],ctx.profile.settings,{className:'shop-greeting'})}
    <div class="menu-grid">${dishes.map(dish=>`
      <button class="menu-card" data-dish="${esc(dish.id)}">
        ${itemArt(dish.visual)}
        <div class="menu-text"><b>${esc(dish.zh)}</b><small>${pinyinHtml(dish.pinyin,dish.zh)}</small></div>
        <span class="menu-price">${icon('coin',14)} ${dish.price}</span>
      </button>`).join('')}</div>
    <p class="microcopy">点一道菜，然后用中文说出你要什么。第一次用中文点每道菜，多给 ${ORDER_BONUS} 学习币。<br>
    Pick a dish, then say what you want in Chinese. The first Chinese order of each dish pays a small bonus.</p>`;
  body.querySelectorAll('[data-dish]').forEach(b=>b.onclick=()=>order(ctx,body,byId(b.dataset.dish),from));
}

function order(ctx,body,dish,from){
  let tries=0;
  const draw=(feedback='')=>{
    body.innerHTML=`
      <button class="subtle" id="menu-back">← 回到菜单</button>
      <div class="product-detail">${itemArt(dish.visual)}<div>${languageLine(dish,ctx.profile.settings)}
        <p>${esc(dish.description)}</p>
        <div class="product-price">${icon('coin')} <strong>${dish.price}</strong> <span>学习币</span></div></div></div>
      <div class="negotiation"><h3>怎么点？ <small>SAY YOUR ORDER</small></h3>
        <div class="bargain-suggestions">
          <button class="choice" data-say="我要一份${esc(dish.zh)}">我要一份${esc(dish.zh)}</button>
          <button class="choice" data-say="来一个${esc(dish.zh)}">来一个${esc(dish.zh)}</button>
        </div>
        <form id="order-form"><div class="answer-row">
          <input id="order-text" autocomplete="off" maxlength="60" placeholder="用中文说…" aria-label="你的点菜">
          <button type="button" id="order-mic" class="mic-button" aria-label="麦克风点菜">${icon('mic')}</button>
          <button class="secondary" type="submit">说出来</button>
        </div></form>
        <p id="order-status" class="microcopy" aria-live="polite"></p>
        <div id="order-feedback">${feedback}</div>
      </div>
      <button class="subtle wide" id="order-skip">直接买下（不用中文）</button>`;

    body.querySelector('#menu-back').onclick=()=>list(ctx,body,from);
    body.querySelectorAll('[data-say]').forEach(b=>b.onclick=()=>submit(b.dataset.say));
    body.querySelector('#order-form').onsubmit=e=>{e.preventDefault();submit(body.querySelector('#order-text').value);};
    body.querySelector('#order-mic').onclick=()=>{const input=body.querySelector('#order-text'),status=body.querySelector('#order-status');ctx.speech.start({onTranscript:t=>{if(input.isConnected)input.value=t;},onStatus:t=>{if(status.isConnected)status.textContent=t;}});};
    body.querySelector('#order-skip').onclick=()=>settle(false);
  };

  const submit=text=>{
    if(accepts(text,dish.zh))return settle(true);
    tries++;
    draw(`<div class="feedback gentle">没听懂。试试「我要一份${esc(dish.zh)}」。
      <small>${tries>1?'点菜常用：我要… / 来一份… / 我想要…':'Say what you want, then the dish name.'}</small></div>`);
  };

  const settle=inChinese=>{
    ctx.speech.stop();
    if(ctx.profile.wallet<dish.price){
      draw('<div class="feedback gentle">学习币不够。先去练习赚一点。 / Not enough coins yet.</div>');
      return;
    }
    const result=purchase(ctx.profile,dish,dish.price);
    if(!result.ok)return ctx.ui.notice('暂时无法下单。 / Could not order just now.');
    let bonus=0;
    if(inChinese){
      bonus=grant(ctx.profile,`order:${dish.id}`,ORDER_BONUS);
      addWord(ctx.profile,{zh:dish.zh,pinyin:dish.pinyin,en:dish.en,audio:dish.audio});
    }
    ctx.music?.cue('purchase');ctx.save();
    body.innerHTML=`<div class="completion"><div class="purchased-art">${itemArt(dish.visual)}</div>
      <h3>${inChinese?'点好了！':'好的。'}</h3>
      <p>${esc(dish.zh)} 已经上桌。${bonus?`<br>用中文点菜 +${bonus} 学习币`:''}</p>
      ${inChinese?'<p class="microcopy">这道菜的名字已经收进生词本。</p>':'<p class="microcopy">下次试试用中文点菜，可以多拿学习币。</p>'}
      <div class="completion-actions">
        <button class="primary" id="order-more">再点一道</button>
        <button class="secondary" id="order-done">吃好了</button></div></div>`;
    body.querySelector('#order-more').onclick=()=>list(ctx,body,from);
    body.querySelector('#order-done').onclick=()=>ctx.ui.close();
  };

  draw();
}
