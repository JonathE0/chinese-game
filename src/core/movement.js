// Source-engine (CS) style horizontal movement: ground friction and acceleration give a little
// run-up and a short slide, the air carries momentum with a touch of steering, and nothing in
// the air can add speed, so there is no bunny hopping.
export const GRAVITY=19;
export const JUMP=6.4;   // enough to clear a bench or a planter, not a boundary wall

// CS values scaled to a 4.5 m/s walk. Accelerate is raised from CS's 5.5 to 7 so walking reaches
// full speed in about a quarter of a second rather than nearly half.
const FRICTION=5.2,ACCELERATE=7,STOP_SPEED=1.44,AIR_ACCELERATE=.7;
// A jump from a standstill (or from against a ledge) may still drift this fraction of the cap, as
// in CS, so W + Space climbs onto a bench. Far below ground speed, so it gives nothing to hop for.
const AIR_FLOOR=.12;
// With W or S held, A/D count this much, so strafing steers (W+D runs about 27° off the view and
// keeps ~89% of forward speed) instead of trading forward speed for a 45° diagonal.
const STRAFE_WITH_FORWARD=.5;

/** Keys or stick (advance, strafe: -1..1 each) to a wish in view space: forward and sideways. */
export function inputWish(advance,strafe) {
  return {forward:advance,side:strafe*(1-(1-STRAFE_WITH_FORWARD)*Math.min(1,Math.abs(advance)))};
}

/** New horizontal velocity {x,z} after dt. wishDir is a unit vector (or zero), wishSpeed in m/s,
 *  cap the current speed limit (run or walk, already scaled). */
export function stepVelocity(v,wishDir,wishSpeed,grounded,dt,cap) {
  let {x,z}=v;const before=Math.hypot(x,z);
  if(grounded&&before>0){
    const drop=Math.max(before,STOP_SPEED)*FRICTION*dt,scale=Math.max(before-drop,0)/before;
    x*=scale;z*=scale;
  }
  const add=wishSpeed-(x*wishDir.x+z*wishDir.z);
  if(wishSpeed>0&&add>0){
    const accel=Math.min((grounded?ACCELERATE:AIR_ACCELERATE)*dt*wishSpeed,add);
    x+=accel*wishDir.x;z+=accel*wishDir.z;
  }
  if(!grounded){
    // Air steering may turn or slow you, never speed you up, and never past the cap.
    const now=Math.hypot(x,z),limit=Math.min(Math.max(before,AIR_FLOOR*cap),cap);
    if(now>limit){x*=limit/now;z*=limit/now;}
  }
  return {x,z};
}
