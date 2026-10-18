const $ = s => document.querySelector(s);
const state = {data:null,country:'中国',decade:'2020年代'};
const cosine=(a,b,features)=>{const av=features.map(k=>a.scores[k]),bv=features.map(k=>b.scores[k]);const dot=av.reduce((s,v,i)=>s+v*bv[i],0),na=Math.sqrt(av.reduce((s,v)=>s+v*v,0)),nb=Math.sqrt(bv.reduce((s,v)=>s+v*v,0));return na&&nb?dot/(na*nb):0};
const pill=(text,cls='')=>`<span class="${cls}">${text}</span>`;
function renderCountries(){const cs=[...new Set(state.data.records.map(r=>r.country))];$('#countries').innerHTML=cs.map(c=>`<button class="${c===state.country?'active':''}" data-country="${c}">${c}</button>`).join('');$('#countryCount').textContent=cs.length;$('#recordCount').textContent=state.data.records.length;document.querySelectorAll('[data-country]').forEach(b=>b.onclick=()=>{state.country=b.dataset.country;const rows=state.data.records.filter(r=>r.country===state.country);state.decade=rows.at(-1).decade;renderCountries();renderDecades();render()})}
function renderDecades(){const rows=state.data.records.filter(r=>r.country===state.country);$('#decade').innerHTML=rows.map(r=>`<option ${r.decade===state.decade?'selected':''}>${r.decade}</option>`).join('')}
function render(){const d=state.data,rec=d.records.find(r=>r.country===state.country&&r.decade===state.decade);if(!rec)return;$('#selection').textContent=`${rec.country} · ${rec.decade}`;$('#stageName').textContent=rec.stage;$('#evidence').textContent=rec.evidence;$('#opportunities').innerHTML=[...rec.hotspots,...rec.opportunities].map(x=>pill(x)).join('');$('#risks').innerHTML=rec.risks.map(x=>pill(x)).join('');$('#bars').innerHTML=d.features.map(f=>`<div class="bar"><span>${f}</span><div class="track"><div class="fill" style="width:${rec.scores[f]*20}%"></div></div><b>${rec.scores[f]}</b></div>`).join('');const matches=d.records.filter(r=>r!==rec).map(r=>({r,s:cosine(rec,r,d.features)})).sort((a,b)=>b.s-a.s).slice(0,5);$('#analogues').innerHTML=matches.map((x,i)=>`<div class="analogue"><b>0${i+1}</b><div><strong>${x.r.country} · ${x.r.decade}</strong><small>${x.r.stage}</small></div><span class="score">${(x.s*100).toFixed(1)}%</span></div>`).join('')}
function renderSources(){
 const links=state.data.sources.flatMap(s=>{
  const [name,url,description]=Array.isArray(s)?s:[s.name,s.url,s.description];
  if(typeof url!=='string'||!/^https:\/\//.test(url))return [];
  const a=document.createElement('a');a.href=url;a.textContent=name||'资料来源';a.title=description||'';a.target='_blank';a.rel='noopener noreferrer';return [a];
 });
 $('#sourceLinks').replaceChildren(...links);
}
async function loadData(){
 const status=$('#loadStatus'),retry=$('#retryData');retry.hidden=true;retry.disabled=true;$('#decade').disabled=true;status.textContent='正在读取研究样本……';
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch('history-data.json',{signal:controller.signal});if(!response.ok)throw Error('数据文件读取失败');const d=await response.json();
  if(!Array.isArray(d.records)||!d.records.length||!Array.isArray(d.features)||!Array.isArray(d.sources))throw Error('研究数据格式错误');
  state.data=d;renderCountries();renderDecades();renderSources();render();$('#decade').disabled=false;status.textContent=`已加载 ${d.records.length} 个年代样本，可切换国家和年代。`;
  $('#decade').onchange=e=>{state.decade=e.target.value;render()};
 }catch(e){status.textContent=e.name==='AbortError'?'数据加载超时，请检查网络后重试。':`${e.message}，请点击重新加载。`;retry.hidden=false;$('#stageName').textContent='研究样本暂不可用';$('#evidence').textContent='页面介绍仍可阅读；交互研究需要成功加载数据。';}
 finally{clearTimeout(timer);retry.disabled=false;}
}
$('#retryData').onclick=loadData;loadData();
