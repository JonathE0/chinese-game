import data from '../content/rental.json' with {type:'json'};
import rooms from '../content/rooms.json' with {type:'json'};
import signs from '../content/signs.json' with {type:'json'};
import {leaseStatus,quoteLease,rentApartment,rentalAccess,unitOf,amenityOf} from '../core/rental.js';
import {escapeHtml as esc} from '../core/language.js';
import {openDialogue} from './dialogue.js';
import {storeRoomFurniture} from './decorate.js';
import {openMenu} from './menu.js';
import {languageLine,pinyinWith} from './shell.js';

/**
 * 海景公寓 (src/content/rental.json): the front desk, where a flat is rented, renewed or swapped for
 * another; the lift between its floors; and the rooftop restaurant's menu. The rules are
 * src/core/rental.js, the tower and the lift car src/world/rental.js.
 */
const TOWER=new Set([data.lobby,data.lift,...data.stops.map(s=>s.room)]);
const STOPS=new Map(data.stops.map(s=>[s.room,s]));
const line=key=>({...data.lines[key],audio:'rental-'+key});
const tierName=tier=>data.units.find(u=>u.tier===tier)?.zh;
/** A word the desk names (a room, an amenity): Chinese, with its reading on hover. */
const word=zh=>{const s=signs.signs[zh];return `<span${s?` title="${esc(s.pinyin+' · '+s.en)}"`:''}>${esc(zh)}</span>`;};
const area=id=>{const r=rooms[id];return Math.round(r.size[0]*r.size[1]*(r.upper?2:1));};
/** A line from over the tannoy: shown, and played without cutting into a conversation. */
function announce(ctx,l){
  ctx.ui.notice(ctx.profile.settings.english===false?l.zh:`${l.zh} / ${l.en}`);
  if(ctx.voice.available(l.audio))ctx.voice.play(l.audio,{ambient:true});
}
const REFUSED={money:'Not enough coins. Study to earn rent.',paid:`Already paid up: renew once fewer than ${data.days} in-game days are left.`,
  changed:'Lease changed. Check the updated details.',unit:'That flat is not for rent.',day:'That lease runs too far ahead.'};

