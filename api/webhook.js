import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
      return res.status(200).send(req.query['hub.challenge']);
    }
    return res.status(403).send('Forbidden');
  }
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    await redis.lpush('webhook_logs', JSON.stringify(req.body));
    await redis.ltrim('webhook_logs', 0, 19);
  } catch {}

  let entryId = req.body?.entry?.[0]?.id?.toString().trim();
  console.log('WABA ID DETECTADO', entryId);

  const allMapsRaw = await redis.hgetall('waba_map') || {};
  // Limpia espacios de keys viejas
  const allMaps = {};
  for (const k in allMapsRaw) {
    allMaps[k.trim()] = allMapsRaw[k];
  }

  // Test de Meta viene con id:0
  if (!entryId || entryId === '0') {
    const firstKey = Object.keys(allMaps)[0];
    if (firstKey) {
      entryId = firstKey;
      if (req.body?.entry?.[0]) req.body.entry[0].id = firstKey;
      console.log('TEST PAYLOAD, usando', firstKey);
    } else {
      return res.status(200).send('EVENT_RECEIVED');
    }
  }

  let urlCliente = allMaps[entryId];

  if (!urlCliente) {
    console.log('NO MAPPING FOUND FOR', entryId, 'disponibles:', Object.keys(allMaps));
    return res.status(200).send('EVENT_RECEIVED');
  }

  // Si el ID es Messaging account (116471...) y existe otro ID con misma URL (159759...), reescribe al WABA que espera Seller
  const sameUrlKeys = Object.keys(allMaps).filter(k => allMaps[k] === urlCliente && k !== entryId);
  if (sameUrlKeys.length > 0) {
    const canonical = sameUrlKeys[0];
    console.log(`REWRITE ${entryId} -> ${canonical} para compatibilidad Seller`);
    if (req.body?.entry?.[0]) req.body.entry[0].id = canonical;
  }

  console.log('FORWARDING TO', urlCliente, 'FROM', entryId);
  try {
    const r = await fetch(urlCliente, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    console.log('FORWARD STATUS', r.status, (await r.text()).slice(0,500));
  } catch (e) {
    console.log('FORWARD ERROR', e.message);
  }
  return res.status(200).send('EVENT_RECEIVED');
}
