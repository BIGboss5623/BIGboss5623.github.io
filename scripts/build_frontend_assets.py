"""Build fingerprinted frontend assets, rewrite current page references and prune stale copies."""

import hashlib
import re
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]
ASSETS = (
    "assets/operations.css", "assets/site-stats.js", "assets/js/site-tools.js",
    "assets/subpages.css", "network/network.js", "proxy/game.js",
    "hzyx/site.js", "history-cycle/app.js", "history-cycle/usability.css",
    "assets/js/site.js", "assets/css/usability.css", "assets/portal.js",
    "assets/portal.css", "quant-console/console.js", "games/rich4/rich4.css",
    "games/rich4/rich4.js", "assets/domain-expiry.css",
    "assets/domain-expiry.js", "credentials/style.css", "credentials/app.js",
    "local-ai/guide.css", "local-ai/guide.js",
)
PAGE_DIRS = (
    "fund", "fund/workbench", "proxy", "network", "hzyx",
    "history-cycle", "domain-console", "quant-console", "games",
    "games/rich4", "credentials", "local-ai", "site-stats", "site-blueprint",
)
FINGERPRINT = r"\.[0-9a-f]{12}(?=\.[^.]+$)"


def active_pages():
    pages = list(ROOT.glob("*.html"))
    pages.extend(ROOT / directory / "index.html" for directory in PAGE_DIRS)
    return [page for page in pages if page.is_file()]


def fingerprint_assets():
    versions = {}
    for relative in ASSETS:
        source = ROOT / relative
        if not source.is_file():
            continue
        content = source.read_bytes().replace(b"\r\n", b"\n")
        digest = hashlib.sha256(content).hexdigest()[:12]
        target = source.with_name(f"{source.stem}.{digest}{source.suffix}")
        if not target.exists():
            target.write_bytes(content)
        versions[source.resolve()] = target.name
    return versions


def update_page_references(versions):
    for page in active_pages():
        def rewrite(match):
            attr, value = match.group(1), match.group(2)
            url = urlsplit(value)
            if url.netloc and url.hostname != "zgland.com":
                return match.group(0)
            path = Path(url.path)
            if not path.name or (re.match(r"^[a-z][a-z0-9+.-]*:", value, re.I)
                                 and url.scheme not in ("http", "https")):
                return match.group(0)
            canonical = path.with_name(re.sub(FINGERPRINT, "", path.name))
            base = ROOT if url.netloc or url.path.startswith("/") else page.parent
            resolved = (base / str(canonical).lstrip("/\\")).resolve()
            if resolved not in versions:
                return match.group(0)
            new_path = str(path.with_name(versions[resolved])).replace("\\", "/")
            return attr + '="' + urlunsplit((url.scheme, url.netloc, new_path,
                                              url.query, url.fragment)) + '"'

        old = page.read_text(encoding="utf-8")
        new = re.sub(r'(src|href)="([^"]+)"', rewrite, old)
        if old != new:
            page.write_bytes(new.encode("utf-8"))


def prune_superseded(versions):
    """Preserve the active and one rollback version, never deleting referenced files."""
    # Scan all HTML for references, including pages outside the normal build list.
    referenced = set()
    for page in ROOT.rglob("*.html"):
        if ".git" in page.relative_to(ROOT).parts or "本地留档" in page.relative_to(ROOT).parts:
            continue
        referenced.update(
            re.findall(r'(?:src|href)="([^"]+)"',
                       page.read_text(encoding="utf-8", errors="replace"))
        )
    live = {Path(urlsplit(ref).path).name for ref in referenced if urlsplit(ref).path}

    for relative in ASSETS:
        source = ROOT / relative
        if not source.is_file():
            continue
        regex = re.compile(re.escape(source.stem) +
                           r"\.[0-9a-f]{12}" + re.escape(source.suffix) + "$")
        siblings = [file for file in source.parent.glob(source.stem + ".*" + source.suffix)
                    if regex.fullmatch(file.name) and file.is_file()]
        if len(siblings) <= 2:
            continue
        siblings.sort(key=lambda file: (file.stat().st_mtime, file.name), reverse=True)
        keep = {versions[source.resolve()]}
        keep.update(file.name for file in siblings if file.name in live)
        if len(keep) < 2:
            fallback = next((file for file in siblings if file.name not in keep), None)
            if fallback is not None:
                keep.add(fallback.name)
        if len(keep) > 2:
            print(f"NOTICE: {relative} has {len(keep)} referenced versions; no live file deleted.")
        for stale in siblings:
            if stale.name not in keep:
                stale.unlink()
                print(f"Pruned obsolete asset: {stale.relative_to(ROOT)}")


def main():
    versions = fingerprint_assets()
    update_page_references(versions)
    prune_superseded(versions)
    print("Frontend asset fingerprint update and cleanup completed.")


if __name__ == "__main__":
    main()
