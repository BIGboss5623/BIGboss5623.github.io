const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage(),requests=[];
 await page.route('http://activation.test/**',route=>{
  const url=new URL(route.request().url()),file=path.join(__dirname,'..',url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname);
  if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
  return route.fulfill({path:file,contentType:file.endsWith('.css')?'text/css':'text/html'});
 });
 page.on('request',r=>{if(r.url().includes('monkeycode')||r.url().includes('/api/quant-status'))requests.push(r.url())});
 await page.goto('http://activation.test/quant-console/');
 for(const width of [390,1360]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);}
 assert.equal(await page.locator('#activateCloud,#enterCloud,#checkCloud').count(),0);
 assert.equal(await page.locator('#enterLocal').getAttribute('href'),'http://127.0.0.1:8765/');
 assert.deepEqual(requests,[]);console.log('PASS: local-first entry, no activation/probes/provider links, mobile/desktop layout.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
