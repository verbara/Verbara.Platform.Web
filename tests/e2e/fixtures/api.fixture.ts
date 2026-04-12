import { type APIRequestContext } from '@playwright/test';
import { generate as generateTotp } from 'otplib';
import { API_BASE, PLATFORM_ADMIN } from '../helpers/credentials';

export class ApiHelper {
  constructor(private readonly request: APIRequestContext) {}

  /**
   * Tenant that the authenticated request context is scoped to.
   * The auth fixture bakes PLATFORM_ADMIN.tenantId into X-Tenant-Id, so
   * any user created via this helper lives in that tenant.
   */
  readonly tenantId = PLATFORM_ADMIN.tenantId;

  async createTenant(data: {
    tenantId: string;
    name: string;
    type?: number;
    maxConcurrentChannels?: number;
    maxActiveCampaigns?: number;
  }) {
    const response = await this.request.post(`${API_BASE}/api/v1/management/tenants`, {
      data: { type: 2, maxConcurrentChannels: 100, maxActiveCampaigns: 10, ...data },
    });
    return response;
  }

  async deleteTenant(tenantId: string) {
    return this.request.delete(`${API_BASE}/api/v1/management/tenants/${tenantId}`);
  }

  async getSystemSettings() {
    const response = await this.request.get(`${API_BASE}/api/v1/management/system/settings`);
    return response.json();
  }

  async updateSystemSettings(data: Record<string, unknown>) {
    return this.request.put(`${API_BASE}/api/v1/management/system/settings`, { data });
  }

  async getAuthConfig() {
    const response = await this.request.get(`${API_BASE}/api/v1/admin/auth/config`, {
      headers: { 'X-Tenant-Id': PLATFORM_ADMIN.tenantId },
    });
    return response.json();
  }

  async updateAuthConfig(data: Record<string, unknown>) {
    return this.request.put(`${API_BASE}/api/v1/admin/auth/config`, {
      data,
      headers: { 'X-Tenant-Id': PLATFORM_ADMIN.tenantId },
    });
  }

  async login(tenantId: string, email: string, password: string) {
    const response = await this.request.post(`${API_BASE}/api/v1/auth/login`, {
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
      `${API_BASE}/api/v1/management/rate-cards?tenantId=${tenantId}`,
      { data },
    );
    return response;
  }

  async listRateCards(tenantId: string) {
    const response = await this.request.get(
      `${API_BASE}/api/v1/management/rate-cards?tenantId=${tenantId}`,
    );
    return response.json();
  }

  async deleteRateCard(tenantId: string, rateCardId: string) {
    return this.request.delete(
      `${API_BASE}/api/v1/management/rate-cards/${rateCardId}?tenantId=${tenantId}`,
    );
  }

  // --- Billing: Invoices ---

  async generateInvoice(tenantId: string, periodStart: string, periodEnd: string) {
    const response = await this.request.post(
      `${API_BASE}/api/v1/management/invoices/generate?tenantId=${tenantId}`,
      { data: { periodStart, periodEnd } },
    );
    return response;
  }

  async listInvoices(tenantId: string) {
    const response = await this.request.get(
      `${API_BASE}/api/v1/management/invoices?tenantId=${tenantId}`,
    );
    return response.json();
  }

  // --- Billing: Quotas ---

  async updateQuota(tenantId: string, data: Record<string, unknown>) {
    const response = await this.request.put(
      `${API_BASE}/api/v1/management/tenants/${tenantId}/quota`,
      { data },
    );
    return response;
  }

  async getQuotaStatus(tenantId: string) {
    const response = await this.request.get(
      `${API_BASE}/api/v1/management/tenants/${tenantId}/quota`,
    );
    return response.json();
  }

  // --- Billing: Usage ---

  async getUsageSummary(tenantId: string) {
    const response = await this.request.get(
      `${API_BASE}/api/v1/management/tenants/${tenantId}/usage`,
    );
    return response.json();
  }

  // --- Webhooks ---

  async createWebhookSubscription(data: {
    name: string;
    endpointUrl: string;
    eventTypes: string[];
  }) {
    const response = await this.request.post(`${API_BASE}/api/v1/webhooks/subscriptions`, {
      data,
    });
    return response;
  }

  async listWebhookSubscriptions() {
    const response = await this.request.get(`${API_BASE}/api/v1/webhooks/subscriptions`);
    return response.json();
  }

  async deleteWebhookSubscription(id: string) {
    return this.request.delete(`${API_BASE}/api/v1/webhooks/subscriptions/${id}`);
  }

  // --- Retention Policy ---

  async getRetentionPolicy(tenantId: string) {
    const response = await this.request.get(
      `${API_BASE}/api/v1/management/tenants/${tenantId}/retention`,
    );
    return response.json();
  }

  async updateRetentionPolicy(tenantId: string, data: Record<string, unknown>) {
    return this.request.put(
      `${API_BASE}/api/v1/management/tenants/${tenantId}/retention`,
      { data },
    );
  }

  // --- Users ---

  async createUser(data: {
    email: string;
    displayName: string;
    role: string;
    password?: string;
  }) {
    return this.request.post(`${API_BASE}/api/v1/admin/users`, { data });
  }

  /**
   * Provisions a test user with MFA already enrolled and returns the
   * plaintext recovery codes so tests can exercise the recovery-code login
   * path. The user is created via the authenticated admin context, then the
   * helper performs its own unauthenticated login + MFA setup/confirm cycle
   * using the freshly generated TOTP secret.
   */
  async setupTestUserWithMfa(
    email: string,
    password: string,
  ): Promise<{ recoveryCodes: string[] }> {
    // Step 1: create the user with a known password
    const createRes = await this.createUser({
      email,
      displayName: email,
      role: 'Agent',
      password,
    });
    if (!createRes.ok()) {
      throw new Error(
        `setupTestUserWithMfa: createUser failed: ${createRes.status()} ${await createRes.text()}`,
      );
    }

    // Step 2: log in as that user to obtain a JWT for the MFA setup endpoints
    const loginRes = await this.request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { tenantId: this.tenantId, email, password },
    });
    if (!loginRes.ok()) {
      throw new Error(
        `setupTestUserWithMfa: login failed: ${loginRes.status()} ${await loginRes.text()}`,
      );
    }
    const loginBody = (await loginRes.json()) as { accessToken?: string };
    const accessToken = loginBody.accessToken;
    if (!accessToken) {
      throw new Error('setupTestUserWithMfa: login response missing accessToken');
    }

