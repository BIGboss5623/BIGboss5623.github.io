import {inspectBackup} from './backup-check.mjs';
const input=document.getElementById('backupFile');
const result=document.getElementById('backupResult');
const initial=result.textContent;
let revision=0;
input.addEventListener('change',async()=>{
  const current=++revision;
  const file=input.files?.[0];
  if(!file)return;
  result.dataset.state='unknown';
  result.textContent='正在当前浏览器检查…';
  try {
    if(file.size>5_000_000)throw new Error('文件超过 5 MB，未读取。请确认选择的是状态备份 JSON，不是行情包或完整部署包。');
    const checked=inspectBackup(await file.text());
    if(current!==revision)return;
    result.dataset.state='protected';
    result.textContent=`结构初检通过：${checked.strategies} 个策略、${checked.holdings} 条持仓、${checked.journal} 条交易记录。原文件导出时间：${checked.exportedAt}。\n不含行情、登录凭据或完整环境；完整恢复兼容性仍需恢复工具检查。本次未上传文件或修改数据。`;
  } catch(error) {
    if(current!==revision)return;
    result.dataset.state='unavailable';
    result.textContent=error.message;
  }
});
document.getElementById('clearBackup').addEventListener('click',()=>{
  revision++;
  input.value='';
  result.dataset.state='unknown';
  result.textContent=initial;
});
