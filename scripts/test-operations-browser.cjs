const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const root=path.resolve(__dirname,'..');
(async()=>{
 const daily=Array.from({length:30},(_,i)=>({day:`2026-10-${String(i+1).padStart(2,'0')}`,pv:i*3,visitors:i}));
 let offline=false;
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');let name=decodeURIComponent(url.pathname);if(name==='/api/site-stats'){res.writeHead(offline?503:200,{'content-type':'application/json'});res.end(JSON.stringify({ok:!offline,today:daily.at(-1),daily,hosts:[{host:'zgland.com',pv:1305}],pages:[{host:'zgland.com',path:'/credentials/',pv:50}],updated_at:'2026-10-31T01:00:00+08:00',first_recorded_day:'2026-10-01'}));return;}
 if(name.endsWith('/'))name+='index.html';const target=path.resolve(root,'.'+name);if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}try{res.setHeader('content-type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(target));}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true});try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [1366,390]){
   await page.setViewportSize({width,height:900});await page.goto(base+'/site-stats/');await page.waitForFunction(()=>document.querySelector('#todayPv').textContent==='87');
   assert.equal(await page.locator('#trend .bar').count(),30);assert.equal(await page.locator('#dailyRows tr').count(),30);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:path.join(process.env.QA_OUTPUT,`网站统计-${width}.png`),fullPage:true});
   await page.goto(base+'/site-blueprint/');assert.equal(await page.locator('section.panel').count(),9);assert(await page.locator('body').textContent().then(x=>x.includes('浏览器本地验证')));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:path.join(process.env.QA_OUTPUT,`建站思路-${width}.png`),fullPage:true});
  }
  await page.goto(base+'/');await page.locator('#siteSearch').fill('建站');assert.equal(await page.locator('.site-card:visible').count(),1);
  await page.locator('.zg-tools summary').click();assert(await page.getByRole('link',{name:'网站访问统计',exact:true}).isVisible());
  offline=true;await page.goto(base+'/site-stats/');await page.waitForSelector('#error:not([hidden])');assert.equal(await page.locator('#todayPv').textContent(),'—');assert.deepEqual(errors,[]);
  console.log('PASS: real browser desktop/mobile stats, chart/table, blueprint 9 sections, no page overflow, directory search, global links, offline does not show zero.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
