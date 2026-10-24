import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { matchingEngine } from '../correlation/matching-engine';
import { stateMachine } from '../workflow/state-machine';
import { dockService } from './dock-service';
import { realtimeBroker } from '@/lib/sse';
import {
  ReceivingStatus,
  CorrelationStatus,
  ExceptionType,
  ExceptionSeverity,
} from '@prisma/client';
import { NormalizedRingEvent } from '@/types/ring';

export interface CorrelateJobPayload {
  ringEventId: string;
  cameraId?: string;
  deviceId: string;
  facilityId: string;
  subType: string;
  startedAt: string;
}

export class CorrelationService {
  /**
   * Processes a newly arrived Ring event against scheduled deliveries.
   */
  async processEventCorrelation(payload: CorrelateJobPayload, orgId: string) {
    logger.info('Processing Ring event correlation', { payload, orgId });

    const ringEvent = await prisma.ringEvent.findUnique({
      where: { id: payload.ringEventId },
    });

    if (!ringEvent) {
      logger.error('RingEvent not found for correlation', null, { ringEventId: payload.ringEventId });
      return;
    }

    // 1. Resolve dock mapped to camera
    const cameraDock = payload.cameraId
      ? await dockService.getDockForCamera(payload.cameraId, orgId)
      : null;

    // 2. Query candidate deliveries in this facility around the event time window (+/- 3 hours)
    const eventTime = new Date(payload.startedAt);
    const windowStartBoundary = new Date(eventTime.getTime() - 3 * 60 * 60 * 1000);
    const windowEndBoundary = new Date(eventTime.getTime() + 3 * 60 * 60 * 1000);

    const candidateDeliveries = await prisma.expectedDelivery.findMany({
      where: {
        orgId,
        facilityId: payload.facilityId,
        status: { in: [ReceivingStatus.SCHEDULED, ReceivingStatus.ARRIVAL_DETECTED, ReceivingStatus.MATCH_PENDING] },
        expectedArrivalWindowStart: { lte: windowEndBoundary },
        expectedArrivalWindowEnd: { gte: windowStartBoundary },
      },
      include: {
        carrier: true,
        dock: true,
      },
    });

    // 3. Prepare normalized event structure for matching engine
    const normalized: NormalizedRingEvent = {
      requestId: ringEvent.requestId,
      deviceId: payload.deviceId,
      eventType: ringEvent.eventType,
      subType: (ringEvent.subType as any) || 'motion',
      hasSmartAlertClassification: Boolean(ringEvent.subType && ringEvent.subType !== 'motion'),
      startedAt: ringEvent.startedAt,
      endedAt: ringEvent.endedAt || undefined,
      snapshotUrl: ringEvent.snapshotUrl || undefined,
      rawPayload: ringEvent.rawPayload as any,
      provenance: {
        source: 'RING_PARTNER_WEBHOOK',
        receivedAt: ringEvent.createdAt,
        verifiedSignature: true,
      },
    };

    // 4. Run deterministic matching engine
    const candidates = matchingEngine.evaluateCandidates(
      normalized,
      cameraDock,
      candidateDeliveries.map((d) => ({
        id: d.id,
        purchaseOrderNumber: d.purchaseOrderNumber,
        carrierName: d.carrier?.name || 'Unknown Carrier',
        dockId: d.dockId,
        dockNumber: d.dock?.dockNumber,
        windowStart: d.expectedArrivalWindowStart,
        windowEnd: d.expectedArrivalWindowEnd,
        status: d.status,
      }))
    );

    // 5. Evaluate matching outcomes
    if (candidates.length === 0) {
      // No scheduled delivery matches this event
      if (normalized.subType === 'vehicle') {
        // Unscheduled vehicle arrival at dock
        const dockLabel = cameraDock ? `Dock ${cameraDock.dockNumber}` : 'unassigned dock';
        logger.warn('Detected unscheduled vehicle arrival', {
          deviceId: payload.deviceId,
          dockNumber: cameraDock?.dockNumber,
        });

        await prisma.operationalException.create({
          data: {
            orgId,
            facilityId: payload.facilityId,
            dockId: cameraDock?.dockId,
            exceptionType: ExceptionType.UNSCHEDULED_VEHICLE,
            severity: ExceptionSeverity.MEDIUM,
            title: `Unscheduled Vehicle at ${dockLabel}`,
            details: `Vehicle detected by camera ${payload.deviceId} at ${eventTime.toLocaleTimeString()} with no matching scheduled appointment.`,
          },
        });

        realtimeBroker.broadcast({
          id: `evt_exc_${Date.now()}`,
          type: 'EXCEPTION_DETECTED',
          orgId,
          data: {
            type: ExceptionType.UNSCHEDULED_VEHICLE,
            dockNumber: cameraDock?.dockNumber,
            timestamp: eventTime.toISOString(),
          },
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      const topMatch = candidates[0];

      // Store correlation records
      for (const candidate of candidates.slice(0, 3)) {
        await prisma.eventCorrelation.upsert({
          where: {
            ringEventId_expectedDeliveryId: {
              ringEventId: ringEvent.id,
              expectedDeliveryId: candidate.deliveryId,
            },
          },
          create: {
            orgId,
            ringEventId: ringEvent.id,
            expectedDeliveryId: candidate.deliveryId,
            confidenceScore: candidate.confidenceScore,
            matchReasoning: candidate.evidence as any,
            status: CorrelationStatus.PROPOSED,
          },
          update: {
            confidenceScore: candidate.confidenceScore,
            matchReasoning: candidate.evidence as any,
          },
        });
      }

      // Check if multiple candidates have close scores (e.g. difference <= 0.15)
      const hasCloseCompetitor =
        candidates.length > 1 &&
        candidates[1].confidenceScore >= 0.6 &&
        topMatch.confidenceScore - candidates[1].confidenceScore <= 0.15;

      if (hasCloseCompetitor) {
        logger.info('Multiple competing delivery matches detected; requiring operator review', {
          topCandidate: topMatch.deliveryId,
          secondCandidate: candidates[1].deliveryId,
        });

        await stateMachine.transitionDelivery({
          deliveryId: topMatch.deliveryId,
          targetStatus: ReceivingStatus.MATCH_PENDING,
          notes: 'Multiple delivery appointments match arrival window; operator confirmation required.',
        });
      } else if (topMatch.confidenceScore >= 0.7) {
        // High confidence match
        await stateMachine.transitionDelivery({
          deliveryId: topMatch.deliveryId,
          targetStatus: ReceivingStatus.ARRIVAL_DETECTED,
          notes: `Vehicle motion confirmed via Ring camera at ${topMatch.dockNumber} (Confidence: ${(topMatch.confidenceScore * 100).toFixed(0)}%).`,
        });

        // Link snapshot evidence if available
        if (ringEvent.snapshotUrl) {
          await prisma.evidenceReference.create({
            data: {
              orgId,
              expectedDeliveryId: topMatch.deliveryId,
              ringEventId: ringEvent.id,
              evidenceType: 'RING_SNAPSHOT',
              storagePath: ringEvent.snapshotUrl,
              sha256Checksum: 'simulated_checksum_' + ringEvent.id.slice(0, 8),
              metadata: {
                dockNumber: topMatch.dockNumber,
                confidenceScore: topMatch.confidenceScore,
              },
            },
          });
        }
      }

      realtimeBroker.broadcast({
        id: `evt_corr_${ringEvent.id}`,
        type: 'CORRELATION_COMPLETED',
        orgId,
        data: {
          ringEventId: ringEvent.id,
          topMatch,
          candidateCount: candidates.length,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Mark Ring event as processed
    await prisma.ringEvent.update({
      where: { id: ringEvent.id },
      data: { isProcessed: true },
    });
  }
}

export const correlationService = new CorrelationService();
