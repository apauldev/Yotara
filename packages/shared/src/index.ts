// Node entry: explicit .js extensions keep the emitted ESM runnable.
export * from './auth.js';
export * from './content-security-policy.js';
export * from './default-labels.js';
export * from './default-projects.js';
export * from './label-colors.js';
export * from './label-icons.js';
export * from './name-key.js';
export * from './utils/email.js';
export * from './domain.js';
export type { ProjectKind } from './domain.js';
export { PROJECT_KINDS, isProjectKind } from './domain.js';
