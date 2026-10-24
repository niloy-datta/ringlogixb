import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { receivingService } from '@/services/receiving/receiving-service';
import { ConfirmCorrelationSchema } from '@/types/api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);
    const json = await request.json();
    const validated = ConfirmCorrelationSchema.parse(json);

    await receivingService.handleCorrelationDecision({
      correlationId: validated.correlationId,
      action: validated.action,
      actorUserId: user.id,
      orgId: user.orgId,
      assignedDeliveryId: validated.assignedDeliveryId,
      notes: validated.notes,
    });

    return NextResponse.json({
      success: true,
      message: `Correlation match ${validated.action.toLowerCase()}ed successfully.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error processing correlation decision';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
