import data from '../content/hotpot.json' with {type:'json'};
import {escapeHtml as esc} from '../core/language.js';
import {BROTHS,newTable,pickBroth,placeOrder,payBill,billLines,billTotal,hasBroth,brothAffordable,menuOf,orderLabel} from '../core/hotpot.js';
import {addToCart,setQuantity,cartLines,cartTotal} from '../core/cart.js';
import {languageLine,pinyinWith} from './shell.js';
import {icon} from './art.js';
import {say} from './order.js';

/**
 * 山城老火锅: the waiter's side of a hotpot dinner (the terrace itself is src/world/hotpot.js, the
 * rules src/core/hotpot.js). Sit down and the waiter comes: 几位？, the broth, the spice level, then
 * the menu by category with + / −, 下单 for each round and 买单 at the end.
 *
 * `table` is this sitting's basket and spice level, which cost nothing. The open bill lives on
 * the profile; walking off the terrace with it unpaid, or loading a save that has one, pays it.
 */
let table=null;
const clip=key=>'hotpot-'+key;
const waiterSays=(ctx,keys)=>keys.map(key=>languageLine(data.lines[key],ctx.profile.settings,{className:'dialogue-line'})).join('');
const heading=entry=>`<h3>${esc(entry.zh)} <small>${pinyinWith(entry.pinyin,entry.zh,entry.en)}</small></h3>`;
const coins=n=>`${icon('coin',14)} ${n}`;
const notify=(ctx,entry,extra='')=>ctx.ui.notice(`${entry.zh}${extra}${ctx.profile.settings.english?` / ${entry.en}`:''}`);

/** The world tells the UI what the staff say as it happens, and when you walk off with the bill. */
function hookUp(ctx){
  const part=ctx.town?.hotpot;
  if(!part||part.hooks.say)return;
  part.hooks.unpaid=()=>billTotal(ctx.profile)>0;
  part.hooks.leave=()=>settleHotpot(ctx);
  part.hooks.say=(who,key)=>{
    const entry=who==='chef'?data.chef[key]:data.lines[key],id=who==='chef'?'hotpot-chef-'+key:clip(key);
    if(ctx.voice.available(id))ctx.voice.play(id);
    notify(ctx,entry);
  };
}

/**
 * An open bill is paid without asking: when you walk off the terrace, and when a save that still
 * has one is loaded. 下单 never lets the bill outgrow the wallet, so this goes through; should a
 * hand-edited save make it fall short, the bill simply stays open. Returns whether it paid.
 */
export function settleHotpot(ctx){
  if(!billTotal(ctx.profile))return false;
  const paid=payBill(ctx.profile);
  if(!paid.ok){notify(ctx,data.lines.short);return false;}
  table=null;
  ctx.town?.hotpot?.clear();
  if(ctx.voice.available(clip('bill')))ctx.voice.play(clip('bill'));
  notify(ctx,data.lines.bill,` −${paid.total} 学习币`);
  ctx.music?.cue('purchase');
  ctx.save();
  return true;
}

export function openHotpot(ctx,id){
  hookUp(ctx);
  if(!id.startsWith('table:'))return;
  const body=ctx.ui.open('hotpot','山城老火锅',`${data.ui.order.zh} · ${data.ui.order.en}`);
  const owing=billTotal(ctx.profile)>0;
  if(!table){table=newTable();if(!owing)return greet(ctx,body);}
  if(!hasBroth(ctx.profile,table))return chooseBroth(ctx,body,['broth']);
  menu(ctx,body,owing?'more':null);
}

function greet(ctx,body){
  const reply=data.replies.party;
  body.innerHTML=`${waiterSays(ctx,['greet'])}
    <div class="order-row"><button class="choice" data-reply>${esc(reply.zh)}</button></div>
    <p class="microcopy">${pinyinWith(reply.pinyin,reply.zh,reply.en)}</p>`;
  say(ctx,body,[clip('greet')]);
  body.querySelector('[data-reply]').onclick=()=>chooseBroth(ctx,body,['seat','broth']);
}

