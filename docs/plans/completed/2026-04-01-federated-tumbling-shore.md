# E2E Sprint 2: Tenant Administration — Plan de Implementacion

## Contexto

Platform.Web tiene 19 spec files (116 tests) cubriendo solo paginas Platform Admin (login, setup, system, diagnostics, auth, audit, tenants, billing, webhooks, GDPR, cluster). **20+ paginas de administracion de tenant no tienen cobertura E2E ni data-testid attributes.** Sprint 2 agrega ~100 tests para estas paginas.

**Estado actual:** 116 tests, 19 specs, `tests/e2e/tests/platform-admin/`
**Objetivo:** ~216 tests, ~37 specs, mismo directorio

---

## Hallazgos: Paginas Sin Cobertura

### Inventario Completo (20 paginas, 8 sidebar groups)

| # | Pagina | Ruta | Sidebar Group | Sidebar Key | Patron Delete | Form Type |
|---|--------|------|---------------|-------------|---------------|-----------|
| 1 | Users | `/admin/users` | people | `users` | ConfirmDialog (detail) | Sheet |
| 2 | User Detail | `/admin/users/:userId` | — | — | ConfirmDialog (instant) | — |
| 3 | Agents | `/admin/agents` | people | `agents` | ConfirmDialog (detail) | Sheet |
| 4 | Teams | `/admin/teams` | people (bajo agents)| `teams` | ConfirmDialog (instant) | Dialog |
| 5 | Roles | `/admin/roles` | people | `roles` | ConfirmDialog (instant) | Dialog |
| 6 | Role Detail | `/admin/roles/:id` | — | — | — | Inline |
| 7 | Channels | `/admin/channels` | communication | `channels` | — | Sheet (config) |
| 8 | Queues | `/admin/queues` | communication | `queues` | ConfirmDialog (detail) | Sheet |
| 9 | Skills | `/admin/skills` | communication | `skills` | `window.confirm()` | Sheet |
| 10 | Flows | `/admin/flows` | communication | `flows` | — | Auto-create |
| 11 | Campaigns | `/admin/campaigns` | communication | `campaigns` | — | Wizard (`/new`) |
| 12 | Surveys | `/admin/surveys` | communication | `surveys` | ConfirmDeleteDialog (3s) | Sheet |
| 13 | Trunks | `/admin/trunks` | telephony | `trunks` | ConfirmDeleteDialog (3s) | Sheet |
| 14 | Routes | `/admin/routes` | telephony | `routes` | ConfirmDeleteDialog (3s) | Sheet |
| 15 | Caller ID Pools | `/admin/caller-id-pools` | telephony | `caller-id-pools` | ConfirmDeleteDialog (3s) | Dialog |
| 16 | DNC Lists | `/admin/dnc-lists` | compliance | `dnc-lists` | ConfirmDeleteDialog (3s) | Dialog |
| 17 | Holiday Calendars | `/admin/holiday-calendars` | compliance | `holiday-calendars` | ConfirmDeleteDialog (3s) | Dialog |
| 18 | Bots | `/admin/bots` | ai-automation | `bots` | ConfirmDeleteDialog (3s) | Sheet |
| 19 | Knowledge Base | `/admin/knowledge-base` | ai-automation | `knowledge-base` | `window.confirm()` | Sheet |
| 20 | Dialer Settings | `/admin/dialer-settings` | system | `dialer-settings` | — | Config form |
| 21 | Realtime | `/admin/realtime` | system | `realtime` | ConfirmDialog (instant) | Sheet |
| 22 | Reports | `/admin/reports` | system | `reports` | ConfirmDeleteDialog (3s) | Sheet |

### Decisiones de Diseño

1. **Fixture:** `platformAdminPage` + `authenticatedApiContext` para TODOS los tests (consistente con Sprint 1, tiene todos los permisos)
2. **Directorio:** `tests/e2e/tests/platform-admin/` (mismo directorio, no crear nuevo)
3. **Flow Designer:** SKIP — XY Flow canvas no es testable en E2E sin esfuerzo extremo
4. **Campaign Wizard:** Solo tests de navegacion (display page + navigate to wizard + wizard step 1 visible)
5. **DnD Routes:** No test de reorder. Solo verificar que tabla sortable es visible. CRUD via form normal.
6. **Agent Assist:** SKIP — config page demasiado compleja (600+ lineas, keyword rules, compliance rules)
7. **Detail pages:** Solo User Detail (mayor valor). Otros details solo test de navegacion (row click → URL cambia).
8. **Skills/KB `window.confirm()`:** Usar `page.once('dialog', d => d.accept())` de Playwright

