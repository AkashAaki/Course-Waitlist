# Verification

This file covers the verification strategy (§0), Phase 4's independent verification (§1–§3) and the Phase 6 self-review
against the spec (§4). Who ran each check is stated; engineer-run output is in [evidence/engineer-runs.md](evidence/engineer-runs.md).

Environment: Node v26.13.0, Vitest 5.0.5. Phase 4 started from commit `9fee9bb` (Phase 3: 90/90 passing, 100% coverage).
It found and fixed one defect (F1, §3). The final state is **94/94 passing** with 100% statement, branch, function and
line coverage. Coverage shows that every line *ran*. The mutation checks show that the assertions *notice* when behaviour breaks.

## 0. Strategy
Each layer answers a different question, and none is relied on alone. The layers that found something are the ones
that went beyond coverage: the invariant review found F1, and mutation checks then pinned the fix.

| Layer | Question it answers | Evidence | Limit | Run by |
|---|---|---|---|---|
| Type check (`tsc --noEmit`) | Do code and tests respect the result-code unions in `src/types.ts`? | exit 0 | Says nothing about behaviour | Engineer, Phases 0–3 and 5 |
| Scenario tests | Does each acceptance criterion and stated policy behave as specified? | 94 passing; map in §0.1 and §4.2 | Only the scenarios written | Engineer, Phases 4–5 |
| Invariant wrapper `checked()`, plus `expectUnchanged` | Do I1, I2, I7 and canonical IDs hold after **every** call? Does a rejection change nothing (I4)? | Used across the suite (`tests/helpers.ts`) | Checks state, not result codes | Within the suite |
| Seeded sweep S1 | Does a random operation sequence break an invariant or an independent post-condition oracle? | 25 seeds × 80 ops; asserts that all 10 result codes and at least one skip occurred | The oracle reuses `isEligible` (LIMITATIONS #16) | Within the suite |
| Tests first | Did each test fail for the intended reason before the code existed? | 58 failed / 28 passed before implementation; 2 failing reproductions each before option A and before the F1 fix | Reproductions are AI-run | Engineer (Phase 2 count); AI (reproductions) |
| Coverage | Did every line and branch run? | 100% (§4.1) | Execution, not detection | AI and engineer, full table |
| Mutation checks | Would the tests notice a likely bug? | 17/17 killed (§1) | Hand-picked set | Engineer at `adf98c6` and on the final code; AI at `3f660a6` |
| Hand trace H1 | Does a worked example agree with the code? | §2 | AI-produced, then checked by hand | AI; engineer checked |
| Invariant code review | Does each invariant hold on every path, including when the directory throws? | §3; found F1 | Reviewed by the same AI that wrote the code | AI |
| Concurrency regression guards | Does a racing enroll or drop keep last-seat and FIFO behaviour? | 2 `Promise.all` tests (R1) | Not proof of thread safety; no async mutant was run (§1 Limits) | Within the suite |
| Clean clone | Does the repo install, build and pass from scratch? | §4.1 | Node 26 only | AI |

### 0.1 Failure scenarios and edge cases
Test IDs are the comments in `tests/`; "unnamed" tests carry no ID and are identified by their test name.

| Scenario | Expected outcome | Tests |
|---|---|---|
| Capacity 0, negative, fractional, NaN or ∞ | `RangeError` at construction | C1 |
| Seat free, prerequisites met / not met | `ENROLLED` / `PREREQ_NOT_MET` listing missing courses, no change | E1, E2 / E3, E4 |
| Course full, eligible / ineligible learner | `WAITLISTED` with a 1-based position / rejected, never queued | E5 / E6 |
| Duplicate enroll: enrolled, waitlisted, other ID format, repeated retries | `ALREADY_ENROLLED` / `ALREADY_WAITLISTED`; never a second record | E7, E8, E9, unnamed normalised-ID test |
| Prerequisite revoked after enrolment | Stays enrolled; a repeat enroll returns `ALREADY_ENROLLED` | E12 |
| Unknown ID; separator variant `L-1`; non-string or blank ID | `UNKNOWN_LEARNER`; `UNKNOWN_LEARNER`; `INVALID_REQUEST`, no change | E10, D13; unnamed separator test; E11, D14 |
| Drop by a never-enrolled learner; repeated drop; repeated leave | `NOT_ENROLLED`; no second promotion | D11, D12, unnamed repeated-leave test |
| Leave the waitlist | `LEFT_WAITLIST`; no promotion; others keep their order | D10 |
| FIFO promotion | Head promoted in the same step; join order, not ID order; a learner who left is never promoted | D2, D3, D4, unnamed left-waitlist test |
| Ineligible learner at the queue front | Skipped and removed; next eligible promoted; learners behind untouched; all ineligible → seat stays open | D5, D6, unnamed "does not touch" test, D7 |
| Same rule at join and at promotion; eligibility regained before the drop | Identical outcome (I6); re-check promotes them | D8, unnamed re-check test |
| After skips | A newcomer takes the open seat; a skipped learner can re-enroll as a new request | E13, D9 |
| Waitlisted learner deleted from the directory | Skipped as ineligible at promotion | unnamed test in `invariants.test.ts` |
| Learner record deleted while in the offering (option A) | Can still drop or leave; `UNKNOWN_LEARNER` once out | 3 tests in `drop.test.ts` |
| Directory throws during drop or enroll (F1) | Exception propagates; state unchanged | 3 tests in `drop.test.ts` |
| Re-enrollment | A promoted learner counts as enrolled; a dropped learner gets a free seat or the back of the waitlist | D15, D16 |
| Racing requests | Exactly one wins the last seat; a newcomer racing a drop does not jump the queue | R1 (2 tests) |
| Caller mutates a snapshot | No effect on the offering | S2 |

## 1. Mutation checks: `npm run mutate`
`scripts/mutate.mjs` applies one hand-picked bug at a time to `src/`, runs the full suite, records which tests fail, and
restores the file. Each target snippet must occur exactly once before it is mutated. Each run has a 60 s timeout in case a
mutation creates an infinite loop. The script refuses to run on uncommitted `src/` changes unless passed `--allow-dirty`,
restores the file on Ctrl-C, and exits 1 if any mutant survives.

**Final run, against the F1-fixed code:** `src/*.ts` checksums were identical before and after the run, and the suite was
green afterwards.

| # | Mutation | Targets | Result | Failed | Caught by (examples) |
|---|---|---|---|---|---|
| a | Enroll capacity check `<` → `<=` | I1 | **Killed** | 30/94 | `checked()` I1 assertion across many tests |
| b | Promotion scans from the back of the queue | I3 | **Killed** | 14/94 | D2–D4 FIFO, D12, D16, S1 |
| c | Promotion ignores eligibility | AC4, I6 | **Killed** | 10/94 | D5–D8, missing-record skip, S1 |
| d | Promoted learner left on waitlist | I2 | **Killed** | 16/94 | `checked()` I2 assertion, D2, D12, D15 |
| e | Enroll mutates before prerequisite check | I4 | **Killed** | 6/94 | E3, E4, E6 (`expectUnchanged`) |
| f | Promoted learner removed from waitlist but never seated | AC3, I7 | **Killed** | 13/94 | D2–D5, I7 assertion |
| g | No `ALREADY_WAITLISTED` check | AC2, I2 | **Killed** | 3/94 | E8, E9, S1 |
| h | **F1 regression:** seat released before directory lookups | I4, I5 | **Killed** | 2/94 | both directory-failure drop tests |
| i | Promotion stops at first ineligible head (block, not skip) | AC4, A3 | **Killed** | 8/94 | D5, D6, missing-record skip, S1 |
| j | Enroll checks prerequisites before membership | §4 order | **Killed** | 2/94 | E12, S1 |
| k | Option A reverted (drop looks up directory first) | §4 order | **Killed** | 2/94 | both deleted-record drop tests |
| l | Request IDs not normalised (`raw.trim()`) | normalisation | **Killed** | 4/94 | normalised-ID enroll/drop tests |
| m | `snapshot()` returns internal waitlist array | I4 | **Killed** | 2/94 | S2, S1 |
| q | Enroll waitlists even when a seat is free | AC1 | **Killed** | 54/94 | E1, E2, D1 and most setups |
| n | Prerequisite rule checks only the first course | AC1, AC4 | **Killed** | 3/94 | U1 partial/none, E4 |
| o | Prerequisite comparison not normalised | normalisation | **Killed** | 1/94 | U1 canonical-form test only |
| p | `normalizeId` without NFKC | normalisation | **Killed** | 3/94 | `ids.test.ts` full-width case, directory canonical test |

**Result: 17/17 killed.** The first run, against `9fee9bb` before the F1 fix, used 16 mutants (an earlier version of
this set, not committed) and killed 16/16. The set was then updated for the read-then-write code: the old
"loop ignores capacity" mutant no longer applies, so it was replaced by (h), and (q) was added.

**Thin spots** (caught by only 1–2 tests, which should not be deleted):
- **(o)** is caught only by its unit test. The directory already normalises course IDs, so the integration tests can't see
  this bug. That's defence in depth.
- **(h), (j), (k), (m)** are each pinned by dedicated tests, plus S1 for (j) and (m).

**Limits:** the mutations are hand-picked, not generated (no Stryker). They cover the bugs judged likely, not every
possible bug. The `find` snippets are tied to the current code, so a refactor will produce `ERROR` rows until they are updated.
The concurrency guards are not mutation-checked: the advisory chat suggested an `await` mutant inside `enroll` (key prompts 0p),
and it was not run. LIMITATIONS #3's claim that the guards "would catch someone adding an `await`" is therefore reasoned,
not demonstrated.

## 2. Hand trace
Scenario (plan §4): capacity 2; L1 and L2 enrolled; waitlist L3, L4, L5; L4's prerequisite is revoked; drop L1, then drop L2.
The trace below follows the final read-then-write `drop`.

| Step | Read phase (scan waitlist) | Write phase | enrolled | waitlist | Result |
|---|---|---|---|---|---|
| start | — | — | [L1, L2] | [L3, L4, L5] | — |
| drop L1 | L3 eligible → promote L3; skipped [] | remove L1; remove 1 from front; add L3 | [L2, L3] | [L4, L5] | `DROPPED` promoted L3, skipped [] |
| drop L2 | L4 ineligible → skip; L5 eligible → promote L5 | remove L2; remove 2 from front; add L5 | [L3, L5] | [] | `DROPPED` promoted L5, skipped [L4] |

Encoded as test **H1** in `tests/promotion.test.ts`, with expected values taken from this table. It passed on its first run,
both before and after the F1 refactor. The AI did this trace; the **engineer checked it by hand** against `drop()` / `planPromotion()` in
`src/courseOffering.ts` on 2026-10-29, and both rows matched.

## 3. Invariant review (`src/courseOffering.ts`, final)
| Inv | Where it's upheld | Verdict |
|---|---|---|
| I1 enrolled ≤ capacity | `enroll` adds only when `size < capacity`. A drop removes 1 and adds ≤ 1. | ✔ (a) |
| I2 at most once | `enroll` checks `enrolled.has` and `waitlist.includes` first. The promoted learner is spliced off the waitlist and then added. | ✔ (d, g) |
| I3 FIFO | Joins only `push`. Promotion scans from index 0 and removes a front prefix. `LEFT_WAITLIST` `splice` keeps relative order. | ✔ (b) |
| I4 rejected ⇒ unchanged | Every rejection returns before the first mutation. All directory lookups precede mutation. | ✔ (e, h, m) |
| I5 drop + promotion atomic | Synchronous, no `await`. Read phase, then a write phase with no outbound calls. | ✔ (h) |
| I6 same rule | `enroll` → `missingPrerequisites`; `planPromotion` → `isEligible` (delegates to it), with the same `requiredCourseIds`. | ✔ (c, n) |
| I7 waitlist ⇒ full | `enroll` waitlists only when full. A drop with a non-empty waitlist promotes one or empties the scanned prefix. `LEFT_WAITLIST` doesn't touch `enrolled`. | ✔ (f, q) |

### Finding F1: a directory failure during promotion corrupted state (FIXED)
**Found:** reading the code for I4/I5. The Phase 3 `drop` ran `enrolled.delete(id)` and then a promotion loop that
`shift()`ed each head **before** calling `directory.getCompletedCourses(head)`. A temporary probe test (deleted afterwards
and never committed) confirmed it:
```
capacity 1; enrolled [L1]; waitlist [L2, L3]; the directory throws when asked about L2; drop('L1') throws.
expected state unchanged: enrolled [L1], waitlist [L2, L3]
actual:                   enrolled [],   waitlist [L3]     ← L1 dropped despite the error; L2 lost from both lists
```
It was not reachable with `InMemoryLearnerDirectory`, which cannot throw, but it was a real gap at the `LearnerDirectory` port.

**Fix (engineer decision: "read, then write"):** `planPromotion()` does every lookup with no mutation. `drop` then
applies the result with no outbound calls. **Evidence:** three tests were added to `tests/drop.test.ts` *before* the fix
(throw on the head; throw after an earlier head was skipped; throw during enroll). The two drop tests **failed** against the
old code, and the enroll test passed, as expected because enroll was already safe. All three pass after the fix, and mutant (h), which reintroduces the bug, is killed.

## 4. Final self-review (Phase 6)
The rubric (`Course-Registration-Rubric-Score.md`) was not supplied, so this review checks against the spec's acceptance
criteria, deliverables, candidate expectations and scope boundaries. Verdicts are the AI's; **the engineer should confirm each one.**

### 4.1 Clean-clone check (AI-run, commit `3f660a6`)
Fresh `git clone` into a scratch directory; Node v26.13.0, npm 11.20.0. 24 tracked files; `node_modules/` and `coverage/` are not tracked.

| Command | Result |
|---|---|
| `npm ci` | added 50 packages, 0 vulnerabilities |
| `npx tsc --noEmit` | exit 0 |
| `npm test` | 6 files, **94 passed** |
| `npm run coverage` | 100% statements (109/109), branches (51/51), functions (27/27), lines (91/91) |
| `npm run mutate` | **17/17 mutants killed**, exit 0; clone working tree clean afterwards |

Not checked: Node 22.12 or 24, which are within `engines` but not installed here.

### 4.2 Acceptance criteria
| AC | Requirement | Evidence | Verdict |
|---|---|---|---|
| 1 | Enroll succeeds with capacity and prerequisite met | E1, E2, omitted-prereqs test, U1; mutants a, q, n | **Met** |
| 2 | Full → eligible learner waitlisted once; no duplicate records | E5, E6, E7–E9, normalised-ID duplicate; I2 checked after every call; mutant g | **Met** |
| 3 | Drop opens a seat and promotes the earliest eligible learner | D1–D4, D15, H1 (hand trace); mutants b, d, f | **Met** |
| 4 | Ineligible never enrolled or promoted; skip/retain policy consistent | Policy: DESIGN.md §6 (reject at join, skip-and-remove at the front). Tests E3, E4, E6, D5–D9, E13, missing-record skip; D8 (same rule at both points); mutants c, i | **Met** |
| 5 | Invalid requests and duplicate drops: clear results, no corruption | Explicit codes (DESIGN.md §4); E10–E12, D10–D14, deleted-record tests, F1 directory-failure tests; `expectUnchanged`; S1 oracle; S2; mutants e, h, m | **Met** |
| 6 | Tests cover available, full, duplicate, FIFO, prereq failure, invalid/repeated drops; concurrency test if the starter uses concurrency | Available E1/E2 · full E5/E6 · duplicate E7–E9 · FIFO D2–D4 · prereq failure E3/E4/E6 · invalid/repeated drop D11–D14. No starter, so no locking pattern to preserve; two regression-guard concurrency tests were added anyway (LIMITATIONS #3) | **Met** |
| 7 | AI used; prompts, responses, accept/edit/reject and verification recorded | AI_USAGE.md: entries 0, 0a and 1–16, each with prompt, response, files, and separate AI-run and Engineer-run evidence; a Prompt engineering section. [prompts/](prompts/key-prompts.md): system prompt verbatim; key prompts labelled verbatim, quoted during the session, or summary | **Partial:** every Status was marked by the engineer on 2026-10-29; remaining gap: prompts for entries 0–3 and 7 exist only as summaries, and the "quoted during the session" prompts await engineer confirmation |

### 4.3 Deliverables
| # | Deliverable | Where | Verdict |
|---|---|---|---|
| D1 | Runnable code and focused tests | `src/`, `tests/`; clean clone §4.1 | **Met** |
| D2 | Design spec (boundary, data/API, invariants, promotion rule, concurrency/persistence, assumptions/tradeoffs; proportionate) | DESIGN.md §2, §3–4, §5, §6, §7, §6+§8 (about 150 lines) | **Met** |
| D3 | AI prompt/use record with files/decisions and verification evidence | AI_USAGE.md, VERIFICATION.md, [evidence/engineer-runs.md](evidence/engineer-runs.md), [prompts/](prompts/key-prompts.md) | **Partial:** Statuses marked by the engineer (2026-10-29); prompt gap as AC7. Engineer-run output is recorded for Phases 0–5 and the final code (entries 2, 3, 5, 6, 8, 9, 10, 11). Entry 4 is covered inside the Phase 2 run, not separately. Entry 7 is **pending engineer** (optional) |
| D4 | Setup and run instructions with test commands | README.md (setup, commands with expected results, usage example run as a test) | **Met** |
| D5 | Limitations and follow-up risks | LIMITATIONS.md (19 items) | **Met** |

### 4.4 Candidate expectations
| Expectation | Evidence | Verdict |
|---|---|---|
| Understand the starter, or use the fallback; no frontend | No starter found; fallback recorded in DESIGN.md §1 and AI_USAGE entry 1 | **Met** |
| State prerequisite/waitlist assumptions, incl. ineligible at the queue front | DESIGN.md §6, README "Policy in brief" | **Met** |
| Use AI; independently review and verify; be candid about AI contribution and changes | AI used throughout. Candour: AI_USAGE Summary (rejections, 4 self-corrections), F1 written up openly, and the history rewrite disclosed with a code-identity check. **Engineer-run** ([evidence/engineer-runs.md](evidence/engineer-runs.md)): tests and typecheck at every phase gate from Phase 0 to Phase 5; the tests-first red count (58 failed / 28 passed); coverage at Phases 3 and 4 (shown in part); `npm run mutate` 17/17 at `adf98c6`, including the dirty-tree guard refusing to run; and a full run of the final code with no `tail` (94 passed, every coverage row 100%, mutate 17/17). **Engineer-checked:** the §2 hand trace. **AI-run only:** the invariant review and the §4.1 clean-clone check | **Partial (narrowed):** still needed: a run of entry 7's 90-test state (optional). The full run at the final commit and the hand-trace check are done (engineer) |
| No credentials, secrets or unnecessary sensitive data | Scan of all tracked files: no emails, home paths or secrets; the only learner IDs are `L` + digits | **Met** |
| Prioritise correct capacity/queue behaviour, focused tests and review over features | No runtime deps, no extra features. 94 tests, mutation-checked | **Met** |
| Submit implementation and deliverables together | One git repo, all deliverables at the root | **Met** (packaging and submission are the engineer's action) |

### 4.5 Scope boundaries
| Boundary | Check | Verdict |
|---|---|---|
| One offering's enroll/drop/promotion only | `src/` is 6 files and one `CourseOffering` class | ✔ |
| No frontend, catalog, payments, identity, multi-term, deployment, DB | No runtime dependencies; no `fs`/`http`/DB/UI imports in `src/` | ✔ |
| No configurable policy engine | One hard-coded policy; `LearnerDirectory` is a data port, not a policy hook | ✔ |
| No separate greenfield/brownfield variants | Single implementation | ✔ |
| Extras beyond the minimum (disclosed) | `scripts/mutate.mjs` and VERIFICATION.md (verification tooling and evidence); ID normalisation (engineer-requested) | Acceptable: no product scope added |

### 4.6 Open items for the engineer before submission
1. ~~**Mark every AI_USAGE.md Status**~~ Done 2026-10-29. This closes the AC7/D3 gap (a).
2. ~~**Re-run and record your own results**~~ Done 2026-10-29, 23:15: full run of the final code, no `tail`; 94 passed,
   coverage 100% on every row, mutate 17/17. See [evidence/engineer-runs.md § Final run](evidence/engineer-runs.md#final-run).
3. ~~**Check the hand trace**~~ Done 2026-10-29: engineer checked §2 against `drop()` / `planPromotion()`; both rows matched.
4. **Confirm the prompts** in [prompts/key-prompts.md](prompts/key-prompts.md) marked "quoted during the session", and supply any
   verbatim text you still have for entries 0–3 and 7 (AC7 gap (b)).
5. **Optional:** supply the rubric for a scored review.
6. **Timebox:** the AI has no record of elapsed time. If the assessment asks for it, record hours spent yourself.
7. **Optional:** run an `await` mutant inside `enroll` to turn LIMITATIONS #3's regression-guard claim from reasoned into demonstrated (§1 Limits).
