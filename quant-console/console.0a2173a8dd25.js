(() => {
  'use strict';
  const button = document.getElementById('checkCloud');
  const box = document.getElementById('cloudStatus');
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
      document.getElementById('statusTitle').textContent = result.title;
      document.getElementById('statusMessage').textContent = result.message;
      document.getElementById('statusTime').textContent = `检查时间：${new Date(result.checkedAt).toLocaleString()} · 单次检查，不自动保活`;
    } catch (error) {
      box.dataset.state = 'unavailable';
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
