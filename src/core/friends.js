// Friendship with 林阿姨, 小美 and 陈叔叔, and the postcards you write them
// (docs/superpowers/plans/2026-09-24-friends-and-postcards.md). Saved under
// profile.learning.friends and profile.learning.postcards; see normalizeLearning.
import friends from '../content/friends.json' with {type:'json'};
import catalog from '../content/catalog.json' with {type:'json'};
import quests from '../content/quests.json' with {type:'json'};

export {friends};
const today=p=>p.dayIndex??0;
const top=friends.levels.at(-1);
export const isFriend=npc=>Object.hasOwn(friends.people,npc);
export const levelOf=points=>friends.levels.findLast(l=>points>=l.points);
/** One of a person's lines, voiced as friend-<npc>-<key>. */
export const friendLine=(npc,key)=>({...(friends.lines[npc]?.[key]??friends.shared[key]),speaker:npc,audio:`friend-${npc}-${key}`});

export function friendOf(p,npc){
 const all=(p.learning??={}).friends??={};
 return all[npc]??={points:0,seen:[],missions:[]};
}
/** A daily source (`day` for the chat, `gift`, `post`) pays once per person per game day. */
function earn(f,field,amount,day){
 if(f[field]===day)return 0;
 f[field]=day;f.points=Math.min(99999,f.points+amount);
 return amount;
}
const take=(p,id)=>{if(--p.inventory[id]<=0)delete p.inventory[id];};

/** The first finished chat of the day. */
export const chatted=(p,npc)=>earn(friendOf(p,npc),'day',friends.points.chat,today(p));

/** Food and small things in the bag that could be given away (never an earned certificate). */
export const giftables=p=>catalog.filter(i=>friends.giftCategories.includes(i.category)&&i.sellable!==false&&(p.inventory[i.id]??0)>0);

/** Give one thing: `{line, points}`, or null for something you cannot give. A second gift the
 *  same day is politely refused and stays in the bag. */
export function giveGift(p,npc,itemId){
 const f=friendOf(p,npc),day=today(p);
 if(f.gift===day)return {line:'gift-again',points:0};
 if(!giftables(p).some(i=>i.id===itemId))return null;
 take(p,itemId);
 const liked=friends.people[npc].liked.includes(itemId);
 return {line:liked?'gift-liked':'gift-plain',points:earn(f,'gift',liked?friends.points.liked:friends.points.gift,day)};
}

const waiting=(p,npc)=>(p.learning?.postcards??[]).filter(c=>c.to===npc&&!c.replied&&c.day<today(p));
const linesOf=(npc,level)=>Object.keys(friends.lines[npc]).filter(k=>k.startsWith(level+'-'));

/**
 * Walking up to a friend counts any mission finished for them since, and lists what they have to
 * say, in order: the answer to a postcard sent on an earlier day, then the lines of every level
 * reached that have not played. Nothing is spent here: each line takes effect in `heard`, when it
 * is actually shown, so walking off first keeps it for next time.
 */
export function visit(p,npc){
 const f=friendOf(p,npc),person=friends.people[npc],said=[];
 for(const id of person.missions){
  const flag=quests.quests.find(q=>q.id===id)?.done?.flag;
  if(flag&&p.completed.includes(flag)&&!f.missions.includes(id)){f.missions.push(id);f.points=Math.min(99999,f.points+friends.points.mission);}
 }
 if(waiting(p,npc).length)said.push('post-reply');
 for(const level of friends.levels.slice(1))
  if(f.points>=level.points&&!f.seen.includes(level.id))said.push(...linesOf(npc,level.id));
 return {said};
}
/**
 * One line from `visit` has been shown. The postcard answer marks the cards answered, pays the
 * postcard points and, for 陈叔叔, pins the card up; the last line of a level marks the level
 * heard and, at the top level, hands over the present. Returns the item given, if any.
 */
export function heard(p,npc,key){
 const f=friendOf(p,npc),person=friends.people[npc];
 if(key==='post-reply'){
  const post=waiting(p,npc);
  if(!post.length)return null;
  for(const c of post)c.replied=true;
  earn(f,'post',friends.points.postcard,today(p));
  if(person.pin)f.pinned=true;
  return null;
 }
 const level=friends.levels.find(l=>linesOf(npc,l.id).at(-1)===key);
 if(!level||f.seen.includes(level.id))return null;
 f.seen.push(level.id);
 const item=level===top&&person.present.item;
 if(!item)return null;
 p.inventory[item]=(p.inventory[item]??0)+1;
 return item;
}

/** A shop's price after a friend's discount: 陈叔叔's 九折 once he has said so. */
export function priced(p,shop,item){
 const [npc,person]=Object.entries(friends.people).find(([,x])=>x.present.shop===shop)??[];
 if(!npc||!p.learning?.friends?.[npc]?.seen?.includes(top.id))return item;
 const rate=person.present.discount;
 return {...item,price:Math.round(item.price*rate),minPrice:Math.round((item.minPrice??item.price)*rate)};
}

export const sentToday=(p,to)=>(p.learning?.postcards??[]).some(c=>c.to===to&&c.day===today(p));
/** Post a card: uses one `postcard` from the bag; one per person per day; the newest 50 are kept. */
export function sendPostcard(p,to,lines){
 if(!isFriend(to)||(p.inventory.postcard??0)<1||sentToday(p,to))return false;
 take(p,'postcard');
 const cards=(p.learning??={}).postcards??=[];
 cards.push({to,day:today(p),lines:[...lines],replied:false});
 if(cards.length>50)cards.splice(0,cards.length-50);
 return true;
}
/** Whether a friend has one of your cards on their wall (陈叔叔 pins his up once he answers it). */
export const pinned=(p,npc)=>p.learning?.friends?.[npc]?.pinned===true;

/** Walking into one of the postcard's places (a district, the word hall) the first time. */
export function noteVisit(p,id){
 if(!friends.postcard.places.some(x=>x.id===id&&!x.flag))return false;
 const visited=(p.learning??={}).visited??=[];
 if(visited.includes(id))return false;
 visited.push(id);
 return true;
}

/**
 * The five rows of postcard tiles, one choice each. A place is offered once visited (`noteVisit`),
 * or once its flag is set (云海市中心: the metro has been ridden).
 */
export function postcardRows(p){
 const c=friends.postcard;
 const join=(head,x,id)=>({id,zh:`${head.zh}${x.zh}。`,pinyin:`${head.pinyin} ${x.pinyin}.`,en:`${head.en} ${x.en}.`});
 const carried=catalog.filter(i=>(p.inventory[i.id]??0)>0&&i.sellable!==false);
 const food=i=>['food','dish'].includes(i.category);
 return [
  c.to,
  c.places.filter(x=>x.flag?p.completed.includes(x.flag):(p.learning?.visited??[]).includes(x.id)).map(x=>join(c.went,x,'went-'+x.id)),
  [...carried.filter(i=>food(i)&&!c.notEaten.includes(i.id)).map(i=>join(c.ate,i,'ate-'+i.id)),c.learned,
   ...carried.filter(i=>!food(i)).map(i=>join(c.bought,i,'bought-'+i.id))],
  c.feel,
  c.close,
 ];
}
