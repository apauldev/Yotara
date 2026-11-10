/**
 * Legacy API alias for the shared case-folding key. The implementation now
 * lives in `@yotara/shared` (`nameKey`) so the startup wizard can validate
 * names with exactly the same folding the server enforces.
 */
export { nameKey as labelNameKey } from '@yotara/shared';
