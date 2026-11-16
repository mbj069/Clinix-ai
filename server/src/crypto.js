// Secret encryption at rest (AES-256-GCM).
//
// Used for provider API keys stored in the database. The encryption key comes
// from ENCRYPTION_KEY (32 random bytes, hex or base64) or is derived from
// JWT_SECRET via scrypt as a fallback — so a deployment that sets JWT_SECRET
// (required in production) always has a working encryption key without a
// second secret to manage. Real-client deployments should set ENCRYPTION_KEY
// explicitly so key rotation is independent of the JWT secret.
//
// Stored format: "enc:v1:<base64(iv 12B | authTag 16B | ciphertext)>".
// Values without the prefix are legacy plaintext — read as-is so keys saved
// before encryption keep working, and re-encrypted on the next save.

import crypto from 'node:crypto';

const PREFIX = 'enc:v1:';

function encryptionKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (raw) {
    // Accept 64 hex chars (32 bytes) or base64 of 32 bytes.
    const buf = /^[0-9a-fA-F]{64}$/.test(raw)
      ? Buffer.from(raw, 'hex')
      : Buffer.from(raw, 'base64');
    if (buf.length === 32) return buf;
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64).');
  }
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret !== 'dev-secret-change-me') {
    return crypto.scryptSync(jwtSecret, 'clinix-ai-encryption', 32);
  }
  // Local dev only: deterministic dev key. Production refuses to start
  // without JWT_SECRET (see middleware/auth.js), so this is unreachable there.
  return crypto.scryptSync('dev-secret-change-me', 'clinix-ai-encryption', 32);
}

export function encryptSecret(plaintext) {
  if (!plaintext) return '';
  const key = encryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decryptSecret(stored) {
  if (!stored) return '';
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext
  const buf = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const key = encryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function isEncrypted(stored) {
  return typeof stored === 'string' && stored.startsWith(PREFIX);
}
