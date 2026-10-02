import {setFold} from '../core/language.js';

/**
 * 汉字: 简体字 or 繁體字 (settings.script; docs/superpowers/plans/2026-09-30-development-wave-4.md,
 * W4-script). Everything in the game is written in simplified characters and stays that way; with
 * traditional on, what the player sees is converted on its way out and what they type is folded
 * back on its way in.
 *
 * - The page: a MutationObserver converts every text node and the title / aria-label / placeholder
 *   attributes as they appear, and puts the exact originals back when simplified returns. Input
 *   values and editable text are never touched.
 * - Canvas text (signs, LED screens, the drone show): drawn through `zh()`, and redrawn by the
 *   functions registered with `scripted()` whenever the setting changes.
 * - Typing: `normalize` in core/language.js folds traditional to simplified before comparing.
 *
 * The converter is opencc-js (mainland to Taiwan standard characters, no vocabulary changes), about
 * a megabyte of phrase tables, so it is only fetched the first time traditional is switched on.
 */
let mode='simplified',toTrad=null,toSimp=null,loading=null,observer=null;
const HAN=/[㐀-鿿]/;
const ATTRS=['title','aria-label','placeholder'];
const cache=new Map(),redraws=new Set();
const texts=new WeakMap(),attrs=new WeakMap();   // node → [original, converted]; element → {attr: [...]}

const trad=text=>{
  if(!HAN.test(text))return text;
  let out=cache.get(text);
  if(out===undefined){
    if(cache.size>4000)cache.clear();   // ponytail: clear-all cap, an LRU if clocks and counters ever thrash it
    cache.set(text,out=toTrad(text));
  }
  return out;
};
const on=()=>mode==='traditional'&&!!toTrad;

/** What a canvas should draw for `text`: itself, or its traditional form while that is on. */
export const zh=text=>on()?trad(String(text)):text;
/** Text the player typed or selected, folded back to simplified while traditional is on. */
export const simplified=text=>on()?toSimp(text):text;
/** Run `redraw` whenever the setting changes, for as long as `owner` (an entity, if any) lives. */
export function scripted(redraw,owner){
  redraws.add(redraw);
  owner?.once('destroy',()=>redraws.delete(redraw));
}

const skipped=el=>!el||el.isContentEditable||el.tagName==='TEXTAREA'||el.tagName==='SCRIPT'||el.tagName==='STYLE';
function convertText(node){
  if(skipped(node.parentElement))return;
  const seen=texts.get(node);
  if(seen&&node.data===seen[1])return;   // our own write coming back through the observer
  const out=trad(node.data);
  if(out!==node.data){texts.set(node,[node.data,out]);node.data=out;}
}
function convertAttrs(el){
  for(const name of ATTRS){
    const value=el.getAttribute(name);
    if(value===null)continue;
    const kept=attrs.get(el)??{};
    if(kept[name]&&value===kept[name][1])continue;
    const out=trad(value);
    if(out!==value){kept[name]=[value,out];attrs.set(el,kept);el.setAttribute(name,out);}
  }
}
function restore(node){
  if(node.nodeType===Node.TEXT_NODE){const seen=texts.get(node);if(seen&&node.data===seen[1])node.data=seen[0];texts.delete(node);return;}
  const kept=attrs.get(node);
  if(kept){for(const [name,[was,now]]of Object.entries(kept))if(node.getAttribute(name)===now)node.setAttribute(name,was);attrs.delete(node);}
}
/** Visit `root` and everything under it: convert, or put back. */
function walk(root,back=false){
  const visit=node=>back?restore(node):node.nodeType===Node.TEXT_NODE?convertText(node):convertAttrs(node);
  if(root.nodeType!==Node.TEXT_NODE&&root.nodeType!==Node.ELEMENT_NODE)return;
  visit(root);
  if(root.nodeType!==Node.ELEMENT_NODE)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
  while(walker.nextNode())visit(walker.currentNode);
}

function apply(){
  const lit=on(),page=document.documentElement;
  setFold(lit?toSimp:null);
  if(lit){
    if(!observer){
      observer=new MutationObserver(records=>{for(const r of records){
        if(r.type==='characterData')convertText(r.target);
        else if(r.type==='attributes')convertAttrs(r.target);
        else r.addedNodes.forEach(n=>walk(n));
      }});
      observer.observe(page,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
    }
    walk(page);
  }else if(observer){
    observer.disconnect();observer=null;
    walk(page,true);
  }
  page.lang=lit?'zh-Hant':'zh-Hans';
  for(const redraw of redraws)redraw();
}

/**
 * Switch to 'simplified' or 'traditional', live. The first switch to traditional loads the converter;
 * if it cannot load, `ctx` (the game) goes back to simplified: the setting, the settings select and a notice.
 */
export async function setScript(next,ctx){
  mode=next==='traditional'?'traditional':'simplified';
  if(mode==='traditional'&&!toTrad){
    loading??=import('opencc-js').then(({Converter})=>{toTrad=Converter({from:'cn',to:'tw'});toSimp=Converter({from:'tw',to:'cn'});});
    try{await loading;}catch(error){
      loading=null;console.warn('Traditional characters are unavailable:',error);
      if(mode!=='traditional')return;   // switched back meanwhile
      mode='simplified';
      if(ctx){
        ctx.profile.settings.script='simplified';ctx.save();
        const select=document.querySelector('#setting-script');if(select)select.value='simplified';
        ctx.ui.notice('繁體字现在用不了，请稍后再试。 / Traditional characters couldn\'t load. Please try again later.');
      }
      return;
    }
  }
  apply();
}
