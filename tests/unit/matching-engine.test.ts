import { describe, it, expect } from 'vitest';
import { matchingEngine, DeliveryCandidateRecord, CameraDockInfo } from '@/services/correlation/matching-engine';
import { NormalizedRingEvent } from '@/types/ring';

describe('Deterministic Correlation & Matching Engine', () => {
  const baseCameraDock: CameraDockInfo = {
    dockId: 'dock_bay_01',
    dockNumber: 'BAY-01',
    facilityId: 'fac_chicago_01',
  };

  const scheduledDeliveries: DeliveryCandidateRecord[] = [
    {
      id: 'del_01',
      purchaseOrderNumber: 'PO-1001',
      carrierName: 'FedEx Freight',
      dockId: 'dock_bay_01',
      dockNumber: 'BAY-01',
      windowStart: new Date('2026-10-24T10:00:00Z'),
      windowEnd: new Date('2026-10-24T12:00:00Z'),
      status: 'SCHEDULED',
    },
    {
      id: 'del_02',
      purchaseOrderNumber: 'PO-1002',
      carrierName: 'Old Dominion Freight',
      dockId: 'dock_bay_02',
      dockNumber: 'BAY-02',
      windowStart: new Date('2026-10-24T10:30:00Z'),
      windowEnd: new Date('2026-10-24T12:30:00Z'),
      status: 'SCHEDULED',
    },
  ];

  it('produces high confidence match (> 0.90) for vehicle arrival matching dock and appointment window', () => {
    const event: NormalizedRingEvent = {
      requestId: 'req_01',
      deviceId: 'ava1.ring.device.dock1',
      eventType: 'motion',
      subType: 'vehicle',
      hasSmartAlertClassification: true,
      startedAt: new Date('2026-10-24T10:45:00Z'), // Strictly inside PO-1001 window
      rawPayload: {},
      provenance: { source: 'RING_PARTNER_WEBHOOK', receivedAt: new Date(), verifiedSignature: true },
    };

    const matches = matchingEngine.evaluateCandidates(event, baseCameraDock, scheduledDeliveries);

    expect(matches).toHaveLength(2);
    const topMatch = matches[0];
    expect(topMatch.deliveryId).toBe('del_01');
    expect(topMatch.confidenceScore).toBeGreaterThanOrEqual(0.9);
    expect(topMatch.evidence.dockMatch.matched).toBe(true);
    expect(topMatch.evidence.timeWindowMatch.matched).toBe(true);
    expect(topMatch.evidence.classificationMatch.isVehicle).toBe(true);
  });

  it('evaluates and ranks multiple candidate delivery matches', () => {
    // Both deliveries at same dock with overlapping windows
    const overlappingDeliveries: DeliveryCandidateRecord[] = [
      {
        id: 'del_primary',
        purchaseOrderNumber: 'PO-1001',
        carrierName: 'FedEx Freight',
        dockId: 'dock_bay_01',
        dockNumber: 'BAY-01',
        windowStart: new Date('2026-10-24T10:00:00Z'),
        windowEnd: new Date('2026-10-24T11:00:00Z'),
        status: 'SCHEDULED',
      },
      {
        id: 'del_secondary',
        purchaseOrderNumber: 'PO-1002',
        carrierName: 'J.B. Hunt',
        dockId: 'dock_bay_01',
        dockNumber: 'BAY-01',
        windowStart: new Date('2026-10-24T10:45:00Z'),
        windowEnd: new Date('2026-10-24T12:00:00Z'),
        status: 'SCHEDULED',
      },
    ];

    const event: NormalizedRingEvent = {
      requestId: 'req_overlap',
      deviceId: 'ava1.ring.device.dock1',
      eventType: 'motion',
      subType: 'vehicle',
      hasSmartAlertClassification: true,
      startedAt: new Date('2026-10-24T10:50:00Z'), // In window of both!
      rawPayload: {},
      provenance: { source: 'RING_PARTNER_WEBHOOK', receivedAt: new Date(), verifiedSignature: true },
    };

    const matches = matchingEngine.evaluateCandidates(event, baseCameraDock, overlappingDeliveries);

    expect(matches).toHaveLength(2);
    expect(matches[0].confidenceScore).toBeGreaterThanOrEqual(0.8);
    expect(matches[1].confidenceScore).toBeGreaterThanOrEqual(0.8);
  });

  it('bounds confidence score when only generic motion is available (never identifies truck from generic motion alone)', () => {
    const genericMotionEvent: NormalizedRingEvent = {
      requestId: 'req_generic',
      deviceId: 'ava1.ring.device.dock1',
      eventType: 'motion',
      subType: 'motion', // Generic motion without vehicle smart alert
      hasSmartAlertClassification: false,
      startedAt: new Date('2026-10-24T10:30:00Z'),
      rawPayload: {},
      provenance: { source: 'RING_PARTNER_WEBHOOK', receivedAt: new Date(), verifiedSignature: true },
    };

    const matches = matchingEngine.evaluateCandidates(genericMotionEvent, baseCameraDock, scheduledDeliveries);

    const topMatch = matches[0];
    // Generic motion contribution is only 0.08, so score is significantly lower
    expect(topMatch.confidenceScore).toBeLessThan(0.85);
    expect(topMatch.evidence.classificationMatch.isVehicle).toBe(false);
  });

  it('handles delayed events within grace window with reduced time contribution', () => {
    const delayedEvent: NormalizedRingEvent = {
      requestId: 'req_delayed',
      deviceId: 'ava1.ring.device.dock1',
      eventType: 'motion',
      subType: 'vehicle',
      hasSmartAlertClassification: true,
      startedAt: new Date('2026-10-24T12:20:00Z'), // 20 minutes after PO-1001 window ended (12:00)
      rawPayload: {},
      provenance: { source: 'RING_PARTNER_WEBHOOK', receivedAt: new Date(), verifiedSignature: true },
    };

    const matches = matchingEngine.evaluateCandidates(delayedEvent, baseCameraDock, scheduledDeliveries);
    const topMatch = matches[0];

    expect(topMatch.deliveryId).toBe('del_01');
    expect(topMatch.evidence.timeWindowMatch.deviationMinutes).toBe(20);
    // Reduced time contribution applied (0.895 rounds to 0.90)
    expect(topMatch.confidenceScore).toBeLessThanOrEqual(0.9);
    expect(topMatch.confidenceScore).toBeGreaterThan(0.7);
  });
});
