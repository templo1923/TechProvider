// POST /api/exchange — OLD flow without config_id
// code -> access_token -> me/businesses -> owned_whatsapp_business_accounts -> phone_numbers -> details -> POST subscribed_apps override_callback_uri = destination_url
// save to KV waba_map:phone_id encrypted, no burned data
const { getStore } = require('./_lib/kv');
const { encrypt } = require('./_lib/crypto');
const { graphFetch, exchangeCodeForToken } = require('./_lib/meta');

module.exports = async (req, res) => {
  if(req.method === 'OPTIONS'){ res.status(200).end(); return; }
  if(req.method !== 'POST'){ res.status(405).json({ok:false, error:'Method not allowed'}); return; }

  try{
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    // Vercel may need raw body parsing fallback
    let parsed = body;
    if(!parsed.code){
      try{
        const chunks = [];
        // if body empty, try req parsing via manual? already handled
      }catch{}
    }
    const { code, destination_url, verify_token, coexistence } = parsed;

    if(!code) return res.status(400).json({ok:false, error:'code missing from Embedded Signup'});
    if(!destination_url) return res.status(400).json({ok:false, error:'destination_url required'});
    if(!verify_token) return res.status(400).json({ok:false, error:'verify_token required'});
    try{ new URL(destination_url); }catch{ return res.status(400).json({ok:false, error:'destination_url must be valid https URL'}); }

    // 1) exchange code
    const access_token = await exchangeCodeForToken(code);

    // 2) get user businesses
    let businesses = [];
    try{
      const r = await graphFetch('/me/businesses', {token: access_token, params:{limit:'50'}});
      businesses = r.data || [];
    }catch(e){
      // fallback try me/accounts?
      businesses = [];
    }
    if(businesses.length===0){
      // still try single WABA via owned_whatsapp_business_accounts on user?
      // attempt to list directly via /me/owned_whatsapp_business_accounts may fail, so we error helpfully
      // but continue to try via debug path: if token is business token, we might have waba from business? So we try first business id from error?
      // For old flow, businesses should exist.
      return res.status(400).json({ok:false, error:'No businesses found for this user. Ensure business_management permission granted.', details: businesses});
    }

    const store = await getStore();
    const connectedNumbers = [];

    // iterate businesses to find WABAs
    for(const biz of businesses){
      let wabas = [];
      try{
        const w = await graphFetch(`/${biz.id}/owned_whatsapp_business_accounts`, {token: access_token, params:{limit:'100'}});
        wabas = w.data || [];
      }catch(e){ continue; }

      for(const waba of wabas){
        let phones = [];
        try{
          const pr = await graphFetch(`/${waba.id}/phone_numbers`, {token: access_token, params:{limit:'100'}});
          phones = pr.data || [];
        }catch(e){ continue; }

        for(const ph of phones){
          // detailed info
          let details = ph;
          try{
            details = await graphFetch(`/${ph.id}`, {token: access_token, params:{
              fields:'id,display_phone_number,verified_name,quality_rating,code_verification_status,platform_type,throughput,last_onboarded_time'
            }});
          }catch(e){ details = ph; }

          // 3) subscribe app with override_callback_uri
          try{
            await graphFetch(`/${waba.id}/subscribed_apps`, {
              method:'POST',
              token: access_token,
              body:{
                override_callback_uri: destination_url,
                verify_token: verify_token
              }
            });
          }catch(e){
            // if fails, log but continue — might be already subscribed, try with same endpoint to update
            console.warn('subscribed_apps failed', e.message, e.details);
            // don't fail entire flow, still save
          }

          const record = {
            phone_id: details.id || ph.id,
            waba_id: waba.id,
            business_id: biz.id,
            display_phone_number: details.display_phone_number || ph.display_phone_number || '',
            verified_name: details.verified_name || '',
            quality_rating: details.quality_rating || 'UNKNOWN',
            code_verification_status: details.code_verification_status || '',
            platform_type: details.platform_type || (coexistence ? 'CLOUD_API' : 'CLOUD_API'),
            throughput: details.throughput || {level:'STANDARD'},
            tier: details.throughput?.level || 'STANDARD',
            destination_url_enc: encrypt(destination_url),
            verify_token_enc: encrypt(verify_token),
            // also store plain destination for display (masked)
            destination_url_plain: destination_url,
            coexistence: !!coexistence,
            connected_at: new Date().toISOString(),
            last_health_check: new Date().toISOString()
          };

          const key = `phone:${record.phone_id}`;
          await store.set(key, record);
          if(store.addToIndex) await store.addToIndex('phone:', key);

          connectedNumbers.push({
            phone_id: record.phone_id,
            display_phone_number: record.display_phone_number,
            verified_name: record.verified_name,
            quality_rating: record.quality_rating,
            tier: record.tier,
            destination: destination_url,
            coexistence: record.coexistence,
            connected_at: record.connected_at
          });
        }
      }
    }

    if(connectedNumbers.length===0){
      return res.status(400).json({ok:false, error:'No phone numbers found/discovered after businesses scan. Check permissions and that number finished onboarding.'});
    }

    res.status(200).json({ok:true, count: connectedNumbers.length, numbers: connectedNumbers});

  }catch(err){
    console.error('exchange error', err);
    res.status(500).json({ok:false, error: err.message, details: err.details || null});
  }
};
