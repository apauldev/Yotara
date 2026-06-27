import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';

async function setupTestDb() {
  const dbFile = join(tmpdir(), `yotara-project-service-test-${randomUUID()}.db`);
  process.env['DATABASE_URL'] = dbFile;

  const { db, sqlite } = await import('../db/client.js');
  const projectService = await import('./project-service.js');

  return {
    db,
    sqlite,
    projectService,
    cleanup() {
      sqlite.close();
      rmSync(dbFile, { force: true });
      delete process.env['DATABASE_URL'];
    },
  };
}

test('Project Service', async (t) => {
  const ctx = await setupTestDb();
  const ownerId = randomUUID();

  try {
    // Create a user in the DB for FK constraints
    const { users } = await import('../db/schema.js');
    await ctx.db.insert(users).values({
      id: ownerId,
      name: 'Test User',
      email: `${ownerId}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await t.test('lists projects for owner (includes defaults)', async () => {
      const projects = await ctx.projectService.listProjectsForOwner(ownerId);

      // Should include 8 default projects
      assert.ok(projects.length >= 8);
      const names = projects.map((p) => p.name);
      assert.ok(names.includes('Inbox'));
      assert.ok(names.includes('Focus'));
    });

    await t.test('seeds default projects only once', async () => {
      // Second call should not duplicate
      const projects = await ctx.projectService.listProjectsForOwner(ownerId);
      const inboxCount = projects.filter((p) => p.name === 'Inbox').length;
      assert.equal(inboxCount, 1, 'Inbox should only exist once');
    });

    await t.test('creates a project with default fields', async () => {
      const project = await ctx.projectService.createProjectForOwner(ownerId, {
        name: 'My Project',
      });

      assert.ok(project);
      assert.equal(project.name, 'My Project');
      assert.equal(project.ownerId, ownerId);
      assert.equal(project.taskCount, 0);
      assert.equal(project.completedTaskCount, 0);
      assert.equal(project.openTaskCount, 0);
      assert.ok(project.id);
      assert.ok(project.createdAt);
      assert.ok(project.updatedAt);
    });

    await t.test('creates a project with optional description and color', async () => {
      const project = await ctx.projectService.createProjectForOwner(ownerId, {
        name: 'Colored Project',
        description: 'A project with color',
        color: 'teal',
      });

      assert.ok(project);
      assert.equal(project.name, 'Colored Project');
      assert.equal(project.description, 'A project with color');
      assert.equal(project.color, 'teal');
    });

    await t.test('gets a project by id', async () => {
      const created = await ctx.projectService.createProjectForOwner(ownerId, {
        name: 'Get Test',
      });
      assert.ok(created);

      const fetched = await ctx.projectService.getProjectForOwner(created.id, ownerId);
      assert.ok(fetched);
      assert.equal(fetched.id, created.id);
      assert.equal(fetched.name, 'Get Test');
    });

    await t.test('returns null for non-existent project', async () => {
      const fetched = await ctx.projectService.getProjectForOwner(randomUUID(), ownerId);
      assert.equal(fetched, undefined);
    });

    await t.test('updates a project', async () => {
      const created = await ctx.projectService.createProjectForOwner(ownerId, {
        name: 'Update Me',
      });
      assert.ok(created);

      const updated = await ctx.projectService.updateProjectForOwner(ownerId, created.id, {
        name: 'Updated Name',
        description: 'New description',
        color: 'forest',
      });

      assert.ok(updated);
      assert.equal(updated.name, 'Updated Name');
      assert.equal(updated.description, 'New description');
      assert.equal(updated.color, 'forest');
    });

    await t.test('returns null when updating non-existent project', async () => {
      const updated = await ctx.projectService.updateProjectForOwner(ownerId, randomUUID(), {
        name: 'Noop',
      });
      assert.equal(updated, null);
    });

    await t.test('gets default project (Inbox)', async () => {
      const defaultProject = await ctx.projectService.getDefaultProjectForOwner(ownerId);
      assert.ok(defaultProject);
      assert.equal(defaultProject.name, 'Inbox');
    });

    await t.test('lists tasks for a project', async () => {
      const project = await ctx.projectService.createProjectForOwner(ownerId, {
        name: 'Task Project',
      });
      assert.ok(project);

      // Create a task assigned to this project
      const { createTaskForOwner } = await import('./task-service.js');
      await createTaskForOwner(ownerId, {
        title: 'Project Task',
        projectId: project.id,
      });

      const tasks = await ctx.projectService.listTasksForProject(project.id, ownerId);
      assert.ok(tasks);
      assert.equal(tasks.length, 1);
      assert.equal(tasks[0].title, 'Project Task');
      assert.equal(tasks[0].projectId, project.id);
    });
  } finally {
    ctx.cleanup();
  }
});
