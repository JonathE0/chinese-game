import catalog from '../content/catalog.json' with {type:'json'};
import {escapeHtml as esc} from '../core/language.js';
import {icon,itemArt} from './art.js';
import {languageLine,pinyinWith} from './shell.js';
import {LOANS,loanById,totalDue,takeLoan,repay,debtOf,
  savingsOf,deposit,withdraw,interestOn,balanceForCap,INTEREST_RATE,INTEREST_CAP,
  PERMITS,permitById,permitTotal,holdsPermit,permitPlan,buyPermit} from '../core/finance.js';
import {calendarOf} from '../core/calendar.js';
import {sellable,sell,offerFor} from '../core/resale.js';
import {buildRapport,vendorState,moodNote} from '../core/vendor.js';
import {outfit} from '../core/inventory.js';

// ------------------------------------------------------------------- bank
const TELLER={zh:'您好，要办什么？',pinyin:'Nín hǎo, yào bàn shénme?',en:'Good day. What can we do for you?',
  note:'办 here means to handle a piece of business — 办事 is what you go to a counter to do.'};

const TABS=[['savings','存取','Savings'],['loan','借钱','Borrow'],['permit','执照','Permits']];

export function openBank(ctx,tab='savings'){
  const body=ctx.ui.open('bank','青禾银行','柜台 · THE COUNTER');
  render(ctx,body,tab);
}

/** The three things you can do at a counter, and which one is showing. */
function chrome(ctx,body,tab,inner){
  body.innerHTML=`${languageLine(TELLER,ctx.profile.settings,{className:'shop-greeting'})}
    <div class="bank-balance"><div><b>${ctx.profile.wallet}</b><span>钱包 · wallet</span></div>
      <div><b>${savingsOf(ctx.profile)}</b><span>存款 · saved</span></div>
      <div><b>${debtOf(ctx.profile)?.owed??0}</b><span>欠款 · owed</span></div></div>
    <div class="bank-tabs">${TABS.map(([id,zh,en])=>
      `<button class="bank-tab ${id===tab?'active':''}" data-tab="${id}">${zh}<small>${en}</small></button>`).join('')}</div>
    <div id="bank-body">${inner}</div>
    <div id="bank-confirm"></div>
    <p class="microcopy">这里的「学习币」是游戏里的货币，不是真钱，也不涉及任何真实的金融服务。<br>
      Coins are the in-game currency. Nothing here is real money or real financial advice.</p>`;
  body.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>render(ctx,body,button.dataset.tab));
}

function render(ctx,body,tab='savings'){
  if(tab==='savings')return savingsView(ctx,body);
  if(tab==='permit')return permitView(ctx,body);
  return loanView(ctx,body);
}

/** Deposit, withdraw, and a plain statement of what the account pays. */
function savingsView(ctx,body){
  const p=ctx.profile,balance=savingsOf(p),today=interestOn(balance);
  chrome(ctx,body,'savings',`
    <div class="interest-card">
      <div><b>+${today}</b><span>明早的利息 · tomorrow morning</span></div>
      <p class="microcopy">每天早上按存款的 ${Math.round(INTEREST_RATE*100)}% 结息，单利，每天最多 ${INTEREST_CAP} 学习币。
        存满 ${balanceForCap()} 就到顶了。<br>
        ${Math.round(INTEREST_RATE*100)}% of your balance each in-game morning, simple interest, capped at
        ${INTEREST_CAP} a day — ${balanceForCap()} saved reaches the ceiling. It is a steady supplement,
        never a replacement for going out and earning.</p>
      <div class="gate-bar"><i style="width:${Math.min(100,Math.round(balance/balanceForCap()*100))}%"></i></div>
    </div>
    <div class="money-row">
      <label class="editor-field">存进去 · Deposit
        <input id="deposit-amount" type="number" min="1" step="1" max="${p.wallet}" value="${Math.min(p.wallet,50)||''}"></label>
      <button class="primary" id="do-deposit" ${p.wallet<1?'disabled':''}>存</button>
    </div>
    <div class="money-row">
      <label class="editor-field">取出来 · Withdraw
        <input id="withdraw-amount" type="number" min="1" step="1" max="${balance}" value="${Math.min(balance,50)||''}"></label>
      <button class="secondary" id="do-withdraw" ${balance<1?'disabled':''}>取</button>
    </div>`);
  const amount=id=>Math.floor(Number(body.querySelector(id)?.value??0));
  body.querySelector('#do-deposit').onclick=()=>{
    const result=deposit(ctx.profile,amount('#deposit-amount'));
    if(!result.ok)return ctx.ui.notice('请输入要存的数目。 / Enter an amount to deposit.');
    ctx.music?.cue('purchase');ctx.save();
    ctx.ui.notice(`存了 ${result.moved}，账上有 ${result.balance}。 / Deposited ${result.moved}.`);
    savingsView(ctx,body);
  };
  body.querySelector('#do-withdraw').onclick=()=>{
    const result=withdraw(ctx.profile,amount('#withdraw-amount'));
    if(!result.ok)return ctx.ui.notice('账上没有那么多。 / There is not that much in the account.');
    ctx.save();
    ctx.ui.notice(`取了 ${result.moved}。 / Withdrew ${result.moved}.`);
    savingsView(ctx,body);
  };
}

