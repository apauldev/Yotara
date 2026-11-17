import { test, expect, dismissTip } from '../../fixtures/auth';
import type { Locator, Page } from '@playwright/test';

const projectName = (label: string) => `${label}-${Date.now()}`;
const taskName = (label: string) => `${label}-${Date.now()}`;

/** Drag via the CDK drag handle with realistic pointer steps so sorting updates. */
async function dragByHandle(page: Page, handle: Locator, target: Locator): Promise<void> {
  // Synthetic mouse coordinates are viewport-relative, so both rows must be on screen.
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

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Cross CDK's drag threshold first, then glide to the target.
  await page.mouse.move(startX + 10, startY + 10, { steps: 4 });
  await page.mouse.move(endX, endY, { steps: 12 });
  await page.mouse.up();
}

test.describe.configure({ mode: 'serial' });

test.describe('Projects Overhaul E2E Journeys', () => {
  test('1. Directory shows tabs with live counts and empty states', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Header and action button
    await expect(page.getByRole('heading', { name: 'Project Directory' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ New Project' })).toBeVisible();

    // Tabs: Active, Completed, Archived
    const activeTab = page.getByRole('tab', { name: /Active/i });
    const completedTab = page.getByRole('tab', { name: /Completed/i });
    const archivedTab = page.getByRole('tab', { name: /Archived/i });

    await expect(activeTab).toBeVisible();
    await expect(completedTab).toBeVisible();
    await expect(archivedTab).toBeVisible();
    await expect(activeTab).toHaveAttribute('aria-selected', 'true');

    // Switch to Completed tab
    await completedTab.click();
    await expect(completedTab).toHaveAttribute('aria-selected', 'true');

    // Switch to Archived tab
    await archivedTab.click();
    await expect(archivedTab).toHaveAttribute('aria-selected', 'true');

    // Return to Active tab
    await activeTab.click();
    await expect(activeTab).toHaveAttribute('aria-selected', 'true');
  });

  test('2. Creates a pinned finite project with Markdown brief and color identity', async ({
    page,
  }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = projectName('Alpha Launch');
    const brief = '## Core Objectives\n- Ship overhaul\n- Verify GTD calm';

    // Open create modal
    await page.getByRole('button', { name: '+ New Project' }).click();
    const modal = page.locator('.modal-card');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'New Project' })).toBeVisible();

    // Type selection: Finite Project card is selected by default
    const projectCard = modal.locator('.kind-card').filter({ hasText: 'Project' }).first();
    await expect(projectCard).toHaveAttribute('aria-checked', 'true');

    // Name
    await modal.getByPlaceholder('e.g. Launch website').fill(name);

    // Markdown description
    await modal.locator('textarea.markdown-textarea').fill(brief);

    // Color identity: Teal
    await modal.getByRole('button', { name: 'Teal' }).click();

    // Pin to sidebar
    await modal.locator('input[name="projectPinned"]').check();

    // Save project — navigates to /projects/:id
    await modal.getByRole('button', { name: 'Create Project' }).click();
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+/, { timeout: 10_000 });

    // Verify Project Detail Page
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(page.locator('.meta-label').filter({ hasText: 'Project' })).toBeVisible();

    // Verify Markdown brief rendered
    const markdownContent = page.locator('.project-description-markdown');
    await expect(markdownContent).toBeVisible();
    await expect(markdownContent.getByRole('heading', { name: 'Core Objectives' })).toBeVisible();
    await expect(markdownContent.getByText('Ship overhaul')).toBeVisible();

    // Verify Empty State
    await expect(
      page.getByRole('heading', { name: 'Start with one meaningful step' }),
    ).toBeVisible();

    // Verify pinned group in sidebar
    const pinnedGroup = page.locator('.pinned-group');
    await expect(pinnedGroup).toBeVisible();
    const pinnedItem = pinnedGroup.locator('.pinned-item').filter({ hasText: name });
    await expect(pinnedItem).toBeVisible();
    await expect(pinnedItem.locator('.pinned-count')).toHaveText('0');

    // The sidebar offers a direct unpin action, and drops the redundant
    // "New project" / "All projects" links (duplicated by the directory header
    // and the Projects nav item respectively).
    const pinnedRow = pinnedGroup.locator('.pinned-item-row').filter({ hasText: name });
    await expect(pinnedRow.locator('.pinned-unpin-button')).toHaveAttribute(
      'aria-label',
      `Unpin ${name}`,
    );
    await expect(pinnedGroup.getByText('New project', { exact: true })).toHaveCount(0);
    await expect(pinnedGroup.getByText('All projects', { exact: true })).toHaveCount(0);
  });

  test('3. Manages sections: add, inline rename, reorder, and collapse', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Create a new project for section testing
    const name = projectName('Section Space');
    await page.getByRole('button', { name: '+ New Project' }).click();
    const modal = page.locator('.modal-card');
    await modal.getByPlaceholder('e.g. Launch website').fill(name);
    await modal.getByRole('button', { name: 'Create Project' }).click();
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+/, { timeout: 10_000 });

    // Detail page: Add first section
    await page.locator('.add-section-button').first().click();
    const sectionInput = page.locator('.section-name-input');
    await expect(sectionInput).toBeVisible();
    await sectionInput.fill('Discovery');
    await sectionInput.press('Enter');

    // Section 1 is created
    const discoverySection = page.locator('.project-section').filter({ hasText: 'Discovery' });
    await expect(discoverySection).toBeVisible();

    // Add second section
    await page.locator('.add-section-button').first().click();
    const sectionInput2 = page.locator('.section-name-input');
    await sectionInput2.fill('Execution');
    await sectionInput2.press('Enter');

    const executionSection = page.locator('.project-section').filter({ hasText: 'Execution' });
    await expect(executionSection).toBeVisible();

    // Inline rename Discovery -> Planning
    await discoverySection.getByRole('button', { name: 'Section actions for Discovery' }).click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    const renameInput = discoverySection.locator('.section-name-input');
    await expect(renameInput).toBeVisible();
    await renameInput.clear();
    await renameInput.fill('Planning');
    await discoverySection.getByRole('button', { name: 'Save' }).click();

    await expect(page.locator('.project-section').filter({ hasText: 'Planning' })).toBeVisible();

    // Reorder sections: Move Execution up
    await executionSection.getByRole('button', { name: 'Section actions for Execution' }).click();
    await page.getByRole('menuitem', { name: 'Move up' }).click();

    // Verify Execution is now before Planning
    const allSections = page.locator('.project-section h3.section-name');
    await expect(allSections.first()).toHaveText('Execution');
    await expect(allSections.nth(1)).toHaveText('Planning');

    // Move Execution down again
    await page
      .locator('.project-section')
      .filter({ hasText: 'Execution' })
      .getByRole('button', { name: 'Section actions for Execution' })
      .click();
    await page.getByRole('menuitem', { name: 'Move down' }).click();
    await expect(allSections.first()).toHaveText('Planning');
    await expect(allSections.nth(1)).toHaveText('Execution');

    // Drag-to-reorder via the 6-dot handle (CDK drag-drop)
    const executionHandle = page
      .locator('.project-section')
      .filter({ hasText: 'Execution' })
      .locator('.drag-handle');
    const planningSection = page.locator('.project-section').filter({ hasText: 'Planning' });
    await dragByHandle(page, executionHandle, planningSection);
    await expect(allSections.first()).toHaveText('Execution');
    await expect(allSections.nth(1)).toHaveText('Planning');

    // Section collapse & expand
    const planningSec = page.locator('.project-section').filter({ hasText: 'Planning' });
    const collapseBtn = planningSec.getByRole('button', { name: /Collapse Planning/i });
    await expect(collapseBtn).toBeVisible();
    await collapseBtn.click();
    await expect(planningSec.getByRole('button', { name: /Expand Planning/i })).toBeVisible();
    // Expand again
    await planningSec.getByRole('button', { name: /Expand Planning/i }).click();
    await expect(planningSec.getByRole('button', { name: /Collapse Planning/i })).toBeVisible();
  });

  test('4. Adds tasks to sections and unsectioned, updates progress, and safely deletes section', async ({
    page,
  }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = projectName('Section Tasks');
    await page.getByRole('button', { name: '+ New Project' }).click();
    await page.locator('.modal-card').getByPlaceholder('e.g. Launch website').fill(name);
    await page.getByRole('button', { name: 'Create Project' }).click();
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+/, { timeout: 10_000 });

    // Create section "Milestone 1"
    await page.locator('.add-section-button').first().click();
    const sInput = page.locator('.section-name-input');
    await sInput.fill('Milestone 1');
    await sInput.press('Enter');

    const m1Section = page.locator('.project-section').filter({ hasText: 'Milestone 1' });
    await expect(m1Section).toBeVisible();

    // Add task inside Milestone 1
    const task1 = taskName('Sectioned Task');
    await m1Section.getByRole('button', { name: '+ Add task to Milestone 1' }).click();

    const taskModal = page.locator('.modal-card').filter({ hasText: 'Capture a new task' });
    await expect(taskModal).toBeVisible();
    await taskModal.locator('#task-title-input').fill(task1);
    await taskModal.getByRole('button', { name: 'Create Task' }).click();
    await expect(taskModal).not.toBeVisible();

    // Verify task1 is rendered under Milestone 1
    await expect(m1Section.locator('article.task-card').filter({ hasText: task1 })).toBeVisible();

    // Add unsectioned task via header "+ Add Task"
    const task2 = taskName('Unsectioned Task');
    await page.getByRole('button', { name: '+ Add Task', exact: true }).click();
    await expect(taskModal).toBeVisible();
    await taskModal.locator('#task-title-input').fill(task2);
    await taskModal.getByRole('button', { name: 'Create Task' }).click();
    await expect(taskModal).not.toBeVisible();

    // Verify task2 is rendered
    await expect(page.locator('article.task-card').filter({ hasText: task2 })).toBeVisible();

    // Metrics card shows 2 tasks, 0 completed, 0%
    const metricsCard = page.locator('.metrics-card');
    await expect(metricsCard).toBeVisible();
    await expect(metricsCard.getByText('2 of 2 tasks complete')).not.toBeVisible();
    await expect(metricsCard.getByText('0 of 2 tasks complete')).toBeVisible();
    await expect(metricsCard.getByText('0%')).toBeVisible();

    // Safe section deletion: delete "Milestone 1"
    await m1Section.getByRole('button', { name: 'Section actions for Milestone 1' }).click();
    await page.getByRole('menuitem', { name: 'Delete section…' }).click();

    // Confirm dialog appears
    const deleteSectionDialog = page
      .locator('.modal-card')
      .filter({ hasText: 'Delete “Milestone 1”?' });
    await expect(deleteSectionDialog).toBeVisible();
    await expect(
      deleteSectionDialog.getByText('Its tasks will stay in this project.'),
    ).toBeVisible();
    await deleteSectionDialog.getByRole('button', { name: 'Delete section' }).click();

    // Section is gone
    await expect(page.locator('.project-section')).toHaveCount(0);

    // But the task is NOT deleted! It moved to unsectioned tasks
    await expect(page.locator('article.task-card').filter({ hasText: task1 })).toBeVisible();
    await expect(page.locator('article.task-card').filter({ hasText: task2 })).toBeVisible();
  });

  test('5. Gated completion: disables complete while tasks are open, enables when finished, and supports reopen', async ({
    page,
  }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = projectName('Gated Project');
    await page.getByRole('button', { name: '+ New Project' }).click();
    await page.locator('.modal-card').getByPlaceholder('e.g. Launch website').fill(name);
    await page.getByRole('button', { name: 'Create Project' }).click();
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+/, { timeout: 10_000 });

    // Add a single task
    const tName = taskName('Solo Task');
    await page.getByRole('button', { name: '+ Add Task', exact: true }).click();
    const taskModal = page.locator('.modal-card').filter({ hasText: 'Capture a new task' });
    await taskModal.locator('#task-title-input').fill(tName);
    await taskModal.getByRole('button', { name: 'Create Task' }).click();
    await expect(taskModal).not.toBeVisible();

    const taskCard = page.locator('article.task-card').filter({ hasText: tName });
    await expect(taskCard).toBeVisible();

    // Try to complete project via header actions menu: should be gated!
    await page.getByRole('button', { name: `Project actions for ${name}` }).click();
    const menu = page.locator('.header-menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByText(/Finish or move the remaining 1 tasks first/i)).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Complete project' })).toBeDisabled();

    // Close menu by clicking elsewhere
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();

    // Complete the task
    await taskCard.getByRole('button', { name: 'Mark task complete' }).click({ force: true });
    const confirmBtn = page.getByRole('button', { name: 'Mark complete' });
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();
    await page.waitForLoadState('networkidle');

    // Progress reaches 100%
    const metricsCard = page.locator('.metrics-card');
    await expect(metricsCard.getByText('100%')).toBeVisible();

    // Open header menu again: Complete project is now ENABLED!
    await page.getByRole('button', { name: `Project actions for ${name}` }).click();
    await expect(page.locator('.header-menu')).toBeVisible();
    const completeProjectBtn = page
      .locator('.header-menu')
      .getByRole('menuitem', { name: 'Complete project' });
    await expect(completeProjectBtn).toBeEnabled();
    await completeProjectBtn.click();

    // Meta line displays "Completed" pill
    await expect(page.locator('.completed-pill')).toBeVisible();

    // Navigate to directory
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Switch to Completed tab
    const completedTab = page.getByRole('tab', { name: /Completed/i });
    await completedTab.click();

    // Project is in completed tab with 100% and Completed badge
    const projectRow = page.locator('.table-row').filter({ hasText: name });
    await expect(projectRow).toBeVisible();
    await expect(projectRow.locator('.status-badge')).toHaveText('Completed');
    await expect(projectRow.locator('.progress-label')).toHaveText('100%');

    // Reopen project from row menu
    await projectRow.getByRole('button', { name: `More actions for ${name}` }).click();
    await page.getByRole('menuitem', { name: 'Reopen project' }).click();

    // Project moves out of Completed tab
    await expect(page.locator('.table-row').filter({ hasText: name })).not.toBeVisible();

    // Switch back to Active tab
    await page.getByRole('tab', { name: /Active/i }).click();
    await expect(page.locator('.table-row').filter({ hasText: name })).toBeVisible();
  });

  test('6. Archives and restores project via directory and detail banner', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = projectName('Archive Project');
    await page.getByRole('button', { name: '+ New Project' }).click();
    await page.locator('.modal-card').getByPlaceholder('e.g. Launch website').fill(name);
    await page.getByRole('button', { name: 'Create Project' }).click();
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+/, { timeout: 10_000 });

    // Archive from project detail page menu
    await page.getByRole('button', { name: `Project actions for ${name}` }).click();
    await page.locator('.header-menu').getByRole('menuitem', { name: 'Archive project' }).click();

    // Archive banner is shown
    const archiveBanner = page.locator('.archive-banner');
    await expect(archiveBanner).toBeVisible();
    await expect(
      archiveBanner.getByText(/Archived project · Its tasks still appear/i),
    ).toBeVisible();

    // Go to projects directory
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Active tab does NOT contain it
    await expect(page.locator('.table-row').filter({ hasText: name })).not.toBeVisible();

    // Switch to Archived tab
    await page.getByRole('tab', { name: /Archived/i }).click();
    const archivedRow = page.locator('.table-row').filter({ hasText: name });
    await expect(archivedRow).toBeVisible();
    await expect(archivedRow.locator('.status-badge')).toHaveText('Archived');

    // Restore from row menu
    await archivedRow.getByRole('button', { name: `More actions for ${name}` }).click();
    await page.getByRole('menuitem', { name: 'Restore project' }).click();

    // Row disappears from Archived tab
    await expect(page.locator('.table-row').filter({ hasText: name })).not.toBeVisible();

    // Appears back in Active tab
    await page.getByRole('tab', { name: /Active/i }).click();
    await expect(page.locator('.table-row').filter({ hasText: name })).toBeVisible();
  });

  test('7. Ongoing area has no completion button, no target date, and em dash progress', async ({
    page,
  }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = projectName('Daily Health');

    // Open create modal
    await page.getByRole('button', { name: '+ New Project' }).click();
    const modal = page.locator('.modal-card');

    // Select Ongoing area
    await modal.locator('.kind-card').filter({ hasText: 'Ongoing area' }).click();

    // Fill name
    await modal.getByPlaceholder('e.g. Launch website').fill(name);

    // Verify Target date field is NOT rendered for ongoing area
    await expect(modal.getByText('Target date (optional)')).not.toBeVisible();

    // Create
    await modal.getByRole('button', { name: 'Create Project' }).click();
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+/, { timeout: 10_000 });

    // Verify detail page
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(page.locator('.meta-label')).toHaveText('Ongoing area');

    // Check menu: NO "Complete project" option exists for ongoing area
    await page.getByRole('button', { name: `Project actions for ${name}` }).click();
    await expect(
      page.locator('.header-menu').getByRole('menuitem', { name: /Complete project/i }),
    ).not.toBeVisible();
    await page.keyboard.press('Escape');

    // Add a task
    const oTask = taskName('Morning yoga');
    await page.getByRole('button', { name: '+ Add Task', exact: true }).click();
    const taskModal = page.locator('.modal-card').filter({ hasText: 'Capture a new task' });
    await taskModal.locator('#task-title-input').fill(oTask);
    await taskModal.getByRole('button', { name: 'Create Task' }).click();
    await expect(taskModal).not.toBeVisible();

    // Metrics card shows ongoing note
    const ongoingCard = page.locator('.metrics-card-ongoing');
    await expect(ongoingCard).toBeVisible();
    await expect(ongoingCard.getByText('Ongoing area · no completion goal')).toBeVisible();

    // Navigate to /projects: progress column shows em dash "—"
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const row = page.locator('.table-row').filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row.locator('.progress-ongoing')).toHaveText('—');
  });

  test('8. Safe project deletion dialog: "keep tasks" preserves tasks in Inbox', async ({
    page,
  }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = projectName('Preserve Test');

    // Create project
    await page.getByRole('button', { name: '+ New Project' }).click();
    await page.locator('.modal-card').getByPlaceholder('e.g. Launch website').fill(name);
    await page.getByRole('button', { name: 'Create Project' }).click();
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+/, { timeout: 10_000 });

    // Add a task
    const pTask = taskName('Preserved Task');
    await page.getByRole('button', { name: '+ Add Task', exact: true }).click();
    const taskModal = page.locator('.modal-card').filter({ hasText: 'Capture a new task' });
    await taskModal.locator('#task-title-input').fill(pTask);
    await taskModal.getByRole('button', { name: 'Create Task' }).click();
    await expect(taskModal).not.toBeVisible();
    await expect(page.locator('article.task-card').filter({ hasText: pTask })).toBeVisible();

    // Go to directory
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const row = page.locator('.table-row').filter({ hasText: name });
    await expect(row).toBeVisible();

    // Open row menu -> Delete project…
    await row.getByRole('button', { name: `More actions for ${name}` }).click();
    await page.getByRole('menuitem', { name: 'Delete project…' }).click();

    // Delete dialog appears
    const deleteModal = page.locator('.modal-card').filter({ hasText: `Delete “${name}”?` });
    await expect(deleteModal).toBeVisible();
    await expect(deleteModal.getByText(/This project contains 1 task/i)).toBeVisible();

    // "Delete project, keep tasks" option card is selected by default
    const keepTasksOption = deleteModal
      .locator('.delete-option-card')
      .filter({ hasText: 'Delete project, keep tasks' });
    await expect(keepTasksOption).toHaveAttribute('aria-checked', 'true');

    // Confirm deletion with keep tasks
    await deleteModal.getByRole('button', { name: 'Delete Project, Keep Tasks' }).click();
    await expect(deleteModal).not.toBeVisible();

    // Project is gone from directory
    await expect(page.locator('.table-row').filter({ hasText: name })).not.toBeVisible();

    // Navigate to Inbox: the task MUST still exist safely!
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await expect(page.locator('article.task-card').filter({ hasText: pTask })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('9. Reorders projects by dragging the handle, and the order persists', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const first = projectName('Drag First');
    const second = projectName('Drag Second');
    for (const name of [first, second]) {
      await page.getByRole('button', { name: '+ New Project' }).click();
      await page.locator('.modal-card').getByPlaceholder('e.g. Launch website').fill(name);
      await page.getByRole('button', { name: 'Create Project' }).click();
      await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+/, { timeout: 10_000 });
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');
      await dismissTip(page);
    }

    const firstRow = page.locator('.table-row').filter({ hasText: first });
    const secondRow = page.locator('.table-row').filter({ hasText: second });
    await expect(firstRow).toBeVisible();
    await expect(secondRow).toBeVisible();

    // Drag the second project's handle above the first.
    await dragByHandle(page, secondRow.locator('.drag-handle'), firstRow);

    const secondComesFirst = async () => {
      const names = await page.locator('.table-row h3').allTextContents();
      return names.indexOf(second) !== -1 && names.indexOf(second) < names.indexOf(first);
    };
    await expect.poll(secondComesFirst).toBe(true);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect.poll(secondComesFirst).toBe(true);
  });
});
