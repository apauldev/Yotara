import { users } from '../db/schema.js';
import { toIsoTimestamp } from './timestamps.js';

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
  workspaceMode: 'personal' | 'team' | null;
  onboardingCompleted: boolean;
  archiveAutoDelete: boolean;
  captureBehavior: 'quick' | 'capture';
  createdAt: string;
  updatedAt: string;
};

export function toPublicUser(user: typeof users.$inferSelect): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    emailVerified: user.emailVerified,
    workspaceMode: user.workspaceMode,
    onboardingCompleted: user.onboardingCompleted,
    archiveAutoDelete: user.archiveAutoDelete,
    captureBehavior: user.captureBehavior,
    createdAt: toIsoTimestamp(user.createdAt),
    updatedAt: toIsoTimestamp(user.updatedAt),
  };
}
