import crypto from 'crypto';
import {
  RingWebhookPayload,
  RingJsonApiEventPayload,
  RingLegacyWebhookPayload,
  RingClassification,
} from '@/types/ring';
import { computeRingHmac } from '@/lib/crypto';

export interface SimulationOptions {
  deviceId?: string;
  subType?: RingClassification;
  timestamp?: Date;
  snapshotUrl?: string;
  isOnline?: boolean;
  format?: 'json_api' | 'legacy';
}

export class RingSimulator {
  /**
   * Generates an official Ring Partner JSON:API compliant webhook event payload.
   * Based on Amazon Vision / Ring Developer documentation:
   * https://developer.amazon.com/docs/ring/api-documentation.html
   */
  generateOfficialJsonApiPayload(options?: SimulationOptions): RingJsonApiEventPayload {
    const date = options?.timestamp || new Date();
    const eventId = `evt_${crypto.randomBytes(8).toString('hex')}`;
    const requestId = `sim_req_${crypto.randomUUID()}`;
    const deviceId = options?.deviceId || 'ava1.ring.device.dock1';
    const subType = options?.subType !== undefined ? options.subType : 'vehicle';

    return {
      data: {
        type: 'events',
        id: eventId,
        attributes: {
          event_type: 'motion_detected',
          sub_type: subType,
          source: deviceId,
          source_type: 'devices',
          timestamp: date.getTime(),
          timestamp_readable: date.toISOString(),
          snapshot_url:
            options?.snapshotUrl ||
            `https://snapshots.dockflow.internal/ring/${deviceId}/${Date.now()}.jpg`,
          component_ids: ['cam_module_0'],
        },
        relationships: {
          device: { data: { type: 'devices', id: deviceId } },
        },
      },
      meta: {
        request_id: requestId,
        account_id: 'ring_playground_simulated_account',
      },
    };
  }

  /**
   * Generates an official Ring Partner JSON:API device status event (device_online / device_offline).
   */
  generateOfficialJsonApiStatusPayload(
    deviceId: string,
    isOnline: boolean,
    options?: { timestamp?: Date }
  ): RingJsonApiEventPayload {
    const date = options?.timestamp || new Date();
    const eventId = `evt_status_${crypto.randomBytes(8).toString('hex')}`;
    const requestId = `sim_status_${crypto.randomUUID()}`;

    return {
      data: {
        type: 'events',
        id: eventId,
        attributes: {
          event_type: isOnline ? 'device_online' : 'device_offline',
          source: deviceId,
          source_type: 'devices',
          timestamp: date.getTime(),
          timestamp_readable: date.toISOString(),
          component_ids: ['cam_module_0'],
        },
        relationships: {
          device: { data: { type: 'devices', id: deviceId } },
        },
      },
      meta: {
        request_id: requestId,
        account_id: 'ring_playground_simulated_account',
      },
    };
  }

  /**
   * Generates a realistic Ring webhook event payload.
   * If options.format === 'json_api', generates the official Amazon Ring JSON:API payload.
   * Defaults to official format while retaining legacy payload adapter compatibility.
   */
  generateSimulatedPayload(options: SimulationOptions & { format: 'json_api' }): RingJsonApiEventPayload;
  generateSimulatedPayload(options?: SimulationOptions & { format?: 'legacy' }): RingLegacyWebhookPayload;
  generateSimulatedPayload(options?: SimulationOptions): RingWebhookPayload;
  generateSimulatedPayload(options?: SimulationOptions): RingWebhookPayload {
    const timestamp = (options?.timestamp || new Date()).toISOString();
    const requestId = `sim_req_${crypto.randomUUID()}`;
    const deviceId = options?.deviceId || 'ava1.ring.device.dock1';
    const subType = options?.subType !== undefined ? options.subType : 'vehicle';

    if (options?.format === 'json_api') {
      return this.generateOfficialJsonApiPayload(options);
    }

    // Default: Return legacy envelope with full fields for existing test suite compatibility
    return {
      meta: {
        request_id: requestId,
        timestamp,
        account_id: 'ring_playground_simulated_account',
      },
      event_type: 'motion',
      device_id: deviceId,
      data: {
        event_id: `evt_${crypto.randomBytes(8).toString('hex')}`,
        sub_type: subType,
        confidence: subType === 'vehicle' ? 0.94 : 0.88,
        started_at: timestamp,
        snapshot_url:
          options?.snapshotUrl ||
          `https://snapshots.dockflow.internal/ring/${deviceId}/${Date.now()}.jpg`,
      },
    };
  }

  /**
   * Generates a device status change payload (e.g. camera going offline or coming online).
   */
  generateDeviceStatusPayload(deviceId: string, isOnline: boolean, format: 'json_api'): RingJsonApiEventPayload;
  generateDeviceStatusPayload(deviceId: string, isOnline: boolean, format?: 'legacy'): RingLegacyWebhookPayload;
  generateDeviceStatusPayload(deviceId: string, isOnline: boolean, format?: 'json_api' | 'legacy'): RingWebhookPayload;
  generateDeviceStatusPayload(
    deviceId: string,
    isOnline: boolean,
    format: 'json_api' | 'legacy' = 'legacy'
  ): RingWebhookPayload {
    if (format === 'json_api') {
      return this.generateOfficialJsonApiStatusPayload(deviceId, isOnline);
    }

    const timestamp = new Date().toISOString();
    const requestId = `sim_status_${crypto.randomUUID()}`;

    return {
      meta: {
        request_id: requestId,
        timestamp,
        account_id: 'ring_playground_simulated_account',
      },
      event_type: 'device_status_changed',
      device_id: deviceId,
      data: {
        online: isOnline,
        started_at: timestamp,
      },
    };
  }

  /**
   * Signs a payload with the HMAC-SHA256 secret key for realistic integration testing.
   */
  signPayload(payload: RingWebhookPayload, secret: string): { rawBody: string; signatureHeader: string } {
    const rawBody = JSON.stringify(payload);
    const signature = computeRingHmac(rawBody, secret);
    return {
      rawBody,
      signatureHeader: signature,
    };
  }
}

export const ringSimulator = new RingSimulator();
