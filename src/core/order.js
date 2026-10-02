import catalog from '../content/catalog.json' with {type:'json'};
import balance from '../content/balance.json' with {type:'json'};
import {grant} from './economy.js';
import {folded} from './language.js';

/**
 * Ordering food in Chinese: 我要 + number + measure word + dish, then paying a total you heard.
 * The UI lives in ui/order.js; this is the part that decides what counts as right.
 */
const DIGITS=['','一','二','三','四','五','六','七','八','九'];

/** 1–99 as a vendor says it: 两 only for 2 on its own, 十 not 一十, 二十二 not 两十两. */
export function sayNumber(n){
  if(!Number.isInteger(n)||n<1||n>99)throw new RangeError(`sayNumber takes 1–99, not ${n}`);
  if(n===2)return '两';
  const tens=Math.floor(n/10),units=n%10;
  return (tens>1?DIGITS[tens]:'')+(tens?'十':'')+(units?DIGITS[units]:'');
}
export const totalText=n=>`一共${sayNumber(n)}块。`;

export const orderName=item=>item.orderName??item.zh;
export const orderText=(item,quantity)=>`我要${sayNumber(quantity)}${item.measure}${orderName(item)}。`;

// Longest first, so 小碗 wins over 碗 in the alternations below.
const longestFirst=list=>[...new Set(list)].sort((a,b)=>b.length-a.length);
const MEASURES=longestFirst(catalog.map(i=>i.measure).filter(Boolean));
const ANY_MEASURE=longestFirst(catalog.flatMap(i=>[i.measure,...(i.alsoOk??[])]).filter(Boolean)).join('|');
/** The item's own measure plus any other measure that is also natural for it (alsoOk). */
const fits=item=>longestFirst([item.measure,...(item.alsoOk??[])]);
const SPOKEN_NUMBER={'一':1,'1':1,'两':2,'2':2,'三':3,'3':3};
const NOT_AFTER='(?<![0-9一二三四五六七八九十两])';

/**
 * Does a recognised sentence order this item? Recognisers often write 2 for 两, so digits count.
 * 二 before a measure is the classic slip and gets its own reason, so the UI can show 两.
 */
export function matchSpoken(text,item){
  const said=folded(text??'').replace(/[\s，。！？、,.!?]/g,'');
  if(!said.includes(orderName(item)))return {ok:false,reason:'again'};
  const right=said.match(new RegExp(`${NOT_AFTER}([一两三123])(${fits(item).join('|')})`));
  if(right)return {ok:true,quantity:SPOKEN_NUMBER[right[1]]};
  // Four bowls or twelve bowls is not a slip of measure or of 二; the builder only goes up to three.
  const number=said.match(new RegExp(`${NOT_AFTER}([0-9一二三四五六七八九十两]+)(${ANY_MEASURE})`));
  if(number&&number[1]!=='二'&&!(number[1] in SPOKEN_NUMBER))return {ok:false,reason:'again'};
  if(new RegExp(`二(${ANY_MEASURE})`).test(said))return {ok:false,reason:'er'};
  if(new RegExp(`[一两二三四五六七八九十0-9](${ANY_MEASURE})`).test(said))return {ok:false,reason:'measure'};
  return {ok:false,reason:'again'};
}

function shuffle(list,rand=Math.random){
  for(let i=list.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
  return list;
}

// 份 and 个 fit almost any dish loosely, and 碗/盘 are both serving vessels, so none of them is
// offered as a "wrong" tile; nor is anything in the item's alsoOk list.
const LOOSE=['份','个'],DISH=/[碗盘]/;
/** The right measure and three plainly wrong ones, shuffled. */
export function measureChoices(item,rand=Math.random){
  const wrong=MEASURES.filter(m=>!fits(item).includes(m)&&!LOOSE.includes(m)&&!(DISH.test(m)&&DISH.test(item.measure)));
  return shuffle([item.measure,...shuffle(wrong,rand).slice(0,3)],rand);
}

/** The total and two amounts a learner confuses it with: 四/十 swapped (14↔40), then digits swapped (14↔41). */
export function payChoices(total,rand=Math.random){
  const swapped=sayNumber(total).replace(/[四十]/g,c=>c==='四'?'十':'四');
  const fourTen=Array.from({length:99},(_,i)=>i+1).find(m=>m!==total&&sayNumber(m)===swapped);
  const tens=Math.floor(total/10),units=total%10;
  const digits=total<10?total*10:units?units*10+tens:null;
  const near=[fourTen,digits,total+10,total-10,total+1,total-1].filter(m=>m>=1&&m<=99&&m!==total);
  return shuffle([total,...[...new Set(near)].slice(0,2)],rand);
}

/**
 * A spoken order, or a built one with no wrong tile, earns a small bonus: once per order, and each
 * kind once per game day, so a bonus as large as a cheap snack's price cannot make food free.
 */
export function orderBonus(profile,order){
  if(order.bonusPaid)return 0;
  order.bonusPaid=true;
  const kind=order.via==='spoken'?'spoken':order.via==='built'&&order.clean?'built':null;
  return kind?grant(profile,`order-bonus:${kind}:${profile.dayIndex??0}`,balance.orderBonus[kind]):0;
}
