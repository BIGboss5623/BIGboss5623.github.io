import {forward,boundedJson} from '../../operations/edge.js';

const allowed=new Set(['zgland.com','www.zgland.com','hzct.zgland.com','feitianshan.zgland.com','network.zgland.com',
  'proxy.zgland.com','hzyx.zgland.com','fund.zgland.com','history-cycle.zgland.com','credentials.zgland.com',
  'local-ai.zgland.com','games.zgland.com','domain-console.zgland.com']);

export async function onRequest({request,env}) {
  const origin=request.headers.get('Origin')||'';
  let host;
  try {const u=new URL(origin);if(u.protocol!=='https:'||u.port||!allowed.has(u.hostname))throw Error();host=u.hostname;}
  catch {return new Response('Forbidden',{status:403});}
  const headers={'Access-Control-Allow-Origin':origin,'Vary':'Origin','Cache-Control':'no-store','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
  if (request.method==='OPTIONS') return new Response(null,{status:204,headers});
  if (request.method!=='POST') return new Response(null,{status:405,headers});
  if (request.headers.get('DNT')==='1'||request.headers.get('Sec-GPC')==='1') return new Response(null,{status:204,headers});
  try {
    const data=await boundedJson(request,1024);
    if (typeof data.path!=='string'||data.path.length>200||!data.path.startsWith('/')||/[?#]/.test(data.path)) return new Response(null,{status:400,headers});
    const response=await forward(env,'/hit',{host,path:data.path,ip:request.headers.get('CF-Connecting-IP')||'unknown',agent:request.headers.get('User-Agent')||''});
    return new Response(null,{status:response.ok?204:503,headers});
  } catch {return new Response(null,{status:503,headers});}
}
