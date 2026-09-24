import {friends,postcardRows,sendPostcard,sentToday} from '../core/friends.js';
import {escapeHtml as esc} from '../core/language.js';
import {languageLine} from './shell.js';
import {openBuyGuide} from './buyguide.js';

/**
 * Writing a postcard at a 邮筒: pick one tile per line, sign it and 寄出. It uses one 明信片 from
 * the bag; with none, the panel is the buy guide's way to 小小商店. The person answers the next
 * game day, when you next talk to them (core/friends.js `visit`).
 */
export function openPostcard(ctx){
 const p=ctx.profile,ui=friends.ui;
 const body=ctx.ui.open('postcard',ui.write.zh,`${ui.postcard.zh} · ${ui.write.en}`);
 if(!((p.inventory.postcard??0)>0))return openBuyGuide(ctx,body,[{id:'postcard',short:1}],{back:()=>ctx.ui.close()});
 const rows=postcardRows(p),picked=[];
 const card=()=>`<div class="postcard-card">${picked.filter(Boolean).map(t=>languageLine(t,p.settings)).join('')}<p class="postcard-name">${esc(p.playerName)}</p></div>`;
 function render(){
  const ready=rows.every((_,i)=>picked[i]);
  body.innerHTML=`${rows.map((row,i)=>`<div class="button-row postcard-row" role="group">${row.map((t,j)=>
    `<button class="choice order-tile${picked[i]===t?' picked':''}" data-row="${i}" data-tile="${j}" aria-pressed="${picked[i]===t}"${i===0&&sentToday(p,t.to)?' disabled':''}>${esc(t.zh)}</button>`).join('')}</div>`).join('')}
   ${card()}
   <button class="primary wide" id="postcard-send"${ready?'':' disabled'}>${esc(ui.send.zh)} <small>${esc(ui.send.en)}</small></button>`;
  body.querySelectorAll('[data-tile]').forEach(b=>b.onclick=()=>{picked[b.dataset.row]=rows[b.dataset.row][b.dataset.tile];render();});
  body.querySelector('#postcard-send').onclick=()=>{
   if(!ready||!sendPostcard(p,picked[0].to,picked.map(t=>t.id)))return;
   ctx.music?.cue('place');ctx.save();
   body.innerHTML=`${card()}<button class="primary wide" id="postcard-done">回到小镇</button>`;
   body.querySelector('#postcard-done').onclick=()=>ctx.ui.close();
  };
 }
 render();
}
