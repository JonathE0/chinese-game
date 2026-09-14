import {test,expect} from '@playwright/test';

test('playlist controls skip smoothly, keep songs across places, and clean up',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.music.currentTrack?.id)).toBeTruthy();
  const first=await page.evaluate(()=>{
    const m=window.__qinghe.music,id=m.currentTrack.id;
    m.setPlace('cafe');m.setPlace('city');return {id,after:m.currentTrack.id};
  });
  expect(first.after).toBe(first.id);
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await expect(page.locator('.music-playlist li')).toHaveCount(5);
  await expect(page.locator('.music-playlist [aria-current]')).toHaveAttribute('data-track',first.id);
  await page.getByRole('button',{name:'下一首 Next track'}).click();
  await expect(page.locator('.music-next')).toBeDisabled();
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.music.currentTrack?.id)).toBeTruthy();
  const second=await page.evaluate(()=>window.__qinghe.music.currentTrack.id);
  expect(second).not.toBe(first.id);
  await expect(page.locator('.music-playlist [aria-current]')).toHaveAttribute('data-track',second);
  // Slider changes must not cancel the independent song fade.
  await page.locator('#music-volume').fill('0');await page.locator('#music-volume').dispatchEvent('input');
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.music.music.gain.value)).toBeLessThan(.001);
  await page.locator('#music-volume').fill('0.5');await page.locator('#music-volume').dispatchEvent('input');
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.music.listeners.size)).toBe(0);
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.music.music.gain.value)).toBeGreaterThan(.3);
  // Audio time stays still while suspended.
  const paused=await page.evaluate(async()=>{const m=window.__qinghe.music;await m.suspend();return {time:m.ctx.currentTime,id:m.currentTrack.id};});
  await page.waitForTimeout(200);
  expect(await page.evaluate(()=>window.__qinghe.music.ctx.currentTime)).toBe(paused.time);
  await page.evaluate(()=>window.__qinghe.music.resume());
  expect(await page.evaluate(()=>window.__qinghe.music.currentTrack.id)).toBe(paused.id);
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.locator('#edit-world').click();
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.music.listeners.size)).toBe(0);
  expect(errors).toEqual([]);
});

test('all five complete scores render audible unclipped audio and fade to silence',async({page})=>{
  await page.goto('/');
  const results=await page.evaluate(async()=>{
    const {default:content}=await import('/src/content/music.json');
    const {compileScore}=await import('/src/core/music-playlist.js');
    const {playNote,songBus}=await import('/src/services/music-instruments.js');
    const results=[];
    for(const track of content.tracks){
      const score=compileScore(track),sampleRate=22050;
      const ctx=new OfflineAudioContext(2,Math.ceil((score.duration+1)*sampleRate),sampleRate);
      const bus=songBus(ctx,ctx.destination,{track,start:0,end:score.duration});
      for(const event of score.events)playNote(ctx,bus.input,event,event.at);
      const buffer=await ctx.startRendering(),data=buffer.getChannelData(0);
      let peak=0,power=0,tail=0;
      for(let i=0;i<data.length;i++){peak=Math.max(peak,Math.abs(data[i]));power+=data[i]**2;if(i>data.length-sampleRate)tail=Math.max(tail,Math.abs(data[i]));}
      results.push({id:track.id,peak,rms:Math.sqrt(power/data.length),tail});bus.disconnect();
    }
    return results;
  });
  expect(results).toHaveLength(5);
  for(const result of results){
    expect(result.peak,result.id).toBeGreaterThan(.02);
    expect(result.peak,result.id).toBeLessThan(.95);
    expect(result.rms,result.id).toBeGreaterThan(.002);
    expect(result.tail,result.id).toBeLessThan(.0001);
  }
});
