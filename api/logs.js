import { Redis } from '@upstash/redis';
const redis = new Redis({
<<<<<<< HEAD
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
=======
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
>>>>>>> bd2b935808f5186c002828723c345e6c8288de2b
});
export default async function handler(req,res){
  const logs = await redis.lrange('webhook_logs',0,19) || [];
  return res.status(200).json(logs.map(l=>{try{return JSON.parse(l)}catch{return l}}));
}
