import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { demoStudioService } from '@/services/demo/demo-studio-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);

    if (process.env.NODE_ENV === 'production' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Demo Studio scenarios are restricted to administrators in production' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const scenario = (body.scenario || 'A').toUpperCase();

    let result;
    switch (scenario) {
      case 'A':
        result = await demoStudioService.runScenarioA(user.orgId);
        break;
      case 'B':
        result = await demoStudioService.runScenarioB(user.orgId);
        break;
      case 'C':
        result = await demoStudioService.runScenarioC(user.orgId);
        break;
      case 'D':
        result = await demoStudioService.runScenarioD(user.orgId);
        break;
      case 'E':
        result = await demoStudioService.runScenarioE(user.orgId);
        break;
      case 'F':
        result = await demoStudioService.runScenarioF(user.orgId);
        break;
      default:
        return NextResponse.json({ success: false, error: 'Invalid scenario ID. Must be A, B, C, D, E, or F.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error executing demo scenario';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
