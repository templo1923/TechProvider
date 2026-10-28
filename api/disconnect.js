// DELETE /api/disconnect?phone_id=...
const { getStore } = require('./_lib/kv');

module.exports = async (req, res) => {
  if(req.method === 'OPTIONS'){ res.status(200).end(); return; }
  if(req.method !== 'DELETE' && req.method !== 'POST'){ res.status(405).json({ok:false}); return; }
  const phone_id = req.query.phone_id || (req.body && (typeof req.body==='string'?JSON.parse(req.body):req.body).phone_id);
  if(!phone_id){ res.status(400).json({ok:false, error:'phone_id required'}); return; }
  try{
    const store = await getStore();
    const key = `phone:${phone_id}`;
    const record = await store.get(key);
    if(!record){
      res.status(404).json({ok:false, error:'not found'});
      return;
    }
    await store.del(key);
    if(store.removeFromIndex) await store.removeFromIndex('phone:', key);
    res.status(200).json({ok:true, message:'disconnected', phone_id});
  }catch(err){
    console.error('disconnect error', err);
    res.status(500).json({ok:false, error: err.message});
  }
};