### Patrones de Delete (3 tipos)

| Patron | Componente | Testid del boton confirm | Espera |
|--------|-----------|--------------------------|--------|
| ConfirmDeleteDialog | `core/ui/confirm-delete-dialog.tsx` | `confirm-delete-btn` | 3.5s countdown |
| ConfirmDialog | `admin/shared/confirm-dialog.tsx` | `confirm-dialog-confirm` | Instant |
| Browser dialog | `window.confirm()` | N/A | `page.once('dialog')` |

---

## Plan de Implementacion

### Archivos a Modificar: ~32 archivos (data-testids)

### Archivos a Crear: 18 spec files (100 tests)

### Archivos a Extender: 1 archivo (api.fixture.ts — ~40 metodos nuevos)

---

## Fase A: Data-testid Instrumentation + ApiHelper (paralelo, 6 subagents)

Cada pagina necesita testids en:
- Container: `data-testid="{resource}-page"` en el div raiz
- Create button: `data-testid="{resource}-create-btn"`
- Row edit: `data-testid="edit-{resource}-{id}"`
- Row delete: `data-testid="delete-{resource}-{id}"`
- Form fields: `data-testid="{resource}-form-{field}"`
- Form submit: `data-testid="{resource}-form-submit"`

### A-1: People testids (4 archivos)

**`src/admin/users/users-page.tsx`:**
- Outer div: `data-testid="users-page"`
- Create Button: `data-testid="users-create-btn"`

**`src/admin/users/user-form.tsx`:**
- Email Input: `data-testid="user-form-email"`
- DisplayName Input: `data-testid="user-form-displayName"`
- Role SelectTrigger: `data-testid="user-form-role"`
- Status SelectTrigger: `data-testid="user-form-status"`
- Submit Button: `data-testid="user-form-submit"`

**`src/admin/users/user-detail.tsx`:**
- Container div: `data-testid="user-detail-page"`
- Edit button: `data-testid="user-edit-btn"`
- Delete button: `data-testid="user-delete-btn"`

**`src/admin/agents/agents-page.tsx`:**
- Outer div: `data-testid="agents-page"`
- Create Button: `data-testid="agents-create-btn"`

### A-2: Teams + Roles testids (3 archivos)

**`src/admin/agents/teams-page.tsx`:**
- Outer div: `data-testid="teams-page"`
- Create Button: `data-testid="teams-create-btn"`
- Edit button en actions column: `data-testid={`edit-team-${info.row.original.id}`}`
- Delete button en actions column: `data-testid={`delete-team-${info.row.original.id}`}`
- Dialog name Input: `data-testid="team-form-name"` (add `id="teamName"` ya existe, agregar testid)
- Dialog submit Button: `data-testid="team-form-submit"`

**`src/admin/roles/roles-page.tsx`:**
- Outer div: `data-testid="roles-page"`
- Create Button: `data-testid="roles-create-btn"`
- Clone button per row: `data-testid={`clone-role-${role.roleId}`}`
- Delete button per row: `data-testid={`delete-role-${role.roleId}`}`
- Create dialog name Input: `data-testid="role-form-name"`
- Create dialog description Input: `data-testid="role-form-description"`
- Create dialog template Select: `data-testid="role-form-template"`
- Create dialog submit Button: `data-testid="role-form-submit"`
- Clone dialog name Input: `data-testid="role-clone-name"`
- Clone dialog submit Button: `data-testid="role-clone-submit"`

**`src/admin/roles/role-detail-page.tsx`:**
- Container: `data-testid="role-detail-page"`
- Save button: `data-testid="role-save-btn"`

### A-3: Communication testids (7 archivos)

**`src/admin/channels/channels-page.tsx`:**
- Outer div: `data-testid="channels-page"`

**`src/admin/queues/queues-page.tsx`:**
- Outer div: `data-testid="queues-page"`
- Create Button: `data-testid="queues-create-btn"`

**`src/admin/queues/queue-form.tsx`:**
- Name Input: `data-testid="queue-form-name"`
- Submit Button: `data-testid="queue-form-submit"`

**`src/admin/skills/skills-page.tsx`:**
- Outer div: `data-testid="skills-page"`
- Create Button: `data-testid="skills-create-btn"`
- Delete button per row: `data-testid={`delete-skill-${row.original.name}`}`

