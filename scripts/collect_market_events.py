"""Archive public headline metadata; candidates are never trading signals."""
import argparse
import hashlib
import html
import json
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

WATCH = ('600418', '跌停', '立案调查', '重大事故', '召回', '退市')
TRIGGERS = ('跌停', '立案', '调查', '重大事故', '召回', '退市', '违约', '财务造假')


def collect(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    existing = {event['url']: event for event in data['events']}
    now = datetime.now(timezone(timedelta(hours=8)))
    errors = []
    successful = 0
    for keyword in WATCH:
        param = {'uid':'', 'keyword':keyword, 'type':['cmsArticleWebOld'], 'client':'web',
                 'clientType':'web', 'clientVersion':'curr', 'param':{'cmsArticleWebOld':{
                 'searchScope':'default','sort':'latest','pageIndex':1,'pageSize':20,'preTag':'','postTag':''}}}
        url = 'https://search-api-web.eastmoney.com/search/jsonp?' + urlencode({'cb':'eventwatch','param':json.dumps(param, ensure_ascii=False)})
        try:
            with urlopen(Request(url, headers={'User-Agent':'Mozilla/5.0'}), timeout=20) as response:
                text = response.read(2_000_000).decode('utf-8')
            payload = json.loads(text[text.index('(')+1:text.rindex(')')])
            rows = payload['result']['cmsArticleWebOld']
            if not isinstance(rows, list):
                raise ValueError('unexpected source schema')
            successful += 1
            for row in rows:
                title = html.unescape(re.sub('<[^>]+>', '', str(row.get('title',''))))
                if not any(word in title for word in TRIGGERS):
                    continue
                published = str(row.get('date',''))
                try:
                    event_date = datetime.fromisoformat(published).replace(tzinfo=now.tzinfo)
                except ValueError:
                    continue
                if event_date > now or (now-event_date).days > 30:
                    continue
                code = str(row.get('code',''))
                if not code.isdigit():
                    continue
                link = 'https://finance.eastmoney.com/a/' + code + '.html'
                if link in existing:
                    continue
                existing[link] = {'id':hashlib.sha256(link.encode()).hexdigest()[:16],
                    'title':title[:200], 'published_at':published, 'recorded_at':now.isoformat(timespec='seconds'),
                    'symbols':[keyword] if keyword.isdigit() else [], 'source':str(row.get('mediaName','东方财富检索'))[:80],
                    'url':link, 'status':'自动收集·待核实', 'category':'重大风险候选',
                    'summary':'按标题风险关键词筛选，需点击来源核实公告与后续进展。',
                    'market_observation':'尚未独立核验价格影响；不自动判断利空、跌停原因或买卖动作。'}
        except Exception as exc:
            errors.append({'keyword':keyword,'error':type(exc).__name__})
    data['events'] = sorted(existing.values(), key=lambda row:row['published_at'], reverse=True)
    data['last_attempted'] = now.isoformat(timespec='seconds')
    if successful:
        data['last_checked'] = now.isoformat(timespec='seconds')
    data['collection_errors'] = errors
    temp = path.with_suffix('.json.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    temp.replace(path)
    print(f'Checked {successful}/{len(WATCH)} queries; retained {len(existing)} event records.')
    if not successful:
        raise RuntimeError('All sources failed; old events retained, freshness unchanged')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1]/'fund/events.json')
    collect(parser.parse_args().output)
