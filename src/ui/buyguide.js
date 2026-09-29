import world from '../content/world.json' with {type:'json'};
import rooms from '../content/rooms.json' with {type:'json'};
import {escapeHtml as esc} from '../core/language.js';
import {whereToBuy} from '../core/sellers.js';
import {gateMessage} from '../core/progress.js';

/**
 * The where-to-buy map guide: opened from inside the kitchen or a build site whenever something
 * is short, it marks every seller of what is missing on a map of the whole town and offers a
 * 带路 button that hands the job to the minimap's own route (`ctx.ui.showWay`).
 */

const districtZh=id=>world.districts.find(d=>d.id===id)?.zh??'';

/** The state of the district gate a seller sits behind, if any — reused from the town's own
 *  gate check so the message here always matches the one on the gate itself. */
const gateStateFor=(ctx,districtId)=>ctx.gateStates?.find(s=>s.id===districtId);

/** Where the player is right now, for the "你在这儿" marker: their own position outdoors, or
 *  the door of whichever building they are standing inside (the kitchen counts as the house). */
function whereAmI(ctx){
  const place=ctx.town?.place;
  if(place&&place!=='town'){
    const room=rooms[place];
    if(room?.door)return {x:room.door.x,z:room.door.z};
  }
  const pos=ctx.town?.player?.entity?.getPosition?.();
  return pos?{x:pos.x,z:pos.z}:null;
}

/** The town's map, drawn straight from world.json in the minimap's own style: district rects,
 *  buildings in their roof colour, trees, the square's fountain, a numbered pin per seller. */
function mapSvg(groups,me){
  const xs=world.districts.flatMap(d=>d.bounds.x),zs=world.districts.flatMap(d=>d.bounds.z);
  const pad=4,x0=Math.min(...xs)-pad,x1=Math.max(...xs)+pad,z0=Math.min(...zs)-pad,z1=Math.max(...zs)+pad;
  const parts=world.districts.map(d=>
    `<rect x="${d.bounds.x[0]}" y="${d.bounds.z[0]}" width="${d.bounds.x[1]-d.bounds.x[0]}" height="${d.bounds.z[1]-d.bounds.z[0]}" rx="2" fill="#f6eedb"/>`);
  for(const b of world.buildings)
    parts.push(`<rect x="${b.x-b.width/2}" y="${b.z-b.depth/2}" width="${b.width}" height="${b.depth}" rx="1" fill="${b.roof}" opacity=".85"/>`);
  for(const t of world.trees)
    parts.push(`<circle cx="${t[0]}" cy="${t[1]}" r="1.1" fill="#9db98a"/>`);
  parts.push('<circle cx="0" cy="1.8" r="2.4" fill="#90b5a9"/>'); // the fountain, square only
  groups.forEach(({seller},i)=>{
    parts.push(`<g class="buy-pin"><circle cx="${seller.x}" cy="${seller.z}" r="1.7" fill="#c58a4f" stroke="#fff8de" stroke-width=".3"/>
      <text x="${seller.x}" y="${seller.z}" font-size="1.8" text-anchor="middle" dominant-baseline="central" fill="#fff8de">${i+1}</text></g>`);
  });
  if(me)parts.push(`<circle cx="${me.x}" cy="${me.z}" r="1.3" fill="#345f51" stroke="#fff8de" stroke-width=".4"/>
    <text x="${me.x}" y="${me.z-2.6}" font-size="1.7" text-anchor="middle" fill="#345f51">你在这儿</text>`);
  return `<svg viewBox="${x0} ${z0} ${x1-x0} ${z1-z0}" class="buyguide-svg">${parts.join('')}</svg>`;
}

function rowMarkup(ctx,group,index){
  const {seller,items}=group;
  const notes=[];
  const gateState=gateStateFor(ctx,seller.district);
  if(gateState&&!gateState.unlocked)notes.push(esc(gateMessage(gateState)));
  if(seller.opens&&!ctx.profile.completed.includes(seller.opens.flag))notes.push(esc(seller.opens.zh));
  if(seller.city)notes.push('在云海 · 先坐地铁 / In Yunhai — take the metro first');
  return `<article class="buy-row">
    <span class="buy-pin-number">${index+1}</span>
    <div class="buy-row-info">
      <b>${esc(seller.zh)}</b><small>${esc(districtZh(seller.district))}</small>
      <div class="buy-items">${items.map(it=>
        `<span class="buy-item">${esc(it.zh??it.id)} 还差 ${it.short} · 每个 ${it.price??'?'} 学习币</span>`).join('')}</div>
      ${notes.length?`<div class="buy-notes">${notes.map(n=>`<p class="buy-note">${n}</p>`).join('')}</div>`:''}
    </div>
    <button class="secondary" data-way="${esc(seller.shop)}">带路</button>
  </article>`;
}

/** Render the guide into an already-open panel's body. `back()` returns to whatever it replaced. */
export function openBuyGuide(ctx,body,needs,{back}={}){
  const {sellers,unsold}=whereToBuy(needs);
  const me=whereAmI(ctx);
  body.innerHTML=`<h3 class="section-title">去哪儿买 <small>WHERE TO BUY</small></h3>
    <p class="microcopy">地图上标出了卖这些东西的地方。点「带路」，小地图会带你过去。<br>
    The map marks where these are sold. Tap 带路 and the minimap leads you there.</p>
    <div class="buyguide-map">${mapSvg(sellers,me)}</div>
    <div class="buy-rows">${sellers.map((group,i)=>rowMarkup(ctx,group,i)).join('')}</div>
    ${unsold.length?`<p class="microcopy">${unsold.map(row=>esc(row.zh??row.id)).join('、')}：城里暂时买不到。<br>No shop with a door on the map sells ${unsold.length>1?'these':'this'}.</p>`:''}
    <button class="secondary wide" data-buyguide-back>返回</button>`;

  body.querySelectorAll('[data-way]').forEach(button=>button.onclick=()=>{
    const group=sellers.find(g=>g.seller.shop===button.dataset.way);
    if(!group)return;
    const seller=group.seller;
    const key=seller.city?'metro-platform':seller.shop;
    const label=seller.city?`青禾地铁站 → ${seller.zh}`:seller.zh;
    ctx.ui.showWay({key,district:seller.district,x:seller.x,z:seller.z,label,shop:seller.shop});
    ctx.ui.close();
  });
  body.querySelector('[data-buyguide-back]')?.addEventListener('click',()=>back?.());
}
