import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

test.describe('Knowledge Base', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/knowledge-base');
  });

  test('should display knowledge base page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('kb-page')).toBeVisible();
    await expect(page.getByTestId('kb-create-btn')).toBeVisible();
  });

  test('should create an article', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const title = `E2E Article ${Date.now()}`;

    await page.getByTestId('kb-create-btn').click();
    await page.getByTestId('article-form-title').fill(title);
    await page.getByTestId('article-form-content').fill('This is E2E test content for knowledge base article.');
    await page.getByTestId('article-form-submit').click();
    await page.waitForTimeout(600);

    await expect(page.getByText(title)).toBeVisible();

    const articles = await api.listArticles();
    const arr = Array.isArray(articles) ? articles : articles.items || [];
    const created = arr.find((a: any) => a.title === title);
    if (created) await api.deleteArticle(created.id);
  });

  test('should delete article with browser confirm', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const title = `E2E KB Del ${Date.now()}`;

    const res = await api.createArticle({ title, content: 'To be deleted' });
    const created = await res.json();

    await page.reload();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId(`delete-article-${created.id}`).click();
    await page.waitForTimeout(600);

    await expect(page.getByText(title)).not.toBeVisible();
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-ai-automation').click();
    await page.getByTestId('sidebar-link-knowledge-base').click();
    await expect(page).toHaveURL(/\/admin\/knowledge-base/);
  });
});
