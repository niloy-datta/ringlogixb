import {
  RingWebhookPayload,
  RingJsonApiEventPayload,
  RingLegacyWebhookPayload,
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
  payload: RingWebhookPayload | any,
  provenanceSource: 'RING_PARTNER_WEBHOOK' | 'RING_SIMULATOR' | 'LOCAL_SYNTHETIC_FIXTURE',
  verifiedSignature: boolean = true
): NormalizedRingEvent {
  // 1. Check if official JSON:API structure (data.type === 'events' with attributes)
  if (payload?.data && payload.data.type === 'events' && payload.data.attributes) {
    const jsonApi = payload as RingJsonApiEventPayload;
    const attrs = jsonApi.data.attributes;
    const id = jsonApi.data.id || jsonApi.meta?.request_id;

    if (!id) {
      throw new Error('Normalization Error: Missing event ID or meta.request_id in JSON:API payload');
    }

    const deviceId =
      attrs.source ||
      jsonApi.data.relationships?.device?.data?.id;

    if (!deviceId) {
      throw new Error('Normalization Error: Missing source device ID in JSON:API attributes or relationships');
    }

    // Determine normalized event type
    let normalizedEventType = 'motion';
    if (attrs.event_type === 'device_offline' || attrs.event_type === 'device_online') {
      normalizedEventType = 'device_status_changed';
    } else if (attrs.event_type === 'motion_detected') {
      normalizedEventType = 'motion';
    } else {
      normalizedEventType = attrs.event_type;
    }

    // Extract Smart Alerts sub_type
    let classification: RingClassification = 'motion';
    let hasSmartAlert = false;

    if (attrs.sub_type && VALID_CLASSIFICATIONS.has(attrs.sub_type as RingClassification)) {
      classification = attrs.sub_type as RingClassification;
      hasSmartAlert = true;
    } else if (attrs.sub_type) {
      // Future or custom Smart Alerts classification: fallback to motion
      classification = 'motion';
      hasSmartAlert = true;
    }

    // Parse timestamp (epoch ms or ISO readable)
    let startedAt: Date;
    if (typeof attrs.timestamp === 'number') {
      startedAt = new Date(attrs.timestamp);
    } else if (attrs.timestamp_readable) {
      startedAt = new Date(attrs.timestamp_readable);
    } else if (attrs.occurred_at) {
      startedAt = new Date(attrs.occurred_at);
    } else {
      startedAt = new Date();
    }

    return {
      requestId: id,
      deviceId,
      eventType: normalizedEventType,
      subType: classification,
      hasSmartAlertClassification: hasSmartAlert,
      startedAt,
      snapshotUrl: attrs.snapshot_url,
      accountId: jsonApi.meta?.account_id,
      rawPayload: payload as unknown as Record<string, unknown>,
      provenance: {
        source: provenanceSource,
        receivedAt: new Date(),
        verifiedSignature,
      },
    };
  }

  // 2. Legacy / Simplified Webhook Structure
  const legacy = payload as RingLegacyWebhookPayload;
  const requestId = legacy.meta?.request_id || (legacy as any)?.request_id;
  const deviceId = legacy.device_id || (legacy as any)?.deviceId;

  if (!requestId) {
    throw new Error('Normalization Error: Missing meta.request_id in webhook payload');
  }

  if (!deviceId) {
    throw new Error('Normalization Error: Missing device_id in webhook payload');
  }

  // Extract classification if present in Smart Alerts sub_type
  let classification: RingClassification = 'motion';
  let hasSmartAlert = false;

  if (legacy.data?.sub_type && VALID_CLASSIFICATIONS.has(legacy.data.sub_type)) {
    classification = legacy.data.sub_type;
    hasSmartAlert = true;
  } else if (legacy.event_type === 'motion' || legacy.event_type === 'motion_detected') {
    classification = 'motion';
    hasSmartAlert = false;
  }

  const startedAt = legacy.data?.started_at
    ? new Date(legacy.data.started_at)
    : legacy.meta?.timestamp
    ? new Date(legacy.meta.timestamp)
    : new Date();

  const endedAt = legacy.data?.ended_at ? new Date(legacy.data.ended_at) : undefined;

  return {
    requestId,
    deviceId,
    eventType: legacy.event_type === 'motion_detected' ? 'motion' : legacy.event_type || 'motion',
    subType: classification,
    hasSmartAlertClassification: hasSmartAlert,
    startedAt,
    endedAt,
    snapshotUrl: legacy.data?.snapshot_url,
    accountId: legacy.meta?.account_id,
    rawPayload: payload as unknown as Record<string, unknown>,
    provenance: {
      source: provenanceSource,
      receivedAt: new Date(),
      verifiedSignature,
    },
  };
}