function chooseBroth(ctx,body,lines){
  const broths=menuOf('broth');
  if(!broths.some(item=>brothAffordable(ctx.profile,item)))lines=[...lines,'short'];
  body.innerHTML=`${waiterSays(ctx,lines)}${heading(data.ui.broth)}
    <div class="hotpot-choices">${broths.map(item=>`<button class="choice" data-broth="${esc(item.id)}" ${brothAffordable(ctx.profile,item)?'':'disabled'}>
      <b>${esc(item.zh)}</b> <small>${pinyinWith(item.pinyin,item.zh,item.en)}</small> <span>${coins(item.price)}</span></button>`).join('')}</div>`;
  say(ctx,body,lines.map(clip));
  body.querySelectorAll('[data-broth]').forEach(b=>b.onclick=()=>{pickBroth(table,b.dataset.broth);chooseSpice(ctx,body);});
}

function chooseSpice(ctx,body){
  body.innerHTML=`${waiterSays(ctx,['spice'])}${heading(data.ui.spice)}
    <div class="order-row">${data.spice.map(s=>`<button class="choice" data-spice="${esc(s.key)}">${esc(s.zh)}</button>`).join('')}</div>
    <p class="microcopy">${data.spice.map(s=>pinyinWith(s.pinyin,s.zh,s.en)).join(' ／ ')}</p>`;
  say(ctx,body,[clip('spice')]);
  body.querySelectorAll('[data-spice]').forEach(b=>b.onclick=()=>{table.spice=b.dataset.spice;menu(ctx,body,null);});
}

/**
 * The menu: one tab per category, + / − on every dish, this round's basket and what is already
 * ordered. Until the first round is ordered the 锅底 tab stays, so the broth can still be changed.
 */
function menu(ctx,body,lineKey){
  const p=ctx.profile;
  let tab='meat',dipsSaid=false;
  const spice=data.spice.find(s=>s.key===table.spice);
  const list=lines=>lines.map(l=>`<li><span>${esc(orderLabel(l.item,l.quantity))}</span><span>${coins(l.total)}</span></li>`).join('');
  // A broth's + picks it (one per pot) and is off while it is chosen or out of reach.
  const canAdd=item=>!BROTHS.includes(item.id)||(!table.cart.lines[item.id]&&brothAffordable(p,item));
  const render=()=>{
    // Re-rendering replaces every button: keep the keyboard on the control that was pressed.
    const was=body.contains(document.activeElement)?document.activeElement.dataset:{};
    const focusKey=['tab','more','less'].find(k=>was[k]!==undefined);
    const categories=data.categories.filter(c=>c.id!=='broth'||!BROTHS.some(id=>p.hotpot?.[id]));
    const basket=cartLines(table.cart),ordered=billLines(p);
    body.innerHTML=`<div id="hotpot-line" aria-live="polite">${lineKey?waiterSays(ctx,[lineKey]):''}</div>
      <div class="level-tabs hotpot-tabs" role="tablist">${categories.map(c=>`<button class="level-tab ${c.id===tab?'active':''}" role="tab" aria-selected="${c.id===tab}" data-tab="${c.id}"><b>${esc(c.zh)}</b><small>${pinyinWith(c.pinyin,c.zh,c.en)}</small></button>`).join('')}</div>
      <ul class="hotpot-menu">${menuOf(tab).map(item=>{const n=table.cart.lines[item.id]??0;return `<li>
        <div class="grow"><b>${esc(item.zh)}</b> <small>${pinyinWith(item.pinyin,item.zh,item.en)}</small>
          ${item.description?`<div class="microcopy">${esc(item.description)}${p.settings.english?` <i>${esc(item.descriptionEn)}</i>`:''}</div>`:''}</div>
        <span class="hotpot-price">${coins(item.price)}<small>/${esc(item.measure)}</small></span>
        <div class="stepper"><button data-less="${esc(item.id)}" aria-label="少一个" ${n?'':'disabled'}>−</button><span>${n}</span><button data-more="${esc(item.id)}" aria-label="多一个" ${canAdd(item)?'':'disabled'}>+</button></div></li>`;}).join('')}</ul>
      <div class="hotpot-bill">
        ${spice?`<p class="microcopy">${esc(data.ui.spice.zh)}：${esc(spice.zh)}</p>`:''}
        <ul>${list(basket)}</ul>
        <p class="hotpot-total"><b>${esc(data.ui.total.zh)}</b> <small>${pinyinWith(data.ui.total.pinyin,data.ui.total.zh,data.ui.total.en)}</small> <span>${coins(cartTotal(table.cart))}</span></p>
        ${ordered.length?`<h3>${esc(data.ui.ordered.zh)} <small>${pinyinWith(data.ui.ordered.pinyin,data.ui.ordered.zh,data.ui.ordered.en)}</small></h3>
          <ul>${list(ordered)}</ul><p class="hotpot-total"><b>${esc(data.ui.total.zh)}</b> <span>${coins(billTotal(p))}</span></p>`:''}
      </div>
      <div class="button-row">
        <button class="primary" id="hotpot-order" ${basket.length&&hasBroth(p,table)?'':'disabled'}>${esc(data.ui.place.zh)} <small>${pinyinWith(data.ui.place.pinyin,data.ui.place.zh,data.ui.place.en)}</small></button>
        <button class="secondary" id="hotpot-pay" ${ordered.length?'':'disabled'}>${esc(data.ui.pay.zh)} <small>${pinyinWith(data.ui.pay.pinyin,data.ui.pay.zh,data.ui.pay.en)}</small></button>
      </div>`;
    if(focusKey){
      const at=body.querySelector(`[data-${focusKey}="${CSS.escape(was[focusKey])}"]`);
      (at&&!at.disabled?at:body.querySelector(`[data-more="${CSS.escape(was[focusKey])}"]`)??body.querySelector('.level-tab.active'))?.focus();
    }
    body.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{
      tab=b.dataset.tab;
      if(tab==='dip'&&!dipsSaid){dipsSaid=true;lineKey='dips';say(ctx,body,[clip('dips')]);}
      render();
    });
    body.querySelectorAll('[data-more]').forEach(b=>b.onclick=()=>{
      if(BROTHS.includes(b.dataset.more))pickBroth(table,b.dataset.more);else addToCart(table.cart,b.dataset.more);
      render();
    });
    body.querySelectorAll('[data-less]').forEach(b=>b.onclick=()=>{setQuantity(table.cart,b.dataset.less,(table.cart.lines[b.dataset.less]??0)-1);render();});
    body.querySelector('#hotpot-order').onclick=()=>{
      const placed=placeOrder(p,table);
      if(!placed.ok){if(placed.reason==='short'){lineKey='short';render();say(ctx,body,[clip('short')]);}return;}
      ctx.save();
      ctx.music?.cue('purchase');
      ctx.ui.close();
      ctx.town.hotpot?.serve(placed.lines,{noodles:placed.noodles});
    };
    body.querySelector('#hotpot-pay').onclick=()=>openBill(ctx,body);
  };
  render();
  if(lineKey)say(ctx,body,[clip(lineKey)]);
}

