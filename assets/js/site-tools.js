(() => {
  'use strict';
  const base = 'https://zgland.com';
  const links = [['官网首页','/'],['量化研究台','/fund/'],['网络工具','/network/'],['软件下载','/proxy/'],['钰玺医药','/hzyx/'],['域名控制台','/domain-console/'],['联系反馈','/contact.html']];
  const style = document.createElement('style');
  style.textContent = `.zg-tools{position:fixed;right:16px;bottom:18px;z-index:9000;font:14px/1.5 system-ui,'Microsoft YaHei',sans-serif;color:#edf6ff}.zg-tools summary{list-style:none;cursor:pointer;background:#123044;border:1px solid #7cb7c9;border-radius:24px;padding:11px 18px;box-shadow:0 4px 18px #0003}.zg-tools summary::-webkit-details-marker{display:none}.zg-tools nav{position:absolute;right:0;bottom:55px;width:190px;max-height:65vh;overflow:auto;background:#102637;border:1px solid #7193a5;border-radius:14px;padding:8px;box-shadow:0 8px 30px #0005}.zg-tools a,.zg-tools button{display:block;box-sizing:border-box;width:100%;text-align:left;color:#edf6ff!important;background:transparent;border:0;border-radius:8px;padding:10px;text-decoration:none!important;font:inherit;cursor:pointer}.zg-tools a:hover,.zg-tools button:hover{background:#27485b}.zg-tools :focus-visible{outline:3px solid #f6cc71;outline-offset:2px}@media(max-width:600px){.zg-tools{right:10px;bottom:max(12px,env(safe-area-inset-bottom))}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto!important}*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}@media print{.zg-tools{display:none}}`;
  document.head.append(style);
  const panel = document.createElement('details');
  panel.className = 'zg-tools';
  const summary = document.createElement('summary'); summary.textContent = '网站导航';
  const nav = document.createElement('nav'); nav.setAttribute('aria-label','网站快捷导航');
  for (const [label,path] of links) {
    const a = document.createElement('a'); a.textContent=label; a.href=base+path; nav.append(a);
  }
  const top = document.createElement('button'); top.type='button'; top.textContent='↑ 返回顶部'; top.onclick=()=>{window.scrollTo({top:0});panel.open=false;}; nav.append(top);
  panel.append(summary,nav); document.body.append(panel);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){panel.open=false;summary.focus();}});
  document.addEventListener('click',e=>{if(!panel.contains(e.target))panel.open=false;});
})();
