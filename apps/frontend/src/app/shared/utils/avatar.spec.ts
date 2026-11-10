import {
  AVATAR_MAX_DECODED_BYTES,
  formatFileSize,
  isAvatarWithinLimits,
  isSafeAvatarImage,
  toAvatarDataUrl,
  toSafeAvatarImage,
  validateAvatarFile,
} from './avatar';

describe('avatar URL whitelist', () => {
  it('accepts png, jpeg, and webp data URLs', () => {
    expect(isSafeAvatarImage('data:image/png;base64,iVBORw0KGgo=')).toBeTrue();
    expect(isSafeAvatarImage('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBeTrue();
    expect(isSafeAvatarImage('data:image/webp;base64,UklGRiIAAABXRUJQVLkA')).toBeTrue();
  });

  it('rejects remote URLs, svg, gif, and malformed values', () => {
    expect(isSafeAvatarImage('https://example.com/avatar.png')).toBeFalse();
    expect(isSafeAvatarImage('data:image/svg+xml;base64,PHN2Zz48c3Z==')).toBeFalse();
    expect(
      isSafeAvatarImage(
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      ),
    ).toBeFalse();
    expect(isSafeAvatarImage('javascript:alert(1)')).toBeFalse();
    expect(isSafeAvatarImage('data:image/png;base64,<script>alert(1)</script>')).toBeFalse();
  });

  it('rejects empty and non-string input', () => {
    expect(isSafeAvatarImage('')).toBeFalse();
    expect(isSafeAvatarImage(null)).toBeFalse();
    expect(isSafeAvatarImage(undefined)).toBeFalse();
  });

  it('returns the trimmed image or null', () => {
    expect(toSafeAvatarImage(' data:image/png;base64,iVBORw0KGgo= ')).toBe(
      'data:image/png;base64,iVBORw0KGgo=',
    );
    expect(toSafeAvatarImage('https://example.com/avatar.png')).toBeNull();
    expect(toSafeAvatarImage(null)).toBeNull();
  });
});

describe('avatar file helpers', () => {
  it('accepts JPEG, PNG, and WebP files', () => {
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'avatar.png', {
      type: 'image/png',
    });
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'avatar.jpg', {
      type: 'image/jpeg',
    });
    const webp = new File([new Uint8Array([0x52, 0x49, 0x46, 0x46])], 'avatar.webp', {
      type: 'image/webp',
    });

    expect(validateAvatarFile(png)).toBeNull();
    expect(validateAvatarFile(jpeg)).toBeNull();
    expect(validateAvatarFile(webp)).toBeNull();
  });

  it('rejects SVG, GIF, HEIC, and oversized files', () => {
    const svg = new File(['<svg/>'], 'avatar.svg', { type: 'image/svg+xml' });
    const gif = new File([new Uint8Array([0x47, 0x49, 0x46])], 'avatar.gif', {
      type: 'image/gif',
    });
    const heic = new File([new Uint8Array([0x00])], 'avatar.heic', { type: 'image/heic' });
    const huge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.png', {
      type: 'image/png',
    });

    expect(validateAvatarFile(svg)).toBe('Choose a JPEG, PNG, or WebP image.');
    expect(validateAvatarFile(gif)).toBe('Choose a JPEG, PNG, or WebP image.');
    expect(validateAvatarFile(heic)).toBe('Choose a JPEG, PNG, or WebP image.');
    expect(validateAvatarFile(huge)).toBe(
      'That photo is 5.0 MB. Choose an image up to 5 MB \u2014 or export it at a smaller size.',
    );
  });

  it('tells the person how big their photo actually is when it is too large', () => {
    const huge = new File([new Uint8Array(8 * 1024 * 1024)], 'huge.png', { type: 'image/png' });
    expect(validateAvatarFile(huge)).toBe(
      'That photo is 8.0 MB. Choose an image up to 5 MB \u2014 or export it at a smaller size.',
    );
  });

  it('formats file sizes for messages', () => {
    expect(formatFileSize(8 * 1024 * 1024)).toBe('8.0 MB');
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('normalizes bare cropper output to a data URL', () => {
    // Bare base64 gets its MIME sniffed from the magic bytes (PNG here),
    // never blindly labelled WebP.
    expect(toAvatarDataUrl('iVBORw0KGgoAAAANSUhEUg==')).toBe(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
    );
    expect(toAvatarDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(
      'data:image/png;base64,iVBORw0KGgo=',
    );
    expect(toAvatarDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
  });

  it('checks the decoded byte cap', () => {
    const small = `data:image/png;base64,${btoa('x'.repeat(100))}`;
    const large = `data:image/png;base64,${btoa('x'.repeat(AVATAR_MAX_DECODED_BYTES + 10))}`;

    expect(isAvatarWithinLimits(small)).toBeTrue();
    expect(isAvatarWithinLimits(large)).toBeFalse();
  });
});
