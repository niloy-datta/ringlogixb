import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { ReceivingStatus } from '@prisma/client';

export interface CreateDeliveryInput {
  orgId: string;
  facilityId: string;
  dockId?: string | null;
  carrierName: string;
  carrierScac?: string | null;
  purchaseOrderNumber: string;
  bolNumber?: string | null;
  trackingNumber?: string | null;
  expectedArrivalWindowStart: Date;
  expectedArrivalWindowEnd: Date;
  palletCount?: number;
  itemDescription?: string | null;
  notes?: string | null;
}

export class DeliveryService {
  /**
   * Creates an expected delivery record and resolves or registers the carrier.
   */
  async createDelivery(input: CreateDeliveryInput) {
    // 1. Find or create carrier
    let carrier = await prisma.carrier.findFirst({
      where: {
        orgId: input.orgId,
        name: { equals: input.carrierName, mode: 'insensitive' },
      },
    });

    if (!carrier) {
      carrier = await prisma.carrier.create({
        data: {
          orgId: input.orgId,
          name: input.carrierName,
          scacCode: input.carrierScac || undefined,
        },
      });
    }

    // 2. Create the ExpectedDelivery
    const delivery = await prisma.expectedDelivery.create({
      data: {
        orgId: input.orgId,
        facilityId: input.facilityId,
        dockId: input.dockId || undefined,
        carrierId: carrier.id,
        purchaseOrderNumber: input.purchaseOrderNumber,
        bolNumber: input.bolNumber || undefined,
        trackingNumber: input.trackingNumber || undefined,
        expectedArrivalWindowStart: input.expectedArrivalWindowStart,
        expectedArrivalWindowEnd: input.expectedArrivalWindowEnd,
        palletCount: input.palletCount || 1,
        itemDescription: input.itemDescription || undefined,
        notes: input.notes || undefined,
        status: ReceivingStatus.SCHEDULED,
      },
      include: {
        carrier: true,
        dock: true,
        facility: true,
      },
    });

    // 3. Register shipment references (PO and BOL)
    await prisma.shipmentReference.create({
      data: {
        expectedDeliveryId: delivery.id,
        referenceType: 'PO',
        referenceValue: input.purchaseOrderNumber,
      },
    });

    if (input.bolNumber) {
      await prisma.shipmentReference.create({
        data: {
          expectedDeliveryId: delivery.id,
          referenceType: 'BOL',
          referenceValue: input.bolNumber,
        },
      });
    }

    logger.info('Created expected delivery', {
      deliveryId: delivery.id,
      po: input.purchaseOrderNumber,
      carrier: input.carrierName,
    });

    return delivery;
  }

  /**
   * Retrieves deliveries with full relations, filtered by org and optionally status.
   */
  async listDeliveries(params: {
    orgId: string;
    facilityId?: string;
    status?: ReceivingStatus;
    searchQuery?: string;
  }) {
    const { orgId, facilityId, status, searchQuery } = params;

    const where: any = { orgId };
    if (facilityId) where.facilityId = facilityId;
    if (status) where.status = status;
    if (searchQuery) {
      where.OR = [
        { purchaseOrderNumber: { contains: searchQuery, mode: 'insensitive' } },
        { bolNumber: { contains: searchQuery, mode: 'insensitive' } },
        { carrier: { name: { contains: searchQuery, mode: 'insensitive' } } },
      ];
    }

    return prisma.expectedDelivery.findMany({
      where,
      include: {
        carrier: true,
        dock: true,
        facility: true,
        eventCorrelations: {
          include: {
            ringEvent: true,
          },
        },
        receivingSessions: {
          include: {
            confirmations: true,
          },
        },
        operationalExceptions: true,
      },
      orderBy: { expectedArrivalWindowStart: 'asc' },
    });
  }

  async getDeliveryById(id: string, orgId: string) {
    return prisma.expectedDelivery.findFirst({
      where: { id, orgId },
      include: {
        carrier: true,
        dock: true,
        facility: true,
        shipmentReferences: true,
        eventCorrelations: {
          include: {
            ringEvent: true,
          },
        },
        receivingSessions: {
          include: {
            confirmations: true,
            startedByUser: true,
          },
        },
        operationalExceptions: true,
        evidenceReferences: true,
      },
    });
  }
}

export const deliveryService = new DeliveryService();
