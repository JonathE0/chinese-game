import mall from '../content/mall.json' with {type:'json'};
import signs from '../content/signs.json' with {type:'json'};
import {escapeHtml as esc} from '../core/language.js';

/** 星光百货's lift (task Y-mall): choose a floor and the glass car takes you there (src/world/mall.js). */
export function openMall(ctx,what){
  const lift=ctx.town.rooms.get('mall')?.lift;
  if(what!=='lift'||!lift)return;
  const said=signs.signs[mall.signs.lift],here=lift.floorOf(ctx.town.playerY);
  const body=ctx.ui.open('mall-lift',mall.signs.lift,[said.pinyin,said.en].join(' · '));
  body.innerHTML=`<div class="button-row">${mall.signs.floors.map((zh,i)=>{
    const floor=signs.signs[zh];
    return `<button class="${i===here?'secondary':'primary'}" data-floor="${i}"${i===here?' disabled':''}>${esc(zh)} <small>${esc(floor.pinyin)} · ${esc(floor.en)}</small></button>`;
  }).join('')}</div>`;
  for(const button of body.querySelectorAll('[data-floor]'))
    button.onclick=()=>{ctx.ui.armClose(()=>lift.ride(Number(button.dataset.floor)));ctx.ui.close();};
  body.querySelector('button:not([disabled])')?.focus();
}
