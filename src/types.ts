export type LearnerId = string;
export type CourseId = string;

/**
 * Read-only port for learner records. The offering never caches what it returns, so eligibility is
 * always evaluated against current data — at join time and again at promotion time.
 */
export interface LearnerDirectory {
  /** Completed course IDs for a known learner, or `undefined` if the learner is unknown. */
  getCompletedCourses(learnerId: LearnerId): ReadonlySet<CourseId> | undefined;
}

/** Rejections shared by `enroll` and `drop`. Neither changes any state. */
export type RequestRejection =
  | { readonly ok: false; readonly code: 'INVALID_REQUEST'; readonly reason: string }
  | { readonly ok: false; readonly code: 'UNKNOWN_LEARNER' };

/** `ok` is true only when the request changed state as asked. */
export type EnrollResult =
  | { readonly ok: true; readonly code: 'ENROLLED' }
  /** `position` is 1-based: 1 means next in line. */
  | { readonly ok: true; readonly code: 'WAITLISTED'; readonly position: number }
  | { readonly ok: false; readonly code: 'ALREADY_ENROLLED' }
  | { readonly ok: false; readonly code: 'ALREADY_WAITLISTED' }
  | { readonly ok: false; readonly code: 'PREREQ_NOT_MET'; readonly missing: readonly CourseId[] }
  | RequestRejection;

export type DropResult =
  | {
      readonly ok: true;
      readonly code: 'DROPPED';
      /** Learner moved from the waitlist into the freed seat, or `null` if none was eligible. */
      readonly promoted: LearnerId | null;
      /** Ineligible learners removed from the front of the waitlist during promotion, in queue order. */
      readonly skipped: readonly LearnerId[];
    }
  | { readonly ok: true; readonly code: 'LEFT_WAITLIST' }
  /** Covers a learner who never enrolled and a repeated drop alike; no drop history is kept. */
  | { readonly ok: false; readonly code: 'NOT_ENROLLED' }
  | RequestRejection;

export type EnrollCode = EnrollResult['code'];
export type DropCode = DropResult['code'];

/** Defensive copy of offering state, for callers and tests. Mutating it has no effect on the offering. */
export interface OfferingSnapshot {
  readonly capacity: number;
  readonly requiredCourseIds: readonly CourseId[];
  /** In enrollment order. */
  readonly enrolled: readonly LearnerId[];
  /** In join order; index 0 is next in line. */
  readonly waitlist: readonly LearnerId[];
}
