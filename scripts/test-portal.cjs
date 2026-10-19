const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
(async () => {
  const source = fs.readFileSync(path.join(root,'functions/api/quant-status.js'),'utf8');
  const api = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const request = new Request('https://zgland.com/api/quant-status');
  let calls = 0;
  for (const [status,realm,state] of [[401,'Basic realm="FundPilot isolated trial"','protected'],[401,'Basic realm="Different app"','unavailable'],[200,'','unsafe'],[302,'','unavailable'],[503,'','unavailable']]) {
    global.fetch = async (url,init) => {
      calls++;
      assert.equal(url,'https://8766-ac6a65e93d8d4e6a.monkeycode-ai.online/healthz');
      assert.equal(init.redirect,'manual');
      assert.equal(init.method,'GET');
      assert.equal(Object.keys(init.headers).some(key=>key.toLowerCase()==='authorization'),false);
      return new Response('not forwarded',{status,headers:{'www-authenticate':realm}});
    };
    const response = await api.onRequest({request});
    const body = await response.json();
    assert.equal(body.state,state);
    assert.equal(body.permanentHostingVerified,false);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal(JSON.stringify(body).includes('not forwarded'),false);
  }
  global.fetch = async () => {throw Error('private provider details must not leak')};
  const unavailable = await (await api.onRequest({request})).json();
  assert.equal(unavailable.state,'unavailable');
  assert.equal(JSON.stringify(unavailable).includes('private provider'),false);
  assert.equal((await api.onRequest({request:new Request(request.url,{method:'POST'})})).status,405);
  assert.equal(calls,5);
  const entrySource=fs.readFileSync(path.join(root,'functions/api/quant-enter.js'),'utf8').replace("'./quant-status.js'",JSON.stringify('data:text/javascript;base64,'+Buffer.from(source).toString('base64')));
  const entry=await import('data:text/javascript;base64,'+Buffer.from(entrySource).toString('base64'));
  for(const [status,realm,expected] of [[401,'Basic realm="FundPilot isolated trial"','https://8766-ac6a65e93d8d4e6a.monkeycode-ai.online/'],[503,'','https://zgland.com/quant-console/?cloud=unavailable#cloudTitle'],[200,'','https://zgland.com/quant-console/?cloud=unsafe#cloudTitle']]){
    global.fetch=async()=>new Response('',{status,headers:{'www-authenticate':realm}});
    const result=await entry.onRequest({request:new Request('https://zgland.com/api/quant-enter?target=https://evil.invalid')});
    assert.equal(result.status,303);assert.equal(result.headers.get('location'),expected);
    assert.equal(result.headers.get('cache-control'),'no-store');
  }
  assert.equal((await entry.onRequest({request:new Request('https://zgland.com/api/quant-enter',{method:'POST'})})).status,405);
  const portal=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const href of ['/fund/','/fund/workbench/','/quant-console/','https://hzct.zgland.com/','/hzyx/','https://feitianshan.zgland.com/','/history-cycle/','/network/','/proxy/','/domain-console/'])assert(portal.includes(href),href);
  assert(portal.includes('<title>ZGLAND'));
  const company=fs.readFileSync(path.join(root,'company-home.html'),'utf8');
  assert(company.includes('创投作品1')&&company.includes('创投作品2'));
  assert(!company.includes('量化研究与重点新闻'));
  console.log('PASS: distinct homepages, complete directory, bounded fixed probe, auth challenge, unsafe/unavailable states, no private response forwarding, read-only API.');
})().catch(error=>{console.error(error);process.exitCode=1});
