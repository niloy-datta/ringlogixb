import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { demoStudioService } from '@/services/demo/demo-studio-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);

    if (process.env.NODE_ENV === 'production' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Baseline reset is restricted to administrators in production' },
        { status: 403 }
      );
    }

    const result = await demoStudioService.resetToBaseline(user.orgId);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error resetting facility baseline';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
