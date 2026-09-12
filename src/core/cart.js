import catalog from '../content/catalog.json' with {type:'json'};

/**
 * A basket you fill before you pay.
 *
 * Buying one thing at a time was fine for a souvenir stall and wrong for a supermarket. This
 * holds a shop's worth of choices, prices the whole lot, and hands the till a single
 * transaction: either every line goes through or none of them does, so a checkout can never
 * leave the wallet and the bag disagreeing.
 *
 * Haggled items stay out of it on purpose. A price you talked someone down to belongs to that
 * conversation, not to a running total.
 */
const MAX_PER_LINE=20;
const MAX_OWNED=999;
const byId=id=>catalog.find(item=>item.id===id);

export const newCart=shop=>({shop,lines:{}});
export const cartCount=cart=>Object.values(cart?.lines??{}).reduce((sum,n)=>sum+n,0);

/** The basket as rows, in catalog order so it does not reshuffle as you add things. */
export function cartLines(cart){
  return catalog
    .filter(item=>cart?.lines?.[item.id]>0)
    .map(item=>({item,quantity:cart.lines[item.id],each:item.price,total:item.price*cart.lines[item.id]}));
}
export const cartTotal=cart=>cartLines(cart).reduce((sum,line)=>sum+line.total,0);

export function setQuantity(cart,id,quantity){
  const item=byId(id);
  if(!item||item.negotiable)return cart;
  const wanted=Math.max(0,Math.min(MAX_PER_LINE,Math.floor(quantity)));
  if(wanted)cart.lines[id]=wanted;else delete cart.lines[id];
  return cart;
}
export const addToCart=(cart,id,step=1)=>setQuantity(cart,id,(cart.lines[id]??0)+step);
export const clearCart=cart=>{cart.lines={};return cart;};

/** Why a basket cannot be paid for yet, or null when it can. */
export function cartProblem(profile,cart){
  const lines=cartLines(cart);
  if(!lines.length)return 'empty';
  if(cartTotal(cart)>profile.wallet)return 'funds';
  if(lines.some(line=>(profile.inventory[line.item.id]??0)+line.quantity>MAX_OWNED))return 'limit';
  return null;
}

/** Pay for the whole basket at once. Nothing moves unless everything can. */
export function checkout(profile,cart){
  const problem=cartProblem(profile,cart);
  if(problem)return {ok:false,reason:problem};
  const lines=cartLines(cart);
  const total=cartTotal(cart);
  profile.wallet-=total;
  for(const line of lines)profile.inventory[line.item.id]=(profile.inventory[line.item.id]??0)+line.quantity;
  clearCart(cart);
  return {ok:true,total,lines};
}
