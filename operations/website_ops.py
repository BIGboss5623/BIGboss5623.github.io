"""Website statistics, authenticated edge bridge, mail delivery and daily scheduling.

Runs in the existing server process. Configuration and SQLite live outside code.
"""
import base64
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import math
import os
from pathlib import Path
import re
import secrets
import threading
import time
from urllib.request import Request, build_opener, ProxyHandler, HTTPRedirectHandler
from urllib.parse import urlencode, urlsplit

from security_core import Security, Paused, client_ip

TZ = timezone(timedelta(hours=8))
DEFAULT_RECIPIENT = '648974542@qq.com'
BOT = re.compile(r'bot|crawler|spider|headless|curl|wget|python|preview|facebookexternalhit', re.I)
HOSTS = {'zgland.com','www.zgland.com','hzct.zgland.com','feitianshan.zgland.com',
         'network.zgland.com','proxy.zgland.com','hzyx.zgland.com','fund.zgland.com',
         'history-cycle.zgland.com','quant.zgland.com','files.zgland.com',
         'credentials.zgland.com','local-ai.zgland.com','games.zgland.com','domain-console.zgland.com'}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *_):
        return None


def https_json(url, data=None, headers=None):
    if not url.startswith('https://'):
        raise ValueError('HTTPS required')
    opener = build_opener(ProxyHandler({}), NoRedirect())
    with opener.open(Request(url, data=data, headers={'User-Agent':'ZGLAND-Operations/1.0', **(headers or {})}), timeout=20) as response:
        raw = response.read(262145)
        if len(raw) > 262144:
            raise ValueError('Response too large')
        return json.loads(raw)


def send_mail(subject, message, recipient=DEFAULT_RECIPIENT):
    form = urlencode({'_subject':subject,'_template':'table','_captcha':'false',
                      '通知内容':message,'网站':'https://zgland.com/'}).encode('utf-8')
    result = https_json('https://formsubmit.co/ajax/'+recipient, form,
                        {'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
                         'Accept':'application/json','Origin':'https://zgland.com','Referer':'https://zgland.com/'})
    if result.get('success') not in (True, 'true'):
        raise RuntimeError('Mail provider did not accept notification')


def due_domain(expiry, today, monthly_sent=False, daily_sent=False):
    days = (expiry-today).days
    if days <= 30:
        return None if daily_sent else 'daily'
    return None if monthly_sent else 'monthly'


def significant(current, baseline):
    return abs(current-baseline) >= 20 and (baseline == 0 or abs(current-baseline)/baseline >= .30)


