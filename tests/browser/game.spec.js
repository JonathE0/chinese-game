import {test,expect} from '@playwright/test';
import {pastGreeting} from './greeting.js';
test('town loads, stays player initiated, and Chinese help is opt-in',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
  await expect(page.locator('#arrival')).toBeHidden();
  await expect(page.locator('#panel')).toBeHidden();
  await page.getByRole('button',{name:'旅行手册'}).click();
  await expect(page.getByText("今天的小事")).toBeVisible();
  await expect(page.locator('#panel .help-content').first()).toBeHidden();
  await page.locator('#panel [data-help]').first().click();
  await expect(page.locator('#panel .help-content').first()).toBeVisible();
  await page.screenshot({path:'test-results/journal.png'});
  expect(errors).toEqual([]);
});
test('denied microphone keeps the response editable and does not alter rewards',async({page})=>{
  await page.addInitScript(()=>{window.SpeechRecognition=class{start(){queueMicrotask(()=>this.onerror?.({error:'not-allowed'}));}abort(){}};});
  await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
  await toLin(page);await page.keyboard.press('e');await pastGreeting(page);
  await page.getByRole('button',{name:'麦克风回答'}).click();await expect(page.locator('#speech-status')).toContainText('denied');
  await expect(page.getByRole('textbox',{name:'你的回答'})).toBeEditable();await expect(page.locator('#wallet-count')).toHaveText('0');
  await page.getByRole('textbox',{name:'你的回答'}).fill('您好');await page.getByRole('button',{name:'提交回答'}).click();await expect(page.getByRole('button',{name:'继续',exact:true})).toBeVisible();
});
test('practice gives saved rewards and repeat completion cannot farm coins',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
  // The picture drill is 小美's corner of the square, not a sidebar tab.
  await page.evaluate(()=>window.__qinghe.town.onInteract('mei'));await pastGreeting(page);
  await page.getByRole('button',{name:'开始练习'}).click();
  for(let i=0;i<4;i++){
    const word=await page.locator('#practice-word').getAttribute('data-word');
    await page.locator(`[data-item="${word}"]`).click();
    await page.getByRole('button',{name:i===3?'完成练习':'下一个'}).click();
  }
  await expect(page.getByText('练习完成！')).toBeVisible();
  const wallet=Number(await page.locator('#wallet-count').textContent());expect(wallet).toBeGreaterThan(0);
  await page.reload();await page.getByRole('button',{name:'开始旅行'}).click();
  await expect(page.locator('#wallet-count')).toHaveText(String(wallet));
  await page.evaluate(()=>window.__qinghe.town.onInteract('mei'));await pastGreeting(page);await page.getByRole('button',{name:'开始练习'}).click();
  for(let i=0;i<4;i++){const word=await page.locator('#practice-word').getAttribute('data-word');await page.locator(`[data-item="${word}"]`).click();await page.getByRole('button',{name:i===3?'完成练习':'下一个'}).click();}
  await expect(page.locator('#wallet-count')).toHaveText(String(wallet));
});

// Walking slides about 0.7 m after the key comes up, so let go that much early and let it settle.
/** From the fountain's north side to 林阿姨's tea stall beside the tea-house: west past the market
 *  carts, across in front of the tea-house, and up to her counter. */
