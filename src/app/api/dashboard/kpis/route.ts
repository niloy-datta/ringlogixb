import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ReceivingStatus, ExceptionStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);
    const orgId = user.orgId;

    const [
      scheduledCount,
      arrivedCount,
      receivingCount,
      receivedCount,
      openExceptionsCount,
      totalDocks,
      occupiedDocks,
      totalCameras,
      onlineCameras,
      recentEvents,
    ] = await Promise.all([
      prisma.expectedDelivery.count({
        where: { orgId, status: ReceivingStatus.SCHEDULED },
      }),
      prisma.expectedDelivery.count({
        where: { orgId, status: { in: [ReceivingStatus.ARRIVAL_DETECTED, ReceivingStatus.MATCH_PENDING, ReceivingStatus.ARRIVED] } },
      }),
      prisma.expectedDelivery.count({
        where: { orgId, status: ReceivingStatus.RECEIVING },
      }),
      prisma.expectedDelivery.count({
        where: { orgId, status: ReceivingStatus.RECEIVED },
      }),
      prisma.operationalException.count({
        where: { orgId, status: { in: [ExceptionStatus.OPEN, ExceptionStatus.INVESTIGATING] } },
      }),
      prisma.dock.count({ where: { orgId } }),
      prisma.dock.count({ where: { orgId, status: 'OCCUPIED' } }),
      prisma.ringCameraConnection.count({ where: { orgId } }),
      prisma.ringCameraConnection.count({ where: { orgId, isOnline: true } }),
      prisma.ringEvent.findMany({
        where: { orgId },
        take: 10,
        orderBy: { startedAt: 'desc' },
        include: {
          camera: true,
          eventCorrelations: {
            include: { expectedDelivery: true },
          },
        },
      }),
    ]);

    const dockUtilization = totalDocks > 0 ? Math.round((occupiedDocks / totalDocks) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        deliveries: {
          scheduled: scheduledCount,
          arrived: arrivedCount,
          receiving: receivingCount,
          received: receivedCount,
          totalActive: scheduledCount + arrivedCount + receivingCount,
        },
        docks: {
          total: totalDocks,
          occupied: occupiedDocks,
          utilizationPercent: dockUtilization,
        },
        cameras: {
          total: totalCameras,
          online: onlineCameras,
        },
        exceptions: {
          open: openExceptionsCount,
        },
        recentEvents,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching dashboard KPIs';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
