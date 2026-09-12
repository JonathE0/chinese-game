import catalog from '../content/catalog.json' with {type:'json'};
import {escapeHtml as esc} from '../core/language.js';
import {icon,itemArt} from './art.js';
import {languageLine} from './shell.js';
import {RECIPES,recipeById,recipeCost,preparedMealCost,cookingProblem,startCooking,collectMeal} from '../core/cooking.js';
import {readStats,eat,hungerNote} from '../core/stats.js';
import {bump} from '../core/daily.js';

/**
 * Your own stove.
 *
 * Eating out is the convenient thing and it should stay convenient — but a bought bowl of
 * noodles only takes the edge off, and getting from starving to full costs about sixteen coins
 * of restaurant food. Groceries are cheap and dull on their own; put two or three of them
 * together on your own stove and you get a whole meal for seven to ten, and it fills you
 * completely. That gap is the point of this panel, so the panel says it out loud on every card
 * rather than leaving the player to work it out.
 *
 * The cost of the shortcut is time. A pot takes twenty to thirty-five seconds of real play, and
 * those seconds are counted in the frame loop, not on the wall clock — so sleeping through it,
 * reloading, or leaving the tab does not cook your dinner for you. You can walk away while it
 * simmers; the town tells you when it is ready.
 */
const byId=id=>catalog.find(item=>item.id===id);
const COOK_LINE={zh:'今天想做点什么？',pinyin:'Jīntiān xiǎng zuò diǎn shénme?',en:'What shall we cook today?',
  note:'做饭 (zuòfàn) is to cook a meal — literally to make rice. 做菜 is to cook a dish.'};
const READY_LINE={zh:'饭好了，快趁热吃。',pinyin:'Fàn hǎo le, kuài chèn rè chī.',en:'It is ready — eat it while it is hot.',
  note:'趁热 (chèn rè) means while it is still hot; 趁 marks taking advantage of a moment.'};

export function openKitchen(ctx){
  const body=ctx.ui.open('kitchen','做饭','厨房 · HOME KITCHEN');
  render(ctx,body);
  // The pot keeps simmering while you stand at it, so the panel has to keep counting down.
  const timer=setInterval(()=>{
    if(ctx.ui.panelId!=='kitchen')return clearInterval(timer);
    const job=ctx.profile.cooking;
    if(!job)return;
    const bar=body.querySelector('[data-pot-bar]');
    if(!bar)return render(ctx,body);
    const recipe=recipeById(job.recipe);
    const left=Math.ceil(job.remaining);
    if(left<=0)return render(ctx,body);                 // it finished under our hands
    bar.style.width=Math.round((1-job.remaining/recipe.seconds)*100)+'%';
    body.querySelector('[data-pot-left]').textContent=`还要 ${left} 秒 · ${left}s to go`;
  },250);
}

/** One row per ingredient: what it is, how many the recipe wants, how many are in the bag. */
function needRow(profile,id,count){
  const item=byId(id),held=profile.inventory[id]??0;
  return `<span class="need ${held>=count?'have':'short'}">${esc(item?.zh??id)} ×${count}
    <small>${held>=count?'✓':`还差 ${count-held}`}</small></span>`;
}

