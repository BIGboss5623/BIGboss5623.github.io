'use strict';
const menu = document.querySelector('.menu');
const navigation = document.getElementById('navigation');
menu.addEventListener('click', () => {
  const expanded = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(expanded));
  navigation.classList.toggle('open', expanded);
});
navigation.addEventListener('click', event => {
  if (event.target.closest('a')) {
    menu.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('open');
  }
});
document.getElementById('copyEmail').addEventListener('click', async () => {
  const status = document.getElementById('copyStatus');
  try {
    await navigator.clipboard.writeText('36166180@qq.com');
    status.textContent = '邮箱已复制';
  } catch {
    status.textContent = '请长按或选中邮箱地址复制：36166180@qq.com';
  }
});
document.getElementById('year').textContent = new Date().getFullYear();
