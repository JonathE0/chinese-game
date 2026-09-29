import data from '../content/harbour.json' with {type:'json'};
import {payFare,fareAt} from '../core/harbour.js';

/**
 * The ferry's ticket and the Ferris wheel's (task B-harbour; the harbour itself is
 * src/world/harbour.js, its rules src/core/harbour.js). E at a pier's gangway buys a 船票 and steps
 * aboard, E aboard at the far side steps off, E at the wheel's gate pays and seats you in a cabin.
 * What the crew and the attendant say shows as a notice, in their own voices.
 */
function say(ctx,key,extra=''){
  const line=data.lines[key];
  if(ctx.voice.available(line.audio))ctx.voice.play(line.audio);
  ctx.ui.notice(`${line.zh}${extra}${ctx.profile.settings.english?` / ${line.en}`:''}`);
}

export function openHarbour(ctx,id){
  const part=ctx.town?.harbour;
  if(!part)return;
  const [what,pier]=id.split(':');
  if(what==='off'){part.getOff();return;}
  const wheel=what==='wheel';
  if(wheel?!part.canRide():part.boardingProblem(pier))return;   // gone by now: the prompt is already off
  // Stepping back aboard before the ferry leaves is the ride already paid for (payFare takes nothing twice).
  const ride=wheel?{paid:false}:part.rideFor(pier),paid=payFare(ctx.profile,ride,wheel?data.wheel.fare:fareAt(ctx.profile,pier));
  if(!paid.ok){ctx.ui.notice('钱不够。 / Not enough coins.');return;}
  if(!(wheel?part.rideWheel():part.board(pier,ride))){ctx.profile.wallet+=paid.cost;return;}
  // The way back from the far landing is free to a wallet that cannot cover it: no ticket to sell.
  if(wheel||paid.cost)say(ctx,wheel?'wheel-on':'ticket',` −${paid.cost} 学习币`);
  if(paid.cost)ctx.music?.cue('purchase');
  ctx.save();
}
