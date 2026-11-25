from pathlib import Path
import subprocess,functools,http.server,threading,json,os,sys
from datetime import datetime,timezone
R=Path(__file__).resolve().parents[1]
Q=R/'本地留档'/'qa-reports'
ALL=['/','/about.html','/company.html','/contact.html','/help.html','/privacy.html','/network/','/proxy/','/hzyx/','/history-cycle/','/domain-console/','/fund/','/quant-console/','/credentials/','/local-ai/','/games/','/site-stats/','/site-blueprint/','/fund/workbench/','/guides/remote-ssh/','/guides/website-publishing/','/guides/cloudflare-search-crawling/','/tools/robots-checker/','/guides/']
SMOKE=['/','/domain-console/','/site-stats/','/fund/','/quant-console/','/credentials/','/local-ai/','/hzyx/','/guides/remote-ssh/','/guides/website-publishing/','/guides/cloudflare-search-crawling/','/tools/robots-checker/','/guides/']
CHECKS=[
 ['node','scripts/test-site-qa-rules.cjs'],
 ['node','scripts/test-seo-routing.cjs'],
 ['node','scripts/test-robots-checker.cjs'],
 [sys.executable,'-m','py_compile','scripts/check_live_seo.py'],
 [sys.executable,'scripts/test_seo.py'],
 [sys.executable,'scripts/test_check_search_crawlers.py'],
 [sys.executable,'scripts/test-verify-site.py'],
 [sys.executable,'scripts/test-tunnel-health.py'],
 ['node','scripts/test-navigation-links.cjs'],
 ['node','scripts/test-portal.cjs'],
 ['node','scripts/test-domain-api.cjs'],
 ['node','scripts/test-domain-expiry.cjs'],
 ['node','scripts/test-site-operations.cjs'],
 ['node','scripts/test-backup-check.cjs'],
 [sys.executable,'scripts/test_audit_links.py'],
 [sys.executable,'scripts/audit_links.py'],
 [sys.executable,'scripts/test_site_operations.py'],
]
def run(args,env=None,timeout=70):
 try:
  p=subprocess.run(args,cwd=R,env=env,capture_output=True,text=True,errors='replace',timeout=timeout)
  return {'ok':p.returncode==0,'exit_code':p.returncode,'command':' '.join(args),'output':(p.stdout+'\n'+p.stderr)[-1800:]}
 except Exception as e:return {'ok':False,'command':' '.join(args),'error':str(e)[:450]}
def playwright():
 if os.environ.get('PLAYWRIGHT_MODULE'):return os.environ['PLAYWRIGHT_MODULE']
 p=R/'本地留档/qa-tools/node_modules/playwright'
 if (p/'index.js').is_file():return str(p)
 if (R/'node_modules/playwright/index.js').is_file():return 'playwright'
 return None
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
def pagecheck(report,mode,base,env,pages):
 destination=Q/(report['stamp']+'-'+mode+'-pages.json')
 e=env.copy();e['QA_PAGES']=json.dumps(pages)
 if mode=='local':e['QA_LOCAL']='1'
 else:e.pop('QA_LOCAL',None)
 v=run(['node','scripts/site-qa.cjs',base,str(destination)],e,max(115,len(pages)*12))
 v['page_report']=str(destination)
 if destination.is_file():
  data=json.loads(destination.read_text(encoding='utf-8'))
  v['pages']=len(data)
  v['expected_static_function_404']=sum(len(i.get('expectedLocalFunctions',[])) for i in data)
  v['telemetry_warnings']=sum(len(i.get('telemetryWarnings',[])) for i in data)
  v['failing_pages']=[
    {'url':i.get('url'),'status':i.get('status'),'failures':i.get('failed',[]),
     'errors':i.get('errors',[]),'message':i.get('error'),
     'overflow':bool(i.get('overflow') or i.get('desktopOverflow')),
     'broken_images':i.get('brokenImages',[]),'analytics_requests':i.get('analyticsRequests',[]),
     'nav_ok':not i.get('nav') or i.get('visibleNavLinks',0)>=15}
    for i in data if i.get('error') or i.get('failed') or i.get('errors') or
    i.get('status')!=200 or i.get('overflow') or i.get('desktopOverflow') or
    i.get('brokenImages') or i.get('analyticsRequests') or
    (i.get('nav') and i.get('visibleNavLinks',0)<15)]
 report['checks'][mode+'_pages']=v
 page_count=v.get('pages',0)
 problems=len(v.get('failing_pages',[]))
 print(f'{mode.upper()} PAGES: {page_count-problems}/{page_count} healthy; {problems} affected',flush=True)
