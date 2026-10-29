import { describe, expect, it } from 'vitest';
import { isEligible, missingPrerequisites } from '../src/eligibility.js';
import { InMemoryLearnerDirectory } from '../src/learnerDirectory.js';

const set = (...ids: string[]) => new Set(ids);

// U1 — the single prerequisite rule (AC1, AC4; invariant I6)
describe('prerequisite rule', () => {
  it('treats every learner as eligible when no courses are required', () => {
    expect(isEligible(set(), set())).toBe(true);
    expect(missingPrerequisites(set(), set('C101'))).toEqual([]);
  });

  it('is eligible when every required course is completed (extra courses are ignored)', () => {
    expect(isEligible(set('C101', 'C102'), set('C102', 'C101', 'C999'))).toBe(true);
  });

  it('is ineligible when only some required courses are completed, and reports the rest', () => {
    expect(isEligible(set('C101', 'C102'), set('C101'))).toBe(false);
    expect(missingPrerequisites(set('C101', 'C102'), set('C101'))).toEqual(['C102']);
  });

  it('is ineligible when no required course is completed, listing all in required order', () => {
    expect(isEligible(set('C101', 'C102'), set())).toBe(false);
    expect(missingPrerequisites(set('C101', 'C102'), set())).toEqual(['C101', 'C102']);
  });

  it('matches course IDs in canonical form (case, surrounding whitespace, full-width)', () => {
    expect(isEligible(set('C101'), set(' c101 '))).toBe(true);
    expect(isEligible(set(' c101'), set('C101'))).toBe(true);
    expect(isEligible(set('C101'), set('Ｃ１０１'))).toBe(true);
  });

  it('does not fold separators: C-101 does not satisfy C101', () => {
    expect(isEligible(set('C101'), set('C-101'))).toBe(false);
  });

  it('reports missing courses canonicalised and de-duplicated', () => {
    expect(missingPrerequisites(set('c102', 'C102 ', 'C101'), set('C101'))).toEqual(['C102']);
  });
});

describe('InMemoryLearnerDirectory', () => {
  it('returns undefined for an unknown learner', () => {
    expect(new InMemoryLearnerDirectory({ L1: [] }).getCompletedCourses('L2')).toBeUndefined();
  });

  it('distinguishes a known learner with no completed courses from an unknown one', () => {
    expect(new InMemoryLearnerDirectory({ L1: [] }).getCompletedCourses('L1')).toEqual(new Set());
  });

  it('replaces a record on update, modelling a revoked prerequisite', () => {
    const directory = new InMemoryLearnerDirectory({ L1: ['C101'] });
    directory.setCompletedCourses('L1', []);
    expect(directory.getCompletedCourses('L1')).toEqual(new Set());
  });

  it('looks learners up by canonical ID and stores canonical course IDs', () => {
    const directory = new InMemoryLearnerDirectory({ l1: [' c101 '] });
    expect(directory.getCompletedCourses(' L1 ')).toEqual(new Set(['C101']));
    expect(directory.getCompletedCourses('Ｌ１')).toEqual(new Set(['C101']));
  });

  it('refuses seed data where two IDs collapse to the same canonical ID', () => {
    expect(() => new InMemoryLearnerDirectory({ l1: [], L1: [] })).toThrow(/Duplicate learner ID/);
  });

  it('refuses a blank learner ID', () => {
    expect(() => new InMemoryLearnerDirectory({ '  ': [] })).toThrow(RangeError);
  });

  it('removes a learner by canonical ID', () => {
    const directory = new InMemoryLearnerDirectory({ L1: [], L2: [] });
    directory.removeLearner(' l1 ');
    expect(directory.getCompletedCourses('L1')).toBeUndefined();
    expect(directory.getCompletedCourses('L2')).toEqual(new Set());
  });

  it('copies input arrays, so later caller mutation does not leak in', () => {
    const courses = ['C101'];
    const directory = new InMemoryLearnerDirectory({ L1: courses });
    courses.push('C102');
    expect(directory.getCompletedCourses('L1')).toEqual(new Set(['C101']));
  });
});
