/**
 * Official Ring Partner API Client
 * Base Endpoint: https://api.amazonvision.com
 */

import { RingDevice, RingDeviceStatus, RingDeviceCapabilities } from '@/types/ring';
import { logger } from '@/lib/logger';

export interface RingClientConfig {
  baseUrl?: string;
  accessToken?: string;
  timeoutMs?: number;
}

export class RingPartnerApiClient {
  private baseUrl: string;
  private accessToken?: string;
  private timeoutMs: number;

  constructor(config?: RingClientConfig) {
    this.baseUrl = config?.baseUrl || process.env.RING_API_BASE_URL || 'https://api.amazonvision.com';
    this.accessToken = config?.accessToken || process.env.RING_ACCESS_TOKEN;
    this.timeoutMs = config?.timeoutMs || 8000;
  }

  private getHeaders(customToken?: string): HeadersInit {
    const token = customToken || this.accessToken;
    if (!token) {
      throw new Error('Ring API Error: Missing access token. Provide a Developer Playground token or OAuth token.');
    }
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'DockFlow-Receiving-OS/1.0',
    };
  }

  /**
   * Discovers authorized Ring devices for the account.
   * Endpoint: GET /v1/devices
   */
  async listDevices(customToken?: string): Promise<RingDevice[]> {
    const url = `${this.baseUrl}/v1/devices`;
    logger.debug('Calling Ring API listDevices', { url });

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(customToken),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ring API listDevices failed: HTTP ${response.status} - ${errorText}`);
      }

      const body = await response.json();
      return (body.data || body.devices || body) as RingDevice[];
    } catch (err: unknown) {
      logger.error('Failed to list Ring devices', err);
      throw err;
    }
  }

  /**
   * Fetches real-time status of a specific Ring device (online/offline, battery).
   * Endpoint: GET /v1/devices/{id}/status
   */
  async getDeviceStatus(deviceId: string, customToken?: string): Promise<RingDeviceStatus> {
    const url = `${this.baseUrl}/v1/devices/${encodeURIComponent(deviceId)}/status`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(customToken),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { device_id: deviceId, online: false };
        }
        const errorText = await response.text();
        throw new Error(`Ring API getDeviceStatus failed: HTTP ${response.status} - ${errorText}`);
      }

      const body = await response.json();
      return (body.data || body) as RingDeviceStatus;
    } catch (err: unknown) {
      logger.error('Failed to get Ring device status', err, { deviceId });
      throw err;
    }
  }

  /**
   * Fetches device capabilities (motion detection, Smart Alerts, video codecs).
   * Endpoint: GET /v1/devices/{id}/capabilities
   */
  async getDeviceCapabilities(deviceId: string, customToken?: string): Promise<RingDeviceCapabilities> {
    const url = `${this.baseUrl}/v1/devices/${encodeURIComponent(deviceId)}/capabilities`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(customToken),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ring API getDeviceCapabilities failed: HTTP ${response.status} - ${errorText}`);
      }

      const body = await response.json();
      return (body.data || body) as RingDeviceCapabilities;
    } catch (err: unknown) {
      logger.error('Failed to get Ring device capabilities', err, { deviceId });
      throw err;
    }
  }

  /**
   * Fetches historical events recorded by a specific device.
   * Endpoint: GET /v1/history/devices/{id}/events
   */
  async getDeviceEventHistory(
    deviceId: string,
    options?: { limit?: number; since?: string },
    customToken?: string
  ): Promise<Array<Record<string, unknown>>> {
    const query = new URLSearchParams();
    if (options?.limit) query.set('limit', String(options.limit));
    if (options?.since) query.set('since', options.since);

    const url = `${this.baseUrl}/v1/history/devices/${encodeURIComponent(deviceId)}/events?${query.toString()}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(customToken),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ring API getDeviceEventHistory failed: HTTP ${response.status} - ${errorText}`);
      }

      const body = await response.json();
      return (body.data || body.events || []) as Array<Record<string, unknown>>;
    } catch (err: unknown) {
      logger.error('Failed to get Ring event history', err, { deviceId });
      throw err;
    }
  }
}

export const ringApiClient = new RingPartnerApiClient();
