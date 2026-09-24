import market from '../content/market.json' with {type:'json'};
import {languageLine} from './shell.js';
import {icon} from './art.js';
import {escapeHtml as esc} from '../core/language.js';
import {sayNumber,totalText,orderName,orderText,matchSpoken,measureChoices,payChoices,orderBonus} from '../core/order.js';
import {newCart,addToCart,checkout} from '../core/cart.js';
import {bump} from '../core/daily.js';

/** Snack stalls and the restaurant counter take orders in Chinese; other shops keep the stepper. */
export const ordersAt=shopId=>market.shops.includes(shopId);

const clip=key=>`market-${key}`;
const totalClip=n=>`market-total-${n}`;
const NO_FUNDS='<div class="feedback gentle">学习币不够。再练习一下，或者看看便宜一点的物品。</div>';

// Vendor lines play one after another. A newer sequence, or the panel closing, ends an older one.
let sequence=0;
export async function say(ctx,el,entries){
  const run=++sequence;
  for(const entry of entries){
    const [id,slow]=[].concat(entry);
    if(run!==sequence||!el.isConnected)return;
    if(!ctx.voice.available(id))continue;
    // Wait for the clip to finish, fail to load, or be refused (play() settles with the audio still paused).
    const started=ctx.voice.play(id,{slow:!!slow}),audio=ctx.voice.foreground;
    if(audio)await new Promise(done=>{
      for(const event of ['ended','pause','error'])audio.addEventListener(event,done,{once:true});
      started.then(()=>{if(audio.paused)done();});
    });
  }
}

/**
 * The 点餐 builder: 我要 + 一/两/三 + measure + dish, built from tiles or said aloud. It replaces
 * the quantity stepper only; a finished order moves on to paying by ear.
 */
