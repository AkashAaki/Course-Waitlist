import type { CourseId, DropResult, EnrollResult, LearnerDirectory, LearnerId, OfferingSnapshot } from './types.js';

export interface CourseOfferingOptions {
  /** Positive integer, fixed for the offering's lifetime. */
  readonly capacity: number;
  /** Prerequisite courses; omitted or empty means no prerequisites. */
  readonly requiredCourseIds?: Iterable<CourseId>;
  readonly directory: LearnerDirectory;
}

/** One course offering's enrollment and FIFO waitlist. See DESIGN.md. Phase 2 stub: not implemented yet. */
export class CourseOffering {
  constructor(_options: CourseOfferingOptions) {}

  enroll(_learnerId: LearnerId): EnrollResult {
    throw new Error('Not implemented');
  }

  drop(_learnerId: LearnerId): DropResult {
    throw new Error('Not implemented');
  }

  snapshot(): OfferingSnapshot {
    throw new Error('Not implemented');
  }
}
