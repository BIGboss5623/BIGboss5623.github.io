(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.RobotsCheck=api;})(typeof globalThis==='undefined'?this:globalThis,function(){
'use strict';
function check(robots,bot,target){
 bot=String(bot||'').trim().toLowerCase();if(!bot)throw Error('缺少 User-agent');
 let path=String(target||'/').trim();if(/^https?:\/\//i.test(path)){try{const u=new URL(path);path=u.pathname+u.search}catch{throw Error('网址格式无效')}}
 if(!path.startsWith('/'))path='/'+path;
 const groups=[];let group=null;let active=false;
 String(robots||'').slice(0,100000).split(/\r?\n/).slice(0,2000).forEach((line,i)=>{
   const m=line.replace(/#.*$/,'').trim().match(/^([a-z-]+)\s*:\s*(.*?)\s*$/i);
   if(!m){if(!line.trim()&&active){group=null;active=false;}return;}
   const key=m[1].toLowerCase(),value=m[2];
   if(key==='user-agent'){if(!group||active){group={bots:[],rules:[]};groups.push(group);active=false;}group.bots.push(value.toLowerCase());}
   else if(group&&(key==='allow'||key==='disallow')){active=true;if(key==='disallow'&&!value)return;if(value.length<400)group.rules.push({key,value,line:i+1});}
 });
 let score=-1;const selected=[];
 groups.forEach(g=>{const n=Math.max(-1,...g.bots.map(b=>b==='*'?0:bot.includes(b)?b.length:-1));if(n>score){score=n;selected.length=0;if(n>=0)selected.push(g)}else if(n===score&&n>=0)selected.push(g);});
 const matches=[];
 selected.forEach(g=>g.rules.forEach(r=>{
   const end=r.value.endsWith('$'),source=end?r.value.slice(0,-1):r.value;
   if((source.match(/\*/g)||[]).length>8)return;
   const safe=source.split('*').map(x=>x.replace(/[|\\{}()[\]^$+?.]/g,'\\$&')).join('.*');
   try{if(new RegExp('^'+safe+(end?'$':'')).test(path))matches.push({...r,size:source.replace(/\*/g,'').length})}catch{}
 }));
 matches.sort((a,b)=>b.size-a.size||(a.key==='allow'?-1:1));
 const rule=matches[0];
 return {allowed:!rule||rule.key==='allow',rule:rule?rule.key+': '+rule.value:'默认允许',line:rule?.line||null,groups:selected.flatMap(g=>g.bots)};
}
return {check};
});
