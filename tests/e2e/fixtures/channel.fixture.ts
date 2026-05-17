import { type APIRequestContext } from '@playwright/test';
import { API_BASE, PLATFORM_ADMIN } from '../helpers/credentials';

/**
 * Channel configuration helpers used by `reference-deployment.spec.ts`.
 *
 * Wraps the `/api/v1/admin/channels` CRUD surface so the reference-deployment
 * suite can enable/disable + reconfigure channels deterministically across
 * runs. Uses the platform-admin tenant by default (matching the SMB reference
 * deploy which ships a single tenant).
 */
export class ChannelHelper {
  constructor(private readonly request: APIRequestContext) {}

  readonly tenantId = PLATFORM_ADMIN.tenantId;

  private headers() {
    return { 'X-Tenant-Id': this.tenantId };
  }

  async list() {
    const response = await this.request.get(`${API_BASE}/api/v1/admin/channels`, {
      headers: this.headers(),
    });
    if (!response.ok()) {
      throw new Error(`list channels failed: ${response.status()}`);
    }
    return response.json() as Promise<
      Array<{ id: string; displayName: string; enabled: boolean; tenantId: string }>
    >;
  }

  async get(channelId: string) {
    const response = await this.request.get(`${API_BASE}/api/v1/admin/channels/${channelId}`, {
      headers: this.headers(),
    });
    return response;
  }

  async patch(channelId: string, body: Record<string, unknown>) {
    return this.request.patch(`${API_BASE}/api/v1/admin/channels/${channelId}`, {
      headers: this.headers(),
      data: body,
    });
  }

  async enableWebchat(
    opts: {
      displayName?: string;
      allowedOrigins?: string[];
      defaultQueueId?: string;
    } = {},
  ) {
    return this.patch('webchat', {
      enabled: true,
      displayName: opts.displayName ?? 'WebChat reference deploy',
      allowedOrigins: opts.allowedOrigins ?? ['http://localhost', 'http://127.0.0.1'],
      defaultQueueId: opts.defaultQueueId,
    });
  }

  async enableEmail(opts: {
    displayName?: string;
    fromAddress: string;
    fromName?: string;
    defaultQueueId?: string;
  }) {
    return this.patch('email', {
      enabled: true,
      displayName: opts.displayName ?? 'Email reference deploy',
      fromAddress: opts.fromAddress,
      fromName: opts.fromName ?? 'Verbara Reference',
      defaultQueueId: opts.defaultQueueId,
      threadingMode: 'In-Reply-To',
    });
  }

  /**
   * Voice channel uses dialer endpoints (trunks + inbound routes) rather
   * than the generic channels CRUD. Helpers below cover the surface the
   * reference deploy tests exercise.
   */
  async listTrunks() {
    const response = await this.request.get(`${API_BASE}/api/v1/dialer/trunks`, {
      headers: this.headers(),
    });
    return response;
  }

  async createMinimalTrunk(name: string) {
    return this.request.post(`${API_BASE}/api/v1/dialer/trunks`, {
      headers: this.headers(),
      data: {
        name,
        displayName: `${name} (test)`,
        host: 'sip.test.invalid',
        port: 5060,
        transport: 'udp',
        authType: 'IpAuth',
        fromUser: '+15551234567',
        callerId: '+15551234567',
        codecs: ['g711_ulaw'],
        isActive: false,
      },
    });
  }

  async deleteTrunk(trunkId: string | number) {
    return this.request.delete(`${API_BASE}/api/v1/dialer/trunks/${trunkId}`, {
      headers: this.headers(),
    });
  }

  /**
   * Provision a WebRTC endpoint for an existing agent. Used to validate
   * the SIP channel surface without needing a real softphone or trunk.
   */
  async provisionAgentWebRtc(agentUserId: string, extension: string) {
    return this.request.post(`${API_BASE}/api/v1/admin/agents/${agentUserId}/provision-webrtc`, {
      headers: this.headers(),
      data: { extension, preferredCodecs: ['ulaw', 'opus'] },
    });
  }
}
