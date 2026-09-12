export const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/[\s，。！？、,.!?：:；;“”"'「」]/g,'');

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
  return {ok:(node.accepted ?? []).some(x=>normalize(x)===value),value};
}

function chineseNumber(s) {
  const digits = {零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
  if (s==='十') return 10;
  if (/^[一二两三四五六七八九]?十[一二三四五六七八九]?$/.test(s)) { const [a,b] = s.split('十'); return (a?digits[a]:1)*10+(b?digits[b]:0); }
  return s.length===1 ? digits[s] : undefined;
}
export function parseOffer(text) {
  const value=String(text).normalize('NFKC');
  if (/[-−.]|还是|或者|或/.test(value)) return null;
  const parts=value.match(/[0-9]+|[零一二两三四五六七八九十百千万]+/g);
  if (!parts || parts.length!==1) return null;
  const n=/^\d+$/.test(parts[0]) ? Number(parts[0]) : chineseNumber(parts[0]);
  return Number.isSafeInteger(n) && n>0 && n<=9999 ? n : null;
}

export function escapeHtml(value) { return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
