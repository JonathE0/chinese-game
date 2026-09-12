import {STEPS,TUTORIAL_UI as UI,currentStep,tutorialEvent,nextStep,skipTutorial,startTutorial,fillText} from '../core/tutorial.js';
import {escapeHtml as esc} from '../core/language.js';

/** How long 做到了！ stays up before the next step appears. */
const CELEBRATE_MS=1100;
/** A frame that moves the player further than this was a warp, not a walk. */
const WARP_METRES=3;
/** Standing still still jitters by a hair; this much per frame is not walking. */
const STILL_METRES=.004;

/**
 * The first-run tutorial card: one step at a time at the top of the screen. The rules live in
 * core/tutorial.js; this measures what the player does, says so, and draws the card.
 */
export class Tutorial {
 constructor(ctx){
  this.ctx=ctx;this.started=false;this.shown=null;this.routed=null;this.pending=false;this.flashUntil=0;this.last=null;
 }
 get card(){return document.querySelector('#tutorial-card');}
 get running(){return !!currentStep(this.ctx.profile);}
 /** From the start button (brand-new players) and from Settings (anyone replaying it). */
 start(){
  this.leaveStep();
  startTutorial(this.ctx.profile);
  this.shown=null;this.pending=false;this.flashUntil=0;
  this.ctx.save();
  this.sync();
 }
 /** Something the player did. Saves on every advance; progress alone waits for the next save. */
 event(type,{id,amount}={}){
  const p=this.ctx.profile;
  if(!currentStep(p))return null;
  const result=tutorialEvent(p,{type,id,amount});
  if(result==='advanced'){
   this.leaveStep();
   this.pending=true;this.shown=null;
   this.ctx.save();
   // No sync here: the event often comes just before a panel opens (saying hello opens the
   // conversation), and the frame loop celebrates once the card is actually in view.
  }
  return result;
 }
 next(){
  nextStep(this.ctx.profile);
  this.leaveStep();this.shown=null;
  this.ctx.save();
  this.sync();
 }
 skip(){
  skipTutorial(this.ctx.profile);
  this.leaveStep();this.shown=null;this.pending=false;this.flashUntil=0;
  this.ctx.save();
  this.ctx.ui.notice(`${UI.skipped.zh} / ${UI.skipped.en}`);
  this.sync();
 }
 /** A step's route belongs to that step: moving on takes it off the map, unless something else
  *  (a mission, a shop) has already replaced it. */
 leaveStep(){
  this.routed=null;
  if(this.ctx.ui.route?.key==='tutorial')this.ctx.ui.clearRoute();
 }
 /** Called every frame: measures looking, walking and the camera, then shows or hides the card. */
 frame(town,started){
  this.started=started;
  this.measure(town,started&&!this.ctx.ui.panelId&&!town.paused);
  this.sync();
 }
 measure(town,playing){
  const pos=town.player.entity.getPosition();
  const now={yaw:town.yaw,view:town.view,x:pos.x,z:pos.z,place:town.place};
  const last=this.last;this.last=now;
  const step=currentStep(this.ctx.profile);
  // Going through a door turns and moves you in one jump; none of that is the player's doing.
  if(!last||!playing||!step?.done||last.place!==now.place)return;
  const type=step.done.event;
  if(type==='look'){
   const turned=Math.abs(((now.yaw-last.yaw)%360+540)%360-180);
   if(turned>0)this.event('look',{amount:turned});
  }else if(type==='walk'&&now.place==='town'){
   const moved=Math.hypot(now.x-last.x,now.z-last.z);
   if(moved>STILL_METRES&&moved<WARP_METRES)this.event('walk',{amount:moved});
  }else if(type==='view'&&now.view!==last.view)this.event('view');
 }
 /** Hidden before 开始旅行, behind any panel, and once the tutorial is over. */
 sync(){
  const card=this.card;
  if(!card)return;
  const p=this.ctx.profile,ui=this.ctx.ui,step=currentStep(p),now=performance.now();
  const flashing=now<this.flashUntil;
  const visible=this.started&&!ui.panelId&&(!!step||flashing||this.pending);
  if(card.hidden===visible)card.hidden=!visible;
  if(!visible)return;
  // A step finished behind a panel is celebrated when the card is next in view.
  if(this.pending&&!flashing){
   this.pending=false;this.flashUntil=now+CELEBRATE_MS;
   this.ctx.music?.cue('collect');
   card.classList.add('celebrating');
   card.innerHTML=`<div class="tutorial-did"><b>${esc(UI.didIt.zh)}</b><small>${esc(UI.didIt.en)}</small></div>`;
   return;
  }
  if(flashing)return;
  card.classList.remove('celebrating');
  if(!step){card.hidden=true;return;}
  const index=p.tutorial.step;
  if(this.shown===index)return;
  this.shown=index;
  this.render(step,index);
  // A route the player picked themselves (a mission, a shop) is theirs to keep.
  if(step.where&&this.routed!==index){
   this.routed=index;
   if(!ui.route||ui.route.key==='tutorial')ui.showWay({key:'tutorial',...step.where,label:step.where.zh});
  }
 }
 render(step,index){
  const card=this.card,last=index===STEPS.length-1,button=last?UI.finish:UI.next;
  card.innerHTML=`
   <div class="tutorial-head"><span class="eyebrow">${esc(UI.eyebrow.zh)} · ${esc(UI.eyebrow.en)}</span><span class="tutorial-count">${index+1} / ${STEPS.length}</span></div>
   <div class="tutorial-line"><b>${esc(fillText(step.zh))}</b>
    <button class="help-toggle tutorial-help" data-help aria-label="显示拼音">?</button>
    <div class="help-content" hidden><div class="pinyin">${esc(fillText(step.pinyin))}</div></div></div>
   <small class="tutorial-en">${esc(fillText(step.en))}</small>
   <div class="tutorial-actions-row">
    <button class="tutorial-skip" data-tutorial="skip">${esc(UI.skip.zh)} <small>${esc(UI.skip.en)}</small></button>
    <button class="tutorial-next ${step.done?'quiet':'primary'}" data-tutorial="next">${esc(button.zh)} <small>${esc(button.en)}</small></button>
   </div>`;
  card.querySelector('[data-tutorial="next"]').onclick=()=>this.next();
  card.querySelector('[data-tutorial="skip"]').onclick=()=>this.skip();
 }
}
