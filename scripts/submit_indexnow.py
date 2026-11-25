"""Submit changed canonical pages to IndexNow, only after verifying live key files.
Usage: python scripts/submit_indexnow.py [--send]
Default is a read-only preview. Does not send to Google or Baidu.
"""
from pathlib import Path
from urllib import request,error,parse
from xml.etree import ElementTree
from datetime import datetime,timezone
import argparse,json,hashlib
R=Path(__file__).resolve().parents[1]
SITES=json.loads((R/'scripts/indexnow-hosts.json').read_text(encoding='utf-8'))
LOG=R/'本地留档'/'qa-reports'/'indexnow-submissions.json'
SITEMAPS={'zgland.com':'sitemap.xml','hzct.zgland.com':'sitemap-hzct.xml','hzyx.zgland.com':'sitemap-hzyx.xml'}
def read(url,timeout=14):
 with request.urlopen(request.Request(url,headers={'User-Agent':'ZGLAND-IndexNow/1.0','Cache-Control':'no-cache'}),timeout=timeout) as f:
  return f.read(160000).decode('utf-8','replace')
def main():
 ap=argparse.ArgumentParser()
 ap.add_argument('--send',action='store_true',help='Verify live keys and POST updated URLs to IndexNow')
 a=ap.parse_args()
 prior=json.loads(LOG.read_text(encoding='utf-8')) if LOG.exists() else {}
 all_ok=True
 for host,obj in SITES.items():
  key=obj['key'];key_url='https://'+host+'/'+key+'.txt'
  urls=['https://'+host+x for x in obj['urls']]
  sitemap='https://'+host+'/sitemap.xml'
  local_xml=(R/SITEMAPS[host]).read_text(encoding='utf-8')
  for url in urls:
   assert url in local_xml,(host,url)
  fingerprint=hashlib.sha256(('\n'.join(urls)+'\n'+key).encode('utf-8')).hexdigest()
  state=prior.get(host)
  if state and state.get('fingerprint')==fingerprint and state.get('status') in (200,202):
   print(host,'ALREADY_SUBMITTED',state.get('status'),len(urls),'urls')
   continue
  print(host,'PREVIEW',len(urls),'canonical pages','KEY_LOCATION',key_url)
  if not a.send:continue
  try:
   k=read(key_url)
   if k.strip()!=key:raise ValueError('Live public verification key content mismatch')
   xml=read(sitemap)
   root=ElementTree.fromstring(xml)
   locs={e.text for e in root.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')}
   if not set(urls).issubset(locs):raise ValueError('Live sitemap is not deployed or missing target URLs')
   data=json.dumps({'host':host,'key':key,'keyLocation':key_url,'urlList':urls}).encode('utf-8')
   req=request.Request('https://api.indexnow.org/indexnow',data=data,headers={'Content-Type':'application/json; charset=utf-8','User-Agent':'ZGLAND-IndexNow/1.0'},method='POST')
   try:
    with request.urlopen(req,timeout=20) as resp:status=resp.status
   except error.HTTPError as e:
    status=e.code
   print(host,'INDEXNOW_HTTP',status)
   if status in (200,202):
    prior[host]={'fingerprint':fingerprint,'status':status,'submitted_at':datetime.now(timezone.utc).isoformat(),'url_count':len(urls)}
    LOG.parent.mkdir(parents=True,exist_ok=True)
    LOG.write_text(json.dumps(prior,ensure_ascii=False,indent=2),encoding='utf-8')
   else:all_ok=False
  except Exception as e:
   print(host,'NOT_SUBMITTED',type(e).__name__,str(e)[:220])
   all_ok=False
 return 0 if all_ok else 1
if __name__=='__main__':raise SystemExit(main())
