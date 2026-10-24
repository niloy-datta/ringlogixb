import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { stateMachine } from '../workflow/state-machine';
import { generateTamperProofHash } from '@/lib/crypto';
import { bedrockAnalyzer } from '@/lib/bedrock';
import { realtimeBroker } from '@/lib/sse';
import {
  ReceivingStatus,
  CorrelationStatus,
  DockStatus,
  ExceptionType,
  ExceptionSeverity,
} from '@prisma/client';
import { ProofOfReceipt } from '@/types/domain';

export class ReceivingService {
  /**
   * Confirms, rejects, or overrides an AI/Ring correlation match.
   */
  async handleCorrelationDecision(params: {
    correlationId: string;
    action: 'CONFIRM' | 'REJECT' | 'OVERRIDE';
    actorUserId: string;
    orgId: string;
    assignedDeliveryId?: string;
    notes?: string;
  }) {
    const correlation = await prisma.eventCorrelation.findUnique({
      where: { id: params.correlationId },
      include: { expectedDelivery: true, ringEvent: true },
    });

    if (!correlation) {
      throw new Error(`Correlation record not found: ${params.correlationId}`);
    }

    if (params.action === 'CONFIRM') {
      await prisma.eventCorrelation.update({
        where: { id: params.correlationId },
        data: {
          status: CorrelationStatus.CONFIRMED,
          confirmedByUserId: params.actorUserId,
        },
      });

      // Advance delivery state to ARRIVED
      await stateMachine.transitionDelivery({
        deliveryId: correlation.expectedDeliveryId,
        targetStatus: ReceivingStatus.ARRIVED,
        actorUserId: params.actorUserId,
        notes: params.notes || 'Arrival confirmed by operator verification.',
      });

      // Update dock status to OCCUPIED if dock assigned
      if (correlation.expectedDelivery.dockId) {
        await prisma.dock.update({
          where: { id: correlation.expectedDelivery.dockId },
          data: { status: DockStatus.OCCUPIED },
        });
      }
    } else if (params.action === 'REJECT') {
      await prisma.eventCorrelation.update({
        where: { id: params.correlationId },
        data: {
          status: CorrelationStatus.REJECTED,
          confirmedByUserId: params.actorUserId,
        },
      });

      // If delivery was waiting in MATCH_PENDING or ARRIVAL_DETECTED, reset to SCHEDULED or REVIEW_REQUIRED
      await stateMachine.transitionDelivery({
        deliveryId: correlation.expectedDeliveryId,
        targetStatus: ReceivingStatus.SCHEDULED,
        actorUserId: params.actorUserId,
        notes: `Correlation match rejected by operator: ${params.notes || 'False alarm / incorrect vehicle'}`,
      });
    } else if (params.action === 'OVERRIDE' && params.assignedDeliveryId) {
      await prisma.eventCorrelation.update({
        where: { id: params.correlationId },
        data: {
          status: CorrelationStatus.OVERRIDDEN,
          confirmedByUserId: params.actorUserId,
        },
      });

      // Transition the overridden target delivery to ARRIVED
      await stateMachine.transitionDelivery({
        deliveryId: params.assignedDeliveryId,
        targetStatus: ReceivingStatus.ARRIVED,
        actorUserId: params.actorUserId,
        isManualOverride: true,
        overrideReason: params.notes || 'Operator manual match override.',
      });
    }

    logger.info('Operator correlation decision recorded', {
      correlationId: params.correlationId,
      action: params.action,
      actorUserId: params.actorUserId,
    });
  }