async function toLin(page){
  await page.evaluate(()=>window.__qinghe.town.warp(0,9,0));
  await walk(page,'a','cx',-9);await walk(page,'w','cy',-1.1);await walk(page,'d','cx',-4.8);await walk(page,'w','cy',-7.2);
}
async function walk(page,key,axis,target){
  const start=Number(await page.locator('#map-player').getAttribute(axis)),early=target>start?target-.7:target+.7;
  await page.keyboard.down(key);
  try{await expect.poll(async()=>Number(await page.locator('#map-player').getAttribute(axis)),{timeout:12000,intervals:[80]} )[target>start?'toBeGreaterThan':'toBeLessThan'](early);}finally{await page.keyboard.up(key);}
  await page.waitForTimeout(600);
}
test('walk to NPC, introduce yourself, bargain and confirm a wearable purchase',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Start with a little money so the test is about haggling, not affordability.
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},
    ['little-mandarin-town.v1',JSON.stringify({version:1,wallet:40,inventory:{},equipped:{},claims:{},words:{},
     completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],clock:14,dayIndex:0,vendors:{},
     settings:{pinyin:true,english:true,dialogueVolume:0.9,ambientVolume:0.35,musicVolume:0},playerName:'旅人'})]);
  const clips=[];page.on('request',r=>{if(r.url().includes('/audio/clips/'))clips.push(r.url());});
  await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
  await page.screenshot({path:'test-results/town.png'});
  await toLin(page);
  await expect(page.locator('#interact')).toBeVisible();await expect(page.locator('#panel')).toBeHidden();
  await page.keyboard.press('e');await pastGreeting(page);await expect(page.getByRole('heading',{name:'初次见面'})).toBeVisible();
  // The clip manifest is fetched in the background, so the label starts as "loading".
  await expect(page.locator('.audio-source')).toHaveText('普通话 · AI 配音',{timeout:15000});
  await page.getByRole('button',{name:'重听',exact:true}).click();
  await expect.poll(()=>clips.some(u=>u.includes('intro-greeting.mp3')),{timeout:8000}).toBe(true);
  await expect(page.locator('#toast')).toBeHidden();
  for(const [i,answer]of ['您好','我叫安娜','我是来看朋友的','好啊'].entries()){
    await page.getByRole('textbox',{name:'你的回答'}).fill(answer);await page.getByRole('button',{name:'提交回答'}).click();await page.getByRole('button',{name:i===3?'完成对话':'继续',exact:true}).click();
  }
  await expect(page.locator('#wallet-count')).toHaveText('60');await page.getByRole('button',{name:'回到小镇',exact:true}).click();
  await walk(page,'s','cy',-4);await walk(page,'d','cx',4.8);await walk(page,'w','cy',-7.2);await page.keyboard.press('e');await pastGreeting(page);await expect(page.getByRole('heading',{name:'带一点青禾回家'})).toBeVisible();
  await page.locator('[data-shop-item="travel-hat"]').click();
  // How low the vendor will go depends on their mood today, so read it off the counter.
  const floorText=await page.locator('.negotiation h3 small').textContent();
  const floor=Number(floorText.match(/[0-9]+/)[0]);
  expect(floor).toBeGreaterThanOrEqual(18);
  await page.getByRole('textbox',{name:'你的出价'}).fill('十可以吗？');
  await page.getByRole('button',{name:'出价',exact:true}).click();
  await expect(page.locator('#quoted-price')).not.toHaveText('10');          // a lowball is countered, never taken
  await page.getByRole('textbox',{name:'你的出价'}).fill(floor+'可以吗？');
  await page.getByRole('button',{name:'出价',exact:true}).click();
  await expect(page.locator('#quoted-price')).toHaveText(String(floor));
  const before=Number(await page.locator('#wallet-count').textContent());
  await page.getByRole('button',{name:'按这个价格购买'}).click();
  await page.getByRole('button',{name:'确认购买',exact:true}).click();
  await expect(page.locator('#wallet-count')).toHaveText(String(before-floor));
  await page.getByRole('button',{name:'现在穿上'}).click();await page.getByRole('button',{name:'背包',exact:true}).click();await expect(page.getByRole('button',{name:'取下'})).toBeVisible();
  expect(errors).toEqual([]);
});
test('settings export, layout preview, ambient collection and mobile layout',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
  await page.evaluate(()=>window.__qinghe.town.warp(0,9,0));   // the neighbours chat in view of the old arrival spot
  await page.getByRole('button',{name:'听听闲聊'}).click();await page.locator('[data-save-phrase]').first().click();await expect(page.locator('[data-save-phrase]').first()).toHaveText('已收藏');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'设置',exact:true}).click();await page.locator('#setting-pinyin').selectOption('never');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出存档'}).click();expect((await download).suggestedFilename()).toBe('qinghe-save.json');
  await page.getByRole('button',{name:'编辑小镇布局'}).click();await page.locator('#layout-x').fill('-8');
  const layoutDownload=page.waitForEvent('download');await page.getByRole('button',{name:'导出 world.json'}).click();expect((await layoutDownload).suggestedFilename()).toBe('world.json');
  await page.keyboard.press('Escape');await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'旅行手册'}).click();
  await expect(page.locator('#panel')).toBeVisible();await page.screenshot({path:'test-results/mobile.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('mouse look turns the view and walking follows where you face',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
  const at=async axis=>Number(await page.locator('#map-player').getAttribute(axis));
  const heading=async()=>Number((await page.locator('#map-facing').getAttribute('transform')).match(/rotate\(([-\d.]+)\)/)[1]);
  await expect(page.locator('#crosshair')).toBeVisible();
  // You arrive facing your home; start this from the middle of the square, facing north.
  await page.evaluate(()=>window.__qinghe.town.warp(0,9,0));
  await expect.poll(heading).toBe(0);   // the map redraws on the next frame
  // Clicking the town grabs the mouse, then moving it turns the tourist.
  await page.mouse.click(700,500);
  expect(await page.evaluate(()=>document.pointerLockElement?.id)).toBe('world');
  await page.mouse.move(1000,500);
  await expect.poll(heading,{timeout:5000}).toBeGreaterThan(15);
  // The view eases into a turn rather than snapping, so let it settle before measuring it.
  await expect.poll(async()=>{
    const before=await heading();await page.waitForTimeout(90);
    return Math.abs(await heading()-before)<.01;
  },{timeout:5000}).toBe(true);
  const turned=await heading();
  const [x0,y0]=[await at('cx'),await at('cy')];
  await page.keyboard.down('w');await page.waitForTimeout(700);await page.keyboard.up('w');
  const [x1,y1]=[await at('cx'),await at('cy')];
  // Facing right of north, forward must carry the tourist both north and east.
  expect(y1).toBeLessThan(y0-1);
  expect(x1).toBeGreaterThan(x0+.3);
  // The walk direction matches the heading rather than the world axes.
  const yaw=-turned*Math.PI/180;
  expect(Math.atan2(x1-x0,-(y1-y0))).toBeCloseTo(Math.atan2(-Math.sin(yaw),Math.cos(yaw)),1);
  expect(errors).toEqual([]);
});
test('typing in a dialogue field never drives the town or repeats the interaction',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
  await toLin(page);await page.keyboard.press('e');await pastGreeting(page);
  await expect(page.getByRole('heading',{name:'初次见面'})).toBeVisible();
  const box=page.getByRole('textbox',{name:'你的回答'});await box.click();
  const before={cx:Number(await page.locator('#map-player').getAttribute('cx')),cy:Number(await page.locator('#map-player').getAttribute('cy'))};
  await page.keyboard.type('wasde');await page.waitForTimeout(600);
  await expect(box).toHaveValue('wasde');
  expect(Number(await page.locator('#map-player').getAttribute('cx'))).toBeCloseTo(before.cx,3);
  expect(Number(await page.locator('#map-player').getAttribute('cy'))).toBeCloseTo(before.cy,3);
  await expect(page.getByRole('heading',{name:'初次见面'})).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#panel')).toBeHidden();
});
test('ambient music starts after the first gesture and is audible without clipping',async({page})=>{
  await page.addInitScript(()=>{
    // Tap whatever reaches the speakers so the signal itself can be measured.
    const realConnect=AudioNode.prototype.connect;
    AudioNode.prototype.connect=function(dest,...rest){
      if(dest&&this.context&&dest===this.context.destination&&!window.__analyser){
        const analyser=this.context.createAnalyser();analyser.fftSize=2048;window.__analyser=analyser;realConnect.call(this,analyser);
      }
      return realConnect.call(this,dest,...rest);
    };
  });
  await page.goto('/');
  expect(await page.evaluate(()=>!!window.__analyser)).toBe(false);
  await page.getByRole('button',{name:'开始旅行'}).click();
  const level=()=>page.evaluate(()=>{
    const analyser=window.__analyser;if(!analyser)return null;
    const buffer=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(buffer);
    let sum=0,peak=0;for(const v of buffer){sum+=v*v;peak=Math.max(peak,Math.abs(v));}
    return {rms:Math.sqrt(sum/buffer.length),peak};
  });
  await expect.poll(async()=>(await level())?.rms??0,{timeout:15000,intervals:[400]}).toBeGreaterThan(.01);
  const {peak}=await level();
  expect(peak).toBeLessThan(.9);
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.locator('#music-volume').fill('0');
  await expect.poll(async()=>(await level())?.rms??1,{timeout:8000,intervals:[400]}).toBeLessThan(.005);
});
test('highlighting Chinese gives pinyin and a gloss, and saves it for later',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
  // A fixture rather than a particular panel: the lookup works on any Chinese on screen, and
  // the test should not break every time a section of the journal is rearranged.
  await page.evaluate(()=>{
    const fixture=document.createElement('p');
    fixture.id='lookup-fixture';fixture.innerHTML='<span class="zh">水</span>';
    document.body.appendChild(fixture);
  });
  const select=selector=>page.evaluate(css=>{
    const node=document.querySelector(css);
    const range=document.createRange();range.selectNodeContents(node);
    const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  },selector);
  await select('#lookup-fixture .zh');
  await expect(page.locator('#lookup')).toBeVisible();
  await expect(page.locator('#lookup .lookup-pinyin').first()).toContainText('shuǐ',{timeout:20000});
  await expect(page.locator('#lookup .lookup-en').first()).toContainText('water');
  await expect(page.locator('#lookup .lookup-credit')).toContainText('CC BY-SA 4.0');
  await page.locator('#lookup .lookup-save').first().click();
  await expect(page.locator('#lookup .lookup-save').first()).toHaveText('已收藏');
  // A multi-word phrase is segmented rather than looked up whole.
  await page.keyboard.press('Escape');
  await page.evaluate(()=>window.__qinghe.town.warp(0,9,0));
  await page.getByRole('button',{name:'听听闲聊'}).click();
  await select('.ambient-line .zh');
  // A sentence leads with its meaning; the word-by-word breakdown is loaded when you open it.
  await page.locator('#lookup summary').click();
  await expect.poll(()=>page.locator('#lookup .lookup-word').count(),{timeout:15000}).toBeGreaterThan(2);
  await page.keyboard.press('Escape');
  // The saved word survives a reload and is listed in the journal.
  await page.reload();await page.getByRole('button',{name:'开始旅行'}).click();
  await page.getByRole('button',{name:'旅行手册'}).click();
  await expect(page.locator('#saved-words .lookup-zh')).toHaveText('水');
  await page.locator('[data-forget="0"]').click();
  await expect(page.locator('#saved-words .lookup-zh')).toHaveCount(0);
  expect(errors).toEqual([]);
});
