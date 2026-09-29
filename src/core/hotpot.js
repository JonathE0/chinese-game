import catalog from '../content/catalog.json' with {type:'json'};
import hotpot from '../content/hotpot.json' with {type:'json'};
import {newCart,setQuantity,cartLines,cartTotal,clearCart} from './cart.js';
import {sayNumber} from './order.js';
import {eat} from './stats.js';
import {bump} from './daily.js';

/**
 * 山城老火锅: what a sitting at the hotpot terrace owes and has eaten. The UI (ui/hotpot.js)
 * drives the conversation; this decides what counts.
 *
 * Like a real hotpot restaurant you order in rounds and pay once at the end. A round (下单) moves
 * the basket onto the bill and is eaten there and then; it is only accepted while the whole bill
 * would still be affordable, so the bill can always be paid. The open bill is kept on the profile
 * (`profile.hotpot`, id → count) so it follows its own save: a reload or a save swap cannot drop
 * it or hand it to someone else.
 */
const byId=new Map(catalog.map(item=>[item.id,item]));
export const menuOf=categoryId=>(hotpot.categories.find(c=>c.id===categoryId)?.items??[]).map(id=>byId.get(id));
export const BROTHS=hotpot.categories.find(c=>c.id==='broth').items;

/** This round's basket, and the spice level asked for. Neither costs anything until 下单. */
export const newTable=()=>({cart:newCart('hotpot'),spice:null});
const bill=profile=>({lines:profile.hotpot??{}});
export const billLines=profile=>cartLines(bill(profile));
export const billTotal=profile=>cartTotal(bill(profile));
export const hasBroth=(profile,table)=>BROTHS.some(id=>profile.hotpot?.[id]||table.cart.lines[id]);
/** A broth is only offered while it still fits in what the wallet has left after the bill. */
export const brothAffordable=(profile,item)=>item.price<=profile.wallet-billTotal(profile);

/** One broth per pot: picking another replaces the one in the basket. */
export function pickBroth(table,id){
  if(!BROTHS.includes(id))return false;
  for(const other of BROTHS)setQuantity(table.cart,other,0);
  setQuantity(table.cart,id,1);
  return true;
}

/** 下单. `noodles` says whether this round calls the noodle chef. */
export function placeOrder(profile,table){
  const lines=cartLines(table.cart);
  if(!lines.length)return {ok:false,reason:'empty'};
  if(!hasBroth(profile,table))return {ok:false,reason:'broth'};
  if(billTotal(profile)+cartTotal(table.cart)>profile.wallet)return {ok:false,reason:'short'};
  profile.hotpot??={};
  for(const {item,quantity} of lines){
    profile.hotpot[item.id]=(profile.hotpot[item.id]??0)+quantity;
    for(let i=0;i<quantity;i++)eat(profile,item);
  }
  clearCart(table.cart);
  bump(profile,'meals');
  return {ok:true,lines,noodles:lines.some(line=>line.item.id===hotpot.noodles)};
}

/** 买单: the whole bill at once, or nothing at all. */
export function payBill(profile){
  const total=billTotal(profile);
  if(!total)return {ok:false,reason:'empty'};
  if(total>profile.wallet)return {ok:false,reason:'short'};
  profile.wallet-=total;
  delete profile.hotpot;
  if(!profile.completed.includes('purchase:first'))profile.completed.push('purchase:first');
  return {ok:true,total};
}

/** 一碗米饭, 两份肥牛: the number and measure word the way the order is read back. */
export const orderLabel=(item,quantity)=>`${quantity<100?sayNumber(quantity):quantity}${item.measure}${item.zh}`;
