import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { waba_id, url_seller } = req.body;
    await redis.hset('waba_map', { [waba_id]: url_seller });
    return res.json({ ok: true });
  }
  if (req.method === 'GET') {
    const map = await redis.hgetall('waba_map');
    return res.json(map || {});
  }
}
