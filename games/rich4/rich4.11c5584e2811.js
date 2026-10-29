(() => {
  'use strict';
  const button=document.getElementById('copyHash');
  const status=document.getElementById('copyStatus');
  button.addEventListener('click',async()=>{
    const hash=document.getElementById('windowsHash').textContent.trim();
    try {
      await navigator.clipboard.writeText(hash);
      status.textContent='已复制 Windows 完整包的 SHA-256。';
    } catch {
      const range=document.createRange();range.selectNodeContents(document.getElementById('windowsHash'));
      const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
      status.textContent='校验值已选中，请按 Ctrl+C 复制。';
    }
  });
})();
