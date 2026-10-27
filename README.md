# TechProvider CLEAN SAAS FINAL - Single landing, no burned data

Fixed 3 problems:
- Removed all hardcoded webhook URLs and verify tokens, phone IDs, WABA IDs from landing and backend - now env vars + placeholders only
- Fixed FB SDK asyncfunction error: fbAsyncInit as regular function, loader via (function(d,s,id){...}), FB.init with autoLogAppEvents,xfbml,version v20.0
- Restored Ranvedix professional non-technical conversion-focused landing LATAM Spanish
- Modal placeholders: Destination https://your-app.com/webhook/whatsapp (empty value) and verify token placeholder your-webhook-verify-token

APP_ID 811281598468466 + CONFIG 1889600718898450 work without portfolio verification in dev mode

Checklist:
- Landing hero: Tus mensajes van a todas partes excepto a traves de nosotros.
- Trust bar: Meta Tech Provider, Official Cloud API, Message-blind, Per-tenant
- How it works 3 pasos, pricing 9/49/149, FAQ, footer
- No technical IDs in landing text
- FB SDK: domain check for techproviderseller.vercel.app, warning banner, friendly error about App Domains and OAuth URIs
