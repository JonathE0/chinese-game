// With 繁體字 on (settings.script, src/services/script.js), typed traditional is folded back to the
// simplified every answer is written in before anything is compared.
let fold=null;
export const setFold = fn => { fold=fn; };
export const folded = value => { const text=String(value).normalize('NFKC'); return fold?fold(text):text; };
export const normalize = value => folded(value).toLowerCase().replace(/[\s，。！？、,.!?：:；;“”"'「」]/g,'');

export function matchAnswer(text,node) {
  const value = normalize(text);
  if (!value || value.length > 100) return {ok:false};
  if (node.intent === 'name') {
    const match = value.match(/^(?:我叫|我的名字是|你可以叫我)([\p{Script=Han}a-z·]{1,16})$/u);
    const name = match?.[1] ?? value;
    const forbidden = /[不没谁什么哪吗呢？?<>]|喜欢|知道|是|想|去|喝|吃|叫|名字|你好|谢谢|再见/;
    const valid = /^[\p{Script=Han}a-z·]{1,16}$/u.test(name) && !forbidden.test(name) && (match || name.length <= 6 || /^[a-z]{1,16}$/.test(name));
    return {ok:!!valid,value:name};
  }
  return {ok:(node.accepted ?? []).some(x=>normalize(x)===value)||matchRules(value,node.answerRules),value};
}

// Full-template matching keeps keywords from accepting contradictory replies.
export function matchRules(value,rules) {
  if(!rules||!Array.isArray(rules.templates)||!rules.slots)return false;
  const escape=s=>s.replace(/[.*+?^\u0024{}()|[\]\\]/g,'\\$&');
  return rules.templates.slice(0,40).some(template=>{
    if(typeof template!=='string'||template.length>150)return false;
    let pattern='';
    for(const part of template.split(/(\{[a-zA-Z]+\})/g)){
      if(/^\{[a-zA-Z]+\}$/.test(part)){
        const values=rules.slots[part.slice(1,-1)];
        if(!Array.isArray(values)||!values.length||values.length>80||values.some(v=>typeof v!=='string'||v.length>100))return false;
        pattern+='(?:'+values.map(v=>escape(normalize(v))).join('|')+')';
      }else pattern+=escape(normalize(part));
    }
    return new RegExp('^'+pattern+'$','u').test(value);
  });
}

function chineseNumber(s) {
  const digits = {零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
  if (s==='十') return 10;
  if (/^[一二两三四五六七八九]?十[一二三四五六七八九]?$/.test(s)) { const [a,b] = s.split('十'); return (a?digits[a]:1)*10+(b?digits[b]:0); }
  return s.length===1 ? digits[s] : undefined;
}
export function parseOffer(text) {
  const value=folded(text);
  if (/[-−.]|还是|或者|或/.test(value)) return null;
  const parts=value.match(/[0-9]+|[零一二两三四五六七八九十百千万]+/g);
  if (!parts || parts.length!==1) return null;
  const n=/^\d+$/.test(parts[0]) ? Number(parts[0]) : chineseNumber(parts[0]);
  return Number.isSafeInteger(n) && n>0 && n<=9999 ? n : null;
}

export function escapeHtml(value) { return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
