import catalog from '../content/catalog.json' with {type:'json'};
import rooms from '../content/rooms.json' with {type:'json'};
import {languageLine,pinyinHtml} from './shell.js';
import {icon,itemArt} from './art.js';
import {escapeHtml as esc} from '../core/language.js';
import {purchase} from '../core/economy.js';
import {bump} from '../core/daily.js';
import {openGuide} from './guide.js';
import {fillKeys,keyLabel} from '../core/keys.js';
import {decorOn,canStack,hangsOnWall} from '../core/surfaces.js';

// Wall pieces only go up in a wall slot, so they are never offered for free placement.
const furniture=catalog.filter(item=>item.category==='furniture'&&!hangsOnWall(item.kind));
const byId=id=>catalog.find(item=>item.id===id);
const slotsOf=roomId=>rooms[roomId]?.slots??{};
/** The slots on the floor the tourist is standing on: upstairs slots carry the floor's height. */
const slotsHere=ctx=>{
  const floor=ctx.town?.place===here(ctx)?ctx.town.floorY?.()??0:0;
  return Object.entries(slotsOf(here(ctx))).filter(([,slot])=>(slot.y??0)===floor);
};
/** Only something a shop sells can be ordered; anything else (a certificate) only if it is owned. */
const orderable=item=>(item.shop?.length??0)>0;
/** Which room a furnishing stands in: saves from before the bedroom had only the living room. */
const roomOf=record=>record.room??'home';
/** The decoratable room the tourist is standing in, or the living room. */
const here=ctx=>rooms[ctx.town?.place]?.decoratable?ctx.town.place:'home';

/** Owned but not currently standing in the room. */
function spare(ctx,id){
  return (ctx.profile.inventory[id]??0)-ctx.profile.home.filter(r=>r.item===id).length;
}
const inSlot=(ctx,slotId,room=here(ctx))=>ctx.profile.home.find(r=>r.slot===slotId&&roomOf(r)===room);

/** Put a piece away, and anything standing on it. The world already removes an assembly as a
 *  unit; the save has to agree, or the decor comes back as a ghost on the next reload. */
function putAway(ctx,record){
  if(!record)return false;
  const uids=new Set([record.uid,...decorOn(ctx.profile.home,record.uid).map(part=>part.uid)]);
  ctx.profile.home=ctx.profile.home.filter(kept=>!uids.has(kept.uid));
  for(const uid of uids)ctx.town.removeProp(roomOf(record),uid);
  ctx.save();
  return true;
}

export function openDecorate(ctx){
  if(!ctx.profile.completed.includes('home:tutorial'))return tutorial(ctx);
  slotView(ctx);
}

// ---------------------------------------------------------------- tutorial
const STEPS=[
  {zh:'这是你的家。',pinyin:'Zhè shì nǐ de jiā.',en:'This is your home.',
   body:'楼上的卧室已经放好了床和床头柜，客厅里有一块地毯。书桌在书房里，你在那里复习生词。<br>Upstairs, your bedroom already has a bed and a nightstand, and there is a rug in the living room. The desk is in the study — that is where you review the words you collect.'},
  {zh:'按位置布置。',pinyin:'Àn wèizhì bùzhì.',en:'Furnish by position.',
   body:'每件家具都有自己的位置：床位、五斗柜、衣柜、灯……点一个位置就能订购或更换。<br>Every piece has its own spot. Click a position to order something for it, or swap what is there. It is delivered straight to the room — nothing to carry.'},
  {zh:'也可以自己摆。',pinyin:'Yě kěyǐ zìjǐ bǎi.',en:'Or place it yourself.',
   body:'想自己决定位置，就用「自由摆放」。走到想放的地方，点击放下，<kbd>{rotate}</kbd> 转向，<kbd>{cancel}</kbd> 取消。绿色表示放得下。<br>Prefer to decide yourself? Use free placement: walk where you want it and click. {rotate} turns it, {cancel} cancels.'},
  {zh:'天黑了要开灯。',pinyin:'Tiān hēi le yào kāi dēng.',en:'Turn a light on after dark.',
   body:'白天窗户就够亮了，晚上房间会暗下来。灯具店里的灯，放进房间会真的发光。<br>Daylight comes through the windows, but the room really does go dark at night. Lamps from the lighting shop actually light it.'},
];