    const authHeaders = {
      Authorization: `Bearer ${accessToken}`,
      'X-Tenant-Id': this.tenantId,
    };

    // Step 3: initiate MFA setup — backend returns secret + plaintext recovery codes
    const setupRes = await this.request.post(`${API_BASE}/api/v1/auth/mfa/setup`, {
      headers: authHeaders,
    });
    if (!setupRes.ok()) {
      throw new Error(
        `setupTestUserWithMfa: mfa/setup failed: ${setupRes.status()} ${await setupRes.text()}`,
      );
    }
    const { secret, recoveryCodes } = (await setupRes.json()) as {
      secret: string;
      recoveryCodes: string[];
    };

    // Step 4: confirm MFA with a TOTP code derived from the secret
    const code = await generateTotp({ secret });
    const confirmRes = await this.request.post(`${API_BASE}/api/v1/auth/mfa/confirm`, {
      headers: authHeaders,
      data: { code },
    });
    if (!confirmRes.ok()) {
      throw new Error(
        `setupTestUserWithMfa: mfa/confirm failed: ${confirmRes.status()} ${await confirmRes.text()}`,
      );
    }

    return { recoveryCodes };
  }

  async listUsers() {
    const response = await this.request.get(`${API_BASE}/api/v1/admin/users`);
    return response.json();
  }

  async deleteUser(userId: string) {
    return this.request.delete(`${API_BASE}/api/v1/admin/users/${userId}`);
  }

  // --- Teams ---

  async createTeam(data: { name: string }) {
    return this.request.post(`${API_BASE}/api/v1/admin/teams`, { data });
  }

  async listTeams() {
    const response = await this.request.get(`${API_BASE}/api/v1/admin/teams`);
    return response.json();
  }

  async deleteTeam(teamId: string) {
    return this.request.delete(`${API_BASE}/api/v1/admin/teams/${teamId}`);
  }

  // --- Roles ---

  async createRole(data: { name: string; description?: string; sourceTemplateId?: string }) {
    return this.request.post(`${API_BASE}/api/v1/admin/roles`, { data });
  }

  async listRoles() {
    const response = await this.request.get(`${API_BASE}/api/v1/admin/roles`);
    return response.json();
  }

  async deleteRole(roleId: string) {
    return this.request.delete(`${API_BASE}/api/v1/admin/roles/${roleId}`);
  }

  async cloneRole(roleId: string, newName: string) {
    return this.request.post(`${API_BASE}/api/v1/admin/roles/${roleId}/clone`, {
      data: { name: newName },
    });
  }

  // --- Queues ---

  async createQueue(data: { name: string; isActive?: boolean }) {
    return this.request.post(`${API_BASE}/api/v1/admin/queues`, { data });
  }

  async listQueues() {
    const response = await this.request.get(`${API_BASE}/api/v1/admin/queues`);
    // Endpoint returns PagedResult<QueueDto>: { items, totalCount, page, pageSize }.
    // Return the items array so callers can `.find(...)` without unwrapping.
    const body = await response.json();
    return Array.isArray(body) ? body : body.items ?? [];
  }

  async deleteQueue(queueId: string) {
    return this.request.delete(`${API_BASE}/api/v1/admin/queues/${queueId}`);
  }

  // --- Skills ---

  async createSkill(data: { name: string; category?: string; description?: string }) {
    return this.request.post(`${API_BASE}/api/v1/admin/skills`, { data });
  }

  async listSkills() {
    const response = await this.request.get(`${API_BASE}/api/v1/admin/skills`);
    return response.json();
  }

  async deleteSkill(skillName: string) {
    return this.request.delete(`${API_BASE}/api/v1/admin/skills/${skillName}`);
  }

  // --- Flows ---

  async createFlow(data: { name: string; entryNodeId?: string; nodes?: unknown[] }) {
    return this.request.post(`${API_BASE}/api/v1/admin/flows`, { data });
  }

  async listFlows() {
    const response = await this.request.get(`${API_BASE}/api/v1/admin/flows`);
    return response.json();
  }

  // --- Surveys ---

  async createSurvey(data: { name: string; type: string; questions?: unknown[]; isActive?: boolean }) {
    return this.request.post(`${API_BASE}/api/v1/admin/surveys`, { data });
  }

  async listSurveys() {
    const response = await this.request.get(`${API_BASE}/api/v1/admin/surveys`);
    return response.json();
  }

  async deleteSurvey(surveyId: string) {
    return this.request.delete(`${API_BASE}/api/v1/admin/surveys/${surveyId}`);
  }

  // --- Trunks ---

  async createTrunk(data: {
    name: string;
    displayName: string;
    type: string;
    maxChannels: number;
    isActive?: boolean;
  }) {
    return this.request.post(`${API_BASE}/api/v1/admin/trunks`, { data });
  }

  async listTrunks() {
    const response = await this.request.get(`${API_BASE}/api/v1/admin/trunks`);
    return response.json();
  }

  async deleteTrunk(trunkId: number) {
    return this.request.delete(`${API_BASE}/api/v1/admin/trunks/${trunkId}`);
  }

  // --- Routes ---

  async createRoute(data: {
    pattern: string;
    patternType: string;
    trunkId: number;
    priority: number;
    dialPrefix?: string;
  }) {
    return this.request.post(`${API_BASE}/api/v1/admin/routes`, { data });
  }

  async listRoutes() {
    const response = await this.request.get(`${API_BASE}/api/v1/admin/routes`);
    return response.json();
  }

  async deleteRoute(routeId: number) {
    return this.request.delete(`${API_BASE}/api/v1/admin/routes/${routeId}`);
  }

  // --- Caller ID Pools ---

  async createCallerIdPool(data: { name: string }) {
    return this.request.post(`${API_BASE}/api/v1/admin/caller-id-pools`, { data });
  }

  async listCallerIdPools() {
    const response = await this.request.get(`${API_BASE}/api/v1/admin/caller-id-pools`);
    return response.json();
  }

  async deleteCallerIdPool(poolId: number) {
    return this.request.delete(`${API_BASE}/api/v1/admin/caller-id-pools/${poolId}`);
  }

  // --- DNC Lists ---

  async createDncList(data: { name: string; scope?: string }) {
    return this.request.post(`${API_BASE}/api/v1/admin/dnc-lists`, { data });
  }

  async listDncLists() {
    const response = await this.request.get(`${API_BASE}/api/v1/admin/dnc-lists`);
    return response.json();
  }

  async deleteDncList(listId: number) {
    return this.request.delete(`${API_BASE}/api/v1/admin/dnc-lists/${listId}`);
  }

  // --- Holiday Calendars ---

  async createHolidayCalendar(data: { name: string }) {
    return this.request.post(`${API_BASE}/api/v1/admin/holiday-calendars`, { data });
  }

  async listHolidayCalendars() {
    const response = await this.request.get(`${API_BASE}/api/v1/admin/holiday-calendars`);
    return response.json();
  }

  async deleteHolidayCalendar(calendarId: number) {
    return this.request.delete(`${API_BASE}/api/v1/admin/holiday-calendars/${calendarId}`);
  }

  // --- Bots ---

  async createBot(data: { name: string; maxTurns?: number; isActive?: boolean }) {
    return this.request.post(`${API_BASE}/api/v1/admin/bots`, { data });
  }

  async listBots() {
    const response = await this.request.get(`${API_BASE}/api/v1/admin/bots`);
    return response.json();
  }

  async deleteBot(botId: string) {
    return this.request.delete(`${API_BASE}/api/v1/admin/bots/${botId}`);
  }

  // --- Knowledge Base ---

  async createArticle(data: {
    title: string;
    content: string;
    tags?: string[];
    isPublished?: boolean;
  }) {
    return this.request.post(`${API_BASE}/api/v1/admin/articles`, { data });
  }

  async listArticles() {
    const response = await this.request.get(`${API_BASE}/api/v1/admin/articles`);
    return response.json();
  }

  async deleteArticle(articleId: string) {
    return this.request.delete(`${API_BASE}/api/v1/admin/articles/${articleId}`);
  }

  // --- Reports ---

  async createReport(data: { name: string; type: string; schedule: string; format: string; isActive?: boolean }) {
    const response = await this.request.post(`${API_BASE}/api/v1/admin/reports`, { data });
    return response.json();
  }

  async deleteReport(reportId: number) {
    return this.request.delete(`${API_BASE}/api/v1/admin/reports/${reportId}`);
  }
}
