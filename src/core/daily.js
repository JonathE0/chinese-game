/**
 * Small errands, three a day.
 *
 * The main missions carry the story; these are the reason to come back tomorrow, and they are
 * the steady way to earn coins without grinding review cards. The three are chosen from the
 * dayIndex, so they are the same all day however many times you open the journal, and reset
 * when the clock passes midnight. A festival day adds its own errand as a fourth.
 */
import {festivalOn} from './festivals.js';

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
  {id:'order',   zh:'用中文点一次餐', pinyin:'Yòng Zhōngwén diǎn yí cì cān', en:'Order a meal in Chinese.',            metric:'ordered',    goal:1,  reward:10},
  {id:'hunt',    zh:'认出一样带部首的东西', pinyin:'Rènchū yí yàng dài bùshǒu de dōngxi', en:"Name something with a hunt's component.", metric:'hunt-found', goal:1, reward:8},
];
// One extra errand on each festival day, keyed by the festival's id in festivals.json.
const FESTIVAL_TASKS={
  chunjie: {id:'bainian', zh:'给三个人拜年',     pinyin:'Gěi sān ge rén bàinián',             en:'Wish three people a happy new year',          metric:'greeted',    goal:3, reward:12},
  yuanxiao:{id:'dengmi',  zh:'猜对三个灯谜',     pinyin:'Cāi duì sān ge dēngmí',              en:'Guess three lantern riddles',                 metric:'riddles',    goal:3, reward:12},
  duanwu:  {id:'zongzi',  zh:'吃一个粽子',       pinyin:'Chī yí ge zòngzi',                   en:'Eat a zongzi',                                metric:'ate-zongzi', goal:1, reward:10},
  zhongqiu:{id:'shangyue',zh:'晚上在公园看月亮', pinyin:'Wǎnshang zài gōngyuán kàn yuèliang', en:'Look at the moon in the park in the evening', metric:'moon',       goal:1, reward:10},
};

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
  const daily=syncDay(profile,day),festival=FESTIVAL_TASKS[festivalOn(day)?.id];
  return [...picks.map(({task})=>task),...(festival?[festival]:[])].map(task=>{
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
