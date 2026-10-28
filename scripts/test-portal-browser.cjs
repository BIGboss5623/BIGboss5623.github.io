const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:8892';
const live = base.startsWith('https:');
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    if (!live) await context.route('https://zgland.com/assets/js/site-tools*.js*',route=>route.fulfill({path:path.resolve(__dirname,'../assets/js/site-tools.js'),contentType:'application/javascript'}));
    for (const width of [1360,390]) {
      await page.setViewportSize({width,height:900});
      assert.equal((await page.goto(base+'/?qa=portal')).status(),200);
      await page.waitForFunction(()=>document.getElementById('siteCount').textContent.includes('12'));
      assert.equal(await page.locator('.site-card:visible').count(),12);
      await page.locator('#siteSearch').fill('创投');
      assert.equal(await page.locator('.site-card:visible').count(),1);
      await page.locator('#siteSearch').press('Escape');
      await page.locator('[data-filter=research]').click();
      assert.equal(await page.locator('.site-card:visible').count(),4);
      await page.locator('#siteSearch').fill('not-found-qa');
      assert.equal(await page.locator('#emptySites').isVisible(),true);
      await page.locator('#siteSearch').fill('');
      await page.locator('[data-filter=all]').click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
      if (process.env.QA_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,`portal-${live?'live':'local'}-${width}.png`),fullPage:true});
      const companyUrl = live ? 'https://hzct.zgland.com/' : base+'/company-home.html';
      assert.equal((await page.goto(companyUrl)).status(),200);
      assert((await page.title()).includes('杭州创投'));
      assert.equal(await page.locator('.work-evidence-grid img, .work-evidence img').count()>0 || await page.getByText('创投作品1 · 协拍人员',{exact:true}).count()>0,true);
      assert.equal(await page.getByText('量化研究与重点新闻',{exact:true}).count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
      const companyImages = await page.locator('img[src*="chuangtou-work-"]').evaluateAll(images=>images.map(image=>image.getAttribute('src')));
      assert.equal(companyImages.length,2);
    }
    const remote=[];page.on('request',r=>{if(r.url().includes('monkeycode')||r.url().includes('/api/quant-status'))remote.push(r.url())});
    await page.goto(base+'/quant-console/');
    assert.equal(await page.locator('#enterLocal').getAttribute('href'),'http://127.0.0.1:8765/');
    assert.equal(await page.locator('#activateCloud,#enterCloud,#checkCloud').count(),0);
    assert((await page.locator('body').textContent()).includes('原环境和原有备份文件均未删除'));
    assert.equal(await page.locator('#enterServer').getAttribute('href'),'https://quant.zgland.com/');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,`quant-console-${live?'live':'local'}-390.png`),fullPage:true});
    assert.deepEqual(remote,[]);
    assert.deepEqual(errors,[]);
    await context.close();
    console.log('PASS: portal search/category/empty/reset, company content, desktop/mobile, private server and local fallback entries, no automatic probes.');
  } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