function tutorial(ctx,step=0){
  const body=ctx.ui.open('decorate','布置房间','第一次回家 · WELCOME HOME');
  const s=STEPS[step];
  body.innerHTML=`
    <div class="tutorial-step"><span>${step+1} / ${STEPS.length}</span>
      <div class="step-track">${STEPS.map((_,i)=>`<i class="${i<=step?'active':''}"></i>`).join('')}</div></div>
    ${languageLine(s,ctx.profile.settings,{className:'dialogue-line'})}
    <p class="tutorial-body">${fillKeys(s.body)}</p>
    <div class="button-row tutorial-actions">
      ${step>0?'<button class="secondary" id="tut-back">上一步</button>':''}
      <button class="primary" id="tut-next">${step===STEPS.length-1?'开始布置':'下一步'} ${icon('arrow',15)}</button>
      <button class="subtle" id="tut-skip">跳过</button>
    </div>`;
  body.querySelector('#tut-back')?.addEventListener('click',()=>tutorial(ctx,step-1));
  body.querySelector('#tut-skip').onclick=()=>finishTutorial(ctx);
  body.querySelector('#tut-next').onclick=()=>step===STEPS.length-1?finishTutorial(ctx):tutorial(ctx,step+1);
}
function finishTutorial(ctx){
  if(!ctx.profile.completed.includes('home:tutorial'))ctx.profile.completed.push('home:tutorial');
  ctx.save();
  slotView(ctx);
}

// ------------------------------------------------------------- slot layout
function slotView(ctx){
  const body=ctx.ui.open('decorate','布置房间','家居订购 · FURNISH YOUR ROOM');
  render(ctx,body);
}

function render(ctx,body){
  // Anything placed by hand has no slot, so it needs its own way back into the box.
  const loose=ctx.profile.home.map((record,index)=>({record,index})).filter(({record})=>!record.slot&&roomOf(record)===here(ctx));
  body.innerHTML=`
    <p class="panel-intro">点一个位置，选一件家具。买下的会直接送到房间里。<br>Pick a spot, choose a piece. It is delivered straight into the room.</p>
    <div class="slot-grid">${slotsHere(ctx).map(([id,slot])=>{
      const record=inSlot(ctx,id);
      const item=record&&byId(record.item);
      return `<button class="slot-card ${item?'filled':''}" data-slot="${esc(id)}">
        <span class="slot-name">${esc(slot.zh)}</span>
        ${item?`${itemArt(item.visual)}<b>${esc(item.zh)}</b>`:`<span class="slot-empty">${icon('leaf',22)}</span><b>空着</b>`}
      </button>`;}).join('')}</div>
    <h3 class="section-title">自由摆放 <small>PLACE IT YOURSELF</small></h3>
    <div class="decorate-grid">${furniture.filter(i=>spare(ctx,i.id)>0).map(item=>`
      <button class="shop-card" data-place="${esc(item.id)}">${itemArt(item.visual)}<b>${esc(item.zh)}</b><span>还有 ${spare(ctx,item.id)} 件</span></button>`).join('')
      ||'<p class="microcopy">仓库里没有多余的家具。买一件，或从某个位置上收起来。</p>'}</div>
    <p class="microcopy">自由摆放时：<kbd>${keyLabel('rotate')}</kbd> 转向 · <kbd>${keyLabel('cancel')}</kbd> 取消 · 点击放下。</p>
    <button class="subtle wide" id="open-guide">忘了怎么弄？看看墙上的海报 · House notes</button>
    ${loose.length?`<h3 class="section-title">自己摆的 <small>PLACED BY HAND</small></h3>
      <div class="placed-list">${loose.filter(({record})=>!record.on).map(({record,index})=>{
        const item=byId(record.item);
        const parts=decorOn(ctx.profile.home,record.uid);
        return `<article class="placed-row ${parts.length?'assembly':''}">
          <div class="placed-main">${languageLine(item,ctx.profile.settings)}
            ${parts.length?`<span class="assembly-tag">自定义家具 · Customized furniture · ${parts.length}</span>`:''}</div>
          <button class="lookup-save" data-remove="${index}">收起</button>
          ${parts.length?`<div class="assembly-parts">${parts.map(part=>{
            const partItem=byId(part.item);
            const partIndex=ctx.profile.home.indexOf(part);
            return `<span class="assembly-part">${esc(partItem?.zh??part.item)}<button class="lookup-save" data-remove="${partIndex}" aria-label="收起${esc(partItem?.zh??'')}">收起</button></span>`;
          }).join('')}</div>`:''}
        </article>`;
      }).join('')}</div>
      <p class="microcopy">放在桌面上的小东西会和桌子变成一组：收起桌子，上面的东西也一起收走。<br>
        Anything standing on a piece of furniture becomes one assembly with it — put the base away and its decor goes too.</p>`:''}`;

  body.querySelector('#open-guide').onclick=()=>openGuide(ctx,'furnish');
  body.querySelectorAll('[data-slot]').forEach(b=>b.onclick=()=>slotPicker(ctx,body,b.dataset.slot));
  body.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>{
    const item=byId(b.dataset.place);
    if(spare(ctx,item.id)<1)return;
    ctx.ui.close();
    if(ctx.town.beginPlacement(item))ctx.ui.notice(`放置「${item.zh}」：点击放下 · R 转向 · X 取消`);
  });
  body.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{
    putAway(ctx,ctx.profile.home[Number(b.dataset.remove)]);
    render(ctx,body);
  });
}

