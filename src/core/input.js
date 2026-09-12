const MAX_PENDING=600;
const LOOK_RESPONSE=30;
const clamp=value=>Math.max(-MAX_PENDING,Math.min(MAX_PENDING,value));

export function isTyping(target){
  return !!(target?.isContentEditable||target?.closest?.('input,textarea,select,[role="textbox"]'));
}

/** Pixel deltas are already displacement; do not multiply them by frame duration. */
export function queueLook(pending,x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y))return;
  pending.x=clamp(pending.x+clamp(x));
  pending.y=clamp(pending.y+clamp(y));
}

export function drainLook(pending,dt){
  if(!Number.isFinite(dt)||dt<=0)return {x:0,y:0};
  const share=1-Math.exp(-LOOK_RESPONSE*dt);
  const x=pending.x*share,y=pending.y*share;
  pending.x-=x;pending.y-=y;
  return {x,y};
}

export const UTILITY_PANELS=new Set(['journal','inventory','wordbank','status','settings']);
export function shortcutAllowed(event,{started,panelId,placing=false,reviewing=false}){
  return started&&!placing&&!reviewing&&!event.repeat&&!event.isComposing&&
    !event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.shiftKey&&
    !isTyping(event.target)&&(!panelId||UTILITY_PANELS.has(panelId));
}
