# TechProvider DEFINITIVO - Verificación Pendiente

White-label message-blind WhatsApp Tech Provider.

- No burned data: all inputs empty in frontend
- config_id flow with coexistence (sessionInfoVersion 3)
- Message-blind webhook forwarding
- Quality check via quality_rating, is_on_biz_app
- Scalable KV (Upstash + ioredis fallback)

## Setup

1. Copy .env.example to .env.local and fill Vercel envs
2. Deploy to Vercel (Node 22.x)
3. Set in Meta dev dashboard:
   - Allowed domains, Valid OAuth redirect URIs: https://your-domain.vercel.app
   - Webhook: https://your-domain.vercel.app/api/webhook
   - Verify token: same as VERIFY_TOKEN env (or per-connection)

## Flow

Frontend collects destination_url + verify_token (empty by default)
-> FB.login with config_id
-> /api/exchange exchanges code, gets WABA + phones, subscribes app, stores mapping uuid -> {waba, phones, destination_url, verify_token}
-> /api/webhook GET verifies, POST forwards blind to destination_url

## Endpoints

- GET /api/config -> {appId, configId, graphVersion}
- POST /api/exchange -> {code?, accessToken?, destination_url, verify_token}
- GET/POST /api/webhook -> verification + blind forwarding
- GET /api/connections -> list 0 initially

## Verification Pending

Leave Meta App Review pending:
- Ensure webhook verified
- Test forwarding
- Then submit for whatsapp_business_management, business_management

No message content stored.
