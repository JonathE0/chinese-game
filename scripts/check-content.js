import {readFile,readdir,access} from 'node:fs/promises';
import {evaluateNode} from '../src/core/conversation.js';
const read=async name=>JSON.parse(await readFile(new URL('../src/content/'+name,import.meta.url),'utf8'));
const lessonFiles=(await readdir(new URL('../src/content/lessons/',import.meta.url))).filter(f=>f.endsWith('.json')).sort();
const [words,npcs,world,catalog,ambient,lessons,curriculum,voices,objects,rooms,hsk,manifest]=await Promise.all([read('vocabulary.json'),read('npcs.json'),read('world.json'),read('catalog.json'),read('ambient.json'),Promise.all(lessonFiles.map(f=>read('lessons/'+f))),read('curriculum.json'),read('voices.json'),read('objects.json'),read('rooms.json'),read('hsk.json'),readFile(new URL('../public/audio/manifest.json',import.meta.url),'utf8').then(JSON.parse)]);
const errors=[],warnings=[];
const require=(ok,message)=>{if(!ok)errors.push(message);};
function ids(list,label){const set=new Set();for(const item of list){require(typeof item.id==='string'&&/^[a-z0-9-]+$/.test(item.id),label+': invalid id');require(!set.has(item.id),label+': duplicate '+item.id);set.add(item.id);}return set;}
function language(list,label){for(const line of list)for(const k of ['zh','pinyin','en'])require(typeof line[k]==='string'&&line[k].trim().length>0,`${label}:${line.id} missing ${k}`);}
const wordIds=ids(words,'vocabulary'),npcIds=ids(npcs,'NPCs');ids(world.buildings,'buildings');ids(catalog,'catalog');ids(ambient,'ambient');
language(words,'vocabulary');language(npcs,'NPC');language(catalog,'catalog');language(ambient,'ambient');
for(const actor of world.npcs){require(npcIds.has(actor.id),'Unknown placed NPC '+actor.id);require(Number.isFinite(actor.x)&&Number.isFinite(actor.z),'Invalid NPC position');}
for(const npc of npcs)if(npc.lesson)require(lessons.some(l=>l.id===npc.lesson),'Missing lesson '+npc.lesson);
// Every conversation: node ids only need to be unique within their own lesson (two different
// lessons may each have a node called "where"), every node and extra line needs zh/pinyin/en, an
// audio id and a speaker in the voice cast, and each intent's own shape has to hold up.
for(const l of lessons){
  ids(l.nodes,'lesson '+l.id+' nodes');
  const extraLines=Object.entries(l.extraLines??{}).map(([key,line])=>({...line,id:key}));
  const allLines=[...l.nodes,...extraLines];
  language(allLines,'lesson '+l.id);
  for(const line of allLines){
    require(typeof line.audio==='string'&&line.audio.trim().length>0,`lesson ${l.id}:${line.id} missing audio`);
    require(!!voices.cast[line.speaker??'narrator'],`lesson ${l.id}:${line.id} has no voice cast for speaker ${line.speaker??'narrator'}`);
  }
  for(const node of l.nodes){
    require(['name','variants','option','none'].includes(node.intent),`lesson ${l.id}:${node.id} has an unknown intent`);
    if(node.intent==='name'||node.intent==='variants')require(Array.isArray(node.choices)&&node.choices.length>0,`lesson ${l.id}:${node.id} missing modeled answers`);
    if(node.intent==='variants')require(node.accepted?.length>0,`lesson ${l.id}:${node.id} missing accepted alternatives`);
    if(node.intent==='option'){
      require(Array.isArray(node.options)&&node.options.length>0,`lesson ${l.id}:${node.id} has no options`);
      require(typeof node.store==='string'&&node.store.trim().length>0,`lesson ${l.id}:${node.id} option needs a store key`);
      const values=new Set();
      for(const opt of node.options??[]){
        require(typeof opt.value==='string'&&opt.value.trim().length>0,`lesson ${l.id}:${node.id} has an option with no value`);
        require(typeof opt.choice==='string'&&opt.choice.trim().length>0,`lesson ${l.id}:${node.id} option "${opt.value}" needs a choice`);
        require(Array.isArray(opt.accepted)&&opt.accepted.length>0,`lesson ${l.id}:${node.id} option "${opt.value}" needs accepted replies`);
        require(!values.has(opt.value),`lesson ${l.id}:${node.id} has duplicate option value "${opt.value}"`);
        values.add(opt.value);
        // The modeled answer button has to pick its own option, through the real matcher.
        if(typeof opt.choice==='string'&&opt.choice.trim()){
          const result=evaluateNode(node,opt.choice);
          require(result.ok&&result.value===opt.value,`lesson ${l.id}:${node.id} option "${opt.value}": its choice "${opt.choice}" maps to ${result.ok?`"${result.value}"`:'nothing'}`);
        }
      }
    }
    // Every modeled answer offered as a button must be accepted by its own node's matcher.
    for(const choice of node.choices??[])
      require(evaluateNode(node,choice).ok,`lesson ${l.id}:${node.id} does not accept its own modeled answer "${choice}"`);
  }
  if(l.host)for(const k of ['zh','pinyin','en','color'])require(typeof l.host[k]==='string'&&l.host[k].trim(),`lesson ${l.id} host missing ${k}`);
}
for(const item of catalog){require(Number.isSafeInteger(item.price)&&item.price>0&&Number.isSafeInteger(item.minPrice)&&item.minPrice>0&&item.minPrice<=item.price,'Invalid pricing '+item.id);for(const id of item.vocabulary)require(wordIds.has(id),'Unknown vocabulary '+id);}
require(curriculum.source.startsWith('https://www.chinesetest.cn/'),'Missing official curriculum source');
const quests=JSON.parse(await readFile(new URL('../src/content/quests.json',import.meta.url),'utf8'));
ids(quests.quests,'quests');
for(const quest of quests.quests){
  for(const key of ['zh','pinyin','en'])require(typeof quest[key]==='string'&&quest[key].trim(),`quest ${quest.id} missing ${key}`);
  if(quest.where){
    require(world.districts.some(d=>d.id===quest.where.district),`quest ${quest.id} points at unknown district ${quest.where.district}`);
    require(Number.isFinite(quest.where.x)&&Number.isFinite(quest.where.z),`quest ${quest.id} needs a position`);
  }
}
// Objects the player can look at and name.
const objectIds=Object.keys(objects.objects);
for(const [id,entry] of Object.entries(objects.objects)){
  require(/^[a-z0-9-]+$/.test(id),'objects: invalid id '+id);
  for(const key of ['zh','pinyin','en'])require(typeof entry[key]==='string'&&entry[key].trim(),`objects:${id} missing ${key}`);
  require(entry.hsk===null||entry.hsk===undefined||(Number.isInteger(entry.hsk)&&entry.hsk>=1&&entry.hsk<=6),`objects:${id} bad hsk level`);
}
// Districts, their gates, and the buildings and props placed in them.
const districtIds=new Set(world.districts.map(d=>d.id));
for(const d of world.districts){
  require(typeof d.zh==='string'&&d.zh.trim(),'district missing name '+d.id);
  require(Array.isArray(d.bounds?.x)&&Array.isArray(d.bounds?.z),'district missing bounds '+d.id);
  if(d.gate){
    require(['x','z'].includes(d.gate.axis),'district gate needs an axis '+d.id);
    require(Number.isInteger(d.gate.requires?.level)&&Number.isInteger(d.gate.requires?.words),'district gate needs a requirement '+d.id);
    require(d.gate.requires.level>=1&&d.gate.requires.level<=hsk.levels.length,'district gate level out of range '+d.id);
  }
}
for(const b of world.buildings){
  require(districtIds.has(b.district),`building ${b.id} is in unknown district ${b.district}`);
  require(!b.object||objectIds.includes(b.object),`building ${b.id} names unknown object ${b.object}`);
  require([0,180].includes(b.rotation??0),`building ${b.id} may only face 0 or 180`);
  require(['tiled','shophouse','modern'].includes(b.style??'tiled'),`building ${b.id} has an unknown style`);
}
for(const prop of world.props??[])require(districtIds.has(prop.district),'prop in unknown district '+prop.kind);
for(const one of world.people??[])require(districtIds.has(one.district),'person in unknown district');
// Rooms: doors sit in the world, counters point at a real shop.
const shopsOf=item=>[].concat(item.shop??'chen');
const shopIds=new Set(catalog.flatMap(shopsOf));
// Every shape the world asks for has to exist in models.js, or it silently becomes a grey box,
// and the half-extents it reports are what decides whether two fittings end up inside each other.
const modelSource=await readFile(new URL('../src/world/models.js',import.meta.url),'utf8');
const modelKinds=new Set([...modelSource.matchAll(/kind==='([a-z]+)'/g)].map(m=>m[1]));
const modelHalves={};
for(const m of modelSource.matchAll(/if\(kind==='([a-z]+)'\)[\s\S]*?return \{entity:e,half:\[([-\d.]+),([-\d.]+)\]/g))
  modelHalves[m[1]]=[Number(m[2]),Number(m[3])];
/** A fitting's footprint in room coordinates, allowing for its rotation. */
function footprintOf(fitting){
  const [hw,hd]=modelHalves[fitting.kind]??[.5,.5];
  const turned=((fitting.rot??0)/90)%2!==0;
  return {x:fitting.x,z:fitting.z,hw:turned?hd:hw,hd:turned?hw:hd};
}
const collide=(a,b)=>Math.abs(a.x-b.x)<a.hw+b.hw-.02&&Math.abs(a.z-b.z)<a.hd+b.hd-.02;
for(const prop of world.props??[])require(modelKinds.has(prop.kind),`street prop ${prop.kind} has no model`);
// Two solid pieces of street furniture standing inside each other block the pavement and read
// as a glitch. Canopies, poles and signs are left out: an awning is *meant* to overlap the shop
// it is bolted to, and a parasol is meant to come up through the middle of its table.
const PASS_THROUGH=new Set(['awning','parasol','sign','streetlight','bollard']);
const solidProps=(world.props??[]).filter(prop=>!PASS_THROUGH.has(prop.kind)).map(prop=>{
  const [hw,hd]=modelHalves[prop.kind]??[.4,.4];
  const turned=((prop.rot??0)/90)%2!==0;
  return {name:`${prop.kind} at ${prop.x},${prop.z}`,district:prop.district,x:prop.x,z:prop.z,
    hw:turned?hd:hw,hd:turned?hw:hd};
});
for(let i=0;i<solidProps.length;i++)for(let j=i+1;j<solidProps.length;j++){
  const a=solidProps[i],b=solidProps[j];
  if(a.district!==b.district)continue;
  if(collide(a,b))errors.push(`world: ${a.name} overlaps ${b.name}`);
}
for(const [id,room] of Object.entries(rooms)){
  require(Number.isFinite(room.door?.x)&&Number.isFinite(room.door?.z),`room ${id} needs a door position`);
  require(world.buildings.some(b=>b.id===room.building)||room.building==='city:department',`room ${id} has no building ${room.building}`);
  if(room.lectern?.shop)require(shopIds.has(room.lectern.shop),`room ${id} sells for unknown shop ${room.lectern.shop}`);
  if(room.lectern)require(!!room.lectern.label,`room ${id} counter needs a label`);
  require(!(room.lectern?.shop&&room.lectern?.panel),`room ${id} counter cannot be both a shop and a panel`);
  const [w,d]=room.size;
  // Fittings, the counter and its flanking shelves, and the study desk all share one floor.
  const placed=[];
  for(const fitting of room.fittings??[]){
    require(modelKinds.has(fitting.kind),`room ${id} uses unknown fitting ${fitting.kind}`);
    if(fitting.action)require(!!fitting.label,`room ${id} fitting ${fitting.kind} needs a label for its action`);
    placed.push({name:`${fitting.kind} at ${fitting.x},${fitting.z}`,...footprintOf(fitting)});
  }
  if(room.lectern){
    placed.push({name:'the counter',x:room.lectern.x,z:room.lectern.z,hw:1.15,hd:.5});
    for(const dx of [-2.1,2.1])placed.push({name:'a counter shelf',x:room.lectern.x+dx,z:room.lectern.z-.35,hw:.2,hd:.78});
  }
  if(room.desk)placed.push({name:'the study desk',x:room.desk.x,z:room.desk.z,hw:.45,hd:.95});
  for(const [slotId,slot] of Object.entries(room.slots??{})){
    const item=catalog.find(i=>i.kind&&slot.accepts.includes(i.kind));
    if(!item)continue;
    const turned=((slot.rot??0)/90)%2!==0;
    if(item.kind!=='rug'&&item.kind!=='ceilinglamp')
      placed.push({name:`the ${slotId} slot`,x:slot.x,z:slot.z,
        hw:(turned?item.footprint[1]:item.footprint[0])/2*.86,hd:(turned?item.footprint[0]:item.footprint[1])/2*.86});
  }
  for(const part of placed){
    require(Math.abs(part.x)+part.hw<=w/2+.05&&Math.abs(part.z)+part.hd<=d/2+.05,`room ${id}: ${part.name} sticks through a wall`);
    require(!(Math.abs(part.x)<.85+part.hw&&part.z+part.hd>d/2-.6),`room ${id}: ${part.name} stands in the doorway`);
  }
  for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++)
    require(!collide(placed[i],placed[j]),`room ${id}: ${placed[i].name} overlaps ${placed[j].name}`);
  const spawn={x:room.spawn[0],z:room.spawn[1],hw:.34,hd:.34};
  for(const part of placed)require(!collide(part,spawn),`room ${id}: you would spawn inside ${part.name}`);
  // A shop that opens on a milestone needs the milestone, and a sign to explain it.
  if(room.opens){
    require(typeof room.opens.flag==='string'&&room.opens.flag.length>0,`room ${id} opens on nothing`);
    for(const key of ['zh','en'])require(typeof room.opens[key]==='string'&&room.opens[key].trim(),`room ${id} opens note missing ${key}`);
  }
  for(const key of ['zh','pinyin','en'])require(typeof room[key]==='string'&&room[key].trim(),`room ${id} missing ${key}`);
}
for(const item of catalog){
  if(item.category==='furniture')require(item.kind&&Array.isArray(item.footprint)&&item.footprint.length===2,`catalog ${item.id} needs kind and footprint`);
  if(item.wear)require(['hat','shirt','trousers','shoes'].includes(item.wear.slot),`catalog ${item.id} has an unknown wear slot`);
  if(item.wear?.speed!==undefined)require(Number.isFinite(item.wear.speed)&&item.wear.speed>=0&&item.wear.speed<=.5,`catalog ${item.id} has an implausible speed bonus`);
  if(item.nutrition!==undefined)require(Number.isSafeInteger(item.nutrition)&&item.nutrition>0&&item.nutrition<=100,`catalog ${item.id} has an implausible nutrition value`);
}
// Home cooking. The whole point of the kitchen is that it beats eating out, so that is checked
// here rather than left to whoever next edits a price: every recipe must cost less in groceries
// than the cheapest way to fill the same hunger with food bought ready-made.
const recipes=await read('recipes.json');
const byItem=new Map(catalog.map(item=>[item.id,item]));
const READY_SHOPS=['restaurant','bakery','cafe','nightstall'];
const readyFoods=catalog.filter(item=>item.nutrition&&[].concat(item.shop).some(shop=>READY_SHOPS.includes(shop)));
const fill=Array(101).fill(Infinity);fill[0]=0;
for(let h=1;h<=100;h++)for(const food of readyFoods)fill[h]=Math.min(fill[h],food.price+fill[Math.max(0,h-food.nutrition)]);
ids(recipes,'recipes');language(recipes,'recipe');
for(const recipe of recipes){
  const dish=byItem.get(recipe.output);
  require(!!dish,`recipe ${recipe.id} cooks unknown item ${recipe.output}`);
  require(dish?.nutrition===100,`recipe ${recipe.id} should produce a meal that fills you completely`);
  require([].concat(dish?.shop??[]).length===0,`recipe ${recipe.id} produces ${recipe.output}, which is also sold in a shop`);
  require(Number.isFinite(recipe.seconds)&&recipe.seconds>=10&&recipe.seconds<=120,`recipe ${recipe.id} takes an implausible time`);
  const entries=Object.entries(recipe.ingredients??{});
  require(entries.length>=2,`recipe ${recipe.id} should combine at least two groceries`);
  let cost=0;
  for(const [id,count] of entries){
    const item=byItem.get(id);
    require(!!item,`recipe ${recipe.id} wants unknown ingredient ${id}`);
    require([].concat(item?.shop??[]).length>0,`recipe ${recipe.id} wants ${id}, which is not sold anywhere`);
    require(Number.isSafeInteger(count)&&count>0&&count<=9,`recipe ${recipe.id} wants an odd number of ${id}`);
    cost+=(item?.price??0)*count;
  }
  require(cost<fill[100],`recipe ${recipe.id} costs ${cost} in groceries but ${fill[100]} buys the same hunger ready-made`);
  // Selling a cooked meal back must never turn a profit, or the stove becomes a mint.
  require((dish?.price??0)<=cost,`recipe ${recipe.id} lists ${recipe.output} above the cost of its ingredients`);
}
// A back room says which room it belongs to, and that room says how to get in.
for(const [id,room] of Object.entries(rooms)){
  if(room.returnPlace){
    require(!!rooms[room.returnPlace]||room.returnPlace==='city',`room ${id} returns to unknown room ${room.returnPlace}`);
    require(room.returnPlace==='city'||rooms[room.returnPlace]?.annex?.room===id,`room ${id} returns to ${room.returnPlace}, which has no way back in`);
    require(Array.isArray(room.returnSpawn)&&room.returnSpawn.length===3,`room ${id} needs a returnSpawn of [x,z,yaw]`);
  }
  if(room.annex){
    require(!!rooms[room.annex.room],`room ${id} opens onto unknown room ${room.annex.room}`);
    require(rooms[room.annex.room]?.returnPlace===id,`room ${id} opens onto ${room.annex.room}, which does not lead back`);
    require(Math.abs(room.annex.x)<=room.size[0]/2+.6,`room ${id} puts its annex door outside the wall`);
  }
}