  /**
   * Starts a receiving session at a specified dock bay.
   */
  async startReceivingSession(params: {
    expectedDeliveryId: string;
    dockId: string;
    actorUserId: string;
    orgId: string;
  }) {
    const delivery = await prisma.expectedDelivery.findUnique({
      where: { id: params.expectedDeliveryId },
    });

    if (!delivery) {
      throw new Error(`Delivery not found: ${params.expectedDeliveryId}`);
    }

    // Advance state machine to RECEIVING
    const transition = await stateMachine.transitionDelivery({
      deliveryId: params.expectedDeliveryId,
      targetStatus: ReceivingStatus.RECEIVING,
      actorUserId: params.actorUserId,
      notes: 'Receiving inspection initiated.',
    });

    if (!transition.success) {
      throw new Error(`Cannot start receiving: ${transition.error}`);
    }

    // Create ReceivingSession
    const session = await prisma.receivingSession.create({
      data: {
        orgId: params.orgId,
        expectedDeliveryId: params.expectedDeliveryId,
        dockId: params.dockId,
        startedByUserId: params.actorUserId,
        status: 'IN_PROGRESS',
      },
    });

    // Mark dock as OCCUPIED
    await prisma.dock.update({
      where: { id: params.dockId },
      data: { status: DockStatus.OCCUPIED },
    });

    return session;
  }

  /**
   * Completes the receiving session with physical verification, seal checks,
   * AI discrepancy analysis, and tamper-evident receipt sealing.
   */
  async completeReceivingSession(params: {
    sessionId: string;
    actorUserId: string;
    orgId: string;
    palletCountReceived: number;
    sealIntact: boolean;
    damagesReported: boolean;
    damageNotes?: string | null;
    discrepancyCount?: number;
    signatureData?: string;
  }) {
    const session = await prisma.receivingSession.findUnique({
      where: { id: params.sessionId },
      include: {
        expectedDelivery: {
          include: { carrier: true, dock: true },
        },
      },
    });

    if (!session) {
      throw new Error(`Receiving session not found: ${params.sessionId}`);
    }

    const delivery = session.expectedDelivery;

    // AI/Bedrock Discrepancy Evaluation
    const analysis = await bedrockAnalyzer.analyzeReceivingSession({
      carrierName: delivery.carrier?.name || 'Unknown',
      expectedPallets: delivery.palletCount,
      receivedPallets: params.palletCountReceived,
      sealIntact: params.sealIntact,
      damagesReported: params.damagesReported,
      damageNotes: params.damageNotes,
    });

    // If discrepancies or broken seal detected, automatically create an OperationalException
    if (analysis.riskScore >= 30) {
      await prisma.operationalException.create({
        data: {
          orgId: params.orgId,
          facilityId: delivery.facilityId,
          dockId: session.dockId,
          expectedDeliveryId: delivery.id,
          exceptionType: ExceptionType.DISCREPANCY_FOUND,
          severity: analysis.riskScore >= 60 ? ExceptionSeverity.HIGH : ExceptionSeverity.MEDIUM,
          title: `Receiving Discrepancy: PO ${delivery.purchaseOrderNumber}`,
          details: analysis.discrepancySummary,
        },
      });
    }

    // Build Canonical Receipt Payload for SHA-256 Cryptographic Hash
    const receiptNumber = `REC-${Date.now().toString(36).toUpperCase()}-${delivery.purchaseOrderNumber.slice(-4)}`;
    const receiptPayload = {
      receiptNumber,
      deliveryId: delivery.id,
      purchaseOrderNumber: delivery.purchaseOrderNumber,
      carrier: delivery.carrier?.name,
      dockNumber: delivery.dock?.dockNumber,
      expectedPallets: delivery.palletCount,
      receivedPallets: params.palletCountReceived,
      sealIntact: params.sealIntact,
      damagesReported: params.damagesReported,
      discrepancyCount: params.discrepancyCount || 0,
      verifiedByUserId: params.actorUserId,
      confirmedAt: new Date().toISOString(),
    };

    const tamperProofHash = generateTamperProofHash(receiptPayload);

    // Persist ReceivingConfirmation and close session
    const confirmation = await prisma.$transaction(async (tx) => {
      // 1. Update session to COMPLETED
      await tx.receivingSession.update({
        where: { id: session.id },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
          palletCountReceived: params.palletCountReceived,
          discrepanciesNote: params.damageNotes,
        },
      });

      // 2. Create confirmation with cryptographic receipt hash
      const conf = await tx.receivingConfirmation.create({
        data: {
          orgId: params.orgId,
          receivingSessionId: session.id,
          expectedDeliveryId: delivery.id,
          confirmedByUserId: params.actorUserId,
          receiptNumber,
          signatureData: params.signatureData,
          discrepancyCount: params.discrepancyCount || 0,
          sealIntact: params.sealIntact,
          damagesReported: params.damagesReported,
          damageNotes: params.damageNotes,
          proofOfReceiptHash: tamperProofHash,
        },
      });

      // 3. Reset dock to IDLE
      await tx.dock.update({
        where: { id: session.dockId },
        data: { status: DockStatus.IDLE },
      });

      return conf;
    });

