import { describe, it, expect } from 'vitest';
import { normalizeRingWebhookEvent } from '@/services/ring/event-normalizer';
import { RingWebhookPayload } from '@/types/ring';

describe('Ring Event Normalization & Fallbacks', () => {
  const baseValidPayload: RingWebhookPayload = {
    meta: {
      request_id: 'wh_req_998877',
      timestamp: '2026-10-24T14:30:00.000Z',
    },
    event_type: 'motion',
    device_id: 'ava1.ring.device.dock1',
    data: {
      event_id: 'evt_001',
      sub_type: 'vehicle',
      started_at: '2026-10-24T14:30:00.000Z',
      snapshot_url: 'https://snapshots.dockflow.internal/test.jpg',
    },
  };

  it('correctly normalizes a vehicle motion event with Smart Alerts', () => {
    const normalized = normalizeRingWebhookEvent(baseValidPayload, 'RING_PARTNER_WEBHOOK', true);

    expect(normalized.requestId).toBe('wh_req_998877');
    expect(normalized.deviceId).toBe('ava1.ring.device.dock1');
    expect(normalized.subType).toBe('vehicle');
    expect(normalized.hasSmartAlertClassification).toBe(true);
    expect(normalized.startedAt.toISOString()).toBe('2026-10-24T14:30:00.000Z');
    expect(normalized.provenance.source).toBe('RING_PARTNER_WEBHOOK');
    expect(normalized.provenance.verifiedSignature).toBe(true);
  });

  it('handles missing Smart Alerts classification gracefully by falling back to generic motion', () => {
    const payloadWithoutSmartAlert: RingWebhookPayload = {
      ...baseValidPayload,
      data: {
        event_id: 'evt_002',
        started_at: '2026-10-24T14:35:00.000Z',
        // sub_type is undefined / omitted
      },
    };

    const normalized = normalizeRingWebhookEvent(payloadWithoutSmartAlert, 'RING_SIMULATOR', true);

    expect(normalized.subType).toBe('motion');
    expect(normalized.hasSmartAlertClassification).toBe(false);
    expect(normalized.provenance.source).toBe('RING_SIMULATOR');
  });

  it('supports human and package_delivery classifications', () => {
    const humanPayload: RingWebhookPayload = {
      ...baseValidPayload,
      data: { ...baseValidPayload.data, sub_type: 'human' },
    };
    const packagePayload: RingWebhookPayload = {
      ...baseValidPayload,
      data: { ...baseValidPayload.data, sub_type: 'package_delivery' },
    };

    const normHuman = normalizeRingWebhookEvent(humanPayload, 'RING_PARTNER_WEBHOOK', true);
    const normPackage = normalizeRingWebhookEvent(packagePayload, 'RING_PARTNER_WEBHOOK', true);

    expect(normHuman.subType).toBe('human');
    expect(normHuman.hasSmartAlertClassification).toBe(true);
    expect(normPackage.subType).toBe('package_delivery');
    expect(normPackage.hasSmartAlertClassification).toBe(true);
  });

  it('throws an informative error if meta.request_id is missing', () => {
    const invalidPayload = {
      ...baseValidPayload,
      meta: { timestamp: '2026-10-24T14:30:00Z' } as any,
    };

    expect(() => normalizeRingWebhookEvent(invalidPayload, 'RING_PARTNER_WEBHOOK')).toThrow(
      'Missing meta.request_id'
    );
  });

  it('throws an informative error if device_id is missing', () => {
    const invalidPayload = {
      ...baseValidPayload,
      device_id: '' as any,
    };

    expect(() => normalizeRingWebhookEvent(invalidPayload, 'RING_PARTNER_WEBHOOK')).toThrow(
      'Missing device_id'
    );
  });
});
