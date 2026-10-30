export async function onRequest({request}) {
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
  try {
    const response=await fetch('https://quant.zgland.com/site-ops/stats',{headers:{'User-Agent':'ZGLAND-Operations/1.0'},redirect:'error',signal:AbortSignal.timeout(8000)});
    if(!response.ok)return Response.json({ok:false,message:'统计服务器暂时离线，请稍后刷新。',upstream_status:response.status},{status:503,headers:{'Cache-Control':'no-store'}});
    return new Response(request.method==='HEAD'?null:response.body,{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff'}});
  }catch(error){return Response.json({ok:false,message:'统计服务器暂时离线，请稍后刷新。',diagnostic:String(error?.message||'fetch failed').slice(0,120)},{status:503,headers:{'Cache-Control':'no-store'}});}
}
