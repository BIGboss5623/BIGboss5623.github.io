(() => {
  'use strict';
  const button = document.getElementById('checkCloud');
  const box = document.getElementById('cloudStatus');
  const recovery=document.getElementById('wakeCloud');
  const showRecovery=state=>{if(recovery) recovery.hidden=state==='protected';};
  const fromEntry=new URLSearchParams(location.search).get('cloud');
  if (['unavailable','unsafe'].includes(fromEntry)) {
    box.dataset.state=fromEntry;
    document.getElementById('statusTitle').textContent=fromEntry==='unsafe'?'入口认证异常，暂不跳转':'云端暂不可达，不是密码错误';
    document.getElementById('statusMessage').textContent='先打开下方平台任务唤醒环境，再回到此页点击“检查入口状态”。不要反复输入密码或重复提交部署。';
    showRecovery(fromEntry);
  }
  button.addEventListener('click', async () => {
    if (button.disabled) return;
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
    } catch (error) {
      box.dataset.state = 'unavailable';
      showRecovery('unavailable');
      document.getElementById('statusTitle').textContent = '本次检查未完成';
      document.getElementById('statusMessage').textContent = '可能是入口超时或状态服务不可用，不代表数据已经丢失。可尝试直接登录；云端不可用时使用浏览器回测。';
      document.getElementById('statusTime').textContent = `检查时间：${new Date().toLocaleString()} · 未自动重试`;
    } finally {
      clearTimeout(timer);
      button.disabled = false;
      button.textContent = original;
    }
  });
})();
