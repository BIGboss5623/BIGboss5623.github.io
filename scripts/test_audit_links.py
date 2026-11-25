"""Clean-page aliases must resolve to their actual sources, not mask broken links."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from audit_links import ROOT,resolve_published_html
assert resolve_published_html(ROOT/'company') == ROOT/'company.html'
assert resolve_published_html(ROOT/'help') == ROOT/'help.html'
assert resolve_published_html(ROOT/'guides/remote-ssh') == ROOT/'guides/remote-ssh/index.html'
assert not resolve_published_html(ROOT/'completely-missing-SEO-test').exists()
print('PASS: clean URL rewrite checks retain missing-file detection')
