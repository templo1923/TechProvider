export async function kvGet(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Missing Upstash env');
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (!data.result) return null;
  try { return JSON.parse(data.result); } catch { return data.result; }
}

export async function kvSet(key, value) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Missing Upstash env');
  const val = typeof value === 'string' ? value : JSON.stringify(value);
  const res = await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(val)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

export async function kvKeys(pattern) {
  // Upstash: use SCAN via REST? use keys endpoint
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Missing Upstash env');
  // Try SCAN 0 MATCH pattern
  const res = await fetch(`${url}/keys/${encodeURIComponent(pattern)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return data.result || [];
}

export async function kvDel(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const res = await fetch(`${url}/del/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

export async function kvLpush(key, value) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const val = typeof value === 'string' ? value : JSON.stringify(value);
  const res = await fetch(`${url}/lpush/${encodeURIComponent(key)}/${encodeURIComponent(val)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  // Keep only 500 logs
  await fetch(`${url}/ltrim/${encodeURIComponent(key)}/0/499`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

export async function kvLrange(key, start=0, stop=100) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const res = await fetch(`${url}/lrange/${encodeURIComponent(key)}/${start}/${stop}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (!data.result) return [];
  return data.result.map(v => {
    try { return JSON.parse(v); } catch { return v; }
  });
}

export async function kvSadd(key, member) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const res = await fetch(`${url}/sadd/${encodeURIComponent(key)}/${encodeURIComponent(member)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

export async function kvSmembers(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const res = await fetch(`${url}/smembers/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return data.result || [];
}
