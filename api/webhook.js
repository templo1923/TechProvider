/**
 * Clean message-blind router - no burned data
 * Env: VERIFY_TOKEN, APP_ID, WHATSAPP_CONFIG_ID, KV vars
 */
import { kvGet, kvLpush } from '../lib/redis.js';
function getVerifyToken(){ const t=process.env.VERIFY_TOKEN; if(!t) throw new Error('Missing VERIFY_TOKEN env'); return t.trim(); }
function getAppId(){ return (process.env.APP_ID || '811281598468466').trim(); }
function getConfigId(){ return (process.env.WHATSAPP_CONFIG_ID || process.env.CONFIG_ID || '1889600718898450').trim(); }
export default async function handler(req,res){
  const APP_ID=getAppId(); const CONFIG_ID=getConfigId();
  if(req.method==='GET'){
    try{
      const mode=req.query['hub.mode']; const token=req.query['hub.verify_token']; const challenge=req.query['hub.challenge'];
      const EXPECTED=getVerifyToken();
      if(mode==='subscribe' && token===EXPECTED){ console.log(`[VERIFY OK] config_id=${CONFIG_ID}`); return res.status(200).send(challenge); }
      else { console.warn('[VERIFY FAIL]'); return res.status(403).send('Forbidden'); }
    }catch(e){ return res.status(500).send(e.message); }
  }
  if(req.method==='POST'){
    try{
      const body=req.body||{};
      if(body.object!=='whatsapp_business_account') return res.status(200).send('Not WA event');
      for(const entry of body.entry||[]){
        for(const change of entry.changes||[]){
          const value=change.value||{}; const metadata=value.metadata||{};
          const phone_number_id=(metadata.phone_number_id || value.phone_number_id || entry.id || '').toString().trim();
          const waba_id=(value.business_id || entry.id || '').toString().trim();
          if(value.messages && value.messages.length>0){
            const dropLog={type:'message_dropped', reason:'message_blind_router', phone_number_id, waba_id, count:value.messages.length, from:value.messages.map(m=>m.from), timestamp:new Date().toISOString(), app_id:APP_ID, config_id:CONFIG_ID};
            if(phone_number_id) await kvLpush(`logs:${phone_number_id}`, dropLog).catch(()=>{});
            await kvLpush('logs:global', dropLog).catch(()=>{}); continue;
          }
          if(value.statuses && value.statuses.length>0){
            for(const st of value.statuses){
              const lifecycle={type:'status', id:st.id, status:st.status, timestamp:st.timestamp, recipient_id:st.recipient_id, phone_number_id, waba_id, errors:st.errors||null, pricing:st.pricing||null, conversation:st.conversation||null, received_at:new Date().toISOString(), app_id:APP_ID, config_id:CONFIG_ID};
              if(phone_number_id) await kvLpush(`logs:${phone_number_id}`, lifecycle).catch(()=>{});
              await kvLpush('logs:global', lifecycle).catch(()=>{});
              try{
                if(phone_number_id){
                  const mapping=await kvGet(`waba_map:${phone_number_id}`).catch(()=>null);
                  if(mapping?.destination_url){
                    fetch(mapping.destination_url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({object:'whatsapp_business_account',entry:[{id:waba_id,changes:[{field:'messages',value:{statuses:[st],metadata}}]}]})}).catch(()=>{});
                  }
                }
              }catch{}
            }
          }
          if(!value.messages && !value.statuses){
            const other={type:change.field||'lifecycle', value, phone_number_id, waba_id, received_at:new Date().toISOString(), app_id:APP_ID, config_id:CONFIG_ID};
            if(phone_number_id) await kvLpush(`logs:${phone_number_id}`, other).catch(()=>{});
            await kvLpush('logs:global', other).catch(()=>{});
          }
        }
      }
      return res.status(200).send('EVENT_RECEIVED');
    }catch(err){ console.error('webhook err',err); return res.status(200).send('EVENT_RECEIVED'); }
  }
  return res.status(405).send('Method Not Allowed');
}
export const config={api:{bodyParser:true}};
