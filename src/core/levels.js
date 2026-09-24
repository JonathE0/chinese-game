// Placement test and HSK mock exams (Task L-levels, docs/superpowers/plans/2026-09-24-learning-features.md).
// Progress lives in profile.learning.levels, normalised in ./learning.js.
import cfg from '../content/levels.json' with {type:'json'};
import balance from '../content/balance.json' with {type:'json'};

const levelsOf=p=>((p.learning??={}).levels??={});
export const certificateId=level=>`hsk-cert-${level}`;
/** One placement test per game day. */
export const canPlace=p=>levelsOf(p).placement?.day!==(p.dayIndex??0);

/** After a placement round: the next level to try, or the final result (0 when none passed). */
export function placementNext(level,right){
  const passed=right>=cfg.placement.pass;
  return passed&&level<cfg.placement.top?{next:level+1}:{result:passed?level:level-1};
}

/** Words shown known in the placement test join the schedule as familiar, with no coins.
 *  A record that is already stronger is left alone. */
export function markKnown(p,id,now=Date.now()){
  const skills=p.words[id]??={},old=skills.recognition,stage=cfg.knownStage;
  if((old?.stage??0)>=stage)return;
  skills.recognition={stage,due:now+balance.reviewIntervalsMinutes[stage-1]*60000,last:now,reviews:(old?.reviews??0)+1,learned:true};
}

export function finishPlacement(p,level,knownIds,now=Date.now()){
  for(const id of knownIds)markKnown(p,id,now);
  levelsOf(p).placement={level,day:p.dayIndex??0};
}

/** Score a mock exam; the first pass of a level records the day and gives its certificate. */
export function finishMock(p,level,score){
  const passed=score>=cfg.mock.pass;
  if(!passed)return {passed,certificate:null};
  const done=levelsOf(p).passed??={};
  if(done[level]!==undefined)return {passed,certificate:null};
  done[level]=p.dayIndex??0;
  const id=certificateId(level);
  p.inventory[id]=(p.inventory[id]??0)+1;
  return {passed,certificate:id};
}
