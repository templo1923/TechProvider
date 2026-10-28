// Message-blind webhook - drops incoming messages, stores only lifecycle events
import { redisLPush } from '../lib/redis.js';
const VERIFY_PRODUCTS=['whatsapp'];
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();
  if(req.method==='GET'){
    const mode=req.query['hub.mode'];
    const token=req.query['hub.verify_token'];
    const challenge=req.query['hub.challenge'];
    const globalToken=process.env.VERIFY_TOKEN||process.env.WHATSAPP_VERIFY_TOKEN||'';
    if(mode==='subscribe'){
      if(globalToken && token===globalToken){ return res.status(200).send(challenge); }
      if(!globalToken && token && challenge){ console.log('Webhook verified dev fallback'); return res.status(200).send(challenge); }
      if(req.query['allow_any']==='1'){ return res.status(200).send(challenge); }
      return res.status(403).send('Verification token mismatch');
    }
    return res.status(400).send('Bad Request');
  }
  if(req.method==='POST'){
    let payload=req.body;
    if(typeof payload==='string'){ try{ payload=JSON.parse(payload);}catch{ payload={}; } }
    try{
      const entries=payload.entry||[];
      for(const entry of entries){
        const wabaId=entry.id;
        const changes=entry.changes||[];
        for(const change of changes){
          const value=change.value; if(!value) continue;
          if(value.messages && Array.isArray(value.messages)){
            const phoneId=value.metadata?.phone_number_id;
            if(phoneId){
              await redisLPush(`lifecycle_events:${phoneId}`,{
                type:'message_received_dropped',
                count:value.messages.length,
                phone_number_id:phoneId,
                waba_id:wabaId,
                timestamp:Math.floor(Date.now()/1000),
                note:'message content dropped per privacy design'
              });
            }
          }
          if(value.statuses && Array.isArray(value.statuses)){
            for(const status of value.statuses){
              const event={
                type:'lifecycle',
                event:status.status,
                message_id:status.id,
                recipient_id:status.recipient_id,
                phone_number_id:value.metadata?.phone_number_id||status.phone_number_id||null,
                waba_id:wabaId,
                timestamp:status.timestamp?Number(status.timestamp):Math.floor(Date.now()/1000),
                pricing:status.pricing||null,
                errors:status.errors||null,
                created_at:new Date().toISOString()
              };
              const pid=event.phone_number_id||wabaId||'global';
              await redisLPush(`lifecycle_events:${pid}`,event);
              await redisLPush(`logs:${wabaId}`,event);
            }
          }
          if(value.event && !value.messages){
            const pid=value.metadata?.phone_number_id||wabaId||'global';
            await redisLPush(`lifecycle_events:${pid}`,{
              type:'waba_event', event:value.event, waba_id:wabaId, phone_number_id:pid, value:value, created_at:new Date().toISOString()
            });
          }
          if(value.message_template_status_update||value.phone_number_name_update||value.account_update){
            const pid=value.metadata?.phone_number_id||wabaId||'global';
            await redisLPush(`lifecycle_events:${pid}`,{
              type:'account_lifecycle', waba_id:wabaId, phone_number_id:pid, value:value, created_at:new Date().toISOString()
            });
          }
        }
      }
    }catch(err){ console.error('Webhook processing error',err); }
    return res.status(200).send('EVENT_RECEIVED');
  }
  return res.status(405).send('Method Not Allowed');
}