"""Verify Rich4 download page, retained source archive and browser flows."""
import argparse
import functools
import hashlib
import http.server
import json
import threading
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--base',help='Published origin for browser checks; local archive is still verified.')
    parser.add_argument('--screenshots',type=Path)
    args=parser.parse_args()
    manifest=json.loads((ROOT/'games/rich4/download-manifest.json').read_text(encoding='utf-8'))
    archive=ROOT/'games/rich4/downloads'/manifest['source']['filename']
    assert archive.stat().st_size==manifest['source']['bytes']
    assert hashlib.sha256(archive.read_bytes()).hexdigest()==manifest['source']['sha256']
    assert archive.stat().st_size<25*1024*1024
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        prefix=z.namelist()[0]
        assert json.loads(z.read(prefix+'game/package.json'))['version']==manifest['source']['package_version']
        assert all(prefix+f in z.namelist() for f in ['LICENSE','README.md','THIRD_PARTY.md'])
        assert not any('/node_modules/' in n or '/.env' in n or '/public/assets/' in n for n in z.namelist())
    server=None
    if args.base:
        base=args.base.rstrip('/')
    else:
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
        threading.Thread(target=server.serve_forever,daemon=True).start()
        base=f'http://127.0.0.1:{server.server_port}'
    try:
        with TemporaryDirectory(prefix='rich4-download-qa-') as tmp,sync_playwright() as p:
            browser=p.chromium.launch()
            context=browser.new_context(accept_downloads=True,permissions=['clipboard-read','clipboard-write'])
            errors=[]
            for width in [1360,390]:
                page=context.new_page()
                page.set_viewport_size({'width':width,'height':1000})
                page.on('pageerror',lambda e:errors.append(str(e)))
                response=page.goto(base+'/games/rich4/')
                assert response.status==200
                expect(page.locator('#gameTitle')).to_contain_text('大富翁4重制版')
                assert page.locator('#windowsDownload').get_attribute('href')==manifest['windows']['url']
                expect(page.locator('.screenshot-grid img')).to_have_count(3)
                for image in page.locator('.screenshot-grid img').all():
                    image.scroll_into_view_if_needed()
                    page.wait_for_function('(img)=>img.complete && img.naturalWidth===1600',arg=image.element_handle())
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                page.locator('#copyHash').click()
                expect(page.locator('#copyStatus')).to_contain_text('已复制')
                assert page.evaluate('navigator.clipboard.readText()')==manifest['windows']['sha256']
                if width==1360:
                    with page.expect_download() as event:page.locator('#sourceDownload').click()
                    download=event.value
                    target=Path(tmp)/download.suggested_filename
                    download.save_as(target)
                    assert download.suggested_filename==manifest['source']['filename']
                    assert hashlib.sha256(target.read_bytes()).hexdigest()==manifest['source']['sha256']
                if args.screenshots:
                    args.screenshots.mkdir(parents=True,exist_ok=True)
                    page.evaluate('document.activeElement.blur();window.scrollTo(0,0)')
                    page.screenshot(path=str(args.screenshots/f'rich4-{width}.png'),full_page=True)
                page.goto(base+'/')
                page.locator('#siteSearch').fill('大富翁')
                expect(page.locator('.site-card:visible')).to_have_count(1)
                assert page.locator('.site-card:visible a[href="https://zgland.com/games/rich4/"]').count()==1
                page.goto(base+'/games/')
                expect(page.locator('#board .tile')).to_have_count(16)
                expect(page.locator('#rich4Title')).to_contain_text('大富翁4')
                page.close()
            assert not errors,errors
            browser.close()
        print(json.dumps({'passed':True,'browser_errors':errors,'checks':['Source ZIP SHA-256 and CRC, license and package version, no private runtime files','Desktop and 390px layout, three real game screenshots loaded','Actual source download SHA-256','Windows URL and clipboard hash','Portal search entry and preserved 2048 board'],'base':base},ensure_ascii=False))
    finally:
        if server:server.shutdown();server.server_close()


if __name__=='__main__':main()
