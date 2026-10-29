"""Test expiry presentation with API fixtures and an unchanged registration date."""
import argparse
import functools
import http.server
import json
import threading
from datetime import datetime,timedelta,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright,expect

ROOT=Path(__file__).resolve().parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

def main():
    args=argparse.ArgumentParser()
    args.add_argument('--base')
    args.add_argument('--screenshots',type=Path)
    a=args.parse_args()
    server=None
    if a.base:base=a.base.rstrip('/')
    else:
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
        threading.Thread(target=server.serve_forever,daemon=True).start()
        base=f'http://127.0.0.1:{server.server_port}'
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch()
            errors=[]
            for width in [1360,390]:
                page=browser.new_page(viewport={'width':width,'height':1000})
                page.on('pageerror',lambda e:errors.append(str(e)))
                days={'value':284}
                now=datetime(2026,10,29,8,tzinfo=timezone.utc)
                def route(r):
                    expiry=(now+timedelta(days=days['value'])).strftime('%Y-%m-%d')
                    r.fulfill(json={'ok':True,'domain':'zgland.com','expiry_date':expiry,'expires_at':expiry+'T13:24:13Z','served_at':now.isoformat(),'checked_at':now.isoformat(),'source_label':'注册局实时查询','source_kind':'registry','verified':True,'warning':''})
                if not a.base:page.route('**/api/domain-expiry',route)
                page.goto(base+'/')
                expect(page.locator('[data-expiry-days]')).to_have_text('284')
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                if not a.base:
                    for value,level in [(60,'soon'),(30,'urgent'),(0,'today'),(-3,'expired')]:
                        days['value']=value;page.locator('[data-expiry-refresh]').click()
                        expect(page.locator('[data-domain-expiry]')).to_have_attribute('data-level',level)
                    page.unroute('**/api/domain-expiry')
                    page.route('**/api/domain-expiry',lambda r:r.fulfill(status=503,json={'ok':False}))
                    page.locator('[data-expiry-refresh]').click()
                    expect(page.locator('[data-expiry-source]')).to_contain_text('静态备用')
                    expect(page.locator('[data-expiry-warning]')).to_be_visible()
                    page.unroute('**/api/domain-expiry');page.route('**/api/domain-expiry',route);days['value']=284
                    page.locator('[data-expiry-refresh]').click()
                if a.screenshots:
                    a.screenshots.mkdir(parents=True,exist_ok=True)
                    page.screenshot(path=str(a.screenshots/f'expiry-home-{width}.png'),full_page=True)
                page.goto(base+'/domain-console/')
                expect(page.locator('[data-expiry-days]')).to_have_text('284')
                page.locator('.expiry-help summary').click()
                expect(page.locator('.expiry-help')).to_contain_text('manual_expiry_date')
                assert page.locator('.expiry-actions a').first.get_attribute('href').endswith('/edit/main/config/domain-expiry.json')
                expect(page.locator('#planButton')).to_be_visible()
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                page.close()
            assert not errors,errors
            browser.close()
        print(json.dumps({'passed':True,'browser_errors':errors,'base':base,'checks':['284-day countdown','Desktop and mobile layout','Warnings at 60/30/0/past dates and explicit fallback (local fixtures)','Refresh and management link','Existing domain console preserved']},ensure_ascii=False))
    finally:
        if server:server.shutdown();server.server_close()

if __name__=='__main__':main()
