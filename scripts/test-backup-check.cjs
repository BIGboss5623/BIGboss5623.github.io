const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const {inspectBackup}=await import(pathToFileURL(path.resolve(__dirname,'../quant-console/backup-check.mjs')).href);
 const good={exported_at:'2026-10-19T12:00:00',strategies:{demo:{kind:'balanced',fast_ma:10,slow_ma:40}},portfolio:{holdings:[],journal:[]}};
 assert.deepEqual(inspectBackup(JSON.stringify(good)),{exportedAt:good.exported_at,strategies:1,holdings:0,journal:0});
 for(const bad of ['{','[]','{}',JSON.stringify({...good,credentials:'must-not-be-accepted'}),JSON.stringify({...good,portfolio:{holdings:{},journal:[]}}),JSON.stringify({...good,strategies:{demo:{kind:'execute'}}}),JSON.stringify({...good,strategies:{demo:{fast_ma:true}}}),JSON.stringify({...good,strategies:{demo:{fast_ma:40,slow_ma:10}}}),JSON.stringify({...good,strategies:{demo:{fee:1}}}),JSON.stringify({...good,portfolio:{holdings:[{symbol:'110017',shares:-1,cost:1,target:30}],journal:[]}})])assert.throws(()=>inspectBackup(bad));
 console.log('PASS: browser backup structure/counts, malformed JSON, wrong type, credentials/unknown fields, unsafe strategy parameters and invalid holdings rejected.');
})().catch(error=>{console.error(error);process.exitCode=1});
