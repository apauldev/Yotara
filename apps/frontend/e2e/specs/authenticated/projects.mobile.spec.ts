import type { Locator, Page } from '@playwright/test';
import { test, expect, dismissTip } from '../../fixtures/auth';

const projectName = (label: string) => `${label}-mobile-${Date.now()}`;

/** CDP touch events are needed to exercise CDK's pointer/touch drag path. */
async function touchDragByHandle(page: Page, handle: Locator, target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  await handle.scrollIntoViewIfNeeded();

  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) {
    throw new Error('Drag handle and target must both be visible');
  }

  const startX = from.x + from.width / 2;
  const startY = from.y + from.height / 2;
  const endX = to.x + to.width / 2;
  const endY = to.y + to.height / 2;

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: startY }],
  });
  for (let step = 1; step <= 12; step++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: startX + ((endX - startX) * step) / 12,
          y: startY + ((endY - startY) * step) / 12,
        },
      ],
    });
    await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test.describe('Projects mobile', () => {
  test('touch-reorders projects by the grip and the order persists', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Mobile layout: no horizontal overflow, a visible pin badge, touch-ready handle.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(page.locator('.drag-handle').first()).toHaveCSS('touch-action', 'none');
    const pinnedBadge = page.locator('.pinned-badge').first();
    if (await pinnedBadge.count()) {
      await expect(pinnedBadge).toBeVisible();
    }

    const first = projectName('First');
    const second = projectName('Second');
    for (const name of [first, second]) {
      await page.getByRole('button', { name: '+ New Project' }).click();
      await page.locator('.modal-card').getByPlaceholder('e.g. Launch website').fill(name);
      await page.getByRole('button', { name: 'Create Project' }).click();
      await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+/, { timeout: 10_000 });
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');
      await dismissTip(page);
    }

    const unpinnedRows = page.locator('.table-rows').last().locator('.table-row');
    const firstRow = unpinnedRows.filter({ hasText: first });
    const secondRow = unpinnedRows.filter({ hasText: second });
    await expect(firstRow).toBeVisible();
    await expect(secondRow).toBeVisible();

    // Drag the second project's grip above the first using touch events.
    await touchDragByHandle(page, secondRow.locator('.drag-handle'), firstRow);

    const secondComesFirst = async () => {
      const names = await unpinnedRows.locator('h3').allTextContents();
      return names.indexOf(second) !== -1 && names.indexOf(second) < names.indexOf(first);
    };
    await expect.poll(secondComesFirst).toBe(true);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await dismissTip(page);
    await expect.poll(secondComesFirst).toBe(true);
  });
});
