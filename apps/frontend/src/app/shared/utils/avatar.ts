/**
 * Avatar URL whitelist and client-side photo limits.
 *
 * Only client-processed `data:image/(png|jpeg|webp)` URLs may be bound as
 * `<img>` sources. Remote URLs, SVG (script risk), GIF, and malformed values
 * are rejected and the caller falls back to initials.
 */
const AVATAR_DATA_URL_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

/** Input cap for a chosen file. The browser resizes before anything is sent. */
export const AVATAR_MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Server cap for the decoded image. */
export const AVATAR_MAX_DECODED_BYTES = 128 * 1024;

/** Server/OpenAPI cap for the stored data URL. */
export const AVATAR_MAX_DATA_URL_LENGTH = 200_000;

export const AVATAR_ACCEPTED_MIME_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
];

/** `accept` attribute value for the file picker. */
export const AVATAR_ACCEPT = AVATAR_ACCEPTED_MIME_TYPES.join(',');

/** Whether `image` is a safe avatar data URL that may be rendered. */
export function isSafeAvatarImage(image: string | null | undefined): boolean {
  if (typeof image !== 'string') {
    return false;
  }

  const trimmed = image.trim();
  if (!trimmed) {
    return false;
  }

  return AVATAR_DATA_URL_PATTERN.test(trimmed);
}

/**
 * Returns the image when it passes the whitelist, otherwise `null`.
 * The avatar component binds only this result (via `DomSanitizer` when it
 * needs a resource URL), so unsafe input degrades to initials.
 */
export function toSafeAvatarImage(image: string | null | undefined): string | null {
  if (!isSafeAvatarImage(image)) {
    return null;
  }

  return (image as string).trim();
}

/** Validates a picked file, returning a user-facing error or `null`. */
export function validateAvatarFile(file: File): string | null {
  if (!AVATAR_ACCEPTED_MIME_TYPES.includes(file.type)) {
    return 'Choose a JPEG, PNG, or WebP image.';
  }
  if (file.size > AVATAR_MAX_FILE_BYTES) {
    return 'Choose an image up to 5 MB.';
  }
  return null;
}

/**
 * Normalizes a cropper result to a full data URL. The library normally returns
 * a prefixed value; a bare base64 string gets the fallback MIME prefix.
 */
export function toAvatarDataUrl(base64: string, fallbackMime = 'image/webp'): string | null {
  const trimmed = base64.trim();
  if (!trimmed) {
    return null;
  }

  const withPrefix = /^data:[^;]+;base64,/.test(trimmed)
    ? trimmed
    : `data:${fallbackMime};base64,${trimmed}`;

  return isSafeAvatarImage(withPrefix) ? withPrefix : null;
}

/** Whether the data URL stays within both the character and decoded-byte caps. */
export function isAvatarWithinLimits(dataUrl: string): boolean {
  if (dataUrl.length > AVATAR_MAX_DATA_URL_LENGTH) {
    return false;
  }

  const match = /^data:[^;]+;base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return false;
  }

  const base64 = match[1] ?? '';
  const decodedBytes = Math.floor((base64.length * 3) / 4) - (base64.match(/=*$/)?.[0].length ?? 0);
  return decodedBytes > 0 && decodedBytes <= AVATAR_MAX_DECODED_BYTES;
}
