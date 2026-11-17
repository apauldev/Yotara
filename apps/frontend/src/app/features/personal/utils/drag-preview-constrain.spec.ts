import { constrainDragPreviewToViewport } from './drag-preview-constrain';

const constrain = (point: { x: number; y: number }) =>
  constrainDragPreviewToViewport(point, null!, null!, null!);

describe('constrainDragPreviewToViewport', () => {
  beforeEach(() => {
    const preview = document.createElement('div');
    preview.classList.add('cdk-drag-preview');
    document.body.appendChild(preview);
    spyOn(preview, 'getBoundingClientRect').and.returnValue({
      width: 256,
      height: 48,
    } as DOMRect);
  });

  afterEach(() => {
    document.querySelector('.cdk-drag-preview')?.remove();
  });

  it('leaves points inside the viewport untouched', () => {
    expect(constrain({ x: 100, y: 200 })).toEqual({ x: 100, y: 200 });
  });

  it('clamps the point so the whole preview stays on screen', () => {
    expect(constrain({ x: window.innerWidth - 20, y: window.innerHeight - 10 })).toEqual({
      x: Math.max(8, window.innerWidth - 256 - 8),
      y: Math.max(8, window.innerHeight - 48 - 8),
    });
  });

  it('never returns a negative offset on a viewport smaller than the preview', () => {
    expect(constrain({ x: -50, y: -50 })).toEqual({ x: 8, y: 8 });
  });

  it('passes the point through when no preview element exists', () => {
    document.querySelector('.cdk-drag-preview')?.remove();
    expect(constrain({ x: 9999, y: 9999 })).toEqual({ x: 9999, y: 9999 });
  });
});
