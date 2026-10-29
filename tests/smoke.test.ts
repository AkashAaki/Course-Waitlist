import { describe, expect, it } from 'vitest';

// Phase 0 only: proves the toolchain runs TypeScript tests. Removed once real tests exist.
describe('toolchain', () => {
  it('runs a TypeScript test', () => {
    const ids: readonly string[] = ['L1', 'L2'];
    expect(ids).toHaveLength(2);
  });
});
