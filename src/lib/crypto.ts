import crypto from 'crypto';

/**
 * Computes the HMAC-SHA256 signature of a raw byte buffer using the given secret key.
 */
export function computeRingHmac(rawBody: Buffer | string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody);
  return hmac.digest('hex');
}

/**
 * Verifies the incoming X-Signature header against the raw request body bytes.
 * Uses timingSafeEqual to protect against timing attacks.
 */
export function verifyRingWebhookSignature(
  rawBody: Buffer | string,
  providedSignature: string | null | undefined,
  secret: string
): boolean {
  if (!providedSignature || !secret) {
    return false;
  }

  // Remove possible 'sha256=' prefix if present
  const cleanSignature = providedSignature.startsWith('sha256=')
    ? providedSignature.slice(7)
    : providedSignature;

  const expectedSignature = computeRingHmac(rawBody, secret);

  const providedBuffer = Buffer.from(cleanSignature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Creates a tamper-evident SHA-256 cryptographic hash from a canonicalized receipt payload.
 */
export function generateTamperProofHash(receiptPayload: Record<string, unknown>): string {
  // Canonical JSON serialization (sorted keys)
  const sortedKeys = Object.keys(receiptPayload).sort();
  const canonicalObj: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    canonicalObj[key] = receiptPayload[key];
  }
  const canonicalString = JSON.stringify(canonicalObj);
  return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
}

/**
 * Encrypts sensitive credentials (like Ring tokens) using AES-256-GCM.
 */
export function encryptSecret(plainText: string, masterKeyHex?: string): string {
  const key = Buffer.from(
    (masterKeyHex || process.env.JWT_SECRET || 'dockflow-master-secret-key-32chars!').padEnd(32, '0').slice(0, 32),
    'utf8'
  );
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts sensitive credentials encrypted with AES-256-GCM.
 */
export function decryptSecret(encryptedPayload: string, masterKeyHex?: string): string {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret format');
  }
  const [ivHex, authTagHex, encryptedText] = parts;
  const key = Buffer.from(
    (masterKeyHex || process.env.JWT_SECRET || 'dockflow-master-secret-key-32chars!').padEnd(32, '0').slice(0, 32),
    'utf8'
  );
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
