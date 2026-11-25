"""Read-only monitoring of public robots.txt and search crawler permissions.

Cloudflare managed directives can differ from source-controlled robots.txt.
Uses real public responses; sitemap/Googlebot/bingbot failures stop CI.
Baiduspider blockage is an explicit warning until the Cloudflare owner resolves it.
"""
from urllib import robotparser,request
from public_http import open_public
from urllib.error import HTTPError,URLError
from datetime import datetime,timezone
import json,os,sys

HOSTS=('zgland.com','hzct.zgland.com','hzyx.zgland.com')
AGENTS=('Baiduspider','Googlebot','bingbot')
def evaluate(text,host):
    parser=robotparser.RobotFileParser()
    parser.parse(text.splitlines())
    address='https://'+host+'/'
    return {
        'host':host,
        'sitemap_declared':('Sitemap: https://'+host+'/sitemap.xml') in text,
        'permissions':{name:parser.can_fetch(name,address) for name in AGENTS},
        'managed_rules_present':('Cloudflare Managed Content' in text or 'Content-Signal:' in text),
    }
def main():
    results=[];errors=[]
    for host in HOSTS:
        url='https://'+host+'/robots.txt'
        try:
            req=request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; ZGLAND-public-SEO-health/1.0)','Accept':'text/plain,*/*','Cache-Control':'no-cache','DNT':'1','Sec-GPC':'1'})
            with open_public(req,timeout=16) as response:
                if response.status!=200:raise ValueError('HTTP '+str(response.status))
                text=response.read(160000).decode('utf-8','replace')
            if not text:raise ValueError('empty robots.txt')
            result=evaluate(text,host)
            results.append(result)
            if not result['sitemap_declared']:errors.append(host+' sitemap declaration missing')
            for agent in ('Googlebot','bingbot'):
                if not result['permissions'][agent]:errors.append(host+' '+agent+' blocked')
        except (HTTPError,URLError,ValueError,OSError) as exc:
            errors.append(host+' request error: '+type(exc).__name__+': '+str(exc)[:140])
    now=datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    print(json.dumps({'time_utc':now,'sites':results,'errors':errors},ensure_ascii=False,indent=2))
    summary=['## ZGLAND search crawler policy (UTC '+now+')','','| Host | Baiduspider | Googlebot | bingbot | Sitemap |','|---|---|---|---|---|']
    for item in results:
        p=item['permissions']
        label=lambda agent:'Allow' if p[agent] else 'Block'
        summary.append('| '+item['host']+' | '+label('Baiduspider')+' | '+label('Googlebot')+' | '+label('bingbot')+' | '+('OK' if item['sitemap_declared'] else 'MISSING')+' |')
    if any(not x['permissions']['Baiduspider'] for x in results):
        summary.extend(['','**Known warning:** Baiduspider blocked on some hosts by public rules; see GitHub issue #4 for the Cloudflare owner-controlled fix.'])
    if errors:summary.extend(['','**New errors:**']+['- '+e for e in errors])
    dest=os.getenv('GITHUB_STEP_SUMMARY')
    if dest:
        with open(dest,'a',encoding='utf-8') as fh:fh.write('\n'.join(summary)+'\n')
    return 1 if errors else 0
if __name__=='__main__':
    sys.exit(main())
