import catalog from '../content/catalog.json' with {type:'json'};
import {purchase,negotiate} from '../core/economy.js';
import {languageLine,pinyinHtml} from './shell.js';
import {icon,itemArt} from './art.js';
import {toggleWear,wearable} from '../core/inventory.js';
import {vendorState,buildRapport,moodNote,floorFor} from '../core/vendor.js';
import {bump} from '../core/daily.js';
import {priced} from '../core/friends.js';
import {escapeHtml as esc} from '../core/language.js';
import {newCart,cartLines,cartTotal,cartCount,addToCart,setQuantity,clearCart,cartProblem,checkout} from '../core/cart.js';
import {ordersAt,mountOrder} from './order.js';
import festivals from '../content/festivals.json' with {type:'json'};
import market from '../content/market.json' with {type:'json'};

/** A shop can share stock with another: the square carries the basics the market also sells. */
export const shopsOf=item=>[].concat(item.shop??'chen');

const SHOPS={
 hardware:{title:'星光五金百货',sub:'建材 · 家具 · 灯具',greeting:{zh:'修房子、添家具，这里都能买齐。',pinyin:'Xiū fángzi, tiān jiājù, zhèlǐ dōu néng mǎiqí.',en:'Building supplies and furnishings, all in one place.'},foot:'木材、砖和布料可以用于青禾茶楼的建设。家具和灯具可以带回家布置。'},
 chen:{title:'带一点青禾回家',sub:'小小商店 · 陈叔叔',greeting:{zh:'随便看看，喜欢什么？',pinyin:'Suíbiàn kànkan, xǐhuan shénme?',en:'Take a look around. Anything you like?',note:'随便看看 is a casual invitation to browse. This stall allows bargaining; not every shop does.'},
   foot:'小摊可以礼貌讲价，商店规则各不相同。文化灵感来自香港女人街；这里练习普通话。'},
 lifestyle:{title:'生活馆',sub:'家具 · 文具 · 衣服',greeting:{zh:'慢慢挑，价格是固定的。',pinyin:'Mànman tiāo, jiàgé shì gùdìng de.',en:'Take your time. Prices here are fixed.',note:'固定 means fixed. In a shop like this you do not bargain.'},
   foot:'家具买回家后，可以在「我的家」里布置。'},
 cafe:{title:'慢慢咖啡',sub:'咖啡 · 蛋糕 · 面包',greeting:{zh:'今天想喝点什么？',pinyin:'Jīntiān xiǎng hē diǎn shénme?',en:'What would you like to drink today?',note:'点 here means a little / some, softening the question.'},
   foot:'买下的东西会放进背包，慢慢享用。'},
 restaurant:{title:'家常餐厅',sub:'服务台 · 点菜',greeting:{zh:'坐吧，想吃点什么？',pinyin:'Zuò ba, xiǎng chī diǎn shénme?',en:'Have a seat. What would you like to eat?',note:'坐吧 is a relaxed invitation to sit down. 吧 softens it.'},
   foot:'桌上的平板也可以点菜，服务员走过来的时候也能直接说。'},
 lights:{title:'青禾灯具',sub:'灯 · 让房间亮起来',greeting:{zh:'天黑了就知道灯的好。',pinyin:'Tiān hēi le jiù zhīdào dēng de hǎo.',en:'You appreciate a lamp once it gets dark.',note:'天黑了 means once it has got dark. 了 marks the change.'},
   foot:'买回家的灯，天黑以后会真的把房间照亮。'},
 supermarket:{title:'青禾超市',sub:'今天很新鲜',greeting:{zh:'欢迎光临！要买点什么？',pinyin:'Huānyíng guānglín! Yào mǎi diǎn shénme?',en:'Welcome! What would you like to buy?',note:'欢迎光临 is the standard greeting shops call out as you walk in.'},
   foot:'超市明码标价，不讲价。'},
 homeware:{title:'家居小铺',sub:'床 · 桌椅 · 地毯 · 鞋',greeting:{zh:'刚搬来吧？家里缺什么？',pinyin:'Gāng bān lái ba? Jiā lǐ quē shénme?',en:'Just moved in? What is your place missing?',note:'缺 (quē) is to be short of something — 家里缺什么 is what a shopkeeper asks someone furnishing a room.'},
   foot:'这家店从第一天就开着，家里要用的都能在这儿买齐。买下的家具会直接送到房间里。'},
 bakery:{title:'麦香面包',sub:'面包 · 蛋挞 · 甜甜圈',greeting:{zh:'刚出炉的，趁热吃。',pinyin:'Gāng chūlú de, chèn rè chī.',en:'Fresh out of the oven — eat it while it is warm.',note:'趁热 means while it is still hot; 趁 marks doing something while the moment lasts.'},
   foot:'挑好几样一起结账。柜台里的样品可以拿起来看看，但那不是卖的。'},
 kiosk:{title:'便利店',sub:'水 · 三明治 · 地图',greeting:{zh:'要袋子吗？',pinyin:'Yào dàizi ma?',en:'Do you want a bag?',note:'袋子 (dàizi) is a bag. A convenience store asks this at the till everywhere in China.'},
   foot:'城里的小店，二十四小时开着，价格比青禾贵一点。'},
 nightstall:{title:'夜市小摊',sub:'糖葫芦 · 烤串 · 豆花',greeting:{zh:'来一串吗？刚烤好的。',pinyin:'Lái yí chuàn ma? Gāng kǎo hǎo de.',en:'Fancy a skewer? Just off the grill.',note:'来一串 is how you order one of something on a stick — 来 stands in for give me.'},
   foot:'夜里才出摊，天亮以前就收了。'},
 wonton:{title:'馄饨摊',sub:'馄饨 · 小笼包',greeting:{zh:'刚包好的馄饨，来一碗吗？',pinyin:'Gāng bāo hǎo de húntun, lái yì wǎn ma?',en:'Freshly wrapped wontons. Fancy a bowl?',note:'来一碗 is how you order a bowl of something; 碗 (wǎn) is the measure word for bowls.'},
   foot:'白天出摊，天黑以前收摊。'},
 noodlestall:{title:'面摊',sub:'阳春面 · 炸酱面',greeting:{zh:'想吃什么面？我们的面都是现做的。',pinyin:'Xiǎng chī shénme miàn? Wǒmen de miàn dōu shì xiàn zuò de.',en:'What noodles would you like? Ours are all made fresh.',note:'现做 (xiàn zuò) means made on the spot, right now.'},
   foot:'白天出摊，天黑以前收摊。'},
 breakfast:{title:'早点摊',sub:'包子 · 豆浆 · 油条 · 煎饼',greeting:{zh:'包子刚出锅，热乎着呢！来几个？',pinyin:'Bāozi gāng chū guō, rèhu zhe ne! Lái jǐ ge?',en:'The buns have just come out of the steamer, nice and hot! How many would you like?',note:'出锅 (chū guō) is taking food out of the pot or steamer; 来几个 asks how many you want.'},
   foot:'白天出摊，天黑以前收摊。'},
};
// A festival's stall is named for the festival and greets you the way the snack stalls do.
for(const f of festivals.festivals)SHOPS['fest-'+f.id]={title:f.zh,sub:festivals.ui.festival.zh,greeting:market.lines.greet,foot:''};

