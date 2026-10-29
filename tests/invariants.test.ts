import { describe, expect, it } from 'vitest';
import { CourseOffering } from '../src/courseOffering.js';
import { isEligible } from '../src/eligibility.js';
import { normalizeId } from '../src/ids.js';
import type { DropResult, EnrollResult, LearnerDirectory, OfferingSnapshot } from '../src/types.js';
import { C101, enrollAll, setup } from './helpers.js';

/** Small deterministic PRNG so failures reproduce from the seed. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const without = (list: readonly string[], id: string) => list.filter((x) => x !== id);

/**
 * Independent post-condition check for one operation: given the state before, the request and the result,
 * the state after must be exactly what DESIGN.md §4/§6 says. Uses the shared prerequisite rule (I6) as the oracle
 * for eligibility; everything else is recomputed here from first principles.
 */
function checkTransition(
  before: OfferingSnapshot,
  after: OfferingSnapshot,
  op: 'enroll' | 'drop',
  raw: string,
  result: EnrollResult | DropResult,
  directory: LearnerDirectory,
): void {
  const id = normalizeId(raw);
  const required = new Set(before.requiredCourseIds);
  const eligible = (learner: string) => {
    const completed = directory.getCompletedCourses(learner);
    return completed !== undefined && isEligible(required, completed);
  };
  const unchanged = () => expect(after).toEqual(before);

  switch (result.code) {
    case 'ENROLLED':
      expect(op).toBe('enroll');
      expect(before.enrolled.length).toBeLessThan(before.capacity);
      expect(eligible(id)).toBe(true);
      expect(after.enrolled).toEqual([...before.enrolled, id]);
      expect(after.waitlist).toEqual(before.waitlist);
      break;
    case 'WAITLISTED':
      expect(before.enrolled.length).toBe(before.capacity);
      expect(eligible(id)).toBe(true);
      expect(after.waitlist).toEqual([...before.waitlist, id]);
      expect(result.position).toBe(after.waitlist.length);
      expect(after.enrolled).toEqual(before.enrolled);
      break;
    case 'ALREADY_ENROLLED':
      expect(before.enrolled).toContain(id);
      unchanged();
      break;
    case 'ALREADY_WAITLISTED':
      expect(before.waitlist).toContain(id);
      unchanged();
      break;
    case 'PREREQ_NOT_MET':
      expect(eligible(id)).toBe(false);
      expect([...before.enrolled, ...before.waitlist]).not.toContain(id);
      unchanged();
      break;
    case 'UNKNOWN_LEARNER':
      expect(directory.getCompletedCourses(id)).toBeUndefined();
      unchanged();
      break;
    case 'INVALID_REQUEST':
      expect(id).toBe('');
      unchanged();
      break;
    case 'LEFT_WAITLIST':
      expect(before.waitlist).toContain(id);
      expect(after.waitlist).toEqual(without(before.waitlist, id));
      expect(after.enrolled).toEqual(before.enrolled);
      break;
    case 'NOT_ENROLLED':
      expect([...before.enrolled, ...before.waitlist]).not.toContain(id);
      unchanged();
      break;
    case 'DROPPED': {
      expect(before.enrolled).toContain(id);
      const queue = [...before.waitlist];
      const skipped: string[] = [];
      let promoted: string | null = null;
      while (promoted === null && queue.length > 0) {
        const head = queue.shift()!;
        if (eligible(head)) promoted = head;
        else skipped.push(head);
      }
      expect(result).toEqual({ ok: true, code: 'DROPPED', promoted, skipped });
      expect(after.enrolled).toEqual(promoted ? [...without(before.enrolled, id), promoted] : without(before.enrolled, id));
      expect(after.waitlist).toEqual(queue);
      break;
    }
  }
}

