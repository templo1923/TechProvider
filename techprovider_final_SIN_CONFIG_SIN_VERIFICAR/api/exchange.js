// OLD FLOW without config_id - avoids Kiamber Corp error
import { redisSet, redisSAdd, redisLPush } from '../lib/redis.js';
import { encryptValue, encryptObject } from '../lib/encrypt.js';
const APP_ID=process.env.APP_ID||process.env.NEXT_PUBLIC_FB_APP_ID||'811281598468466';
const APP_SECRET=process.env.APP_SECRET||'';
const GRAPH_VERSION='v20.0';
const GRAPH_BASE=`https://graph.facebook.com/${GRAPH_VERSION}`;
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  let body=req.body;
  if(typeof body==='string'){ try{ body=JSON.parse(body);}catch{ body={}; } }
  const { code, destination_url, verify_token, business_id: inputBusinessId, is_live_on_whatsapp } = body||{};
  if(!code) return res.status(400).json({error:'Missing code from FB.login'});
  if(!destination_url) return res.status(400).json({error:'Missing destination_url'});
  if(!verify_token) return res.status(400).json({error:'Missing verify_token'});
  if(!APP_SECRET) return res.status(500).json({error:'APP_SECRET not configured on server'});
  try{ new URL(destination_url); }catch{ return res.status(400).json({error:'Invalid destination_url'}); }
  try{
    const tokenUrl=`${GRAPH_BASE}/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&code=${encodeURIComponent(code)}`;
    const tokenRes=await fetch(tokenUrl);
    const tokenJson=await tokenRes.json();
    if(!tokenRes.ok||!tokenJson.access_token){ console.error('Token exchange failed',tokenJson); return res.status(400).json({error:'Failed to exchange code for token',details:tokenJson}); }
    const userAccessToken=tokenJson.access_token;
    let businessId=inputBusinessId; let businesses=[];
    if(!businessId){
      const bizRes=await fetch(`${GRAPH_BASE}/me/businesses?access_token=${encodeURIComponent(userAccessToken)}&limit=50`);
      const bizJson=await bizRes.json();
      if(bizRes.ok){ businesses=bizJson.data||[]; if(businesses.length>0) businessId=businesses[0].id; }
    }
    if(!businessId){ return res.status(400).json({error:'No business found - ensure you are admin of a Business Manager',rawBusinesses:businesses}); }
    const wabaRes=await fetch(`${GRAPH_BASE}/${businessId}/owned_whatsapp_business_accounts?access_token=${encodeURIComponent(userAccessToken)}&limit=50`);
    const wabaJson=await wabaRes.json();
    if(!wabaRes.ok){ console.error('owned_whatsapp_business_accounts failed',wabaJson); return res.status(400).json({error:'Failed to fetch owned WhatsApp Business Accounts',details:wabaJson}); }
    const wabas=wabaJson.data||[];
    if(wabas.length===0){ return res.status(400).json({error:'No WABA found in this Business - create one first in Business Manager'}); }
    const wabaId=wabas[0].id;
    const phonesRes=await fetch(`${GRAPH_BASE}/${wabaId}/phone_numbers?access_token=${encodeURIComponent(userAccessToken)}&limit=50`);
    const phonesJson=await phonesRes.json();
    if(!phonesRes.ok){ console.error('phone_numbers fetch failed',phonesJson); return res.status(400).json({error:'Failed to fetch phone numbers',details:phonesJson}); }
    const phoneNumbers=phonesJson.data||[];
    let subscribeResult=null; let subscribeError=null;
    try{
      const subscribeUrl=`${GRAPH_BASE}/${wabaId}/subscribed_apps`;
      const payload={ override_callback_uri:destination_url, verify_token:verify_token };
      const subUrlWithToken=`${subscribeUrl}?access_token=${encodeURIComponent(userAccessToken)}`;
      const subRes2=await fetch(subUrlWithToken,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const subJson=await subRes2.json();
      if(!subRes2.ok){ subscribeError=subJson; console.warn('subscribed_apps override failed',subJson); }
      else{ subscribeResult=subJson; console.log('subscribed_apps override success',subJson); }
    }catch(e){ subscribeError={message:e.message}; console.warn('subscribe exception',e); }
    const saved=[];
    for(const phone of phoneNumbers){
      const phoneId=phone.id;
      const mappingPayload={
        waba_id:wabaId,
        phone_number_id:phoneId,
        display_phone_number:phone.display_phone_number||null,
        verified_name:phone.verified_name||null,
        code_verification_status:phone.code_verification_status||null,
        business_id:businessId,
        destination_url:destination_url,
        verify_token:verify_token,
        user_access_token_enc:encryptValue(userAccessToken),
        app_id:APP_ID,
        is_live_on_whatsapp:!!is_live_on_whatsapp,
        subscribe_result:subscribeResult,
        subscribe_error:subscribeError,
        created_at:new Date().toISOString(),
        flow:'OLD_SELF_SERVE_NO_CONFIG_ID'
      };
      const encryptedBlob=encryptObject(mappingPayload);
      await redisSet(`waba_map:${phoneId}`,encryptedBlob);
      await redisSet(`mapping:${phoneId}`,encryptedBlob);
      await redisSet(`waba:${wabaId}:phone:${phoneId}`,encryptedBlob);
      await redisSAdd('connections',phoneId);
      await redisSAdd(`business:${businessId}:phones`,phoneId);
      await redisLPush(`lifecycle_events:${phoneId}`,{
        type:'connection_created', waba_id:wabaId, phone_number_id:phoneId, business_id:businessId,
        destination_url:destination_url, flow:'OLD_SELF_SERVE_NO_CONFIG_ID', subscribe_overridden:!!subscribeResult, created_at:new Date().toISOString()
      });
      saved.push({ phone_number_id:phoneId, display_phone_number:phone.display_phone_number, verified_name:phone.verified_name, waba_id:wabaId });
    }
    await redisSet(`waba_map:${wabaId}`,encryptObject({
      waba_id:wabaId, business_id:businessId, phone_numbers:saved,
      destination_url, verify_token_enc:encryptValue(verify_token),
      user_token_enc:encryptValue(userAccessToken), created_at:new Date().toISOString()
    }));
    return res.status(200).json({
      success:true, business_id:businessId, waba_id:wabaId, phone_numbers:saved,
      businesses:businesses.map(b=>({id:b.id,name:b.name})),
      subscribed_apps_result:subscribeResult, subscribed_apps_error:subscribeError,
      message: subscribeResult ? 'Override subscribed successfully - messages will go directly to your server' : 'Mapping saved - override may require manual subscription (check app permissions)',
      note:'Flujo self-serve sin config_id - funciona sin verificar portafolio en modo desarrollo'
    });
  }catch(err){ console.error('exchange error',err); return res.status(500).json({error:'Internal error',details:err.message}); }
}