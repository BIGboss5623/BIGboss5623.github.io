const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const {moveBoard,addTile,gameOver}=await import(pathToFileURL(path.resolve(__dirname,'../games/engine.mjs')));
 const row=values=>values.concat(Array(12).fill(0));
 let result=moveBoard(row([2,2,2,2]),'left');assert.deepEqual(result.grid.slice(0,4),[4,4,0,0]);assert.equal(result.gain,8);
 assert.deepEqual(moveBoard(row([2,2,4,0]),'left').grid.slice(0,4),[4,4,0,0]);
 assert.deepEqual(moveBoard(row([2,2,4,0]),'right').grid.slice(0,4),[0,0,4,4]);
 assert.equal(moveBoard(row([2,0,0,0]),'left').changed,false);
 const vertical=[2,0,0,0,2,0,0,0,4,0,0,0,4,0,0,0];
 result=moveBoard(vertical,'up');assert.equal(result.grid[0],4);assert.equal(result.grid[4],8);assert.equal(result.gain,12);
 assert.equal(moveBoard(vertical,'down').grid[12],8);
 const full=[2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2];assert(gameOver(full));assert.deepEqual(addTile(full),full);
 const source=row([2,0,0,0]);const added=addTile(source,()=>0);assert.equal(added[1],2);assert.equal(source[1],0);
 console.log('PASS game engine: single merge, four directions, scoring, no-op, game-over and immutable spawn.');
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext();
  await context.addInitScript(()=>{Math.random=()=>0;Object.defineProperty(window,'localStorage',{get(){throw Error('Disabled storage')}})});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base=process.argv[2]||'http://127.0.0.1:8892';
  for(const width of [390,1360]){
   await page.setViewportSize({width,height:900});
   assert.equal((await page.goto(base+'/games/?qa=game')).status(),200);
   await page.waitForFunction(()=>document.querySelectorAll('.tile').length===16);
   assert.equal(await page.locator('#score').innerText(),'0');
   await page.locator('[data-direction=left]').click();
   assert.equal(await page.locator('#score').innerText(),'4');
   await page.locator('#undo').click();assert.equal(await page.locator('#score').innerText(),'0');assert(await page.locator('#undo').isDisabled());
   await page.locator('#board').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#score').innerText(),'4');
   await page.locator('#newGame').click();assert.equal(await page.locator('#score').innerText(),'0');
   await page.locator('#board').scrollIntoViewIfNeeded();const area=await page.locator('#board').boundingBox();
   await page.mouse.move(area.x+area.width*.7,area.y+area.height*.5);await page.mouse.down();
   await page.mouse.move(area.x+area.width*.3,area.y+area.height*.5);await page.mouse.up();
   assert.equal(await page.locator('#score').innerText(),'4');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  }
  assert.deepEqual(errors,[]);
  await page.goto(base+'/?qa=game-links');
  assert.equal(await page.locator('.site-card a[href="https://zgland.com/games/"]').count(),1);
  for(const host of ['www.bilibili.com','www.taobao.com','www.zhihu.com']){
   const link=page.locator(`#bookmarks a[href="https://${host}/"]`);assert.equal(await link.count(),1);assert((await link.getAttribute('rel')).includes('noopener'));
  }
  console.log('PASS browser: keyboard, buttons, swipe, undo, reset, disabled storage, mobile/desktop and official external links.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
