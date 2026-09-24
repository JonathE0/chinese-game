import catalog from '../content/catalog.json' with {type:'json'};
import {escapeHtml as esc} from '../core/language.js';
import {icon,itemArt} from './art.js';
import {languageLine} from './shell.js';
import {readStats,speedFactor,impression,hungerNote,energyNote,band,eat} from '../core/stats.js';
import {SLOTS,outfit,toggleWear} from '../core/inventory.js';
import {debtOf,isOverdue} from '../core/finance.js';
import {bump} from '../core/daily.js';

const byId=id=>catalog.find(item=>item.id===id);
const SLOT_NAMES={hat:{zh:'帽子',en:'Hat'},shirt:{zh:'上衣',en:'Top'},trousers:{zh:'裤子',en:'Trousers'},shoes:{zh:'鞋',en:'Shoes'}};

/** Everything about the body you are walking around in, on one page. */
export function openStatus(ctx){
  const body=ctx.ui.open('status','身体状况','状态 · YOUR CONDITION');
  render(ctx,body);
}

function bar(label,en,value,note,settings){
  const state=band(value).key;
  return `<div class="stat-row">
    <div class="stat-head"><b>${esc(label)}</b><small>${esc(en)}</small><span class="stat-value ${state}">${Math.round(value)}</span></div>
    <div class="gate-bar stat-bar ${state}"><i style="width:${Math.max(2,Math.round(value))}%"></i></div>
    ${languageLine(note,settings,{className:'stat-note'})}
  </div>`;
}

function render(ctx,body){
  const p=ctx.profile,s=readStats(p),speed=speedFactor(p);
  const look=impression(p,{overdue:isOverdue(p)});
  const debt=debtOf(p);
  const food=catalog.filter(item=>item.nutrition&&(p.inventory[item.id]??0)>0);
  const worn=outfit(p);
  body.innerHTML=`
    ${bar('肚子','Hunger',s.hunger,hungerNote(s.hunger),p.settings)}
    ${bar('精神','Rest',s.energy,energyNote(s.energy),p.settings)}
    <div class="stat-pair">
      <div class="stat-chip"><span>${icon('bolt',15)}</span><b>${Math.round(speed*100)}%</b><small>走路速度<br>Walking speed</small></div>
      <div class="stat-chip"><span>${icon('heart',15)}</span><b>${Math.round(look*100)}%</b><small>别人的印象<br>How you come across</small></div>
    </div>
    <p class="microcopy">饿了、累了都会走得慢一点；穿得体面、按时还钱，店家讲价时会松一些。<br>
      Hunger and tiredness slow you down. Being well dressed — and not owing anyone money — makes vendors easier to haggle with.</p>

    <h3 class="section-title">吃点东西 <small>EAT SOMETHING</small></h3>
    <div class="decorate-grid">${food.length?food.map(item=>`
      <button class="shop-card" data-eat="${esc(item.id)}">${itemArt(item.visual)}<b>${esc(item.zh)}</b>
        <span>+${item.nutrition} 饱</span><small>还有 ${p.inventory[item.id]} 份</small></button>`).join('')
      :'<p class="microcopy">背包里没有吃的。超市、面包店和餐厅都可以买。<br>Nothing edible in the bag — try the supermarket, the bakery or the restaurant.</p>'}</div>

    <h3 class="section-title">身上穿的 <small>WHAT YOU ARE WEARING</small></h3>
    <div class="wear-grid">${SLOTS.map(slot=>{
      const id=p.equipped?.[slot],item=id&&byId(id);
      return `<div class="wear-slot ${item?'filled':''}">
        <span class="wear-name">${SLOT_NAMES[slot].zh}<small>${SLOT_NAMES[slot].en}</small></span>
        ${item?`${itemArt(item.visual)}<b>${esc(item.zh)}</b>
          ${item.wear?.speed?`<span class="wear-bonus">+${Math.round(item.wear.speed*100)}% 速度</span>`:''}
          <button class="lookup-save" data-off="${esc(item.id)}">取下</button>`
         :'<span class="slot-empty">—</span><b>空着</b>'}</div>`;}).join('')}</div>
    <p class="microcopy">四个位置都穿上，别人会更认真地对待你。鞋子还会影响走路速度。<br>
      Filling all four slots lifts the impression you make; shoes also change how fast you walk.</p>

    ${debt?`<h3 class="section-title">欠银行的钱 <small>WHAT YOU OWE</small></h3>
      <div class="debt-card ${debt.missed?'late':''}">
        <div><b>${debt.owed}</b><span>还没还 · outstanding</span></div>
        <div><b>${debt.perDay}</b><span>每天还 · per day</span></div>
        ${debt.missed?`<p class="microcopy raised-note">已经迟了 ${debt.missed} 天，欠款每天多一成，店家也不太高兴。<br>
          ${debt.missed} missed payment${debt.missed>1?'s':''} — the balance is growing and the town has noticed.</p>`
          :'<p class="microcopy">每过一天，银行自动扣一笔。钱不够就会加罚金。<br>One instalment is taken automatically each day.</p>'}
      </div>`:'<p class="microcopy">目前没有欠款。 / You owe nothing.</p>'}`;

  body.querySelectorAll('[data-eat]').forEach(button=>button.onclick=()=>{
    const item=byId(button.dataset.eat);
    if((ctx.profile.inventory[item.id]??0)<1)return;
    ctx.profile.inventory[item.id]--;
    if(ctx.profile.inventory[item.id]<=0)delete ctx.profile.inventory[item.id];
    eat(ctx.profile,item);
    bump(ctx.profile,'meals');
    bump(ctx.profile,'ate-'+item.id);
    if(item.audio&&ctx.voice.available(item.audio))ctx.voice.play(item.audio);
    ctx.save();
    ctx.ui.notice(`吃了${item.zh}。 / Ate the ${item.en}.`);
    render(ctx,body);
  });
  body.querySelectorAll('[data-off]').forEach(button=>button.onclick=()=>{
    ctx.town.equip(toggleWear(ctx.profile,button.dataset.off));ctx.save();render(ctx,body);
  });
}
