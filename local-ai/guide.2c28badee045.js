(() => {
  'use strict';
  const plans = {
    8: '8GB：先试 1.5B，预留 20～30GB SSD；适合跑通流程，复杂编程能力有限。',
    16: '16GB：先试 7B / 8B，预留 40～60GB SSD；单任务、4K 上下文，避免同时开大型软件。',
    32: '32GB：优先试 14B，预留约 100GB SSD；关闭大型软件，先用 4K 上下文。',
    64: '64GB：可试 32B，预留 150～200GB SSD；CPU 能跑但可能很慢，先测实际任务再决定显卡。',
    128: '128GB 及以上：可评估 70B，预留 150～250GB SSD；先实测速度。此配置仍不适合完整 R1 671B。'
  };
  const memory = document.getElementById('memoryPlan');
  memory.addEventListener('change', () => { document.getElementById('planResult').textContent = plans[memory.value]; });
  const status = document.getElementById('copyStatus');
  let statusTimer;
  for (const block of document.querySelectorAll('pre')) {
    block.tabIndex = 0;
    block.setAttribute('aria-label', '命令示例，可横向滚动');
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'copy-button'; button.textContent = '复制命令';
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(block.querySelector('code').textContent);
        status.textContent = '已复制。请先核对执行设备、权限与示例路径。';
      } catch {
        status.textContent = '浏览器未允许复制，请选中命令后手动复制。';
      }
      clearTimeout(statusTimer); statusTimer = setTimeout(() => {status.textContent = '';}, 5000);
    });
    block.prepend(button);
  }
  const checks = [...document.querySelectorAll('[data-check]')];
  const storageKey = 'zgland-local-ai-checklist-v1';
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    for (const input of checks) input.checked = saved?.[input.dataset.check] === true;
  } catch { /* Checklist remains usable without browser storage. */ }
  function updateChecks(save) {
    document.getElementById('checkProgress').textContent = `已完成 ${checks.filter(x => x.checked).length} / ${checks.length} 项`;
    if (save) try { localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(checks.map(x => [x.dataset.check, x.checked])))); } catch { /* Storage may be disabled. */ }
  }
  for (const input of checks) input.addEventListener('change', () => updateChecks(true));
  document.getElementById('resetChecks').addEventListener('click', () => {checks.forEach(x => {x.checked = false;}); updateChecks(true);});
  updateChecks(false);
  let previouslyOpen = [];
  window.addEventListener('beforeprint', () => {
    previouslyOpen = [...document.querySelectorAll('details')].map(x => [x, x.open]);
    previouslyOpen.forEach(([x]) => {x.open = true;});
  });
  window.addEventListener('afterprint', () => {previouslyOpen.forEach(([x, open]) => {x.open = open;});});
  document.getElementById('printGuide').addEventListener('click', () => window.print());
})();
