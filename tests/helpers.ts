import { expect } from 'vitest';
import { CourseOffering } from '../src/courseOffering.js';
import { normalizeId } from '../src/ids.js';
import { InMemoryLearnerDirectory } from '../src/learnerDirectory.js';
import type { CourseId, DropResult, EnrollResult, LearnerId, OfferingSnapshot } from '../src/types.js';

export const C101 = 'C101';
export const C102 = 'C102';

/** Fake learners L1…L9, all of whom have completed C101 unless overridden. */
export function eligibleLearners(count = 9): Record<LearnerId, CourseId[]> {
  return Object.fromEntries(Array.from({ length: count }, (_, i) => [`L${i + 1}`, [C101]]));
}

/**
 * Checks the invariants that must hold after every operation (DESIGN.md §5):
 * I1 enrolled ≤ capacity; I2 each learner at most once across enrolled ∪ waitlist;
 * I7 waitlist non-empty ⇒ course full; plus every stored ID is canonical.
 */
export function assertInvariants(s: OfferingSnapshot): void {
  expect(s.enrolled.length, 'I1 enrolled ≤ capacity').toBeLessThanOrEqual(s.capacity);
  const all = [...s.enrolled, ...s.waitlist];
  expect(new Set(all).size, 'I2 no learner appears twice').toBe(all.length);
  if (s.waitlist.length > 0) {
    expect(s.enrolled.length, 'I7 waitlist non-empty ⇒ full').toBe(s.capacity);
  }
  for (const id of all) expect(id, 'stored IDs are canonical').toBe(normalizeId(id));
}

/** The operations under test, with invariants asserted after every call. */
export interface CheckedOffering {
  enroll(learnerId: LearnerId): EnrollResult;
  drop(learnerId: LearnerId): DropResult;
  snapshot(): OfferingSnapshot;
  readonly raw: CourseOffering;
}

export function checked(offering: CourseOffering): CheckedOffering {
  return {
    raw: offering,
    enroll(learnerId) {
      const result = offering.enroll(learnerId);
      assertInvariants(offering.snapshot());
      return result;
    },
    drop(learnerId) {
      const result = offering.drop(learnerId);
      assertInvariants(offering.snapshot());
      return result;
    },
    snapshot: () => offering.snapshot(),
  };
}

export interface SetupOptions {
  capacity?: number;
  required?: CourseId[];
  learners?: Record<LearnerId, CourseId[]>;
}

/** Defaults: capacity 2, prerequisite C101, learners L1…L9 all eligible. */
export function setup({ capacity = 2, required = [C101], learners = eligibleLearners() }: SetupOptions = {}) {
  const directory = new InMemoryLearnerDirectory(learners);
  const offering = checked(new CourseOffering({ capacity, requiredCourseIds: required, directory }));
  return { offering, directory };
}

/** Runs `fn` and asserts the offering's state is identical before and after (invariant I4). */
export function expectUnchanged<T>(offering: CheckedOffering, fn: () => T): T {
  const before = offering.snapshot();
  const result = fn();
  expect(offering.snapshot(), 'I4 state unchanged').toEqual(before);
  return result;
}

/** Enrolls each learner, asserting the expected code, to build up a starting state. */
export function enrollAll(offering: CheckedOffering, ids: LearnerId[], code: EnrollResult['code']): void {
  for (const id of ids) expect(offering.enroll(id).code, `enroll ${id}`).toBe(code);
}
