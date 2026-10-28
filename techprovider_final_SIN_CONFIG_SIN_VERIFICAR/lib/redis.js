// Upstash / Vercel KV REST wrapper - works without verification
function getEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return { url, token };
}
async function restCall(commands) {
  const { url, token } = getEnv();
  if (!url || !token) return null;
  const endpoint = url.replace(/\/$/, '');
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands)
    });
    if (!res.ok) { const txt = await res.text(); console.error('KV REST error', res.status, txt); return null; }
    return await res.json();
  } catch (e) { console.error('KV REST exception', e); return null; }
}
function ensureMemory(){
  if (!global.__MEM_KV) global.__MEM_KV = new Map();
  if (!global.__MEM_LISTS) global.__MEM_LISTS = new Map();
}
export async function redisGet(key){
  ensureMemory();
  const {url,token}=getEnv();
  if(!url||!token) return global.__MEM_KV.get(key)||null;
  const result = await restCall([['GET', key]]);
  if (!result) return null;
  if (Array.isArray(result)) return result[0]?.result ?? null;
  return result.result ?? null;
}
export async function redisSet(key,value,opts={}){
  ensureMemory();
  const {url,token}=getEnv();
  const str = typeof value==='string'?value:JSON.stringify(value);
  if(!url||!token){ global.__MEM_KV.set(key,str); return true; }
  let cmd = opts.ex ? ['SET', key, str, 'EX', String(opts.ex)] : ['SET', key, str];
  await restCall([cmd]); return true;
}
export async function redisDel(key){
  ensureMemory();
  const {url,token}=getEnv();
  if(!url||!token){ global.__MEM_KV.delete(key); return true; }
  await restCall([['DEL', key]]); return true;
}
export async function redisLPush(key,value){
  ensureMemory();
  const str = typeof value==='string'?value:JSON.stringify(value);
  const {url,token}=getEnv();
  if(!url||!token){
    if(!global.__MEM_LISTS.has(key)) global.__MEM_LISTS.set(key, []);
    global.__MEM_LISTS.get(key).unshift(str);
    if(global.__MEM_LISTS.get(key).length>500) global.__MEM_LISTS.get(key).pop();
    return true;
  }
  await restCall([['LPUSH', key, str], ['LTRIM', key, '0', '499']]); return true;
}
export async function redisLRange(key,start=0,stop=99){
  ensureMemory();
  const {url,token}=getEnv();
  if(!url||!token){
    const arr = global.__MEM_LISTS.get(key)||[];
    const s = start<0?0:start;
    const e = stop===-1?arr.length:stop+1;
    return arr.slice(s,e);
  }
  const result = await restCall([['LRANGE', key, String(start), String(stop)]]);
  if(!result) return [];
  const data = Array.isArray(result)?result[0]?.result:result.result;
  return data||[];
}
export async function redisKeys(pattern){
  ensureMemory();
  const {url,token}=getEnv();
  if(!url||!token){
    const all=[...global.__MEM_KV.keys()];
    if(pattern.endsWith('*')){ const prefix=pattern.slice(0,-1); return all.filter(k=>k.startsWith(prefix)); }
    return all;
  }
  const result = await restCall([['KEYS', pattern]]);
  if(!result) return [];
  const data = Array.isArray(result)?result[0]?.result:result.result;
  return data||[];
}
export async function redisSAdd(key,member){
  ensureMemory();
  const {url,token}=getEnv();
  if(!url||!token){
    if(!global.__MEM_LISTS.has(key)) global.__MEM_LISTS.set(key, new Set());
    let set=global.__MEM_LISTS.get(key);
    if(!(set instanceof Set)){ set=new Set(Array.isArray(set)?set:[]); global.__MEM_LISTS.set(key,set); }
    set.add(member); return true;
  }
  await restCall([['SADD', key, member]]); return true;
}
export async function redisSMembers(key){
  ensureMemory();
  const {url,token}=getEnv();
  if(!url||!token){
    const set=global.__MEM_LISTS.get(key);
    if(!set) return [];
    if(set instanceof Set) return [...set];
    return set;
  }
  const result = await restCall([['SMEMBERS', key]]);
  if(!result) return [];
  const data = Array.isArray(result)?result[0]?.result:result.result;
  return data||[];
}