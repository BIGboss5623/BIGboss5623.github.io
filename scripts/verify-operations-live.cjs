// Reads public pages and records a small number of our own acceptance visits.
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZGLAND-Verification/1.0'});
  const page=await context.newPage(),visits=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',response=>{if(response.url().includes('/api/visit'))visits.push({url:response.url(),status:response.status()});});
  for(const [url,expected] of [['https://zgland.com/site-stats/','网站访问统计'],['https://zgland.com/site-blueprint/','建站思路'],['https://feitianshan.zgland.com/','飞天山']]){
   const response=await page.goto(url+'?rev=6009ade',{waitUntil:'networkidle',timeout:30000});assert.equal(response.status(),200);
   await page.locator('.zg-tools summary').click();assert(await page.getByRole('link',{name:'网站访问统计',exact:true}).isVisible());assert(await page.getByRole('link',{name:'建站思路与恢复蓝图',exact:true}).isVisible());
   await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.goto('https://zgland.com/site-stats/?rev=6009ade',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#todayPv').textContent!=='—');
  assert(await page.locator('#error').isHidden());
  await page.screenshot({path:path.join(process.env.QA_OUTPUT,'网站统计-公网手机.png'),fullPage:true});
  assert(visits.length>=3 && visits.every(v=>v.status===204),JSON.stringify(visits));assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,public_pages:3,real_acceptance_visits:visits.length,beacon_statuses:visits.map(v=>v.status),mobile_overflow:false,stats_live:true,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
