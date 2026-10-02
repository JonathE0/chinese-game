/** Press 开始旅行 the way a player does, then dismiss the one Roots welcome panel that a brand-new
 *  save gets (src/ui/roots.js openRootsWelcome). It pauses the game and covers the screen, so a
 *  spec about anything else starts here. A save that has met it already gets no panel. */
export async function startGame(page){
  await page.getByRole('button',{name:'开始旅行',exact:true}).click();
  const welcome=page.locator('#roots-welcome-close');
  if(await welcome.isVisible())await welcome.click();
}
