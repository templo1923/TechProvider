import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WABA_REAL = "1597597978810935";
const PHONE_ID_REAL = "1386620191199894";
const PHONE_DISPLAY_REAL = "12057510826";

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
    console.log('POST BODY', JSON.stringify(req.body || {}).slice(0, 4000));
    let raw_id = req.body?.entry?.[0]?.id?.toString();
    let waba_id = raw_id;
    let isTest = false;

    if (!raw_id || raw_id === "0" || raw_id === "0,0") {
      isTest = true;
      waba_id = WABA_REAL;
      console.log('PRUEBA DETECTADO, USANDO WABA REAL', waba_id);
    }

    console.log('WABA ID DETECTADO', waba_id);

    if (!waba_id) {
      return res.status(200).send('EVENT_RECEIVED');
    }

    // Arregla el payload de prueba para que Seller lo acepte
    try {
      if (req.body?.entry?.[0]) {
        req.body.entry[0].id = waba_id;
        const val = req.body.entry[0].changes?.[0]?.value;
        if (val?.metadata) {
          if (isTest || val.metadata.phone_number_id === "123456123") {
            val.metadata.phone_number_id = PHONE_ID_REAL;
            val.metadata.display_phone_number = PHONE_DISPLAY_REAL;
          }
        }
      }
    } catch(e) {
      console.log('REWRITE ERROR', e.message);
    }
    
    const urlCliente = await redis.hget('waba_map', waba_id);
    console.log('MAP RESULT', { waba_id, urlCliente, isTest });

    if (urlCliente) {
      console.log('FORWARDING TO', urlCliente);
      try {
        const r = await fetch(urlCliente, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req.body)
        });
        const txt = await r.text();
        console.log('FORWARD STATUS', r.status, txt.slice(0,800));
      } catch(e){
        console.log('FORWARD ERROR', e.message);
      }
    } else {
      console.log('NO MAPPING FOUND FOR', waba_id);
    }
    return res.status(200).send('EVENT_RECEIVED');
  }

  return res.status(405).send('Method Not Allowed');
}
