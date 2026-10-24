import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { waba_id, url_seller } = req.body;
    await redis.hset('waba_map', { [waba_id]: url_seller });
    return res.json({ ok: true, waba_id, url_seller });
  }
  const map = await redis.hgetall('waba_map');
  return res.json(map || {});
}
