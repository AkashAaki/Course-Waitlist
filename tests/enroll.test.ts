import { describe, expect, it } from 'vitest';
import { CourseOffering } from '../src/courseOffering.js';
import { InMemoryLearnerDirectory } from '../src/learnerDirectory.js';
import { C101, C102, enrollAll, expectUnchanged, setup } from './helpers.js';

describe('construction', () => {
  // C1 — capacity is a positive integer fixed at construction (A6b)
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects capacity %s', (capacity) => {
    const directory = new InMemoryLearnerDirectory();
    expect(() => new CourseOffering({ capacity, directory })).toThrow(RangeError);
  });

  it('starts empty, with canonical prerequisite IDs', () => {
    const { offering } = setup({ capacity: 3, required: [' c101 ', 'C102'] });
    expect(offering.snapshot()).toEqual({
      capacity: 3,
      requiredCourseIds: [C101, C102],
      enrolled: [],
      waitlist: [],
    });
  });

  it('treats omitted prerequisites as none', () => {
    const directory = new InMemoryLearnerDirectory({ L1: [] });
    const offering = new CourseOffering({ capacity: 1, directory });
    expect(offering.enroll('L1')).toEqual({ ok: true, code: 'ENROLLED' });
  });
});

describe('enroll with capacity remaining (AC1)', () => {
  // E1
  it('enrolls an eligible learner when a seat is free', () => {
    const { offering } = setup();
    expect(offering.enroll('L1')).toEqual({ ok: true, code: 'ENROLLED' });
    expect(offering.snapshot().enrolled).toEqual(['L1']);
  });

  // E2
  it('fills exactly to capacity', () => {
    const { offering } = setup({ capacity: 2 });
    enrollAll(offering, ['L1', 'L2'], 'ENROLLED');
    expect(offering.snapshot()).toMatchObject({ enrolled: ['L1', 'L2'], waitlist: [] });
  });

  it('stores the canonical ID for a non-canonical request', () => {
    const { offering } = setup();
    expect(offering.enroll(' l1 ').code).toBe('ENROLLED');
    expect(offering.snapshot().enrolled).toEqual(['L1']);
  });
});

describe('prerequisite failure (AC4, AC6)', () => {
  // E3
  it('rejects an ineligible learner even when a seat is free, without changing state', () => {
    const { offering } = setup({ learners: { L1: [] } });
    const result = expectUnchanged(offering, () => offering.enroll('L1'));
    expect(result).toEqual({ ok: false, code: 'PREREQ_NOT_MET', missing: [C101] });
  });

  // E4
  it('rejects a learner who has only some prerequisites, listing the missing ones', () => {
    const { offering } = setup({ required: [C101, C102], learners: { L1: [C101] } });
    const result = expectUnchanged(offering, () => offering.enroll('L1'));
    expect(result).toEqual({ ok: false, code: 'PREREQ_NOT_MET', missing: [C102] });
  });
});

describe('enroll when full (AC2)', () => {
  // E5
  it('waitlists eligible learners in join order with 1-based positions', () => {
    const { offering } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    expect(offering.enroll('L2')).toEqual({ ok: true, code: 'WAITLISTED', position: 1 });
    expect(offering.enroll('L3')).toEqual({ ok: true, code: 'WAITLISTED', position: 2 });
    expect(offering.snapshot()).toMatchObject({ enrolled: ['L1'], waitlist: ['L2', 'L3'] });
  });

  // E6
  it('does not waitlist an ineligible learner', () => {
    const { offering } = setup({ capacity: 1, learners: { L1: [C101], L2: [] } });
    enrollAll(offering, ['L1'], 'ENROLLED');
    const result = expectUnchanged(offering, () => offering.enroll('L2'));
    expect(result).toEqual({ ok: false, code: 'PREREQ_NOT_MET', missing: [C101] });
  });
});

describe('duplicate enrollment requests (AC2, AC5)', () => {
  // E7
  it('returns ALREADY_ENROLLED for an enrolled learner, without changing state', () => {
    const { offering } = setup();
    enrollAll(offering, ['L1'], 'ENROLLED');
    expect(expectUnchanged(offering, () => offering.enroll('L1'))).toEqual({ ok: false, code: 'ALREADY_ENROLLED' });
  });

  it('treats a differently formatted ID as the same learner', () => {
    const { offering } = setup();
    enrollAll(offering, ['L1'], 'ENROLLED');
    expect(expectUnchanged(offering, () => offering.enroll(' l1')).code).toBe('ALREADY_ENROLLED');
  });

  // E8
  it('returns ALREADY_WAITLISTED for a waitlisted learner, keeping order and length', () => {
    const { offering } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L2', 'L3'], 'WAITLISTED');
    expect(expectUnchanged(offering, () => offering.enroll('L2'))).toEqual({ ok: false, code: 'ALREADY_WAITLISTED' });
    expect(offering.snapshot().waitlist).toEqual(['L2', 'L3']);
  });

  // E9
  it('never creates a second record however many times a learner retries', () => {
    const { offering } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L1', 'L1'], 'ALREADY_ENROLLED');
    enrollAll(offering, ['L2'], 'WAITLISTED');
    enrollAll(offering, ['L2', 'L2'], 'ALREADY_WAITLISTED');
    expect(offering.snapshot()).toMatchObject({ enrolled: ['L1'], waitlist: ['L2'] });
  });

  // E12
  it('keeps an enrolled learner whose prerequisite is later revoked (ALREADY_ENROLLED, no eviction)', () => {
    const { offering, directory } = setup();
    enrollAll(offering, ['L1'], 'ENROLLED');
    directory.setCompletedCourses('L1', []);
    expect(expectUnchanged(offering, () => offering.enroll('L1')).code).toBe('ALREADY_ENROLLED');
    expect(offering.snapshot().enrolled).toEqual(['L1']);
  });
});

describe('invalid and unknown learners (AC5)', () => {
  // E10
  it('returns UNKNOWN_LEARNER for an ID not in the directory, without changing state', () => {
    const { offering } = setup();
    expect(expectUnchanged(offering, () => offering.enroll('L99'))).toEqual({ ok: false, code: 'UNKNOWN_LEARNER' });
  });

  it('does not fold separators: L-1 is a different (unknown) learner', () => {
    const { offering } = setup();
    expect(expectUnchanged(offering, () => offering.enroll('L-1')).code).toBe('UNKNOWN_LEARNER');
  });

  // E11
  it.each<[string, unknown]>([
    ['empty string', ''],
    ['whitespace only', '   '],
    ['number', 123],
    ['null', null],
    ['undefined', undefined],
    ['object', { id: 'L1' }],
  ])('returns INVALID_REQUEST for %s, without changing state', (_label, raw) => {
    const { offering } = setup();
    enrollAll(offering, ['L1'], 'ENROLLED');
    const result = expectUnchanged(offering, () => offering.enroll(raw as string));
    expect(result).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
    expect(result.code === 'INVALID_REQUEST' && result.reason).toEqual(expect.any(String));
  });
});
