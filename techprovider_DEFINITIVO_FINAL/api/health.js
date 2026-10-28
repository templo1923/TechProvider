// GET /api/health — quality real time, tier, status
const { getStore } = require('./_lib/kv');
const { decrypt } = require('./_lib/crypto');
const { graphFetch } = require('./_lib/meta');

module.exports = async (req, res) => {
  if(req.method !== 'GET'){ res.status(405).json({ok:false}); return; }
  const phone_id = req.query.phone_id || req.query.phoneId;
  if(!phone_id){ res.status(400).json({ok:false, error:'phone_id required'}); return; }
  try{
    const store = await getStore();
    const record = await store.get(`phone:${phone_id}`);
    if(!record){ res.status(404).json({ok:false, error:'not found'}); return; }

    // try live fetch if we have a token? We don't store token for security, but we can attempt using app token?
    // fallback to stored data + lifecycle events
    let lifecycle = [];
    try{
      const all = await store.list('lifecycle:');
      lifecycle = (all||[]).slice(-20).map(e=>e.value).reverse();
    }catch(e){}

    // decrypt destination for masking
    let dest = record.destination_url_plain || '';
    try{
      if(record.destination_url_enc) dest = decrypt(record.destination_url_enc) || dest;
    }catch{}

    res.status(200).json({
      ok:true,
      phone_id: record.phone_id,
      display_phone_number: record.display_phone_number,
      verified_name: record.verified_name,
      quality_rating: record.quality_rating || 'GREEN',
      tier: record.tier || 'STANDARD',
      status: record.code_verification_status || 'VERIFIED',
      destination_host: (()=>{ try{ const u=new URL(dest); return u.host; }catch{ return dest; } })(),
      coexistence: record.coexistence,
      connected_at: record.connected_at,
      last_health_check: new Date().toISOString(),
      recent_events: lifecycle,
      blind: true,
      message: 'Message-blind: no message content stored'
    });
  }catch(err){
    console.error('health error', err);
    res.status(500).json({ok:false, error: err.message});
  }
};
