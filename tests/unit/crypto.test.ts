import { describe, it, expect } from 'vitest';
import {
  computeRingHmac,
  verifyRingWebhookSignature,
  generateTamperProofHash,
  encryptSecret,
  decryptSecret,
} from '@/lib/crypto';

describe('Cryptographic Operations & Signature Verification', () => {
  const secretKey = 'whsec_test_secret_for_dockflow_unit_tests';
  const testPayload = JSON.stringify({
    meta: { request_id: 'req_123', timestamp: '2026-10-24T12:00:00Z' },
    event_type: 'motion',
    device_id: 'ava1.ring.device.dock1',
  });

  it('correctly calculates HMAC-SHA256 signature for raw byte payloads', () => {
    const signature = computeRingHmac(testPayload, secretKey);
    expect(signature).toBeDefined();
    expect(signature).toHaveLength(64); // 32 bytes hex encoded = 64 characters
  });

  it('verifies valid HMAC signatures using timing-safe comparison', () => {
    const signature = computeRingHmac(testPayload, secretKey);
    const isValid = verifyRingWebhookSignature(testPayload, signature, secretKey);
    expect(isValid).toBe(true);
  });

  it('supports signatures prefixed with "sha256="', () => {
    const rawSignature = computeRingHmac(testPayload, secretKey);
    const prefixed = `sha256=${rawSignature}`;
    const isValid = verifyRingWebhookSignature(testPayload, prefixed, secretKey);
    expect(isValid).toBe(true);
  });

  it('rejects tampered payload content with invalid signature', () => {
    const validSignature = computeRingHmac(testPayload, secretKey);
    const tamperedPayload = JSON.stringify({
      meta: { request_id: 'req_123_tampered' },
      event_type: 'motion',
    });
    const isValid = verifyRingWebhookSignature(tamperedPayload, validSignature, secretKey);
    expect(isValid).toBe(false);
  });

  it('rejects null, undefined, or empty signatures', () => {
    expect(verifyRingWebhookSignature(testPayload, null, secretKey)).toBe(false);
    expect(verifyRingWebhookSignature(testPayload, undefined, secretKey)).toBe(false);
    expect(verifyRingWebhookSignature(testPayload, '', secretKey)).toBe(false);
  });

  it('generates deterministic SHA-256 tamper-proof receipt hashes regardless of key order', () => {
    const objA = { receiptNumber: 'REC-001', carrier: 'FedEx', pallets: 10 };
    const objB = { pallets: 10, receiptNumber: 'REC-001', carrier: 'FedEx' };

    const hashA = generateTamperProofHash(objA);
    const hashB = generateTamperProofHash(objB);

    expect(hashA).toBe(hashB);
    expect(hashA).toHaveLength(64);
  });

  it('encrypts and decrypts sensitive Ring tokens using AES-256-GCM', () => {
    const originalToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ring_test_token';
    const encrypted = encryptSecret(originalToken);

    expect(encrypted).not.toBe(originalToken);
    expect(encrypted.split(':')).toHaveLength(3); // iv:authTag:cipherText

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(originalToken);
  });
});
