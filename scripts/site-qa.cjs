/* Run with PLAYWRIGHT_MODULE pointing to an existing Playwright installation. */
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.argv[2] || 'https://zgland.com';
const pages = process.env.QA_PAGES ? JSON.parse(process.env.QA_PAGES) : ['/', '/about.html', '/company.html', '/contact.html', '/help.html', '/privacy.html', '/network/', '/proxy/', '/hzyx/', '/history-cycle/', '/domain-console/', '/fund/'];
(async () => {
  const browser = await chromium.launch({channel:'msedge', headless:true, args:['--no-proxy-server']});
  const results = [];
  for (const path of pages) {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    const errors = [], failed = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if(r.status() >= 400) failed.push({url:r.url(),status:r.status()}); });
    if (process.env.QA_LOCAL) await page.route('https://zgland.com/assets/js/site-tools*.js*', r => r.fulfill({path:require('node:path').resolve(__dirname,'../assets/js/site-tools.js'),contentType:'application/javascript'}));
    const url = new URL(path, root).href;
    try {
      const start = Date.now();
      const response = await page.goto(url,{waitUntil:'load',timeout:30000});
      await page.waitForTimeout(300);
      const details = await page.evaluate(() => ({title:document.title,overflow:document.documentElement.scrollWidth>innerWidth+2,nav:document.querySelectorAll('.zg-tools').length,brokenImages:[...document.images].filter(i=>i.getAttribute('src') && i.complete && !i.naturalWidth).map(i=>i.getAttribute('src')),resources:performance.getEntriesByType('resource').length,bytes:performance.getEntriesByType('resource').reduce((s,r)=>s+r.transferSize,0),links:[...document.querySelectorAll('a[href]')].map(a=>({text:a.textContent.trim().slice(0,40),href:a.href}))}));
      if(details.nav){await page.locator('.zg-tools summary').click();details.visibleNavLinks=await page.locator('.zg-tools a:visible').count();await page.keyboard.press('Escape');}
      await page.setViewportSize({width:1366,height:900});
      details.desktopOverflow = await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
      results.push({url,status:response.status(),ms:Date.now()-start,...details,errors,failed});
    } catch (e) { results.push({url,error:e.message,errors,failed}); }
    await page.close();
  }
  await browser.close();
  if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(results,null,2));
  console.log(JSON.stringify(results.map(({links,...r})=>r),null,2));
  if(results.some(r=>r.error || r.status!==200 || r.overflow || r.desktopOverflow || (r.nav && r.visibleNavLinks!==12) || r.errors.length || r.brokenImages.length || r.failed.some(f=>new URL(f.url).origin===new URL(r.url).origin)))process.exitCode=1;
})();
