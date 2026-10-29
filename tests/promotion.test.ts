import { describe, expect, it } from 'vitest';
import { C101, eligibleLearners, enrollAll, expectUnchanged, setup } from './helpers.js';

describe('FIFO promotion (AC3, AC6)', () => {
  // D2
  it('promotes the head of the waitlist into the freed seat in the same step', () => {
    const { offering } = setup({ capacity: 2 });
    enrollAll(offering, ['L1', 'L2'], 'ENROLLED');
    enrollAll(offering, ['L3', 'L4'], 'WAITLISTED');
    expect(offering.drop('L1')).toEqual({ ok: true, code: 'DROPPED', promoted: 'L3', skipped: [] });
    expect(offering.snapshot()).toMatchObject({ enrolled: ['L2', 'L3'], waitlist: ['L4'] });
  });

  // D3
  it('promotes in join order across successive drops', () => {
    const { offering } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L2', 'L3', 'L4'], 'WAITLISTED');
    expect(offering.drop('L1')).toMatchObject({ promoted: 'L2' });
    expect(offering.drop('L2')).toMatchObject({ promoted: 'L3' });
    expect(offering.drop('L3')).toMatchObject({ promoted: 'L4' });
    expect(offering.drop('L4')).toMatchObject({ promoted: null });
    expect(offering.snapshot()).toMatchObject({ enrolled: [], waitlist: [] });
  });

  // D4
  it('uses join order, not ID order', () => {
    const { offering } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L9', 'L3', 'L5'], 'WAITLISTED');
    expect(offering.drop('L1')).toMatchObject({ promoted: 'L9' });
    expect(offering.snapshot().waitlist).toEqual(['L3', 'L5']);
  });

  it('a learner who left the waitlist is never promoted', () => {
    const { offering } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L2', 'L3'], 'WAITLISTED');
    offering.drop('L2');
    expect(offering.drop('L1')).toMatchObject({ promoted: 'L3', skipped: [] });
  });
});

describe('ineligible learner at the front of the queue: skip and remove (AC4)', () => {
  // D5
  it('skips and removes a head whose prerequisite was revoked, promoting the next eligible learner', () => {
    const { offering, directory } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L2', 'L3', 'L4'], 'WAITLISTED');
    directory.setCompletedCourses('L2', []);
    expect(offering.drop('L1')).toEqual({ ok: true, code: 'DROPPED', promoted: 'L3', skipped: ['L2'] });
    expect(offering.snapshot()).toMatchObject({ enrolled: ['L3'], waitlist: ['L4'] });
  });

  // D6
  it('skips several ineligible learners in a row and promotes the first eligible one', () => {
    const { offering, directory } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L2', 'L3', 'L4', 'L5'], 'WAITLISTED');
    directory.setCompletedCourses('L2', []);
    directory.setCompletedCourses('L3', []);
    expect(offering.drop('L1')).toMatchObject({ promoted: 'L4', skipped: ['L2', 'L3'] });
    expect(offering.snapshot()).toMatchObject({ enrolled: ['L4'], waitlist: ['L5'] });
  });

  it('does not touch ineligible learners behind the promoted one', () => {
    const { offering, directory } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L2', 'L3'], 'WAITLISTED');
    directory.setCompletedCourses('L3', []);
    expect(offering.drop('L1')).toMatchObject({ promoted: 'L2', skipped: [] });
    expect(offering.snapshot().waitlist).toEqual(['L3']);
  });

  // D7
  it('leaves the seat open and empties the waitlist when everyone waiting is ineligible', () => {
    const { offering, directory } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L2', 'L3'], 'WAITLISTED');
    directory.setCompletedCourses('L2', []);
    directory.setCompletedCourses('L3', []);
    expect(offering.drop('L1')).toEqual({ ok: true, code: 'DROPPED', promoted: null, skipped: ['L2', 'L3'] });
    expect(offering.snapshot()).toMatchObject({ enrolled: [], waitlist: [] });
  });

  // E13
  it('after everyone waiting was skipped, a newcomer takes the open seat; skipped learners stay out', () => {
    const { offering, directory } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L2'], 'WAITLISTED');
    directory.setCompletedCourses('L2', []);
    offering.drop('L1');
    expect(expectUnchanged(offering, () => offering.enroll('L2')).code).toBe('PREREQ_NOT_MET');
    expect(offering.enroll('L3').code).toBe('ENROLLED');
  });

  // D8
  it('applies the same rule at join time and at promotion time', () => {
    const learners = { ...eligibleLearners(3), L4: [] as string[] };
    const { offering, directory } = setup({ capacity: 1, learners });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L2', 'L3'], 'WAITLISTED');
    // L4's record (no C101) is rejected at join...
    expect(offering.enroll('L4')).toMatchObject({ code: 'PREREQ_NOT_MET', missing: [C101] });
    // ...and the same record on a waitlisted learner causes a skip at promotion.
    directory.setCompletedCourses('L2', []);
    expect(offering.drop('L1')).toMatchObject({ promoted: 'L3', skipped: ['L2'] });
  });

  it('re-checks eligibility at promotion, so a learner who regains it before the drop is promoted', () => {
    const { offering, directory } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L2'], 'WAITLISTED');
    directory.setCompletedCourses('L2', []);
    directory.setCompletedCourses('L2', [C101]);
    expect(offering.drop('L1')).toMatchObject({ promoted: 'L2', skipped: [] });
  });

  // D9
  it('lets a skipped learner who regains eligibility enroll again as a new request', () => {
    const { offering, directory } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L2'], 'WAITLISTED');
    directory.setCompletedCourses('L2', []);
    expect(offering.drop('L1')).toMatchObject({ skipped: ['L2'] });
    directory.setCompletedCourses('L2', [C101]);
    expect(offering.enroll('L2').code).toBe('ENROLLED');
  });
});
