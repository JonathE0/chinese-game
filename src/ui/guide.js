import {icon} from './art.js';
import {languageLine} from './shell.js';
import {fillKeys} from '../core/keys.js';

/**
 * The poster by the door at home.
 *
 * Everything here is something the player was told once, in a tutorial, on their first visit —
 * which is exactly when it is least likely to stick. The poster is the copy you can walk back
 * to. Sections open one at a time so it stays a poster and not a manual.
 */
const SECTIONS=[
  {id:'furnish',zh:'怎么布置房间',pinyin:'Zěnme bùzhì fángjiān',en:'How to furnish this room',
   body:`<p>站在房间里按 <kbd>{interact}</kbd>，选「布置房间」。<br><b>Stand anywhere in the room and press {interact}, then choose 布置房间.</b></p>
   <ul>
     <li><b>按位置订购。</b>每件家具都有自己的位置：床位、五斗柜、衣柜、灯……点一个位置，挑一件，直接送到房间里。<br>
       <small>Pick a spot, pick a piece. It is delivered straight into the room — nothing to carry home.</small></li>
     <li><b>自己摆放。</b>在「自由摆放」里选一件，走到想放的地方，<kbd>点击</kbd> 放下，<kbd>{rotate}</kbd> 转向，<kbd>{cancel}</kbd> 取消。绿色表示放得下。<br>
       <small>Green pad means it fits; red means step back or turn it.</small></li>
     <li><b>收起来。</b>在「布置房间」里点那件家具的「收起」，它就回到背包。<br>
       <small>Anything you placed can go back in the bag.</small></li>
   </ul>`},
  {id:'buy',zh:'东西在哪里买',pinyin:'Dōngxi zài nǎlǐ mǎi',en:'Where to buy things',
   body:`<ul>
     <li><b>家居小铺</b>（广场西边）— 床、桌子、椅子、地毯、鞋。刚开始需要的都在这里。<br>
       <small>Home goods, west side of the square. The basics for your room, open from day one.</small></li>
     <li><b>生活馆</b>（商业街）— 家具、文具、衣服。<small>Furniture, stationery and clothes, once the shopping street opens.</small></li>
     <li><b>青禾灯具</b>（商业街）— 灯。天黑以后房间真的会暗，灯是有用的。<br>
       <small>Lighting. Rooms genuinely go dark at night; a lamp is not decoration.</small></li>
     <li><b>旧物铺</b>（广场东边）— 卖掉不要的东西。价格每天不一样。<br>
       <small>Sell what you no longer want. The offer is rerolled once a day.</small></li>
     <li><b>青禾银行</b>（广场西边）— 借钱，也还钱。<small>Borrow, and pay it back daily.</small></li>
   </ul>
   <p class="microcopy">买东西：走到柜台按 <kbd>{interact}</kbd>，挑一件，确认。陈叔叔的小摊可以讲价，商店不行。</p>`},
  {id:'learn',zh:'怎么学词',pinyin:'Zěnme xué cí',en:'How the learning works',
   body:`<ul>
     <li>看着任何东西按 <kbd>{collect}</kbd>，就记住了它的名字，它会进你的生词本。<br>
       <small>Look at anything and press {collect}. It goes into your word bank.</small></li>
     <li>回家坐到<b>书桌</b>前按 <kbd>{interact}</kbd>，复习收集到的词。<br><small>The study desk reviews everything you collected.</small></li>
     <li><b>词语馆</b>里有整套 HSK 词表，按级复习。<small>The word hall has the full HSK lists.</small></li>
     <li>城门要认识够多这一级的词才会开。两种方式都算数。<br>
       <small>District gates open on how many words of a level you know — drilling and naming both count.</small></li>
   </ul>`},
  {id:'living',zh:'照顾好自己',pinyin:'Zhàogù hǎo zìjǐ',en:'Looking after yourself',
   body:`<ul>
     <li>会饿，也会累。饿了走得慢，累了也一样。<small>Hunger and tiredness both slow you down.</small></li>
     <li>背包里的吃的可以直接吃掉。<small>Anything edible in your bag can be eaten from the bag.</small></li>
     <li>睡在自己的床上，可以选择醒来的时间：早上、中午、晚上。<br>
       <small>Sleep in your own bed and choose what time to wake up.</small></li>
     <li>穿得体面一点，店家会更好说话。<small>How you are dressed nudges every vendor's mood.</small></li>
   </ul>`},
];

export function openGuide(ctx,openId=null){
  const body=ctx.ui.open('guide','布置指南','墙上的海报 · HOUSE NOTES');
  const line={zh:'不记得怎么弄了？看看墙上。',pinyin:'Bú jìde zěnme nòng le? Kànkan qiáng shàng.',
    en:'Forgotten how something works? It is on the wall.'};
  body.innerHTML=`${languageLine(line,ctx.profile.settings,{className:'dialogue-line'})}
    <div class="guide-list">${SECTIONS.map(section=>`
      <details class="guide-section" ${section.id===openId?'open':''}>
        <summary><b>${section.zh}</b><small>${section.en}</small><span class="chevron">${icon('chevron',14)}</span></summary>
        <div class="guide-body">${fillKeys(section.body)}</div>
      </details>`).join('')}</div>
    <p class="microcopy">这张海报一直在门边的墙上，随时可以回来看。<br>The poster stays by the door — come back to it whenever.</p>`;
}
