import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';

const MAGIC = Buffer.from('TW1'); // Toolsweb AES-256-GCM v1
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

/**
 * Resolve AES-256 key from env.
 * Accepts: 64-char hex, base64 32-byte key, or passphrase (scrypt-derived).
 */
export function resolveEncryptionKey(raw = process.env.TOOLSWEB_ENCRYPTION_KEY): Buffer {
  if (!raw || !raw.trim()) {
    throw new Error(
      'TOOLSWEB_ENCRYPTION_KEY no configurada. Define 64 hex chars (openssl rand -hex 32) o una passphrase en .env'
    );
  }
  const value = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, 'hex');
  }
  try {
    const b64 = Buffer.from(value, 'base64');
    if (b64.length === KEY_LEN) return b64;
  } catch {
    /* fall through */
  }
  const salt = createHash('sha256')
    .update(process.env.TOOLSWEB_ENCRYPTION_SALT ?? 'toolsweb-at-rest-v1')
    .digest();
  return scryptSync(value, salt, KEY_LEN);
}

export function hasEncryptionKey(): boolean {
  return Boolean(process.env.TOOLSWEB_ENCRYPTION_KEY?.trim());
}

/** AES-256-GCM encrypt → TW1 | iv | tag | ciphertext */
export function encryptAes256Gcm(plain: Buffer, key = resolveEncryptionKey()): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, iv, tag, ciphertext]);
}

export function decryptAes256Gcm(blob: Buffer, key = resolveEncryptionKey()): Buffer {
  if (blob.length < MAGIC.length + IV_LEN + TAG_LEN + 1) {
    throw new Error('Ciphertext too short');
  }
  if (!blob.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('Unknown ciphertext magic (expected TW1)');
  }
  let offset = MAGIC.length;
  const iv = blob.subarray(offset, offset + IV_LEN);
  offset += IV_LEN;
  const tag = blob.subarray(offset, offset + TAG_LEN);
  offset += TAG_LEN;
  const ciphertext = blob.subarray(offset);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function isEncryptedBlob(blob: Buffer): boolean {
  return blob.length >= MAGIC.length && blob.subarray(0, MAGIC.length).equals(MAGIC);
}