/** Building permits: everything up front, or four weekly instalments for a surcharge. */
function permitView(ctx,body){
  const p=ctx.profile,{week}=calendarOf(p);
  chrome(ctx,body,'permit',`
    <p class="microcopy">大的工程动土以前要先办执照。可以一次付清，也可以分四周付，分期要多付 ${Math.round(PERMITS[0].surcharge*100)}%。<br>
      A build site will not break ground without one. Pay it all now, or spread it over four in-game
      weeks for a surcharge; instalments come out of your wallet, then your savings.</p>
    <div class="permit-grid">${PERMITS.map(permit=>{
      const held=holdsPermit(p,permit.id),plan=permitPlan(p,permit.id);
      return `<article class="permit-card ${held?'held':''}">
        <div class="permit-head"><b>${esc(permit.zh)}</b><small>${pinyinWith(permit.pinyin,permit.zh,permit.en)}</small></div>
        <p>${esc(permit.note)}<br><small>${esc(permit.noteEn)}</small></p>
        ${held?`<span class="permit-state">已办好${plan?` · 还剩 ${plan.owed} 分 ${Math.ceil(plan.owed/plan.perWeek)} 周付清`:''}</span>`
          :`<div class="button-row">
             <button class="primary" data-permit="${esc(permit.id)}" data-plan="lump" ${p.wallet<permit.price?'disabled':''}>
               一次付清 ${permit.price}</button>
             <button class="secondary" data-permit="${esc(permit.id)}" data-plan="weekly"
               ${p.wallet<Math.ceil(permitTotal(permit,'weekly')/permit.weeks)?'disabled':''}>
               分期 ${Math.ceil(permitTotal(permit,'weekly')/permit.weeks)} × ${permit.weeks} 周</button>
           </div>`}
      </article>`;}).join('')}</div>`);
  body.querySelectorAll('[data-permit]').forEach(button=>button.onclick=()=>{
    const permit=permitById(button.dataset.permit);
    const result=buyPermit(ctx.profile,permit,button.dataset.plan,week);
    if(!result.ok)return ctx.ui.notice(result.reason==='funds'
      ?'学习币不够。 / Not enough coins.':'这张执照已经办过了。 / You already hold that permit.');
    ctx.music?.cue('reward');ctx.save();
    ctx.ui.notice(result.plan==='lump'
      ?`${permit.zh}办好了。 / Permit granted.`
      :`${permit.zh}办好了，之后每周自动扣款。 / Permit granted; instalments start next week.`);
    permitView(ctx,body);
  });
}

function loanView(ctx,body){

  const p=ctx.profile,debt=debtOf(p);
  chrome(ctx,body,'loan',`
    ${debt?`<div class="debt-card ${debt.missed?'late':''}">
        <p>还有 <b>${debt.owed}</b> 学习币没还，每天自动扣 <b>${debt.perDay}</b>。
        ${debt.missed?`已经迟了 ${debt.missed} 天。`:''}</p>
        <p class="microcopy">${debt.missed
          ?'迟还一天，余额加一成，城里的店家也会知道。 / Each missed day adds ten percent, and the shopkeepers hear about it.'
          :'钱不够的时候会加罚金，别忘了留一点。 / A missed instalment adds a late fee — keep something back for it.'}</p>
        <div class="button-row">
          <button class="primary" id="pay-day" ${p.wallet<Math.min(debt.perDay,debt.owed)?'disabled':''}>还今天的 ${Math.min(debt.perDay,debt.owed)}</button>
          <button class="secondary" id="pay-all" ${p.wallet<debt.owed?'disabled':''}>一次还清 ${debt.owed}</button>
        </div></div>`
      :`<h3 class="section-title">借钱 <small>BORROW</small></h3>
        <p class="microcopy">一次只能借一笔，按天平均还，还清了才能再借。<br>One loan at a time, repaid in equal daily instalments.</p>
        <div class="loan-grid">${LOANS.map(loan=>`
          <button class="loan-card" data-loan="${esc(loan.id)}">
            <b>${icon('coin',15)} ${loan.amount}</b>
            <span>${loan.zh} · ${esc(loan.en)}</span>
            <small>${loan.days} 天 · 共还 ${totalDue(loan)} · 每天 ${Math.ceil(totalDue(loan)/loan.days)}</small>
          </button>`).join('')}</div>`}`);

  body.querySelector('#pay-day')?.addEventListener('click',()=>{
    const result=repay(ctx.profile,debtOf(ctx.profile).perDay);
    if(result.ok)ctx.ui.notice(result.cleared?'还清了，谢谢！ / Paid off in full.':`还了 ${result.paid}。 / Paid ${result.paid}.`);
    ctx.save();loanView(ctx,body);
  });
  body.querySelector('#pay-all')?.addEventListener('click',()=>{
    const result=repay(ctx.profile,debtOf(ctx.profile).owed);
    if(result.ok)ctx.ui.notice('还清了，谢谢！ / Paid off in full.');
    ctx.save();loanView(ctx,body);
  });
  body.querySelectorAll('[data-loan]').forEach(button=>button.onclick=()=>{
    const loan=loanById(button.dataset.loan),confirm=body.querySelector('#bank-confirm');
    confirm.innerHTML=`<div class="purchase-confirm"><h3>确认借款？</h3>
      <dl><div><dt>现在拿到</dt><dd>${loan.amount} 学习币</dd></div>
        <div><dt>一共要还</dt><dd>${totalDue(loan)} 学习币</dd></div>
        <div><dt>每天扣</dt><dd>${Math.ceil(totalDue(loan)/loan.days)} · 共 ${loan.days} 天</dd></div></dl>
      <button class="primary" id="confirm-loan">确认借款</button><button class="secondary" id="cancel-loan">再想想</button></div>`;
    confirm.querySelector('#cancel-loan').onclick=()=>confirm.innerHTML='';
    confirm.querySelector('#confirm-loan').onclick=()=>{
      const result=takeLoan(ctx.profile,loan,ctx.profile.dayIndex??0);
      if(!result.ok)return ctx.ui.notice('还有没还清的贷款。 / You already have a loan outstanding.');
      ctx.save();ctx.ui.notice(`借到 ${result.received} 学习币，从明天开始还。 / Borrowed ${result.received}; repayments start tomorrow.`);
      loanView(ctx,body);
    };
  });
}

