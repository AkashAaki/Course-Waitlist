import { normalizeId } from './ids.js';
import type { CourseId } from './types.js';

/**
 * The single prerequisite rule, used at both join time and promotion time (invariant I6):
 * a learner is eligible when they have completed every required course.
 * Course IDs are compared in canonical form (see `normalizeId`), so `c101` satisfies `C101`.
 * Returns the missing courses, canonicalised and in `required` order; empty means eligible.
 */
export function missingPrerequisites(
  required: ReadonlySet<CourseId>,
  completed: ReadonlySet<CourseId>,
): CourseId[] {
  const have = new Set([...completed].map(normalizeId));
  const need = new Set([...required].map(normalizeId));
  return [...need].filter((courseId) => !have.has(courseId));
}

export function isEligible(required: ReadonlySet<CourseId>, completed: ReadonlySet<CourseId>): boolean {
  return missingPrerequisites(required, completed).length === 0;
}