/** The front desk (`what`: the lift panel, or the rooftop restaurant's menu). `said` picks the receptionist's line. */
export function openRental(ctx,what='',said=null){
  if(what==='lift')return openLift(ctx);
  if(what==='menu')return openRestaurant(ctx);
  // A flat's glass door out onto its balcony in 云海, and back in (src/world/rental.js).
  if(what.startsWith('balcony:')){ctx.town.ensureCity();if(ctx.town.rentalBalcony?.(what.slice(8)))ctx.syncPlace?.();return;}
  const p=ctx.profile,s=leaseStatus(p),revision=p.rental?.revision??0,body=ctx.ui.open('rental',data.name,'前台 · FRONT DESK');
  const greeting=said?[said]:!s.held?['desk-welcome','desk-rent']:!s.active?['desk-rent']:s.soon?['desk-due']:['desk-home'];
  const state=s.active?`${s.unit.zh} · ${s.unit.en}: ${s.days} in-game day${s.days===1?'':'s'} remaining`
    :s.held?`Lease on ${s.unit.zh} expired — belongings safely stored`:'No active lease';
  const cards=data.units.map(u=>{
    const q=quoteLease(p,u.id),stop=STOPS.get(u.id),mine=s.held&&p.rental.id===u.id;
    const verb=q.action==='renew'?'Renew':q.action==='move'?'Move here':'Rent',pay=q.pay>=0?`Pay ${q.pay} coins`:`${-q.pay} coins back`;
    const note=!q.ok?REFUSED[q.reason]:q.action==='move'?`Your ${unitOf(q.from).zh} ends today, and ${q.refund} coins come back for its unused days.`:'';
    return `<div class="gate-note rental-unit${mine?' held':''}">
      <b>${esc(u.zh)} <small>${pinyinWith(u.pinyin,u.zh,u.en)}</small></b>
      <div class="microcopy">${esc(stop.zh)} · ${area(u.id)} m² · ${u.rooms.map(word).join(' ')}<br>${data.amenities.filter(a=>a.tier<=u.tier).map(a=>word(a.zh)).join(' ')}</div>
      <div><b>${u.price} coins for ${data.days} in-game days</b></div>
      <button class="${q.ok?'primary':'secondary'} wide" data-unit="${esc(u.id)}"${q.ok?'':' disabled'}>${verb} · ${pay}</button>
      ${note?`<p class="microcopy">${esc(note)}</p>`:''}</div>`;
  }).join('');
  body.innerHTML=`${greeting.map(key=>languageLine(data.lines[key],p.settings,{className:'dialogue-line'})).join('')}
    <div class="fare-state${s.active?' held':''}">${esc(state)}</div>
    <p>Rent a flat in 云海中心 for ${data.days} in-game days, paid in advance, one lease at a time. Wallet: ${p.wallet}.</p>
    <div class="rental-units">${cards}</div>
    <div id="rental-confirm"></div>
    <button class="secondary wide" id="rental-recover">Put the furniture from flats I don't rent back in my inventory</button>
    <button class="secondary wide" id="rental-practice">Practise asking for a room · 租房</button>
    <p class="microcopy">Rent only runs while you play, and nothing renews by itself. Moving hands back the unused days of your old flat and puts its furniture in your inventory. When a lease ends, sleeping and decorating there pause; your belongings stay yours. Your grandfather’s Qinghe home remains available. Need more coins? Keep studying from your journal or word review.</p>`;
  const voiced=line(greeting[0]);if(ctx.voice.available(voiced.audio))ctx.voice.play(voiced.audio);
  // A card's button only asks, as a shop's 确认购买 does: the flat, its price and term, what is left
  // after paying and, for a move, what becomes of the old lease. Its 确认租房 pays.
  const confirm=body.querySelector('#rental-confirm');
  for(const button of body.querySelectorAll('[data-unit]'))button.onclick=()=>{
    if(ctx.profile!==p)return openRental(ctx);
    const id=button.dataset.unit,q=quoteLease(p,id),u=unitOf(id);
    if(!q.ok)return ctx.ui.notice(REFUSED[q.reason]);
    if(!(p.wallet>=q.pay))return ctx.ui.notice(REFUSED.money);
    const left=leaseStatus(p).days,english=p.settings.english!==false;
    const move=q.action==='move'?`<p class="microcopy">Your ${esc(unitOf(q.from).zh)} lease ends today: ${left} unused day${left===1?'':'s'}, ${q.refund} coins back. Its furniture is packed into your inventory.</p>`:'';
    confirm.innerHTML=`<div class="purchase-confirm"><h3>确认租房？</h3><p>${esc(u.zh)} · ${esc(STOPS.get(id).zh)} · ${area(id)} m²</p>
      <dl><div><dt>价格</dt><dd>${u.price} 学习币 · ${data.days} in-game days</dd></div></dl>
      <p>付款后还剩 ${p.wallet-q.pay} 学习币${english?` <small>(${p.wallet-q.pay} coins left after paying)</small>`:''}</p>${move}
      <button class="primary" id="confirm-rent">确认租房</button><button class="secondary" id="cancel-rent">取消</button></div>`;
    confirm.querySelector('#cancel-rent').onclick=()=>{confirm.innerHTML='';};
    confirm.querySelector('#confirm-rent').onclick=e=>pay(e,id);
    confirm.scrollIntoView({behavior:'smooth',block:'nearest'});
  };
  const pay=(e,id)=>{
    if(ctx.profile!==p)return openRental(ctx);
    if(e.detail>1)return;   // the second half of a double click lands on the redrawn panel (the rules refuse it too)
    e.currentTarget.disabled=true;
    const result=rentApartment(p,id,revision);
    if(!result.ok){ctx.ui.notice(REFUSED[result.reason]);return openRental(ctx);}
    // Furniture left in any other flat comes back to the inventory: owned, and ready for this one.
    for(const u of data.units)if(u.id!==id)storeRoomFurniture(ctx,u.id);
    ctx.save();
    const u=unitOf(id);
    ctx.ui.notice(result.action==='move'?`Moved to ${u.zh}. ${result.refund} coins came back for your old flat's unused days; its furniture is in your inventory.`
      :`Rent paid: ${u.zh} on ${STOPS.get(id).zh}, ${leaseStatus(p).days} in-game days. Take the lift.`);
    openRental(ctx,'','desk-lift');
  };
  body.querySelector('#rental-recover').onclick=()=>{
    if(ctx.profile!==p)return openRental(ctx);
    for(const u of data.units)if(!rentalAccess(p,u.id))storeRoomFurniture(ctx,u.id);
    ctx.ui.notice('Your furniture is available in inventory.');
  };
  body.querySelector('#rental-practice').onclick=()=>openDialogue(ctx,data.lesson.id,{lessonData:data.lesson,reward:false,englishSupport:true,onFinish:()=>openRental(ctx)});
}

