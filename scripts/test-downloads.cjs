/* Read-only: assembles the three published packages but never installs them. */
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--no-proxy-server']});try{
 const base=process.argv[2]||'http://127.0.0.1:8892/proxy/';
 const manifest=JSON.parse(fs.readFileSync(require('node:path').resolve(__dirname,'../proxy/downloads-manifest.json'),'utf8'));
 for(const [name,expected]of Object.entries(manifest.files)){
  if(process.env.QA_DOWNLOAD_FILES && !JSON.parse(process.env.QA_DOWNLOAD_FILES).includes(name))continue;
  const page=await browser.newPage();await page.addInitScript(()=>{window.savedBlob=null;URL.createObjectURL=blob=>{window.savedBlob=blob;return 'blob:qa-package';};document.addEventListener('click',e=>{if(e.target.closest('a[download]'))e.preventDefault();});});
  await page.goto(base);await page.locator(`[data-base="${name}"]`).click();
  const progress=setInterval(async()=>{try{console.log(name+': '+await page.locator('.assemble-status').nth(Object.keys(manifest.files).indexOf(name)).innerText());}catch{}},15000);
  try{await page.waitForFunction(()=>window.savedBlob || [...document.querySelectorAll('.assemble-status')].some(e=>e.textContent.includes('下载失败')),{},{timeout:300000});}finally{clearInterval(progress);}
  const actual=await page.evaluate(async()=>{if(!window.savedBlob)throw Error([...document.querySelectorAll('.assemble-status')].map(e=>e.textContent).join(';'));const bytes=window.savedBlob.size;const hash=await crypto.subtle.digest('SHA-256',await window.savedBlob.arrayBuffer());return{bytes,sha256:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')};});assert.equal(actual.bytes,expected.bytes);assert.equal(actual.sha256,expected.sha256);console.log('PASS '+name+' '+actual.bytes+' bytes, full SHA-256 matches.');await page.close();
 }}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
