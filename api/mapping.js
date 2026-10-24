import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { waba_id, url_seller } = req.body;
    if (!waba_id || !url_seller) return res.status(400).json({error: 'Falta waba_id o url_seller'});
    await kv.hset('waba_map', { [waba_id]: url_seller });
    return res.json({ ok: true, waba_id, url_seller });
  }
  if (req.method === 'GET') {
    const map = await kv.hgetall('waba_map');
    return res.json(map || {});
  }
}
