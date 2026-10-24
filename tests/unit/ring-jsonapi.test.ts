import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeRingWebhookEvent } from '@/services/ring/event-normalizer';
import { ringSimulator } from '@/services/ring/simulator';
import { computeRingHmac, verifyRingWebhookSignature } from '@/lib/crypto';
import { ringApiClient } from '@/services/ring/ring-client';
import { RingJsonApiEventPayload } from '@/types/ring';

describe('Official Ring JSON:API Webhook Compatibility', () => {
  const secretKey = 'whsec_official_jsonapi_test_key_2026';

  it('correctly parses and normalizes official Ring JSON:API motion_detected event with vehicle classification', () => {
    const epochMs = Date.now() - 5000;
    const jsonApiPayload: RingJsonApiEventPayload = {
      data: {
        type: 'events',
        id: 'evt_ring_vision_987654321',
        attributes: {
          event_type: 'motion_detected',
          sub_type: 'vehicle',
          source: 'ava1.ring.device.dock1',
          source_type: 'devices',
          timestamp: epochMs,
          timestamp_readable: new Date(epochMs).toISOString(),
          snapshot_url: 'https://snapshots.amazonvision.com/ava1.ring.device.dock1/frame_001.jpg',
          component_ids: ['cam_module_0'],
        },
        relationships: {
          device: { data: { type: 'devices', id: 'ava1.ring.device.dock1' } },
        },
      },
      meta: {
        account_id: 'ring_acc_prod_warehouse_north',
        request_id: 'req_guid_vision_001',
      },
    };

    const normalized = normalizeRingWebhookEvent(jsonApiPayload, 'RING_PARTNER_WEBHOOK', true);

    expect(normalized.requestId).toBe('evt_ring_vision_987654321');
    expect(normalized.deviceId).toBe('ava1.ring.device.dock1');
    expect(normalized.eventType).toBe('motion');
    expect(normalized.subType).toBe('vehicle');
    expect(normalized.hasSmartAlertClassification).toBe(true);
    expect(normalized.startedAt.getTime()).toBe(epochMs);
    expect(normalized.snapshotUrl).toBe('https://snapshots.amazonvision.com/ava1.ring.device.dock1/frame_001.jpg');
    expect(normalized.accountId).toBe('ring_acc_prod_warehouse_north');
    expect(normalized.provenance.source).toBe('RING_PARTNER_WEBHOOK');
    expect(normalized.provenance.verifiedSignature).toBe(true);
  });

  it('correctly parses official Ring device_offline and device_online events', () => {
    const offlinePayload: RingJsonApiEventPayload = {
      data: {
        type: 'events',
        id: 'evt_offline_9999',
        attributes: {
          event_type: 'device_offline',
          source: 'ava1.ring.device.dock4',
          source_type: 'devices',
          timestamp: Date.now(),
        },
      },
      meta: {
        account_id: 'ring_acc_prod_warehouse_north',
      },
    };

    const normalizedOffline = normalizeRingWebhookEvent(offlinePayload, 'RING_PARTNER_WEBHOOK', true);
    expect(normalizedOffline.eventType).toBe('device_status_changed');
    expect(normalizedOffline.deviceId).toBe('ava1.ring.device.dock4');

    const onlinePayload: RingJsonApiEventPayload = {
      data: {
        type: 'events',
        id: 'evt_online_1000',
        attributes: {
          event_type: 'device_online',
          source: 'ava1.ring.device.dock4',
          source_type: 'devices',
          timestamp: Date.now(),
        },
      },
    };

    const normalizedOnline = normalizeRingWebhookEvent(onlinePayload, 'RING_PARTNER_WEBHOOK', true);
    expect(normalizedOnline.eventType).toBe('device_status_changed');
    expect(normalizedOnline.deviceId).toBe('ava1.ring.device.dock4');
  });

  it('verifies raw-body HMAC-SHA256 signature with constant-time equality', () => {
    const payload = ringSimulator.generateOfficialJsonApiPayload({
      deviceId: 'ava1.ring.device.dock3',
      subType: 'vehicle',
    });

    const rawBody = JSON.stringify(payload);
    const expectedHmac = computeRingHmac(rawBody, secretKey);

    // Exact match passes
    expect(verifyRingWebhookSignature(rawBody, expectedHmac, secretKey)).toBe(true);
    // sha256= prefix passes
    expect(verifyRingWebhookSignature(rawBody, `sha256=${expectedHmac}`, secretKey)).toBe(true);
    // Tampered body fails
    expect(verifyRingWebhookSignature(rawBody + ' ', expectedHmac, secretKey)).toBe(false);
    // Tampered signature fails
    expect(verifyRingWebhookSignature(rawBody, 'deadbeef'.repeat(8), secretKey)).toBe(false);
  });

  it('encrypts and decrypts partner tokens securely using AES-256-GCM', () => {
    const rawToken = 'oauth_ring_partner_token_super_secret_xyz123';
    const encrypted = ringApiClient.encryptToken(rawToken);

    expect(encrypted).not.toBe(rawToken);
    expect(encrypted.split(':')).toHaveLength(3); // iv:authTag:cipher

    const decrypted = ringApiClient.decryptToken(encrypted);
    expect(decrypted).toBe(rawToken);
  });
});
