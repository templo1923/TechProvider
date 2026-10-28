import { redisLRange } from '../lib/redis.js';
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  const phoneId=req.query.phone_id||req.query.phone_number_id||req.query.waba_id||'global';
  const limit=Math.min(parseInt(req.query.limit||'100',10),500);
  try{
    const events=await redisLRange(`lifecycle_events:${phoneId}`,0,limit-1);
    let combined=events;
    if(phoneId!=='global' && phoneId.startsWith('10')){
      const wabaLogs=await redisLRange(`logs:${phoneId}`,0,limit-1);
      combined=[...events,...wabaLogs].slice(0,limit);
    }
    const parsed=combined.map(item=>{ if(typeof item==='string'){ try{ return JSON.parse(item);}catch{ return {raw:item}; } } return item; });
    parsed.sort((a,b)=>{ const ta=a.timestamp||0; const tb=b.timestamp||0; return tb-ta; });
    return res.status(200).json({phone_id:phoneId,count:parsed.length,events:parsed});
  }catch(e){ console.error(e); return res.status(500).json({error:e.message}); }
}