import {parseOffer} from './language.js';
import {floorFor,wasPolite} from './vendor.js';
export function grant(p,key,amount) {
  if(p.claims[key] || !Number.isSafeInteger(amount)||amount<0) return 0;
  p.claims[key]=true;p.wallet+=amount;return amount;
}
/** Pays without recording a claim, for a payout that cannot repeat anyway (see reviewWord). */
export function pay(p,amount) {
  if(!Number.isSafeInteger(amount)||amount<0) return 0;
  p.wallet+=amount;return amount;
}
/**
 * Haggle one round. Passing a `vendor` (see core/vendor.js) makes the outcome depend on their
 * mood: a sour vendor holds a higher floor, allows fewer rounds, and can put the price up if
 * you keep pushing. Called without a vendor it behaves neutrally and deterministically.
 */
export function negotiate(item,current,round,text,vendor=null,roll=Math.random) {
  if(!item.negotiable) return {quote:current,round,message:'明码标价，不讲价。',en:'This item has a fixed price.',pinyin:'Míngmǎ biāojià, bù jiǎngjià.'};
  const offer=parseOffer(text),discount=/便宜|少一点/.test(text);
  if(offer===null && !discount) return {quote:current,round,message:'您想出多少？请说一个价格。',en:'What would you offer? Please give one price.',pinyin:'Nín xiǎng chū duōshao? Qǐng shuō yí ge jiàgé.'};
  const floor=floorFor(item,vendor),maxRounds=vendor?vendor.rounds:3,give=vendor?vendor.give:3;
  const polite=wasPolite(text);
  if(round>=maxRounds) return {quote:current,round,message:'这是最后的价格了。',en:'That is my final price.',pinyin:'Zhè shì zuìhòu de jiàgé le.',polite};
  if(offer!==null && offer>=floor) return {quote:Math.min(current,offer),round:round+1,message:'好，就这个价！',en:'All right, that price works!',pinyin:'Hǎo, jiù zhège jià!',polite,deal:true};
  // A vendor in a poor mood may take offence and put the price back up.
  if(vendor&&vendor.raise>0&&round>=1&&!polite&&roll()<vendor.raise){
    const quote=Math.min(item.price,current+1+Math.floor(roll()*2));
    return {quote,round:round+1,polite,raised:true,
      message:`那算了，${quote} 吧。`,en:'Then forget it — the price is going the other way.',pinyin:`Nà suàn le, ${quote} ba.`};
  }
  // A polite ask earns a little extra, but only from a vendor who is actually listening.
  const quote=Math.max(floor,current-(vendor&&polite?give+1:give));
  return {quote,round:round+1,polite,
    message:`再便宜一点，${quote}，怎么样？`,
    en:offer===null?'A little less. How about this?':'I cannot go that low. How about this price? Your Chinese offer was understood.',
    pinyin:`Zài piányi yìdiǎn, ${quote}, zěnmeyàng?`};
}
export function purchase(p,item,quote) {
  if(!Number.isSafeInteger(quote)||quote<(item.minPrice??item.price)||quote>item.price||(!item.negotiable&&quote!==item.price)) return {ok:false,reason:'invalid'};
  if(p.wallet<quote) return {ok:false,reason:'funds'};
  if((p.inventory[item.id]??0)>=999) return {ok:false,reason:'limit'};
  p.wallet-=quote;p.inventory[item.id]=(p.inventory[item.id]??0)+1;return {ok:true};
}
