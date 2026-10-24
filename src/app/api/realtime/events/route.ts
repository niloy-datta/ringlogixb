import { NextRequest } from 'next/server';
import { realtimeBroker, RealtimeEventPayload } from '@/lib/sse';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  const orgId = user.orgId;

  const url = new URL(request.url);
  const lastEventId =
    request.headers.get('last-event-id') || url.searchParams.get('lastEventId') || undefined;

  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Send SSE initial connection event
  const sendEvent = (event: RealtimeEventPayload) => {
    const dataStr = `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    writer.write(encoder.encode(dataStr)).catch(() => {});
  };

  // Replay buffered events on connect/reconnect
  const replay = realtimeBroker.getReplayEvents(orgId, lastEventId);
  for (const item of replay) {
    sendEvent(item);
  }

  // Subscribe to new real-time broadcasts
  const unsubscribe = realtimeBroker.subscribe(orgId, (event) => {
    sendEvent(event);
  });

  // Keep-alive heartbeat interval (15s)
  const heartbeatInterval = setInterval(() => {
    writer.write(encoder.encode(': heartbeat\n\n')).catch(() => {
      clearInterval(heartbeatInterval);
      unsubscribe();
    });
  }, 15000);

  // Handle client disconnect
  request.signal.addEventListener('abort', () => {
    clearInterval(heartbeatInterval);
    unsubscribe();
    writer.close().catch(() => {});
  });

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
