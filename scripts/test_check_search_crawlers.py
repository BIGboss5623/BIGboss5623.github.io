from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).parent))
from check_search_crawlers import evaluate,HOSTS,AGENTS
assert len(HOSTS)==3 and set(AGENTS)=={'Baiduspider','Googlebot','bingbot'}
sample='User-agent: Baiduspider\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /\n\nUser-agent: bingbot\nAllow: /\n\nUser-agent: *\nAllow: /\nSitemap: https://zgland.com/sitemap.xml\n'
r=evaluate(sample,'zgland.com')
assert r['permissions']=={'Baiduspider':False,'Googlebot':True,'bingbot':True},r
assert r['sitemap_declared']
assert not evaluate(sample,'hzct.zgland.com')['sitemap_declared']
print('PASS: robots policy monitor identifies blocked Baiduspider, allowed search crawlers and correct sitemap')
