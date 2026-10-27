// Clean encrypt - uses ENCRYPTION_KEY env, no hardcoded secrets
import crypto from 'crypto';
const ALG='aes-256-gcm';
function getKey(){
  const raw=process.env.ENCRYPTION_KEY;
  if(!raw) throw new Error('Missing ENCRYPTION_KEY env - generate via openssl rand -hex 32');
  if(/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw,'hex');
  try{ const b=Buffer.from(raw,'base64'); if(b.length===32) return b; }catch{}
  return crypto.createHash('sha256').update(raw).digest();
}
export function encrypt(text){
  if(!text) return null;
  const key=getKey();
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv(ALG,key,iv);
  const enc=Buffer.concat([cipher.update(String(text),'utf8'),cipher.final()]);
  const tag=cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}
export function decrypt(payload){
  if(!payload) return null;
  const [ivB64,tagB64,encB64]=payload.split(':');
  if(!ivB64||!tagB64||!encB64) throw new Error('Invalid payload');
  const key=getKey();
  const iv=Buffer.from(ivB64,'base64'); const tag=Buffer.from(tagB64,'base64'); const enc=Buffer.from(encB64,'base64');
  const decipher=crypto.createDecipheriv(ALG,key,iv); decipher.setAuthTag(tag);
  const dec=Buffer.concat([decipher.update(enc),decipher.final()]);
  return dec.toString('utf8');
}
