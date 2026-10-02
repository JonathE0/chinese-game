import translations from '../content/translations.json' with {type:'json'};
import stories from '../content/stories.json' with {type:'json'};
import ambient from '../content/ambient.json' with {type:'json'};
import introductions from '../content/lessons/introductions.json' with {type:'json'};
import cityDirections from '../content/lessons/city-directions.json' with {type:'json'};
import cityNoodles from '../content/lessons/city-noodles.json' with {type:'json'};

export const MAX_TRANSLATION_LENGTH=500;
const key=text=>text.replace(/\s+/g,'');
// Every lesson the conversation engine can open, not just Auntie Lin's — a highlighted line from
// a stranger in Yunhai deserves the same translate-on-tap as one from the town square.
const LESSONS=[introductions,cityDirections,cityNoodles];

function authoredEntries(){
  const lessonLines=LESSONS.flatMap(l=>[...l.nodes,...Object.values(l.extraLines??{})]);
  const entries=[...translations,...ambient,...lessonLines];
  for(const story of stories.stories){
    // Only compose consecutive, authored sentences from the same passage. Dictionary tokens
    // never participate: their glosses cannot tell us what a sentence means.
    for(let start=0;start<story.lines.length;start++){
      let zh='',en=[],pinyin=[];
      for(let end=start;end<story.lines.length;end++){
        const line=story.lines[end];zh+=line.zh;
        if(zh.length>MAX_TRANSLATION_LENGTH)break;
        en.push(line.en);pinyin.push(line.pinyin??'');
        entries.push({zh,en:en.join(' '),pinyin:pinyin.join(' ')});
      }
    }
  }
  return entries;
}

export class TranslationService{
  constructor(entries=authoredEntries()){
    this.entries=new Map(entries.map(entry=>[key(entry.zh),entry]));
  }

  async translate(value){
    const source=String(value??'').trim();
    if(source.length>MAX_TRANSLATION_LENGTH)return {status:'too-long',source,maxLength:MAX_TRANSLATION_LENGTH};
    const entry=this.entries.get(key(source));
    if(!entry)return {status:'unavailable',source};
    return {status:'translated',source,pinyin:entry.pinyin??'',meaning:entry.en};
  }
}
