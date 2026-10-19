// Stable front door, not a credential proxy. A click causes one bounded probe.
import {onRequest as probe} from './quant-status.js';
export async function onRequest({request}) {
  if (request.method !== 'GET') return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});
  const result=await (await probe({request})).json();
  const destination=result.state==='protected'
    ? 'https://8766-ac6a65e93d8d4e6a.monkeycode-ai.online/'
    : 'https://zgland.com/quant-console/?cloud='+result.state+'#cloudTitle';
  return new Response(null,{status:303,headers:{Location:destination,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
