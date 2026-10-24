import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { deliveryService } from '@/services/receiving/delivery-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthenticatedUser(request);
    const delivery = await deliveryService.getDeliveryById(params.id, user.orgId);

    if (!delivery) {
      return NextResponse.json({ success: false, error: 'Delivery not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: delivery });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error retrieving delivery';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
