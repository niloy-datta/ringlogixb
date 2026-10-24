import { describe, it, expect } from 'vitest';
import { ringSimulator } from '@/services/ring/simulator';
import { verifyRingWebhookSignature } from '@/lib/crypto';
import { normalizeRingWebhookEvent } from '@/services/ring/event-normalizer';

describe('Simulator Fixtures & Webhook Integration Pipeline', () => {
  const secretKey = 'whsec_simulator_test_key';

  it('generates fully compliant Ring motion payload signed with HMAC', () => {
    const payload = ringSimulator.generateSimulatedPayload({
      deviceId: 'ava1.ring.device.dock1',
      subType: 'vehicle',
    });

    const { rawBody, signatureHeader } = ringSimulator.signPayload(payload, secretKey);

    expect(signatureHeader).toBeDefined();
    expect(rawBody).toContain('ava1.ring.device.dock1');
    expect(rawBody).toContain('vehicle');

    // Verify signature passes
    const isValid = verifyRingWebhookSignature(rawBody, signatureHeader, secretKey);
    expect(isValid).toBe(true);
  });

  it('generates Ring device status changed payload (camera offline)', () => {
    const payload = ringSimulator.generateDeviceStatusPayload('ava1.ring.device.dock2', false);

    expect(payload.event_type).toBe('device_status_changed');
    expect(payload.device_id).toBe('ava1.ring.device.dock2');
    expect(payload.data.online).toBe(false);

    const { rawBody, signatureHeader } = ringSimulator.signPayload(payload, secretKey);
    const isValid = verifyRingWebhookSignature(rawBody, signatureHeader, secretKey);
    expect(isValid).toBe(true);
  });

  it('normalizes simulated payload with proper provenance tracking', () => {
    const payload = ringSimulator.generateSimulatedPayload({
      deviceId: 'ava1.ring.device.dock1',
      subType: 'vehicle',
    });

    const normalized = normalizeRingWebhookEvent(payload, 'RING_SIMULATOR', true);

    expect(normalized.provenance.source).toBe('RING_SIMULATOR');
    expect(normalized.subType).toBe('vehicle');
    expect(normalized.hasSmartAlertClassification).toBe(true);
  });
});
