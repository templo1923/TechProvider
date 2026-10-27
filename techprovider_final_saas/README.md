# TechProvider Seller SaaS — CONFIG_ID 1889600718898450
**Works WITHOUT business verification • Message-blind router • Ranvedix modal clone**

APP_ID: `811281598468466`  
CONFIG_ID: `1889600718898450`  
VERIFY_TOKEN default: `WLfsAiS52U0n`

## What this is
Complete Vercel-deployable SaaS that lets you sell WhatsApp Cloud API access as a Tech Provider WITHOUT requiring business verification from buyers.

- Buyer clicks **Connect WhatsApp** → Facebook Embedded Signup with `config_id=1889600718898450`
- Modal collects: **Destination URL**, **Verify Token**, **Coexistence** (same as Ranvedix)
- `exchange.js` exchanges `code` for token via `graph.facebook.com/v20.0/oauth/access_token?client_id=811281598468466`
- Fetches businesses → WABAs → phone_numbers
- Tries `POST /{waba_id}/subscribed_apps?override_callback_uri=destination_url` to set buyer's webhook as override
- Saves encrypted mapping to Upstash KV key `waba_map:{phone_id}` = `{waba_id, phone_id, destination_url, encrypted_token, coexistence, config_id}`
- Webhook is **message-blind**: drops `messages`, only stores lifecycle events (sent, delivered, read, failed)

## Structure
```
/api/webhook.js      - GET verify + POST message-blind router
/api/exchange.js     - code -> token -> waba/phone_numbers + override_callback_uri
/api/mapping.js      - list real mappings (0 initially, no mocks)
/api/connections.js  - list real connections (0 initially, no mocks)
/api/logs.js         - lifecycle logs only
/lib/redis.js        - Upstash REST wrapper
/lib/encrypt.js      - AES-256-GCM encrypt/decrypt for tokens
/public/index.html   - Ranvedix clone with FB.login config_id 1889600718898450
vercel.json
.env.example
```

## Deploy to Vercel
1. Create Upstash Redis (free) → get REST URL + TOKEN
2. Set env in Vercel:
   - `APP_SECRET` = from Meta App Dashboard (811281598468466)
   - `VERIFY_TOKEN=WLfsAiS52U0n`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `ENCRYPTION_KEY` = 32 chars random (e.g. `openssl rand -hex 16`)
3. `vercel --prod`

## Frontend Flow (public/index.html)
- Loads `connect.facebook.net/en_US/sdk.js`, `FB.init({appId: 811281598468466, version: v20.0})`
- Ranvedix UI: Connect button + connections table + logs viewer
- Modal before FB.login: inputs for Destination URL, Verify Token, Coexistence checkbox
- On click: `FB.login(callback, {config_id: 1889600718898450, response_type: 'code', override_default_response_type: true, extras: {setup: {business: {}, ...}}})`
- Sends `{code, destination_url, verify_token, coexistence}` to `/api/exchange`

## Why it works WITHOUT verification
Tech Provider + Embedded Signup config `1889600718898450` is pre-approved. Buyer business does NOT need to be verified if your Tech Provider app is approved and config uses Solution Provider flow. The exchange uses system user / user token to fetch WABAs directly.

## Webhook Message-Blind Logic
```js
if (value.messages) { // DROP
  log dropped metadata only
  return 200;
}
if (value.statuses) { // STORE
  kvLpush(logs:phone_id, status)
  optionalForward to destination_url (statuses only)
}
```

## APIs
- `GET /api/connections` → {total, connections}
- `GET /api/mapping` → {count, mappings}
- `GET /api/logs?phone_id=...&limit=100` → lifecycle only
- `POST /api/exchange` → creates mapping

## Security
- Tokens encrypted with AES-256-GCM before KV
- No mocks, real connections only
- Message bodies never stored or forwarded

## Meta Dashboard Settings
- Valid OAuth Redirects: `https://your-domain.vercel.app/`
- Webhook URL: `https://your-domain.vercel.app/api/webhook`
- Verify Token: `WLfsAiS52U0n`
- Subscribe to: `messages` field (router will drop but needs event), plus `message_deliveries, message_reads, message_sends`

Built from screenshots: WhatsApp Embedded Signup config already in production mode (Empresa).

