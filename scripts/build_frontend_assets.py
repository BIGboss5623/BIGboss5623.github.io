"""Fingerprint active frontend assets so cached older deployments cannot win."""
import hashlib
import re
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ("assets/operations.css", "assets/site-stats.js", "assets/js/site-tools.js", "assets/subpages.css", "network/network.js", "proxy/game.js",
          "hzyx/site.js", "history-cycle/app.js", "history-cycle/usability.css",
          "assets/js/site.js", "assets/css/usability.css", "assets/portal.js", "assets/portal.css", "quant-console/console.js",
          "games/rich4/rich4.css", "games/rich4/rich4.js", "assets/domain-expiry.css", "assets/domain-expiry.js",
          "credentials/style.css", "credentials/app.js", "local-ai/guide.css", "local-ai/guide.js")


def main():
    versions = {}
    for relative in ASSETS:
        source = ROOT / relative
        if not source.is_file():
            continue
        content = source.read_bytes().replace(b'\r\n', b'\n')
        digest = hashlib.sha256(content).hexdigest()[:12]
        name = source.stem + "." + digest + source.suffix
        target = source.with_name(name)
        if not target.exists():
            target.write_bytes(content)
        versions[source.resolve()] = name

def prune_superseded(versions):
    """Remove all but the two newest fingerprints per source, never touching a name a page still references."""
    referenced = set()
    for page in list(ROOT.glob("*.html")) + [ROOT / d / "index.html" for d in
            ("fund", "fund/workbench", "proxy", "network", "hzyx", "history-cycle", "domain-console",
             "quant-console", "games", "games/rich4", "credentials", "local-ai", "site-stats", "site-blueprint")]:
        if page.is_file():
            referenced |= set(re.findall(r'(?:src|href)="([^"]+)"', page.read_text(encoding="utf-8", errors="utf-8-sig")))
    live = {Path(urlsplit(ref).path).name for ref in referenced if urlsplit(ref).path}
    for relative in ASSETS:
        source = ROOT / relative
        if not source.is_file():
            continue
        pattern = source.stem + ".*" + source.suffix
        siblings = [item for item in source.parent.glob(pattern) if re.fullmatch(re.escape(source.stem) + r"\.[0-9a-f]{12}" + re.escape(source.suffix), item.name)]
        if len(siblings) <= 2:
            continue
        siblings.sort(key=lambda item: (item.stat().st_mtime, item.name), reverse=True)
        for stale in siblings[2:]:
            if stale.name in live:
                continue
            stale.unlink()
            print(f"Pruned superseded fingerprint: {stale.relative_to(ROOT)}")


    pages = list(ROOT.glob("*.html")) + [ROOT / d / "index.html" for d in
            ("fund", "fund/workbench", "proxy", "network", "hzyx", "history-cycle", "domain-console", "quant-console", "games", "games/rich4", "credentials", "local-ai", "site-stats", "site-blueprint")]
    for page in pages:
        if not page.is_file():
            continue
        def rewrite(match):
            attr, value = match.group(1), match.group(2)
            url = urlsplit(value)
            if url.netloc and url.hostname != "zgland.com":
                return match.group(0)
            path = Path(url.path)
            if not path.name or (re.match(r'^[a-z][a-z0-9+.-]*:', value, re.I) and url.scheme not in ('http', 'https')):
                return match.group(0)
            canonical = path.with_name(re.sub(r"\.[a-f0-9]{12}(?=\.[^.]+$)", "", path.name))
            base = ROOT if url.netloc or url.path.startswith("/") else page.parent
            resolved = (base / str(canonical).lstrip("/\\")).resolve()
            if resolved not in versions:
                return match.group(0)
            new_path = str(path.with_name(versions[resolved])).replace("\\", "/")
            return attr + '="' + urlunsplit((url.scheme, url.netloc, new_path, "", url.fragment)) + '"'
        old = page.read_text(encoding="utf-8")
        new = re.sub(r'(src|href)="([^"]+)"', rewrite, old)
        if old != new:
            page.write_bytes(new.encode("utf-8"))
    prune_superseded(versions)
    print("Frontend asset fingerprints prepared.")


if __name__ == "__main__":
    main()
