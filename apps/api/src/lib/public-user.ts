import { users } from '../db/schema.js';

export function toPublicUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    workspaceMode: user.workspaceMode,
    onboardingCompleted: user.onboardingCompleted,
  };
}
