/** 打车: the taxis on the Yunhai avenue. Task 3 of docs/superpowers/plans/2026-09-11-city-quests.md. */
import {openDialogue,showLine} from './dialogue.js';
import {CITY,CITY_OFFSET} from '../world/city.js';
import {dropOffAtTower} from '../core/city.js';
import {taxiFareProblem,payTaxiFare} from '../core/taxi.js';
import {fadeThrough} from './fade.js';

export function openTaxi(ctx){
  openDialogue(ctx,'city-taxi',{onFinish:state=>arrive(ctx,state)});
}

/**
 * The driver has been told where to go. Too little money for the fare stops the ride before it
 * starts — no fade, no move, no debit. Otherwise the ride happens and the fare is taken once it
 * is over, exactly as `city-taxi`'s own line about the fare only comes up on arrival.
 */
function arrive(ctx,state){
  const tower=CITY.towers.find(t=>t.sign===state.destination);
  if(!tower)return;
  if(taxiFareProblem(ctx.profile)){showLine(ctx,'city-taxi','broke');return;}
  ride(ctx,tower);
}

/**
 * A fade hides the jump across town — there is nothing about the drive itself worth showing. The
 * `city-taxi` mission is already satisfied at this point: finishing the conversation itself pushed
 * the lesson id to `profile.completed` (the same generic, repeat-safe reward every lesson gets),
 * so nothing here needs to touch a mission flag — only the fare.
 */
function ride(ctx,tower){
  // The drop-off stands clear of the tower's facade. 一号书店 is only found by going in through its
  // door (enterPlace in main.js), so being set down outside it finds nothing yet.
  const town=ctx.town,spot=dropOffAtTower(tower);
  town.setPaused(true);
  fadeThrough(()=>town.warp(spot.x+CITY_OFFSET,spot.z),{onDone:()=>{
    town.setPaused(false);
    payTaxiFare(ctx.profile);
    ctx.save();
    showLine(ctx,'city-taxi','arrived');
  }});
}
