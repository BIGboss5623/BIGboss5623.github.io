"""Exercise the guide and lighter portal without installing AI or remote services."""
import argparse
import functools
import http.server
import json
import re
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
CSP = "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def end_headers(self):
        if self.path.startswith('/local-ai/'):
            self.send_header('Content-Security-Policy', CSP)
        super().end_headers()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base')
    parser.add_argument('--screenshots', type=Path)
    args = parser.parse_args()
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
            context = browser.new_context(permissions=['clipboard-read', 'clipboard-write'])
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('console', lambda message: errors.append(message.text) if message.type == 'error' and 'Content Security Policy' in message.text else None)
            # Test visible expiry colors deterministically; this is not a live RDAP check.
            context.route('**/api/domain-expiry*', lambda route: route.fulfill(status=503, content_type='application/json', body='{}'))
            for width in (1440, 390):
                page.set_viewport_size({'width': width, 'height': 1000})
                assert page.goto(base + '/').status == 200
                expect(page.locator('.site-card')).to_have_count(14)
                page.locator('#siteSearch').fill('DeepSeek')
                expect(page.locator('.site-card:visible')).to_have_count(1)
                expect(page.locator('.site-card:visible')).to_contain_text('本地 AI 与远程控制')
                page.locator('#siteSearch').press('Escape')
                page.locator('[data-filter="tools"]').click()
                expect(page.locator('.site-card:visible')).to_have_count(6)
                page.locator('[data-filter="all"]').click()
                expect(page.locator('.site-card:visible')).to_have_count(14)
                assert page.evaluate("getComputedStyle(document.documentElement).colorScheme") == 'light'
                assert not page.evaluate('document.documentElement.scrollWidth > innerWidth + 2')
                if args.screenshots:
                    args.screenshots.mkdir(parents=True, exist_ok=True)
                    page.screenshot(path=str(args.screenshots / f'portal-{width}.png'), full_page=True)
                response = page.goto(base + '/local-ai/')
                assert response.status == 200
                assert "connect-src 'none'" in response.headers['content-security-policy']
                expect(page).to_have_title(re.compile('本地 AI 部署'))
                expect(page.locator('h1')).to_have_count(1)
                assert page.locator('.chapter').count() == 10
                assert not page.evaluate('document.documentElement.scrollWidth > innerWidth + 2')
                assert not re.search(r'\?{3,}|\ufffd', page.locator('body').inner_text())
                # Every chapter target must exist, and off-site resource links are HTTPS.
                for href in page.locator('.contents a').evaluate_all('(items) => items.map(x => x.getAttribute("href"))'):
                    expect(page.locator(href)).to_have_count(1)
                assert page.locator('.resource-list a[href^="https://"]').count() == 20
                page.locator('#memoryPlan').select_option('16')
                expect(page.locator('#planResult')).to_contain_text('7B / 8B')
                page.locator('#memoryPlan').select_option('64')
                expect(page.locator('#planResult')).to_contain_text('32B')
                page.locator('#memoryPlan').select_option('32')
                block = page.locator('pre').first
                command = block.locator('code').inner_text()
                block.get_by_role('button', name='复制命令').click()
                expect(page.locator('#copyStatus')).to_contain_text('已复制')
                assert page.evaluate('navigator.clipboard.readText()').replace('\r\n', '\n') == command.replace('\r\n', '\n')
                page.locator('[data-check="capacity"]').check()
                page.reload()
                expect(page.locator('[data-check="capacity"]')).to_be_checked()
                expect(page.locator('#checkProgress')).to_contain_text('1 / 9')
                page.locator('#resetChecks').click()
                expect(page.locator('#checkProgress')).to_contain_text('0 / 9')
                page.locator('#troubleshoot details').first.locator('summary').click()
                expect(page.locator('#troubleshoot details').first).to_have_attribute('open', '')
                # Printing opens details and restores the previous state afterward.
                page.evaluate("window.dispatchEvent(new Event('beforeprint'))")
                assert page.locator('details:not([open])').count() == 0
                page.evaluate("window.dispatchEvent(new Event('afterprint'))")
                assert page.locator('details:not([open])').count() > 0
                page.evaluate('window.scrollTo(0, 0)')
                if args.screenshots:
                    page.screenshot(path=str(args.screenshots / f'local-ai-top-{width}.png'))
                    page.screenshot(path=str(args.screenshots / f'local-ai-{width}.png'), full_page=True)
            assert not errors, errors
            browser.close()
        print(json.dumps({'result': 'PASS', 'checks': ['desktop/mobile', 'light portal search and categories', 'chapter anchors', 'copy exact commands', 'memory planner', 'persistent checklist/reset', 'print details', 'CSP/no script errors']}, ensure_ascii=False))
    finally:
        if server:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    main()
