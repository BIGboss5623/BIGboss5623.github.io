'use strict';
const assert=require('node:assert/strict');
const {isExpectedLocalFunction404: expected,isBestEffortVisitFailure: telemetry}=require('./site-qa-rules.cjs');
const base='http://127.0.0.1:8892/';
for(const endpoint of ['domain-expiry','site-stats']){
  assert(expected(base+'api/'+endpoint,base,404,true),endpoint);
  assert(!expected(base+'api/'+endpoint,base,404,false),'production HTTP 404 cannot be ignored');
  assert(!expected(base+'api/'+endpoint,base,503,true),'server HTTP 503 cannot be ignored');
}
assert(!expected(base+'api/nonexistent-test-endpoint',base,404,true),'missing Function must fail');
assert(!expected('https://other.example.com/api/domain-expiry',base,404,true),'cross-origin 404 must fail');
assert(!expected(base+'styles/missing.css',base,404,true),'missing resource must fail');
assert(!expected(base+'api/../config/secret',base,404,true),'path traversal must fail');
assert(telemetry('https://zgland.com/api/visit','POST',503),'best-effort counter outage is warning');
assert(!telemetry('https://zgland.com/api/visit','GET',503),'non-POST must fail');
assert(!telemetry('https://zgland.com/api/visit','POST',403),'authorization errors must fail');
assert(!telemetry('https://zgland.com/api/site-stats','GET',503),'stats dashboard outage must fail');
assert(!telemetry('https://other.example.com/api/visit','POST',503),'other origin must fail');
console.log('PASS: local static-Functions exceptions are narrow, live/unknown responses remain failures.');
