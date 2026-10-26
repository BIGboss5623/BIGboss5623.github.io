// This site no longer uses the third-party development environment.
export function onRequest({request}) {
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});
 return Response.json({mode:'local',retired:true,message:'云端入口已停用，请使用本地程序或公开研究快照。'},{status:410,headers:{'Cache-Control':'no-store'}});
}
