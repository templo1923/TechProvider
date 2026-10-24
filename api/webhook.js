import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const mode = req.query['hub.mode'];
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  if (req.method === 'POST') {
    const body = req.body;
    const waba_id = body?.entry?.[0]?.id;
    if (!waba_id) return res.status(200).send('EVENT_RECEIVED');
    
    const urlCliente = await redis.hget('waba_map', waba_id);
    if (urlCliente) {
      await fetch(urlCliente, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }
    return res.status(200).send('EVENT_RECEIVED');
  }
}
