# Course Waitlist

Enrollment, dropping and FIFO waitlist promotion for **one course offering**, as a small in-memory TypeScript service.
No starter project was supplied, so this follows the assessment's fallback: no frontend, database or CLI. Behaviour is
demonstrated through automated tests.

## Requirements
- Node.js `^22.12.0 || ^24.0.0 || >=26.0.0` (the range Vitest 5 supports). Developed on Node v26.13.0 / npm 11.20.0.
- No other system dependencies.

## Setup and commands
```sh
npm ci                  # install the exact versions from package-lock.json
npm test                # run the test suite (Vitest)
npm run typecheck       # strict TypeScript check (tsc --noEmit)
npm run coverage        # tests + V8 coverage report
npm run mutate          # mutation checks: needs a clean git checkout of src/ (see VERIFICATION.md)
npm run test:watch      # watch mode, for development
```
Expected results: `npm test` → 94 passed. `npm run coverage` → 100% statements, branches, functions and lines.
`npm run mutate` → `17/17 mutants killed.`

## Usage
```ts
import { CourseOffering, InMemoryLearnerDirectory } from './src/index.js';

const directory = new InMemoryLearnerDirectory({ L1: ['C101'], L2: ['C101'], L3: [], L4: ['C101'] });
const offering = new CourseOffering({ capacity: 1, requiredCourseIds: ['C101'], directory });

console.log(offering.enroll('L1')); // { ok: true, code: 'ENROLLED' }
console.log(offering.enroll('l1')); // { ok: false, code: 'ALREADY_ENROLLED' }  (IDs are normalised)
console.log(offering.enroll('L3')); // { ok: false, code: 'PREREQ_NOT_MET', missing: ['C101'] }
console.log(offering.enroll('L2')); // { ok: true, code: 'WAITLISTED', position: 1 }
console.log(offering.enroll('L4')); // { ok: true, code: 'WAITLISTED', position: 2 }

directory.setCompletedCourses('L2', []); // L2's prerequisite is revoked while waiting
console.log(offering.drop('L1'));  // { ok: true, code: 'DROPPED', promoted: 'L4', skipped: ['L2'] }
console.log(offering.snapshot());  // { capacity: 1, requiredCourseIds: ['C101'], enrolled: ['L4'], waitlist: [] }
```
(This snippet was checked by running it as a temporary test; the commented values are its actual output.)

## Policy in brief
Full detail and rationale: [DESIGN.md](DESIGN.md).
- **Prerequisite rule:** a learner must have completed *every* required course.
- **Ineligible at join:** rejected with `PREREQ_NOT_MET`. They never join the waitlist.
- **Ineligible at the front of the queue:** **skip and remove**. Eligibility is re-checked at promotion, ineligible heads
  are removed and reported in `skipped`, and the earliest *eligible* learner is promoted.
- **Duplicates** (`ALREADY_ENROLLED` / `ALREADY_WAITLISTED`) and invalid or repeated requests return a result code and change nothing.
- **Drop** frees the seat and promotes in one synchronous step. `drop` on a waitlisted learner removes them from the waitlist.
- **Re-enrollment** after dropping is a fresh request: a seat if one is free, otherwise the back of the waitlist.
- **IDs** are normalised (Unicode NFKC, trimmed, upper-cased), so `' l1 '` is `L1`. Separators and leading zeros are kept (`L-1` ≠ `L1`).

## Project layout
```
src/
  courseOffering.ts     CourseOffering: enroll / drop / snapshot, promotion
  eligibility.ts        the single prerequisite rule (used at join and at promotion)
  ids.ts                ID normalisation
  learnerDirectory.ts   LearnerDirectory port + in-memory implementation
  types.ts              result types and codes
  index.ts              public exports
tests/
  helpers.ts            setup, invariant checks after every call, unchanged-state assertion
  enroll.test.ts  drop.test.ts  promotion.test.ts  invariants.test.ts  eligibility.test.ts  ids.test.ts
scripts/mutate.mjs      mutation-check runner (npm run mutate)
```

## Documents
| File | Contents |
|---|---|
| [DESIGN.md](DESIGN.md) | Design specification: service boundary, data model and API, invariants, promotion rule, concurrency, assumptions and tradeoffs |
| [VERIFICATION.md](VERIFICATION.md) | Independent-verification evidence: mutation checks, hand trace, invariant review, Finding F1 |
| [AI_USAGE.md](AI_USAGE.md) | AI prompt and use record: prompts, responses, accept/edit/reject, verification per change |
| [LIMITATIONS.md](LIMITATIONS.md) | Known limitations and follow-up risks |
