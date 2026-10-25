import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

export default async function handler(req, res) {
  console.log('=== WEBHOOK HIT ===', req.method, JSON.stringify(req.query || {}));

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
    try {
      await redis.lpush('webhook_logs', JSON.stringify(req.body));
      await redis.ltrim('webhook_logs', 0, 19);
    } catch(e){}

    let waba_id = req.body?.entry?.[0]?.id?.toString();
    console.log('WABA ID DETECTADO', waba_id);

    if (!waba_id || waba_id === "0") {
      const all = await redis.hgetall('waba_map') || {};
      const firstKey = Object.keys(all)[0];
      waba_id = firstKey || waba_id;
      console.log('TEST DETECTADO, USANDO', waba_id);
      if (req.body?.entry?.[0]) req.body.entry[0].id = waba_id;
    }

    if (!waba_id) return res.status(200).send('EVENT_RECEIVED');

    const allMaps = await redis.hgetall('waba_map') || {};
    let urlCliente = allMaps[waba_id];

    // Si viene con Messaging account ID 116471..., busca el WABA ID que comparte la misma URL para reescribirlo y que Seller lo reconozca
    if (urlCliente) {
      const sameUrlKeys = Object.keys(allMaps).filter(k => allMaps[k] === urlCliente && k !== waba_id);
      if (sameUrlKeys.length > 0) {
        const canonicalWaba = sameUrlKeys[0];
        console.log(`REWRITE ${waba_id} -> ${canonicalWaba} para Seller`);
        if (req.body?.entry?.[0]) req.body.entry[0].id = canonicalWaba;
        // usa el canonical para log pero mantiene urlCliente
      }
    }

    // Si no hay mapeo directo, intenta buscar por URL compartida (escalable para 2 IDs por cliente)
    if (!urlCliente) {
      console.log('NO MAPPING FOUND FOR', waba_id, 'maps:', Object.keys(allMaps));
      return res.status(200).send('EVENT_RECEIVED');
    }

    console.log('FORWARDING TO', urlCliente, 'FROM', waba_id);
    try {
      const r = await fetch(urlCliente, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      const txt = await r.text();
      console.log('FORWARD STATUS', r.status, txt.slice(0,500));
    } catch(e){
      console.log('FORWARD ERROR', e.message);
    }
    return res.status(200).send('EVENT_RECEIVED');
  }

  return res.status(405).send('Method Not Allowed');
}
