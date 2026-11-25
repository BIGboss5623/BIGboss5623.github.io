document.querySelector('#try').addEventListener('click',()=>{
 try{
 const a=RobotsCheck.check(document.querySelector('#robots').value,document.querySelector('#agent').value,document.querySelector('#target').value);
 document.querySelector('#result').textContent=(a.allowed?'初步允许抓取':'初步禁止抓取')+'\n'+a.rule+(a.line?'（第'+a.line+'行）':'')+'\n匹配组：'+(a.groups.join(', ')||'无');
 }catch(e){document.querySelector('#result').textContent='错误：'+e.message}
});
document.querySelector('#sample').addEventListener('click',()=>{
 document.querySelector('#robots').value='User-agent: Baiduspider\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /\n\nUser-agent: *\nAllow: /';
});