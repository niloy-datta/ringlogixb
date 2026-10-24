/**
 * Ring Partner API & Webhook Specifications
 * Based on official Amazon Vision API: https://api.amazonvision.com
 */

export type RingClassification = 'human' | 'vehicle' | 'package_delivery' | 'other_motion' | 'motion';

export interface RingDevice {
  id: string; // e.g. "ava1.ring.device.dock1"
  name: string;
  kind?: string;
  device_type?: string;
  firmware_version?: string;
  battery_life?: number | string;
  created_at?: string;
}

export interface RingDeviceStatus {
  device_id: string;
  online: boolean;
  battery_level?: number;
  ac_power?: boolean;
  cellular_backup?: boolean;
  last_updated?: string;
}

export interface RingDeviceCapabilities {
  device_id: string;
  video_codecs: string[];
  smart_alerts: {
    supported: boolean;
    classifications: RingClassification[];
  };
  night_vision: boolean;
  two_way_audio: boolean;
  snapshot_interval_seconds?: number;
}

export interface RingWebhookMeta {
  request_id: string; // Unique GUID for deduplication
  timestamp: string;  // ISO UTC timestamp
  account_id?: string;
}

export interface RingWebhookPayload {
  meta: RingWebhookMeta;
  event_type: 'motion' | 'device_status_changed' | 'doorbell_press' | 'live_view';
  device_id: string;
  data: {
    event_id?: string;
    sub_type?: RingClassification;
    confidence?: number;
    detection_box?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    snapshot_url?: string;
    started_at: string;
    ended_at?: string;
    online?: boolean;
    raw_status?: Record<string, unknown>;
  };
}

export interface NormalizedRingEvent {
  requestId: string;
  deviceId: string;
  eventType: string;
  subType: RingClassification;
  hasSmartAlertClassification: boolean;
  startedAt: Date;
  endedAt?: Date;
  snapshotUrl?: string;
  rawPayload: Record<string, unknown>;
  provenance: {
    source: 'RING_PARTNER_WEBHOOK' | 'RING_SIMULATOR' | 'LOCAL_SYNTHETIC_FIXTURE';
    receivedAt: Date;
    verifiedSignature: boolean;
  };
}
