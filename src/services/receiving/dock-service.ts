import { prisma } from '@/lib/prisma';
import { DockStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

export class DockService {
  async listDocks(orgId: string, facilityId?: string) {
    const where: any = { orgId };
    if (facilityId) where.facilityId = facilityId;

    return prisma.dock.findMany({
      where,
      include: {
        facility: true,
        cameraMappings: {
          include: {
            camera: true,
          },
        },
        expectedDeliveries: {
          where: {
            status: { in: ['SCHEDULED', 'ARRIVAL_DETECTED', 'MATCH_PENDING', 'ARRIVED', 'RECEIVING'] },
          },
          include: {
            carrier: true,
          },
        },
        receivingSessions: {
          where: { status: 'IN_PROGRESS' },
        },
      },
      orderBy: { dockNumber: 'asc' },
    });
  }

  async createDock(params: {
    orgId: string;
    facilityId: string;
    dockNumber: string;
    name: string;
  }) {
    return prisma.dock.create({
      data: {
        orgId: params.orgId,
        facilityId: params.facilityId,
        dockNumber: params.dockNumber,
        name: params.name,
        status: DockStatus.IDLE,
      },
    });
  }

  async mapCameraToDock(params: {
    orgId: string;
    cameraId: string;
    dockId: string;
    isPrimary?: boolean;
    viewAngle?: string;
  }) {
    const mapping = await prisma.cameraDockMapping.upsert({
      where: {
        cameraId_dockId: {
          cameraId: params.cameraId,
          dockId: params.dockId,
        },
      },
      create: {
        orgId: params.orgId,
        cameraId: params.cameraId,
        dockId: params.dockId,
        isPrimary: params.isPrimary ?? true,
        viewAngle: params.viewAngle || 'FRONT_BAY',
      },
      update: {
        isPrimary: params.isPrimary ?? true,
        viewAngle: params.viewAngle || 'FRONT_BAY',
      },
      include: {
        camera: true,
        dock: true,
      },
    });

    logger.info('Mapped camera to dock bay', {
      cameraId: params.cameraId,
      dockId: params.dockId,
      dockNumber: mapping.dock.dockNumber,
    });

    return mapping;
  }

  async getDockForCamera(cameraId: string, orgId: string) {
    const mapping = await prisma.cameraDockMapping.findFirst({
      where: { cameraId, orgId },
      include: { dock: true },
    });

    if (!mapping) return null;

    return {
      dockId: mapping.dock.id,
      dockNumber: mapping.dock.dockNumber,
      facilityId: mapping.dock.facilityId,
    };
  }
}

export const dockService = new DockService();
