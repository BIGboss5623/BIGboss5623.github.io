const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
(async () => {
  const source = fs.readFileSync(path.join(root,'functions/api/quant-status.js'),'utf8');
  const api = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const request = new Request('https://zgland.com/api/quant-status');
  let calls=0;global.fetch=async()=>{calls++;throw Error('retired provider must not be contacted')};
  const result=await api.onRequest({request});
  assert.equal(result.status,410);assert.equal((await result.json()).mode,'local');
  assert.equal((await api.onRequest({request:new Request(request.url,{method:'POST'})})).status,405);
  const entry=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(root,'functions/api/quant-enter.js'),'utf8')).toString('base64'));
  const redirect=await entry.onRequest({request:new Request('https://zgland.com/api/quant-enter?target=https://evil.invalid')});
  assert.equal(redirect.status,303);assert.equal(redirect.headers.get('location'),'https://zgland.com/quant-console/');
  assert.equal((await entry.onRequest({request:new Request(request.url,{method:'POST'})})).status,405);
  assert.equal(calls,0);
  for(const file of ['quant-console/index.html','fund/index.html','fund/workbench/index.html']){
    const html=fs.readFileSync(path.join(root,file),'utf8');
    assert(!html.includes('monkeycode-ai.online'));assert(!html.includes('id="activateCloud"'));
  }
  const portal=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const href of ['/fund/','/fund/workbench/','/quant-console/','https://hzct.zgland.com/','/hzyx/','https://feitianshan.zgland.com/','/history-cycle/','/network/','/proxy/','/domain-console/'])assert(portal.includes(href),href);
  assert(portal.includes('<title>ZGLAND'));
  const company=fs.readFileSync(path.join(root,'company-home.html'),'utf8');
  assert(company.includes('创投作品1')&&company.includes('创投作品2'));
  assert(!company.includes('量化研究与重点新闻'));
  console.log('PASS: distinct homepages, directory, retired cloud API, fixed safe redirect, local-first pages and zero provider requests.');
})().catch(error=>{console.error(error);process.exitCode=1});
