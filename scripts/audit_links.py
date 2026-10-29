"""Read-only checks of published HTML/CSS links in the two existing sites."""
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITES = {"zgland.com": ROOT, "www.zgland.com": ROOT, "hzct.zgland.com": ROOT,
         "feitianshan.zgland.com": ROOT.parent / "feitianshan"}
for folder in ("network", "proxy", "hzyx", "fund", "history-cycle", "domain-console", "quant-console", "games"):
    SITES[folder + ".zgland.com"] = ROOT / folder


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        key = "href" if tag in ("a", "link") else "src" if tag in ("img", "script", "source") else None
        if key and attrs.get(key):
            self.links.append((tag, attrs[key]))


def main():
    issues, checked = [], 0
    credential_ids = {"item-" + item["id"] for item in json.loads((ROOT / "credentials/catalog.json").read_text(encoding="utf-8"))["entries"]}
    for root in (ROOT, ROOT.parent / "feitianshan"):
        pages = list(root.glob("*.html"))
        if root == ROOT:
            pages += [root / folder / "index.html" for folder in ("fund", "proxy", "network", "hzyx", "history-cycle", "domain-console", "quant-console", "fund/workbench", "games", "games/rich4", "credentials", "local-ai")]
        for page in pages:
            parser = Links()
            parser.feed(page.read_text(encoding="utf-8"))
            for tag, href in parser.links:
                if href.lower().startswith(("tel:", "mailto:", "data:", "javascript:")):
                    continue
                url = urlsplit(href)
                if url.scheme and url.scheme not in ("https", "http"):
                    continue
                if url.netloc:
                    if url.hostname not in SITES:
                        continue
                    base = SITES[url.hostname]
                    target = base / unquote(url.path).lstrip("/")
                    if url.hostname == 'hzct.zgland.com' and url.path in ('', '/', '/index.html'):
                        target = ROOT / 'company-home.html'
                elif url.path.startswith("/"):
                    target = root / unquote(url.path).lstrip("/")
                else:
                    target = page.parent / unquote(url.path) if url.path else page
                if root == ROOT and url.path.startswith('/api/') and (not url.netloc or SITES.get(url.hostname)==ROOT):
                    route=Path(url.path.lstrip('/'))
                    function=ROOT/'functions'/route.with_suffix('.js')
                    if function.is_file():
                        checked += 1
                        continue
                if target.is_dir():
                    target /= "index.html"
                checked += 1
                if not target.is_file():
                    issues.append({"page": str(page.relative_to(root)), "link": href, "error": "missing file"})
                elif url.fragment and target.suffix == ".html":
                    other = Links()
                    other.feed(target.read_text(encoding="utf-8"))
                    if target.resolve() == (ROOT / "credentials/index.html").resolve():
                        other.ids.update(credential_ids)
                    if unquote(url.fragment) not in other.ids:
                        issues.append({"page": str(page.relative_to(root)), "link": href, "error": "missing anchor"})
        for css in root.glob("**/*.css"):
            if any(p in css.parts for p in ("old web", "本地留档", ".git")):
                continue
            for href in re.findall(r"url\(['\"]?([^)'\"]+)", css.read_text(encoding="utf-8")):
                if urlsplit(href).scheme or href.startswith("#"):
                    continue
                checked += 1
                if not (css.parent / unquote(href)).is_file():
                    issues.append({"page": str(css.relative_to(root)), "link": href, "error": "missing CSS asset"})
    print(json.dumps({"checked": checked, "issues": issues}, ensure_ascii=False, indent=2))
    raise SystemExit(bool(issues))


if __name__ == "__main__":
    main()
