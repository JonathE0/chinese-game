import {normalize,matchAnswer} from './language.js';
import {grant} from './economy.js';

/**
 * Evaluate a learner's reply against one lesson node, across every intent the conversation
 * engine supports. `name` and `variants` are unchanged — delegated straight to `matchAnswer` so
 * existing lessons keep matching exactly as before. `option` checks the reply against each
 * option's `accepted` list with the same normaliser as everything else, and reports which option
 * won so its `value` can be stored. `none` takes no input at all: the node always advances.
 */
export function evaluateNode(node,text='') {
  if (node.intent==='none') return {ok:true};
  if (node.intent==='option') {
    const value=normalize(text);
    const match=(node.options??[]).find(o=>(o.accepted??[]).some(a=>normalize(a)===value));
    return match ? {ok:true,value:match.value,choice:match.choice} : {ok:false};
  }
  return matchAnswer(text,node);
}

/** The buttons offered as modeled answers. An `option` node has no flat `choices` list of its
 *  own — each option supplies its own `choice` text instead. */
export function choicesFor(node) {
  return node.intent==='option' ? (node.options??[]).map(o=>o.choice) : (node.choices??[]);
}

/** Fold a successful answer into the conversation's saved state. Only a matched `option` node
 *  (with a `store` key) writes anything; every other intent leaves state untouched. */
export function applyState(state,node,result) {
  return node.intent==='option' && node.store ? {...state,[node.store]:result.value} : state;
}

/**
 * Award a lesson's completion coins exactly once. Repeat playthroughs of the same conversation
 * are expected — these are ordinary town errands, not one-shot cutscenes — so `grant`'s existing
 * replay-safe claim keeps every completion after the first from minting more coins. Whether this
 * was the first completion is reported back so a caller can still run its own follow-up (an
 * `onFinish` callback, a toast, moving the player) every single time, reward or not.
 */
export function completeLesson(profile,lessonId,coins) {
  const amount=grant(profile,'lesson:'+lessonId,coins);
  const firstTime=!profile.completed.includes(lessonId);
  if (firstTime) profile.completed.push(lessonId);
  return {amount,firstTime};
}

/**
 * A one-shot close hook: whatever is armed runs exactly once, the next time the panel closes —
 * by its own button, Esc or ×. Arming again (a new panel replacing the old one) replaces what
 * was pending, and arming nothing clears it, so closing a panel that never armed one runs
 * nothing. The Shell owns one of these; `run()` is called at the end of `Shell.close()`.
 */
export function closeHook() {
  let pending=null;
  return {
    arm(fn) { pending=typeof fn==='function' ? fn : null; },
    get armed() { return pending!==null; },
    run() { const fn=pending;pending=null;fn?.(); },
  };
}

/**
 * The end of a conversation, in order: pay the reward and remember the lesson (`completeLesson`,
 * once), then arm `hook` so `onFinish(state)` runs once when the completion panel closes, however
 * it closes. A conversation abandoned before this point arms nothing, so closing it runs nothing.
 */
export function finishConversation(profile,lessonId,coins,{hook,state={},onFinish}={}) {
  const result=completeLesson(profile,lessonId,coins);
  hook?.arm(onFinish ? ()=>onFinish(state) : null);
  return result;
}
