// Fixed private server only; caller-supplied redirect targets are ignored.
export function onRequest({request}) {
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});
 return new Response(null,{status:303,headers:{Location:'https://quant.zgland.com/','Cache-Control':'no-store'}});
}
