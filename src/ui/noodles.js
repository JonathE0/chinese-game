/** 海风面馆: the noodle counter on the Yunhai avenue. Task 4 of docs/superpowers/plans/2026-09-11-city-quests.md fills in the order. */
import {openDialogue,showLine} from './dialogue.js';
import {escapeHtml as esc} from '../core/language.js';
import {startNoodleOrder,settleNoodleOrder} from '../core/noodles.js';

export function openNoodles(ctx){
  openDialogue(ctx,'city-noodles',{onFinish:state=>afterOrder(ctx,state)});
}

/**
 * What happens once the ordering conversation itself is done. The rule — teach the recipe once,
 * on the first completed order, whether or not the bowl is paid for — lives in
 * `core/noodles.js` `startNoodleOrder`; this only shows its steps.
 */
function afterOrder(ctx,order){
  const plan=startNoodleOrder(ctx.profile,order);
  if(!plan.taught)return pay(ctx,order,plan);
  ctx.save();
  ctx.ui.notice('学会了：番茄鸡蛋面 / Learned: tomato and egg noodles');
  showLine(ctx,'city-noodles','recipe',{onDone:()=>pay(ctx,order,plan)});
}

/** The purchase confirmation: item, quantity 1, total, and what is left, just like a shop. */
function pay(ctx,order,{item,step}){
  if(!item)return;
  if(step==='cant-afford')return showLine(ctx,'city-noodles','cant-afford');
  // Only 确认购买 confirms. The cancel button, Esc and × all close the panel without deciding,
  // and closing it undecided is cancelling.
  let decision='cancel';
  const body=ctx.ui.open('noodles',item.zh,'海风面馆 · 点面',{onClose:()=>settle(ctx,order,decision)});
  const remaining=ctx.profile.wallet-item.price;
  body.innerHTML=`<div class="purchase-confirm">
      <h3>确认购买？</h3>
      <p>${esc(item.zh)} × 1</p>
      <dl>
        <div><dt>价格</dt><dd>${item.price} 学习币</dd></div>
        <div><dt>购买后剩余</dt><dd>${remaining} 学习币</dd></div>
      </dl>
      <button class="primary" id="confirm-purchase">确认购买</button>
      <button class="secondary" id="cancel-purchase">取消</button>
    </div>`;
  body.querySelector('#confirm-purchase').onclick=()=>{decision='confirm';ctx.ui.close();};
  body.querySelector('#cancel-purchase').onclick=()=>ctx.ui.close();
}

function settle(ctx,order,decision){
  const result=settleNoodleOrder(ctx.profile,order,decision);
  if(result.ok){ctx.music?.cue('purchase');ctx.save();}
  else if(decision==='confirm')return ctx.ui.notice('暂时无法购买，请检查余额。');
  showLine(ctx,'city-noodles',result.line);
}
