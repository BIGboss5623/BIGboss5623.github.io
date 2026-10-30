(()=>{'use strict';const $=id=>document.getElementById(id),format=n=>Number(n).toLocaleString('zh-CN');
function row(parent,values){const tr=document.createElement('tr');for(const value of values){const td=document.createElement('td');td.textContent=value;tr.append(td);}parent.append(tr);}
async function load(){const button=$('refresh');button.disabled=true;$('error').hidden=true;
try{const response=await fetch('/api/site-stats',{cache:'no-cache',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error();const data=await response.json();if(!data.ok)throw Error();
$('todayPv').textContent=format(data.today.pv);$('todayUv').textContent=format(data.today.visitors);$('monthPv').textContent=format(data.daily.reduce((n,d)=>n+d.pv,0));
$('status').textContent='更新于 '+new Date(data.updated_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+'（UTC+8）'+(data.first_recorded_day?' · 首次记录 '+data.first_recorded_day:' · 尚无访问记录');
for(const id of ['dailyRows','hostRows','pageRows','trend'])$(id).replaceChildren();
const max=Math.max(1,...data.daily.map(d=>d.pv));for(const day of data.daily){row($('dailyRows'),[day.day,format(day.pv),format(day.visitors)]);const bar=document.createElement('div');bar.className='bar';bar.style.height=Math.max(1,day.pv/max*100)+'%';bar.title=day.day+'：'+day.pv+'次浏览';bar.setAttribute('aria-label',bar.title);$('trend').append(bar);}
for(const host of data.hosts)row($('hostRows'),[host.host,format(host.pv)]);for(const page of data.pages)row($('pageRows'),[page.host+page.path,format(page.pv)]);
if(!data.hosts.length)row($('hostRows'),['数据正在积累','—']);if(!data.pages.length)row($('pageRows'),['暂无访问记录','—']);
}catch{$('error').hidden=false;$('status').textContent='未取得最新数据；不将离线状态显示为零。';}finally{button.disabled=false;}}
$('refresh').addEventListener('click',load);load();})();
