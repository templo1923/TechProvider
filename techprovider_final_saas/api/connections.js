/**
 * Connections - Real connections list
 * APP_ID: 811281598468466
 * CONFIG_ID: 1889600718898450
 * No mocks, 0 initially
 */
import { kvKeys, kvGet, kvSmembers } from '../lib/redis.js';

const APP_ID = '811281598468466';
const CONFIG_ID = '1889600718898450';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let phoneIds = [];
    try {
      phoneIds = await kvSmembers('connections:index');
    } catch {}

    if (!phoneIds || phoneIds.length === 0) {
      try {
        const keys = await kvKeys('waba_map:*');
        phoneIds = keys.map(k => k.replace('waba_map:', '')).filter(Boolean);
      } catch {}
    }

    const connections = [];
    for (const pid of phoneIds || []) {
      try {
        const data = await kvGet(`waba_map:${pid}`);
        if (!data) continue;
        connections.push({
          phone_number_id: data.phone_number_id || pid,
          waba_id: data.waba_id,
          business_id: data.business_id,
          display_phone_number: data.display_phone_number || data.phone_number || '',
          destination_url: data.destination_url,
          coexistence: data.coexistence,
          created_at: data.created_at,
          app_id: APP_ID,
          config_id: CONFIG_ID,
          verified_name: data.name || '',
          status: 'connected',
          message_blind: true,
          override_callback_uri: data.override_callback_uri
        });
      } catch (e) { continue; }
    }

    // Sort newest first
    connections.sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));

    return res.status(200).json({
      app_id: APP_ID,
      config_id: CONFIG_ID,
      total: connections.length,
      connections, // no mocks
      note: 'Real connections only. 0 initially. Tech Provider flow works WITHOUT business verification.'
    });
  } catch (err) {
    return res.status(200).json({
      app_id: APP_ID,
      config_id: CONFIG_ID,
      total: 0,
      connections: [],
      error: err.message
    });
  }
}
