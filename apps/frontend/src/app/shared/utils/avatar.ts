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

/** Human-readable input cap for messages, e.g. "5 MB". */
export const AVATAR_MAX_FILE_SIZE_LABEL = '5 MB';

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
    return `That photo is ${formatFileSize(file.size)}. Choose an image up to ${AVATAR_MAX_FILE_SIZE_LABEL} — or export it at a smaller size.`;
  }
  return null;
}

/** Practical file-size label, e.g. "8.0 MB" or "1.5 KB". */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  }
  if (bytes >= 1024) {
    const kb = bytes / 1024;
    return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  }
  return `${Math.round(bytes)} B`;
}

/**
 * Normalizes a cropper result to a full data URL. The library normally returns
 * a prefixed value; for a bare base64 string the MIME is sniffed from the
 * magic bytes (PNG / JPEG / WebP) instead of guessing, so a PNG never gets a
 * WebP prefix that the API's magic-byte check would reject.
 */
export function toAvatarDataUrl(base64: string): string | null {
  const trimmed = base64.trim();
  if (!trimmed) {
    return null;
  }

  const withPrefix = /^data:[^;]+;base64,/.test(trimmed)
    ? trimmed
    : `data:${sniffAvatarMime(trimmed)};base64,${trimmed}`;

  return isSafeAvatarImage(withPrefix) ? withPrefix : null;
}

function sniffAvatarMime(base64: string): string {
  const bytes = decodeBase64Head(base64, 12);
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return 'image/webp';
}

function decodeBase64Head(base64: string, byteCount: number): Uint8Array {
  const clean = base64.replace(/\s/g, '');
  const headChars = Math.min(clean.length, Math.ceil((byteCount / 3) * 4));
  const head = clean.slice(0, headChars).replace(/=+$/, '');
  try {
    const binary = atob(head);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return new Uint8Array(0);
  }
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
