import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { exceptionService } from '@/services/receiving/exception-service';
import { ResolveExceptionSchema } from '@/types/api';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthenticatedUser(request);
    const json = await request.json();
    const validated = ResolveExceptionSchema.parse(json);

    const updated = await exceptionService.resolveException({
      exceptionId: params.id,
      orgId: user.orgId,
      actorUserId: user.id,
      action: validated.action,
      resolutionNotes: validated.resolutionNotes,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to resolve exception';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
