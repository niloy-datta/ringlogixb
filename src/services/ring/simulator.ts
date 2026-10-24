import crypto from 'crypto';
import { RingWebhookPayload, RingClassification } from '@/types/ring';
import { computeRingHmac } from '@/lib/crypto';

export interface SimulationOptions {
  deviceId?: string;
  subType?: RingClassification;
  timestamp?: Date;
  snapshotUrl?: string;
  isOnline?: boolean;
}

export class RingSimulator {
  /**
   * Generates a realistic Ring webhook event payload.
   * Clearly marked as simulated in meta.account_id or provenance.
   */
  generateSimulatedPayload(options?: SimulationOptions): RingWebhookPayload {
    const timestamp = (options?.timestamp || new Date()).toISOString();
    const requestId = `sim_req_${crypto.randomUUID()}`;
    const deviceId = options?.deviceId || 'ava1.ring.device.dock1';
    const subType = options?.subType !== undefined ? options.subType : 'vehicle';

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
  generateDeviceStatusPayload(deviceId: string, isOnline: boolean): RingWebhookPayload {
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
