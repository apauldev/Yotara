import { BadRequestError } from './app-error.js';

/** Decoded cap for a stored profile photo (a 256×256 WebP is typically 10–25 KB). */
export const AVATAR_MAX_DECODED_BYTES = 128 * 1024;

/** Character cap for the stored data URL, matching the OpenAPI schema. */
export const AVATAR_MAX_DATA_URL_LENGTH = 200_000;

const DATA_URL_PATTERN = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

type AvatarMime = 'png' | 'jpeg' | 'webp';

/**
 * Validates a client-processed profile photo. Only PNG, JPEG, and WebP data
 * URLs are accepted; remote URLs, SVG (script risk), GIF, and malformed base64
 * are rejected. The declared MIME must match the decoded magic bytes so a
 * spoofed prefix cannot be stored. `null` clears the photo.
 */
export function normalizeAvatarImage(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new BadRequestError('image must be a data URL string or null');
  }

  const dataUrl = value.trim();
  if (dataUrl.length > AVATAR_MAX_DATA_URL_LENGTH) {
    throw new BadRequestError('Profile photo is too large');
  }

  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    throw new BadRequestError('Profile photo must be a PNG, JPEG, or WebP data URL');
  }

  const mime = match[1] as AvatarMime;
  const base64 = match[2] ?? '';
  const bytes = Buffer.from(base64, 'base64');

  if (bytes.length === 0) {
    throw new BadRequestError('Profile photo is empty');
  }
  if (bytes.length > AVATAR_MAX_DECODED_BYTES) {
    throw new BadRequestError('Profile photo must be 128 KB or smaller');
  }
  if (!matchesMagicBytes(bytes, mime)) {
    throw new BadRequestError('Profile photo data does not match its declared image type');
  }

  return dataUrl;
}

function matchesMagicBytes(bytes: Buffer, mime: AvatarMime): boolean {
  switch (mime) {
    case 'png':
      return (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      );
    case 'jpeg':
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case 'webp':
      return (
        bytes.length >= 12 &&
        bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.toString('ascii', 8, 12) === 'WEBP'
      );
    default:
      return false;
  }
}
