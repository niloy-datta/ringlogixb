import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { receivingService } from '@/services/receiving/receiving-service';
import { CompleteReceivingSessionSchema } from '@/types/api';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const user = getAuthenticatedUser(request);
    const json = await request.json();
    const validated = CompleteReceivingSessionSchema.parse(json);

    const confirmation = await receivingService.completeReceivingSession({
      sessionId: params.sessionId,
      actorUserId: user.id,
      orgId: user.orgId,
      palletCountReceived: validated.palletCountReceived,
      sealIntact: validated.sealIntact,
      damagesReported: validated.damagesReported,
      damageNotes: validated.damageNotes,
      discrepancyCount: validated.discrepancyCount,
      signatureData: validated.signatureData,
    });

    return NextResponse.json({ success: true, data: confirmation });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error completing receiving session';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