/** 服务员，买单！ — the bill, read back with its measure words, and paying it in one go. */
function openBill(ctx,body){
  const reply=data.replies.bill;
  body.innerHTML=`<div class="order-row"><button class="choice" data-reply>${esc(reply.zh)}</button></div>
    <p class="microcopy">${pinyinWith(reply.pinyin,reply.zh,reply.en)}</p>`;
  body.querySelector('[data-reply]').onclick=()=>{
    const total=billTotal(ctx.profile);
    body.innerHTML=`<div id="hotpot-line" aria-live="polite">${waiterSays(ctx,['bill'])}</div>
      <div class="hotpot-bill"><ul>${billLines(ctx.profile).map(l=>`<li><span>${esc(orderLabel(l.item,l.quantity))}</span><span>${coins(l.total)}</span></li>`).join('')}</ul>
      <p class="hotpot-total"><b>${esc(data.ui.total.zh)}</b> <small>${pinyinWith(data.ui.total.pinyin,data.ui.total.zh,data.ui.total.en)}</small> <span>${coins(total)}</span></p></div>
      <button class="primary wide" id="hotpot-settle">${esc(data.ui.pay.zh)} · ${coins(total)}</button>`;
    say(ctx,body,[clip('bill')]);
    body.querySelector('#hotpot-settle').onclick=()=>{
      const paid=payBill(ctx.profile);
      if(!paid.ok){
        body.querySelector('#hotpot-line').innerHTML=waiterSays(ctx,['short']);
        return say(ctx,body,[clip('short')]);
      }
      table=null;
      ctx.town.hotpot?.clear();
      ctx.music?.cue('purchase');
      ctx.save();
      body.innerHTML=`<div class="completion"><div class="completion-seal">${icon('coin',30)}</div>${waiterSays(ctx,['bye'])}
        <p class="microcopy">−${paid.total}</p></div>`;
      say(ctx,body,[clip('bye')]);
    };
  };
}
