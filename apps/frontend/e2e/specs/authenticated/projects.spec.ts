import { test, expect, dismissTip } from '../../fixtures/auth';

const projectName = (label: string) => `${label}-project-${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Projects CRUD', () => {
  test('shows the projects page', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await expect(page.getByRole('heading', { name: 'Project Directory' })).toBeVisible();
  });

  test('creates a project and navigates to detail page', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = projectName('create');

    // Open create modal
    await page.getByRole('button', { name: '+ New Project' }).click();

    // Fill name
    await page.getByPlaceholder('e.g. Morning Rituals').fill(name);

    // Fill description
    await page.getByPlaceholder('Describe the sanctuary of this project...').fill('A test project');

    // Select teal color
    await page.getByRole('button', { name: 'Teal' }).click();

    // Save — this navigates to /projects/:id
    await page.getByRole('button', { name: 'Create Project' }).click();
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+/, { timeout: 10_000 });

    // Should be on project detail page
    expect(page.url()).toMatch(/\/projects\/[a-zA-Z0-9-]+/);
  });

  test('edits a project from the projects list', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = projectName('edit');
    const updatedName = projectName('edited');

    // Create project first (this navigates to detail page)
    await page.getByRole('button', { name: '+ New Project' }).click();
    await page.getByPlaceholder('e.g. Morning Rituals').fill(name);
    await page.getByRole('button', { name: 'Create Project' }).click();
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+/, { timeout: 10_000 });

    // Go back to projects list
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Edit the project
    await page.getByRole('button', { name: `Edit project ${name}` }).click();
    await page.getByPlaceholder('e.g. Morning Rituals').clear();
    await page.getByPlaceholder('e.g. Morning Rituals').fill(updatedName);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Verify updated name shown on the projects list
    await expect(page.locator('.table-row').filter({ hasText: updatedName })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('navigates to project detail page from list', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Click the first project row to navigate to its detail page
    const projectRow = page.locator('.table-row').first();
    await expect(projectRow).toBeVisible({ timeout: 5_000 });
    await projectRow.click();

    // Angular router navigation — use waitForURL
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+/, { timeout: 10_000 });
  });
});
