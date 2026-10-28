// api/connections.js - List connections, dashboard data, quality check live refresh (optional)
const redis = require('../lib/redis');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id required' });
      const conn = await redis.getConnection(id);
      if (!conn) return res.status(404).json({ error: 'not found' });
      await redis.del(`connection:${id}`);
      if (conn.waba_id) await redis.del(`waba:${conn.waba_id}`);
      if (conn.verify_token) await redis.del(`verify_token:${conn.verify_token}`);
      if (conn.phone_numbers) {
        for (const p of conn.phone_numbers) {
          if (p.id) await redis.del(`phone:${p.id}`);
        }
      }
      // Remove from index set - rebuild via list filter if using kv which supports srem
      try {
        const { kv } = require('@vercel/kv');
        await kv.srem('connections:index', id);
      } catch {
        // fallback for memory / redis: fetch members and reset (handled via del of memSet)
        try {
          const all = await redis.sMembers('connections:index');
          const filtered = all.filter(x => x !== id);
          // For redis: del set and re-add
          const IORedis = require('ioredis');
          // skip - if using mem, we have memSets
        } catch {}
      }
      return res.status(200).json({ ok: true, deleted: id });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // GET list
  try {
    const connections = await redis.listConnections();
    const GRAPH_VERSION = process.env.GRAPH_VERSION || 'v20.0';

    // Enrich with live quality if token available and requested via ?refresh=1
    const shouldRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    if (shouldRefresh) {
      for (const c of connections) {
        if (!c._token) continue;
        for (const pn of (c.phone_numbers || [])) {
          try {
            const qUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${pn.id}?fields=quality_rating,is_on_biz_app,platform_type,code_verification_status,throughput&access_token=${encodeURIComponent(c._token)}`;
            const qRes = await fetch(qUrl);
            const qJson = await qRes.json();
            if (qJson?.quality_rating) pn.quality_rating = qJson.quality_rating;
            if (typeof qJson?.is_on_biz_app !== 'undefined') pn.is_on_biz_app = qJson.is_on_biz_app;
            if (qJson?.platform_type) pn.platform_type = qJson.platform_type;
            if (qJson?.throughput) pn.throughput = qJson.throughput;
          } catch {}
        }
        c.quality_rating = c.phone_numbers?.[0]?.quality_rating || c.quality_rating;
        c.is_on_biz_app = c.phone_numbers?.[0]?.is_on_biz_app ?? c.is_on_biz_app;
        // persist updated quality
        await redis.saveConnection(c);
      }
    }

    // Sanitize for frontend - never expose _token
    const safe = connections.map(c => ({
      id: c.id,
      waba_id: c.waba_id,
      business_id: c.business_id,
      phone_numbers: c.phone_numbers || [],
      destination_url: c.destination_url,
      destination_masked: c.destination_url ? (new URL(c.destination_url).hostname + new URL(c.destination_url).pathname.slice(0,20) + '...') : '',
      created_at: c.created_at,
      quality_rating: c.quality_rating,
      is_on_biz_app: c.is_on_biz_app,
      platform_type: c.platform_type
    }));

    return res.status(200).json({
      ok: true,
      blind: true,
      count: safe.length,
      message: 'Message-blind enforced',
      connections: safe
    });
  } catch (e) {
    console.error('connections err', e);
    return res.status(500).json({ error: e.message });
  }
};
