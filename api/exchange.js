import { Redis } from '@upstash/redis';
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  const { code, url_seller } = req.body;
  
  // 1. Cambia code por token
  const tokenRes = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?client_id=${process.env.APP_ID}&client_secret=${process.env.APP_SECRET}&code=${code}&redirect_uri=https://techproviderseller.vercel.app/`);
  const tokenData = await tokenRes.json();
  const access_token = tokenData.access_token;

  // 2. Pregunta a 【entity-Meta¦canonical_name=Meta】 qué WABAs tiene
  const wabaRes = await fetch(`https://graph.facebook.com/v20.0/me/whatsapp_business_accounts?access_token=${access_token}`);
  const wabaData = await wabaRes.json();
  const waba_id = wabaData.data?.[0]?.id;

  // 3. Pregunta qué números tiene esa WABA
  const phoneRes = await fetch(`https://graph.facebook.com/v20.0/${waba_id}/phone_numbers?access_token=${access_token}`);
  const phoneData = await phoneRes.json();
  const phone_id = phoneData.data?.[0]?.id;

  // 4. Guarda mapeo
  await redis.hset('waba_map', { [waba_id]: url_seller });

  return res.json({ ok: true, waba_id, phone_id, url_seller, access_token });
}
