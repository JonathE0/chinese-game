// Progress for the learning features (docs/superpowers/plans/2026-09-24-learning-features.md).
// Each feature owns one key of `profile.learning`; a bad entry drops only itself.
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const whole=(v,lo,hi)=>Number.isSafeInteger(v)&&v>=lo&&v<=hi;
const text=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\u0000-\u001f]/.test(v);
const key=k=>text(k,40)&&!['__proto__','constructor','prototype'].includes(k);
const entries=(v,ok,limit)=>plain(v)?Object.fromEntries(Object.entries(v).filter(([k,x])=>key(k)&&ok(x)).slice(0,limit)):undefined;

export function normalizeLearning(v) {
  if(!plain(v))return undefined;
  const out={};
  // Where each word was first met: the place, the spot there, and the line it was heard in.
  const sources=entries(v.sources,s=>plain(s)&&key(s.place)&&Number.isFinite(s.x)&&Number.isFinite(s.z)&&(s.line===undefined||text(s.line,200)),5000);
  if(sources)out.sources=Object.fromEntries(Object.entries(sources).map(([k,s])=>[k,{place:s.place,x:s.x,z:s.z,...(s.line?{line:s.line}:{})}]));
  // Wrong answers per word; they feed the confusables deck.
  const misses=entries(v.misses,n=>whole(n,1,99999),8000);
  if(misses)out.misses=misses;
  // Level checks: the placement result, and the day each HSK mock exam was passed.
  if(plain(v.levels)){
    const levels={},pl=v.levels.placement;
    if(plain(pl)&&whole(pl.level,0,6)&&whole(pl.day,0,Number.MAX_SAFE_INTEGER))levels.placement={level:pl.level,day:pl.day};
    const passed=entries(v.levels.passed,d=>whole(d,0,Number.MAX_SAFE_INTEGER),6);
    if(passed)levels.passed=Object.fromEntries(Object.entries(passed).filter(([k])=>/^[1-6]$/.test(k)));
    out.levels=levels;
  }
  // Friendship per townsperson: points, the day the chat, a gift and a postcard last paid, the
  // levels whose lines have played, and the missions already counted.
  const gameDay=d=>whole(d,0,Number.MAX_SAFE_INTEGER),ids=(a,n)=>Array.isArray(a)?[...new Set(a.filter(key))].slice(0,n):[];
  const friends=entries(v.friends,f=>plain(f)&&whole(f.points,0,99999),10);
  if(friends)out.friends=Object.fromEntries(Object.entries(friends).map(([k,f])=>[k,{points:f.points,
    ...Object.fromEntries(['day','gift','post'].filter(x=>gameDay(f[x])).map(x=>[x,f[x]])),seen:ids(f.seen,10),missions:ids(f.missions,50),...(f.pinned===true?{pinned:true}:{})}]));
  // The postcard's places walked into (districts, the word hall).
  if(Array.isArray(v.visited))out.visited=ids(v.visited,20);
  // Postcards sent, oldest first, the newest 50 kept.
  if(Array.isArray(v.postcards))out.postcards=v.postcards.filter(c=>plain(c)&&key(c.to)&&gameDay(c.day)&&typeof c.replied==='boolean'
    &&Array.isArray(c.lines)&&c.lines.length<=8&&c.lines.every(key)).slice(-50).map(c=>({to:c.to,day:c.day,lines:[...c.lines],replied:c.replied}));
  return out;
}

/** Where a word was first met: `{place, x, z, line?}`, recorded once and never moved. */
export function noteSource(p,zh,spot){
  if(!key(zh)||!spot)return false;
  const sources=(p.learning??={}).sources??={};
  if(sources[zh])return false;
  sources[zh]={place:spot.place,x:spot.x,z:spot.z,...(spot.line?{line:spot.line}:{})};
  return true;
}
/** One more wrong answer for a word; the confusables deck puts the most-missed first. */
export function addMiss(p,zh){
  if(!key(zh))return;
  const misses=(p.learning??={}).misses??={};
  misses[zh]=Math.min(99999,(misses[zh]??0)+1);
}
