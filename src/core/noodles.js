/**
 * 海风面馆: pricing and the pay/eat/bag steps for one bowl of noodles at the Yunhai noodle
 * counter. Pure profile mutations only — `src/ui/noodles.js` drives the dialogue and panels.
 */
import catalog from '../content/catalog.json' with {type:'json'};
import {purchase} from './economy.js';
import {eat} from './stats.js';
import {bump} from './daily.js';

const byId=id=>catalog.find(item=>item.id===id);

/** The catalog id for one order: dish (beef|egg) and size (large|small) pick one of four bowls. */
export const noodleItemId=(dish,size)=>`city-${dish}-noodles-${size}`;
export const noodleItem=(dish,size)=>byId(noodleItemId(dish,size));

/** The flag that marks the home recipe as taught. Shared by the UI and the kitchen's own gate. */
export const RECIPE_FLAG='recipe:tomato-egg-noodles';

/** The cook teaches the recipe once, for free — it does not depend on paying for a bowl. Returns
 *  whether this was the first time, so a caller only toasts and shows the line once. */
export function learnNoodleRecipe(profile){
  if(profile.completed.includes(RECIPE_FLAG))return false;
  profile.completed.push(RECIPE_FLAG);
  return true;
}

/**
 * Pay for one bowl. This is `economy.purchase` under the hood, so an order that cannot be
 * afforded changes nothing: no debit, no bowl. `where:'here'` immediately eats it — the same
 * decrement-and-restore-hunger sequence the kitchen uses for a plated meal — so "eating" means
 * the same thing everywhere; `takeaway` leaves the bowl sitting in the bag.
 */
export function orderNoodles(profile,dish,size,where){
  const item=noodleItem(dish,size);
  if(!item)return {ok:false,reason:'unknown'};
  const result=purchase(profile,item,item.price);
  if(!result.ok)return result;
  // The same generic first-purchase effect every shop sale has (a mission flag, and what opens
  // some rooms), so a bowl of noodles can be the player's first purchase too.
  if(!profile.completed.includes('purchase:first'))profile.completed.push('purchase:first');
  bump(profile,'bought-food');
  if(where==='here'){
    profile.inventory[item.id]--;
    if(profile.inventory[item.id]<=0)delete profile.inventory[item.id];
    eat(profile,item);
    bump(profile,'meals');
  }
  return {ok:true,item};
}

/**
 * The ordering conversation is over; what happens next. Teaching the recipe is a learning reward,
 * not a sale, so the first completed order always teaches it (once) before anything about money,
 * and whether the bowl then gets paid for makes no difference to it. `step` is what follows the
 * recipe line (if any): `confirm` shows the purchase confirmation, `cant-afford` the cook's line
 * saying the money is short — with nothing charged either way yet.
 */
export function startNoodleOrder(profile,{dish,size}){
  const taught=learnNoodleRecipe(profile);
  const item=noodleItem(dish,size);
  if(!item)return {taught,item:null,step:null};
  return {taught,item,step:profile.wallet<item.price?'cant-afford':'confirm'};
}

/**
 * The purchase confirmation closed. `decision` is `confirm` only when the player pressed 确认购买;
 * the cancel button, Esc and × all count as cancelling, which changes nothing. `line` is the
 * `city-noodles` extra line to show next (null when a confirmed purchase somehow fails).
 */
export function settleNoodleOrder(profile,{dish,size,where},decision){
  if(decision!=='confirm')return {ok:false,line:'cancelled'};
  const result=orderNoodles(profile,dish,size,where);
  if(!result.ok)return {ok:false,line:null,reason:result.reason};
  return {ok:true,item:result.item,line:where==='here'?'served-here':'served-takeaway'};
}
