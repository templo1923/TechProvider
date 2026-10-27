/**
 * Mapping - List real connections from Upstash
 * Returns 0 initially, no mocks
 * APP_ID: 811281598468466
 * CONFIG_ID: 1889600718898450
 */
import { kvKeys, kvGet, kvSmembers } from '../lib/redis.js';

const APP_ID = '811281598468466';
const CONFIG_ID = '1889600718898450';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    // Get all mapped phone ids - real data only
    let phoneIds = [];
    try {
      phoneIds = await kvSmembers('connections:index');
    } catch {}

    if (!phoneIds || phoneIds.length === 0) {
      // Fallback scan via keys
      try {
        const keys = await kvKeys('waba_map:*');
        phoneIds = keys.map(k => k.replace('waba_map:', '')).filter(Boolean);
      } catch {}
    }

    const mappings = [];
    for (const pid of phoneIds || []) {
      try {
        const data = await kvGet(`waba_map:${pid}`);
        if (!data) continue;
        // Do not expose encrypted tokens
        const safe = {
          phone_number_id: data.phone_number_id || pid,
          waba_id: data.waba_id,
          business_id: data.business_id,
          display_phone_number: data.display_phone_number || data.phone_number || '',
          destination_url: data.destination_url,
          override_callback_uri: data.override_callback_uri,
          coexistence: data.coexistence || false,
          created_at: data.created_at,
          config_id: data.config_id || CONFIG_ID,
          app_id: data.app_id || APP_ID,
          flow: data.flow
        };
        mappings.push(safe);
      } catch {}
    }

    return res.status(200).json({
      app_id: APP_ID,
      config_id: CONFIG_ID,
      count: mappings.length,
      mappings, // real only, 0 initially, no mocks
      message: mappings.length === 0 ? 'No connections yet - connect via Embedded Signup' : `${mappings.length} real connections`
    });
  } catch (err) {
    console.error('mapping error', err);
    return res.status(200).json({
      app_id: APP_ID,
      config_id: CONFIG_ID,
      count: 0,
      mappings: [],
      error: err.message
    });
  }
}