const lessonAudioSources=lessons.flatMap(l=>[...l.nodes,...Object.values(l.extraLines??{})]);
const needed=[...words,...ambient,...lessonAudioSources,...catalog].map(x=>x.audio).filter(Boolean)
  .concat(objectIds.map(id=>'obj-'+id));
const missing=[],unreviewed=[];
for(const id of needed){
  const clip=manifest.clips[id];
  if(!clip?.approved){missing.push(id);continue;}
  require(typeof clip.src==='string'&&/^\/audio\/[a-zA-Z0-9_/-]+\.(mp3|wav|ogg)$/.test(clip.src),'Invalid audio path '+id);
  require(typeof clip.voice==='string'&&clip.voice.startsWith('zh-'),'Clip '+id+' is not cast to a Mandarin voice');
  if(clip.review!=='reviewed')unreviewed.push(id);
  if(typeof clip.src==='string'&&clip.src.startsWith('/audio/'))try{await access(new URL('../public'+clip.src,import.meta.url));}catch{errors.push('Missing audio file '+id);}
}
for(const id of missing)warnings.push('No voice clip yet: '+id+' (run scripts/generate-voice.py)');
const speakers=new Set([...lessonAudioSources.map(n=>n.speaker??'narrator'),...ambient.map(a=>a.speaker),'teacher','chen']);
for(const speaker of speakers)require(!!voices.cast[speaker],'No voice cast for speaker '+speaker);
if(unreviewed.length)warnings.push(`${unreviewed.length}/${needed.length} clips are ${manifest.provider??'generated'} speech and have not passed a human listening review`);
warnings.push(curriculum.status);
console.log(`Content validation: ${recipes.length} recipes, ${quests.quests.length} missions, ${words.length} town words, ${objectIds.length} named objects, ${npcs.length} NPCs, ${lessons.length} lessons with ${lessons.reduce((n,l)=>n+l.nodes.length,0)} dialogue nodes, ${catalog.length} shop items across ${shopIds.size} shops, ${world.districts.length} districts, ${Object.keys(rooms).length} interiors.`);
for(const w of warnings)console.log('NOTICE:',w);
for(const e of errors)console.error('ERROR:',e);
if(errors.length)process.exitCode=1;else console.log('All structural content checks passed. Notices are outstanding content-production requirements.');
