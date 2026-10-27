// CLEAN redis helper - uses env vars only (UPSTASH_REDIS_REST_URL or KV_REST_API_URL)
// No hardcoded IDs, no tokens hardcoded
function getEnv(){
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if(!url || !token) throw new Error('Missing KV env: set UPSTASH_REDIS_REST_URL and TOKEN or KV_REST_API_URL/TOKEN');
  return {url: url.replace(/\/$/,''), token};
}
export function getRedisConfig(){ return getEnv(); }
export async function kvGet(key){
  const {url, token} = getEnv();
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, { headers:{Authorization:`Bearer ${token}`}});
  const data = await res.json();
  if(!data.result) return null;
  try{return JSON.parse(data.result);}catch{return data.result;}
}
export async function kvSet(key,value){
  const {url, token} = getEnv();
  const val = typeof value==='string'?value:JSON.stringify(value);
  return (await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(val)}`, { headers:{Authorization:`Bearer ${token}`}})).json();
}
export async function kvDel(key){
  const {url, token} = getEnv();
  return (await fetch(`${url}/del/${encodeURIComponent(key)}`, { headers:{Authorization:`Bearer ${token}`}})).json();
}
export async function kvKeys(pattern){
  const {url, token} = getEnv();
  const res = await fetch(`${url}/keys/${encodeURIComponent(pattern)}`, { headers:{Authorization:`Bearer ${token}`}});
  const data = await res.json();
  return data.result||[];
}
export async function kvLpush(key,value){
  const {url, token} = getEnv();
  const val = typeof value==='string'?value:JSON.stringify(value);
  await fetch(`${url}/lpush/${encodeURIComponent(key)}/${encodeURIComponent(val)}`, { headers:{Authorization:`Bearer ${token}`}});
  await fetch(`${url}/ltrim/${encodeURIComponent(key)}/0/499`, { headers:{Authorization:`Bearer ${token}`}});
}
export async function kvLrange(key,start=0,stop=100){
  const {url, token} = getEnv();
  const res = await fetch(`${url}/lrange/${encodeURIComponent(key)}/${start}/${stop}`, { headers:{Authorization:`Bearer ${token}`}});
  const data = await res.json();
  if(!data.result) return [];
  return data.result.map(v=>{try{return JSON.parse(v);}catch{return v;}});
}
export async function kvSadd(key,member){
  const {url, token} = getEnv();
  return (await fetch(`${url}/sadd/${encodeURIComponent(key)}/${encodeURIComponent(member)}`, { headers:{Authorization:`Bearer ${token}`}})).json();
}
export async function kvSmembers(key){
  const {url, token} = getEnv();
  const res = await fetch(`${url}/smembers/${encodeURIComponent(key)}`, { headers:{Authorization:`Bearer ${token}`}});
  const data = await res.json();
  return data.result||[];
}
