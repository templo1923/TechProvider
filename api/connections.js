// GET /api/connections — real list from KV, 0 initially beautiful empty
const { getStore } = require('./_lib/kv');
const { decrypt } = require('./_lib/crypto');

module.exports = async (req, res) => {
  if(req.method === 'OPTIONS'){ res.status(200).end(); return; }
  if(req.method !== 'GET'){ res.status(405).json({ok:false}); return; }
  try{
    const store = await getStore();
    let items = [];
    try{
      items = await store.list('phone:');
    }catch(e){ items = []; }

    // items is [{key,value}] or if file store same
    const numbers = (items||[]).map(entry=>{
      const v = entry.value || entry;
      // decrypt if needed for display masking
      let dest = v.destination_url_plain || '';
      try{
        if(v.destination_url_enc){
          dest = decrypt(v.destination_url_enc) || dest;
        }
      }catch{}
      // mask destination for privacy? show host
      let destHost = dest;
      try{ const u = new URL(dest); destHost = u.host + u.pathname; }catch{}

      return {
        phone_id: v.phone_id,
        waba_id: v.waba_id,
        business_id: v.business_id,
        display_phone_number: v.display_phone_number || '',
        verified_name: v.verified_name || '',
        quality_rating: v.quality_rating || 'GREEN',
        tier: v.tier || v.throughput?.level || 'STANDARD',
        quality: v.quality_rating || 'GREEN',
        status: v.code_verification_status || 'VERIFIED',
        destination: dest,
        destination_host: destHost,
        coexistence: !!v.coexistence,
        connected_at: v.connected_at,
        last_health_check: v.last_health_check
      };
    }).filter(x=>x.phone_id);

    // sort newest first
    numbers.sort((a,b)=> new Date(b.connected_at) - new Date(a.connected_at));

    res.status(200).json({ok:true, count: numbers.length, numbers});
  }catch(err){
    console.error('connections error', err);
    res.status(500).json({ok:false, error: err.message, count:0, numbers:[]});
  }
};