// -------------------------------------------------------------- resale shop
const OLD_ZHOU={zh:'有什么要卖的？我看看。',pinyin:'Yǒu shénme yào mài de? Wǒ kànkan.',
  en:'Anything to sell? Let me have a look.',note:'卖 (mài, sell) and 买 (mǎi, buy) differ only in tone — and in one stroke.'};

export function openResale(ctx){
  const body=ctx.ui.open('resale','旧物铺','老周收货 · SECOND-HAND');
  renderResale(ctx,body);
}

function renderResale(ctx,body){
  const p=ctx.profile,vendor=vendorState(p,'resale');
  const rows=sellable(p);
  body.innerHTML=`${languageLine(OLD_ZHOU,p.settings,{className:'shop-greeting'})}
    <div class="vendor-mood mood-${vendor.key}">
      <span class="mood-face" aria-hidden="true">${vendor.face}</span>
      <div><b>老周 ${vendor.zh}</b>${languageLine(moodNote(vendor),p.settings,{className:'mood-note'})}</div>
      <div class="rapport" title="熟悉程度"><span>熟</span><span class="rapport-bar"><i style="width:${Math.round(vendor.rapport/40*100)}%"></i></span></div>
    </div>
    <p class="panel-intro">他今天给的价钱，明天就不一样了。讲价买来的东西，运气好的时候能卖得比你付的还多。<br>
      Today's offers are rerolled tomorrow. Something you haggled hard for can, on a good day, sell for more than you paid.</p>
    <div class="shop-grid">${rows.length?rows.map(({item,offer,spare})=>`
      <button class="shop-card" data-sell="${esc(item.id)}">${itemArt(item.visual)}<b>${esc(item.zh)}</b>
        <span>${icon('coin',15)} ${offer}</span>
        <small>原价 ${item.price} · 还有 ${spare}</small></button>`).join('')
      :'<p class="microcopy">背包里没有可以卖的东西。房间里摆着的家具要先收起来。<br>Nothing spare to sell — furniture standing in your room has to be put away first.</p>'}</div>
    <div id="sell-confirm"></div>
    <p class="microcopy">卖掉的东西不会退回来。房间里正在用的家具不会出现在这里。</p>`;

  body.querySelectorAll('[data-sell]').forEach(button=>button.onclick=()=>{
    const item=catalog.find(i=>i.id===button.dataset.sell);
    const offer=offerFor(ctx.profile,item);
    const confirm=body.querySelector('#sell-confirm');
    const gain=offer>=item.price?'比原价还高，今天运气不错。':offer>=item.price*.7?'今天的价钱还可以。':'今天他压得比较狠。';
    confirm.innerHTML=`<div class="purchase-confirm"><h3>卖掉「${esc(item.zh)}」？</h3>
      <p>${gain}</p>
      <dl><div><dt>他出</dt><dd>${offer} 学习币</dd></div><div><dt>原价</dt><dd>${item.price} 学习币</dd></div></dl>
      <button class="primary" id="confirm-sell">卖了</button><button class="secondary" id="cancel-sell">再想想</button></div>`;
    confirm.querySelector('#cancel-sell').onclick=()=>confirm.innerHTML='';
    confirm.querySelector('#confirm-sell').onclick=()=>{
      const result=sell(ctx.profile,item,offer);
      if(!result.ok)return ctx.ui.notice('这件卖不了。 / That one cannot be sold.');
      buildRapport(ctx.profile,'resale',1);
      ctx.town.equip(outfit(ctx.profile));
      ctx.save();
      ctx.ui.notice(`卖掉了${item.zh}，+${result.price} 学习币。 / Sold for ${result.price}.`);
      renderResale(ctx,body);
    };
  });
}
