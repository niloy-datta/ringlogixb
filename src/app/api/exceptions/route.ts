import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { exceptionService } from '@/services/receiving/exception-service';
import { ExceptionStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');

    const status = statusParam && Object.values(ExceptionStatus).includes(statusParam as any)
      ? (statusParam as ExceptionStatus)
      : undefined;

    const exceptions = await exceptionService.listExceptions(user.orgId, status);
    return NextResponse.json({ success: true, count: exceptions.length, data: exceptions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching exceptions';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);
    const count = await exceptionService.scanForExceptions(user.orgId);
    return NextResponse.json({ success: true, message: `Scan complete. Found ${count} new exception(s).` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error scanning exceptions';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