function render(ctx,body){
  const p=ctx.profile,job=p.cooking,stats=readStats(p);
  const eating=catalog.filter(item=>item.nutrition>=100&&(p.inventory[item.id]??0)>0);
  const outside=preparedMealCost();

  const pot=job?potMarkup(recipeById(job.recipe),job):'';
  body.innerHTML=`${languageLine(job&&job.remaining<=0?READY_LINE:COOK_LINE,p.settings,{className:'dialogue-line'})}
    <div class="kitchen-hunger">
      <div class="stat-head"><b>肚子</b><small>HUNGER</small><span class="stat-value">${Math.round(stats.hunger)}</span></div>
      <div class="gate-bar stat-bar"><i style="width:${Math.max(2,Math.round(stats.hunger))}%"></i></div>
      ${languageLine(hungerNote(stats.hunger),p.settings,{className:'stat-note'})}
    </div>
    ${pot}
    ${eating.length?`<h3 class="section-title">做好的饭 <small>READY TO EAT</small></h3>
      <div class="decorate-grid">${eating.map(item=>`
        <button class="shop-card" data-eat="${esc(item.id)}">${itemArt(item.visual)}<b>${esc(item.zh)}</b>
          <span>吃饱 · fills you up</span><small>还有 ${p.inventory[item.id]} 份</small></button>`).join('')}</div>`:''}

    <h3 class="section-title">菜谱 <small>RECIPES</small></h3>
    <div class="recipe-list">${RECIPES.map(recipe=>{
      const dish=byId(recipe.output),cost=recipeCost(recipe),reason=cookingProblem(p,recipe);
      const locked=reason==='locked';
      return `<article class="recipe-card ${reason==='ingredients'?'short':''}${locked?' locked':''}">
        <div class="recipe-art">${itemArt(dish?.visual??'soup')}</div>
        <div class="recipe-info">
          ${languageLine(recipe,p.settings)}
          ${locked?'<p class="microcopy">去云海的海风面馆学吧 / Learn it at the noodle house in Yunhai.</p>':`
          <div class="recipe-needs">${Object.entries(recipe.ingredients).map(([id,count])=>needRow(p,id,count)).join('')}</div>
          <div class="recipe-value">
            <span>${icon('coin',13)} 材料 ${cost}</span>
            <span class="recipe-save">买现成的要 ${outside} · saves ${outside-cost}</span>
            <span>${icon('clock',13)} ${recipe.seconds} 秒</span>
          </div>`}
        </div>
        <button class="${reason?'secondary':'primary'} recipe-go" data-cook="${esc(recipe.id)}" ${reason?'disabled':''}>
          ${reason==='busy'?'锅在用':reason==='ingredients'?'材料不够':locked?'还没学会':'开火'}</button>
      </article>`;}).join('')}</div>

    <p class="microcopy">食材在青禾超市买，一顿自己做的饭能把肚子填满，比在外面吃便宜一半。做饭要一点时间，火开着也可以先去忙别的。<br>
      Groceries come from the supermarket. One home-cooked meal fills you completely for
      roughly half what the same amount of restaurant food costs. Cooking takes a little real
      time, and you are free to walk away while it is on the stove.</p>`;

  body.querySelectorAll('[data-cook]').forEach(button=>button.onclick=()=>{
    if(!startCooking(p,button.dataset.cook).ok)return;
    ctx.cookClock=ctx.town?.clock;                       // start counting from now, not from load
    ctx.music?.cue('place');ctx.save();
    ctx.ui.notice(`${recipeById(button.dataset.cook).zh}下锅了。 / It is on the stove.`);
    render(ctx,body);
  });
  body.querySelector('[data-collect]')?.addEventListener('click',()=>{
    const got=collectMeal(p);
    if(!got.ok)return;
    ctx.music?.cue('reward');ctx.save();
    ctx.ui.notice(`${byId(got.item)?.zh??'饭'}盛好了。 / Served up.`);
    render(ctx,body);
  });
  body.querySelectorAll('[data-eat]').forEach(button=>button.onclick=()=>{
    const item=byId(button.dataset.eat);
    if((p.inventory[item.id]??0)<1)return;
    p.inventory[item.id]--;
    if(p.inventory[item.id]<=0)delete p.inventory[item.id];
    eat(p,item);bump(p,'meals');ctx.save();
    ctx.ui.notice(`吃饱了。 / You are full.`);
    render(ctx,body);
  });
}

/** The pot on the stove: what is in it, how far along it is, and the plate when it is done. */
function potMarkup(recipe,job){
  const done=job.remaining<=0,left=Math.ceil(job.remaining);
  return `<div class="pot-card ${done?'done':''}">
    <div class="pot-art">${itemArt(done?'soup':'noodles')}</div>
    <div class="pot-info">
      <b>${done?'做好了':'正在做'}：${esc(recipe.zh)}</b>
      <div class="gate-bar pot-bar"><i data-pot-bar style="width:${Math.round((1-job.remaining/recipe.seconds)*100)}%"></i></div>
      <span data-pot-left>${done?'可以盛出来了 · ready to serve':`还要 ${left} 秒 · ${left}s to go`}</span>
    </div>
    ${done?'<button class="primary" data-collect>盛出来</button>':''}
  </div>`;
}
