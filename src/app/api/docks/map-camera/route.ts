import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { dockService } from '@/services/receiving/dock-service';
import { MapCameraToDockSchema } from '@/types/api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);
    const json = await request.json();
    const validated = MapCameraToDockSchema.parse(json);

    const mapping = await dockService.mapCameraToDock({
      orgId: user.orgId,
      cameraId: validated.cameraId,
      dockId: validated.dockId,
      isPrimary: validated.isPrimary,
      viewAngle: validated.viewAngle,
    });

    return NextResponse.json({ success: true, data: mapping });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to map camera to dock';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
