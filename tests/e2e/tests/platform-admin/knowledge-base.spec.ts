import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';
import { DEMO_ADMIN } from '../../helpers/credentials';

test.describe('Knowledge Base', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/admin/knowledge-base');
  });

  test('should display knowledge base page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('kb-page')).toBeVisible();
    await expect(page.getByTestId('kb-create-btn')).toBeVisible();
  });

  test('should create an article', async ({ demoAdminPage: page, demoApiContext }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const title = `E2E Article ${Date.now()}`;

    await page.getByTestId('kb-create-btn').click();
    await page.getByTestId('article-form-title').fill(title);
    await page
      .getByTestId('article-form-content')
      .fill('This is E2E test content for knowledge base article.');
    await page.getByTestId('article-form-submit').click();

    await page.getByTestId('data-table-search').fill(title);
    await expect(page.getByTestId('data-table').getByText(title)).toBeVisible({ timeout: 5000 });

    const articles = await api.listArticles();
    const arr = Array.isArray(articles) ? articles : articles.items || [];
    const created = arr.find((a: any) => a.title === title);
    if (created) await api.deleteArticle(created.id);
  });

  test('should delete article with browser confirm', async ({
    demoAdminPage: page,
    demoApiContext,
  }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const title = `E2E KB Del ${Date.now()}`;

    const res = await api.createArticle({ title, content: 'To be deleted' });
    const created = await res.json();

    await page.reload();
    await page.getByTestId('data-table-search').fill(title);
    await expect(page.getByTestId('data-table').getByText(title)).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId(`delete-article-${created.id}`).click();

    // Keep the filter applied: clearing it here races with the post-delete refetch, which
    // remounts the table and detaches the search input mid-fill. Asserting the row is gone
    // while still filtered to it is both simpler and a stronger check.
    await expect(page.getByTestId('data-table').getByText(title)).not.toBeVisible();
  });

  test('should navigate via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-ai-automation').click();
    await page.getByTestId('sidebar-link-knowledge-base').click();
    await expect(page).toHaveURL(/\/admin\/knowledge-base/);
  });
});
