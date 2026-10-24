import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { realtimeBroker } from '@/lib/sse';
import {
  ExceptionType,
  ExceptionSeverity,
  ExceptionStatus,
  ReceivingStatus,
} from '@prisma/client';

export class OperationalExceptionService {
  /**
   * Scans the system for receiving exceptions and persists newly discovered issues.
   */
  async scanForExceptions(orgId: string): Promise<number> {
    const now = new Date();
    let exceptionsCreated = 0;

    // 1. Expected Arrival Overdue
    // Deliveries still in SCHEDULED where windowEnd is in the past (> 15 mins)
    const overdueThreshold = new Date(now.getTime() - 15 * 60 * 1000);
    const overdueDeliveries = await prisma.expectedDelivery.findMany({
      where: {
        orgId,
        status: ReceivingStatus.SCHEDULED,
        expectedArrivalWindowEnd: { lt: overdueThreshold },
        operationalExceptions: {
          none: {
            exceptionType: ExceptionType.ARRIVAL_OVERDUE,
            status: { in: [ExceptionStatus.OPEN, ExceptionStatus.INVESTIGATING] },
          },
        },
      },
      include: { carrier: true },
    });

    for (const delivery of overdueDeliveries) {
      await prisma.operationalException.create({
        data: {
          orgId,
          facilityId: delivery.facilityId,
          dockId: delivery.dockId,
          expectedDeliveryId: delivery.id,
          exceptionType: ExceptionType.ARRIVAL_OVERDUE,
          severity: ExceptionSeverity.MEDIUM,
          title: `Delivery Overdue: PO ${delivery.purchaseOrderNumber}`,
          details: `Carrier ${delivery.carrier?.name || 'Unknown'} has not arrived. Appointment window ended at ${delivery.expectedArrivalWindowEnd.toLocaleTimeString()}.`,
        },
      });
      exceptionsCreated++;
    }

    // 2. Receiving Confirmation Overdue
    // Deliveries in ARRIVED or RECEIVING for longer than 90 minutes
    const receivingThreshold = new Date(now.getTime() - 90 * 60 * 1000);
    const stuckDeliveries = await prisma.expectedDelivery.findMany({
      where: {
        orgId,
        status: { in: [ReceivingStatus.ARRIVED, ReceivingStatus.RECEIVING] },
        actualArrivalTime: { lt: receivingThreshold },
        operationalExceptions: {
          none: {
            exceptionType: ExceptionType.RECEIVING_OVERDUE,
            status: { in: [ExceptionStatus.OPEN, ExceptionStatus.INVESTIGATING] },
          },
        },
      },
      include: { dock: true },
    });

    for (const delivery of stuckDeliveries) {
      await prisma.operationalException.create({
        data: {
          orgId,
          facilityId: delivery.facilityId,
          dockId: delivery.dockId,
          expectedDeliveryId: delivery.id,
          exceptionType: ExceptionType.RECEIVING_OVERDUE,
          severity: ExceptionSeverity.HIGH,
          title: `Receiving Delay: Dock ${delivery.dock?.dockNumber || 'BAY'}`,
          details: `Trailer arrived at ${delivery.actualArrivalTime?.toLocaleTimeString()} and receiving has exceeded 90 minutes.`,
        },
      });
      exceptionsCreated++;
    }

    // 3. Offline Ring Cameras
    // Ring cameras where isOnline === false
    const offlineCameras = await prisma.ringCameraConnection.findMany({
      where: {
        orgId,
        isOnline: false,
      },
    });

    for (const camera of offlineCameras) {
      const existingOpen = await prisma.operationalException.findFirst({
        where: {
          orgId,
          facilityId: camera.facilityId,
          exceptionType: ExceptionType.CAMERA_OFFLINE,
          status: { in: [ExceptionStatus.OPEN, ExceptionStatus.INVESTIGATING] },
          details: { contains: camera.deviceId },
        },
      });

      if (!existingOpen) {
        await prisma.operationalException.create({
          data: {
            orgId,
            facilityId: camera.facilityId,
            exceptionType: ExceptionType.CAMERA_OFFLINE,
            severity: ExceptionSeverity.HIGH,
            title: `Camera Offline: ${camera.deviceName}`,
            details: `Ring camera device ${camera.deviceId} is disconnected or offline.`,
          },
        });
        exceptionsCreated++;
      }
    }

    // 4. Dock Congestion Check
    // If a dock has more than 1 delivery assigned with overlapping windows today
    const docks = await prisma.dock.findMany({
      where: { orgId },
      include: {
        expectedDeliveries: {
          where: {
            status: { in: [ReceivingStatus.SCHEDULED, ReceivingStatus.ARRIVAL_DETECTED, ReceivingStatus.ARRIVED] },
          },
        },
      },
    });

    for (const dock of docks) {
      if (dock.expectedDeliveries.length > 2) {
        const existingCongestion = await prisma.operationalException.findFirst({
          where: {
            orgId,
            dockId: dock.id,
            exceptionType: ExceptionType.DOCK_CONGESTION,
            status: { in: [ExceptionStatus.OPEN, ExceptionStatus.INVESTIGATING] },
          },
        });

        if (!existingCongestion) {
          await prisma.operationalException.create({
            data: {
              orgId,
              facilityId: dock.facilityId,
              dockId: dock.id,
              exceptionType: ExceptionType.DOCK_CONGESTION,
              severity: ExceptionSeverity.MEDIUM,
              title: `Dock Congestion: Bay ${dock.dockNumber}`,
              details: `Dock ${dock.dockNumber} has ${dock.expectedDeliveries.length} active shipments queued simultaneously.`,
            },
          });
          exceptionsCreated++;
        }
      }
    }

    if (exceptionsCreated > 0) {
      logger.info('Exception scan detected new operational issues', { count: exceptionsCreated });
    }

    return exceptionsCreated;
  }

  /**
   * Resolves or dismisses an operational exception.
   */
  async resolveException(params: {
    exceptionId: string;
    orgId: string;
    actorUserId: string;
    action: 'RESOLVE' | 'DISMISS';
    resolutionNotes: string;
  }) {
    const updated = await prisma.operationalException.update({
      where: { id: params.exceptionId },
      data: {
        status: params.action === 'RESOLVE' ? ExceptionStatus.RESOLVED : ExceptionStatus.DISMISSED,
        resolvedAt: new Date(),
        resolvedByUserId: params.actorUserId,
        resolutionNotes: params.resolutionNotes,
      },
    });

    realtimeBroker.broadcast({
      id: `evt_res_${updated.id}`,
      type: 'EXCEPTION_RESOLVED',
      orgId: params.orgId,
      data: {
        exceptionId: updated.id,
        status: updated.status,
      },
      timestamp: new Date().toISOString(),
    });

    return updated;
  }

  async listExceptions(orgId: string, status?: ExceptionStatus) {
    const where: any = { orgId };
    if (status) where.status = status;

    return prisma.operationalException.findMany({
      where,
      include: {
        facility: true,
        dock: true,
        expectedDelivery: {
          include: { carrier: true },
        },
        resolvedByUser: true,
      },
      orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
    });
  }
}

export const exceptionService = new OperationalExceptionService();
