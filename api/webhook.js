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
    console.log('VERIFY ATTEMPT', { mode, token_ok: token === VERIFY_TOKEN });
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  if (req.method === 'POST') {
    console.log('POST BODY', JSON.stringify(req.body || {}).slice(0, 3000));
    const waba_id = req.body?.entry?.[0]?.id;
    console.log('WABA ID DETECTADO', waba_id);

    if (!waba_id) {
      console.log('No waba_id, return OK');
      return res.status(200).send('EVENT_RECEIVED');
    }
    
    const urlCliente = await redis.hget('waba_map', waba_id);
    console.log('MAP RESULT', { waba_id, urlCliente });

    if (urlCliente) {
      console.log('FORWARDING TO', urlCliente);
      try {
        const r = await fetch(urlCliente, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req.body)
        });
        console.log('FORWARD STATUS', r.status);
      } catch(e){
        console.log('FORWARD ERROR', e.message);
      }
    } else {
      console.log('NO MAPPING FOUND FOR', waba_id);
    }
    return res.status(200).send('EVENT_RECEIVED');
  }
}
