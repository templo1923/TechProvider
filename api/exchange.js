import { Redis } from '@upstash/redis';
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  const { code, waba_id, phone_number_id, url_seller } = req.body;
  
  // 1. Cambia code por token
  const tokenRes = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?client_id=${process.env.APP_ID}&client_secret=${process.env.APP_SECRET}&code=${code}`);
  const tokenData = await tokenRes.json();
  
  // 2. Suscribe tu App a esa WABA
  await fetch(`https://graph.facebook.com/v20.0/${waba_id}/subscribed_apps`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ access_token: tokenData.access_token })
  });

  // 3. Guarda el mapeo para tu router
  await redis.hset('waba_map', { [waba_id]: url_seller });

  return res.json({ ok: true, waba_id, phone_number_id, url_seller, tokenData });
}
