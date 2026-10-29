import { describe, expect, it } from 'vitest';
import { enrollAll, expectUnchanged, setup } from './helpers.js';

describe('drop an enrolled learner (AC3)', () => {
  // D1
  it('frees the seat when nobody is waiting', () => {
    const { offering } = setup({ capacity: 2 });
    enrollAll(offering, ['L1', 'L2'], 'ENROLLED');
    expect(offering.drop('L1')).toEqual({ ok: true, code: 'DROPPED', promoted: null, skipped: [] });
    expect(offering.snapshot()).toMatchObject({ enrolled: ['L2'], waitlist: [] });
    expect(offering.enroll('L3').code).toBe('ENROLLED');
  });

  it('accepts a differently formatted ID for the same learner', () => {
    const { offering } = setup();
    enrollAll(offering, ['L1'], 'ENROLLED');
    expect(offering.drop(' l1 ').code).toBe('DROPPED');
    expect(offering.snapshot().enrolled).toEqual([]);
  });
});

describe('leave the waitlist (A6)', () => {
  // D10
  it('removes a waitlisted learner without promoting anyone, keeping the others in order', () => {
    const { offering } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L2', 'L3', 'L4'], 'WAITLISTED');
    expect(offering.drop('L3')).toEqual({ ok: true, code: 'LEFT_WAITLIST' });
    expect(offering.snapshot()).toMatchObject({ enrolled: ['L1'], waitlist: ['L2', 'L4'] });
  });
});

describe('invalid and repeated drops (AC5, AC6)', () => {
  // D11
  it('returns NOT_ENROLLED for a known learner who never enrolled, without changing state', () => {
    const { offering } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L2'], 'WAITLISTED');
    expect(expectUnchanged(offering, () => offering.drop('L3'))).toEqual({ ok: false, code: 'NOT_ENROLLED' });
  });

  // D12
  it('returns NOT_ENROLLED on a repeated drop, with no second promotion', () => {
    const { offering } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L2', 'L3'], 'WAITLISTED');
    expect(offering.drop('L1')).toMatchObject({ code: 'DROPPED', promoted: 'L2' });
    expect(expectUnchanged(offering, () => offering.drop('L1'))).toEqual({ ok: false, code: 'NOT_ENROLLED' });
    expect(offering.snapshot()).toMatchObject({ enrolled: ['L2'], waitlist: ['L3'] });
  });

  it('returns NOT_ENROLLED for a repeated leave-waitlist', () => {
    const { offering } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L2'], 'WAITLISTED');
    expect(offering.drop('L2').code).toBe('LEFT_WAITLIST');
    expect(expectUnchanged(offering, () => offering.drop('L2')).code).toBe('NOT_ENROLLED');
  });

  // D13
  it('returns UNKNOWN_LEARNER for an ID not in the directory, without changing state', () => {
    const { offering } = setup();
    enrollAll(offering, ['L1'], 'ENROLLED');
    expect(expectUnchanged(offering, () => offering.drop('L99'))).toEqual({ ok: false, code: 'UNKNOWN_LEARNER' });
  });

  // D14
  it.each<[string, unknown]>([
    ['empty string', ''],
    ['whitespace only', '\t '],
    ['number', 1],
    ['null', null],
    ['undefined', undefined],
  ])('returns INVALID_REQUEST for %s, without changing state', (_label, raw) => {
    const { offering } = setup();
    enrollAll(offering, ['L1'], 'ENROLLED');
    expect(expectUnchanged(offering, () => offering.drop(raw as string))).toMatchObject({
      ok: false,
      code: 'INVALID_REQUEST',
    });
  });
});

describe('learner record deleted while in the offering (option A)', () => {
  it('still lets an enrolled learner drop, freeing the seat and promoting the next learner', () => {
    const { offering, directory } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L2'], 'WAITLISTED');
    directory.removeLearner('L1');
    expect(offering.drop('L1')).toEqual({ ok: true, code: 'DROPPED', promoted: 'L2', skipped: [] });
    expect(offering.snapshot()).toMatchObject({ enrolled: ['L2'], waitlist: [] });
  });

  it('still lets a waitlisted learner leave the waitlist', () => {
    const { offering, directory } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L2', 'L3'], 'WAITLISTED');
    directory.removeLearner('L2');
    expect(offering.drop('L2')).toEqual({ ok: true, code: 'LEFT_WAITLIST' });
    expect(offering.snapshot().waitlist).toEqual(['L3']);
  });

  it('returns UNKNOWN_LEARNER once the deleted learner is no longer in the offering', () => {
    const { offering, directory } = setup();
    enrollAll(offering, ['L1'], 'ENROLLED');
    directory.removeLearner('L1');
    offering.drop('L1');
    expect(expectUnchanged(offering, () => offering.drop('L1'))).toEqual({ ok: false, code: 'UNKNOWN_LEARNER' });
  });
});

describe('re-enrollment (A4)', () => {
  // D15
  it('treats a promoted learner as enrolled: duplicate enroll is a no-op and they can drop', () => {
    const { offering } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    enrollAll(offering, ['L2'], 'WAITLISTED');
    offering.drop('L1');
    expect(expectUnchanged(offering, () => offering.enroll('L2')).code).toBe('ALREADY_ENROLLED');
    expect(offering.drop('L2')).toMatchObject({ code: 'DROPPED' });
  });

  // D16
  it('lets a dropped learner re-enroll: a free seat if available, otherwise the back of the waitlist', () => {
    const { offering } = setup({ capacity: 1 });
    enrollAll(offering, ['L1'], 'ENROLLED');
    offering.drop('L1');
    expect(offering.enroll('L1').code).toBe('ENROLLED');

    enrollAll(offering, ['L2', 'L3'], 'WAITLISTED');
    offering.drop('L1'); // L2 promoted
    expect(offering.enroll('L1')).toEqual({ ok: true, code: 'WAITLISTED', position: 2 });
    expect(offering.snapshot()).toMatchObject({ enrolled: ['L2'], waitlist: ['L3', 'L1'] });
  });
});
