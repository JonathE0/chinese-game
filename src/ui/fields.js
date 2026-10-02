import fields from '../content/fields.json' with {type:'json'};
import catalog from '../content/catalog.json' with {type:'json'};
import objects from '../content/objects.json' with {type:'json'};
import {openDialogue,showLine} from './dialogue.js';
import {languageLine,pinyinText} from './shell.js';
import {icon,itemArt} from './art.js';
import {escapeHtml as esc} from '../core/language.js';
import {bump} from '../core/daily.js';
import {sell} from '../core/resale.js';
import {ROD_LESSON,CAUGHT_FLAG,FISH_FLAG,biteAfter,reelResult,fishFor,landFish,fishLeft,basketRight,pickInto,putBack,harvest} from '../core/fields.js';

/**
 * Playing 青禾田园's two errands (docs/superpowers/specs/2026-10-01-fields-design.md; rules in
 * src/core/fields.js, the scene in src/world/fields.js): talking to 王爷爷 and 刘奶奶, the fishing
 * mini-game off the pier, picking into 刘奶奶's basket and selling fish where food is bought.
 */
const UI=fields.ui,NOTE=fields.fishing.notices,NAMES=objects.objects;
/** A line for a notice: Chinese first, then English unless it is switched off; an English-only
 *  placeholder (fields.json `ui`, waiting for vetted Chinese) shows its English. */
const say=(ctx,l)=>!l.zh?l.en:ctx.profile.settings.english===false?l.zh:`${l.zh} / ${l.en}`;

/** E on someone or something out in the fields; false if the id is not one of ours. */
export function fieldsAction(ctx,id){
  if(id==='wang'){bump(ctx.profile,'talks');talkWang(ctx);return true;}
  if(id==='liu'){bump(ctx.profile,'talks');talkLiu(ctx);return true;}
  if(id==='fish'){openFishing(ctx);return true;}
  if(id.startsWith('veg:')){pick(ctx,id.slice(4));return true;}
  return false;
}

/** 王爷爷: the rod and how to fish first; once a fish is in the bag he wants to see it (that
 *  finishes the mission); after that his first chat again, for practice. */
function talkWang(ctx){
  const done=()=>ctx.profile.completed;
  if(done().includes(CAUGHT_FLAG)&&!done().includes(FISH_FLAG))
    return openDialogue(ctx,'fishing-wang-show',{onFinish:()=>{if(!done().includes(FISH_FLAG)){done().push(FISH_FLAG);ctx.save();}}});
  openDialogue(ctx,ROD_LESSON,{onFinish:()=>{if(!done().includes(CAUGHT_FLAG))ctx.ui.notice(say(ctx,UI.castHere));}});
}

/** 刘奶奶: what she needs picked; then, basket in hand, either her thanks or what is still wrong. */
function talkLiu(ctx){
  const basket=ctx.fields?.basket;
  if(!basket)return openDialogue(ctx,'veggies-liu',{onFinish:()=>startPicking(ctx)});
  if(!basketRight(basket))return showLine(ctx,'veggies-liu-check','wrong');
  openDialogue(ctx,'veggies-liu-check',{onFinish:()=>{
    const {coins,items}=harvest(ctx.profile);
    stopPicking(ctx);
    const got=Object.entries(items).map(([id,n])=>`${catalog.find(i=>i.id===id).zh} ×${n}`);
    if(coins||got.length)ctx.ui.notice([coins?`+${coins} 学习币`:'',...got].filter(Boolean).join(' · '));
    ctx.save();
  }});
}

// ── Picking into the basket ────────────────────────────────────────────────────────────────────
function startPicking(ctx){
  ctx.fields={basket:{}};ctx.town.fields.state.picking=true;
  drawBasket(ctx);ctx.ui.notice(say(ctx,UI.pickHint));
}
function stopPicking(ctx){ctx.fields=null;ctx.town.fields.state.picking=false;drawBasket(ctx);}
function pick(ctx,veg){
  if(!ctx.fields?.basket||!NAMES[veg])return;
  pickInto(ctx.fields.basket,veg);ctx.music?.cue('place');drawBasket(ctx);
}
/** The basket on screen: what is in it, each with a button to put one back. */
function drawBasket(ctx){
  let el=document.querySelector('#fields-basket');
  const basket=ctx.fields?.basket;
  if(!basket){if(el)el.hidden=true;return;}
  if(!el){
    el=document.createElement('aside');el.id='fields-basket';el.className='fields-basket';
    (document.querySelector('#app')??document.body).append(el);   // with the HUD, under any open panel
    el.addEventListener('click',e=>{
      const id=e.target.closest('[data-back]')?.dataset.back;
      if(id&&ctx.fields?.basket){putBack(ctx.fields.basket,id);drawBasket(ctx);}
    });
  }
  const english=ctx.profile.settings.english!==false,rows=Object.entries(basket);
  el.setAttribute('aria-label',NAMES.basket.zh);
  el.innerHTML=`<b>${esc(NAMES.basket.zh)}${english?` <small>${esc(NAMES.basket.en)}</small>`:''}</b>`+(rows.length?`<ul>${rows.map(([id,n])=>
    `<li><span>${esc(NAMES[id].zh)}${english?` <small>${esc(NAMES[id].en)}</small>`:''}</span><em>×${n}</em><button type="button" data-back="${esc(id)}" aria-label="${esc(UI.putBack.en)}: ${esc(NAMES[id].zh)}" title="${esc(UI.putBack.en)}">−</button></li>`).join('')}</ul>`:'<p>—</p>');
  el.hidden=false;
}

