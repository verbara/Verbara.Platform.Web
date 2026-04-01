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

  // --- Billing: Rate Cards ---

  async createRateCard(tenantId: string, data: {
    name: string;
    currency: string;
    effectiveFrom: string;
    effectiveTo?: string | null;
    isDefault: boolean;
    rates: Array<{ usageType: string; unitPrice: number; includedQuantity: number; tiers: null }>;
  }) {
    const response = await this.request.post(
      `${API_BASE}/api/management/rate-cards?tenantId=${tenantId}`,
      { data },
    );
    return response;
  }

  async listRateCards(tenantId: string) {
    const response = await this.request.get(
      `${API_BASE}/api/management/rate-cards?tenantId=${tenantId}`,
    );
    return response.json();
  }

  async deleteRateCard(tenantId: string, rateCardId: string) {
    return this.request.delete(
      `${API_BASE}/api/management/rate-cards/${rateCardId}?tenantId=${tenantId}`,
    );
  }

  // --- Billing: Invoices ---

  async generateInvoice(tenantId: string, periodStart: string, periodEnd: string) {
    const response = await this.request.post(
      `${API_BASE}/api/management/invoices/generate?tenantId=${tenantId}`,
      { data: { periodStart, periodEnd } },
    );
    return response;
  }

  async listInvoices(tenantId: string) {
    const response = await this.request.get(
      `${API_BASE}/api/management/invoices?tenantId=${tenantId}`,
    );
    return response.json();
  }

  // --- Billing: Quotas ---

  async updateQuota(tenantId: string, data: Record<string, unknown>) {
    const response = await this.request.put(
      `${API_BASE}/api/management/tenants/${tenantId}/quota`,
      { data },
    );
    return response;
  }

  async getQuotaStatus(tenantId: string) {
    const response = await this.request.get(
      `${API_BASE}/api/management/tenants/${tenantId}/quota`,
    );
    return response.json();
  }

  // --- Billing: Usage ---

  async getUsageSummary(tenantId: string) {
    const response = await this.request.get(
      `${API_BASE}/api/management/tenants/${tenantId}/usage`,
    );
    return response.json();
  }
}
