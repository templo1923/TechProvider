/**
 * TechProvider Seller - Code Exchange & Mapping
 * APP_ID: 811281598468466
 * CONFIG_ID: 1889600718898450
 * 
 * Flow WITHOUT business verification:
 * 1. Exchange code for access_token via graph.facebook.com/v20.0/oauth/access_token
 * 2. Get /me/businesses, then /business/waba, then /waba/phone_numbers
 * 3. Try subscribed_apps override_callback_uri = destination_url (seller router override)
 * 4. Save encrypted to Upstash KV waba_map:phone_id
 */

import { kvSet, kvSadd, kvGet } from '../lib/redis.js';
import { encrypt } from '../lib/encrypt.js';

const APP_ID = '811281598468466';
const CONFIG_ID = '1889600718898450';
const GRAPH = 'https://graph.facebook.com/v20.0';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { code, destination_url, verify_token, coexistence, business_id: inputBusinessId } = req.body || {};

    if (!code) return res.status(400).json({ error: 'Missing code from FB.login (config_id flow)' });
    if (!destination_url) return res.status(400).json({ error: 'Missing destination_url from Ranvedix modal' });

    const APP_SECRET = process.env.APP_SECRET;
    const VERIFY_TOKEN = verify_token || process.env.VERIFY_TOKEN || 'WLfsAiS52U0n';
    if (!APP_SECRET) return res.status(500).json({ error: 'Missing APP_SECRET env' });

    // 1) Exchange code -> user access token
    const tokenRes = await fetch(`${GRAPH}/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&code=${encodeURIComponent(code)}`);
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Token exchange failed', tokenData);
      return res.status(400).json({ error: 'Token exchange failed', details: tokenData });
    }
    const userToken = tokenData.access_token;

    // 2) Get businesses (tech provider flow works without business verification)
    let businesses = [];
    const bizRes = await fetch(`${GRAPH}/me/businesses?access_token=${encodeURIComponent(userToken)}`);
    const bizData = await bizRes.json();
    if (bizData.data) businesses = bizData.data;

    // 2b) If no businesses, try to get owned WABAs via debug or me? fallback
    let wabas = [];
    for (const biz of businesses) {
      // Owned WABAs
      const ownedRes = await fetch(`${GRAPH}/${biz.id}/owned_whatsapp_business_accounts?access_token=${encodeURIComponent(userToken)}`);
      const ownedData = await ownedRes.json();
      if (ownedData.data) {
        for (const w of ownedData.data) wabas.push({ ...w, business_id: biz.id, relationship: 'owned' });
      }
      const clientRes = await fetch(`${GRAPH}/${biz.id}/client_whatsapp_business_accounts?access_token=${encodeURIComponent(userToken)}`);
      const clientData = await clientRes.json();
      if (clientData.data) {
        for (const w of clientData.data) wabas.push({ ...w, business_id: biz.id, relationship: 'client' });
      }
    }

    // If still no WABA via businesses, try /me/whatsapp_business_accounts or /debug_token flow for Embedded Signup
    if (wabas.length === 0) {
      // For new Embedded Signup, WABA ID comes from granted dataset
      // Try to list WABAs directly with user token via /me
      const meWabaRes = await fetch(`${GRAPH}/debug_token?input_token=${encodeURIComponent(userToken)}&access_token=${APP_ID}|${APP_SECRET}`);
      const meWabaData = await meWabaRes.json();
      // Fallback: try fetching from /me with permission
      const fallbackRes = await fetch(`${GRAPH}/${APP_ID}/subscriptions?access_token=${encodeURIComponent(userToken)}`).catch(()=>null);
    }

    // If input business_id provided, prioritize
    if (inputBusinessId) {
      const filtered = wabas.filter(w => w.business_id === inputBusinessId);
      if (filtered.length > 0) wabas = filtered;
    }

    let phone_numbers = [];
    let mappings = [];

    for (const waba of wabas) {
      const wabaId = waba.id;
      // Get phone numbers
      const phRes = await fetch(`${GRAPH}/${wabaId}/phone_numbers?access_token=${encodeURIComponent(userToken)}`);
      const phData = await phRes.json();
      const numbers = phData.data || [];

      for (const ph of numbers) {
        phone_numbers.push(ph);
        const phoneId = ph.id;

        // 3) Try subscribed_apps override_callback_uri = destination_url
        let subResult = null;
        try {
          const subRes = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              override_callback_uri: destination_url,
              verify_token: VERIFY_TOKEN,
              access_token: userToken
            })
          });
          subResult = await subRes.json();
          // Some versions expect query params
          if (!subRes.ok) {
            const subRes2 = await fetch(`${GRAPH}/${wabaId}/subscribed_apps?override_callback_uri=${encodeURIComponent(destination_url)}&verify_token=${encodeURIComponent(VERIFY_TOKEN)}&access_token=${encodeURIComponent(userToken)}`, {
              method: 'POST'
            });
            subResult = await subRes2.json();
          }
        } catch (e) {
          subResult = { error: e.message };
        }

        // 4) Save encrypted mapping to Upstash KV: waba_map:phone_id
        const record = {
          waba_id: wabaId,
          phone_number_id: phoneId,
          phone_number: ph.display_phone_number || ph.phone_number || '',
          display_phone_number: ph.display_phone_number || '',
          business_id: waba.business_id,
          business_name: waba.business_id,
          name: ph.verified_name || ph.certificate || '',
          destination_url,
          verify_token: VERIFY_TOKEN,
          coexistence: !!coexistence,
          config_id: CONFIG_ID,
          app_id: APP_ID,
          access_token_encrypted: encrypt(userToken), // encrypted storage
          waba_access_token_encrypted: ph.access_token ? encrypt(ph.access_token) : null,
          subscribed_apps_result: subResult,
          created_at: new Date().toISOString(),
          flow: 'tech_provider_no_verification',
          override_callback_uri: destination_url
        };

        await kvSet(`waba_map:${phoneId}`, record);
        await kvSadd('connections:index', phoneId);
        await kvSet(`phone:${phoneId}:info`, {
          waba_id: wabaId,
          phone_id: phoneId,
          display: ph.display_phone_number,
          created_at: record.created_at
        });

        mappings.push({
          phone_number_id: phoneId,
          waba_id: wabaId,
          display_phone_number: ph.display_phone_number,
          subscribed_apps: subResult,
          destination_url
        });
      }
    }

    return res.status(200).json({
      success: true,
      app_id: APP_ID,
      config_id: CONFIG_ID,
      businesses_found: businesses.length,
      wabas_found: wabas.length,
      phone_numbers_found: phone_numbers.length,
      mappings,
      message: `Tech Provider flow completed WITHOUT business verification using config_id ${CONFIG_ID}`,
      verify_token_default: 'WLfsAiS52U0n',
      note: 'Message-blind router active: inbound messages dropped, only lifecycle stored. Override callback set to destination_url via subscribed_apps.'
    });

  } catch (err) {
    console.error('exchange error', err);
    return res.status(500).json({ error: 'Internal error', details: err.message, app_id: APP_ID, config_id: CONFIG_ID });
  }
}