**`src/admin/skills/skill-form.tsx`:**
- Name Input: `data-testid="skill-form-name"`
- Category Input: `data-testid="skill-form-category"`
- Description Input: `data-testid="skill-form-description"`
- Submit Button: `data-testid="skill-form-submit"`

**`src/admin/flows/flow-list-page.tsx`:**
- Outer div: `data-testid="flows-page"`
- Create Button: `data-testid="flows-create-btn"`

**`src/admin/campaigns/campaign-list-page.tsx`:**
- Outer div: `data-testid="campaigns-page"`
- Create Button: `data-testid="campaigns-create-btn"`

### A-4: Telephony + Surveys testids (8 archivos)

**`src/admin/surveys/survey-list-page.tsx`:**
- Outer div: `data-testid="surveys-page"`
- Create Button: `data-testid="surveys-create-btn"`
- Delete button per row: `data-testid={`delete-survey-${row.original.id}`}`

**`src/admin/surveys/survey-form.tsx`:**
- Name Input: `data-testid="survey-form-name"`
- Type Select: `data-testid="survey-form-type"`
- Submit Button: `data-testid="survey-form-submit"`

**`src/admin/trunks/trunks-page.tsx`:**
- Outer div: `data-testid="trunks-page"`
- Create Button: `data-testid="trunks-create-btn"`
- Custom search Input: `data-testid="trunks-search"`
- Active-only checkbox: `data-testid="trunks-active-only"`
- Delete button per row: `data-testid={`delete-trunk-${info.row.original.id}`}`

**`src/admin/trunks/trunk-form.tsx`:**
- Name Input: `data-testid="trunk-form-name"`
- DisplayName Input: `data-testid="trunk-form-displayName"`
- Type Select: `data-testid="trunk-form-type"`
- MaxChannels Input: `data-testid="trunk-form-maxChannels"`
- isActive Switch: `data-testid="trunk-form-isActive"`
- Submit Button: `data-testid="trunk-form-submit"`

**`src/admin/routes/routes-page.tsx`:**
- Outer div: `data-testid="routes-page"`
- Create Button: `data-testid="routes-create-btn"`

**`src/admin/routes/route-form.tsx`:**
- Pattern Input: `data-testid="route-form-pattern"`
- PatternType Select: `data-testid="route-form-patternType"`
- Trunk Select: `data-testid="route-form-trunkId"`
- Priority Input: `data-testid="route-form-priority"`
- Submit Button: `data-testid="route-form-submit"`

**`src/admin/caller-id-pools/caller-id-pools-page.tsx`:**
- Outer div: `data-testid="caller-id-pools-page"`
- Create Button: `data-testid="caller-id-pools-create-btn"`
- Edit per row: `data-testid={`edit-pool-${row.original.id}`}`
- Delete per row: `data-testid={`delete-pool-${row.original.id}`}`
- Dialog name Input: `data-testid="pool-form-name"`
- Dialog submit: `data-testid="pool-form-submit"`

### A-5: Compliance + AI testids (6 archivos)

**`src/admin/dnc-lists/dnc-lists-page.tsx`:**
- Outer div: `data-testid="dnc-lists-page"`
- Create Button: `data-testid="dnc-lists-create-btn"`
- Delete per row: `data-testid={`delete-dnc-${row.original.id}`}`
- Dialog name Input: `data-testid="dnc-form-name"`
- Dialog submit: `data-testid="dnc-form-submit"`

**`src/admin/holiday-calendars/holiday-calendars-page.tsx`:**
- Outer div: `data-testid="holiday-calendars-page"`
- Create Button: `data-testid="holiday-calendars-create-btn"`
- Delete per row: `data-testid={`delete-calendar-${row.original.id}`}`
- Dialog name Input: `data-testid="calendar-form-name"`
- Dialog submit: `data-testid="calendar-form-submit"`

**`src/admin/bots/bot-list-page.tsx`:**
- Outer div: `data-testid="bots-page"`
- Create Button: `data-testid="bots-create-btn"`
- Delete per row: `data-testid={`delete-bot-${info.row.original.id}`}`

**`src/admin/bots/bot-form.tsx`:**
- Name Input: `data-testid="bot-form-name"`
- MaxTurns Input: `data-testid="bot-form-maxTurns"`
- isActive Switch: `data-testid="bot-form-isActive"`
- Submit Button: `data-testid="bot-form-submit"`

**`src/admin/knowledge-base/kb-list-page.tsx`:**
- Outer div: `data-testid="kb-page"`
- Create Button: `data-testid="kb-create-btn"`
- Delete per row: `data-testid={`delete-article-${row.original.id}`}`

