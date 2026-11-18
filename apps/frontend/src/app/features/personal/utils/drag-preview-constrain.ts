const VIEWPORT_PADDING = 8;

/**
 * CDK positions a custom drag preview at the pointer with no viewport
 * clamping, so a wide preview hangs off the right/bottom edge on phones.
 * Clamp the placement to the visible viewport. CDK also uses this point for
 * drop-target sorting, but the clamp only engages near an edge — and the drag
 * lists are vertical, so horizontal clamping never changes the target row.
 *
 * Accepts only the point; a function with fewer parameters is assignable to
 * CDK's `DragConstrainPosition`, so the unused dragRef/dimensions/pickup
 * arguments are neither declared nor required by callers and tests.
 */
export const constrainDragPreviewToViewport = (point: { x: number; y: number }) => {
  const preview = document.querySelector<HTMLElement>('.cdk-drag-preview');
  if (!preview) {
    return point;
  }

  const { width, height } = preview.getBoundingClientRect();
  const maxX = Math.max(VIEWPORT_PADDING, window.innerWidth - width - VIEWPORT_PADDING);
  const maxY = Math.max(VIEWPORT_PADDING, window.innerHeight - height - VIEWPORT_PADDING);

  return {
    x: Math.min(Math.max(point.x, VIEWPORT_PADDING), maxX),
    y: Math.min(Math.max(point.y, VIEWPORT_PADDING), maxY),
  };
};
