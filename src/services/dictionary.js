// Pop-up dictionary for selected Chinese text, in the spirit of Yomitan.
// Data is CC-CEDICT (CC BY-SA 4.0), built by scripts/build-dictionary.py and shipped
// gzipped so the browser downloads ~2.7 MB once instead of ~11 MB of JSON.
import {sanitizeDictionaryEntry} from '../content/dictionary-policy.js';
const SOURCE='/dictionary/cedict.tsv.gz';
const MAX_WORD=4;                       // longest headword the build script keeps
const isHan=ch=>/[㐀-䶿一-鿿豈-﫿]/.test(ch);

export class Dictionary {
  constructor(){this.entries=null;this.pending=null;this.error=null;}
  get ready(){return !!this.entries;}
  async load(){
    if(this.entries)return this.entries;
    if(this.pending)return this.pending;
    this.pending=(async()=>{
      try{
        const response=await fetch(SOURCE);
        if(!response.ok)throw Error('HTTP '+response.status);
        // Some servers send the .gz with Content-Encoding: gzip and the browser has already
        // unwrapped it, so sniff the magic number rather than assuming either way.
        const buffer=await response.arrayBuffer(),bytes=new Uint8Array(buffer,0,2);
        let text;
        if(bytes[0]===0x1f&&bytes[1]===0x8b){
          if(!('DecompressionStream' in window))throw Error('This browser cannot decompress the dictionary.');
          text=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
        }else text=new TextDecoder('utf-8').decode(buffer);
        const entries=new Map();
        for(const line of text.split('\n')){
          if(!line||line[0]==='#')continue;
          const [word,pinyin,glosses]=line.split('\t');
          const entry=sanitizeDictionaryEntry({zh:word,pinyin,en:glosses??''});
          if(entry&&!entries.has(word))entries.set(word,entry);
        }
        this.entries=entries;return entries;
      }catch(error){this.error=error.message;this.pending=null;throw error;}
    })();
    return this.pending;
  }
  lookup(word){return this.entries?.get(word)??null;}
  /** Greedy longest-match segmentation, so 喝杯茶 comes back as 喝 / 杯 / 茶 with readings. */
  segment(text){
    const out=[];
    const clean=[...(text??'')].filter(ch=>isHan(ch)||/\s/.test(ch)===false).join('');
    let i=0;
    while(i<clean.length){
      const ch=clean[i];
      if(!isHan(ch)){i++;continue;}
      let hit=null;
      for(let len=Math.min(MAX_WORD,clean.length-i);len>=1;len--){
        const candidate=clean.slice(i,i+len);
        const entry=this.lookup(candidate);
        if(entry){hit={...entry,length:len};break;}
      }
      if(hit){out.push(hit);i+=hit.length;}
      else{out.push({zh:ch,pinyin:'',en:'',length:1,unknown:true});i++;}
      if(out.length>=24)break;
    }
    return out;
  }
}
