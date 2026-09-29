import tutorial from '../content/tutorial.json' with {type:'json'};
import {cardCoins} from './review.js';
import {fillKeys} from './keys.js';

/**
 * The first-run tutorial, as rules. The save holds `profile.tutorial`:
 *   {step, progress} while it runs (`progress` counts towards the step's `done.amount`),
 *   {done:true} once finished or skipped, and nothing at all for a save that never met it.
 */
export const STEPS=tutorial.steps;
export const TUTORIAL_UI=tutorial.ui;

/** Only a brand-new traveller is walked through it; nobody already playing is interrupted.
 *  The starter home adds `home:starter` on every first load, so that one flag does not count. */
export function shouldAutoStart(p) {
  if(p.tutorial!==undefined)return false;
  if((p.completed??[]).some(flag=>flag!=='home:starter'))return false;
  if(p.discovered?.length)return false;
  return !Object.keys(p.words??{}).length;
}
export function startTutorial(p) {p.tutorial={step:0,progress:0};return p.tutorial;}
export function currentStep(p) {
  const t=p?.tutorial;
  if(!t||t.done||!Number.isInteger(t.step))return null;
  return STEPS[t.step]??null;
}
function advance(p) {
  const next=p.tutorial.step+1;
  p.tutorial=next>=STEPS.length?{done:true}:{step:next,progress:0};
}
/** Something the player did. Only the current step's own event (and its id, when it names one)
 *  counts; a step without `done` waits for 下一步 whatever happens. */
export function tutorialEvent(p,{type,id,amount=1}={}) {
  const step=currentStep(p);
  if(!step?.done||step.done.event!==type)return null;
  if(step.done.id!==undefined&&step.done.id!==id)return null;
  p.tutorial.progress+=amount;
  if(p.tutorial.progress>=(step.done.amount??1)){advance(p);return 'advanced';}
  return 'progress';
}
/** 下一步: always moves on, and finishes from the last step. */
export function nextStep(p) {if(currentStep(p))advance(p);return p.tutorial;}
export function skipTutorial(p) {p.tutorial={done:true};return p.tutorial;}
/** Coin rates in the text come from balance.json, so the tutorial never quotes a stale price. */
export function fillText(text) {
  return fillKeys(text)
    .replaceAll('{anywhere}',cardCoins(null,false))
    .replaceAll('{desk}',cardCoins('desk',false))
    .replaceAll('{hallNew}',cardCoins('hall',true));
}
/** A saved tutorial that makes sense, or undefined. A bad one is not worth refusing a save over. */
export function normalizeTutorial(t) {
  if(!t||typeof t!=='object'||Array.isArray(t))return undefined;
  if(t.done===true)return {done:true};
  if(Number.isInteger(t.step)&&t.step>=0&&t.step<STEPS.length&&Number.isFinite(t.progress)&&t.progress>=0)
    return {step:t.step,progress:t.progress};
  return undefined;
}
