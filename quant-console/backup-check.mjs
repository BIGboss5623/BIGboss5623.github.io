// Initial structure checks only. No networking, evaluation or data persistence.
const kinds = new Set(['balanced','trend','mean_reversion','ma_cross','macd_momentum','dual_momentum','range_plan']);
const paramKeys = new Set(['kind','fast_ma','slow_ma','rsi_buy','rsi_sell','fee','plan_amount','plan_capital','plan_withdraw_pct']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value,keys) => object(value) && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const numeric = (value,min=0,max=1e15) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const symbol = value => typeof value === 'string' && /^[0-9]{6}$/.test(value);
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value) && value.length <= 40 && Number.isFinite(Date.parse(value));
function requireValid(condition) {if(!condition) throw new Error('备份结构或字段不符合当前格式，请使用恢复工具进一步检查。')}

export function inspectBackup(text) {
  let data;
  try {data=JSON.parse(text)} catch {throw new Error('不是有效 JSON 文件。请选择工作台导出的状态备份。')}
  requireValid(exactKeys(data,['exported_at','strategies','portfolio']) && timestamp(data.exported_at));
  requireValid(object(data.strategies));
  const strategies=Object.entries(data.strategies);
  requireValid(strategies.length>=1 && strategies.length<=1000);
  for(const [name,params] of strategies) {
    requireValid(name.trim().length>0 && name.length<=200 && object(params));
    requireValid(Object.keys(params).every(key=>paramKeys.has(key)));
    requireValid(Object.entries(params).every(([key,value])=>key==='kind'?kinds.has(value):numeric(value)));
    const fast=params.fast_ma??20,slow=params.slow_ma??60;
    requireValid(Number.isInteger(fast) && Number.isInteger(slow) && fast>=(params.kind==='range_plan'?1:2) && fast<slow && slow<=250);
    requireValid(numeric(params.fee??.0015,0,.05) && numeric(params.rsi_buy??68,1,99) && numeric(params.rsi_sell??35,1,99));
    requireValid(numeric(params.plan_withdraw_pct??20,1,100) && (params.plan_amount??500)>0 && (params.plan_capital??10000)>0 && (params.plan_amount??500)<=(params.plan_capital??10000));
  }
  requireValid(exactKeys(data.portfolio,['holdings','journal']));
  const {holdings,journal}=data.portfolio;
  requireValid(Array.isArray(holdings) && holdings.length<=10000 && Array.isArray(journal) && journal.length<=500);
  const seen = new Set();
  for(const row of holdings) {
    requireValid(exactKeys(row,['symbol','shares','cost','target']) && symbol(row.symbol) && !seen.has(row.symbol));
    seen.add(row.symbol);
    requireValid(numeric(row.shares) && row.shares>0 && numeric(row.cost) && row.cost>0 && numeric(row.target,0,100));
  }
  for(const row of journal) {
    requireValid(exactKeys(row,['time','symbol','side','price','shares','note']) && timestamp(row.time) && symbol(row.symbol));
    requireValid(['买入','卖出','观察'].includes(row.side) && numeric(row.price) && numeric(row.shares) && typeof row.note==='string' && row.note.length<=200);
  }
  return {exportedAt:data.exported_at,strategies:strategies.length,holdings:holdings.length,journal:journal.length};
}
