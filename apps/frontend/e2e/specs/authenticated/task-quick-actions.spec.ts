import { test, expect, dismissTip } from '../../fixtures/auth';

test.describe.configure({ mode: 'serial' });

const taskName = (label: string) => `quick-actions-${label}-${Date.now()}`;

async function createInboxTask(page: import('@playwright/test').Page, name: string) {
  await page.goto('/tasks?view=inbox');
  await page.waitForLoadState('networkidle');
  await dismissTip(page);

  const captureInput = page.getByPlaceholder("What's on your mind today?");
  await captureInput.fill(name);
  await captureInput.press('Enter');

  const card = page.locator('article.task-card').filter({ hasText: name }).first();
  await expect(card).toBeVisible({ timeout: 10_000 });
  return card;
}

test.describe('Task quick actions', () => {
  test('saves staged changes on outside click and discards on Escape', async ({ page }) => {
    const name = taskName('save');
    const card = await createInboxTask(page, name);
    const trigger = card.getByRole('button', { name: `Quick actions for ${name}` });

    let patchCount = 0;
    page.on('request', (request) => {
      if (request.method() === 'PATCH' && new URL(request.url()).pathname.startsWith('/tasks/')) {
        patchCount += 1;
      }
    });

    await trigger.click();
    const dialog = page.getByRole('dialog', { name: `Quick actions for ${name}` });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'High', exact: true }).click();

    const updateResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        new URL(response.url()).pathname.startsWith('/tasks/'),
    );
    // The popover has no backdrop; click the non-interactive page heading to
    // exercise an outside click without depending on a screen coordinate.
    await page.getByRole('heading', { name: 'Inbox' }).click();
    expect((await updateResponse).ok()).toBeTruthy();
    await expect(page.getByText('Task updated', { exact: true })).toBeVisible();
    await expect(card.locator('.priority-chip')).toHaveClass(/priority-chip-high/);
    await expect(trigger).toBeEnabled();

    await trigger.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Low', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(card.locator('.priority-chip')).toHaveClass(/priority-chip-high/);
    await page.waitForLoadState('networkidle');
    expect(patchCount).toBe(1);
  });

  test('keeps the trigger and quick actions panel within a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    const name = taskName('mobile');
    const card = await createInboxTask(page, name);
    const trigger = card.getByRole('button', { name: `Quick actions for ${name}` });

    const triggerBox = await trigger.boundingBox();
    expect(triggerBox?.width).toBeGreaterThanOrEqual(44);
    expect(triggerBox?.height).toBeGreaterThanOrEqual(44);

    await trigger.click();
    const dialog = page.getByRole('dialog', { name: `Quick actions for ${name}` });
    await expect(dialog).toBeVisible();

    const panelBox = await dialog.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox!.x).toBeGreaterThanOrEqual(0);
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(360);

    const labelFilter = dialog.getByRole('textbox', { name: 'Filter labels' });
    const filterBox = await labelFilter.boundingBox();
    expect(filterBox?.height).toBeGreaterThanOrEqual(44);
  });
});
