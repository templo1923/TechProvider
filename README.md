# Tech Provider Final - SIN CONFIG_ID - SIN VERIFICACION
Clean SaaS template that works WITHOUT portfolio verification and WITHOUT Kiamber Corp error.

## Why this fixes Kiamber Corp error
Earlier builds used `config_id: 18896..._REMOVED_FOR_CLEAN_BUILD (old system_user flow)` with `system_user` type.
That requires Tech Provider business verification. If not verified, Meta returns: "Kiamber Corp no puede incorporar clientes".

Final fix: Use OLD self-serve flow without config_id:
```js
FB.login(callback, {
  scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management',
  extras: { featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: 3 }
})
```
Self-serve, no system_user, works in dev mode.

Funciona sin verificar portafolio en modo desarrollo - flujo self-serve

## Files
/api/webhook.js (message-blind)
/api/exchange.js (OLD FLOW exchange code -> token via /oauth/access_token?client_id=APP_ID&client_secret=APP_SECRET&code=CODE, me/businesses, owned_whatsapp_business_accounts, phone_numbers, POST subscribed_apps override_callback_uri = destination_url)
/api/mapping.js, connections.js, logs.js
/lib/redis.js, encrypt.js
/public/index.html beautiful Ranvedix landing CLEAN no burned data
vercel.json, .env.example

## FB SDK fixed
window.fbAsyncInit = function() NOT async
(function(d,s,id)... loader
FB.init({appId: '811281598468466', autoLogAppEvents: true, xfbml: true, version: 'v20.0'})