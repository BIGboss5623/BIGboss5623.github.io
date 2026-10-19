(() => {
  'use strict';
  const button = document.getElementById('checkCloud');
  const box = document.getElementById('cloudStatus');
  const recovery=document.getElementById('wakeCloud');
  const activate=document.getElementById('activateCloud');
  const hint=document.getElementById('activationHint');
  let pendingReturn=0;
  const showRecovery=state=>{if(recovery) recovery.hidden=state==='protected';};
  const fromEntry=new URLSearchParams(location.search).get('cloud');
  if (['unavailable','unsafe'].includes(fromEntry)) {
    box.dataset.state=fromEntry;
    document.getElementById('statusTitle').textContent=fromEntry==='unsafe'?'入口认证异常，暂不跳转':'云端暂不可达，不是密码错误';
    document.getElementById('statusMessage').textContent='先打开下方平台任务唤醒环境，再回到此页点击“检查入口状态”。不要反复输入密码或重复提交部署。';
    showRecovery(fromEntry);
  }
  async function check() {
    if (button.disabled) return null;
    button.disabled = true;
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
      button.textContent = original;
    }
  }
  button.addEventListener('click',check);
  activate.addEventListener('click',async()=>{
    if(button.disabled||activate.disabled)return;
    pendingReturn=0;
    // Reserve the tab in the user gesture; never open popups on a status failure alone.
    const tab=window.open('about:blank','_blank');
    if(tab){tab.opener=null;tab.document.body.textContent='正在检查云端入口，请稍候…';}
    activate.disabled=true;
    try{
      const state=await check();
      if(state==='protected'){
        if(tab)tab.close();
        hint.textContent='入口已可达，无需激活。点击“进入云端工作台”即可。';
      }else if(state==='unsafe'){
        if(tab)tab.close();
        hint.textContent='认证状态异常，不按休眠处理，也未打开激活页。请先核对服务。';
      }else{
        showRecovery('unavailable');
        if(tab&&!tab.closed){
          tab.location.replace('https://monkeycode-ai.com/console/task/f18292a4-3b01-4eeb-8297-5cac31c02457');
          pendingReturn=Date.now();
          hint.textContent='已打开平台唤醒页，尚未确认激活成功。需要时先登录平台；返回本站后自动复查一次。';
        }else{
          hint.textContent='浏览器阻止了新窗口。请点击下方“打开原任务 / 唤醒环境”，完成后手动检查状态。';
        }
      }
    }finally{activate.disabled=false;}
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
