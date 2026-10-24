import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyRingWebhookSignature } from '@/lib/crypto';
import { normalizeRingWebhookEvent } from './event-normalizer';
import { RingWebhookPayload } from '@/types/ring';
import { jobQueue } from '../workflow/job-queue';
import { realtimeBroker } from '@/lib/sse';
import { ExceptionType, ExceptionSeverity } from '@prisma/client';

export interface WebhookProcessingResult {
  statusCode: number;
  body: {
    status: 'acknowledged' | 'duplicate_ignored' | 'invalid_signature' | 'error';
    requestId?: string;
    message?: string;
  };
}

export class RingWebhookHandler {
  private secret: string;

  constructor(secret?: string) {
    this.secret = secret || process.env.RING_WEBHOOK_SECRET || 'whsec_dockflow_production_grade_hmac_secret_2026';
  }

  /**
   * Fast entrypoint for incoming Ring webhooks.
   * Guarantees response within Ring's required 5-second SLA.
   */
  async handleWebhook(
    rawBody: Buffer | string,
    signatureHeader: string | null | undefined,
    orgId: string = 'org_main_warehouse_01'
  ): Promise<WebhookProcessingResult> {
    const startTime = Date.now();

    // 1. Validate signature against raw request bytes
    const isValidSignature = verifyRingWebhookSignature(rawBody, signatureHeader, this.secret);
    if (!isValidSignature) {
      logger.warn('Rejected Ring webhook: Invalid HMAC signature', { orgId });
      return {
        statusCode: 401,
        body: {
          status: 'invalid_signature',
          message: 'HMAC signature verification failed for X-Signature header',
        },
      };
    }

    // 2. Parse payload
    let payload: RingWebhookPayload;
    try {
      const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
      payload = JSON.parse(bodyStr);
    } catch (parseErr) {
      logger.error('Failed to parse Ring webhook JSON', parseErr);
      return {
        statusCode: 400,
        body: {
          status: 'error',
          message: 'Malformed JSON payload',
        },
      };
    }

    const requestId = payload.meta?.request_id;
    if (!requestId) {
      return {
        statusCode: 400,
        body: {
          status: 'error',
          message: 'Missing meta.request_id',
        },
      };
    }

    // 3. Deduplication check via meta.request_id
    const existingEvent = await prisma.ringEvent.findUnique({
      where: { requestId },
    });

    if (existingEvent) {
      logger.info('Duplicate Ring webhook received; acknowledging idempotently', { requestId });
      return {
        statusCode: 200,
        body: {
          status: 'duplicate_ignored',
          requestId,
        },
      };
    }

    // 4. Normalize the event
    const normalized = normalizeRingWebhookEvent(payload, 'RING_PARTNER_WEBHOOK', true);

    // 5. Ensure camera connection exists or resolve facility
    let camera = await prisma.ringCameraConnection.findUnique({
      where: {
        orgId_deviceId: {
          orgId,
          deviceId: normalized.deviceId,
        },
      },
    });

    // Auto-register discovered camera in default facility if not yet mapped
    if (!camera) {
      const defaultFacility = await prisma.facility.findFirst({
        where: { orgId },
      });

      if (defaultFacility) {
        camera = await prisma.ringCameraConnection.create({
          data: {
            orgId,
            facilityId: defaultFacility.id,
            deviceId: normalized.deviceId,
            deviceName: `Camera ${normalized.deviceId.slice(-6)}`,
            isOnline: true,
            lastSeenAt: new Date(),
          },
        });
      }
    }

    const facilityId = camera?.facilityId || (await prisma.facility.findFirst({ where: { orgId } }))?.id || 'fac_default';

    // 6. Persist event durably
    const persistedEvent = await prisma.ringEvent.create({
      data: {
        orgId,
        facilityId,
        cameraId: camera?.id || 'cam_unmapped',
        requestId: normalized.requestId,
        eventType: normalized.eventType,
        subType: normalized.subType,
        startedAt: normalized.startedAt,
        endedAt: normalized.endedAt,
        snapshotUrl: normalized.snapshotUrl,
        rawPayload: normalized.rawPayload as any,
        isProcessed: false,
      },
    });

    // 7. Handle device status change events directly
    if (payload.event_type === 'device_status_changed' && camera) {
      const isOnline = payload.data?.online !== false;
      await prisma.ringCameraConnection.update({
        where: { id: camera.id },
        data: {
          isOnline,
          lastSeenAt: new Date(),
        },
      });

      if (!isOnline) {
        // Trigger automated CAMERA_OFFLINE exception
        await prisma.operationalException.create({
          data: {
            orgId,
            facilityId,
            exceptionType: ExceptionType.CAMERA_OFFLINE,
            severity: ExceptionSeverity.HIGH,
            title: `Camera Offline: ${camera.deviceName}`,
            details: `Ring device ${camera.deviceId} reported offline status at ${new Date().toISOString()}`,
          },
        });
      }
    }

    // 8. Enqueue background correlation job for asynchronous processing
    await jobQueue.enqueue(orgId, 'CORRELATE_EVENT', {
      ringEventId: persistedEvent.id,
      cameraId: camera?.id,
      deviceId: normalized.deviceId,
      facilityId,
      subType: normalized.subType,
      startedAt: normalized.startedAt.toISOString(),
    });

    // 9. Broadcast live event to connected web clients
    realtimeBroker.broadcast({
      id: `evt_ring_${persistedEvent.id}`,
      type: 'RING_EVENT_RECEIVED',
      orgId,
      data: {
        eventId: persistedEvent.id,
        deviceId: normalized.deviceId,
        subType: normalized.subType,
        startedAt: normalized.startedAt.toISOString(),
      },
      timestamp: new Date().toISOString(),
    });

    const elapsedMs = Date.now() - startTime;
    logger.info('Ring webhook successfully ingested & acknowledged', {
      requestId,
      elapsedMs,
      subType: normalized.subType,
    });

    // Return 200 OK within 5-second window
    return {
      statusCode: 200,
      body: {
        status: 'acknowledged',
        requestId,
      },
    };
  }
}

export const ringWebhookHandler = new RingWebhookHandler();
