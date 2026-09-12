/**
 * Small errands, three a day.
 *
 * The main missions carry the story; these are the reason to come back tomorrow, and they are
 * the steady way to earn coins without grinding review cards. The three are chosen from the
 * dayIndex, so they are the same all day however many times you open the journal, and reset
 * when the clock passes midnight.
 */
const TASKS=[
  {id:'study',   zh:'复习十张词卡',   pinyin:'Fùxí shí zhāng cí kǎ',    en:'Review ten word cards, anywhere.',            metric:'reviews',    goal:10, reward:14},
  {id:'name',    zh:'认出五样新东西', pinyin:'Rèn chū wǔ yàng xīn dōngxi', en:'Name five things you have not named before.', metric:'discovered', goal:5,  reward:12},
  {id:'grocery', zh:'去买点吃的',     pinyin:'Qù mǎi diǎn chī de',      en:'Buy something to eat from a shop.',           metric:'bought-food',goal:2,  reward:10},
  {id:'eat',     zh:'好好吃一顿',     pinyin:'Hǎohāo chī yí dùn',       en:'Actually eat something from your bag.',       metric:'meals',      goal:1,  reward:9},
  {id:'visit',   zh:'走进两家店',     pinyin:'Zǒu jìn liǎng jiā diàn',  en:'Step inside two different shops today.',      metric:'visits',     goal:2,  reward:9},
  {id:'chat',    zh:'跟人说说话',     pinyin:'Gēn rén shuōshuo huà',    en:'Talk to someone in town.',                    metric:'talks',      goal:1,  reward:8},
  {id:'sit',     zh:'坐下来歇一会儿', pinyin:'Zuò xiàlái xiē yíhuìr',   en:'Sit down somewhere and take a break.',        metric:'sits',       goal:1,  reward:7},
  {id:'tidy',    zh:'布置一下房间',   pinyin:'Bùzhì yíxià fángjiān',    en:'Change something in your room.',              metric:'furnished',  goal:1,  reward:11},
  {id:'cook',    zh:'自己做顿饭',     pinyin:'Zìjǐ zuò dùn fàn',        en:'Cook a meal in your own kitchen.',            metric:'cooked',     goal:1,  reward:12},
];

function noise(dayIndex,salt){
  let hash=2166136261^((dayIndex>>>0)*2654435761>>>0);
  for(const ch of String(salt)){hash^=ch.codePointAt(0);hash=Math.imul(hash,16777619)>>>0;}
  return (hash>>>8)/16777216;
}

/** Reset the counters when the in-game day rolls over. Safe to call every frame. */
export function syncDay(profile,dayIndex){
  const day=dayIndex??0;
  if(!profile.daily||profile.daily.day!==day)profile.daily={day,counts:{},claimed:[]};
  return profile.daily;
}

export function todaysTasks(profile,dayIndex){
  const day=dayIndex??profile.dayIndex??0;
  const picks=[...TASKS].map(task=>({task,roll:noise(day,task.id)})).sort((a,b)=>a.roll-b.roll).slice(0,3);
  const daily=syncDay(profile,day);
  return picks.map(({task})=>{
    const have=Math.min(task.goal,daily.counts[task.metric]??0);
    return {...task,have,done:have>=task.goal,claimed:daily.claimed.includes(task.id)};
  });
}

/** Record progress against whatever the player just did. Unused metrics cost nothing. */
export function bump(profile,metric,amount=1){
  const daily=syncDay(profile,profile.dayIndex??0);
  daily.counts[metric]=Math.min(999,(daily.counts[metric]??0)+amount);
  return daily.counts[metric];
}

/** Pay out one finished task, once. */
export function claimTask(profile,taskId){
  const task=todaysTasks(profile,profile.dayIndex??0).find(t=>t.id===taskId);
  if(!task||!task.done||task.claimed)return {ok:false};
  profile.daily.claimed.push(taskId);
  profile.wallet+=task.reward;
  return {ok:true,reward:task.reward};
}

export const dailyReady=(profile,dayIndex)=>todaysTasks(profile,dayIndex).filter(t=>t.done&&!t.claimed).length;
export {TASKS};
