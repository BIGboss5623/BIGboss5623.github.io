// No remote requests: imported data remains in this tab.
export function parseCSV(text){
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(l=>l.trim());
 if(lines.length<4||lines.length>20001)throw Error('需要3—20000条行情记录');
 const split=line=>line.split(',').map(s=>s.trim().replace(/^"([^"]*)"$/,'$1'));
 const head=split(lines.shift()).map(s=>s.toLowerCase());
 const di=head.findIndex(s=>['date','日期'].includes(s)),pi=head.findIndex(s=>['nav','close','单位净值','净值','收盘价'].includes(s));
 if(di<0||pi<0)throw Error('缺少表头 date,nav（或 date,close / 日期,单位净值）');
 const seen=new Set();const rows=lines.map((line,i)=>{const cells=split(line),date=cells[di],raw=cells[pi],price=Number(raw);
  if(cells.length!==head.length||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||!raw||!Number.isFinite(price)||price<=0)throw Error(`第${i+2}行日期或净值无效`);
  if(seen.has(date))throw Error(`日期重复：${date}`);seen.add(date);return{date,price};});
 return rows.sort((a,b)=>a.date.localeCompare(b.date));
}
export function backtest(rows,fast,slow,fee){
 if(!Number.isInteger(fast)||!Number.isInteger(slow)||fast<2||slow<=fast||slow>250||!Number.isFinite(fee)||fee<0||fee>.05)throw Error('请使用2≤快线<慢线≤250，费率0%—5%');
 if(rows.length<=slow)throw Error('样本数量必须大于慢均线周期');
 let cash=1,shares=0,sumFast=0,sumSlow=0,signal=0,orders=0,peak=1,drawdown=0;const equity=[],benchmark=[];
 rows.forEach(({price:p},i)=>{if(!Number.isFinite(p)||p<=0)throw Error('行情净值无效');
  if(i>0&&((signal===1&&shares<1e-12)||(signal===0&&shares>1e-12))){const wealth=cash+shares*p,gap=signal*wealth-shares*p,amount=gap/(gap>=0?1+signal*fee:1-signal*fee);if(Math.abs(amount)>1e-12){cash-=amount+Math.abs(amount)*fee;shares+=amount/p;orders++;}}
  const value=cash+shares*p;if(!Number.isFinite(value)||!Number.isFinite(p/rows[0].price))throw Error('数值超出计算范围，请检查净值或复权数据');equity.push(value);benchmark.push(p/rows[0].price);peak=Math.max(peak,value);drawdown=Math.min(drawdown,value/peak-1);
  sumFast+=p;sumSlow+=p;if(i>=fast)sumFast-=rows[i-fast].price;if(i>=slow)sumSlow-=rows[i-slow].price;if(!Number.isFinite(sumFast)||!Number.isFinite(sumSlow))throw Error('净值超出计算范围');signal=i>=slow-1&&sumFast/fast>sumSlow/slow?1:0;
 });return{equity,benchmark,orders,total:(equity.at(-1)-1)*100,drawdown:drawdown*100};
}
if(typeof document!=='undefined'){
 const $=id=>document.getElementById(id);let rows=[],source='',result=null,revision=0;
 const notify=(s,error=false)=>{$('message').textContent=s;$('message').dataset.error=String(error)};
 const invalidate=()=>{result=null;$('export').disabled=true;$('metrics').replaceChildren();$('chart').replaceChildren();$('resultSummary').textContent='数据或参数已改变，等待重新回测。'};
 const setRows=(next,name)=>{rows=next;source=name;invalidate();$('run').disabled=!rows.length;$('dataStatus').textContent=rows.length?`${source} · ${rows.length}条 · ${rows[0].date} — ${rows.at(-1).date}`:'尚未导入数据。';};
 const download=(name,text,type)=>{const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 $('file').onchange=async()=>{const token=++revision;setRows([],'');const file=$('file').files[0];if(!file)return;try{if(file.size>5*1024*1024)throw Error('文件超过5 MB');const text=await file.text();if(token!==revision)return;setRows(parseCSV(text),file.name);notify('数据已就绪，可以运行回测。')}catch(e){if(token===revision)notify(e.message,true)}};
 $('demo').onclick=()=>{revision++;$('file').value='';setRows(Array.from({length:400},(_,i)=>({date:new Date(Date.UTC(2024,0,i+1)).toISOString().slice(0,10),price:100*Math.exp(.0007*i+.09*Math.sin(i/17))})),'模拟数据（非真实行情，包含非交易日）');notify('已载入合成模拟数据，仅用于体验操作。')};
 $('sample').onclick=()=>download('FundPilot_CSV格式.csv','date,nav\n2024-01-02,1.000\n2024-01-03,1.010\n2024-01-04,1.005\n','text/csv;charset=utf-8');
 $('clear').onclick=()=>{revision++;$('file').value='';setRows([],'');notify('已清除当前行情与回测结果。')};
 for(const id of ['fast','slow','fee'])$(id).addEventListener('input',invalidate);
 $('save').onclick=()=>{try{const params=[$('fast').value,$('slow').value,$('fee').value];backtest(Array.from({length:251},()=>({price:1})),+params[0],+params[1],+params[2]/100);localStorage.setItem('fundpilot-web-params-v1',JSON.stringify(params));notify('参数已保存在本浏览器；未保存行情文件。')}catch(e){notify('保存失败：'+e.message,true)}};
 $('restore').onclick=()=>{try{const p=JSON.parse(localStorage.getItem('fundpilot-web-params-v1')||'null');if(!Array.isArray(p)||p.length!==3)throw Error('没有已保存参数');backtest(Array.from({length:251},()=>({price:1})),+p[0],+p[1],+p[2]/100);['fast','slow','fee'].forEach((id,i)=>$(id).value=p[i]);invalidate();notify('参数已恢复，请重新回测。')}catch(e){notify('恢复失败：'+e.message,true)}};
 $('form').onsubmit=e=>{e.preventDefault();invalidate();try{const params={fast:+$('fast').value,slow:+$('slow').value,fee:+$('fee').value/100};const r=backtest(rows,params.fast,params.slow,params.fee);result={schema:1,engine:'browser-dual-ma-v1',source,params,dates:rows.map(r=>r.date),...r,assumptions:'T close signal, next observation close execution; long/cash; fees both sides; no slippage; no forced liquidation'};$('resultSummary').textContent=`${source} · ${rows.length}条 · ${rows[0].date} — ${rows.at(-1).date}`;
  for(const [name,value]of [['累计收益',r.total.toFixed(2)+'%'],['最大回撤',r.drawdown.toFixed(2)+'%'],['成交次数',r.orders]]){const box=document.createElement('div'),b=document.createElement('b');box.textContent=name;b.textContent=value;box.append(b);$('metrics').append(box)}
  const all=[...r.equity,...r.benchmark],lo=Math.min(...all),span=Math.max(...all)-lo||1;const path=values=>values.map((v,i)=>`${i?'L':'M'}${(i/(values.length-1)*960+20).toFixed(2)},${(260-(v-lo)/span*240).toFixed(2)}`).join(' ');$('chart').innerHTML=`<svg viewBox="0 0 1000 280" role="img" aria-label="绿色策略净值，蓝色买入持有；具体数值可导出JSON"><path d="${path(r.benchmark)}" fill="none" stroke="#79b8ff" stroke-width="2"/><path d="${path(r.equity)}" fill="none" stroke="#5ce0b6" stroke-width="2"/></svg>`;$('export').disabled=false;notify('回测完成。历史表现不代表未来收益。');
 }catch(error){notify(error.message,true)}};
 $('export').onclick=()=>{if(result)download('FundPilot_web_backtest.json',JSON.stringify(result,null,2),'application/json')};
}
