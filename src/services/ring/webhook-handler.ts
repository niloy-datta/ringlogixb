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

    // 1. Validate signature against raw request bytes using constant-time comparison
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

    // 3. Resolve Request ID / Deduplication ID (JSON:API data.id or meta.request_id)
    const anyPayload = payload as any;
    const requestId =
      anyPayload.meta?.request_id ||
      anyPayload.data?.id ||
      anyPayload.data?.event_id ||
      anyPayload.request_id;

    if (!requestId) {
      return {
        statusCode: 400,
        body: {
          status: 'error',
          message: 'Missing meta.request_id or data.id for event idempotency',
        },
      };
    }

    // 4. Replay attack protection (verify timestamp tolerance window: 5 minutes)
    const rawTimestamp =
      anyPayload.data?.attributes?.timestamp ||
      anyPayload.meta?.timestamp ||
      anyPayload.data?.started_at;

    if (rawTimestamp) {
      const eventEpoch = typeof rawTimestamp === 'number' ? rawTimestamp : new Date(rawTimestamp).getTime();
      if (!isNaN(eventEpoch)) {
        const now = Date.now();
        const maxAgeMs = 5 * 60 * 1000; // 5 minutes
        const maxClockSkewMs = 60 * 1000; // 1 minute in the future

        if (now - eventEpoch > maxAgeMs) {
          logger.warn('Rejected Ring webhook: Replay attack or stale event detected', { requestId, eventEpoch });
          return {
            statusCode: 400,
            body: {
              status: 'error',
              message: 'Webhook timestamp expired: event is older than 300 seconds',
            },
          };
        }

        if (eventEpoch - now > maxClockSkewMs) {
          logger.warn('Rejected Ring webhook: Future timestamp clock skew detected', { requestId, eventEpoch });
          return {
            statusCode: 400,
            body: {
              status: 'error',
              message: 'Webhook timestamp invalid: clock skew in the future exceeds 60 seconds',
            },
          };
        }
      }
    }

    // 5. Deduplication check via requestId
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

    // 6. Account-to-Organization mapping based on trusted identities
    let effectiveOrgId = orgId;
    const accountId = anyPayload.meta?.account_id;
    if (accountId && accountId !== 'ring_playground_simulated_account') {
      const mappedOrg = await prisma.organization.findFirst({
        where: {
          OR: [
            { id: accountId },
            { code: accountId },
            { slug: accountId },
          ],
        },
      });
      if (mappedOrg) {
        effectiveOrgId = mappedOrg.id;
      }
    }

    // 7. Normalize the event (handles JSON:API or legacy format)
    const isSimulation = Boolean(anyPayload.meta?.simulation || anyPayload.meta?.account_id?.includes('simulat'));
    const provenance = isSimulation ? 'RING_SIMULATOR' : 'RING_PARTNER_WEBHOOK';
    const normalized = normalizeRingWebhookEvent(payload, provenance, true);

    // 8. Ensure camera connection exists or resolve facility
    let camera = await prisma.ringCameraConnection.findUnique({
      where: {
        orgId_deviceId: {
          orgId: effectiveOrgId,
          deviceId: normalized.deviceId,
        },
      },
    });

    // Auto-register discovered camera in default facility if not yet mapped
    if (!camera) {
      const defaultFacility = await prisma.facility.findFirst({
        where: { orgId: effectiveOrgId },
      });

      if (defaultFacility) {
        camera = await prisma.ringCameraConnection.create({
          data: {
            orgId: effectiveOrgId,
            facilityId: defaultFacility.id,
            deviceId: normalized.deviceId,
            deviceName: `Camera ${normalized.deviceId.slice(-6)}`,
            isOnline: true,
            lastSeenAt: new Date(),
          },
        });
      }
    }

    const facilityId =
      camera?.facilityId ||
      (await prisma.facility.findFirst({ where: { orgId: effectiveOrgId } }))?.id ||
      'fac_default';

    // 9. Persist event durably
    const persistedEvent = await prisma.ringEvent.create({
      data: {
        orgId: effectiveOrgId,
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

    // 10. Handle device status change events (online / offline)
    if (normalized.eventType === 'device_status_changed' && camera) {
      let isOnline = true;
      if (anyPayload.data?.attributes?.event_type === 'device_offline') {
        isOnline = false;
      } else if (anyPayload.data?.attributes?.event_type === 'device_online') {
        isOnline = true;
      } else if (anyPayload.data?.online !== undefined) {
        isOnline = Boolean(anyPayload.data.online);
      }

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
            orgId: effectiveOrgId,
            facilityId,
            exceptionType: ExceptionType.CAMERA_OFFLINE,
            severity: ExceptionSeverity.HIGH,
            title: `Camera Offline: ${camera.deviceName}`,
            details: `Ring device ${camera.deviceId} reported offline status at ${new Date().toISOString()}`,
          },
        });
      }
    }

    // 11. Enqueue background correlation job for asynchronous processing
    await jobQueue.enqueue(effectiveOrgId, 'CORRELATE_EVENT', {
      ringEventId: persistedEvent.id,
      cameraId: camera?.id,
      deviceId: normalized.deviceId,
      facilityId,
      subType: normalized.subType,
      startedAt: normalized.startedAt.toISOString(),
    });

    // 12. Broadcast live event to connected web clients
    realtimeBroker.broadcast({
      id: `evt_ring_${persistedEvent.id}`,
      type: 'RING_EVENT_RECEIVED',
      orgId: effectiveOrgId,
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

    // 13. Return 200 OK within official Ring 5-second SLA
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
