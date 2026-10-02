/**
 * Small signs of life.
 *
 * The people in the town are blocks, and they should stay blocks — the aim here is only that
 * standing still does not look like being switched off. Everything is deliberately small and
 * slow: a blink, a glance to one side and back, a change of expression that goes no further
 * than lifting the corners of the mouth, a little weight shift. Nothing tracks the player and
 * nothing holds a stare, because both of those are what makes a face unsettling.
 */
const TAU=Math.PI*2;
const rand=(a,b)=>a+Math.random()*(b-a);

export function initIdle(person,seed=Math.random()){
  person.idle={
    t:seed*20,phase:seed*TAU,
    blinkIn:rand(1,5),blink:0,
    glanceIn:rand(3,11),glance:0,glanceTo:0,glanceAt:0,
    smile:seed>.55?1:0,smileAt:0,moodIn:rand(8,22),
    eyeScale:person.eyes?.[0]?.getLocalScale().clone(),
  };
  return person;
}

/** One person, one frame. `moving` suppresses the idle sway while a walk cycle is driving. */
export function animateIdle(person,dt,moving=false){
  const s=person.idle;
  if(!s)return;
  s.t+=dt;

  // Blink: a fast close, a fast open, then several seconds of nothing.
  s.blinkIn-=dt;
  if(s.blinkIn<=0){s.blink=.14;s.blinkIn=rand(2.4,7);}
  if(s.blink>0){
    s.blink-=dt;
    const closed=s.blink>0;
    if(s.eyeScale)for(const eye of person.eyes)eye.setLocalScale(s.eyeScale.x,closed?s.eyeScale.y*.12:s.eyeScale.y,s.eyeScale.z);
  }

  // A glance to one side, held briefly, then back to centre. Never toward the camera.
  s.glanceIn-=dt;
  if(s.glanceIn<=0){s.glanceTo=rand(-24,24);s.glanceAt=1.1+Math.random();s.glanceIn=rand(5,14);}
  if(s.glanceAt>0)s.glanceAt-=dt;else s.glanceTo*=Math.max(0,1-dt*2.2);
  s.glance+=(s.glanceTo-s.glance)*Math.min(1,dt*3.4);
  person.neck?.setLocalEulerAngles(Math.sin(s.t*.7+s.phase)*1.6,s.glance,0);

  // Expression drifts between a smaller grin and the sheets' open smile: the mouth hangs from its top
  // edge (src/world/people.js), so opening it is a stretch down and a little wider.
  s.moodIn-=dt;
  if(s.moodIn<=0){s.smile=s.smile?0:1;s.moodIn=rand(9,26);}
  s.smileAt+=(s.smile-s.smileAt)*Math.min(1,dt*1.6);
  person.mouth?.setLocalScale(.9+.1*s.smileAt,.7+.3*s.smileAt,1);

  if(moving)return;
  // Standing still: breathe, and shift weight from one foot to the other.
  const breath=Math.sin(s.t*1.05+s.phase);
  person.upper?.setLocalEulerAngles(breath*.7,0,Math.sin(s.t*.42+s.phase)*1.1);
  person.arms?.forEach((arm,i)=>arm.setLocalEulerAngles(Math.sin(s.t*.9+s.phase+i*.6)*2.6,0,i?-2:2));
  person.legs?.forEach((leg,i)=>leg.setLocalEulerAngles(Math.sin(s.t*.42+s.phase)*(i?1.4:-1.4),0,0));
}

/** Put the limbs back where a walk cycle expects them. */
export function restIdle(person){
  person.upper?.setLocalEulerAngles(0,0,0);
  person.neck?.setLocalEulerAngles(0,0,0);
}
