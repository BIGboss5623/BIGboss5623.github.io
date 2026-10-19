const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();
  let state='protected',calls=0;
  await page.route('http://activation.test/**',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/quant-status'){
    calls++;return route.fulfill({json:{state,title:'Test '+state,message:'Mock status',checkedAt:new Date().toISOString()}});
   }
   const file=path.join(root,url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname);
   if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({path:file,contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/plain'});
  });
  await page.addInitScript(()=>{
   window.popupBlocked=false;window.popupEvents=[];
   window.open=()=>{
    if(window.popupBlocked)return null;
    const tab={opener:window,closed:false,document:{body:{}},location:{replace:url=>window.popupEvents.push(url)},close(){this.closed=true;window.popupEvents.push('closed')}};
    return tab;
   };
  });
  await page.goto('http://activation.test/quant-console/');
  assert.equal(calls,0);
  await page.locator('#activateCloud').click();
  await page.waitForFunction(()=>document.querySelector('#activationHint').textContent.includes('无需激活'));
  assert.equal(calls,1);assert.deepEqual(await page.evaluate(()=>popupEvents),['closed']);
  state='unavailable';
  await page.locator('#activateCloud').click();
  await page.waitForFunction(()=>document.querySelector('#activationHint').textContent.includes('尚未确认激活成功'));
  assert.equal(calls,2);
  assert((await page.evaluate(()=>popupEvents.at(-1))).startsWith('https://monkeycode-ai.com/console/task/'));
  state='protected';
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>document.querySelector('#activationHint').textContent.includes('复查通过'));
  assert.equal(calls,3);
  await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'))});
  assert.equal(calls,3);
  state='unsafe';
  await page.locator('#activateCloud').click();
  await page.waitForFunction(()=>document.querySelector('#activationHint').textContent.includes('未打开激活页'));
  assert.equal(calls,4);
  state='unavailable';await page.evaluate(()=>window.popupBlocked=true);
  await page.locator('#activateCloud').click();
  await page.waitForFunction(()=>document.querySelector('#activationHint').textContent.includes('阻止了新窗口'));
  assert.equal(calls,5);
  for(const width of [390,1360]){
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  }
  console.log('PASS: activation precheck, already available, unsafe refusal, wake navigation, single return recheck, popup-block fallback, mobile layout; platform wake is mocked.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
