"""Static SEO invariants: canonical hosts, sitemap, metadata and share keys."""
from pathlib import Path
from html.parser import HTMLParser
from xml.etree import ElementTree
from urllib.parse import urlsplit
from datetime import date
import json,re
R=Path(__file__).resolve().parents[1]
hosts={
 'zgland.com':('sitemap.xml',{'/':'index.html','/local-ai/':'local-ai/index.html','/fund/':'fund/index.html','/fund/workbench/':'fund/workbench/index.html','/history-cycle/':'history-cycle/index.html','/credentials/':'credentials/index.html','/games/':'games/index.html','/games/rich4/':'games/rich4/index.html','/proxy/':'proxy/index.html','/site-blueprint/':'site-blueprint/index.html','/guides/remote-ssh/':'guides/remote-ssh/index.html','/guides/website-publishing/':'guides/website-publishing/index.html','/guides/cloudflare-search-crawling/':'guides/cloudflare-search-crawling/index.html','/tools/robots-checker/':'tools/robots-checker/index.html','/guides/':'guides/index.html'}),
 'hzct.zgland.com':('sitemap-hzct.xml',{'/':'company-home.html','/company':'company.html','/about':'about.html','/help':'help.html','/contact':'contact.html','/privacy':'privacy.html'}),
 'hzyx.zgland.com':('sitemap-hzyx.xml',{'/':'hzyx/index.html'})
}
class Head(HTMLParser):
 def __init__(self):super().__init__();self.c=[];self.d=[];self.o={};self.r=[];self.ld=[];self.in_ld=False;self.data=''
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='link' and a.get('rel')=='canonical':self.c.append(a.get('href'))
  if tag=='meta':
   k=a.get('name') or a.get('property')
   if k=='description':self.d.append(a.get('content',''))
   if k=='robots':self.r.append(a.get('content',''))
   if k and k.startswith('og:'):self.o[k]=a.get('content','')
  if tag=='script' and a.get('type')=='application/ld+json':self.in_ld=True;self.data=''
 def handle_data(self,d):
  if self.in_ld:self.data+=d
 def handle_endtag(self,tag):
  if tag=='script' and self.in_ld:self.ld.append(json.loads(self.data));self.in_ld=False
all_urls=[]
for host,(xml,paths) in hosts.items():
 root=ElementTree.parse(R/xml).getroot()
 ns={'x':'http://www.sitemaps.org/schemas/sitemap/0.9'}
 entries=root.findall('x:url',ns)
 assert len(entries)==len(paths),(host,len(entries),len(paths))
 for item in entries:
  loc=item.findtext('x:loc',namespaces=ns);dt=item.findtext('x:lastmod',namespaces=ns)
  parsed=urlsplit(loc)
  assert parsed.scheme=='https' and parsed.hostname==host and parsed.path in paths,loc
  assert not parsed.query and not parsed.fragment,loc
  assert dt and date.fromisoformat(dt)<=date.today(),loc
  file=R/paths[parsed.path]
  assert file.is_file(),file
  h=Head();h.feed(file.read_text(encoding='utf-8-sig'))
  assert h.c==[loc],(file,h.c,loc)
  assert len(h.d)==1 and len(h.d[0])>=12,file
  assert not any('noindex' in x.lower() for x in h.r),file
  all_urls.append(loc)
 robots={'zgland.com':'robots.txt','hzct.zgland.com':'robots-hzct.txt','hzyx.zgland.com':'robots-hzyx.txt'}[host]
 assert 'Sitemap: https://'+host+'/sitemap.xml' in (R/robots).read_text(encoding='utf-8')
assert len(set(all_urls))==len(all_urls)
for page in ['index.html','company.html','help.html','hzyx/index.html','fund/index.html','history-cycle/index.html','guides/remote-ssh/index.html','guides/website-publishing/index.html','guides/cloudflare-search-crawling/index.html']:
 h=Head();h.feed((R/page).read_text(encoding='utf-8'))
 assert all(h.o.get(x) for x in ['og:title','og:url','og:description','og:type']),page
 assert h.o['og:url']==h.c[0],page
for page in ['guides/remote-ssh/index.html','guides/website-publishing/index.html','guides/cloudflare-search-crawling/index.html']:
 text=(R/page).read_text(encoding='utf-8')
 h=Head();h.feed(text)
 assert len(text)>4200 and {'TechArticle','BreadcrumbList'}=={x.get('@type') for x in h.ld},page
for page in ['network/index.html','domain-console/index.html']:
 assert 'noindex' in (R/page).read_text(encoding='utf-8').lower(),page
keys=json.loads((R/'scripts/indexnow-hosts.json').read_text(encoding='utf-8'))
assert set(keys)==set(hosts)
for host,v in keys.items():
 key=v['key']
 assert re.fullmatch('[a-f0-9]{32}',key),host
 f=(R/'hzyx'/f'{key}.txt') if host=='hzyx.zgland.com' else R/f'{key}.txt'
 assert f.read_text(encoding='utf-8')==key
 for path in v['urls']:assert 'https://'+host+path in all_urls
print('PASS SEO: 3 host-specific sitemaps, 21 canonical URLs, search metadata, structured guides and IndexNow keys')

# Check guide hub metadata and structured list.
h=Head();h.feed((R/'guides/index.html').read_text(encoding='utf-8'))
assert all(h.o.get(x) for x in ['og:title','og:url','og:description','og:type'])
assert {'ItemList','BreadcrumbList'}=={x.get('@type') for x in h.ld}
