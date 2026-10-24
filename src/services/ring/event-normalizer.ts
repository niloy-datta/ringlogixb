import {
  RingWebhookPayload,
  NormalizedRingEvent,
  RingClassification,
} from '@/types/ring';

const VALID_CLASSIFICATIONS: Set<RingClassification> = new Set([
  'human',
  'vehicle',
  'package_delivery',
  'other_motion',
  'motion',
]);

export function normalizeRingWebhookEvent(
  payload: RingWebhookPayload,
  provenanceSource: 'RING_PARTNER_WEBHOOK' | 'RING_SIMULATOR' | 'LOCAL_SYNTHETIC_FIXTURE',
  verifiedSignature: boolean = true
): NormalizedRingEvent {
  const { meta, event_type, device_id, data } = payload;

  if (!meta?.request_id) {
    throw new Error('Normalization Error: Missing meta.request_id in webhook payload');
  }

  if (!device_id) {
    throw new Error('Normalization Error: Missing device_id in webhook payload');
  }

  // Extract classification if present in Smart Alerts sub_type
  let classification: RingClassification = 'motion';
  let hasSmartAlert = false;

  if (data?.sub_type && VALID_CLASSIFICATIONS.has(data.sub_type)) {
    classification = data.sub_type;
    hasSmartAlert = true;
  } else if (event_type === 'motion') {
    // Fallback when Smart Alerts is absent or unclassified
    classification = 'motion';
    hasSmartAlert = false;
  }

  // Ensure timestamps are parsed into valid UTC Date objects
  const startedAt = data?.started_at ? new Date(data.started_at) : new Date(meta.timestamp);
  const endedAt = data?.ended_at ? new Date(data.ended_at) : undefined;

  return {
    requestId: meta.request_id,
    deviceId: device_id,
    eventType: event_type,
    subType: classification,
    hasSmartAlertClassification: hasSmartAlert,
    startedAt,
    endedAt,
    snapshotUrl: data?.snapshot_url,
    rawPayload: payload as unknown as Record<string, unknown>,
    provenance: {
      source: provenanceSource,
      receivedAt: new Date(),
      verifiedSignature,
    },
  };
}
