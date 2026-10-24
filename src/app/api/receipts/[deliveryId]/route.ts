import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { receivingService } from '@/services/receiving/receiving-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { deliveryId: string } }
) {
  try {
    const user = getAuthenticatedUser(request);
    const receipt = await receivingService.getProofOfReceipt(params.deliveryId, user.orgId);

    if (!receipt) {
      return NextResponse.json(
        { success: false, error: 'Proof of receipt not found for this delivery' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: receipt });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error retrieving proof of receipt';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
