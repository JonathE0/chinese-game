import {wordId} from './bank.js';
import {escapeHtml as esc} from './language.js';

/**
 * When pinyin shows, and in what colours.
 *
 * The pinyin setting has three modes: 'always', 'known' (hide it for words review has marked
 * learned) and 'never'. Saves from before the modes store true/false, which still mean
 * always/never. A line hides its pinyin in 'known' mode only when every Han character in it
 * belongs to a learned word.
 */
export const PINYIN_MODES=['always','known','never'];
export const pinyinMode=s=>s?.pinyin===true?'always':s?.pinyin===false?'never':PINYIN_MODES.includes(s?.pinyin)?s.pinyin:'known';

const HAN=/\p{Script=Han}/u;
const learned=(p,id)=>!!id&&Object.values(p?.words?.[id]??{}).some(r=>r?.learned);

/** True when every Han character of `zh` sits inside a learned word. `idOf(zh)` names any
 *  extra id the word is reviewed under (the HSK list's ids are not derived from the text). */
export function lineKnown(p,zh,idOf=()=>null){
  const chars=Array.from(String(zh??'')),covered=chars.map(c=>!HAN.test(c));
  if(covered.every(Boolean)||!Object.keys(p?.words??{}).length)return false;
  // games.js reviews some words under 'bank-' + the word itself, so that id counts too.
  const known=w=>learned(p,wordId(w))||learned(p,'bank-'+w)||learned(p,idOf(w));
  for(let i=0;i<chars.length;i++){
    let w='';
    for(let j=i;j<Math.min(chars.length,i+8)&&HAN.test(chars[j]);j++){w+=chars[j];if(known(w))covered.fill(true,i,j+1);}
  }
  return covered.every(Boolean);
}

/** Whether a pinyin line shows under these settings. `always` is for study tools, where the
 *  pinyin is the answer being checked rather than help. */
export function showPinyin(text,{zh,settings,profile,idOf,always=false}={}){
  const mode=always?'always':pinyinMode(settings);
  return !!text&&mode!=='never'&&!(mode==='known'&&lineKnown(profile,zh,idOf));
}

const TONES={'̄':1,'́':2,'̌':3,'̀':4};
/** 1-4 from the tone mark, 0 for a neutral (unmarked) syllable. */
export const toneOf=s=>{for(const c of String(s).normalize('NFD'))if(TONES[c])return TONES[c];return 0;};

// Greedy syllable match on toneless lowercase pinyin, ü written v.
const SYLLABLE=/^(?:[zcs]h|[bpmfdtnlgkhjqxrzcsyw])?(?:iang|iong|uang|ang|eng|ing|ong|ian|iao|uai|uan|van|ai|ei|ao|ou|an|en|er|in|un|vn|ia|ie|iu|ua|uo|ui|ve|ue|a|e|i|o|u|v)(?:r(?![aeiouv]))?/;
const plainOf=c=>{const d=c.normalize('NFD');return d.includes('̈')?'v':d[0].toLowerCase();};

/** Splits pinyin into [text, tone] pieces; tone is null for anything that is not a syllable. */
export function syllables(text){
  const out=[];
  for(const [k,part] of String(text??'').normalize('NFC').split(/([\p{L}\p{M}]+)/u).entries()){
    if(!part)continue;
    if(k%2===0){out.push([part,null]);continue;}
    const chars=Array.from(part),plain=chars.map(plainOf).join('');
    let i=0;
    while(i<chars.length){
      const m=SYLLABLE.exec(plain.slice(i));
      if(!m){out.push([chars.slice(i).join(''),null]);break;}
      let n=m[0].length;
      // No written syllable starts with a vowel straight after n/ng/r (pinyin uses an apostrophe),
      // so a vowel there means the consonant belongs to the next syllable: yīnián is yī nián.
      if(n>1&&/[ngr]$/.test(m[0])&&/[aeiouv]/.test(plain[i+n]??''))n--;
      const s=chars.slice(i,i+n).join('');
      out.push([s,toneOf(s)]);i+=n;
    }
  }
  return out;
}

/** Escaped pinyin, each syllable wrapped in a tone-N class when tone colours are on. */
export const pinyinMarkup=(text,settings)=>settings?.toneColors
  ?syllables(text).map(([s,t])=>t===null?esc(s):`<span class="tone-${t}">${esc(s)}</span>`).join('')
  :esc(text);
