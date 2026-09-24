import {test,expect} from '@playwright/test';

/**
 * Saves synced to a folder on the computer (docs/superpowers/plans/2026-09-21-saves-art-hall-house.md,
 * Task 2). `showDirectoryPicker` is replaced by an in-memory folder whose files live in window.__files.
 */
const SAVE_KEY='little-mandarin-town.v1';
const save=extra=>JSON.stringify({version:1,wallet:40,inventory:{},equipped:{},claims:{},words:{},completed:[],phrases:[],saved:[],home:[],discovered:[],read:[],clock:10,dayIndex:0,vendors:{},tutorial:{done:true},
  settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0,sensitivity:0.12},playerName:'旅人',...extra});

async function setUp(page,files={}){
  await page.addInitScript(([key,value,files])=>{
    localStorage.setItem(key,value);
    window.__files=new Map(Object.entries(files));
    const file=name=>({
      getFile:async()=>new File([window.__files.get(name)??''],name),
      createWritable:async()=>{let text='';return {write:async t=>{text+=t;},close:async()=>{window.__files.set(name,text);}};},
    });
    const folder={kind:'directory',name:'Qinghe saves',queryPermission:async()=>'granted',requestPermission:async()=>'granted',
      getFileHandle:async(name,{create=false}={})=>{
        if(!window.__files.has(name)){if(!create)throw new DOMException('missing','NotFoundError');window.__files.set(name,'');}
        return file(name);
      }};
    window.showDirectoryPicker=async()=>folder;
  },[SAVE_KEY,save(),files]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.locator('#settings-button').click();
}
const fileText=(page,name)=>page.evaluate(n=>window.__files.get(n)??null,name);

test('choosing a folder writes the save and a daily HSK log row, and keeps them current',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await setUp(page);
  await expect(page.locator('#panel')).toContainText('每个网址都有自己的存档');
  await page.getByRole('button',{name:/选择文件夹/}).click();
  await expect(page.locator('#folder-sync')).toContainText('已同步到：Qinghe saves');
  await expect.poll(async()=>JSON.parse(await fileText(page,'qinghe-save.json')??'{}').wallet).toBe(40);
  await expect(page.locator('#folder-sync')).toContainText('上次保存：');
  // Progress made after connecting reaches the folder within a few seconds.
  await page.evaluate(()=>{window.__qinghe.profile.wallet=77;window.__qinghe.save();});
  await expect.poll(async()=>JSON.parse(await fileText(page,'qinghe-save.json')).wallet,{timeout:9000}).toBe(77);
  // The log waits for the HSK word list, then writes one row for today.
  await expect.poll(()=>fileText(page,'qinghe-hsk-log.csv'),{timeout:9000}).toMatch(/^date,hsk1,hsk2,hsk3,hsk4,hsk5,hsk6,objects,coins\n\d{4}-\d{2}-\d{2},\d+,\d+,\d+,\d+,\d+,\d+,0,\d+\n$/);
  // The journal shows the same log from the browser's copy.
  await page.keyboard.press('Escape');
  await page.locator('#journal-button').click();
  await expect(page.locator('.progress-log tbody tr')).toHaveCount(1);
  await expect(page.locator('.progress-log thead')).toContainText('认识的东西');
  expect(errors).toEqual([]);
});

test('a folder holding a fuller save offers to restore it, without overwriting it first',async({page})=>{
  const fuller=save({wallet:12,words:{water:{recognition:{stage:2,due:0,last:0,reviews:2}}}});
  await setUp(page,{'qinghe-save.json':fuller});
  await page.getByRole('button',{name:/选择文件夹/}).click();
  await expect(page.locator('#panel')).toContainText('在文件夹里找到了进度更多的存档，要恢复吗？');
  await page.waitForTimeout(5500);                         // longer than the sync delay
  expect(await fileText(page,'qinghe-save.json')).toBe(fuller);
  await page.getByRole('button',{name:/^恢复/}).click();
  await expect(page.locator('#panel')).toBeHidden();
  expect(await page.evaluate(()=>window.__qinghe.profile.words.water.recognition.stage)).toBe(2);
  await expect.poll(async()=>JSON.parse(await fileText(page,'qinghe-save.json')).words.water?.recognition.stage,{timeout:9000}).toBe(2);
});

test('declining the fuller folder save keeps a dated copy of it before syncing over it',async({page})=>{
  const fuller=save({wallet:12,words:{water:{recognition:{stage:2,due:0,last:0,reviews:2}}}});
  await setUp(page,{'qinghe-save.json':fuller});
  await page.getByRole('button',{name:/选择文件夹/}).click();
  await page.getByRole('button',{name:/不用了/}).click();
  const dated=()=>page.evaluate(()=>[...window.__files.keys()].find(n=>/^qinghe-save-\d{4}-\d{2}-\d{2}\.json$/.test(n)));
  await expect.poll(dated).toBeTruthy();
  const copy=await dated();
  expect(await fileText(page,copy)).toBe(fuller);
  await page.evaluate(()=>window.__qinghe.save());
  await expect.poll(async()=>JSON.parse(await fileText(page,'qinghe-save.json')).wallet,{timeout:9000}).toBe(40);
});

test('a save from a newer version of the game is never written over',async({page})=>{
  const newer=save({version:99,wallet:500});
  await page.addInitScript(([key,value])=>{localStorage.setItem(key,value);},[SAVE_KEY,newer]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await expect(page.locator('#toast')).toContainText('newer version');
  await page.evaluate(()=>{window.__qinghe.profile.wallet=3;window.__qinghe.save();});
  expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(newer);
});
