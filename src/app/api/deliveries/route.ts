import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { deliveryService } from '@/services/receiving/delivery-service';
import { CreateDeliverySchema } from '@/types/api';
import { ReceivingStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);

    const facilityId = searchParams.get('facilityId') || undefined;
    const statusParam = searchParams.get('status');
    const searchQuery = searchParams.get('q') || undefined;

    const status = statusParam && Object.values(ReceivingStatus).includes(statusParam as any)
      ? (statusParam as ReceivingStatus)
      : undefined;

    const deliveries = await deliveryService.listDeliveries({
      orgId: user.orgId,
      facilityId,
      status,
      searchQuery,
    });

    return NextResponse.json({ success: true, count: deliveries.length, data: deliveries });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve deliveries';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);
    const json = await request.json();

    const validated = CreateDeliverySchema.parse(json);

    const delivery = await deliveryService.createDelivery({
      orgId: user.orgId,
      facilityId: validated.facilityId,
      dockId: validated.dockId,
      carrierName: validated.carrierName,
      carrierScac: validated.carrierScac,
      purchaseOrderNumber: validated.purchaseOrderNumber,
      bolNumber: validated.bolNumber,
      trackingNumber: validated.trackingNumber,
      expectedArrivalWindowStart: new Date(validated.expectedArrivalWindowStart),
      expectedArrivalWindowEnd: new Date(validated.expectedArrivalWindowEnd),
      palletCount: validated.palletCount,
      itemDescription: validated.itemDescription,
      notes: validated.notes,
    });

    return NextResponse.json({ success: true, data: delivery }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Validation or creation error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
