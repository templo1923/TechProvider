import { redisGet, redisSet, redisDel, redisKeys } from '../lib/redis.js';
import { decryptObject, encryptObject } from '../lib/encrypt.js';
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();
  const phoneId=req.query.phone_id||req.query.phone_number_id||(req.body&&req.body.phone_number_id);
  if(req.method==='GET'){
    if(phoneId){
      const raw=await redisGet(`mapping:${phoneId}`) || await redisGet(`waba_map:${phoneId}`);
      if(!raw) return res.status(404).json({error:'Mapping not found'});
      let obj=null;
      try{ obj=decryptObject(raw); if(typeof obj==='string'){ try{ obj=JSON.parse(obj);}catch{} } }catch{ try{ obj=JSON.parse(raw);}catch{ obj={raw}; } }
      if(obj){
        const safe={ waba_id:obj.waba_id, phone_number_id:obj.phone_number_id, display_phone_number:obj.display_phone_number, business_id:obj.business_id, destination_url:obj.destination_url, app_id:obj.app_id, created_at:obj.created_at, flow:obj.flow, subscribe_result:obj.subscribe_result||null, subscribe_error:obj.subscribe_error||null };
        return res.status(200).json(safe);
      }
      return res.status(200).json({raw:'unable to decrypt'});
    } else {
      const keys=await redisKeys('mapping:*');
      const results=[];
      for(const k of keys.slice(0,100)){
        const raw=await redisGet(k);
        let obj=null; try{ obj=decryptObject(raw);}catch{}
        if(obj && typeof obj==='object'){ results.push({ phone_number_id:obj.phone_number_id, waba_id:obj.waba_id, business_id:obj.business_id, destination_url:obj.destination_url, created_at:obj.created_at }); }
        else{ results.push({key:k}); }
      }
      return res.status(200).json({count:results.length,mappings:results});
    }
  }
  if(req.method==='DELETE'){
    if(!phoneId) return res.status(400).json({error:'phone_id required'});
    await redisDel(`mapping:${phoneId}`); await redisDel(`waba_map:${phoneId}`);
    return res.status(200).json({success:true,deleted:phoneId});
  }
  if(req.method==='POST'){
    let body=req.body;
    if(typeof body==='string'){ try{ body=JSON.parse(body);}catch{ body={}; } }
    const { phone_number_id, waba_id, destination_url }=body||{};
    if(!phone_number_id||!waba_id||!destination_url) return res.status(400).json({error:'phone_number_id, waba_id, destination_url required'});
    const payload={ ...body, created_at:new Date().toISOString(), flow:body.flow||'manual' };
    const enc=encryptObject(payload);
    await redisSet(`mapping:${phone_number_id}`,enc);
    await redisSet(`waba_map:${phone_number_id}`,enc);
    return res.status(200).json({success:true});
  }
  return res.status(405).json({error:'Method not allowed'});
}