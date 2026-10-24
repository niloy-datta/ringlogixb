/**
 * Server-Sent Events (SSE) Real-Time Broker
 * Supports organization channel isolation, keep-alive heartbeats, and bounded replay buffer.
 */

export interface RealtimeEventPayload {
  id: string;
  type:
    | 'RING_EVENT_RECEIVED'
    | 'CORRELATION_COMPLETED'
    | 'DELIVERY_STATUS_CHANGED'
    | 'EXCEPTION_DETECTED'
    | 'EXCEPTION_RESOLVED'
    | 'RECEIVING_COMPLETED';
  orgId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

type SSEListener = (event: RealtimeEventPayload) => void;

class RealtimeBroker {
  private listeners: Map<string, Set<SSEListener>> = new Map();
  private eventHistory: Map<string, RealtimeEventPayload[]> = new Map();
  private maxHistorySize = 50;

  subscribe(orgId: string, listener: SSEListener): () => void {
    if (!this.listeners.has(orgId)) {
      this.listeners.set(orgId, new Set());
    }
    this.listeners.get(orgId)!.add(listener);

    return () => {
      const orgListeners = this.listeners.get(orgId);
      if (orgListeners) {
        orgListeners.delete(listener);
        if (orgListeners.size === 0) {
          this.listeners.delete(orgId);
        }
      }
    };
  }

  broadcast(event: RealtimeEventPayload): void {
    const orgId = event.orgId;

    // Maintain bounded history for reconnect replay
    if (!this.eventHistory.has(orgId)) {
      this.eventHistory.set(orgId, []);
    }
    const history = this.eventHistory.get(orgId)!;
    history.push(event);
    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    // Dispatch to all connected listeners in the organization
    const orgListeners = this.listeners.get(orgId);
    if (orgListeners) {
      for (const listener of orgListeners) {
        try {
          listener(event);
        } catch (err) {
          console.error('[SSE Broker] Listener error:', err);
        }
      }
    }
  }

  getReplayEvents(orgId: string, lastEventId?: string): RealtimeEventPayload[] {
    const history = this.eventHistory.get(orgId) || [];
    if (!lastEventId) {
      return history.slice(-20); // Return last 20 events on initial connect
    }
    const index = history.findIndex((e) => e.id === lastEventId);
    if (index === -1) {
      return history;
    }
    return history.slice(index + 1);
  }
}

// Global broker singleton
declare global {
  // eslint-disable-next-line no-var
  var __realtimeBroker: RealtimeBroker | undefined;
}

export const realtimeBroker = global.__realtimeBroker || new RealtimeBroker();

if (process.env.NODE_ENV !== 'production') {
  global.__realtimeBroker = realtimeBroker;
}
