// Clean connections
import { kvKeys, kvGet, kvSmembers } from '../lib/redis.js';
function getAppId(){return (process.env.APP_ID||'811281598468466').trim();} function getConfigId(){return (process.env.WHATSAPP_CONFIG_ID||'1889600718898450').trim();}
export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  const APP_ID=getAppId(); const CONFIG_ID=getConfigId();
  try{
    let phoneIds=[]; try{ phoneIds=await kvSmembers('connections:index'); }catch{}
    if(!phoneIds||phoneIds.length===0){ try{ const keys=await kvKeys('waba_map:*'); phoneIds=keys.map(k=>k.replace('waba_map:','')).filter(Boolean); }catch{} }
    const connections=[]; for(const pid of phoneIds||[]){ const clean=pid.trim(); if(!clean) continue; const data=await kvGet(`waba_map:${clean}`).catch(()=>null); if(!data) continue; connections.push({phone_number_id:data.phone_number_id||clean, waba_id:data.waba_id, business_id:data.business_id, display_phone_number:data.display_phone_number||'', destination_url:data.destination_url, override_callback_uri:data.override_callback_uri, coexistence:data.coexistence, created_at:data.created_at, app_id:APP_ID, config_id:CONFIG_ID, status:'connected', message_blind:true}); }
    connections.sort((a,b)=> new Date(b.created_at||0)-new Date(a.created_at||0));
    return res.status(200).json({app_id:APP_ID, config_id:CONFIG_ID, total:connections.length, connections});
  }catch(err){ return res.status(200).json({app_id:APP_ID, config_id:CONFIG_ID, total:0, connections:[], error:err.message}); }
}
