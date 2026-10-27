// Clean mapping
import { kvKeys, kvGet, kvDel, kvSmembers, kvSet, kvSadd } from '../lib/redis.js';
function getAppId(){return (process.env.APP_ID||'811281598468466').trim();} function getConfigId(){return (process.env.WHATSAPP_CONFIG_ID||'1889600718898450').trim();}
export default async function handler(req,res){
  const APP_ID=getAppId(); const CONFIG_ID=getConfigId();
  if(req.method==='GET'){
    try{
      let phoneIds=[]; try{ phoneIds=await kvSmembers('connections:index'); }catch{}
      if(!phoneIds||phoneIds.length===0){ try{ const keys=await kvKeys('waba_map:*'); phoneIds=keys.map(k=>k.replace('waba_map:','')).filter(Boolean); }catch{} }
      const mappings=[]; for(const pid of phoneIds||[]){ const clean=pid.trim(); if(!clean) continue; const data=await kvGet(`waba_map:${clean}`).catch(()=>null); if(!data) continue; mappings.push({phone_number_id:data.phone_number_id||clean, waba_id:data.waba_id, business_id:data.business_id, display_phone_number:data.display_phone_number||'', destination_url:data.destination_url, override_callback_uri:data.override_callback_uri, coexistence:data.coexistence||false, created_at:data.created_at, config_id:data.config_id||CONFIG_ID, app_id:data.app_id||APP_ID}); }
      return res.status(200).json({app_id:APP_ID, config_id:CONFIG_ID, count:mappings.length, mappings});
    }catch(err){ return res.status(200).json({app_id:APP_ID, config_id:CONFIG_ID, count:0, mappings:[], error:err.message}); }
  }
  if(req.method==='POST'){
    try{
      const {waba_id, phone_number_id, destination_url}=req.body||{};
      if(!phone_number_id||!destination_url) return res.status(400).json({error:'Missing phone_number_id or destination_url'});
      const pid=phone_number_id.toString().trim(); const existing=await kvGet(`waba_map:${pid}`).catch(()=>null)||{};
      const record={...existing, waba_id:(waba_id||existing.waba_id||'').trim(), phone_number_id:pid, destination_url:destination_url.trim(), override_callback_uri:destination_url.trim(), updated_at:new Date().toISOString()};
      await kvSet(`waba_map:${pid}`, record); await kvSadd('connections:index', pid);
      return res.status(200).json({success:true, mapping:record});
    }catch(e){ return res.status(500).json({error:e.message}); }
  }
  if(req.method==='DELETE'){
    try{
      const {phone_number_id}=req.query||{}; if(!phone_number_id) return res.status(400).json({error:'Missing phone_number_id'});
      const pid=phone_number_id.toString().trim(); await kvDel(`waba_map:${pid}`); await kvDel(`waba_map:${pid} `).catch(()=>{}); return res.status(200).json({success:true, deleted:pid});
    }catch(e){ return res.status(500).json({error:e.message}); }
  }
  return res.status(405).json({error:'Method not allowed'});
}
