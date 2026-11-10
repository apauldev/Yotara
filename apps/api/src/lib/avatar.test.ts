import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AVATAR_MAX_DATA_URL_LENGTH,
  AVATAR_MAX_DECODED_BYTES,
  normalizeAvatarImage,
} from './avatar.js';

test('normalizeAvatarImage returns null when given null', () => {
  assert.equal(normalizeAvatarImage(null), null);
});

test('normalizeAvatarImage rejects non-string and non-null values', () => {
  assert.throws(
    // @ts-expect-error testing invalid type input
    () => normalizeAvatarImage(123),
    /image must be a data URL string or null/,
  );
  assert.throws(
    // @ts-expect-error testing invalid type input
    () => normalizeAvatarImage({}),
    /image must be a data URL string or null/,
  );
});

test('normalizeAvatarImage rejects data URLs exceeding length cap', () => {
  const oversizedDataUrl = 'data:image/png;base64,' + 'A'.repeat(AVATAR_MAX_DATA_URL_LENGTH);
  assert.throws(() => normalizeAvatarImage(oversizedDataUrl), /Profile photo is too large/);
});

test('normalizeAvatarImage rejects unsupported schemes and non-allowed formats', () => {
  assert.throws(
    () => normalizeAvatarImage('https://example.com/avatar.png'),
    /Profile photo must be a PNG, JPEG, or WebP data URL/,
  );
  assert.throws(
    () =>
      normalizeAvatarImage(
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      ),
    /Profile photo must be a PNG, JPEG, or WebP data URL/,
  );
  assert.throws(
    () => normalizeAvatarImage('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='),
    /Profile photo must be a PNG, JPEG, or WebP data URL/,
  );
  assert.throws(
    () => normalizeAvatarImage('data:image/png;base64,not-valid-base64!'),
    /Profile photo must be a PNG, JPEG, or WebP data URL/,
  );
});

test('normalizeAvatarImage validates PNG, JPEG, and WebP with magic bytes', () => {
  // Valid PNG: 89 50 4E 47 0D 0A 1A 0A
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const pngDataUrl = `data:image/png;base64,${pngHeader.toString('base64')}`;
  assert.equal(normalizeAvatarImage(pngDataUrl), pngDataUrl);

  // Valid JPEG: FF D8 FF
  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const jpegDataUrl = `data:image/jpeg;base64,${jpegHeader.toString('base64')}`;
  assert.equal(normalizeAvatarImage(jpegDataUrl), jpegDataUrl);

  // Valid WebP: RIFF .... WEBP
  const webpHeader = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x20, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP'),
    Buffer.from('VP8 '),
  ]);
  const webpDataUrl = `data:image/webp;base64,${webpHeader.toString('base64')}`;
  assert.equal(normalizeAvatarImage(webpDataUrl), webpDataUrl);
});

test('normalizeAvatarImage rejects data URL with empty decoded bytes', () => {
  assert.throws(
    () => normalizeAvatarImage('data:image/png;base64,'),
    /Profile photo must be a PNG, JPEG, or WebP data URL/,
  );
});

test('normalizeAvatarImage rejects decoded payload exceeding decoded byte cap', () => {
  const hugePayload = Buffer.alloc(AVATAR_MAX_DECODED_BYTES + 10, 0x89);
  hugePayload[0] = 0x89;
  hugePayload[1] = 0x50;
  hugePayload[2] = 0x4e;
  hugePayload[3] = 0x47;
  hugePayload[4] = 0x0d;
  hugePayload[5] = 0x0a;
  hugePayload[6] = 0x1a;
  hugePayload[7] = 0x0a;
  const hugeDataUrl = `data:image/png;base64,${hugePayload.toString('base64')}`;
  assert.throws(() => normalizeAvatarImage(hugeDataUrl), /Profile photo must be 128 KB or smaller/);
});

test('normalizeAvatarImage rejects magic byte mismatch', () => {
  const fakePng = Buffer.from('NOT A REAL PNG FILE AT ALL');
  const fakePngDataUrl = `data:image/png;base64,${fakePng.toString('base64')}`;
  assert.throws(
    () => normalizeAvatarImage(fakePngDataUrl),
    /Profile photo data does not match its declared image type/,
  );

  const fakeJpeg = Buffer.from([0x00, 0x01, 0x02, 0x03]);
  const fakeJpegDataUrl = `data:image/jpeg;base64,${fakeJpeg.toString('base64')}`;
  assert.throws(
    () => normalizeAvatarImage(fakeJpegDataUrl),
    /Profile photo data does not match its declared image type/,
  );

  const fakeWebp = Buffer.from('RIFF1234NOTWEBP');
  const fakeWebpDataUrl = `data:image/webp;base64,${fakeWebp.toString('base64')}`;
  assert.throws(
    () => normalizeAvatarImage(fakeWebpDataUrl),
    /Profile photo data does not match its declared image type/,
  );
});
