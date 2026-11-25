const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const source=fs.readFileSync(path.join(root,'functions/_middleware.js'),'utf8');
 const mw=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const keys=JSON.parse(fs.readFileSync(path.join(root,'scripts/indexnow-hosts.json'),'utf8'));
 async function test(url,expected){
  let actual='';
  await mw.onRequest({request:new Request(url),env:{ASSETS:{fetch:async r=>{actual=new URL(r.url).pathname;return new Response('ok')}}},next:async()=>{actual='NEXT';return new Response('ok')}});
  assert.equal(actual,expected,url+' routing');
 }
 await test('https://zgland.com/sitemap.xml','NEXT');
 await test('https://hzct.zgland.com/sitemap.xml','/sitemap-hzct.xml');
 await test('https://hzct.zgland.com/robots.txt','/robots-hzct.txt');
 await test('https://hzyx.zgland.com/sitemap.xml','/sitemap-hzyx.xml');
 await test('https://hzyx.zgland.com/robots.txt','/robots-hzyx.txt');
 await test('https://hzyx.zgland.com/'+keys['hzyx.zgland.com'].key+'.txt','/hzyx/'+keys['hzyx.zgland.com'].key+'.txt');
 await test('https://hzct.zgland.com/','/company-home');
 await test('https://hzyx.zgland.com/','/hzyx/');
 await test('https://hzyx.zgland.com/api/domains','NEXT');
 console.log('PASS SEO multi-host static asset routing, public key and private API exclusions');
})().catch(e=>{console.error(e);process.exitCode=1});