const DOMAIN='zgland.com';
const RDAP=`https://rdap.verisign.com/com/v1/domain/${DOMAIN}`;
const EDIT='https://github.com/BIGboss5623/BIGboss5623.github.io/edit/main/config/domain-expiry.json';
const DAY=86400000;

export function expiryDate(value) {
  if(typeof value!=='string')return null;
  if(/^\d{4}-\d{2}-\d{2}$/.test(value)){
    const d=new Date(value+'T00:00:00Z');
    if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)return null;
    return new Date(value+'T23:59:59+08:00');
  }
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value))return null;
  const d=new Date(value);
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value.slice(0,10)?d:null;
}

function localDate(d){return new Date(d.getTime()+8*3600000).toISOString().slice(0,10);}
export function remainingDays(expires,now=new Date()){
  return Math.round((Date.parse(localDate(expires)+'T00:00:00Z')-Date.parse(localDate(now)+'T00:00:00Z'))/DAY);
}

function json(body,status=200,head=false){
  return new Response(head?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','allow':'GET, HEAD'}});
}

export async function onRequest({request,env}){
  const head=request.method==='HEAD';
  if(!['GET','HEAD'].includes(request.method))return json({ok:false,message:'只提供只读查询；日期更新使用已有GitHub账户。'},405);
  const now=new Date();let config={},warning='',snapshot=null;
  try{
    const response=await env.ASSETS.fetch(new Request(new URL('/config/domain-expiry.json',request.url)));
    if(!response.ok)throw new Error('missing configuration');
    config=await response.json();
    if(config.domain!==DOMAIN)throw new Error('wrong domain');
  }catch{
    config={};warning='备用日期配置不可用。';
  }
  if(config.manual_expiry_date!=null){
    const manual=expiryDate(config.manual_expiry_date);
    if(manual)snapshot={expires:manual,source_kind:'manual',source_label:'手动设定',checked_at:null,verified:false};
    else warning='手动日期无效，当前尝试读取注册局。';
  }
  if(!snapshot){
    try{
      const response=await fetch(RDAP,{headers:{accept:'application/rdap+json'},signal:AbortSignal.timeout(6000)});
      if(!response.ok)throw new Error('registry unavailable');
      const payload=await response.json();
      if(String(payload.ldhName||'').toLowerCase()!==DOMAIN)throw new Error('wrong domain response');
      const expires=expiryDate((payload.events||[]).find(e=>e.eventAction==='expiration')?.eventDate);
      if(!expires)throw new Error('no valid expiration');
      snapshot={expires,source_kind:'registry',source_label:'注册局实时查询',checked_at:now.toISOString(),verified:true};
    }catch{
      const expires=expiryDate(config.last_verified_expiry_at);
      if(expires)snapshot={expires,source_kind:'snapshot',source_label:'上次核验日期',checked_at:expiryDate(config.last_verified_on)?.toISOString()||null,verified:false};
      warning='注册局暂时无法查询；备用日期可能未包含最近续费，请稍后刷新或核对注册商。';
    }
  }
  if(!snapshot)return json({ok:false,domain:DOMAIN,message:'暂时无法取得到期日，请登录注册商核对。',edit_url:EDIT},503,head);
  const days=remainingDays(snapshot.expires,now);
  return json({ok:true,domain:DOMAIN,expires_at:snapshot.expires.toISOString(),expiry_date:localDate(snapshot.expires),days_remaining:days,status:days<0?'expired':days===0?'today':days<=30?'urgent':days<=60?'soon':'healthy',source_kind:snapshot.source_kind,source_label:snapshot.source_label,verified:snapshot.verified,checked_at:snapshot.checked_at,served_at:now.toISOString(),time_zone:'Asia/Shanghai',warning,edit_url:EDIT,registry_url:RDAP},200,head);
}
