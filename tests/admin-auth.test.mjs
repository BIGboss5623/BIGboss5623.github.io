import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {adminRequest} from '../operations/admin-auth.js';
import {onRequest} from '../functions/_middleware.js';
const sql=new DatabaseSync(':memory:');
sql.exec(readFileSync(new URL('../operations/admin-schema.sql',import.meta.url),'utf8'));
const db={prepare(query){let args=[];return {bind(...a){args=a;return this;},async first(){return sql.prepare(query).get(...args)||null;},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)}};},async all(){return {results:sql.prepare(query).all(...args)};}};},async batch(stmts){sql.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const env={ADMIN_DB:db,ADMIN_PASSWORD:'fixture-only-password',ADMIN_IP_KEY:'fixture-key-not-for-production-0123456789',ASSETS:{fetch:async()=>new Response('PRIVATE-DASHBOARD')}};
const origin='https://zgland.com',ip='192.0.2.10',ip2='192.0.2.11';let clock=1700000000000;const originalNow=Date.now;Date.now=()=>clock;
async function req(path,opts={}){const h=new Headers({'CF-Connecting-IP':opts.ip||ip});if(opts.cookie)h.set('Cookie',opts.cookie);const method=opts.method||'GET';let body;if(method==='POST'){h.set('Origin',opts.origin||origin);h.set('Content-Type','application/x-www-form-urlencoded');body=new URLSearchParams({password:opts.password||''});}return adminRequest({request:new Request(origin+path,{method,headers:h,body}),env:opts.env||env});}
const pass=async(p=ip)=>req('/admin/login',{method:'POST',password:env.ADMIN_PASSWORD,ip:p});
const wrong=async(p=ip)=>req('/admin/login',{method:'POST',password:'bad-test',ip:p});
const cookieOf=r=>r.headers.get('set-cookie').split(';')[0];
try{
assert.equal((await req('/admin/',{env:{}})).status,503);
assert.equal((await req('/admin/')).status,303);
assert.equal((await req('/admin/api/audit')).status,401);
assert.equal((await req('/admin/login')).status,200);
assert.equal((await req('/admin/login',{method:'POST',origin:'https://example.org',password:env.ADMIN_PASSWORD})).status,403);
for(let i=1;i<=19;i++)assert.equal((await wrong()).status,401,'failed attempt '+i);
const last=await wrong();assert.equal(last.status,429);assert.equal(last.headers.get('Retry-After'),'1800');
assert.equal((await req('/admin/')).status,429);
assert.equal((await pass()).status,429);
clock+=60000;assert.equal((await wrong()).headers.get('Retry-After'),'1740');
const other=await pass(ip2);assert.equal(other.status,303);const c2=cookieOf(other);assert.match(other.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Strict/);
assert.equal(await(await req('/admin/',{ip:ip2,cookie:c2})).text(),'PRIVATE-DASHBOARD');
clock+=1740000;assert.equal((await wrong()).status,401);
const good=await pass();assert.equal(good.status,303);const c=cookieOf(good);
assert.equal((await req('/admin/api/audit',{cookie:c})).status,200);
const audit=await(await req('/admin/api/audit',{cookie:c})).json();assert.ok(audit.events.some(e=>e.event==='login_locked'));assert.ok(audit.events.every(e=>!('ip_key' in e)));
assert.equal((await req('/admin/logout',{method:'POST',cookie:c})).status,303);
assert.equal((await req('/admin/api/audit',{cookie:c})).status,401);
for(let i=0;i<19;i++)assert.equal((await wrong()).status,401);
const fresh=await pass();assert.equal(fresh.status,303);assert.equal((await wrong()).status,401);
const c3=cookieOf(fresh);
assert.equal((await req('/admin/api/audit',{cookie:c3,env:{...env,ADMIN_PASSWORD:'rotated-fixture-password'}})).status,401);
clock+=28800000;assert.equal((await req('/admin/api/audit',{cookie:c3})).status,401);
for(const path of ['/admin/','/admin/index.html','/admin/dashboard.v2.js','/admin/api/audit','/ADMIN/','/%61dmin/','/admin%2findex.html','/foo/../admin/']){
 const r=await onRequest({request:new Request(origin+path,{headers:{'CF-Connecting-IP':ip}}),env,next:()=>new Response('PUBLIC-BYPASS')});
 assert.ok([303,401].includes(r.status),path+' '+r.status);
}
for(const u of ['https://admin.zgland.com/','https://www.zgland.com/admin/','https://preview.pages.dev/admin/']){
 const r=await onRequest({request:new Request(u),env,next:()=>new Response('PUBLIC-BYPASS')});assert.equal(r.status,303);assert.equal(r.headers.get('Location'),origin+'/admin/');
}
const publicPage=await onRequest({request:new Request(origin+'/'),env,next:()=>new Response('PUBLIC')});assert.equal(await publicPage.text(),'PUBLIC');
const dbFail={prepare(){throw Error('fixture database down');}};
assert.equal((await req('/admin/',{env:{...env,ADMIN_DB:dbFail}})).status,503);
console.log('PASS: 19/20 attempts, 30-minute fixed lockout, distinct IP, expiry, success reset, secure cookie, logout, rotation, expiry, private audit, same-origin POST, route aliases, public site, fail closed');
}finally{Date.now=originalNow;sql.close();}
