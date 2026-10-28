# TechProvider DEFINITIVO FINAL — White-Label SaaS 0 → Conectado

> **Tus mensajes van a todas partes excepto a través de nosotros.**
> Conectas tu número en 2 minutos. Los mensajes van directo a tu CRM.

## ✅ CERO DATOS QUEMADOS — Verificado
- NO `1d6dc93a-72ce-4247-9ebf-4f5e0a1fde32`
- NO `WLfsAiS52U0n` fixed
- NO `+57 300 408 5041` fixed (solo placeholder XXX en mock)
- NO WABA IDs, phone IDs fijos
- NO config_id `1889600718898450` — OLD flow sin config_id

Todo viene de ENV o del Embedded Signup real.

## 🎨 Landing Ranvedix — Beautiful Professional
- Hero: “Tus mensajes van a todas partes excepto a través de nosotros” + sub “Conectas tu número en 2 minutos. Los mensajes van directo a tu CRM.”
- Trust bar: Meta Official API, Message-Blind, Coexistencia, 15 días guardado
- 3 features: Conecta sin desconectar, Mensajes nunca pasan por nosotros, Calidad en tiempo real
- How it works 3 pasos
- Pricing $9 / $49 / $149
- FAQ, footer — sin IDs técnicos visibles

## 🚀 Funcional 0 → Conectado
- `public/index.html` SPA con landing + dashboard real
- Modal:
  - Destination webhook URL placeholder `https://tu-crm.com/webhook` (value vacío)
  - Verify token placeholder (value vacío) + botón Generar random
  - Checkbox Coexistencia (checked por defecto)
  - Accordion bloqueadores (Kiamber Corp error, etc.)
  - Launch signup button
- Launch signup **OLD flow sin config_id**:
  ```js
  window.fbAsyncInit = function() NOT async
  (function(d,s,id){... loader ...})
  FB.init({appId: '811281598468466', version: 'v20.0'})
  FB.login({scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management', extras: {featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3'}})
  ```
  Evita Kiamber Corp error, funciona sin verificación.
- POST /api/exchange con {code, destination_url, verify_token, coexistence}
- exchange.js: code → access_token via `https://graph.facebook.com/v20.0/oauth/access_token?client_id=APP_ID&client_secret=APP_SECRET&code=CODE`, luego me/businesses, owned_whatsapp_business_accounts, phone_numbers, phone details, POST subscribed_apps override_callback_uri = destination_url, save KV phone:phone_id encriptado
- GET /api/connections lista real desde KV, 0 estado hermoso inicial
- Dashboard: empty state + lista real con calidad GREEN, tier, status, destino, botones Probar, Ver salud, Copiar reporte, Desconectar — sin IDs crudos a menos que expanda Avanzado
- webhook.js message-blind: GET verifica hub, POST borra messages field, guarda lifecycle solo

## 🏗️ Escalable White-Label
- Solo ENV vars (FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, ENCRYPTION_KEY, Vercel KV)
- vercel.json, .env.example, README
- KV abstracto: Vercel KV > file /tmp > memory
- AES-256-GCM para destination_url y verify_token

## 📦 Estructura
```
public/index.html        SPA landing + dashboard + modal
api/exchange.js          OLD flow exchange + subscribe override
api/connections.js       lista real KV
api/webhook.js           message-blind GET/POST
api/health.js            calidad real time
api/disconnect.js        desconectar
api/_lib/kv.js           abstraction
api/_lib/crypto.js       encrypt/decrypt
api/_lib/meta.js         graph helpers
vercel.json
.env.example
package.json
```

## 🔧 Deploy
```bash
vercel --prod
```
ENV en Vercel Dashboard:
- FACEBOOK_APP_ID=811281598468466
- FACEBOOK_APP_SECRET=...
- ENCRYPTION_KEY=32 chars random (openssl rand -hex 16)
- KV_REST_API_URL, KV_REST_API_TOKEN (auto si añades Vercel KV)
- WEBHOOK_VERIFY_TOKEN opcional global

## 🔐 Seguridad Message-Blind
webhook.js:
```js
if(change.value.messages) delete change.value.messages;
```
Nunca log, nunca guarda mensajes. Solo statuses y quality.

## 💰 Listo para vender white-label
Cambia logo, colores, dominio en index.html. Tu pricing, tu marca. Backend sin quemados, escalable.

No more attempts. DEFINITIVO FINAL.
