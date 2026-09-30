import {icon} from './art.js';
import {escapeHtml as esc} from '../core/language.js';
import npcs from '../content/npcs.json' with {type:'json'};
import {dueCount} from '../core/review.js';
import questData from '../content/quests.json' with {type:'json'};
import {KEY_ACTIONS,keyLabel,fillKeys} from '../core/keys.js';
import {dailyReady} from '../core/daily.js';
import {closeHook} from '../core/conversation.js';
import {TUTORIAL_UI,shouldAutoStart} from '../core/tutorial.js';
import {gardenMapParts} from './garden-map.js';
import {knowsLook} from '../core/bank.js';
import {showPinyin,pinyinMarkup} from '../core/pinyin.js';

// The live game, bound when the shell starts, so pinyin can tell which words the player knows.
let bound=null,hskList=null,hskIds=null;
const hskId=zh=>{
  const list=bound?.hskWords;
  if(list!==hskList){hskList=list;hskIds=list?new Map(list.map(w=>[w.zh,w.id])):null;}
  return hskIds?.get(zh)??null;
};
const pinyinShown=(text,zh,settings,always)=>showPinyin(text,{zh,settings,profile:bound?.profile,idOf:hskId,always});
/** Pinyin markup for `zh` under the player's settings, or '' when it should not show.
 *  `always` is for study tools, where the pinyin is the answer rather than help. */
export function pinyinHtml(text,zh,{always=false,settings=bound?.profile?.settings}={}){
  return pinyinShown(text,zh,settings,always)?pinyinMarkup(text,settings):'';
}
/** The same rule as plain text, for notices, tooltips and other text-only places. */
export const pinyinText=(text,zh)=>pinyinShown(text,zh,bound?.profile?.settings,false)?text:'';
/** Pinyin followed by other escaped parts (usually the English), joined with ' · '. */
export const pinyinWith=(text,zh,...rest)=>[pinyinHtml(text,zh),...rest.filter(Boolean).map(esc)].filter(Boolean).join(' · ');

export function languageLine(line,settings,{className='',help=true}={}) {
  const shown=pinyinHtml(line.pinyin,line.zh,{settings}),pinyin=shown?`<div class="pinyin">${shown}</div>`:'';
  const english=settings.english?`<div class="translation">${esc(line.en)}</div>`:'';
  // A usage note and an answering hint are different help, so one never hides the other.
  const note=settings.english?[line.note,line.hint].filter(Boolean).map(t=>`<div class="usage">${esc(t)}</div>`).join(''):'';
  const empty=!settings.english&&!pinyin?'<div class="translation">请在设置里选择帮助语言。</div>':'';
  const helpMarkup=help?`<button class="help-toggle" data-help aria-label="显示帮助">?</button><div class="help-content" hidden>${pinyin}${english}${note}${empty}</div>`:'';
  return `<div class="language-line ${className}"><div class="zh">${esc(line.zh)}</div>${helpMarkup}</div>`;
}

/** The keyboard help. English is the default here on purpose — you need it before you can read
 *  the Chinese, and it is the one strip of the screen that exists to get you moving. */
const CONTROLS=[
  {keys:['forward','left','back','right'],en:'Move',zh:'移动'},
  {keys:[],en:'Mouse to look',zh:'移动鼠标转身'},
  {keys:['interact'],en:'Talk / enter',zh:'交谈 · 进门'},
  {keys:['collect'],en:'Learn this word',zh:'记住这个词'},
  {keys:['jump'],en:'Jump',zh:'跳'},
  {keys:['view'],en:'Third person',zh:'视角'},
  {keys:['camera'],en:'Camera',zh:'相机'},
  {keys:['labels'],en:'Hide labels',zh:'隐藏名字'},
  {keys:['Esc'],en:'Free the cursor',zh:'松开鼠标'},
];
/** A <kbd> for a bindable action is filled in by applyKeys(); anything else (Esc) is fixed. */
const kbd=k=>KEY_ACTIONS.some(a=>a.id===k)?`<kbd data-key="${k}"></kbd>`:`<kbd>${esc(k)}</kbd>`;
const hudOf=profile=>(profile.settings.hud??={quests:true,names:true,controls:'en'});

