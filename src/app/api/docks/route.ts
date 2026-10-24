import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { dockService } from '@/services/receiving/dock-service';
import { CreateDockSchema } from '@/types/api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get('facilityId') || undefined;

    const docks = await dockService.listDocks(user.orgId, facilityId);
    return NextResponse.json({ success: true, count: docks.length, data: docks });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve docks';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);
    const json = await request.json();
    const validated = CreateDockSchema.parse(json);

    const dock = await dockService.createDock({
      orgId: user.orgId,
      facilityId: validated.facilityId,
      dockNumber: validated.dockNumber,
      name: validated.name,
    });

    return NextResponse.json({ success: true, data: dock }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create dock';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
