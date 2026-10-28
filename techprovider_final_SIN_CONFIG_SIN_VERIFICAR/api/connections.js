import { redisGet, redisKeys, redisSMembers } from '../lib/redis.js';
import { decryptObject } from '../lib/encrypt.js';
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  try{
    const members=await redisSMembers('connections');
    let phoneIds=members||[];
    if(phoneIds.length===0){ const keys=await redisKeys('mapping:*'); phoneIds=keys.map(k=>k.replace('mapping:','')); }
    const connections=[];
    for(const pid of phoneIds.slice(0,100)){
      const raw=await redisGet(`mapping:${pid}`) || await redisGet(`waba_map:${pid}`);
      if(!raw){ connections.push({phone_number_id:pid,status:'missing_blob'}); continue; }
      let obj=null; try{ obj=decryptObject(raw); if(typeof obj==='string') obj=JSON.parse(obj); }catch{ obj=null; }
      if(obj){ connections.push({ phone_number_id:obj.phone_number_id||pid, waba_id:obj.waba_id, business_id:obj.business_id, display_phone_number:obj.display_phone_number||null, destination_url:obj.destination_url||null, flow:obj.flow||'unknown', created_at:obj.created_at, subscribed:!!obj.subscribe_result }); }
      else{ connections.push({phone_number_id:pid,raw:true}); }
    }
    return res.status(200).json({count:connections.length,connections});
  }catch(e){ console.error(e); return res.status(500).json({error:e.message}); }
}