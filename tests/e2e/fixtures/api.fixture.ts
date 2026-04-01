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

  // --- Webhooks ---

  async createWebhookSubscription(data: {
    name: string;
    endpointUrl: string;
    eventTypes: string[];
  }) {
    const response = await this.request.post(`${API_BASE}/api/webhooks/subscriptions`, {
      data,
    });
    return response;
  }

  async listWebhookSubscriptions() {
    const response = await this.request.get(`${API_BASE}/api/webhooks/subscriptions`);
    return response.json();
  }

  async deleteWebhookSubscription(id: string) {
    return this.request.delete(`${API_BASE}/api/webhooks/subscriptions/${id}`);
  }

  // --- Retention Policy ---

  async getRetentionPolicy(tenantId: string) {
    const response = await this.request.get(
      `${API_BASE}/api/management/tenants/${tenantId}/retention`,
    );
    return response.json();
  }

  async updateRetentionPolicy(tenantId: string, data: Record<string, unknown>) {
    return this.request.put(
      `${API_BASE}/api/management/tenants/${tenantId}/retention`,
      { data },
    );
  }

  // --- Users ---

  async createUser(data: { email: string; displayName: string; role: string }) {
    return this.request.post(`${API_BASE}/api/admin/users`, { data });
  }

  async listUsers() {
    const response = await this.request.get(`${API_BASE}/api/admin/users`);
    return response.json();
  }

  async deleteUser(userId: string) {
    return this.request.delete(`${API_BASE}/api/admin/users/${userId}`);
  }

  // --- Teams ---

  async createTeam(data: { name: string }) {
    return this.request.post(`${API_BASE}/api/admin/teams`, { data });
  }

  async listTeams() {
    const response = await this.request.get(`${API_BASE}/api/admin/teams`);
    return response.json();
  }

  async deleteTeam(teamId: string) {
    return this.request.delete(`${API_BASE}/api/admin/teams/${teamId}`);
  }

  // --- Roles ---

  async createRole(data: { name: string; description?: string; sourceTemplateId?: string }) {
    return this.request.post(`${API_BASE}/api/admin/roles`, { data });
  }

  async listRoles() {
    const response = await this.request.get(`${API_BASE}/api/admin/roles`);
    return response.json();
  }

  async deleteRole(roleId: string) {
    return this.request.delete(`${API_BASE}/api/admin/roles/${roleId}`);
  }

  async cloneRole(roleId: string, newName: string) {
    return this.request.post(`${API_BASE}/api/admin/roles/${roleId}/clone`, {
      data: { name: newName },
    });
  }

  // --- Queues ---

  async createQueue(data: { name: string; isActive?: boolean }) {
    return this.request.post(`${API_BASE}/api/admin/queues`, { data });
  }

  async listQueues() {
    const response = await this.request.get(`${API_BASE}/api/admin/queues`);
    return response.json();
  }

  async deleteQueue(queueId: string) {
    return this.request.delete(`${API_BASE}/api/admin/queues/${queueId}`);
  }

  // --- Skills ---

  async createSkill(data: { name: string; category?: string; description?: string }) {
    return this.request.post(`${API_BASE}/api/admin/skills`, { data });
  }

  async listSkills() {
    const response = await this.request.get(`${API_BASE}/api/admin/skills`);
    return response.json();
  }

  async deleteSkill(skillName: string) {
    return this.request.delete(`${API_BASE}/api/admin/skills/${skillName}`);
  }

  // --- Flows ---

  async createFlow(data: { name: string; entryNodeId?: string; nodes?: unknown[] }) {
    return this.request.post(`${API_BASE}/api/admin/flows`, { data });
  }

  async listFlows() {
    const response = await this.request.get(`${API_BASE}/api/admin/flows`);
    return response.json();
  }

  // --- Surveys ---

  async createSurvey(data: { name: string; type: string; questions?: unknown[]; isActive?: boolean }) {
    return this.request.post(`${API_BASE}/api/admin/surveys`, { data });
  }

  async listSurveys() {
    const response = await this.request.get(`${API_BASE}/api/admin/surveys`);
    return response.json();
  }

  async deleteSurvey(surveyId: string) {
    return this.request.delete(`${API_BASE}/api/admin/surveys/${surveyId}`);
  }

  // --- Trunks ---

  async createTrunk(data: {
    name: string;
    displayName: string;
    type: string;
    maxChannels: number;
    isActive?: boolean;
  }) {
    return this.request.post(`${API_BASE}/api/admin/trunks`, { data });
  }

  async listTrunks() {
    const response = await this.request.get(`${API_BASE}/api/admin/trunks`);
    return response.json();
  }

  async deleteTrunk(trunkId: number) {
    return this.request.delete(`${API_BASE}/api/admin/trunks/${trunkId}`);
  }

  // --- Routes ---

  async createRoute(data: {
    pattern: string;
    patternType: string;
    trunkId: number;
    priority: number;
    dialPrefix?: string;
  }) {
    return this.request.post(`${API_BASE}/api/admin/routes`, { data });
  }

  async listRoutes() {
    const response = await this.request.get(`${API_BASE}/api/admin/routes`);
    return response.json();
  }

  async deleteRoute(routeId: number) {
    return this.request.delete(`${API_BASE}/api/admin/routes/${routeId}`);
  }

  // --- Caller ID Pools ---

  async createCallerIdPool(data: { name: string }) {
    return this.request.post(`${API_BASE}/api/admin/caller-id-pools`, { data });
  }

  async listCallerIdPools() {
    const response = await this.request.get(`${API_BASE}/api/admin/caller-id-pools`);
    return response.json();
  }

  async deleteCallerIdPool(poolId: number) {
    return this.request.delete(`${API_BASE}/api/admin/caller-id-pools/${poolId}`);
  }

  // --- DNC Lists ---

  async createDncList(data: { name: string; scope?: string }) {
    return this.request.post(`${API_BASE}/api/admin/dnc-lists`, { data });
  }

  async listDncLists() {
    const response = await this.request.get(`${API_BASE}/api/admin/dnc-lists`);
    return response.json();
  }

  async deleteDncList(listId: number) {
    return this.request.delete(`${API_BASE}/api/admin/dnc-lists/${listId}`);
  }

  // --- Holiday Calendars ---

  async createHolidayCalendar(data: { name: string }) {
    return this.request.post(`${API_BASE}/api/admin/holiday-calendars`, { data });
  }

  async listHolidayCalendars() {
    const response = await this.request.get(`${API_BASE}/api/admin/holiday-calendars`);
    return response.json();
  }

  async deleteHolidayCalendar(calendarId: number) {
    return this.request.delete(`${API_BASE}/api/admin/holiday-calendars/${calendarId}`);
  }

  // --- Bots ---

  async createBot(data: { name: string; maxTurns?: number; isActive?: boolean }) {
    return this.request.post(`${API_BASE}/api/admin/bots`, { data });
  }

  async listBots() {
    const response = await this.request.get(`${API_BASE}/api/admin/bots`);
    return response.json();
  }

  async deleteBot(botId: string) {
    return this.request.delete(`${API_BASE}/api/admin/bots/${botId}`);
  }

  // --- Knowledge Base ---

  async createArticle(data: {
    title: string;
    content: string;
    tags?: string[];
    isPublished?: boolean;
  }) {
    return this.request.post(`${API_BASE}/api/admin/articles`, { data });
  }

  async listArticles() {
    const response = await this.request.get(`${API_BASE}/api/admin/articles`);
    return response.json();
  }

  async deleteArticle(articleId: string) {
    return this.request.delete(`${API_BASE}/api/admin/articles/${articleId}`);
  }

  // --- Reports ---

  async createReport(data: { name: string; type: string; schedule: string; format: string }) {
    return this.request.post(`${API_BASE}/api/admin/reports`, { data });
  }

  async deleteReport(reportId: number) {
    return this.request.delete(`${API_BASE}/api/admin/reports/${reportId}`);
  }
}
