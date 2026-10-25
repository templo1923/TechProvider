import { Redis } from '@upstash/redis';
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});
export default async function handler(req,res){
  const logs = await redis.lrange('webhook_logs',0,19) || [];
  return res.status(200).json(logs.map(l=>{try{return JSON.parse(l)}catch{return l}}));
}
