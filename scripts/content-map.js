/**
 * Writes docs/CONTENT_MAP.md: a compact index of what the game's content defines (districts,
 * buildings, interiors, shops and their stock, NPCs, missions, daily errands, the city, build sites,
 * recipes, words and stories), so people and agents can see what exists without opening the large
 * JSON files. `npm run map` runs it alone; `npm run check:content` and `npm run verify` run it after
 * validation. The output carries no timestamps, so an unchanged game leaves the file unchanged.
 */
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {TASKS} from '../src/core/daily.js';

const url=p=>new URL(`../${p}`,import.meta.url);
const read=p=>JSON.parse(readFileSync(url(`src/content/${p}`),'utf8'));
const world=read('world.json'),rooms=read('rooms.json'),npcs=read('npcs.json'),catalog=read('catalog.json');
const city=read('city.json'),recipes=read('recipes.json'),vocabulary=read('vocabulary.json'),ambient=read('ambient.json');
const {quests}=read('quests.json'),{sites}=read('sites.json'),{objects}=read('objects.json'),{stories}=read('stories.json');
const lessons=readdirSync(url('src/content/lessons')).filter(f=>f.endsWith('.json')).sort().map(f=>read(`lessons/${f}`));

const at=(x,z)=>`${x},${z}`;
const cell=v=>String(v??'').replace(/\|/g,'\\|');
const table=(head,rows)=>[head,head.map(()=>'---'),...rows].map(r=>`| ${r.map(cell).join(' | ')} |`).join('\n');
const tally=list=>Object.entries(list.reduce((m,k)=>(m[k]=(m[k]||0)+1,m),{})).map(([k,n])=>n>1?`${k} ×${n}`:k).join(', ');
const doneWhen=d=>d.flag?`flag ${d.flag}`:`${d.metric}${d.count?` ≥ ${d.count}`:''}${d.district?` (${d.district})`:''}`;
const roomsIn=b=>Object.entries(rooms).filter(([,r])=>r.building===b).map(([id])=>id).join(', ');
const npcAt=Object.fromEntries(world.npcs.map(n=>[n.id,at(n.x,n.z)]));

const shopsOf=i=>[].concat(i.shop??[]);
const item=i=>`${i.zh} ${i.id} ${i.price}${i.negotiable?'~':''}`;

/** Where a catalog `shop` id is sold: the interior that stocks it (or shares its id), or the NPC who runs it. */
function soldAt(shop){
  const room=Object.entries(rooms).find(([id,r])=>r.stock===shop||id===shop);
  if(room)return `${room[1].zh}, room ${room[0]}`;
  const npc=npcs.find(n=>n.id===shop);
  return npc?`${npc.zh}, ${npc.role}`:'';
}
function shopLine(shop){
  const where=soldAt(shop);
  return `- **${shop}**${where?` (${where})`:''}: `+catalog.filter(i=>shopsOf(i).includes(shop)).map(item).join(', ');
}
function roomNotes(r){
  return [r.interiorOnly&&'inside only',r.annexes?.length&&`annexes → ${r.annexes.map(a=>a.room).join(', ')}`,r.decoratable&&'decoratable',
    r.lectern?.panel&&`${r.lectern.panel} panel`,r.staff?.length&&`${r.staff.length} staff`].filter(Boolean).join(', ');
}

