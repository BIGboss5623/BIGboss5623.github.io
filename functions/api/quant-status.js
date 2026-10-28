// Authentication-gateway probe only; not authenticated business health.
export async function onRequest({request}) {
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});
 try {
  const result=await fetch('https://quant.zgland.com/healthz',{redirect:'manual',signal:AbortSignal.timeout(8000),headers:{'User-Agent':'Zgland-Service-Probe/1.0','Cache-Control':'no-cache'}});
  const reachable=result.status===401&&(result.headers.get('www-authenticate')||'').includes('FundPilot');
  return Response.json({mode:'self-hosted',gateway_reachable:reachable,business_health:'authentication-required',message:reachable?'登录入口可达；实际数据与回测请登录后核对。':'尚未确认登录入口可达，请检查服务器与隧道。'},{status:reachable?200:503,headers:{'Cache-Control':'no-store'}});
 } catch {
  return Response.json({mode:'self-hosted',gateway_reachable:false,business_health:'unknown',message:'入口检查超时或网络异常，不代表电脑一定关机。'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
