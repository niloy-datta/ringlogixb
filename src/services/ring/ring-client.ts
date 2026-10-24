/**
 * Official Ring Partner API Client
 * Base Endpoint: https://api.amazonvision.com
 * Conforms to Amazon Vision / Ring Partner API OAuth2 and REST endpoints:
 * https://developer.amazon.com/docs/ring/api-documentation.html
 */

import { RingDevice, RingDeviceStatus, RingDeviceCapabilities } from '@/types/ring';
import { logger } from '@/lib/logger';
import { encryptSecret, decryptSecret } from '@/lib/crypto';

export interface RingClientConfig {
  baseUrl?: string;
  tokenEndpoint?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  timeoutMs?: number;
}

export interface RingTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export class RingPartnerApiClient {
  private baseUrl: string;
  private tokenEndpoint: string;
  private clientId?: string;
  private clientSecret?: string;
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiresAt?: number;
  private timeoutMs: number;

  constructor(config?: RingClientConfig) {
    this.baseUrl = config?.baseUrl || process.env.RING_API_BASE_URL || 'https://api.amazonvision.com';
    this.tokenEndpoint =
      config?.tokenEndpoint ||
      process.env.RING_OAUTH_TOKEN_URL ||
      'https://api.amazonvision.com/oauth/token';
    this.clientId = config?.clientId || process.env.RING_CLIENT_ID;
    this.clientSecret = config?.clientSecret || process.env.RING_CLIENT_SECRET;
    this.accessToken = config?.accessToken || process.env.RING_ACCESS_TOKEN;
    this.refreshToken = config?.refreshToken || process.env.RING_REFRESH_TOKEN;
    this.timeoutMs = config?.timeoutMs || 8000;
  }

  /**
   * Exchanges Client Credentials or Refresh Token for an OAuth 2.0 Access Token.
   * Caches token in memory until expiration.
   */
  async getValidToken(): Promise<string> {
    const now = Date.now();
    // Use cached token if valid for at least 60 more seconds
    if (this.accessToken && this.tokenExpiresAt && this.tokenExpiresAt - now > 60000) {
      return this.accessToken;
    }

    if (this.clientId && this.clientSecret) {
      try {
        const bodyParams = new URLSearchParams();
        if (this.refreshToken) {
          bodyParams.set('grant_type', 'refresh_token');
          bodyParams.set('refresh_token', this.refreshToken);
        } else {
          bodyParams.set('grant_type', 'client_credentials');
          bodyParams.set('scope', 'ring.partner.devices ring.partner.events');
        }

        const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
        const res = await fetch(this.tokenEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: bodyParams.toString(),
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (res.ok) {
          const data = (await res.json()) as RingTokenResponse;
          this.accessToken = data.access_token;
          this.tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
          if (data.refresh_token) {
            this.refreshToken = data.refresh_token;
          }
          return this.accessToken;
        }
      } catch (tokenErr) {
        logger.warn('Failed OAuth client credentials token exchange; falling back to static token', {
          error: String(tokenErr),
        });
      }
    }

    // Static fallback token (e.g. playground token)
    if (this.accessToken) {
      return this.accessToken;
    }

    throw new Error('Ring API Error: Missing access token and credentials to obtain OAuth token.');
  }

  private async getHeaders(customToken?: string): Promise<HeadersInit> {
    const token = customToken || (await this.getValidToken());
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
      const headers = await this.getHeaders(customToken);
      const response = await fetch(url, {
        method: 'GET',
        headers,
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
      const headers = await this.getHeaders(customToken);
      const response = await fetch(url, {
        method: 'GET',
        headers,
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
      const headers = await this.getHeaders(customToken);
      const response = await fetch(url, {
        method: 'GET',
        headers,
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
      const headers = await this.getHeaders(customToken);
      const response = await fetch(url, {
        method: 'GET',
        headers,
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

  /**
   * Helper to securely encrypt stored Ring credentials before writing to DB.
   */
  encryptToken(token: string): string {
    return encryptSecret(token);
  }

  /**
   * Helper to securely decrypt stored Ring credentials from DB.
   */
  decryptToken(encryptedToken: string): string {
    return decryptSecret(encryptedToken);
  }
}

export const ringApiClient = new RingPartnerApiClient();
