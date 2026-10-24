import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { ringSimulator } from '@/services/ring/simulator';
import { ringWebhookHandler } from '@/services/ring/webhook-handler';
import { jobQueue } from '@/services/workflow/job-queue';
import '@/services/workflow/job-init';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);

    // Protect simulator from unauthorized production access
    if (process.env.NODE_ENV === 'production' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Simulator controls are restricted to administrators in production' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const scenario = body.scenario || 'SCHEDULED_TRUCK';
    const secret = process.env.RING_WEBHOOK_SECRET || 'whsec_dockflow_production_grade_hmac_secret_2026';

    let payload;
    let signatureHeader;
    let rawBody;

    if (scenario === 'CAMERA_OFFLINE') {
      payload = ringSimulator.generateDeviceStatusPayload(body.deviceId || 'ava1.ring.device.dock1', false);
      const signed = ringSimulator.signPayload(payload, secret);
      rawBody = signed.rawBody;
      signatureHeader = signed.signatureHeader;
    } else if (scenario === 'GENERIC_MOTION') {
      payload = ringSimulator.generateSimulatedPayload({
        deviceId: body.deviceId || 'ava1.ring.device.dock1',
        subType: 'motion',
      });
      const signed = ringSimulator.signPayload(payload, secret);
      rawBody = signed.rawBody;
      signatureHeader = signed.signatureHeader;
    } else if (scenario === 'UNSCHEDULED_VEHICLE') {
      payload = ringSimulator.generateSimulatedPayload({
        deviceId: body.deviceId || 'ava1.ring.device.dock3',
        subType: 'vehicle',
      });
      const signed = ringSimulator.signPayload(payload, secret);
      rawBody = signed.rawBody;
      signatureHeader = signed.signatureHeader;
    } else if (scenario === 'TAMPERED_SIGNATURE') {
      payload = ringSimulator.generateSimulatedPayload({ subType: 'vehicle' });
      rawBody = JSON.stringify(payload);
      signatureHeader = 'invalid_tampered_hmac_signature_0000000000000000';
    } else {
      // Default: SCHEDULED_TRUCK
      payload = ringSimulator.generateSimulatedPayload({
        deviceId: body.deviceId || 'ava1.ring.device.dock1',
        subType: 'vehicle',
      });
      const signed = ringSimulator.signPayload(payload, secret);
      rawBody = signed.rawBody;
      signatureHeader = signed.signatureHeader;
    }

    // Ingest through real webhook processing pipeline
    const webhookResult = await ringWebhookHandler.handleWebhook(
      Buffer.from(rawBody, 'utf8'),
      signatureHeader,
      user.orgId
    );

    // If requested or in simulation mode, process the queued background jobs immediately
    let processedJobCount = 0;
    if (body.executeJobsImmediately !== false && webhookResult.statusCode === 200) {
      processedJobCount = await jobQueue.processNextJobs(10);
    }

    return NextResponse.json({
      success: webhookResult.statusCode === 200,
      scenario,
      webhookResult,
      processedJobCount,
      simulatedPayload: payload,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error executing simulation scenario';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