const out=[
'# Content map','',
'Generated from `src/content/` by `scripts/content-map.js`; do not edit by hand. Regenerate with',
'`npm run map` (`npm run check:content` and `npm run verify` also do it). Positions are `x,z`;',
'the city uses its own coordinates.','',
'## Districts','',
table(['id','zh','en','level','gate'],world.districts.map(d=>[d.id,d.zh,d.en,d.level,
  d.gate?.requires?Object.entries(d.gate.requires).map(([k,v])=>`${k} ${v}`).join(' + '):'open'])),'',
'## Buildings','',
table(['sign','id','district','x,z','interior','build site'],
  world.buildings.map(b=>[b.sign,b.id,b.district,at(b.x,b.z),roomsIn(b.id),b.site])),'',
'## Interiors','',
table(['id','zh','en','building','stock','opens when','notes'],Object.entries(rooms).map(([id,r])=>
  [id,r.zh,r.en,r.building,r.stock,r.opens?`${r.opens.flag}: ${r.opens.en}`:'',roomNotes(r)])),'',
'## Shops and stock','','Prices in 学习币; `~` marks a negotiable price. An item sold in several shops is listed under each.','',
...[...new Set(catalog.flatMap(shopsOf))].map(shopLine),
`- Not sold in any shop: ${catalog.filter(i=>!shopsOf(i).length).map(item).join(', ')||'none'}`,'',
'## NPCs','',
table(['id','zh','en','role','lesson','x,z','voice'],npcs.map(n=>[n.id,n.zh,n.en,n.role,n.lesson,npcAt[n.id],n.voice])),'',
'## Missions (`quests.json`, in order)','',
table(['id','zh','done when','where'],quests.map(q=>
  [q.id,q.zh,doneWhen(q.done),q.where?`${q.where.district} ${at(q.where.x,q.where.z)} ${q.where.zh}`:''])),'',
'## Daily errands (`src/core/daily.js`)','',
table(['id','zh','done when','coins'],TASKS.map(t=>[t.id,t.zh,`${t.metric} ≥ ${t.goal}`,t.reward])),'',
`## City: ${city.place.zh} (${city.place.en})`,'',
`- Metro from ${city.station.zh} in the square at ${at(city.station.x,city.station.z)}. Fares: single ${city.fare.single}, pass ${city.fare.pass} for ${city.fare.passDays} days. Size ${city.place.size.join('×')}.`,
`- Towers: ${city.towers.filter(t=>t.sign).map(t=>`${t.sign} ${at(t.x,t.z)}`).join(' · ')}; plus ${city.towers.filter(t=>!t.sign).length} unsigned.`,
`- Props: ${tally(city.props.map(p=>p.kind))}.`,
`- People: ${city.people.map(p=>`${p.id} ${p.zh} ${at(p.x,p.z)} (${p.lines.length} lines)`).join(' · ')}.`,
...(city.department?[`- Door at ${at(city.department.x,city.department.z)} leads to interior ${city.department.room} (${city.department.label}).`]:[]),'',
'## Build sites','',
table(['id','zh','district','x,z','permit','needs','unlocks','income'],sites.map(s=>
  [s.id,s.zh,s.district,at(s.x,s.z),s.permit,s.needs.map(n=>`${n.item} ×${n.count}`).join(', '),s.unlocks,s.income])),'',
'## Recipes','',
table(['id','zh','ingredients','seconds','makes'],recipes.map(r=>
  [r.id,r.zh,Object.entries(r.ingredients).map(([k,n])=>n>1?`${k} ×${n}`:k).join(', '),r.seconds,r.output])),'',
'## Town props and passers-by','',
...world.districts.map(d=>`- **${d.id}**: ${tally(world.props.filter(p=>p.district===d.id).map(p=>p.kind))}; ${world.people.filter(p=>p.district===d.id).length} passers-by`),'',
'## Words, lessons and reading','',
`- Town words (vocabulary.json): ${vocabulary.map(v=>`${v.zh} ${v.id}`).join(', ')}`,
`- Nameable objects (objects.json): ${Object.keys(objects).length} (${tally(Object.values(objects).map(o=>o.hsk?`HSK ${o.hsk}`:'no level'))})`,
`- Lessons: ${lessons.map(l=>`${l.id} ${l.title} (${l.nodes.length} nodes)`).join(', ')}`,
`- Ambient lines: ${ambient.map(a=>a.id).join(', ')}`,
`- Library stories: ${stories.map(s=>`${s.zh} ${s.id} (level ${s.level}, ${s.lines.length} lines)`).join(', ')}`,
'- HSK word lists: `public/hsk/words.json` and `src/content/hsk*.json` (large: query them, never read them whole)',''];

const text=out.join('\n');
writeFileSync(url('docs/CONTENT_MAP.md'),text);
console.log(`Content map: docs/CONTENT_MAP.md, ${text.split('\n').length-1} lines.`);