export function openShop(ctx,shopId='chen'){
 const shop=SHOPS[shopId]??SHOPS.chen;
 // A friend's discount (陈叔叔's 九折) is already in the price, so haggling and paying both see it.
 const stock=catalog.filter(item=>shopsOf(item).includes(shopId)).map(item=>priced(ctx.profile,shopId,item));
 const body=ctx.ui.open('shop',shop.title,shop.sub);
 const vendor=vendorState(ctx.profile,shopId);
 const haggles=stock.some(i=>i.negotiable);
 body.innerHTML=`${languageLine(shop.greeting,ctx.profile.settings,{className:'shop-greeting'})}
 ${haggles?`<div class="vendor-mood mood-${vendor.key}">
   <span class="mood-face" aria-hidden="true">${vendor.face}</span>
   <div><b>${vendor.zh}</b>${languageLine(moodNote(vendor),ctx.profile.settings,{className:'mood-note'})}</div>
   <div class="rapport" title="熟悉程度"><span>熟</span><span class="rapport-bar"><i style="width:${Math.round(vendor.rapport/40*100)}%"></i></span></div>
 </div>`:''}<div id="cart-bar"></div>${haggles?'<p class="microcopy">这个摊子要一样一样地谈价钱，所以没有购物车。<br>This stall haggles one item at a time, so there is no basket here.</p>':'<p class="microcopy">可以先挑好几样，最后一起结账。<br>Pick several things, then pay for the lot in one go.</p>'}<div class="shop-grid">${stock.map(item=>{
  const inCart=cartFor(ctx,shopId).lines[item.id]??0;
  return `<div class="shop-card-wrap"><button class="shop-card" data-shop-item="${item.id}">${itemArt(item.visual)}<b>${item.zh}</b><span>${icon('coin',15)} ${item.price}</span><small>${item.negotiable?'可商量':item.nutrition?`吃了 +${item.nutrition} 饱`:'固定价格'}</small>${inCart?`<span class="card-badge">购物车 × ${inCart}</span>`:''}</button>${item.negotiable?'':`<button class="cart-add" data-add="${item.id}" aria-label="把${item.zh}加入购物车">${icon('bag',13)} 加入购物车</button>`}</div>`;
 }).join('')}</div><p class="microcopy">${shop.foot}</p>`;
 body.querySelectorAll('[data-shop-item]').forEach(b=>b.onclick=()=>openItem(ctx,stock.find(i=>i.id===b.dataset.shopItem),shopId));
 body.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{
  addToCart(cartFor(ctx,shopId),b.dataset.add);
  ctx.music?.cue('place');
  openShop(ctx,shopId);                       // redraw so the badge and the basket agree
 });
 drawCartBar(ctx,body,shopId);
}

