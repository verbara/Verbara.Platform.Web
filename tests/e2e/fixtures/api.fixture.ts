import { type APIRequestContext } from '@playwright/test';
import { API_BASE, PLATFORM_ADMIN } from '../helpers/credentials';

export class ApiHelper {
  constructor(private readonly request: APIRequestContext) {}

  async createTenant(data: {
    tenantId: string;
    name: string;
    type?: number;
    maxConcurrentChannels?: number;
    maxActiveCampaigns?: number;
  }) {
    const response = await this.request.post(`${API_BASE}/api/management/tenants`, {
      data: { type: 2, maxConcurrentChannels: 100, maxActiveCampaigns: 10, ...data },
    });
    return response;
  }

  async deleteTenant(tenantId: string) {
    return this.request.delete(`${API_BASE}/api/management/tenants/${tenantId}`);
  }

  async getSystemSettings() {
    const response = await this.request.get(`${API_BASE}/api/management/system/settings`);
    return response.json();
  }

  async updateSystemSettings(data: Record<string, unknown>) {
    return this.request.put(`${API_BASE}/api/management/system/settings`, { data });
  }

  async getAuthConfig() {
    const response = await this.request.get(`${API_BASE}/api/admin/auth/config`, {
      headers: { 'X-Tenant-Id': PLATFORM_ADMIN.tenantId },
    });
    return response.json();
  }

  async updateAuthConfig(data: Record<string, unknown>) {
    return this.request.put(`${API_BASE}/api/admin/auth/config`, {
      data,
      headers: { 'X-Tenant-Id': PLATFORM_ADMIN.tenantId },
    });
  }

  async login(tenantId: string, email: string, password: string) {
    const response = await this.request.post(`${API_BASE}/api/auth/login`, {
      data: { tenantId, email, password },
    });
    return response;
  }
}
