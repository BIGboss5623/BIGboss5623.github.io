(() => {
  'use strict';
  const button = document.getElementById('enterCloud');
  const box = document.getElementById('cloudStatus');
  const recovery=document.getElementById('wakeCloud');
  const hint=document.getElementById('activationHint');
  let pendingReturn=0;
  const showRecovery=state=>{if(recovery) recovery.hidden=state==='protected';};
  const fromEntry=new URLSearchParams(location.search).get('cloud');
  if (['unavailable','unsafe'].includes(fromEntry)) {
    box.dataset.state=fromEntry;
    document.getElementById('statusTitle').textContent=fromEntry==='unsafe'?'入口认证异常，暂不跳转':'云端暂不可达，不是密码错误';
    document.getElementById('statusMessage').textContent='点击“检查并进入云端”查看当前状态；不可达时转到平台环境管理。不要反复输入密码或重复提交部署。';
    showRecovery(fromEntry);
  }
  async function check() {
    if (button.disabled) return null;
    button.disabled = true;
    button.setAttribute('aria-disabled','true');
    const original = button.textContent;
    button.textContent = '正在检查…';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('/api/quant-status', {signal:controller.signal, cache:'no-store', credentials:'omit'});
      const result = await response.json();
      if (!response.ok || !['protected','unavailable','unsafe'].includes(result.state)) throw new Error('状态接口暂不可用');
      box.dataset.state = result.state;
      showRecovery(result.state);
      document.getElementById('statusTitle').textContent = result.title;
      document.getElementById('statusMessage').textContent = result.message;
      document.getElementById('statusTime').textContent = `检查时间：${new Date(result.checkedAt).toLocaleString()} · 单次检查，不自动保活`;
      return result.state;
    } catch (error) {
      box.dataset.state = 'unavailable';
      showRecovery('unavailable');
      document.getElementById('statusTitle').textContent = '本次检查未完成';
      document.getElementById('statusMessage').textContent = '可能是入口超时或状态服务不可用，不代表数据已经丢失。可尝试直接登录；云端不可用时使用浏览器回测。';
      document.getElementById('statusTime').textContent = `检查时间：${new Date().toLocaleString()} · 未自动重试`;
      return null;
    } finally {
      clearTimeout(timer);
      button.disabled = false;
      button.removeAttribute('aria-disabled');
      button.textContent = original;
    }
  }
  button.addEventListener('click',async event=>{
    event.preventDefault();
    if(button.disabled)return;
    pendingReturn=0;
    // Reserve the tab in the user gesture; never open popups on a status failure alone.
    const tab=window.open('about:blank','_blank');
    if(tab){tab.opener=null;tab.document.body.textContent='正在检查云端入口，请稍候…';}
    {
      const state=await check();
      if(state==='protected'){
        if(tab)tab.location.replace('https://8766-ac6a65e93d8d4e6a.monkeycode-ai.online/');
        else window.location.assign('/api/quant-enter');
        hint.textContent='入口可达，已进入云端工作台。认证通过不代表业务功能全部正常。';
      }else if(state==='unsafe'){
        if(tab)tab.close();
        hint.textContent='认证状态异常，不按休眠处理，也未打开激活页。请先核对服务。';
      }else if(state==='unavailable'){
        showRecovery('unavailable');
        if(tab&&!tab.closed){
          tab.location.replace('https://monkeycode-ai.com/console');
          pendingReturn=Date.now();
          hint.textContent='已打开平台管理，尚未确认恢复成功。配置 → 开发环境 → 显示离线开发环境；返回本站后复查一次。';
        }else{
          hint.textContent='浏览器阻止了新窗口。展开故障说明打开平台管理，完成后再点击同一个入口。';
        }
      }else{
        if(tab)tab.close();
        hint.textContent='状态检查未完成，未跳转。请稍后点击同一个入口重试。';
      }
    }
  });
  async function recheckOnReturn(){
    if(!pendingReturn||document.visibilityState==='hidden'||button.disabled)return;
    const started=pendingReturn;pendingReturn=0;
    if(Date.now()-started>10*60*1000)return;
    const state=await check();
    hint.textContent=state==='protected'?'复查通过，入口已可达。现在可以进入云端工作台。':
      state==='unsafe'?'复查发现认证异常，请核对服务，不要反复激活。':
      '复查仍未可达，可能尚在启动或存在其他故障。稍后手动检查；不会自动重试或宣称激活成功。';
  }
  window.addEventListener('focus',recheckOnReturn);
  document.addEventListener('visibilitychange',recheckOnReturn);
})();
