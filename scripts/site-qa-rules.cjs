'use strict';
const fs = require('node:fs');
const path = require('node:path');
// A plain static-file server does not execute Cloudflare Pages Functions.
// Ignore only those local 404s for which a real Function implementation exists.
// In production, every non-2xx response remains reportable.
function isExpectedLocalFunction404(responseUrl,pageUrl,status,isLocal){
  if(!isLocal || status!==404) return false;
  let response, page;
  try { response = new URL(responseUrl); page = new URL(pageUrl); } catch { return false; }
  if(response.origin!==page.origin || !/^\/api\/[a-z0-9-]+$/.test(response.pathname)) return false;
  const file=path.resolve(__dirname,'..','functions',response.pathname.slice(1)+'.js');
  return fs.existsSync(file);
}
// Visits are non-blocking telemetry. An upstream 503 must not make every
// otherwise healthy page fail a release check; record it separately.
function isBestEffortVisitFailure(responseUrl,method,status){
  if(method!=='POST'||status!==503)return false;
  try{
    const url=new URL(responseUrl);
    return url.origin==='https://zgland.com' && url.pathname==='/api/visit';
  }catch{return false;}
}
module.exports={isExpectedLocalFunction404,isBestEffortVisitFailure};
