import assert from 'node:assert/strict';
import test from 'node:test';
import { getTrustedProxy } from './trusted-proxy.js';

test('trusted proxy defaults to no proxy trust', () => {
  const previous = process.env['TRUST_PROXY'];
  delete process.env['TRUST_PROXY'];

  try {
    assert.equal(getTrustedProxy(), false);
  } finally {
    if (previous === undefined) {
      delete process.env['TRUST_PROXY'];
    } else {
      process.env['TRUST_PROXY'] = previous;
    }
  }
});

test('trusted proxy parses configured addresses and CIDRs', () => {
  const previous = process.env['TRUST_PROXY'];
  process.env['TRUST_PROXY'] = ' 172.16.0.0/12, 10.0.0.5 ';

  try {
    assert.deepEqual(getTrustedProxy(), ['172.16.0.0/12', '10.0.0.5']);
  } finally {
    if (previous === undefined) {
      delete process.env['TRUST_PROXY'];
    } else {
      process.env['TRUST_PROXY'] = previous;
    }
  }
});
