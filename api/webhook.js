import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv(); // Lee automático UPSTASH_REDIS_REST_URL
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'mi_token_global_123';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
      return res.status(200).send(req.query['hub.challenge']);
    }
    return res.status(403).send('Forbidden');
  }
  if (req.method === 'POST') {
    const body = req.body;
    const waba_id = body?.entry?.[0]?.id;
    if (!waba_id) return res.status(200).send('EVENT_RECEIVED');
    const urlCliente = await redis.hget('waba_map', waba_id);
    if (urlCliente) {
      await fetch(urlCliente, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    }
    return res.status(200).send('EVENT_RECEIVED');
  }
}
