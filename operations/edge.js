// This module only runs in Pages Functions. Never ship environment values to a browser.
const BASE = 'https://quant.zgland.com/site-ops';
const encoder = new TextEncoder();
const hex = bytes => [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');

export async function edgeSecrets(env) {
  if (!env.CLOUDFLARE_API_TOKEN || !env.DOMAIN_CONSOLE_PASSWORD) throw Error('Operations not configured');
  const key = await crypto.subtle.importKey('raw',encoder.encode(env.CLOUDFLARE_API_TOKEN),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const edge_key = hex(await crypto.subtle.sign('HMAC',key,encoder.encode('zgland-site-ops/v1')));
  const domain_digest = hex(await crypto.subtle.digest('SHA-256',encoder.encode(env.DOMAIN_CONSOLE_PASSWORD)));
  return {edge_key,domain_digest};
}

export async function forward(env,route,payload) {
  const {edge_key} = await edgeSecrets(env);
  const key = await crypto.subtle.importKey('raw',Uint8Array.from(edge_key.match(/../g),x=>parseInt(x,16)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const body = JSON.stringify(payload), at = String(Math.floor(Date.now()/1000));
  const signature = hex(await crypto.subtle.sign('HMAC',key,encoder.encode(at+'\n'+body)));
  return fetch(BASE+route,{method:'POST',headers:{'content-type':'application/json','X-Zg-Time':at,'X-Zg-Signature':signature},
    body,redirect:'error',signal:AbortSignal.timeout(12000)});
}

export const publicHeaders = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
export function unavailable() {return Response.json({ok:false,message:'安全验证服务暂不可用，请稍后重试。'},{status:503,headers:publicHeaders});}

export async function checkPassword(request,env,password,service,purpose) {
  if (typeof password !== 'string' || password.length>512) return Response.json({ok:false,message:'密码格式无效'},{status:400,headers:publicHeaders});
  return forward(env,'/verify',{service,password,ip:request.headers.get('CF-Connecting-IP')||'unknown',purpose});
}

export async function boundedJson(request,limit=4096) {
  const reader=request.body?.getReader();if(!reader)throw Error('Missing body');
  const chunks=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;
    if(size>limit){await reader.cancel();throw Error('Request too large');}chunks.push(value);}
  const raw=new Uint8Array(size);let at=0;for(const chunk of chunks){raw.set(chunk,at);at+=chunk.byteLength;}
  return JSON.parse(new TextDecoder().decode(raw));
}