export function mountOrder(ctx,{body,host,item,shopId,onSale,back}){
  const settings=ctx.profile.settings,line=key=>languageLine(market.lines[key],settings);
  const order={via:null,clean:true,quantity:0,measure:null};
  const afford=n=>n*item.price<=ctx.profile.wallet;
  host.innerHTML=`<div class="order-builder">
    <h3>点餐 <small>Order</small></h3>
    ${line('greet')}
    <p class="order-sentence" id="order-sentence"></p>
    <p class="microcopy">拼句子 · Build it — 我要 · I want</p>
    <div class="order-row">${[1,2,3].map(n=>`<button class="choice order-tile" data-num="${n}" ${afford(n)?'':'disabled'}>${sayNumber(n)}</button>`).join('')}</div>
    <div class="order-row">${measureChoices(item).map(m=>`<button class="choice order-tile" data-measure="${m}">${m}</button>`).join('')}</div>
    <div class="button-row"><button class="primary" id="order-go" disabled>点餐</button>
      ${ctx.speech.supported?`<button class="secondary" id="order-say">${icon('mic',15)} 说出来</button>`:''}</div>
    <p id="order-status" class="microcopy"></p>
    <div id="order-feedback" aria-live="polite">${afford(1)?'':NO_FUNDS}</div>
  </div>`;
  const $=selector=>host.querySelector(selector);
  const feedback=html=>{$('#order-feedback').innerHTML=html;};
  const paint=()=>{
    $('#order-sentence').innerHTML=`我要<b>${order.quantity?sayNumber(order.quantity):'＿'}</b><b>${order.measure??'＿'}</b>${esc(orderName(item))}。`;
    host.querySelectorAll('[data-num]').forEach(b=>b.classList.toggle('picked',+b.dataset.num===order.quantity));
    host.querySelectorAll('[data-measure]').forEach(b=>b.classList.toggle('picked',b.dataset.measure===order.measure));
    $('#order-go').disabled=!(order.quantity&&order.measure);
  };
  // A wrong measure lights up the right tile. After 二 + measure the screen shows the right phrase.
  const hint=(text=null)=>{
    $(`[data-measure="${item.measure}"]`)?.classList.add('hint');
    feedback(text?line('liang')+`<div class="feedback gentle">${esc(text)}</div>`:line('measureHint'));
    say(ctx,host,[clip(text?'liang':'measureHint')]);
  };
  host.querySelectorAll('[data-num]').forEach(b=>b.onclick=()=>{order.quantity=+b.dataset.num;paint();});
  host.querySelectorAll('[data-measure]').forEach(b=>b.onclick=()=>{
    if(b.dataset.measure!==item.measure){order.clean=false;return hint();}
    order.measure=item.measure;feedback('');paint();
  });
  $('#order-go').onclick=()=>{order.via='built';placed('ok');};
  // SpeechInput's statuses are written for a text box (check the transcript, or type instead). The
  // builder has none, so it shows only that it is listening, then what was heard, and clears on errors.
  $('#order-say')?.addEventListener('click',()=>ctx.speech.start({
    onStatus:text=>{
      if(text.startsWith('正在听'))$('#order-status').textContent=text;
      else if(!text.startsWith('请检查'))$('#order-status').textContent='';
    },
    onTranscript:text=>{
      $('#order-status').textContent=`「${text}」`;
      const heard=matchSpoken(text,item);
      if(heard.ok){
        if(!afford(heard.quantity))return feedback(NO_FUNDS);
        Object.assign(order,{via:'spoken',quantity:heard.quantity,measure:item.measure});
        return placed('praise');
      }
      if(heard.reason==='er')return hint(orderText(item,2));
      if(heard.reason==='measure')return hint();
      feedback(line('again'));say(ctx,host,[clip('again')]);
    },
  }));
  paint();
  say(ctx,host,[clip('greet')]);

  /** The order stands: the vendor says the total and the player pays by picking what they heard. */
  function placed(lead){
    ctx.speech.stop();
    const total=order.quantity*item.price,byEar=total<=99;
    const heardable=byEar&&ctx.voice.available(totalClip(total));
    const totalLine=()=>languageLine({zh:totalText(total),en:`That's ${total} kuai altogether.`},settings);
    let misses=0;
    body.innerHTML=`<button class="subtle" id="order-back">← 继续逛逛</button>
      <div class="order-pay">
        <p class="order-sentence">${esc(orderText(item,order.quantity))}</p>
        ${line(lead)}
        <h3>付钱 <small>Pay</small></h3>
        ${byEar?'':`<div class="product-price">${icon('coin')} <strong>${total}</strong> <span>学习币</span></div>`}
        <div class="order-row">${(byEar?payChoices(total):[total]).map(n=>`<button class="choice order-tile" data-pay="${n}">${icon('coin',15)} ${n}</button>`).join('')}</div>
        ${byEar?`<button class="subtle" id="order-replay">${icon('sound',14)} 再听一遍</button>`:''}
        <div id="pay-feedback" aria-live="polite">${byEar&&!heardable?totalLine():''}</div>
      </div>`;
    const pay=body.querySelector('.order-pay');
    body.querySelector('#order-back').onclick=back;
    body.querySelector('#order-replay')?.addEventListener('click',()=>say(ctx,pay,[totalClip(total)]));
    say(ctx,pay,[clip(lead),...(byEar?[totalClip(total)]:[])]);
    body.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>{
      if(+b.dataset.pay!==total){
        // A wrong amount costs nothing: hear it again, slower, and after two misses see it written.
        misses++;b.disabled=true;
        body.querySelector('#pay-feedback').innerHTML=line('wrongPay')+(misses>=2||!heardable?totalLine():'');
        return say(ctx,pay,[clip('wrongPay'),[totalClip(total),true]]);
      }
      const paid=checkout(ctx.profile,addToCart(newCart(shopId),item.id,order.quantity));
      if(!paid.ok)return ctx.ui.notice('暂时无法结账，请检查余额。 / Checkout could not complete.');
      bump(ctx.profile,'ordered');
      const bonus=orderBonus(ctx.profile,order);
      onSale(paid);
      body.innerHTML=`<div class="completion"><div class="completion-seal">谢</div>${line('paid')}
        <p>${esc(item.zh)} × ${order.quantity}</p>
        <p class="microcopy">一共 ${paid.total} 学习币，都放进背包了。${bonus?`<br>用中文点菜 +${bonus} 学习币`:''}</p>
        <div class="completion-actions"><button class="primary" id="keep-shopping">继续逛逛</button><button class="secondary" id="leave-order">回到小镇</button></div></div>`;
      body.querySelector('#keep-shopping').onclick=back;
      body.querySelector('#leave-order').onclick=()=>ctx.ui.close();
      say(ctx,body.querySelector('.completion'),[clip('paid')]);
    });
  }
}
