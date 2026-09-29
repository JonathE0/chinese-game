import data from '../content/keys.json' with {type:'json'};

/**
 * Keyboard bindings. The player's changes live in profile.settings.keys as {action: code}, only for
 * actions moved off their default. Arrow keys are fixed extra movement keys; they, Escape, Tab, Meta,
 * ContextMenu, the modifiers (Shift is the fixed sprint key), CapsLock and F1–F12 can never be bound. A numpad digit always counts as its plain digit.
 */
export const KEY_ACTIONS=data.actions;
export const KEY_UI=data.ui;
const DEFAULT=Object.fromEntries(KEY_ACTIONS.map(a=>[a.id,a.key]));
const RESERVED=/^(Escape|Tab|Meta(Left|Right)?|OS(Left|Right)?|ContextMenu|Arrow(Up|Down|Left|Right)|(Shift|Control|Alt)(Left|Right)|CapsLock|F([1-9]|1[0-2]))$/;
const ARROWS={ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→'};

export const normalCode=code=>String(code??'').replace(/^Numpad(\d)$/,'Digit$1');
const bindable=code=>/^[A-Za-z0-9]+$/.test(code)&&!RESERVED.test(code);

// Where the live bindings come from: main.js points this at the current profile's settings.
let source=()=>undefined;
export const readKeysFrom=fn=>{source=fn;};
export const codeOf=action=>source()?.[action]??DEFAULT[action];
/** Is this keyboard event the given action? */
export const isKey=(e,action)=>normalCode(e.code)===codeOf(action);

export function label(code){
  const m=/^(?:Key([A-Z])|(?:Digit|Numpad)(\d))$/.exec(code);
  return m?(m[1]??m[2]):ARROWS[code]??code;
}
export const keyLabel=action=>label(codeOf(action));
/** Fills {action} placeholders with the key the player has bound; other braces are left alone. */
export const fillKeys=text=>String(text).replace(/\{(\w+)\}/g,(all,id)=>id in DEFAULT?keyLabel(id):all);

/** A saved binding map made safe: known actions, plain bindable codes, no two actions on one key. */
export function sanitiseKeys(raw){
  const out={};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
  for(const {id} of KEY_ACTIONS){
    const code=typeof raw[id]==='string'?normalCode(raw[id]):'';
    if(bindable(code)&&code!==DEFAULT[id])out[id]=code;
  }
  // Drop a clashing change (the later one, or whichever of the pair was changed) until none clash;
  // each pass removes one, and the defaults never clash.
  for(;;){
    const seen=new Map();let drop=null;
    for(const {id} of KEY_ACTIONS){
      const code=out[id]??DEFAULT[id];
      if(seen.has(code)){drop=id in out?id:seen.get(code);break;}
      seen.set(code,id);
    }
    if(!drop)return out;
    delete out[drop];
  }
}

/** Binds `action` to `code` in a copy of `keys`; an action already on that key takes the old one. */
export function rebind(keys,action,code){
  code=normalCode(code);
  if(!bindable(code))return {reserved:true};
  const next={...keys},of=id=>next[id]??DEFAULT[id];
  const set=(id,c)=>{if(c===DEFAULT[id])delete next[id];else next[id]=c;};
  const swapped=KEY_ACTIONS.find(a=>a.id!==action&&of(a.id)===code)?.id??null;
  if(swapped)set(swapped,of(action));
  set(action,code);
  return {keys:next,swapped};
}
