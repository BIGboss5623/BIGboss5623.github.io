'use strict';
const start = document.querySelector('#start'), signal = document.querySelector('#signal');
const result = document.querySelector('#result'), bestText = document.querySelector('#best');
let timer = null, beganAt = 0, state = 'idle', best = 0;
try { best = Number(localStorage.getItem('zg-network-best')) || 0; } catch { /* Storage is optional. */ }
if (best) bestText.textContent = `最佳：${best} ms`;
function label(a,b) { signal.querySelector('span').textContent=a; signal.querySelector('small').textContent=b; }
start.addEventListener('click', () => {
  clearTimeout(timer); state='wait'; signal.className='wait'; label('WAIT','绿灯亮起后点击'); result.textContent='—';
  timer=setTimeout(()=>{state='go'; beganAt=performance.now(); signal.className='go'; label('GO!','现在点击');},1200+Math.random()*2600);
});
signal.addEventListener('click', () => {
  if(state==='wait'){clearTimeout(timer);state='idle';signal.className='';label('抢跑','请重新开始');return;}
  if(state!=='go')return;
  const elapsed=Math.round(performance.now()-beganAt); state='idle'; signal.className=''; result.textContent=elapsed; label('完成',`${elapsed} ms`);
  if(!best || elapsed<best){best=elapsed;try{localStorage.setItem('zg-network-best',String(best));}catch{}bestText.textContent=`最佳：${best} ms`;}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden && state!=='idle'){clearTimeout(timer);state='idle';signal.className='';label('已暂停','返回后请重新开始');}});

// Same-origin CDN files, restored byte-for-byte from the historical assets.
const downloadArchive=new URL('downloads/',location.href).href;
const downloadButtons=[...document.querySelectorAll('.assembled-download')];
let activeDownload=null;
for(const button of downloadButtons){
  const status=button.closest('article').querySelector('.assemble-status');
  status.setAttribute('role','status');
  button.addEventListener('click',async()=>{
    if(activeDownload){if(activeDownload.button===button)activeDownload.controller.abort();return;}
    const total=Number(button.dataset.parts),name=button.dataset.base,originalLabel=button.textContent;
    if(!Number.isInteger(total) || total<1 || total>10 || !/^[\w.-]+\.(exe|zip)$/.test(name)){status.textContent='下载配置无效，请联系网站管理员。';return;}
    const controller=new AbortController();activeDownload={button,controller};
    downloadButtons.forEach(b=>{b.disabled=b!==button;});button.textContent='取消下载';button.setAttribute('aria-busy','true');
    const parts=new Array(total),received=new Array(total).fill(0);let next=0,completed=0,metadata;
    function progress(){status.textContent=`已接收 ${(received.reduce((a,b)=>a+b,0)/1048576).toFixed(1)} MB · 完成 ${completed}/${total} 段（可取消）`;}
    async function loadPart(i){
      for(let attempt=0;attempt<2;attempt++){
        if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
        const requestController=new AbortController();
        const cancel=()=>requestController.abort();controller.signal.addEventListener('abort',cancel,{once:true});
        let timeout=setTimeout(cancel,30000);
        try{
          received[i]=0;
          const response=await fetch(`${downloadArchive}${name}.part${i+1}`,{signal:requestController.signal});
          if(!response.ok)throw Error(`第 ${i+1} 段 HTTP ${response.status}`);
          if(/text\/html/.test(response.headers.get('content-type')||''))throw Error('下载地址返回了网页而非文件');
          const reader=response.body.getReader(),chunks=[];
          for(;;){const {done,value}=await reader.read();if(done)break;clearTimeout(timeout);timeout=setTimeout(cancel,30000);chunks.push(value);received[i]+=value.byteLength;progress();}
          if(!received[i])throw Error(`第 ${i+1} 段为空`);
          const blob=new Blob(chunks),expected=metadata.parts[i];
          if(blob.size!==expected.bytes)throw Error('文件段大小校验失败');
          const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
          const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
          if(hash!==expected.sha256)throw Error('文件段SHA-256校验失败');
          if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
          parts[i]=blob;completed++;progress();return;
        }catch(error){
          if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
          if(attempt===1)throw Error(`第 ${i+1} 段连接失败或超时，请稍后重试或使用官方发布页。`);
          status.textContent=`正在重试第 ${i+1} 段……`;
        }finally{clearTimeout(timeout);controller.signal.removeEventListener('abort',cancel);}
      }
    }
    async function worker(){while(next<total){const i=next++;await loadPart(i);}}
    try{
      status.textContent='正在读取本站下载校验清单……';
      const manifestController=new AbortController(),cancel=()=>manifestController.abort();controller.signal.addEventListener('abort',cancel,{once:true});
      const manifestTimeout=setTimeout(cancel,15000);
      try{
        const response=await fetch(new URL('downloads-manifest.json?v=20261018',location.href),{signal:manifestController.signal});
        if(!response.ok)throw Error('下载校验清单暂不可用');
        const manifest=await response.json();metadata=manifest.files?.[name];
        if(!metadata || metadata.parts?.length!==total)throw Error('下载校验清单不匹配');
      }finally{clearTimeout(manifestTimeout);controller.signal.removeEventListener('abort',cancel);}
      if(!crypto.subtle)throw Error('请通过HTTPS安全地址下载');
      await Promise.all(Array.from({length:Math.min(2,total)},worker));
      if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
      const magic=new Uint8Array(await parts[0].slice(0,2).arrayBuffer());
      if(name.endsWith('.zip') ? magic[0]!==0x50 || magic[1]!==0x4b : magic[0]!==0x4d || magic[1]!==0x5a)throw Error('文件格式校验失败，已停止下载');
      const blob=new Blob(parts,{type:name.endsWith('.zip')?'application/zip':'application/vnd.microsoft.portable-executable'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      status.textContent='文件已开始保存，请在浏览器下载列表查看。';
    }catch(error){const cancelled=controller.signal.aborted;controller.abort();status.textContent=cancelled?'已取消下载，可重新开始。':`下载失败：${error.message}`;}
    finally{activeDownload=null;button.textContent=originalLabel;button.removeAttribute('aria-busy');downloadButtons.forEach(b=>{b.disabled=false;});}
  });
}
