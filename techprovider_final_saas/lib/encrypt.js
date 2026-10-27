import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function getKey() {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error('Missing ENCRYPTION_KEY');
  // Derive 32 byte key via SHA256 if not 32
  if (secret.length === 32) return Buffer.from(secret);
  if (secret.length === 64) return Buffer.from(secret, 'hex'); // if hex
  return crypto.createHash('sha256').update(secret).digest();
}

export function encrypt(text) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  let enc = cipher.update(text, 'utf8', 'base64');
  enc += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');
  return `${iv.toString('base64')}:${authTag}:${enc}`;
}

export function decrypt(payload) {
  const key = getKey();
  const [ivB64, tagB64, encB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !encB64) throw new Error('Invalid encrypted payload');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  let dec = decipher.update(encB64, 'base64', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}
