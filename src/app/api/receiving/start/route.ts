import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { receivingService } from '@/services/receiving/receiving-service';
import { StartReceivingSessionSchema } from '@/types/api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);
    const json = await request.json();
    const validated = StartReceivingSessionSchema.parse(json);

    const session = await receivingService.startReceivingSession({
      expectedDeliveryId: validated.expectedDeliveryId,
      dockId: validated.dockId,
      actorUserId: user.id,
      orgId: user.orgId,
    });

    return NextResponse.json({ success: true, data: session }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error starting receiving session';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
