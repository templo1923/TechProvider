// lib/redis.js - Scalable storage: Upstash REST (KV) + ioredis + in-memory fallback
let kvClient = null;
let redisClient = null;
let useKv = false;
let useRedis = false;

// Try load @vercel/kv lazily
try {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { kv } = require('@vercel/kv');
    kvClient = kv;
    useKv = true;
  }
} catch (e) {
  console.warn('KV not available, fallback', e.message);
}

try {
  if (process.env.REDIS_URL) {
    const IORedis = require('ioredis');
    redisClient = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: false
    });
    useRedis = true;
  }
} catch (e) {
  console.warn('Redis not available', e.message);
}

// In-memory fallback for local dev (not for production, but allows verification pending to run)
const mem = new Map();
const memSets = new Map();

function memSAdd(key, val) {
  if (!memSets.has(key)) memSets.set(key, new Set());
  memSets.get(key).add(val);
}
function memSMembers(key) {
  return Array.from(memSets.get(key) || []);
}

async function get(key) {
  if (useKv) {
    try { return await kvClient.get(key); } catch {}
  }
  if (useRedis) {
    try {
      const raw = await redisClient.get(key);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return raw; }
    } catch {}
  }
  return mem.get(key) || null;
}

async function set(key, value, ttlSec) {
  if (useKv) {
    try {
      if (ttlSec) await kvClient.set(key, value, { ex: ttlSec });
      else await kvClient.set(key, value);
      return true;
    } catch (e) { console.error('kv set err', e.message); }
  }
  if (useRedis) {
    try {
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttlSec) await redisClient.set(key, str, 'EX', ttlSec);
      else await redisClient.set(key, str);
      return true;
    } catch (e) { console.error('redis set err', e.message); }
  }
  mem.set(key, value);
  return true;
}

async function del(key) {
  if (useKv) { try { await kvClient.del(key); } catch {} }
  if (useRedis) { try { await redisClient.del(key); } catch {} }
  mem.delete(key);
}

async function sAdd(setKey, member) {
  if (useKv) { try { await kvClient.sadd(setKey, member); return; } catch {} }
  if (useRedis) { try { await redisClient.sadd(setKey, member); return; } catch {} }
  memSAdd(setKey, member);
}

async function sMembers(setKey) {
  if (useKv) { try { return await kvClient.smembers(setKey); } catch {} }
  if (useRedis) { try { return await redisClient.smembers(setKey); } catch {} }
  return memSMembers(setKey);
}

async function keys(pattern) {
  // pattern only supports prefix* for mem
  if (useKv) { try { return await kvClient.keys(pattern); } catch {} }
  if (useRedis) { try { return await redisClient.keys(pattern); } catch {} }
  const prefix = pattern.replace('*','');
  return Array.from(mem.keys()).filter(k => k.startsWith(prefix));
}

// High-level helpers
async function saveConnection(conn) {
  const key = `connection:${conn.id}`;
  await set(key, conn);
  await sAdd('connections:index', conn.id);
  if (conn.waba_id) await set(`waba:${conn.waba_id}`, conn.id);
  if (conn.phone_numbers) {
    for (const p of conn.phone_numbers) {
      if (p.id) await set(`phone:${p.id}`, conn.id);
      if (p.display_phone_number) {
        const norm = p.display_phone_number.replace(/[^0-9]/g,'');
        if (norm) await set(`phone_display:${norm}`, conn.id);
      }
    }
  }
  // also map verify_token -> id for fast webhook GET (per connection)
  if (conn.verify_token) await set(`verify_token:${conn.verify_token}`, conn.id);
  return conn;
}

async function getConnection(id) {
  return await get(`connection:${id}`);
}

async function getConnectionIdByWaba(wabaId) {
  return await get(`waba:${wabaId}`);
}

async function getConnectionIdByPhone(phoneId) {
  return await get(`phone:${phoneId}`);
}

async function getConnectionIdByVerifyToken(token) {
  return await get(`verify_token:${token}`);
}

async function listConnections() {
  const ids = await sMembers('connections:index');
  const out = [];
  for (const id of ids) {
    const c = await get(`connection:${id}`);
    if (c) out.push(c);
  }
  // sort newest first
  out.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  return out;
}

async function findConnectionByWabaOrPhone(wabaId, phoneId) {
  let cid = null;
  if (phoneId) cid = await getConnectionIdByPhone(phoneId);
  if (!cid && wabaId) cid = await getConnectionIdByWaba(wabaId);
  if (!cid) return null;
  return await getConnection(cid);
}

module.exports = {
  get,
  set,
  del,
  sAdd,
  sMembers,
  keys,
  saveConnection,
  getConnection,
  getConnectionIdByWaba,
  getConnectionIdByPhone,
  getConnectionIdByVerifyToken,
  listConnections,
  findConnectionByWabaOrPhone
};
