/**
 * Clean exchange - no burned data
 * Env: APP_ID, APP_SECRET, WHATSAPP_CONFIG_ID, VERIFY_TOKEN, ENCRYPTION_KEY
 */
import { kvSet, kvSadd } from '../lib/redis.js';
import { encrypt } from '../lib/encrypt.js';
const GRAPH='https://graph.facebook.com/v20.0';
function getAppId(){ return (process.env.APP_ID || '811281598468466').trim(); }
function getConfigId(){ return (process.env.WHATSAPP_CONFIG_ID || process.env.CONFIG_ID || '1889600718898450').trim(); }
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const {code, destination_url, verify_token, coexistence, business_id: inputBusinessId} = req.body||{};
    if(!code) return res.status(400).json({error:'Missing code'});
    if(!destination_url) return res.status(400).json({error:'Missing destination_url - use placeholder https://your-app.com/webhook/whatsapp'});
    if(!destination_url.trim().startsWith('https://')) return res.status(400).json({error:'destination_url must be HTTPS'});
    const APP_ID=getAppId(); const CONFIG_ID=getConfigId();
    const APP_SECRET=process.env.APP_SECRET; if(!APP_SECRET) return res.status(500).json({error:'Missing APP_SECRET env'});
    const VERIFY_TOKEN=(verify_token || process.env.VERIFY_TOKEN || '').trim();
    if(!VERIFY_TOKEN) return res.status(400).json({error:'Missing verify_token - placeholder: your-webhook-verify-token'});

    const tokenUrl=`${GRAPH}/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&code=${encodeURIComponent(code.trim())}`;
    const tokenRes=await fetch(tokenUrl); const tokenData=await tokenRes.json();
    if(!tokenRes.ok || !tokenData.access_token){ console.error('token fail',tokenData); return res.status(400).json({error:'Token exchange failed', details:tokenData, hint:'Check App Domains and Valid OAuth Redirect URIs contain techproviderseller.vercel.app and app is Live'}); }
    const userToken=tokenData.access_token;

    let businesses=[]; const bizRes=await fetch(`${GRAPH}/me/businesses?access_token=${encodeURIComponent(userToken)}`); const bizData=await bizRes.json(); if(bizData.data) businesses=bizData.data;
    let wabas=[];
    for(const biz of businesses){
      const ownedRes=await fetch(`${GRAPH}/${biz.id}/owned_whatsapp_business_accounts?access_token=${encodeURIComponent(userToken)}`); const ownedData=await ownedRes.json().catch(()=>({})); if(ownedData.data) for(const w of ownedData.data) wabas.push({...w, business_id:biz.id});
      const clientRes=await fetch(`${GRAPH}/${biz.id}/client_whatsapp_business_accounts?access_token=${encodeURIComponent(userToken)}`); const clientData=await clientRes.json().catch(()=>({})); if(clientData.data) for(const w of clientData.data) wabas.push({...w, business_id:biz.id});
    }
    if(inputBusinessId){ const f=wabas.filter(w=>w.business_id===inputBusinessId); if(f.length>0) wabas=f; }
    let mappings=[]; let phone_numbers=[];
    for(const waba of wabas){
      const wabaId=(waba.id||'').trim(); if(!wabaId) continue;
      const phRes=await fetch(`${GRAPH}/${wabaId}/phone_numbers?access_token=${encodeURIComponent(userToken)}`); const phData=await phRes.json().catch(()=>({})); const numbers=phData.data||[];
      for(const ph of numbers){
        const phoneId=(ph.id||'').trim(); if(!phoneId) continue; phone_numbers.push(ph);
        let subResult=null;
        try{
          const subRes=await fetch(`${GRAPH}/${wabaId}/subscribed_apps`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({override_callback_uri:destination_url.trim(), verify_token:VERIFY_TOKEN, access_token:userToken})});
          subResult=await subRes.json().catch(()=>({}));
          if(!subRes.ok){
            const subRes2=await fetch(`${GRAPH}/${wabaId}/subscribed_apps?override_callback_uri=${encodeURIComponent(destination_url.trim())}&verify_token=${encodeURIComponent(VERIFY_TOKEN)}&access_token=${encodeURIComponent(userToken)}`,{method:'POST'});
            subResult=await subRes2.json().catch(()=>subResult);
          }
        }catch(e){ subResult={error:e.message}; }
        const record={waba_id:wabaId, phone_number_id:phoneId, phone_number:ph.display_phone_number||'', display_phone_number:ph.display_phone_number||'', business_id:waba.business_id, name:ph.verified_name||'', destination_url:destination_url.trim(), verify_token:VERIFY_TOKEN, coexistence:!!coexistence, config_id:CONFIG_ID, app_id:APP_ID, access_token_encrypted:encrypt(userToken), subscribed_apps_result:subResult, created_at:new Date().toISOString(), flow:'tech_provider_clean', override_callback_uri:destination_url.trim()};
        await kvSet(`waba_map:${phoneId}`, record).catch(()=>{}); await kvSadd('connections:index', phoneId).catch(()=>{});
        mappings.push({phone_number_id:phoneId, waba_id:wabaId, display_phone_number:ph.display_phone_number, subscribed_apps:subResult, destination_url:destination_url.trim()});
      }
    }
    return res.status(200).json({success:true, app_id:APP_ID, config_id:CONFIG_ID, businesses_found:businesses.length, wabas_found:wabas.length, phone_numbers_found:phone_numbers.length, mappings, message:`Tech Provider flow completed WITHOUT business verification using config_id ${CONFIG_ID}`});
  }catch(err){ console.error('exchange error',err); return res.status(500).json({error:'Internal error', details:err.message}); }
}
