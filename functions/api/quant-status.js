// A fixed, anonymous, read-only probe. No proxy target or credentials from clients.
const TARGET = 'https://8766-ac6a65e93d8d4e6a.monkeycode-ai.online/healthz';
const expectedRealm = 'FundPilot isolated trial';

async function checkStatus() {
  let state = 'unavailable';
  let title = '云端入口暂不可用';
  let message = '可能正在休眠、已停止或地址发生变化。此结果不代表数据丢失；可以使用公开研究台和浏览器回测。';
  try {
    const response = await fetch(TARGET, {
      method:'GET', redirect:'manual', signal:AbortSignal.timeout(8000),
      headers:{'Cache-Control':'no-cache'}, cf:{cacheTtl:0},
    });
    const challenge = response.headers.get('www-authenticate') || '';
    if (response.status === 401 && challenge.includes(expectedRealm)) {
      state = 'protected';
      title = '入口可达，认证保护生效';
      message = '服务返回了预期的登录挑战。仍需登录后验证更新与回测；这不代表长期托管或重启恢复已验收。';
    } else if (response.status === 200) {
      state = 'unsafe';
      title = '认证状态异常，请先核对';
      message = '预期应拒绝匿名访问，但入口返回了成功响应。请先核对认证保护，不要提交私人数据。';
    }
    if (response.body) await response.body.cancel();
  } catch { /* Return a bounded, non-sensitive result; never log credentials. */ }
  return Response.json({state,title,message,checkedAt:new Date().toISOString(),hosting:'free-trial',permanentHostingVerified:false}, {
    headers:{'cache-control':'no-store','x-content-type-options':'nosniff'},
  });
}

export function onRequest({request}) {
  if (request.method === 'GET') return checkStatus();
  return new Response('Method not allowed', {status:405,headers:{Allow:'GET','Cache-Control':'no-store'}});
}
