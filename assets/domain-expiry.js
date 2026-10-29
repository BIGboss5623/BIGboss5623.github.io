(() => {
  'use strict';
  const panels=[...document.querySelectorAll('[data-domain-expiry]')];
  if(!panels.length)return;
  const edit='https://github.com/BIGboss5623/BIGboss5623.github.io/edit/main/config/domain-expiry.json';
  let current=null,busy=false;
  panels.forEach(panel=>{
    const management=panel.hasAttribute('data-expiry-management');
    panel.innerHTML=`<div class="expiry-heading"><span class="expiry-kicker">域名续费提醒</span><h2>zgland.com</h2><span class="expiry-state" data-expiry-state>正在查询</span></div><div class="expiry-number"><strong data-expiry-days>—</strong><span data-expiry-unit>剩余天数</span></div><div class="expiry-detail"><p data-expiry-date>正在读取注册局到期日…</p><small data-expiry-source>按北京时间计算日历天数，每天自动递减。</small><div class="expiry-actions"><button type="button" data-expiry-refresh>刷新到期日</button><a href="${management?edit:'https://zgland.com/domain-console/#expiry'}" ${management?'target="_blank" rel="noopener noreferrer"':''}>${management?'更新全站到期日 ↗':'管理与更新 ↗'}</a><a href="https://dc.console.aliyun.com/next/index#/domain-list/all" target="_blank" rel="noopener noreferrer">续费控制台 ↗</a></div></div><p class="expiry-warning" data-expiry-warning hidden></p>${management?'<details class="expiry-help"><summary>续费后怎样更新？</summary><p>通常只需点“刷新到期日”，注册局更新后，全站会自动读到新日期，不用每天修改天数。</p><p>需要人工校正时，点击“更新全站到期日”，用你已有的 GitHub 账户编辑配置，将 <code>manual_expiry_date</code> 从 <code>null</code> 改成日期字符串，例如 <code>"2028-08-09"</code>，提交到 main；网站部署完成后各设备都会读取新日期。恢复自动查询时设回 <code>null</code>。</p><p>此设置用于网站倒计时；现有定时邮件任务继续读取注册局数据。注册局到期日不替代注册商账单或实际续费截止日。</p></details>':''}`;
  });
  const dateKey=d=>new Date(d.getTime()+8*3600000).toISOString().slice(0,10);
  function render(){
    if(!current)return;
    // Advance from the server's clock, independent of the visitor's clock/timezone.
    const now=new Date(Date.parse(current.served_at)+(performance.now()-current.received_at));
    const days=Math.round((Date.parse(current.expiry_date+'T00:00:00Z')-Date.parse(dateKey(now)+'T00:00:00Z'))/86400000);
    const level=days<0?'expired':days===0?'today':days<=30?'urgent':days<=60?'soon':'healthy';
    panels.forEach(panel=>{
      panel.dataset.level=level;
      panel.querySelector('[data-expiry-days]').textContent=Math.abs(days);
      panel.querySelector('[data-expiry-unit]').textContent=days<0?'已过期天数':days===0?'今天到期':'天后到期';
      panel.querySelector('[data-expiry-state]').textContent=days<0?'已过期，请核对':days===0?'今日到期':days<=30?'即将到期':days<=60?'请安排续费':'正常';
      panel.querySelector('[data-expiry-date]').textContent=`到期日期：${current.expiry_date}（北京时间）`;
      const checked=current.checked_at?` · 核验于 ${dateKey(new Date(current.checked_at))}`:'';
      panel.querySelector('[data-expiry-source]').textContent=current.source_label+checked+' · 每天自动递减';
      const warning=panel.querySelector('[data-expiry-warning]');warning.hidden=!current.warning;warning.textContent=current.warning||'';
    });
  }
  async function fallback(){
    const response=await fetch('/config/domain-expiry.json',{cache:'no-store'});
    if(!response.ok)throw new Error('no fallback');
    const config=await response.json();
    const manual=typeof config.manual_expiry_date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(config.manual_expiry_date)?config.manual_expiry_date:null;
    const value=manual?manual+'T23:59:59+08:00':config.last_verified_expiry_at;
    const parsed=new Date(value);
    if(config.domain!=='zgland.com'||!Number.isFinite(parsed.getTime())||(manual&&dateKey(parsed)!==manual))throw new Error('invalid date');
    return {expiry_date:dateKey(parsed),source_label:manual?'手动设定（静态备用）':'上次核验日期（静态备用）',checked_at:manual?null:config.last_verified_on,served_at:new Date().toISOString(),warning:'实时查询不可用，显示备用记录；请核对续费结果。'};
  }
  async function refresh(){
    if(busy)return;busy=true;
    panels.forEach(p=>{p.querySelector('[data-expiry-refresh]').disabled=true;p.querySelector('[data-expiry-state]').textContent='正在查询';});
    try{
      const response=await fetch('/api/domain-expiry',{cache:'no-store',signal:AbortSignal.timeout(10000)});
      const payload=await response.json();
      if(!response.ok||!payload.ok||!/^\d{4}-\d{2}-\d{2}$/.test(payload.expiry_date)||!Number.isFinite(Date.parse(payload.served_at)))throw new Error('unavailable');
      current={...payload,received_at:performance.now()};render();
    }catch{
      try{current={...await fallback(),received_at:performance.now()};render();}
      catch{current=null;panels.forEach(p=>{p.dataset.level='unknown';p.querySelector('[data-expiry-days]').textContent='—';p.querySelector('[data-expiry-unit]').textContent='剩余天数';p.querySelector('[data-expiry-state]').textContent='暂未取得日期';p.querySelector('[data-expiry-date]').textContent='请刷新或登录续费控制台核对。';p.querySelector('[data-expiry-source]').textContent='实时查询与备用记录均不可用。';p.querySelector('[data-expiry-warning]').hidden=true;});}
    }finally{busy=false;panels.forEach(p=>p.querySelector('[data-expiry-refresh]').disabled=false);}
  }
  panels.forEach(p=>p.querySelector('[data-expiry-refresh]').addEventListener('click',refresh));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
  setInterval(render,60000);
  refresh();
})();
