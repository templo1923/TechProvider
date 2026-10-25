import { Redis } from '@upstash/redis';
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const map = await redis.hgetall('waba_map') || {};
    return res.status(200).json(map);
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
    return res.status(200).json({ok:true, deleted:waba_id});
  }
}