describe('invariant sweep (S1)', () => {
  const ALL_CODES = [
    'ENROLLED', 'WAITLISTED', 'ALREADY_ENROLLED', 'ALREADY_WAITLISTED', 'PREREQ_NOT_MET',
    'UNKNOWN_LEARNER', 'INVALID_REQUEST', 'DROPPED', 'LEFT_WAITLIST', 'NOT_ENROLLED',
  ];
  const REQUEST_IDS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', ' l3 ', 'L99', ''];
  const LEARNERS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8'];

  it('holds every invariant and post-condition across seeded random operation sequences', () => {
    const seen = new Set<string>();
    let dropsWithSkips = 0;

    for (let seed = 1; seed <= 25; seed++) {
      const rand = mulberry32(seed);
      const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
      const learners = Object.fromEntries(LEARNERS.map((l) => [l, l === 'L8' ? [] : [C101]]));
      const { offering, directory } = setup({ capacity: 3, learners }); // checked(): I1/I2/I7 after every call

      for (let step = 0; step < 80; step++) {
        const roll = rand();
        if (roll < 0.1) {
          directory.setCompletedCourses(pick(LEARNERS), rand() < 0.5 ? [] : [C101]);
          continue;
        }
        const op = roll < 0.55 ? 'enroll' : 'drop';
        const raw = pick(REQUEST_IDS);
        const before = offering.snapshot();
        const result = op === 'enroll' ? offering.enroll(raw) : offering.drop(raw);
        checkTransition(before, offering.snapshot(), op, raw, result, directory);
        seen.add(result.code);
        if (result.code === 'DROPPED' && result.skipped.length > 0) dropsWithSkips++;
      }
    }

    // The sweep is only meaningful if it actually exercised every outcome, including skip-and-remove.
    expect([...seen].sort()).toEqual([...ALL_CODES].sort());
    expect(dropsWithSkips).toBeGreaterThan(0);
  });
});

describe('snapshot isolation (S2)', () => {
  it('returns copies: mutating a snapshot does not change the offering', () => {
    const { offering } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L2'], 'WAITLISTED');
    const snap = offering.snapshot();
    (snap.enrolled as string[]).push('L9');
    (snap.waitlist as string[]).length = 0;
    (snap.requiredCourseIds as string[]).length = 0;
    expect(offering.snapshot()).toMatchObject({ requiredCourseIds: [C101], enrolled: ['L1'], waitlist: ['L2'] });
  });
});

describe('waitlisted learner missing from the directory at promotion', () => {
  it('is skipped as ineligible (DESIGN.md §6)', () => {
    const records = new Map<string, ReadonlySet<string>>([
      ['L1', new Set([C101])],
      ['L2', new Set([C101])],
      ['L3', new Set([C101])],
    ]);
    const directory: LearnerDirectory = { getCompletedCourses: (id) => records.get(normalizeId(id)) };
    const offering = new CourseOffering({ capacity: 1, requiredCourseIds: [C101], directory });
    offering.enroll('L1');
    offering.enroll('L2');
    offering.enroll('L3');
    records.delete('L2');
    expect(offering.drop('L1')).toEqual({ ok: true, code: 'DROPPED', promoted: 'L3', skipped: ['L2'] });
  });
});

/**
 * R1 — regression guard, NOT proof of thread safety. enroll/drop are synchronous, so these "concurrent"
 * calls run one after another on Node's single thread. The test fails if someone makes the operations
 * async with an await between the capacity check and the insert. See DESIGN.md §7 and LIMITATIONS.md.
 */
describe('concurrent requests (R1, regression guard)', () => {
  it('gives the last seat to exactly one of two simultaneous enrolls', async () => {
    const { offering } = setup({ capacity: 2 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    const results = await Promise.all(
      ['L2', 'L3'].map((id) => Promise.resolve().then(() => offering.enroll(id))),
    );
    expect(results.map((r) => r.code).sort()).toEqual(['ENROLLED', 'WAITLISTED']);
    expect(offering.snapshot()).toMatchObject({ enrolled: ['L1', 'L2'], waitlist: ['L3'] });
  });

  it('a newcomer racing a drop does not jump the waitlist', async () => {
    const { offering } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L2'], 'WAITLISTED');
    const [dropResult, enrollResult] = await Promise.all([
      Promise.resolve().then(() => offering.drop('L1')),
      Promise.resolve().then(() => offering.enroll('L3')),
    ]);
    expect(dropResult).toMatchObject({ code: 'DROPPED', promoted: 'L2' });
    expect(enrollResult).toEqual({ ok: true, code: 'WAITLISTED', position: 1 });
  });
});