**`src/admin/knowledge-base/kb-form.tsx`:**
- Title Input: `data-testid="article-form-title"`
- Content Textarea: `data-testid="article-form-content"`
- Tags Input: `data-testid="article-form-tags"`
- Submit Button: `data-testid="article-form-submit"`

### A-6: System testids + ApiHelper (3 archivos + 1 fixture)

**`src/admin/dialer-settings/dialer-settings-page.tsx`:**
- Container: `data-testid="dialer-settings-page"`
- Save button: `data-testid="dialer-settings-save-btn"`

**`src/admin/realtime/realtime-page.tsx`:**
- Outer div: `data-testid="realtime-page"`
- Create button: `data-testid="realtime-create-btn"`

**`src/admin/reports/reports-page.tsx`:**
- Outer div: `data-testid="reports-page"`
- Create button: `data-testid="reports-create-btn"`
- Delete per row: `data-testid={`delete-report-${row.original.id}`}`

**`tests/e2e/fixtures/api.fixture.ts`** — Agregar ~40 metodos nuevos:

```typescript
// --- Users ---
async createUser(data: { email: string; displayName: string; role: string }) {
  return this.request.post(`${API_BASE}/api/admin/users`, { data });
}
async listUsers() {
  const r = await this.request.get(`${API_BASE}/api/admin/users`);
  return r.json();
}
async deleteUser(userId: string) {
  return this.request.delete(`${API_BASE}/api/admin/users/${userId}`);
}

// --- Teams ---
async createTeam(data: { name: string }) {
  return this.request.post(`${API_BASE}/api/admin/teams`, { data });
}
async listTeams() {
  const r = await this.request.get(`${API_BASE}/api/admin/teams`);
  return r.json();
}
async deleteTeam(teamId: string) {
  return this.request.delete(`${API_BASE}/api/admin/teams/${teamId}`);
}

// --- Roles ---
async createRole(data: { name: string; description?: string; sourceTemplateId?: string }) {
  return this.request.post(`${API_BASE}/api/admin/roles`, { data });
}
async listRoles() {
  const r = await this.request.get(`${API_BASE}/api/admin/roles`);
  return r.json();
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
  const r = await this.request.get(`${API_BASE}/api/admin/queues`);
  return r.json();
}
async deleteQueue(queueId: string) {
  return this.request.delete(`${API_BASE}/api/admin/queues/${queueId}`);
}

// --- Skills ---
async createSkill(data: { name: string; category?: string; description?: string }) {
  return this.request.post(`${API_BASE}/api/admin/skills`, { data });
}
async listSkills() {
  const r = await this.request.get(`${API_BASE}/api/admin/skills`);
  return r.json();
}
async deleteSkill(skillName: string) {
  return this.request.delete(`${API_BASE}/api/admin/skills/${skillName}`);
}

// --- Flows ---
async createFlow(data: { name: string; entryNodeId?: string; nodes?: any[] }) {
  return this.request.post(`${API_BASE}/api/admin/flows`, { data });
}
async listFlows() {
  const r = await this.request.get(`${API_BASE}/api/admin/flows`);
  return r.json();
}

// --- Surveys ---
async createSurvey(data: { name: string; type: string; questions?: any[]; isActive?: boolean }) {
  return this.request.post(`${API_BASE}/api/admin/surveys`, { data });
}
async listSurveys() {
  const r = await this.request.get(`${API_BASE}/api/admin/surveys`);
  return r.json();
}
async deleteSurvey(surveyId: string) {
  return this.request.delete(`${API_BASE}/api/admin/surveys/${surveyId}`);
}

// --- Trunks ---
async createTrunk(data: { name: string; displayName: string; type: string; maxChannels: number; isActive?: boolean }) {
  return this.request.post(`${API_BASE}/api/admin/trunks`, { data });
}
async listTrunks() {
  const r = await this.request.get(`${API_BASE}/api/admin/trunks`);
  return r.json();
}
async deleteTrunk(trunkId: number) {
  return this.request.delete(`${API_BASE}/api/admin/trunks/${trunkId}`);
}

// --- Routes ---
async createRoute(data: { pattern: string; patternType: string; trunkId: number; priority: number }) {
  return this.request.post(`${API_BASE}/api/admin/routes`, { data });
}
async listRoutes() {
  const r = await this.request.get(`${API_BASE}/api/admin/routes`);
  return r.json();
}
async deleteRoute(routeId: number) {
  return this.request.delete(`${API_BASE}/api/admin/routes/${routeId}`);
}

// --- Caller ID Pools ---
async createCallerIdPool(data: { name: string }) {
  return this.request.post(`${API_BASE}/api/admin/caller-id-pools`, { data });
}
async listCallerIdPools() {
  const r = await this.request.get(`${API_BASE}/api/admin/caller-id-pools`);
  return r.json();
}
async deleteCallerIdPool(poolId: number) {
  return this.request.delete(`${API_BASE}/api/admin/caller-id-pools/${poolId}`);
}

// --- DNC Lists ---
async createDncList(data: { name: string; scope?: string }) {
  return this.request.post(`${API_BASE}/api/admin/dnc-lists`, { data });
}
async listDncLists() {
  const r = await this.request.get(`${API_BASE}/api/admin/dnc-lists`);
  return r.json();
}
async deleteDncList(listId: number) {
  return this.request.delete(`${API_BASE}/api/admin/dnc-lists/${listId}`);
}

// --- Holiday Calendars ---
async createHolidayCalendar(data: { name: string }) {
  return this.request.post(`${API_BASE}/api/admin/holiday-calendars`, { data });
}
async listHolidayCalendars() {
  const r = await this.request.get(`${API_BASE}/api/admin/holiday-calendars`);
  return r.json();
}
async deleteHolidayCalendar(calendarId: number) {
  return this.request.delete(`${API_BASE}/api/admin/holiday-calendars/${calendarId}`);
}

// --- Bots ---
async createBot(data: { name: string; maxTurns?: number; isActive?: boolean }) {
  return this.request.post(`${API_BASE}/api/admin/bots`, { data });
}
async listBots() {
  const r = await this.request.get(`${API_BASE}/api/admin/bots`);
  return r.json();
}
async deleteBot(botId: string) {
  return this.request.delete(`${API_BASE}/api/admin/bots/${botId}`);
}

// --- Knowledge Base ---
async createArticle(data: { title: string; content: string; tags?: string[]; isPublished?: boolean }) {
  return this.request.post(`${API_BASE}/api/admin/articles`, { data });
}
async listArticles() {
  const r = await this.request.get(`${API_BASE}/api/admin/articles`);
  return r.json();
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
```

