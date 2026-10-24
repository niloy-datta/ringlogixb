import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { stateMachine } from '@/services/workflow/state-machine';
import { UpdateDeliveryStatusSchema } from '@/types/api';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthenticatedUser(request);
    const json = await request.json();
    const validated = UpdateDeliveryStatusSchema.parse(json);

    const result = await stateMachine.transitionDelivery({
      deliveryId: params.id,
      targetStatus: validated.status,
      actorUserId: user.id,
      notes: validated.notes,
      isManualOverride: Boolean(validated.overrideReason),
      overrideReason: validated.overrideReason,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'State transition failed';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
