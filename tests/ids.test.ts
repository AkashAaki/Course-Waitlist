import { describe, expect, it } from 'vitest';
import { normalizeId } from '../src/ids.js';

describe('normalizeId', () => {
  it.each([
    ['L1', 'L1'],
    ['l1', 'L1'],
    ['  L1\t\n', 'L1'],
    ['Ｌ１', 'L1'], // full-width letters/digits (NFKC)
    [' l1 ', 'L1'], // non-breaking spaces are trimmed
    ['c101', 'C101'],
  ])('canonicalises %j to %j', (raw, expected) => {
    expect(normalizeId(raw)).toBe(expected);
  });

  it.each(['L-1', 'L_1', 'L 1', 'L01'])('keeps %j distinct from L1 (no separator/zero folding)', (raw) => {
    expect(normalizeId(raw)).not.toBe('L1');
  });

  it.each(['', '   ', '\t\n'])('returns empty string for blank input %j', (raw) => {
    expect(normalizeId(raw)).toBe('');
  });

  it('is idempotent', () => {
    for (const raw of [' l1 ', 'Ｌ１', 'c-101']) {
      expect(normalizeId(normalizeId(raw))).toBe(normalizeId(raw));
    }
  });
});
