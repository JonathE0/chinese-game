import data from '../content/rental.json' with {type:'json'};
import {leaseStatus,quoteLease,rentApartment,rentalAccess} from '../core/rental.js';
import {openDialogue} from './dialogue.js';
import {storeRoomFurniture} from './decorate.js';
export function openRental(ctx){
 const p=ctx.profile,s=leaseStatus(p),q=quoteLease(p),body=ctx.ui.open('rental',data.name,'YOUR CITY HOME · RENTAL DESK');
 body.innerHTML=`<p>A temporary home across the water. Rent includes a bed; bring your own furniture to decorate.</p><div class="fare-state">${s.active?s.days+' in-game days remaining':s.held?'Lease expired — belongings safely stored':'No active lease'}</div><p><b>${q.cost} coins for ${q.days} in-game days</b>. Pay in advance. No automatic renewal or rent while the game is closed. Wallet: ${p.wallet}.</p><p>Expiry pauses sleeping and decorating here. Your furniture stays yours. Your grandfather’s Qinghe home remains available.</p><button class="primary wide" id="rental-confirm">${s.active?'Renew':'Rent'} · Pay ${q.cost} coins</button>${s.active?'<button class="secondary wide" id="rental-enter">Enter Apartment 101</button>':''}<button class="secondary wide" id="rental-recover">Put my apartment furniture back in my inventory</button><button class="secondary wide" id="rental-practice">Practise asking for a room · 租房</button><p class="microcopy">Need more coins? Keep studying from your journal or word review. The ferry still requires its usual fare.</p>`;
 body.querySelector('#rental-confirm').onclick=e=>{if(ctx.profile!==p)return;e.target.disabled=true;const result=rentApartment(p,q.revision);if(!result.ok){ctx.ui.notice(result.reason==='money'?'Not enough coins. Study to earn rent.':'Lease changed. Check the updated details.');return openRental(ctx);}ctx.save();ctx.ui.notice('Rent paid. Apartment 101 is ready.');openRental(ctx);};
 body.querySelector('#rental-enter')?.addEventListener('click',()=>{if(!rentalAccess(ctx.profile,data.id))return openRental(ctx);ctx.ui.close();ctx.town.enterRoom(data.id);ctx.syncPlace?.();});
 body.querySelector('#rental-recover').onclick=()=>{if(ctx.profile!==p)return;storeRoomFurniture(ctx,data.id);ctx.ui.notice('Your furniture is available in inventory.');};
 body.querySelector('#rental-practice').onclick=()=>openDialogue(ctx,data.lesson.id,{lessonData:data.lesson,reward:false,englishSupport:true,onFinish:()=>openRental(ctx)});
}
export function installRental(ctx){ctx.town.rentalAllowed=place=>rentalAccess(ctx.profile,place);}
