export async function onRequest({request}) {
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
  try {
    const response=await fetch('https://quant.zgland.com/site-ops/stats',{redirect:'error',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error();
    return new Response(request.method==='HEAD'?null:response.body,{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff'}});
  }catch{return Response.json({ok:false,message:'统计服务器暂时离线，请稍后刷新。'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
