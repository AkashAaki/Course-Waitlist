import { isEligible, missingPrerequisites } from './eligibility.js';
import { normalizeId } from './ids.js';
import type {
  CourseId,
  DropResult,
  EnrollResult,
  LearnerDirectory,
  LearnerId,
  OfferingSnapshot,
  RequestRejection,
} from './types.js';

export interface CourseOfferingOptions {
  /** Positive integer, fixed for the offering's lifetime. */
  readonly capacity: number;
  /** Prerequisite courses; omitted or empty means no prerequisites. */
  readonly requiredCourseIds?: Iterable<CourseId>;
  readonly directory: LearnerDirectory;
}

/**
 * One course offering's enrollment and FIFO waitlist. See DESIGN.md.
 *
 * Every public method is synchronous and checks everything before its first mutation, so each call is atomic on
 * Node's single thread and a rejected request leaves state untouched (invariants I4, I5).
 */
export class CourseOffering {
  private readonly capacity: number;
  private readonly requiredCourseIds: ReadonlySet<CourseId>;
  private readonly directory: LearnerDirectory;
  private readonly enrolled = new Set<LearnerId>();
  private readonly waitlist: LearnerId[] = [];

  constructor({ capacity, requiredCourseIds = [], directory }: CourseOfferingOptions) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError(`Capacity must be a positive integer, got ${capacity}`);
    }
    this.capacity = capacity;
    this.requiredCourseIds = new Set([...requiredCourseIds].map(normalizeId).filter((id) => id !== ''));
    this.directory = directory;
  }

  enroll(learnerId: LearnerId): EnrollResult {
    const learner = this.resolve(learnerId);
    if (!learner.ok) return learner;
    const { id, completed } = learner;

    // Membership before eligibility: a duplicate is a no-op even if the learner has since become ineligible.
    if (this.enrolled.has(id)) return { ok: false, code: 'ALREADY_ENROLLED' };
    if (this.waitlist.includes(id)) return { ok: false, code: 'ALREADY_WAITLISTED' };

    const missing = missingPrerequisites(this.requiredCourseIds, completed);
    if (missing.length > 0) return { ok: false, code: 'PREREQ_NOT_MET', missing };

    // All checks passed; mutate. By I7 a free seat implies an empty waitlist, so no one is jumped.
    if (this.enrolled.size < this.capacity) {
      this.enrolled.add(id);
      return { ok: true, code: 'ENROLLED' };
    }
    this.waitlist.push(id);
    return { ok: true, code: 'WAITLISTED', position: this.waitlist.length };
  }

  drop(learnerId: LearnerId): DropResult {
    const parsed = parseLearnerId(learnerId);
    if (!parsed.ok) return parsed;
    const { id } = parsed;

    // Membership before the directory lookup: a learner already in the offering can always leave it, even if their
    // record has since been deleted. Otherwise their seat or queue position would be stuck.
    const waitlistIndex = this.waitlist.indexOf(id);
    if (waitlistIndex !== -1) {
      this.waitlist.splice(waitlistIndex, 1);
      return { ok: true, code: 'LEFT_WAITLIST' };
    }
    if (!this.enrolled.has(id)) {
      if (this.directory.getCompletedCourses(id) === undefined) return { ok: false, code: 'UNKNOWN_LEARNER' };
      return { ok: false, code: 'NOT_ENROLLED' };
    }

    // Read, then write: every directory lookup happens in planPromotion() before any mutation, so if the directory
    // throws, the drop is abandoned with state untouched (I4, I5; Finding F1 in VERIFICATION.md).
    const { promoted, skipped } = this.planPromotion();

    this.enrolled.delete(id);
    this.waitlist.splice(0, skipped.length + (promoted === null ? 0 : 1));
    if (promoted !== null) this.enrolled.add(promoted);
    return { ok: true, code: 'DROPPED', promoted, skipped };
  }

  snapshot(): OfferingSnapshot {
    return {
      capacity: this.capacity,
      requiredCourseIds: [...this.requiredCourseIds],
      enrolled: [...this.enrolled],
      waitlist: [...this.waitlist],
    };
  }

  /**
   * Read-only: decides who fills the one seat a drop frees, without mutating anything. Scans from the front of the
   * waitlist (I3), re-checking eligibility with the same rule used at join time (I6). Ineligible heads, or heads no
   * longer in the directory, come before the promoted learner and are skipped and removed (A3). A drop frees exactly one
   * seat, and by I7 a non-empty waitlist means the course was full, so at most one learner is promoted.
   */
  private planPromotion(): { promoted: LearnerId | null; skipped: LearnerId[] } {
    const skipped: LearnerId[] = [];
    for (const head of this.waitlist) {
      const completed = this.directory.getCompletedCourses(head);
      if (completed !== undefined && isEligible(this.requiredCourseIds, completed)) return { promoted: head, skipped };
      skipped.push(head);
    }
    return { promoted: null, skipped };
  }

  /** Enroll's validation (DESIGN.md §4): INVALID_REQUEST, then UNKNOWN_LEARNER. */
  private resolve(raw: unknown): ResolvedLearner | RequestRejection {
    const parsed = parseLearnerId(raw);
    if (!parsed.ok) return parsed;
    const completed = this.directory.getCompletedCourses(parsed.id);
    if (completed === undefined) return { ok: false, code: 'UNKNOWN_LEARNER' };
    return { ok: true, id: parsed.id, completed };
  }
}

interface ResolvedLearner {
  readonly ok: true;
  /** Canonical form. */
  readonly id: LearnerId;
  readonly completed: ReadonlySet<CourseId>;
}

/**
 * Format check shared by enroll and drop: the ID must be a string that is non-blank after normalisation.
 * `raw` is typed `unknown` because callers outside TypeScript can pass anything.
 */
function parseLearnerId(raw: unknown): { readonly ok: true; readonly id: LearnerId } | RequestRejection {
  if (typeof raw !== 'string') {
    return { ok: false, code: 'INVALID_REQUEST', reason: `Learner ID must be a string, got ${typeof raw}` };
  }
  const id = normalizeId(raw);
  if (id === '') return { ok: false, code: 'INVALID_REQUEST', reason: 'Learner ID must not be blank' };
  return { ok: true, id };
}
