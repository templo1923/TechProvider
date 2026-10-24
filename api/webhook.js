import { kv } from '@vercel/kv';

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'mi_token_global_123';

export default async function handler(req, res) {
  // Verificación que hace Meta cuando pegas la URL
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  // Llegada de mensajes
  if (req.method === 'POST') {
    const body = req.body;
    const waba_id = body?.entry?.[0]?.id;
    console.log('Mensaje de WABA:', waba_id);

    if (!waba_id) return res.status(200).send('EVENT_RECEIVED');

    // Busca a donde reenviar
    const urlCliente = await kv.hget('waba_map', waba_id);

    if (urlCliente) {
      await fetch(urlCliente, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      console.log(`Reenviado ${waba_id} -> ${urlCliente}`);
    } else {
      console.log('WABA no mapeado:', waba_id);
    }
    return res.status(200).send('EVENT_RECEIVED');
  }
}
