import {test,expect} from '@playwright/test';

test('places change the soundscape and task sounds respect the ambient volume',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
  const result=await page.evaluate(()=>{
    const m=window.__qinghe.music;
    if(typeof m.setPlace!=='function'||typeof m.cue!=='function')return {available:false};
    m.setPlace('cafe');const cafe=m.place;
    m.setPlace('restaurant');const restaurant=m.place;
    m.settings.ambientVolume=0;
    const muted=m.cue('collect');
    m.settings.ambientVolume=.35;
    const audible=m.cue('collect');
    const limited=m.cue('collect');
    return {available:true,cafe,restaurant,muted,audible,limited,filter:m.highpass.type,frequency:m.highpass.frequency.value};
  });
  const {frequency,...rest}=result;
  expect(rest).toEqual({available:true,cafe:'cafe',restaurant:'restaurant',muted:false,audible:true,limited:false,filter:'highpass'});
  // Rumble goes, the bass stays: the corner sits below the lowest note the band plays.
  expect(frequency).toBeGreaterThanOrEqual(40);
  expect(frequency).toBeLessThanOrEqual(160);
});
