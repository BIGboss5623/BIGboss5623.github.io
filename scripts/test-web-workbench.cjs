const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 const {parseCSV,backtest}=await import(pathToFileURL(path.resolve(__dirname,'../fund/workbench/workbench.mjs')));
 assert.deepEqual(parseCSV('\uFEFFdate,nav\n2024-01-03,2\n2024-01-01,1\n2024-01-02,1.5').map(r=>r.price),[1,1.5,2]);
 for(const bad of ['date,nav\n2024-02-30,1\n2024-03-01,2\n2024-03-02,3','date,nav\n2024-01-01,1\n2024-01-01,2\n2024-01-02,3','date,nav\n2024-01-01,Infinity\n2024-01-02,2\n2024-01-03,3','date,nav\n2024-01-01,\n2024-01-02,2\n2024-01-03,3'])assert.throws(()=>parseCSV(bad));
 const rows=Array.from({length:400},(_,i)=>({date:new Date(Date.UTC(2024,0,i+1)).toISOString().slice(0,10),price:100*Math.exp(.0007*i+.09*Math.sin(i/17))}));
 const r=backtest(rows,20,60,.0015);assert.equal(r.equity.length,400);assert.ok(r.orders>1);assert.equal(r.equity[59],1);assert.throws(()=>backtest(rows,60,20,0));
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE);const browser=await chromium.launch({channel:'msedge',headless:true,args:['--no-proxy-server']});
 try{for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url())});
  await page.goto((process.env.BASE_URL||'http://127.0.0.1:8892')+'/fund/workbench/',{waitUntil:'networkidle'});
  assert.equal(await page.locator('#run').isDisabled(),true);await page.click('#demo');await page.click('#run');await page.waitForSelector('#chart svg');assert.match(await page.locator('#message').innerText(),/回测完成/);
  const dl=page.waitForEvent('download');await page.click('#export');assert.equal((await dl).suggestedFilename(),'FundPilot_web_backtest.json');
  await page.click('#save');await page.fill('#fast','10');assert.equal(await page.locator('#export').isDisabled(),true);await page.click('#restore');assert.equal(await page.inputValue('#fast'),'20');
  await page.locator('#file').setInputFiles({name:'invalid.csv',mimeType:'text/csv',buffer:Buffer.from('date,nav\n2024-02-30,1\n2024-03-01,2\n2024-03-02,3')});await page.waitForFunction(()=>document.querySelector('#message').dataset.error==='true');assert.equal(await page.locator('#run').isDisabled(),true);
  await page.locator('#file').setInputFiles({name:'private.csv',mimeType:'text/csv',buffer:Buffer.from('date,nav\n'+rows.map(r=>`${r.date},${r.price}`).join('\n'))});await page.waitForFunction(()=>!document.querySelector('#run').disabled);await page.click('#run');await page.waitForSelector('#chart svg');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);await page.reload();assert.equal(await page.locator('#run').isDisabled(),true);await page.close();
 }console.log('Workbench: CSV, engine invariants, desktop/mobile import, backtest, export, storage and privacy passed');}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
