const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
(async () => {
  const source = fs.readFileSync(path.join(root,'functions/api/quant-status.js'),'utf8');
  const api = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const request = new Request('https://zgland.com/api/quant-status');
  let calls=0;global.fetch=async(url,options)=>{calls++;assert.equal(url,'https://quant.zgland.com/healthz');assert.equal(options.redirect,'manual');return new Response(null,{status:401,headers:{'www-authenticate':'Basic realm="FundPilot isolated trial"'}})};
  const result=await api.onRequest({request});
  assert.equal(result.status,200);assert.equal((await result.json()).mode,'self-hosted');
  assert.equal((await api.onRequest({request:new Request(request.url,{method:'POST'})})).status,405);
  const entry=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(root,'functions/api/quant-enter.js'),'utf8')).toString('base64'));
  const redirect=await entry.onRequest({request:new Request('https://zgland.com/api/quant-enter?target=https://evil.invalid')});
  assert.equal(redirect.status,303);assert.equal(redirect.headers.get('location'),'https://quant.zgland.com/');
  assert.equal((await entry.onRequest({request:new Request(request.url,{method:'POST'})})).status,405);
  assert.equal(calls,1);
  global.fetch=async()=>new Response('unexpected public health',{status:200});
  assert.equal((await api.onRequest({request})).status,503);
  global.fetch=async()=>{throw Error('network unavailable')};
  const unavailable=await api.onRequest({request});
  assert.equal(unavailable.status,503);assert.equal((await unavailable.json()).business_health,'unknown');
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
  const consolePage=fs.readFileSync(path.join(root,'quant-console/index.html'),'utf8');
  assert(consolePage.includes('id="enterServer" href="https://quant.zgland.com/"'));
  assert(!consolePage.includes('<script'));
  console.log('PASS: distinct homepages, fixed private-server redirect, bounded anonymous gateway probe, no secret or retired provider requests, and no automatic page probes.');
})().catch(error=>{console.error(error);process.exitCode=1});
