# Limitations and Follow-up Risks

These are limits that are known and accepted within this feature's scope, plus the risks to address before relying on it beyond
that scope. Each one names where it is documented or tested.

## Scope and runtime
1. **In memory and single process.** All state lives in one `CourseOffering` object and is lost on restart. There is no persistence.
2. **Atomicity rests on Node's single thread.** `enroll` and `drop` are synchronous with no `await`, so calls cannot
   interleave *within one process*. That guarantee disappears with multiple processes or instances, or with a real database.
   *Follow-up:* wrap the seat release and promotion together in one per-offering transaction or lock, such as a row lock or an
   optimistic version check (DESIGN.md §7).
3. **The concurrency tests are regression guards, not proof.** The two `Promise.all` tests in `tests/invariants.test.ts`
   run sequentially on one thread. They would catch someone adding an `await` between a check and its mutation. They
   do **not** demonstrate thread safety or multi-instance safety.
4. **A directory failure surfaces as a thrown exception, not a result code.** If `LearnerDirectory.getCompletedCourses`
   throws, `enroll` or `drop` rethrows it with offering state unchanged (Finding F1, fixed and tested). Callers must handle
   the exception. There is no retry and no `UNAVAILABLE` code.

## Policy consequences
5. **A revoked prerequisite does not evict an enrolled learner.** Eligibility is checked only at join and at promotion.
   Re-requesting `enroll` returns `ALREADY_ENROLLED` (test E12).
6. **Ineligible learners deep in the waitlist keep their place until they reach the front.** Only the head is re-checked,
   so `WAITLISTED.position` and the waitlist length can overstate how many learners will actually be promoted.
7. **A skipped learner loses their position.** Under skip-and-remove, regaining eligibility means re-joining at the
   back of the waitlist (test D9). The skip is reported only through `DROPPED.skipped`; no notification is sent.
8. **No drop history.** A repeated drop and a drop by a learner who never enrolled both return `NOT_ENROLLED` (D11, D12).
   Re-enrollment after dropping is always allowed (D16).
9. **A deleted learner record has asymmetric effects.** A learner already in the offering can still `drop` (option A).
   But if an *enrolled* learner whose record has been deleted calls `enroll`, they get `UNKNOWN_LEARNER` rather than
   `ALREADY_ENROLLED`. No state changes either way. A waitlisted learner with no record is skipped at promotion.
10. **Capacity is fixed at construction.** There is no runtime capacity change, so there is no bulk promotion when capacity grows.

## IDs
11. **IDs are case-insensitive.** Two IDs that differ only by case or full-width form can't coexist. The in-memory
    directory refuses seed data that collides after normalisation, but a custom `LearnerDirectory` must keep its own keys
    canonical: the offering always queries it with the normalised ID.
12. **Separators, internal spaces and leading zeros are not folded** (`L-1`, `L 1`, `L01` ≠ `L1`). Callers with such
    variants in their data get `UNKNOWN_LEARNER`.

## Performance
13. **Linear-time waitlist operations.** `includes`, `indexOf` and `splice` on the waitlist array are O(n). A drop may do
    one directory lookup per ineligible head. This is fine for one offering. For large queues, use an indexed queue.

## Verification
14. **The mutation checks are hand-picked**, not generated (no Stryker). There are 17 mutants, all killed. They cover the bugs
    judged likely, not every possible bug. The `find` snippets in `scripts/mutate.mjs` are tied to the current code.
15. **Some behaviour is pinned by a single test.** Mutants (h), (j), (k), (m) and (o) are caught by only 1–2 tests
    (VERIFICATION.md §1). Deleting those tests would let the corresponding regression through silently.
16. **The S1 sweep's oracle reuses the production prerequisite rule** (`isEligible`). It cannot catch a bug inside that
    function. The U1 unit tests and mutants (n) and (o) cover it instead.
17. **The hand trace was produced by the AI.** It becomes independent evidence once the engineer has checked it (VERIFICATION.md §2).
18. **The scoring rubric was not available.** The assessment references `Course-Registration-Rubric-Score.md`, but it was
    not supplied. The final self-review is against the acceptance criteria and candidate expectations only.

## Toolchain
19. **Recent major versions:** TypeScript 7.0.2 and Vitest 5.0.5 (exact-pinned, with a committed lockfile). Reviewers on an older
    Node must still fall within the supported `engines` range.
