import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

export default async function handler(req, res) {
  // VERIFY
  if (req.method === 'GET') {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
      return res.status(200).send(req.query['hub.challenge']);
    }
    return res.status(403).send('Forbidden');
  }

  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // LOG RAW
  try {
    await redis.lpush('webhook_logs', JSON.stringify(req.body));
    await redis.ltrim('webhook_logs', 0, 19);
  } catch {}

  let entryId = req.body?.entry?.[0]?.id?.toString();
  console.log('WABA ID DETECTADO', entryId, JSON.stringify(req.body).slice(0,1000));

  // Test de 【entity-Meta¦canonical_name=Meta】 viene con id:0
  if (!entryId || entryId === '0') {
    const all = await redis.hgetall('waba_map') || {};
    const firstKey = Object.keys(all)[0];
    if (firstKey) {
      console.log('TEST PAYLOAD, usando primer mapeo', firstKey);
      entryId = firstKey;
      if (req.body?.entry?.[0]) req.body.entry[0].id = firstKey;
    } else {
      return res.status(200).send('EVENT_RECEIVED');
    }
  }

  const allMaps = await redis.hgetall('waba_map') || {};
  const urlCliente = allMaps[entryId];

  if (!urlCliente) {
    console.log('NO MAPPING FOUND FOR', entryId, 'disponibles:', Object.keys(allMaps));
    return res.status(200).send('EVENT_RECEIVED');
  }

  console.log('FORWARDING TO', urlCliente, 'FROM', entryId);
  try {
    const r = await fetch(urlCliente, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const txt = await r.text();
    console.log('FORWARD STATUS', r.status, txt.slice(0, 800));
  } catch (e) {
    console.log('FORWARD ERROR', e.message);
  }

  return res.status(200).send('EVENT_RECEIVED');
}
