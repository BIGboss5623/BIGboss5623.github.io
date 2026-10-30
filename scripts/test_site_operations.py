"""Isolated boundary tests: never guess live passwords or send real email."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sqlite3
import sys
import tempfile

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'operations'))
from security_core import Security, Paused, client_ip
import website_ops as ops


def paused(fn):
    try:fn()
    except Paused as error:return error.until
    raise AssertionError('pause was bypassed')


with tempfile.TemporaryDirectory() as temp:
    root=Path(temp);now=[10000.0];guard=Security(root/'security.sqlite',clock=lambda:now[0])
    for i in range(20):assert not guard.verify('a',lambda:False,'192.0.2.1','test')
    assert guard.verify('a',lambda:True,'192.0.2.1','login')
    for i in range(49):
        if i==24:guard=Security(root/'security.sqlite',clock=lambda:now[0])
        assert not guard.verify('a',lambda:False,'192.0.2.'+str(i+1),'test')
    until=paused(lambda:guard.verify('a',lambda:False))
    assert until==13600
    counter=[0]
    def must_not_run():counter[0]+=1;return True
    for _ in range(100):assert paused(lambda:guard.verify('a',must_not_run,'198.51.100.1'))==until
    assert counter==[0]
    assert guard.verify('other-service',lambda:True)
    guard=Security(root/'security.sqlite',clock=lambda:now[0])
    now[0]=13599.999;paused(lambda:guard.verify('a',must_not_run))
    now[0]=13600;assert guard.verify('a',must_not_run);assert counter==[1]
    with guard.db() as db:
        assert db.execute("SELECT COUNT(*) FROM mail WHERE id LIKE 'lock:%'").fetchone()[0]==1
        assert db.execute("SELECT failures,until FROM locks WHERE service='a'").fetchone()==(0,0)
    def attempt(_):
        try:return guard.verify('race',lambda:False)
        except Paused:return 'paused'
    with ThreadPoolExecutor(max_workers=10) as pool:results=list(pool.map(attempt,range(80)))
    assert results.count(False)==49 and results.count('paused')==31
    with guard.db() as db:assert db.execute("SELECT failures FROM locks WHERE service='race'").fetchone()[0]==50
    assert client_ip('192.0.2.7',{'CF-Connecting-IP':'1.1.1.1','X-Forwarded-For':'8.8.8.8'})=='192.0.2.7'
    assert client_ip('127.0.0.1',{'CF-Connecting-IP':'2001:db8::1'})=='2001:db8::1'
    assert client_ip('127.0.0.1',{'X-Forwarded-For':'8.8.8.8'})=='127.0.0.1'
    folder=root/'ops';folder.mkdir()
    config={'edge_key':'11'*32,'visitor_key':'22'*32,'domain_digest':'33'*32,'network':{},'expiry_snapshot':'2027-08-09'}
    (folder/'config.json').write_text(json.dumps(config))
    service=ops.Operations(folder)
    data={'host':'zgland.com','path':'/credentials/private-document-name','ip':'192.0.2.9','agent':'Mozilla/5.0 Test Browser'}
    assert service.hit(data);assert not service.hit(data)
    assert not service.hit({**data,'host':'attacker.example'})
    assert not service.hit({**data,'agent':'Googlebot'})
    assert not service.hit({**data,'path':'/x?secret=x'})
    result=service.stats();assert result['today']['pv']==1 and result['today']['visitors']==1
    public=json.dumps(result);assert '192.0.2.9' not in public and 'private-document-name' not in public
    assert result['pages'][0]['path']=='/credentials/'
    assert ops.significant(130,100) and not ops.significant(129,100)
    assert ops.significant(0,20) and not ops.significant(19,0)
    day=datetime(2027,7,10).date()
    assert ops.due_domain(day+timedelta(days=30),day)=='daily'
    assert ops.due_domain(day+timedelta(days=31),day)=='monthly'
    assert ops.due_domain(day+timedelta(days=30),day,False,True) is None
    real_datetime=ops.datetime
    class FixedDate(datetime):
        @classmethod
        def now(cls,tz=None):return cls(2027,7,10,12,tzinfo=ops.TZ)
    ops.datetime=FixedDate
    ops.https_json=lambda *a,**k:{'ok':True,'expiry_date':'2027-08-09','source_label':'test'}
    # Test closed-day decrease to zero, including absence of a hit row.
    with service.security.db() as db:
        db.execute("UPDATE meta SET value='2027-07-01T00:00:00+08:00' WHERE key='tracking_started'")
        db.execute("INSERT INTO hits VALUES('2027-07-08','zgland.com','/',100)")
    service.schedule();service.schedule()
    with service.security.db() as db:
        assert db.execute("SELECT COUNT(*) FROM mail WHERE id='domain:2027-07-10'").fetchone()[0]==1
        assert db.execute("SELECT COUNT(*) FROM mail WHERE id='traffic:2027-07-09'").fetchone()[0]==1
    calls=[]
    def fail(*a):raise OSError('test failure')
    ops.send_mail=fail;assert service.deliver_one()
    with service.security.db() as db:
        assert db.execute('SELECT MAX(attempts) FROM mail').fetchone()[0]==1
        db.execute('UPDATE mail SET due=0')
    ops.send_mail=lambda *a:calls.append(a)
    assert service.deliver_one();assert len(calls)==1
    ops.datetime=real_datetime
print('PASS: 49/50, reset, 3600s, restart, changing IP, concurrent attempts, pause without verification, one protection mail, trusted IP, visitor privacy, dedup, bots, 30-day/month boundaries, zero-traffic decline, idempotent schedules, mail retry. No live mail sent.')
