import harbour from '../content/harbour.json' with {type:'json'};

/**
 * 云海's harbour, the rules (task B-harbour, docs/superpowers/plans/2026-09-27-development-wave-3.md):
 * where the ferry, the boats and the Ferris wheel are at a given moment, who may board, and what a
 * ride costs. The scene is src/world/harbour.js, the tickets and the rides src/ui/harbour.js.
 *
 * Everything runs off the game clock, as real seconds since midnight (a game hour is a real minute),
 * so the ferry is wherever the clock says whether anyone is watching, and a clock set by a test or
 * a night's sleep simply moves it on. Every period divides a day, so nothing jumps at midnight.
 */
export const HARBOUR=harbour;
export const DAY=24*60;
export const clockSeconds=hour=>hour*60;
const wrap=(v,m)=>((v%m)+m)%m;
const smooth=u=>u*u*(3-2*u);

/**
 * Where the ferry is at `t`: docked at a pier (`at` 'near' or 'far', `leaves` seconds before it
 * sets off) or crossing (`at` null). `u` runs 0 at the near dock to 1 at the far dock, easing out
 * of one and into the other; `speed` is how fast `u` changes, per second. Writes into `out`.
 */
export function ferryAt(t,ferry=harbour.ferry,out={}){
  const {wait,crossing}=ferry;
  let s=wrap(t,2*(wait+crossing));
  out.leaves=null;out.speed=0;
  if(s<wait){out.at='near';out.u=0;out.leaves=wait-s;return out;}
  s-=wait;
  if(s<crossing){const v=s/crossing;out.at=null;out.u=smooth(v);out.speed=6*v*(1-v)/crossing;return out;}
  s-=crossing;
  if(s<wait){out.at='far';out.u=1;out.leaves=wait-s;return out;}
  s-=wait;
  const v=s/crossing;out.at=null;out.u=1-smooth(v);out.speed=-6*v*(1-v)/crossing;
  return out;
}

/**
 * Why the tourist cannot board at `pier` now, or null when they can: the ferry has to be docked
 * there with at least `closing` seconds to go, and nobody boards a ferry they are already on.
 */
export function boardingProblem(state,pier,aboard,ferry=harbour.ferry){
  if(aboard)return 'aboard';
  if(state.at!==pier)return 'away';
  if(state.leaves<ferry.closing)return 'leaving';
  return null;
}

/**
 * Take the fare for one ride, `ride` being {paid} for the ride it buys. It is taken once, when the
 * ride begins: a ride already paid for costs nothing more, however often it is asked (a second E,
 * staying aboard for the way back). Too little money leaves the wallet untouched.
 */
export function payFare(profile,ride,fare){
  if(ride.paid)return {ok:true,cost:0};
  if(!Number.isSafeInteger(fare)||fare<0)return {ok:false,reason:'fare'};
  if(!(profile.wallet>=fare))return {ok:false,reason:'money'};
  profile.wallet-=fare;ride.paid=true;
  return {ok:true,cost:fare};
}

/** How far round the wheel has turned at `t`, as a share of a turn (0..1). */
export const wheelTurn=(t,wheel=harbour.wheel)=>wrap(t/wheel.turn,1);

/**
 * Getting into the wheel at `t`: the cabin at the bottom (the one nearest it, just past or just
 * coming) and how long until that cabin is back at the bottom having gone right round once. Cabin
 * `k` is at the bottom when the turn is -k/n; it goes round in the turning direction.
 */
export function wheelRide(t,wheel=harbour.wheel){
  const n=wheel.cabins,turn=wheelTurn(t,wheel);
  const cabin=wrap(Math.round(-turn*n),n);
  const past=wrap(turn+cabin/n+.5,1)-.5;   // how far past the bottom that cabin is, in turns
  return {cabin,seconds:(1-past)*wheel.turn};
}

/** A loop boat at `t`: how far round its route it is, in metres (0 at its mooring), and how fast it goes. */
export function loopAt(t,boat,length,out={}){
  const ramp=6,v=boat.speed,cruise=length/v+ramp,s=wrap(t-boat.offset,boat.period);
  if(s>=cruise){out.d=0;out.speed=0;return out;}
  if(s<ramp){out.d=v*s*s/(2*ramp);out.speed=v*s/ramp;}
  else if(s>cruise-ramp){const r=cruise-s;out.d=length-v*r*r/(2*ramp);out.speed=v*r/ramp;}
  else{out.d=v*(s-ramp/2);out.speed=v;}
  return out;
}

/**
 * A smooth curve through `points` ([x, z]; `closed` joins the last back to the first), walked by
 * distance: `at(d, out)` writes where it is `d` metres along ({x, z}) and which way it runs there
 * ({dx, dz}, a unit vector). Catmull-Rom between the points, measured once into a table so that
 * going along it at a steady speed looks steady; nothing is allocated by `at`.
 */
export function curve(points,closed=false,steps=24){
  const n=points.length,segments=closed?n:n-1;
  const P=i=>points[closed?wrap(i,n):Math.max(0,Math.min(n-1,i))];
  const ts=[],lengths=[0];
  let px=points[0][0],pz=points[0][1],total=0;
  const spot={x:0,z:0,dx:0,dz:0};
  for(let i=0;i<segments;i++)for(let k=1;k<=steps;k++){
    evaluate(i,k/steps,spot);
    total+=Math.hypot(spot.x-px,spot.z-pz);px=spot.x;pz=spot.z;
    ts.push(i+k/steps);lengths.push(total);
  }
  ts.unshift(0);
  function evaluate(i,t,out){
    const a=P(i-1),b=P(i),c=P(i+1),d=P(i+2),t2=t*t,t3=t2*t;
    for(let axis=0;axis<2;axis++){
      const p0=a[axis],p1=b[axis],p2=c[axis],p3=d[axis];
      const value=.5*(2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3);
      const slope=.5*((-p0+p2)+2*(2*p0-5*p1+4*p2-p3)*t+3*(-p0+3*p1-3*p2+p3)*t2);
      if(axis===0){out.x=value;out.dx=slope;}else{out.z=value;out.dz=slope;}
    }
    const len=Math.hypot(out.dx,out.dz)||1;out.dx/=len;out.dz/=len;
    return out;
  }
  function at(d,out={}){
    d=closed?wrap(d,total):Math.max(0,Math.min(total,d));
    let lo=0,hi=lengths.length-1;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(lengths[mid]<=d)lo=mid;else hi=mid;}
    const span=lengths[hi]-lengths[lo]||1,u=ts[lo]+(ts[hi]-ts[lo])*(d-lengths[lo])/span;
    const i=Math.min(segments-1,Math.floor(u));
    return evaluate(i,u-i,out);
  }
  return {length:total,at};
}

/**
 * What boarding at `pier` costs: the fare, except that nobody is left stranded across the bay. The
 * far landing has no other way back, so a wallet that cannot cover the fare there rides home free.
 */
export const fareAt=(profile,pier,fare=harbour.ferry.fare)=>pier==='far'&&!(profile.wallet>=fare)?0:fare;

/**
 * A ticket holds for as long as its ferry stays at the pier it was bought at: step back ashore and
 * aboard again before it leaves and it is the same ride. `kept` is {ride, pier}; it comes back
 * while it still holds at `state`, and null once the ferry has gone (so keep what this returns).
 */
export const stillHolds=(kept,state)=>kept&&state.at===kept.pier?kept:null;
