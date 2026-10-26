const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:8892';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage(),errors=[],remote=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('monkeycode')||r.url().includes('/api/quant-status'))remote.push(r.url())});
 await page.goto(base+'/fund/',{waitUntil:'domcontentloaded'});await page.waitForSelector('#equity svg');
 assert.equal(await page.locator('#equity polyline').count(),1);
 assert((await page.locator('#localWorkspace').innerText()).includes('本地'));
 for(const width of [1360,390]){
  await page.setViewportSize({width,height:900});
  for(const id of await page.locator('#asset option').evaluateAll(es=>es.map(e=>e.value))){
   await page.locator('#asset').selectOption(id);await page.waitForSelector('#equity polyline');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+3),false);
  }
  await page.locator('#showStrategy').check();await page.locator('#range').selectOption('1');
  assert.equal(await page.locator('#equity polyline').count(),2);
  const first=await page.locator('#equity polyline').evaluateAll(es=>es.map(e=>e.getAttribute('points').split(' ')[0]));assert.equal(first[0],first[1]);
  assert((await page.locator('#chartPeriod').innerText()).includes('起点统一为1'));
  if(width>600)await page.locator('nav a[href="#strategies"]').click();
  else {const panel=page.locator('details').filter({has:page.locator('#strategies')});if(await panel.getAttribute('open')===null)await panel.locator(':scope > summary').click();}
  assert(await page.locator('#strategies').isVisible());
  await page.locator('#showStrategy').uncheck();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 console.log('PASS: public snapshots, 3 assets, local-first links, one default curve, normalized comparison, collapsed research navigation, desktop/mobile and no retired host requests.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
