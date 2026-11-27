// Server-side authentication. Never include secrets in source.
const HOST='zgland.com', COOKIE='__Host-zgland_admin', TTL=300*86400, AUDIT_TTL=365*86400;
const enc=new TextEncoder(), now=()=>Math.floor(Date.now()/1000);
const hex=a=>Array.from(new Uint8Array(a),b=>b.toString(16).padStart(2,'0')).join('');
async function hash(s){return hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));}
async function mac(key,s){const k=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,enc.encode(s)));}
async function same(a,b){const x=await hash(a),y=await hash(b);let d=0;for(let i=0;i<x.length;i++)d|=x.charCodeAt(i)^y.charCodeAt(i);return d===0;}
const headers={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"};
function response(body,status=200,extra={}){return new Response(body,{status,headers:{...headers,'Content-Type':'text/html; charset=utf-8',...extra}});}
function json(body,status=200){return Response.json(body,{status,headers});}
function redirect(path,extra={}){return response(null,303,{Location:path,...extra});}
function cookie(value,maxAge){return COOKIE+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+maxAge;}
function loginPage(message='',status=200){return response('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ZGLAND 管理员登录</title><style>body{margin:0;background:#eef3f9;color:#172b43;font:16px system-ui,sans-serif;min-height:100vh;display:grid;place-items:center}main{width:min(390px,calc(100% - 64px));background:white;padding:30px;border:1px solid #dce5ef;border-radius:16px;box-shadow:0 12px 40px #14263d18}h1{font-size:26px;margin:12px 0}p{color:#52687e;line-height:1.6}label{display:block;margin:22px 0 8px}input,button{box-sizing:border-box;width:100%;padding:13px;border-radius:8px;font:inherit}input{border:1px solid #bacbdd}button{margin-top:14px;background:#205da7;color:white;border:0;cursor:pointer}a{color:#205da7}small{color:#52687e}.brand{font-size:13px;font-weight:700;letter-spacing:.15em;color:#205da7}</style><main><div class="brand">ZGLAND ADMIN / V2</div><h1>站长管理中心</h1><p>请验证管理员身份。</p>'+(message?'<p role="alert">'+message+'</p>':'')+'<form method="post" action="/admin/login"><label for="password">管理员密码</label><input id="password" name="password" type="password" required maxlength="256" autocomplete="current-password"><button type="submit">安全登录</button></form><p><small>同一 IP 连续 20 次失败后限制 30 分钟。会话有效期 300 天。</small></p><a href="/">返回主站</a></main></html>',status);}
function locked(until,t){return response('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>暂时限制访问</title><h1>管理中心暂时限制访问</h1><p>当前网络地址登录失败次数过多。请在限制期结束后再试。</p><a href="/">返回主站</a></html>',429,{'Retry-After':String(Math.max(1,until-t))});}
function configured(env){return !!env.ADMIN_DB&&typeof env.ADMIN_PASSWORD==='string'&&env.ADMIN_PASSWORD.length>=10&&typeof env.ADMIN_IP_KEY==='string'&&env.ADMIN_IP_KEY.length>=32;}
function sessionToken(request){const raw=request.headers.get('Cookie')||'';const value=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';return /^[a-f0-9]{64}$/.test(value)?value:null;}
function newToken(){return hex(crypto.getRandomValues(new Uint8Array(32)));}
async function sessionHash(env,token){return mac(env.ADMIN_IP_KEY,'session:'+await hash(env.ADMIN_PASSWORD)+':'+token);}
const LOCK_SQL='SELECT locked_until FROM admin_attempts WHERE ip_key=? AND locked_until>?';
const FAILURE_SQL='INSERT INTO admin_attempts(ip_key,failures,locked_until,updated_at) VALUES(?1,1,0,?2) ON CONFLICT(ip_key) DO UPDATE SET failures=CASE WHEN locked_until>?2 THEN failures WHEN locked_until>0 THEN 1 ELSE MIN(failures+1,20) END, locked_until=CASE WHEN locked_until>?2 THEN locked_until WHEN locked_until>0 THEN 0 WHEN failures+1>=20 THEN ?2+1800 ELSE 0 END, updated_at=CASE WHEN locked_until>?2 THEN updated_at ELSE ?2 END RETURNING failures,locked_until';
async function limitedBody(request){if(Number(request.headers.get('Content-Length')||0)>2048)throw Error('size');const reader=request.body?.getReader();if(!reader)return '';let total=0,parts=[];while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>2048){await reader.cancel();throw Error('size');}parts.push(value);}const bytes=new Uint8Array(total);let off=0;for(const p of parts){bytes.set(p,off);off+=p.length;}return new TextDecoder().decode(bytes);}
function locationFields(request,ip){const clean=v=>typeof v==='string'?v.trim().slice(0,100):'';const cf=request.cf||{};return [ip.trim(),clean(cf.country),clean(cf.region),clean(cf.city)];}
async function audit(db,t,event,ip,geo){await db.prepare('INSERT INTO admin_audit(created_at,event,ip_key,ip_address,country,region,city) VALUES(?,?,?,?,?,?,?)').bind(t,event,ip,...geo).run();}
async function getSession(db,env,request,t){const tok=sessionToken(request);if(!tok)return null;const digest=await sessionHash(env,tok);const row=await db.prepare('SELECT token_hash FROM admin_sessions WHERE token_hash=? AND expires_at>?').bind(digest,t).first();return row?digest:null;}
async function checkService(url,checkJson=false){try{const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(6000),headers:{'Accept':'application/json'}});let ok=r.ok;if(checkJson&&ok){const d=await r.json();ok=d.ok===true;}return {http:r.status,ok};}catch{return {http:null,ok:false};}}
export async function adminRequest(context){
 const {request,env}=context;const url=new URL(request.url),method=request.method;
 if(url.hostname!==HOST)return redirect('https://'+HOST+'/admin/');
 if(!configured(env))return response('<!doctype html><meta charset="utf-8"><h1>管理中心暂未启用</h1><p>服务端认证配置尚未完成，请联系站主。</p><a href="/">返回主站</a>',503);
 const ip=request.headers.get('CF-Connecting-IP');
 if(!ip||ip.length>64)return response('无法核验请求来源',403);
 const db=env.ADMIN_DB,t=now(),ipKey=await mac(env.ADMIN_IP_KEY,'ip:'+ip.trim().toLowerCase());
 const path=url.pathname, geo=locationFields(request,ip);
 try{
  const lock=await db.prepare(LOCK_SQL).bind(ipKey,t).first();
  if(lock)return locked(lock.locked_until,t);
  if(method==='POST'){
   if(request.headers.get('Origin')!==url.origin)return response('请求来源不匹配',403);
   if(path==='/admin/login'){
    if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/x-www-form-urlencoded'))return response('请求格式不正确',415);
    let password;try{password=new URLSearchParams(await limitedBody(request)).get('password');}catch{return response('请求过大',413);}
    if(typeof password!=='string'||password.length>256)return response('请求格式不正确',400);
    if(!await same(password,env.ADMIN_PASSWORD)){
     const row=await db.prepare(FAILURE_SQL).bind(ipKey,t).first();
     await audit(db,t,row.locked_until>t?'login_locked':'login_failed',ipKey,geo);
     if(row.locked_until>t)return locked(row.locked_until,t);
     return loginPage('密码不正确。',401);
    }
    const token=newToken(),digest=await sessionHash(env,token);
    const results=await db.batch([
     db.prepare('INSERT INTO admin_sessions(token_hash,expires_at,created_at) SELECT ?1,?2,?3 WHERE NOT EXISTS(SELECT 1 FROM admin_attempts WHERE ip_key=?4 AND locked_until>?3)').bind(digest,t+TTL,t,ipKey),
     db.prepare('DELETE FROM admin_attempts WHERE ip_key=? AND locked_until<=?').bind(ipKey,t),
     db.prepare("INSERT INTO admin_audit(created_at,event,ip_key,ip_address,country,region,city) SELECT ?1,'login_success',?2,?4,?5,?6,?7 WHERE EXISTS(SELECT 1 FROM admin_sessions WHERE token_hash=?3)").bind(t,ipKey,digest,...geo),
     db.prepare('DELETE FROM admin_sessions WHERE expires_at<=?').bind(t),
     db.prepare('DELETE FROM admin_attempts WHERE updated_at<? AND locked_until<=?').bind(t-30*86400,t),
     db.prepare('DELETE FROM admin_audit WHERE created_at<?').bind(t-AUDIT_TTL)
    ]);
    if(results[0].meta.changes!==1){const blocked=await db.prepare(LOCK_SQL).bind(ipKey,t).first();return blocked?locked(blocked.locked_until,t):response('请重新登录',409);}
    return redirect('/admin/',{'Set-Cookie':cookie(token,TTL)});
   }
   if(path==='/admin/logout'){
    const digest=await getSession(db,env,request,t);
    if(digest){await db.batch([db.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(digest),db.prepare('INSERT INTO admin_audit(created_at,event,ip_key,ip_address,country,region,city) VALUES(?,?,?,?,?,?,?)').bind(t,'logout',ipKey,...geo)]);}
    return redirect('/admin/login',{'Set-Cookie':cookie('',0)});
   }
   return response('不支持的操作',405);
  }
  if(method!=='GET'&&method!=='HEAD')return response('不支持的操作',405);
  const session=await getSession(db,env,request,t);
  if(path==='/admin/login')return session?redirect('/admin/'):loginPage();
  if(!session)return path.startsWith('/admin/api/')?json({ok:false},401):redirect('/admin/login');
  if(path==='/admin/api/status'){
    const [stats,quant]=await Promise.all([checkService('https://zgland.com/api/site-stats',true),checkService('https://quant.zgland.com/healthz')]);
    return json({ok:true,checked_at:new Date().toISOString(),stats,quant});
  }
  if(path==='/admin/api/audit'){
   const rows=await db.prepare('SELECT created_at,event,ip_address,country,region,city FROM admin_audit WHERE created_at>=? ORDER BY id DESC LIMIT 100').bind(t-AUDIT_TTL).all();
   return json({ok:true,events:rows.results});
  }
  if(path==='/admin')return redirect('/admin/');
  const asset=await env.ASSETS.fetch(request);
  const h=new Headers(asset.headers);for(const [k,v] of Object.entries(headers))h.set(k,v);
  return new Response(asset.body,{status:asset.status,headers:h});
 }catch{return response('<!doctype html><meta charset="utf-8"><h1>管理服务暂不可用</h1><p>身份验证或数据库连接异常。为安全起见，未开放管理功能。</p>',503);}
}
export {FAILURE_SQL,LOCK_SQL};
