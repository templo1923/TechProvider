import { Redis } from '@upstash/redis';
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method === 'GET') {
<<<<<<< HEAD
    const raw = await redis.hgetall('waba_map') || {};
    const map = {};
    for (const k in raw) { map[k.trim()] = raw[k]; }
    const logs = await redis.lrange('webhook_logs', 0, 9);
    return res.status(200).json({ mapping: map, last_logs: logs.map(l=>{try{return JSON.parse(l)}catch{return l}}) });
  }
  if (req.method === 'POST') {
    const waba_id = req.body?.waba_id?.toString().trim();
    const url_seller = req.body?.url_seller?.toString().trim();
    if (!waba_id || !url_seller) return res.status(400).json({error:'faltan datos'});
    await redis.hset('waba_map', { [waba_id]: url_seller });
    return res.status(200).json({ok:true, waba_id, url_seller});
  }
  if (req.method === 'DELETE') {
    const waba_id = req.body?.waba_id?.toString().trim();
    if (!waba_id) return res.status(400).json({error:'falta waba_id'});
    await redis.hdel('waba_map', waba_id);
    // Limpia tambien la version con espacio por si existe
    await redis.hdel('waba_map', waba_id + ' ');
=======
    const map = await redis.hgetall('waba_map') || {};
    const logs = await redis.lrange('webhook_logs', 0, 9);
    return res.status(200).json({ mapping: map, last_logs: logs.map(l=>{try{return JSON.parse(l)}catch{return l}}) });
  }
  if (req.method === 'POST') {
    const { waba_id, url_seller } = req.body;
    if (!waba_id || !url_seller) return res.status(400).json({error:'faltan datos'});
    await redis.hset('waba_map', { [waba_id]: url_seller });
    return res.status(200).json({ok:true, waba_id, url_seller});
  }
  if (req.method === 'DELETE') {
    const { waba_id } = req.body;
    if (!waba_id) return res.status(400).json({error:'falta waba_id'});
    await redis.hdel('waba_map', waba_id);
>>>>>>> bd2b935808f5186c002828723c345e6c8288de2b
    return res.status(200).json({ok:true, deleted:waba_id});
  }
  return res.status(405).json({error:'method not allowed'});
}