    // Advance state machine to RECEIVED
    await stateMachine.transitionDelivery({
      deliveryId: delivery.id,
      targetStatus: ReceivingStatus.RECEIVED,
      actorUserId: params.actorUserId,
      notes: `Receipt ${receiptNumber} confirmed with hash ${tamperProofHash.slice(0, 12)}...`,
    });

    realtimeBroker.broadcast({
      id: `evt_recv_${confirmation.id}`,
      type: 'RECEIVING_COMPLETED',
      orgId: params.orgId,
      data: {
        receiptNumber,
        deliveryId: delivery.id,
        purchaseOrderNumber: delivery.purchaseOrderNumber,
        proofOfReceiptHash: tamperProofHash,
      },
      timestamp: new Date().toISOString(),
    });

    return confirmation;
  }

  /**
   * Retrieves an immutable Proof-Of-Receipt record.
   */
  async getProofOfReceipt(deliveryId: string, orgId: string): Promise<ProofOfReceipt | null> {
    const delivery = await prisma.expectedDelivery.findFirst({
      where: { id: deliveryId, orgId },
      include: {
        carrier: true,
        dock: true,
        receivingConfirmations: {
          include: { confirmedByUser: true, receivingSession: true },
        },
        eventCorrelations: {
          include: { ringEvent: true },
        },
        operationalExceptions: true,
      },
    });

    if (!delivery || delivery.receivingConfirmations.length === 0) {
      return null;
    }

    const confirmation = delivery.receivingConfirmations[0];

    return {
      receiptNumber: confirmation.receiptNumber,
      deliveryId: delivery.id,
      purchaseOrderNumber: delivery.purchaseOrderNumber,
      carrierName: delivery.carrier?.name || 'Unknown',
      dockNumber: delivery.dock?.dockNumber || 'BAY-1',
      actualArrivalTime: delivery.actualArrivalTime || delivery.updatedAt,
      receivedAt: confirmation.confirmedAt,
      confirmedByUserId: confirmation.confirmedByUserId,
      confirmedByUserName: confirmation.confirmedByUser.name,
      sealIntact: confirmation.sealIntact,
      damagesReported: confirmation.damagesReported,
      discrepancyCount: confirmation.discrepancyCount,
      palletCountReceived: confirmation.receivingSession.palletCountReceived,
      eventReferences: delivery.eventCorrelations.map((c) => ({
        eventId: c.ringEvent.id,
        timestamp: c.ringEvent.startedAt,
        subType: c.ringEvent.subType || 'motion',
        snapshotUrl: c.ringEvent.snapshotUrl || undefined,
      })),
      exceptionHistory: delivery.operationalExceptions.map((e) => ({
        id: e.id,
        type: e.exceptionType,
        severity: e.severity,
        resolutionNotes: e.resolutionNotes || undefined,
      })),
      tamperProofHash: confirmation.proofOfReceiptHash,
      generatedAt: confirmation.createdAt,
    };
  }
}

export const receivingService = new ReceivingService();
