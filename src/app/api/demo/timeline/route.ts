import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);

    // Fetch recent events, exceptions, confirmations, and deliveries
    const [ringEvents, exceptions, confirmations] = await Promise.all([
      prisma.ringEvent.findMany({
        where: { orgId: user.orgId },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.operationalException.findMany({
        where: { orgId: user.orgId },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { dock: true },
      }),
      prisma.receivingConfirmation.findMany({
        where: { orgId: user.orgId },
        take: 10,
        orderBy: { confirmedAt: 'desc' },
        include: { expectedDelivery: true, confirmedByUser: true },
      }),
    ]);

    const timeline: any[] = [];

    // Map Ring events
    for (const evt of ringEvents) {
      timeline.push({
        id: `timeline_evt_${evt.id}`,
        type: 'RING_EVENT',
        timestamp: new Date(evt.startedAt).toLocaleTimeString(),
        rawDate: evt.startedAt,
        title: `Ring Motion: ${(evt.subType || 'motion').toUpperCase()}`,
        details: `Detected on device ${evt.cameraId} with verified HMAC-SHA256 signature.`,
        badge: evt.subType === 'vehicle' ? 'SMART ALERT: VEHICLE' : 'MOTION',
        badgeColor: evt.subType === 'vehicle' ? 'sky' : 'indigo',
        metadata: { eventId: evt.id, snapshotUrl: evt.snapshotUrl },
      });
    }

    // Map Exceptions
    for (const ex of exceptions) {
      timeline.push({
        id: `timeline_ex_${ex.id}`,
        type: 'EXCEPTION_RAISED',
        timestamp: new Date(ex.createdAt).toLocaleTimeString(),
        rawDate: ex.createdAt,
        title: `Exception: ${ex.exceptionType}`,
        details: ex.details || ex.title,
        badge: ex.severity,
        badgeColor: ex.severity === 'HIGH' || ex.severity === 'CRITICAL' ? 'rose' : 'amber',
        metadata: { exceptionId: ex.id, dockNumber: ex.dock?.dockNumber },
      });
    }

    // Map Confirmations (Sealed Receipts)
    for (const conf of confirmations) {
      timeline.push({
        id: `timeline_conf_${conf.id}`,
        type: 'RECEIVING_COMPLETED',
        timestamp: new Date(conf.confirmedAt).toLocaleTimeString(),
        rawDate: conf.confirmedAt,
        title: `Receipt Sealed: ${conf.receiptNumber}`,
        details: `Confirmed by ${conf.confirmedByUser.name}. Proof Hash: ${conf.proofOfReceiptHash.slice(0, 16)}...`,
        badge: conf.sealIntact ? 'CLEAN RECEIPT' : 'DISCREPANCY RECORDED',
        badgeColor: conf.sealIntact ? 'emerald' : 'amber',
        metadata: {
          deliveryId: conf.expectedDeliveryId,
          proofOfReceiptHash: conf.proofOfReceiptHash,
        },
      });
    }

    // Sort descending by rawDate
    timeline.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());

    return NextResponse.json({ success: true, count: timeline.length, data: timeline });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error retrieving timeline';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