function slotPicker(ctx,body,slotId){
  const slot=slotsOf(here(ctx))[slotId];
  const record=inSlot(ctx,slotId);
  const current=record&&byId(record.item);
  const options=catalog.filter(item=>item.kind&&slot.accepts.includes(item.kind)&&(orderable(item)||(ctx.profile.inventory[item.id]??0)>0));
  body.innerHTML=`
    <button class="subtle" id="slot-back">← 回到房间</button>
    <h3 class="slot-title">${esc(slot.zh)}</h3>
    ${current?`<div class="slot-current">${itemArt(current.visual)}<div>${languageLine(current,ctx.profile.settings)}<button class="secondary" id="slot-clear">收起来</button></div></div>`:'<p class="microcopy">这个位置还空着。</p>'}
    <h3 class="section-title">可以放这里 <small>FITS HERE</small></h3>
    <div class="decorate-grid">${options.map(item=>{
      const owned=spare(ctx,item.id)>0,here=record?.item===item.id;
      const afford=ctx.profile.wallet>=item.price;
      const buy=!owned&&orderable(item);
      return `<button class="shop-card" data-choose="${esc(item.id)}" ${here||(!owned&&(!buy||!afford))?'disabled':''}>
        ${itemArt(item.visual)}<b>${esc(item.zh)}</b>
        <span>${here||(!owned&&!buy)?'已放好':owned?'放这里':`${icon('coin',13)} ${item.price}`}</span>
        <small>${pinyinHtml(item.pinyin,item.zh)}</small></button>`;}).join('')}</div>
    <p class="microcopy">${options.length?'买下的家具会直接送到这个位置。':'暂时没有适合这个位置的家具。'}</p>`;

  body.querySelector('#slot-back').onclick=()=>render(ctx,body);
  body.querySelector('#slot-clear')?.addEventListener('click',()=>{
    putAway(ctx,inSlot(ctx,slotId));
    slotPicker(ctx,body,slotId);
  });
  body.querySelectorAll('[data-choose]').forEach(b=>b.onclick=()=>{
    const item=byId(b.dataset.choose);
    if(spare(ctx,item.id)<1){
      if(!orderable(item))return;
      const result=purchase(ctx.profile,item,item.price);
      if(!result.ok)return ctx.ui.notice('学习币不够。 / Not enough coins.');
      ctx.ui.notice(`买好了：${item.zh}。 / Bought.`);
    }
    fillSlot(ctx,slotId,item,here(ctx));
    bump(ctx.profile,'furnished');
    ctx.music?.cue('place');
    ctx.save();
    slotPicker(ctx,body,slotId);
  });
}

/** Put an item into a named position in a room, replacing whatever was there. */
export function fillSlot(ctx,slotId,item,room='home'){
  const slot=slotsOf(room)[slotId];
  if(!slot)return null;
  // Swapping what is in a slot takes whatever was standing on the old piece with it.
  putAway(ctx,inSlot(ctx,slotId,room));
  const record={uid:`${item.id}-${slotId}-${Date.now().toString(36)}`,item:item.id,kind:item.kind,
    color:item.color,footprint:item.footprint,x:slot.x,z:slot.z,...(slot.y?{y:slot.y}:{}),rot:slot.rot??0,slot:slotId,room};
  ctx.profile.home.push(record);
  ctx.town.addProp(room,record);
  return record;
}

/** A new home is not an empty box: a bed and a nightstand upstairs, and a rug in the living room. */
export function applyStarterHome(ctx){
  if(ctx.profile.completed.includes('home:starter'))return false;
  ctx.profile.completed.push('home:starter');
  for(const [room,slotId,itemId] of [['home','up-bed','wooden-bed'],['home','up-nightstand','nightstand'],['home','rug','floor-rug']]){
    const item=byId(itemId);
    if(!item)continue;
    ctx.profile.inventory[itemId]=(ctx.profile.inventory[itemId]??0)+1;
    fillSlot(ctx,slotId,item,room);
  }
  ctx.save();
  return true;
}

/** Called by the world when a free placement is confirmed, blocked or cancelled. */
export function installPlacement(ctx){
  ctx.town.onPlace=result=>{
    if(result.status==='placed'){
      ctx.profile.home.push(result.record);
      bump(ctx.profile,'furnished');
      ctx.music?.cue('place');
      ctx.save();
      ctx.ui.notice(`「${result.item.zh}」放好了。 / Placed.`);
      if(spare(ctx,result.item.id)>0)ctx.town.beginPlacement(result.item);
    }else if(result.status==='blocked'){
      const why=result.problem;
      ctx.ui.notice(why
        ?`${why.zh}。 / ${why.en}.`
        :`这里放不下「${result.item.zh}」。往后退一点，或按 ${keyLabel('rotate')} 转个方向。 / It does not fit here — step back or press ${keyLabel('rotate')} to turn it.`);
    }else{
      ctx.ui.notice('已取消。 / Cancelled.');
    }
  };
}