// ── Fishing ────────────────────────────────────────────────────────────────────────────────────
/**
 * Cast from the end of the pier: the float bobs, dips after a random wait (鱼上钩了！), and a click,
 * a tap, Space or Enter within the window lands the fish; too early or too late and it gets away.
 * The town is paused meanwhile, and every key is the mini-game's (Esc puts the rod down).
 */
export function openFishing(ctx){
  const p=ctx.profile,town=ctx.town;
  if(ctx.fishing||ctx.ui.panelId)return;
  if(!p.completed.includes(ROD_LESSON))return ctx.ui.notice(say(ctx,UI.needRod));
  if(fishLeft(p)<=0)return ctx.ui.notice(say(ctx,UI.tired));
  const spot=fields.fishingSpot,pos=town.player.entity.getPosition();
  town.setPaused(true);town.yaw=spot.yaw;town.pitch=spot.pitch;
  town.fields.fishing.cast(pos.x,pos.y,pos.z);
  const bite=biteAfter(),start=performance.now(),el=document.createElement('div');
  el.className='fishing';el.setAttribute('role','dialog');el.setAttribute('aria-label',UI.fish.zh);
  el.innerHTML=`<div class="fishing-state" aria-live="assertive"></div><p class="fishing-hint">${esc(UI.reelHint.en)}</p><button type="button" class="primary fishing-reel">${esc(UI.reel.en)}</button>`;
  document.body.append(el);el.querySelector('.fishing-reel').focus({preventScroll:true});
  let dipped=false,over=false,raf=0;
  const finish=result=>{
    if(over)return;over=true;
    cancelAnimationFrame(raf);removeEventListener('keydown',onKey,true);el.remove();
    town.fields.fishing.clear();ctx.fishing=null;town.setPaused(false);
    if(result==='caught'){
      const first=!p.completed.includes(CAUGHT_FLAG),id=fishFor(p),fish=catalog.find(i=>i.id===id);
      landFish(p,id);ctx.music?.cue('reward');ctx.save();
      const english=p.settings.english!==false;
      ctx.ui.notice(`${NOTE.caught.zh} ${fish.zh} ${[pinyinText(fish.pinyin,fish.zh),english?fish.en:''].filter(Boolean).join(' · ')}${first?' — '+UI.showWang.en:''}`);
    } else if(result!=='cancel')ctx.ui.notice(say(ctx,NOTE.away));
  };
  const reel=()=>finish(reelResult((performance.now()-start)/1000,bite));
  const onKey=e=>{
    e.preventDefault();e.stopImmediatePropagation();
    if(e.repeat)return;
    if(e.key==='Escape')return finish('cancel');
    if(e.code==='Space'||e.key==='Enter')reel();
  };
  addEventListener('keydown',onKey,true);
  el.addEventListener('pointerdown',e=>{e.preventDefault();reel();});
  const tick=()=>{
    const t=(performance.now()-start)/1000;
    if(!dipped&&t>=bite){
      dipped=true;town.fields.fishing.dip();el.classList.add('bite');
      el.querySelector('.fishing-state').innerHTML=languageLine(NOTE.bite,p.settings,{className:'fishing-bite',help:false});
    }
    if(dipped&&reelResult(t,bite)==='late')return finish('late');
    raf=requestAnimationFrame(tick);
  };
  raf=requestAnimationFrame(tick);
  ctx.fishing={finish};
}

// ── Selling the catch where food is bought ─────────────────────────────────────────────────────
/** Under a shop's goods, the fish in the bag it buys (catalog `buyer`), each sold at its price. */
export function mountCatch(ctx,shopId,body,redraw){
  const fish=catalog.filter(i=>i.buyer===shopId&&(ctx.profile.inventory[i.id]??0)>0);
  if(!fish.length)return;
  const section=document.createElement('div');section.className='shop-catch';
  section.innerHTML=`<p class="microcopy">${esc(UI.sell.en)}</p><div class="shop-grid">${fish.map(i=>
    `<button class="shop-card" data-sell-catch="${esc(i.id)}">${itemArt(i.visual)}<b>${esc(i.zh)}</b><span>${icon('coin',15)} ${i.price}</span><small>× ${ctx.profile.inventory[i.id]}</small></button>`).join('')}</div>`;
  body.append(section);
  section.querySelectorAll('[data-sell-catch]').forEach(b=>b.onclick=()=>{
    const item=catalog.find(i=>i.id===b.dataset.sellCatch),result=sell(ctx.profile,item,item.price);
    if(!result.ok)return ctx.ui.notice('这件卖不了。 / That one cannot be sold.');
    ctx.save();ctx.ui.notice(`卖掉了${item.zh}，+${result.price} 学习币。 / Sold for ${result.price}.`);
    redraw();
  });
}
