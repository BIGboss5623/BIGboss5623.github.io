'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const selected = new Set();
  let data, visible = [], category = '', toastTimer;
  const fields = [['verdict','结论'],['kind','资格性质'],['china','在中国内地怎么用'],['outbound','境外用途 / 反向路径'],['title','职称衔接'],['requirements','取得与申请门槛'],['assessment','评价方式'],['effort','投入与难易分析（研究判断）'],['renewal','有效期与维护'],['next','下一步核查']];
  const countryOrder = ['中国内地','中国香港','法国','比利时','阿联酋','塞尔维亚','美国','英国','德国','日本','澳大利亚','新加坡','加拿大','俄罗斯','跨国组织'];
  function notify(message) { clearTimeout(toastTimer); $('#notice').textContent = message; $('#notice').hidden = false; toastTimer = setTimeout(() => { $('#notice').hidden = true; }, 5000); }
  function sourceLink(id, detailed = false) {
    const s = data.sources[id];
    return `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.issuer)} · ${esc(s.title)} ↗</a>${detailed ? `<span class="source-note">${esc(s.note)}</span>` : ''}`;
  }
  function matches(e) {
    const words = $('#search').value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const searchText = Object.values(e).flat().join(' ').toLocaleLowerCase();
    return (!category || e.category === category) && (!$('#country').value || e.countries.includes($('#country').value)) && (!$('#recognition').value || e.path === $('#recognition').value) && (!$('#titleOnly').checked || e.titleRelevant) && words.every(w => searchText.includes(w));
  }
  function render() {
    const open = new Set(Array.from(document.querySelectorAll('.record[open]')).map(d => d.id));
    visible = data.entries.filter(matches);
    $('#records').innerHTML = visible.map(e => `<details class="record" id="item-${esc(e.id)}"${open.has('item-'+e.id) ? ' open' : ''}>
      <summary><span class="record-number">${String(data.entries.indexOf(e)+1).padStart(2,'0')}</span><span class="record-heading"><strong>${esc(e.name)}</strong><small>${esc(e.countries.join(' / '))} · ${esc(e.kind)}</small></span><span class="badge${e.category==='院士与学术称号' || e.path==='不能单独使用'?' warm':''}">${esc(e.path)}</span><span class="record-verdict">${esc(e.verdict)}</span></summary>
      <div class="record-body"><div class="record-body-top"><label class="check"><input type="checkbox" data-compare="${esc(e.id)}"${selected.has(e.id)?' checked':''}>加入并排比较</label><span>核查基准 ${esc(data.version)}</span><a href="#item-${esc(e.id)}" data-permalink="${esc(e.id)}">定位链接 ↗</a></div>
      <div class="detail-grid">${fields.filter(([key]) => key!=='verdict' && key!=='kind').map(([key,label]) => `<div class="detail-block${key==='effort'?' analysis':''}${key==='next'?' full':''}"><h4>${label}</h4><p>${esc(e[key])}</p></div>`).join('')}</div><div class="record-sources">该条目依据 · 主管机关判断效力，发证机构说明取得条件<ul>${e.sources.map(id => `<li>${sourceLink(id,true)}</li>`).join('')}</ul></div></div></details>`).join('');
    $('#resultsStatus').textContent = `显示 ${visible.length} / ${data.entries.length} 项 · 展开条目查看条件与原文`;
    $('#empty').hidden = visible.length !== 0;
    $('#exportCsv').disabled = visible.length === 0;
    renderTray();
  }
  function renderTray() {
    $('#compareTray').hidden = selected.size === 0;
    const names = [...selected].map(id => data.entries.find(e=>e.id===id).name);
    $('#selectionStatus').textContent = `已选 ${selected.size} / 3：${names.join('、')}`;
    $('#showCompare').disabled = selected.size < 2;
  }
  function compare() {
    const entries = [...selected].map(id=>data.entries.find(e=>e.id===id));
    if (entries.length < 2) return;
    $('#compareTable').innerHTML = `<table><thead><tr><th scope="col">比较维度</th>${entries.map(e=>`<th scope="col">${esc(e.name)}<br><button class="small-button" data-remove="${esc(e.id)}" type="button" aria-label="从比较中移除${esc(e.name)}">移除 ×</button></th>`).join('')}</tr></thead><tbody>${[['countries','发证来源'],...fields].map(([key,label])=>`<tr><th scope="row">${label}</th>${entries.map(e=>`<td>${esc(Array.isArray(e[key])?e[key].join(' / '):e[key])}</td>`).join('')}</tr>`).join('')}<tr><th scope="row">核查日期与依据</th>${entries.map(e=>`<td>${esc(data.version)}${e.sources.map(id=>sourceLink(id)).join('')}</td>`).join('')}</tr></tbody></table>`;
    $('#comparison').hidden = false;
  }
  function reset() {
    category=''; $('#search').value=''; $('#country').value=''; $('#recognition').value=''; $('#titleOnly').checked=false;
    document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category==='')));
    if (data) render();
  }
  function openHash() {
    if (!data || !location.hash.startsWith('#item-')) return;
    const id = location.hash.slice(6);
    if (!data.entries.some(e=>e.id===id)) return;
    reset();
    const item = document.getElementById('item-'+id); item.open=true; item.scrollIntoView({block:'start'});
  }
  const plans = {
    construction: {title:'国内建设岗位，先确认注册要求。', steps:['从拟任岗位和工程专业查需要的国内资格，满足一建考试条件并取得资格后，还须完成注册。','如实际承担国际项目，再比较CIOB、RICS、CEng或PMP与工作内容的匹配，不以英文译名互相替代。','把业绩、学历、继续教育和本地职称衔接同时准备，避免只积累证书却缺岗位所需条件。'], ids:['jian','ciob','rics','pmp']},
    title: {title:'先有本地条目，再决定为哪张证投入。', steps:['按实际工作领域查受理地现行目录，记录证书全称、发证机构、等级及版本。','核实资格取得路径、有效期、学历和工作经验，确认是否需要在当地就业、海外经历或评审。','国内IT方向也比较软考；境外证书的年费和续证应计入总成本。不要使用不相关工作经历申请认定。'], ids:['aws-pro','aws-assoc','ceng','soft']},
    global: {title:'先选国家和岗位，再选执照。', steps:['美国先选州，加拿大先选省/地区，新加坡核对PEB；不要只寻找“最容易考试”的地方。','先请监管机关确认学历、境外工作经验、推荐人与考试条件，区分考试通过和取得执照。','需要签章或独立执业时另核法定权限；项目管理认证、会籍和移民职业评估不能直接替代。'], ids:['pe-us','peng-ca','pe-sg','cpeng-au']},
    finance: {title:'先分清审计、投资和项目管理。', steps:['内地审计、海外审计、企业财务和投资分析需要的权利与知识不同。ACCA、CFA、PMP不能互相代替。','确有两地会计需求时，可核HKICPA与CICPA部分科目互免；先确认本人完整取得路径是否适用。','考试外还核经验、道德、会籍、续证费用与目标岗位实际要求。'], ids:['acca','hkicpa','cfa','pmp']},
    driving: {title:'先分清来华与出境，短期与长期。', steps:['境外证来华：先查现行部令条件，再核协议是否覆盖本人国籍、居留、原证版式和车型。','短期驾驶与长期换证分别申请；不要用IDP或商业翻译卡替代中国驾照/临时许可。','中国证赴外，按目的地交通机关最新规则查询。美国、澳洲要选州，日本须注意2025年后的调整。'], ids:['dr-fr','dr-ae','dr-jp','idp']},
    honor: {title:'先查法人和成员类别，再谈用途。', steps:['核对原文全称、国家/社会组织性质、章程、当选名录与个人级别，不只看中文院士证书。','问清所申报人才政策是否精确列入该机构和成员类别；学术荣誉、专业会士、职称与执照分别判断。','机构有会费不能证明买卖头衔，也不能保证国内认定；不以不明中介的包过承诺制定职业计划。'], ids:['rae','ras','raeng','ieee']}
  };
  const regions = {
    zhejiang:['浙江重点：2023目录样本提供初、中级比照认定路径，工作需匹配、经权限审核，信息入系统。申请前核对新版目录及证书是否仍有效。','zj-list'],
    guangzhou:['广州重点：2025目录中的“对应”仍要按年度标准申报，不直接换发职称证书；有效资格、在穗相关工作与精确条目缺一不可。','gz-policy'],
    jiangsu:['江苏重点：2026版境外专业技术资格比照另有境外取得、留学/海外工作经历及在苏工作要求；境内考到国际认证并非当然符合此路径。','js-policy'],
    other:['地区未定：先向拟聘单位或所在地职称主管部门问清现行目录和受理条件。浙江、广州或江苏的路径不能直接推广至其他地区。',null]
  };
  function renderPlan() {
    const plan=plans[$('#goal').value], region=regions[$('#region').value];
    $('#planOutput').innerHTML=`<h3>${plan.title}</h3><ol>${plan.steps.map(s=>`<li>${s}</li>`).join('')}</ol><div class="plan-links">${plan.ids.map(id=>`<a href="#item-${id}">${esc(data.entries.find(e=>e.id===id).name)} ↗</a>`).join('')}</div><p class="region-note">${region[0]}${region[1]?`<br>${sourceLink(region[1])}`:''}</p>`;
  }
  function exportCsv() {
    if (!visible.length) return;
    const quote=value=>{let v=String(value??''); if (/^[=+\-@\t\r]/.test(v)) v="'"+v; return '"'+v.replace(/"/g,'""')+'"';};
    const rows=[['名称','类别','发证国家/地区','认定路径',...fields.map(([,v])=>v),'核查日期','原文链接'],...visible.map(e=>[e.name,e.category,e.countries.join(' / '),e.path,...fields.map(([key])=>e[key]),data.version,e.sources.map(id=>data.sources[id].url).join('\n')])];
    const blob=new Blob(['\ufeff'+rows.map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=`证书互认对比-${data.version}.csv`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    notify(`已导出当前筛选的 ${visible.length} 项，含原文链接与核查日期。`);
  }
  async function load() {
    $('#loadError').hidden=true; $('#resultsStatus').textContent='正在加载核查目录…';
    try {
      const response=await fetch('/credentials/catalog.json',{cache:'no-cache'});
      if(!response.ok)throw new Error('catalog unavailable');
      const payload=await response.json();
      if(!Array.isArray(payload.entries)||!payload.entries.length||!payload.sources)throw new Error('invalid catalog');
      data=payload;
      const countries=new Set(data.entries.flatMap(e=>e.countries));
      $('#entryCount').textContent=data.entries.length;
      $('#countryCount').textContent=[...countries].filter(c=>c!=='跨国组织').length;
      $('#sourceCount').textContent=Object.keys(data.sources).length;
      $('#sourceTotal').textContent=`${Object.keys(data.sources).length} 条`;
      $('#country').innerHTML='<option value="">全部来源</option>'+countryOrder.filter(c=>countries.has(c)).map(c=>`<option>${esc(c)}</option>`).join('');
      $('#recognition').innerHTML='<option value="">全部路径</option>'+[...new Set(data.entries.map(e=>e.path))].map(c=>`<option>${esc(c)}</option>`).join('');
      $('#sources').innerHTML=Object.entries(data.sources).map(([id,s],i)=>`<div class="source-item" id="source-${esc(id)}"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${String(i+1).padStart(2,'0')} · ${esc(s.title)} ↗</a><p>${esc(s.issuer)} · 核查基准 ${esc(data.version)}</p><p>${esc(s.note)}</p></div>`).join('');
      render(); renderPlan(); openHash();
    } catch {
      $('#loadError').hidden=false; $('#resultsStatus').textContent='目录加载失败，请重试或查看原始资料。';
    }
  }
  document.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{
    category=button.dataset.category;
    document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    if(data)render();
  }));
  ['search','country','recognition','titleOnly'].forEach(id=>$('#'+id).addEventListener(id==='search'?'input':'change',()=>{if(data)render();}));
  $('#reset').addEventListener('click',reset); $('#retry').addEventListener('click',load);
  $('#goal').addEventListener('change',()=>{if(data)renderPlan();}); $('#region').addEventListener('change',()=>{if(data)renderPlan();});
  $('#records').addEventListener('change',event=>{
    const input=event.target.closest('[data-compare]'); if(!input)return;
    if(input.checked){ if(selected.size>=3){input.checked=false;notify('最多比较3项。请先取消一项再选择。');return;} selected.add(input.dataset.compare); }else selected.delete(input.dataset.compare);
    renderTray(); if(!$('#comparison').hidden){if(selected.size>=2)compare();else $('#comparison').hidden=true;}
  });
  $('#records').addEventListener('click',event=>{
    const link=event.target.closest('[data-permalink]');if(!link)return;
    event.preventDefault(); history.replaceState(null,'','#item-'+link.dataset.permalink); notify('地址栏已定位到该条目，可复制链接分享。');
  });
  $('#showCompare').addEventListener('click',()=>{compare();$('#comparison').scrollIntoView({block:'start'});});
  $('#clearCompare').addEventListener('click',()=>{selected.clear();$('#comparison').hidden=true;render();});
  $('#closeCompare').addEventListener('click',()=>{$('#comparison').hidden=true;});
  $('#compareTable').addEventListener('click',event=>{const b=event.target.closest('[data-remove]');if(!b)return;selected.delete(b.dataset.remove);render();if(selected.size>=2)compare();else $('#comparison').hidden=true;});
  $('#exportCsv').addEventListener('click',exportCsv);
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href^="#item-"]');
    if(!link||link.hasAttribute('data-permalink')||!data)return;
    event.preventDefault();
    if(location.hash!==link.hash)history.pushState(null,'',link.hash);
    openHash();
  });
  window.addEventListener('hashchange',openHash);
  load();
})();
