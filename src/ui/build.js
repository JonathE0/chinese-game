import {escapeHtml as esc} from '../core/language.js';
import {icon,itemArt} from './art.js';
import {languageLine,pinyinWith} from './shell.js';
import {siteById,requirements,siteState,completion,contribute,raise,isBuilt} from '../core/construction.js';
import {holdsPermit} from '../core/finance.js';
import {openBuyGuide} from './buyguide.js';

/**
 * The hoarding around a build site.
 *
 * Everything about this panel is meant to make the shape of the job obvious at a glance: the
 * paperwork you still need, the pile you still owe, and how far along the whole thing is. You
 * hand materials over as you get them, so a site is somewhere you come back to rather than a
 * single expensive click.
 */
const FOREMAN={zh:'材料齐了就能动工。',pinyin:'Cáiliào qí le jiù néng dònggōng.',
  en:'Once the materials are all here, we can start.',
  note:'齐 (qí) means complete, all present — 材料齐了 is what a foreman says when nothing is missing.'};

export function openSite(ctx,siteId){
  const site=siteById(siteId);
  if(!site)return;
  const body=ctx.ui.open('site',site.zh,'工地 · BUILD SITE');
  render(ctx,body,site);
}

function render(ctx,body,site){
  const state=siteState(ctx.profile,site),rows=requirements(ctx.profile,site);
  const done=Math.round(completion(ctx.profile,site)*100);

  if(state==='built'){
    body.innerHTML=`${languageLine({zh:'盖好了，欢迎光临。',pinyin:'Gài hǎo le, huānyíng guānglín.',
      en:'It is built. Come in whenever you like.'},ctx.profile.settings,{className:'dialogue-line'})}
      <div class="completion"><div class="completion-seal">成</div><h3>${esc(site.zh.replace('工地',''))}开门了</h3>
      <p class="microcopy">每天早上会有一点营业收入进你的钱包。<br>
        A little of the day's takings reaches your wallet each morning.</p></div>`;
    return;
  }

  body.innerHTML=`${languageLine(FOREMAN,ctx.profile.settings,{className:'dialogue-line'})}
    <p class="panel-intro">${esc(site.blurb)}<br>${esc(site.blurbEn)}</p>
    <div class="site-progress"><div class="gate-bar"><i style="width:${done}%"></i></div>
      <span>${done}% · ${esc(site.en)}</span></div>

    <h3 class="section-title">先办执照 <small>PAPERWORK FIRST</small></h3>
    <div class="site-permit ${holdsPermit(ctx.profile,site.permit)?'held':''}">
      ${holdsPermit(ctx.profile,site.permit)
        ?`${icon('check',16)} 商铺执照已办好。 / The shop permit is in hand.`
        :`${icon('book',16)} 还需要商铺执照，去青禾银行办。 / You still need a shop permit from the bank.`}
    </div>

    <h3 class="section-title">材料 <small>MATERIALS</small></h3>
    <div class="site-rows">${rows.map(row=>`
      <article class="site-row ${row.short<=0?'done':''}">
        <div class="site-art">${itemArt(row.item?.visual??'postcard')}</div>
        <div class="site-info">
          <b>${esc(row.item?.zh??row.id)}</b>
          <small>${pinyinWith(row.item?.pinyin,row.item?.zh,row.item?.en)}</small>
          <div class="gate-bar site-bar"><i style="width:${Math.round(row.done/row.count*100)}%"></i></div>
          <span class="site-count">${row.done} / ${row.count}${row.held?` · 身上有 ${row.held}`:''}</span>
        </div>
        ${row.short<=0?`<span class="site-tick">${icon('check',15)}</span>`
          :`<button class="secondary" data-give="${esc(row.id)}" ${row.held?'':'disabled'}>
             交 ${Math.min(row.short,row.held)}</button>`}
      </article>`).join('')}</div>
    ${rows.some(row=>row.short-row.held>0)?`<button class="secondary wide buy-guide-btn" id="buy-guide">哪儿有卖<small>where to buy</small></button>`:''}
    <p class="microcopy">交出去的材料收不回来。木料、砖和布匹在家居小铺有卖，帮工地干活也会给一些。<br>
      Materials handed over are gone for good. The builders' merchant at 家居小铺 sells all three,
      and helping on site as a daily errand earns you some.</p>
    ${state==='ready'?'<button class="primary wide" id="raise-it">动工！ · Break ground</button>'
      :`<button class="primary wide" disabled>${state==='permit'?'先去银行办执照':'材料还没齐'}</button>`}`;

  body.querySelectorAll('[data-give]').forEach(button=>button.onclick=()=>{
    const moved=contribute(ctx.profile,site,button.dataset.give);
    if(!moved)return;
    ctx.music?.cue('place');ctx.save();
    ctx.ui.notice(`交了 ${moved} 份材料。 / Handed over ${moved}.`);
    render(ctx,body,site);
  });
  body.querySelector('#buy-guide')?.addEventListener('click',()=>{
    // What is still to buy: owed to the site, less what you are already carrying.
    const needs=rows.filter(row=>row.short-row.held>0).map(row=>({id:row.id,short:row.short-row.held}));
    openBuyGuide(ctx,body,needs,{back:()=>render(ctx,body,site)});
  });
  body.querySelector('#raise-it')?.addEventListener('click',()=>{
    const result=raise(ctx.profile,site);
    if(!result.ok)return;
    ctx.music?.cue('reward');ctx.save();
    ctx.town.revealSite?.(site.id);
    ctx.ui.notice(`${site.zh.replace('工地','')}盖好了！ / It is built.`);
    render(ctx,body,site);
  });
}

export {isBuilt};
