// /api/webhook — message-blind: GET verify, POST drops messages, stores lifecycle only
const { getStore } = require('./_lib/kv');
const { decrypt } = require('./_lib/crypto');

module.exports = async (req, res) => {
  const store = await getStore();

  if(req.method === 'GET'){
    // Verification: hub.mode=subscribe & hub.verify_token matches any stored token or env
    const mode = req.query['hub.mode'] || req.query['hub_mode'];
    const token = req.query['hub.verify_token'] || req.query['hub_verify_token'];
    const challenge = req.query['hub.challenge'] || req.query['hub_challenge'];

    if(mode === 'subscribe'){
      // check against stored verify tokens
      let valid = false;
      const envToken = process.env.WEBHOOK_VERIFY_TOKEN;
      if(envToken && token === envToken) valid = true;

      if(!valid){
        try{
          const phones = await store.list('phone:');
          for(const entry of (phones||[])){
            const v = entry.value;
            let stored = '';
            try{
              stored = v.verify_token_enc ? decrypt(v.verify_token_enc) : (v.verify_token || '');
            }catch{}
            if(!stored) stored = v.verify_token || '';
            if(stored && stored === token){ valid = true; break; }
          }
        }catch(e){}
      }

      // For white-label with override_callback_uri, destination_url handles own verification.
      // We still allow any token if no phones yet for initial setup test? No, require match unless empty.
      // If no phones configured, allow valid if token non-empty to help test (but log).
      if(!valid){
        try{
          const phones = await store.list('phone:');
          if(!phones || phones.length===0){
            // no phones yet, allow any token for testing initial webhook config in Meta
            console.log('No phones stored yet, allowing verification for testing');
            valid = true;
          }
        }catch{}
      }

      if(valid && challenge){
        res.status(200).send(challenge);
        return;
      } else {
        res.status(403).json({ok:false, error:'verify token mismatch'});
        return;
      }
    }
    res.status(400).json({ok:false, error:'invalid verification request'});
    return;
  }

  if(req.method === 'POST'){
    try{
      let body = req.body;
      if(typeof body === 'string'){
        body = JSON.parse(body);
      }
      // MESSAGE-BLIND enforcement: drop messages field completely
      if(body && body.entry){
        for(const entry of body.entry){
          if(entry.changes){
            for(const change of entry.changes){
              if(change.value){
                if(change.value.messages){
                  // Drop before any processing / logging
                  delete change.value.messages;
                }
                // also drop contacts that may contain message-related? keep but note
                // We only keep statuses, errors, quality updates
                const val = change.value;
                // store lifecycle event
                const storeKey = `lifecycle:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;
                const safeEvent = {
                  timestamp: new Date().toISOString(),
                  waba_id: change.value?.metadata?.phone_number_id ? undefined : (entry.id || change.value?.metadata?.display_phone_number),
                  metadata: val.metadata || {},
                  statuses: val.statuses || [],
                  errors: val.errors || [],
                  event_type: val.statuses ? 'status' : (val.errors ? 'error' : (val.display_phone_number ? 'quality' : 'other')),
                  // message-blind proof
                  blind: true,
                  count: 1
                };
                // include quality info if present
                if(val.display_phone_number || val.event || val.quality_rating){
                  safeEvent.quality = val;
                }
                try{
                  await store.set(storeKey, safeEvent);
                  if(store.addToIndex) await store.addToIndex('lifecycle:', storeKey);
                }catch(e){}
              }
            }
          }
        }
      }

      // Always return ok, blind enforced
      res.status(200).json({ok:true, blind:true, message:'Message-blind enforced — lifecycle stored only'});
      return;
    }catch(err){
      console.error('webhook POST error', err);
      // still return 200 to avoid Meta retries
      res.status(200).json({ok:true, blind:true, error_logged: true});
      return;
    }
  }

  if(req.method === 'OPTIONS'){ res.status(200).end(); return; }
  res.status(405).json({ok:false});
};
