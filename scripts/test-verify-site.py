"""Release gate must not hide unexpected website or backend failures."""
from verify_site import frontend_release_ready as ready

stats_failure={
  'url':'https://zgland.com/site-stats/',
  'status':200,
  'failures':[{'url':'https://zgland.com/api/site-stats','status':503}],
  'errors':[],'message':None,'overflow':False,
  'broken_images':[],'analytics_requests':[],'nav_ok':True,
}
checks={
  'local_pages':{'ok':True},
  'live_portal':{'ok':True},
  'tunnel_health':{'ok':False},
  'live_pages':{'ok':False,'failing_pages':[stats_failure]},
}
assert ready(checks), 'known private stats backend outage should not block healthy frontend release'
assert ready({'local_pages':{'ok':True}}), 'local-only mode must be supported'
assert not ready({'local_pages':{'ok':False}}), 'real frontend failures must block'
assert not ready({'browser_dependency':{'ok':False}}), 'missing test dependencies cannot pass'
assert not ready({**checks,'live_pages':{'ok':False,'failing_pages':[]}}), 'unknown live failure must block'
for changed in [
 {'status':500},
 {'url':'https://zgland.com/'},
 {'failures':[{'url':'https://zgland.com/api/site-stats','status':404}]},
 {'failures':[{'url':'https://zgland.com/api/visit','status':503}]},
 {'overflow':True},
 {'errors':['bad script']},
 {'analytics_requests':['https://zgland.com/api/visit']},
 {'nav_ok':False},
]:
 failure={**stats_failure,**changed}
 assert not ready({**checks,'live_pages':{'ok':False,'failing_pages':[failure]}}),changed
print('PASS: public frontend release gate distinguishes only known private stats degradation.')