class Operations:
    def __init__(self, folder, notifications_only=False, config_path=None):
        self.folder = Path(folder)
        self.security = Security(self.folder/'operations.sqlite3')
        self.notifications_only = notifications_only
        config_file=Path(config_path) if config_path else self.folder/'config.json'
        self.config = {'recipient':DEFAULT_RECIPIENT} if notifications_only else json.loads(config_file.read_text(encoding='utf-8'))
        self.stop = threading.Event()
        self.last_schedule = 0
        self.summary_cache = (0, None)
        with self.security.db() as db:
            db.executescript('''
            CREATE TABLE IF NOT EXISTS hits(day TEXT,host TEXT,path TEXT,pv INTEGER NOT NULL,PRIMARY KEY(day,host,path));
            CREATE TABLE IF NOT EXISTS visitors(day TEXT,host TEXT,visitor TEXT,hits INTEGER,last REAL,PRIMARY KEY(day,host,visitor));
            CREATE TABLE IF NOT EXISTS recent(day TEXT,host TEXT,visitor TEXT,path TEXT,last REAL,PRIMARY KEY(day,host,visitor,path));
            CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
            ''')
            db.execute('INSERT OR IGNORE INTO meta VALUES(?,?)',('tracking_started',datetime.now(TZ).isoformat()))

    def start(self):
        if os.environ.get('ZGLAND_MAIL_DISABLED')=='1':
            return  # Explicit local test/dry-run process only; never a request parameter.
        thread = threading.Thread(target=self.worker, daemon=True, name='website-operations')
        thread.start()

    def validate_signed(self, raw, headers):
        timestamp = headers.get('X-Zg-Time','')
        signature = headers.get('X-Zg-Signature','')
        try:
            if abs(time.time()-int(timestamp)) > 60:
                return False
        except (TypeError, ValueError):
            return False
        expected = hmac.new(bytes.fromhex(self.config['edge_key']), timestamp.encode()+b'\n'+raw, 'sha256').hexdigest()
        return len(signature) == 64 and hmac.compare_digest(signature, expected)

    def verify(self, service, password, ip, purpose):
        if service == 'domain-console':
            def check():
                return hmac.compare_digest(hashlib.sha256(password.encode()).hexdigest(), self.config['domain_digest'])
        else:
            raise ValueError('Unknown password service')
        return self.security.verify(service, check, ip, purpose)

    def hit(self, data):
        host = data.get('host','')
        path = data.get('path','')
        agent = str(data.get('agent',''))[:200]
        if host not in HOSTS or not isinstance(path,str) or not path.startswith('/') or len(path)>200 or '?' in path or '#' in path:
            return False
        # Never publish arbitrary path names, document names, query strings or IDs.
        section = path.strip('/').split('/')[0]
        known = {'','index.html','about','about.html','company','company.html','contact','contact.html','help','help.html',
                 'privacy','privacy.html','company-home','fund','network','proxy','hzyx','history-cycle','quant-console',
                 'domain-console','credentials','local-ai','games','site-stats','site-blueprint','login','catalog','document','page'}
        path = '/' if section in {'','index.html'} else '/'+(section if section in known else 'other')+'/'
        if not agent or BOT.search(agent):
            return False
        now = time.time()
        day = datetime.fromtimestamp(now,TZ).date().isoformat()
        visitor = hmac.new(bytes.fromhex(self.config['visitor_key']), (day+'|'+str(data.get('ip','unknown'))+'|'+agent).encode(), 'sha256').hexdigest()
        with self.security.db() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT hits FROM visitors WHERE day=? AND host=? AND visitor=?', (day,host,visitor)).fetchone()
            recent = db.execute('SELECT last FROM recent WHERE day=? AND host=? AND visitor=? AND path=?', (day,host,visitor,path)).fetchone()
            if (row and row[0] >= 1000) or (recent and recent[0]>now-10):
                return False
            db.execute('INSERT INTO hits VALUES(?,?,?,1) ON CONFLICT(day,host,path) DO UPDATE SET pv=pv+1', (day,host,path))
            db.execute('INSERT INTO visitors VALUES(?,?,?,1,?) ON CONFLICT(day,host,visitor) DO UPDATE SET hits=hits+1,last=excluded.last', (day,host,visitor,now))
            db.execute('INSERT OR REPLACE INTO recent VALUES(?,?,?,?,?)', (day,host,visitor,path,now))
        return True

    def stats(self):
        now = time.time()
        if self.summary_cache[0] > now-60:
            return self.summary_cache[1]
        today = datetime.now(TZ).date()
        start = (today-timedelta(days=29)).isoformat()
        with self.security.db() as db:
            visits = dict(db.execute('SELECT day,SUM(pv) FROM hits WHERE day>=? GROUP BY day',(start,)))
            visitors = dict(db.execute('SELECT day,COUNT(DISTINCT visitor) FROM visitors WHERE day>=? GROUP BY day',(start,)))
            hosts = [{'host':h,'pv':p,'visitors':db.execute('SELECT COUNT(DISTINCT visitor) FROM visitors WHERE host=? AND day>=?',(h,start)).fetchone()[0]}
                     for h,p in db.execute('SELECT host,SUM(pv) FROM hits WHERE day>=? GROUP BY host ORDER BY SUM(pv) DESC',(start,))]
            pages = [{'host':h,'path':p,'pv':n} for h,p,n in db.execute('SELECT host,path,SUM(pv) FROM hits WHERE day>=? GROUP BY host,path ORDER BY SUM(pv) DESC LIMIT 20',(start,))]
            first = db.execute('SELECT MIN(day) FROM hits').fetchone()[0]
        daily = [{'day':(today-timedelta(days=i)).isoformat(),'pv':visits.get((today-timedelta(days=i)).isoformat(),0),
                  'visitors':visitors.get((today-timedelta(days=i)).isoformat(),0)} for i in range(29,-1,-1)]
        result = {'ok':True,'time_zone':'UTC+08:00','updated_at':datetime.now(TZ).isoformat(),'first_recorded_day':first,
                  'today':daily[-1],'daily':daily,'hosts':hosts,'pages':pages,'automations_enabled':True,
                  'method':'浏览器页面浏览计数；不使用Cookie；UV为每日IP与浏览器标识的加盐摘要估算，跨日相加为人次。尊重DNT/GPC，排除常见机器人，不能代表精确人数。',
                  'change_rule':'完整自然日PV较前一天变化至少30%且至少20次，每天最多一封。原始IP不落统计库。'}
        self.summary_cache = (now,result)
        return result

    def schedule(self):
        now = datetime.now(TZ)
        if now.hour < 10:
            return
        today = now.date()
        yesterday = (today-timedelta(days=1)).isoformat()
        previous = (today-timedelta(days=2)).isoformat()
        with self.security.db() as db:
            rows = dict(db.execute('SELECT day,SUM(pv) FROM hits WHERE day IN (?,?) GROUP BY day',(yesterday,previous)))
            started = datetime.fromisoformat(db.execute("SELECT value FROM meta WHERE key='tracking_started'").fetchone()[0]).date()
            a,b = rows.get(yesterday,0),rows.get(previous,0)
            if datetime.fromisoformat(previous).date() > started and significant(a,b):
                self.security.queue(db,'traffic:'+yesterday,'【访问数据变化】'+yesterday,
                    'UTC+8完整自然日：%s\n页面浏览量：%d；前一天：%d；变化：%+d。\n阈值：至少30%%且至少20次。每天最多一次。\n查看汇总：https://zgland.com/site-stats/'%(yesterday,a,b,a-b))
        # Fetch dates every hour, not on every queue cycle. Snapshot explicitly marked.
        try:
            payload = https_json('https://zgland.com/api/domain-expiry')
            if not payload.get('ok'):
                raise ValueError('No expiry date')
            expiry = datetime.fromisoformat(payload['expiry_date']).date()
            source = payload.get('source_label','注册局')
            if payload.get('warning'):
                source += '（'+payload['warning']+'）'
        except Exception:
            expiry = datetime.fromisoformat(self.config['expiry_snapshot']).date()
            source = '部署时的备用日期，实时查询失败，请到注册商核实，不能据此认定已续费'
        period = today.isoformat() if (expiry-today).days<=30 else today.strftime('%Y-%m')
        key = 'domain:'+period
        with self.security.db() as db:
            days = (expiry-today).days
            self.security.queue(db,key,'【域名到期%s】zgland.com 剩余%d天'%('每日提醒' if days<=30 else '月报',days),
                '域名：zgland.com（各子域名共用此注册期限）\n到期日：%s\n剩余：%d天\n来源：%s\n规则：每月一封，到期前30天及逾期每天一封。\n续费入口：https://dc.console.aliyun.com/next/index#/domain-list/all'%(expiry,days,source))
            cutoff = (today-timedelta(days=90)).isoformat()
            db.execute('DELETE FROM hits WHERE day<?',(cutoff,))
            db.execute('DELETE FROM visitors WHERE day<?',(cutoff,))
            db.execute('DELETE FROM recent WHERE day<?',((today-timedelta(days=1)).isoformat(),))
            db.execute('DELETE FROM mail WHERE sent IS NOT NULL AND sent<?',(time.time()-90*86400,))

    def deliver_one(self):
        now = time.time()
        with self.security.db() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT id,subject,message,attempts FROM mail WHERE sent IS NULL AND due<=? ORDER BY created LIMIT 1',(now,)).fetchone()
            if not row:
                return False
            # Lease prevents two workers from sending simultaneously after a restart.
            db.execute('UPDATE mail SET due=? WHERE id=?',(now+120,row[0]))
        try:
            send_mail(row[1],row[2],self.config.get('recipient',DEFAULT_RECIPIENT))
        except Exception as error:
            with self.security.db() as db:
                db.execute('UPDATE mail SET attempts=attempts+1,due=? WHERE id=?',(now+min(21600,300*2**min(row[3],6)),row[0]))
            print('Website notification pending retry:',type(error).__name__,flush=True)
        else:
            with self.security.db() as db:
                db.execute('UPDATE mail SET sent=? WHERE id=?',(time.time(),row[0]))
        return True

    def worker(self):
        while not self.stop.is_set():
            try:
                if not self.notifications_only and time.time()-self.last_schedule > 3600:
                    self.schedule()
                    self.last_schedule = time.time()
                if self.deliver_one():
                    self.stop.wait(2)
                    continue
            except Exception as error:
                print('Website operations retry:',type(error).__name__,flush=True)
            self.stop.wait(30)

    def handle(self, handler):
        route = urlsplit(handler.path).path
        if not route.startswith('/site-ops/'):
            return False
        def reply(data,status=200,mime='application/json; charset=utf-8',extra=None):
            raw = data if isinstance(data,bytes) else json.dumps(data,ensure_ascii=False).encode()
            handler.send_response(status)
            for k,v in {'Content-Type':mime,'Content-Length':str(len(raw)),'Cache-Control':'no-store',
                        'X-Content-Type-Options':'nosniff',**(extra or {})}.items():
                handler.send_header(k,v)
            handler.end_headers()
            handler.wfile.write(raw)
        if route == '/site-ops/stats' and handler.command == 'GET':
            reply(self.stats())
            return True
        if handler.command != 'POST':
            reply({'ok':False},405)
            return True
        try:
            size = int(handler.headers.get('Content-Length','0'))
            if not 0<size<=4096:
                reply({'ok':False},413)
                return True
            raw = handler.rfile.read(size)
            if not self.validate_signed(raw,handler.headers):
                reply({'ok':False},401)
                return True
            data = json.loads(raw)
            if route == '/site-ops/hit':
                reply({'ok':True,'counted':self.hit(data)})
            elif route == '/site-ops/verify':
                service = data.get('service','')
                password = data.get('password','')
                if not isinstance(password,str) or len(password)>512:
                    reply({'ok':False},400)
                elif not self.verify(service,password,data.get('ip','unknown'),data.get('purpose','密码验证')):
                    reply({'ok':False,'message':'密码不正确'},401)
                else:
                    reply({'ok':True})
            else:
                reply({'ok':False},404)
        except Paused as error:
            reply({'ok':False,'message':str(error),'paused_until':error.until},429,extra={'Retry-After':str(max(1,math.ceil(error.until-time.time())))})
        except (ValueError,TypeError,KeyError):
            reply({'ok':False,'message':'请求无效'},400)
        except Exception:
            reply({'ok':False,'message':'安全服务暂不可用，请稍后重试'},503)
        return True


_instance = None


def configured():
    global _instance
    folder = os.environ.get('ZGLAND_OPS_STATE')
    if folder and _instance is None:
        _instance = Operations(folder,config_path=os.environ.get('ZGLAND_OPS_CONFIG'))
        _instance.start()
    return _instance
