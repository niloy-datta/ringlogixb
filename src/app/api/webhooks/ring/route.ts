import { NextRequest, NextResponse } from 'next/server';
import { ringWebhookHandler } from '@/services/ring/webhook-handler';
import '@/services/workflow/job-init'; // Ensure job handlers are registered

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-signature');
    const orgId = request.headers.get('x-org-id') || 'org_main_warehouse_01';

    // Extract raw request body bytes for precise HMAC-SHA256 signature verification
    const rawBodyBuffer = Buffer.from(await request.arrayBuffer());

    const result = await ringWebhookHandler.handleWebhook(rawBodyBuffer, signature, orgId);

    return NextResponse.json(result.body, { status: result.statusCode });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { status: 'error', message },
      { status: 500 }
    );
  }
}