**Total ApiHelper metodos nuevos: 40 (13 create + 12 list + 14 delete + 1 clone)**

---

## Fase B: Spec Files (paralelo, 5 subagents por grupo)

**Todos los specs en:** `tests/e2e/tests/platform-admin/`
**Fixture:** `platformAdminPage` + `authenticatedApiContext`
**Import:** `import { test, expect } from '../../fixtures/auth.fixture';`

### B-1: People specs (24 tests, 4 archivos)

**`users.spec.ts` (8 tests):**
1. should display users page — assert `users-page`, `users-create-btn` visible
2. should show users in data table — assert `data-table` visible with rows
3. should search users — seed user, type in `data-table-search`, verify filter
4. should create a user via form — click create, fill email/displayName/role, submit, verify row, API cleanup
5. should show validation for empty email — open form, submit empty, assert error
6. should navigate to user detail on row click — seed user, click row, assert URL `/admin/users/{id}`
7. should edit user from detail page — navigate to detail, click `user-edit-btn`, change name, submit, verify
8. should navigate via sidebar — `sidebar-group-people` → `sidebar-link-users`

**`agents.spec.ts` (5 tests):**
1. should display agents page — assert `agents-page`, `agents-create-btn`
2. should show agents in data table — seed via API (need user first), assert visible
3. should search agents — seed, search, verify
4. should navigate to agent detail on row click — seed, click row, assert URL
5. should navigate via sidebar — `sidebar-group-people` → `sidebar-link-agents`

**`teams.spec.ts` (6 tests):**
1. should display teams page — assert `teams-page`, `teams-create-btn`
2. should create a team via dialog — click create, fill `team-form-name`, click `team-form-submit`, verify row, cleanup
3. should edit a team — seed, click `edit-team-{id}`, change name, submit, verify
4. should delete a team — seed, click `delete-team-{id}`, click `confirm-dialog-confirm` (instant), verify gone
5. should search teams — seed, search, verify
6. should navigate via sidebar — nota: teams esta en ruta `/admin/teams` pero sidebar link es bajo `people`

