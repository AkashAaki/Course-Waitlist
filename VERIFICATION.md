# Verification Evidence (Phase 4)

Environment: Node v26.13.0, Vitest 5.0.5. Phase 4 started from commit `d0e680d` (Phase 3: 90/90 passing, 100% coverage).
It found and fixed one defect (F1, §3). The final state is **94/94 passing** with 100% statement, branch, function and
line coverage. Coverage shows that every line *ran*. The mutation checks show that the assertions *notice* when behaviour breaks.

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

**Result: 17/17 killed.** The first run, against `d0e680d` before the F1 fix, used 16 mutants (an earlier version of
this set, not committed) and killed 16/16. The set was then updated for the read-then-write code: the old
"loop ignores capacity" mutant no longer applies, so it was replaced by (h), and (q) was added.

**Thin spots** (caught by only 1–2 tests, which should not be deleted):
- **(o)** is caught only by its unit test. The directory already normalises course IDs, so the integration tests can't see
  this bug. That's defence in depth.
- **(h), (j), (k), (m)** are each pinned by dedicated tests, plus S1 for (j) and (m).

**Limits:** the mutations are hand-picked, not generated (no Stryker). They cover the bugs judged likely, not every
possible bug. The `find` snippets are tied to the current code, so a refactor will produce `ERROR` rows until they are updated.

## 2. Hand trace
Scenario (plan §4): capacity 2; L1 and L2 enrolled; waitlist L3, L4, L5; L4's prerequisite is revoked; drop L1, then drop L2.
The trace below follows the final read-then-write `drop`.

| Step | Read phase (scan waitlist) | Write phase | enrolled | waitlist | Result |
|---|---|---|---|---|---|
| start | — | — | [L1, L2] | [L3, L4, L5] | — |
| drop L1 | L3 eligible → promote L3; skipped [] | remove L1; remove 1 from front; add L3 | [L2, L3] | [L4, L5] | `DROPPED` promoted L3, skipped [] |
| drop L2 | L4 ineligible → skip; L5 eligible → promote L5 | remove L2; remove 2 from front; add L5 | [L3, L5] | [] | `DROPPED` promoted L5, skipped [L4] |

Encoded as test **H1** in `tests/promotion.test.ts`, with expected values taken from this table. It passed on its first run,
both before and after the F1 refactor. **Caveat:** the AI did this trace. It counts as *independent* evidence only once the
engineer has checked it against `drop()` / `planPromotion()`.

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

### 4.1 Clean-clone check (AI-run, commit `1a77787`)
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
| 7 | AI used; prompts, responses, accept/edit/reject and verification recorded | AI_USAGE.md: 12 entries with prompt summary, response summary, files and evidence; Summary section | **Partial:** (a) every Status is still **PENDING** until the engineer marks it; (b) prompts are recorded as *summaries* with key quotes, not verbatim |

### 4.3 Deliverables
| # | Deliverable | Where | Verdict |
|---|---|---|---|
| D1 | Runnable code and focused tests | `src/`, `tests/`; clean clone §4.1 | **Met** |
| D2 | Design spec (boundary, data/API, invariants, promotion rule, concurrency/persistence, assumptions/tradeoffs; proportionate) | DESIGN.md §2, §3–4, §5, §6, §7, §6+§8 (about 150 lines) | **Met** |
| D3 | AI prompt/use record with files/decisions and verification evidence | AI_USAGE.md, VERIFICATION.md | **Partial:** same as AC7; the engineer's own re-run output is recorded for Phase 0 only |
| D4 | Setup and run instructions with test commands | README.md (setup, commands with expected results, usage example run as a test) | **Met** |
| D5 | Limitations and follow-up risks | LIMITATIONS.md (19 items) | **Met** |

### 4.4 Candidate expectations
| Expectation | Evidence | Verdict |
|---|---|---|
| Understand the starter, or use the fallback; no frontend | No starter found; fallback recorded in DESIGN.md §1 and AI_USAGE entry 1 | **Met** |
| State prerequisite/waitlist assumptions, incl. ineligible at the queue front | DESIGN.md §6, README "Policy in brief" | **Met** |
| Use AI; independently review and verify; be candid about AI contribution and changes | AI used throughout. Candour: AI_USAGE Summary (rejections, 4 self-corrections), F1 written up openly. **Independent** verification so far: the engineer re-ran Phase 0 and made every decision; the mutation checks, hand trace and invariant review were AI-run | **Partial:** needs the engineer's own re-run and hand-trace check (see §4.6) |
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
1. **Mark every AI_USAGE.md Status** as Accepted, Edited or Rejected. This closes the AC7/D3 gap (a).
2. **Re-run and record your own results** for the final commit: `npm ci && npm test && npm run coverage && npm run mutate`.
   Paste them into AI_USAGE.md. This is independent evidence; the §4.1 run is the AI's.
3. **Check the hand trace** (§2) against `drop()` / `planPromotion()` yourself.
4. **Optional:** add verbatim prompts as an appendix in AI_USAGE.md (AC7 gap (b)), with local paths redacted.
5. **Optional:** supply the rubric for a scored review.
6. **Timebox:** the AI has no record of elapsed time. If the assessment asks for it, record hours spent yourself.
