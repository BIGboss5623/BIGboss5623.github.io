// Retired cloud bookmarks return to local-first guidance, without contacting the old host.
export function onRequest({request}) {
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});
 return new Response(null,{status:303,headers:{Location:'https://zgland.com/quant-console/','Cache-Control':'no-store'}});
}