/** One basket per shop visit. It is deliberately not saved: a shop you walked out of is finished. */
function cartFor(ctx,shopId){
 if(ctx.cart?.shop!==shopId)ctx.cart=newCart(shopId);
 return ctx.cart;
}
function drawCartBar(ctx,body,shopId){
 const bar=body.querySelector('#cart-bar');
 if(!bar)return;
 const cart=cartFor(ctx,shopId),count=cartCount(cart);
 if(!count){bar.innerHTML='';return;}
 bar.innerHTML=`<div class="cart-bar"><span class="cart-count">${count}</span>
   <div><b>购物车</b><small>共 ${cartTotal(cart)} 学习币</small></div>
   <button class="primary" id="cart-open">看看清单 ${icon('arrow',14)}</button></div>`;
 bar.querySelector('#cart-open').onclick=()=>openCart(ctx,shopId);
}

/** The itemised bill: change your mind about quantities, then pay for the lot in one go. */
function openCart(ctx,shopId){
 const shop=SHOPS[shopId]??SHOPS.chen;
 const body=ctx.ui.open('shop','购物车',shop.sub);
 const render=()=>{
  const cart=cartFor(ctx,shopId),lines=cartLines(cart),total=cartTotal(cart);
  const problem=cartProblem(ctx.profile,cart);
  body.innerHTML=`<button class="subtle" id="back-shop">← 继续逛逛</button>
   ${lines.length?`<table class="cart-table"><thead><tr><th>东西</th><th>单价</th><th>数量</th><th>小计</th></tr></thead>
     <tbody>${lines.map(line=>`<tr>
       <td><b>${esc(line.item.zh)}</b><small>${pinyinHtml(line.item.pinyin,line.item.zh)}</small></td>
       <td>${line.each}</td>
       <td><div class="stepper"><button data-less="${esc(line.item.id)}" aria-label="少一个">−</button><span>${line.quantity}</span><button data-more="${esc(line.item.id)}" aria-label="多一个">+</button></div></td>
       <td>${line.total}</td></tr>`).join('')}</tbody>
     <tfoot><tr><th colspan="3">合计 · Total</th><th>${total}</th></tr>
       <tr><td colspan="3">付款后剩下</td><td>${Math.max(0,ctx.profile.wallet-total)}</td></tr></tfoot></table>
     <button class="primary wide" id="cart-pay" ${problem?'disabled':''}>${icon('coin',15)} 一起结账 ${total}</button>
     <button class="subtle wide" id="cart-clear">清空购物车</button>
     ${problem==='funds'?'<p class="microcopy raised-note">学习币不够。去掉几样，或者先去挣一点。 / Not enough coins — take something out.</p>':''}`
    :'<p class="microcopy">购物车是空的。 / Your cart is empty.</p>'}`;
  body.querySelector('#back-shop').onclick=()=>openShop(ctx,shopId);
  body.querySelectorAll('[data-more]').forEach(b=>b.onclick=()=>{addToCart(cartFor(ctx,shopId),b.dataset.more);render();});
  body.querySelectorAll('[data-less]').forEach(b=>b.onclick=()=>{
   const cart=cartFor(ctx,shopId);setQuantity(cart,b.dataset.less,(cart.lines[b.dataset.less]??0)-1);render();
  });
  body.querySelector('#cart-clear')?.addEventListener('click',()=>{clearCart(cartFor(ctx,shopId));render();});
  body.querySelector('#cart-pay')?.addEventListener('click',()=>{
   const paid=checkout(ctx.profile,cartFor(ctx,shopId));
   if(!paid.ok)return ctx.ui.notice('暂时无法结账，请检查余额。 / Checkout could not complete.');
   recordSale(ctx,shopId,paid.lines);
   body.innerHTML=`<div class="completion"><div class="completion-seal">谢</div><h3>谢谢，欢迎再来！</h3>
     <p>${paid.lines.map(l=>`${esc(l.item.zh)} × ${l.quantity}`).join('、')}</p>
     <p class="microcopy">一共 ${paid.total} 学习币，都放进背包了。</p>
     <div class="completion-actions"><button class="primary" id="keep-shopping">继续逛逛</button><button class="secondary" id="leave-cart">回到小镇</button></div></div>`;
   body.querySelector('#keep-shopping').onclick=()=>openShop(ctx,shopId);
   body.querySelector('#leave-cart').onclick=()=>ctx.ui.close();
  });
 };
 render();
}
/** Bookkeeping shared by every multi-item sale: the basket and a spoken or built order. */
function recordSale(ctx,shopId,lines){
 if(!ctx.profile.completed.includes('purchase:first'))ctx.profile.completed.push('purchase:first');
 if(shopId==='homeware'&&!ctx.profile.completed.includes('homeware:first'))ctx.profile.completed.push('homeware:first');
 buildRapport(ctx.profile,shopId,1);
 for(const line of lines)if(line.item.nutrition)bump(ctx.profile,'bought-food',line.quantity);
 ctx.music?.cue('purchase');ctx.save();
}
function openItem(ctx,item,shopId='chen'){
 const shop=SHOPS[shopId]??SHOPS.chen;
 const body=ctx.ui.open('shop',item.zh,shop.sub);let quote=item.price,round=0;
 const vendor=vendorState(ctx.profile,shopId);
 body.innerHTML=`<button class="subtle" id="back-shop">← 继续逛逛</button><div class="product-detail">${itemArt(item.visual)}<div>${languageLine(item,ctx.profile.settings)}<p>${item.description}</p><div class="product-price">${icon('coin')} <strong id="quoted-price">${quote}</strong> <span>学习币</span></div></div></div>${item.negotiable?`<div class="negotiation"><h3>商量一下？ <small>最低 ${floorFor(item,vendor)} 左右</small></h3><div class="bargain-suggestions"><button class="choice" data-bargain="能便宜一点吗？">能便宜一点吗？</button><button class="choice" data-bargain="我只有${ctx.profile.wallet}，够吗？">我只有${ctx.profile.wallet}，够吗？</button></div><form id="offer-form"><div class="answer-row"><input id="offer" aria-label="你的出价" placeholder="例如：十八可以吗？" maxlength="80"><button type="button" id="offer-mic" class="mic-button" aria-label="麦克风出价">${icon('mic')}</button><button class="secondary" type="submit">出价</button></div></form><p id="offer-status" class="microcopy"></p><div id="vendor-answer" aria-live="polite"></div></div>`:`<p class="microcopy fixed-price">这里明码标价，不讲价。 / Prices here are fixed.</p>
   ${ordersAt(shopId)?'<div id="order-host"></div>':`<div class="item-basket" id="item-basket">
     <span class="item-basket-label">要几个？ <small>How many?</small></span>
     <div class="stepper"><button id="item-less" aria-label="少一个">−</button><span id="item-count">1</span><button id="item-more" aria-label="多一个">+</button></div>
     <button class="primary" id="item-add">${icon('bag',14)} 加入购物车</button>
   </div>`}`}<button class="${item.negotiable?'primary':'secondary'} wide" id="buy-quote">${item.negotiable?'按这个价格购买':'只买一个，马上结账'} ${icon('arrow')}</button><button class="subtle wide" id="leave-shop">谢谢，我再看看。</button><div id="confirmation"></div>`;
 body.querySelector('#back-shop').onclick=()=>openShop(ctx,shopId);body.querySelector('#leave-shop').onclick=()=>ctx.ui.close();
 // At a snack stall the quantity comes from ordering in Chinese instead of a stepper.
 if(!item.negotiable&&ordersAt(shopId))mountOrder(ctx,{body,host:body.querySelector('#order-host'),item,shopId,
  onSale:paid=>recordSale(ctx,shopId,paid.lines),back:()=>openShop(ctx,shopId)});
 // Somebody who opened an item is exactly the person who wants two of them.
 else if(!item.negotiable){
  const basket=body.querySelector('#item-basket');
  let wanted=1;
  const paint=()=>{basket.querySelector('#item-count').textContent=wanted;};
  basket.querySelector('#item-less').onclick=()=>{wanted=Math.max(1,wanted-1);paint();};
  basket.querySelector('#item-more').onclick=()=>{wanted=Math.min(20,wanted+1);paint();};
  basket.querySelector('#item-add').onclick=()=>{
   addToCart(cartFor(ctx,shopId),item.id,wanted);
   ctx.music?.cue('place');
   ctx.ui.notice(`加了 ${wanted} 个「${item.zh}」到购物车。 / Added ${wanted} to your basket.`);
   openShop(ctx,shopId);
  };
 }
 if(item.negotiable){
 const offer=text=>{
  const result=negotiate(item,quote,round,text,vendor);
  quote=result.quote;round=result.round;
  if(result.polite)buildRapport(ctx.profile,shopId,.5);
  body.querySelector('#quoted-price').textContent=quote;
  body.querySelector('#quoted-price').classList.toggle('raised',!!result.raised);
  body.querySelector('#vendor-answer').innerHTML=languageLine({zh:result.message,pinyin:result.pinyin,en:result.en},ctx.profile.settings)
   +(result.raised?'<p class="microcopy raised-note">价格反而涨了。客气一点会有帮助。 / The price went up. A polite phrase helps.</p>':'');
  body.querySelector('#confirmation').innerHTML='';
 };
 body.querySelectorAll('[data-bargain]').forEach(b=>b.onclick=()=>offer(b.dataset.bargain));body.querySelector('#offer-form').onsubmit=e=>{e.preventDefault();offer(body.querySelector('#offer').value);};
 body.querySelector('#offer-mic').onclick=()=>ctx.speech.start({onTranscript:t=>body.querySelector('#offer').value=t,onStatus:t=>body.querySelector('#offer-status').textContent=t});
 }
 body.querySelector('#buy-quote').onclick=()=>{
  ctx.speech.stop();const confirm=body.querySelector('#confirmation');
  if(ctx.profile.wallet<quote){confirm.innerHTML='<div class="feedback gentle">学习币不够。再练习一下，或者看看便宜一点的物品。</div>';return;}
  const acceptedQuote=quote;
  confirm.innerHTML=`<div class="purchase-confirm"><h3>确认购买？</h3><p>${item.zh} × 1</p><dl><div><dt>价格</dt><dd>${acceptedQuote} 学习币</dd></div><div><dt>购买后剩余</dt><dd>${ctx.profile.wallet-acceptedQuote} 学习币</dd></div></dl><button class="primary" id="confirm-purchase">确认购买</button><button class="secondary" id="cancel-purchase">取消</button></div>`;
  confirm.querySelector('#cancel-purchase').onclick=()=>confirm.innerHTML='';confirm.querySelector('#confirm-purchase').onclick=()=>{
   if(acceptedQuote!==quote)return;const result=purchase(ctx.profile,item,acceptedQuote);if(!result.ok){ctx.ui.notice('暂时无法购买，请检查余额。');return;}
   if(!ctx.profile.completed.includes('purchase:first'))ctx.profile.completed.push('purchase:first');
   if(shopId==='homeware'&&!ctx.profile.completed.includes('homeware:first'))ctx.profile.completed.push('homeware:first');
   buildRapport(ctx.profile,shopId,1);
   if(item.nutrition)bump(ctx.profile,'bought-food');
   ctx.music?.cue('purchase');
   ctx.save();
   body.innerHTML=`<div class="completion"><div class="purchased-art">${itemArt(item.visual)}</div><h3>谢谢，欢迎再来！</h3><p>${item.zh} 已放入背包。</p>${wearable(item.id)?'<button class="primary" id="equip-now">现在穿上</button>':'<button class="primary" id="back-town">回到小镇</button>'}</div>`;
   if(wearable(item.id))body.querySelector('#equip-now').onclick=()=>{ctx.town.equip(toggleWear(ctx.profile,item.id));ctx.save();ctx.ui.close();ctx.ui.notice(`${item.zh}，很适合你！`);};
   else body.querySelector('#back-town').onclick=()=>ctx.ui.close();
  };
  confirm.scrollIntoView({behavior:'smooth',block:'nearest'});
 };
}
