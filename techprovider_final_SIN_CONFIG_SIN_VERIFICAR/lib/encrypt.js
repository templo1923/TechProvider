import crypto from 'crypto';
const ALGO='aes-256-gcm'; const IV_LEN=12;
function getKey(){
  const raw=process.env.ENCRYPTION_KEY||'default-dev-key-please-change-32b!';
  if(raw.length===32) return Buffer.from(raw);
  if(/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw,'hex');
  return crypto.createHash('sha256').update(raw).digest();
}
export function encryptValue(text){
  if(!text) return text;
  const key=getKey(); const iv=crypto.randomBytes(IV_LEN);
  const cipher=crypto.createCipheriv(ALGO,key,iv);
  const enc=Buffer.concat([cipher.update(String(text),'utf8'), cipher.final()]);
  const tag=cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}
export function decryptValue(payload){
  if(!payload) return payload;
  try{
    const [ivB64,tagB64,encB64]=String(payload).split(':');
    if(!ivB64||!tagB64||!encB64) return payload;
    const key=getKey(); const iv=Buffer.from(ivB64,'base64'); const tag=Buffer.from(tagB64,'base64'); const enc=Buffer.from(encB64,'base64');
    const decipher=crypto.createDecipheriv(ALGO,key,iv); decipher.setAuthTag(tag);
    const dec=Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  }catch(e){ console.error('decrypt fail',e.message); return null; }
}
export function encryptObject(obj){ return encryptValue(JSON.stringify(obj)); }
export function decryptObject(payload){
  const txt=decryptValue(payload); if(!txt) return null;
  try{ return JSON.parse(txt); }catch{ return txt; }
}