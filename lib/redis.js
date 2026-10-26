import { Redis } from '@upstash/redis';
let client;
export function getRedis(){
  if(client) return client;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if(url && token){ client = new Redis({ url, token }); } else {
    client = { _mem:{}, _lists:{}, hgetall: async(k)=>client._mem[k]||{}, hset: async(k,v)=>{ client._mem[k]={...(client._mem[k]||{}), ...v}; return 1; }, hdel: async(k,f)=>{ if(client._mem[k]) delete client._mem[k][f]; }, lpush: async(k,v)=>{ client._lists[k]=client._lists[k]||[]; client._lists[k].unshift(v); }, lrange: async(k,s,e)=>{ const arr=client._lists[k]||[]; const end=e===-1?undefined:e+1; return arr.slice(s,end); }, ltrim: async(k,s,e)=>{ if(client._lists[k]) client._lists[k]=client._lists[k].slice(s,e+1); }, del: async(k)=>{ delete client._mem[k]; delete client._lists[k]; } };
  }
  return client;
}
export function encryptToken(t){ return Buffer.from(t).toString('base64'); }
export function decryptToken(e){ try{ return Buffer.from(e,'base64').toString(); }catch{ return e; } }