def frontend_release_ready(checks: dict) -> bool:
    """Strict frontend gate, separately reporting an explicitly degraded private stats upstream."""
    if any(not v.get('ok',False) for k,v in checks.items() if k not in ('tunnel_health','live_pages')):
        return False
    live=checks.get('live_pages')
    if live is None or live.get('ok',False):
        return True
    degraded=live.get('failing_pages',[])
    if not degraded:
        return False
    for page in degraded:
        if page.get('url')!='https://zgland.com/site-stats/':
            return False
        if page.get('status')!=200 or page.get('message') or page.get('errors') or page.get('overflow'):
            return False
        if page.get('broken_images') or page.get('analytics_requests') or page.get('nav_ok') is not True:
            return False
        if page.get('failures') != [{'url':'https://zgland.com/api/site-stats','status':503}]:
            return False
    return True


def main():
 import argparse
 parser=argparse.ArgumentParser()
 parser.add_argument('--mode',choices=['static','local','live','both'],default='both')
 parser.add_argument('--full',action='store_true')
 a=parser.parse_args();Q.mkdir(parents=True,exist_ok=True)
 report={'stamp':datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'),'mode':a.mode,'full':a.full,'checks':{}}
 if a.mode in ('static','local','both'):
  for args in CHECKS:
   c=run(args);key=Path(args[-1]).name;report['checks'][key]=c
   print('STATIC '+key+' '+('PASS' if c['ok'] else 'FAIL'),flush=True)
 if a.mode in ('local','live','both'):
  pw=playwright()
  if not pw:
   report['checks']['browser_dependency']={'ok':False,'error':'Install Playwright or set PLAYWRIGHT_MODULE'}
   print('Missing Playwright; browser checks unavailable',flush=True)
  else:
   env=os.environ.copy();env['PLAYWRIGHT_MODULE']=pw
   pages=ALL if a.full else SMOKE
   if a.mode in ('local','both'):
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(R)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
     base='http://127.0.0.1:'+str(server.server_port)
     pagecheck(report,'local',base,env,pages)
     v=run(['node','scripts/test-portal-browser.cjs',base],env,100)
     report['checks']['local_portal']=v
     print('LOCAL PORTAL '+('PASS' if v['ok'] else 'FAIL'),flush=True)
    finally:server.shutdown();server.server_close()
   if a.mode in ('live','both'):
    health=run([sys.executable,'scripts/check_tunnel_health.py'],timeout=38)
    report['checks']['tunnel_health']=health
    print('BACKEND HEALTH '+('PASS' if health['ok'] else 'DEGRADED'),flush=True)
    pagecheck(report,'live','https://zgland.com',env,pages)
    v=run(['node','scripts/test-portal-browser.cjs','https://zgland.com'],env,105)
    report['checks']['live_portal']=v
    print('LIVE PORTAL '+('PASS' if v['ok'] else 'FAIL'),flush=True)
 total=len(report['checks']);passed=sum(c.get('ok',False) for c in report['checks'].values())
 report.update(passed=passed,total=total,ok=passed==total)
 report['frontend_release_ready']=frontend_release_ready(report['checks'])
 report['backend_health_ok']=report['checks'].get('tunnel_health',{}).get('ok')
 print('FRONTEND RELEASE '+('READY' if report['frontend_release_ready'] else 'BLOCKED'),flush=True)
 if report['backend_health_ok'] is False:
  print('PRIVATE BACKEND DEGRADED (not silently treated as healthy)',flush=True)
 out=Q/(report['stamp']+'-summary.json')
 out.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
 print('VERDICT '+str(passed)+'/'+str(total)+' '+('PASS' if report['ok'] else 'FAIL'),flush=True)
 print('REPORT '+str(out),flush=True)
 return 0 if report['ok'] else 1
if __name__=='__main__':raise SystemExit(main())
