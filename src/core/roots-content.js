import {matchAnswer} from './language.js';
export function validateRoots(data){
 const errors=[];
 if(!data||!Array.isArray(data.skills)||!Array.isArray(data.memories))return ['Missing skills or memories'];
 const line=(value,label)=>{if(!value||['zh','pinyin','en'].some(key=>typeof value[key]!=='string'||!value[key].trim()))errors.push('Missing text or translation: '+label);};
 line(data.opening,'opening');line(data.letter,'letter');line(data.caretaker?.greeting,'caretaker greeting');line(data.caretaker?.memory,'caretaker memory');
 const memoryIds=new Set();
 for(const m of data.memories){
  if(!m||typeof m.id!=='string'||!m.id||memoryIds.has(m.id)||typeof m.image!=='string'||!m.image.startsWith('/images/roots/')){errors.push('Invalid memory');continue;}
  memoryIds.add(m.id);line(m,m.id);line(m.clue,m.id+' clue');
  if(!m.keepsake&&(!m.place||![m.x,m.z,m.radius].every(Number.isFinite)||m.radius<=0))errors.push('Invalid photo location: '+m.id);
 }
 const skillIds=new Set(),variantIds=new Set();
 const validateNode=v=>{
  if(!v||typeof v.id!=='string'||!v.id){errors.push('Missing variant ID');return;}
  if(variantIds.has(v.id))errors.push('Duplicate variant ID: '+v.id);variantIds.add(v.id);
  line(v,v.id);
  if(typeof v.audio!=='string'||!v.audio||!Array.isArray(v.accepted)||!v.accepted.length||!Array.isArray(v.choices)||!v.choices.length){errors.push('Missing prompt or examples: '+v.id);return;}
  if(v.answerRules){
   if(!Array.isArray(v.answerRules.templates)||!v.answerRules.templates.length)errors.push('Missing templates: '+v.id);
   for(const t of Array.isArray(v.answerRules.templates)?v.answerRules.templates:[]){
    if(typeof t!=='string'){errors.push('Invalid template: '+v.id);continue;}
    for(const key of t.matchAll(/{([a-zA-Z]+)}/g))if(!Array.isArray(v.answerRules.slots?.[key[1]])||!v.answerRules.slots[key[1]].length)errors.push('Missing slot: '+v.id);
   }
  }
  for(const example of v.choices)if(typeof example!=='string'||!matchAnswer(example,v).ok)errors.push('Unsupported model answer: '+v.id);
 };
 for(const skill of data.skills){
  if(!skill||!skill.id||skillIds.has(skill.id)){errors.push('Invalid skill');continue;}skillIds.add(skill.id);
  if(!Array.isArray(skill.variants)||new Set(skill.variants.map(v=>v?.id)).size<2)errors.push('Skill needs distinct variants');
  for(const v of Array.isArray(skill.variants)?skill.variants:[])validateNode(v);
 }
 if(!Array.isArray(data.bankLesson?.nodes)||!data.bankLesson.nodes.length)errors.push('Missing bank lesson');
 else for(const node of data.bankLesson.nodes)validateNode(node);
 for(const key of ['starter','price','pack'])if(!Number.isSafeInteger(data.film?.[key])||data.film[key]<=0)errors.push('Invalid film balance: '+key);
 return errors;
}
