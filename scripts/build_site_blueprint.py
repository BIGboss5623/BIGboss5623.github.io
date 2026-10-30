"""Render the public recovery blueprint using only Python's standard library."""
from html import escape
import json
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
folder=ROOT/'site-blueprint'
source=(folder/'blueprint.md').read_text(encoding='utf-8')
def inline(text):
    return re.sub(r'`([^`]+)`',r'<code>\1</code>',escape(text))
parts=[];table=False;listing=False;routes=[]
for line in source.splitlines():
    if not line.startswith('|') and table:
        parts.append('</tbody></table></div>');table=False
    if not re.match(r'^\d+\. ',line) and listing:
        parts.append('</ol>');listing=False
    if line.startswith('# '):continue
    if line.startswith('## '):
        if parts:parts.append('</section>')
        title=line[3:];slug='chapter-'+str(len([x for x in parts if '<section' in x])+1)
        parts.append('<section class="panel" id="'+slug+'"><h2>'+inline(title)+'</h2>')
    elif line.startswith('|'):
        values=[x.strip() for x in line.strip('|').split('|')]
        if all(re.fullmatch('[- :]+',x) for x in values):continue
        if not table:
            parts.append('<div class="table-scroll"><table><thead><tr>'+''.join('<th>'+inline(x)+'</th>' for x in values)+'</tr></thead><tbody>');table=True
        else:
            parts.append('<tr>'+''.join('<td>'+inline(x)+'</td>' for x in values)+'</tr>')
            routes.append({'route':values[0],'purpose':values[1]})
    elif re.match(r'^\d+\. ',line):
        if not listing:parts.append('<ol>');listing=True
        parts.append('<li>'+inline(re.sub(r'^\d+\. ','',line))+'</li>')
    elif line.strip():parts.append('<p>'+inline(line)+'</p>')
if listing:parts.append('</ol>')
if table:parts.append('</tbody></table></div>')
parts.append('</section>')
# Intro precedes the first section: remove the unmatched section closing there.
first=next((i for i,x in enumerate(parts) if x.startswith('<section')),None)
if first is not None and first>0 and parts[first-1]=='</section>':parts.pop(first-1)
body=''.join(parts)
page='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>建站思路与恢复蓝图 · ZGLAND</title><meta name="description" content="公开保留ZGLAND网站群的建站目标、全部子站、架构、接口、安全规则与AI重建步骤。"><link rel="canonical" href="https://zgland.com/site-blueprint/"><link rel="stylesheet" href="/assets/operations.css"><script defer src="/assets/js/site-tools.js"></script></head><body><header class="wrap"><a class="brand" href="https://zgland.com/">ZGLAND <span>/ 建站档案</span></a><nav><a href="https://zgland.com/">全部网站</a><a href="https://zgland.com/site-stats/">访问统计</a></nav></header><main class="wrap"><section class="hero"><p class="eyebrow">BUILD · PRESERVE · REBUILD</p><h1>保留建站的思路，<br>让未来可以重建。</h1><p class="lead">为什么建、每个网站做什么、如何连接与保护数据，都写在公开可读的这份档案里。</p><p><a class="button" href="blueprint.md" download>下载完整Markdown ↓</a> <a href="routes.json">读取结构化路由 JSON ↗</a></p><nav class="toc" aria-label="蓝图章节">'''+''.join('<a href="#chapter-%d">%s</a>'%(i+1,escape(t)) for i,t in enumerate(re.findall(r'^## (.+)$',source,re.M)))+'''</nav></section>'''+body+'''</main><footer class="wrap">维护约定：架构、入口或安全规则改变时，同步更新这份档案。公开蓝图不保存秘密。</footer></body></html>'''
(folder/'index.html').write_text(page,encoding='utf-8')
(folder/'routes.json').write_text(json.dumps({'version':'2026-10-31','blueprint':'https://zgland.com/site-blueprint/blueprint.md','routes':routes},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Public blueprint rendered:',len(routes),'routes')
