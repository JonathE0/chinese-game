/** Talking to Lin, Xiaomei, Uncle Chen, a waiter or someone in the city opens a small-talk
 *  greeting first (src/ui/social.js). Step past it, and past its question if there is one, to
 *  what the test is about. Harmless where no greeting appears. */
export async function pastGreeting(page){
  const next=page.locator('#social-continue');
  await next.waitFor({timeout:4000}).catch(()=>{});
  if(await next.isVisible())await next.click();
  const skip=page.locator('#social-skip');
  if(await skip.isVisible())await skip.click();
}