export class Shell {
 constructor(ctx){
  this.ctx=ctx;bound=ctx;this.panelId=null;this.route=null;this.closeHook=closeHook();
  const hud=hudOf(ctx.profile);
  document.querySelector('#app').innerHTML=`
  <header class="topbar"><div class="brand"><span class="brand-mark">禾</span><div><h1>青禾小镇</h1><span>A LITTLE MANDARIN GETAWAY</span></div></div><div class="top-actions"><div class="wallet" title="学习币">${icon('coin')}<b id="wallet-count">0</b><span>学习币</span></div>${[['journal-button','journal','旅行手册','Journal','book'],['inventory-button','inventory','背包','Inventory','bag'],['review-button','wordbank','生词本','Encountered words','leaf'],['status-button','status','状态','Condition','heart'],['settings-button','settings','设置','Settings','settings'],['labels-button','labels','名字标签','Labels','eye']]
    .map(([id,action,zh,en,svg])=>`<button class="icon-button" id="${id}" aria-label="${zh}" data-shortcut="${action}" data-title="${zh} · ${en}">${icon(svg)}<kbd data-key="${action}"></kbd></button>`).join('')}</div></header>
  <aside class="quest-card${hud.quests?'':' collapsed'}" id="quest-card"><button class="quest-toggle" id="quest-toggle" aria-expanded="${hud.quests}" aria-controls="quest-body" title="收起 / 展开 · Collapse"><span class="dot"></span><span class="quest-eyebrow">你的第一天 <small>YOUR MISSIONS</small></span><span class="chapter" id="quest-count">0 / 7</span><span class="chevron">${icon('chevron',14)}</span></button><div id="quest-body"><h2>从一句你好开始。</h2><p class="quest-sub">慢慢逛，慢慢学。点一个任务，地图上就会给你带路。</p><div id="quest-list"></div><div class="quest-foot">${icon('leaf',15)} <span id="quest-foot-text">自由探索 · 随时休息</span></div></div></aside>
  <div id="world-labels">${npcs.map(n=>`<div class="npc-label" id="label-${n.id}"><span class="label-dot" style="background:${n.color}"></span>${n.zh}<small>${n.role}</small></div>`).join('')}</div>
  <button id="ambient-bubble" class="ambient-bubble" hidden aria-label="听听闲聊"><span>今天天气真好！</span><small>···</small></button>
  <div class="location"><span class="location-icon">${icon('map',17)}</span><div><b>青禾广场</b><span id="place-time">下午 · 15:00</span></div></div>
  <div class="interaction-stack"><div id="toast" role="status" hidden></div><div id="interact" hidden><button id="interact-button"><kbd data-key="interact"></kbd> <span></span></button></div></div>
  <div class="controls" id="controls" data-lang="${esc(hud.controls??'en')}">${CONTROLS.map(c=>
    `<span class="ctl">${c.keys.map(kbd).join('')}<em data-en>${esc(c.en)}</em><em data-zh>${esc(c.zh)}</em></span><i></i>`).join('')}<button class="lang-toggle" id="controls-lang" title="按键说明的语言 · Language of these hints">中 / EN</button></div>
  <aside id="tutorial-card" class="tutorial-card" hidden aria-live="polite" aria-label="新手教程"></aside>
  <div id="crosshair" hidden aria-hidden="true"></div>
  <div id="nameplate" hidden aria-live="polite"></div>
  <div id="carrying" hidden><b></b><small><kbd>点击</kbd> 扔出去 · <kbd data-key="drop"></kbd> 放下</small><i>Click to throw · <span data-key="drop"></span> to put down</i></div>
  <div id="seated" hidden><kbd data-key="jump"></kbd> 站起来 <small><span data-key="jump"></span> to stand up</small></div>
  <div id="placing" hidden><b></b><span class="placing-state"></span><small><kbd>点击</kbd> 放下 · <kbd data-key="rotate"></kbd> 转向 · <kbd data-key="cancel"></kbd> 取消</small></div>
  <div id="look-hint" hidden>点击画面转身 · Click the town to look around, Esc to free the cursor</div>
  <aside class="mini-map"><div class="map-heading">青禾广场 <span>N ↑</span></div><svg id="map-svg" viewBox="-24 -24 48 48"><g id="map-content"></g><g id="map-route"></g><g id="map-facing" transform="translate(0,9)"><path d="M0 -5.4L2.7 -1.4L-2.7 -1.4Z" fill="#345f51" opacity=".45"/></g><circle id="map-player" cx="0" cy="9" r="1.4" fill="#345f51" stroke="#fff8de" stroke-width=".6"/></svg><div class="map-caption" id="map-caption">一段属于你的旅程</div></aside>
  <section id="arrival"><span class="arrival-stamp">旅</span><div class="eyebrow">WELCOME TO YOUR LITTLE GETAWAY</div><h2>Welcome, traveller.</h2><p>A new town. Your grandfather’s memories. A little Mandarin at a time.</p>${shouldAutoStart(ctx.profile)?`<p class="arrival-tutorial">${esc(TUTORIAL_UI.arrival.zh)}<small>${esc(TUTORIAL_UI.arrival.en)}</small></p>`:''}<p class="arrival-en">You see the town through your own eyes. Walk up to someone and say hello.<br>Start with English guidance; Mandarin grows with your practice. Tap <b>?</b> for extra help.<br>Choose 开始旅行 below to start your journey.</p><button class="primary" id="start-button">开始旅行 ${icon('arrow')}</button><div class="arrival-note"><span data-key="forward"></span><span data-key="left"></span><span data-key="back"></span><span data-key="right"></span> to move · Move the mouse to look · <span data-key="interact"></span> to talk · <span data-key="view"></span> for third person<br>Playable prototype · Mandarin voices are AI generated</div></section>
  <div id="scrim" hidden></div><section id="panel" hidden role="dialog" aria-modal="true" aria-labelledby="panel-title"></section>`;
  document.addEventListener('click',e=>{const b=e.target.closest('[data-help]');if(b){const target=b.parentElement.querySelector('.help-content');target.hidden=!target.hidden;b.setAttribute('aria-expanded',String(!target.hidden));if(!target.hidden)this.ctx.hinted=true;}});
  document.addEventListener('keydown',e=>{if(e.code==='Escape'&&!e.repeat&&this.panelId)this.close();if(e.key==='Tab'&&this.panelId){const els=[...document.querySelector('#panel').querySelectorAll('button,input,select,a,textarea')].filter(x=>!x.disabled&&x.offsetParent!==null);if(!els.length)return;const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  // The three pieces of screen furniture the player is most likely to want out of the way.
  document.querySelector('#quest-toggle').onclick=()=>this.toggleQuests();
  document.querySelector('#labels-button').onclick=()=>this.toggleNames();
  document.querySelector('#controls-lang').onclick=()=>this.cycleControlLanguage();
  addEventListener('resize',()=>{this.cardBox=null;});
  this.applyHud();this.applyKeys();
 }
 /** Where the mission card is on screen, so a world-space bubble can step around it rather
  *  than sitting behind it — the card takes clicks now, and an unreachable bubble is a bug. */
 hudBox(){
  const card=document.querySelector('#quest-card');
  if(!card||getComputedStyle(card).display==='none')return null;
  if(!this.cardBox)this.cardBox=card.getBoundingClientRect();
  return this.cardBox;
 }
 // ------------------------------------------------------------ HUD switches
 applyHud(){
  const hud=hudOf(this.ctx.profile);
  const card=document.querySelector('#quest-card');
  card.classList.toggle('collapsed',!hud.quests);
  document.querySelector('#quest-toggle').setAttribute('aria-expanded',String(!!hud.quests));
  document.querySelector('#labels-button').classList.toggle('off',!hud.names);
  document.querySelector('#controls').dataset.lang=hud.controls??'en';
  if(!hud.names)document.querySelector('#nameplate').hidden=true;
 }
 /** Every key shown on screen follows the player's bindings; called again whenever one changes. */
 applyKeys(){
  for(const el of document.querySelectorAll('[data-key]'))el.textContent=keyLabel(el.dataset.key);
  for(const el of document.querySelectorAll('[data-shortcut]')){const k=keyLabel(el.dataset.shortcut);el.setAttribute('aria-keyshortcuts',k);el.title=`${el.dataset.title} (${k})`;}
  if(this.ctx.town)this.update();
 }
 toggleQuests(){const hud=hudOf(this.ctx.profile);hud.quests=!hud.quests;this.cardBox=null;this.ctx.save();this.applyHud();}
 toggleNames(){
  const hud=hudOf(this.ctx.profile);hud.names=!hud.names;this.ctx.save();this.applyHud();
  if(hud.names)this.nameplate(this.ctx.town?.looking,{known:!!this.ctx.town?.looking&&knowsLook(this.ctx.profile,this.ctx.town.looking)});
  this.notice(hud.names?'名字标签：开 / Labels on':`名字标签：关。按 ${keyLabel('labels')} 打开。 / Labels off — press ${keyLabel('labels')} to bring them back.`);
 }
 /** English, Chinese, or both. English first is the default; the Chinese is never thrown away. */
 cycleControlLanguage(){
  const hud=hudOf(this.ctx.profile),order=['en','zh','both'];
  hud.controls=order[(order.indexOf(hud.controls??'en')+1)%order.length];
  this.ctx.save();this.applyHud();
 }
 /** `onClose` runs once when this panel closes, however it closes (its own button, Esc or ×).
  *  Opening another panel over it replaces the hook with the new panel's own. */
 open(id,title,subtitle='',{onClose}={}){
  this.closeHook.arm(onClose);
  this.returnFocus=document.activeElement;this.panelId=id;this.ctx.hinted=false;this.ctx.town?.setPaused(true);this.ctx.voice.stop();this.ctx.voice.duck(true);this.ctx.music?.duck(true);this.ctx.speech.stop();
  document.querySelector('#interact').hidden=true;
  const panel=document.querySelector('#panel');panel.hidden=false;panel.className=`panel panel-${id}`;
  panel.innerHTML=`<header class="panel-header"><div><div class="eyebrow">${esc(subtitle)}</div><h2 id="panel-title">${esc(title)}</h2></div><button class="close-button" aria-label="关闭">${icon('close')}</button></header><div id="panel-body"></div>`;
  document.querySelector('#scrim').hidden=false;panel.querySelector('.close-button').onclick=()=>this.close();panel.querySelector('.close-button').focus();
  const body=document.querySelector('#panel-body');
  this.ctx.tutorial?.event('panel',{id});
  return body;
 }
 /** Arm the open panel's one-shot close hook after it has opened (a conversation's completion
  *  screen, say). */
 armClose(fn){this.closeHook.arm(fn);}
 close(){this.panelId=null;document.querySelector('#panel').hidden=true;document.querySelector('#scrim').hidden=true;this.ctx.voice.stop();this.ctx.voice.duck(false);this.ctx.music?.duck(false);this.ctx.speech.stop();this.ctx.town?.setPaused(false);this.returnFocus?.focus?.();
  // Last, once the panel is fully torn down, so whatever it runs may open the next one.
  this.closeHook.run();}
 notice(message){const el=document.querySelector('#toast');el.textContent=message;el.hidden=false;clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>el.hidden=true,5500);}
 /** A mission is named in Chinese and explained in English, so it always reads at a glance. */
 questDone(quest){
  const p=this.ctx.profile,done=quest.done??{};
  if(done.flag)return p.completed.includes(done.flag);
  if(done.metric==='discovered')return (p.discovered?.length??0)>=done.count;
  if(done.metric==='home')return (p.home?.length??0)>=done.count;
  if(done.metric==='ordered')return Object.keys(p.claims??{}).some(k=>k.startsWith('order:'));
  if(done.metric==='district')return !!this.ctx.gateStates?.find(s=>s.id===done.district)?.unlocked;
  return false;
 }
 questProgress(quest){
  const p=this.ctx.profile,done=quest.done??{};
  if(done.metric==='discovered')return `${Math.min(done.count,p.discovered?.length??0)} / ${done.count}`;
  if(done.metric==='home')return `${Math.min(done.count,p.home?.length??0)} / ${done.count}`;
  if(done.metric==='district'){const s=this.ctx.gateStates?.find(g=>g.id===done.district);return s?`${Math.min(s.need,s.have)} / ${s.need}`:'';}
  return '';
 }
 update(){
  const p=this.ctx.profile;
  this.cardBox=null;
  document.querySelector('#wallet-count').textContent=p.wallet;
  // Unfinished missions first, so the card always opens on what to do next.
  const ordered=questData.quests.map((quest,i)=>({quest,i,done:this.questDone(quest)}))
    .sort((a,b)=>(a.done?1:0)-(b.done?1:0)||a.i-b.i);
  const finished=ordered.filter(q=>q.done).length;
  document.querySelector('#quest-count').textContent=`${finished} / ${questData.quests.length}`;
  // The list is redrawn on every save, so hold on to where the player had scrolled it.
  const list=document.querySelector('#quest-list'),scrolled=list.scrollTop;
  list.innerHTML=ordered.map(({quest,i,done})=>{
   const progress=done?'':this.questProgress(quest);
   const routed=this.route?.quest===quest.id;
   return `<div class="quest ${done?'done':''} ${routed?'routed':''}" ${quest.where&&!done?`data-route="${esc(quest.id)}" role="button" tabindex="0"`:''}>
     <span class="quest-number">${done?'✓':String(i+1).padStart(2,'0')}</span>
     <div class="quest-text">
       <div class="quest-line"><b>${esc(fillKeys(quest.zh))}</b>
         <button class="help-toggle quest-help" data-help aria-label="显示拼音">?</button>
         <div class="help-content" hidden><div class="pinyin">${pinyinHtml(fillKeys(quest.pinyin),fillKeys(quest.zh),{always:true})}</div></div></div>
       <small>${esc(fillKeys(quest.en))}</small>
       ${progress?`<span class="quest-progress">${progress}</span>`:''}
       ${quest.where&&!done?`<span class="quest-go">${routed?'带路中 · guiding':'点一下带路 · show me'}</span>`:''}
     </div></div>`;
  }).join('');
  list.scrollTop=scrolled;
  document.querySelectorAll('#quest-list [data-route]').forEach(el=>{
   const go=()=>this.followQuest(el.dataset.route);
   el.onclick=e=>{if(!e.target.closest('[data-help]'))go();};
   el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}};
  });
  const ready=dailyReady(p,p.dayIndex??0);
  document.querySelector('#journal-button').dataset.due=(dueCount(p)+ready)||'';
  document.querySelector('#quest-foot-text').textContent=ready?`今天有 ${ready} 件小事可以领奖`:'自由探索 · 随时休息';
 }
 // ------------------------------------------------------------ way-finding
 /** Clicking a mission drops a marker on the minimap and draws a line to it, GTA style. */
 followQuest(id){
  const quest=questData.quests.find(q=>q.id===id);
  if(!quest?.where)return;
  if(this.route?.quest===id){this.clearRoute();return this.notice('已取消带路。 / Guidance off.');}
  this.route={quest:id,...quest.where,label:fillKeys(quest.zh)};
  this.update();
  this.ctx.tutorial?.event('route');
  this.notice(`带路：${fillKeys(quest.zh)} → ${quest.where.zh??''} / Follow the dashed line on the map.`);
 }
 /** Lead the way to any spot in town — a shop door, the metro, your home — the same way a
  *  mission does. `key` says what the route is for (a room id, 'metro', 'tutorial'), so whoever
  *  set it can recognise it later and clear it on arrival. `shop`: the buy guide says which shop
  *  the trip is for, even when the route ends at the metro. */
 showWay({key,district,x,z,label,shop}){
  this.route={key,district,x,z,label,shop};
  this.update();
  this.notice(`带路：${label} / Follow the dashed line on the map.`);
 }
 clearRoute(){this.route=null;document.querySelector('#map-route').innerHTML='';document.querySelector('#map-caption').textContent='一段属于你的旅程';this.update();}
 /** Redraw the dashed line each frame. Another district is reached through its gate first. */
 drawRoute(world,district,pos){
  const layer=document.querySelector('#map-route');
  if(!this.route||!world){layer.innerHTML='';return;}
  const leg=this.routeLeg(world,district);
  if(!leg){layer.innerHTML='';return;}
  const far=Math.hypot(leg.x-pos.x,leg.z-pos.z);
  layer.innerHTML=`
    <line x1="${pos.x}" y1="${pos.z}" x2="${leg.x}" y2="${leg.z}" stroke="#c58a4f" stroke-width=".7"
      stroke-linecap="round" stroke-dasharray="1.6 1.4" opacity=".95"/>
    <circle cx="${leg.x}" cy="${leg.z}" r="2" fill="none" stroke="#c58a4f" stroke-width=".7"/>
    <circle cx="${leg.x}" cy="${leg.z}" r=".9" fill="#c58a4f"/>`;
  document.querySelector('#map-caption').textContent=
    `${leg.via?'先去 '+leg.via:this.route.label} · ${Math.round(far)} m`;
 }
 routeLeg(world,district){
  if(this.route.district===district.id)return {x:this.route.x,z:this.route.z};
  // The square is the hub: leave your own district through its gate, then cross the square.
  const target=world.districts.find(d=>d.id===this.route.district);
  const hop=district.id==='square'?target:world.districts.find(d=>d.id===district.id);
  if(!hop?.gate)return null;
  return {x:hop.gate.x,z:hop.gate.z,via:hop===target?target.zh:'青禾广场'};
 }
 nearby(target){
  // The world keeps evaluating proximity while paused. A panel always owns the keyboard and
  // pointer, so its underlying E prompt must stay out of the modal layer.
  if(this.panelId)target=null;
  const el=document.querySelector('#interact');el.hidden=!target;
  if(!target)return;
  const npc=npcs.find(n=>n.id===target.id);
  el.querySelector('span').textContent=npc?`和${npc.zh}交谈`:target.label;
 }
 /** The corner card shows where you are and what time it is. */
 setClock(state,hour){
  const el=document.querySelector('#place-time');
  if(!el)return;
  el.textContent=this.placeSub?`${this.placeSub} · ${hour}`:`${state.label} · ${hour}`;
  document.body.classList.toggle('after-dark',state.lamps>.5);
 }
 /** What the crosshair is resting on. Chinese first; F reveals the rest and keeps it. */
 nameplate(name,{known=false,reveal=false}={}){
  const el=document.querySelector('#nameplate');
  if(!hudOf(this.ctx.profile).names){el.hidden=true;return;}
  el.hidden=!name;
  if(!name)return;
  const s=this.ctx.profile.settings,show=known||reveal;
  const shown=show&&pinyinHtml(name.pinyin,name.zh),pinyin=shown?`<span class="np-pinyin">${shown}</span>`:'';
  const english=show&&s.english&&name.en?`<span class="np-en">${esc(name.en)}</span>`:'';
  const level=name.hsk?`<span class="np-hsk">HSK ${name.hsk}</span>`:'';
  el.className=known?'known':'';
  el.innerHTML=`<b>${esc(name.zh)}</b>${pinyin}${english}${level}<small>${known?'已记住':`<kbd>${esc(keyLabel('collect'))}</kbd> 记住`}</small>`;
 }
 /** Redraw the minimap for one district, straight from the world data. */
 drawMap(world,district){
  const [x0,x1]=district.bounds.x,[z0,z1]=district.bounds.z;
  const pad=3,cx=(x0+x1)/2,cz=(z0+z1)/2,size=Math.max(x1-x0,z1-z0)+pad*2;
  document.querySelector('#map-svg').setAttribute('viewBox',`${cx-size/2} ${cz-size/2} ${size} ${size}`);
  const parts=[`<rect x="${x0}" y="${z0}" width="${x1-x0}" height="${z1-z0}" rx="2" fill="#f6eedb"/>`];
  if(district.id==='garden')parts.push(...gardenMapParts());
  const labels=[];          // drawn last, so nothing on the map covers a landmark's name
  for(const b of world.buildings.filter(b=>b.district===district.id)){
   if(b.label)labels.push(`<text x="${b.x}" y="${b.z}" font-size="4.5" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="#3d2a1e" stroke="#fcf6e8" stroke-width=".8" paint-order="stroke">${esc(b.label)}</text>`);
   parts.push(`<rect x="${b.x-b.width/2}" y="${b.z-b.depth/2}" width="${b.width}" height="${b.depth}" rx="1" fill="${b.roof}" opacity=".85"/>`);
   // Wings turn with their building (only 0 and 180 degrees are used).
   const s=(b.rotation??0)===180?-1:1;
   for(const wg of b.wings??[])
    parts.push(`<rect x="${b.x+s*wg.x-wg.width/2}" y="${b.z+s*wg.z-wg.depth/2}" width="${wg.width}" height="${wg.depth}" rx="1" fill="${wg.roof??b.roof}" opacity=".85"/>`);
  }
  for(const t of world.trees.filter(([x,z])=>x>=x0&&x<=x1&&z>=z0&&z<=z1))
   parts.push(`<circle cx="${t[0]}" cy="${t[1]}" r="1.1" fill="#9db98a"/>`);
  if(district.id==='square')parts.push('<circle cx="0" cy="1.8" r="2.4" fill="#90b5a9"/>');
  for(const placed of world.npcs){
   const info=npcs.find(n=>n.id===placed.id);
   if(placed.x<x0||placed.x>x1||placed.z<z0||placed.z>z1)continue;
   parts.push(`<circle cx="${placed.x}" cy="${placed.z}" r="1.1" fill="${info?.color??'#8a8f7a'}"/>`);
  }
  for(const d of world.districts){
   if(!d.gate)continue;
   const g=d.gate,horizontal=g.axis==='z';
   parts.push(`<rect x="${horizontal?g.x-g.span:g.x-.5}" y="${horizontal?g.z-.5:g.z-g.span}" width="${horizontal?g.span*2:1}" height="${horizontal?1:g.span*2}" fill="#b08a60"/>`);
  }
  document.querySelector('#map-content').innerHTML=parts.concat(labels).join('');
 }
 /** The card in the corner names wherever you are: a district outdoors, a room indoors. */
 setPlace(place,where){
  const inside=place!=='town';
  document.body.classList.toggle('indoors',inside);
  document.querySelector('.location b').textContent=where?.zh??'青禾广场';
  this.placeName=where?.zh??'青禾广场';this.placeSub=inside?(where?.en??''):null;
  document.querySelector('.map-heading').firstChild.textContent=(where?.zh??'青禾广场')+' ';
 }
}