**`roles.spec.ts` (5 tests):**
1. should display roles page — assert `roles-page`, `roles-create-btn`, table visible
2. should create a role — click create, fill `role-form-name` + `role-form-description`, click `role-form-submit`, verify row, cleanup
3. should clone a role — seed role, click `clone-role-{id}`, fill `role-clone-name`, click `role-clone-submit`, verify, cleanup both
4. should delete a non-default role — seed, click `delete-role-{id}`, confirm (instant), verify gone
5. should navigate to role detail on row click — seed role, click row, assert URL `/admin/roles/{id}`

### B-2: Communication specs (25 tests, 6 archivos)

**`channels.spec.ts` (3 tests):**
1. should display channels page — assert `channels-page`, verify channel cards visible
2. should show multiple channel cards — count channel cards ≥ 5 (core channels)
3. should navigate via sidebar — `sidebar-group-communication` → `sidebar-link-channels`

**`queues.spec.ts` (6 tests):**
1. should display queues page — assert `queues-page`, `queues-create-btn`
2. should show queues in data table — seed, assert visible
3. should create a queue — open form, fill `queue-form-name`, submit via `queue-form-submit`, verify, cleanup
4. should search queues — seed, search, verify
5. should navigate to queue detail — seed, click row, assert URL
6. should navigate via sidebar — `sidebar-group-communication` → `sidebar-link-queues`

**`skills.spec.ts` (5 tests):**
1. should display skills page — assert `skills-page`, `skills-create-btn`
2. should create a skill — open form, fill name/category, submit, verify, cleanup
3. should search skills — seed, search, verify
4. should delete with browser confirm — seed, set `page.once('dialog', d => d.accept())`, click `delete-skill-{name}`, verify gone
5. should navigate via sidebar — `sidebar-group-communication` → `sidebar-link-skills`

**`flows.spec.ts` (4 tests):**
1. should display flows page — assert `flows-page`, `flows-create-btn`
2. should show flows in data table — seed flow via API, assert row visible
3. should navigate to designer on row click — seed flow, click row, assert URL `/admin/flows/{id}`
4. should navigate via sidebar — `sidebar-group-communication` → `sidebar-link-flows`

**`campaigns.spec.ts` (3 tests):**
1. should display campaigns page — assert `campaigns-page`, `campaigns-create-btn`
2. should navigate to wizard on create — click create, assert URL `/admin/campaigns/new`
3. should navigate via sidebar — `sidebar-group-communication` → `sidebar-link-campaigns`

**`surveys.spec.ts` (4 tests):**
1. should display surveys page — assert `surveys-page`, `surveys-create-btn`
2. should create a survey — open form, fill `survey-form-name`, select type, submit, verify, cleanup
3. should delete a survey with 3s confirmation — seed, click `delete-survey-{id}`, wait 3.5s, `confirm-delete-btn`, verify gone
4. should navigate via sidebar — `sidebar-group-communication` → `sidebar-link-surveys`

### B-3: Telephony specs (16 tests, 3 archivos)

**`trunks.spec.ts` (7 tests):**
1. should display trunks page — assert `trunks-page`, `trunks-create-btn`
2. should show trunks in data table — seed, assert visible
3. should create a trunk — open form, fill name/displayName/type/maxChannels, submit, verify, cleanup
4. should search trunks by name — type in `trunks-search`, verify debounce filter
5. should filter active only — seed active+inactive, toggle `trunks-active-only`, verify
6. should delete a trunk with 3s confirmation — seed, click `delete-trunk-{id}`, wait 3.5s, confirm, verify gone
7. should navigate via sidebar — `sidebar-group-telephony` → `sidebar-link-trunks`

**`routes.spec.ts` (5 tests):**
1. should display routes page — assert `routes-page`, `routes-create-btn`
2. should show routes in sortable table — seed trunk+route via API, assert table con grip handles visible
3. should create a route — seed trunk first, open form, fill pattern/type/trunk/priority, submit, verify, cleanup
4. should delete a route with 3s confirmation — seed, click delete, wait 3.5s, confirm, verify gone
5. should navigate via sidebar — `sidebar-group-telephony` → `sidebar-link-routes`

**`caller-id-pools.spec.ts` (4 tests):**
1. should display caller ID pools page — assert `caller-id-pools-page`, `caller-id-pools-create-btn`
2. should create a pool — click create, fill `pool-form-name`, submit, verify, cleanup
3. should delete a pool with 3s confirmation — seed, click `delete-pool-{id}`, wait 3.5s, confirm, verify gone
4. should navigate via sidebar — `sidebar-group-telephony` → `sidebar-link-caller-id-pools`

