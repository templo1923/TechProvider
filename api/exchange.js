import { getRedis, encryptToken } from '../lib/redis.js';
export default async function handler(req,res){
  const { code, destination_url, verify_token } = req.body;
  const APP_ID = process.env.APP_ID, APP_SECRET = process.env.APP_SECRET;
  if(!code) return res.status(400).json({error:'falta code'});
  const tokenRes = await fetch(`https://graph.facebook.com/v23.0/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&code=${code}&redirect_uri=https://techproviderseller.vercel.app/`);
  const tokenData = await tokenRes.json();
  const user_token = tokenData.access_token;
  const bizRes = await fetch(`https://graph.facebook.com/v23.0/me/businesses?access_token=${user_token}`); const bizData = await bizRes.json(); const business_id = bizData.data?.[0]?.id;
  const wabaRes = await fetch(`https://graph.facebook.com/v23.0/me/whatsapp_business_accounts?access_token=${user_token}`); const wabaData = await wabaRes.json(); const waba_id = wabaData.data?.[0]?.id;
  const phoneRes = await fetch(`https://graph.facebook.com/v23.0/${waba_id}/phone_numbers?access_token=${user_token}`); const phoneData = await phoneRes.json(); const phone_id = phoneData.data?.[0]?.id; const phone_number = phoneData.data?.[0]?.display_phone_number;
  let system_user_id=null, perm_token=null;
  try{
    const sysRes = await fetch(`https://graph.facebook.com/v23.0/${business_id}/system_users`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name:'TechProvider Admin', role:'ADMIN', access_token:user_token})});
    const sysData = await sysRes.json(); system_user_id = sysData.id;
    await fetch(`https://graph.facebook.com/v23.0/${waba_id}/assigned_users`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({user: system_user_id, tasks:['MANAGE','DEVELOP'], access_token:user_token})});
    const permRes = await fetch(`https://graph.facebook.com/v23.0/${system_user_id}/access_tokens?business_app=${APP_ID}&scope=whatsapp_business_management,business_management,whatsapp_business_messaging&access_token=${user_token}`, {method:'POST'}); const permData = await permRes.json(); perm_token = permData.access_token;
  }catch(e){ console.log(e); }
  const redis = getRedis(); const connectionId = phone_id || waba_id;
  if(connectionId){
    await redis.hset(`connections:${connectionId}`, {waba_id:waba_id||'', phone_number_id:phone_id||'', phone_number:phone_number||'', destination_url:(destination_url||'').trim(), verify_token:(verify_token||'').trim(), token_encrypted: perm_token?encryptToken(perm_token):'', business_id:business_id||'', system_user_id:system_user_id||'', status:'live', type:'Coexistencia', created_at:new Date().toISOString()});
    if(destination_url){ const dest=destination_url.trim(); if(waba_id) await redis.hset('waba_map', {[waba_id.trim()]:dest}); if(phone_id) await redis.hset('waba_map', {[phone_id.trim()]:dest}); }
    if(destination_url && verify_token && waba_id && perm_token){ await fetch(`https://graph.facebook.com/v23.0/${waba_id}/subscribed_apps`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({override_callback_uri:destination_url.trim(), verify_token:verify_token.trim(), subscribed_fields:['messages','message_template_status_update'], access_token:perm_token})}); }
  }
  return res.status(200).json({ok:true, waba_id, phone_id, phone_number, has_perm_token:!!perm_token, access_token_once:perm_token});
}