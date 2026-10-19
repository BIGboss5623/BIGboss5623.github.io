const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
  const code=fs.readFileSync(require('node:path').resolve(__dirname,'../functions/api/domains.js'),'utf8');
  const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const env={CLOUDFLARE_API_TOKEN:'test',CLOUDFLARE_ACCOUNT_ID:'account',CLOUDFLARE_ZONE_ID:'zone',CLOUDFLARE_PAGES_PROJECT:'project',CLOUDFLARE_PAGES_TARGET:'test.pages.dev',DOMAIN_CONSOLE_PASSWORD:'test-only'};
  let calls=[],records=[],domains=[];
  global.fetch=async(url,init={})=>{
    calls.push({url,method:init.method||'GET'});
    const dns=url.includes('/dns_records');
    if(init.method==='POST'){const body=JSON.parse(init.body);if(dns)records=[{id:'dns',...body}];else domains=[{name:body.name,status:'active'}];}
    return Response.json({success:true,result:dns?records:domains});
  };
  async function request(body,status=200){return api.onRequestPost({env:{...env,ASSETS:{fetch:async()=>new Response('page',{status,headers:{'content-type':'text/html'}})}},request:new Request('https://zgland.com/api/domains',{method:'POST',body:JSON.stringify({password:'test-only',hostname:'network.zgland.com',action:'plan',...body})})});}
  assert.equal((await request({password:'wrong'})).status,401);
  assert.equal((await request({hostname:'zgland.com'})).status,400);
  assert.equal((await request({hostname:'*.zgland.com'})).status,400);
  assert.equal((await request({action:'apply'},404)).status,409);assert.equal(calls.length,0);
  assert.equal((await request({})).status,200);assert(calls.every(c=>c.method==='GET'));
  calls=[];records=[{id:'a',type:'A',name:'network.zgland.com',content:'192.0.2.1'}];
  assert.equal((await request({action:'apply'})).status,409);assert(calls.every(c=>c.method==='GET'));
  calls=[];records=[];domains=[];
  const applied=await (await request({action:'apply'})).json();assert.equal(applied.ok,true);assert.equal(applied.changed,true);assert.equal(applied.result.pages.status,'active');assert.equal(calls.filter(c=>c.method==='POST').length,2);
  calls=[];assert.equal((await (await request({action:'apply'})).json()).changed,false);assert(calls.every(c=>c.method==='GET'));
  const middleware=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(require('node:path').resolve(__dirname,'../functions/_middleware.js'),'utf8')).toString('base64'));
  let mapped;
  for(const [url,expected] of [['https://network.zgland.com/','/network/'],['https://network.zgland.com/network/network.js','/network/network.js'],['https://network.zgland.com/api/domains','next'],['https://zgland.com/','next'],['https://www.zgland.com/','next'],['https://hzct.zgland.com/','/company-home.html'],['https://hzct.zgland.com/index.html','/company-home.html'],['https://hzct.zgland.com/assets/images/jimao-poster.jpg','next'],['https://hzct.zgland.com/company.html','next'],['https://fund.zgland.com/','/fund/']]){
    mapped='';await middleware.onRequest({request:new Request(url),next:()=>{mapped='next';return new Response();},env:{ASSETS:{fetch:request=>{mapped=new URL(request.url).pathname;return new Response();}}}});assert.equal(mapped,expected);
  }
  console.log('PASS: password, root/wildcard protection, missing content, plan read-only, conflict, apply, idempotency, routing (mock APIs only).');
})().catch(e=>{console.error(e);process.exitCode=1;});
