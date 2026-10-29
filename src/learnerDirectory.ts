import { normalizeId } from './ids.js';
import type { CourseId, LearnerDirectory, LearnerId } from './types.js';

/**
 * In-memory stand-in for a learner records system. `setCompletedCourses` and `removeLearner` model record changes
 * between join and promotion (e.g. a grade correction revoking a prerequisite, or a deleted record).
 * Learner and course IDs are stored and looked up in canonical form (see `normalizeId`).
 */
export class InMemoryLearnerDirectory implements LearnerDirectory {
  private readonly records = new Map<LearnerId, ReadonlySet<CourseId>>();

  constructor(records: Readonly<Record<LearnerId, readonly CourseId[]>> = {}) {
    for (const [learnerId, courses] of Object.entries(records)) {
      // Seed data that collapses to one canonical ID ('l1' and 'L1') is ambiguous, so refuse it rather than merge silently.
      if (this.records.has(normalizeId(learnerId))) {
        throw new Error(`Duplicate learner ID after normalisation: ${JSON.stringify(learnerId)}`);
      }
      this.setCompletedCourses(learnerId, courses);
    }
  }

  getCompletedCourses(learnerId: LearnerId): ReadonlySet<CourseId> | undefined {
    return this.records.get(normalizeId(learnerId));
  }

  /** Models a learner record being deleted from the records system. */
  removeLearner(learnerId: LearnerId): void {
    this.records.delete(normalizeId(learnerId));
  }

  setCompletedCourses(learnerId: LearnerId, courses: readonly CourseId[]): void {
    const key = normalizeId(learnerId);
    if (key === '') throw new RangeError('Learner ID must not be blank');
    this.records.set(key, new Set(courses.map(normalizeId).filter((courseId) => courseId !== '')));
  }
}
