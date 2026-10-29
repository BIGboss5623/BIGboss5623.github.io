"""Verify the credential catalogue and the user's search/compare/export paths."""
import argparse
import csv
import functools
import http.server
import io
import json
import re
import threading
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
CSP = "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def end_headers(self):
        if self.path.startswith('/credentials/'):
            self.send_header('Content-Security-Policy', CSP)
        super().end_headers()


def check_data(data):
    assert data['version'] == '2026-10-29'
    entries, sources = data['entries'], data['sources']
    assert len(entries) == 34 and len({e['id'] for e in entries}) == 34
    assert len(sources) == 53
    for e in entries:
        assert re.fullmatch(r'[a-z0-9-]+', e['id'])
        for field in ['name', 'category', 'countries', 'kind', 'path', 'china', 'outbound', 'title', 'verdict', 'requirements', 'assessment', 'effort', 'renewal', 'next', 'sources']:
            assert e[field], (e['id'], field)
        assert all(s in sources for s in e['sources'])
        assert isinstance(e['titleRelevant'], bool)
    for s in sources.values():
        assert urlsplit(s['url']).scheme == 'https' and s['issuer'] and s['note']
    assert not re.search(r'\?{2,}|\ufffd', json.dumps(data, ensure_ascii=False))
    assert len({e['category'] for e in entries}) == 5
    assert all(sid in {s for e in entries for s in e['sources']} or sid == 'js-policy' for sid in sources)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base')
    parser.add_argument('--screenshots', type=Path)
    args = parser.parse_args()
    check_data(json.loads((ROOT / 'credentials/catalog.json').read_text(encoding='utf-8')))
    server = None
    if args.base:
        base = args.base.rstrip('/')
    else:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f'http://127.0.0.1:{server.server_port}'
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            context = browser.new_context(viewport={'width': 1440, 'height': 1050}, accept_downloads=True, reduced_motion='reduce')
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(base + '/credentials/')
            expect(page.locator('.record')).to_have_count(34, timeout=20000)
            expect(page.locator('#sourceCount')).to_have_text('53')
            expect(page.locator('#countryCount')).to_have_text('14')
            if args.base:
                response = context.request.get(base + '/credentials/catalog.json')
                assert response.ok
                check_data(response.json())
                assert "script-src 'self'" in context.request.get(base + '/credentials/').headers.get('content-security-policy', '')
            if args.screenshots:
                args.screenshots.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(args.screenshots / 'credentials-desktop.png'))
            page.locator('#search').fill('俄罗斯')
            expect(page.locator('.record')).to_have_count(2)
            page.locator('#reset').click()
            page.locator('#country').select_option('法国')
            expect(page.locator('.record')).to_have_count(1)
            page.locator('#item-dr-fr > summary').focus()
            page.keyboard.press('Enter')
            expect(page.locator('#item-dr-fr')).to_have_attribute('open', '')
            page.locator('#reset').click()
            page.locator('[data-category="工程与建设"]').click()
            expect(page.locator('.record')).to_have_count(9)
            page.locator('#titleOnly').check()
            expect(page.locator('.record')).to_have_count(6)
            page.locator('#reset').click()
            page.locator('#search').fill('AWS')
            with page.expect_download() as pending:
                page.locator('#exportCsv').click()
            download = pending.value
            rows = list(csv.reader(io.StringIO(Path(download.path()).read_text(encoding='utf-8-sig'))))
            assert len(rows) == 3 and '原文链接' in rows[0]
            assert all('https://' in row[-1] and row[-2] == '2026-10-29' for row in rows[1:])
            page.locator('#search').fill('no-matching-credential-xyz')
            expect(page.locator('#empty')).to_be_visible()
            expect(page.locator('#exportCsv')).to_be_disabled()
            # A deep link must reset incompatible filters and open the requested entry.
            page.locator('.quick-card.warm').click()
            expect(page.locator('#item-rae')).to_have_attribute('open', '')
            expect(page.locator('#item-rae')).to_contain_text('全俄社会组织')
            page.locator('#search').fill('no-matching-credential-xyz')
            page.locator('.quick-card.warm').click()
            expect(page.locator('#item-rae')).to_have_attribute('open', '')
            for sid in ['jian', 'ceng', 'pe-us']:
                page.locator('#item-' + sid + ' > summary').click()
                page.locator('[data-compare="' + sid + '"]').check()
            page.locator('#item-ciob > summary').click()
            page.locator('[data-compare="ciob"]').click()
            expect(page.locator('[data-compare="ciob"]')).not_to_be_checked()
            expect(page.locator('#notice')).to_contain_text('最多比较3项')
            expect(page.locator('#notice')).to_be_hidden(timeout=7000)
            page.locator('#showCompare').click()
            expect(page.locator('#comparison')).to_be_visible()
            expect(page.locator('#compareTable thead th')).to_have_count(4)
            expect(page.locator('#compareTable')).to_contain_text('一级建造师')
            expect(page.locator('#compareTable')).to_contain_text('PE考试通过不等于')
            if args.screenshots:
                page.screenshot(path=str(args.screenshots / 'credentials-comparison.png'))
            page.locator('[data-remove="ceng"]').click()
            expect(page.locator('#compareTable thead th')).to_have_count(3)
            page.locator('#clearCompare').click()
            expect(page.locator('#compareTray')).to_be_hidden()
            page.locator('#goal').select_option('title')
            page.locator('#region').select_option('jiangsu')
            expect(page.locator('#planOutput')).to_contain_text('海外工作经历')
            page.locator('#goal').select_option('honor')
            expect(page.locator('#planOutput')).to_contain_text('成员类别')
            for width in [390, 768]:
                page.set_viewport_size({'width': width, 'height': 844})
                page.goto(base + '/credentials/#item-aws-pro')
                expect(page.locator('#item-aws-pro')).to_have_attribute('open', '', timeout=20000)
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
                page.locator('#country').select_option('日本')
                expect(page.locator('.record')).to_have_count(1)
                page.locator('#reset').click()
                page.locator('#item-dr-ae > summary').click()
                expect(page.locator('#item-dr-ae')).to_contain_text('阿联酋公民')
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
                if args.screenshots and width == 390:
                    page.locator('#item-dr-ae').scroll_into_view_if_needed()
                    page.screenshot(path=str(args.screenshots / 'credentials-mobile-detail.png'))
                    page.goto(base + '/credentials/')
                    expect(page.locator('.record')).to_have_count(34)
                    page.screenshot(path=str(args.screenshots / 'credentials-mobile.png'))
            if not args.base:
                page.route('**/credentials/catalog.json', lambda r: r.fulfill(status=503, json={}))
                page.goto(base + '/credentials/')
                expect(page.locator('#loadError')).to_be_visible()
                page.unroute('**/credentials/catalog.json')
                page.locator('#retry').click()
                expect(page.locator('.record')).to_have_count(34)
            page.goto(base + '/')
            expect(page.locator('.site-card')).to_have_count(13)
            expect(page.locator('.site-card a[href="/credentials/"]')).to_be_visible()
            assert not errors, errors
            context.close()
            browser.close()
        print(json.dumps({'passed': True, 'base': base, 'entries': 34, 'sources': 53, 'browser_errors': errors, 'checks': ['data integrity and source references', 'country/category/title filters', 'CSV content and provenance', 'deep links with active filters', 'compare, 3-item limit and removal', 'regional career prompts', 'desktop/mobile/tablet overflow', 'loading error/retry locally', 'homepage entry preserved']}, ensure_ascii=False))
    finally:
        if server:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    main()
