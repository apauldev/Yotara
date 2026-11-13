import { test, expect, dismissTip } from '../../fixtures/auth';

test('shows read-only events beside completable tasks in the day agenda', async ({ page }) => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const source = {
    id: 'e2e-calendar-source',
    name: 'Work',
    color: 'teal',
    enabled: true,
    host: 'example.test',
    eventCount: 1,
    lastFetchedAt: new Date().toISOString(),
    lastSuccessAt: new Date().toISOString(),
    lastError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  let connected = false;
  await page.route(/\/calendar\/sources(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      connected = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(source),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(connected ? [source] : []),
    });
  });
  await page.route(/\/calendar\/events(?:\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'e2e-calendar-event',
          sourceId: 'e2e-calendar-source',
          sourceName: 'Work',
          sourceColor: 'teal',
          summary: 'Team offsite',
          description: 'Planning day',
          location: 'Room 3',
          allDay: true,
          dayKeys: [today],
          startTime: null,
          endTime: null,
          floating: false,
          timezone: 'UTC',
          status: 'CONFIRMED',
        },
      ]),
    }),
  );

  await page.goto('/tasks?view=inbox');
  await page.waitForLoadState('networkidle');
  await dismissTip(page);
  const taskName = `agenda-task-${Date.now()}`;
  const capture = page.getByPlaceholder("What's on your mind today?");
  await capture.fill(`${taskName} today`);
  await capture.press('Enter');
  await expect(capture).toHaveValue('');

  await page.goto('/settings');
  await page.getByLabel('Calendar URL').fill('https://example.test/private-calendar.ics');
  await page.getByLabel('Name optional').fill('Work');
  await page.getByRole('button', { name: 'Connect calendar' }).click();
  await expect(page.getByText('Connected — 1 events found.')).toBeVisible();
  await expect(page.locator('#calendars')).toContainText('example.test');

  await page.getByRole('link', { name: 'Calendar' }).click();
  const eventButton = page.locator('.agenda').getByRole('button', { name: /Event: Team offsite/ });
  await expect(eventButton).toBeVisible();
  await eventButton.click();
  const details = page.getByRole('dialog', { name: 'Team offsite' });
  await expect(details).toBeVisible();
  await expect(
    details.getByText('From Work calendar · Read-only.', { exact: false }),
  ).toBeVisible();
  await expect(details.getByRole('button', { name: /complete|delete|edit/i })).toHaveCount(0);

  await details.getByRole('button', { name: 'Close event details' }).click();
  const taskChip = page.locator('.agenda app-calendar-task-chip').filter({ hasText: taskName });
  await expect(taskChip).toBeVisible();
  await taskChip.getByRole('button', { name: `Mark ${taskName} as complete` }).click();
  await expect(taskChip).toHaveCount(0);
  await expect(eventButton).toBeVisible();
});