/** The lift's panel: every floor, top down, the ones your lease does not open greyed out. */
export function openLift(ctx){
  const here=ctx.town.place,p=ctx.profile,said=signs.signs['电梯'];
  const body=ctx.ui.open('rental-lift','电梯',[said?.pinyin,said?.en].filter(Boolean).join(' · '));
  body.innerHTML=`<div class="lift-floors">${[...data.stops].reverse().map(stop=>{
    const open=rentalAccess(p,stop.room),at=stop.room===here,unit=unitOf(stop.room),amenity=amenityOf(stop.room),what=unit??amenity??rooms[stop.room];
    const why=at?'You are here':open?'':unit?'Rent it at the front desk':`For ${tierName(amenity.tier)} and up`;
    return `<button class="${open&&!at?'primary':'secondary'}" data-stop="${esc(stop.room)}"${open&&!at?'':' disabled'}><b>${esc(stop.zh)}</b> ${esc(what.zh)} <small>${esc(what.en)}${why?' · '+esc(why):''}</small></button>`;
  }).join('')}</div>`;
  for(const button of body.querySelectorAll('[data-stop]:not([disabled])'))
    button.onclick=()=>{ctx.ui.armClose(()=>{if(ctx.town.rentalLift?.ride(here,button.dataset.stop))ctx.syncPlace?.();});ctx.ui.close();};
  body.querySelector('[data-stop]:not([disabled])')?.focus();
}

/** 屋顶餐厅 orders from the restaurant menu everyone knows, under its own name. */
function openRestaurant(ctx){
  openMenu(ctx,'tablet');
  const eyebrow=document.querySelector('#panel .eyebrow');if(eyebrow)eyebrow.textContent='屋顶餐厅 · 桌上点菜';
}

/**
 * Before a door opens (src/main.js enterPlace): true when the rental has dealt with it. Out of a
 * floor of the tower is down by lift, so the lift's panel opens; a flat without its lease, or an
 * amenity above the lease's tier, stays shut and says why.
 */
export function rentalDoor(ctx,id){
  const here=ctx.town.place;
  if(id==='city'&&TOWER.has(here)&&here!==data.lobby){if(!ctx.town.rentalLift?.riding)openLift(ctx);return true;}
  if(rentalAccess(ctx.profile,id))return false;
  const amenity=amenityOf(id);
  if(amenity)ctx.ui.notice(`${amenity.zh} is for ${tierName(amenity.tier)} tenants and up. Ask at the front desk.`);
  else openRental(ctx);
  return true;
}

export function installRental(ctx){
  ctx.town.rentalAllowed=place=>rentalAccess(ctx.profile,place);
  // The flats have been redrawn since some saves furnished them (the studio's door moved, a kitchen
  // came in): anything now standing on a fitting or in a doorway goes back to the inventory.
  for(const u of data.units)storeRoomFurniture(ctx,u.id,r=>ctx.town.misplaced(u.id,r));
  // The lift car (src/world/rental.js) calls out as it goes: up or down, the chime and the floor, then out.
  ctx.town.onLift=(event,stop)=>{
    if(event==='depart')return announce(ctx,line(stop.up?'lift-up':'lift-down'));
    if(event==='arrive'){ctx.music?.cue('place');return announce(ctx,{...stop.arrive,audio:'rental-lift-floor-'+stop.floor});}
    if(event!=='out')return;
    ctx.town.onInteract('door:'+stop.room);
    const at=data.rooms[stop.room]?.arrive,room=ctx.town.rooms.get(stop.room);
    if(at&&ctx.town.place===stop.room)ctx.town.warp(room.offsetX+at[0],at[1],at[2]);
  };
}
