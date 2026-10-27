// Clean logs
import { kvLrange } from '../lib/redis.js';
function getAppId(){return (process.env.APP_ID||'811281598468466').trim();} function getConfigId(){return (process.env.WHATSAPP_CONFIG_ID||'1889600718898450').trim();}
export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  const APP_ID=getAppId(); const CONFIG_ID=getConfigId();
  try{
    const {phone_id, limit='100'}=req.query||{}; const lim=Math.min(parseInt(limit)||100,500);
    let logs=[]; if(phone_id){ const clean=phone_id.toString().trim(); logs=await kvLrange(`logs:${clean}`,0,lim-1); } else { logs=await kvLrange('logs:global',0,lim-1); }
    const sanitized=(logs||[]).map(entry=>{ if(entry?.value?.messages) delete entry.value.messages; if(entry?.messages) delete entry.messages; return entry; });
    return res.status(200).json({app_id:APP_ID, config_id:CONFIG_ID, phone_id:phone_id||'global', count:sanitized.length, logs:sanitized, note:'Message-blind: messages dropped, only lifecycle stored'});
  }catch(err){ return res.status(200).json({app_id:APP_ID, config_id:CONFIG_ID, count:0, logs:[], error:err.message}); }
}
