"""Read-only public SEO smoke test: GET only, never POST visit statistics."""
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from time import sleep
import sys

CHECKS = [
    ("https://zgland.com/tools/robots-checker/", "id=\"robots\""),
    ("https://zgland.com/tools/robots-checker/rules.js", "RobotsCheck"),
    ("https://zgland.com/tools/robots-checker/client.js", "querySelector"),
    ("https://zgland.com/guides/cloudflare-search-crawling/", "/tools/robots-checker/"),
    ("https://zgland.com/sitemap.xml", "https://zgland.com/tools/robots-checker/"),
    ("https://zgland.com/", "/tools/robots-checker/"),
]
def inspect(url, marker):
    req = Request(url, headers={
        "User-Agent": "ZGLAND-static-release-smoke/1.0",
        "Cache-Control": "no-cache",
        "Accept": "text/html,application/xml,application/javascript,text/javascript,*/*"
    })
    with urlopen(req, timeout=12) as response:
        body = response.read(210000).decode("utf-8", "replace")
        return response.status == 200 and marker in body, response.status
def main():
    for attempt in range(1,7):
        errors = []
        for url, marker in CHECKS:
            try:
                ok, status = inspect(url, marker)
                print(f"GET {url} HTTP={status} CONTENT_OK={ok}", flush=True)
                if not ok: errors.append(url)
            except (OSError, HTTPError, ValueError) as exc:
                print(f"GET {url} ERROR={type(exc).__name__}: {exc}", flush=True)
                errors.append(url)
        if not errors:
            print(f"PASS: {len(CHECKS)} production SEO smoke checks", flush=True)
            return 0
        print(f"Attempt {attempt}/6: {len(errors)} checks pending", flush=True)
        if attempt < 6: sleep(20)
    print("FAIL: production SEO content not verified", flush=True)
    return 1
if __name__ == "__main__":
    sys.exit(main())
