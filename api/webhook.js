// api/webhook.js - Message-blind forwarding, no message storage
const redis = require('../lib/redis');

module.exports = async (req, res) => {
  // GET verification
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode !== 'subscribe') return res.status(400).send('Invalid mode');

    const envToken = process.env.VERIFY_TOKEN;

    // Check env token or any stored per-connection token
    let isValid = false;
    if (envToken && token === envToken) isValid = true;
    if (!isValid && token) {
      try {
        const connId = await redis.getConnectionIdByVerifyToken(token);
        if (connId) isValid = true;
        else {
          // also scan all connections (fallback, scalable for few connections)
          const all = await redis.listConnections();
          if (all.some(c => c.verify_token === token)) { isValid = true; }
        }
      } catch (e) { console.warn('verify lookup err', e.message); }
    }

    if (isValid) {
      console.log('Webhook verified', { tokenPreview: token?.slice(0,4)+'***' });
      return res.status(200).send(challenge);
    } else {
      console.warn('Webhook verification failed', { tokenPreview: token?.slice(0,6) });
      return res.status(403).send('Verification failed');
    }
  }

  // POST forwarding - message-blind
  if (req.method === 'POST') {
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      // Extract identifiers without storing content
      const entry = payload?.entry?.[0];
      const wabaId = entry?.id || payload?.entry?.[0]?.id || null;
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const metadata = value?.metadata;
      const phoneNumberId = metadata?.phone_number_id || null;
      const displayPhone = metadata?.display_phone_number || null;

      // Determine event type for logging only (no content)
      let eventType = 'unknown';
      if (value?.messages) eventType = 'message';
      else if (value?.statuses) eventType = 'status';
      else if (value?.errors) eventType = 'error';
      else if (payload?.object === 'whatsapp_business_account' && value?.account_update) eventType = 'account_update';
      else if (value?.history) eventType = 'history';
      else if (changes?.field === 'smb_app_state_sync') eventType = 'smb_app_state_sync';
      else if (changes?.field === 'smb_message_echoes') eventType = 'smb_message_echoes';

      console.log('Webhook POST received', {
        wabaId,
        phoneNumberId,
        eventType,
        entryCount: payload?.entry?.length || 0,
        hasMessages: !!value?.messages,
        hasStatuses: !!value?.statuses
      });

      // Find destination
      let connection = null;
      if (wabaId || phoneNumberId) {
        connection = await redis.findConnectionByWabaOrPhone(wabaId, phoneNumberId);
        // Fallback: try display phone normalization
        if (!connection && displayPhone) {
          const norm = displayPhone.replace(/[^0-9]/g,'');
          const cid = await redis.get(`phone_display:${norm}`);
          if (cid) connection = await redis.getConnection(cid);
        }
      }

      // If not found via mapping, try to find any connection if single-tenant setup (env fallback)
      if (!connection) {
        const all = await redis.listConnections();
        if (all.length === 1) connection = all[0];
        // If multiple, cannot blind forward without mapping -> log and return 200 to avoid retries
        else if (all.length === 0) {
          console.warn('No connections stored, cannot forward - returning 200 to prevent retry storm');
          return res.status(200).json({ ok: true, blind: true, forwarded: false, reason: 'no_connections' });
        }
      }

      if (!connection || !connection.destination_url) {
        console.warn('Connection not found for forwarding', { wabaId, phoneNumberId });
        return res.status(200).json({ ok: true, blind: true, forwarded: false, reason: 'connection_not_found' });
      }

      // Message-blind forwarding - forward raw payload as-is
      const dest = connection.destination_url;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        const forwardRes = await fetch(dest, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-TechProvider-Blind': 'true',
            'X-WABA-ID': wabaId || connection.waba_id || '',
            'X-Phone-ID': phoneNumberId || '',
            'X-Event-Type': eventType,
            'X-Connection-ID': connection.id
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeout);
        const text = await forwardRes.text().catch(() => '');
        console.log('Forwarded to destination', { dest: dest.slice(0,40)+'...', status: forwardRes.status, eventType });
        return res.status(200).json({ ok: true, blind: true, count: 1, forwarded: forwardRes.ok, destStatus: forwardRes.status });
      } catch (fwdErr) {
        clearTimeout(timeout);
        console.error('Forward failed', { err: fwdErr.message, dest: dest.slice(0,50) });
        // Still return 200 to Meta to avoid retry loop, but inform logs
        return res.status(200).json({ ok: true, blind: true, forwarded: false, error: fwdErr.message });
      }

    } catch (err) {
      console.error('webhook POST error', err.message);
      return res.status(200).json({ ok: true, blind: true, error: 'internal_logged' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
