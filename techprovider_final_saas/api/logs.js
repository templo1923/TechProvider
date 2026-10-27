/**
 * Logs - Lifecycle logs only (message-blind)
 * APP_ID: 811281598468466
 * CONFIG_ID: 1889600718898450
 */
import { kvLrange, kvGet } from '../lib/redis.js';

const APP_ID = '811281598468466';
const CONFIG_ID = '1889600718898450';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { phone_id, limit = '100' } = req.query;
    const lim = Math.min(parseInt(limit) || 100, 500);

    let logs = [];
    if (phone_id) {
      logs = await kvLrange(`logs:${phone_id}`, 0, lim-1);
    } else {
      logs = await kvLrange('logs:global', 0, lim-1);
    }

    // Filter to ensure no message content leaked (message-blind)
    const sanitized = (logs || []).map(entry => {
      if (entry && entry.type === 'message_dropped') {
        return entry; // only metadata about dropped
      }
      // Remove any accidental message bodies
      if (entry?.value?.messages) delete entry.value.messages;
      if (entry?.messages) delete entry.messages;
      return entry;
    });

    return res.status(200).json({
      app_id: APP_ID,
      config_id: CONFIG_ID,
      phone_id: phone_id || 'global',
      count: sanitized.length,
      logs: sanitized,
      note: 'Message-blind router: messages are dropped, only lifecycle events (status, delivered, read, failed) stored.'
    });
  } catch (err) {
    console.error('logs error', err);
    return res.status(200).json({
      app_id: APP_ID,
      config_id: CONFIG_ID,
      count: 0,
      logs: [],
      error: err.message
    });
  }
}
