import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ringApiClient } from '@/services/ring/ring-client';
import { ConnectRingCameraSchema } from '@/types/api';
import { encryptSecret } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const discover = searchParams.get('discover') === 'true';

    if (discover) {
      // Discover real devices from the official Ring Partner API
      const discovered = await ringApiClient.listDevices();
      return NextResponse.json({ success: true, count: discovered.length, data: discovered });
    }

    const cameras = await prisma.ringCameraConnection.findMany({
      where: { orgId: user.orgId },
      include: {
        facility: true,
        cameraMappings: {
          include: { dock: true },
        },
      },
      orderBy: { deviceName: 'asc' },
    });

    return NextResponse.json({ success: true, count: cameras.length, data: cameras });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching Ring cameras';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);
    const json = await request.json();
    const validated = ConnectRingCameraSchema.parse(json);

    // Securely encrypt token if provided
    const encryptedToken = validated.token ? encryptSecret(validated.token) : undefined;

    const camera = await prisma.ringCameraConnection.upsert({
      where: {
        orgId_deviceId: {
          orgId: user.orgId,
          deviceId: validated.deviceId,
        },
      },
      create: {
        orgId: user.orgId,
        facilityId: validated.facilityId,
        deviceId: validated.deviceId,
        deviceName: validated.deviceName,
        deviceType: validated.deviceType,
        tokenEncrypted: encryptedToken,
        isOnline: true,
        lastSeenAt: new Date(),
      },
      update: {
        deviceName: validated.deviceName,
        deviceType: validated.deviceType,
        tokenEncrypted: encryptedToken || undefined,
        isOnline: true,
        lastSeenAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: camera }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to register Ring camera';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