### B-4: Compliance specs (8 tests, 2 archivos)

**`dnc-lists.spec.ts` (4 tests):**
1. should display DNC lists page — assert `dnc-lists-page`, `dnc-lists-create-btn`
2. should create a DNC list — click create, fill `dnc-form-name`, submit, verify, cleanup
3. should delete a DNC list with 3s confirmation — seed, click `delete-dnc-{id}`, wait 3.5s, confirm, verify gone
4. should navigate via sidebar — `sidebar-group-compliance` → `sidebar-link-dnc-lists`

**`holiday-calendars.spec.ts` (4 tests):**
1. should display holiday calendars page — assert `holiday-calendars-page`, `holiday-calendars-create-btn`
2. should create a calendar — click create, fill `calendar-form-name`, submit, verify, cleanup
3. should delete a calendar with 3s confirmation — seed, click `delete-calendar-{id}`, wait 3.5s, confirm, verify gone
4. should navigate via sidebar — `sidebar-group-compliance` → `sidebar-link-holiday-calendars`

### B-5: AI + System specs (13 tests, 5 archivos)

**`bots.spec.ts` (4 tests):**
1. should display bots page — assert `bots-page`, `bots-create-btn`
2. should create a bot — open form, fill `bot-form-name` + `bot-form-maxTurns`, submit, verify, cleanup
3. should delete a bot with 3s confirmation — seed, click `delete-bot-{id}`, wait 3.5s, confirm, verify gone
4. should navigate via sidebar — `sidebar-group-ai-automation` → `sidebar-link-bots`

**`knowledge-base.spec.ts` (4 tests):**
1. should display knowledge base page — assert `kb-page`, `kb-create-btn`
2. should create an article — open form, fill title/content, submit, verify, cleanup
3. should delete article with browser confirm — seed, `page.once('dialog', d => d.accept())`, click `delete-article-{id}`, verify gone
4. should navigate via sidebar — `sidebar-group-ai-automation` → `sidebar-link-knowledge-base`

**`dialer-settings.spec.ts` (2 tests):**
1. should display dialer settings page — assert `dialer-settings-page`, `dialer-settings-save-btn` visible
2. should navigate via sidebar — `sidebar-group-system` → `sidebar-link-dialer-settings`

**`realtime.spec.ts` (2 tests):**
1. should display endpoint profiles page — assert `realtime-page`, `realtime-create-btn` visible
2. should navigate via sidebar — `sidebar-group-system` → `sidebar-link-realtime`

**`reports.spec.ts` (1 test):**
1. should display reports page — assert `reports-page`, `reports-create-btn` visible

---

## Resumen Numerico

| Spec File | Grupo | Tests |
|-----------|-------|-------|
| users.spec.ts | People | 8 |
| agents.spec.ts | People | 5 |
| teams.spec.ts | People | 6 |
| roles.spec.ts | People | 5 |
| channels.spec.ts | Communication | 3 |
| queues.spec.ts | Communication | 6 |
| skills.spec.ts | Communication | 5 |
| flows.spec.ts | Communication | 4 |
| campaigns.spec.ts | Communication | 3 |
| surveys.spec.ts | Communication | 4 |
| trunks.spec.ts | Telephony | 7 |
| routes.spec.ts | Telephony | 5 |
| caller-id-pools.spec.ts | Telephony | 4 |
| dnc-lists.spec.ts | Compliance | 4 |
| holiday-calendars.spec.ts | Compliance | 4 |
| bots.spec.ts | AI & Automation | 4 |
| knowledge-base.spec.ts | AI & Automation | 4 |
| dialer-settings.spec.ts | System | 2 |
| realtime.spec.ts | System | 2 |
| reports.spec.ts | System | 1 |
| **TOTAL** | **20 specs** | **96 tests** |

**Resultado final:** 116 (existentes) + 96 (nuevos) = **212 tests** across 39 spec files

---

## Ejecucion (FCM Batching con Subagents)

### Phase A (paralelo, 6 subagents — data-testid instrumentation):
- **Subagent A1:** People testids — users-page, user-form, user-detail, agents-page (4 archivos)
- **Subagent A2:** Teams + Roles testids — teams-page, roles-page, role-detail-page (3 archivos)
- **Subagent A3:** Communication testids — channels-page, queues-page, queue-form, skills-page, skill-form, flows-page, campaigns-page (7 archivos)
- **Subagent A4:** Telephony + Surveys testids — surveys-page, survey-form, trunks-page, trunk-form, routes-page, route-form, caller-id-pools-page (8 archivos)
- **Subagent A5:** Compliance + AI testids — dnc-lists-page, holiday-calendars-page, bots-page, bot-form, kb-list-page, kb-form (6 archivos)
- **Subagent A6:** System testids + ApiHelper — dialer-settings-page, realtime-page, reports-page + api.fixture.ts (4 archivos)

