import {test,expect} from '@playwright/test';

// 汉字: 简体字 / 繁體字, live both ways (docs/superpowers/plans/2026-09-30-development-wave-4.md, W4-script).
// SHOTS=<folder> saves before/after screenshots of a street sign, the quest card and a dialogue.
const SAVE_KEY='little-mandarin-town.v1';
const shots=process.env.SHOTS;

async function start(page){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    clock:14,settings:{pinyin:'known',toneColors:false,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
}
const choose=(page,script)=>page.evaluate(async script=>{
  const {openSettings}=await import('/src/ui/panels.js');const ctx=window.__qinghe;
  openSettings(ctx);const select=document.querySelector('#setting-script');
  select.value=script;select.dispatchEvent(new Event('change'));ctx.ui.close();
},script);
// Every canvas sign board (models.label draws 768×160), as pixels, keyed by its place in the scene.
const boards=page=>page.evaluate(()=>{
  const out={};
  window.__qinghe.town.app.root.find(e=>e.signText&&e.render?.meshInstances?.[0]?.material?.diffuseMap?.getSource?.()?.width===768)
    .forEach((e,i)=>{out[i+':'+e.signText]=e.render.meshInstances[0].material.diffuseMap.getSource().toDataURL();});
  return out;
});
// Stand in front of the gate board to 商业街 and look at it.
const faceGate=page=>page.evaluate(async()=>{
  const t=window.__qinghe.town,[e]=t.app.root.find(e=>e.signText==='商业街'&&e.render);
  const p=e.getPosition(),f=e.forward;t.warp(p.x-f.x*6,p.z-f.z*6);
  t.yaw=Math.atan2(-f.x,-f.z)*180/Math.PI;t.pitch=6;
  await new Promise(done=>setTimeout(done,600));
});
const snap=async(page,name)=>{if(shots)await page.screenshot({path:`${shots}/${name}.png`});};
const talk=page=>page.evaluate(async()=>{const {openDialogue}=await import('/src/ui/dialogue.js');openDialogue(window.__qinghe,'introductions');});

test('繁體字 converts the page and the 3D signs and folds typed answers; 简体字 restores them, with no reload',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  await page.evaluate(()=>{window.__sameLoad=true;});   // a reload would lose this
  const card=page.locator('#quest-card h2');
  await expect(card).toHaveText('从一句你好开始。');
  const before=await boards(page);
  expect(Object.keys(before).length).toBeGreaterThan(5);
  await faceGate(page);await snap(page,'1-simplified-sign-and-card');
  await talk(page);await snap(page,'2-simplified-dialogue');
  const titleBefore=await page.title();
  await page.evaluate(()=>window.__qinghe.ui.close());

  await choose(page,'traditional');
  await expect(card).toHaveText('從一句你好開始。',{timeout:15000});
  expect(await page.evaluate(()=>[document.documentElement.lang,window.__qinghe.profile.settings.script])).toEqual(['zh-Hant','traditional']);
  const {zh}=await import('../../node_modules/opencc-js/dist/esm/full.js').then(({Converter})=>({zh:Converter({from:'cn',to:'tw'})}));
  const after=await boards(page);
  const changed=Object.keys(before).filter(k=>after[k]!==before[k]);
  expect(changed.length).toBeGreaterThan(0);
  for(const key of Object.keys(before)){
    const text=key.slice(key.indexOf(':')+1);
    expect(after[key]!==before[key],`board ${text}`).toBe(zh(text)!==text);   // redrawn exactly when it reads differently
  }
  expect(await page.evaluate(()=>window.__qinghe.town.app.root.find(e=>e.signText==='商业街').length)).toBeGreaterThan(0);   // the look-up key stays simplified
  await faceGate(page);await snap(page,'3-traditional-sign-and-card');

  // A typed traditional answer where the simplified one is expected; the field keeps what was typed.
  await talk(page);
  const answer=page.getByRole('textbox',{name:'你的回答'});
  await answer.fill('你好謝謝');
  await expect(answer).toHaveValue('你好謝謝');
  await snap(page,'4-traditional-dialogue');
  await page.getByRole('button',{name:'提交回答'}).click();
  await expect(page.getByRole('button',{name:'繼續',exact:true})).toBeVisible();
  await page.evaluate(()=>window.__qinghe.ui.close());

  await choose(page,'simplified');
  await expect(card).toHaveText('从一句你好开始。');
  expect(await page.title()).toBe(titleBefore);
  expect(await page.evaluate(()=>[document.documentElement.lang,window.__qinghe.profile.settings.script,window.__sameLoad])).toEqual(['zh-Hans','simplified',true]);
  expect(await boards(page)).toEqual(before);
  expect(errors).toEqual([]);
});
