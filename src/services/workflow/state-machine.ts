import { ReceivingStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { realtimeBroker } from '@/lib/sse';

export const VALID_TRANSITIONS: Record<ReceivingStatus, ReceivingStatus[]> = {
  SCHEDULED: [ReceivingStatus.ARRIVAL_DETECTED, ReceivingStatus.CANCELLED],
  ARRIVAL_DETECTED: [ReceivingStatus.MATCH_PENDING, ReceivingStatus.ARRIVED, ReceivingStatus.REVIEW_REQUIRED, ReceivingStatus.CANCELLED],
  MATCH_PENDING: [ReceivingStatus.ARRIVED, ReceivingStatus.REVIEW_REQUIRED, ReceivingStatus.CANCELLED],
  ARRIVED: [ReceivingStatus.RECEIVING, ReceivingStatus.REVIEW_REQUIRED, ReceivingStatus.CANCELLED],
  RECEIVING: [ReceivingStatus.RECEIVED, ReceivingStatus.REVIEW_REQUIRED, ReceivingStatus.CANCELLED],
  REVIEW_REQUIRED: [ReceivingStatus.ARRIVED, ReceivingStatus.RECEIVING, ReceivingStatus.RECEIVED, ReceivingStatus.CANCELLED],
  RECEIVED: [ReceivingStatus.CLOSED],
  CLOSED: [],
  CANCELLED: [],
};

export class ReceivingStateMachine {
  /**
   * Checks if a transition between two statuses is permitted.
   */
  canTransition(currentStatus: ReceivingStatus, targetStatus: ReceivingStatus): boolean {
    if (currentStatus === targetStatus) return true; // Idempotent no-op
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    return allowed.includes(targetStatus);
  }

  /**
   * Performs an atomic transition on an ExpectedDelivery with validation and audit trail.
   */
  async transitionDelivery(params: {
    deliveryId: string;
    targetStatus: ReceivingStatus;
    actorUserId?: string;
    isManualOverride?: boolean;
    overrideReason?: string;
    notes?: string;
  }): Promise<{ success: boolean; previousStatus: ReceivingStatus; currentStatus: ReceivingStatus; error?: string }> {
    const { deliveryId, targetStatus, actorUserId, isManualOverride, overrideReason, notes } = params;

    const delivery = await prisma.expectedDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      return {
        success: false,
        previousStatus: ReceivingStatus.SCHEDULED,
        currentStatus: targetStatus,
        error: `Delivery not found with ID: ${deliveryId}`,
      };
    }

    const previousStatus = delivery.status;

    // Check idempotency: If already in target status, return success cleanly
    if (previousStatus === targetStatus) {
      return { success: true, previousStatus, currentStatus: targetStatus };
    }

    // Validate transition legality
    if (!isManualOverride && !this.canTransition(previousStatus, targetStatus)) {
      const errorMsg = `Invalid state transition from ${previousStatus} to ${targetStatus}`;
      logger.warn(errorMsg, { deliveryId, actorUserId });
      return { success: false, previousStatus, currentStatus: previousStatus, error: errorMsg };
    }

    // Manual overrides require an explicit justification
    if (isManualOverride && !overrideReason) {
      return {
        success: false,
        previousStatus,
        currentStatus: previousStatus,
        error: 'Manual state transition overrides require an explicit justification reason.',
      };
    }

    // Atomic database update with audit log
    const updated = await prisma.$transaction(async (tx) => {
      const updateData: any = {
        status: targetStatus,
        notes: notes ? (delivery.notes ? `${delivery.notes}\n${notes}` : notes) : delivery.notes,
      };

      if (targetStatus === ReceivingStatus.ARRIVED && !delivery.actualArrivalTime) {
        updateData.actualArrivalTime = new Date();
      }
      if (targetStatus === ReceivingStatus.RECEIVED || targetStatus === ReceivingStatus.CLOSED) {
        updateData.completedAt = new Date();
      }

      const res = await tx.expectedDelivery.update({
        where: { id: deliveryId },
        data: updateData,
      });

      // Write audit log
      await tx.auditLog.create({
        data: {
          orgId: delivery.orgId,
          userId: actorUserId,
          action: isManualOverride ? 'STATE_TRANSITION_OVERRIDE' : 'STATE_TRANSITION',
          entityType: 'ExpectedDelivery',
          entityId: deliveryId,
          previousState: { status: previousStatus },
          newState: {
            status: targetStatus,
            isManualOverride: Boolean(isManualOverride),
            overrideReason: overrideReason || null,
          },
        },
      });

      return res;
    });

    // Broadcast update via Server-Sent Events
    realtimeBroker.broadcast({
      id: `evt_status_${Date.now()}`,
      type: 'DELIVERY_STATUS_CHANGED',
      orgId: delivery.orgId,
      data: {
        deliveryId,
        previousStatus,
        newStatus: targetStatus,
        purchaseOrderNumber: delivery.purchaseOrderNumber,
      },
      timestamp: new Date().toISOString(),
    });

    logger.info('Delivery state transitioned', {
      deliveryId,
      from: previousStatus,
      to: targetStatus,
      isManualOverride,
    });

    return { success: true, previousStatus, currentStatus: updated.status };
  }
}

export const stateMachine = new ReceivingStateMachine();
