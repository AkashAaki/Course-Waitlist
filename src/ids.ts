/**
 * Canonical form for learner and course IDs, applied at every boundary so that equivalent spellings
 * (`' l1 '`, `'L1'`, full-width `'Ｌ１'`) refer to the same record:
 *   1. Unicode NFKC (folds compatibility forms such as full-width digits and letters),
 *   2. trim leading/trailing whitespace,
 *   3. upper-case (locale-independent).
 * Separators, internal whitespace and leading zeros are deliberately kept: `L-1`, `L 1` and `L01` stay
 * distinct from `L1`, because folding them could merge genuinely different IDs.
 * Returns `''` for blank input; callers decide whether that is an error.
 */
export function normalizeId(raw: string): string {
  return raw.normalize('NFKC').trim().toUpperCase();
}
