/**
 * TechProvider Seller - Message-Blind Webhook Router
 * APP_ID: 811281598468466
 * CONFIG_ID: 1889600718898450
 * 
 * Logic:
 * - GET verifies hub.challenge with VERIFY_TOKEN
 * - POST drops incoming messages (message-blind), only stores lifecycle events (statuses, errors)
 * - Saves lifecycle to Upstash logs:{phone_id}
 * - Optionally forwards statuses to destination_url (override_callback_uri) if mapping exists
 */
import { kvGet, kvLpush, kvLrange } from '../lib/redis.js';

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'WLfsAiS52U0n';
const APP_ID = '811281598468466';
const CONFIG_ID = '1889600718898450';

export default async function handler(req, res) {
  // Verification (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log(`[WEBHOOK VERIFY] SUCCESS config_id=${CONFIG_ID} token matched`);
      return res.status(200).send(challenge);
    } else {
      console.warn(`[WEBHOOK VERIFY] FAIL expected=${VERIFY_TOKEN} got=${token}`);
      return res.status(403).send('Forbidden');
    }
  }

  // Event handling (POST)
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      // console.log('Webhook body', JSON.stringify(body).slice(0,2000))

      if (body.object !== 'whatsapp_business_account') {
        return res.status(200).send('Not a WA event');
      }

      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value || {};
          const metadata = value.metadata || {};
          const phone_number_id = metadata.phone_number_id || value.phone_number_id || entry.id;
          const waba_id = value.business_id || entry.id || metadata.waba_id;

          // MESSAGE-BLIND: Drop messages entirely
          if (value.messages && value.messages.length > 0) {
            const dropLog = {
              type: 'message_dropped',
              reason: 'message_blind_router',
              phone_number_id,
              waba_id,
              count: value.messages.length,
              from: value.messages.map(m => m.from),
              timestamp: new Date().toISOString(),
              app_id: APP_ID,
              config_id: CONFIG_ID
            };
            if (phone_number_id) {
              await kvLpush(`logs:${phone_number_id}`, dropLog);
            }
            await kvLpush(`logs:global`, dropLog);
            console.log(`[BLIND] Dropped ${value.messages.length} messages for ${phone_number_id}`);
            continue; // Do NOT forward, do NOT process
          }

          // LIFECYCLE EVENTS: Only statuses, errors, etc are stored
          if (value.statuses && value.statuses.length > 0) {
            for (const st of value.statuses) {
              const lifecycle = {
                type: 'status',
                id: st.id,
                status: st.status, // sent, delivered, read, failed
                timestamp: st.timestamp,
                recipient_id: st.recipient_id,
                phone_number_id,
                waba_id,
                errors: st.errors || null,
                pricing: st.pricing || null,
                conversation: st.conversation || null,
                received_at: new Date().toISOString(),
                app_id: APP_ID,
                config_id: CONFIG_ID
              };
              if (phone_number_id) await kvLpush(`logs:${phone_number_id}`, lifecycle);
              await kvLpush(`logs:global`, lifecycle);

              // Optional forward to destination_url (message-blind still forwards statuses)
              try {
                if (phone_number_id) {
                  const mapping = await kvGet(`waba_map:${phone_number_id}`);
                  if (mapping?.destination_url) {
                    // Forward only statuses, never messages
                    fetch(mapping.destination_url, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        entry: [{
                          id: waba_id,
                          changes: [{ value: { statuses: [st], metadata }, field: 'messages' }]
                        }],
                        object: 'whatsapp_business_account'
                      })
                    }).catch(()=>{});
                  }
                }
              } catch (e) {}
            }
          }

          // Other lifecycle: account updates, phone number name quality, etc
          if (!value.messages && !value.statuses) {
            const other = {
              type: change.field || 'lifecycle',
              value,
              phone_number_id,
              waba_id,
              received_at: new Date().toISOString(),
              app_id: APP_ID,
              config_id: CONFIG_ID
            };
            if (phone_number_id) await kvLpush(`logs:${phone_number_id}`, other);
            await kvLpush(`logs:global`, other);
          }
        }
      }

      return res.status(200).send('EVENT_RECEIVED');
    } catch (err) {
      console.error('Webhook error', err);
      // Always 200 to stop retries for message-blind
      return res.status(200).send('EVENT_RECEIVED');
    }
  }

  return res.status(405).send('Method Not Allowed');
}

export const config = {
  api: {
    bodyParser: true
  }
}
