"""Apply the website operations links/privacy/tracker to maintained public pages."""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
FARM=ROOT.parent/'feitianshan'
tracker='''
  // Cookie-free page measurement; only paths, never queries or document names.
  if (window.top===window && navigator.doNotTrack!=='1' && !navigator.globalPrivacyControl &&
      /^(?:[a-z0-9-]+\\.)?zgland\\.com$/.test(location.hostname)) {
    const record=()=>{if(document.visibilityState!=='visible')return;
      document.removeEventListener('visibilitychange',record);
      fetch('https://zgland.com/api/visit',{method:'POST',headers:{'Content-Type':'text/plain'},
        body:JSON.stringify({path:location.pathname.slice(0,200)}),credentials:'omit',keepalive:true}).catch(()=>{});
    };
    if(document.visibilityState==='visible')record();else document.addEventListener('visibilitychange',record);
  }
'''
for root in (ROOT,FARM):
    script=root/'assets/js/site-tools.js'
    text=script.read_text(encoding='utf-8')
    if 'Cookie-free page measurement' not in text:
        text=text.replace("  'use strict';","  'use strict';"+tracker,1)
    if "['网站访问统计'" not in text:
        text=text.replace("const links = [","const links = [['网站访问统计','/site-stats/','PV UV 流量 趋势 访问'],['建站思路与恢复蓝图','/site-blueprint/','AI 重建 备份 架构 思路'],",1)
    script.write_text(text,encoding='utf-8')
    headers=root/'_headers'
    text=headers.read_text(encoding='utf-8')
    text=text.replace("connect-src 'none'","connect-src 'self' https://zgland.com").replace("connect-src 'self';","connect-src 'self' https://zgland.com;")
    headers.write_text(text,encoding='utf-8')
    privacy=root/'privacy.html'
    text=privacy.read_text(encoding='utf-8')
    note='<section id="site-measurement"><h2>访问统计与登录安全通知</h2><p>普通网页在可见时发送页面路径，尊重DNT/GPC，不使用Cookie，不发送查询参数或填写内容。自有服务器以每日变化的摘要估算访客，统计库不保存原始IP，保留90天；公开页面仅显示汇总。安全验证会记录IP与操作目的，在密码成功或连续50次错误暂停服务时通知站主。邮件经FormSubmit转发，相关安全通知仅保留于私密队列与邮箱。</p><p><a href="https://zgland.com/site-stats/">查看访问统计及完整口径</a> · <a href="https://zgland.com/site-blueprint/">建站与恢复思路</a></p></section>'
    if 'id="site-measurement"' not in text:
        text=text.replace('</main>',note+'</main>')
    privacy.write_text(text,encoding='utf-8')
build=ROOT/'scripts/build_frontend_assets.py'
text=build.read_text(encoding='utf-8')
if '"assets/operations.css"' not in text:
    text=text.replace('ASSETS = (','ASSETS = ("assets/operations.css", "assets/site-stats.js", ',1)
text=text.replace('"credentials", "local-ai")','"credentials", "local-ai", "site-stats", "site-blueprint")')
build.write_text(text,encoding='utf-8')
home=ROOT/'index.html'
text=home.read_text(encoding='utf-8')
cards='''
        <article class="site-card" data-category="tools" data-search="访问统计 PV UV 流量 网站 变化 邮件"><span class="card-kicker">16 / INSIGHTS</span><h3><a href="/site-stats/">网站访问统计 ↗</a></h3><p>查看真实浏览量、访客估算与30天趋势，了解各网站的访问变化。</p><span class="card-note">自有服务器 · 公开汇总</span></article>
        <article class="site-card" data-category="tools" data-search="建站 思路 AI 恢复 重建 蓝图 架构 备份"><span class="card-kicker">17 / BLUEPRINT</span><h3><a href="/site-blueprint/">建站思路与恢复蓝图 ↗</a></h3><p>保留网站群的用途、架构、安全规则和恢复步骤，供未来AI重建。</p><span class="card-note">公开建站档案 · Markdown可下载</span></article>
'''
if '17 / BLUEPRINT' not in text:
    # Insert immediately before the first actual directory card.
    match=re.search(r'<article class="site-card',text)
    if not match:raise RuntimeError('Directory card markup changed')
    text=text[:match.start()]+cards+text[match.start():]
home.write_text(text,encoding='utf-8')
print('Frontend links, tracker, privacy and build entries updated.')