### Phase B (paralelo, 5 subagents — spec files):
- **Subagent B1:** People specs — users.spec.ts, agents.spec.ts, teams.spec.ts, roles.spec.ts (24 tests)
- **Subagent B2:** Communication specs — channels.spec.ts, queues.spec.ts, skills.spec.ts, flows.spec.ts, campaigns.spec.ts, surveys.spec.ts (25 tests)
- **Subagent B3:** Telephony specs — trunks.spec.ts, routes.spec.ts, caller-id-pools.spec.ts (16 tests)
- **Subagent B4:** Compliance specs — dnc-lists.spec.ts, holiday-calendars.spec.ts (8 tests)
- **Subagent B5:** AI + System specs — bots.spec.ts, knowledge-base.spec.ts, dialer-settings.spec.ts, realtime.spec.ts, reports.spec.ts (13 tests)

### Phase C (secuencial):
1. `npm run build` — verificar 0 TS errors
2. `npm run e2e` — verificar 212 tests passing
3. Update CLAUDE.md con nuevo test count

---

## Referencia clave para subagents

| Archivo | Proposito |
|---------|-----------|
| `tests/e2e/fixtures/auth.fixture.ts` | Fixtures: platformAdminPage, authenticatedApiContext |
| `tests/e2e/fixtures/api.fixture.ts` | ApiHelper class (19 metodos actuales + 40 nuevos) |
| `tests/e2e/helpers/credentials.ts` | PLATFORM_ADMIN, DEMO_ADMIN, API_BASE |
| `tests/e2e/tests/platform-admin/webhooks.spec.ts` | Referencia CRUD + detail + API seeding |
| `tests/e2e/tests/platform-admin/billing-rate-cards.spec.ts` | Referencia CRUD + delete 3s + search |
| `tests/e2e/tests/platform-admin/teams.spec.ts` | (sprint 2) Referencia Dialog form + ConfirmDialog instant |
| `src/admin/shared/data-table.tsx` | Testids: data-table, data-table-search, data-table-prev/next |
| `src/admin/shared/confirm-dialog.tsx` | Testids: confirm-dialog-confirm, confirm-dialog-cancel |
| `src/core/ui/confirm-delete-dialog.tsx` | Testid: confirm-delete-btn (3s countdown) |
| `src/admin/sidebar.tsx` | Sidebar groups/links: sidebar-group-{key}, sidebar-link-{key} |

### Patron de seeding (copia de webhooks.spec.ts):
```typescript
const api = new ApiHelper(authenticatedApiContext);
const name = `E2E {Entity} ${Date.now()}`;
const res = await api.create{Entity}({ name, ... });
const created = await res.json();
await page.reload();
// ... test UI ...
// cleanup:
await api.delete{Entity}(created.id);
```

### Patron de delete 3s (ConfirmDeleteDialog):
```typescript
await page.getByTestId(`delete-{resource}-${id}`).click();
const confirmBtn = page.getByTestId('confirm-delete-btn');
await expect(confirmBtn).toBeDisabled();
await page.waitForTimeout(3500);
await expect(confirmBtn).toBeEnabled();
await confirmBtn.click();
await page.waitForTimeout(600);
await expect(page.getByText(name)).not.toBeVisible();
```

### Patron de delete instant (ConfirmDialog):
```typescript
await page.getByTestId(`delete-{resource}-${id}`).click();
await page.getByTestId('confirm-dialog-confirm').click();
await page.waitForTimeout(600);
await expect(page.getByText(name)).not.toBeVisible();
```

### Patron de browser dialog (window.confirm):
```typescript
page.once('dialog', (dialog) => dialog.accept());
await page.getByTestId(`delete-{resource}-${id}`).click();
await page.waitForTimeout(600);
await expect(page.getByText(name)).not.toBeVisible();
```

### Patron de sidebar navigation:
```typescript
await page.goto('/admin/system'); // navigate away first
await page.getByTestId('sidebar-group-{groupKey}').click();
await page.getByTestId('sidebar-link-{itemKey}').click();
await expect(page).toHaveURL(/\/admin\/{path}/);
```
