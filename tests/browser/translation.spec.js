import {test,expect} from '@playwright/test';

async function selectRange(page,startSelector,startOffset,endSelector,endOffset){
  await page.evaluate(({startSelector,startOffset,endSelector,endOffset})=>{
    const range=document.createRange();
    range.setStart(document.querySelector(startSelector).firstChild,startOffset);
    range.setEnd(document.querySelector(endSelector).firstChild,endOffset);
    const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  },{startSelector,startOffset,endSelector,endOffset});
}

test.beforeEach(async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>{
    const fixture=document.createElement('p');fixture.id='translation-fixture';
    fixture.innerHTML='<span id="part-a">我要一杯</span><strong id="part-b">咖啡</strong><span id="part-c">。</span><span id="unknown">紫色火车正在月亮上唱歌。</span><span id="water">水</span>';
    document.body.appendChild(fixture);
  });
});

test('shows sentence meaning above expandable vocabulary across nested elements',async({page})=>{
  await selectRange(page,'#part-a',0,'#part-c',1);
  const popup=page.locator('#lookup');
  await expect(popup).toBeVisible();
  await expect(popup.locator('.lookup-meaning')).toContainText('I would like a cup of coffee.');
  await expect(popup.locator('.lookup-source')).toHaveText('我要一杯咖啡。');
  await expect(popup.locator('.lookup-word')).toHaveCount(0);
  await popup.locator('summary').click();
  await expect.poll(()=>popup.locator('.lookup-word').count(),{timeout:20000}).toBeGreaterThan(1);
});

test('shows explicit unavailable and length-limit states without synthesized glosses',async({page})=>{
  await selectRange(page,'#unknown',0,'#unknown',12);
  await expect(page.locator('#lookup .lookup-status')).toContainText('Translation unavailable');
  await expect(page.locator('#lookup .lookup-meaning')).toHaveCount(0);

  await page.evaluate(()=>{document.querySelector('#unknown').textContent='我'.repeat(501);});
  await selectRange(page,'#unknown',0,'#unknown',501);
  await expect(page.locator('#lookup .lookup-status')).toContainText('500');
});

test('closing or replacing a selection prevents stale async content from reappearing',async({page})=>{
  await selectRange(page,'#part-a',0,'#part-b',2);
  await page.keyboard.press('Escape');
  await expect(page.locator('#lookup')).toBeHidden();
  await page.waitForTimeout(100);
  await expect(page.locator('#lookup')).toBeHidden();

  await selectRange(page,'#part-a',0,'#part-b',2);
  await selectRange(page,'#water',0,'#water',1);
  await expect(page.locator('#lookup .lookup-source')).toHaveText('水');
  await expect(page.locator('#lookup .lookup-word')).toHaveCount(1,{timeout:20000});
  await expect(page.locator('#lookup .lookup-save')).toBeVisible();
});
