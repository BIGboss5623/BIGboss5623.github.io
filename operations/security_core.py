"""Persistent password circuit breaker and private notification outbox (stdlib)."""
import contextlib
import ipaddress
import json
from pathlib import Path
import sqlite3
import time

LIMIT = 50
COOLDOWN = 3600


class Paused(ValueError):
    def __init__(self, until):
        self.until = until
        super().__init__('连续50次密码错误，相关服务已暂停1小时；剩余%d秒' % max(1, int(until-time.time())))


def client_ip(peer, headers):
    """Only the loopback cloudflared origin may supply CF-Connecting-IP. Never XFF."""
    try:
        address = ipaddress.ip_address(peer)
        if address.is_loopback:
            forwarded = headers.get('CF-Connecting-IP', '')
            if forwarded:
                return str(ipaddress.ip_address(forwarded))
        return str(address)
    except ValueError:
        return 'unknown'


class Security:
    def __init__(self, path, clock=time.time):
        self.path = Path(path)
        self.clock = clock
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.db() as db:
            db.executescript('''
            CREATE TABLE IF NOT EXISTS locks(service TEXT PRIMARY KEY, failures INTEGER NOT NULL, until REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS mail(id TEXT PRIMARY KEY, subject TEXT NOT NULL, message TEXT NOT NULL,
                created REAL NOT NULL, due REAL NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, sent REAL);
            CREATE TABLE IF NOT EXISTS success_notice(id TEXT PRIMARY KEY, at REAL NOT NULL);
            ''')

    @contextlib.contextmanager
    def db(self):
        db = sqlite3.connect(str(self.path), timeout=20)
        try:
            db.execute('PRAGMA busy_timeout=20000')
            db.execute('PRAGMA synchronous=FULL')
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def queue(self, db, key, subject, message):
        now = self.clock()
        db.execute('INSERT OR IGNORE INTO mail(id,subject,message,created,due) VALUES(?,?,?,?,?)',
                   (key, subject[:180], message[:12000], now, now))

    def paused_until(self, service):
        with self.db() as db:
            row = db.execute('SELECT until FROM locks WHERE service=?', (service,)).fetchone()
        return row[0] if row and row[0] > self.clock() else 0

    def require_available(self, service):
        until = self.paused_until(service)
        if until:
            raise Paused(until)

    def verify(self, service, verify_password, ip='unknown', purpose='密码验证', notice_key=None):
        """Check inside a cross-process transaction; even valid passwords cannot bypass a pause.

        No credentials are persisted. Errors in storage/verifier fail closed and do not
        pretend a password failure. Only actual submitted passwords count.
        """
        now = self.clock()
        ip = str(ip)[:64]
        purpose = str(purpose).replace('\r', ' ').replace('\n', ' ')[:240]
        with self.db() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT failures,until FROM locks WHERE service=?', (service,)).fetchone()
            failures, until = row or (0, 0)
            if until > now:
                # Exit the transaction normally before raising (keep prior state).
                paused = until
                good = False
            else:
                paused = 0
                if until:
                    failures = 0
                good = bool(verify_password())
                failures = 0 if good else failures + 1
                until = now + COOLDOWN if failures >= LIMIT else 0
                db.execute('INSERT OR REPLACE INTO locks VALUES(?,?,?)', (service, failures, until))
                detail = '时间(UTC epoch)：%.0f\n服务：%s\nIP：%s\n操作目的：%s\n' % (now, service, ip, purpose)
                if until:
                    self.queue(db, 'lock:%s:%.6f' % (service, now), '【安全保护】%s 连错50次，暂停1小时' % service,
                               detail+'结果：已全局暂停此服务的密码验证，持续3600秒。切换IP或重启不会解除。\n不记录密码；此通知不代表已发生入侵。')
                    paused = until
                elif good:
                    # Basic credentials accompany every API request. Notify once per
                    # client/10min, while explicit browser logins always get a notice.
                    prior = db.execute('SELECT at FROM success_notice WHERE id=?', (notice_key,)).fetchone() if notice_key else None
                    if not prior or prior[0] <= now-600:
                        import secrets
                        self.queue(db, 'login:'+secrets.token_hex(16), '【登录成功】'+service, detail+'结果：密码验证成功。')
                        if notice_key:
                            db.execute('INSERT OR REPLACE INTO success_notice VALUES(?,?)', (notice_key, now))
                    db.execute('DELETE FROM success_notice WHERE at<?', (now-86400,))
        if paused:
            raise Paused(paused)
        return good
