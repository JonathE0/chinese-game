import {TUTORIAL_UI as UI,TIP_SECONDS,nextTip,tipEvent,markSeen,skipTutorial,startTutorial,fillText} from '../core/tutorial.js';
import {escapeHtml as esc} from '../core/language.js';
import {pinyinHtml} from './shell.js';

/** How long 做到了！ stays up before the tip goes. */
const CELEBRATE_MS=1100;
/** A frame that moves the player further than this was a warp, not a walk. */
const WARP_METRES=3;
/** Standing still still jitters by a hair; this much per frame is not walking. */
const STILL_METRES=.004;

/**
 * The first-run tips: one small card at a time at the top of the screen, never a panel. The rules
 * (which tip, when, once each) live in core/tutorial.js and content/tutorial.json; this counts
 * play time, measures looking and walking, hears about everything else through trigger() and
 * event(), and draws the card.
 */
export class Tutorial {
 constructor(ctx){
  this.ctx=ctx;this.started=false;this.watched=new Map();this.reset();
 }
 reset(){
  this.fired=new Set();this.progress={};this.time=0;this.lastAt=-Infinity;this.active=null;this.left=0;this.flashUntil=0;
  this.last=null;this.stamp=null;this.shown=null;this.routed=null;
 }
 get card(){return document.querySelector('#tutorial-card');}
 get on(){return !!this.ctx.profile.tutorial&&this.ctx.profile.settings.tips!==false;}
 /** From the start button, for a save that already has tips to give (or none to give). */
 begin(){this.trigger('start');this.sync();}
 /** For a brand-new traveller, and from Settings for anyone replaying the tips. */
 start(){
  this.leaveStep();
  startTutorial(this.ctx.profile);
  this.reset();
  this.ctx.save();
  this.begin();
 }
 /** Something happened that a tip can wait for (name it in tutorial.json). It stays true. */
 trigger(name){this.fired.add(name);}
 /** A number that changes (the wallet, the missions finished): its first change is a trigger. */
 watch(name,value){
  const before=this.watched.get(name);
  this.watched.set(name,value);
  if(before!==undefined&&before!==value)this.trigger(name);
 }
 /** Something the player did. A tip it finishes is marked seen at once, and if it is the one on
  *  screen it says 做到了！ and goes. */
 event(type,{id,amount}={}){
  this.trigger(type);
  if(id!==undefined)this.trigger(`${type}:${id}`);
  const done=tipEvent(this.ctx.profile,this.progress,{type,id,amount});
  if(!done.length)return;
  this.ctx.save();
  if(this.active&&done.includes(this.active.id)){
   const {didIt}=UI;
   this.flashUntil=performance.now()+CELEBRATE_MS;this.shown='did';
   this.ctx.music?.cue('collect');
   this.card.classList.add('celebrating');
   this.card.innerHTML=`<div class="tutorial-did"><b>${esc(didIt.zh)}</b><small>${esc(didIt.en)}</small></div>`;
   this.leaveStep(true);
  }
 }
 skip(){
  skipTutorial(this.ctx.profile);
  this.leaveStep();
  this.ctx.save();
  this.ctx.ui.notice(`${UI.skipped.zh} / ${UI.skipped.en}`);
  this.sync();
 }
 /** A tip's route belongs to that tip: it goes off the map when the tip does, unless something
  *  else (a mission, a shop) has already replaced it. `keepCard` leaves the celebration up. */
 leaveStep(keepCard){
  this.active=null;this.routed=null;
  if(!keepCard)this.shown=null;
  if(this.ctx.ui.route?.key==='tutorial')this.ctx.ui.clearRoute();
 }
 /** The tip is over: it will not come back. */
 finish(){
  if(this.active)markSeen(this.ctx.profile,this.active.id);
  this.leaveStep();
  this.ctx.save();
  this.sync();
 }
 /** Called every frame: counts play time, measures looking and walking, picks the next tip and
  *  times the one on screen. */
 frame(town,started){
  this.started=started;
  const now=performance.now(),dt=this.stamp===null?0:Math.min(now-this.stamp,200);
  this.stamp=now;
  const playing=started&&!this.ctx.ui.panelId&&!town.paused;
  if(playing)this.time+=dt/1000;
  this.measure(town,playing);
  if(this.on&&started){
   const card=this.card;
   if(this.active){
    // Reading it (the pointer over it, or the pinyin open) stops the clock; so does anything in front of it.
    if(this.visible()&&!card.matches(':hover')&&!card.querySelector('.help-content:not([hidden])'))this.left-=dt;
    if(this.left<=0)this.finish();
   }else if(playing&&this.flashUntil<now){
    const pos=town.player.entity.getPosition();
    const tip=nextTip(this.ctx.profile,{time:this.time,lastAt:this.lastAt,fired:this.fired,nearId:town.nearest?.id??null,pos,place:town.place});
    if(tip)this.show(tip);
   }
  }
  this.sync();
 }
 show(step){
  this.active=step;this.left=TIP_SECONDS*1000;this.lastAt=this.time;this.shown=null;
  // A route the player picked themselves (a mission, a shop) is theirs to keep.
  const ui=this.ctx.ui;
  if(step.where&&(!ui.route||ui.route.key==='tutorial'))ui.showWay({key:'tutorial',...step.where,label:step.where.zh});
 }
 measure(town,playing){
  const pos=town.player.entity.getPosition();
  const now={yaw:town.yaw,view:town.view,x:pos.x,z:pos.z,place:town.place};
  const last=this.last;this.last=now;
  // Going through a door turns and moves you in one jump; none of that is the player's doing.
  if(!last||!playing||!this.ctx.profile.tutorial||last.place!==now.place)return;
  const turned=Math.abs(((now.yaw-last.yaw)%360+540)%360-180);
  if(turned>0)this.event('look',{amount:turned});
  const moved=Math.hypot(now.x-last.x,now.z-last.z);
  if(now.place==='town'&&moved>STILL_METRES&&moved<WARP_METRES)this.event('walk',{amount:moved});
  if(now.view!==last.view)this.event('view');
 }
 visible(){return this.started&&this.on&&!this.ctx.ui.panelId&&!document.body.classList.contains('riding');}
 /** Behind any panel and the ride, hidden before 开始旅行, and when tips are off. */
 sync(){
  const card=this.card;
  if(!card)return;
  const flashing=performance.now()<this.flashUntil;
  if(!this.on&&this.active)this.leaveStep();
  const show=this.visible()&&(!!this.active||flashing);
  if(card.hidden===show)card.hidden=!show;
  if(!show){if(!flashing)this.shown=null;return;}
  if(flashing)return;
  card.classList.remove('celebrating');
  if(!this.active){card.hidden=true;return;}
  if(this.shown===this.active.id)return;
  this.shown=this.active.id;
  this.render(this.active);
 }
 render(step){
  const card=this.card,words=step.drag&&this.ctx.profile.settings.mouse!=='lock'?{...step,...step.drag}:step;
  card.innerHTML=`
   <div class="tutorial-head"><span class="eyebrow">${esc(UI.eyebrow.zh)} · ${esc(UI.eyebrow.en)}</span>
    <button class="tutorial-close" data-tutorial="close" aria-label="${esc(UI.close.zh)}">×</button></div>
   <div class="tutorial-line"><b>${esc(fillText(words.zh))}</b>
    <button class="help-toggle tutorial-help" data-help aria-label="显示拼音">?</button>
    <div class="help-content" hidden><div class="pinyin">${pinyinHtml(fillText(words.pinyin),'',{always:true})}</div></div></div>
   <small class="tutorial-en">${esc(fillText(words.en))}</small>
   <div class="tutorial-actions-row">
    <button class="tutorial-skip" data-tutorial="skip">${esc(UI.skip.zh)} <small>${esc(UI.skip.en)}</small></button>
   </div>`;
  card.querySelector('[data-tutorial="close"]').onclick=()=>this.finish();
  card.querySelector('[data-tutorial="skip"]').onclick=()=>this.skip();
 }
}
