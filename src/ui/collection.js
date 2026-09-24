import objectNames from '../content/objects.json' with {type:'json'};
import {escapeHtml as esc} from '../core/language.js';
import {pinyinHtml} from './shell.js';
import {icon} from './art.js';
import {CITY} from '../world/city.js';
import {PEOPLE,activeHunts,claimHunt} from '../core/collection.js';
import balance from '../content/balance.json' with {type:'json'};

const NAMES=objectNames.objects;

/**
 * Every nameable object id in each area, read from the live registry (boxes and look boxes) by
 * place and position, so the book can never drift from what is actually in the world. Town
 * boxes go to the district they stand in; rooms are grouped by the room's Chinese name.
 */
function areas(town){
  town.ensureCity();   // built once and kept; without it the city tab would be empty until the first ride
  const tabs=new Map([...town.data.districts.map(d=>[d.id,d.zh]),['city',CITY.place.zh],['indoors','室内']]
    .map(([id,zh])=>[id,{zh,groups:new Map()}]));
  for(const box of [...town.registry.boxes,...town.registry.looks]){
    const id=box.name?.id;
    // Signs and people are left out; so are stall carts and their keepers, which come and go
    // with the hour and would make the counts drift through the day.
    if(!id||box.name.sign||PEOPLE.has(id)||!NAMES[id]||box.owner==='moving'||box.group?.startsWith('stall:'))continue;
    const [tab,group]=box.place==='town'?[town.districtAt(box.x,box.z).id,'']
      :box.place==='city'?['city',''] :['indoors',town.rooms.get(box.place)?.data?.zh??box.place];
    const groups=tabs.get(tab).groups;
    if(!groups.has(group))groups.set(group,new Set());
    groups.get(group).add(id);
  }
  for(const t of tabs.values())t.ids=[...new Set([...t.groups.values()].flatMap(set=>[...set]))];
  return tabs;
}

export function openCollection(ctx,tab){
  render(ctx,ctx.ui.open('collection','图鉴','COLLECTION'),tab);
}

function render(ctx,body,tab){
  const tabs=areas(ctx.town),found=new Set(ctx.profile.discovered),s=ctx.profile.settings;
  const all=[...new Set([...tabs.values()].flatMap(t=>t.ids))];
  const hunts=activeHunts(all.map(id=>({id,zh:NAMES[id].zh})));
  const done=hunt=>hunt.targets.every(id=>found.has(id));
  const count=ids=>`${ids.filter(id=>found.has(id)).length}/${ids.length}`;
  tab=tab==='hunts'||tabs.has(tab)?tab:tabs.keys().next().value;
  const chip=id=>found.has(id)
    ?`<button class="discovered-chip" data-clip="obj-${esc(id)}" aria-label="${esc(NAMES[id].zh)}">${esc(NAMES[id].zh)}${pinyinHtml(NAMES[id].pinyin,NAMES[id].zh)?`<small>${pinyinHtml(NAMES[id].pinyin,NAMES[id].zh)}</small>`:''}${s.english?`<small>${esc(NAMES[id].en)}</small>`:''}</button>`
    :'<span class="discovered-chip">？？</span>';
  const chips=ids=>`<div class="discovered-list">${ids.map(chip).join('')}</div>`;
  const tabButton=(id,zh,n)=>`<button class="level-tab ${id===tab?'active':''}" data-tab="${id}"><b>${esc(zh)}</b><small>${n}</small></button>`;
  const areaBody=t=>[...t.groups].map(([zh,ids])=>
    (zh?`<h3 class="section-title">${esc(zh)} <small>${count([...ids])}</small></h3>`:'')+chips([...ids])).join('');
  const huntBody=()=>hunts.map(hunt=>{
    const claimed=ctx.profile.claims['hunt:'+hunt.id];
    return `<h3 class="section-title">${esc(hunt.zh)} <small>${esc(hunt.en)} · ${count(hunt.targets)}</small>
      ${claimed?'<span class="daily-reward done">已领</span>'
        :done(hunt)?`<button class="primary daily-claim" data-hunt="${esc(hunt.id)}">领 ${balance.huntCoins}</button>`
        :`<span class="daily-reward">${icon('coin',13)} ${balance.huntCoins}</span>`}</h3>${chips(hunt.targets)}`;
  }).join('');
  body.innerHTML=`<p class="microcopy">已找到 <b id="collection-total">${count(all)}</b> <small>found</small></p>
    <div class="level-tabs">${[...tabs].map(([id,t])=>tabButton(id,t.zh,count(t.ids))).join('')}${tabButton('hunts','找部首',`${hunts.filter(done).length}/${hunts.length}`)}</div>
    <div id="collection-body">${tab==='hunts'?huntBody():areaBody(tabs.get(tab))}</div>`;
  body.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>render(ctx,body,b.dataset.tab));
  body.querySelectorAll('[data-clip]').forEach(b=>b.onclick=()=>{if(ctx.voice.available(b.dataset.clip))ctx.voice.play(b.dataset.clip);});
  body.querySelectorAll('[data-hunt]').forEach(b=>b.onclick=()=>{
    const hunt=hunts.find(h=>h.id===b.dataset.hunt),coins=claimHunt(ctx.profile,hunt,hunt.targets);
    if(!coins)return;
    ctx.music?.cue('reward');ctx.save();ctx.ui.notice(`+${coins} 学习币。`);render(ctx,body,'hunts');
  });
}
