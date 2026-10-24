import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { receivingService } from '@/services/receiving/receiving-service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { deliveryId: string } }
) {
  try {
    const user = getAuthenticatedUser(request);
    const result = await receivingService.verifyReceipt(params.deliveryId, user.orgId);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error executing cryptographic receipt verification';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
